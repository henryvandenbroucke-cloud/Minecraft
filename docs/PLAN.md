# Saltline — Plan (written before implementation, 2026-10-11)

This document is the plan requested in the brief ("Plan first, then Build"). It records the
stack decision, the reference profile, the environment blockers, the milestone sequence, and
what this session will and will not deliver. Status words follow the brief: unresearched,
researched, implemented, tested, blocked.

## 1. Scope honesty

The brief describes a full GTA V / GTA Online–class product (45+ system families, 69 story
missions, multiplayer heists, 100% checklist, editor, etc.). That is a multi-year, multi-team
production. This session cannot deliver it. The plan therefore:

- Records the **entire** scope as structured data (mission, vehicle, weapon, activity, property,
  economy, and gate registries) with honest status values, so nothing is silently dropped.
- Builds **Milestone A (Foundations)** as working, tested software, and a small slice of
  Milestone B mechanics where they fall naturally out of A (vehicle + on-foot + streaming).
- Labels everything else `unresearched`, `researched`, or `blocked` in the parity matrix and gap register.
- Does **not** claim parity with any reference build. No reference installation is present, so no
  measurement against GTA V has been made.

## 2. Reference profile (researched, not measured)

Full details: `reference_profile.json`. Summary:

- Reference: Grand Theft Auto V Enhanced, PC (Enhanced), with Online Title Update 1.73.
- TU 1.73 released 2026-07-16 for PS5, Xbox Series X|S and PC Enhanced/Legacy (GTA Wiki latest-versions table; Rockstar support article "GTAV Title Update 1.73 Notes", last updated 2026-10-01).
- Drip-feed updates continue after 1.73 (e.g. Halloween event 2026-10-01 to 2026-11-04, Pegassi Horus 2026-09-10). Those are recorded as dated Online content, not as a new executable.
- Executable build number of the reference installation: **unknown**. Third-party build strings seen on download sites were **not** used; they are unverified.
- Controls, aim mode, frame rate, display mode, installed content: **unknown** because no reference installation exists in this sandbox. They are recorded as `unknown`, not guessed.

## 3. Engineering stack decision

Candidate stack per the brief's default: Unreal Engine 5 with C++ simulation. **Rejected for this
environment** for concrete reasons:

- The sandbox has 2 vCPU, 3.8 GiB RAM, 21 GB disk, and an outbound allowlist (github.com,
  codeload, api.github.com, registry.npmjs.org, pypi.org, files.pythonhosted.org). The Epic
  download and an Unreal editor build are not reachable and would not fit in the time/RAM budget.
- No GPU is available for a packaged UE5 build test.

**Chosen stack (browser-hosted native-web build, "equivalent engine" under the brief):**

| Concern | Choice | Pin (installed) |
|---|---|---|
| Language | TypeScript (strict) | 5.x |
| Rendering | three.js (WebGL 2) | 0.186.1 |
| Bundler / dev server | Vite | 8.x |
| Tests | Vitest | 3.x |
| Simulation | pure TypeScript modules, no DOM or three.js imports | — |
| Persistence | versioned JSON with checksums, localStorage, backup slot | — |
| Multiplayer (later) | Node + ws, authoritative server | not started |

Architecture rule (from the brief): simulation rules are independent of rendering and HUD.
`src/sim/` contains only pure logic and is tested with Vitest. `src/game/` (three.js) and `src/ui/` consume it.

**Budgets for the browser profile** (declared now so later tests can check them): target 60 fps
on a mid-range desktop GPU for the Milestone A district; the sandbox has no GPU, so no measured
frame data is claimed in this session.

## 4. Asset strategy

- Everything is original and procedural in this milestone: boxes for buildings, colored primitives
  for characters and cars, a generated sky. Provenance is recorded in `docs/ASSET_PROVENANCE.md`.
- No Rockstar assets, dialogue, songs, cinematics, or extracted data are used or planned.
- Temporary placeholder names are used for the three protagonists and the city. They are marked
  `temporary` in `data/registries/characters.json` and the gap register.

## 5. Units, clocks, state ownership

Defined in `docs/UNITS_AND_CLOCKS.md`. Summary: 1 world unit = 1 metre, Y up, right-handed; fixed
simulation step 1/60 s; separate game clock (in-game day length is a tunable, provisional 48 real
minutes, unverified), real clock, mission clock, and local slow-motion timeline, which does not
change the game clock, deadlines, or saves.

## 6. Milestones and status

| Milestone | Brief's exit evidence | This session |
|---|---|---|
| A — Foundations | build instructions + packaged prototype; registries; input; streamed test district; player; camera; one vehicle; save/load | **Target of this session** |
| B — Free roam | traffic, pedestrians, combat, police, multi-vehicle, phone/HUD | Not started. Traffic, police, combat, and phone are `blocked` behind A's streaming and entity rules |
| C — Story systems | 3 characters, abilities, switching, mission runtime, checkpoints, heist | Not started. Character records exist as data only |
| D — Campaign & activities | regional map, mission catalog, endings, sports, collectibles, checklist | Catalog seeded as `unresearched` records only |
| E — Online foundations | two-client sessions, authority, economy ledger | Not started. Economy snapshot has structure only; no unverified values |
| F — Online content | businesses, heists, updates | Not started |
| G — Production completion | final assets, packaged release, QA, parity review | Not started |

## 7. Immediate work (this session)

1. Freeze reference profile and feature gates (`reference_profile.json`, `feature_gates.json`).
2. Create registries with stable IDs and honest statuses: vehicles, handling profiles,
   weapons, characters, missions, locations, activities, collectibles, properties, economy snapshot, update manifest.
3. Implement Milestone A simulation (clock, input map, player locomotion, collision, cell streamer,
   vehicle model, save schema with migration and recovery).
4. Implement the three.js client (streamed district, third- and first-person cameras, one vehicle,
   HUD, pause/settings, save/load).
5. Tests: unit tests for every sim module plus registry validation. Browser-level checks if a headless
   browser can be obtained from the npm registry; otherwise state that visual checks were not run.
6. Documentation: README (build and run), controls guide, mechanics notebook, parity matrix (generated),
   gap register, test report, asset provenance.
7. Commit and push to `arena/ed62c283-minecraft`.

## 8. Blockers and open decisions

- **Reference installation:** none in the sandbox. Required to measure any handling, police, or
  weapon number. Until the user supplies a legitimately owned installation (or accepts documented
  published observations), the mechanics notebook can only hold `provisional` values.
- **Browser binary for visual QA:** none preinstalled; Playwright/Puppeteer download hosts are not allowlisted.
  An npm-packaged Chromium may work; see the test report for what was actually run.
- **Multiplayer:** the authoritative server depends on Milestone E; it is not part of this session.
- **Naming and identity:** the game name "Saltline" and the characters are temporary. The user can
  change them in one registry file.
