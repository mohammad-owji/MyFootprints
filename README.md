# MyFootprints

A minimal, modern web app for marking the countries you have visited on an
interactive world map. Start on a slowly rotating 3D-style globe, click through
to a flat world map, and tap countries to toggle them as visited. Your
selections are saved locally in the browser.

![dark theme · globe → map](https://img.shields.io/badge/theme-dark-0b0f14)

## Features

- **Globe start screen** — a shaded, glowing orthographic globe (HTML canvas)
  that auto-rotates and can be dragged. Visited countries show in green.
- **World map** — flat Natural Earth projection (SVG) with hover highlighting,
  floating country labels, click-to-toggle, zoom & pan (wheel / drag / pinch).
- **Visited styling** — calm emerald fill with centroid name labels that scale
  with country size (tiny countries show their name on hover only).
- **Persistence** — visited countries are stored in `localStorage` behind a
  small repository abstraction, so a real backend can be dropped in later.
- **Responsive & accessible** — works on desktop, tablet and mobile; keyboard
  focusable controls, aria-labels, reduced-motion support.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript (vanilla, no UI framework)
- [d3-geo](https://github.com/d3/d3-geo) for projections & path rendering
- [d3-zoom](https://github.com/d3/d3-zoom) for map zoom/pan
- [topojson-client](https://github.com/topojson/topojson-client) +
  [world-atlas](https://github.com/topojson/world-atlas) (`countries-110m`)
- Plain CSS

## Getting started

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173).

### Other scripts

```bash
npm run build     # type-check and build to dist/
npm run preview   # preview the production build
```

## How it works

1. **Globe (start screen).** The app opens on a rotating canvas globe. Click or
   tap it (or press Enter when focused) to transition to the map.
2. **Map.** All countries are interactive. Hover (or focus) a country to see its
   name; click/tap to toggle it visited. A counter in the corner shows your
   progress. Use the back button to return to the globe.
3. **Persistence.** Toggling a country saves immediately to `localStorage`.
   Reloading the page restores your visited set.

## Project structure

```
MyFootprints/
├── index.html                # entry HTML, fonts, favicon
├── vite.config.ts            # Vite config + "@/" → src alias
├── tsconfig.json
├── public/                   # static assets (currently empty)
└── src/
    ├── main.ts               # bootstraps the App
    ├── app.ts                # screen controller, counter, transitions
    ├── components/
    │   ├── Globe.ts          # canvas orthographic globe (screen 1)
    │   └── WorldMap.ts       # SVG flat map + zoom/pan (screen 2)
    ├── storage/
    │   ├── VisitedRepository.ts              # persistence interface
    │   └── LocalStorageVisitedRepository.ts  # localStorage implementation
    ├── utils/
    │   ├── countries.ts      # TopoJSON → features, id→name mapping
    │   ├── countryNames.ts   # fallback names for ids missing one
    │   └── theme.ts          # shared color tokens (canvas ↔ CSS)
    └── styles/
        ├── global.css        # theme variables, screen transitions
        ├── globe.css         # globe screen styles
        └── map.css           # map screen styles
```

## Swapping the storage backend

All persistence goes through the `VisitedRepository` interface
([src/storage/VisitedRepository.ts](src/storage/VisitedRepository.ts)):

```ts
interface VisitedRepository {
  getVisited(): Promise<Set<CountryId>>;
  toggleVisited(id: CountryId): Promise<boolean>;
  setVisited(ids: CountryId[]): Promise<void>;
}
```

The methods are already async, so replacing `LocalStorageVisitedRepository` with
an API/DB-backed implementation only requires writing a new class and swapping
the one `new LocalStorageVisitedRepository()` in
[src/app.ts](src/app.ts) — no other code changes.

## Notes on the data

- Country ids are ISO 3166-1 numeric codes (as strings), matching the
  world-atlas TopoJSON.
- Antarctica is excluded from the interactive map and the counter.
- The counter denominator is the number of countries in the dataset
  (`countries-110m`), which is close to but not exactly 195.
