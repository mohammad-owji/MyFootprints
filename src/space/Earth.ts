import * as THREE from "three";

import { createEarthCanvas, drawEarthTexture } from "./earthTexture";
import type { CountryId } from "@/storage/VisitedRepository";

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // A soft halo: broad falloff from the limb inward, with a gentle bright
    // edge, so it reads as atmosphere rather than a hard outline.
    float f = 1.0 - abs(dot(vNormal, vView));
    float glow = pow(f, 2.6) * 0.75 + pow(f, 6.0) * 0.6;
    gl_FragColor = vec4(uColor, glow * uIntensity);
  }
`;

/**
 * The Earth: a sphere textured from the procedural world map, lit by the scene's
 * directional (sun) light so it shows a real day/night terminator, wrapped in a
 * soft additive fresnel atmosphere. Auto-rotates and eases a hover-glow boost.
 */
export class Earth {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;

  private readonly canvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshPhongMaterial;
  private readonly atmosphere: THREE.Mesh;
  private readonly atmoMat: THREE.ShaderMaterial;

  private glow = 0.55;
  private targetGlow = 0.55;

  constructor(readonly radius = 1) {
    this.canvas = createEarthCanvas(2048);
    drawEarthTexture(this.canvas, new Set());
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    this.material = new THREE.MeshPhongMaterial({
      map: this.texture,
      shininess: 6,
      specular: new THREE.Color(0x152028),
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 96, 64),
      this.material,
    );
    // Offset so the texture's seam/longitude sits sensibly toward the camera.
    this.mesh.rotation.y = -Math.PI / 2;
    this.group.add(this.mesh);

    this.atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x6fb1ff) },
        uIntensity: { value: 0.55 },
      },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.14, 96, 64),
      this.atmoMat,
    );
    this.group.add(this.atmosphere);
  }

  setVisited(visited: Set<CountryId>): void {
    drawEarthTexture(this.canvas, visited);
    this.texture.needsUpdate = true;
  }

  setHover(hovering: boolean): void {
    this.targetGlow = hovering ? 0.95 : 0.55;
  }

  update(dt: number, rotate: boolean): void {
    if (rotate) this.mesh.rotation.y += dt * 0.05;
    this.glow += (this.targetGlow - this.glow) * Math.min(1, dt * 6);
    this.atmoMat.uniforms.uIntensity.value = this.glow;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.atmosphere.geometry.dispose();
    this.atmoMat.dispose();
  }
}
