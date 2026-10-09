import { Globe } from "@/components/Globe";
import { SpaceScene } from "@/space/SpaceScene";
import type { StartScene } from "@/components/StartScene";
import { WorldMap } from "@/components/WorldMap";
import { AuthControl } from "@/components/AuthControl";
import { LocalStorageVisitedRepository } from "@/storage/LocalStorageVisitedRepository";
import { isFirebaseConfigured } from "@/storage/firebaseConfig";
import type { CloudSync } from "@/storage/cloud";
import type { User } from "@/storage/firebase";
import type { CountryId, VisitedRepository } from "@/storage/VisitedRepository";
import { totalCountryCount } from "@/utils/countries";

type Screen = "globe" | "map";

/**
 * Top-level controller: owns the two screens, the shared visited state, and the
 * transition between them. All persistence goes through a VisitedRepository so
 * the backend can later be swapped without touching this file.
 */
export class App {
  // localStorage is always available as the offline fallback; `repo` points at
  // it until the user signs in, then switches to the Firestore-backed store.
  private readonly local = new LocalStorageVisitedRepository();
  private repo: VisitedRepository = this.local;
  private visited: Set<CountryId> = new Set();

  private startScene!: StartScene;
  private map!: WorldMap;
  private authControl: AuthControl | null = null;
  private cloud: CloudSync | null = null;

  private globeScreen!: HTMLElement;
  private mapScreen!: HTMLElement;
  private current: Screen = "globe";

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.visited = await this.repo.getVisited();
    this.render();

    this.startScene = createStartScene(() => this.goTo("map"));
    this.startScene.setVisited(this.visited);
    this.startScene.mount(document.getElementById("globe-stage")!);

    this.map = new WorldMap({ onToggle: (id) => this.handleToggle(id) });
    this.map.setVisited(this.visited);
    this.map.mount(document.getElementById("map-stage")!);

    this.updateCounter();
    this.setupAuth().catch((err) =>
      console.error("Failed to initialise cloud sync:", err),
    );
  }

  /**
   * Wire up Firebase auth, but only when configured — and lazily, so the large
   * Firebase SDK is code-split out of the default (localStorage) bundle. On
   * sign-in the repository switches to Firestore (seeding the cloud doc from
   * local data the first time) and the UI reloads from the active store.
   */
  private async setupAuth(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const { startCloudSync } = await import("@/storage/cloud");

    this.authControl = new AuthControl({
      onSignIn: () => this.cloud?.signIn() ?? Promise.resolve(),
      onSignOut: () => this.cloud?.signOut() ?? Promise.resolve(),
    });
    this.root.appendChild(this.authControl.el);

    this.cloud = startCloudSync({
      getLocalSeed: () => this.local.getVisited(),
      onChange: async (repo: VisitedRepository | null, user: User | null) => {
        this.repo = repo ?? this.local;
        this.applyVisited(await this.repo.getVisited());
        this.authControl?.setUser(user);
      },
    });
  }

  /** Push a freshly loaded visited set into both screens and the counter. */
  private applyVisited(visited: Set<CountryId>): void {
    this.visited = visited;
    this.startScene.setVisited(this.visited);
    this.map.setVisited(this.visited);
    this.updateCounter();
  }

  private render(): void {
    this.root.innerHTML = `
      <main class="app">
        <section id="globe-screen" class="screen screen--globe is-active" aria-label="Start screen">
          <div id="globe-stage" class="globe-stage"></div>
          <p class="start-hint"><span>Click to explore</span></p>
        </section>

        <section id="map-screen" class="screen screen--map" aria-label="World map" aria-hidden="true">
          <header class="map-header">
            <button id="back-btn" class="icon-btn" aria-label="Back to globe">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Globe</span>
            </button>
            <div id="counter" class="counter" aria-live="polite"></div>
          </header>
          <div id="map-stage" class="map-stage"></div>
        </section>
      </main>
    `;

    this.globeScreen = document.getElementById("globe-screen")!;
    this.mapScreen = document.getElementById("map-screen")!;
    document.getElementById("back-btn")!.addEventListener("click", () => this.goTo("globe"));
  }

  private async handleToggle(id: CountryId): Promise<boolean> {
    const nowVisited = await this.repo.toggleVisited(id);
    if (nowVisited) this.visited.add(id);
    else this.visited.delete(id);
    this.startScene.setVisited(this.visited);
    this.updateCounter();
    return nowVisited;
  }

  private updateCounter(): void {
    const total = totalCountryCount();
    const count = this.visited.size;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const html = `
      <span class="counter-main">${count} / ${total}</span>
      <span class="counter-sub">countries · ${pct}%</span>`;
    // Both the map header and the start screen show the counter.
    this.root
      .querySelectorAll<HTMLElement>(".counter")
      .forEach((el) => (el.innerHTML = html));
  }

  private goTo(screen: Screen): void {
    if (screen === this.current) return;
    this.current = screen;

    const toMap = screen === "map";
    this.globeScreen.classList.toggle("is-active", !toMap);
    this.globeScreen.classList.toggle("is-exit", toMap);
    this.mapScreen.classList.toggle("is-active", toMap);
    this.globeScreen.setAttribute("aria-hidden", String(toMap));
    this.mapScreen.setAttribute("aria-hidden", String(!toMap));

    if (toMap) {
      this.startScene.stop();
      this.map.resetZoom();
    } else {
      // Re-enter the start screen (resumes rotation / zooms back out).
      this.startScene.start();
    }
  }
}

/** True when the browser can create a WebGL context. */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

/** The Three.js space scene when WebGL is available, else the canvas globe. */
function createStartScene(onOpen: () => void): StartScene {
  if (webglAvailable()) {
    try {
      return new SpaceScene(onOpen);
    } catch (err) {
      console.error("WebGL start scene failed, falling back to globe:", err);
    }
  }
  return new Globe(onOpen);
}
