# OUR WORLD — Project Foundation & Technical Concept

A complete handoff document. Everything below describes a working, built application — not a proposal.

---

## 1. WHAT IT IS

**Our World** is a private shared travel-discovery map for two people: Bruce and his girlfriend Elena ("Princess Elena").

It is a romantic pixel-adventure game layered over real-world geography. The world begins covered in clouds and fog. As the couple travels, regions clear permanently. Every place they've stood becomes part of a shared world that only the two of them can see.

Both people see the same world: the same cleared regions, the same memories, the same photos.

**Emotional target:** *"I open the map and see where we are. The world around us feels real, but transformed into something that belongs to us. Every trip clears another piece of the clouds. Every special place becomes part of Our World."*

**Home bases**
- Bruce — Chesapeake Beach, Calvert County, Maryland (golden pixel cottage)
- Elena — Arnold, Maryland / Annapolis area (pink pixel castle with gold flags)

---

## 2. HARD CONSTRAINTS THAT SHAPED EVERY DECISION

These are not preferences. They are the reasons the architecture looks the way it does.

1. **No external map tiles.** The runtime blocks images, stylesheets, fetch and XHR from every external host. Leaflet, Mapbox, Google Maps and OpenStreetMap tiles are all impossible. *All geography is embedded in the page and drawn from scratch.*
2. **Only scripts from an allowlist of CDNs.** No external CSS, no external images. Fonts may come from Google Fonts only.
3. **Geolocation is frequently blocked** by the frame the page runs in. The app must work with zero location access.
4. **Network storage is unreliable.** The page must display a complete world with no successful database read.
5. **Phone-first.** It is used one-handed, outdoors, on cellular.

---

## 3. VISUAL SYSTEM

### Palette
```
Background    #FFF8FB
Primary pink  #D85A92
Deep pink     #9F3D6D
Princess pink #F3A9C7
Gold          #E7B765
Soft gold     #F5D88E
Land green    #91B979
Deep land     #5E8D63
Water         #63B9C7
Light water   #A5E1E5
Fog           #C5C1CF
Cloud         #E2DDE7
Text          #3D2838
Outer space   #1F1D39
```

### Typography
- **Display:** Pixelify Sans — titles, region names, labels, buttons
- **Body:** Quicksand — notes, UI copy, form fields

### Direction
Soft and dreamy. Pink UI panels, chunky pixel borders, sparkles, drifting hearts. Every panel is pink-cream rather than white. Deliberately single-theme — it is a committed world, not a document.

### Art rules learned the hard way
- Pixel sprites are drawn as character grids (`'..RRR..'`) with a colour-key palette object.
- Sprites get a white 1-block outline drawn by offsetting the whole grid in four directions before the fill.
- **That outline closes any gap narrower than 2 grid cells.** Thin rays, crown spikes, 1-cell steam and floating detail all get swallowed. Any sprite with fine detail must either use gaps of 3+ cells or skip the outline entirely and rely on a glow behind it.
- Sprites anchor at bottom-centre, so a marker sits on its point.

---

## 4. GEOGRAPHY — HOW REAL MAPS EXIST WITHOUT TILES

### Sources (all public domain)
- **Land, states, counties:** US Census cartographic county boundaries (via the plotly datasets mirror). County polygons are drawn overlapping with a single fill colour, which produces the correct land silhouette for free — no polygon union needed. Coastal counties are clipped to the shoreline, so the Chesapeake Bay, Delmarva and the Atlantic coast emerge naturally.
- **Rivers:** Natural Earth 10m rivers and lake centerlines.
- **World land (for the globe):** Natural Earth 110m land.

### Coverage
Maryland, DC, Virginia, Delaware (bright/core) · Pennsylvania, West Virginia, New Jersey, North Carolina, New York, Connecticut (muted). New York City and the Poconos corridor carry extra detail.

### Encoding
Coordinates are rounded to 3 decimals (~110m), Douglas-Peucker simplified with per-region tolerance, delta-encoded, zig-zag varint packed, then base64'd. The whole geography file is **~40KB**.

Decoder is ~15 lines: base64 → bytes → varints → running delta → `[lng, lat]` pairs.

### Projection
Standard Web Mercator, hand-rolled:
```js
worldSize(z)  = 256 * 2^z
lngToWX(lng)  = (lng + 180) / 360 * worldSize
latToWY(lat)  = worldSize * (0.5 - ln((1+sin φ)/(1-sin φ)) / 4π)
kmPerPx(lat,z)= 156.543 * cos(lat) / 2^z
```

### Simplified extras (hand-authored, honestly labelled)
- ~20 major route corridors (I-95, US-50/Bay Bridge, MD-2/4, I-270, I-81…) as waypoint polylines — visual texture, not survey alignments.
- ~58 county / city-area labels (Anne Arundel County, Monroe County, New York City…) — **the primary labels**.
- ~130 towns and landmarks — only shown zoomed right in.
- 9 state names — drawn zoomed out, for orientation.

---

## 5. RENDERING ARCHITECTURE

Three canvas layers composited every frame, all drawn at reduced resolution and upscaled with `imageSmoothingEnabled = false` to get true pixel chunk:

| Layer | Resolution | Redrawn | Contains |
|---|---|---|---|
| **Base** | 1/3 scale | only when the view changes | water, waves, foam, land, county lines, rivers, routes, the gold wash over explored ground |
| **Fog** | 1/6 scale | every tick | cloud cover and the punched-out holes |
| **Overlay** | full res | every tick | labels, sprites, sparkles, glows |

### Water
Pastel three-stop vertical wash, plus chunky wave dashes positioned in *world* coordinates so they stay pinned to the sea when you pan. A white foam stroke traces every coastline before the land fill goes down.

### Fog of war
1. Fill with a deep lavender base.
2. Draw blocky clouds (see below).
3. Switch to `destination-out` and punch a hole for every discovered region, using a blurred organic blob path.
4. Composite onto the map at 78–95% opacity depending on zoom, so unexplored land ghosts through faintly instead of being solid grey.

### Blobs, not circles
Each region gets a deterministic wobble: its id is hashed to seed an LCG, which produces 26 radius multipliers between 0.86 and 1.16. The blob is drawn as a quadratic spline through those points. Same region, same shape, forever.

### Clouds — the important one
Clouds belong to **the ground, not the screen**. A procedural field:
- Space is divided into cells whose size comes from a fixed ladder (0.04° → 5.12°), chosen so cloud spacing stays around 105 screen px at any zoom. A ladder rather than a continuous value means clouds only re-form at a couple of zoom boundaries instead of shimmering constantly.
- Each cell is hashed to decide: does a cloud exist here (66% yes), where inside the cell, which of 5 blocky shapes, which of 3 depth layers, and what size.
- Clouds drift east at ~0.0004° of longitude per tick — roughly a pixel every three seconds when zoomed out. Real-life slow.
- **Result:** every area has its own permanent sky. Pennsylvania's weather is Pennsylvania's weather. Pan the map and clouds travel with the land beneath them.

### Views
`LOCAL → DMV → EARTH → SPACE`, continuous.
- Map mode: Mercator, zoom 4.6–14.5.
- Below zoom 4.6 it hands off to an orthographic globe, arriving at the size the map left.
- Globe scale 1.55 → 0.20. Sky colour is a single smoothstep interpolation from daylight pink to deep space, with stars fading up and an atmosphere shell around the planet so the globe never has a hard edge. **No step anywhere in the transition.**

---

## 6. FEATURES

### Discovery
Tapping **Discover this area** (or **Find me**) takes a GPS fix, clears ~20km, names the region after the nearest town, and saves it for both people. Arriving somewhere new clears it automatically — no second tap.

**Because geolocation is often blocked**, there are two fallbacks that always work:
1. A pin button that clears whatever is at the centre of the screen.
2. A paste field that accepts coordinates *or* a whole map link: `40.9269, -75.2026` · `https://maps.google.com/?q=41.1165,-75.0121` · `https://maps.apple.com/?ll=41.05,-75.35`

A diagnostic panel reports exactly what is blocking location and gives per-platform instructions rather than failing silently.

### Memories
Title, photo, note, date, creator, approximate location. Pinned as a pink pixel heart. Photos upload to asset storage with a compressed data-URL fallback. Tapping a photo opens it full-screen. Editable after the fact — date, title and note — with the date change moving it in the calendar.

### Calendar
Every memory appears automatically on the date it happened. A month with memories shows a pink grid: days with pins fill in princess pink with a 💗 (and ×2, ×3 for several), today gets a gold ring, and every memory that month lists below with photo thumbnails. A month with none shows just the month name and *"Add your favorite memories!"*. History stops at May 2026; forward is unlimited.

### Surprises
One person hides a sealed letter at a location for the other. It shows as an envelope and only opens when the recipient is physically within a set distance (1/3/8 km). Unopened ones pulse.

### Landmarks
Hand-built pixel icons for real places:

| Place | Icon |
|---|---|
| Bushkill Falls Park, PA | tall narrow plunge in a forested gorge |
| Great Falls Park, VA | wide rocky cascade, three channels |
| Dale's Pocono Bistro, Bartonsville PA | pink coffee mug, gold saucer, floating heart |
| Camelback Resort, Tannersville PA | lavender twin-peak mountain, snow, pink summit flag |
| Night Lights, Pocono Raceway | golden radiant sun, big, with sky lanterns rising and fading |
| New York City | Statue of Liberty, largest marker on the map |

Opposite silhouettes on purpose — the two waterfalls are vertical vs horizontal so they're distinguishable without reading the label.

### Navigation
- **Hop bar** — `‹  🏡 Arnold & Annapolis  ›` — steps through every place that's yours and flies there.
- **Our places** — full list, tap to jump.
- **Show us together** — frames both home bases at once.

---

## 7. STORAGE MODEL — LOCAL FIRST

This is the single most important architectural decision, and it was learned by getting it wrong.

**The page must render a complete world with zero successful network reads.**

Three tiers, merged by id:

1. **Page seeds** — key places and memories compiled into the page itself. Always present, no permissions, no accounts, works offline.
2. **Device cache** — every read and every write also lands in `localStorage`. Your own edits outrank page seeds.
3. **Shared database** — a small document store (`discoveries`, `memories`, `surprises`, `deleted`) synced between both people.

**Write path:** save to device first → then attempt the shared world → tell the user plainly if the shared write failed. The pin exists either way.

**Read path:** read each collection *once* on load, **then** subscribe for live updates. A live subscription can die on its own; a one-shot read still fills the world.

**Deletes:** removing something writes a tombstone document to the shared world, so it stays gone on every device even if the delete itself is refused. Retired ids are also blocklisted in the page so a stale cached copy can never resurrect them.

### Mistakes worth not repeating
- **Never rely only on a live subscription.** The original build subscribed but never did an initial read. Writes worked perfectly, reads never happened, and the app looked completely broken while the database was full of correct data.
- **Never swallow errors.** Empty `catch` blocks hid the real fault for days.
- **Never test only locally.** Local file testing doesn't run the runtime capability code at all, so local tests passed while the real device failed.
- **Hardcoded fallback data goes stale and lies to the user.** Seeds must be blocklist-aware and periodically reconciled with the live store.
- **Surface connection state in the UI.** A status chip showing *Shared* vs *This device only*, with the actual error text and a round-trip test button, is worth more than any amount of guessing.

---

## 8. IDENTITY

Both people share one account, so identity is a per-device choice stored locally: a first-run picker (golden cottage = Bruce, pink castle = Princess Elena). It decides whose name goes on new pins, who a sealed letter is addressed to, and who sees the opening card.

---

## 9. THE OPENING CARD

When the device is set to Elena, opening the map shows a full-screen pink card: a small "OUR WORLD" mark, a gold rule, one line in the pixel display font, and hearts drifting upward. Tap to dismiss into the map. Bruce gets the map immediately.

24 lines in rotation, never repeating the last one, plus a separate set that only appears on her birthday (September 12).

---

## 10. STATE SHAPE

```js
S = {
  who,                  // 'bruce' | 'elena'
  mode,                 // 'map' | 'globe'
  center: {lat, lng}, zoom,
  globe:  {lon, lat, scale},
  regions:  [ {id, name, lat, lng, r, by, at} ],
  memories: [ {id, title, note, date, by, lat, lng, at, photoUrl, assetId} ],
  surprises:[ {id, title, note, by, forWho, unlockKm, lat, lng, opened, at} ],
  deleted:  { id: 1 },
  me,                   // last GPS fix
  placing, selected, db, assets
}
```

---

## 11. BUILT AND WORKING

Real 2D geography · fog with world-anchored clouds · both home bases · regional discovery · memory pins with photos and full-screen viewing · editable dates · calendar · sealed surprises · six custom landmarks · Earth globe · outer space · place-hopping navigation · local-first storage with shared sync · location fallbacks · connection diagnostics · birthday awareness.

## 12. NOT BUILT YET

- **Trips** — group memories into a named trip and draw the route between stops in order as a gold thread across the map. *The highest-value next feature.*
- **Photos as polaroids on the map** rather than only inside the card.
- **Printable poster export** — the whole world as a framable high-res image.
- **"This day" look-back** — *one year ago today, you were at Bushkill Falls.*
- Live presence (seeing when the other person has it open).
- Voice notes.

## 13. DELIBERATELY REJECTED

- Pre-placed "mystery landmark" markers — every mark should be one they made.
- Statistics and percentages — turns romance into a dashboard.
- Continuous background location tracking — discovery happens when they choose.
- Exact addresses — everything is pinned to approximate town locations by design.

---

*Built as a single self-contained HTML page plus one ~40KB geography file. No build step, no framework, no dependencies.*
