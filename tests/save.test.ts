import { describe, expect, it } from 'vitest';
import { MemoryStore, SaveManager, parseSave, serializeSave, sealSave, validateSaveV1, migrateV0toV1, type SaveV1 } from '../src/sim/save';
import { SaltlineSim } from '../src/sim/game';
import { NEUTRAL_INTENT } from '../src/sim/intent';

function sampleSave(): SaveV1 {
  const sim = new SaltlineSim({ seed: 3 });
  for (let i = 0; i < 90; i++) sim.step({ ...NEUTRAL_INTENT, moveZ: 1 });
  return sealSave(sim.snapshot() as Omit<SaveV1, 'checksum'>);
}

describe('save schema, migration, and recovery (brief §28 subset)', () => {
  it('T-SAV-001 round-trips a save with a valid checksum', () => {
    const s = sampleSave();
    const parsed = parseSave(serializeSave(s));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.save.characters).toEqual(s.characters);
  });

  it('T-SAV-001 rejects a tampered save via checksum mismatch', () => {
    const text = serializeSave(sampleSave());
    const tampered = text.replace(/"cash":0/, '"cash":999999');
    const r = parseSave(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/checksum/);
  });

  it('T-SAV-001 rejects truncated and non-JSON saves without throwing', () => {
    const text = serializeSave(sampleSave());
    expect(parseSave(text.slice(0, text.length / 2)).ok).toBe(false);
    expect(parseSave('not json').ok).toBe(false);
    expect(parseSave('[]').ok).toBe(false);
  });

  it('T-SAV-001 validation flags out-of-range and non-finite values', () => {
    const s = sampleSave() as unknown as Record<string, unknown>;
    const chars = s.characters as Record<string, Record<string, unknown>>;
    const eli = chars['chr.story.eli_mercer']!;
    eli.health = 500;
    eli.cash = -1;
    eli.x = Number.NaN;
    const errors = validateSaveV1(s);
    expect(errors.join(' ')).toMatch(/health out of range/);
    expect(errors.join(' ')).toMatch(/cash negative/);
    expect(errors.join(' ')).toMatch(/x not finite/);
  });

  it('T-SAV-001 migrates the legacy schema-0 fixture to schema 1 with defaults for missing fields', () => {
    const legacy = { version: 0, player: { x: 12, z: -4, hp: 80 }, money: 500 };
    const r = parseSave(JSON.stringify(legacy));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.schemaVersion).toBe(1);
      expect(r.save.characters['chr.story.eli_mercer']!.cash).toBe(500);
      expect(r.save.characters['chr.story.eli_mercer']!.health).toBe(80);
      expect(r.warnings.join(' ')).toMatch(/migrated/);
    }
    expect(validateSaveV1(migrateV0toV1(legacy as Record<string, unknown>))).toEqual([]);
  });

  it('T-SAV-001 refuses saves from a newer build instead of guessing', () => {
    const r = parseSave(JSON.stringify({ schemaVersion: 99 }));
    expect(r.ok).toBe(false);
  });

  it('T-SAV-001 an interrupted write leaves the previous main save readable', () => {
    const store = new MemoryStore();
    const mgr = new SaveManager(store);
    const first = sampleSave();
    mgr.write(1, first);
    // Simulate a crash after writing tmp but before main was replaced: tmp is half-written garbage.
    mgr.writeRaw(1, 'tmp', '{"schemaVersion":1,"sav');
    const out = mgr.read(1);
    expect(out.result.ok).toBe(true);
    expect(out.source).toBe('main');
  });

  it('T-SAV-001 a corrupted main file recovers from a complete tmp file, then from the backup', () => {
    const store = new MemoryStore();
    const mgr = new SaveManager(store);
    const a = sampleSave();
    mgr.write(2, a);
    const b = sampleSave();
    mgr.write(2, b); // main = b, bak = a
    // Corrupt main, keep tmp complete: expect promotion of tmp.
    mgr.writeRaw(2, 'main', '{broken');
    mgr.writeRaw(2, 'tmp', serializeSave(b));
    const fromTmp = mgr.read(2);
    expect(fromTmp.source).toBe('tmp');
    expect(fromTmp.result.ok).toBe(true);
    // Now corrupt main and drop tmp: expect the backup.
    mgr.writeRaw(2, 'main', '{broken');
    mgr.writeRaw(2, 'tmp', null);
    const fromBak = mgr.read(2);
    expect(fromBak.source).toBe('backup');
    expect(fromBak.result.ok).toBe(true);
  });

  it('T-SAV-001 an empty slot reports a clear error rather than a default save', () => {
    const r = new SaveManager(new MemoryStore()).read(3);
    expect(r.result.ok).toBe(false);
    expect(r.source).toBe('none');
  });

  it('T-SAV-001 refuses to write an invalid save', () => {
    const bad = { ...sampleSave(), mode: 'flying' } as unknown as SaveV1;
    expect(() => new SaveManager(new MemoryStore()).write(1, bad)).toThrow(/invalid/);
  });
});
