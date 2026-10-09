import * as THREE from "three";

/** Soft radial sprite texture (white core → warm → transparent). */
function createGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, outer);
  g.addColorStop(1, "rgba(255, 220, 170, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The Sun: the scene's light source plus a visible glowing disc.
 *
 * The directional light and the visible sprite are decoupled on purpose: the
 * light comes from slightly in front (so the Earth's day side faces the camera
 * and stays well lit), while the sprite sits in a screen corner as the visible
 * sun. Both share the same upper-right direction, so it still reads naturally.
 */
export class Sun {
  readonly group = new THREE.Group();
  readonly light: THREE.DirectionalLight;
  readonly spritePos: THREE.Vector3;

  private readonly textures: THREE.Texture[] = [];
  private readonly materials: THREE.SpriteMaterial[] = [];

  constructor(
    lightPos: [number, number, number],
    spritePos: [number, number, number],
    intensity = 2.8,
  ) {
    this.light = new THREE.DirectionalLight(0xfff3e0, intensity);
    this.light.position.set(...lightPos);
    this.light.target.position.set(0, 0, 0);
    this.group.add(this.light);
    this.group.add(this.light.target);

    this.spritePos = new THREE.Vector3(...spritePos);

    const corona = this.sprite(
      createGlowTexture("rgba(255, 248, 232, 1)", "rgba(255, 204, 140, 0.6)"),
      2.4,
    );
    corona.position.copy(this.spritePos);
    this.group.add(corona);

    const core = this.sprite(
      createGlowTexture("rgba(255, 255, 255, 1)", "rgba(255, 236, 200, 0.9)"),
      0.9,
    );
    core.position.copy(this.spritePos);
    this.group.add(core);

    // Faint lens-flare ghosts along the sun → centre axis.
    const flareTex = createGlowTexture(
      "rgba(255, 230, 190, 0.5)",
      "rgba(255, 210, 150, 0.15)",
    );
    for (const [t, s] of [
      [0.45, 0.4],
      [0.7, 0.25],
    ] as const) {
      const ghost = this.sprite(flareTex, s);
      ghost.position.copy(this.spritePos).multiplyScalar(t);
      this.group.add(ghost);
    }
  }

  private sprite(texture: THREE.Texture, scale: number): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.textures.push(texture);
    this.materials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(scale);
    return sprite;
  }

  dispose(): void {
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
