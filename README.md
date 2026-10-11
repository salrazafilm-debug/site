# Our World

A shared travel-discovery map for two people. The world starts under cloud;
travelling clears it permanently. Real geography — coastlines, counties,
rivers, the Great Lakes — rendered as pixel art, with no map tiles and no
mapping library.

**[Open the live map →](https://salrazafilm-debug.github.io/our-world/)**

Zero dependencies. Zero build step for development. The entire application is
one HTML file and one compressed geography pack; the whole US eastern seaboard
plus the Midwest fits in about 48KB of embedded vector data.

---

## What this repository is

This is the **open build**: the full map engine, with no database behind it and
no personal content in it. Pins you drop are saved in your own browser and
nowhere else — there is no server, no account, and nothing is sent anywhere.

The version the two of us actually use runs as a private Claude Artifact, where
a shared database syncs both our phones and photos go to real object storage.
Everything about that integration is in **Storage / database** below, including
what to replace to put it on Supabase or Firebase instead. Swapping that layer
is the one piece of real work left; the map does not care which backend it is
talking to.

---

## Run it

```bash
npm run dev          # → http://localhost:4173
```

No install step. No dependencies. Node 18+ is the only requirement, and it's
used solely for a 40-line static file server.

```bash
npm run check        # syntax-check every inline script + verify the geo pack decodes
npm run build        # → dist/our-world.html, one self-contained file
npm run build:site   # → docs/index.html, the static site GitHub Pages serves
```

There is **no build step for normal development.** Edit `src/index.html`,
reload the browser. That is the whole loop.

`npm run build:site` wraps the same fragment in `tools/site-shell.html`, which
sets `window.__OW_PUBLIC`. That flag changes nothing but the wording the app
uses to explain why nothing syncs, and the builder refuses to write the file if
any photo reference survives into it.

---

## Framework

**None. Deliberately.** No React, no bundler, no TypeScript, no npm packages —
`dependencies` and `devDependencies` are both empty and should stay that way.

This is not laziness; it is forced by the deployment target (see below). The
app ships as one HTML page plus one data file, and every external host except
Google Fonts is blocked at runtime. A framework would have to be inlined, and
buys nothing here.

If you're tempted to port it to a framework: the renderer is a canvas paint
loop, not a component tree. There is nothing for a virtual DOM to do.

---

## Entry file

**`src/index.html`** — the whole application. ~131KB: markup, CSS and all
JavaScript in one file.

Critically, **it is a fragment, not a document.** It has no `<!doctype>`, no
`<html>`, no `<head>`, no `<body>`. The Claude Artifacts runtime wraps it in
that skeleton at publish time. `dev/index.html` reproduces the same wrapper so
the identical fragment runs in a plain browser.

> Publish `src/index.html`. Never publish `dev/index.html` or `dist/`.

---

## Files

```
src/index.html     the application — markup, CSS, all logic
src/geo.js         ~44KB compressed geography pack (see below)
dev/index.html     local shell reproducing the Artifact wrapper + a window.claude stub
dev/serve.js       dev server; inlines the fragment into the shell
tools/check.js     syntax-checks inline scripts, verifies the geo pack decodes
tools/build-standalone.js   → dist/our-world.html (single file, geo.js inlined)
docs/FOUNDATION.md concept, visual system, full architecture rationale
LICENSE-DATA.md    map data attribution (all public domain)
.env.example       no vars needed today; documents what a backend migration needs
```

There are **no local image assets.** Every graphic is a pixel sprite defined in
code as a character grid with a colour-key palette, drawn to canvas. Nothing to
download, nothing to optimise, no CSP problem.

---

## Architecture

### Geography without map tiles

The runtime blocks images, stylesheets, `fetch` and XHR from every external
host. Leaflet, Mapbox and OSM tiles are all impossible. So the map is drawn
from scratch out of embedded vector data.

`src/geo.js` holds US Census county boundaries and Natural Earth rivers +
world land, simplified with Douglas-Peucker, rounded to ~110m, delta-encoded,
zig-zag varint packed and base64'd — **the entire eastern seaboard in ~44KB.**
The decoder is about 15 lines.

The five Midwest states (OH · IN · MI · IL · WI) are whole-state outlines from
us-atlas `states-10m`, encoded the same way, ~4.6KB for all five. They carry no
internal county lines, so they show no boundary texture — that is expected, not
a bug. Because the source excludes the Great Lakes from every state polygon,
Lake Michigan appears correctly without any extra data.

Overlapping county polygons filled in one colour produce the correct land
silhouette for free; no polygon union needed. Because Census coastal counties
are shoreline-clipped, the Chesapeake, Delmarva and the Atlantic coast emerge
naturally.

Projection is hand-rolled Web Mercator (`lngToWX` / `latToWY` / `kmPerPx`).

### Three canvas layers

| Layer | Resolution | Redrawn | Contents |
|---|---|---|---|
| Base | 1/3 | only on view change | water, waves, foam, land, county lines, rivers, routes, gold wash |
| Fog | 1/6 | every tick | cloud cover, punched-out discovered regions |
| Overlay | full | every tick | labels, sprites, sparkles, glows |

Low-resolution layers are upscaled with `imageSmoothingEnabled = false` to get
true pixel chunk. The base layer is cached because it's the expensive one —
if you add anything animated to it, cache it separately or you'll tank the
frame rate on a phone.

### Clouds belong to the ground

Clouds are positioned in **world coordinates**, not screen coordinates. Space
is divided into cells from a fixed ladder (0.04° → 5.12°) chosen so spacing
stays ~105 screen px at any zoom; each cell is hashed to decide whether a cloud
exists, where, which shape, which depth layer. Every area therefore has its own
permanent sky, and panning moves the map *under* the weather.

The ladder matters: a continuously-varying cell size makes clouds shimmer and
re-form constantly. Don't "simplify" it.

### Fog of war

Fill → draw clouds → `destination-out` → punch a blurred organic blob per
discovered region → composite at 78–95% opacity by zoom so unexplored land
ghosts through faintly rather than going solid grey.

Blob shapes are deterministic: the region id is hashed to seed an LCG that
produces 26 radius multipliers. Same region, same wobble, forever.

---

## Storage / database

**Local-first, three tiers, merged by id.** This is the most important thing to
understand before you touch anything.

1. **Page seeds** — key places and memories compiled into `src/index.html`
   (`SEED_REGIONS`, `SEED_MEMORIES`). Always present. No permissions, no
   account, works offline.
2. **Device cache** — every read and write also lands in `localStorage`
   (`ow.cache.*`). Your own edits outrank page seeds.
3. **Shared database** — the Claude Artifacts `db` capability, reached via
   `await window.claude.use('db')`.

**The page must render a complete world with zero successful network reads.**
That is a hard requirement, not an optimisation.

**Write path:** device first → then attempt the shared world → tell the user
plainly if the shared write failed. The pin exists either way.

**Read path:** one-shot `.get()` on load, **then** `.onSnapshot()` for live
updates. A subscription can die on its own; the initial read still fills the
world. *Never subscribe without an initial read* — see Known bugs.

**Deletes** write a tombstone document so a removal sticks on every device even
if the delete itself is refused. Retired ids are also blocklisted in the page
so a stale cached copy cannot resurrect them.

### Collections

| Collection | Shape | Notes |
|---|---|---|
| `discoveries` | `{name, lat, lng, r, by, at}` | cleared regions; `r` in km |
| `memories` | `{title, note, date, by, lat, lng, at, photoUrl, assetId}` | `date` is `YYYY-MM-DD` and drives the calendar |
| `surprises` | `{title, note, by, forWho, unlockKm, lat, lng, opened, at}` | sealed letters |
| `deleted` | `{at, by}` | tombstones, doc id = the deleted memory's id |

Document ids are client-generated (`Date.now().toString(36) + random`).
Writes are last-writer-wins. There are no transactions.

### Photo storage

Photos go to the Artifacts `assets` capability:
`(await claude.use('assets')).upload(blob)` → `{id, url}`. The asset id is
stored on the memory as `assetId`, the URL as `photoUrl` (`/_blob/<id>`).

Images are downscaled to max 1100px and JPEG-encoded at 0.82 before upload.

**Fallback:** if `assets` is unavailable (it is writer-only), the image is
re-encoded at decreasing quality until it fits under ~170KB and stored inline
as a data URL on the memory document. If it can't fit, the memory saves without
the photo and the user is told.

**Rendering:** a stored photo may be a data URL, `/_blob/<id>`, `_blob/<id>`,
or just an asset id. `photoCandidates()` tries each shape in turn with an
`onerror` chain, and falls back to a visible *"Photo saved, but it will not
load here"* placeholder rather than a broken frame. Keep that chain — the
exact URL shape has changed underneath us before.

> Assets are scoped to a single artifact. Republishing the same artifact keeps
> them; **publishing to a new artifact does not carry photos across.** That is
> the main cost of ever moving to a new artifact URL.

---

## Deployment

Published as a **Claude Artifact**: the fragment `src/index.html` plus
`geo.js` as a supporting file, with capabilities declared:

```js
capabilities: {
  db:     { rules: [ { path: "", read: "view", write: "interact" } ] },
  assets: {}
}
contract: "latest"
```

Republishing the same artifact keeps the URL, the database and the photos.

The artifact must be **private**, not public. A `db`-declaring artifact is
organization-internal; public sharing is what appeared to break database reads.
Both people use the same account, so private costs nothing.

### Hosting it anywhere else

`npm run build` produces `dist/our-world.html`, one self-contained file that
works on any static host (Netlify, Vercel, GitHub Pages, S3) or opened directly
from disk. Everything still works **except** the shared database and photo
upload, which are Claude-runtime features. It degrades to the local-first path
— the map, fog, discovery, calendar and device-local memories all function.

### Migrating off the Claude runtime

Everything network-facing is behind two calls. Write an adapter exposing
`collection(name)` with `.get()`, `.onSnapshot()`, `.doc(id).set/update/delete`,
plus an `upload(blob) → {id, url}`, and point `connect()` at it. Firebase maps
almost one-to-one; Supabase needs a thin translation. `.env.example` documents
the variables either would need.

---

## Completed features

Real 2D geography (MD · DC · VA · DE · PA · WV · NJ · NC · NY · CT, plus
OH · IN · MI · IL · WI for the Chicago trip) · fog of
war with world-anchored drifting clouds · both home bases (golden cottage,
pink castle) · regional discovery with GPS plus two fallbacks · memory pins
with photos, notes and dates · full-screen photo viewer · editable memory dates,
titles and notes · calendar with per-day pins and thumbnails · sealed surprise
letters with proximity unlock · six hand-drawn landmark sprites · Earth globe ·
outer space · place-hopping navigation · local-first storage with shared sync ·
connection diagnostics · location diagnostics · rotating opening card for Elena
with birthday awareness · planned destinations that appear before the trip
happens, with a dashed flight path and a drifting plane.

Twelve places currently on the map, eight with custom icons.

### Planned destinations

A landmark tuple gains an optional slot 8. When it is truthy *and* the ground
around the landmark is not yet cleared, the landmark draws anyway — held at
0.72 alpha, hovering, inside a slowly rotating dashed gold ellipse, labelled
`<name> · soon`. It is clickable and opens a "Planned — not there yet" card
instead of the usual one, and it appears in **Our places** with a plane icon.

The moment a discovery clears that ground the flag stops applying and the
landmark behaves exactly like every other one. Nothing has to be edited when
they actually arrive.

`FLIGHT` is a list of `[lat, lng]` waypoints (home → Chicago → Milwaukee) drawn
in the overlay as quadratic arcs bowed 13% north of each chord, with a plane
sprite travelling the whole polyline once every ~1600 `cloudPhase` units, about
two and a half minutes. The sprite's nose points west and is never rotated, so
its pixel grid stays axis-aligned and seam-free.

---

## Known bugs and gotchas

**Fixed, but do not reintroduce:**

- **Subscribing without an initial read.** The original build only called
  `onSnapshot()`. Writes worked perfectly, reads never arrived, and the app
  looked completely broken while the database was full of correct data. Cost
  several days. Always `.get()` first.
- **Empty `catch` blocks.** They hid the above. Every failure path must surface
  something the user can read.
- **Testing only locally.** Local testing never executes the `window.claude`
  paths at all, so local tests passed while the real device failed. Verify
  runtime-capability changes on the published artifact.
- **Stale hardcoded seeds.** Page seeds added as a fallback went out of date and
  resurrected memories the user had deleted. Seeds must be blocklist-aware
  (`RETIRED`) and reconciled with the live store when you touch them.
- **Sprite outlines eating detail.** The 1-block white outline is drawn by
  offsetting the whole grid four ways; it closes any gap narrower than ~2 grid
  cells. Thin rays, crown spikes and 1-cell steam all vanish. Either use gaps
  of 3+ cells or skip the outline and rely on a glow (see the sun sprite).

**Open:**

- **Geolocation is frequently blocked** by the frame the page runs in, and
  allowing it in browser settings does not help. Two fallbacks exist (drop a pin
  at map centre; paste coordinates or a map link) and a diagnostic panel reports
  the real cause. Not fixable from inside the page.
- **Shared-world reads were unreliable** on the old runtime contract. Now
  running `contract: "latest"` with explicit read rules and the artifact set to
  private. Watch the status chip: green *Shared* = working; gold *This device
  only* = local fallback. It has a round-trip test button.
- Two memories at identical coordinates render exactly on top of each other on
  the map. The calendar lists them separately. No clustering yet.
- The hop bar index doesn't follow a jump made from the **Our places** list.
- No conflict resolution: simultaneous edits are last-writer-wins.

---

## Current unfinished work

Nothing is half-built or broken mid-change. The tree is clean and shippable.

The unfinished items are unstarted features, in the order they were judged
worth doing:

1. **Trips** — group memories into a named trip and draw the route between its
   stops in order as a gold thread across the map.
2. **Photos as polaroids on the map**, not only inside the card.
3. **Printable poster export** — the whole world as a framable high-res image.
4. **"This day" look-back** — *one year ago today, you were at Bushkill Falls.*
5. Live presence; voice notes.

**Deliberately rejected** — don't add these back without asking:
pre-placed "mystery" markers (every mark should be one they made); statistics
and percentages (turns romance into a dashboard); continuous background
location tracking; exact street addresses.

---

## Recommended next step

**Build Trips.**

The data is already there — every memory has `date`, `lat`, `lng` and `at`.
A trip is a name plus an ordered list of memory ids, which is one more
collection following the exact pattern of the existing three.

The payoff is visual and immediate: their September birthday weekend becomes a
single gold thread running Chesapeake Beach → Bartonsville → Camelback →
Night Lights → Bushkill Falls → New York City, instead of nine unrelated pins.
It reuses the renderer, the storage layer and the calendar without touching any
of them, so it's low-risk and high-delight — the best ratio left on the list.

Suggested shape:

```js
trips: { name, startDate, endDate, memoryIds: [], by, at }
```

Draw the polyline in the overlay layer in gold, with the same
`proj(lat, lng)` the markers use, and animate a slow dash offset along it so
the route reads as a journey rather than a line.

---

## Before you ship anything

```bash
npm run check
```

There is no compiler. That script is the only safety net: it syntax-checks
every inline script and confirms the geography pack still decodes.
