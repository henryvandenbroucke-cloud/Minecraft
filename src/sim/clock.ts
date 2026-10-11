import { FIXED_DT, MAX_FRAME_DT, clamp } from './units';

/**
 * Four separate timelines (brief §4):
 *  - realSeconds: wall-clock seconds the app has been running (menus included).
 *  - simSeconds: fixed-step world seconds. Physics, streaming, and mission deadlines use this.
 *  - gameMinutes: the in-game day clock. Driven by simSeconds only, never by slow motion.
 *  - abilityTime: a local presentation/ability timeline that slow motion scales.
 * Slow motion changes abilityTime and nothing else.
 */
export interface ClockConfig {
  /** Real seconds for one full in-game day. PROVISIONAL: reference value not measured. */
  dayLengthRealSeconds: number;
  /** In-game hour at simSeconds = 0. */
  startHour: number;
}

export const DEFAULT_CLOCK_CONFIG: ClockConfig = { dayLengthRealSeconds: 48 * 60, startHour: 10 };

export class SimClock {
  readonly config: ClockConfig;
  realSeconds = 0;
  simSeconds = 0;
  gameMinutes: number;
  abilityTime = 0;
  localScale = 1;
  paused = false;
  private acc = 0;

  constructor(config: ClockConfig = DEFAULT_CLOCK_CONFIG) {
    if (!(config.dayLengthRealSeconds > 0)) throw new Error('dayLengthRealSeconds must be > 0');
    this.config = config;
    this.gameMinutes = config.startHour * 60;
  }

  /** In-game minutes that pass per fixed simulation second. */
  get gameMinutesPerSimSecond(): number {
    return 1440 / this.config.dayLengthRealSeconds;
  }

  get hour(): number {
    return ((this.gameMinutes / 60) % 24 + 24) % 24;
  }

  setLocalScale(scale: number): void {
    this.localScale = clamp(scale, 0.05, 1);
  }

  /**
   * Converts elapsed real time into a number of fixed simulation steps.
   * The caller runs that many steps; the leftover is kept in the accumulator.
   */
  advanceReal(realDt: number): number {
    const dt = clamp(realDt, 0, MAX_FRAME_DT);
    this.realSeconds += dt;
    if (this.paused) return 0;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT;
      steps++;
    }
    return steps;
  }

  /** Called once per fixed step by the owner of the simulation. */
  tick(): void {
    this.simSeconds += FIXED_DT;
    this.gameMinutes += FIXED_DT * this.gameMinutesPerSimSecond;
    this.abilityTime += FIXED_DT * this.localScale;
  }
}
