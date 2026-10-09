import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { select, type Selection } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from "d3-zoom";

import { getCountries, countryName, type CountryFeature } from "@/utils/countries";
import type { CountryId } from "@/storage/VisitedRepository";

const SVG_NS = "http://www.w3.org/2000/svg";

interface WorldMapOptions {
  /** A real click (not a drag) on a country — opens the confirmation dialog. */
  onSelect: (country: CountryFeature) => void;
}

/**
 * Interactive flat world map (SVG + d3-zoom).
 *
 * - hover: highlight + the country's name animates in at its centroid
 * - click/tap: open the confirmation dialog (drags are ignored)
 * - visited countries: green fill
 * - wheel / drag / pinch zoom + pan with sensible limits
 */
export class WorldMap {
  readonly el: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly zoomLayer: Selection<SVGGElement, unknown, null, undefined>;
  private hoverLabel!: SVGTextElement;

  private readonly projection: GeoProjection;
  private readonly path: ReturnType<typeof geoPath>;
  private readonly countries: CountryFeature[];
  private readonly pathEls = new Map<CountryId, SVGPathElement>();

  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private currentScale = 1;
  private visited: Set<CountryId> = new Set();
  private hoveredId: CountryId | null = null;
  private pointerMoved = false; // true once a pan/drag happens, to suppress clicks

  constructor(private readonly opts: WorldMapOptions) {
    this.el = document.createElement("div");
    this.el.className = "map-root";

    const svgEl = document.createElementNS(SVG_NS, "svg");
    svgEl.setAttribute("class", "map-svg");
    svgEl.setAttribute("role", "application");
    svgEl.setAttribute("aria-label", "World map. Select a country to mark it visited.");
    this.el.appendChild(svgEl);

    this.svg = select(svgEl);
    this.zoomLayer = this.svg.append("g").attr("class", "zoom-layer");

    this.countries = getCountries();
    this.projection = geoNaturalEarth1();
    this.path = geoPath(this.projection);

    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", this.handleZoom);
    this.svg.call(this.zoomBehavior);
    // Reset the drag guard at the start of every gesture.
    this.svg.on("pointerdown.track", () => {
      this.pointerMoved = false;
    });

    this.buildPaths();

    // A single hover label, kept on top and repositioned to the hovered
    // country. It fades/scales in via CSS and persists (hidden) otherwise.
    this.hoverLabel = document.createElementNS(SVG_NS, "text");
    this.hoverLabel.setAttribute("class", "country-label");
    this.hoverLabel.setAttribute("aria-hidden", "true");
    this.zoomLayer.node()!.appendChild(this.hoverLabel);
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

      p.addEventListener("pointerenter", () => this.onHover(country));
      p.addEventListener("pointerleave", () => this.onHoverEnd(country));
      p.addEventListener("click", () => {
        if (this.pointerMoved) return; // ignore the click that ends a pan
        this.opts.onSelect(country);
      });
      p.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.opts.onSelect(country);
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
    // A pointer-driven pan counts as a drag, so the ensuing click is ignored.
    if (event.sourceEvent && /move/.test(event.sourceEvent.type)) {
      this.pointerMoved = true;
    }
    // Keep the label visually constant while zooming.
    this.applyLabelScale();
  };

  private onHover(country: CountryFeature): void {
    this.hoveredId = country.id;
    this.pathEls.get(country.id)?.classList.add("is-hover");
    this.showHoverLabel(country);
  }

  private onHoverEnd(country: CountryFeature): void {
    this.pathEls.get(country.id)?.classList.remove("is-hover");
    // Only hide the label if we are truly leaving (not switching to another
    // country whose pointerenter already fired first).
    if (this.hoveredId === country.id) {
      this.hoveredId = null;
      this.hoverLabel.classList.remove("is-visible");
    }
  }

  /** Clear any hover highlight/label (used when a dialog opens over the map). */
  clearHover(): void {
    if (this.hoveredId) {
      this.pathEls.get(this.hoveredId)?.classList.remove("is-hover");
      this.hoveredId = null;
    }
    this.hoverLabel.classList.remove("is-visible");
  }

  /** Reapply visited classes. */
  private refreshStyles(): void {
    for (const [id, el] of this.pathEls) {
      el.classList.toggle("is-visited", this.visited.has(id));
    }
  }

  /** Position and reveal the hover label at the country's centroid. */
  private showHoverLabel(country: CountryFeature): void {
    const [cx, cy] = this.path.centroid(country);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      this.hoverLabel.classList.remove("is-visible");
      return;
    }
    // Font size scales gently with country area, then clamps.
    const area = this.path.area(country);
    const base = Math.max(10, Math.min(18, Math.sqrt(area) / 6));
    this.hoverLabel.dataset.base = String(base);
    this.hoverLabel.setAttribute("x", String(cx));
    this.hoverLabel.setAttribute("y", String(cy));
    this.hoverLabel.textContent = countryName(country);
    this.applyLabelScale();
    this.hoverLabel.classList.add("is-visible");
  }

  /** Keep the label's font size and halo constant across zoom levels. */
  private applyLabelScale(): void {
    const base = Number(this.hoverLabel.dataset.base ?? 12);
    this.hoverLabel.setAttribute("font-size", String(base / this.currentScale));
    this.hoverLabel.setAttribute(
      "stroke-width",
      String((base * 0.16) / this.currentScale),
    );
  }

  /** Programmatic reset of the zoom/pan (used when entering the screen). */
  resetZoom(): void {
    this.svg.call(this.zoomBehavior.transform, zoomIdentity);
  }
}
