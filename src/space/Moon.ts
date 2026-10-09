import * as THREE from "three";

type V3 = [number, number, number];

/** A uniformly distributed random unit vector (point on the sphere). */
function randUnit(): V3 {
  const u = Math.random() * 2 - 1;
  const th = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Gray, crater-pocked moon texture. Craters and maria are placed as directions
 * on the sphere and evaluated per pixel from each texel's 3D direction, so they
 * stay round everywhere and do NOT smear at the poles (no equirectangular UV
 * stretching).
 */
function createMoonTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 384;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const base = 158;
  const maria = Array.from({ length: 12 }, () => ({
    c: randUnit(),
    cr: Math.cos(0.5 + Math.random() * 0.6), // cos(angular radius)
    d: 16 + Math.random() * 20,
  }));
  const craters = Array.from({ length: 170 }, () => ({
    c: randUnit(),
    cr: Math.cos(0.02 + Math.random() * 0.07),
    depth: 18 + Math.random() * 34,
  }));

  let idx = 0;
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
      const dx = cl * Math.cos(lon);
      const dy = sl;
      const dz = cl * Math.sin(lon);
      let v = base;

      for (const m of maria) {
        const dot = dx * m.c[0] + dy * m.c[1] + dz * m.c[2];
        if (dot > m.cr) v -= m.d * smooth((dot - m.cr) / (1 - m.cr));
      }
      for (const k of craters) {
        const dot = dx * k.c[0] + dy * k.c[1] + dz * k.c[2];
        if (dot > k.cr) {
          const t = (dot - k.cr) / (1 - k.cr); // 0 at rim, 1 at centre
          v -= k.depth * t; // dark bowl, deepest at the centre
          v += 22 * Math.max(0, 1 - Math.abs(t - 0.82) / 0.16); // bright rim
        }
      }

      v = Math.max(22, Math.min(236, v));
      data[idx++] = v;
      data[idx++] = v;
      data[idx++] = Math.min(255, v + 3); // faint cool tint
      data[idx++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

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
