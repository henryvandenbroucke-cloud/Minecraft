# Asset provenance

Policy: no Rockstar Games code, models, textures, audio, dialogue, songs, cinematics, or extracted
game data is used, copied, or planned. Every asset in this repository is either created by this
project or is a published open-source dependency listed below.

## Project-created assets (Milestone A)

| Asset family | How it is made | Origin | Licence | Readiness |
|---|---|---|---|---|
| Ground, roads, buildings | Procedural boxes and planes generated per block in `src/game/geometry.ts` and `src/sim/world` | This project | Project licence (see note below) | placeholder |
| Protagonist (Eli Mercer, Dez Okafor, Rourke Vance) | Coloured primitives plus a head bob in `src/game/actors.ts` | This project | Project licence | placeholder |
| Kestrel GT car | Box body, wheels, headlight beams in `src/game/actors.ts` | This project. Original stand-in; not a reference model. | Project licence | placeholder |
| Sky and lighting | Generated gradient and directional light in `src/game/world-view.ts` | This project | Project licence | placeholder |
| HUD and menus | HTML/CSS (`src/ui/styles.css`), system font stack | This project. No font files shipped. | Project licence | placeholder |
| Names and text | Character names, district names, UI strings | This project. Temporary working names. | Project licence | temporary |
| Images in `docs/screenshots/` | Captured from this build in headless QA | This project | Project licence | QA evidence |

No binary asset files (models, textures, audio, fonts) are committed in Milestone A.

## Third-party dependencies (runtime and build)

| Package | Version (pinned) | Licence | Use |
|---|---|---|---|
| three | 0.186.1 | MIT | Rendering (runtime) |
| vite | 8.3.4 | MIT | Dev server and bundler |
| vitest | 3.2.7 | MIT | Unit tests |
| typescript | 5.9.3 | Apache-2.0 | Typecheck |
| tsx | 4.20.6 | MIT | Run TypeScript tools |
| @types/three | 0.186.0 | MIT | Types |
| @types/node | 22.20.5 | MIT | Types |
| puppeteer-core | 25.13.0 | Apache-2.0 | Browser smoke test (dev only) |

Licences were read from each package's `package.json` in `node_modules/`.

## Browser used for QA (not shipped)

Headless Chromium 153 from the `@sparticuz/chromium` npm package was used for local QA in
`/home/user/browser-tools/`, outside the repository. It is not a dependency of the repository.
Repository tests need a Chrome or Chromium binary provided through `CHROME_PATH`.

## Note on project licence

The project does not yet have a licence file. Before publication, the owner must choose one.
This is an open decision and is listed in `docs/KNOWN_ISSUES.md`.

## Replacement tracking

Every placeholder above is marked **placeholder** and must be replaced or re-labelled `final` before a
Milestone G claim. The replacement log is empty because no final asset exists yet.
