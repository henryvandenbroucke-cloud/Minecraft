import { makeAabb, type Aabb } from './collision';
import { SimClock, type ClockConfig } from './clock';
import { NEUTRAL_INTENT, type Intent } from './intent';
import { KESTREL_GT_ID, KESTREL_HANDLING_ID, getHandlingProfile, STORY_CHARACTER_IDS } from './content';
import { makeOnFoot, stepOnFoot, type OnFootState, ON_FOOT_TUNING } from './player';
import { pushCylinderOutOfBoxes } from './collision';
import { makeCar, rightOf, stepCar, type CarState, type HandlingProfile } from './vehicle';
import { type CharacterSave, type SaveV1, type VehicleSave, defaultCharacter } from './save';
import { CELL_SIZE, PARKED_CAR_SPAWN, REGION_BOUNDS, SPAWN_POINT, generateCell, type CellData } from './world/district';
import { CellStreamer, DEFAULT_STREAMING, keyOf, type StreamingConfig } from './world/streaming';
import { ColliderIndex } from './world/collider-index';
import { wrapAngle } from './units';

export type SimEvent =
  | { type: 'cell_loaded'; cx: number; cz: number }
  | { type: 'cell_unloaded'; cx: number; cz: number }
  | { type: 'entered_vehicle'; vehicleId: string }
  | { type: 'exited_vehicle'; vehicleId: string }
  | { type: 'landed'; impact: number }
  | { type: 'car_impact'; speed: number; vehicleId: string };

export interface SaltlineSimOptions {
  seed?: number;
  clock?: ClockConfig;
  streaming?: StreamingConfig;
  /** Maximum background cell loads per fixed step (mandatory loads around the focus are never limited). */
  loadsPerStep?: number;
}

/** Four static walls at the region edge so the player cannot walk into the void. */
/** Wet-road grip factor. Weather is not implemented yet, so the value is dry (1). */
const WET_FACTOR = 1;
const WALL = 2;
const WALL_HEIGHT = 300;

/**
 * Milestone A simulation aggregate: streamed district, on-foot character, one vehicle, enter/exit.
 * The renderer reads state and events; it never writes sim state.
 */
export class SaltlineSim {
  readonly seed: number;
  readonly clock: SimClock;
  readonly streamer: CellStreamer;
  readonly colliders: ColliderIndex;
  readonly loadsPerStep: number;
  readonly handling: HandlingProfile;

  mode: 'on_foot' | 'in_vehicle' = 'on_foot';
  activeCharacterId: string = STORY_CHARACTER_IDS[0];
  player: OnFootState;
  /** Per-character saved state for characters that are not active. */
  readonly characters: Record<string, CharacterSave>;
  car: CarState;
  readonly vehicleOwner: string;
  readonly boundaryBoxes: Aabb[];

  private readonly cellData = new Map<string, CellData>();
  private readonly events: SimEvent[] = [];
  private readonly scratchBoxes: Aabb[] = [];
  private readonly landing = { landed: false, jumped: false, impactSpeed: 0 };

  constructor(opts: SaltlineSimOptions = {}) {
    this.seed = opts.seed ?? 20261011;
    this.clock = new SimClock(opts.clock);
    this.streamer = new CellStreamer(opts.streaming ?? DEFAULT_STREAMING);
    this.colliders = new ColliderIndex(CELL_SIZE);
    this.loadsPerStep = opts.loadsPerStep ?? 2;
    this.handling = getHandlingProfile(KESTREL_HANDLING_ID);
    this.vehicleOwner = STORY_CHARACTER_IDS[0];

    this.boundaryBoxes = [
      makeAabb(REGION_BOUNDS.minX - WALL, 0, REGION_BOUNDS.minZ, REGION_BOUNDS.minX, WALL_HEIGHT, REGION_BOUNDS.maxZ),
      makeAabb(REGION_BOUNDS.maxX, 0, REGION_BOUNDS.minZ, REGION_BOUNDS.maxX + WALL, WALL_HEIGHT, REGION_BOUNDS.maxZ),
      makeAabb(REGION_BOUNDS.minX, 0, REGION_BOUNDS.minZ - WALL, REGION_BOUNDS.maxX, WALL_HEIGHT, REGION_BOUNDS.minZ),
      makeAabb(REGION_BOUNDS.minX, 0, REGION_BOUNDS.maxZ, REGION_BOUNDS.maxX, WALL_HEIGHT, REGION_BOUNDS.maxZ + WALL),
    ];

    this.characters = {};
    for (const id of STORY_CHARACTER_IDS) this.characters[id] = defaultCharacter(0);
    this.player = makeOnFoot(SPAWN_POINT.x, SPAWN_POINT.z, 0);
    this.car = makeCar(KESTREL_GT_ID, PARKED_CAR_SPAWN.x, PARKED_CAR_SPAWN.z, PARKED_CAR_SPAWN.yaw);
    this.warmup();
  }

  // ---- streaming -------------------------------------------------------------------------

  private focus() {
    if (this.mode === 'in_vehicle') {
      const sp = this.car.v;
      return { x: this.car.x, z: this.car.z, vx: sp * Math.sin(this.car.yaw), vz: sp * Math.cos(this.car.yaw) };
    }
    return { x: this.player.x, z: this.player.z, vx: this.player.vx, vz: this.player.vz };
  }

  /** Loads every cell in the streamer's load ring immediately. Used at start-up and after restore. */
  warmup(): void {
    const f = this.focus();
    for (let guard = 0; guard < 500; guard++) {
      const plan = this.streamer.plan(f);
      if (plan.toLoad.length === 0) break;
      for (const [cx, cz] of plan.toLoad) this.loadCell(cx, cz);
    }
    // Events stay queued so a renderer that is already showing cells (after a restore) sees loads and unloads.
  }

  private loadCell(cx: number, cz: number): void {
    const key = keyOf(cx, cz);
    if (this.cellData.has(key)) return;
    const data = generateCell(this.seed, cx, cz);
    this.cellData.set(key, data);
    const boxes = data.buildings.map((b) => makeAabb(b.x0, 0, b.z0, b.x1, b.height, b.z1));
    this.colliders.setCell(key, cx, cz, boxes);
    this.streamer.markLoaded(cx, cz);
    this.events.push({ type: 'cell_loaded', cx, cz });
  }

  private unloadCell(cx: number, cz: number): void {
    const key = keyOf(cx, cz);
    this.cellData.delete(key);
    this.colliders.removeCell(key);
    this.streamer.markUnloaded(cx, cz);
    this.events.push({ type: 'cell_unloaded', cx, cz });
  }

  /** Cell data currently resident (renderer uses it to build meshes). */
  getCell(cx: number, cz: number): CellData | undefined {
    return this.cellData.get(keyOf(cx, cz));
  }

  /** Returns and clears queued events. */
  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /**
   * Collision coverage guarantee (brief §8): the cell under the focus and its immediate ring
   * are always resident before the step runs. Background loads are budgeted.
   */
  private streamStep(): void {
    const f = this.focus();
    const plan = this.streamer.plan(f);
    const fcx = Math.floor(f.x / CELL_SIZE);
    const fcz = Math.floor(f.z / CELL_SIZE);
    let budget = this.loadsPerStep;
    for (const [cx, cz] of plan.toLoad) {
      // plan.toLoad is nearest-first. The focus ring is mandatory; background and look-ahead cells use the budget.
      const mandatory = Math.max(Math.abs(cx - fcx), Math.abs(cz - fcz)) <= 1;
      if (!mandatory) {
        if (budget <= 0) continue;
        budget--;
      }
      this.loadCell(cx, cz);
    }
    for (const [cx, cz] of plan.toUnload) this.unloadCell(cx, cz);
  }

  /** True when the collision for the cells around the focus is resident. Used by tests and HUD diagnostics. */
  collisionCoverageOk(): boolean {
    const f = this.focus();
    const fcx = Math.floor(f.x / CELL_SIZE);
    const fcz = Math.floor(f.z / CELL_SIZE);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const x = fcx + i;
        const z = fcz + j;
        const inside = x * CELL_SIZE >= REGION_BOUNDS.minX && (x + 1) * CELL_SIZE <= REGION_BOUNDS.maxX;
        const insideZ = z * CELL_SIZE >= REGION_BOUNDS.minZ && (z + 1) * CELL_SIZE <= REGION_BOUNDS.maxZ;
        if (inside && insideZ && !this.colliders.has(keyOf(x, z))) return false;
      }
    }
    return true;
  }

  // ---- stepping --------------------------------------------------------------------------

  /** Advances one fixed simulation step. */
  step(intent: Intent = NEUTRAL_INTENT, dt = 1 / 60): void {
    this.streamStep();
    this.clock.tick();

    if (this.mode === 'on_foot') {
      if (intent.interactPressed && this.canEnterCar()) this.enterCar();
      const boxes = this.gatherBoxes(this.player.x, this.player.z, 4);
      stepOnFoot(this.player, intent, dt, boxes, this.landing);
      if (this.landing.landed) this.events.push({ type: 'landed', impact: this.landing.impactSpeed });
    } else {
      if (intent.interactPressed && Math.abs(this.car.v) < 1) this.exitCar();
      if (this.mode === 'in_vehicle') {
        const drive: Intent = this.car.health <= 0 ? { ...intent, throttle: 0 } : intent;
        const boxes = this.gatherBoxes(this.car.x, this.car.z, 8);
        stepCar(this.car, this.handling, drive, dt, boxes, WET_FACTOR);
        if (this.car.lastImpact > 4) this.events.push({ type: 'car_impact', speed: this.car.lastImpact, vehicleId: this.car.id });
        this.syncPlayerToCar();
      }
    }
  }

  private gatherBoxes(x: number, z: number, margin: number): Aabb[] {
    const out = this.scratchBoxes;
    out.length = 0;
    this.colliders.query(x - margin, z - margin, x + margin, z + margin, out);
    for (const b of this.boundaryBoxes) out.push(b);
    return out;
  }

  // ---- vehicles --------------------------------------------------------------------------

  distanceToCar(): number {
    return Math.hypot(this.player.x - this.car.x, this.player.z - this.car.z);
  }

  canEnterCar(): boolean {
    return this.car.health > 0 && this.distanceToCar() <= 3.0 && Math.abs(this.car.v) < 1;
  }

  enterCar(): void {
    this.mode = 'in_vehicle';
    this.events.push({ type: 'entered_vehicle', vehicleId: this.car.id });
    this.syncPlayerToCar();
  }

  /** Exits on the right side if clear, otherwise the left side. Never places the player inside geometry. */
  exitCar(): void {
    const R = rightOf(this.car.yaw);
    const candidates = [1, -1].map((s) => ({ x: this.car.x + R.x * 1.6 * s, z: this.car.z + R.z * 1.6 * s, yaw: this.car.yaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2) }));
    let placed = false;
    for (const c of candidates) {
      const boxes = this.gatherBoxes(c.x, c.z, 3);
      const res = pushCylinderOutOfBoxes(c.x, c.z, 0, ON_FOOT_TUNING.height, ON_FOOT_TUNING.radius, boxes);
      if (!res.hit) {
        this.player.x = c.x;
        this.player.z = c.z;
        this.player.yaw = wrapAngle(c.yaw);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Both sides blocked: stay at the car's centre offset rather than inside a wall.
      this.player.x = this.car.x + R.x * 1.6;
      this.player.z = this.car.z + R.z * 1.6;
    }
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.y = 0;
    this.player.vy = 0;
    this.player.onGround = true;
    this.mode = 'on_foot';
    this.events.push({ type: 'exited_vehicle', vehicleId: this.car.id });
  }

  private syncPlayerToCar(): void {
    this.player.x = this.car.x;
    this.player.z = this.car.z;
    this.player.yaw = this.car.yaw;
    this.player.vx = this.car.v * Math.sin(this.car.yaw);
    this.player.vz = this.car.v * Math.cos(this.car.yaw);
  }

  get isDriving(): boolean {
    return this.mode === 'in_vehicle';
  }

  // ---- save / restore --------------------------------------------------------------------

  /** Snapshot of campaign state (without checksum). Save manager seals it. */
  snapshot(): Omit<SaveV1, 'checksum'> {
    const characters: Record<string, CharacterSave> = { ...this.characters };
    const active = this.characters[this.activeCharacterId] ?? defaultCharacter(0);
    characters[this.activeCharacterId] = {
      ...active,
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
      yaw: this.player.yaw,
      health: this.player.health,
      stamina: this.player.stamina,
      inVehicleId: this.mode === 'in_vehicle' ? this.car.id : null,
    };
    const vehicles: Record<string, VehicleSave> = {
      [this.car.id]: {
        x: this.car.x,
        z: this.car.z,
        yaw: this.car.yaw,
        v: this.car.v,
        u: this.car.u,
        r: this.car.r,
        health: this.car.health,
        ownerId: this.vehicleOwner,
      },
    };
    return {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      seed: this.seed,
      clock: { gameMinutes: this.clock.gameMinutes, simSeconds: this.clock.simSeconds },
      activeCharacterId: this.activeCharacterId,
      mode: this.mode,
      characters,
      vehicles,
    };
  }

  /** Restores a validated save. Collision is warmed before the first step, so the player never falls through. */
  restore(save: SaveV1): void {
    this.clock.gameMinutes = save.clock.gameMinutes;
    this.clock.simSeconds = save.clock.simSeconds;
    this.activeCharacterId = save.activeCharacterId;
    for (const [id, c] of Object.entries(save.characters)) this.characters[id] = { ...c };
    const ch = save.characters[save.activeCharacterId]!;
    this.player = makeOnFoot(ch.x, ch.z, ch.yaw, ch.health);
    this.player.y = ch.y;
    this.player.stamina = ch.stamina;
    const v = save.vehicles[KESTREL_GT_ID];
    if (v) {
      this.car = makeCar(KESTREL_GT_ID, v.x, v.z, v.yaw);
      this.car.v = v.v;
      this.car.u = v.u;
      this.car.r = v.r;
      this.car.health = v.health;
    }
    this.mode = save.mode;
    if (this.mode === 'in_vehicle' && v) this.syncPlayerToCar();
    this.warmup();
  }

}
