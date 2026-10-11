# Gap register

Every gap is listed here, with the status the brief requires. A gap is closed only when the
matching registry record moves to `tested` and the test is in `tests/`. "Placeholder" is not a
completion status. Milestone references follow `docs/PLAN.md`.

Status vocabulary: unresearched · researched · implemented · tested · blocked.

## Mechanical fidelity (not claimed anywhere)

| ID | Gap | Status | Milestone | Blocker / note |
|---|---|---|---|---|
| GAP-MEC-01 | No reference measurement for any vehicle, on-foot, camera, or weapon number | blocked | — | No legitimately owned reference installation or recording rig in the sandbox. |
| GAP-MEC-02 | Vehicle yaw rate is ~14% below its analytic prediction | implemented (known deviation) | B | Tuning/model difference; not reviewed. |
| GAP-MEC-03 | Car has no suspension, damage, or deformation | blocked | B | Physics scope. |
| GAP-MEC-04 | On-foot locomotion lacks vaults, ladders, stairs, swimming, ragdoll, parachute | blocked | B | Locomotion scope. |
| GAP-MEC-05 | Collision is boxes only; no heightfield terrain, step-up, roof walking | blocked | B | Needs terrain data. |
| GAP-MEC-06 | Economy numbers are unknown; `data/economy` contains nulls only | blocked | E | Needs authoritative server and reference values. |

## Content coverage

| ID | Gap | Status | Milestone |
|---|---|---|---|
| GAP-CON-01 | Story missions: 77 catalog records, all `unresearched` (brief target 69 story missions; the checklist eligibility rules are not researched) | unresearched | C/D |
| GAP-CON-02 | Activities (41), collectibles (11), weapons (53), properties (34) are `unresearched` | unresearched | B/D |
| GAP-CON-03 | Vehicles: 27 records, one implemented (Kestrel GT, an original stand-in), 26 `unresearched` | implemented/unresearched | B |
| GAP-CON-04 | Checklist targets (69/20/42/14/16) are targets only; qualifying rules unresearched | unresearched | D |
| GAP-CON-05 | Story characters: Eli Mercer only is playable; Dez Okafor and Rourke Vance are records only | implemented/unresearched | C |
| GAP-CON-06 | Map: one 2304 m procedural test district. Not a map of any reference city | implemented | B/G |
| GAP-CON-07 | Events: Halloween 2026 and Business Rivalries are `researched`, not active | researched | B/D |
| GAP-CON-08 | Update manifest (TU 1.73 + drip entries) is `researched`; no content from it is implemented | researched | B–F |
| GAP-CON-09 | Feature-gated content (HSW upgrades, Kortz Center, Career Progress, Mission Creator warp points) closed | blocked | per gate |

## Systems

| ID | System | Status | Milestone | Note |
|---|---|---|---|---|
| GAP-SYS-01 | Police and wanted levels | blocked | B | Needs crime events, perception, AI. |
| GAP-SYS-02 | Traffic and pedestrians | blocked | B | Needs lane graph and AI budget. |
| GAP-SYS-03 | Combat and weapons | blocked | B | No weapon data. |
| GAP-SYS-04 | Story missions runtime | blocked | C | Catalog is a seed only. |
| GAP-SYS-05 | Heists | blocked | C/F | Depends on mission runtime, multiplayer, economy. |
| GAP-SYS-06 | Economy ledger | blocked | E | Needs authoritative server. |
| GAP-SYS-07 | Multiplayer | blocked | E | No server; feature gate closed. |
| GAP-SYS-08 | Audio (engine, footsteps, music, dialogue) | blocked | B+ | No audio is implemented. |
| GAP-SYS-09 | Phone, map, radio | blocked | B | No content or UI. |
| GAP-SYS-10 | Weather and water (only a simple day/night tint) | blocked | B | |
| GAP-SYS-11 | Content tools / editors | blocked | G | Registries are JSON with a validator. |
| GAP-SYS-12 | HUD | researched | — | Works in the browser build; no automated test (sys.hud). |
| GAP-SYS-13 | Save: one slot used; no autosave, slot UI, cloud save | implemented | B | |

## Camera and presentation

| ID | Gap | Status |
|---|---|---|
| GAP-CAM-01 | No shoulder aim, scoped aim, cinematic, or activity cameras | blocked (B) |
| GAP-CAM-02 | Third-person camera does not recentre behind the car | blocked (B) |
| GAP-CAM-03 | First-person vehicle view has no dashboard or mirror | blocked (B) |
| GAP-CAM-04 | No lock-on | blocked (B) |
| GAP-PRS-01 | Figure is a blocky primitive with a bob animation; no rig or animation set | blocked (G) |
| GAP-PRS-02 | Buildings are flat boxes; no textures, lighting detail, or modular kit | blocked (G) |
| GAP-PRS-03 | No audio, no VFX, no lighting beyond a generated sky | blocked (B+/G) |

## Input and platform

| ID | Gap | Status |
|---|---|---|
| GAP-INP-01 | Keyboard and mouse plus basic gamepad only; no hold/tap variants | implemented (partial) |
| GAP-INP-02 | Controller rebinding is not available; pad bindings are fixed | blocked (G) |
| GAP-INP-03 | Aim assist not implemented | blocked (B) |
| GAP-INP-04 | Pointer lock (mouse look) not exercised in automated QA | open verification |
| GAP-PLT-01 | Only Chromium-class browsers were exercised; Firefox and Safari were not | open verification |
| GAP-PLT-02 | No performance measurement on a real GPU; see PERFORMANCE_REPORT | open verification |

## Process

| ID | Gap | Status |
|---|---|---|
| GAP-PRC-01 | Reference build number unknown | unknown |
| GAP-PRC-02 | Reference controls, aim mode, frame rate, display mode, installed content unknown | unknown |
| GAP-PRC-03 | Notebook values are provisional and not reviewed by a second person | open |
