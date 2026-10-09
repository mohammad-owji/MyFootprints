import * as THREE from "three";

/**
 * Tweakable comet settings.
 */
export const COMET = {
  minGap: 20, // seconds between comets
  maxGap: 60,
  minDuration: 8, // seconds for one flight
  maxDuration: 14,
  depthMin: -17, // z range (always behind the Earth)
  depthMax: -26,
  spanX: 14, // horizontal travel spread (lower = slower head, tail points more anti-sun)
  spanY: 11, // vertical spread of start/end
  arc: 2.4, // curvature of the flight path
  nucleusSize: 0.14,
  comaSize: 0.7,
  haloSize: 2.0,
  // Two tail layers emitted continuously from the head. The anti-sun drift
  // speed is kept well above the head's travel speed so the tail trails away
  // from the sun rather than merely behind the motion.
  ion: { count: 360, life: 1.9, speed: 5.0, jitter: 0.1, size: 0.42, color: 0x9fc0ff },
  dust: { count: 220, life: 1.5, speed: 3.0, jitter: 0.6, size: 0.8, color: 0xffe3b0 },
};

const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlobal;
  varying float vAlpha;
  void main() {
    // Soft round particle, fully transparent at the edge (no hard disc).
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor, a * vAlpha * uGlobal);
  }
`;

interface TailCfg {
  count: number;
  life: number;
  speed: number;
  jitter: number;
  size: number;
  color: number;
}

/** A pooled particle tail: particles emitted at the head, drifting away. */
class Tail {
  readonly points: THREE.Points;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private readonly pos: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  private readonly size0: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly n: number;
  private cursor = 0;
  private emitAcc = 0;

  constructor(private readonly cfg: TailCfg, pixelRatio: number) {
    this.n = cfg.count;
    this.pos = new Float32Array(this.n * 3);
    this.size = new Float32Array(this.n);
    this.alpha = new Float32Array(this.n);
    this.vel = new Float32Array(this.n * 3);
    this.size0 = new Float32Array(this.n);
    this.age = new Float32Array(this.n).fill(999);
    this.life = new Float32Array(this.n).fill(1);

    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(cfg.color) },
        uPixelRatio: { value: pixelRatio },
        uGlobal: { value: 1 },
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  setGlobal(a: number): void {
    this.mat.uniforms.uGlobal.value = a;
  }

  reset(): void {
    this.age.fill(999);
    this.alpha.fill(0);
    this.emitAcc = 0;
  }

  emit(dt: number, head: THREE.Vector3, antiSun: THREE.Vector3): void {
    this.emitAcc += (this.cfg.count / this.cfg.life) * dt;
    let k = Math.floor(this.emitAcc);
    this.emitAcc -= k;
    const { speed, jitter, size } = this.cfg;
    while (k-- > 0) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      this.pos[i * 3] = head.x;
      this.pos[i * 3 + 1] = head.y;
      this.pos[i * 3 + 2] = head.z;
      // Drift away from the sun + a small isotropic jitter (a soft cone).
      this.vel[i * 3] = antiSun.x * speed + (Math.random() - 0.5) * jitter;
      this.vel[i * 3 + 1] = antiSun.y * speed + (Math.random() - 0.5) * jitter;
      this.vel[i * 3 + 2] = antiSun.z * speed + (Math.random() - 0.5) * jitter;
      this.age[i] = 0;
      this.life[i] = this.cfg.life * (0.7 + Math.random() * 0.6);
      this.size0[i] = size * (0.7 + Math.random() * 0.6);
      this.alpha[i] = 1;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const f = Math.max(0, 1 - this.age[i] / this.life[i]);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // Fade out smoothly; grow a touch then shrink (slight spread).
      this.alpha[i] = f * f * (0.85 + 0.3 * Math.sin(this.age[i] * 9 + i));
      this.size[i] = this.size0[i] * (0.4 + 0.6 * f);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Soft radial sprite (bright centre → transparent edge). */
function glowTexture(stops: [number, string][]): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [stop, col] of stops) g.addColorStop(stop, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A single reusable comet (object pooling): a soft glowing head (nucleus +
 * coma + faint halo) and two particle tails (a thin bluish ion tail and a
 * wider warm dust tail) that stream away from the sun and trail along a gently
 * curved path. Fades in and out; one instance, reused.
 */
export class Comet {
  readonly group = new THREE.Group();
  active = false;

  private readonly ion: Tail;
  private readonly dust: Tail;
  private readonly nucleus: THREE.Sprite;
  private readonly coma: THREE.Sprite;
  private readonly halo: THREE.Sprite;
  private readonly headSprites: THREE.Sprite[];
  private readonly textures: THREE.CanvasTexture[] = [];

  private readonly start = new THREE.Vector3();
  private readonly control = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly sunPos = new THREE.Vector3();
  private readonly head = new THREE.Vector3();
  private readonly antiSun = new THREE.Vector3();
  private duration = 10;
  private elapsed = 0;

  constructor(pixelRatio: number) {
    this.ion = new Tail(COMET.ion, pixelRatio);
    this.dust = new Tail(COMET.dust, pixelRatio);

    this.halo = this.makeSprite(
      [[0, "rgba(180,210,255,0.5)"], [0.5, "rgba(150,185,255,0.12)"], [1, "rgba(150,185,255,0)"]],
      COMET.haloSize,
    );
    this.coma = this.makeSprite(
      [[0, "rgba(240,248,255,1)"], [0.35, "rgba(190,220,255,0.55)"], [1, "rgba(170,205,255,0)"]],
      COMET.comaSize,
    );
    this.nucleus = this.makeSprite(
      [[0, "rgba(255,255,255,1)"], [0.6, "rgba(220,235,255,0.9)"], [1, "rgba(210,230,255,0)"]],
      COMET.nucleusSize,
    );
    this.headSprites = [this.halo, this.coma, this.nucleus];

    // Tails behind the head sprites.
    this.group.add(this.dust.points);
    this.group.add(this.ion.points);
    this.group.add(this.halo);
    this.group.add(this.coma);
    this.group.add(this.nucleus);
    this.group.visible = false;
  }

  private makeSprite(stops: [number, string][], scale: number): THREE.Sprite {
    const tex = glowTexture(stops);
    this.textures.push(tex);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(scale);
    return sprite;
  }

  /** Begin a new flight along a gentle arc from one far edge to another. */
  spawn(sunPos: THREE.Vector3): void {
    const z = COMET.depthMin + Math.random() * (COMET.depthMax - COMET.depthMin);
    const fromLeft = Math.random() < 0.5;
    const sx = (fromLeft ? -1 : 1) * (COMET.spanX + Math.random() * 4);
    this.start.set(sx, (Math.random() - 0.5) * COMET.spanY, z);
    this.end.set(-sx + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * COMET.spanY, z - 2);
    // Control point offset perpendicular for a slight curve.
    this.control
      .addVectors(this.start, this.end)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, (Math.random() < 0.5 ? 1 : -1) * COMET.arc, (Math.random() - 0.5) * 3));

    this.duration = COMET.minDuration + Math.random() * (COMET.maxDuration - COMET.minDuration);
    this.elapsed = 0;
    this.sunPos.copy(sunPos);
    this.ion.reset();
    this.dust.reset();
    this.active = true;
    this.group.visible = true;
  }

  /** Advance the flight; returns false once finished and recycled. */
  update(dt: number): boolean {
    if (!this.active) return false;
    this.elapsed += dt;
    const p = this.elapsed / this.duration;
    if (p >= 1) {
      this.active = false;
      this.group.visible = false;
      return false;
    }

    // Quadratic-bezier head position (curved path).
    const q = 1 - p;
    this.head
      .copy(this.start)
      .multiplyScalar(q * q)
      .addScaledVector(this.control, 2 * q * p)
      .addScaledVector(this.end, p * p);
    for (const s of this.headSprites) s.position.copy(this.head);

    this.antiSun.copy(this.head).sub(this.sunPos).normalize();
    this.ion.emit(dt, this.head, this.antiSun);
    this.dust.emit(dt, this.head, this.antiSun);
    this.ion.update(dt);
    this.dust.update(dt);

    // Smooth fade in/out at the ends (no pop).
    const g = Math.min(smooth01(p / 0.18), smooth01((1 - p) / 0.18));
    this.ion.setGlobal(g);
    this.dust.setGlobal(g);
    this.halo.material.opacity = g * 0.8;
    this.coma.material.opacity = g;
    this.nucleus.material.opacity = g;
    return true;
  }

  dispose(): void {
    this.ion.dispose();
    this.dust.dispose();
    this.headSprites.forEach((s) => s.material.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
