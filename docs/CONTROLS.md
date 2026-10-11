# Controls (Milestone A build)

Source of truth: `src/sim/input-actions.ts` (`ACTIONS`). Rebinding is available in
Settings → Controls and rebinding. Conflicts are checked per context: `global` conflicts with every
context; `on_foot`, `vehicle` conflict only within themselves.

Only actions marked **implemented** do anything in this build. Others are listed so the binding
space is reserved, not because they work.

| Action | Context | Keyboard | Gamepad (W3C standard index) | Press | Implemented |
|---|---|---|---|---|---|
| Move forward / throttle | global | W, ↑ | — | hold | yes |
| Move back / brake / reverse | global | S, ↓ | — | hold | yes |
| Move left / steer left | global | A, ← | — | hold | yes |
| Move right / steer right | global | D, → | — | hold | yes |
| Sprint | on foot | Left Shift | 10 (left stick press) | hold | yes |
| Jump | on foot | Space | 0 (A / cross) | tap | yes |
| Handbrake | vehicle | Space | 1 (B / circle) | hold | yes |
| Enter / exit vehicle | global | F | 3 | tap | yes |
| Horn | vehicle | H | 11 | hold | yes |
| Headlights | vehicle | L | 14 | tap | yes |
| Camera view (third / first person) | global | V | 13 | tap | yes |
| Pause and settings | global | Escape | 9 | tap | yes |
| Quick save (slot 1) | global | F5 | 8 | tap | yes |
| Quick load (slot 1) | global | F9 | — | tap | yes (not browser-tested) |
| Interact | on foot | E | 2 | tap | no |
| Aim | on foot | Right mouse | 6 | hold | no |
| Fire | on foot | Left mouse | 7 | hold | no |
| Reload | on foot | R | — | tap | no |
| Melee | on foot | G | 1 | tap | no |
| Cover | on foot | C | 5 | tap | no |
| Weapon wheel | on foot | Q | 4 | hold | no |
| Character wheel | global | Tab | — | hold | no |
| Special ability | global | Z | — | hold | no |
| Phone | global | P | 12 | tap | no |
| Map | global | M | — | tap | no |
| Radio station | vehicle | T | 15 | tap | no |
| Roof | vehicle | O | — | tap | no |
| Landing gear | vehicle | G | — | tap | no |
| Vehicle weapon | vehicle | Left mouse | 7 | hold | no |

## Notes

- **Pad bindings are fixed in this build.** Controller rebinding is a gap (GAP-INP-02).
- Pad dead zones are radial. Pad bindings were checked for same-context conflicts by
  `tests/input.test.ts` (added in this session; it found and fixed a clash where `reload` and
  `interact` both used pad button 2).
- Escape and the start overlay were exercised by browser automation only. Pointer lock (mouse look)
  was not exercised in headless QA.
- Mouse look sensitivity and invert-Y are in Settings. Pitch is clamped to [-1.2, 0.2] rad.
