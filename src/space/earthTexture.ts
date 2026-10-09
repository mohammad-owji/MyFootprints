import { geoEquirectangular, geoPath } from "d3-geo";

import { getCountries } from "@/utils/countries";
import type { CountryId } from "@/storage/VisitedRepository";

/**
 * Procedural equirectangular Earth textures, drawn from the world-atlas TopoJSON
 * onto offscreen canvases — no external image downloads.
 *
 * - {@link drawEarthTexture}: the colour map (deep-blue oceans, lighter land,
 *   visited countries in the app green).
 * - {@link drawVisitedEmissive}: an emissive map (visited countries green on
 *   black) so they keep a faint glow even on the Earth's shadow side.
 */

const OCEAN = "#17496f"; // deep, rich blue
const LAND = "#5b7183"; // clearly lighter, muted blue-gray
const LAND_STROKE = "rgba(12, 22, 32, 0.45)";
const VISITED = "#34d399";
const VISITED_STROKE = "#1f9d6b";

function makeCanvas(width: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width / 2; // equirectangular is 2:1
  return canvas;
}

export function createEarthCanvas(width = 2048): HTMLCanvasElement {
  return makeCanvas(width);
}

export function createEmissiveCanvas(width = 1024): HTMLCanvasElement {
  return makeCanvas(width);
}

function pathFor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const projection = geoEquirectangular().fitSize([canvas.width, canvas.height], {
    type: "Sphere",
  });
  return geoPath(projection, ctx);
}

export function drawEarthTexture(
  canvas: HTMLCanvasElement,
  visited: Set<CountryId>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const path = pathFor(canvas, ctx);

  ctx.fillStyle = OCEAN;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

export function drawVisitedEmissive(
  canvas: HTMLCanvasElement,
  visited: Set<CountryId>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Black = no emission; green = visited countries glow.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (visited.size === 0) return;

  const path = pathFor(canvas, ctx);
  ctx.fillStyle = VISITED;
  for (const country of getCountries()) {
    if (!visited.has(country.id)) continue;
    ctx.beginPath();
    path(country);
    ctx.fill();
  }
}
