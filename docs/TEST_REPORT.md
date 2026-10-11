# Test report (Milestone A)

Build under test: branch `arena/ed62c283-minecraft`, Milestone A sources, after the changes listed
at the end. Environment: Linux x86_64 sandbox, 2 vCPU, Node 22.22.3, npm (lockfile pinned), no GPU.

## Summary

| Layer | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | pass (strict, no errors) |
| Registry validation | `npm run validate` | pass: 307 records, 15 test IDs, all `test_ids` resolve |
| Unit tests | `npx vitest run` | **66 passed / 66, 12 files** |
| Production build | `npm run build` | pass: `dist/assets/index-*.js` 581.41 kB (149.53 kB gzipped) |
| Browser smoke (packaged build) | `CHROME_PATH=… npm run e2e` | **10/10 passed** in the final two runs; one earlier run failed one check (see below) |

## Unit tests by file

| File | Tests | Covers |
|---|---:|---|
| tests/streaming.test.ts | 6 | streaming load/unload, budgets, immediate neighbour load (T-WRL-001) |
| tests/world.test.ts | 3 | procedural district determinism (T-WRL-002); on-foot to in-vehicle loop, spawn clearance, save/restore (T-SIM-001) |
| tests/save.test.ts | 10 | versioned saves, checksum, backup, interrupted-write recovery, schema-0 migration (T-SAV-001) |
| tests/vehicle.test.ts | 5 | throttle, steering, handbrake, collision response (T-VEH-001..003) |
| tests/characters.test.ts | 2 | character registry integrity (T-CHR-001) |
| tests/clock.test.ts | 5 | fixed step, game-day conversion, pause (T-CLK-001) |
| tests/player.test.ts | 5 | locomotion, jump apex, landing, fall damage (T-PLY-001) |
| tests/registry.test.ts | 14 | registry schema and status rules (T-REG-001) |
| tests/settings.test.ts | 2 | settings defaults and sanitizing (T-SET-001) |
| tests/input.test.ts | 6 | conflicts per context, Space in two contexts, rebinding, deadzones (T-INP-001); **pad-default conflict test added this session** |
| tests/collision.test.ts | 5 | AABB collision and coverage (T-COL-001) |
| tests/camera.test.ts | 3 | wall clip, default 4.6 m distance, first-person eye height 1.6 m (T-CAM-001) |
| (cross-cutting) | — | T-SIM-001 is in `tests/world.test.ts`: walk to car, enter, drive, exit without ending inside a building; spawn outside building footprints; save and restore of on-foot and in-vehicle state |

Test IDs use the brief's scheme `T-<AREA>-NNN`. `tools/validate-registries.ts` checks that every
`test_id` in a registry appears in `tests/`.

## Registry status changes made from these results

15 records were `implemented` with test IDs that exist and pass. They are now `tested`:
`chr.story.eli_mercer`, `hp.sports_rwd_provisional`, `loc.saltline.test_district`, `sys.input`,
`sys.clock`, `sys.player_locomotion`, `sys.collision`, `sys.camera`, `sys.world_streaming`,
`sys.procedural_district`, `sys.vehicles_car`, `sys.vehicle_ownership`, `sys.save_persistence`,
`sys.story_characters`, `veh.kestrel_gt`.

`sys.hud` stays `researched` because the HUD runs in the browser build but has no automated test.

## Browser smoke test

Script: `tools/browser-smoke/smoke.mjs` (`npm run e2e`). Chromium 153 driven through puppeteer-core,
software WebGL (`--use-angle=swiftshader`), packaged build from `vite preview` on port 4173.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Start screen loads with canvas | pass | |
| 2 | Sim boots with 25 resident cells and collision coverage | pass | |
| 3 | W moves the player | pass | 4.4–6.1 m in a ~1.5 s hold (wall-clock; not a speed measurement) |
| 4 | F5 quick save writes slot 1 | pass | `saltline.save.v1.slot1.main` |
| 5 | Escape opens pause and freezes sim | pass | `{hidden:false, paused:true}` |
| 6 | Resume unfreezes sim | pass | |
| 7 | F enters the Kestrel GT when near | pass | mode `in_vehicle` |
| 8 | W accelerates the car | pass | 13.5–16.3 m/s after 3 s |
| 9 | S brakes the car | pass | 16.3 → 0.3 m/s and 13.5 → 0.0 m/s |
| 10 | No uncaught page errors | pass | |

Runs after the failure: three, all 10/10. One was before the pad-binding fix; two were after the rebuild.

**Known flake:** the first run of this script, before the final edits, failed check 5 (Escape pause).
The sim and the pause state were not captured at the time. Three later runs passed. The cause is not
known; see `docs/KNOWN_ISSUES.md` item 10.

Screenshots from the packaged build (committed in `docs/screenshots/`):

- `docs/screenshots/milestone-a-start.png`: start overlay and street scene.
- `docs/screenshots/milestone-a-driving-swiftshader.png`: driving view in the Kestrel GT (software renderer).

Earlier QA (`/home/user/browser-tools/`, outside the repo) also captured the pause menu and
confirmed the HUD and the Kestrel GT in the distance. Those screenshots were checked by eye, not
by automated pixel comparison.

## What these tests do not show

- They do not measure physics against any reference game. Every vehicle and on-foot number is
  internal-consistency only (`docs/MECHANICS_NOTEBOOK.md`).
- They do not test pointer lock, Firefox, Safari, gamepads, F9 quick load, or the first-person vehicle view.
- They do not test frame rate on GPU hardware (`docs/PERFORMANCE_REPORT.md`).
- The browser checks use fixed waits and wall-clock holds, so they can be slow or variable.
- The brief's acceptance scenarios 1–35 have **not** been mapped one by one in this milestone. Only the
  Milestone A test IDs above are evidence. Other scenarios are not claimed as passed.

## Changes made during this test pass

1. `src/game/input.ts`: press latch (`tapped` set) so press-and-release in one frame still registers.
2. `src/sim/input-actions.ts`: `reload` no longer shares pad button 2 with `interact`.
3. `tests/input.test.ts`: added a pad-default conflict test.
4. `feature_gates.json`: `dev_tools` renamed to `diagnostics_overlay`, enabled in every build.
5. `data/registries/*.json`: 15 records promoted to `tested` (see above).
6. `package.json`: added `e2e`, `test:all`, and pinned `puppeteer-core` 25.13.0 as a dev dependency.
7. `.gitignore`: anchored generated-output patterns to the root.
