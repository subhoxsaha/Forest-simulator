/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE } from '../../constants';
import { EcosystemType, Grid, WeatherType } from '../../types';
import { getRandomRange, WORLD_OFFSET, RIVER_MASK } from '../../utils/webgl';
import { simClock } from '../../simulation/clock';
import { sharedGeos, getPooledMaterial } from './MaterialLibrary';

// Precomputed land and river tile coordinates for ecologically authentic navigation
const LAND_COORDS: { x: number; y: number }[] = [];
const RIVER_COORDS: { x: number; y: number }[] = [];

for (let y = 0; y < GRID_SIZE; y++) {
  for (let x = 0; x < GRID_SIZE; x++) {
    if (RIVER_MASK[y][x]) {
      RIVER_COORDS.push({ x, y });
    } else {
      LAND_COORDS.push({ x, y });
    }
  }
}

// Sort river coordinates from upstream (low y) to downstream (high y) for natural aquatic patrol paths
RIVER_COORDS.sort((a, b) => a.y - b.y || a.x - b.x);

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

// --- 1. Daytime Butterflies & Riparian Dragonflies ---
export const ButterflySystem: React.FC<{ count?: number; weather?: WeatherType }> = React.memo(
  ({ count = 9, weather = 'Sunny' }) => {
    const butterflyGroupRef = useRef<THREE.Group>(null);
    const dragonflyGroupRef = useRef<THREE.Group>(null);
    const pathRadius = GRID_SIZE / 2.65;

    const butterflies = useMemo(
      () =>
        Array.from({ length: count }, (_, i) => ({
          yOff: getRandomRange(0.95, 2.9),
          speed: getRandomRange(0.38, 0.82),
          phase: i * ((Math.PI * 2) / count),
          rScale: getRandomRange(0.55, 1.25),
          wingMat: getPooledMaterial(
            'blossom',
            ['#f43f5e', '#f472b6', '#fbbf24', '#38bdf8', '#34d399', '#c084fc'][i % 6]
          ),
        })),
      [count]
    );

    const dragonflies = useMemo(
      () =>
        Array.from({ length: 4 }, (_, i) => ({
          riverIndex: Math.floor((i / 4) * Math.max(1, RIVER_COORDS.length)),
          phase: i * 1.7,
          speed: getRandomRange(0.55, 0.95),
          yBase: getRandomRange(0.28, 0.72),
        })),
      []
    );

    const bodyMat = useMemo(() => getPooledMaterial('critter', '#1e293b'), []);
    const dragonflyBodyMat = useMemo(() => getPooledMaterial('blossom', '#06b6d4'), []);
    const dragonflyWingMat = useMemo(() => getPooledMaterial('blossom', '#cffafe'), []);

    useFrame((state) => {
      const time = state.clock.getElapsedTime();
      const progress = simClock.getProgress();
      const isNight = progress > 0.75 || progress < 0.2;
      const isRaining = weather === 'Raining';
      const activeDayInsects = !isNight && !isRaining;

      if (butterflyGroupRef.current) {
        butterflyGroupRef.current.visible = activeDayInsects;
        if (activeDayInsects) {
          const children = butterflyGroupRef.current.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const b = butterflies[i];
            const theta = time * b.speed + b.phase;
            const r = pathRadius * b.rScale;
            const nx = Math.sin(theta) * r + Math.sin(time * 0.35 + i) * 1.2;
            const nz = Math.cos(theta) * r + Math.cos(time * 0.42 + i) * 1.2;
            const dx = nx - child.position.x;
            const dz = nz - child.position.z;
            child.position.set(nx, b.yOff + Math.sin(time * 3.2 + i) * 0.32, nz);
            if (dx * dx + dz * dz > 1e-6) {
              child.rotation.y = Math.atan2(dx, dz);
            }

            const leftWing = child.children[0];
            const rightWing = child.children[1];
            if (leftWing && rightWing) {
              const flap = Math.sin(time * 22 + i) * 0.82;
              leftWing.rotation.z = flap;
              rightWing.rotation.z = -flap;
            }
          }
        }
      }

      if (dragonflyGroupRef.current && RIVER_COORDS.length > 0) {
        dragonflyGroupRef.current.visible = !isRaining;
        if (!isRaining) {
          const children = dragonflyGroupRef.current.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const d = dragonflies[i];
            const sweep = (Math.sin(time * d.speed + d.phase) * 0.5 + 0.5) * (RIVER_COORDS.length - 1);
            const idx0 = Math.floor(sweep);
            const idx1 = Math.min(RIVER_COORDS.length - 1, idx0 + 1);
            const frac = sweep - idx0;
            const rx = THREE.MathUtils.lerp(RIVER_COORDS[idx0].x, RIVER_COORDS[idx1].x, frac) - WORLD_OFFSET;
            const rz = THREE.MathUtils.lerp(RIVER_COORDS[idx0].y, RIVER_COORDS[idx1].y, frac) - WORLD_OFFSET;
            const nx = rx + Math.sin(time * 2.4 + d.phase) * 0.42;
            const nz = rz + Math.cos(time * 2.0 + d.phase) * 0.32;
            const dx = nx - child.position.x;
            const dz = nz - child.position.z;
            child.position.set(nx, d.yBase + Math.sin(time * 5.2 + d.phase) * 0.08, nz);
            if (dx * dx + dz * dz > 1e-6) {
              child.rotation.y = Math.atan2(dx, dz);
            }
            const wings = child.children[1];
            if (wings) {
              wings.rotation.z = Math.sin(time * 42 + i) * 0.28;
            }
          }
        }
      }
    });

    return (
      <group raycast={() => null}>
        <group ref={butterflyGroupRef}>
          {butterflies.map((b, i) => (
            <group key={i} scale={0.13}>
              <mesh position={[-0.24, 0, 0]} scale={[0.42, 0.03, 0.42]} geometry={sharedGeos.box} material={b.wingMat} />
              <mesh position={[0.24, 0, 0]} scale={[0.42, 0.03, 0.42]} geometry={sharedGeos.box} material={b.wingMat} />
              <mesh scale={[0.1, 0.1, 0.5]} geometry={sharedGeos.box} material={bodyMat} />
            </group>
          ))}
        </group>

        <group ref={dragonflyGroupRef}>
          {dragonflies.map((_, i) => (
            <group key={i} scale={0.12}>
              <mesh scale={[0.08, 0.08, 0.72]} geometry={sharedGeos.box} material={dragonflyBodyMat} />
              <group position={[0, 0.04, 0.08]}>
                <mesh position={[0, 0, 0.08]} scale={[0.85, 0.02, 0.16]} geometry={sharedGeos.box} material={dragonflyWingMat} />
                <mesh position={[0, 0, -0.08]} scale={[0.72, 0.02, 0.14]} geometry={sharedGeos.box} material={dragonflyWingMat} />
              </group>
            </group>
          ))}
        </group>
      </group>
    );
  }
);

// --- 2. Aquatic River Life (Swimming Koi Fish & Paddling Mallard Ducks) ---
const AquaticFauna: React.FC<{ weather: WeatherType }> = React.memo(({ weather }) => {
  const koiGroupRef = useRef<THREE.Group>(null);
  const duckGroupRef = useRef<THREE.Group>(null);

  const kois = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        phase: i * 1.15,
        speed: getRandomRange(0.24, 0.42),
        lateralOffset: getRandomRange(-0.22, 0.22),
        scale: getRandomRange(0.14, 0.21),
        color: ['#f97316', '#f8fafc', '#fb923c', '#ef4444', '#facc15', '#fb7185'][i % 6],
      })),
    []
  );

  const ducks = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        phase: i * 2.1 + 0.5,
        speed: getRandomRange(0.14, 0.22),
        lateralOffset: getRandomRange(-0.18, 0.18),
        isMale: i % 2 === 0,
      })),
    []
  );

  const mats = useMemo(
    () => ({
      koiColors: ['#f97316', '#f8fafc', '#fb923c', '#ef4444', '#facc15', '#fb7185'].map((c) =>
        getPooledMaterial('blossom', c)
      ),
      duckBodyMale: getPooledMaterial('critter', '#9ca3af'),
      duckHeadMale: getPooledMaterial('leaf', '#047857'),
      duckBodyFemale: getPooledMaterial('bark', '#854d0e'),
      duckBeak: getPooledMaterial('blossom', '#f59e0b'),
      duckWing: getPooledMaterial('bark', '#475569'),
    }),
    []
  );

  useFrame((state) => {
    if (RIVER_COORDS.length < 2) return;
    const t = state.clock.getElapsedTime();
    const len = RIVER_COORDS.length - 1;

    // Animate Koi fish gliding smoothly along the riverbed
    if (koiGroupRef.current) {
      const children = koiGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const fish = children[i];
        const k = kois[i];
        const pathT = (Math.sin(t * k.speed + k.phase) * 0.5 + 0.5) * len;
        const i0 = Math.floor(pathT);
        const i1 = Math.min(len, i0 + 1);
        const f = pathT - i0;
        const wx = THREE.MathUtils.lerp(RIVER_COORDS[i0].x, RIVER_COORDS[i1].x, f) - WORLD_OFFSET + k.lateralOffset;
        const wz = THREE.MathUtils.lerp(RIVER_COORDS[i0].y, RIVER_COORDS[i1].y, f) - WORLD_OFFSET;
        const dx = wx - fish.position.x;
        const dz = wz - fish.position.z;
        fish.position.set(wx, -0.44 + Math.sin(t * 2.5 + k.phase) * 0.015, wz);
        if (dx * dx + dz * dz > 1e-7) {
          fish.rotation.y = Math.atan2(dx, dz);
        }
        const tail = fish.children[1];
        if (tail) {
          tail.rotation.y = Math.sin(t * 11 + k.phase) * 0.45;
        }
      }
    }

    // Animate Mallard Ducks paddling calmly on the water surface
    if (duckGroupRef.current) {
      const children = duckGroupRef.current.children;
      const rainBob = weather === 'Raining' ? 0.015 : 0.008;
      for (let i = 0; i < children.length; i++) {
        const duck = children[i];
        const d = ducks[i];
        const pathT = (Math.sin(t * d.speed + d.phase) * 0.5 + 0.5) * len;
        const i0 = Math.floor(pathT);
        const i1 = Math.min(len, i0 + 1);
        const f = pathT - i0;
        const wx =
          THREE.MathUtils.lerp(RIVER_COORDS[i0].x, RIVER_COORDS[i1].x, f) -
          WORLD_OFFSET +
          d.lateralOffset +
          Math.sin(t * 0.9 + d.phase) * 0.12;
        const wz = THREE.MathUtils.lerp(RIVER_COORDS[i0].y, RIVER_COORDS[i1].y, f) - WORLD_OFFSET;
        const dx = wx - duck.position.x;
        const dz = wz - duck.position.z;
        duck.position.set(wx, -0.35 + Math.sin(t * 3.4 + d.phase) * rainBob, wz);
        if (dx * dx + dz * dz > 1e-7) {
          duck.rotation.y = Math.atan2(dx, dz);
        }
        // Subtle paddling rock + periodic water dip
        duck.rotation.z = Math.sin(t * 3.8 + d.phase) * 0.06;
        const dipCycle = Math.sin(t * 0.7 + d.phase * 2.2);
        duck.rotation.x = dipCycle > 0.82 ? (dipCycle - 0.82) * 2.1 : 0;
      }
    }
  });

  return (
    <group raycast={() => null}>
      {/* Swimming Koi Fish */}
      <group ref={koiGroupRef}>
        {kois.map((k, i) => (
          <group key={`koi-${i}`} scale={k.scale}>
            <mesh scale={[0.32, 0.24, 0.88]} geometry={sharedGeos.sphere} material={mats.koiColors[i]} />
            <mesh position={[0, 0, -0.52]} scale={[0.12, 0.28, 0.42]} geometry={sharedGeos.cone} rotation={[-Math.PI / 2, 0, 0]} material={mats.koiColors[i]} />
          </group>
        ))}
      </group>

      {/* Paddling Mallard Ducks */}
      <group ref={duckGroupRef}>
        {ducks.map((d, i) => (
          <group key={`duck-${i}`} scale={0.22}>
            {/* Body */}
            <mesh position={[0, 0.12, 0]} scale={[0.42, 0.28, 0.62]} geometry={sharedGeos.sphere} material={d.isMale ? mats.duckBodyMale : mats.duckBodyFemale} />
            {/* Folded wings */}
            <mesh position={[0.18, 0.15, -0.02]} scale={[0.12, 0.16, 0.42]} geometry={sharedGeos.box} material={mats.duckWing} />
            <mesh position={[-0.18, 0.15, -0.02]} scale={[0.12, 0.16, 0.42]} geometry={sharedGeos.box} material={mats.duckWing} />
            {/* Neck & Head */}
            <mesh position={[0, 0.34, 0.24]} scale={[0.24, 0.24, 0.26]} geometry={sharedGeos.sphere} material={d.isMale ? mats.duckHeadMale : mats.duckBodyFemale} />
            {/* Beak */}
            <mesh position={[0, 0.31, 0.42]} scale={[0.14, 0.08, 0.22]} geometry={sharedGeos.box} material={mats.duckBeak} />
          </group>
        ))}
      </group>
    </group>
  );
});

// --- 3. Sky Raptors (Daytime Soaring Hawk & Moonlit Nocturnal Owl) ---
const SkyRaptors: React.FC<{ hasMatureForest: boolean }> = React.memo(({ hasMatureForest }) => {
  const hawkRef = useRef<THREE.Group>(null);
  const owlRef = useRef<THREE.Group>(null);

  const mats = useMemo(
    () => ({
      hawkBody: getPooledMaterial('bark', '#78350f'),
      hawkWing: getPooledMaterial('bark', '#92400e'),
      hawkTail: getPooledMaterial('critter', '#fef3c7'),
      owlBody: getPooledMaterial('critter', '#e2e8f0'),
      owlWing: getPooledMaterial('bark', '#64748b'),
      owlEye: getPooledMaterial('blossom', '#facc15'),
      beak: getPooledMaterial('blossom', '#f59e0b'),
    }),
    []
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const progress = simClock.getProgress();
    const isNight = progress > 0.72 || progress < 0.22;

    if (hawkRef.current) {
      hawkRef.current.visible = hasMatureForest && !isNight;
      if (hawkRef.current.visible) {
        const angle = t * 0.28;
        const r = 5.4 + Math.sin(t * 0.4) * 1.1;
        const nx = Math.cos(angle) * r;
        const nz = Math.sin(angle) * r;
        const ny = 5.2 + Math.sin(t * 0.65) * 0.45;
        const dx = nx - hawkRef.current.position.x;
        const dz = nz - hawkRef.current.position.z;
        hawkRef.current.position.set(nx, ny, nz);
        if (dx * dx + dz * dz > 1e-7) {
          hawkRef.current.rotation.y = Math.atan2(dx, dz);
        }
        // Subtle bank into the turn + occasional slow soar flap
        hawkRef.current.rotation.z = 0.18;
        const flap = Math.sin(t * 2.4) > 0.6 ? Math.sin(t * 10) * 0.22 : Math.sin(t * 1.4) * 0.05;
        if (hawkRef.current.children[2] && hawkRef.current.children[3]) {
          hawkRef.current.children[2].rotation.z = flap;
          hawkRef.current.children[3].rotation.z = -flap;
        }
      }
    }

    if (owlRef.current) {
      owlRef.current.visible = isNight;
      if (owlRef.current.visible) {
        const angle = -t * 0.34 + 1.4;
        const r = 4.2 + Math.cos(t * 0.5) * 0.9;
        const nx = Math.cos(angle) * r;
        const nz = Math.sin(angle) * r;
        const ny = 3.6 + Math.sin(t * 0.9) * 0.35;
        const dx = nx - owlRef.current.position.x;
        const dz = nz - owlRef.current.position.z;
        owlRef.current.position.set(nx, ny, nz);
        if (dx * dx + dz * dz > 1e-7) {
          owlRef.current.rotation.y = Math.atan2(dx, dz);
        }
        const flap = Math.sin(t * 6.5) * 0.38;
        if (owlRef.current.children[2] && owlRef.current.children[3]) {
          owlRef.current.children[2].rotation.z = flap;
          owlRef.current.children[3].rotation.z = -flap;
        }
      }
    }
  });

  return (
    <group raycast={() => null}>
      {/* Daytime Soaring Hawk */}
      <group ref={hawkRef} scale={0.35}>
        <mesh scale={[0.26, 0.2, 0.72]} geometry={sharedGeos.sphere} material={mats.hawkBody} />
        <mesh position={[0, 0, -0.45]} scale={[0.32, 0.04, 0.34]} geometry={sharedGeos.box} material={mats.hawkTail} />
        <group position={[0.14, 0.02, 0.04]}>
          <mesh position={[0.45, 0, 0]} scale={[0.92, 0.04, 0.34]} geometry={sharedGeos.box} material={mats.hawkWing} />
        </group>
        <group position={[-0.14, 0.02, 0.04]}>
          <mesh position={[-0.45, 0, 0]} scale={[0.92, 0.04, 0.34]} geometry={sharedGeos.box} material={mats.hawkWing} />
        </group>
        <mesh position={[0, 0, 0.42]} scale={[0.08, 0.08, 0.14]} rotation={[Math.PI / 2, 0, 0]} geometry={sharedGeos.cone} material={mats.beak} />
      </group>

      {/* Nocturnal Moonlit Owl */}
      <group ref={owlRef} scale={0.3}>
        <mesh scale={[0.32, 0.26, 0.58]} geometry={sharedGeos.sphere} material={mats.owlBody} />
        <mesh position={[0, 0.06, 0.32]} scale={[0.24, 0.22, 0.22]} geometry={sharedGeos.sphere} material={mats.owlBody} />
        <group position={[0.14, 0.02, 0]}>
          <mesh position={[0.38, 0, 0]} scale={[0.78, 0.05, 0.34]} geometry={sharedGeos.box} material={mats.owlWing} />
        </group>
        <group position={[-0.14, 0.02, 0]}>
          <mesh position={[-0.38, 0, 0]} scale={[0.78, 0.05, 0.34]} geometry={sharedGeos.box} material={mats.owlWing} />
        </group>
        <mesh position={[0.07, 0.09, 0.42]} scale={[0.05, 0.05, 0.05]} geometry={sharedGeos.sphere} material={mats.owlEye} />
        <mesh position={[-0.07, 0.09, 0.42]} scale={[0.05, 0.05, 0.05]} geometry={sharedGeos.sphere} material={mats.owlEye} />
      </group>
    </group>
  );
});

// --- 4. Woodland Ground & Canopy Fauna (Deer, Foxes, Rabbits, Squirrels, Songbirds) ---
type CritterKind = 0 | 1 | 2 | 3 | 4; // 0: Deer, 1: Rabbit, 2: Squirrel, 3: Songbird, 4: Woodland Fox

export const WildlifeSystem: React.FC<{
  population: number;
  grid?: Grid;
  weather?: WeatherType;
}> = React.memo(({ population, grid, weather = 'Sunny' }) => {
  // Always keep a lively starter wildlife presence, scaling richly as the forest flourishes
  const critterCount = Math.min(Math.max(8, 7 + Math.floor(population / 32)), 24);
  const groupRef = useRef<THREE.Group>(null);

  // Extract living tree coordinates so songbirds & squirrels gravitate naturally toward canopies
  const treeCoords = useMemo(() => {
    const coords: { x: number; y: number }[] = [];
    if (!grid) return coords;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const t = grid[y]?.[x];
        if (t && t.type !== EcosystemType.None && t.type !== EcosystemType.DeadTree && t.growthStage >= 2) {
          coords.push({ x, y });
        }
      }
    }
    return coords;
  }, [grid]);

  const critters = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const tile = LAND_COORDS[Math.floor(Math.random() * LAND_COORDS.length)] || { x: 4, y: 4 };
        // Balanced woodland distribution: Deer, Rabbit, Fox, Songbird, Squirrel
        const order: CritterKind[] = [0, 1, 4, 3, 2, 0, 3, 1, 4, 2, 0, 3, 1, 2, 4, 3, 0, 1, 2, 3, 4, 0, 1, 3];
        const variant = order[i % order.length];
        return {
          curX: tile.x + getRandomRange(-0.25, 0.25),
          curZ: tile.y + getRandomRange(-0.25, 0.25),
          tx: tile.x + getRandomRange(-0.25, 0.25),
          tz: tile.y + getRandomRange(-0.25, 0.25),
          yaw: Math.random() * Math.PI * 2,
          pauseTimer: getRandomRange(0, 2.5),
          isGoldenFinch: i % 2 === 0,
          speed:
            variant === 3
              ? getRandomRange(1.25, 1.85)
              : variant === 4
              ? getRandomRange(0.85, 1.3)
              : variant === 2
              ? getRandomRange(0.75, 1.25)
              : variant === 1
              ? getRandomRange(0.55, 0.95)
              : getRandomRange(0.38, 0.72),
          variant,
          scale:
            variant === 0
              ? getRandomRange(0.24, 0.31)
              : variant === 4
              ? getRandomRange(0.22, 0.27)
              : variant === 1
              ? getRandomRange(0.19, 0.24)
              : variant === 2
              ? getRandomRange(0.16, 0.21)
              : getRandomRange(0.16, 0.22),
        };
      }),
    []
  );

  const mats = useMemo(
    () => ({
      deer: getPooledMaterial('critter', '#b45309'),
      deerBelly: getPooledMaterial('critter', '#fde68a'),
      antler: getPooledMaterial('bark', '#78350f'),
      hoof: getPooledMaterial('bark', '#3f2305'),
      foxCoat: getPooledMaterial('blossom', '#ea580c'),
      foxCream: getPooledMaterial('critter', '#fff7ed'),
      foxDark: getPooledMaterial('critter', '#1e293b'),
      rabbit: getPooledMaterial('critter', '#f8fafc'),
      ear: getPooledMaterial('blossom', '#fca5a5'),
      squirrel: getPooledMaterial('critter', '#d97706'),
      squirrelTail: getPooledMaterial('critter', '#92400e'),
      birdBlue: getPooledMaterial('critter', '#3b82f6'),
      birdGold: getPooledMaterial('blossom', '#facc15'),
      birdHead: getPooledMaterial('critter', '#ffffff'),
      beak: getPooledMaterial('critter', '#ea580c'),
      wingBlue: getPooledMaterial('critter', '#1e40af'),
      wingGold: getPooledMaterial('bark', '#a16207'),
    }),
    []
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const time = state.clock.getElapsedTime();
    const progress = simClock.getProgress();
    const isNight = progress > 0.76 || progress < 0.18;
    const children = groupRef.current.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (i >= critterCount) {
        child.visible = false;
        continue;
      }
      // Songbirds tuck into roosts at night
      const c = critters[i];
      if (c.variant === 3 && isNight) {
        child.visible = false;
        continue;
      }
      child.visible = true;

      let moving = true;
      if (c.pauseTimer > 0) {
        c.pauseTimer -= dt;
        moving = false;
      } else {
        const dx = c.tx - c.curX;
        const dz = c.tz - c.curZ;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.14 || Math.random() < 0.003) {
          // Pause briefly to graze/perch/sniff before picking a new natural destination
          c.pauseTimer = c.variant === 0 ? getRandomRange(1.4, 3.6) : c.variant === 3 ? getRandomRange(0.8, 2.2) : getRandomRange(0.4, 1.8);
          const preferTree = (c.variant === 2 || c.variant === 3) && treeCoords.length > 0 && Math.random() < 0.72;
          const pool = preferTree ? treeCoords : LAND_COORDS;
          const nextTile = pool[Math.floor(Math.random() * pool.length)];
          if (nextTile) {
            c.tx = nextTile.x + getRandomRange(-0.32, 0.32);
            c.tz = nextTile.y + getRandomRange(-0.32, 0.32);
          }
          moving = false;
        } else {
          const speedMult = isNight && c.variant !== 4 ? 0.55 : 1.0; // Foxes remain spry at night!
          c.curX += (dx / dist) * c.speed * speedMult * dt;
          c.curZ += (dz / dist) * c.speed * speedMult * dt;
          const targetYaw = -Math.atan2(dz, dx);
          c.yaw = dampAngle(c.yaw, targetYaw, 7.5, dt);
        }
      }

      let yOffset = -0.29;
      if (c.variant === 1) {
        yOffset += moving ? Math.abs(Math.sin(time * 7.5 + i)) * 0.14 : 0;
      } else if (c.variant === 2) {
        yOffset += moving ? Math.abs(Math.cos(time * 11 + i)) * 0.05 : 0;
      } else if (c.variant === 3) {
        yOffset += moving ? 0.55 + Math.abs(Math.sin(time * 4.5 + i)) * 0.35 : 0.42;
      } else if (c.variant === 4) {
        yOffset += moving ? Math.abs(Math.sin(time * 9.5 + i)) * 0.035 : 0;
      }

      child.position.set(c.curX - WORLD_OFFSET, yOffset, c.curZ - WORLD_OFFSET);
      child.rotation.y = c.yaw;

      // Per-species secondary motion (grazing head dip, wing flap, tail wag)
      const bodyGroup = child.children[0];
      if (!bodyGroup) continue;

      if (c.variant === 0) {
        // Deer grazing nod when paused, gentle stride rock when walking
        bodyGroup.rotation.z = moving ? Math.sin(time * 7 + i) * 0.04 : -0.18 - Math.sin(time * 2.2 + i) * 0.06;
      } else if (c.variant === 4) {
        // Fox tail swish
        const tail = bodyGroup.children[4];
        if (tail) tail.rotation.y = Math.sin(time * (moving ? 9 : 3.5) + i) * 0.25;
      } else if (c.variant === 3 && bodyGroup.children.length >= 5) {
        const flap = moving ? Math.sin(time * 20 + i) * 0.88 : 0.1;
        bodyGroup.children[3].rotation.x = flap;
        bodyGroup.children[4].rotation.x = -flap;
      }
    }
  });

  return (
    <group raycast={() => null}>
      {/* Land & Canopy Wildlife */}
      <group ref={groupRef}>
        {critters.map((c, i) => (
          <group key={i} scale={c.scale}>
            {c.variant === 0 ? (
              /* Forest Deer with Antlers */
              <group>
                <mesh position={[0, 0.24, 0]} scale={[0.46, 0.24, 0.22]} geometry={sharedGeos.box} material={mats.deer} />
                <mesh position={[0, 0.16, 0]} scale={[0.38, 0.08, 0.18]} geometry={sharedGeos.box} material={mats.deerBelly} />
                <mesh position={[0.18, 0.44, 0]} scale={[0.14, 0.26, 0.14]} rotation={[0, 0, -0.18]} geometry={sharedGeos.box} material={mats.deer} />
                <mesh position={[0.26, 0.56, 0]} scale={[0.22, 0.15, 0.14]} geometry={sharedGeos.box} material={mats.deer} />
                <mesh position={[0.22, 0.68, 0.06]} scale={[0.035, 0.18, 0.035]} rotation={[0.25, 0, 0.15]} geometry={sharedGeos.cylinder} material={mats.antler} />
                <mesh position={[0.22, 0.68, -0.06]} scale={[0.035, 0.18, 0.035]} rotation={[-0.25, 0, 0.15]} geometry={sharedGeos.cylinder} material={mats.antler} />
                <mesh position={[-0.14, 0.09, 0.07]} scale={[0.05, 0.2, 0.05]} geometry={sharedGeos.cylinder} material={mats.hoof} />
                <mesh position={[-0.14, 0.09, -0.07]} scale={[0.05, 0.2, 0.05]} geometry={sharedGeos.cylinder} material={mats.hoof} />
                <mesh position={[0.14, 0.09, 0.07]} scale={[0.05, 0.2, 0.05]} geometry={sharedGeos.cylinder} material={mats.hoof} />
                <mesh position={[0.14, 0.09, -0.07]} scale={[0.05, 0.2, 0.05]} geometry={sharedGeos.cylinder} material={mats.hoof} />
              </group>
            ) : c.variant === 4 ? (
              /* Woodland Fox with White-Tipped Bushy Tail */
              <group>
                <mesh position={[0, 0.18, 0]} scale={[0.42, 0.2, 0.18]} geometry={sharedGeos.box} material={mats.foxCoat} />
                <mesh position={[0.24, 0.28, 0]} scale={[0.2, 0.16, 0.16]} geometry={sharedGeos.box} material={mats.foxCoat} />
                <mesh position={[0.35, 0.25, 0]} scale={[0.12, 0.08, 0.1]} geometry={sharedGeos.box} material={mats.foxCream} />
                <mesh position={[0.22, 0.39, 0.06]} scale={[0.05, 0.1, 0.05]} geometry={sharedGeos.cone} material={mats.foxDark} />
                <group position={[-0.22, 0.2, 0]}>
                  <mesh position={[-0.14, 0.04, 0]} scale={[0.34, 0.12, 0.12]} rotation={[0, 0, 0.25]} geometry={sharedGeos.sphere} material={mats.foxCoat} />
                  <mesh position={[-0.28, 0.08, 0]} scale={[0.12, 0.1, 0.1]} geometry={sharedGeos.sphere} material={mats.foxCream} />
                </group>
                <mesh position={[0.22, 0.39, -0.06]} scale={[0.05, 0.1, 0.05]} geometry={sharedGeos.cone} material={mats.foxDark} />
                <mesh position={[-0.12, 0.06, 0.06]} scale={[0.045, 0.14, 0.045]} geometry={sharedGeos.cylinder} material={mats.foxDark} />
                <mesh position={[-0.12, 0.06, -0.06]} scale={[0.045, 0.14, 0.045]} geometry={sharedGeos.cylinder} material={mats.foxDark} />
                <mesh position={[0.12, 0.06, 0.06]} scale={[0.045, 0.14, 0.045]} geometry={sharedGeos.cylinder} material={mats.foxDark} />
                <mesh position={[0.12, 0.06, -0.06]} scale={[0.045, 0.14, 0.045]} geometry={sharedGeos.cylinder} material={mats.foxDark} />
              </group>
            ) : c.variant === 1 ? (
              /* Cottontail Rabbit */
              <group>
                <mesh position={[0, 0.15, 0]} scale={[0.28, 0.24, 0.24]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[-0.15, 0.14, 0]} scale={[0.1, 0.1, 0.1]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[0.15, 0.24, 0]} scale={[0.15, 0.15, 0.15]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[0.12, 0.38, 0.045]} scale={[0.04, 0.18, 0.04]} rotation={[0, 0, -0.1]} geometry={sharedGeos.cylinder} material={mats.ear} />
                <mesh position={[0.12, 0.38, -0.045]} scale={[0.04, 0.18, 0.04]} rotation={[0, 0, -0.1]} geometry={sharedGeos.cylinder} material={mats.ear} />
              </group>
            ) : c.variant === 2 ? (
              /* Red Squirrel */
              <group>
                <mesh position={[0, 0.12, 0]} scale={[0.3, 0.18, 0.18]} geometry={sharedGeos.box} material={mats.squirrel} />
                <mesh position={[0.16, 0.24, 0]} scale={[0.14, 0.14, 0.14]} geometry={sharedGeos.sphere} material={mats.squirrel} />
                <mesh position={[-0.15, 0.26, 0]} scale={[0.11, 0.3, 0.12]} rotation={[0.4, 0, 0]} geometry={sharedGeos.box} material={mats.squirrelTail} />
                <mesh position={[0.15, 0.34, 0.04]} scale={[0.03, 0.08, 0.03]} geometry={sharedGeos.box} material={mats.ear} />
                <mesh position={[0.15, 0.34, -0.04]} scale={[0.03, 0.08, 0.03]} geometry={sharedGeos.box} material={mats.ear} />
              </group>
            ) : (
              /* Canopy Songbird (Blue Jay or Golden Finch) */
              <group>
                <mesh
                  position={[0, 0.15, 0]}
                  scale={[0.24, 0.18, 0.2]}
                  geometry={sharedGeos.sphere}
                  material={c.isGoldenFinch ? mats.birdGold : mats.birdBlue}
                />
                <mesh position={[0.14, 0.24, 0]} scale={[0.13, 0.13, 0.13]} geometry={sharedGeos.sphere} material={mats.birdHead} />
                <mesh position={[0.23, 0.24, 0]} scale={[0.06, 0.06, 0.1]} rotation={[0, Math.PI / 2, 0]} geometry={sharedGeos.cone} material={mats.beak} />
                <group position={[0, 0.15, 0.12]}>
                  <mesh
                    scale={[0.18, 0.025, 0.16]}
                    position={[0, 0, 0.08]}
                    geometry={sharedGeos.box}
                    material={c.isGoldenFinch ? mats.wingGold : mats.wingBlue}
                  />
                </group>
                <group position={[0, 0.15, -0.12]}>
                  <mesh
                    scale={[0.18, 0.025, 0.16]}
                    position={[0, 0, -0.08]}
                    geometry={sharedGeos.box}
                    material={c.isGoldenFinch ? mats.wingGold : mats.wingBlue}
                  />
                </group>
              </group>
            )}
          </group>
        ))}
      </group>

      {/* River Koi & Mallard Ducks */}
      <AquaticFauna weather={weather} />

      {/* Daytime Soaring Hawk & Moonlit Owl */}
      <SkyRaptors hasMatureForest={treeCoords.length >= 4 || population >= 120} />
    </group>
  );
});
