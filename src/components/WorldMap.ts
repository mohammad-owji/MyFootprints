import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { select, type Selection } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from "d3-zoom";

import { getCountries, countryName, type CountryFeature } from "@/utils/countries";
import type { CountryId } from "@/storage/VisitedRepository";

const SVG_NS = "http://www.w3.org/2000/svg";

// Pixel-area threshold (at zoom = 1) above which a visited country gets a
// permanent centroid label. Smaller countries only show their name on hover.
const LABEL_MIN_AREA = 900;

interface WorldMapOptions {
  /** Toggle a country; resolves with its new visited state. */
  onToggle: (id: CountryId) => Promise<boolean>;
}

/**
 * Interactive flat world map (SVG + d3-zoom).
 *
 * - hover: highlight + floating name label at the cursor
 * - click/tap: toggle visited
 * - visited countries: green fill + centroid label (large ones only)
 * - wheel / drag / pinch zoom + pan with sensible limits
 */
export class WorldMap {
  readonly el: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly zoomLayer: Selection<SVGGElement, unknown, null, undefined>;
  private readonly floatingLabel: HTMLDivElement;

  private readonly projection: GeoProjection;
  private readonly path: ReturnType<typeof geoPath>;
  private readonly countries: CountryFeature[];
  private readonly pathEls = new Map<CountryId, SVGPathElement>();

  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private currentScale = 1;
  private visited: Set<CountryId> = new Set();
  private hoveredId: CountryId | null = null;

  constructor(private readonly opts: WorldMapOptions) {
    this.el = document.createElement("div");
    this.el.className = "map-root";

    const svgEl = document.createElementNS(SVG_NS, "svg");
    svgEl.setAttribute("class", "map-svg");
    svgEl.setAttribute("role", "application");
    svgEl.setAttribute("aria-label", "World map. Select a country to mark it visited.");
    this.el.appendChild(svgEl);

    this.floatingLabel = document.createElement("div");
    this.floatingLabel.className = "map-floating-label";
    this.floatingLabel.setAttribute("aria-hidden", "true");
    this.el.appendChild(this.floatingLabel);

    this.svg = select(svgEl);
    this.zoomLayer = this.svg.append("g").attr("class", "zoom-layer");

    this.countries = getCountries();
    this.projection = geoNaturalEarth1();
    this.path = geoPath(this.projection);

    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", this.handleZoom);
    this.svg.call(this.zoomBehavior);

    this.buildPaths();
  }

  setVisited(visited: Set<CountryId>): void {
    this.visited = visited;
    this.refreshStyles();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  destroy(): void {
    window.removeEventListener("resize", this.resize);
    this.el.remove();
  }

  private buildPaths(): void {
    for (const country of this.countries) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("class", "country");
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "button");
      const name = countryName(country);
      p.setAttribute("aria-label", name);

      p.addEventListener("pointerenter", (e) => this.onHover(country, e));
      p.addEventListener("pointermove", (e) => this.moveFloatingLabel(e));
      p.addEventListener("pointerleave", () => this.onHoverEnd(country));
      p.addEventListener("click", () => this.toggle(country));
      p.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggle(country);
        }
      });

      this.pathEls.set(country.id, p);
      this.zoomLayer.node()!.appendChild(p);
    }
  }

  private resize = (): void => {
    const { clientWidth: w, clientHeight: h } = this.el;
    if (!w || !h) return;

    const pad = Math.min(w, h) * 0.04;
    this.projection.fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      { type: "FeatureCollection", features: this.countries },
    );

    for (const country of this.countries) {
      const d = this.path(country);
      const el = this.pathEls.get(country.id);
      if (el && d) el.setAttribute("d", d);
    }
    this.refreshStyles();
  };

  private handleZoom = (event: D3ZoomEvent<SVGSVGElement, unknown>): void => {
    const { transform } = event;
    this.currentScale = transform.k;
    this.zoomLayer.attr("transform", transform.toString());
    // Keep label text and strokes visually constant while zooming.
    this.zoomLayer
      .selectAll<SVGTextElement, unknown>("text.country-label")
      .attr("font-size", (_, i, nodes) => {
        const base = Number((nodes[i] as SVGTextElement).dataset.base ?? 11);
        return base / transform.k;
      });
  };

  private onHover(country: CountryFeature, e: PointerEvent): void {
    this.hoveredId = country.id;
    this.pathEls.get(country.id)?.classList.add("is-hover");
    this.floatingLabel.textContent = countryName(country);
    this.floatingLabel.classList.add("is-visible");
    this.moveFloatingLabel(e);
  }

  private moveFloatingLabel(e: PointerEvent): void {
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.floatingLabel.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  }

  private onHoverEnd(country: CountryFeature): void {
    if (this.hoveredId === country.id) this.hoveredId = null;
    this.pathEls.get(country.id)?.classList.remove("is-hover");
    this.floatingLabel.classList.remove("is-visible");
  }

  private async toggle(country: CountryFeature): Promise<void> {
    const nowVisited = await this.opts.onToggle(country.id);
    if (nowVisited) this.visited.add(country.id);
    else this.visited.delete(country.id);
    this.refreshStyles();
  }

  /** Reapply visited classes and rebuild centroid labels. */
  private refreshStyles(): void {
    for (const [id, el] of this.pathEls) {
      el.classList.toggle("is-visited", this.visited.has(id));
    }
    this.renderLabels();
  }

  private renderLabels(): void {
    this.zoomLayer.selectAll("text.country-label").remove();
    const layer = this.zoomLayer.node();
    if (!layer) return;

    for (const country of this.countries) {
      if (!this.visited.has(country.id)) continue;
      const area = this.path.area(country); // pixel area at current fit
      if (area < LABEL_MIN_AREA) continue; // tiny countries: hover only

      const [cx, cy] = this.path.centroid(country);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

      // Font size scales gently with country area, then clamps.
      const base = Math.max(9, Math.min(16, Math.sqrt(area) / 7));
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("class", "country-label");
      text.setAttribute("x", String(cx));
      text.setAttribute("y", String(cy));
      text.setAttribute("font-size", String(base / this.currentScale));
      text.dataset.base = String(base);
      text.textContent = countryName(country);
      layer.appendChild(text);
    }
  }

  /** Programmatic reset of the zoom/pan (used when entering the screen). */
  resetZoom(): void {
    this.svg.call(this.zoomBehavior.transform, zoomIdentity);
  }
}
