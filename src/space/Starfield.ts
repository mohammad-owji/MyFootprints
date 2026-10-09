import * as THREE from "three";

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = 0.75 + 0.25 * sin(uTime * 1.6 + aPhase) * uTwinkle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (260.0 / -mv.z);
  }
`;

const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float mask = smoothstep(0.5, 0.0, d);
    if (mask <= 0.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * mask);
  }
`;

/** Soft nebula backdrop: a dark gradient with a couple of faint colour hazes. */
function createNebula(): THREE.Mesh {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, size, size);

  const haze = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  haze(size * 0.3, size * 0.35, size * 0.5, "rgba(40, 60, 110, 0.18)");
  haze(size * 0.72, size * 0.62, size * 0.45, "rgba(90, 50, 110, 0.14)");
  haze(size * 0.55, size * 0.2, size * 0.4, "rgba(30, 70, 90, 0.12)");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), mat);
}

/**
 * A field of thousands of tinted stars (THREE.Points) with soft twinkling, plus
 * a subtle nebula backdrop. The whole group is offset for parallax by the scene.
 */
export class Starfield {
  readonly group = new THREE.Group();

  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;
  private readonly nebula: THREE.Mesh;

  constructor(count = 6000, pixelRatio = 1) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    const tints = [
      [1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0],
      [0.75, 0.85, 1.0], // faint blue
      [1.0, 0.9, 0.78], // faint warm
    ];

    for (let i = 0; i < count; i++) {
      // Random direction on a shell, pushed far out.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 70 + Math.random() * 45;
      positions[i * 3] = Math.cos(theta) * s * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(theta) * s * r;

      const tint = tints[(Math.random() * tints.length) | 0];
      const b = 0.6 + Math.random() * 0.4; // brightness
      colors[i * 3] = tint[0] * b;
      colors[i * 3 + 1] = tint[1] * b;
      colors[i * 3 + 2] = tint[2] * b;

      sizes[i] = 0.6 + Math.random() * Math.random() * 3.2;
      phases[i] = Math.random() * Math.PI * 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTwinkle: { value: 1 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.nebula = createNebula();
    this.group.add(this.nebula);
    this.group.add(new THREE.Points(this.geometry, this.material));
  }

  setTwinkle(enabled: boolean): void {
    this.material.uniforms.uTwinkle.value = enabled ? 1 : 0;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.nebula.geometry.dispose();
    (this.nebula.material as THREE.Material).dispose();
    ((this.nebula.material as THREE.MeshBasicMaterial).map as THREE.Texture)?.dispose();
  }
}
