/**
 * Shared visual tokens used by the canvas globe (which cannot read CSS custom
 * properties directly) and referenced in comments for the SVG map. Keep these
 * in sync with the CSS variables in src/styles/global.css.
 */
export const COLORS = {
  background: "#0b0f14",
  land: "#232a33",
  landStroke: "#2f3744",
  visited: "#34d399",
  visitedStroke: "#1f9d6b",
  hover: "#4a5563",
  sphere: "#0f1722",
  atmosphere: "#2b6cb0",
  graticule: "rgba(255, 255, 255, 0.05)",
} as const;

/** Standard micro-animation duration (ms). */
export const ANIM_MS = 260;
