import * as THREE from "three";

import { Earth } from "./Earth";
import { Moon } from "./Moon";
import { Sun } from "./Sun";
import { Starfield } from "./Starfield";
import { Saturn } from "./Saturn";
import { Mars } from "./Mars";
import { Comet } from "./Comet";
import type { StartScene } from "@/components/StartScene";
import type { CountryId } from "@/storage/VisitedRepository";

/**
 * Tweakable scene settings — adjust sizes, positions and timing here.
 */
const CONFIG = {
  earthRadius: 1,
  earthHeightFraction: 0.34, // Earth diameter as a share of viewport height
  fov: 38,
  autoRotate: 0.045, // rad/s
  starCount: 6000,
  // Sun: light comes from slightly in front (keeps the Earth's day side lit);
  // the sprite sits in the upper-right corner as the visible sun.
  sunLightPos: [5, 3.5, 4.5] as [number, number, number],
  sunSpritePos: [6, 4, -3.5] as [number, number, number],
  saturn: {
    radius: 0.3,
    ringInner: 1.3,
    ringOuter: 2.1,
    tiltDeg: 24,
    position: [5, -2.6, -12] as [number, number, number],
  },
  mars: {
    radius: 0.16,
    position: [-5.5, 3, -10] as [number, number, number],
  },
  comet: { minGap: 20, maxGap: 60 }, // seconds between comets
};

const OPEN_DURATION = 1100; // ms, cinematic zoom into the Earth
const OPEN_DIST = 1.28; // camera distance at the end of the zoom (Earth fills view)

/** Smooth ease-in-out, for the open transition. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Three.js start screen: a lit Earth in deep space with a Moon, a distant Sun,
 * Saturn and Mars in the background, a starfield, and occasional comets.
 * Implements {@link StartScene} so it is a drop-in for the canvas globe. All GPU
 * resources are released in {@link dispose}.
 */
export class SpaceScene implements StartScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly raycaster = new THREE.Raycaster();

  private readonly earth: Earth;
  private readonly moon: Moon;
  private readonly sun: Sun;
  private readonly stars: Starfield;
  private readonly saturn: Saturn;
  private readonly mars: Mars;
  private readonly comet: Comet;
  private readonly hemi: THREE.HemisphereLight;
  private nextComet: number;

  private readonly clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private parent: HTMLElement | null = null;

  private readonly reducedMotion: boolean;

  // Interaction state.
  private hovering = false;
  private dragging = false;
  private moved = false;
  private pointerDownAt = 0;
  private lastPointer = [0, 0];
  private spinVel = 0; // horizontal drag inertia (rad/s)
  private tilt = 0; // vertical tilt of the Earth group
  private readonly pointerNdc = new THREE.Vector2(0, 0);
  private readonly parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  // Camera dolly (for the zoom-in/out transition).
  private fitDist = 9;
  private camDist = 9;
  private camTarget = 9;
  private opening = false;
  private opened = false;
  private openStart = 0;
  private openFrom = 9;

  constructor(private readonly onOpen: () => void) {
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x05070b, 1);
    this.renderer.domElement.className = "space-canvas";

    this.camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 400);

    this.earth = new Earth(CONFIG.earthRadius);
    this.moon = new Moon(CONFIG.earthRadius);
    this.sun = new Sun(CONFIG.sunLightPos, CONFIG.sunSpritePos);
    this.stars = new Starfield(CONFIG.starCount, pixelRatio);
    this.stars.setTwinkle(!this.reducedMotion);
    this.saturn = new Saturn(CONFIG.saturn);
    this.mars = new Mars(CONFIG.mars);
    this.comet = new Comet();

    // Fill light so the night side is a very dark blue, never pure black.
    this.hemi = new THREE.HemisphereLight(0x3b5c80, 0x0a1018, 0.45);

    this.scene.add(this.stars.group);
    this.scene.add(this.sun.group);
    this.scene.add(this.saturn.group);
    this.scene.add(this.mars.group);
    this.scene.add(this.comet.group);
    this.scene.add(this.hemi);
    this.scene.add(this.earth.group);
    this.earth.group.add(this.moon.group);

    this.nextComet = this.randomCometGap();
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;
    parent.appendChild(this.renderer.domElement);
    this.resize();
    this.start();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setVisited(visited: Set<CountryId>): void {
    this.earth.setVisited(visited);
  }

  start(): void {
    // Reset the dolly so returning from the map zooms back out.
    this.opening = false;
    this.opened = false;
    this.camTarget = this.fitDist;
    if (this.running) return;
    this.running = true;
    this.clock.getDelta(); // drop the paused gap
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);

    this.earth.dispose();
    this.moon.dispose();
    this.sun.dispose();
    this.stars.dispose();
    this.saturn.dispose();
    this.mars.dispose();
    this.comet.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // --- Render loop -------------------------------------------------------- */

  private randomCometGap(): number {
    const { minGap, maxGap } = CONFIG.comet;
    return this.clock.elapsedTime + minGap + Math.random() * (maxGap - minGap);
  }

  private loop = (): void => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Earth rotation: auto-rotate + drag inertia.
    const auto = this.reducedMotion ? 0 : CONFIG.autoRotate;
    this.earth.mesh.rotation.y += (auto + this.spinVel) * dt;
    this.spinVel *= Math.pow(0.0001, dt); // frame-rate independent damping
    this.earth.group.rotation.x = this.tilt;
    this.earth.update(dt);
    this.earth.setHover(this.hovering);

    this.moon.update(dt, !this.reducedMotion);
    this.saturn.update(dt, t, !this.reducedMotion);
    this.mars.update(dt);
    this.stars.update(t);

    // Occasional comet (one at a time, disabled for reduced motion).
    if (!this.reducedMotion) {
      if (this.comet.active) {
        if (!this.comet.update(dt, this.camera)) this.nextComet = this.randomCometGap();
      } else if (t >= this.nextComet) {
        this.comet.spawn(this.sun.spritePos);
      }
    }

    // Parallax easing (camera shift gives natural depth: near moves more).
    if (!this.reducedMotion) {
      this.parallax.x += (this.parallax.tx - this.parallax.x) * Math.min(1, dt * 3);
      this.parallax.y += (this.parallax.ty - this.parallax.y) * Math.min(1, dt * 3);
    }

    // Camera dolly: a timed ease-in-out zoom when opening, otherwise a gentle
    // exponential ease toward the target (return from the map, resize).
    let settle = 1; // fades breathing/parallax out as the zoom progresses
    if (this.opening) {
      const p = Math.min(1, (performance.now() - this.openStart) / OPEN_DURATION);
      this.camDist = this.openFrom + (OPEN_DIST - this.openFrom) * easeInOutCubic(p);
      settle = 1 - p;
      if (!this.opened && p >= 0.92) {
        this.opened = true;
        this.onOpen();
      }
    } else {
      this.camDist += (this.camTarget - this.camDist) * Math.min(1, dt * 3.2);
    }

    const breathe = this.reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12 * settle;
    this.camera.position.set(
      this.parallax.x * 0.3 * settle,
      this.parallax.y * 0.3 * settle + breathe,
      this.camDist,
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  // --- Sizing ------------------------------------------------------------- */

  private resize = (): void => {
    if (!this.parent) return;
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const fovY = THREE.MathUtils.degToRad(CONFIG.fov);
    this.fitDist =
      CONFIG.earthRadius / (CONFIG.earthHeightFraction * Math.tan(fovY / 2));
    if (!this.opening) this.camTarget = this.fitDist;
    if (this.camDist === 9) this.camDist = this.fitDist; // first layout
  };

  // --- Pointer interaction ------------------------------------------------ */

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.moved = false;
    this.pointerDownAt = performance.now();
    this.lastPointer = [e.clientX, e.clientY];
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointerNdc(e);
    this.updateParallax(e);

    if (this.dragging) {
      const [lx, ly] = this.lastPointer;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
      this.spinVel = dx * 0.01;
      this.earth.mesh.rotation.y += dx * 0.005;
      this.tilt = THREE.MathUtils.clamp(this.tilt + dy * 0.005, -0.9, 0.9);
      this.lastPointer = [e.clientX, e.clientY];
    } else {
      this.updateHover();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    }
    const quick = performance.now() - this.pointerDownAt < 400;
    if (!this.moved && quick) {
      this.updatePointerNdc(e);
      this.updateHover();
      if (this.hovering) this.beginOpen();
    }
  };

  private onPointerLeave = (): void => {
    if (!this.dragging) this.setHover(false);
  };

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (this.parent) this.start();
  };

  private updatePointerNdc(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private updateParallax(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.parallax.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.parallax.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  private updateHover(): void {
    // Only the Earth is clickable; planets and comets are decorative.
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster.intersectObject(this.earth.mesh, false).length > 0;
    this.setHover(hit);
  }

  private setHover(hovering: boolean): void {
    if (this.hovering === hovering) return;
    this.hovering = hovering;
    this.renderer.domElement.style.cursor = hovering ? "pointer" : "grab";
  }

  private beginOpen(): void {
    if (this.opening) return;
    this.opening = true;
    this.opened = false;
    this.openStart = performance.now();
    this.openFrom = this.camDist;
  }
}
