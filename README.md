# Saltline

Saltline is an original, browser-hosted open-world action prototype. It is an **independent
project**: it does not use, copy, or extract any Rockstar Games code, assets, dialogue, music,
or cinematics. Its design is informed by publicly observable mechanics of a reference title
(Grand Theft Auto V Enhanced, PC, Title Update 1.73), and its parity claims are tracked honestly in
the documents listed below.

> **Status: Milestone A (Foundations) prototype.** It is a playable slice of one streamed test
> district, one car, and one on-foot character. Milestones B–G (free roam systems, story,
> campaign, online, production content) are **not started**. No parity with the reference is
> claimed. See [`docs/GAP_REGISTER.md`](docs/GAP_REGISTER.md) before relying on any behaviour.

## What runs today

- Walk, jog, sprint, and jump on foot in a procedural district of 2304 m × 2304 m.
- Stream 25 cells around the player with hysteresis; collision is coverage-checked.
- Enter and drive the Kestrel GT (an original stand-in car) with a kinematic bicycle model.
- Third- and first-person camera; pause menu; settings; key rebinding with conflict checks.
- Save and load with versioned, checksummed JSON, backup slot, and an interrupted-write recovery
  path (quick save F5, quick load F9).
- F3 diagnostics overlay (available in every build; read-only).

Controls are listed in [`docs/CONTROLS.md`](docs/CONTROLS.md).

## Requirements

- Node.js 22 (developed on 22.22.3) and npm.
- A WebGL 2 capable browser. Headless QA used software WebGL (SwiftShader); no GPU was available.

## Build and run

```bash
npm ci                  # install pinned dependencies (package-lock.json)
npm run dev             # dev server on 0.0.0.0:5173
npm run build           # typecheck + production build into dist/
npm run preview         # serve dist/ on 0.0.0.0:4173
```

## Checks

```bash
npm run typecheck       # tsc --noEmit (strict)
npm run validate        # registry schema, unique IDs, status enum, test_ids exist in tests/
npm test                # Vitest unit tests (src/sim is pure; no DOM or three.js)
npm run parity          # regenerate docs/PARITY_MATRIX.md and docs/parity-matrix.csv
npm run test:all        # typecheck + validate + test + build
```

Browser smoke test (needs the packaged build served on port 4173 and a Chrome/Chromium binary):

```bash
npm run preview &       # or use the preview process in your environment
CHROME_PATH=/path/to/chrome npm run e2e
```

It checks start, sim boot, W movement, F5 save, Escape pause and resume, entering the car, driving,
and braking, and writes screenshots to `test-results/` (git-ignored). Set `SALTLINE_URL` to test
another host. Results from the last run are in [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md).

## Repository layout

| Path | Purpose |
|---|---|
| `src/sim/` | Pure simulation: clock, input actions, player, vehicle, collision, world streaming, save, settings, registry types. No DOM or three.js imports. |
| `src/game/` | three.js rendering, camera rig, HUD, input capture, storage adapter, app shell. |
| `src/ui/` | Pause menu, settings and controls screens, styles. |
| `src/main.ts` | Browser entry point. |
| `tests/` | Vitest suites. Test IDs (`T-XXX-NNN`) are referenced from registries. |
| `data/registries/` | Seeded content registries (vehicles, missions, weapons, …) with honest statuses. |
| `data/economy/` | Qualitative economy notes. All numeric values are `null`. |
| `reference_profile.json` | Frozen reference profile (edition, update, unknowns). |
| `feature_gates.json` | Edition and feature gates. |
| `tools/validate-registries.ts` | Registry validator (used by `npm run validate`). |
| `tools/gen-parity.ts` | Generates the parity matrix from registries. |
| `tools/browser-smoke/` | Browser smoke test for the packaged build. |
| `docs/` | Plan, mechanics notebook, parity matrix, gap register, controls, units, known issues, test and performance reports, asset provenance, research sources. |

## Generated files

`dist/`, `test-results/`, and `node_modules/` are reproducible and git-ignored. The parity matrix
and CSV are generated and committed so they can be reviewed in a diff.

## Names and assets

"Saltline", "Eli Mercer", "Dez Okafor", "Rourke Vance", "Bayhaven", and "Sable Basin" are
**temporary working names**. They can be changed in the registries. Every Milestone A asset is an
original procedural primitive; see [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md).

## Document index

- [`docs/PLAN.md`](docs/PLAN.md): plan, stack decision, milestone sequence, blockers.
- [`docs/RESEARCH_SOURCES.md`](docs/RESEARCH_SOURCES.md): sources consulted and how much weight each carries.
- [`docs/MECHANICS_NOTEBOOK.md`](docs/MECHANICS_NOTEBOOK.md): mechanic-by-mechanic notes with confidence.
- [`docs/PARITY_MATRIX.md`](docs/PARITY_MATRIX.md): generated status per registry record.
- [`docs/GAP_REGISTER.md`](docs/GAP_REGISTER.md): known gaps against the brief and reference.
- [`docs/UNITS_AND_CLOCKS.md`](docs/UNITS_AND_CLOCKS.md): units, timestep, clocks, slow motion rules.
- [`docs/CONTROLS.md`](docs/CONTROLS.md): default bindings and implementation status.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): defects and rough edges found during QA.
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md): what was run, with results.
- [`docs/PERFORMANCE_REPORT.md`](docs/PERFORMANCE_REPORT.md): what was and was not measured.
- [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md): origin and licence of every asset.
