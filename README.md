# Orbis

The world in one lens — a live 3D view of natural disasters across the planet.

Open the site and a photoreal Earth slowly turns in front of you: daylight on one
side, city lights on the night side, drifting clouds, and a thin blue atmosphere
rim. Rising from the surface are colored data spikes — red for earthquakes (taller
spike = stronger quake), amber for wildfires, blue for floods, violet for storms.
A glass side panel lets you search any place (the globe flies there), switch layers
on and off, filter by time, magnitude, and country (the country gets an outline on
the globe), and click any event to fly to it and open its detail card.

A **3D Globe / 2D Map** switch in the top bar flips between the globe and a flat
satellite map of the same data. Both views share every filter, the event list, the
detail card, and search — so you can work whichever view suits the moment without
losing your place.

## Features

- **3D globe / 2D map toggle** in the top bar — same events, filters, list,
  detail card and search in both views; each view keeps its own camera
- Photoreal 3D globe (day/night terminator from real UTC sun position, night-side
  city lights, clouds, atmosphere glow, starfield) with drag-zoom and slow auto-spin
- Flat 2D satellite map (Leaflet + Esri World Imagery, with place labels), country
  outlines, and the same click-to-inspect markers
- Live earthquake feed (USGS) with spikes scaled by magnitude
- Live wildfire, flood, and storm feed (NASA EONET), GDACS as backup source
- Place search with autocomplete (OpenStreetMap Nominatim), flag emoji, fly-to result
- Filters: 4 layer toggles, time window (24h / 7d / 30d / All), magnitude range
  (earthquakes only — visibly disabled otherwise), country/region dropdown with
  globe outline
- Event list synced with the globe: hover highlights the spike, click flies to it
  and opens a detail card; clicking a spike highlights its list row
- Auto-refresh (quakes every 60s, EONET every 120s), paused when the tab is hidden;
  globe rendering also pauses when hidden
- Loading skeletons, empty states, and per-layer error banners with Retry; a
  "3D view unavailable" fallback keeps list and filters working without WebGL
- Responsive: glass side panel + legend on desktop, pinned bottom sheet on mobile
- Accessible: skip link, labelled controls, aria-pressed toggles, aria-live result
  count, gold focus rings, reduced-motion support (no spin, instant camera moves)

## Tech stack

- React 19 + TypeScript + Vite
- three.js + @react-three/fiber + @react-three/drei + r3f-globe (three-globe bindings)
- Leaflet for the 2D map (canvas-rendered markers, no clustering)
- Custom GLSL day/night shader (inline template strings, no build plugin)
- React Context + useReducer for state, date-fns for relative times
- CSS Modules + CSS custom properties, IBM Plex fonts (Serif / Sans / Mono)

## Data sources

| Layer | Source | Refresh |
|-------|--------|---------|
| Earthquakes | USGS earthquake feed (2.5+ past month) | 60s |
| Wildfires, floods, storms | NASA EONET open events | 120s |
| Backup for all layers | GDACS event list (used only if a primary feed fails) | on demand |
| Place search | OpenStreetMap Nominatim (debounced, cached) | live |
| Country shapes | `public/countries.geojson` (world.geo.json, public domain) | static file |
| Satellite map tiles (shown when you zoom in close) | Esri World Imagery via ArcGIS REST (`server.arcgisonline.com`), no key needed | live, on zoom |
| Earth textures | `public/textures/` — Solar System Scope 2k day/night/clouds (CC BY 4.0), based on NASA Blue Marble / Black Marble | static files |

Attribution is shown in the footer on every screen size (exact strings in the app).

## How it works

**Fetching.** `src/hooks/useLiveData.ts` pulls three keyless feeds on a timer —
USGS every 60s, NASA EONET every 120s, GDACS once as a backup — and pauses when
the tab is hidden. Every successful response is held in a 3-minute in-memory
cache keyed by URL, so polling and repeated clicks on Refresh never hammer the
upstream APIs. Failures are never cached, so a Retry always hits the network.

**Normalisation.** The three feeds speak three different dialects, so each has a
parser (`parseQuakes`, `parseEonet`, `parseGdacs`) that emits the same
`LiveEvent` shape: id, type, title, place, lat/lng, time, magnitude, severity,
source, url. Event types are mapped onto four layers — quake, fire, flood,
storm — and GDACS's GREEN/ORANGE/RED alert level becomes a 0–1 severity for
marker sizing. If USGS or EONET fails, GDACS fills the gap for that layer, and
only the failing source is reported while the rest of the data keeps flowing.

**State.** One React Context with three reducers (`src/context/AppContext.tsx`)
holds filters, data, and UI. Everything — the globe, the 2D map, the event list,
the detail card, search — reads from that single store, so both views stay in
sync automatically.

**Rendering the globe.** `GlobeView.tsx` wraps `r3f-globe` in a react-three-fiber
`Canvas`. A custom GLSL shader mixes a day texture and a night texture using the
real subsolar point computed in `src/globe/sun.ts`, so the terminator is
accurate to the current UTC time. Events are drawn as three-globe point spikes;
when the camera gets close, a satellite tile engine (`globeTileEngineUrl`)
swaps in Esri imagery for that region. `src/utils/globeController.ts` is the
small bridge that lets the event list fly the active view to a marker.

**Rendering the map.** `Map2D.tsx` is a Leaflet instance with canvas-rendered
circle markers. It shares the same event array and selection state as the globe,
and registers its own camera API into the same controller, so "fly to event"
works identically in both views.

## Run it

You need Node.js 18 or newer installed.

```bash
cd living-earth
npm install
npm run dev
```

Then open http://localhost:5173 in a browser. No API keys or accounts needed.

```bash
npm run build   # type-check + production build into dist/
```

## Screenshots

- `screenshots/desktop.png` — desktop 1440×900, 3D globe (current build)
- `screenshots/desktop-2d.png` — desktop 1440×900, 2D satellite map (current build)
- `screenshots/mobile.png` — mobile 390×844 (current build)
- `screenshots/desktop-v1.png`, `screenshots/mobile-v1.png` — the v1 flat map, kept for comparison

## Out of scope (known limits)

- No marker clustering: non-quake layers cap at the 400 most recent markers each
  (with an on-map count note); the event list renders the first 150 matches.
- No severity filter for fires/floods/storms (EONET exposes no uniform scale).
- Country filter uses simplified point-in-polygon math on the bundled world file; if
  that file ever fails to load, the region list falls back to a built-in list of major
  countries without shape filtering or globe outline.
- Mobile panel uses tap-to-cycle (panel / tall / collapsed) instead of a drag gesture.
- The JS bundle is ~2.4 MB (mostly three.js + Leaflet); textures add ~1.7 MB local files.
