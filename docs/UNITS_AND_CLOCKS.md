# Units, timestep, and clocks

Source: `src/sim/units.ts`, `src/sim/clock.ts`.

## Units

- 1 world unit = 1 metre. Y is up; the system is right-handed.
- Yaw 0 faces +Z. Forward for yaw θ is `(sin θ, 0, cos θ)`; right is `(-cos θ, 0, sin θ)`.
  Positive steer turns right (yaw decreases).
- Speeds are stored in m/s; the HUD converts to km/h (×3.6).
- Gravity 9.81 m/s².

## Fixed timestep

- Simulation runs at a fixed **1/60 s** step (`SIM_HZ = 60`).
- Real frame deltas are clamped to **0.25 s** (`MAX_FRAME_DT`) so a stalled tab cannot create
  hundreds of physics steps. Time beyond the clamp is discarded, not replayed. This makes the sim
  run slower than real time on slow machines; see the performance report.

## Clocks

Five clocks exist, and they are deliberately separate:

| Clock | Owner | Advances | Used for |
|---|---|---|---|
| Real | browser | wall time | UI timing, save timestamps |
| Sim | `Clock` | fixed steps while not paused | physics, AI, streaming budgets |
| Game day | `Clock` | sim time × 1440 / `dayLengthRealSeconds` | time of day, schedules |
| Mission | (not built) | mission-local | mission timers (Milestone C) |
| Local slow-motion timeline | (not built as an ability) | scaled presentation time | presentation only |

- Game day length is **48 real minutes** (`DEFAULT_CLOCK_CONFIG`). This is a **provisional
  designer value**, not measured from the reference. Start time is 10:00.
- Pause zeroes the sim clock advance. Pause is also set when the pointer lock is lost.
- **Local slow motion must not alter** the game clock, mission deadlines, or saves. The rule is
  stated here and in the gap register; the slow-motion ability itself is not implemented.

## Save clock

Saves store sim state and the game-day value. Saves do not store real timestamps as game state.
