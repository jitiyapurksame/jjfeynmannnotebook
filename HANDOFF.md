# J.J.'s Ship Log v2 — handoff

A single-file, ocean-liner-themed capture app for Jitiya's son: pin quick notes, draw with a Roblox-style block kit, write Feynman-style diary pages, sort everything into shelves later, earn miles/coal, spend coal in a shop, and back up with a LINE-friendly code. Written Oct 2026.

## Files
| File | Purpose |
|---|---|
| `index.html` | The whole app (plain JavaScript + CSS, **no libraries, no CDN, no build step**). Deploy this. |
| `legacy/classic.html` | The old v1 app (React/Babel). Reference only; v2 does not need it. v2 imports its data once (see Migration). |
| `verify.js`, `package.json` | Smoke tests (jsdom + fake-indexeddb). `npm install && npm run verify` |
| `HANDOFF.md` | This file |

Deploy: replace `index.html` on Vercel. If the new site has the same domain as the old one, the old v1 localStorage data (topics, entries, sketchbook, ledger) is imported automatically on first open.

## Screens (all in `index.html`)
Promenade Deck (home, rank HUD) · Captain's Quick Notes + Notice Board · Captain's Log (diary page) · Captain's Drawing Table · shelves (Note Cabins / Chart Room / Library, with the Cargo Hold = unsorted) · Purser's Shop · Lifeboat (backup) · note editor · picture viewer.

Theme words: Cargo Hold = unsorted, cabin / chart folder / shelf = collection, "Stow it" = save, "Throw overboard" = delete, Lifeboat = backup.

## Code layout (top to bottom)
1. CSS (colour tokens in `:root`: navy, brass, cream, red, sea)
2. Helpers: `h()` element builder, `fill()`, in-page dialogs `ask / say / askText`, `toast`, ranks, `award()`, `scoreLog()`, `hud()`, `owns()`, `bal()`
3. Storage (IndexedDB wrappers `all/put/del/putMany/getMeta/setMeta`, with an in-memory fallback if IndexedDB is blocked)
4. `migrate()` from v1
5. Lifeboat code (`makeParts`, `restoreCode`, `mergeIn`)
6. `/*SHAPES*/ … /*END*/` block: palettes, paper and outfit catalogs, `D` (shape drawings), `DEF` (default colours), `figParts`, `sceneSvg`
7. Views: `home`, `quick`, `shelfView`, `logPage`, `tablePage`, `shop`, `lifeboat`, `notePage`, `picPage`, `render`

## Data model (IndexedDB `shiplog2`, version 1)
- `items` (key `id`): `{ id, type: 'note'|'drawing'|'log', text, title?, collectionId|null, createdAt, color? (notes: paper index into `NOTEC`, 7 colours), pin? (notes: pin index into `PINC`, 8 colours, default 0 = red), data? (log fields), scene? (drawings), image? (old v1 pictures), earned? (logs), sorted? }`
- `cols` (key `id`): `{ id, name, kind: 'note'|'drawing'|'log' }`
- `meta` (key `k`): `migrated`, `ledger {miles, coal, stars}`, `owned [ids]`, `draft`, `logdraft`, `drawdraft`, `lastBackup`
- Log `data` fields: `date, title, eli10, why, steps, example, bug, fix, q1, q2, q3, summary` (old v1 entries may also carry `sketchImage`, `sketchNote`).
- Drawing `scene`: array of objects `{ id, k, x, y, r, s, c, g? , e?, d?, w?, fx?, fy? }` (`fx`/`fy` = 1 when mirrored left-right / up-down; drawn as `scale(s*±1 s*±1)` inside `objSvg`) in an 800×600 space. `k` is a shape kind (key of `D`) or `'path'` (freehand: `d` path, `w` width; `e:1` = eraser stroke) or `'bg'` (paper id in `c`). `g` groups the parts of a figure. Drawings are vector data, so they fit in the Lifeboat code.

## Scoring (one-way ratchet: totals never go down)
- Rank up every 150 miles: Cabin boy, Deckhand, Able seaman, Petty officer, Bosun, First mate, Chief officer, Staff captain, Captain, Commodore, then numbered.
- Captain's Log: 7 checkpoints (briefing, engine room, ports of call, sightings, SOS+fix, bottle questions, manifest): 15 miles + 5 coal each; all 7 adds 30 miles + 20 coal. Stars: 1 (≥2), 2 (≥5), 3 (7). Editing a log awards only the increase over what it already earned (`item.earned`).
- Quick note: +2 miles, +1 coal. New drawing: +8 miles, +10 coal.
- Stowing an item from the Cargo Hold into a shelf for the first time: +3 coal each (`item.sorted` prevents repeats).
- Deleting never removes anything already earned.
- Coal shown = `ledger.coal` minus the prices of owned shop items (`bal()`).

## Shop (catalog lives in the SHAPES block: `OUT` outfits, `PAPERS` papers)
Outfits: Sailor suit 20, Engineer 30, Scientist 30, Wizard 40, Royal knight 50, Astronaut 60 (Deckhand free). Papers: Ocean chart 20, Graph paper 25, Sunset 25, Night sky 30, Blueprint 35 (Parchment free). Buying has no confirmation step. Papers define a flat `base` colour (the eraser paints with it) plus an `ov` overlay drawn on top.

## Drawing Table tabs (arrays in `TABS`)
Crew (+ Blocky Captain / Captainess buttons and outfit chips) · Shapes · Nautical · Vehicles · Animals · Space · RPG · Engineer · Science · Food · Paper.
To add an item: add a drawing function to `D` (centred on 0,0, about ±50 units), a colour in `DEF`, and its name to a `TABS` list. Check it renders by drawing it into a test SVG.

## Lifeboat code
Text parts like `LIFEBOAT|<setId>|<i>|<n>|<data>`, 2500 characters each (`PART`), so each part fits a LINE message (the exact LINE limit has not been confirmed; lower `PART` if one is rejected). Payload `{v:1, cols, items, ledger, owned}` → JSON → gzip (flag `z`, or `r` raw if unsupported) → base64url. Old flat pictures (`image`) are excluded because they are too big; the "Save backup file" button includes everything. Restore **merges**: adds missing ids only, ledger takes the max per field, owned items are unioned.

## Decisions and lessons (please keep)
- Plain JS, one file, nothing loaded from a CDN. (v1's CDN/Babel setup caused deployment failures.)
- **Never use `alert`, `confirm` or `prompt`**: some browsers and preview frames block them silently. Use `say`, `ask`, `askText`.
- **Never pass arrays to `element.replaceChildren(...)`**; use `fill(el, ...children)`. This bug turned toolbars into "[object HTMLButtonElement]".
- Do not store anything with `localStorage` except the one-time v1 import. Use the IndexedDB helpers.
- When editing with scripted string replaces, assert each match is unique and re-run `verify.js`: a regex once deleted the whole Lifeboat function and the page rendered blank.
- Keep it fast and low-friction: write first, sort later; autosave drafts; big tap targets; one thing per screen.

## Oct 2026 update (changes requested after J.J. tested v2)
- **Note colours:** `notePicker()` (paper colour + pin colour swatches with a live preview) is on Quick Notes (choice is remembered for the session in `qCol`/`qPin`) and on the Edit note page. Cards set `--pc` for the pin colour. Old notes without `pin` stay red.
- **Save picture (Drawing Table):** the button now opens `picSheet()` with a preview and iPad steps. Where the browser supports file sharing (`navigator.canShare({files})`) it offers **Save to Photos / Share** (share sheet → Save Image); otherwise the instructions say to press and hold the picture. A plain file download remains as a fallback.
- **Direction + flip:** when a piece is selected, a 3×3 compass (`DIRS`) sets its rotation to 0/45/…/315° (⬆ = the way it first appeared) and two buttons flip it left-right / up-down. Figures turn and flip as a whole (or one part when "One part" is on). Flip mirrors positions about the figure's centre, negates `r` and toggles `fx`/`fy`. The old ⟲ ⟳ 15° turn buttons stay.
- `verify.js` now stubs `TextEncoder`, `Image` and canvas so it runs on current Node; new checks cover note/pin colours, the 8 directions, flips, undo, and the Save picture sheet. The Quick Notes page now has a preview `.card.prev`, so tests select `.card:not(.prev)`.
- Not tested on a real iPad: the Photos share sheet and long-press save (jsdom can't). Please try both once.

## Oct 2026 update 2 (home layout, ship name, copy/export)
- **Ship name:** editable. Stored in meta `shipname` (`S.shipName`, default `DEFNAME` = "J.J.'s Ship Log"); `shipName()` returns it, `renameShip()` opens the in-page `askText` dialog (max 40 chars; empty = default) and also sets `document.title`. It is included in the Lifeboat code and backup file (`name`); restore only applies it if the device still has the default name.
- **Home header:** inline-SVG ocean liner (`linerArt()`), then one changeable ship emoji (meta `shipemoji`, `S.shipEmoji`, default 🚢, list `EMOS`) in front of the name, with a ✏️ button. `renameShip()` opens one dialog with the name box, an emoji grid and a "type your own emoji" box (first emoji only, via `firstEmoji`). The emoji is also in the Lifeboat code/backup (`emoji`).
- **Home order:** header, banners, then Quick Notes / Drawing Table / Captain's Log / Shop / Lifeboat buttons, and at the bottom "Ship status and shelves" (rank HUD, Note Cabins / Chart Room / Library tiles).
- **Copy / export of text:** `textTools(getText, getTitle)` adds 📋 Copy (`copyText`, clipboard API with `execCommand` fallback), 📤 Share (only where `navigator.share` exists, so the iPad share sheet can send to LINE/Teams) and 💾 Save .txt (`saveTextFile`) on Quick Notes and on Edit note (title + blank line + text).
- `verify.js` has new checks for the above.

## Known gaps / ideas
- Not tested with real touch and Apple Pencil input; try drag, the gold rotate/resize dots, pen and eraser on the iPad first.
- No name box inside the Drawing Table (rename from the shelf).
- No "delete whole figure" button (delete each part, or undo).
- Old v1 pictures can be viewed and deleted but not edited.
- Ideas: more shop items (badges, ship colours), link a drawing to a Log entry, search, installable offline app (PWA), cloud sync (the earlier Google Sheets attempt was dropped).

## Verifying a change
`npm install && npm run verify` must print "All checks passed". It covers notes, log scoring, shop, drawing table, Lifeboat round trip, edit/rename/delete and shelf management. Also open the page once in a real browser.

## Starter prompt for the next conversation
> I'm continuing "J.J.'s Ship Log v2". I've attached the handoff zip. Please read HANDOFF.md first, keep the single-file / no-library / in-page-dialog rules, keep the ratchet scoring, and run `npm run verify` (or equivalent) before handing back any change. Next I'd like to: [describe the change].
