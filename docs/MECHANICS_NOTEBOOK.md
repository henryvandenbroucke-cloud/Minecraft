# Mechanics notebook

Each entry records what the prototype does, where the number comes from, and how sure we are.
**No number in this file has been measured against the reference game.** Confidence values come
from the registry vocabulary: `published` (dated official or cited source), `observed` (measured in
the reference), `provisional` (designer value), `unknown`.

Values are internal-consistency targets chosen by the builder to make the prototype feel readable.
They are not reference data and must not be quoted as parity.

## Player on foot (`src/sim/player.ts`, `ON_FOOT_TUNING`)

| Quantity | Value | Confidence | Notes |
|---|---|---|---|
| Capsule radius / height | 0.35 m / 1.8 m | provisional | |
| Walk / jog / sprint speed | 1.6 / 3.6 / 6.2 m/s | provisional | Blend and acceleration are tunable; headless QA moved the player 4.4–6.1 m during a wall-clock W hold of about 1.5 s. This is not a calibrated speed measurement (hold timing is not exact and frame rate is low under software rendering). |
| Jump launch speed | 4.4 m/s | provisional | Apex ≈ 0.99 m (v²/2g). |
| Fall damage threshold | 12 m/s impact | provisional | Landing threshold for "land" detection is 0.1 m/s; recheck under T-PLY-001. |
| Gravity | 9.81 m/s² | published (physical constant) | |

Not implemented: vaults, ladders, stairs, swimming, ragdoll, parachuting, cover.

## Vehicle: Kestrel GT (`src/sim/vehicle.ts`, `src/sim/content.ts`)

Model: kinematic bicycle steering with a friction-circle lateral grip limit. Engine curve peak
9000 N, top speed governed at 70 m/s.

| Quantity | Measured in the prototype's own tests | Target / reference | Confidence |
|---|---|---|---|
| Top speed | 57.3 m/s (≈206 km/h) | no reference | provisional |
| 0–100 km/h | 5.97 s | no reference | provisional |
| Braking from 100 km/h | ≈39.5 m | no reference | provisional |
| Steady-state yaw rate at steer | 1.35 rad/s (vs. 1.57 analytic prediction, ≈14% low) | the 14% gap is a known modelling difference | provisional |
| Handbrake | reduces lateral grip; deceleration coefficient tuned, not measured | — | provisional |

In-browser check (headless, software renderer): holding W for 3 s from rest gave 13.5–16.3 m/s.
That is lower than the sim test value because software rendering slows the frame rate, so fewer
fixed steps run per second of wall time (see performance report). It is not a handling measurement.

Handling profile `hp.sports_rwd_provisional` is described in the registry as "tuned for
arcade-readable behaviour, not simulation realism."

## Camera (`src/game/camera-rig.ts`)

| Quantity | Value | Notes |
|---|---|---|
| Third-person default distance | 4.6 m | Tested (T-CAM-001). |
| Camera wall clearance | camera stops ≈ 0.25 m in front of a wall | Tested. |
| First-person eye height (on foot) | 1.6 m | Tested. |
| Pitch clamp | [-1.2, 0.2] rad | Set by hand. |

Gaps: no shoulder aim, no scoped aim, no cinematic or activity cameras, no lock-on, no
recentering behind the car in third person, and no dashboard or mirror in first-person vehicle view.

## Streaming (`src/sim/world`)

| Quantity | Value |
|---|---|
| Block | 80 m square; roads 16 m; pitch 96 m |
| Cell | 2 × 2 blocks = 192 m |
| District | cells −6…5 on each axis = 2304 m square |
| Load radius | 2 cells (25 resident at spawn) |
| Unload radius | 4 cells (hysteresis) |
| Look-ahead | 6 s, capped at 3 cells |
| Immediate load | cells within Chebyshev distance 1 of the focus load regardless of budget |

Collision is axis-aligned boxes only. There is no heightfield terrain and no step-up.

## Vehicle ownership

One personal vehicle. No storage, impound, insurance, duplication guard, or carjacking.

## Economy

`data/economy/tunables-tu1.73.json` holds qualitative notes on the 1.73 economy changes only. Every
numeric value is `null`. Economic numbers are not implemented and are not estimated.

## Open questions for the reference

1. Reference on-foot speeds, acceleration, and turning rates (needs a legitimately owned install and
   a recording rig; not available here).
2. Reference vehicle acceleration, braking, and grip curves for a comparable car.
3. Reference camera framing and field-of-view defaults for each view mode.
4. Reference day length and clock behaviour for Online (the 48-minute value is unverified).
5. Reference controller binding defaults per edition (the pad mapping here is ours).
