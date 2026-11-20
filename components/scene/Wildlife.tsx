/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE } from '../../constants';
import { EcosystemType, Grid, WeatherType } from '../../types';
import { getRandomRange, WORLD_OFFSET, RIVER_MASK } from '../../utils/webgl';
import { simClock } from '../../simulation/clock';
import { wildlifeTracker, WildlifeSpeciesId } from '../../simulation/wildlifeTracker';
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

RIVER_COORDS.sort((a, b) => a.y - b.y || a.x - b.x);

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function clampGridCoord(v: number): number {
  return Math.max(0.25, Math.min(GRID_SIZE - 1.25, v));
}

function isRiverGridPos(gx: number, gz: number): boolean {
  const ix = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(gx)));
  const iy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(gz)));
  return RIVER_MASK[iy][ix];
}

// --- Subtle Glowing Ring Under Currently Tracked / Controlled Creature ---
const TrackedAnimalBeacon: React.FC = React.memo(() => {
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    if (!ringRef.current || !matRef.current) return;
    const dt = Math.min(delta, 0.05);
    const tracked = wildlifeTracker.getAnimal(wildlifeTracker.trackedAnimalId);

    if (!tracked) {
      ringRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    const isControlled = wildlifeTracker.controlledAnimalId === tracked.id;
    const t = state.clock.getElapsedTime();
    const pulse = 0.72 + Math.sin(t * 4.2) * 0.08;

    ringRef.current.position.x = THREE.MathUtils.damp(ringRef.current.position.x, tracked.pos.x, 12, dt);
    ringRef.current.position.y = THREE.MathUtils.damp(
      ringRef.current.position.y,
      Math.max(-0.26, tracked.pos.y - 0.01),
      12,
      dt
    );
    ringRef.current.position.z = THREE.MathUtils.damp(ringRef.current.position.z, tracked.pos.z, 12, dt);
    ringRef.current.scale.set(pulse, pulse, 1);

    matRef.current.color.set(isControlled ? '#fbbf24' : '#34d399');
    matRef.current.opacity = isControlled ? 0.9 : 0.72;
  });

  return (
    <mesh
      ref={ringRef}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={sharedGeos.ring}
      visible={false}
      raycast={() => null}
    >
      <meshBasicMaterial ref={matRef} color="#34d399" transparent opacity={0.75} depthWrite={false} />
    </mesh>
  );
});

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
      const sw = simClock.getSeasonWeights();
      const isNight = progress > 0.75 || progress < 0.2;
      const isRaining = weather === 'Raining';
      const isWinterFreeze = sw.winter > 0.45;
      const activeDayInsects = !isNight && !isRaining && !isWinterFreeze;

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
        dragonflyGroupRef.current.visible = !isRaining && !isWinterFreeze;
        if (dragonflyGroupRef.current.visible) {
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
      Array.from({ length: 6 }, (_, i) => {
        const start = RIVER_COORDS[(i * 5) % Math.max(1, RIVER_COORDS.length)] || { x: 7, y: 7 };
        return {
          id: `koi-${i}`,
          phase: i * 1.15,
          speed: getRandomRange(0.24, 0.42),
          lateralOffset: getRandomRange(-0.22, 0.22),
          scale: getRandomRange(0.14, 0.21),
          gx: start.x,
          gz: start.y,
          yaw: 0,
        };
      }),
    []
  );

  const ducks = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => {
        const start = RIVER_COORDS[(i * 9 + 3) % Math.max(1, RIVER_COORDS.length)] || { x: 7, y: 7 };
        return {
          id: `duck-${i}`,
          phase: i * 2.1 + 0.5,
          speed: getRandomRange(0.14, 0.22),
          lateralOffset: getRandomRange(-0.18, 0.18),
          isMale: i % 2 === 0,
          gx: start.x,
          gz: start.y,
          yaw: 0,
        };
      }),
    []
  );

  useEffect(() => {
    return () => {
      kois.forEach((k) => wildlifeTracker.remove(k.id));
      ducks.forEach((d) => wildlifeTracker.remove(d.id));
    };
  }, [kois, ducks]);

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

  useFrame((state, delta) => {
    if (RIVER_COORDS.length < 2) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const sw = simClock.getSeasonWeights();
    const winterPace = 1 - sw.winter * 0.45;
    const len = RIVER_COORDS.length - 1;

    // Animate Koi fish
    if (koiGroupRef.current) {
      const children = koiGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const fish = children[i];
        const k = kois[i];
        const isControlled = wildlifeTracker.controlledAnimalId === k.id;

        let wx: number;
        let wz: number;
        let activity = sw.winter > 0.5 ? 'Gliding in chilled stream' : 'Swimming along current';

        if (isControlled) {
          const { mx, mz, moving } = wildlifeTracker.getMoveVector();
          const spd = wildlifeTracker.input.boost ? 2.6 : 1.55;
          if (moving) {
            const nextX = clampGridCoord(k.gx + mx * spd * dt);
            const nextZ = clampGridCoord(k.gz + mz * spd * dt);
            if (isRiverGridPos(nextX, nextZ)) {
              k.gx = nextX;
              k.gz = nextZ;
            } else if (isRiverGridPos(nextX, k.gz)) {
              k.gx = nextX;
            } else if (isRiverGridPos(k.gx, nextZ)) {
              k.gz = nextZ;
            }
            k.yaw = dampAngle(k.yaw, Math.atan2(mx, mz), 10, dt);
            activity = 'Swimming under your guidance';
          } else {
            activity = 'Hovering in stream (WASD to swim)';
          }
          wx = k.gx - WORLD_OFFSET;
          wz = k.gz - WORLD_OFFSET;
        } else {
          const pathT = (Math.sin(t * k.speed * winterPace + k.phase) * 0.5 + 0.5) * len;
          const i0 = Math.floor(pathT);
          const i1 = Math.min(len, i0 + 1);
          const f = pathT - i0;
          k.gx = THREE.MathUtils.lerp(RIVER_COORDS[i0].x, RIVER_COORDS[i1].x, f) + k.lateralOffset;
          k.gz = THREE.MathUtils.lerp(RIVER_COORDS[i0].y, RIVER_COORDS[i1].y, f);
          wx = k.gx - WORLD_OFFSET;
          wz = k.gz - WORLD_OFFSET;
          const dx = wx - fish.position.x;
          const dz = wz - fish.position.z;
          if (dx * dx + dz * dz > 1e-7) {
            k.yaw = Math.atan2(dx, dz);
          }
        }

        const wy = -0.44 + Math.sin(t * 2.5 + k.phase) * 0.015;
        fish.position.set(wx, wy, wz);
        fish.rotation.y = k.yaw;

        const tail = fish.children[1];
        if (tail) {
          tail.rotation.y = Math.sin(t * (isControlled ? 16 : 11) + k.phase) * 0.48;
        }

        wildlifeTracker.upsert(k.id, 'koi', wx, wy + 0.14, wz, k.yaw, true, activity, true);
      }
    }

    // Animate Mallard Ducks
    if (duckGroupRef.current) {
      const children = duckGroupRef.current.children;
      const rainBob = weather === 'Raining' ? 0.015 : 0.008;
      for (let i = 0; i < children.length; i++) {
        const duck = children[i];
        const d = ducks[i];
        const isControlled = wildlifeTracker.controlledAnimalId === d.id;

        let wx: number;
        let wz: number;
        let activity = 'Paddling along river';

        if (isControlled) {
          const { mx, mz, moving } = wildlifeTracker.getMoveVector();
          const spd = wildlifeTracker.input.boost ? 2.4 : 1.45;
          if (moving) {
            d.gx = clampGridCoord(d.gx + mx * spd * dt);
            d.gz = clampGridCoord(d.gz + mz * spd * dt);
            d.yaw = dampAngle(d.yaw, Math.atan2(mx, mz), 9, dt);
            activity = isRiverGridPos(d.gx, d.gz) ? 'Paddling under your guidance' : 'Waddling along the shore';
          } else {
            activity = 'Floating calmly (WASD to steer)';
          }
          wx = d.gx - WORLD_OFFSET;
          wz = d.gz - WORLD_OFFSET;
        } else {
          const pathT = (Math.sin(t * d.speed + d.phase) * 0.5 + 0.5) * len;
          const i0 = Math.floor(pathT);
          const i1 = Math.min(len, i0 + 1);
          const f = pathT - i0;
          d.gx =
            THREE.MathUtils.lerp(RIVER_COORDS[i0].x, RIVER_COORDS[i1].x, f) +
            d.lateralOffset +
            Math.sin(t * 0.9 + d.phase) * 0.12;
          d.gz = THREE.MathUtils.lerp(RIVER_COORDS[i0].y, RIVER_COORDS[i1].y, f);
          wx = d.gx - WORLD_OFFSET;
          wz = d.gz - WORLD_OFFSET;
          const dx = wx - duck.position.x;
          const dz = wz - duck.position.z;
          if (dx * dx + dz * dz > 1e-7) {
            d.yaw = Math.atan2(dx, dz);
          }
        }

        const inWater = isRiverGridPos(d.gx, d.gz);
        const wy = (inWater ? -0.35 : -0.28) + Math.sin(t * 3.4 + d.phase) * rainBob;
        duck.position.set(wx, wy, wz);
        duck.rotation.y = d.yaw;
        duck.rotation.z = Math.sin(t * 3.8 + d.phase) * 0.06;
        const dipCycle = Math.sin(t * 0.7 + d.phase * 2.2);
        duck.rotation.x = !isControlled && inWater && dipCycle > 0.82 ? (dipCycle - 0.82) * 2.1 : 0;

        wildlifeTracker.upsert(d.id, 'duck', wx, wy + 0.08, wz, d.yaw, true, activity, true);
      }
    }
  });

  return (
    <group raycast={() => null}>
      <group ref={koiGroupRef}>
        {kois.map((k, i) => (
          <group key={k.id} scale={k.scale}>
            <mesh scale={[0.32, 0.24, 0.88]} geometry={sharedGeos.sphere} material={mats.koiColors[i]} />
            <mesh position={[0, 0, -0.52]} scale={[0.12, 0.28, 0.42]} geometry={sharedGeos.cone} rotation={[-Math.PI / 2, 0, 0]} material={mats.koiColors[i]} />
          </group>
        ))}
      </group>

      <group ref={duckGroupRef}>
        {ducks.map((d) => (
          <group key={d.id} scale={0.22}>
            <mesh position={[0, 0.12, 0]} scale={[0.42, 0.28, 0.62]} geometry={sharedGeos.sphere} material={d.isMale ? mats.duckBodyMale : mats.duckBodyFemale} />
            <mesh position={[0.18, 0.15, -0.02]} scale={[0.12, 0.16, 0.42]} geometry={sharedGeos.box} material={mats.duckWing} />
            <mesh position={[-0.18, 0.15, -0.02]} scale={[0.12, 0.16, 0.42]} geometry={sharedGeos.box} material={mats.duckWing} />
            <mesh position={[0, 0.34, 0.24]} scale={[0.24, 0.24, 0.26]} geometry={sharedGeos.sphere} material={d.isMale ? mats.duckHeadMale : mats.duckBodyFemale} />
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
  const hawkState = useRef({ x: 4, y: 5.0, z: 0, yaw: 0 });
  const owlState = useRef({ x: -3, y: 3.6, z: 2, yaw: 0 });

  useEffect(() => {
    return () => {
      wildlifeTracker.remove('hawk-0');
      wildlifeTracker.remove('owl-0');
    };
  }, []);

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

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const progress = simClock.getProgress();
    const isNight = progress > 0.72 || progress < 0.22;

    if (hawkRef.current) {
      const visible = hasMatureForest && !isNight;
      hawkRef.current.visible = visible;
      const isControlled = wildlifeTracker.controlledAnimalId === 'hawk-0';

      if (visible) {
        const hs = hawkState.current;
        let activity = 'Soaring on warm thermals';

        if (isControlled) {
          const { mx, mz, moving } = wildlifeTracker.getMoveVector();
          const spd = wildlifeTracker.input.boost ? 5.2 : 3.2;
          if (moving) {
            hs.x = Math.max(-7.2, Math.min(7.2, hs.x + mx * spd * dt));
            hs.z = Math.max(-7.2, Math.min(7.2, hs.z + mz * spd * dt));
            hs.yaw = dampAngle(hs.yaw, Math.atan2(mx, mz), 8, dt);
            activity = 'Soaring under your guidance';
          } else {
            activity = 'Hovering aloft (WASD to fly)';
          }
          hs.y = 4.2 + Math.sin(t * 2.2) * 0.25;
        } else {
          const angle = t * 0.28;
          const r = 5.4 + Math.sin(t * 0.4) * 1.1;
          const nx = Math.cos(angle) * r;
          const nz = Math.sin(angle) * r;
          const dx = nx - hs.x;
          const dz = nz - hs.z;
          hs.x = nx;
          hs.z = nz;
          hs.y = 5.0 + Math.sin(t * 0.65) * 0.4;
          if (dx * dx + dz * dz > 1e-7) {
            hs.yaw = Math.atan2(dx, dz);
          }
        }

        hawkRef.current.position.set(hs.x, hs.y, hs.z);
        hawkRef.current.rotation.y = hs.yaw;
        hawkRef.current.rotation.z = isControlled ? 0.06 : 0.18;
        const flap = isControlled
          ? Math.sin(t * 9) * 0.26
          : Math.sin(t * 2.4) > 0.6
          ? Math.sin(t * 10) * 0.22
          : Math.sin(t * 1.4) * 0.05;
        if (hawkRef.current.children[2] && hawkRef.current.children[3]) {
          hawkRef.current.children[2].rotation.z = flap;
          hawkRef.current.children[3].rotation.z = -flap;
        }
        wildlifeTracker.upsert('hawk-0', 'hawk', hs.x, hs.y, hs.z, hs.yaw, true, activity, true);
      } else {
        wildlifeTracker.upsert('hawk-0', 'hawk', 0, 5, 0, 0, false, 'Roosting', true);
      }
    }

    if (owlRef.current) {
      const visible = isNight;
      owlRef.current.visible = visible;
      const isControlled = wildlifeTracker.controlledAnimalId === 'owl-0';

      if (visible) {
        const os = owlState.current;
        let activity = 'Patrolling moonlit canopy';

        if (isControlled) {
          const { mx, mz, moving } = wildlifeTracker.getMoveVector();
          const spd = wildlifeTracker.input.boost ? 4.8 : 2.9;
          if (moving) {
            os.x = Math.max(-7.2, Math.min(7.2, os.x + mx * spd * dt));
            os.z = Math.max(-7.2, Math.min(7.2, os.z + mz * spd * dt));
            os.yaw = dampAngle(os.yaw, Math.atan2(mx, mz), 8, dt);
            activity = 'Gliding under your guidance';
          } else {
            activity = 'Hovering quietly (WASD to fly)';
          }
          os.y = 3.5 + Math.sin(t * 2.4) * 0.2;
        } else {
          const angle = -t * 0.34 + 1.4;
          const r = 4.2 + Math.cos(t * 0.5) * 0.9;
          const nx = Math.cos(angle) * r;
          const nz = Math.sin(angle) * r;
          const dx = nx - os.x;
          const dz = nz - os.z;
          os.x = nx;
          os.z = nz;
          os.y = 3.6 + Math.sin(t * 0.9) * 0.35;
          if (dx * dx + dz * dz > 1e-7) {
            os.yaw = Math.atan2(dx, dz);
          }
        }

        owlRef.current.position.set(os.x, os.y, os.z);
        owlRef.current.rotation.y = os.yaw;
        const flap = Math.sin(t * 6.5) * 0.38;
        if (owlRef.current.children[2] && owlRef.current.children[3]) {
          owlRef.current.children[2].rotation.z = flap;
          owlRef.current.children[3].rotation.z = -flap;
        }
        wildlifeTracker.upsert('owl-0', 'owl', os.x, os.y, os.z, os.yaw, true, activity, true);
      } else {
        wildlifeTracker.upsert('owl-0', 'owl', 0, 3.6, 0, 0, false, 'Sleeping in hollow', true);
      }
    }
  });

  return (
    <group raycast={() => null}>
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

const KIND_TO_SPECIES: Record<CritterKind, WildlifeSpeciesId> = {
  0: 'deer',
  1: 'rabbit',
  2: 'squirrel',
  3: 'songbird',
  4: 'fox',
};

export const WildlifeSystem: React.FC<{
  population: number;
  grid?: Grid;
  weather?: WeatherType;
}> = React.memo(({ population, grid, weather = 'Sunny' }) => {
  const critterCount = Math.min(Math.max(8, 7 + Math.floor(population / 32)), 24);
  const groupRef = useRef<THREE.Group>(null);

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
        const order: CritterKind[] = [0, 1, 4, 3, 2, 0, 3, 1, 4, 2, 0, 3, 1, 2, 4, 3, 0, 1, 2, 3, 4, 0, 1, 3];
        const variant = order[i % order.length];
        const speciesId = KIND_TO_SPECIES[variant];
        return {
          id: `${speciesId}-${i}`,
          speciesId,
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

  useEffect(() => {
    return () => {
      critters.forEach((c) => wildlifeTracker.remove(c.id));
    };
  }, [critters]);

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
      const c = critters[i];

      if (i >= critterCount || (c.variant === 3 && isNight)) {
        child.visible = false;
        wildlifeTracker.upsert(c.id, c.speciesId, c.curX - WORLD_OFFSET, -0.29, c.curZ - WORLD_OFFSET, c.yaw, false, 'Resting', true);
        continue;
      }
      child.visible = true;

      const isControlled = wildlifeTracker.controlledAnimalId === c.id;
      let moving = true;
      let activity = '';

      if (isControlled) {
        const { mx, mz, moving: inputMoving } = wildlifeTracker.getMoveVector();
        moving = inputMoving;
        const boostMult = wildlifeTracker.input.boost ? 1.85 : 1.0;
        const controlSpeed =
          (c.variant === 3 ? 2.6 : c.variant === 4 ? 2.1 : c.variant === 2 ? 2.0 : c.variant === 1 ? 1.85 : 1.6) *
          boostMult;

        if (inputMoving) {
          const nextX = clampGridCoord(c.curX + mx * controlSpeed * dt);
          const nextZ = clampGridCoord(c.curZ + mz * controlSpeed * dt);
          // Songbirds fly smoothly over the river; land mammals stay cleanly on dry land
          if (c.variant === 3 || !isRiverGridPos(nextX, nextZ)) {
            c.curX = nextX;
            c.curZ = nextZ;
          } else if (!isRiverGridPos(nextX, c.curZ)) {
            c.curX = nextX;
          } else if (!isRiverGridPos(c.curX, nextZ)) {
            c.curZ = nextZ;
          }
          // Notice land/bird meshes face +X in local coordinates, so yaw = -atan2(dz, dx)
          const targetYaw = -Math.atan2(mz, mx);
          c.yaw = dampAngle(c.yaw, targetYaw, 11, dt);
          activity = wildlifeTracker.input.boost ? 'Sprinting under your guidance' : 'Exploring under your guidance';
        } else {
          activity = 'Awaiting your move (WASD / Arrows)';
        }
      } else if (c.pauseTimer > 0) {
        c.pauseTimer -= dt;
        moving = false;
        activity =
          c.variant === 0
            ? 'Grazing peacefully in glade'
            : c.variant === 4
            ? 'Listening for forest rustles'
            : c.variant === 3
            ? 'Perched in canopy singing'
            : c.variant === 2
            ? 'Caching acorns near roots'
            : 'Nibbling meadow clover';
      } else {
        const dx = c.tx - c.curX;
        const dz = c.tz - c.curZ;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.14 || Math.random() < 0.003) {
          c.pauseTimer =
            c.variant === 0
              ? getRandomRange(1.4, 3.6)
              : c.variant === 3
              ? getRandomRange(0.8, 2.2)
              : getRandomRange(0.4, 1.8);
          const preferTree = (c.variant === 2 || c.variant === 3) && treeCoords.length > 0 && Math.random() < 0.72;
          const pool = preferTree ? treeCoords : LAND_COORDS;
          const nextTile = pool[Math.floor(Math.random() * pool.length)];
          if (nextTile) {
            c.tx = nextTile.x + getRandomRange(-0.32, 0.32);
            c.tz = nextTile.y + getRandomRange(-0.32, 0.32);
          }
          moving = false;
        } else {
          const speedMult = isNight && c.variant !== 4 ? 0.55 : 1.0;
          c.curX += (dx / dist) * c.speed * speedMult * dt;
          c.curZ += (dz / dist) * c.speed * speedMult * dt;
          const targetYaw = -Math.atan2(dz, dx);
          c.yaw = dampAngle(c.yaw, targetYaw, 7.5, dt);
        }

        activity =
          c.variant === 0
            ? 'Wandering woodland trail'
            : c.variant === 4
            ? 'Trotting through clearings'
            : c.variant === 3
            ? 'Flitting between treetops'
            : c.variant === 2
            ? 'Scampering across roots'
            : 'Hopping across meadow';
      }

      let yOffset = -0.29;
      if (c.variant === 1) {
        yOffset += moving ? Math.abs(Math.sin(time * (isControlled ? 11 : 7.5) + i)) * 0.14 : 0;
      } else if (c.variant === 2) {
        yOffset += moving ? Math.abs(Math.cos(time * 11 + i)) * 0.05 : 0;
      } else if (c.variant === 3) {
        yOffset += moving ? 0.55 + Math.abs(Math.sin(time * 4.5 + i)) * 0.35 : 0.42;
      } else if (c.variant === 4) {
        yOffset += moving ? Math.abs(Math.sin(time * (isControlled ? 12 : 9.5) + i)) * 0.038 : 0;
      }

      const wx = c.curX - WORLD_OFFSET;
      const wz = c.curZ - WORLD_OFFSET;
      child.position.set(wx, yOffset, wz);
      child.rotation.y = c.yaw;

      wildlifeTracker.upsert(c.id, c.speciesId, wx, yOffset + 0.14, wz, c.yaw, true, activity, true);

      const bodyGroup = child.children[0];
      if (!bodyGroup) continue;

      if (c.variant === 0) {
        bodyGroup.rotation.z = moving
          ? Math.sin(time * (isControlled ? 10 : 7) + i) * 0.045
          : isControlled
          ? 0
          : -0.18 - Math.sin(time * 2.2 + i) * 0.06;
      } else if (c.variant === 4) {
        const tail = bodyGroup.children[4];
        if (tail) tail.rotation.y = Math.sin(time * (moving ? 10 : 3.5) + i) * 0.26;
      } else if (c.variant === 3 && bodyGroup.children.length >= 5) {
        const flap = moving ? Math.sin(time * 20 + i) * 0.88 : 0.1;
        bodyGroup.children[3].rotation.x = flap;
        bodyGroup.children[4].rotation.x = -flap;
      }
    }
  });

  return (
    <group raycast={() => null}>
      <TrackedAnimalBeacon />

      <group ref={groupRef}>
        {critters.map((c) => (
          <group key={c.id} scale={c.scale}>
            {c.variant === 0 ? (
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
              <group>
                <mesh position={[0, 0.15, 0]} scale={[0.28, 0.24, 0.24]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[-0.15, 0.14, 0]} scale={[0.1, 0.1, 0.1]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[0.15, 0.24, 0]} scale={[0.15, 0.15, 0.15]} geometry={sharedGeos.sphere} material={mats.rabbit} />
                <mesh position={[0.12, 0.38, 0.045]} scale={[0.04, 0.18, 0.04]} rotation={[0, 0, -0.1]} geometry={sharedGeos.cylinder} material={mats.ear} />
                <mesh position={[0.12, 0.38, -0.045]} scale={[0.04, 0.18, 0.04]} rotation={[0, 0, -0.1]} geometry={sharedGeos.cylinder} material={mats.ear} />
              </group>
            ) : c.variant === 2 ? (
              <group>
                <mesh position={[0, 0.12, 0]} scale={[0.3, 0.18, 0.18]} geometry={sharedGeos.box} material={mats.squirrel} />
                <mesh position={[0.16, 0.24, 0]} scale={[0.14, 0.14, 0.14]} geometry={sharedGeos.sphere} material={mats.squirrel} />
                <mesh position={[-0.15, 0.26, 0]} scale={[0.11, 0.3, 0.12]} rotation={[0.4, 0, 0]} geometry={sharedGeos.box} material={mats.squirrelTail} />
                <mesh position={[0.15, 0.34, 0.04]} scale={[0.03, 0.08, 0.03]} geometry={sharedGeos.box} material={mats.ear} />
                <mesh position={[0.15, 0.34, -0.04]} scale={[0.03, 0.08, 0.03]} geometry={sharedGeos.box} material={mats.ear} />
              </group>
            ) : (
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

      <AquaticFauna weather={weather} />
      <SkyRaptors hasMatureForest={treeCoords.length >= 4 || population >= 120} />
    </group>
  );
});
