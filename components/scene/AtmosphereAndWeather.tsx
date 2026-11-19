/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GRID_SIZE } from '../../constants';
import { WeatherType } from '../../types';
import { simClock } from '../../simulation/clock';
import { getRandomRange } from '../../utils/webgl';
import { sharedGeos, createAnimatedWaterMaterial, _dummy, _color } from './MaterialLibrary';

const RAIN_COUNT = 220;
const DEW_COUNT = 75;
const FIREFLY_COUNT = 42;

// Zero-dependency procedural PMREM studio/sky environment reflection map
export const ProceduralEnvironment: React.FC = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.75;

    return () => {
      scene.environment = null;
      envRT.dispose();
      roomEnv.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
};

interface AtmosphereRigProps {
  weather: WeatherType;
  isSoftwareGl: boolean;
}

const _bgTarget = new THREE.Color('#78c2e4');
const _bgCurrent = new THREE.Color('#78c2e4');
const _sunTarget = new THREE.Color('#fffbeb');
const _sunCurrent = new THREE.Color('#fffbeb');
const _hemiSkyTarget = new THREE.Color('#cfefff');
const _hemiSkyCurrent = new THREE.Color('#cfefff');
const _hemiGndTarget = new THREE.Color('#1f3b2c');
const _hemiGndCurrent = new THREE.Color('#1f3b2c');

/**
 * 60fps continuous celestial lighting, sky/fog harmony, and atmospheric damping.
 * Reads directly from simClock without triggering any React re-renders!
 */
export const DynamicAtmosphereRig: React.FC<AtmosphereRigProps> = React.memo(({ weather, isSoftwareGl }) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);

  useEffect(() => {
    scene.background = _bgCurrent;
  }, [scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const progress = simClock.getProgress();
    const isNight = progress > 0.74 || progress < 0.19;

    // Celestial arc
    let lx: number;
    let ly: number;
    let lz: number;

    if (isNight) {
      const moonProgress = progress > 0.74 ? (progress - 0.74) / 0.45 : (progress + 0.26) / 0.45;
      const moonAngle = moonProgress * Math.PI + Math.PI / 4;
      lx = Math.cos(moonAngle) * 13;
      ly = Math.max(4.5, Math.sin(moonAngle) * 16);
      lz = Math.sin(moonAngle) * 11;
    } else {
      const sunAngle = progress * Math.PI * 2 - Math.PI / 3;
      lx = Math.cos(sunAngle) * 15;
      ly = Math.max(4.2, Math.sin(sunAngle) * 17);
      lz = Math.sin(sunAngle) * 10;
    }

    let dirIntensity = 2.25;
    let hemiIntensity = 0.82;
    let envIntensity = 0.85;
    let fogDensity = 0.008;

    if (weather === 'Raining') {
      if (isNight) {
        _bgTarget.set('#050914');
        _sunTarget.set('#475569');
        _hemiSkyTarget.set('#1e293b');
        _hemiGndTarget.set('#091318');
        dirIntensity = 0.55;
        hemiIntensity = 0.35;
        envIntensity = 0.25;
        fogDensity = 0.015;
      } else {
        _bgTarget.set('#334155');
        _sunTarget.set('#cbd5e1');
        _hemiSkyTarget.set('#94a3b8');
        _hemiGndTarget.set('#1e293b');
        dirIntensity = 1.1;
        hemiIntensity = 0.68;
        envIntensity = 0.45;
        fogDensity = 0.013;
      }
    } else if (weather === 'Autumn_Dew') {
      if (isNight) {
        _bgTarget.set('#120c0a');
        _sunTarget.set('#b45309');
        _hemiSkyTarget.set('#451a03');
        _hemiGndTarget.set('#1a120b');
        dirIntensity = 0.65;
        hemiIntensity = 0.36;
        envIntensity = 0.28;
        fogDensity = 0.016;
      } else {
        _bgTarget.set('#4c392a');
        _sunTarget.set('#fbbf24');
        _hemiSkyTarget.set('#fde68a');
        _hemiGndTarget.set('#3b2818');
        dirIntensity = 1.8;
        hemiIntensity = 0.72;
        envIntensity = 0.65;
        fogDensity = 0.014;
      }
    } else if (isNight) {
      _bgTarget.set('#070d1d');
      _sunTarget.set('#93c5fd');
      _hemiSkyTarget.set('#1e3a5f');
      _hemiGndTarget.set('#08121c');
      dirIntensity = 1.05;
      hemiIntensity = 0.34;
      envIntensity = 0.22;
      fogDensity = 0.011;
    } else if (progress < 0.33) {
      // Sunrise
      const ratio = Math.max(0, Math.min(1, (progress - 0.19) / 0.14));
      _bgTarget.set('#2c2142').lerp(_color.set('#6cb9dc'), ratio);
      _sunTarget.set('#fb923c').lerp(_color.set('#fff4d6'), ratio);
      _hemiSkyTarget.set('#fdba74').lerp(_color.set('#dbeafe'), ratio);
      _hemiGndTarget.set('#261d24').lerp(_color.set('#1e3a2f'), ratio);
      dirIntensity = 1.45 + ratio * 0.85;
      hemiIntensity = 0.62 + ratio * 0.24;
      envIntensity = 0.45 + ratio * 0.45;
      fogDensity = 0.009;
    } else if (progress < 0.61) {
      // Crisp Daylight
      _bgTarget.set('#74c0e3');
      _sunTarget.set('#fff8e6');
      _hemiSkyTarget.set('#d8f1ff');
      _hemiGndTarget.set('#1e3a2d');
      dirIntensity = 2.35;
      hemiIntensity = 0.88;
      envIntensity = 0.92;
      fogDensity = 0.007;
    } else {
      // Golden Sunset
      const ratio = Math.max(0, Math.min(1, (progress - 0.61) / 0.13));
      _bgTarget.set('#74c0e3').lerp(_color.set('#241838'), ratio);
      _sunTarget.set('#fff8e6').lerp(_color.set('#f43f5e'), ratio);
      _hemiSkyTarget.set('#fed7aa').lerp(_color.set('#4c1d4b'), ratio);
      _hemiGndTarget.set('#2d221d').lerp(_color.set('#110e1c'), ratio);
      dirIntensity = 2.3 - ratio * 1.4;
      hemiIntensity = 0.82 - ratio * 0.42;
      envIntensity = 0.85 - ratio * 0.55;
      fogDensity = 0.01;
    }

    const alpha = 1 - Math.exp(-3.2 * dt);
    _bgCurrent.lerp(_bgTarget, alpha);
    _sunCurrent.lerp(_sunTarget, alpha);
    _hemiSkyCurrent.lerp(_hemiSkyTarget, alpha);
    _hemiGndCurrent.lerp(_hemiGndTarget, alpha);

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_bgCurrent);
    }
    scene.environmentIntensity = THREE.MathUtils.damp(scene.environmentIntensity, envIntensity, 3.2, dt);

    if (fogRef.current) {
      fogRef.current.color.copy(_bgCurrent);
      fogRef.current.density = THREE.MathUtils.damp(fogRef.current.density, fogDensity, 3.0, dt);
    }

    if (dirLightRef.current) {
      dirLightRef.current.position.set(
        THREE.MathUtils.damp(dirLightRef.current.position.x, lx, 4, dt),
        THREE.MathUtils.damp(dirLightRef.current.position.y, ly, 4, dt),
        THREE.MathUtils.damp(dirLightRef.current.position.z, lz, 4, dt)
      );
      dirLightRef.current.color.copy(_sunCurrent);
      dirLightRef.current.intensity = THREE.MathUtils.damp(dirLightRef.current.intensity, dirIntensity, 3.5, dt);
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity = THREE.MathUtils.damp(
        rimLightRef.current.intensity,
        isNight ? 0.35 : 0.45,
        3.5,
        dt
      );
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(_hemiSkyCurrent);
      hemiLightRef.current.groundColor.copy(_hemiGndCurrent);
      hemiLightRef.current.intensity = THREE.MathUtils.damp(hemiLightRef.current.intensity, hemiIntensity, 3.5, dt);
    }
  });

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={['#74c0e3', 0.007]} />

      {/* Warm/Cool Hemisphere Fill */}
      <hemisphereLight ref={hemiLightRef} args={['#d8f1ff', '#1e3a2d', 0.85]} />

      {/* Primary Key Sun / Moon Directional Light */}
      <directionalLight
        ref={dirLightRef}
        castShadow={!isSoftwareGl}
        position={[12, 16, 8]}
        intensity={2.3}
        color="#fff8e6"
        shadow-mapSize={isSoftwareGl ? [512, 512] : [2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={55}
        shadow-bias={-0.0005}
        shadow-normalBias={0.025}
      />

      {/* Subtle Back Rim Light to sculpt low-poly silhouettes */}
      <directionalLight ref={rimLightRef} position={[-14, 10, -12]} intensity={0.42} color="#93c5fd" />
    </>
  );
});

// Volumetric low-poly clouds with soft ground shadow projection
const Cloud: React.FC<{ position: [number, number, number]; scale: number; speed: number; color: string }> = React.memo(
  ({ position, scale, speed, color }) => {
    const groupRef = useRef<THREE.Group>(null);
    const shadowGroupRef = useRef<THREE.Group>(null);

    const bubbles = useMemo(
      () => [
        { pos: [0, 0.1, 0] as [number, number, number], s: 0.92 },
        { pos: [-0.65, -0.08, 0.2] as [number, number, number], s: 0.68 },
        { pos: [0.68, -0.05, -0.15] as [number, number, number], s: 0.74 },
        { pos: [0.18, 0.25, -0.45] as [number, number, number], s: 0.6 },
        { pos: [-0.25, -0.1, -0.45] as [number, number, number], s: 0.56 },
      ],
      []
    );

    const cloudMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color,
          flatShading: true,
          roughness: 0.92,
          transparent: true,
          opacity: 0.88,
        }),
      [color]
    );

    const shadowMat = useMemo(
      () =>
        new THREE.MeshBasicMaterial({
          color: '#091529',
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
        }),
      []
    );

    useEffect(() => {
      return () => {
        cloudMat.dispose();
        shadowMat.dispose();
      };
    }, [cloudMat, shadowMat]);

    useFrame((_, delta) => {
      if (!groupRef.current) return;
      const dt = Math.min(delta, 0.05);
      groupRef.current.position.x += speed * dt;
      const maxBound = GRID_SIZE * 2.1;
      if (groupRef.current.position.x > maxBound) {
        groupRef.current.position.x = -maxBound;
      }
      if (shadowGroupRef.current) {
        const cx = groupRef.current.position.x;
        const cy = groupRef.current.position.y;
        const cz = groupRef.current.position.z;
        const sY = -0.25;
        const t = (cy - sY) / 18;
        shadowGroupRef.current.position.set(cx - t * 10, sY, cz - t * 7);
      }
    });

    return (
      <>
        <group ref={groupRef} position={position} scale={scale}>
          {bubbles.map((b, i) => (
            <mesh key={i} geometry={sharedGeos.sphere} material={cloudMat} position={b.pos} scale={b.s} />
          ))}
        </group>
        <group ref={shadowGroupRef} scale={scale}>
          {bubbles.map((b, i) => (
            <mesh
              key={i}
              geometry={sharedGeos.plane}
              material={shadowMat}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[b.pos[0], 0, b.pos[2]]}
              scale={[b.s * 1.7, b.s * 1.7, 1]}
            />
          ))}
        </group>
      </>
    );
  }
);

// Distant archipelago perimeter rocks & islands so the sanctuary sits in a living world
const SurroundingArchipelago: React.FC = React.memo(() => {
  const islands = useMemo(
    () => [
      { pos: [-16, -0.75, -14] as [number, number, number], scale: [5.5, 1.4, 4.5] as [number, number, number], color: '#1b4d3e' },
      { pos: [17, -0.75, -15] as [number, number, number], scale: [6.2, 1.7, 4.8] as [number, number, number], color: '#174236' },
      { pos: [-18, -0.75, 12] as [number, number, number], scale: [4.8, 1.2, 5.2] as [number, number, number], color: '#1d5242' },
      { pos: [16, -0.75, 15] as [number, number, number], scale: [5.0, 1.3, 4.2] as [number, number, number], color: '#163f33' },
      { pos: [0, -0.75, -20] as [number, number, number], scale: [8.5, 1.9, 4.0] as [number, number, number], color: '#143b30' },
    ],
    []
  );

  const oceanMat = useMemo(
    () =>
      createAnimatedWaterMaterial({
        color: '#0369a1',
        opacity: 0.92,
        roughness: 0.16,
        metalness: 0.62,
        waveScale: 2.2,
        isRiver: false,
      }),
    []
  );

  useEffect(() => {
    return () => oceanMat.dispose();
  }, [oceanMat]);

  return (
    <group raycast={() => null}>
      {/* Extended Horizon Ocean with GLSL waves */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.64, 0]} material={oceanMat} receiveShadow>
        <planeGeometry args={[GRID_SIZE * 9, GRID_SIZE * 9, 32, 32]} />
      </mesh>

      {/* Island Bedrock Rim underneath the playable 15x15 sanctuary */}
      <mesh position={[0, -0.72, 0]} receiveShadow>
        <boxGeometry args={[GRID_SIZE + 0.35, 0.56, GRID_SIZE + 0.35]} />
        <meshStandardMaterial color="#2b2118" roughness={0.95} flatShading />
      </mesh>

      {/* Distant low-poly perimeter islets fading into horizon fog */}
      {islands.map((isl, i) => (
        <mesh key={i} position={isl.pos} scale={isl.scale} geometry={sharedGeos.sphere}>
          <meshStandardMaterial color={isl.color} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
});

export const WeatherEffects: React.FC<{ weather: WeatherType }> = React.memo(({ weather }) => {
  const rainRef = useRef<THREE.InstancedMesh>(null);
  const dewRef = useRef<THREE.InstancedMesh>(null);
  const fireflyRef = useRef<THREE.InstancedMesh>(null);

  const rainData = useMemo(
    () =>
      Array.from({ length: RAIN_COUNT }, () => ({
        x: getRandomRange(-GRID_SIZE * 1.15, GRID_SIZE * 1.15),
        y: getRandomRange(1, 14),
        z: getRandomRange(-GRID_SIZE * 1.15, GRID_SIZE * 1.15),
        speed: getRandomRange(9.0, 14.5),
      })),
    []
  );

  const dewData = useMemo(
    () =>
      Array.from({ length: DEW_COUNT }, () => ({
        x: getRandomRange(-GRID_SIZE * 0.75, GRID_SIZE * 0.75),
        y: getRandomRange(0.4, 5.2),
        z: getRandomRange(-GRID_SIZE * 0.75, GRID_SIZE * 0.75),
        driftX: getRandomRange(0.12, 0.38),
        driftY: getRandomRange(0.08, 0.22),
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  const fireflyData = useMemo(
    () =>
      Array.from({ length: FIREFLY_COUNT }, () => ({
        baseX: getRandomRange(-GRID_SIZE * 0.45, GRID_SIZE * 0.45),
        baseY: getRandomRange(0.35, 2.4),
        baseZ: getRandomRange(-GRID_SIZE * 0.45, GRID_SIZE * 0.45),
        phase: Math.random() * Math.PI * 2,
        speed: getRandomRange(0.5, 1.2),
      })),
    []
  );

  const rainMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.62, depthWrite: false }),
    []
  );
  const dewMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.78, depthWrite: false }),
    []
  );
  const fireflyMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      rainMat.dispose();
      dewMat.dispose();
      fireflyMat.dispose();
    };
  }, [rainMat, dewMat, fireflyMat]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();

    // 1. Instanced Rain (1 Draw Call)
    if (rainRef.current) {
      const isRaining = weather === 'Raining';
      rainRef.current.visible = isRaining;
      if (isRaining) {
        for (let i = 0; i < RAIN_COUNT; i++) {
          const r = rainData[i];
          r.y -= r.speed * dt;
          r.x += 0.9 * dt;
          if (r.y < -0.4) {
            r.y = getRandomRange(10, 14.5);
            r.x = getRandomRange(-GRID_SIZE * 1.15, GRID_SIZE * 1.15);
            r.z = getRandomRange(-GRID_SIZE * 1.15, GRID_SIZE * 1.15);
          }
          _dummy.position.set(r.x, r.y, r.z);
          _dummy.rotation.set(0, 0, 0.08);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          rainRef.current.setMatrixAt(i, _dummy.matrix);
        }
        rainRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Instanced Autumn Dew / Golden Pollen (1 Draw Call)
    if (dewRef.current) {
      const isAutumn = weather === 'Autumn_Dew';
      dewRef.current.visible = isAutumn;
      if (isAutumn) {
        for (let i = 0; i < DEW_COUNT; i++) {
          const d = dewData[i];
          d.y += Math.sin(t * 0.7 + d.phase) * 0.08 * dt - d.driftY * dt;
          d.x += d.driftX * dt;
          if (d.y < -0.2 || d.x > GRID_SIZE * 0.8) {
            d.y = getRandomRange(3.5, 5.5);
            d.x = getRandomRange(-GRID_SIZE * 0.75, GRID_SIZE * 0.4);
          }
          _dummy.position.set(d.x, d.y, d.z);
          _dummy.rotation.set(0, 0, 0);
          const s = 0.06 + Math.sin(t * 2 + d.phase) * 0.015;
          _dummy.scale.set(s, s, s);
          _dummy.updateMatrix();
          dewRef.current.setMatrixAt(i, _dummy.matrix);
        }
        dewRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 3. Instanced Nighttime Fireflies (emerge softly at dusk/night!)
    if (fireflyRef.current) {
      const progress = simClock.getProgress();
      const nightFactor =
        weather === 'Raining'
          ? 0
          : progress > 0.68 || progress < 0.22
          ? 0.85
          : 0;
      fireflyMat.opacity = THREE.MathUtils.damp(fireflyMat.opacity, nightFactor, 2.2, dt);
      fireflyRef.current.visible = fireflyMat.opacity > 0.02;

      if (fireflyRef.current.visible) {
        for (let i = 0; i < FIREFLY_COUNT; i++) {
          const f = fireflyData[i];
          const x = f.baseX + Math.sin(t * f.speed + f.phase) * 0.75;
          const y = f.baseY + Math.cos(t * f.speed * 1.3 + f.phase) * 0.35;
          const z = f.baseZ + Math.cos(t * f.speed * 0.8 + f.phase) * 0.75;
          const blink = 0.035 + Math.max(0, Math.sin(t * 3.5 + f.phase * 3)) * 0.045;
          _dummy.position.set(x, y, z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(blink, blink, blink);
          _dummy.updateMatrix();
          fireflyRef.current.setMatrixAt(i, _dummy.matrix);
        }
        fireflyRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const cloudColor = weather === 'Raining' ? '#94a3b8' : weather === 'Autumn_Dew' ? '#fed7aa' : '#ffffff';

  return (
    <group raycast={() => null}>
      <Cloud position={[-10, 7.6, 3]} scale={1.2} speed={0.28} color={cloudColor} />
      <Cloud position={[4, 8.6, -6]} scale={0.95} speed={0.42} color={cloudColor} />
      <Cloud position={[10, 6.9, 8]} scale={1.35} speed={0.2} color={cloudColor} />

      <instancedMesh
        ref={rainRef}
        args={[sharedGeos.raindrop, rainMat, RAIN_COUNT]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={dewRef}
        args={[sharedGeos.sphere, dewMat, DEW_COUNT]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={fireflyRef}
        args={[sharedGeos.sphere, fireflyMat, FIREFLY_COUNT]}
        frustumCulled={false}
        visible={false}
      />

      <SurroundingArchipelago />
    </group>
  );
});
