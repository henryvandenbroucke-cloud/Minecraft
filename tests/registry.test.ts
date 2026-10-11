import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRegistryDoc, type RegistryDoc } from '../src/sim/registry';

const ROOT = join(__dirname, '..');
const testIds = (() => {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.ts')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/T-[A-Z]+-\d{3}/g)) ids.add(m[0]);
      }
    }
  };
  walk(join(ROOT, 'tests'));
  return ids;
})();

describe('registries (brief §5)', () => {
  const dir = join(ROOT, 'data', 'registries');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    it(`T-REG-001 ${file} is valid and every implemented record cites an existing test`, () => {
      const doc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RegistryDoc;
      expect(validateRegistryDoc(doc, testIds)).toEqual([]);
    });
  }

  it('T-REG-001 validator rejects duplicate ids, bad status, and implemented records without tests', () => {
    const bad = {
      schema_version: 1,
      registry: 'x',
      description: '',
      records: [
        { id: 'a.one', name: 'A', status: 'implemented', source: 's', confidence: 'provisional' },
        { id: 'a.one', name: 'A2', status: 'maybe', source: 's', confidence: 'unknown' },
        { id: 'a.two', name: 'B', status: 'blocked', source: 's', confidence: 'unknown' },
      ],
    };
    const errors = validateRegistryDoc(bad, testIds).join('\n');
    expect(errors).toMatch(/requires test_ids/);
    expect(errors).toMatch(/duplicate id/);
    expect(errors).toMatch(/status must be one of/);
    expect(errors).toMatch(/blocked records need a blocker/);
  });
});
