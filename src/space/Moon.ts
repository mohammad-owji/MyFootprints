import * as THREE from "three";

/** Procedural gray, crater-pocked moon texture on an offscreen canvas. */
function createMoonTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;

  ctx.fillStyle = "#9a9a9e";
  ctx.fillRect(0, 0, width, height);

  // Subtle large-scale maria (darker plains).
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 30 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(120, 120, 128, 0.35)");
    g.addColorStop(1, "rgba(120, 120, 128, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Craters: a dark bowl with a faint bright rim.
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 1.5 + Math.random() * 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(70, 70, 76, ${0.25 + Math.random() * 0.3})`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(200, 200, 205, 0.18)";
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The Moon: a small sphere on a slightly tilted orbit around the Earth, lit by
 * the same directional (sun) light so it shows a correct phase. Placed closer
 * than reality so it stays comfortably in frame.
 */
export class Moon {
  readonly group = new THREE.Group(); // tilted orbit plane
  readonly mesh: THREE.Mesh;

  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly distance: number;
  private angle = Math.PI * 0.25;

  constructor(earthRadius: number) {
    const radius = earthRadius * 0.27;
    this.distance = earthRadius * 3.4;

    this.texture = createMoonTexture();
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 1,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32),
      this.material,
    );
    this.group.add(this.mesh);
    this.group.rotation.x = THREE.MathUtils.degToRad(18); // tilt the orbit
    this.place();
  }

  private place(): void {
    this.mesh.position.set(
      Math.cos(this.angle) * this.distance,
      0,
      Math.sin(this.angle) * this.distance,
    );
  }

  update(dt: number, orbit: boolean): void {
    if (orbit) {
      this.angle += dt * 0.12;
      this.place();
    }
    this.mesh.rotation.y += dt * 0.04;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
