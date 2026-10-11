/**
 * Validates every registry under data/registries plus the reference profile and feature gates.
 * Exit code 1 on any error. Run with: npm run validate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRY_STATUSES, validateRegistryDoc, type RegistryDoc } from '../src/sim/registry';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function collectTestIds(dir: string): Set<string> {
  const ids = new Set<string>();
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.ts')) for (const m of readFileSync(p, 'utf8').matchAll(/T-[A-Z]+-\d{3}/g)) ids.add(m[0]);
    }
  };
  walk(dir);
  return ids;
}

export function run(): number {
  const testIds = collectTestIds(join(ROOT, 'tests'));
  const regDir = join(ROOT, 'data', 'registries');
  const errors: string[] = [];
  const allIds = new Map<string, string>();
  const summary: string[] = [];
  for (const file of readdirSync(regDir).filter((f) => f.endsWith('.json')).sort()) {
    const doc = JSON.parse(readFileSync(join(regDir, file), 'utf8')) as RegistryDoc;
    errors.push(...validateRegistryDoc(doc, testIds));
    const counts: Record<string, number> = Object.fromEntries(REGISTRY_STATUSES.map((s) => [s, 0]));
    for (const r of doc.records ?? []) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      const prev = allIds.get(r.id);
      if (prev) errors.push(`duplicate id ${r.id} in ${prev} and ${file}`);
      else allIds.set(r.id, file);
    }
    summary.push(`${doc.registry.padEnd(20)} ${String(doc.records.length).padStart(4)}  ${REGISTRY_STATUSES.map((s) => `${s}=${counts[s]}`).join(' ')}`);
  }
  for (const f of ['reference_profile.json', 'feature_gates.json', 'package.json']) {
    try {
      JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    } catch (e) {
      errors.push(`${f} is not valid JSON: ${(e as Error).message}`);
    }
  }
  console.log(summary.join('\n'));
  console.log(`\nregistry records: ${allIds.size}; test ids found: ${testIds.size}`);
  if (errors.length) {
    console.error(`\n${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    return 1;
  }
  console.log('registry validation: OK');
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) process.exitCode = run();
