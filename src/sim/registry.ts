/**
 * Registry document schema and validation (brief §5). Pure functions: used by the Vite build,
 * by Vitest, and by tools/validate-registries.ts.
 */
export const REGISTRY_STATUSES = ['unresearched', 'researched', 'implemented', 'tested', 'blocked'] as const;
export const REGISTRY_CONFIDENCE = ['published', 'observed', 'provisional', 'unknown'] as const;
export type RegistryStatus = (typeof REGISTRY_STATUSES)[number];

export interface RegistryRecord {
  id: string;
  name: string;
  status: RegistryStatus;
  source: string | string[];
  confidence: (typeof REGISTRY_CONFIDENCE)[number];
  test_ids?: string[];
  blocker?: string;
  [key: string]: unknown;
}

export interface RegistryDoc {
  schema_version: number;
  registry: string;
  description: string;
  records: RegistryRecord[];
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;

export function validateRegistryDoc(doc: unknown, knownTestIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== 'object') return ['document is not an object'];
  const d = doc as Partial<RegistryDoc>;
  if (d.schema_version !== 1) errors.push('schema_version must be 1');
  if (typeof d.registry !== 'string' || d.registry.length === 0) errors.push('registry name missing');
  if (!Array.isArray(d.records)) return [...errors, 'records must be an array'];
  const seen = new Set<string>();
  for (const [i, r] of d.records.entries()) {
    const where = `${d.registry ?? '?'}[${i}]${typeof r?.id === 'string' ? ` (${r.id})` : ''}`;
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: record is not an object`);
      continue;
    }
    if (typeof r.id !== 'string' || !ID_PATTERN.test(r.id)) errors.push(`${where}: id must match ${ID_PATTERN}`);
    else if (seen.has(r.id)) errors.push(`${where}: duplicate id`);
    else seen.add(r.id);
    if (typeof r.name !== 'string' || r.name.length === 0) errors.push(`${where}: name missing`);
    if (!REGISTRY_STATUSES.includes(r.status as RegistryStatus)) errors.push(`${where}: status must be one of ${REGISTRY_STATUSES.join('|')}`);
    if (!REGISTRY_CONFIDENCE.includes(r.confidence as never)) errors.push(`${where}: confidence invalid`);
    const hasSource = typeof r.source === 'string' ? r.source.length > 0 : Array.isArray(r.source) && r.source.length > 0;
    if (!hasSource) errors.push(`${where}: source missing`);
    if (r.status === 'implemented' || r.status === 'tested') {
      if (!Array.isArray(r.test_ids) || r.test_ids.length === 0) errors.push(`${where}: ${r.status} requires test_ids`);
      else
        for (const t of r.test_ids) if (!knownTestIds.has(t)) errors.push(`${where}: test id ${t} not found in tests/`);
    }
    if (r.status === 'blocked' && (typeof r.blocker !== 'string' || r.blocker.length === 0)) {
      errors.push(`${where}: blocked records need a blocker description`);
    }
  }
  return errors;
}
