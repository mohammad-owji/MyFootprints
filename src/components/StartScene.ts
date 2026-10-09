import type { CountryId } from "@/storage/VisitedRepository";

/**
 * Common surface for the start screen, so the app can use either the Three.js
 * {@link SpaceScene} or the canvas {@link Globe} fallback interchangeably.
 */
export interface StartScene {
  /** Attach the scene's canvas to a parent and begin running. */
  mount(parent: HTMLElement): void;
  /** Reflect the current visited set (re-colours the Earth). */
  setVisited(visited: Set<CountryId>): void;
  /** Resume the render loop (called when the screen becomes active). */
  start(): void;
  /** Pause the render loop (called when leaving the screen). */
  stop(): void;
  /** Release all resources. */
  dispose(): void;
}
