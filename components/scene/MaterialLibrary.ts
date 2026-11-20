/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

// --- Sculpted High-Craft Shared Geometries (Allocated Once, Reused Across All Instances) ---
function createBeveledTileGeometry(): THREE.BufferGeometry {
  const half = 0.455;
  const radius = 0.055;
  const shape = new THREE.Shape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.41,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 3,
  });
  // Orient extrusion vertically so top sits at +0.225 and bottom at -0.225 (total height ~0.46)
  geo.rotateX(-Math.PI / 2);
  geo.center();
  return geo;
}

function createOrganicCanopyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.5, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // Subtle multi-lobe organic puffing so canopies look leafy and sculpted up close
    const puff =
      1.0 +
      Math.sin(vx * 7.2 + vy * 5.4) * 0.065 +
      Math.cos(vz * 6.8 - vy * 4.9) * 0.055;
    pos.setXYZ(i, vx * puff, vy * puff, vz * puff);
  }
  geo.computeVertexNormals();
  return geo;
}

export const sharedGeos = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tileBox: createBeveledTileGeometry(),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  taperedTrunk: new THREE.CylinderGeometry(0.35, 0.57, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 9),
  sphere: createOrganicCanopyGeometry(),
  smoothSphere: new THREE.SphereGeometry(0.5, 12, 10),
  plane: new THREE.PlaneGeometry(1, 1),
  riverPlane: new THREE.PlaneGeometry(1, 1, 6, 6),
  ring: new THREE.RingGeometry(0.42, 0.52, 28),
  rippleRing: new THREE.RingGeometry(0.12, 0.22, 28),
  blade: new THREE.ConeGeometry(0.36, 1, 4),
  wildflower: new THREE.DodecahedronGeometry(0.5, 0),
  petal: new THREE.PlaneGeometry(0.058, 0.072),
  raindrop: new THREE.BoxGeometry(0.015, 0.44, 0.015),
  cursorEdges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 0.06, 1.02)),
};

// --- Procedural High-Detail PBR Bump Textures (100% Code Generated, Zero External Requests) ---
function createCanvasBumpTexture(
  size: number,
  repeatX: number,
  repeatY: number,
  sampleFn: (px: number, py: number, size: number) => number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const v = Math.max(0, Math.min(255, Math.floor(sampleFn(px, py, size))));
        const idx = (py * size + px) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const hash2 = (x: number, y: number) =>
  (((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) + 1) % 1;

let cachedTerrainBump: THREE.CanvasTexture | null = null;
let cachedBarkBump: THREE.CanvasTexture | null = null;
let cachedBirchBump: THREE.CanvasTexture | null = null;
let cachedLeafBump: THREE.CanvasTexture | null = null;

export function getOrganicBumpTexture(): THREE.CanvasTexture {
  if (!cachedTerrainBump && typeof document !== 'undefined') {
    cachedTerrainBump = createCanvasBumpTexture(256, 2, 2, (px, py) => {
      const wave = Math.sin(px * 0.14) * Math.cos(py * 0.14) * 24;
      const tuft = Math.sin(px * 0.42 + py * 0.25) * 16;
      const grain = hash2(px, py) * 44;
      return 112 + wave + tuft + grain;
    });
  }
  return cachedTerrainBump!;
}

export function getBarkBumpTexture(): THREE.CanvasTexture {
  if (!cachedBarkBump && typeof document !== 'undefined') {
    cachedBarkBump = createCanvasBumpTexture(256, 2, 3, (px, py) => {
      // Deep vertical bark furrows + organic wood fibers
      const furrow = Math.sin(px * 0.34 + Math.sin(py * 0.08) * 1.8) * 42;
      const ridge = Math.sin(px * 0.92 + py * 0.05) * 22;
      const speck = hash2(px, Math.floor(py * 0.5)) * 28;
      return 118 + furrow + ridge + speck;
    });
  }
  return cachedBarkBump!;
}

export function getBirchBumpTexture(): THREE.CanvasTexture {
  if (!cachedBirchBump && typeof document !== 'undefined') {
    cachedBirchBump = createCanvasBumpTexture(256, 1, 2, (px, py) => {
      // Characteristic horizontal birch bark lenticels
      const band = Math.sin(py * 0.48 + Math.sin(px * 0.12) * 1.4);
      const lenticel = band > 0.72 ? -70 : 0;
      const subtle = Math.sin(py * 0.18) * 14 + hash2(px, py) * 18;
      return 165 + lenticel + subtle;
    });
  }
  return cachedBirchBump!;
}

export function getLeafBumpTexture(): THREE.CanvasTexture {
  if (!cachedLeafBump && typeof document !== 'undefined') {
    cachedLeafBump = createCanvasBumpTexture(256, 3, 3, (px, py) => {
      // Overlapping micro leaf-cluster stipple for crisp detail up close in Bird Flight
      const c1 = Math.sin(px * 0.28 + Math.cos(py * 0.22) * 2.2) * 32;
      const c2 = Math.cos(py * 0.34 - Math.sin(px * 0.26) * 2.0) * 28;
      const fine = hash2(Math.floor(px * 0.5), Math.floor(py * 0.5)) * 34;
      return 122 + c1 + c2 + fine;
    });
  }
  return cachedLeafBump!;
}

// --- Shared Water Shader Uniforms (Mutated in single useFrame, zero material rebuilds) ---
export const waterUniforms = {
  uTime: { value: 0 },
  uWaveAmp: { value: 0.015 },
  uFlowSpeed: { value: 0.55 },
};

/**
 * Extends MeshStandardMaterial via onBeforeCompile so the water retains full PBR lighting,
 * environment reflections, shadows, and fog while rippling smoothly with caustics & Fresnel sheen.
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
        varying float vWaterCrest;
        varying vec3 vWorldPosW;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #endif
        float flowCoord = (wp.x + wp.z) * ${isRiver > 0.5 ? '2.8' : '0.42'} - uTime * uFlowSpeed * ${isRiver > 0.5 ? '3.4' : '1.15'};
        float crossCoord = (wp.x - wp.z) * ${isRiver > 0.5 ? '3.6' : '0.62'} + uTime * 1.65;
        float fineCoord = (wp.x * 5.2 - wp.z * 4.4) - uTime * 2.4;
        float w1 = sin(flowCoord) * 0.56 + cos(crossCoord) * 0.30 + sin(fineCoord) * 0.14;
        float disp = w1 * uWaveAmp * ${waveScale.toFixed(2)};
        transformed.z += disp;
        vWaterCrest = w1;
        vWorldPosW = wp.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying float vWaterCrest;
        varying vec3 vWorldPosW;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Sparkling sunlit water caustics + crest foam shimmer
        float cA = sin(vWorldPosW.x * ${isRiver > 0.5 ? '7.5' : '1.1'} + uTime * 2.2) * cos(vWorldPosW.z * ${isRiver > 0.5 ? '7.0' : '1.1'} - uTime * 1.7);
        float cB = sin((vWorldPosW.x - vWorldPosW.z) * ${isRiver > 0.5 ? '5.4' : '0.85'} + uTime * 2.9);
        float caustic = smoothstep(0.42, 0.96, cA * 0.55 + cB * 0.45);
        float shimmer = smoothstep(0.28, 0.92, vWaterCrest) * ${isRiver > 0.5 ? '0.24' : '0.12'};
        // Angle-dependent Fresnel sky reflection boost for dramatic grazing Bird Flight views
        vec3 viewDirW = normalize(cameraPosition - vWorldPosW);
        float fresnel = pow(1.0 - max(0.0, viewDirW.y), 3.0);
        diffuseColor.rgb += vec3(0.58, 0.88, 1.0) * (shimmer + caustic * ${isRiver > 0.5 ? '0.20' : '0.09'});
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.92, 1.0), fresnel * ${isRiver > 0.5 ? '0.32' : '0.42'});`
      );
  };
  mat.customProgramCacheKey = () => `evergreen-water-v2-${isRiver}-${waveScale}`;
  return mat;
}

// --- Material Pool for Trees, Foliage, Bark, Wildlife (Zero Memory Leaks!) ---
const materialPool = new Map<string, THREE.MeshStandardMaterial>();

function quantizeHex(color: THREE.Color): string {
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

  let roughness = 0.72;
  let metalness = 0.04;
  let bumpMap: THREE.Texture | null = null;
  let bumpScale = 0;
  let flatShading = true;

  if (category === 'bark' || category === 'deadWood') {
    roughness = 0.94;
    metalness = 0.02;
    bumpMap = getBarkBumpTexture();
    bumpScale = 0.032;
    flatShading = false;
  } else if (category === 'birchBark') {
    roughness = 0.80;
    metalness = 0.04;
    bumpMap = getBirchBumpTexture();
    bumpScale = 0.024;
    flatShading = false;
  } else if (category === 'bambooBark') {
    roughness = 0.52;
    metalness = 0.08;
    bumpMap = getBirchBumpTexture();
    bumpScale = 0.014;
    flatShading = false;
  } else if (category === 'leaf') {
    roughness = 0.66;
    metalness = 0.04;
    bumpMap = getLeafBumpTexture();
    bumpScale = 0.026;
    flatShading = false;
  } else if (category === 'blossom') {
    roughness = 0.50;
    metalness = 0.06;
    bumpMap = getLeafBumpTexture();
    bumpScale = 0.018;
    flatShading = false;
  } else if (category === 'fungi') {
    roughness = 0.34;
    metalness = 0.08;
    flatShading = false;
  } else if (category === 'critter') {
    roughness = 0.76;
    metalness = 0.04;
    flatShading = false;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: c.clone(),
    flatShading,
    roughness,
    metalness,
    bumpMap,
    bumpScale,
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
