/**
 * Versioned campaign save (brief §28, Milestone A subset).
 *  - Schema version 1 with a migration chain (v0 legacy fixture -> v1).
 *  - FNV-1a checksum over canonical JSON; invalid checksums and out-of-range numbers are rejected.
 *  - Atomic-style slot write: tmp -> backup of previous main -> main -> remove tmp.
 *  - Read recovers from an interrupted write by falling back to tmp, then backup.
 * Settings are NOT stored here (brief §6: independent from campaign saves).
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface CharacterSave {
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  armor: number;
  stamina: number;
  cash: number;
  inVehicleId: string | null;
}

export interface VehicleSave {
  x: number;
  z: number;
  yaw: number;
  v: number;
  u: number;
  r: number;
  health: number;
  ownerId: string | null;
}

export interface SaveV1 {
  schemaVersion: 1;
  savedAt: string;
  seed: number;
  clock: { gameMinutes: number; simSeconds: number };
  activeCharacterId: string;
  mode: 'on_foot' | 'in_vehicle';
  characters: Record<string, CharacterSave>;
  vehicles: Record<string, VehicleSave>;
  checksum: string;
}

export type SaveResult = { ok: true; save: SaveV1; warnings: string[] } | { ok: false; error: string };

/** Stable, key-sorted JSON used for the checksum. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/** 32-bit FNV-1a. Not cryptographic: it detects truncation and accidental corruption only. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function withoutChecksum(save: SaveV1): Omit<SaveV1, 'checksum'> {
  const { checksum: _ignored, ...rest } = save;
  return rest;
}

export function sealSave(save: Omit<SaveV1, 'checksum'>): SaveV1 {
  return { ...save, checksum: fnv1a(canonicalJson(save)) };
}

export function serializeSave(save: SaveV1): string {
  return JSON.stringify(sealSave(withoutChecksum(save)));
}

/** Parses, checks the checksum, migrates, and validates. Never throws. */
export function parseSave(text: string): SaveResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'save is not valid JSON' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'save is not an object' };
  const obj = raw as Record<string, unknown>;

  if (typeof obj.checksum === 'string') {
    const expected = fnv1a(canonicalJson(withoutChecksumRaw(obj)));
    if (expected !== obj.checksum) return { ok: false, error: 'checksum mismatch (truncated or corrupted save)' };
  }

  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : typeof obj.version === 'number' ? obj.version : -1;
  if (version > SAVE_SCHEMA_VERSION) return { ok: false, error: `save schema ${version} is newer than this build` };
  const warnings: string[] = [];
  let migrated: unknown = raw;
  if (version === 0) {
    migrated = migrateV0toV1(obj);
    warnings.push('migrated from schema 0');
  } else if (version !== SAVE_SCHEMA_VERSION) {
    return { ok: false, error: 'unknown save schema version' };
  }
  const errors = validateSaveV1(migrated);
  if (errors.length > 0) return { ok: false, error: `invalid save: ${errors[0]}` };
  return { ok: true, save: migrated as SaveV1, warnings };
}

function withoutChecksumRaw(obj: Record<string, unknown>): Record<string, unknown> {
  const { checksum: _ignored, ...rest } = obj;
  return rest;
}

/** Legacy schema 0: { version: 0, player: {x, z, hp}, money }. Only the fields that existed are kept. */
export function migrateV0toV1(obj: Record<string, unknown>): SaveV1 {
  const p = (obj.player ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const eli: CharacterSave = {
    x: num(p.x, 0),
    y: 0,
    z: num(p.z, 0),
    yaw: 0,
    health: num(p.hp, 100),
    armor: 0,
    stamina: 100,
    cash: num(obj.money, 0),
    inVehicleId: null,
  };
  const characters: Record<string, CharacterSave> = {
    'chr.story.eli_mercer': eli,
    'chr.story.dez_okafor': defaultCharacter(0),
    'chr.story.rourke_vance': defaultCharacter(0),
  };
  return sealSave({
    schemaVersion: 1,
    savedAt: 'migrated-from-v0',
    seed: 1,
    clock: { gameMinutes: 600, simSeconds: 0 },
    activeCharacterId: 'chr.story.eli_mercer',
    mode: 'on_foot',
    characters,
    vehicles: {},
  } as Omit<SaveV1, 'checksum'>);
}

export function defaultCharacter(cash: number): CharacterSave {
  return { x: 0, y: 0, z: 0, yaw: 0, health: 100, armor: 0, stamina: 100, cash, inVehicleId: null };
}

/** Returns human-readable errors. An empty array means the structure is valid. */
export function validateSaveV1(value: unknown): string[] {
  const e: string[] = [];
  if (!value || typeof value !== 'object') return ['not an object'];
  const s = value as Record<string, unknown>;
  if (s.schemaVersion !== 1) e.push('schemaVersion must be 1');
  if (typeof s.seed !== 'number' || !Number.isInteger(s.seed)) e.push('seed must be an integer');
  const clock = s.clock as Record<string, unknown> | undefined;
  if (!clock || !finite(clock.gameMinutes) || !finite(clock.simSeconds) || (clock.simSeconds as number) < 0) e.push('clock invalid');
  if (s.mode !== 'on_foot' && s.mode !== 'in_vehicle') e.push('mode invalid');
  const chars = s.characters as Record<string, Record<string, unknown>> | undefined;
  if (!chars || typeof chars !== 'object') {
    e.push('characters missing');
  } else {
    for (const [id, c] of Object.entries(chars)) {
      for (const k of ['x', 'y', 'z', 'yaw', 'health', 'armor', 'stamina', 'cash']) {
        if (!finite(c[k])) e.push(`${id}.${k} not finite`);
      }
      if (finite(c.health) && ((c.health as number) < 0 || (c.health as number) > 100)) e.push(`${id}.health out of range`);
      if (finite(c.cash) && (c.cash as number) < 0) e.push(`${id}.cash negative`);
      if (finite(c.x) && Math.abs(c.x as number) > 1e6) e.push(`${id}.x out of range`);
      if (finite(c.z) && Math.abs(c.z as number) > 1e6) e.push(`${id}.z out of range`);
    }
    if (typeof s.activeCharacterId !== 'string' || !(s.activeCharacterId in chars)) e.push('activeCharacterId not in characters');
  }
  const vehicles = s.vehicles as Record<string, Record<string, unknown>> | undefined;
  if (!vehicles || typeof vehicles !== 'object') e.push('vehicles missing');
  else
    for (const [id, v] of Object.entries(vehicles)) {
      for (const k of ['x', 'z', 'yaw', 'v', 'u', 'r', 'health']) if (!finite(v[k])) e.push(`${id}.${k} not finite`);
      if (finite(v.health) && ((v.health as number) < 0 || (v.health as number) > 1000)) e.push(`${id}.health out of range`);
    }
  if (typeof s.savedAt !== 'string') e.push('savedAt missing');
  return e;
}

function finite(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

export interface ReadOutcome {
  result: SaveResult;
  source: 'main' | 'tmp' | 'backup' | 'none';
}

/** Slot-based save manager. Slots are 1-based. */
export class SaveManager {
  constructor(
    private readonly store: KeyValueStore,
    private readonly prefix = 'saltline.save.v1',
  ) {}

  private key(slot: number, part: 'main' | 'tmp' | 'bak'): string {
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) throw new Error('slot must be 1..9');
    return `${this.prefix}.slot${slot}.${part}`;
  }

  /** Writes a save as tmp -> backup -> main -> remove tmp. A crash at any point leaves a recoverable state. */
  write(slot: number, save: SaveV1): void {
    const text = serializeSave(save);
    const check = parseSave(text);
    if (!check.ok) throw new Error(`refusing to write invalid save: ${check.error}`);
    this.store.setItem(this.key(slot, 'tmp'), text);
    const previous = this.store.getItem(this.key(slot, 'main'));
    if (previous !== null) this.store.setItem(this.key(slot, 'bak'), previous);
    this.store.setItem(this.key(slot, 'main'), text);
    this.store.removeItem(this.key(slot, 'tmp'));
  }

  read(slot: number): ReadOutcome {
    const warnings: string[] = [];
    const main = this.store.getItem(this.key(slot, 'main'));
    if (main !== null) {
      const r = parseSave(main);
      if (r.ok) return { result: { ok: true, save: r.save, warnings }, source: 'main' };
      warnings.push(`main: ${r.error}`);
    }
    const tmp = this.store.getItem(this.key(slot, 'tmp'));
    if (tmp !== null) {
      const r = parseSave(tmp);
      if (r.ok) {
        // An interrupted write left a complete tmp file: promote it.
        this.store.setItem(this.key(slot, 'main'), tmp);
        this.store.removeItem(this.key(slot, 'tmp'));
        return { result: { ok: true, save: r.save, warnings: [...warnings, 'recovered from interrupted write'] }, source: 'tmp' };
      }
      warnings.push(`tmp: ${r.error}`);
    }
    const bak = this.store.getItem(this.key(slot, 'bak'));
    if (bak !== null) {
      const r = parseSave(bak);
      if (r.ok) return { result: { ok: true, save: r.save, warnings: [...warnings, 'restored from backup'] }, source: 'backup' };
      warnings.push(`backup: ${r.error}`);
    }
    return { result: { ok: false, error: warnings.length ? warnings.join('; ') : 'slot is empty' }, source: 'none' };
  }

  exists(slot: number): boolean {
    return this.store.getItem(this.key(slot, 'main')) !== null || this.store.getItem(this.key(slot, 'bak')) !== null;
  }

  /** Test helper and debug tool: writes raw text into a part of a slot without validation. */
  writeRaw(slot: number, part: 'main' | 'tmp' | 'bak', text: string | null): void {
    if (text === null) this.store.removeItem(this.key(slot, part));
    else this.store.setItem(this.key(slot, part), text);
  }
}
