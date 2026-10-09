# MyFootprints

A minimal, modern web app for marking the countries you have visited on an
interactive world map. Start on a slowly rotating 3D-style globe, click through
to a flat world map, and tap countries to toggle them as visited. Your
selections are saved locally in the browser.

![dark theme · globe → map](https://img.shields.io/badge/theme-dark-0b0f14)

## Features

- **Space start screen** — a small Earth floating in deep space (Three.js /
  WebGL) with a starfield + nebula, an orbiting crater Moon and a distant Sun
  that lights the day/night terminator. Drag to rotate (with inertia), hover for
  a glow boost, click to zoom cinematically into the world map. Visited
  countries appear in green on the Earth. Falls back to a canvas globe when
  WebGL is unavailable.
- **World map** — flat Natural Earth projection (SVG) with hover highlighting,
  floating country labels, click-to-toggle, zoom & pan (wheel / drag / pinch).
- **Visited styling** — calm emerald fill with centroid name labels that scale
  with country size (tiny countries show their name on hover only).
- **Persistence** — visited countries are stored in `localStorage` behind a
  small repository abstraction. Optionally sign in with Google to sync across
  devices via **Firebase Firestore** (same abstraction, drop-in backend).
- **Responsive & accessible** — works on desktop, tablet and mobile; keyboard
  focusable controls, aria-labels, reduced-motion support (twinkle, orbit and
  drift animations pause), and the render loop pauses when the tab is hidden.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript (vanilla, no UI framework)
- [Three.js](https://threejs.org/) for the WebGL space start screen
- [d3-geo](https://github.com/d3/d3-geo) for projections & path rendering
  (the flat map and the procedural Earth texture)
- [d3-zoom](https://github.com/d3/d3-zoom) for map zoom/pan
- [topojson-client](https://github.com/topojson/topojson-client) +
  [world-atlas](https://github.com/topojson/world-atlas) (`countries-110m`)
- [Firebase](https://firebase.google.com/) (optional) for auth + cloud sync
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

## Cloud sync (Firebase) — optional

Without any configuration the app runs entirely on `localStorage` (per-browser).
To sync your visited countries across devices, enable Firebase:

1. Create a free project at the [Firebase console](https://console.firebase.google.com/).
2. **Authentication** → *Get started* → enable the **Google** sign-in provider.
3. **Firestore Database** → *Create database* (production mode is fine).
4. Add a **Web app** (`</>`) to the project and copy its config values.
5. Copy `.env.example` to `.env.local` and paste the values:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   # STORAGE_BUCKET and MESSAGING_SENDER_ID are optional
   ```

6. Set Firestore **security rules** so each user only touches their own data:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

7. Restart `npm run dev`. A **Sign in** control appears top-right. On first
   sign-in your existing local countries are copied up to the cloud; after that
   Firestore (document `users/{uid}`) is the source of truth and your countries
   follow you to any device.

The Firebase web keys are **not secrets** (they ship in every web build); access
is secured by the auth + rules above, so `.env.local` is git-ignored only so
each deployment uses its own project.

## How it works

1. **Space (start screen).** The app opens on the Three.js scene — Earth, Moon,
   Sun and stars. Drag to rotate the Earth; click it to zoom into the map (or a
   canvas-globe fallback when WebGL is unavailable).
2. **Map.** All countries are interactive. Hover (or focus) a country to see its
   name; click/tap to toggle it visited. A counter shows your progress. Use the
   back button to return to the space scene.
3. **Persistence.** Toggling a country saves immediately (localStorage, or
   Firestore when signed in). Reloading restores your visited set, shown green
   on both the Earth and the flat map.

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
    │   ├── StartScene.ts     # interface shared by SpaceScene + Globe
    │   ├── Globe.ts          # canvas globe (WebGL fallback)
    │   ├── WorldMap.ts       # SVG flat map + zoom/pan (screen 2)
    │   └── AuthControl.ts    # minimal sign-in / sign-out control
    ├── space/                # Three.js start screen
    │   ├── SpaceScene.ts     # orchestrator: camera, loop, interaction
    │   ├── Earth.ts          # textured sphere + fresnel atmosphere
    │   ├── Moon.ts           # orbiting procedural crater moon
    │   ├── Sun.ts            # directional light + corona sprite
    │   ├── Starfield.ts      # THREE.Points stars + nebula backdrop
    │   └── earthTexture.ts   # procedural equirectangular Earth texture
    ├── storage/
    │   ├── VisitedRepository.ts              # persistence interface
    │   ├── LocalStorageVisitedRepository.ts  # localStorage implementation
    │   ├── FirestoreVisitedRepository.ts     # Firebase implementation
    │   ├── firebaseConfig.ts                 # env config (SDK-free)
    │   ├── firebase.ts                       # Firebase init + Google auth
    │   └── cloud.ts                          # lazy-loaded cloud-sync facade
    ├── utils/
    │   ├── countries.ts      # TopoJSON → features, id→name mapping
    │   ├── countryNames.ts   # fallback names for ids missing one
    │   └── theme.ts          # shared color tokens (canvas ↔ CSS)
    └── styles/
        ├── global.css        # theme variables, screen transitions
        ├── globe.css         # start-screen overlay (brand, hint, counter)
        ├── space.css         # Three.js canvas styles
        ├── map.css           # map screen styles
        └── auth.css          # sign-in control styles
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

The methods are already async, so a new backend is just a new class implementing
this interface. Two implementations ship today:

- [`LocalStorageVisitedRepository`](src/storage/LocalStorageVisitedRepository.ts)
  — the default, per-browser.
- [`FirestoreVisitedRepository`](src/storage/FirestoreVisitedRepository.ts)
  — cloud sync per signed-in user.

[src/app.ts](src/app.ts) starts on localStorage and automatically switches to
Firestore when a user signs in (see *Cloud sync* above), seeding the cloud from
local data on first sign-in.

## Tuning the space scene

Quick knobs, all in [src/space/](src/space/):

| What | Where | Default |
| --- | --- | --- |
| Star count | `SpaceScene.ts` → `new Starfield(6000, …)` | `6000` |
| Earth auto-rotation speed | `SpaceScene.ts` → `AUTO_ROTATE` | `0.045` rad/s |
| Earth size on screen | `SpaceScene.ts` → `EARTH_HEIGHT_FRACTION` | `0.34` |
| Camera field of view | `SpaceScene.ts` → `FOV` | `38` |
| Moon size / distance / speed | `Moon.ts` → `0.27` · `3.4` · `0.12` | — |
| Sun position & light | `Sun.ts` → `position`, `DirectionalLight` | — |
| Earth / ocean / land colours | `earthTexture.ts` constants | — |
| Atmosphere colour & strength | `Earth.ts` → `uColor`, `setHover` | — |

Visited green is `#34d399` (shared with the map via `earthTexture.ts` and the
CSS `--visited` token).

## Notes on the data

- Country ids are ISO 3166-1 numeric codes (as strings), matching the
  world-atlas TopoJSON.
- Antarctica is excluded from the interactive map and the counter.
- The counter denominator is the number of countries in the dataset
  (`countries-110m`), which is close to but not exactly 195.
