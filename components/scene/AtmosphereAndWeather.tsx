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
const FIREFLY_COUNT = 44;
const SNOW_COUNT = 260;
const AUTUMN_LEAF_COUNT = 120;

// Zero-dependency procedural PMREM studio/sky environment reflection map
export const ProceduralEnvironment: React.FC = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.78;

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

// Pre-allocated scratch colors for zero-GC 60fps seasonal + diurnal blending
const _bgTarget = new THREE.Color('#78c2e4');
const _bgCurrent = new THREE.Color('#78c2e4');
const _sunTarget = new THREE.Color('#fffbeb');
const _sunCurrent = new THREE.Color('#fffbeb');
const _hemiSkyTarget = new THREE.Color('#cfefff');
const _hemiSkyCurrent = new THREE.Color('#cfefff');
const _hemiGndTarget = new THREE.Color('#1f3b2c');
const _hemiGndCurrent = new THREE.Color('#1f3b2c');
const _rimTarget = new THREE.Color('#93c5fd');
const _rimCurrent = new THREE.Color('#93c5fd');

// Seasonal daylight palettes (blended seamlessly via continuous SeasonWeights)
const _springBg = new THREE.Color('#86d0ec');
const _summerBg = new THREE.Color('#5cb8e6');
const _autumnBg = new THREE.Color('#cf9872');
const _winterBg = new THREE.Color('#a6c0d8');

const _springSun = new THREE.Color('#fff9e8');
const _summerSun = new THREE.Color('#fff4cc');
const _autumnSun = new THREE.Color('#ffd093');
const _winterSun = new THREE.Color('#dbeafe');

const _springHemiSky = new THREE.Color('#dcfce7');
const _summerHemiSky = new THREE.Color('#d8f3ff');
const _autumnHemiSky = new THREE.Color('#fde68a');
const _winterHemiSky = new THREE.Color('#e2e8f0');

const _springHemiGnd = new THREE.Color('#1f4531');
const _summerHemiGnd = new THREE.Color('#1a3a26');
const _autumnHemiGnd = new THREE.Color('#422917');
const _winterHemiGnd = new THREE.Color('#334155');

const _seasonBg = new THREE.Color();
const _seasonSun = new THREE.Color();
const _seasonHemiSky = new THREE.Color();
const _seasonHemiGnd = new THREE.Color();

function blendFourColors(
  out: THREE.Color,
  cSp: THREE.Color,
  cSu: THREE.Color,
  cAu: THREE.Color,
  cWi: THREE.Color,
  wSp: number,
  wSu: number,
  wAu: number,
  wWi: number
) {
  out.setRGB(
    cSp.r * wSp + cSu.r * wSu + cAu.r * wAu + cWi.r * wWi,
    cSp.g * wSp + cSu.g * wSu + cAu.g * wAu + cWi.g * wWi,
    cSp.b * wSp + cSu.b * wSu + cAu.b * wAu + cWi.b * wWi
  );
}

// Pre-allocated scratch vectors & sky uniforms for zero-GC 60fps SkyDome rendering
const _sunDir = new THREE.Vector3(0.45, 0.72, 0.35).normalize();
const _zenithTarget = new THREE.Color('#3b82c4');
const _zenithCurrent = new THREE.Color('#3b82c4');
const _horizonTarget = new THREE.Color('#bae6fd');
const _horizonCurrent = new THREE.Color('#bae6fd');

const skyUniforms = {
  uZenith: { value: new THREE.Color('#3b82c4') },
  uHorizon: { value: new THREE.Color('#bae6fd') },
  uGround: { value: new THREE.Color('#134e4a') },
  uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.35).normalize() },
  uSunColor: { value: new THREE.Color('#fff7d6') },
  uNightMix: { value: 0.0 },
};

const SKY_VERT = `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNightMix;
  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -1.0, 1.0);

    // Smooth Rayleigh sky gradient above horizon, subtle oceanic reflection below horizon
    vec3 skyCol = h >= 0.0
      ? mix(uHorizon, uZenith, pow(h, 0.58))
      : mix(uHorizon, uGround, pow(-h, 0.45));

    // Warm horizon atmospheric glow near the sun / cool glow near the moon
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, mix(14.0, 28.0, uNightMix)) * mix(0.48, 0.24, uNightMix);
    float disc = smoothstep(0.9965, 0.9988, sunDot);

    skyCol += uSunColor * halo;
    skyCol = mix(skyCol, uSunColor * 1.35, disc * 0.92);

    gl_FragColor = vec4(skyCol, 1.0);
  }
`;

const STAR_COUNT = 340;

const NightStarfield: React.FC<{ starMatRef: React.RefObject<THREE.PointsMaterial | null> }> = React.memo(
  ({ starMatRef }) => {
    const geo = useMemo(() => {
      const positions = new Float32Array(STAR_COUNT * 3);
      for (let i = 0; i < STAR_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(0.14 + Math.random() * 0.85); // Upper sky dome hemisphere
        const r = 165;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return g;
    }, []);

    useEffect(() => {
      return () => geo.dispose();
    }, [geo]);

    return (
      <points geometry={geo} raycast={() => null}>
        <pointsMaterial
          ref={starMatRef}
          color="#f8fafc"
          size={1.45}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
        />
      </points>
    );
  }
);

/**
 * 60fps continuous celestial & 4-season lighting, atmospheric SkyDome, twinkling stars, and fog harmony.
 * Advances simClock's continuous seasonPhase once per frame with zero React re-renders.
 */
export const DynamicAtmosphereRig: React.FC<AtmosphereRigProps> = React.memo(({ weather, isSoftwareGl }) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const starMatRef = useRef<THREE.PointsMaterial>(null);

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  );

  useEffect(() => {
    scene.background = _bgCurrent;
    return () => {
      skyMat.dispose();
    };
  }, [scene, skyMat]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Advance continuous 4-season phase once per frame
    simClock.advanceFrame(dt);
    const sw = simClock.getSeasonWeights();

    const progress = simClock.getProgress();
    const isNight = progress > 0.74 || progress < 0.19;

    // Blend base seasonal daylight palette smoothly
    blendFourColors(_seasonBg, _springBg, _summerBg, _autumnBg, _winterBg, sw.spring, sw.summer, sw.autumn, sw.winter);
    blendFourColors(_seasonSun, _springSun, _summerSun, _autumnSun, _winterSun, sw.spring, sw.summer, sw.autumn, sw.winter);
    blendFourColors(_seasonHemiSky, _springHemiSky, _summerHemiSky, _autumnHemiSky, _winterHemiSky, sw.spring, sw.summer, sw.autumn, sw.winter);
    blendFourColors(_seasonHemiGnd, _springHemiGnd, _summerHemiGnd, _autumnHemiGnd, _winterHemiGnd, sw.spring, sw.summer, sw.autumn, sw.winter);

    // Seasonal sun elevation (highest in summer, lower & dramatic in autumn/winter)
    const seasonalHeightScale = 1.0 * sw.spring + 1.14 * sw.summer + 0.84 * sw.autumn + 0.72 * sw.winter;

    let lx: number;
    let ly: number;
    let lz: number;

    if (isNight) {
      const moonProgress = progress > 0.74 ? (progress - 0.74) / 0.45 : (progress + 0.26) / 0.45;
      const moonAngle = moonProgress * Math.PI + Math.PI / 4;
      lx = Math.cos(moonAngle) * 13;
      ly = Math.max(4.5, Math.sin(moonAngle) * 15.5);
      lz = Math.sin(moonAngle) * 11;
    } else {
      const sunAngle = progress * Math.PI * 2 - Math.PI / 3;
      lx = Math.cos(sunAngle) * 15;
      ly = Math.max(4.0, Math.sin(sunAngle) * 17 * seasonalHeightScale);
      lz = Math.sin(sunAngle) * 10 + sw.winter * 4.5 + sw.autumn * 2.5;
    }

    let dirIntensity = 2.25 * sw.spring + 2.5 * sw.summer + 2.05 * sw.autumn + 1.85 * sw.winter;
    let hemiIntensity = 0.88 * sw.spring + 0.92 * sw.summer + 0.78 * sw.autumn + 0.95 * sw.winter;
    let envIntensity = 0.88 * sw.spring + 0.95 * sw.summer + 0.74 * sw.autumn + 0.82 * sw.winter;
    let fogDensity = 0.0072 * sw.spring + 0.0062 * sw.summer + 0.0096 * sw.autumn + 0.0115 * sw.winter;

    _rimTarget.set('#93c5fd').lerp(_color.set('#f59e0b'), sw.autumn * 0.55);
    if (sw.winter > 0.1) _rimTarget.lerp(_color.set('#e0f2fe'), sw.winter * 0.7);

    if (weather === 'Raining') {
      if (isNight) {
        _bgTarget.set('#060c18');
        _sunTarget.set('#64748b');
        _hemiSkyTarget.set('#1e293b');
        _hemiGndTarget.set('#091318');
        dirIntensity = 0.6;
        hemiIntensity = 0.38;
        envIntensity = 0.28;
        fogDensity = 0.015;
      } else {
        _bgTarget.copy(_seasonBg).lerp(_color.set('#475569'), 0.62);
        _sunTarget.set('#cbd5e1');
        _hemiSkyTarget.set('#94a3b8');
        _hemiGndTarget.set('#1e293b');
        dirIntensity = 1.2;
        hemiIntensity = 0.72;
        envIntensity = 0.48;
        fogDensity = 0.0135;
      }
    } else if (weather === 'Autumn_Dew') {
      if (isNight) {
        _bgTarget.set('#140d0b');
        _sunTarget.set('#b45309');
        _hemiSkyTarget.set('#451a03');
        _hemiGndTarget.set('#1a120b');
        dirIntensity = 0.68;
        hemiIntensity = 0.38;
        envIntensity = 0.3;
        fogDensity = 0.015;
      } else {
        _bgTarget.copy(_seasonBg).lerp(_color.set('#8a5a3c'), 0.55);
        _sunTarget.set('#fbbf24');
        _hemiSkyTarget.set('#fde68a');
        _hemiGndTarget.set('#3b2818');
        dirIntensity = 1.85;
        hemiIntensity = 0.75;
        envIntensity = 0.68;
        fogDensity = 0.0135;
      }
    } else if (isNight) {
      // Winter nights have a slightly brighter frosty-blue alpine moonlight
      _bgTarget.set('#070d1d').lerp(_color.set('#0c192f'), sw.winter * 0.7);
      _sunTarget.set('#93c5fd').lerp(_color.set('#dbeafe'), sw.winter * 0.6);
      _hemiSkyTarget.set('#1e3a5f').lerp(_color.set('#334155'), sw.winter * 0.5);
      _hemiGndTarget.set('#08121c').lerp(_color.set('#1e293b'), sw.winter * 0.45);
      dirIntensity = 1.05 + sw.winter * 0.22;
      hemiIntensity = 0.36 + sw.winter * 0.14;
      envIntensity = 0.24 + sw.winter * 0.1;
      fogDensity = 0.011 + sw.winter * 0.0025;
    } else if (progress < 0.33) {
      // Seasonal Sunrise
      const ratio = Math.max(0, Math.min(1, (progress - 0.19) / 0.14));
      _bgTarget.set('#2c2142').lerp(_seasonBg, ratio);
      _sunTarget.set('#fb923c').lerp(_seasonSun, ratio);
      _hemiSkyTarget.set('#fdba74').lerp(_seasonHemiSky, ratio);
      _hemiGndTarget.set('#261d24').lerp(_seasonHemiGnd, ratio);
      dirIntensity = 1.4 + ratio * (dirIntensity - 1.4);
      hemiIntensity = 0.6 + ratio * (hemiIntensity - 0.6);
      envIntensity = 0.45 + ratio * (envIntensity - 0.45);
      fogDensity += (1 - ratio) * 0.002;
    } else if (progress < 0.61) {
      // Full Seasonal Daylight
      _bgTarget.copy(_seasonBg);
      _sunTarget.copy(_seasonSun);
      _hemiSkyTarget.copy(_seasonHemiSky);
      _hemiGndTarget.copy(_seasonHemiGnd);
    } else {
      // Seasonal Sunset
      const ratio = Math.max(0, Math.min(1, (progress - 0.61) / 0.13));
      _bgTarget.copy(_seasonBg).lerp(_color.set(sw.winter > 0.5 ? '#162038' : '#261838'), ratio);
      _sunTarget.copy(_seasonSun).lerp(_color.set(sw.winter > 0.5 ? '#c4b5fd' : '#f43f5e'), ratio);
      _hemiSkyTarget.copy(_seasonHemiSky).lerp(_color.set('#4c1d4b'), ratio);
      _hemiGndTarget.copy(_seasonHemiGnd).lerp(_color.set('#110e1c'), ratio);
      dirIntensity = dirIntensity * (1 - ratio * 0.58);
      hemiIntensity = hemiIntensity * (1 - ratio * 0.48);
      envIntensity = envIntensity * (1 - ratio * 0.62);
      fogDensity += ratio * 0.0025;
    }

    const alpha = 1 - Math.exp(-3.4 * dt);
    _bgCurrent.lerp(_bgTarget, alpha);
    _sunCurrent.lerp(_sunTarget, alpha);
    _hemiSkyCurrent.lerp(_hemiSkyTarget, alpha);
    _hemiGndCurrent.lerp(_hemiGndTarget, alpha);
    _rimCurrent.lerp(_rimTarget, alpha);

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
      rimLightRef.current.color.copy(_rimCurrent);
      rimLightRef.current.intensity = THREE.MathUtils.damp(
        rimLightRef.current.intensity,
        isNight ? 0.38 : 0.48 + sw.winter * 0.14,
        3.5,
        dt
      );
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(_hemiSkyCurrent);
      hemiLightRef.current.groundColor.copy(_hemiGndCurrent);
      hemiLightRef.current.intensity = THREE.MathUtils.damp(hemiLightRef.current.intensity, hemiIntensity, 3.5, dt);
    }

    // Update custom GLSL SkyDome zenith, horizon, celestial sun/moon halo, and night starfield
    _zenithTarget.copy(_bgCurrent).multiplyScalar(isNight ? 0.65 : 0.72);
    if (!isNight && weather !== 'Raining') {
      _zenithTarget.b = Math.min(1, _zenithTarget.b + 0.14);
    }
    _horizonTarget.copy(_bgCurrent).lerp(_hemiSkyCurrent, isNight ? 0.22 : 0.45);
    _zenithCurrent.lerp(_zenithTarget, alpha);
    _horizonCurrent.lerp(_horizonTarget, alpha);

    skyUniforms.uZenith.value.copy(_zenithCurrent);
    skyUniforms.uHorizon.value.copy(_horizonCurrent);
    skyUniforms.uGround.value.copy(_hemiGndCurrent);
    _sunDir.set(lx, ly, lz).normalize();
    skyUniforms.uSunDir.value.lerp(_sunDir, alpha).normalize();
    skyUniforms.uSunColor.value.copy(_sunCurrent);
    skyUniforms.uNightMix.value = THREE.MathUtils.damp(skyUniforms.uNightMix.value, isNight ? 1 : 0, 2.5, dt);

    if (starMatRef.current) {
      const targetStars = isNight && weather !== 'Raining' ? 0.85 : 0;
      starMatRef.current.opacity = THREE.MathUtils.damp(starMatRef.current.opacity, targetStars, 2.0, dt);
    }
  });

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={['#86d0ec', 0.0072]} />

      {/* Custom GLSL Atmospheric Sky Dome + Sun/Moon Halo + Twinkling Night Stars */}
      <mesh material={skyMat} raycast={() => null} renderOrder={-10}>
        <sphereGeometry args={[180, 28, 18]} />
      </mesh>
      <NightStarfield starMatRef={starMatRef} />

      {/* Warm/Cool Hemisphere Fill */}
      <hemisphereLight ref={hemiLightRef} args={['#dcfce7', '#1f4531', 0.88]} />

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

      {/* Subtle Back Rim Light to sculpt silhouettes */}
      <directionalLight ref={rimLightRef} position={[-14, 10, -12]} intensity={0.48} color="#93c5fd" />
    </>
  );
});

const Cloud: React.FC<{
  position: [number, number, number];
  scale?: number;
  speed?: number;
  weather: WeatherType;
}> = React.memo(({ position, scale = 1, speed = 0.25, weather }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const cloudMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (groupRef.current) {
      groupRef.current.position.x += speed * dt;
      if (groupRef.current.position.x > GRID_SIZE * 1.15) {
        groupRef.current.position.x = -GRID_SIZE * 1.15;
      }
      if (shadowRef.current) {
        shadowRef.current.position.x = groupRef.current.position.x;
        shadowRef.current.position.z = groupRef.current.position.z;
      }
    }
    if (cloudMatRef.current) {
      const sw = simClock.getSeasonWeights();
      if (weather === 'Raining') {
        _color.set('#94a3b8');
      } else {
        _color.set('#ffffff');
        if (sw.autumn > 0.05) _color.lerp(_autumnHemiSky, sw.autumn * 0.4);
        if (sw.winter > 0.05) _color.lerp(_winterHemiSky, sw.winter * 0.45);
      }
      cloudMatRef.current.color.lerp(_color, 1 - Math.exp(-3 * dt));
    }
  });

  return (
    <>
      <group ref={groupRef} position={position} scale={scale} raycast={() => null}>
        {/* Volumetric 6-puff cloud silhouette for panoramic Bird Flight */}
        <mesh position={[0, 0.08, 0]} scale={[1.9, 0.78, 1.35]} geometry={sharedGeos.sphere}>
          <meshStandardMaterial ref={cloudMatRef} color="#ffffff" roughness={0.92} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.98, -0.08, 0.22]} scale={[1.3, 0.62, 1.0]} geometry={sharedGeos.sphere}>
          <meshStandardMaterial color="#f8fafc" roughness={0.92} transparent opacity={0.86} />
        </mesh>
        <mesh position={[-1.02, -0.1, -0.14]} scale={[1.35, 0.64, 1.05]} geometry={sharedGeos.sphere}>
          <meshStandardMaterial color="#f8fafc" roughness={0.92} transparent opacity={0.86} />
        </mesh>
        <mesh position={[0.35, 0.34, -0.18]} scale={[1.15, 0.56, 0.92]} geometry={sharedGeos.sphere}>
          <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.88} />
        </mesh>
        <mesh position={[-0.42, 0.24, 0.28]} scale={[1.0, 0.5, 0.85]} geometry={sharedGeos.sphere}>
          <meshStandardMaterial color="#f1f5f9" roughness={0.94} transparent opacity={0.84} />
        </mesh>
      </group>

      {/* Soft ground shadow silhouette */}
      <mesh
        ref={shadowRef}
        position={[position[0], -0.24, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[scale * 2.2, scale * 1.4, 1]}
        geometry={sharedGeos.plane}
        raycast={() => null}
      >
        <meshBasicMaterial color="#0f172a" transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </>
  );
});

// Sculpted distant archipelago mountain islets, layered island cliffs, and animated Fresnel ocean
const SurroundingArchipelago: React.FC = React.memo(() => {
  const isletMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1b4d3e', roughness: 0.88 }),
    []
  );
  const peakMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.82 }),
    []
  );
  const pineMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.82 }),
    []
  );

  const islands = useMemo(
    () => [
      { pos: [-17.5, -0.75, -14.5] as [number, number, number], scale: [6.2, 2.2, 5.2] as [number, number, number], peak: 2.8 },
      { pos: [18.5, -0.75, -16] as [number, number, number], scale: [7.0, 2.7, 5.6] as [number, number, number], peak: 3.4 },
      { pos: [-19.5, -0.75, 12.5] as [number, number, number], scale: [5.4, 1.8, 5.8] as [number, number, number], peak: 2.2 },
      { pos: [17.5, -0.75, 16] as [number, number, number], scale: [5.8, 1.9, 4.8] as [number, number, number], peak: 2.4 },
      { pos: [0, -0.75, -22.5] as [number, number, number], scale: [10.5, 3.1, 5.4] as [number, number, number], peak: 4.1 },
      { pos: [-22, -0.75, -1.5] as [number, number, number], scale: [5.2, 2.0, 6.8] as [number, number, number], peak: 2.6 },
      { pos: [22.5, -0.75, 1.0] as [number, number, number], scale: [5.4, 2.1, 6.2] as [number, number, number], peak: 2.7 },
    ],
    []
  );

  const oceanMat = useMemo(
    () =>
      createAnimatedWaterMaterial({
        color: '#0369a1',
        opacity: 0.94,
        roughness: 0.14,
        metalness: 0.64,
        waveScale: 2.2,
        isRiver: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      oceanMat.dispose();
      isletMat.dispose();
      peakMat.dispose();
      pineMat.dispose();
    };
  }, [oceanMat, isletMat, peakMat, pineMat]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sw = simClock.getSeasonWeights();
    const alpha = 1 - Math.exp(-3.0 * dt);

    // Distant islets shift across all 4 seasons
    _color.setRGB(
      0.14 * sw.spring + 0.1 * sw.summer + 0.4 * sw.autumn + 0.72 * sw.winter,
      0.4 * sw.spring + 0.32 * sw.summer + 0.25 * sw.autumn + 0.78 * sw.winter,
      0.28 * sw.spring + 0.22 * sw.summer + 0.15 * sw.autumn + 0.84 * sw.winter
    );
    isletMat.color.lerp(_color, alpha);

    // Distant mountain peaks get bright snowcaps in Winter!
    _color.setRGB(
      0.34 * sw.spring + 0.36 * sw.summer + 0.42 * sw.autumn + 0.9 * sw.winter,
      0.39 * sw.spring + 0.4 * sw.summer + 0.36 * sw.autumn + 0.94 * sw.winter,
      0.44 * sw.spring + 0.44 * sw.summer + 0.34 * sw.autumn + 0.98 * sw.winter
    );
    peakMat.color.lerp(_color, alpha);

    _color.setRGB(
      0.1 * sw.spring + 0.08 * sw.summer + 0.44 * sw.autumn + 0.62 * sw.winter,
      0.38 * sw.spring + 0.32 * sw.summer + 0.22 * sw.autumn + 0.72 * sw.winter,
      0.22 * sw.spring + 0.18 * sw.summer + 0.12 * sw.autumn + 0.76 * sw.winter
    );
    pineMat.color.lerp(_color, alpha);

    // Ocean shifts gently toward glacial arctic slate-blue in winter
    _color.setRGB(
      0.03 * sw.spring + 0.02 * sw.summer + 0.05 * sw.autumn + 0.16 * sw.winter,
      0.44 * sw.spring + 0.41 * sw.summer + 0.35 * sw.autumn + 0.46 * sw.winter,
      0.66 * sw.spring + 0.64 * sw.summer + 0.54 * sw.autumn + 0.64 * sw.winter
    );
    oceanMat.color.lerp(_color, alpha);
  });

  return (
    <group raycast={() => null}>
      {/* Extended Horizon Ocean with GLSL waves + Fresnel sheen */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.64, 0]} material={oceanMat} receiveShadow>
        <planeGeometry args={[GRID_SIZE * 14, GRID_SIZE * 14, 48, 48]} />
      </mesh>

      {/* Multi-Tiered Island Bedrock Cliffs (sandstone rim + deep basalt cliff shelf) */}
      <mesh position={[0, -0.62, 0]} receiveShadow>
        <boxGeometry args={[GRID_SIZE + 0.28, 0.32, GRID_SIZE + 0.28]} />
        <meshStandardMaterial color="#5c4734" roughness={0.94} />
      </mesh>
      <mesh position={[0, -0.84, 0]} receiveShadow>
        <boxGeometry args={[GRID_SIZE + 0.62, 0.38, GRID_SIZE + 0.62]} />
        <meshStandardMaterial color="#2d2621" roughness={0.96} />
      </mesh>
      {/* Coastal shoreline foam ring */}
      <mesh position={[0, -0.615, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[GRID_SIZE * 0.71, GRID_SIZE * 0.75, 4]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Sculpted Distant Archipelago Mountain Islets with Snow Peaks & Conifer Silhouettes */}
      {islands.map((isl, i) => (
        <group key={i} position={isl.pos}>
          <mesh scale={isl.scale} geometry={sharedGeos.sphere} material={isletMat} />
          <mesh position={[0, isl.peak * 0.45, 0]} scale={[isl.scale[0] * 0.48, isl.peak, isl.scale[2] * 0.48]} geometry={sharedGeos.cone} material={peakMat} />
          <mesh position={[isl.scale[0] * 0.22, isl.scale[1] * 0.35, 0.4]} scale={[0.7, 1.4, 0.7]} geometry={sharedGeos.cone} material={pineMat} />
          <mesh position={[-isl.scale[0] * 0.24, isl.scale[1] * 0.3, -0.5]} scale={[0.6, 1.25, 0.6]} geometry={sharedGeos.cone} material={pineMat} />
        </group>
      ))}
    </group>
  );
});

export const WeatherEffects: React.FC<{ weather: WeatherType }> = React.memo(({ weather }) => {
  const rainRef = useRef<THREE.InstancedMesh>(null);
  const dewRef = useRef<THREE.InstancedMesh>(null);
  const fireflyRef = useRef<THREE.InstancedMesh>(null);
  const snowRef = useRef<THREE.InstancedMesh>(null);
  const autumnLeafRef = useRef<THREE.InstancedMesh>(null);

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

  const snowData = useMemo(
    () =>
      Array.from({ length: SNOW_COUNT }, () => ({
        x: getRandomRange(-GRID_SIZE * 0.95, GRID_SIZE * 0.95),
        y: getRandomRange(0.2, 12.5),
        z: getRandomRange(-GRID_SIZE * 0.95, GRID_SIZE * 0.95),
        speed: getRandomRange(1.1, 2.3),
        swayAmp: getRandomRange(0.3, 0.9),
        phase: Math.random() * Math.PI * 2,
        size: getRandomRange(0.04, 0.075),
      })),
    []
  );

  const autumnLeafData = useMemo(
    () =>
      Array.from({ length: AUTUMN_LEAF_COUNT }, (_, i) => ({
        x: getRandomRange(-GRID_SIZE * 0.65, GRID_SIZE * 0.65),
        y: getRandomRange(0.3, 7.5),
        z: getRandomRange(-GRID_SIZE * 0.65, GRID_SIZE * 0.65),
        speed: getRandomRange(0.65, 1.35),
        drift: getRandomRange(0.35, 0.85),
        phase: Math.random() * Math.PI * 2,
        color: new THREE.Color(['#ea580c', '#dc2626', '#f59e0b', '#d97706', '#fb923c'][i % 5]),
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
    () => new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0, depthWrite: false }),
    []
  );
  const snowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0, depthWrite: false }),
    []
  );
  const autumnLeafMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    []
  );

  useEffect(() => {
    if (autumnLeafRef.current) {
      for (let i = 0; i < AUTUMN_LEAF_COUNT; i++) {
        autumnLeafRef.current.setColorAt(i, autumnLeafData[i].color);
      }
      if (autumnLeafRef.current.instanceColor) {
        autumnLeafRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [autumnLeafData]);

  useEffect(() => {
    return () => {
      rainMat.dispose();
      dewMat.dispose();
      fireflyMat.dispose();
      snowMat.dispose();
      autumnLeafMat.dispose();
    };
  }, [rainMat, dewMat, fireflyMat, snowMat, autumnLeafMat]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const sw = simClock.getSeasonWeights();

    // 1. Instanced Rain (turns to extra snow flurries in deep Winter!)
    if (rainRef.current) {
      const isRaining = weather === 'Raining' && sw.winter < 0.55;
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

    // 2. Instanced Golden Pollen / Spring-Autumn Dew Motes
    if (dewRef.current) {
      const isDewActive = weather === 'Autumn_Dew' || sw.spring > 0.55;
      dewRef.current.visible = isDewActive && sw.winter < 0.35;
      if (dewRef.current.visible) {
        dewMat.opacity = weather === 'Autumn_Dew' ? 0.78 : Math.max(0, (sw.spring - 0.55) * 1.1);
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
          const s = 0.055 + Math.sin(t * 2 + d.phase) * 0.015;
          _dummy.scale.set(s, s, s);
          _dummy.updateMatrix();
          dewRef.current.setMatrixAt(i, _dummy.matrix);
        }
        dewRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 3. Instanced Nighttime Fireflies (lush in Spring/Summer nights, resting in Winter)
    if (fireflyRef.current) {
      const progress = simClock.getProgress();
      const nightFactor =
        weather === 'Raining' || sw.winter > 0.55
          ? 0
          : progress > 0.68 || progress < 0.22
          ? 0.88 * (1 - sw.winter * 0.9)
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

    // 4. Instanced Winter Snowfall (glides in smoothly as winter weight rises!)
    if (snowRef.current) {
      const targetSnowOpacity = sw.winter > 0.2 ? Math.min(0.92, (sw.winter - 0.2) * 1.25) : 0;
      snowMat.opacity = THREE.MathUtils.damp(snowMat.opacity, targetSnowOpacity, 2.5, dt);
      snowRef.current.visible = snowMat.opacity > 0.02;

      if (snowRef.current.visible) {
        const windBoost = weather === 'Windy' ? 2.1 : weather === 'Raining' ? 1.55 : 1.0;
        for (let i = 0; i < SNOW_COUNT; i++) {
          const s = snowData[i];
          s.y -= s.speed * (weather === 'Raining' ? 1.4 : 1.0) * dt;
          s.x += (Math.sin(t * 1.3 + s.phase) * s.swayAmp + 0.35 * windBoost) * dt;
          s.z += Math.cos(t * 1.1 + s.phase) * s.swayAmp * 0.5 * dt;
          if (s.y < -0.3) {
            s.y = getRandomRange(9.5, 13.5);
            s.x = getRandomRange(-GRID_SIZE * 0.95, GRID_SIZE * 0.95);
            s.z = getRandomRange(-GRID_SIZE * 0.95, GRID_SIZE * 0.95);
          }
          _dummy.position.set(s.x, s.y, s.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(s.size);
          _dummy.updateMatrix();
          snowRef.current.setMatrixAt(i, _dummy.matrix);
        }
        snowRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 5. Instanced Swirling Autumn Leaves (tumble softly across the canopy in Autumn!)
    if (autumnLeafRef.current) {
      const targetLeafOpacity = sw.autumn > 0.25 ? Math.min(0.88, (sw.autumn - 0.25) * 1.35) : 0;
      autumnLeafMat.opacity = THREE.MathUtils.damp(autumnLeafMat.opacity, targetLeafOpacity, 2.5, dt);
      autumnLeafRef.current.visible = autumnLeafMat.opacity > 0.02;

      if (autumnLeafRef.current.visible) {
        const windBoost = weather === 'Windy' ? 2.0 : 1.0;
        for (let i = 0; i < AUTUMN_LEAF_COUNT; i++) {
          const lf = autumnLeafData[i];
          lf.y -= lf.speed * dt;
          lf.x += (lf.drift * windBoost + Math.sin(t * 1.8 + lf.phase) * 0.45) * dt;
          lf.z += Math.cos(t * 1.4 + lf.phase) * 0.35 * dt;
          if (lf.y < -0.25 || lf.x > GRID_SIZE * 0.85) {
            lf.y = getRandomRange(4.0, 8.2);
            lf.x = getRandomRange(-GRID_SIZE * 0.75, GRID_SIZE * 0.45);
            lf.z = getRandomRange(-GRID_SIZE * 0.75, GRID_SIZE * 0.75);
          }
          _dummy.position.set(lf.x, lf.y, lf.z);
          _dummy.rotation.set(t * 2.1 + lf.phase, t * 2.6 + lf.phase, Math.sin(t * 2 + lf.phase));
          _dummy.scale.setScalar(1.35);
          _dummy.updateMatrix();
          autumnLeafRef.current.setMatrixAt(i, _dummy.matrix);
        }
        autumnLeafRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group raycast={() => null}>
      <Cloud position={[-11, 8.6, 3]} scale={1.35} speed={0.26} weather={weather} />
      <Cloud position={[4, 10.2, -7]} scale={1.15} speed={0.38} weather={weather} />
      <Cloud position={[11, 7.8, 9]} scale={1.45} speed={0.2} weather={weather} />
      <Cloud position={[-6, 11.4, -12]} scale={1.55} speed={0.31} weather={weather} />
      <Cloud position={[14, 9.6, -2]} scale={1.25} speed={0.24} weather={weather} />

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
      <instancedMesh
        ref={snowRef}
        args={[sharedGeos.sphere, snowMat, SNOW_COUNT]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={autumnLeafRef}
        args={[sharedGeos.petal, autumnLeafMat, AUTUMN_LEAF_COUNT]}
        frustumCulled={false}
        visible={false}
      />

      <SurroundingArchipelago />
    </group>
  );
});
