import * as THREE from "three";

import {
  createEarthCanvas,
  createEmissiveCanvas,
  drawEarthTexture,
  drawVisitedEmissive,
} from "./earthTexture";
import { makeAtmosphere, type Atmosphere } from "./atmosphere";
import type { CountryId } from "@/storage/VisitedRepository";

const ATMO_BASE = 0.6;
const ATMO_HOVER = 1.0;

/**
 * The Earth: a sphere textured from the procedural world map and lit by the
 * scene's directional (sun) light, so it shows a soft day/night terminator.
 * Visited countries glow slightly (emissive map) so they stay visible even on
 * the shadow side. Wrapped in a thin fresnel atmosphere.
 */
export class Earth {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;

  private readonly canvas: HTMLCanvasElement;
  private readonly emissiveCanvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;
  private readonly emissiveTexture: THREE.CanvasTexture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly atmosphere: Atmosphere;

  private glow = ATMO_BASE;
  private targetGlow = ATMO_BASE;

  constructor(readonly radius = 1) {
    this.canvas = createEarthCanvas(2048);
    this.emissiveCanvas = createEmissiveCanvas(1024);
    drawEarthTexture(this.canvas, new Set());
    drawVisitedEmissive(this.emissiveCanvas, new Set());

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.emissiveTexture = new THREE.CanvasTexture(this.emissiveCanvas);
    this.emissiveTexture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.emissiveTexture,
      emissiveIntensity: 0.55, // visited countries keep a faint green glow
      roughness: 0.92,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 96, 64),
      this.material,
    );
    this.mesh.rotation.y = -Math.PI / 2; // sensible default longitude toward camera
    this.group.add(this.mesh);

    this.atmosphere = makeAtmosphere(radius * 1.07, 0x6ab0ff, ATMO_BASE, 3.2);
    this.group.add(this.atmosphere.mesh);
  }

  setVisited(visited: Set<CountryId>): void {
    drawEarthTexture(this.canvas, visited);
    drawVisitedEmissive(this.emissiveCanvas, visited);
    this.texture.needsUpdate = true;
    this.emissiveTexture.needsUpdate = true;
  }

  setHover(hovering: boolean): void {
    this.targetGlow = hovering ? ATMO_HOVER : ATMO_BASE;
  }

  update(dt: number): void {
    this.glow += (this.targetGlow - this.glow) * Math.min(1, dt * 6);
    this.atmosphere.setIntensity(this.glow);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.emissiveTexture.dispose();
    this.atmosphere.dispose();
  }
}
