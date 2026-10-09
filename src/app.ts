import { Globe } from "@/components/Globe";
import { WorldMap } from "@/components/WorldMap";
import { LocalStorageVisitedRepository } from "@/storage/LocalStorageVisitedRepository";
import type { CountryId, VisitedRepository } from "@/storage/VisitedRepository";
import { totalCountryCount } from "@/utils/countries";

type Screen = "globe" | "map";

/**
 * Top-level controller: owns the two screens, the shared visited state, and the
 * transition between them. All persistence goes through a VisitedRepository so
 * the backend can later be swapped without touching this file.
 */
export class App {
  private readonly repo: VisitedRepository = new LocalStorageVisitedRepository();
  private visited: Set<CountryId> = new Set();

  private globe!: Globe;
  private map!: WorldMap;

  private globeScreen!: HTMLElement;
  private mapScreen!: HTMLElement;
  private counterEl!: HTMLElement;
  private current: Screen = "globe";

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.visited = await this.repo.getVisited();
    this.render();

    this.globe = new Globe(() => this.goTo("map"));
    this.globe.setVisited(this.visited);
    document.getElementById("globe-stage")!.appendChild(this.globe.canvas);
    this.globe.start();

    this.map = new WorldMap({ onToggle: (id) => this.handleToggle(id) });
    this.map.setVisited(this.visited);
    this.map.mount(document.getElementById("map-stage")!);

    this.updateCounter();
  }

  private render(): void {
    this.root.innerHTML = `
      <main class="app">
        <section id="globe-screen" class="screen screen--globe is-active" aria-label="Start screen">
          <div id="globe-stage" class="globe-stage"></div>
          <div class="globe-intro">
            <h1 class="brand">MyFootprints</h1>
            <p class="hint"><span>Click the globe to explore</span></p>
          </div>
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
    this.counterEl = document.getElementById("counter")!;
    document.getElementById("back-btn")!.addEventListener("click", () => this.goTo("globe"));
  }

  private async handleToggle(id: CountryId): Promise<boolean> {
    const nowVisited = await this.repo.toggleVisited(id);
    if (nowVisited) this.visited.add(id);
    else this.visited.delete(id);
    this.globe.setVisited(this.visited);
    this.updateCounter();
    return nowVisited;
  }

  private updateCounter(): void {
    const total = totalCountryCount();
    const count = this.visited.size;
    const pct = total ? Math.round((count / total) * 100) : 0;
    this.counterEl.innerHTML = `
      <span class="counter-main">${count} / ${total}</span>
      <span class="counter-sub">countries · ${pct}%</span>`;
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
      this.globe.stop();
      this.map.resetZoom();
    } else {
      // Re-enter the globe fresh so it rotates again.
      this.globe.start();
    }
  }
}
