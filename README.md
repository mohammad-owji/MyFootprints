# 🌍 MyFootprints

A minimal, modern web app for marking the countries you've visited — on a
cinematic **3D Earth floating in space** and an interactive **world map**.

### ▶️ Live demo: **[myfootprints-world.web.app](https://myfootprints-world.web.app)**

![theme](https://img.shields.io/badge/theme-dark-0b0f14)
![stack](https://img.shields.io/badge/Vite-TypeScript-646cff)
![3d](https://img.shields.io/badge/Three.js-WebGL-000000)
![backend](https://img.shields.io/badge/Firebase-Hosting%20%2B%20Firestore-ffca28)

The app opens on a small Earth in deep space — a distant Sun lighting its
day/night side, an orbiting Moon, Saturn and Mars drifting in the background,
thousands of stars and the occasional comet. Click the Earth to zoom into a
flat world map, pick a country, and mark it visited. Your choices are saved in
the browser, or synced across all your devices when you sign in with Google.

## ✨ Features

- **Space start screen** (Three.js / WebGL)
  - A procedurally textured **Earth**, lit by the Sun with a soft day/night
    terminator; **visited countries glow green** even on the shadow side.
  - An orbiting **Moon** with its phase, a distant glowing **Sun**, **Saturn**
    with tilted rings and **Mars** in the background, a **starfield + nebula**,
    and a **comet** that streaks past every so often.
  - Drag to rotate the Earth (with inertia), subtle parallax on mouse move, and
    a cinematic camera **zoom into the map** on click. Only the Earth is
    clickable. Falls back to a canvas globe when WebGL is unavailable.
- **World map** — flat Natural Earth projection (SVG) with zoom & pan
  (wheel / drag / pinch). Hovering a country animates its **name** in at the
  country's centre.
- **Confirmation dialog** — clicking a country opens a small *"Have you visited
  this country?"* dialog with **Visited** / **Not yet**, so marking is
  deliberate. Focus-trapped, keyboard- and touch-friendly.
- **Persistence & cloud sync** — saved to `localStorage` by default, or to
  **Firebase Firestore** (per user) after a Google sign-in, so your map follows
  you across devices.
- **Responsive & accessible** — desktop, tablet and mobile; keyboard-focusable
  controls, aria labels, `prefers-reduced-motion` support, and the render loop
  pauses when the tab is hidden.

## 🛠️ Tech stack

- [Vite](https://vitejs.dev/) + TypeScript (vanilla — no UI framework)
- [Three.js](https://threejs.org/) for the WebGL space scene
- [d3-geo](https://github.com/d3/d3-geo) + [d3-zoom](https://github.com/d3/d3-zoom)
  for the flat map and the procedural Earth texture
- [topojson-client](https://github.com/topojson/topojson-client) +
  [world-atlas](https://github.com/topojson/world-atlas) (`countries-110m`) for the geometry
- [Firebase](https://firebase.google.com/) — Hosting, Auth (Google) & Firestore
- Plain CSS

## 🚀 Getting started

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173). Without any
configuration the app runs fully on `localStorage` — cloud sync is optional.

```bash
npm run build     # type-check + build to dist/
npm run preview   # preview the production build
```

## ☁️ Cloud sync (Firebase) — optional

To sync visited countries across devices:

1. Create a free project at the [Firebase console](https://console.firebase.google.com/).
2. **Authentication → Sign-in method** → enable **Google**.
3. **Firestore Database → Create database** (production mode).
4. Add a **Web app** (`</>`) and copy its config.
5. Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   # STORAGE_BUCKET and MESSAGING_SENDER_ID are optional
   ```

6. The Firestore rules in [`firestore.rules`](firestore.rules) already restrict
   each user to their own `users/{uid}` document.

Restart `npm run dev` — a **Sign in** control appears top-right. On first
sign-in your local countries are copied to the cloud; after that Firestore is
the source of truth. The Firebase SDK is code-split and only loaded when cloud
sync is configured.

> The Firebase web keys are **not secrets** (they ship in every web build);
> access is secured by Auth + Firestore rules. `.env.local` is git-ignored only
> so each deployment uses its own project.

## 📦 Deploy (Firebase Hosting)

A static build, hosted for free on Firebase Hosting (Spark plan).

```bash
npm install -g firebase-tools   # once
firebase login                  # once
npm run deploy                  # build + deploy hosting & Firestore rules
```

Other scripts: `npm run deploy:hosting` (site only), `npm run deploy:rules`
(rules only). Hosting config (SPA rewrite + cache headers) lives in
[`firebase.json`](firebase.json); the target project is in `.firebaserc`.

After the first deploy, in the Firebase console check **Authentication →
Settings → Authorized domains** includes `<project-id>.web.app` (needed for
Google sign-in).

## 🧭 How it works

1. **Space (start screen).** Opens on the Three.js scene. Drag to rotate the
   Earth; click it to zoom into the map.
2. **Map.** Hover a country to see its name; click it to open the dialog and
   choose **Visited** / **Not yet**. A counter shows your progress; the back
   button returns to space.
3. **Persistence.** Each choice saves immediately (localStorage, or Firestore
   when signed in) and is shown green on both the Earth and the flat map.

## 🗂️ Project structure

```
src/
├── main.ts                # bootstraps the App
├── app.ts                 # screen controller, dialog wiring, counter, auth
├── components/
│   ├── StartScene.ts      # interface shared by SpaceScene + Globe
│   ├── Globe.ts           # canvas globe (WebGL fallback)
│   ├── WorldMap.ts        # SVG flat map + zoom/pan + hover labels
│   ├── CountryDialog.ts   # Visited / Not yet confirmation dialog
│   └── AuthControl.ts     # minimal sign-in / sign-out control
├── space/                 # Three.js start screen
│   ├── SpaceScene.ts      # orchestrator: camera, loop, interaction, CONFIG
│   ├── Earth.ts           # textured sphere, emissive visited map, atmosphere
│   ├── Moon.ts            # orbiting procedural crater moon
│   ├── Sun.ts             # directional light + corona sprite
│   ├── Saturn.ts          # banded planet + procedural rings
│   ├── Mars.ts            # reddish procedural planet
│   ├── Comet.ts           # pooled comet (head + anti-sun tail)
│   ├── Starfield.ts       # THREE.Points stars + nebula backdrop
│   ├── atmosphere.ts      # shared fresnel atmosphere helper
│   └── earthTexture.ts    # procedural equirectangular Earth textures
├── storage/
│   ├── VisitedRepository.ts              # persistence interface
│   ├── LocalStorageVisitedRepository.ts  # localStorage implementation
│   ├── FirestoreVisitedRepository.ts     # Firebase implementation
│   ├── firebaseConfig.ts / firebase.ts   # env config + init + Google auth
│   └── cloud.ts                          # lazy-loaded cloud-sync facade
├── utils/                 # countries (TopoJSON), name fallbacks, theme tokens
└── styles/                # global, globe, space, map, auth, dialog CSS
```

## 🎛️ Tuning the space scene

Everything is in the `CONFIG` object at the top of
[`src/space/SpaceScene.ts`](src/space/SpaceScene.ts):

| What | Key | Default |
| --- | --- | --- |
| Earth size on screen | `earthHeightFraction` | `0.34` |
| Earth auto-rotation | `autoRotate` | `0.045` rad/s |
| Star count | `starCount` | `6000` |
| Sun light / sprite position | `sunLightPos` / `sunSpritePos` | — |
| Saturn size / rings / position | `saturn` | `radius 0.3`, `[5, -2.6, -12]` |
| Mars size / position | `mars` | `radius 0.16`, `[-5.5, 3, -10]` |
| Comet frequency (seconds) | `comet.minGap` / `maxGap` | `20` / `60` |

More: atmosphere strength in `Earth.ts` (`ATMO_BASE` / `ATMO_HOVER`); ocean/land
colours in `earthTexture.ts`. Visited green is `#34d399`.

## 🔌 Swapping the storage backend

All persistence goes through one interface
([`VisitedRepository`](src/storage/VisitedRepository.ts)):

```ts
interface VisitedRepository {
  getVisited(): Promise<Set<CountryId>>;
  toggleVisited(id: CountryId): Promise<boolean>;
  setVisited(ids: CountryId[]): Promise<void>;
}
```

Two implementations ship: `LocalStorageVisitedRepository` (default) and
`FirestoreVisitedRepository` (cloud). [`app.ts`](src/app.ts) starts on
localStorage and switches to Firestore on sign-in, seeding the cloud from local
data the first time. A new backend is just a new class implementing the interface.

## 📝 Notes on the data

- Country ids are ISO 3166-1 numeric codes (as strings), from the world-atlas TopoJSON.
- Antarctica is excluded from the map and the counter.
- The counter denominator is the dataset's country count (`countries-110m`),
  close to but not exactly 195.
