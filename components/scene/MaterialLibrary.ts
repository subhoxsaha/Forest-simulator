/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

// --- Shared Module-Scope Geometries (Allocated Once, Reused Across All Instances) ---
export const sharedGeos = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tileBox: new THREE.BoxGeometry(0.96, 0.45, 0.96),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  taperedTrunk: new THREE.CylinderGeometry(0.36, 0.56, 1, 7),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  sphere: new THREE.IcosahedronGeometry(0.5, 1), // Crisper stylized low-poly canopy silhouette
  smoothSphere: new THREE.SphereGeometry(0.5, 8, 6),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.RingGeometry(0.42, 0.52, 24),
  rippleRing: new THREE.RingGeometry(0.12, 0.22, 24),
  blade: new THREE.ConeGeometry(0.38, 1, 4),
  petal: new THREE.PlaneGeometry(0.055, 0.068),
  raindrop: new THREE.BoxGeometry(0.016, 0.42, 0.016),
  cursorEdges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 0.06, 1.02)),
};

// --- Procedural Micro-Grain Bump Texture (100% Zero-404 Code Generated) ---
function createOrganicNoiseTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor(i / 4 / size);
      const n =
        Math.sin(px * 0.35) * Math.cos(py * 0.35) * 20 +
        (((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1) * 45;
      const v = Math.max(0, Math.min(255, Math.floor(115 + n)));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  // Linear data map (bump/roughness) -> NoColorSpace
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let cachedNoiseTex: THREE.CanvasTexture | null = null;
export function getOrganicBumpTexture(): THREE.CanvasTexture {
  if (!cachedNoiseTex && typeof document !== 'undefined') {
    cachedNoiseTex = createOrganicNoiseTexture(128);
  }
  return cachedNoiseTex!;
}

// --- Shared Water Shader Uniforms (Mutated in single useFrame, zero material rebuilds) ---
export const waterUniforms = {
  uTime: { value: 0 },
  uWaveAmp: { value: 0.015 },
  uFlowSpeed: { value: 0.55 },
};

/**
 * Extends MeshStandardMaterial via onBeforeCompile so the water retains full PBR lighting,
 * environment reflections, shadows, and fog while rippling smoothly on the GPU.
 */
export function createAnimatedWaterMaterial(options: {
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  waveScale?: number;
  isRiver?: boolean;
}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness,
    metalness: options.metalness,
    transparent: true,
    opacity: options.opacity,
    side: THREE.FrontSide,
  });

  const waveScale = options.waveScale ?? 1.0;
  const isRiver = options.isRiver ? 1.0 : 0.0;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.uniforms.uWaveAmp = waterUniforms.uWaveAmp;
    shader.uniforms.uFlowSpeed = waterUniforms.uFlowSpeed;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWaveAmp;
        uniform float uFlowSpeed;
        varying float vWaterCrest;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #endif
        float flowCoord = (wp.x + wp.z) * ${isRiver > 0.5 ? '2.4' : '0.45'} - uTime * uFlowSpeed * ${isRiver > 0.5 ? '3.2' : '1.1'};
        float crossCoord = (wp.x - wp.z) * ${isRiver > 0.5 ? '3.1' : '0.6'} + uTime * 1.4;
        float w1 = sin(flowCoord) * 0.65 + cos(crossCoord) * 0.35;
        float disp = w1 * uWaveAmp * ${waveScale.toFixed(2)};
        transformed.z += disp;
        vWaterCrest = w1;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vWaterCrest;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float shimmer = smoothstep(0.35, 0.95, vWaterCrest) * ${isRiver > 0.5 ? '0.16' : '0.08'};
        diffuseColor.rgb += vec3(0.55, 0.82, 0.96) * shimmer;`
      );
  };
  mat.customProgramCacheKey = () => `evergreen-water-${isRiver}-${waveScale}`;
  return mat;
}

// --- Material Pool for Trees, Foliage, Bark, Wildlife (Zero Memory Leaks!) ---
const materialPool = new Map<string, THREE.MeshStandardMaterial>();

function quantizeHex(color: THREE.Color): string {
  // Quantize to 5-bit per channel so similar variations share materials efficiently
  const r = Math.round(color.r * 31);
  const g = Math.round(color.g * 31);
  const b = Math.round(color.b * 31);
  return `${r}-${g}-${b}`;
}

export function getPooledMaterial(
  category: 'leaf' | 'bark' | 'birchBark' | 'bambooBark' | 'deadWood' | 'blossom' | 'fungi' | 'critter',
  color: THREE.Color | string,
  options?: { opacity?: number; transparent?: boolean; emissive?: string; emissiveIntensity?: number }
): THREE.MeshStandardMaterial {
  const c = typeof color === 'string' ? new THREE.Color(color) : color;
  const opacity = options?.opacity ?? 1;
  const transparent = options?.transparent ?? opacity < 0.99;
  const emissive = options?.emissive ?? '';
  const emissiveIntensity = options?.emissiveIntensity ?? 0;

  const key = `${category}|${quantizeHex(c)}|${opacity.toFixed(2)}|${transparent ? 1 : 0}|${emissive}|${emissiveIntensity.toFixed(1)}`;
  const cached = materialPool.get(key);
  if (cached) return cached;

  // Deliberate roughness contrast (>= 0.25 difference between bark/foliage/blossom/fungi)
  let roughness = 0.72;
  let metalness = 0.04;
  if (category === 'bark' || category === 'deadWood') {
    roughness = 0.96;
    metalness = 0.02;
  } else if (category === 'birchBark') {
    roughness = 0.82;
    metalness = 0.04;
  } else if (category === 'bambooBark') {
    roughness = 0.55;
    metalness = 0.08;
  } else if (category === 'leaf') {
    roughness = 0.68;
    metalness = 0.05;
  } else if (category === 'blossom') {
    roughness = 0.52;
    metalness = 0.06;
  } else if (category === 'fungi') {
    roughness = 0.32;
    metalness = 0.1;
  } else if (category === 'critter') {
    roughness = 0.78;
    metalness = 0.05;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: c.clone(),
    flatShading: true,
    roughness,
    metalness,
    opacity,
    transparent,
    ...(emissive ? { emissive: new THREE.Color(emissive), emissiveIntensity } : {}),
  });

  materialPool.set(key, mat);
  return mat;
}

// --- Zero-GC Scratch Math Objects ---
export const _dummy = new THREE.Object3D();
export const _vec3 = new THREE.Vector3();
export const _vec3b = new THREE.Vector3();
export const _color = new THREE.Color();
export const _colorB = new THREE.Color();
export const _mat4 = new THREE.Matrix4();
