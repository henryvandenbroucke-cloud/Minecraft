/**
 * Per-frame player intent. The browser input layer converts keyboard, mouse, and gamepad state
 * into this structure, so the simulation never reads raw devices.
 */
export interface Intent {
  /** Desired ground-plane direction in WORLD space (camera-relative already applied), magnitude 0..1. */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  /** Edge-triggered: true only on the frame the button went down. */
  jumpPressed: boolean;
  interactPressed: boolean;
  hornHeld: boolean;
  headlightsPressed: boolean;
  /** Vehicle controls, each 0..1 except steer -1..1. */
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

export const NEUTRAL_INTENT: Intent = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  jumpPressed: false,
  interactPressed: false,
  hornHeld: false,
  headlightsPressed: false,
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
};
