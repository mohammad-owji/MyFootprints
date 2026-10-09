import * as THREE from "three";

function createHeadTexture(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(200,225,255,0.7)");
  g.addColorStop(1, "rgba(160,200,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Horizontal tail gradient: bright at the head (left) fading out (right). */
function createTailTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(220,235,255,0.9)"); // bluish ion tail near head
  g.addColorStop(0.25, "rgba(200,220,255,0.45)");
  g.addColorStop(0.6, "rgba(255,230,180,0.18)"); // faint warm dust
  g.addColorStop(1, "rgba(255,220,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Taper vertically so the tail is a soft lens, not a rectangle.
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, "rgba(0,0,0,1)");
  v.addColorStop(0.5, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A single reusable comet (object pooling): a glowing head sprite and a soft
 * tail sprite that always points away from the sun. Flies slowly across the far
 * background from one edge to another, then recycles. One instance, reused.
 */
export class Comet {
  readonly group = new THREE.Group();
  active = false;

  private readonly head: THREE.Sprite;
  private readonly tail: THREE.Sprite;
  private readonly headMat: THREE.SpriteMaterial;
  private readonly tailMat: THREE.SpriteMaterial;
  private readonly headTex: THREE.CanvasTexture;
  private readonly tailTex: THREE.CanvasTexture;

  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly sunPos = new THREE.Vector3();
  private duration = 8;
  private elapsed = 0;
  private len = 4;

  private readonly _dir = new THREE.Vector3();
  private readonly _p0 = new THREE.Vector3();
  private readonly _p1 = new THREE.Vector3();

  constructor() {
    this.headTex = createHeadTexture();
    this.tailTex = createTailTexture();
    this.headMat = new THREE.SpriteMaterial({
      map: this.headTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.tailMat = new THREE.SpriteMaterial({
      map: this.tailTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.head = new THREE.Sprite(this.headMat);
    this.tail = new THREE.Sprite(this.tailMat);
    this.group.add(this.tail);
    this.group.add(this.head);
    this.group.visible = false;
  }

  /** Begin a new flight from a random far edge to another, behind the Earth. */
  spawn(sunPos: THREE.Vector3): void {
    const z = -18 - Math.random() * 8; // always well behind the Earth
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -18 - Math.random() * 5 : 18 + Math.random() * 5;
    const ex = -sx + (Math.random() - 0.5) * 6;
    this.start.set(sx, (Math.random() - 0.5) * 14, z);
    this.end.set(ex, (Math.random() - 0.5) * 14, z - 2);

    this.duration = 6 + Math.random() * 6;
    this.elapsed = 0;
    this.len = 2.6 + Math.random() * 2.4;
    this.head.scale.setScalar(0.38 + Math.random() * 0.3);
    this.sunPos.copy(sunPos);
    this.active = true;
    this.group.visible = true;
  }

  /** Advance the flight; returns false once it has finished and recycled. */
  update(dt: number, camera: THREE.Camera): boolean {
    if (!this.active) return false;
    this.elapsed += dt;
    const p = this.elapsed / this.duration;
    if (p >= 1) {
      this.active = false;
      this.group.visible = false;
      return false;
    }

    this.group.position.lerpVectors(this.start, this.end, p);

    // Tail points directly away from the sun.
    this._dir.copy(this.group.position).sub(this.sunPos).normalize();
    this.tail.position.copy(this._dir).multiplyScalar(this.len * 0.5);
    this.tail.scale.set(this.len, this.len * 0.26, 1);

    // Orient the tail sprite along the anti-sun direction in screen space.
    this._p0.copy(this.group.position).project(camera);
    this._p1.copy(this.group.position).add(this._dir).project(camera);
    this.tailMat.rotation = Math.atan2(this._p1.y - this._p0.y, this._p1.x - this._p0.x);

    const fade = Math.min(1, Math.min(p, 1 - p) * 6);
    this.headMat.opacity = fade;
    this.tailMat.opacity = fade * 0.8;
    return true;
  }

  dispose(): void {
    this.headMat.dispose();
    this.tailMat.dispose();
    this.headTex.dispose();
    this.tailTex.dispose();
  }
}
