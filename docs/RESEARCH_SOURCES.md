# Research sources

This file lists what was consulted, what each source was used for, and how far it can be trusted.
Fetched page text is not stored in the repository; the conclusions that matter are recorded in
`reference_profile.json`, `feature_gates.json`, `data/registries/update_manifest.json`, and
`data/economy/tunables-tu1.73.json`.

Rule applied: a claim enters a registry as `published` only when it comes from an official or dated
primary source that was read. Search-result excerpts are marked as such, and third-party claims are
never used as values.

| # | Source | Type | Read how | Used for | Weight |
|---|---|---|---|---|---|
| 1 | Rockstar Games Customer Support, "GTAV Title Update 1.73 Notes (PS5 / PS4 / XBOX Series X|S / XBOX One / PC [Enhanced/Legacy])", https://support.rockstargames.com/articles/4vRqEDvjUs9h7nqRUgc8YO/gtav-title-update-1-73-notes-ps5-ps4-xbox-series-x-or-s-xbox-one-pc-enhanced-legacy (page age Oct 1, 2026) | Official vendor notes | Search-result excerpt (not fetched in full) | Update content list (Mission Creator items, Warp Points, props, CCTV, etc.); edition gates for some features | Primary, but only partially read. Re-read in full before any gate is relied on. |
| 2 | GTA Wiki, latest versions table | Community wiki | Fetched | TU 1.73 release date (Jul 16, 2026) and platform list (PS5, Xbox Series X|S, PC Enhanced) | Secondary; cross-check with #1 |
| 3 | GTABase, "GTA Online 'Kortz Center Heist' Update 1.73 Patch Notes" (https://www.gtabase.com/articles/grand-theft-auto-v/title-updates/gta-online-summer-2026-dlc-update-1-73-patch-notes-features, page age Jul 19, 2026) | Community patch-note summary | Search-result excerpt | Mission Creator and Collectable cap items | Secondary; not used for values |
| 4 | TwistedVoxel, "GTA 5 Title Update 1.73 Patch Notes Released" (https://twistedvoxel.com/gta-5-title-update-1-73-patch-notes-released/, Jul 14, 2026) | Third-party summary | Search-result excerpt | Qualitative economy changes (weekly completion bonuses, repeat-reward reduction, setup rewards) | Secondary; no numbers were taken |
| 5 | gamedropdaily, Insider Gaming, ValoSettings summaries | Third-party | Search-result snippets | Business Rivalries and Halloween event entries | Secondary; each entry is marked "verify against Rockstar notes" |
| 6 | Third-party torrent/download page with a build string (PC Enhanced build claim) | Untrusted | Not downloaded or used | None | Rejected. No build number is recorded as fact; the reference build is `unknown`. |
| 7 | Chromium 153 via npm (`@sparticuz/chromium`) and `puppeteer-core` | Tooling | Installed in `/home/user/browser-tools/` (outside the repo) | Headless browser QA only | Not a reference source |

## Not consulted or not possible

- No reference installation is present, so no in-game measurement was made.
- Rockstar's own documents were not downloaded in bulk, and no game files, dialogue, music, or cinematics were
  obtained or used.
- Wikis and summary sites were used only to orient the research. They do not set any numeric value.

## Dates

Today's date for this work is 2026-10-11. Rockstar drip-feed entries after 1.73 are in
`data/registries/update_manifest.json`, all `researched`, not implemented.
