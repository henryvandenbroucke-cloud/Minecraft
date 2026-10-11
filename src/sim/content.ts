import handlingDoc from '../../data/registries/handling_profiles.json';
import vehicleDoc from '../../data/registries/vehicles.json';
import characterDoc from '../../data/registries/characters.json';
import type { HandlingProfile } from './vehicle';
import type { RegistryDoc, RegistryRecord } from './registry';

const handling = handlingDoc as unknown as RegistryDoc;
const vehicles = vehicleDoc as unknown as RegistryDoc;
const characters = characterDoc as unknown as RegistryDoc;

export function findRecord(doc: RegistryDoc, id: string): RegistryRecord {
  const r = doc.records.find((x) => x.id === id);
  if (!r) throw new Error(`Registry ${doc.registry} has no record ${id}`);
  return r;
}

/** Converts a handling record into a typed profile. Throws on a missing or non-numeric field. */
export function parseHandlingProfile(r: RegistryRecord): HandlingProfile {
  const num = (k: string): number => {
    const v = r[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`handling ${r.id}.${k} must be a finite number`);
    return v;
  };
  return {
    id: r.id,
    mass_kg: num('mass_kg'),
    wheelbase_m: num('wheelbase_m'),
    max_steer_deg: num('max_steer_deg'),
    steer_speed_falloff_mps: num('steer_speed_falloff_mps'),
    engine_peak_force_n: num('engine_peak_force_n'),
    engine_max_speed_mps: num('engine_max_speed_mps'),
    drag_coefficient_cdA: num('drag_coefficient_cdA'),
    rolling_resistance_n: num('rolling_resistance_n'),
    brake_decel_mps2: num('brake_decel_mps2'),
    handbrake_decel_mps2: num('handbrake_decel_mps2'),
    handbrake_grip_factor: num('handbrake_grip_factor'),
    lateral_grip_mu: num('lateral_grip_mu'),
    wet_grip_factor: num('wet_grip_factor'),
    length_m: num('length_m'),
    width_m: num('width_m'),
  };
}

export const KESTREL_GT_ID = 'veh.kestrel_gt';
export const KESTREL_HANDLING_ID = 'hp.sports_rwd_provisional';

export function getHandlingProfile(id: string): HandlingProfile {
  return parseHandlingProfile(findRecord(handling, id));
}

export function getVehicleRecord(id: string): RegistryRecord {
  return findRecord(vehicles, id);
}

export function getCharacterRecord(id: string): RegistryRecord {
  return findRecord(characters, id);
}

export const STORY_CHARACTER_IDS = ['chr.story.eli_mercer', 'chr.story.dez_okafor', 'chr.story.rourke_vance'] as const;
