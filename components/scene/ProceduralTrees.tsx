/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EcosystemType, Grid, WeatherType } from '../../types';
import { BUILDINGS, GRID_SIZE } from '../../constants';
import { getHash, getSeasonForDay, gridToWorld } from '../../utils/webgl';
import { sharedGeos, getPooledMaterial, _dummy, _color } from './MaterialLibrary';
import { ecosystemAudio } from '../../services/audio';

// --- Centralized Tree Animation Registry (ONE useFrame updates ALL planted trees!) ---
interface AnimatedTreeEntry {
  group: THREE.Group | null;
  canopy: THREE.Group | null;
  branch1: THREE.Mesh | null;
  branch2: THREE.Mesh | null;
  ring: THREE.Mesh | null;
  x: number;
  y: number;
  hash: number;
  type: EcosystemType;
  growthStage: number;
  targetScale: number;
  trunkSpeedMul: number;
  trunkAmtMul: number;
  canopySpeedMul: number;
  canopyAmtMul: number;
}

const treeRegistry = new Set<AnimatedTreeEntry>();

function getWindSpecs(type: EcosystemType, growthStage: number) {
  if (growthStage === 1) return { ts: 1.6, ta: 0.04, cs: 1.4, ca: 0.03 };
  if (growthStage === 2) return { ts: 1.35, ta: 0.034, cs: 1.5, ca: 0.036 };

  switch (type) {
    case EcosystemType.Pine:
      return { ts: 0.85, ta: 0.015, cs: 1.25, ca: 0.022 };
    case EcosystemType.Oak:
      return { ts: 0.7, ta: 0.012, cs: 0.9, ca: 0.032 };
    case EcosystemType.CherryBlossom:
      return { ts: 1.2, ta: 0.028, cs: 1.6, ca: 0.056 };
    case EcosystemType.Maple:
      return { ts: 1.1, ta: 0.024, cs: 1.8, ca: 0.048 };
    case EcosystemType.Redwood:
      return { ts: 0.5, ta: 0.005, cs: 0.8, ca: 0.024 };
    case EcosystemType.Bonsai:
      return { ts: 1.5, ta: 0.012, cs: 1.4, ca: 0.014 };
    case EcosystemType.Willow:
      return { ts: 1.1, ta: 0.03, cs: 2.1, ca: 0.062 };
    case EcosystemType.Baobab:
      return { ts: 0.35, ta: 0.003, cs: 0.7, ca: 0.018 };
    case EcosystemType.Jacaranda:
      return { ts: 1.0, ta: 0.018, cs: 1.5, ca: 0.045 };
    case EcosystemType.Alder:
      return { ts: 1.15, ta: 0.026, cs: 1.65, ca: 0.038 };
    case EcosystemType.Acacia:
      return { ts: 1.05, ta: 0.02, cs: 1.3, ca: 0.024 };
    case EcosystemType.Birch:
      return { ts: 1.25, ta: 0.036, cs: 1.7, ca: 0.044 };
    case EcosystemType.Bamboo:
      return { ts: 1.6, ta: 0.048, cs: 2.3, ca: 0.058 };
    case EcosystemType.Cypress:
      return { ts: 0.9, ta: 0.015, cs: 1.1, ca: 0.02 };
    case EcosystemType.Peepal:
      return { ts: 0.95, ta: 0.02, cs: 1.9, ca: 0.048 };
    case EcosystemType.Neem:
      return { ts: 1.1, ta: 0.028, cs: 2.1, ca: 0.044 };
    case EcosystemType.Banyan:
      return { ts: 0.6, ta: 0.006, cs: 0.8, ca: 0.015 };
    case EcosystemType.DeadTree:
      return { ts: 0.4, ta: 0.004, cs: 0.5, ca: 0.001 };
    default:
      return { ts: 1.0, ta: 0.02, cs: 1.4, ca: 0.03 };
  }
}

export const TreeWindController: React.FC<{ weather: WeatherType }> = ({ weather }) => {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = state.clock.getElapsedTime();

    let windSpeedMult = 0.95;
    let windAmtMult = 0.85;
    let waveFreq = 0.65;
    if (weather === 'Windy') {
      windSpeedMult = 2.1;
      windAmtMult = 2.4;
      waveFreq = 1.4;
    } else if (weather === 'Raining') {
      windSpeedMult = 0.8;
      windAmtMult = 0.7;
      waveFreq = 0.8;
    } else if (weather === 'Autumn_Dew') {
      windSpeedMult = 1.35;
      windAmtMult = 1.25;
      waveFreq = 0.9;
    }

    treeRegistry.forEach((entry) => {
      const baseSpeed = (1.2 + entry.hash * 0.6) * windSpeedMult;
      const gust = Math.sin(time * waveFreq - (entry.x + entry.y) * 0.22) * 0.45 + 0.55;

      if (entry.group) {
        const curS = entry.group.scale.x;
        const nextS = THREE.MathUtils.damp(curS, entry.targetScale, 6.5, dt);
        entry.group.scale.setScalar(nextS);

        const ts = baseSpeed * entry.trunkSpeedMul;
        const ta = entry.trunkAmtMul * windAmtMult * gust;
        entry.group.rotation.z = Math.sin(time * ts + entry.hash * 10) * ta;
        entry.group.rotation.x = Math.cos(time * ts * 0.85 + entry.hash * 5) * (ta * 0.35);
      }

      if (entry.canopy) {
        const cs = baseSpeed * entry.canopySpeedMul;
        const ca = entry.canopyAmtMul * windAmtMult * gust;
        const flutter = Math.sin(time * 5.0 + entry.hash * 12) * (0.005 * windAmtMult) * gust;
        entry.canopy.rotation.z = Math.sin(time * cs + entry.hash * 7) * ca + flutter;
        entry.canopy.rotation.x = Math.cos(time * cs * 1.1 + entry.hash * 4) * (ca * 0.45) + flutter;
      }

      if (entry.branch1) {
        const bs = baseSpeed * (entry.growthStage === 2 ? 1.7 : 1.3);
        const ba = (entry.growthStage === 2 ? 0.07 : 0.042) * windAmtMult * gust;
        entry.branch1.rotation.z = Math.sin(time * bs + entry.hash * 5) * ba;
      }

      if (entry.branch2) {
        const bs = baseSpeed * 1.25;
        const ba = 0.038 * windAmtMult * gust;
        entry.branch2.rotation.z = Math.sin(time * bs + entry.hash * 8 + Math.PI / 2) * ba;
      }

      if (entry.ring) {
        const pulse = 1.0 + Math.sin(time * 2.2 + entry.hash * 6) * 0.11;
        entry.ring.scale.set(pulse, pulse, 1);
      }
    });
  });

  return null;
};

// --- Instanced Canopy Petal Fall System (1 Draw Call for ALL flowering/autumn trees!) ---
const MAX_PETALS = 180;

interface PetalSource {
  wx: number;
  wz: number;
  topY: number;
  color: THREE.Color;
  speed: number;
  phase: number;
  ox: number;
  oz: number;
}

export const InstancedCanopyPetals: React.FC<{ grid: Grid; weather: WeatherType }> = React.memo(({ grid, weather }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const petals = useMemo(() => {
    const list: PetalSource[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tile = grid[y][x];
        if (tile.growthStage < 3) continue;

        let colorHex: string | null = null;
        let height = 1.15;
        let count = 2;
        if (tile.type === EcosystemType.CherryBlossom) {
          colorHex = '#fbcfe8';
          height = tile.growthStage === 4 ? 1.85 : 1.15;
          count = 3;
        } else if (tile.type === EcosystemType.Jacaranda) {
          colorHex = '#c084fc';
          height = tile.growthStage === 4 ? 2.0 : 1.35;
          count = 3;
        } else if (tile.type === EcosystemType.Maple) {
          colorHex = '#fb923c';
          height = tile.growthStage === 4 ? 1.9 : 1.2;
          count = 2;
        } else if (tile.type === EcosystemType.Willow) {
          colorHex = '#fde047';
          height = tile.growthStage === 4 ? 1.55 : 0.95;
          count = 2;
        }

        if (!colorHex) continue;
        const [wx, , wz] = gridToWorld(x, y);
        const h = getHash(x, y);
        const col = new THREE.Color(colorHex);

        for (let i = 0; i < count && list.length < MAX_PETALS; i++) {
          const ph = (h * (i + 1) * 7.7) % 1;
          list.push({
            wx,
            wz,
            topY: height,
            color: col,
            speed: 0.28 + ((ph * 3.1) % 1) * 0.2,
            phase: ph * Math.PI * 2,
            ox: (ph - 0.5) * 0.65,
            oz: (((ph * 2.3) % 1) - 0.5) * 0.65,
          });
        }
      }
    }
    return list;
  }, [grid]);

  const petalMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => () => petalMat.dispose(), [petalMat]);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.count = petals.length;
    for (let i = 0; i < petals.length; i++) {
      meshRef.current.setColorAt(i, petals[i].color);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [petals]);

  useFrame((state) => {
    if (!meshRef.current || petals.length === 0) return;
    const t = state.clock.getElapsedTime();
    const windDrift = weather === 'Windy' ? 0.35 : 0.14;

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      const frac = ((t * p.speed + p.phase) % p.topY) / p.topY;
      const py = p.topY * (1 - frac);
      const sway = Math.sin(t * 2.4 + p.phase) * windDrift;
      _dummy.position.set(p.wx + p.ox + sway, py, p.wz + p.oz + Math.cos(t * 1.9 + p.phase) * 0.12);
      _dummy.rotation.set(t * 1.2 + p.phase, t * 1.8 + p.phase, Math.sin(t + p.phase) * 0.5);
      const fade = Math.min(1, frac * 6) * Math.min(1, (1 - frac) * 5);
      _dummy.scale.setScalar(fade);
      _dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, _dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[sharedGeos.petal, petalMat, MAX_PETALS]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
});

// --- Zero-setState Falling Tree Collapse Effect ---
const FallingTreeEffect: React.FC<{
  type: EcosystemType;
  growthStage: number;
  startTime: number;
  x: number;
  y: number;
  onFinish: () => void;
}> = React.memo(({ type, growthStage, startTime, x, y, onFinish }) => {
  const groupRef = useRef<THREE.Group>(null);
  const doneRef = useRef(false);
  const hash = getHash(x, y);

  const { leafMat, barkMat } = useMemo(() => {
    const cfg = BUILDINGS[type];
    const lc = new THREE.Color(cfg ? cfg.color : '#15803d');
    const bc = new THREE.Color('#6b3a17');
    return {
      leafMat: new THREE.MeshStandardMaterial({ color: lc, flatShading: true, transparent: true, opacity: 1, roughness: 0.72 }),
      barkMat: new THREE.MeshStandardMaterial({ color: bc, flatShading: true, transparent: true, opacity: 1, roughness: 0.95 }),
    };
  }, [type]);

  useEffect(() => {
    return () => {
      leafMat.dispose();
      barkMat.dispose();
    };
  }, [leafMat, barkMat]);

  useFrame((state) => {
    if (doneRef.current) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(1, elapsed / 2.2);

    if (progress >= 1) {
      doneRef.current = true;
      onFinish();
      return;
    }

    const alpha = 1 - progress;
    leafMat.opacity = alpha;
    barkMat.opacity = alpha;

    if (groupRef.current) {
      const shake = progress < 0.15 ? Math.sin(state.clock.getElapsedTime() * 45) * 0.08 : 0;
      const fallDir = hash * Math.PI * 2;
      const tilt = Math.PI * 0.48 * Math.pow(Math.max(0, progress - 0.1) / 0.9, 1.85);
      groupRef.current.rotation.x = Math.sin(fallDir) * tilt + shake;
      groupRef.current.rotation.z = Math.cos(fallDir) * tilt;
      groupRef.current.position.y = -0.3 - tilt * 0.35 - progress * 0.45;
    }
  });

  const scale = growthStage === 4 ? 1.55 : growthStage === 3 ? 1.05 : growthStage === 2 ? 0.55 : 0.25;

  return (
    <group ref={groupRef} position={[0, -0.3, 0]} scale={scale}>
      <mesh geometry={sharedGeos.taperedTrunk} material={barkMat} position={[0, 0.5, 0]} scale={[0.22, 1.15, 0.22]} />
      <mesh geometry={sharedGeos.sphere} material={leafMat} position={[0, 1.25, 0]} scale={[0.72, 0.65, 0.72]} />
      <mesh geometry={sharedGeos.sphere} material={leafMat} position={[0.22, 1.45, 0.12]} scale={[0.48, 0.45, 0.48]} />
    </group>
  );
});

// --- Compute Seasonal Leaf Color ---
function computeLeafColor(type: EcosystemType, hash: number, weather: WeatherType, day: number): THREE.Color {
  const cfg = BUILDINGS[type];
  const season = getSeasonForDay(day);
  const isAutumn = weather === 'Autumn_Dew' || season === 'autumn';
  const isWinter = season === 'winter';
  const isSummer = season === 'summer';

  const col = new THREE.Color(cfg ? cfg.color : '#15803d');

  if (isAutumn) {
    switch (type) {
      case EcosystemType.Maple:
        col.set(hash > 0.5 ? '#b91c1c' : '#dc2626');
        break;
      case EcosystemType.Oak:
        col.set(hash > 0.5 ? '#ca8a04' : '#b45309');
        break;
      case EcosystemType.CherryBlossom:
        col.set(hash > 0.5 ? '#fda4af' : '#f472b6');
        break;
      case EcosystemType.Willow:
        col.set('#eab308');
        break;
      case EcosystemType.Bonsai:
        col.set('#d97706');
        break;
      case EcosystemType.Alder:
        col.set('#c2410c');
        break;
      case EcosystemType.Jacaranda:
        col.set('#6b21a8');
        break;
      case EcosystemType.Acacia:
        col.set('#854d0e');
        break;
      case EcosystemType.Birch:
        col.set('#eab308');
        break;
      default:
        col.set('#065f46');
        break;
    }
  } else if (isWinter) {
    switch (type) {
      case EcosystemType.Pine:
      case EcosystemType.Redwood:
      case EcosystemType.Cypress:
        col.set('#0f766e').offsetHSL(0, -0.14, 0.04);
        break;
      case EcosystemType.CherryBlossom:
        col.set('#fbcfe8').offsetHSL(0.02, -0.35, 0.08);
        break;
      case EcosystemType.Jacaranda:
        col.set('#c084fc').offsetHSL(0, -0.32, 0.06);
        break;
      default:
        col.offsetHSL(0.04, -0.3, 0.1);
        break;
    }
  } else if (isSummer) {
    if (type === EcosystemType.Willow || type === EcosystemType.Alder || type === EcosystemType.Oak) {
      col.offsetHSL(0.05, -0.05, -0.01);
    }
  }

  col.offsetHSL(hash * 0.06 - 0.03, hash * 0.06 - 0.03, hash * 0.06 - 0.03);
  return col;
}

export interface ProceduralTreeProps {
  type: EcosystemType;
  growthStage: number;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
  weather?: WeatherType;
  growthProgress?: number;
  day?: number;
  isPreview?: boolean;
}

export const ProceduralTree: React.FC<ProceduralTreeProps> = React.memo(
  ({
    type,
    growthStage,
    x,
    y,
    opacity = 1,
    transparent = false,
    weather = 'Sunny',
    growthProgress = 0,
    day = 1,
    isPreview = false,
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    const canopyRef = useRef<THREE.Group>(null);
    const branchRef = useRef<THREE.Mesh>(null);
    const branch2Ref = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    const hash = getHash(x, y);
    const h1 = hash;
    const h2 = (hash * 3.7 + 0.13) % 1;
    const h3 = (hash * 7.1 + 0.47) % 1;
    const h4 = (hash * 13.9 + 0.79) % 1;
    const h5 = (hash * 19.3 + 0.23) % 1;
    const rotation = hash * Math.PI * 2;

    // Track transition to DeadTree for collapse animation
    const lastLivingRef = useRef<{ type: EcosystemType; stage: number } | null>(null);
    const lastTypeRef = useRef<EcosystemType>(type);
    const [fallingState, setFallingState] = useState<{ type: EcosystemType; stage: number; startTime: number } | null>(null);

    if (type !== EcosystemType.DeadTree && type !== EcosystemType.None) {
      lastLivingRef.current = { type, stage: growthStage };
    }

    useEffect(() => {
      if (
        !isPreview &&
        lastTypeRef.current !== EcosystemType.DeadTree &&
        lastTypeRef.current !== EcosystemType.None &&
        type === EcosystemType.DeadTree
      ) {
        setFallingState({
          type: lastTypeRef.current,
          stage: lastLivingRef.current?.stage || 3,
          startTime: Date.now(),
        });
        ecosystemAudio.playWoodCrack();
      }
      lastTypeRef.current = type;
    }, [type, isPreview]);

    const scaleMultiplier = useMemo(() => {
      if (type === EcosystemType.DeadTree) return 0.85;
      switch (growthStage) {
        case 1:
          return 0.28;
        case 2:
          return 0.62;
        case 3:
          return 1.1;
        case 4:
          return 1.78;
        default:
          return 0.15;
      }
    }, [growthStage, type]);

    // Register into single centralized TreeWindController (0 per-tree useFrame overhead!)
    useEffect(() => {
      if (isPreview) return;
      const specs = getWindSpecs(type, growthStage);
      const entry: AnimatedTreeEntry = {
        group: groupRef.current,
        canopy: canopyRef.current,
        branch1: branchRef.current,
        branch2: branch2Ref.current,
        ring: ringRef.current,
        x,
        y,
        hash,
        type,
        growthStage,
        targetScale: scaleMultiplier,
        trunkSpeedMul: specs.ts,
        trunkAmtMul: specs.ta,
        canopySpeedMul: specs.cs,
        canopyAmtMul: specs.ca,
      };
      treeRegistry.add(entry);
      return () => {
        treeRegistry.delete(entry);
      };
    }, [type, growthStage, x, y, hash, scaleMultiplier, isPreview]);

    // Pooled materials (zero leaks, crisp roughness contrast between bark & foliage)
    const { leavesMat, barkMat, deadWoodMat, blossomMat, orangeFungiMat, goldFungiMat, redFungiMat, cyanFungiMat, stemMat, ringMat } =
      useMemo(() => {
        const lCol = computeLeafColor(type, hash, weather, day);
        const barkCategory =
          type === EcosystemType.Birch ? 'birchBark' : type === EcosystemType.Bamboo ? 'bambooBark' : 'bark';
        const barkHex =
          type === EcosystemType.Birch
            ? _color.set('#e2e8f0').multiplyScalar(0.92 + hash * 0.08)
            : type === EcosystemType.Bamboo
            ? _color.set('#65a30d').multiplyScalar(0.85 + hash * 0.15)
            : type === EcosystemType.Redwood
            ? _color.set('#7c2d12').multiplyScalar(0.8 + hash * 0.2)
            : _color.set('#78350f').multiplyScalar(0.72 + hash * 0.28);

        return {
          leavesMat: getPooledMaterial('leaf', lCol, { opacity, transparent }),
          barkMat: getPooledMaterial(barkCategory, barkHex, { opacity, transparent }),
          deadWoodMat: getPooledMaterial('deadWood', '#574c40', { opacity, transparent }),
          blossomMat: getPooledMaterial('blossom', '#fbcfe8', { opacity, transparent }),
          orangeFungiMat: getPooledMaterial('fungi', '#f97316', { emissive: '#ea580c', emissiveIntensity: 0.45 }),
          goldFungiMat: getPooledMaterial('fungi', '#fbbf24', { emissive: '#d97706', emissiveIntensity: 0.6 }),
          redFungiMat: getPooledMaterial('fungi', '#ef4444'),
          cyanFungiMat: getPooledMaterial('fungi', '#0284c7', { emissive: '#38bdf8', emissiveIntensity: 1.2 }),
          stemMat: getPooledMaterial('critter', '#f5f5f4'),
          ringMat: getPooledMaterial('fungi', '#a3e635', {
            opacity: 0.24,
            transparent: true,
            emissive: '#65a30d',
            emissiveIntensity: 0.55,
          }),
        };
      }, [type, hash, weather, day, opacity, transparent]);

    const isAncient = growthStage === 4;
    const trunkMul = isAncient ? 1.32 : 1.0;
    const canopyMul = isAncient ? 1.36 : 1.0;
    const cyl = sharedGeos.cylinder;
    const trunk = sharedGeos.taperedTrunk;
    const cone = sharedGeos.cone;
    const sph = sharedGeos.sphere;
    const cast = !isPreview;

    return (
      <>
        <group ref={groupRef} position={[0, -0.28, 0]} scale={isPreview ? scaleMultiplier : Math.max(0.12, scaleMultiplier * 0.85)}>
          {/* Stage 0: Decomposing Dead Wood with Glowing Fungi */}
          {type === EcosystemType.DeadTree && (
            <group rotation={[0, rotation, 0]}>
              <mesh castShadow={cast} receiveShadow geometry={trunk} material={deadWoodMat} position={[0, 0.24, 0]} scale={[0.28, 0.55, 0.28]} />
              <mesh castShadow={cast} geometry={cyl} material={deadWoodMat} position={[0.14, 0.08, 0.1]} scale={[0.12, 0.28, 0.12]} rotation={[0.4, 0.3, -1.1]} />
              <mesh castShadow={cast} geometry={cyl} material={deadWoodMat} position={[-0.12, 0.12, -0.14]} scale={[0.1, 0.32, 0.1]} rotation={[-0.35, -0.2, 1.0]} />

              {/* Nutrient release pulse ring */}
              <mesh ref={ringRef} geometry={sharedGeos.plane} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[1.1, 1.1, 1]} />

              {/* Progressive Fungi Growth */}
              <mesh geometry={sph} material={orangeFungiMat} position={[-0.08, 0.26, 0.06]} scale={[0.13, 0.04, 0.11]} />
              {growthProgress >= 30 && (
                <mesh geometry={sph} material={goldFungiMat} position={[-0.09, 0.42, -0.05]} scale={[0.1, 0.035, 0.09]} />
              )}
              {growthProgress >= 15 && (
                <group position={[0.18, 0.02, -0.15]}>
                  <mesh geometry={cyl} material={stemMat} position={[0, 0.04, 0]} scale={[0.02, 0.08, 0.02]} />
                  <mesh geometry={sph} material={redFungiMat} position={[0, 0.08, 0]} scale={[0.07, 0.045, 0.07]} />
                </group>
              )}
              {growthProgress >= 60 && (
                <group position={[0.21, 0.02, 0.13]}>
                  <mesh geometry={cyl} material={stemMat} position={[0, 0.06, 0]} scale={[0.015, 0.12, 0.015]} />
                  <mesh geometry={sph} material={cyanFungiMat} position={[0, 0.12, 0]} scale={[0.055, 0.038, 0.055]} />
                </group>
              )}
            </group>
          )}

          {/* Stage 1: Sprout */}
          {type !== EcosystemType.DeadTree && growthStage === 1 && (
            <group rotation={[0, rotation, 0]}>
              <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[0, 0.14, 0]} scale={[0.1, 0.3, 0.1]} />
              <group ref={canopyRef} position={[0, 0.26, 0]}>
                <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0.08, 0, 0]} scale={[0.13, 0.2, 0.13]} rotation={[0, 0, -Math.PI / 5]} />
                <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[-0.08, 0, 0]} scale={[0.13, 0.2, 0.13]} rotation={[0, 0, Math.PI / 5]} />
                {type === EcosystemType.CherryBlossom && (
                  <mesh geometry={sph} material={blossomMat} position={[0, 0.06, 0]} scale={0.09} />
                )}
              </group>
            </group>
          )}

          {/* Stage 2: Sapling */}
          {type !== EcosystemType.DeadTree && growthStage === 2 && (
            <group rotation={[0, rotation, 0]}>
              <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.32, 0]} scale={[0.15, 0.68, 0.15]} />
              <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.1, 0.44, 0]} scale={[0.07, 0.28, 0.07]} rotation={[0, 0, -Math.PI / 4]} />
              <group ref={canopyRef} position={[0, 0.68, 0]}>
                <mesh castShadow={cast} receiveShadow geometry={type === EcosystemType.Pine || type === EcosystemType.Cypress ? cone : sph} material={leavesMat} scale={[0.38, 0.42, 0.38]} />
                <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.18, -0.1, 0.06]} scale={[0.24, 0.24, 0.24]} />
              </group>
            </group>
          )}

          {/* Stage 3 (Mature) & Stage 4 (Ancient Titan) — All 17 Living Species */}
          {type !== EcosystemType.DeadTree && growthStage >= 3 && (() => {
            switch (type) {
              case EcosystemType.Pine:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.48 * trunkMul, 0]} scale={[0.2 * trunkMul, 1.0 * trunkMul, 0.2 * trunkMul]} />
                    <group ref={canopyRef} position={[0, 0.72 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.22, 0]} scale={[0.74 * (0.94 + h1 * 0.12), 0.78, 0.74 * (0.94 + h1 * 0.12)]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.62, 0]} scale={[0.58, 0.68, 0.58]} rotation={[0, 0.5, 0]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.98, 0]} scale={[0.42, 0.54, 0.42]} />
                      {isAncient && <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0, 1.28, 0]} scale={[0.26, 0.38, 0.26]} />}
                    </group>
                  </group>
                );

              case EcosystemType.Oak:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.52 * trunkMul, 0]} scale={[0.32 * trunkMul, 1.1 * trunkMul, 0.32 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.22, 0.82 * trunkMul, 0.18]} scale={[0.12, 0.5, 0.12]} rotation={[0.45, 0, -0.5]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.22, 0.8 * trunkMul, -0.18]} scale={[0.12, 0.48, 0.12]} rotation={[-0.45, 0, 0.5]} />
                    <group ref={canopyRef} position={[0, 1.15 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.18, 0]} scale={[0.82, 0.72, 0.82]} />
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0.3, 0.35, 0.18]} scale={[0.56, 0.5, 0.56]} />
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[-0.28, 0.32, -0.14]} scale={[0.58, 0.52, 0.58]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.05, 0.55, -0.2]} scale={[0.46, 0.42, 0.46]} />
                    </group>
                  </group>
                );

              case EcosystemType.CherryBlossom:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.5 * trunkMul, 0]} scale={[0.22 * trunkMul, 1.06 * trunkMul, 0.22 * trunkMul]} rotation={[0.08, 0, 0.08]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.18, 0.78 * trunkMul, 0.12]} scale={[0.1, 0.44, 0.1]} rotation={[0.3, 0, -0.55]} />
                    <group ref={canopyRef} position={[0.08, 1.08 * trunkMul, 0.06]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.08, 0]} scale={[0.78, 0.62, 0.78]} />
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[-0.32, 0.2, -0.2]} scale={[0.54, 0.46, 0.54]} />
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0.32, 0.16, 0.22]} scale={[0.58, 0.48, 0.58]} />
                      <mesh castShadow={cast} geometry={sph} material={blossomMat} position={[0.08, 0.42, -0.08]} scale={[0.42, 0.32, 0.42]} />
                    </group>
                  </group>
                );

              case EcosystemType.Maple:
                return (
                  <group rotation={[0, rotation + Math.PI / 4, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.54 * trunkMul, 0]} scale={[0.22 * trunkMul, 1.15 * trunkMul, 0.22 * trunkMul]} />
                    <group ref={canopyRef} position={[0, 1.12 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.14, 0]} scale={[0.74, 0.76, 0.74]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.62, 0]} scale={[0.5, 0.62, 0.5]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.26, -0.02, 0.18]} scale={[0.44, 0.42, 0.44]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.24, 0.04, -0.18]} scale={[0.42, 0.4, 0.42]} />
                    </group>
                  </group>
                );

              case EcosystemType.Redwood:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.96 * trunkMul, 0]} scale={[0.44 * trunkMul, 1.98 * trunkMul, 0.44 * trunkMul]} />
                    <group ref={canopyRef} position={[0, 1.32 * trunkMul, 0]} scale={[canopyMul, canopyMul * 1.12, canopyMul]}>
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.2, 0]} scale={[0.88, 0.85, 0.88]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.68, 0]} scale={[0.68, 0.72, 0.68]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 1.12, 0]} scale={[0.5, 0.58, 0.5]} />
                      <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0, 1.5, 0]} scale={[0.35, 0.45, 0.35]} />
                      {isAncient && <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0, 1.84, 0]} scale={[0.22, 0.34, 0.22]} />}
                    </group>
                  </group>
                );

              case EcosystemType.Bonsai:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.16 * trunkMul, 0]} scale={[0.12 * trunkMul, 0.34 * trunkMul, 0.12 * trunkMul]} rotation={[0.15, 0, 0.22]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.08, 0.3 * trunkMul, 0.05]} scale={[0.06, 0.22, 0.06]} rotation={[-0.35, 0.3, -Math.PI / 3]} />
                    <group ref={canopyRef} position={[0.1 * canopyMul, 0.4 * canopyMul, -0.04]} scale={0.85 * canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.05, 0]} scale={[0.32, 0.14, 0.32]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.16, -0.04, 0.1]} scale={[0.22, 0.1, 0.22]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.16, 0.12, -0.1]} scale={[0.18, 0.09, 0.18]} />
                    </group>
                  </group>
                );

              case EcosystemType.Willow:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.46 * trunkMul, 0]} scale={[0.18 * trunkMul, 0.96 * trunkMul, 0.18 * trunkMul]} rotation={[0, 0, 0.07]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.18, 0.74 * trunkMul, 0]} scale={[0.08, 0.38, 0.08]} rotation={[0, 0, -Math.PI / 3]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.18, 0.72 * trunkMul, 0]} scale={[0.08, 0.38, 0.08]} rotation={[0, 0, Math.PI / 3]} />
                    <group ref={canopyRef} position={[0, 0.95 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.1, 0]} scale={[0.66, 0.5, 0.66]} />
                      <mesh castShadow={cast} geometry={cyl} material={leavesMat} position={[0.3, -0.2, 0.2]} scale={[0.16, 0.56, 0.16]} rotation={[0.08, 0, 0.05]} />
                      <mesh castShadow={cast} geometry={cyl} material={leavesMat} position={[-0.3, -0.2, -0.2]} scale={[0.16, 0.56, 0.16]} rotation={[-0.08, 0, -0.05]} />
                      <mesh castShadow={cast} geometry={cyl} material={leavesMat} position={[0.2, -0.22, -0.28]} scale={[0.14, 0.5, 0.14]} />
                      <mesh castShadow={cast} geometry={cyl} material={leavesMat} position={[-0.2, -0.22, 0.28]} scale={[0.14, 0.5, 0.14]} />
                    </group>
                  </group>
                );

              case EcosystemType.Baobab:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.36 * trunkMul, 0]} scale={[0.56 * trunkMul, 0.76 * trunkMul, 0.56 * trunkMul]} />
                    <mesh castShadow={cast} receiveShadow geometry={cyl} material={barkMat} position={[0, 0.78 * trunkMul, 0]} scale={[0.36 * trunkMul, 0.46 * trunkMul, 0.36 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.2, 0.96 * trunkMul, 0.1]} scale={[0.12, 0.4, 0.12]} rotation={[0.6, 0, -0.6]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.2, 0.96 * trunkMul, -0.1]} scale={[0.12, 0.4, 0.12]} rotation={[-0.6, 0, 0.6]} />
                    <group ref={canopyRef} position={[0, 1.15 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.1, 0]} scale={[0.52, 0.3, 0.52]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.28, 0.04, 0.14]} scale={[0.36, 0.22, 0.36]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.28, 0.04, -0.14]} scale={[0.36, 0.22, 0.36]} />
                    </group>
                  </group>
                );

              case EcosystemType.Jacaranda:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.54 * trunkMul, 0]} scale={[0.22 * trunkMul, 1.15 * trunkMul, 0.22 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.2, 0.82 * trunkMul, 0.1]} scale={[0.1, 0.55, 0.1]} rotation={[0.4, 0.1, -0.45]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.2, 0.82 * trunkMul, -0.1]} scale={[0.1, 0.55, 0.1]} rotation={[-0.4, -0.1, 0.45]} />
                    <group ref={canopyRef} position={[0, 1.3 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.2, 0]} scale={[0.74, 0.64, 0.74]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.32, 0.04, 0.2]} scale={[0.54, 0.48, 0.54]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.32, 0.06, -0.2]} scale={[0.54, 0.48, 0.54]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.18, 0.34, 0.26]} scale={[0.46, 0.4, 0.46]} />
                    </group>
                  </group>
                );

              case EcosystemType.Alder:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.48 * trunkMul, 0]} scale={[0.2 * trunkMul, 1.04 * trunkMul, 0.2 * trunkMul]} />
                    <group ref={canopyRef} position={[0, 1.08 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.1, 0]} scale={[0.64, 0.76, 0.64]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.15, 0.38, 0.15]} scale={[0.48, 0.54, 0.48]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.15, 0.28, -0.15]} scale={[0.44, 0.5, 0.44]} />
                    </group>
                  </group>
                );

              case EcosystemType.Acacia:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0.04, 0.44 * trunkMul, 0]} scale={[0.18 * trunkMul, 0.96 * trunkMul, 0.18 * trunkMul]} rotation={[0.08, 0, 0.08]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.18, 0.72 * trunkMul, 0.16]} scale={[0.09, 0.48, 0.09]} rotation={[0.4, 0.2, -0.45]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.1, 0.7 * trunkMul, -0.1]} scale={[0.08, 0.42, 0.08]} rotation={[-0.45, 0.2, 0.45]} />
                    <group ref={canopyRef} position={[0.1 * trunkMul, 1.04 * trunkMul, 0.06]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.05, 0]} scale={[1.15, 0.15, 1.15]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.28, 0.2, -0.18]} scale={[0.68, 0.12, 0.68]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.28, 0.16, 0.18]} scale={[0.6, 0.12, 0.6]} />
                    </group>
                  </group>
                );

              case EcosystemType.Birch:
                return (
                  <group rotation={[0, rotation + Math.PI / 4, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.56 * trunkMul, 0]} scale={[0.14 * trunkMul, 1.18 * trunkMul, 0.14 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.1, 0.72 * trunkMul, 0.08]} scale={[0.06, 0.42, 0.06]} rotation={[0.3, 0.2, -0.42]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.1, 0.88 * trunkMul, -0.08]} scale={[0.055, 0.36, 0.055]} rotation={[-0.3, 0.1, 0.42]} />
                    <group ref={canopyRef} position={[0, 1.2 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.1, 0]} scale={[0.56, 0.48, 0.56]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.2, 0.25, 0.14]} scale={[0.38, 0.34, 0.38]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.2, 0.28, -0.14]} scale={[0.36, 0.32, 0.36]} />
                    </group>
                  </group>
                );

              case EcosystemType.Bamboo:
                return (
                  <group rotation={[0, rotation + Math.PI / 2, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={cyl} material={barkMat} position={[0, 0.62 * trunkMul, 0]} scale={[0.09 * trunkMul, 1.28 * trunkMul, 0.09 * trunkMul]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[0.14, 0.55 * trunkMul, 0.05]} scale={[0.07 * trunkMul, 1.15 * trunkMul, 0.07 * trunkMul]} rotation={[0.08, 0, -0.06]} />
                    {isAncient && (
                      <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[-0.14, 0.66 * trunkMul, -0.08]} scale={[0.065 * trunkMul, 1.38 * trunkMul, 0.065 * trunkMul]} rotation={[-0.08, 0, 0.08]} />
                    )}
                    <group ref={canopyRef} position={[0, 1.15 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.1, 0]} scale={[0.4, 0.56, 0.4]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.12, -0.14, 0.1]} scale={[0.26, 0.36, 0.26]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.14, -0.2, -0.08]} scale={[0.24, 0.34, 0.24]} />
                    </group>
                  </group>
                );

              case EcosystemType.Cypress:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.56 * trunkMul, 0]} scale={[0.24 * trunkMul, 1.2 * trunkMul, 0.24 * trunkMul]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[0.18, 0.12, 0.12]} scale={[0.12, 0.26, 0.12]} rotation={[0.2, 0.1, 0.2]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[-0.18, 0.12, -0.12]} scale={[0.12, 0.26, 0.12]} rotation={[-0.2, -0.1, -0.2]} />
                    <group ref={canopyRef} position={[0, 0.85 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.2, 0]} scale={[0.56 * (0.92 + h2 * 0.16), 1.0, 0.56 * (0.92 + h2 * 0.16)]} />
                      <mesh castShadow={cast} receiveShadow geometry={cone} material={leavesMat} position={[0, 0.65, 0]} scale={[0.42, 0.8, 0.42]} />
                      <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0, 1.05, 0]} scale={[0.3, 0.6, 0.3]} />
                      {isAncient && <mesh castShadow={cast} geometry={cone} material={leavesMat} position={[0, 1.42, 0]} scale={[0.18, 0.45, 0.18]} />}
                    </group>
                  </group>
                );

              case EcosystemType.Peepal:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.55 * trunkMul, 0]} scale={[0.22 * trunkMul, 1.15 * trunkMul, 0.22 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.18, 0.92 * trunkMul, 0.08]} scale={[0.09, 0.48, 0.09]} rotation={[0.3, 0, -0.35]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.18, 0.92 * trunkMul, -0.08]} scale={[0.09, 0.48, 0.09]} rotation={[-0.3, 0, 0.35]} />
                    <group ref={canopyRef} position={[0, 1.12 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.2, 0]} scale={[0.66, 0.52, 0.66]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.26, -0.04, 0.15]} scale={[0.44, 0.38, 0.44]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.26, -0.04, -0.15]} scale={[0.44, 0.38, 0.44]} />
                      {isAncient && <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0, 0.54, 0]} scale={[0.38, 0.32, 0.38]} />}
                    </group>
                  </group>
                );

              case EcosystemType.Neem:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.62 * trunkMul, 0]} scale={[0.16 * trunkMul, 1.32 * trunkMul, 0.16 * trunkMul]} />
                    <mesh ref={branchRef} castShadow={cast} geometry={cyl} material={barkMat} position={[0.1, 0.98 * trunkMul, -0.05]} scale={[0.07, 0.55, 0.07]} rotation={[0.18, 0.2, -0.42]} />
                    <mesh ref={branch2Ref} castShadow={cast} geometry={cyl} material={barkMat} position={[-0.1, 0.98 * trunkMul, 0.05]} scale={[0.07, 0.55, 0.07]} rotation={[-0.18, -0.2, 0.42]} />
                    <group ref={canopyRef} position={[0, 1.22 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.15, 0]} scale={[0.46, 0.48, 0.46]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.22, 0.34, -0.14]} scale={[0.28, 0.32, 0.28]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.22, 0.3, 0.14]} scale={[0.28, 0.32, 0.28]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.15, -0.1, 0.22]} scale={[0.3, 0.34, 0.3]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.15, -0.1, -0.22]} scale={[0.3, 0.34, 0.3]} />
                    </group>
                  </group>
                );

              case EcosystemType.Banyan:
                return (
                  <group rotation={[0, rotation, 0]}>
                    <mesh castShadow={cast} receiveShadow geometry={trunk} material={barkMat} position={[0, 0.46 * trunkMul, 0]} scale={[0.38 * trunkMul, 1.05 * trunkMul, 0.38 * trunkMul]} />
                    {/* Aerial prop roots */}
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[0.25 * trunkMul, 0.38 * trunkMul, 0.15]} scale={[0.09 * trunkMul, 0.86 * trunkMul, 0.09 * trunkMul]} rotation={[0.04, 0, -0.06]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[-0.25 * trunkMul, 0.38 * trunkMul, -0.15]} scale={[0.09 * trunkMul, 0.86 * trunkMul, 0.09 * trunkMul]} rotation={[-0.04, 0, 0.06]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[-0.15, 0.38 * trunkMul, 0.25 * trunkMul]} scale={[0.08 * trunkMul, 0.86 * trunkMul, 0.08 * trunkMul]} />
                    <mesh castShadow={cast} geometry={cyl} material={barkMat} position={[0.15, 0.38 * trunkMul, -0.25 * trunkMul]} scale={[0.08 * trunkMul, 0.86 * trunkMul, 0.08 * trunkMul]} />
                    <group ref={canopyRef} position={[0, 0.85 * trunkMul, 0]} scale={canopyMul}>
                      <mesh castShadow={cast} receiveShadow geometry={sph} material={leavesMat} position={[0, 0.22, 0]} scale={[1.05 * (0.94 + h3 * 0.12), 0.36, 1.05 * (0.94 + h3 * 0.12)]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.42, 0.08, 0.24]} scale={[0.62, 0.26, 0.62]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.42, 0.08, -0.24]} scale={[0.62, 0.26, 0.62]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[-0.3, 0.12, 0.38]} scale={[0.55, 0.24, 0.55]} />
                      <mesh castShadow={cast} geometry={sph} material={leavesMat} position={[0.3, 0.12, -0.38]} scale={[0.55, 0.24, 0.55]} />
                    </group>
                  </group>
                );

              default:
                return (
                  <group>
                    <mesh castShadow={cast} geometry={trunk} material={barkMat} position={[0, 0.45, 0]} scale={[0.2, 0.95, 0.2]} />
                    <mesh ref={canopyRef as unknown as React.RefObject<THREE.Mesh>} castShadow={cast} geometry={sph} material={leavesMat} position={[0, 1.05, 0]} scale={[0.65, 0.65, 0.65]} />
                  </group>
                );
            }
          })()}
        </group>

        {fallingState && (
          <FallingTreeEffect
            type={fallingState.type}
            growthStage={fallingState.stage}
            startTime={fallingState.startTime}
            x={x}
            y={y}
            onFinish={() => setFallingState(null)}
          />
        )}
      </>
    );
  }
);
