import * as THREE from "three";

export interface SaturnConfig {
  radius: number;
  ringInner: number; // multiples of radius
  ringOuter: number;
  tiltDeg: number;
  position: [number, number, number];
}

/** Soft horizontal golden/beige bands. */
function createBandTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const tones = ["#d9c08a", "#c7a86a", "#e4d3a6", "#caa767", "#ddc590", "#bfa05f"];
  let y = 0;
  while (y < h) {
    const band = 8 + Math.random() * 22;
    ctx.fillStyle = tones[(Math.random() * tones.length) | 0];
    ctx.fillRect(0, y, w, band + 1);
    y += band;
  }
  // Soften the bands with a vertical blur-ish overlay.
  ctx.globalAlpha = 0.25;
  for (const [stop, col] of [
    [0.2, "#f0e4bf"],
    [0.8, "#9c8350"],
  ] as const) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(stop, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Radial ring profile: several translucent bands with gaps (inner → outer). */
function createRingTexture(): THREE.CanvasTexture {
  const w = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, 8);
  // bands: [startFrac, endFrac, alpha, color]
  const bands: [number, number, number, string][] = [
    [0.0, 0.12, 0.0, "#000"],
    [0.12, 0.33, 0.55, "#c9b483"],
    [0.33, 0.4, 0.12, "#c9b483"],
    [0.4, 0.68, 0.72, "#e3d4a6"],
    [0.68, 0.74, 0.1, "#000"],
    [0.74, 0.95, 0.5, "#bda772"],
    [0.95, 1.0, 0.0, "#000"],
  ];
  for (const [s, e, a, c] of bands) {
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(s * w), 0, Math.ceil((e - s) * w), 8);
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Remap a RingGeometry's UVs so u runs 0→1 along the radius (for radial bands). */
function radialUVs(geo: THREE.RingGeometry, inner: number, outer: number): void {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = v.length();
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  uv.needsUpdate = true;
}

/**
 * Saturn: a small banded sphere with tilted, radially-banded rings. Far in the
 * background, slowly self-rotating with a gentle bob. Purely decorative.
 */
export class Saturn {
  readonly group = new THREE.Group();
  private readonly planet: THREE.Mesh;
  private readonly rings: THREE.Mesh;
  private readonly bandTex: THREE.CanvasTexture;
  private readonly ringTex: THREE.CanvasTexture;
  private readonly planetMat: THREE.MeshStandardMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly baseY: number;

  constructor(cfg: SaturnConfig) {
    this.bandTex = createBandTexture();
    this.planetMat = new THREE.MeshStandardMaterial({
      map: this.bandTex,
      roughness: 1,
      metalness: 0,
    });
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.radius, 40, 32),
      this.planetMat,
    );

    const inner = cfg.radius * cfg.ringInner;
    const outer = cfg.radius * cfg.ringOuter;
    const ringGeo = new THREE.RingGeometry(inner, outer, 96, 1);
    radialUVs(ringGeo, inner, outer);
    this.ringTex = createRingTexture();
    this.ringMat = new THREE.MeshBasicMaterial({
      map: this.ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.rings = new THREE.Mesh(ringGeo, this.ringMat);
    this.rings.rotation.x = -Math.PI / 2; // lay flat around the equator

    this.group.add(this.planet);
    this.group.add(this.rings);
    this.group.position.set(...cfg.position);
    this.group.rotation.z = THREE.MathUtils.degToRad(cfg.tiltDeg);
    this.group.rotation.x = THREE.MathUtils.degToRad(6);
    this.baseY = cfg.position[1];
  }

  update(dt: number, t: number, animate: boolean): void {
    this.planet.rotation.y += dt * 0.08;
    if (animate) this.group.position.y = this.baseY + Math.sin(t * 0.2) * 0.1;
  }

  dispose(): void {
    this.planet.geometry.dispose();
    this.planetMat.dispose();
    this.bandTex.dispose();
    this.rings.geometry.dispose();
    this.ringMat.dispose();
    this.ringTex.dispose();
  }
}
