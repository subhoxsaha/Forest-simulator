/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CivilizationState, EcosystemType, Grid, HumanEra, SettlementSite } from '../../types';
import { GRID_SIZE } from '../../constants';
import { getRandomRange, gridToWorld, RIVER_MASK, WORLD_OFFSET } from '../../utils/webgl';
import { simClock } from '../../simulation/clock';
import { sharedGeos, getPooledMaterial } from './MaterialLibrary';

const LAND_COORDS: { x: number; y: number }[] = [];
for (let y = 0; y < GRID_SIZE; y++) {
  for (let x = 0; x < GRID_SIZE; x++) {
    if (!RIVER_MASK[y][x]) LAND_COORDS.push({ x, y });
  }
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

// --- Evolving Historical Settlement Architecture ---
const SettlementStructure: React.FC<{
  site: SettlementSite;
  era: HumanEra;
}> = React.memo(({ site, era }) => {
  const [wx, , wz] = gridToWorld(site.x, site.y);
  const flameRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const snowGroupRef = useRef<THREE.Group>(null);
  const windowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const mats = useMemo(
    () => ({
      wood: getPooledMaterial('bark', '#7c4a21'),
      darkWood: getPooledMaterial('bark', '#4a2c12'),
      hide: getPooledMaterial('critter', '#c29568'),
      thatch: getPooledMaterial('critter', '#ca9e4b'),
      mudWall: getPooledMaterial('critter', '#d6c3a5'),
      stone: getPooledMaterial('deadWood', '#64748b'),
      slateRoof: getPooledMaterial('deadWood', '#475569'),
      terracotta: getPooledMaterial('blossom', '#b45309'),
      cedar: getPooledMaterial('bark', '#9a5b25'),
      solarPanel: getPooledMaterial('critter', '#0f2942'),
      greenRoof: getPooledMaterial('leaf', '#16a34a'),
      glass: getPooledMaterial('blossom', '#bae6fd', { opacity: 0.72, transparent: true }),
      fire: getPooledMaterial('fungi', '#f97316', { emissive: '#fb923c', emissiveIntensity: 2.2 }),
      snow: getPooledMaterial('critter', '#f8fafc'),
      ecoGlow: getPooledMaterial('fungi', '#2dd4bf', { emissive: '#14b8a6', emissiveIntensity: 1.8 }),
    }),
    []
  );

  // Dynamic dusk/night window glow material (disposed cleanly)
  const warmGlowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.25,
        roughness: 0.35,
      }),
    []
  );

  useEffect(() => () => warmGlowMat.dispose(), [warmGlowMat]);

  // Determine river crossing angle for bridge alignment
  const bridgeRotY = useMemo(() => {
    if (site.kind !== 'bridge') return 0;
    const leftLand = site.x > 0 && !RIVER_MASK[site.y][site.x - 1];
    const rightLand = site.x < GRID_SIZE - 1 && !RIVER_MASK[site.y][site.x + 1];
    return leftLand || rightLand ? 0 : Math.PI / 2;
  }, [site.kind, site.x, site.y]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const progress = simClock.getProgress();
    const sw = simClock.getSeasonWeights();
    const isEveningOrNight = progress > 0.65 || progress < 0.24;
    const glowFactor = isEveningOrNight ? 1.0 : sw.winter > 0.45 ? 0.55 : 0.15;

    // Flickering campfire / beacon warmth
    if (flameRef.current) {
      const flick = 0.88 + Math.sin(t * 14 + site.x * 3) * 0.14 + Math.cos(t * 21) * 0.08;
      flameRef.current.scale.set(0.14 * flick, 0.24 * flick, 0.14 * flick);
      flameRef.current.rotation.y = t * 2.4;
    }

    if (lightRef.current) {
      const targetIntensity =
        (site.kind === 'camp' ? 2.4 : 1.7) * glowFactor * (0.9 + Math.sin(t * 10 + site.y) * 0.1);
      lightRef.current.intensity = THREE.MathUtils.damp(lightRef.current.intensity, targetIntensity, 4, dt);
    }

    if (windowMatRef.current) {
      windowMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        windowMatRef.current.emissiveIntensity,
        0.2 + glowFactor * 1.9,
        4,
        dt
      );
    } else {
      warmGlowMat.emissiveIntensity = THREE.MathUtils.damp(
        warmGlowMat.emissiveIntensity,
        0.2 + glowFactor * 1.9,
        4,
        dt
      );
    }

    // Automatic winter snow dusting on roofs & bridge deck
    if (snowGroupRef.current) {
      const snowTarget = sw.winter > 0.32 ? Math.min(1, (sw.winter - 0.32) / 0.48) : 0;
      snowGroupRef.current.visible = snowTarget > 0.03;
      if (snowGroupRef.current.visible) {
        const curY = snowGroupRef.current.scale.y;
        snowGroupRef.current.scale.set(1, THREE.MathUtils.damp(curY, snowTarget, 3.5, dt), 1);
      }
    }
  });

  // 1. RIVER FOOTBRIDGE (Appears in Era 1+, upgrades visually across eras!)
  if (site.kind === 'bridge') {
    return (
      <group position={[wx, -0.33, wz]} rotation={[0, bridgeRotY, 0]} raycast={() => null}>
        {/* Main deck planks */}
        <mesh
          position={[0, 0.06, 0]}
          scale={[1.18, 0.07, 0.56]}
          geometry={sharedGeos.box}
          material={era >= 3 ? mats.cedar : mats.wood}
          castShadow
          receiveShadow
        />
        {/* Side support posts & rails */}
        {[-0.45, 0, 0.45].map((px, idx) => (
          <React.Fragment key={idx}>
            <mesh position={[px, 0.16, 0.25]} scale={[0.06, 0.26, 0.06]} geometry={sharedGeos.box} material={era >= 2 ? mats.stone : mats.darkWood} castShadow />
            <mesh position={[px, 0.16, -0.25]} scale={[0.06, 0.26, 0.06]} geometry={sharedGeos.box} material={era >= 2 ? mats.stone : mats.darkWood} castShadow />
          </React.Fragment>
        ))}
        <mesh position={[0, 0.25, 0.25]} scale={[1.05, 0.045, 0.045]} geometry={sharedGeos.box} material={era >= 3 ? mats.ecoGlow : mats.wood} />
        <mesh position={[0, 0.25, -0.25]} scale={[1.05, 0.045, 0.045]} geometry={sharedGeos.box} material={era >= 3 ? mats.ecoGlow : mats.wood} />

        {/* Era 2+ bridge lanterns */}
        {era >= 2 && (
          <>
            <mesh position={[0, 0.34, 0.25]} scale={[0.09, 0.1, 0.09]} geometry={sharedGeos.sphere} material={era === 3 ? mats.ecoGlow : warmGlowMat} />
            <mesh position={[0, 0.34, -0.25]} scale={[0.09, 0.1, 0.09]} geometry={sharedGeos.sphere} material={era === 3 ? mats.ecoGlow : warmGlowMat} />
          </>
        )}

        <group ref={snowGroupRef} visible={false}>
          <mesh position={[0, 0.1, 0]} scale={[1.12, 0.03, 0.48]} geometry={sharedGeos.box} material={mats.snow} />
        </group>
      </group>
    );
  }

  // 2. FOUNDATIONAL HEARTH CAMP -> VILLAGE HALL -> SOLARPUNK PAVILION
  if (site.kind === 'camp') {
    return (
      <group position={[wx, -0.29, wz]} raycast={() => null}>
        {era === 0 && (
          /* Era 0: Paleolithic Hide Lean-To & Crackling Stone Campfire */
          <group>
            {/* Hide Tent */}
            <mesh position={[-0.18, 0.2, -0.14]} scale={[0.56, 0.48, 0.56]} rotation={[0, 0.4, 0]} geometry={sharedGeos.cone} material={mats.hide} castShadow receiveShadow />
            <mesh position={[-0.18, 0.45, -0.14]} scale={[0.05, 0.16, 0.05]} geometry={sharedGeos.cylinder} material={mats.darkWood} />
            {/* Stone Fire Ring */}
            <mesh position={[0.2, 0.03, 0.18]} scale={[0.26, 0.06, 0.26]} geometry={sharedGeos.cylinder} material={mats.stone} />
            <mesh position={[0.2, 0.06, 0.18]} scale={[0.18, 0.04, 0.05]} rotation={[0, 0.6, 0]} geometry={sharedGeos.box} material={mats.darkWood} />
            <mesh position={[0.2, 0.06, 0.18]} scale={[0.18, 0.04, 0.05]} rotation={[0, -0.8, 0]} geometry={sharedGeos.box} material={mats.darkWood} />
            <mesh ref={flameRef} position={[0.2, 0.14, 0.18]} scale={[0.14, 0.24, 0.14]} geometry={sharedGeos.cone} material={mats.fire} />
            <pointLight ref={lightRef} position={[0.2, 0.38, 0.18]} color="#fb923c" distance={4.5} decay={2} intensity={0.4} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[-0.18, 0.36, -0.14]} scale={[0.34, 0.16, 0.34]} geometry={sharedGeos.cone} material={mats.snow} />
            </group>
          </group>
        )}

        {era === 1 && (
          /* Era 1: Neolithic Round Mudbrick & Thatch Hearth Hut */
          <group>
            <mesh position={[-0.08, 0.19, -0.06]} scale={[0.56, 0.36, 0.56]} geometry={sharedGeos.cylinder} material={mats.mudWall} castShadow receiveShadow />
            <mesh position={[-0.08, 0.48, -0.06]} scale={[0.76, 0.34, 0.76]} geometry={sharedGeos.cone} material={mats.thatch} castShadow />
            <mesh position={[0.14, 0.13, 0.12]} scale={[0.12, 0.2, 0.06]} rotation={[0, 0.6, 0]} geometry={sharedGeos.box} material={mats.darkWood} />
            {/* Outdoor Hearth Ember */}
            <mesh position={[0.28, 0.03, 0.24]} scale={[0.18, 0.05, 0.18]} geometry={sharedGeos.cylinder} material={mats.stone} />
            <mesh ref={flameRef} position={[0.28, 0.12, 0.24]} scale={[0.11, 0.18, 0.11]} geometry={sharedGeos.cone} material={mats.fire} />
            <pointLight ref={lightRef} position={[0.28, 0.35, 0.24]} color="#fb923c" distance={4.8} decay={2} intensity={0.4} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[-0.08, 0.56, -0.06]} scale={[0.62, 0.18, 0.62]} geometry={sharedGeos.cone} material={mats.snow} />
            </group>
          </group>
        )}

        {era === 2 && (
          /* Era 2: Classical Timber-Framed Woodland Guild Hall */
          <group>
            <mesh position={[0, 0.03, 0]} scale={[0.88, 0.06, 0.88]} geometry={sharedGeos.box} material={mats.stone} receiveShadow />
            <mesh position={[0, 0.24, 0]} scale={[0.68, 0.38, 0.54]} geometry={sharedGeos.box} material={mats.mudWall} castShadow receiveShadow />
            {/* Timber frame beams */}
            <mesh position={[0, 0.24, 0.28]} scale={[0.7, 0.05, 0.03]} geometry={sharedGeos.box} material={mats.darkWood} />
            <mesh position={[0, 0.24, 0.28]} scale={[0.05, 0.38, 0.03]} geometry={sharedGeos.box} material={mats.darkWood} />
            {/* Glowing evening windows */}
            <mesh position={[-0.18, 0.24, 0.28]} scale={[0.12, 0.12, 0.03]} geometry={sharedGeos.box} material={warmGlowMat} />
            <mesh position={[0.18, 0.24, 0.28]} scale={[0.12, 0.12, 0.03]} geometry={sharedGeos.box} material={warmGlowMat} />
            {/* Terracotta pitched roof */}
            <mesh position={[0, 0.55, 0]} scale={[0.86, 0.34, 0.72]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.terracotta} castShadow />
            <pointLight ref={lightRef} position={[0, 0.45, 0.4]} color="#fbbf24" distance={5.2} decay={2} intensity={0.4} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[0, 0.62, 0]} scale={[0.74, 0.2, 0.62]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.snow} />
            </group>
          </group>
        )}

        {era === 3 && (
          /* Era 3: Solarpunk Cedar & Glass Eco-Pavilion */
          <group>
            <mesh position={[0, 0.03, 0]} scale={[0.9, 0.06, 0.9]} geometry={sharedGeos.cylinder} material={mats.stone} receiveShadow />
            <mesh position={[0, 0.24, 0]} scale={[0.68, 0.36, 0.68]} geometry={sharedGeos.cylinder} material={mats.cedar} castShadow receiveShadow />
            <mesh position={[0, 0.26, 0]} scale={[0.72, 0.2, 0.72]} geometry={sharedGeos.cylinder} material={mats.glass} />
            {/* Living green roof & angled solar array */}
            <mesh position={[0, 0.44, 0]} scale={[0.82, 0.09, 0.82]} geometry={sharedGeos.cylinder} material={mats.greenRoof} castShadow />
            <mesh position={[0, 0.54, 0]} scale={[0.56, 0.05, 0.38]} rotation={[0.25, 0.3, 0]} geometry={sharedGeos.box} material={mats.solarPanel} castShadow />
            <mesh position={[0, 0.62, 0]} scale={[0.1, 0.1, 0.1]} geometry={sharedGeos.sphere} material={mats.ecoGlow} />
            <pointLight ref={lightRef} position={[0, 0.65, 0]} color="#5eead4" distance={5.5} decay={2} intensity={0.4} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[0, 0.49, 0]} scale={[0.78, 0.06, 0.78]} geometry={sharedGeos.cylinder} material={mats.snow} />
            </group>
          </group>
        )}
      </group>
    );
  }

  // 3. WATCHTOWER -> CANOPY OBSERVATORY (Era 2+)
  if (site.kind === 'tower') {
    return (
      <group position={[wx, -0.29, wz]} raycast={() => null}>
        {era <= 2 ? (
          <group>
            <mesh position={[0, 0.22, 0]} scale={[0.42, 0.44, 0.42]} geometry={sharedGeos.box} material={mats.stone} castShadow receiveShadow />
            <mesh position={[0, 0.64, 0]} scale={[0.34, 0.46, 0.34]} geometry={sharedGeos.box} material={mats.wood} castShadow />
            <mesh position={[0, 0.9, 0]} scale={[0.52, 0.08, 0.52]} geometry={sharedGeos.box} material={mats.darkWood} castShadow />
            <mesh position={[0, 1.12, 0]} scale={[0.54, 0.36, 0.54]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.slateRoof} castShadow />
            <mesh position={[0, 0.82, 0.2]} scale={[0.11, 0.12, 0.05]} geometry={sharedGeos.box} material={warmGlowMat} />
            <pointLight ref={lightRef} position={[0, 0.95, 0.28]} color="#fbbf24" distance={5.5} decay={2} intensity={0.4} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[0, 1.2, 0]} scale={[0.44, 0.18, 0.44]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.snow} />
            </group>
          </group>
        ) : (
          /* Era 3: Solarpunk Glass-Dome Canopy Observatory */
          <group>
            <mesh position={[0, 0.42, 0]} scale={[0.3, 0.84, 0.3]} geometry={sharedGeos.cylinder} material={mats.cedar} castShadow receiveShadow />
            <mesh position={[0, 0.86, 0]} scale={[0.64, 0.09, 0.64]} geometry={sharedGeos.cylinder} material={mats.greenRoof} castShadow />
            <mesh position={[0, 1.06, 0]} scale={[0.52, 0.44, 0.52]} geometry={sharedGeos.sphere} material={mats.glass} />
            <mesh position={[0, 1.32, 0]} scale={[0.08, 0.24, 0.08]} geometry={sharedGeos.cylinder} material={mats.ecoGlow} />
            <pointLight ref={lightRef} position={[0, 1.25, 0]} color="#5eead4" distance={6.0} decay={2} intensity={0.5} />
            <group ref={snowGroupRef} visible={false}>
              <mesh position={[0, 0.92, 0]} scale={[0.58, 0.05, 0.58]} geometry={sharedGeos.cylinder} material={mats.snow} />
            </group>
          </group>
        )}
      </group>
    );
  }

  // 4. DWELLING (Neolithic Hut -> Classical Cottage -> Solarpunk Solar Lodge)
  return (
    <group position={[wx, -0.29, wz]} raycast={() => null}>
      {era <= 1 && (
        <group>
          <mesh position={[0, 0.17, 0]} scale={[0.48, 0.34, 0.48]} geometry={sharedGeos.box} material={mats.mudWall} castShadow receiveShadow />
          <mesh position={[0, 0.44, 0]} scale={[0.68, 0.32, 0.68]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.thatch} castShadow />
          <mesh position={[0, 0.12, 0.25]} scale={[0.11, 0.18, 0.04]} geometry={sharedGeos.box} material={mats.darkWood} />
          <group ref={snowGroupRef} visible={false}>
            <mesh position={[0, 0.51, 0]} scale={[0.56, 0.16, 0.56]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.snow} />
          </group>
        </group>
      )}
      {era === 2 && (
        <group>
          <mesh position={[0, 0.22, 0]} scale={[0.56, 0.42, 0.48]} geometry={sharedGeos.box} material={mats.mudWall} castShadow receiveShadow />
          <mesh position={[0, 0.52, 0]} scale={[0.74, 0.32, 0.64]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.slateRoof} castShadow />
          <mesh position={[0.14, 0.24, 0.25]} scale={[0.11, 0.11, 0.03]} geometry={sharedGeos.box} material={warmGlowMat} />
          <mesh position={[-0.14, 0.13, 0.25]} scale={[0.11, 0.2, 0.03]} geometry={sharedGeos.box} material={mats.darkWood} />
          <group ref={snowGroupRef} visible={false}>
            <mesh position={[0, 0.59, 0]} scale={[0.62, 0.17, 0.54]} rotation={[0, Math.PI / 4, 0]} geometry={sharedGeos.cone} material={mats.snow} />
          </group>
        </group>
      )}
      {era === 3 && (
        <group>
          <mesh position={[0, 0.2, 0]} scale={[0.58, 0.36, 0.52]} geometry={sharedGeos.box} material={mats.cedar} castShadow receiveShadow />
          <mesh position={[0, 0.22, 0.27]} scale={[0.42, 0.18, 0.03]} geometry={sharedGeos.box} material={warmGlowMat} />
          <mesh position={[0, 0.41, 0]} scale={[0.66, 0.07, 0.58]} geometry={sharedGeos.box} material={mats.greenRoof} castShadow />
          <mesh position={[0, 0.49, 0]} scale={[0.46, 0.04, 0.32]} rotation={[0.24, 0, 0]} geometry={sharedGeos.box} material={mats.solarPanel} castShadow />
          <group ref={snowGroupRef} visible={false}>
            <mesh position={[0, 0.46, 0]} scale={[0.62, 0.04, 0.54]} geometry={sharedGeos.box} material={mats.snow} />
          </group>
        </group>
      )}
    </group>
  );
});

// --- Articulated Living Human Villagers Evolving Through History ---
export const HumanCivilizationSystem: React.FC<{
  civilization: CivilizationState;
  grid: Grid;
}> = React.memo(({ civilization, grid }) => {
  const peopleGroupRef = useRef<THREE.Group>(null);
  const era = civilization.era;

  // Gather living tree targets so humans periodically stroll over to tend saplings & forage
  const treeSpots = useMemo(() => {
    const spots: { x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const t = grid[y]?.[x];
        if (t && t.type !== EcosystemType.None && t.type !== EcosystemType.DeadTree) {
          spots.push({ x, y });
        }
      }
    }
    return spots;
  }, [grid]);

  const homeAnchor = useMemo(() => {
    const camp = civilization.settlements.find((s) => s.kind === 'camp') || civilization.settlements[0];
    return camp ? { x: camp.x, y: camp.y } : { x: 6, y: 6 };
  }, [civilization.settlements]);

  // Pre-allocate up to 10 villagers (active count scales cleanly with Era)
  const villagers = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const start = LAND_COORDS[(i * 19 + 7) % LAND_COORDS.length] || { x: 6, y: 6 };
        return {
          curX: start.x + getRandomRange(-0.25, 0.25),
          curZ: start.y + getRandomRange(-0.25, 0.25),
          tx: start.x,
          tz: start.y,
          yaw: Math.random() * Math.PI * 2,
          speed: getRandomRange(0.45, 0.72),
          pauseTimer: getRandomRange(0.5, 2.5),
          phase: i * 1.37,
          skinVariant: i % 3,
        };
      }),
    []
  );

  const mats = useMemo(
    () => ({
      skins: [
        getPooledMaterial('critter', '#f1c27d'),
        getPooledMaterial('critter', '#c68642'),
        getPooledMaterial('critter', '#8d5524'),
      ],
      hair: getPooledMaterial('bark', '#292524'),
      legs: getPooledMaterial('bark', '#3f3f46'),
      // Era-specific outfits
      tunicEra0: getPooledMaterial('critter', '#b47b4a'),
      tunicEra1: getPooledMaterial('critter', '#d97706'),
      tunicEra2: getPooledMaterial('leaf', '#166534'),
      tunicEra3: getPooledMaterial('critter', '#ecfdf5'),
      accentEra2: getPooledMaterial('blossom', '#9f1239'),
      accentEra3: getPooledMaterial('fungi', '#14b8a6', { emissive: '#0d9488', emissiveIntensity: 0.7 }),
      staff: getPooledMaterial('bark', '#78350f'),
      pitcher: getPooledMaterial('blossom', '#b45309'),
      lantern: getPooledMaterial('fungi', '#fbbf24', { emissive: '#f59e0b', emissiveIntensity: 1.5 }),
    }),
    []
  );

  useFrame((state, delta) => {
    if (!peopleGroupRef.current || !civilization.enabled) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const progress = simClock.getProgress();
    const isNight = progress > 0.73 || progress < 0.2;
    const children = peopleGroupRef.current.children;
    const activeCount = Math.min(civilization.humanCount, children.length);

    for (let i = 0; i < children.length; i++) {
      const person = children[i];
      if (i >= activeCount) {
        person.visible = false;
        continue;
      }
      person.visible = true;

      const v = villagers[i];
      let moving = true;

      if (v.pauseTimer > 0) {
        v.pauseTimer -= dt;
        moving = false;
      } else {
        const dx = v.tx - v.curX;
        const dz = v.tz - v.curZ;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.16) {
          v.pauseTimer = isNight ? getRandomRange(2.4, 4.8) : getRandomRange(1.2, 3.2);
          moving = false;

          // At night, humans gather peacefully near the glowing hearth camp / shelters!
          if (isNight) {
            const settlements = civilization.settlements.filter((s) => s.kind !== 'bridge');
            const targetSite =
              settlements.length > 0 ? settlements[i % settlements.length] : homeAnchor;
            const angle = (i / Math.max(1, activeCount)) * Math.PI * 2 + Math.random() * 0.4;
            v.tx = Math.max(0.5, Math.min(GRID_SIZE - 1.5, targetSite.x + Math.cos(angle) * 0.75));
            v.tz = Math.max(0.5, Math.min(GRID_SIZE - 1.5, targetSite.y + Math.sin(angle) * 0.75));
          } else if (treeSpots.length > 0 && Math.random() < 0.65) {
            // Walk over to tend a tree or forage in a grove
            const tree = treeSpots[Math.floor(Math.random() * treeSpots.length)];
            v.tx = tree.x + getRandomRange(-0.32, 0.32);
            v.tz = tree.y + getRandomRange(-0.32, 0.32);
          } else {
            const spot = LAND_COORDS[Math.floor(Math.random() * LAND_COORDS.length)];
            if (spot) {
              v.tx = spot.x + getRandomRange(-0.28, 0.28);
              v.tz = spot.y + getRandomRange(-0.28, 0.28);
            }
          }
        } else {
          v.curX += (dx / dist) * v.speed * dt;
          v.curZ += (dz / dist) * v.speed * dt;
          const targetYaw = Math.atan2(dx, dz);
          v.yaw = dampAngle(v.yaw, targetYaw, 7.5, dt);
        }
      }

      const walkBob = moving ? Math.abs(Math.sin(t * 9 + v.phase)) * 0.032 : 0;
      person.position.set(v.curX - WORLD_OFFSET, -0.29 + walkBob, v.curZ - WORLD_OFFSET);
      person.rotation.y = v.yaw;

      // Subtle arm stride when walking, gentle tending nod when paused near trees
      const leftArm = person.children[3];
      const rightArm = person.children[4];
      if (leftArm && rightArm) {
        if (moving) {
          const swing = Math.sin(t * 9 + v.phase) * 0.45;
          leftArm.rotation.x = swing;
          rightArm.rotation.x = -swing;
        } else {
          const tend = Math.sin(t * 3.2 + v.phase) * 0.2;
          leftArm.rotation.x = -0.35 + tend;
          rightArm.rotation.x = -0.35 - tend;
        }
      }
    }
  });

  if (!civilization.enabled) return null;

  const tunicMat =
    era === 0
      ? mats.tunicEra0
      : era === 1
      ? mats.tunicEra1
      : era === 2
      ? mats.tunicEra2
      : mats.tunicEra3;

  return (
    <group raycast={() => null}>
      {/* Evolving Era Settlements */}
      {civilization.settlements.map((site) => (
        <SettlementStructure key={site.id} site={site} era={era} />
      ))}

      {/* Living Human Villagers */}
      <group ref={peopleGroupRef}>
        {villagers.map((v, i) => (
          <group key={`human-${i}`} scale={0.26}>
            {/* Legs */}
            <mesh position={[-0.07, 0.16, 0]} scale={[0.09, 0.32, 0.09]} geometry={sharedGeos.box} material={mats.legs} castShadow />
            <mesh position={[0.07, 0.16, 0]} scale={[0.09, 0.32, 0.09]} geometry={sharedGeos.box} material={mats.legs} castShadow />

            {/* Era Tunic / Cloak Body */}
            <mesh position={[0, 0.46, 0]} scale={[0.26, 0.36, 0.18]} geometry={sharedGeos.box} material={tunicMat} castShadow />

            {/* Left Arm */}
            <group position={[-0.18, 0.56, 0]}>
              <mesh position={[0, -0.12, 0]} scale={[0.08, 0.28, 0.08]} geometry={sharedGeos.box} material={tunicMat} />
            </group>

            {/* Right Arm + Era Tool (Staff -> Pitcher -> Lantern -> Eco-Tablet) */}
            <group position={[0.18, 0.56, 0]}>
              <mesh position={[0, -0.12, 0]} scale={[0.08, 0.28, 0.08]} geometry={sharedGeos.box} material={tunicMat} />
              {era === 0 && (
                <mesh position={[0.02, -0.06, 0.09]} scale={[0.04, 0.65, 0.04]} rotation={[0.2, 0, 0]} geometry={sharedGeos.cylinder} material={mats.staff} />
              )}
              {era === 1 && (
                <mesh position={[0.02, -0.22, 0.08]} scale={[0.12, 0.14, 0.12]} geometry={sharedGeos.sphere} material={mats.pitcher} />
              )}
              {era === 2 && (
                <mesh position={[0.02, -0.24, 0.1]} scale={[0.1, 0.13, 0.1]} geometry={sharedGeos.sphere} material={mats.lantern} />
              )}
              {era === 3 && (
                <mesh position={[0.02, -0.16, 0.12]} scale={[0.14, 0.1, 0.04]} rotation={[-0.4, 0, 0]} geometry={sharedGeos.box} material={mats.accentEra3} />
              )}
            </group>

            {/* Head & Hair */}
            <mesh position={[0, 0.76, 0]} scale={[0.2, 0.2, 0.2]} geometry={sharedGeos.sphere} material={mats.skins[v.skinVariant]} castShadow />
            <mesh position={[0, 0.82, -0.02]} scale={[0.21, 0.12, 0.21]} geometry={sharedGeos.sphere} material={mats.hair} />

            {/* Era 2 Cloak Sash / Era 3 Solarpunk Shoulder Accent */}
            {era === 2 && (
              <mesh position={[0, 0.44, -0.1]} scale={[0.28, 0.34, 0.05]} geometry={sharedGeos.box} material={mats.accentEra2} />
            )}
            {era === 3 && (
              <mesh position={[0, 0.58, 0]} scale={[0.29, 0.07, 0.2]} geometry={sharedGeos.box} material={mats.accentEra3} />
            )}
          </group>
        ))}
      </group>
    </group>
  );
});
