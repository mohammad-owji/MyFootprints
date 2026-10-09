import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Fresnel: glow concentrated at the limb, fading inward and into space.
    float f = 1.0 - abs(dot(vNormal, vView));
    gl_FragColor = vec4(uColor, pow(f, uPower) * uIntensity);
  }
`;

export interface Atmosphere {
  mesh: THREE.Mesh;
  setIntensity(v: number): void;
  dispose(): void;
}

/** A soft additive fresnel shell — a thin atmospheric rim around a planet. */
export function makeAtmosphere(
  radius: number,
  color: number,
  intensity: number,
  power: number,
): Atmosphere {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
  return {
    mesh,
    setIntensity: (v) => (material.uniforms.uIntensity.value = v),
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
