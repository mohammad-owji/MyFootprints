import { geoEquirectangular, geoPath } from "d3-geo";

import { getCountries } from "@/utils/countries";
import type { CountryId } from "@/storage/VisitedRepository";

/**
 * Procedural equirectangular Earth texture, drawn from the world-atlas TopoJSON
 * onto an offscreen canvas — no external image downloads. Oceans are a deep
 * blue-gray, land a slightly lighter tone, and visited countries the app green.
 * Redraw via {@link drawEarthTexture} whenever the visited set changes.
 */

const OCEAN = "#0e1d29";
const LAND = "#33444f";
const LAND_STROKE = "rgba(8, 14, 20, 0.55)";
const VISITED = "#34d399";
const VISITED_STROKE = "#1f9d6b";

export function createEarthCanvas(width = 2048): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width / 2; // equirectangular is 2:1
  return canvas;
}

export function drawEarthTexture(
  canvas: HTMLCanvasElement,
  visited: Set<CountryId>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;

  const projection = geoEquirectangular().fitSize([width, height], {
    type: "Sphere",
  });
  const path = geoPath(projection, ctx);

  ctx.fillStyle = OCEAN;
  ctx.fillRect(0, 0, width, height);

  ctx.lineJoin = "round";
  for (const country of getCountries()) {
    const isVisited = visited.has(country.id);
    ctx.beginPath();
    path(country);
    ctx.fillStyle = isVisited ? VISITED : LAND;
    ctx.fill();
    ctx.lineWidth = isVisited ? 1 : 0.6;
    ctx.strokeStyle = isVisited ? VISITED_STROKE : LAND_STROKE;
    ctx.stroke();
  }
}

export type { CountryId };
