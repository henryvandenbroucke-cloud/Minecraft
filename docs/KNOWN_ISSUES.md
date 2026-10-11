# Known issues

Ordered roughly by impact on players and by risk to the honest claim in the README. Fixed items are
kept for the record.

## Open

1. **Frame-rate-dependent sim progress under low frame rates.** Real frame time is clamped to 0.25 s,
   so on slow machines the sim runs slower than wall time. Headless software rendering shows this
   (throttle speeds differ between runs). Fix path: a performance budget and a documented minimum.
2. **Vehicle first-person view has no dashboard or mirror** (GAP-CAM-03).
3. **Third-person camera does not recentre behind the car** (GAP-CAM-02).
4. **Headlight beams are placed by hand** in `CarView` (`src/game/actors.ts`). They are not derived from
   body dimensions. Check against the Kestrel GT body in a real GPU render.
5. **`src/sim/content.ts` hard-codes `KESTREL_GT_ID` and `KESTREL_HANDLING_ID`.** They should be read
   from the registries so a second vehicle does not require code edits.
6. **`src/sim/save.ts`: `migrateV0toV1` calls `defaultCharacter`, which is defined later in the module.**
   It works at runtime because the call happens after module evaluation, but it should be reordered for
   clarity and to avoid a future temporal-dead-zone bug.
7. **Landing threshold of 0.1 m/s** in `src/sim/player.ts` is a tuning value that needs checking
   against T-PLY-001 at other frame rates.
8. **Pad bindings are fixed**, and no controller rebinding exists (GAP-INP-02).
9. **Pointer lock was not exercised in automated QA**; Escape and the start overlay were verified only
   through browser automation (GAP-INP-04).
10. **The first run of `npm run e2e` failed once** on the "Escape opens the pause menu" check. Three
    later runs passed (10/10 each). The cause was not found. The check's detail field now prints the menu and sim
    pause state, so a recurrence will show which of the two was wrong. Watch for recurrence.
11. **Browser test uses fixed waits** (for example 1.5 s after clicking start), so a slow machine could
    race. Replace them with readiness signals.
12. **Browser checks use wall-clock holds**, so the measured distances and speeds in the browser
    suite are sanity checks, not calibrated numbers.
13. **Quick load (F9) is implemented but was not exercised in browser QA.**
14. **Diagnostics overlay (F3)** is available in every build, not only dev builds. `feature_gates.json`
    was updated to match (`diagnostics_overlay`). The overlay is read-only.
15. **Project licence not chosen.** No LICENSE file exists yet.
16. **Only one character is playable**; switching is not implemented.
17. **Mission Creator, multiplayer, and economy content are blocked** and have no runtime code.
18. **Visual quality is placeholder-grade.** The figure is a blocky primitive, the buildings are flat
    boxes, and there is no lighting or texture detail.
19. **Only Chromium-class browsers were tested.**

## Fixed in this milestone (kept for the record)

- **F5 quick save wrote nothing under puppeteer.** Key-down and key-up arrived in the same frame and the
  edge was lost. Fixed by latching presses in `src/game/input.ts` (a `tapped` set cleared on the next
  `pollEdges`). Verified: F5 writes `saltline.save.v1.slot1.main`.
- **Escape was swallowed during rebinding capture.** Capture now forwards all keys, including Escape.
- **Early streaming loaded every planned cell**, ignoring the background budget. Fixed. The immediate
  load of cells within Chebyshev distance 1 is the only budget exception, by design.
- **Pad binding clash:** `reload` and `interact` both used pad button 2 in the `on_foot` context. Reload
  now has no pad binding (it is unimplemented). A new test checks pad defaults for same-context clashes.
- **Registry overstatement:** 15 records had `implemented` status with passing tests. They are now
  `tested` because the test run in this build passed (see `docs/TEST_REPORT.md`).
- **`.gitignore` referred to a missing `docs/BUILD.md`.** It now refers to `README.md`. Generated
  output patterns are anchored to the repository root so `docs/screenshots/` is tracked.
- **Camera test assertion.** The first third-person test expected the camera to pass the wall. It now
  expects it to stop in front of the wall (`z > −2.5 && z < 0`).
- **FigureView dead limb code** removed in favour of a bob animation.
- **Camera pitch range** changed to [-1.2, 0.2] rad.
