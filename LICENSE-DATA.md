# Map data attribution

All geography embedded in `src/geo.js` is public domain. No API keys, no tile
server, no per-request licensing.

## US Census Bureau — cartographic boundary files
County boundaries for MD, DC, VA, DE, PA, WV, NJ, NC, NY, CT. Works of the US
federal government; public domain. Coastal counties are clipped to the
shoreline, which is why the Chesapeake Bay, the Delmarva peninsula and the
Atlantic coast appear correctly without a separate coastline dataset.

## Natural Earth
Rivers and lake centerlines (10m), world land (110m).
Public domain — https://www.naturalearthdata.com

> "Natural Earth is a public domain map dataset... you may use the maps in any
> manner, including modifying the content and design."

## Hand-authored, NOT survey data
The following are approximations written by hand for visual texture and are
explicitly labelled as such in the UI:
- ~20 major route corridors (I-95, US-50, MD-2/4, I-270, I-81…) — waypoint
  polylines, not real road alignments.
- ~58 county and city-area label positions.
- ~130 town and landmark coordinates — approximate town centres by design.
  The app deliberately never stores or displays street-level addresses.
