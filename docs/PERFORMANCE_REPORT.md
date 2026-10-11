# Performance report (Milestone A)

## Status

**No performance target has been measured on GPU hardware.** Milestone A declares a budget
(60 fps on a mid-range desktop GPU, `docs/PLAN.md` §3). The sandbox has 2 vCPU, 3.8 GiB RAM, and
no GPU. All browser runs used SwiftShader (software WebGL), which is far slower than a GPU and says
nothing about the target budget.

## What was observed (software renderer, headless, not a benchmark)

| Observation | Value | Notes |
|---|---|---|
| Packaged JS bundle | 581.41 kB raw, 149.53 kB gzipped | `npm run build`, Vite 8.3.4 |
| CSS bundle | 4.26 kB raw, 1.50 kB gzipped | |
| Resident cells at spawn | 25 | Matches the load radius of 2 cells. |
| Collision coverage at spawn | true for the 25 cells | `collisionCoverageOk()` |
| Vitest suite runtime | ≈2.7 s (66 tests, 12 files) | Pure simulation, no rendering. |
| Browser checks | 10/10 passed in 3 of 4 runs; one run failed once on the Escape check (see KNOWN_ISSUES #10) | Not a timing benchmark. |
| Sim progress under SwiftShader | Throttle 3 s from rest gave 13.5–16.3 m/s across runs | Frame-rate-dependent because real time is clamped to 0.25 s per frame. Not a handling figure. |

## Budgets declared in the code (not yet verified)

- Fixed sim step: 1/60 s.
- Frame clamp: 0.25 s.
- Streaming: load radius 2 cells, unload radius 4 cells, look-ahead 6 s capped at 3 cells.
- Mesh builds are throttled; data generation is synchronous (no worker threads).

## Not measured (open)

- Frame time, GPU time, and draw-call count on any GPU.
- Memory use over a session and over streaming churn.
- Time to first frame on a cold cache.
- Frame time while driving at top speed through the district.
- Scaling with cells beyond the 25-cell spawn set.

These are listed as GAP-PLT-02 in `docs/GAP_REGISTER.md`.
