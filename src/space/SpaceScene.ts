import * as THREE from "three";

import { Earth } from "./Earth";
import { Moon } from "./Moon";
import { Sun } from "./Sun";
import { Starfield } from "./Starfield";
import type { StartScene } from "@/components/StartScene";
import type { CountryId } from "@/storage/VisitedRepository";

const EARTH_RADIUS = 1;
const FOV = 38;
const EARTH_HEIGHT_FRACTION = 0.34; // Earth diameter as a share of viewport height
const AUTO_ROTATE = 0.045; // rad/s

/**
 * Three.js start screen: a small Earth in deep space with a Moon, a distant Sun
 * and a starfield. Implements {@link StartScene} so it is a drop-in for the
 * canvas globe. All GPU resources are released in {@link dispose}.
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
  private readonly ambient: THREE.AmbientLight;

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

  constructor(private readonly onOpen: () => void) {
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x05070b, 1);
    this.renderer.domElement.className = "space-canvas";

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

    this.earth = new Earth(EARTH_RADIUS);
    this.moon = new Moon(EARTH_RADIUS);
    this.sun = new Sun();
    this.stars = new Starfield(6000, pixelRatio);
    this.stars.setTwinkle(!this.reducedMotion);

    this.ambient = new THREE.AmbientLight(0x2b3a4d, 0.55);

    this.scene.add(this.stars.group);
    this.scene.add(this.sun.group);
    this.scene.add(this.ambient);
    this.scene.add(this.earth.group);
    this.earth.group.add(this.moon.group);
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
    this.renderer.dispose();
    el.remove();
  }

  // --- Render loop -------------------------------------------------------- */

  private loop = (): void => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Earth rotation: auto-rotate + drag inertia.
    const auto = this.reducedMotion ? 0 : AUTO_ROTATE;
    this.earth.mesh.rotation.y += (auto + this.spinVel) * dt;
    this.spinVel *= Math.pow(0.0001, dt); // frame-rate independent damping
    this.earth.group.rotation.x = this.tilt;
    this.earth.update(dt, false);
    this.earth.setHover(this.hovering);

    this.moon.update(dt, !this.reducedMotion);
    this.stars.update(t);

    // Parallax easing (starfield shifts opposite the pointer).
    if (!this.reducedMotion) {
      this.parallax.x += (this.parallax.tx - this.parallax.x) * Math.min(1, dt * 3);
      this.parallax.y += (this.parallax.ty - this.parallax.y) * Math.min(1, dt * 3);
      this.stars.group.rotation.y = this.parallax.x * 0.15;
      this.stars.group.rotation.x = this.parallax.y * 0.15;
    }

    // Camera dolly + gentle breathing drift.
    this.camDist += (this.camTarget - this.camDist) * Math.min(1, dt * 3.2);
    const breathe = this.reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12;
    this.camera.position.set(
      this.parallax.x * 0.25,
      this.parallax.y * 0.25 + breathe,
      this.camDist,
    );
    this.camera.lookAt(0, 0, 0);

    if (this.opening && !this.opened && this.camDist < this.fitDist * 0.3) {
      this.opened = true;
      this.onOpen();
    }

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

    // Distance that makes the Earth ~EARTH_HEIGHT_FRACTION of the viewport.
    const fovY = THREE.MathUtils.degToRad(FOV);
    this.fitDist = EARTH_RADIUS / (EARTH_HEIGHT_FRACTION * Math.tan(fovY / 2));
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
    this.camTarget = this.fitDist * 0.22; // dolly into the Earth
  }
}
