import { describe, expect, it } from 'vitest';
import { getCharacterRecord, STORY_CHARACTER_IDS } from '../src/sim/content';
import { SaltlineSim } from '../src/sim/game';
import { NEUTRAL_INTENT } from '../src/sim/intent';
import { parseSave, sealSave, type SaveV1 } from '../src/sim/save';

describe('story characters (brief §11 subset)', () => {
  it('T-CHR-001 three protagonists exist with distinct reference colour keys', () => {
    const colours = STORY_CHARACTER_IDS.map((id) => getCharacterRecord(id).color);
    expect(new Set(colours).size).toBe(3);
    expect(colours).toEqual(['blue', 'green', 'orange']);
  });

  it('T-CHR-001 each character keeps its own cash and position in the save', () => {
    const sim = new SaltlineSim({ seed: 5 });
    sim.characters['chr.story.dez_okafor']!.cash = 1234;
    for (let i = 0; i < 60; i++) sim.step({ ...NEUTRAL_INTENT, moveZ: 1 });
    const snap = sealSave(sim.snapshot() as Omit<SaveV1, 'checksum'>);
    const r = parseSave(JSON.stringify(snap));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.characters['chr.story.dez_okafor']!.cash).toBe(1234);
    expect(r.save.characters['chr.story.eli_mercer']!.cash).toBe(0);
    expect(r.save.characters['chr.story.eli_mercer']!.z).toBeGreaterThan(0);
    expect(r.save.characters['chr.story.dez_okafor']!.z).toBe(0);
  });
});
