import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import type { GeoProjection, GeoPermissibleObjects } from "d3-geo";

import { getCountries, type CountryFeature } from "@/utils/countries";
import { COLORS } from "@/utils/theme";
import type { CountryId } from "@/storage/VisitedRepository";

interface GlobeOptions {
  /** Called when the user clicks (not drags) the globe. */
  onOpen: () => void;
}

/**
 * Canvas orthographic globe for the start screen.
 *
 * Renders on a <canvas> (smooth for continuous rotation), auto-rotates, and can
 * be dragged to spin. Visited countries are filled green. A click that is not a
 * drag triggers {@link GlobeOptions.onOpen}.
 */
export class Globe {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly projection: GeoProjection;
  private readonly path: ReturnType<typeof geoPath>;
  private readonly countries: CountryFeature[];
  private readonly graticule = geoGraticule10();

  private visited: Set<CountryId> = new Set();
  private rotation: [number, number] = [0, -15];
  private autoRotate = true;
  private raf = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Drag state
  private dragging = false;
  private moved = false;
  private lastPointer: [number, number] = [0, 0];
  private pointerDownAt = 0;

  private destroyed = false;

  constructor(private readonly onOpen: GlobeOptions["onOpen"]) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "globe-canvas";
    this.canvas.setAttribute("role", "button");
    this.canvas.setAttribute("tabindex", "0");
    this.canvas.setAttribute("aria-label", "Interactive globe. Activate to explore the world map.");

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.countries = getCountries();
    this.projection = geoOrthographic().clipAngle(90).precision(0.5);
    this.path = geoPath(this.projection, this.ctx);

    this.attachEvents();
  }

  setVisited(visited: Set<CountryId>): void {
    this.visited = visited;
  }

  /** Size the canvas to its parent and start the render loop. */
  start(): void {
    this.destroyed = false;
    this.autoRotate = true;
    this.resize();
    window.removeEventListener("resize", this.resize);
    window.addEventListener("resize", this.resize);
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  stop(): void {
    this.autoRotate = false;
    cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const { clientWidth: w, clientHeight: h } = parent;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const size = Math.min(w, h);
    const radius = size * 0.42;
    this.projection
      .scale(radius * this.dpr)
      .translate([(w * this.dpr) / 2, (h * this.dpr) / 2]);
  };

  private loop = (): void => {
    if (this.destroyed) return;
    if (this.autoRotate && !this.dragging) {
      this.rotation[0] += 0.18; // degrees per frame
    }
    this.projection.rotate(this.rotation);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = this.projection.scale();

    ctx.clearRect(0, 0, w, h);

    // Atmosphere glow (soft ring just outside the sphere).
    const glow = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.22);
    glow.addColorStop(0, "rgba(43, 108, 176, 0.35)");
    glow.addColorStop(1, "rgba(43, 108, 176, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // Base sphere.
    ctx.beginPath();
    this.path({ type: "Sphere" } as GeoPermissibleObjects);
    ctx.fillStyle = COLORS.sphere;
    ctx.fill();

    // Graticule.
    ctx.beginPath();
    this.path(this.graticule);
    ctx.strokeStyle = COLORS.graticule;
    ctx.lineWidth = this.dpr;
    ctx.stroke();

    // Countries.
    for (const country of this.countries) {
      ctx.beginPath();
      this.path(country);
      ctx.fillStyle = this.visited.has(country.id) ? COLORS.visited : COLORS.land;
      ctx.fill();
      ctx.lineWidth = 0.4 * this.dpr;
      ctx.strokeStyle = this.visited.has(country.id)
        ? COLORS.visitedStroke
        : COLORS.landStroke;
      ctx.stroke();
    }

    // Volume shading: darken toward the lower-right limb.
    const shade = ctx.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.35,
      r * 0.2,
      cx,
      cy,
      r,
    );
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();

    // Specular highlight (top-left).
    const hi = ctx.createRadialGradient(
      cx - r * 0.45,
      cy - r * 0.45,
      0,
      cx - r * 0.45,
      cy - r * 0.45,
      r * 0.8,
    );
    hi.addColorStop(0, "rgba(255, 255, 255, 0.18)");
    hi.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = hi;
    ctx.fill();
  }

  private attachEvents(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.onOpen();
      }
    });
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.moved = false;
    this.pointerDownAt = performance.now();
    this.lastPointer = [e.clientX, e.clientY];
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const [lx, ly] = this.lastPointer;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
    // Sensitivity scales inversely with globe size for a natural feel.
    const k = 0.25;
    this.rotation[0] += dx * k;
    this.rotation[1] = Math.max(-90, Math.min(90, this.rotation[1] - dy * k));
    this.lastPointer = [e.clientX, e.clientY];
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    const quick = performance.now() - this.pointerDownAt < 400;
    // A short press that didn't move = a click → open the map.
    if (!this.moved && quick) this.onOpen();
  };
}
