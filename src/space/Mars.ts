import * as THREE from "three";

import { makeAtmosphere, type Atmosphere } from "./atmosphere";

export interface MarsConfig {
  radius: number;
  position: [number, number, number];
}

/** Reddish-orange procedural surface with darker patches and faint polar caps. */
function createMarsTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#b24a2a";
  ctx.fillRect(0, 0, w, h);

  // Mottled darker and lighter patches.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 4 + Math.random() * 26;
    const dark = Math.random() < 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? "rgba(120, 52, 28, 0.5)" : "rgba(220, 140, 92, 0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint polar caps (top and bottom edges).
  for (const y of [0, h]) {
    const g = ctx.createLinearGradient(0, y, 0, y === 0 ? h * 0.12 : h * 0.88);
    g.addColorStop(0, "rgba(236, 232, 228, 0.6)");
    g.addColorStop(1, "rgba(236, 232, 228, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y === 0 ? 0 : h * 0.88, w, h * 0.12);
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mars: a small reddish sphere far in the background, slowly self-rotating. */
export class Mars {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly atmosphere: Atmosphere;

  constructor(cfg: MarsConfig) {
    this.texture = createMarsTexture();
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 1,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.radius, 40, 32),
      this.material,
    );
    this.group.add(this.mesh);

    this.atmosphere = makeAtmosphere(cfg.radius * 1.09, 0xff7a44, 0.5, 3.0);
    this.group.add(this.atmosphere.mesh);

    this.group.position.set(...cfg.position);
  }

  update(dt: number): void {
    this.mesh.rotation.y += dt * 0.06;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.atmosphere.dispose();
  }
}
