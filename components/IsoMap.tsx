/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Environment, SoftShadows, Outlines, OrthographicCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { EcosystemType, Grid, TileData } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';
import { ecosystemAudio } from '../services/audio';

// Fix for TypeScript R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

// Determinstic offset generator
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared basic geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const coneGeo = new THREE.ConeGeometry(0.5, 1, 5);
const sphereGeo = new THREE.SphereGeometry(0.5, 6, 6);

// --- Particle Accents for Decomposition & Organic Nutrient Release ---

interface DecompositionAccentsProps {
  progress?: number;
  x: number;
  y: number;
}

const DecompositionAccents = React.memo(({ progress = 0, x, y }: DecompositionAccentsProps) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 2. Pulse ground circular nutrient pulse waves representing root-zone loam enrichment
    if (ringRef.current) {
      const pulseScale = 1.0 + Math.sin(t * 2.2) * 0.12;
      ringRef.current.scale.set(pulseScale, 1, pulseScale);
      
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        // Pulse glow opacity matching expansion cycle
        mat.opacity = 0.2 + Math.sin(t * 2.2) * 0.12;
      }
    }
  });

  // Dynamically place glowing bracket shelf-fungi and wild soil mushrooms based on decomposition progress
  const renderFungalClumps = () => {
    const caps: React.ReactNode[] = [];

    // Permanent shelf / bracket mushrooms growing on stump trunk
    caps.push(
      <mesh key="shelf1" geometry={sphereGeo} position={[-0.08, 0.25, 0.06]} scale={[0.13, 0.04, 0.11]}>
        <meshStandardMaterial color="#f97316" roughness={0.3} emissive="#ea580c" emissiveIntensity={0.6} />
      </mesh>
    );

    // Mid-stage secondary bracket mushrooms higher up stump
    if (progress >= 30) {
      caps.push(
        <mesh key="shelf2" geometry={sphereGeo} position={[-0.09, 0.45, -0.05]} scale={[0.1, 0.03, 0.09]}>
          <meshStandardMaterial color="#fbbf24" roughness={0.2} emissive="#d97706" emissiveIntensity={0.8} />
        </mesh>
      );
    }

    // Ground Mushrooms - Sprout cute red wild cap mushrooms at bottom
    if (progress >= 15) {
      caps.push(
        <group key="redcap1" position={[0.18, -0.12, -0.15]}>
          <mesh geometry={cylinderGeo} position={[0, 0.04, 0]} scale={[0.015, 0.08, 0.015]}>
            <meshStandardMaterial color="#f5f5f4" />
          </mesh>
          <mesh geometry={sphereGeo} position={[0, 0.08, 0]} scale={[0.07, 0.045, 0.07]}>
            <meshStandardMaterial color="#ef4444" roughness={0.4} />
          </mesh>
        </group>
      );
    }

    // Orange cap mushrooms in early-mid phase
    if (progress >= 45) {
      caps.push(
        <group key="orangecap1" position={[-0.15, -0.12, 0.18]}>
          <mesh geometry={cylinderGeo} position={[0, 0.03, 0]} scale={[0.012, 0.06, 0.012]}>
            <meshStandardMaterial color="#f5f5f4" />
          </mesh>
          <mesh geometry={sphereGeo} position={[0, 0.06, 0]} scale={[0.06, 0.035, 0.06]}>
            <meshStandardMaterial color="#f97316" roughness={0.45} />
          </mesh>
        </group>
      );
    }

    // High progress: Rare bioluminescent magical cyan Fairy Cap mushrooms! Glowing in damp loam
    if (progress >= 65) {
      caps.push(
        <group key="fairycap1" position={[0.22, -0.12, 0.13]}>
          <mesh geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.01, 0.12, 0.01]}>
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.8} />
          </mesh>
          <mesh geometry={sphereGeo} position={[0, 0.12, 0]} scale={[0.05, 0.035, 0.05]}>
            <meshStandardMaterial color="#0284c7" roughness={0.1} emissive="#38bdf8" emissiveIntensity={1.5} />
          </mesh>
        </group>
      );
    }

    // Near completion decomposition: Glowing yellow micro-spore caps exploding at base
    if (progress >= 85) {
      caps.push(
        <group key="fairycap2" position={[-0.2, -0.12, -0.16]}>
          <mesh geometry={cylinderGeo} position={[0, 0.04, 0]} scale={[0.008, 0.08, 0.008]}>
            <meshStandardMaterial color="#fef9c3" />
          </mesh>
          <mesh geometry={sphereGeo} position={[0, 0.08, 0]} scale={[0.04, 0.025, 0.04]}>
            <meshStandardMaterial color="#ca8a04" roughness={0.1} emissive="#fde047" emissiveIntensity={1.8} />
          </mesh>
        </group>
      );
    }

    return caps;
  };

  return (
    <group>
      {/* 1. Nutrient Release Pulse Circle on the Ground (semi-transparent glowing disc) */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial 
          color="#a3e635" 
          transparent 
          opacity={0.25} 
          roughness={1}
          metalness={0.1}
          emissive="#65a30d" 
          emissiveIntensity={0.8} 
          depthWrite={false}
        />
      </mesh>

      {/* 2. Micro Fungal Flora Clumps */}
      {renderFungalClumps()}
    </group>
  );
});

// --- Synthesized Timber Crack & Fall Sound Generator ---
const playWoodCrackSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a series of 4 randomized timber crackles over 0.6s
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.15;
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140 - i * 30 + Math.random() * 20, audioCtx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + delay + 0.12);
      
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.12);
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(250, audioCtx.currentTime + delay);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + 0.13);
    }

    // A final low thud as it falls to the ground
    const thudOsc = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    const thudFilter = audioCtx.createBiquadFilter();

    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(70, audioCtx.currentTime + 0.55);
    thudOsc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.98);

    thudGain.gain.setValueAtTime(0, audioCtx.currentTime);
    thudGain.gain.setValueAtTime(0.16, audioCtx.currentTime + 0.55);
    thudGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.98);

    thudFilter.type = "lowpass";
    thudFilter.frequency.setValueAtTime(120, audioCtx.currentTime + 0.55);

    thudOsc.connect(thudFilter);
    thudFilter.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    thudOsc.start(audioCtx.currentTime + 0.55);
    thudOsc.stop(audioCtx.currentTime + 0.99);

  } catch (err) {
    // Graceful containment for browser security auto-play limits
    console.debug("Audio play blocked by browser sandbox policy", err);
  }
};

// --- Beautiful Falling/Collapsing Tree Physical Representation ---
interface FallingTreeModelProps {
  type: EcosystemType;
  growthStage: number;
  startTime: number;
  x: number;
  y: number;
}

const FallingTreeModel = React.memo(({ type, growthStage, startTime, x, y }: FallingTreeModelProps) => {
  const ref = useRef<THREE.Group>(null);
  const hash = getHash(x, y);
  const rotation = hash * Math.PI * 2;

  const [opacity, setOpacity] = useState(1);
  const [isDone, setIsDone] = useState(false);

  const baseColor = useMemo(() => {
    const config = BUILDINGS[type];
    const col = new THREE.Color(config ? config.color : '#15803d');
    col.offsetHSL((hash * 0.1) - 0.05, (hash * 0.1) - 0.05, (hash * 0.1) - 0.05);
    return col;
  }, [type, hash]);

  const barkColor = useMemo(() => {
    return new THREE.Color("#78350f").multiplyScalar(0.7 + hash * 0.3);
  }, [hash]);

  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: baseColor,
    flatShading: true,
    transparent: true,
    opacity: 1,
    roughness: 0.9,
  }), [baseColor]);

  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: barkColor,
    flatShading: true,
    transparent: true,
    opacity: 1,
    roughness: 0.9,
  }), [barkColor]);

  const blossomMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fbcfe8',
    transparent: true,
    opacity: 1,
    flatShading: true,
  }), []);

  // Compute collapsing gravity values inside frame tick
  useFrame((state) => {
    const elapsed = (Date.now() - startTime) / 1000;
    const duration = 2.4;
    const progress = Math.min(1, elapsed / duration);

    if (progress >= 1) {
      setIsDone(true);
      return;
    }

    setOpacity(1 - progress);

    if (ref.current) {
      // 1. Wood stress shake in first 350ms
      let shake = 0;
      if (progress < 0.15) {
        shake = Math.sin(state.clock.getElapsedTime() * 45) * 0.08;
      }

      // 2. Rotate falling trunk downwards along a random lateral angle
      const fallDir = hash * Math.PI * 2;
      const tilt = (Math.PI * 0.45) * Math.pow(Math.max(0, progress - 0.1) / 0.9, 1.8);
      
      ref.current.rotation.x = Math.sin(fallDir) * tilt + shake;
      ref.current.rotation.z = Math.cos(fallDir) * tilt;

      // 3. Sink decomposing timber into loam
      ref.current.position.y = -0.3 - tilt * 0.4 - progress * 0.5;
    }
  });

  useEffect(() => {
    leafMat.opacity = opacity;
    barkMat.opacity = opacity;
    blossomMat.opacity = opacity;
  }, [opacity, leafMat, barkMat, blossomMat]);

  if (isDone) return null;

  const scaleMultiplier = (() => {
    switch (growthStage) {
      case 1: return 0.25;
      case 2: return 0.55;
      case 3: return 1.05;
      case 4: return 1.75;
      default: return 0.1;
    }
  })();

  const trunkScaleMultiplier = growthStage === 4 ? 1.3 : 1.0;
  const canopyScaleMultiplier = growthStage === 4 ? 1.4 : 1.0;

  return (
    <group ref={ref} position={[0, -0.3, 0]} scale={[scaleMultiplier, scaleMultiplier, scaleMultiplier]}>
      {growthStage === 1 && (
        <group>
          <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.1, 0]} scale={[0.1, 0.3, 0.1]} />
          <mesh geometry={coneGeo} material={leafMat} position={[0.08, 0.22, 0]} scale={[0.12, 0.18, 0.12]} rotation={[0, 0, -Math.PI / 5]} />
          <mesh geometry={coneGeo} material={leafMat} position={[-0.08, 0.22, 0]} scale={[0.12, 0.18, 0.12]} rotation={[0, 0, Math.PI / 5]} />
        </group>
      )}

      {growthStage === 2 && (
        <group rotation={[0, rotation, 0]}>
          <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.25, 0]} scale={[0.14, 0.7, 0.14]} />
          <mesh geometry={cylinderGeo} material={barkMat} position={[0.1, 0.4, 0]} scale={[0.07, 0.3, 0.07]} rotation={[0, 0, -Math.PI / 4]} />
          <group position={[0, 0.65, 0]}>
            <mesh geometry={sphereGeo} material={leafMat} position={[0, 0, 0]} scale={[0.35, 0.35, 0.35]} />
            <mesh geometry={sphereGeo} material={leafMat} position={[0.18, -0.13, 0]} scale={[0.22, 0.22, 0.22]} />
          </group>
        </group>
      )}

      {growthStage >= 3 && (() => {
        switch (type) {
          case EcosystemType.Pine:
            return (
              <group>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.4 * trunkScaleMultiplier, 0]} scale={[0.18 * trunkScaleMultiplier, 1.1 * trunkScaleMultiplier, 0.18 * trunkScaleMultiplier]} />
                <group position={[0, 0.8, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={coneGeo} material={leafMat} position={[0, 0.2, 0]} scale={[0.7, 0.8, 0.7]} />
                  <mesh geometry={coneGeo} material={leafMat} position={[0, 0.6, 0]} scale={[0.55, 0.7, 0.55]} />
                  <mesh geometry={coneGeo} material={leafMat} position={[0, 1.0, 0]} scale={[0.4, 0.55, 0.4]} />
                </group>
              </group>
            );

          case EcosystemType.Oak:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.5 * trunkScaleMultiplier, 0]} scale={[0.32 * trunkScaleMultiplier, 1.2 * trunkScaleMultiplier, 0.32 * trunkScaleMultiplier]} />
                <mesh geometry={cylinderGeo} material={barkMat} position={[0.2, 0.8, 0.2]} scale={[0.12, 0.5, 0.12]} rotation={[Math.PI/6, 0, Math.PI/6]} />
                <mesh geometry={cylinderGeo} material={barkMat} position={[-0.2, 0.8, -0.2]} scale={[0.12, 0.5, 0.12]} rotation={[-Math.PI/6, 0, -Math.PI/6]} />
                <group position={[0, 1.2, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.2, 0]} scale={[0.75, 0.75, 0.75]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[0.25, 0.5, 0.15]} scale={[0.55, 0.55, 0.55]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[-0.25, 0.45, -0.1]} scale={[0.55, 0.55, 0.55]} />
                </group>
              </group>
            );

          case EcosystemType.CherryBlossom:
            return (
              <group rotation={[0, rotation, 0]}>
                <group position={[0, 0.5 * trunkScaleMultiplier, 0]} rotation={[0.1, 0, 0.1]}>
                  <mesh geometry={cylinderGeo} material={barkMat} scale={[0.22 * trunkScaleMultiplier, 1.1 * trunkScaleMultiplier, 0.22 * trunkScaleMultiplier]} />
                </group>
                <group position={[0.1, 1.1, 0.1]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0, 0]} scale={[0.72, 0.65, 0.72]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[-0.3, 0.2, -0.2]} scale={[0.5, 0.45, 0.5]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[0.3, 0.15, 0.2]} scale={[0.55, 0.5, 0.55]} />
                </group>
              </group>
            );

          case EcosystemType.Maple:
            return (
              <group rotation={[0, rotation + Math.PI/4, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.5 * trunkScaleMultiplier, 0]} scale={[0.2 * trunkScaleMultiplier, 1.2 * trunkScaleMultiplier, 0.2 * trunkScaleMultiplier]} />
                <group position={[0, 1.2, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.1, 0]} scale={[0.65, 0.8, 0.65]} />
                  <mesh geometry={coneGeo} material={leafMat} position={[0, 0.6, 0]} scale={[0.45, 0.6, 0.45]} />
                </group>
              </group>
            );

          case EcosystemType.Redwood:
            return (
              <group>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.9 * trunkScaleMultiplier, 0]} scale={[0.42 * trunkScaleMultiplier, 2.0 * trunkScaleMultiplier, 0.42 * trunkScaleMultiplier]} />
                <group position={[0, 1.3, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier * 1.2, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.1, 0]} scale={[0.8, 0.8, 0.8]} />
                  <mesh geometry={coneGeo} material={leafMat} position={[0, 0.6, 0]} scale={[0.65, 0.6, 0.65]} />
                </group>
              </group>
            );

          case EcosystemType.Bonsai:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.15 * trunkScaleMultiplier, 0]} scale={[0.1 * trunkScaleMultiplier, 0.3 * trunkScaleMultiplier, 0.1 * trunkScaleMultiplier]} rotation={[0.15, 0, 0.2]} />
                <mesh geometry={cylinderGeo} material={barkMat} position={[0.07, 0.28 * trunkScaleMultiplier, 0.05]} scale={[0.06, 0.2, 0.06]} rotation={[-0.4, 0.3, -Math.PI / 3]} />
                <group position={[0.1 * canopyScaleMultiplier, 0.38 * canopyScaleMultiplier, -0.05]} scale={[0.8 * canopyScaleMultiplier, 0.8 * canopyScaleMultiplier, 0.8 * canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.05, 0]} scale={[0.25, 0.12, 0.25]} />
                </group>
              </group>
            );

          case EcosystemType.Willow:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.45 * trunkScaleMultiplier, 0]} scale={[0.16 * trunkScaleMultiplier, 1.0 * trunkScaleMultiplier, 0.16 * trunkScaleMultiplier]} rotation={[0, 0, 0.08]} />
                <group position={[0, 0.95, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.1, 0]} scale={[0.62, 0.52, 0.62]} />
                  <mesh geometry={cylinderGeo} material={leafMat} position={[0.3, -0.2, 0.2]} scale={[0.16, 0.55, 0.16]} />
                  <mesh geometry={cylinderGeo} material={leafMat} position={[-0.3, -0.2, -0.2]} scale={[0.16, 0.55, 0.16]} />
                </group>
              </group>
            );

          case EcosystemType.Baobab:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.3 * trunkScaleMultiplier, 0]} scale={[0.55 * trunkScaleMultiplier, 0.7 * trunkScaleMultiplier, 0.55 * trunkScaleMultiplier]} />
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.75 * trunkScaleMultiplier, 0]} scale={[0.38 * trunkScaleMultiplier, 0.5 * trunkScaleMultiplier, 0.38 * trunkScaleMultiplier]} />
                <group position={[0, 1.15 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.1, 0]} scale={[0.48, 0.32, 0.48]} />
                </group>
              </group>
            );

          case EcosystemType.Jacaranda:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.5 * trunkScaleMultiplier, 0]} scale={[0.22 * trunkScaleMultiplier, 1.2 * trunkScaleMultiplier, 0.22 * trunkScaleMultiplier]} />
                <group position={[0, 1.35, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.2, 0]} scale={[0.72, 0.68, 0.72]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[0.32, 0.02, 0.2]} scale={[0.55, 0.5, 0.55]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[-0.32, 0.05, -0.2]} scale={[0.55, 0.5, 0.55]} />
                </group>
              </group>
            );

          case EcosystemType.Alder:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.45 * trunkScaleMultiplier, 0]} scale={[0.2 * trunkScaleMultiplier, 1.1 * trunkScaleMultiplier, 0.2 * trunkScaleMultiplier]} />
                <group position={[0, 1.05, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.2, 0]} scale={[0.62, 0.72, 0.62]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[0.15, 0.4, 0.15]} scale={[0.45, 0.5, 0.45]} />
                </group>
              </group>
            );

          case EcosystemType.Acacia:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh geometry={cylinderGeo} material={barkMat} position={[0, 0.5 * trunkScaleMultiplier, 0]} scale={[0.18 * trunkScaleMultiplier, 1.1 * trunkScaleMultiplier, 0.18 * trunkScaleMultiplier]} rotation={[0.1, 0, 0.1]} />
                <group position={[0.1, 1.1, 0.1]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.1, 0]} scale={[1.1, 0.22, 1.1]} />
                  <mesh geometry={sphereGeo} material={leafMat} position={[0.2, 0.25, -0.2]} scale={[0.7, 0.16, 0.7]} />
                </group>
              </group>
            );

          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- 1. Procedural Botanical Models with Wind Sway ---

// Gentle petal and leaf drift falling from mature tree foliage
const CanopyPetalDrop = ({ type, canopyHeight, x, y, hash }: { 
  type: EcosystemType; 
  canopyHeight: number; 
  x: number; 
  y: number; 
  hash: number;
}) => {
  const petalsRef = useRef<THREE.Group>(null);
  
  // Choose species-specific petal/foliage particle specs
  const config = useMemo(() => {
    switch (type) {
      case EcosystemType.CherryBlossom:
        return { color: '#fbcfe8', count: 3, speed: 0.35, size: 0.045, spread: 0.4 };
      case EcosystemType.Jacaranda:
        return { color: '#c084fc', count: 3, speed: 0.38, size: 0.04, spread: 0.4 };
      case EcosystemType.Maple:
        return { color: '#fca5a5', count: 2, speed: 0.42, size: 0.05, spread: 0.35 };
      case EcosystemType.Willow:
        return { color: '#eab308', count: 2, speed: 0.28, size: 0.035, spread: 0.3 };
      default:
        return null;
    }
  }, [type]);

  // Deterministic local offsets for the particles
  const particles = useMemo(() => {
    if (!config) return [];
    return Array.from({ length: config.count }).map((_, i) => {
      const pHash = (hash * (i + 1) * 7.7) % 1;
      return {
        initialX: (pHash - 0.5) * config.spread,
        initialZ: (((pHash * 2) % 1) - 0.5) * config.spread,
        speedFactor: 0.8 + (((pHash * 3.1) % 1) * 0.4),
        swayAmplitude: 0.08 + (((pHash * 5.9) % 1) * 0.08),
        swayFrequency: 2.5 + (((pHash * 11.3) % 1) * 2),
        phase: pHash * Math.PI * 2,
        startY: canopyHeight - (pHash * canopyHeight)
      };
    });
  }, [config, canopyHeight, hash]);

  useFrame((state, delta) => {
    if (!config || !petalsRef.current) return;
    const time = state.clock.getElapsedTime();
    
    petalsRef.current.children.forEach((mesh, i) => {
      const spec = particles[i];
      if (!spec) return;

      // Drifts downwards
      mesh.position.y -= config.speed * spec.speedFactor * delta;
      
      // Floating sway sideways (aerodynamic flutter)
      const sway = Math.sin(time * spec.swayFrequency + spec.phase) * spec.swayAmplitude;
      mesh.position.x = spec.initialX + sway;
      mesh.rotation.y += delta * 1.5;
      mesh.rotation.x += delta * 0.8;

      // Reset when reaching near ground (y <= 0)
      if (mesh.position.y < 0) {
        mesh.position.y = canopyHeight + (Math.random() * 0.2);
        mesh.position.x = spec.initialX;
        mesh.position.z = spec.initialZ;
      }
    });
  });

  if (!config || particles.length === 0) return null;

  return (
    <group ref={petalsRef}>
      {particles.map((spec, i) => (
        <mesh key={i} position={[spec.initialX, spec.startY, spec.initialZ]} rotation={[Math.sin(i), Math.cos(i), 0]}>
          <planeGeometry args={[config.size, config.size * 1.2]} />
          <meshBasicMaterial color={config.color} transparent opacity={0.72} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

interface ProceduralTreeProps {
  type: EcosystemType;
  growthStage: number; // 1: Sprout, 2: Sapling, 3: Mature, 4: Ancient
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
  weather?: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew';
  growthProgress?: number; // Representing dynamic decomposition progress for DeadTree
  nutrients?: number;
  day?: number;
}

const ProceduralTree = React.memo(({ 
  type, 
  growthStage, 
  x, 
  y, 
  opacity = 1, 
  transparent = false, 
  weather = 'Sunny',
  growthProgress = 0,
  nutrients = 0,
  day
}: ProceduralTreeProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Group>(null);
  const branchRef = useRef<THREE.Mesh>(null);
  const branch2Ref = useRef<THREE.Mesh>(null);
  const leavesRef1 = useRef<THREE.Mesh>(null);
  const leavesRef2 = useRef<THREE.Mesh>(null);
  
  const hash = getHash(x, y);

  // Five deterministic pseudo-random variables for highly-organic variations
  const h1 = hash;
  const h2 = (hash * 3.7 + 0.13) % 1;
  const h3 = (hash * 7.1 + 0.47) % 1;
  const h4 = (hash * 13.9 + 0.79) % 1;
  const h5 = (hash * 19.3 + 0.23) % 1;

  // Transition and Falling effect state machines
  const lastLivingConfig = useRef<{ type: EcosystemType; stage: number } | null>(null);
  const [fallingTree, setFallingTree] = useState<{ type: EcosystemType; stage: number; startTime: number } | null>(null);
  const lastType = useRef<EcosystemType>(type);

  if (type !== EcosystemType.DeadTree && type !== EcosystemType.None) {
    lastLivingConfig.current = { type, stage: growthStage };
  }

  useEffect(() => {
    if (lastType.current !== EcosystemType.DeadTree && lastType.current !== EcosystemType.None && type === EcosystemType.DeadTree) {
      setFallingTree({
        type: lastType.current,
        stage: lastLivingConfig.current?.stage || 3,
        startTime: Date.now()
      });
      playWoodCrackSound();
    }
    lastType.current = type;
  }, [type]);

  useEffect(() => {
    if (fallingTree) {
      const handle = setTimeout(() => {
        setFallingTree(null);
      }, 2600);
      return () => clearTimeout(handle);
    }
  }, [fallingTree]);
  
  // Custom rotation/variation
  const rotation = hash * Math.PI * 2;
  const scaleMultiplier = useMemo(() => {
    if (type === EcosystemType.DeadTree) {
      return 0.82; // Ethereal stout wood stump size
    }
    switch (growthStage) {
      case 1: return 0.25; // Sprout
      case 2: return 0.60; // Sapling (tuned slightly larger for smoother visual scaling step)
      case 3: return 1.10; // Mature
      case 4: return 1.85; // Ancient (truly majestic colossal scale)
      default: return 0.1;
    }
  }, [growthStage, type]);

  const canopyHeight = useMemo(() => {
    const isAncient = growthStage === 4;
    const trunkScaleMultiplier = isAncient ? 1.60 : 1.0;
    
    switch (type) {
      case EcosystemType.CherryBlossom: return 1.1 * trunkScaleMultiplier;
      case EcosystemType.Jacaranda: return 1.35 * trunkScaleMultiplier;
      case EcosystemType.Maple: return 1.2 * trunkScaleMultiplier;
      case EcosystemType.Willow: return 0.95 * trunkScaleMultiplier;
      case EcosystemType.Peepal: return 1.3 * trunkScaleMultiplier;
      case EcosystemType.Neem: return 1.1 * trunkScaleMultiplier;
      case EcosystemType.Banyan: return 1.4 * trunkScaleMultiplier;
      default: return 1.0;
    }
  }, [type, growthStage]);

  // Specific species colors with organic seasonal and coordinate-based variations
  const leafColor = useMemo(() => {
    const config = BUILDINGS[type];
    const baseColor = config ? config.color : '#15803d';
    let finalColor = new THREE.Color(baseColor);

    const cycle = day !== undefined ? ((day - 1) % 40) : 0;
    const season = day !== undefined ? (
      cycle < 10 ? 'spring' :
      cycle < 20 ? 'summer' : // simulated dry season
      cycle < 30 ? 'autumn' : 'winter'
    ) : 'spring';

    const isAutumnActive = weather === 'Autumn_Dew' || season === 'autumn';
    const isWinterActive = season === 'winter';
    const isSummerActive = season === 'summer';

    if (isAutumnActive) {
      // deciduous foliage transitions to gorgeous warm autumn shades
      switch (type) {
        case EcosystemType.Maple:
          // Fierry crimson / blazing warm red
          finalColor = new THREE.Color(hash > 0.5 ? '#b91c1c' : '#dc2626');
          break;
        case EcosystemType.Oak:
          // Deep rich copper amber / gold rust
          finalColor = new THREE.Color(hash > 0.5 ? '#ca8a04' : '#b45309');
          break;
        case EcosystemType.CherryBlossom:
          // Soft rose gold / apricot peach bloom
          finalColor = new THREE.Color(hash > 0.5 ? '#fda4af' : '#f472b6');
          break;
        case EcosystemType.Willow:
          // Golden harvest yellow
          finalColor = new THREE.Color('#eab308');
          break;
        case EcosystemType.Bonsai:
          // Splendid ochre gold tips
          finalColor = new THREE.Color('#d97706');
          break;
        case EcosystemType.Alder:
          // Warm amber brown
          finalColor = new THREE.Color('#c2410c');
          break;
        case EcosystemType.Jacaranda:
          // Muted lavender plum
          finalColor = new THREE.Color('#581c87');
          break;
        case EcosystemType.Acacia:
          // Savanna bronze
          finalColor = new THREE.Color('#854d0e');
          break;
        default:
          // Keep conifers (Pine, Redwood) rich warm forest cedar
          finalColor = new THREE.Color('#065f46');
          break;
      }
    } else if (isWinterActive) {
      // Winter frosty, pale, desaturated colors
      switch (type) {
        case EcosystemType.Pine:
        case EcosystemType.Redwood:
          // Frost spire teal/blue-green
          finalColor = new THREE.Color('#0f766e').offsetHSL(0, -0.15, 0.05);
          break;
        case EcosystemType.CherryBlossom:
          // Dormant desaturated blossom grey-pink
          finalColor = new THREE.Color('#fbcfe8').offsetHSL(0.02, -0.4, 0.1);
          break;
        case EcosystemType.Jacaranda:
          // Cold dusty lavender
          finalColor = new THREE.Color('#c084fc').offsetHSL(0, -0.35, 0.08);
          break;
        default:
          // Deciduous: pale, cool desaturated sage-green
          finalColor = finalColor.clone().offsetHSL(0.04, -0.32, 0.12);
          break;
      }
    } else if (isSummerActive) {
      // Dry season slight yellowish green parched tint
      if (type === EcosystemType.Willow || type === EcosystemType.Alder || type === EcosystemType.Oak) {
        finalColor = finalColor.clone().offsetHSL(0.06, -0.06, -0.01);
      }
    }

    // Shift HSL slightly to avoid synthetic uniform colors
    finalColor.offsetHSL((hash * 0.08) - 0.04, (hash * 0.08) - 0.04, (hash * 0.08) - 0.04);
    return finalColor;
  }, [type, hash, weather, day]);

  // Materials config
  const leavesMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: leafColor,
    flatShading: true,
    opacity,
    transparent,
    roughness: 0.9,
    metalness: 0.1
  }), [leafColor, opacity, transparent]);

  const barkMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#78350f").multiplyScalar(0.7 + hash * 0.3), // Wood-brown
    flatShading: true,
    opacity,
    transparent,
    roughness: 0.9
  }), [hash, opacity, transparent]);

  const deadWoodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#564c40").multiplyScalar(0.7 + hash * 0.2), // Weathered gray-brown crumbly rotting wood
    flatShading: true,
    opacity,
    transparent,
    roughness: 0.96,
    metalness: 0.02
  }), [hash, opacity, transparent]);

  const blossomMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fbcfe8', // soft petal pink for cherry sprout details
    roughness: 0.9,
    flatShading: true,
    opacity,
    transparent
  }), [opacity, transparent]);

  // Dynamic wind speed and wind amplitude multipliers based on weather
  const { windSpeedMult, windAmtMult } = useMemo(() => {
    switch (weather) {
      case 'Windy':
        return { windSpeedMult: 2.2, windAmtMult: 2.6 };
      case 'Raining':
        return { windSpeedMult: 0.8, windAmtMult: 0.7 }; // Heavy wet tree, moves slowly in tight bounds
      case 'Autumn_Dew':
        return { windSpeedMult: 1.4, windAmtMult: 1.3 }; // Lively fluttering fall breeze
      case 'Sunny':
      default:
        return { windSpeedMult: 0.95, windAmtMult: 0.85 }; // Standard tranquil day
    }
  }, [weather]);

  // Animate dynamic wind swaying nested structures
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const baseSpeed = (1.2 + hash * 0.6) * windSpeedMult;
    
    // Smooth botanical scale swell lerp for organic growth stage transitions
    if (groupRef.current) {
      const currentS = groupRef.current.scale.x;
      const targetS = scaleMultiplier;
      const lerpedS = THREE.MathUtils.lerp(currentS, targetS, Math.min(6.5 * delta, 0.25));
      groupRef.current.scale.set(lerpedS, lerpedS, lerpedS);
    }
    
    // Spatially-propagating wind gust traveling across coordinates (from north-west to south-east)
    const waveFreq = weather === 'Windy' ? 1.4 : weather === 'Raining' ? 0.8 : 0.6;
    const gustStrength = Math.sin(time * waveFreq - (x + y) * 0.22) * 0.45 + 0.55; // range: 0.1 to 1.0

    // 1. MAIN TRUNK & ROOT SYSTEM SWAY
    if (groupRef.current) {
      let trunkSwaySpeed = baseSpeed;
      let trunkSwayAmt = 0.025 * windAmtMult;

      if (growthStage === 1) {
        trunkSwaySpeed = baseSpeed * 1.6;
        trunkSwayAmt = 0.04 * windAmtMult;
      } else if (growthStage === 2) {
        trunkSwaySpeed = baseSpeed * 1.35;
        trunkSwayAmt = 0.035 * windAmtMult;
      } else {
        // Mature / Ancient species specific branch flexibility & resistance
        switch (type) {
          case EcosystemType.Pine:
            trunkSwaySpeed = baseSpeed * 0.85;
            trunkSwayAmt = 0.015 * windAmtMult; // Rigid evergreen
            break;
          case EcosystemType.Oak:
            trunkSwaySpeed = baseSpeed * 0.7;
            trunkSwayAmt = 0.012 * windAmtMult; // Sturdy deep gnarled oak
            break;
          case EcosystemType.CherryBlossom:
            trunkSwaySpeed = baseSpeed * 1.2;
            trunkSwayAmt = 0.03 * windAmtMult; // Elegant leaning trunk
            break;
          case EcosystemType.Maple:
            trunkSwaySpeed = baseSpeed * 1.1;
            trunkSwayAmt = 0.024 * windAmtMult; // Mid flexibility
            break;
          case EcosystemType.Redwood:
            trunkSwaySpeed = baseSpeed * 0.5;
            trunkSwayAmt = 0.005 * windAmtMult; // Redwood titan, trunk is almost still
            break;
          case EcosystemType.Bonsai:
            trunkSwaySpeed = baseSpeed * 1.5;
            trunkSwayAmt = 0.012 * windAmtMult; // Small scale, sways fast but tightly
            break;
          case EcosystemType.Willow:
            trunkSwaySpeed = baseSpeed * 1.1;
            trunkSwayAmt = 0.03 * windAmtMult; // Elegant easy sway
            break;
          case EcosystemType.Baobab:
            trunkSwaySpeed = baseSpeed * 0.35;
            trunkSwayAmt = 0.003 * windAmtMult; // Huge fat resilient baobab trunk, virtually static
            break;
          case EcosystemType.Jacaranda:
            trunkSwaySpeed = baseSpeed * 1.0;
            trunkSwayAmt = 0.018 * windAmtMult;
            break;
          case EcosystemType.Alder:
            trunkSwaySpeed = baseSpeed * 1.15;
            trunkSwayAmt = 0.026 * windAmtMult;
            break;
          case EcosystemType.Acacia:
            trunkSwaySpeed = baseSpeed * 1.05;
            trunkSwayAmt = 0.02 * windAmtMult;
            break;
          case EcosystemType.Birch:
            trunkSwaySpeed = baseSpeed * 1.25;
            trunkSwayAmt = 0.038 * windAmtMult; // Slender birch sways relatively easily
            break;
          case EcosystemType.Bamboo:
            trunkSwaySpeed = baseSpeed * 1.6;
            trunkSwayAmt = 0.05 * windAmtMult; // Whispy bendy bamboo sways extensively
            break;
          case EcosystemType.Cypress:
            trunkSwaySpeed = baseSpeed * 0.9;
            trunkSwayAmt = 0.015 * windAmtMult; // Rigid vertical swamp cypress
            break;
          case EcosystemType.Peepal:
            trunkSwaySpeed = baseSpeed * 0.95;
            trunkSwayAmt = 0.02 * windAmtMult; // Moderately graceful sways
            break;
          case EcosystemType.Neem:
            trunkSwaySpeed = baseSpeed * 1.1;
            trunkSwayAmt = 0.028 * windAmtMult; // Flexible feathery sways
            break;
          case EcosystemType.Banyan:
            trunkSwaySpeed = baseSpeed * 0.6;
            trunkSwayAmt = 0.006 * windAmtMult; // Stubborn multi-root giant barely sways
            break;
          case EcosystemType.DeadTree:
            trunkSwaySpeed = baseSpeed * 0.4;
            trunkSwayAmt = 0.004 * windAmtMult; // Stiff decaying stump
            break;
        }
      }

      // Gentle compound physical sway with multi-axis offsets under dynamic gust force
      groupRef.current.rotation.z = Math.sin(time * trunkSwaySpeed + hash * 10) * trunkSwayAmt * gustStrength;
      groupRef.current.rotation.x = Math.cos(time * trunkSwaySpeed * 0.85 + hash * 5) * (trunkSwayAmt * 0.35) * gustStrength;
    }

    // 2. CANOPY (LEAVES) SWAY - Independent fluttering and rustling
    if (canopyRef.current) {
      let leavesSwaySpeed = baseSpeed * 1.4;
      let leavesSwayAmt = 0.03 * windAmtMult;
      
      switch (type) {
        case EcosystemType.Pine:
          leavesSwaySpeed = baseSpeed * 1.25;
          leavesSwayAmt = 0.02 * windAmtMult;
          break;
        case EcosystemType.Oak:
          leavesSwaySpeed = baseSpeed * 0.9;
          leavesSwayAmt = 0.032 * windAmtMult;
          break;
        case EcosystemType.CherryBlossom:
          leavesSwaySpeed = baseSpeed * 1.6;
          leavesSwayAmt = 0.06 * windAmtMult; // Floppy pink blossoms flutter deeply
          break;
        case EcosystemType.Maple:
          leavesSwaySpeed = baseSpeed * 1.8;
          leavesSwayAmt = 0.05 * windAmtMult; // Maple leaves flutter at high frequency
          break;
        case EcosystemType.Redwood:
          leavesSwaySpeed = baseSpeed * 0.8;
          leavesSwayAmt = 0.025 * windAmtMult; // Gentle swaying at great height
          break;
        case EcosystemType.Bonsai:
          leavesSwaySpeed = baseSpeed * 1.4;
          leavesSwayAmt = 0.012 * windAmtMult; // Tiny foliage pads rustle slightly
          break;
        case EcosystemType.Willow:
          leavesSwaySpeed = baseSpeed * 2.1;
          leavesSwayAmt = 0.065 * windAmtMult; // Drooping limbs swing heavily and fast
          break;
        case EcosystemType.Baobab:
          leavesSwaySpeed = baseSpeed * 0.7;
          leavesSwayAmt = 0.018 * windAmtMult; // Compact top umbrellas move slowly
          break;
        case EcosystemType.Jacaranda:
          leavesSwaySpeed = baseSpeed * 1.5;
          leavesSwayAmt = 0.045 * windAmtMult; // purple petals waving
          break;
        case EcosystemType.Alder:
          leavesSwaySpeed = baseSpeed * 1.65;
          leavesSwayAmt = 0.038 * windAmtMult; // Light oval-leaf fluttering
          break;
        case EcosystemType.Acacia:
          leavesSwaySpeed = baseSpeed * 1.3;
          leavesSwayAmt = 0.024 * windAmtMult; // Flat umbrella rustling
          break;
        case EcosystemType.Birch:
          leavesSwaySpeed = baseSpeed * 1.7;
          leavesSwayAmt = 0.045 * windAmtMult; // Rustling fluttering white-bark leaves
          break;
        case EcosystemType.Bamboo:
          leavesSwaySpeed = baseSpeed * 2.3;
          leavesSwayAmt = 0.06 * windAmtMult; // Whispy bamboo feathers rustling at high rate
          break;
        case EcosystemType.Cypress:
          leavesSwaySpeed = baseSpeed * 1.1;
          leavesSwayAmt = 0.02 * windAmtMult; // Rigid dense cypress conifer
          break;
        case EcosystemType.Peepal:
          leavesSwaySpeed = baseSpeed * 1.9;
          leavesSwayAmt = 0.05 * windAmtMult; // Broad fluttering heart leaves
          break;
        case EcosystemType.Neem:
          leavesSwaySpeed = baseSpeed * 2.1;
          leavesSwayAmt = 0.045 * windAmtMult; // Rapid fluttering feathery leaves
          break;
        case EcosystemType.Banyan:
          leavesSwaySpeed = baseSpeed * 0.8;
          leavesSwayAmt = 0.015 * windAmtMult; // Heavy sturdy canopy rustling
          break;
        case EcosystemType.DeadTree:
          leavesSwaySpeed = baseSpeed * 0.5;
          leavesSwayAmt = 0.001 * windAmtMult;
          break;
      }

      // Phase delay relative to main trunk + high frequency micro-vibrations
      const flutter = Math.sin(time * 5.0 + hash * 12) * (0.006 * windAmtMult) * gustStrength;
      canopyRef.current.rotation.z = Math.sin(time * leavesSwaySpeed + hash * 7) * leavesSwayAmt * gustStrength + flutter;
      canopyRef.current.rotation.x = Math.cos(time * leavesSwaySpeed * 1.1 + hash * 4) * (leavesSwayAmt * 0.45) * gustStrength + flutter;

      // Organic stretching & compression to simulate wind aerodynamic pressure
      const scaleSway = 1.0 + Math.sin(time * leavesSwaySpeed * 0.4 + hash) * (0.015 * windAmtMult * gustStrength);
      canopyRef.current.scale.set(scaleSway, 2.0 - scaleSway, scaleSway);
    }

    // 3. SECONDARY BRANCHES / LIMBS SWAY
    if (branchRef.current) {
      let branchSwaySpeed = baseSpeed * 1.3;
      let branchSwayAmt = 0.045 * windAmtMult * gustStrength;
      
      if (growthStage === 2) { // Sapling branch is lightweight
        branchSwaySpeed = baseSpeed * 1.7;
        branchSwayAmt = 0.075 * windAmtMult * gustStrength;
      }

      branchRef.current.rotation.z = Math.sin(time * branchSwaySpeed + hash * 5) * branchSwayAmt;
      branchRef.current.rotation.x = Math.cos(time * branchSwaySpeed * 0.9 + hash * 2) * (branchSwayAmt * 0.35);
    }

    if (branch2Ref.current) {
      const branchSwaySpeed = baseSpeed * 1.25;
      const branchSwayAmt = 0.04 * windAmtMult * gustStrength;
      
      // Mirroring out-of-phase movement relative to branch 1
      branch2Ref.current.rotation.z = Math.sin(time * branchSwaySpeed + hash * 8 + Math.PI / 2) * branchSwayAmt;
      branch2Ref.current.rotation.x = Math.cos(time * branchSwaySpeed * 0.95 + hash * 3) * (branchSwayAmt * 0.4);
    }

    // 4. SPROUT COTYLEDON LEAVES VIBRATION / SHAKE
    if (leavesRef1.current) {
      leavesRef1.current.rotation.z = -Math.PI / 5 + Math.sin(time * baseSpeed * 2.3 + hash * 3) * (0.075 * windAmtMult * gustStrength);
    }
    if (leavesRef2.current) {
      leavesRef2.current.rotation.z = Math.PI / 5 + Math.cos(time * baseSpeed * 2.3 + hash * 9) * (0.075 * windAmtMult * gustStrength);
    }
  });

  const baseHeightOffset = -0.3; // Sit on ground pile

  return (
    <>
    <group ref={groupRef} position={[0, baseHeightOffset, 0]} scale={[0.01, 0.01, 0.01]}>
      {/* 0. Dead Tree Stump with Dynamic Mushrooms and Glowing Spores */}
      {type === EcosystemType.DeadTree && (
        <group rotation={[0, rotation, 0]}>
          {/* Broken tilted decaying trunk stump */}
          <group rotation={[0.2, 0, 0.25]}>
            <mesh castShadow receiveShadow geometry={cylinderGeo} material={deadWoodMaterial} position={[0, 0.35, 0]} scale={[0.18, 0.7, 0.18]} />
          </group>
          <group rotation={[-0.25, 0.4, -0.3]}>
            <mesh castShadow receiveShadow geometry={cylinderGeo} material={deadWoodMaterial} position={[0.18, 0.18, 0.1]} scale={[0.11, 0.4, 0.11]} />
          </group>
          
          {/* Decorative decomposer elements & nutrient release pulses */}
          <DecompositionAccents progress={growthProgress} x={x} y={y} />
        </group>
      )}

      {/* 1. Sprout Stage Architecture (Species-specific colorful seed bud hints) */}
      {type !== EcosystemType.DeadTree && growthStage === 1 && (() => {
        // Soft sprout helper matching species tint at structural tips
        let sproutTipColor = '#a7f3d0'; // default mint glow
        if (type === EcosystemType.CherryBlossom) sproutTipColor = '#fda4af';
        else if (type === EcosystemType.Jacaranda) sproutTipColor = '#d8b4fe';
        else if (type === EcosystemType.Maple) sproutTipColor = '#fca5a5';
        else if (type === EcosystemType.Acacia) sproutTipColor = '#fef08a';
        else if (type === EcosystemType.Peepal) sproutTipColor = '#86efac';
        else if (type === EcosystemType.Neem) sproutTipColor = '#4ade80';
        else if (type === EcosystemType.Banyan) sproutTipColor = '#fcd34d';

        return (
          <group>
            {/* Micro stem */}
            <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.1, 0]} scale={[0.08, 0.3, 0.08]} />
            {/* Two tiny cotyledon leaves */}
            <mesh ref={leavesRef1} castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[0.08, 0.22, 0]} scale={[0.11, 0.18, 0.11]} rotation={[0, 0, -Math.PI / 5]} />
            <mesh ref={leavesRef2} castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[-0.08, 0.22, 0]} scale={[0.11, 0.18, 0.11]} rotation={[0, 0, Math.PI / 5]} />
            {/* Tiny glowing species-specific spore on sprout */}
            <mesh position={[0, 0.3, 0]} scale={0.055}>
              <sphereGeometry />
              <meshBasicMaterial color={sproutTipColor} />
            </mesh>
          </group>
        );
      })()}

      {/* 2. Sapling Stage (Highly styled species-specific silhouette for smoother visual progression) */}
      {type !== EcosystemType.DeadTree && growthStage === 2 && (() => {
        const miniCanopyPos = 0.55;
        switch (type) {
          case EcosystemType.Pine:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Thin vertical trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.11, 0.58, 0.11]} />
                {/* Single mini conifer cone cap */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[0, 0.16, 0]} scale={[0.42, 0.55, 0.42]} />
                </group>
              </group>
            );

          case EcosystemType.Oak:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Balanced seedling wood trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.13, 0.58, 0.13]} />
                {/* Small dual leaf-clumps */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.1, 0]} scale={[0.40, 0.40, 0.40]} />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0.14, -0.05, 0.08]} scale={[0.24, 0.24, 0.24]} />
                </group>
              </group>
            );

          case EcosystemType.CherryBlossom:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Slightly elegant leaning trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0.02, 0.22, 0]} scale={[0.11, 0.58, 0.11]} rotation={[0.05, 0, 0.05]} />
                {/* Pink blossom puff */}
                <group ref={canopyRef} position={[0.05, miniCanopyPos, 0.05]} scale={0.9}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.1, 0]} scale={[0.42, 0.38, 0.42]} />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[-0.14, 0.02, -0.1]} scale={[0.28, 0.24, 0.28]} />
                </group>
              </group>
            );

          case EcosystemType.Maple:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.24, 0]} scale={[0.11, 0.62, 0.11]} />
                {/* Tiny maple dual cone caps */}
                <group ref={canopyRef} position={[0, miniCanopyPos + 0.05, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.38, 0.48, 0.38]} />
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[0, 0.32, 0]} scale={[0.26, 0.36, 0.26]} />
                </group>
              </group>
            );

          case EcosystemType.Redwood:
            return (
              <group>
                {/* Stout early titan pillar */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.3, 0]} scale={[0.15, 0.72, 0.15]} />
                <group ref={canopyRef} position={[0, 0.62, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.45, 0.45, 0.45]} />
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[0, 0.32, 0]} scale={[0.35, 0.42, 0.35]} />
                </group>
              </group>
            );

          case EcosystemType.Bonsai:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* S-shaped mini twisted stem */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.14, 0]} scale={[0.09, 0.32, 0.09]} rotation={[0.15, 0, 0.2]} />
                <group ref={canopyRef} position={[0.05, 0.28, -0.02]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.24, 0.11, 0.24]} />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[-0.08, -0.02, 0.06]} scale={[0.15, 0.08, 0.15]} />
                </group>
              </group>
            );

          case EcosystemType.Willow:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.11, 0.58, 0.11]} />
                {/* Drooping weeping hair cylinder */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.4, 0.34, 0.4]} />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} position={[0.14, -0.1, 0.08]} scale={[0.12, 0.34, 0.12]} />
                </group>
              </group>
            );

          case EcosystemType.Baobab:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Early bottle shape swelling stem */}
                <mesh castShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.2, 0]} scale={[0.25, 0.45, 0.25]} />
                <mesh castShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.42, 0]} scale={[0.16, 0.22, 0.16]} />
                {/* Small umbrella foliage */}
                <group ref={canopyRef} position={[0, miniCanopyPos + 0.02, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.34, 0.22, 0.34]} />
                </group>
              </group>
            );

          case EcosystemType.Jacaranda:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.12, 0.58, 0.12]} />
                {/* Purple floral splash mini */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.08, 0]} scale={[0.42, 0.40, 0.42]} />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[-0.14, -0.04, 0.12]} scale={[0.28, 0.26, 0.28]} />
                </group>
              </group>
            );

          case EcosystemType.Alder:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.12, 0.58, 0.12]} />
                {/* Dual stacked light green ovals */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.06, 0]} scale={[0.38, 0.48, 0.38]} />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0.08, 0.22, 0.06]} scale={[0.26, 0.34, 0.26]} />
                </group>
              </group>
            );

          case EcosystemType.Acacia:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Early tilted twig */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0.02, 0.2, 0]} scale={[0.11, 0.52, 0.11]} rotation={[0.06, 0, 0.06]} />
                {/* Early flat savanna disk canopy */}
                <group ref={canopyRef} position={[0.06, miniCanopyPos - 0.08, 0.04]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.62, 0.12, 0.62]} />
                </group>
              </group>
            );

          case EcosystemType.Birch:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Slender white birch trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.08, 0.58, 0.08]} />
                {/* Whispy green canopy cluster */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.06, 0]} scale={[0.34, 0.44, 0.34]} />
                </group>
              </group>
            );

          case EcosystemType.Bamboo:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Slender segment rod */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.25, 0]} scale={[0.05, 0.65, 0.05]} />
                <group ref={canopyRef} position={[0, miniCanopyPos + 0.05, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.02, 0]} scale={[0.22, 0.32, 0.22]} />
                </group>
              </group>
            );

          case EcosystemType.Cypress:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Cypress straight vertical pole */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.13, 0.58, 0.13]} />
                {/* Columnar cone leaves */}
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} position={[0, 0.12, 0]} scale={[0.32, 0.58, 0.32]} />
                </group>
              </group>
            );

          case EcosystemType.Peepal:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.22, 0]} scale={[0.11, 0.58, 0.11]} />
                <group ref={canopyRef} position={[0, miniCanopyPos, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.08, 0]} scale={[0.42, 0.38, 0.42]} />
                </group>
              </group>
            );

          case EcosystemType.Neem:
            return (
              <group rotation={[0, rotation, 0]}>
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.25, 0]} scale={[0.1, 0.62, 0.1]} />
                <group ref={canopyRef} position={[0, miniCanopyPos + 0.05, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.05, 0]} scale={[0.36, 0.48, 0.36]} />
                </group>
              </group>
            );

          case EcosystemType.Banyan:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Thick main stem */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0, 0.20, 0]} scale={[0.16, 0.52, 0.16]} />
                {/* Micro aerial prop root twig */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0.08, 0.1, 0.04]} scale={[0.04, 0.24, 0.04]} />
                <group ref={canopyRef} position={[0, miniCanopyPos - 0.04, 0]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} position={[0, 0.06, 0]} scale={[0.55, 0.30, 0.55]} />
                </group>
              </group>
            );

          default:
            return null;
        }
      })()}

      {/* 3 & 4. Mature and Ancient Species-Specific Visual Profiles (High Procedural Instancing Variation) */}
      {growthStage >= 3 && (() => {
        const isAncient = growthStage === 4;
        
        // Colossal scaling multipliers for Ancient titan structures
        const trunkScaleMultiplier = isAncient ? 1.60 : 1.0;
        const canopyScaleMultiplier = isAncient ? 1.50 : 1.0;
        
        switch (type) {
          case EcosystemType.Pine:
            return (
              <group>
                {/* Coniferous Columnar Trunk with organic thickness jitter */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.4 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.18 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    1.1 * trunkScaleMultiplier * (0.92 + h2 * 0.16), 
                    0.18 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                />
                
                {/* Coniferous side branches for extra ancient details */}
                {isAncient && (
                  <group>
                    <mesh castShadow geometry={cylinderGeo} material={barkMaterial} position={[0.15, 0.5, 0.15]} scale={[0.06, 0.35, 0.06]} rotation={[0.6, 0, 0.6]} />
                    <mesh castShadow geometry={cylinderGeo} material={barkMaterial} position={[-0.15, 0.7, -0.15]} scale={[0.05, 0.30, 0.05]} rotation={[-0.6, 0, -0.6]} />
                  </group>
                )}
                
                {/* Tapering Stacked Evergreen Cones with procedural offset, vertical spacing, and random rotation offsets */}
                <group ref={canopyRef} position={[0, 0.8 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* First bottom layer */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[(h3 - 0.5) * 0.06, 0.2, (h4 - 0.5) * 0.06]} 
                    scale={[0.7 * (0.9 + h1 * 0.2), 0.8 * (0.9 + h2 * 0.2), 0.7 * (0.9 + h1 * 0.2)]} 
                    rotation={[0, h5 * Math.PI * 2, 0]} 
                  />
                  {/* Second middle layer */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[(h4 - 0.5) * 0.06, 0.6, (h5 - 0.5) * 0.06]} 
                    scale={[0.55 * (0.9 + h3 * 0.2), 0.7 * (0.9 + h4 * 0.2), 0.55 * (0.9 + h3 * 0.2)]} 
                    rotation={[0, h2 * Math.PI * 2, 0]} 
                  />
                  {/* Third top layer */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[(h5 - 0.5) * 0.06, 1.0, (h1 - 0.5) * 0.06]} 
                    scale={[0.4 * (0.9 + h5 * 0.2), 0.55 * (0.9 + h1 * 0.2), 0.4 * (0.9 + h5 * 0.2)]} 
                    rotation={[0, h3 * Math.PI * 2, 0]} 
                  />
                  {/* Fourth apex layer present only for ancient trees */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                      position={[0, 1.34, 0]} 
                      scale={[0.26 * (0.9 + h1 * 0.2), 0.4 * (0.92 + h3 * 0.16), 0.26 * (0.9 + h1 * 0.2)]} 
                      rotation={[0, h4 * Math.PI * 2, 0]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Oak:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Ancient Giant Gnarled Sturdy Trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.5 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.32 * trunkScaleMultiplier * (0.92 + h2 * 0.16), 
                    1.2 * trunkScaleMultiplier, 
                    0.32 * trunkScaleMultiplier * (0.92 + h2 * 0.16)
                  ]} 
                />
                
                {/* Flared root buttress elements for Ancient Oak titan trunks */}
                {isAncient && (
                  <group>
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[0.18, 0.15, 0.05]} 
                      scale={[0.14, 0.4, 0.14]} 
                      rotation={[0, 0, -0.32]} 
                    />
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[-0.15, 0.15, -0.12]} 
                      scale={[0.13, 0.38, 0.13]} 
                      rotation={[0.2, 0, 0.28]} 
                    />
                  </group>
                )}
                
                {/* Secondary side limbs with organic angles */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.2 + (h1-0.5)*0.08, 0.8, 0.2]} 
                  scale={[0.12 * (0.9+h3*0.2), 0.5 * (0.85+h4*0.3), 0.12]} 
                  rotation={[Math.PI / 6 + (h2-0.5)*0.2, 0, Math.PI / 6 + (h5-0.5)*0.2]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.2, 0.8, -0.2 - (h2-0.5)*0.08]} 
                  scale={[0.12, 0.5 * (0.85+h1*0.3), 0.12 * (0.9+h3*0.2)]} 
                  rotation={[-Math.PI / 6 + (h4-0.5)*0.15, 0, -Math.PI / 6 + (h1-0.5)*0.15]} 
                />
                
                {/* Ancient Oak gets a 3rd custom gnarled horizontal branch */}
                {isAncient && (
                  <mesh castShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[0, 1.0, -0.3]} 
                    scale={[0.09, 0.46, 0.09]} 
                    rotation={[-0.2, Math.PI/2, Math.PI/3 + (h4)*0.25]} 
                  />
                )}
                
                {/* Dome-like majestic leafy canopy spheres with multi-direction random spacing & diameter offsets */}
                <group ref={canopyRef} position={[0, 1.2 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Sphere 1 - Center Core */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[(h1-0.5)*0.1, 0.2, (h2-0.5)*0.1]} 
                    scale={[0.75 * (0.9 + h3*0.2), 0.75 * (0.88 + h4*0.24), 0.75 * (0.9 + h3*0.2)]} 
                  />
                  {/* Sphere 2 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.25 + (h2-0.5)*0.1, 0.5 + (h3-0.5)*0.08, 0.15]} 
                    scale={[0.55 * (0.9 + h4*0.2), 0.55 * (0.9 + h5*0.2), 0.55 * (0.9 + h1*0.2)]} 
                  />
                  {/* Sphere 3 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.25, 0.45 - (h1-0.5)*0.08, -0.1 + (h4-0.5)*0.12]} 
                    scale={[0.55 * (0.92 + h5*0.16), 0.55 * (0.92 + h2*0.16), 0.55 * (0.92 + h3*0.16)]} 
                  />
                  {/* Sphere 4 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.1 - (h5-0.5)*0.1, 0.5, -0.3 + (h1-0.5)*0.1]} 
                    scale={[0.48 * (0.9 + h2*0.2), 0.48 * (0.9 + h3*0.2), 0.48 * (0.9 + h4*0.2)]} 
                  />
                  {/* Sphere 5 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.15, 0.6 + (h5-0.5)*0.05, 0.2]} 
                    scale={[0.5 * (0.9 + h1*0.2), 0.5 * (0.9 + h2*0.2), 0.5 * (0.9 + h3*0.2)]} 
                  />
                  {/* Extra 6th sphere at crown top for ancient oaks */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[(h2-0.5)*0.1, 0.85, (h4-0.5)*0.1]} 
                      scale={[0.38 * (0.92 + h1*0.16), 0.38 * (0.92 + h5*0.16), 0.38 * (0.92 + h2*0.16)]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.CherryBlossom:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Sculpted elegant leaning trunk with organic tilt adjustments */}
                <group position={[0, 0.5 * trunkScaleMultiplier, 0]} rotation={[0.1 + (h1 - 0.5) * 0.05, 0, 0.1 + (h2 - 0.5) * 0.05]}>
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    scale={[
                      0.22 * trunkScaleMultiplier * (0.95 + h3 * 0.1), 
                      1.1 * trunkScaleMultiplier, 
                      0.22 * trunkScaleMultiplier * (0.95 + h3 * 0.1)
                    ]} 
                  />
                </group>
                
                {/* Splendiferous pink cloud fluff canopies */}
                <group ref={canopyRef} position={[0.1 * trunkScaleMultiplier, 1.1 * trunkScaleMultiplier, 0.1 * trunkScaleMultiplier]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Main puff */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[(h3-0.5)*0.1, (h4-0.5)*0.05, 0]} 
                    scale={[0.72 * (0.9 + h1*0.2), 0.65 * (0.92 + h2*0.16), 0.72 * (0.9 + h1*0.2)]} 
                  />
                  {/* Side puff 1 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.3 + (h4-0.5)*0.1, 0.2, -0.2]} 
                    scale={[0.5 * (0.9 + h3*0.2), 0.45 * (0.9 + h5*0.2), 0.5 * (0.9 + h3*0.2)]} 
                  />
                  {/* Side puff 2 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.3, 0.15 + (h1-0.5)*0.05, 0.2 + (h5-0.5)*0.1]} 
                    scale={[0.55 * (0.9 + h2*0.2), 0.5 * (0.92 + h4*0.16), 0.55 * (0.9 + h2*0.2)]} 
                  />
                  {/* Side puff 3 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.1 + (h2-0.5)*0.1, 0.35, 0.25 - (h1-0.5)*0.05]} 
                    scale={[0.45 * (0.9 + h5*0.2), 0.4 * (0.9 + h1*0.2), 0.45 * (0.9 + h5*0.2)]} 
                  />
                  {/* Extra top puff for ancient sakura clouds */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[(h1-0.5)*0.2, 0.5, (h4-0.5)*0.1]} 
                      scale={[0.38 * (0.95+h5*0.1), 0.38 * (0.95+h5*0.1), 0.38 * (0.95+h5*0.1)]} 
                    />
                  )}
                  
                  {/* Decorative petal meshes scattered beneath cherry tree in coordinates jittered by hash */}
                  <mesh geometry={sphereGeo} material={leavesMaterial} position={[-0.32 + (h1-0.5)*0.2, -1.05 * trunkScaleMultiplier, 0.32 + (h2-0.5)*0.2]} scale={[0.15, 0.03, 0.1]} />
                  <mesh geometry={sphereGeo} material={leavesMaterial} position={[0.22 + (h3-0.5)*0.2, -1.05 * trunkScaleMultiplier, -0.22 + (h4-0.5)*0.2]} scale={[0.1, 0.02, 0.08]} />
                </group>
              </group>
            );

          case EcosystemType.Maple:
            return (
              <group rotation={[0, rotation + Math.PI/4, 0]}>
                {/* Slender aesthetic trunk line with organic scale jitter */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.5 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.2 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    1.2 * trunkScaleMultiplier, 
                    0.2 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                />
                
                {/* Pointy maple leaf modular shapes with randomized tilting coordinates */}
                <group ref={canopyRef} position={[0, 1.2 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[(h1-0.5)*0.08, 0.1, (h2-0.5)*0.08]} 
                    scale={[0.65 * (0.9 + h3 * 0.2), 0.8 * (0.9 + h4 * 0.2), 0.65 * (0.9 + h3 * 0.2)]} 
                  />
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 0.6 + (h3-0.5)*0.06, 0]} 
                    scale={[0.45 * (0.92 + h5 * 0.16), 0.64 * (0.88 + h1 * 0.24), 0.45 * (0.92 + h5 * 0.16)]} 
                  />
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0.22, 0.2, 0.22]} 
                    scale={[0.32 * (0.9 + h4*0.2), 0.45 * (0.9+h5*0.2), 0.32]} 
                    rotation={[0.2 + (h2-0.5)*0.1, 0, -0.2 - (h3-0.5)*0.1]} 
                  />
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[-0.22, 0.2, -0.22]} 
                    scale={[0.32, 0.45 * (0.9+h1*0.2), 0.32 * (0.9 + h5*0.2)]} 
                    rotation={[-0.2 - (h4-0.5)*0.1, 0, 0.2 + (h2-0.5)*0.1]} 
                  />
                  {/* Ancient Maples get a 5th apex cone crown */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                      position={[0, 0.95, 0]} 
                      scale={[0.28 * (0.9 + h4*0.2), 0.42 * (0.9 + h3*0.2), 0.28]} 
                      rotation={[0, h5 * Math.PI * 2, 0]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Redwood:
            return (
              <group>
                {/* Thick monumental Pillar Trunk with basal taper jitter */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.9 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.42 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    2.0 * trunkScaleMultiplier, 
                    0.42 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                />
                
                {/* Basal flare buttress rings/cylinders for Redwood giant trunks */}
                {isAncient && (
                  <group>
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[0.22, 0.25, 0.0]} 
                      scale={[0.18, 0.6, 0.18]} 
                      rotation={[0, 0, -0.18]} 
                    />
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[-0.15, 0.25, 0.15]} 
                      scale={[0.16, 0.55, 0.16]} 
                      rotation={[-0.1, 0, 0.15]} 
                    />
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[-0.05, 0.25, -0.22]} 
                      scale={[0.16, 0.58, 0.16]} 
                      rotation={[0.15, 0, 0.1]} 
                    />
                  </group>
                )}
                
                {/* Tall stacked majestic redwood tiered branch clusters with custom offsets and height distributions */}
                <group ref={canopyRef} position={[0, 1.3 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier * 1.25, canopyScaleMultiplier]}>
                  {/* Tier 1 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.1 + (h1-0.5)*0.08, 0]} 
                    scale={[0.8 * (0.9 + h2*0.2), 0.8 * (0.9 + h3*0.2), 0.8 * (0.9 + h2*0.2)]} 
                  />
                  {/* Tier 2 */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 0.6, 0]} 
                    scale={[0.65 * (0.9 + h3*0.2), 0.6 * (0.9 + h4*0.2), 0.65 * (0.9 + h3*0.2)]} 
                    rotation={[0, Math.PI / 5 + h1 * 0.5, 0]} 
                  />
                  {/* Tier 3 */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 1.1 + (h2-0.5)*0.05, 0]} 
                    scale={[0.5 * (0.92 + h5*0.16), 0.55 * (0.92 + h1*0.16), 0.5 * (0.92 + h5*0.16)]} 
                    rotation={[0, h2 * Math.PI, 0]}
                  />
                  {/* Tier 4 */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 1.5, 0]} 
                    scale={[0.35 * (0.9 + h1*0.2), 0.45 * (0.9 + h2*0.2), 0.35 * (0.9 + h1*0.2)]} 
                  />
                  {/* Extra Tier 5 for colossal Ancient titans */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                      position={[0, 1.86, 0]} 
                      scale={[0.22 * (0.9 + h5*0.2), 0.32 * (0.95 + h3*0.1), 0.22 * (0.9 + h5*0.2)]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Bonsai:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Small stylized gnarled trunk with leaning offsets */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.15 * trunkScaleMultiplier, 0]} 
                  scale={[0.1 * trunkScaleMultiplier, 0.3 * trunkScaleMultiplier, 0.1 * trunkScaleMultiplier]} 
                  rotation={[0.15 + (h1-0.5)*0.1, 0, 0.2 + (h2-0.5)*0.1]} 
                />
                {/* Gnarled twisted secondary trunk branch */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.07, 0.28 * trunkScaleMultiplier, 0.05]} 
                  scale={[0.06, 0.2 * (0.9+h3*0.2), 0.06]} 
                  rotation={[-0.4 + (h4-0.5)*0.1, 0.3, -Math.PI / 3 + (h5-0.5)*0.1]} 
                />
                
                {/* Tiny refined aesthetic leaf pads with procedural scale and rotation */}
                <group ref={canopyRef} position={[0.1 * canopyScaleMultiplier, 0.38 * canopyScaleMultiplier, -0.05]} scale={[0.8 * canopyScaleMultiplier, 0.8 * canopyScaleMultiplier, 0.8 * canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.05, 0]} 
                    scale={[0.25 * (0.9 + h1*0.2), 0.12 * (0.9 + h2*0.2), 0.25]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.15 + (h3-0.5)*0.05, -0.04, 0.1]} 
                    scale={[0.18 * (0.92 + h4*0.16), 0.08, 0.18]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.15, 0.12 + (h5-0.5)*0.02, -0.1]} 
                    scale={[0.15, 0.08, 0.15 * (0.9 + h1*0.2)]} 
                  />
                  {/* Extra pad for ancient bonsai */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[-0.05, 0.2, 0.08]} 
                      scale={[0.12, 0.06, 0.12]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Willow:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Elegant split-trunk curved setup */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.45 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.16 * trunkScaleMultiplier * (0.95 + h1 * 0.1), 
                    1.0 * trunkScaleMultiplier, 
                    0.16 * trunkScaleMultiplier * (0.95 + h1 * 0.1)
                  ]} 
                  rotation={[0, 0, 0.08 + (h2-0.5)*0.04]} 
                />
                
                {/* Slender drooping limb indicators */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.18, 0.75, 0]} 
                  scale={[0.08, 0.4 * (0.9+h3*0.2), 0.08]} 
                  rotation={[0, 0, -Math.PI / 3 + (h4-0.5)*0.1]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.18, 0.72, 0]} 
                  scale={[0.08, 0.4 * (0.9+h5*0.2), 0.08]} 
                  rotation={[0, 0, Math.PI / 3 - (h1-0.5)*0.1]} 
                />

                {/* Sweeping weeping canopy (drooping cones and long capsules) with jittered length offsets */}
                <group ref={canopyRef} position={[0, 0.95 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Undercoat sphere */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.1, 0]} 
                    scale={[0.62 * (0.9 + h1*0.2), 0.52 * (0.9 + h2*0.2), 0.62]} 
                  />
                  {/* Weeping willow hair cylinders with height-scaling variability */}
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} 
                    position={[0.3 + (h2-0.5)*0.05, -0.2, 0.2]} 
                    scale={[0.16, 0.55 * (0.8 + h3*0.4), 0.16]} 
                    rotation={[0.1, 0, 0.05]} 
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} 
                    position={[-0.3, -0.2, -0.2 - (h4-0.5)*0.05]} 
                    scale={[0.16, 0.55 * (0.8 + h5*0.4), 0.16]} 
                    rotation={[-0.1, 0, -0.05]} 
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} 
                    position={[0.2, -0.22, -0.3]} 
                    scale={[0.15, 0.48 * (0.8 + h1*0.4), 0.15]} 
                    rotation={[-0.05, 0, 0.1]} 
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} 
                    position={[-0.2, -0.22, 0.3]} 
                    scale={[0.15, 0.48 * (0.8 + h2*0.4), 0.15]} 
                    rotation={[0.05, 0, -0.1]} 
                  />
                  
                  {/* Ancient willows sprout 2 more drooping curtain strands */}
                  {isAncient && (
                    <group>
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} position={[0.4, -0.22, -0.1]} scale={[0.12, 0.62 * (0.9+h3*0.2), 0.12]} rotation={[0.05, 0, 0.12]} />
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={leavesMaterial} position={[-0.4, -0.22, 0.1]} scale={[0.12, 0.62 * (0.9+h4*0.2), 0.12]} rotation={[-0.05, 0, -0.12]} />
                    </group>
                  )}
                </group>
              </group>
            );

          case EcosystemType.Baobab:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Colossal thick bottle-shaped Baobab trunk lower and upper neck with girth jitter */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.3 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.55 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    0.7 * trunkScaleMultiplier, 
                    0.55 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                />
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.75 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.38 * trunkScaleMultiplier * (0.94 + h2 * 0.12), 
                    0.5 * trunkScaleMultiplier, 
                    0.38 * trunkScaleMultiplier * (0.94 + h2 * 0.12)
                  ]} 
                />
                
                {/* Ancient Baobab stout creeping surface root anchors */}
                {isAncient && (
                  <group>
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[0.38, 0.1, 0.2]} 
                      scale={[0.18, 0.35, 0.18]} 
                      rotation={[Math.PI/2 - 0.2, 0.6, 0]} 
                    />
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[-0.38, 0.1, -0.2]} 
                      scale={[0.16, 0.32, 0.16]} 
                      rotation={[-Math.PI/2 + 0.2, -0.6, 0]} 
                    />
                  </group>
                )}
                
                {/* Tiny gnarled limbs branching outwards at the very top */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.2, 0.9 * trunkScaleMultiplier, 0.1]} 
                  scale={[0.12, 0.4 * (0.85+h3*0.3), 0.12]} 
                  rotation={[Math.PI/4 + (h4-0.5)*0.2, 0, Math.PI/4]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.2, 0.9 * trunkScaleMultiplier, -0.1]} 
                  scale={[0.12, 0.4, 0.12]} 
                  rotation={[-Math.PI/4, 0, -Math.PI/4 - (h5-0.5)*0.2]} 
                />

                {/* Small compact leafy umbrellas at the topmost branch endpoints with jittered positions */}
                <group ref={canopyRef} position={[0, 1.15 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.1, 0]} 
                    scale={[0.48 * (0.9 + h1*0.2), 0.32, 0.48]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.28 + (h2-0.5)*0.08, 0.02, 0.15]} 
                    scale={[0.35, 0.22 * (0.9+h3*0.2), 0.35]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.28, 0.02 - (h4-0.5)*0.05, -0.15]} 
                    scale={[0.35 * (0.92 + h5*0.16), 0.22, 0.35]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.1, 0.08, 0.2 + (h1-0.5)*0.06]} 
                    scale={[0.3 * (0.9 + h2*0.2), 0.2 * (0.9 + h3*0.2), 0.3]} 
                  />
                </group>
              </group>
            );

          case EcosystemType.Jacaranda:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Tall majestic split trunk with diameter randomness */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.5 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.22 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    1.2 * trunkScaleMultiplier, 
                    0.22 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                />
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.22, 0.8, 0.1]} 
                  scale={[0.11, 0.6 * (0.85+h2*0.3), 0.11]} 
                  rotation={[0.4 + (h3-0.5)*0.1, 0.1, 0.4]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.22, 0.8, -0.1]} 
                  scale={[0.11, 0.6, 0.11]} 
                  rotation={[-0.4, -0.1, -0.4 - (h4-0.5)*0.1]} 
                />
                
                {/* Expansive cloud puffs for purple jacaranda blossoms with organic scaling */}
                <group ref={canopyRef} position={[0, 1.35 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.2, 0]} 
                    scale={[0.72 * (0.9 + h3*0.2), 0.68 * (0.92 + h4*0.16), 0.72]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.32 + (h5-0.5)*0.1, 0.02, 0.2]} 
                    scale={[0.55 * (0.9 + h1*0.2), 0.5, 0.55]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.32, 0.05, -0.2 - (h2-0.5)*0.1]} 
                    scale={[0.55, 0.5 * (0.92 + h3*0.16), 0.55 * (0.9 + h4*0.2)]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.2, 0.35 + (h5-0.5)*0.05, 0.28]} 
                    scale={[0.48 * (0.9 + h2*0.2), 0.42, 0.48]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.2, 0.35, -0.28]} 
                    scale={[0.48, 0.42 * (0.9 + h1*0.2), 0.48]} 
                  />
                  {/* Ancient jacarandas get a 6th flower clump */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[0, 0.72, 0.1]} 
                      scale={[0.42 * (0.95+h5*0.1), 0.35, 0.42]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Alder:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Alder trunk with short side branching with scale variations */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.45 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.2 * trunkScaleMultiplier * (0.93 + h1 * 0.14), 
                    1.1 * trunkScaleMultiplier, 
                    0.2 * trunkScaleMultiplier * (0.93 + h1 * 0.14)
                  ]} 
                />
                
                {/* Clean columnar stacked light green ovals with height-scaling variability */}
                <group ref={canopyRef} position={[0, 1.1 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[(h1-0.5)*0.05, 0.1, (h2-0.5)*0.05]} 
                    scale={[0.62 * (0.9 + h3*0.2), 0.75 * (0.88 + h4*0.24), 0.62]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.15, 0.4 + (h3-0.5)*0.05, 0.15]} 
                    scale={[0.48 * (0.9 + h5*0.2), 0.55, 0.48 * (0.9 + h1*0.2)]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.15, 0.3, -0.15 - (h2-0.5)*0.05]} 
                    scale={[0.44 * (0.92 + h5*0.16), 0.5 * (0.9 + h1*0.2), 0.44]} 
                  />
                  {/* Ancient Alders get another top crown cluster */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[0, 0.72, 0]} 
                      scale={[0.34 * (0.95+h2*0.1), 0.42, 0.34]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Acacia:
            return (
              <group rotation={[0, rotation, 0]}>
                {/* Slightly tilted savanna style Acacia trunk with organic tilt variations */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.05, 0.4 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.18 * trunkScaleMultiplier * (0.94 + h1 * 0.12), 
                    1.0 * trunkScaleMultiplier, 
                    0.18 * trunkScaleMultiplier * (0.94 + h1 * 0.12)
                  ]} 
                  rotation={[0.08 + (h3-0.5)*0.04, 0, 0.08 + (h5-0.5)*0.04]} 
                />
                {/* Sweeping branches */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.18, 0.7, 0.18]} 
                  scale={[0.1, 0.5 * (0.85+h2*0.3), 0.1]} 
                  rotation={[0.4, 0.3, 0.4 + (h4-0.5)*0.1]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.1, 0.7, -0.1]} 
                  scale={[0.09, 0.45 * (0.85+h1*0.3), 0.09]} 
                  rotation={[-Math.PI / 6, 0.2, -Math.PI / 6]} 
                />

                {/* Wide-spreading, double stack flat umbrella-like foliage disk arrays with procedural scale */}
                <group ref={canopyRef} position={[0.12 * trunkScaleMultiplier, 1.05 * trunkScaleMultiplier, 0.08]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Deep low-sitting umbrella plate */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.05, 0]} 
                    scale={[1.15 * (0.9 + h3*0.2), 0.14, 1.15 * (0.9 + h3*0.2)]} 
                  />
                  {/* Sub plate 1 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.3 + (h4-0.5)*0.08, 0.22, -0.2]} 
                    scale={[0.7 * (0.9 + h5*0.2), 0.12, 0.7]} 
                  />
                  {/* Sub plate 2 */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.3, 0.18, 0.2 + (h1-0.5)*0.08]} 
                    scale={[0.6 * (0.92 + h2*0.16), 0.12, 0.6]} 
                  />
                  {/* Extra flat plate for spectacular ancient savanna umbrella trees */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[-0.1, 0.32, -0.1]} 
                      scale={[0.55 * (0.95+h4*0.1), 0.10, 0.55]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Birch:
            return (
              <group rotation={[0, rotation + Math.PI/4, 0]}>
                {/* Slender main trunk with iconic silver color block */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.5 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.13 * trunkScaleMultiplier * (0.95 + h1 * 0.1), 
                    1.2 * trunkScaleMultiplier * (0.9 + h2 * 0.15), 
                    0.13 * trunkScaleMultiplier * (0.95 + h1 * 0.1)
                  ]} 
                />
                
                {/* Elegant swaying subsidiary branches */}
                <mesh ref={branchRef} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0.1, 0.7 * trunkScaleMultiplier, 0.1]} 
                  scale={[0.07, 0.45 * (0.9+h3*0.2), 0.07]} 
                  rotation={[0.3, 0.2, 0.4]} 
                />
                <mesh ref={branch2Ref} castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[-0.1, 0.9 * trunkScaleMultiplier, -0.1]} 
                  scale={[0.06, 0.38, 0.06]} 
                  rotation={[-0.3, 0.1, -0.4]} 
                />

                {/* Delicate airy light-green foliage canopies */}
                <group ref={canopyRef} position={[0, 1.25 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.1, 0]} 
                    scale={[0.55 * (0.9 + h1*0.2), 0.48 * (0.9 + h2*0.2), 0.55 * (0.9 + h1*0.2)]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.2, 0.25, 0.15]} 
                    scale={[0.38, 0.34, 0.38]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.2, 0.30, -0.15]} 
                    scale={[0.36, 0.32, 0.36]} 
                  />
                  {/* Ancient Birches get an extra high flutter cluster */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                      position={[0.05, 0.52, -0.05]} 
                      scale={[0.32, 0.28, 0.32]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Bamboo:
            return (
              <group rotation={[0, rotation + Math.PI/2, 0]}>
                {/* Segmented Bamboo shoots: Multi-stalk clumps for mature and ancient stages */}
                <group>
                  {/* Stalk 1 (Main) */}
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[0, 0.6 * trunkScaleMultiplier, 0]} 
                    scale={[
                      0.09 * trunkScaleMultiplier, 
                      1.3 * trunkScaleMultiplier, 
                      0.09 * trunkScaleMultiplier
                    ]} 
                  />
                  {/* Stalk 2 (Slightly tilted) */}
                  {(isAncient || h1 > 0.4) && (
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[0.15, 0.55 * trunkScaleMultiplier, 0.05]} 
                      scale={[
                        0.07 * trunkScaleMultiplier, 
                        1.2 * trunkScaleMultiplier * (0.9 + h2 * 0.15), 
                        0.07 * trunkScaleMultiplier
                      ]} 
                      rotation={[0.08, 0, -0.06]}
                    />
                  )}
                  {/* Stalk 3 (Slightly tilted, extra tall for Ancient titans) */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                      position={[-0.14, 0.65 * trunkScaleMultiplier, -0.1]} 
                      scale={[
                        0.065 * trunkScaleMultiplier, 
                        1.4 * trunkScaleMultiplier * (0.95 + h3 * 0.1), 
                        0.065 * trunkScaleMultiplier
                      ]} 
                      rotation={[-0.08, 0, 0.08]}
                    />
                  )}
                </group>

                {/* Whispy segmented leaf branches */}
                <group ref={canopyRef} position={[0, 1.15 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Main feather cone cluster */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.1, 0]} 
                    scale={[0.38, 0.58, 0.38]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.12, -0.15 * trunkScaleMultiplier, 0.1]} 
                    scale={[0.26, 0.36, 0.26]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.14, -0.22 * trunkScaleMultiplier, -0.08]} 
                    scale={[0.24, 0.34, 0.24]} 
                  />
                  {/* Extra ancient high wisps */}
                  {isAncient && (
                    <group>
                      <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                        position={[0.15, 0.30, -0.12]} 
                        scale={[0.22, 0.28, 0.22]} 
                      />
                      <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                        position={[-0.15, 0.26, 0.14]} 
                        scale={[0.20, 0.26, 0.20]} 
                      />
                    </group>
                  )}
                </group>
              </group>
            );

          case EcosystemType.Cypress:
            return (
              <group>
                {/* Columnar straight Trunk with extra wide base flare */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.55 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.24 * trunkScaleMultiplier * (0.95 + h1 * 0.1), 
                    1.3 * trunkScaleMultiplier, 
                    0.24 * trunkScaleMultiplier * (0.95 + h1 * 0.1)
                  ]} 
                />
                
                {/* Swollen root knees around the cypress base */}
                <group>
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0.18, 0.12, 0.12]} scale={[0.12, 0.26, 0.12]} rotation={[0.2, 0.1, 0.2]} />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[-0.18, 0.12, -0.12]} scale={[0.12, 0.26, 0.12]} rotation={[-0.2, -0.1, -0.2]} />
                  {isAncient && (
                    <group>
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[-0.18, 0.12, 0.18]} scale={[0.12, 0.26, 0.12]} rotation={[0.15, -0.12, -0.15]} />
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} position={[0.18, 0.12, -0.18]} scale={[0.12, 0.26, 0.12]} rotation={[-0.15, 0.12, 0.15]} />
                    </group>
                  )}
                </group>

                {/* Multiple rigid overlapping cone structures */}
                <group ref={canopyRef} position={[0, 0.85 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Level 1 Cone */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 0.2, 0]} 
                    scale={[0.55 * (0.9 + h2*0.2), 1.0 * (0.9 + h3*0.2), 0.55 * (0.9 + h2*0.2)]} 
                  />
                  {/* Level 2 Cone */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 0.65, 0]} 
                    scale={[0.42 * (0.95 + h4*0.1), 0.8 * (0.95 + h5*0.1), 0.42 * (0.95 + h4*0.1)]} 
                  />
                  {/* Level 3 Cone */}
                  <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                    position={[0, 1.05, 0]} 
                    scale={[0.30, 0.6, 0.30]} 
                  />
                  {/* Ancient Cypress crown height extension */}
                  {isAncient && (
                    <mesh castShadow receiveShadow geometry={coneGeo} material={leavesMaterial} 
                      position={[0, 1.45, 0]} 
                      scale={[0.18, 0.45, 0.18]} 
                    />
                  )}
                </group>
              </group>
            );

          case EcosystemType.Peepal:
            return (
              <group>
                {/* Branching Trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.55 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.20 * trunkScaleMultiplier * (0.95 + h1 * 0.1), 
                    1.2 * trunkScaleMultiplier, 
                    0.20 * trunkScaleMultiplier * (0.95 + h1 * 0.1)
                  ]} 
                />
                {/* Secondary branching forks */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial}
                  position={[0.18, 0.95 * trunkScaleMultiplier, 0.08]}
                  scale={[0.09 * trunkScaleMultiplier, 0.5 * trunkScaleMultiplier, 0.09 * trunkScaleMultiplier]}
                  rotation={[0.3, 0, 0.35]}
                />
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial}
                  position={[-0.18, 0.95 * trunkScaleMultiplier, -0.08]}
                  scale={[0.09 * trunkScaleMultiplier, 0.5 * trunkScaleMultiplier, 0.09 * trunkScaleMultiplier]}
                  rotation={[-0.3, 0, -0.35]}
                />

                {/* Overlapping Heart Canopies */}
                <group ref={canopyRef} position={[0, 1.15 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.2, 0]} 
                    scale={[0.62 * (0.9 + h2*0.1), 0.52 * (0.9 + h3*0.1), 0.62 * (0.9 + h2*0.1)]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.25, -0.05, 0.15]} 
                    scale={[0.42, 0.38, 0.42]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.25, -0.05, -0.15]} 
                    scale={[0.42, 0.38, 0.42]} 
                  />
                  {isAncient && (
                    <group>
                      <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                        position={[0, 0.55, 0]} 
                        scale={[0.38, 0.32, 0.38]} 
                      />
                    </group>
                  )}
                </group>
              </group>
            );

          case EcosystemType.Neem:
            return (
              <group>
                {/* Slender, multi-fork trunk */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.62 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.15 * trunkScaleMultiplier, 
                    1.4 * trunkScaleMultiplier, 
                    0.15 * trunkScaleMultiplier
                  ]} 
                />
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial}
                  position={[0.1, 1.0 * trunkScaleMultiplier, -0.05]}
                  scale={[0.07 * trunkScaleMultiplier, 0.6 * trunkScaleMultiplier, 0.07 * trunkScaleMultiplier]}
                  rotation={[0.18, 0.2, 0.42]}
                />
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial}
                  position={[-0.1, 1.0 * trunkScaleMultiplier, 0.05]}
                  scale={[0.07 * trunkScaleMultiplier, 0.6 * trunkScaleMultiplier, 0.07 * trunkScaleMultiplier]}
                  rotation={[-0.18, -0.2, -0.42]}
                />

                {/* Highly structured, multi-tiered feathery canopy */}
                <group ref={canopyRef} position={[0, 1.25 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.15, 0]} 
                    scale={[0.42, 0.46, 0.42]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.22, 0.35, -0.15]} 
                    scale={[0.26, 0.32, 0.26]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.22, 0.32, 0.15]} 
                    scale={[0.26, 0.32, 0.26]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.15, -0.12, 0.22]} 
                    scale={[0.3, 0.34, 0.3]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.15, -0.12, -0.22]} 
                    scale={[0.3, 0.34, 0.3]} 
                  />
                </group>
              </group>
            );

          case EcosystemType.Banyan:
            return (
              <group>
                {/* Thick massive central trunk core */}
                <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                  position={[0, 0.46 * trunkScaleMultiplier, 0]} 
                  scale={[
                    0.38 * trunkScaleMultiplier * (1.0 + h3 * 0.1), 
                    1.1 * trunkScaleMultiplier, 
                    0.38 * trunkScaleMultiplier * (1.0 + h3 * 0.1)
                  ]} 
                />

                {/* Fused aerial prop roots (4 pillar trunks around the periphery) */}
                <group>
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[0.24 * trunkScaleMultiplier, 0.38 * trunkScaleMultiplier, 0.15]} 
                    scale={[0.09 * trunkScaleMultiplier, 0.9 * trunkScaleMultiplier, 0.09 * trunkScaleMultiplier]} 
                    rotation={[0.04, 0, -0.06]}
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[-0.24 * trunkScaleMultiplier, 0.38 * trunkScaleMultiplier, -0.15]} 
                    scale={[0.09 * trunkScaleMultiplier, 0.9 * trunkScaleMultiplier, 0.09 * trunkScaleMultiplier]} 
                    rotation={[-0.04, 0, 0.06]}
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[-0.15, 0.38 * trunkScaleMultiplier, 0.24 * trunkScaleMultiplier]} 
                    scale={[0.08 * trunkScaleMultiplier, 0.9 * trunkScaleMultiplier, 0.08 * trunkScaleMultiplier]} 
                    rotation={[-0.04, 0, -0.04]}
                  />
                  <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                    position={[0.15, 0.38 * trunkScaleMultiplier, -0.24 * trunkScaleMultiplier]} 
                    scale={[0.08 * trunkScaleMultiplier, 0.9 * trunkScaleMultiplier, 0.08 * trunkScaleMultiplier]} 
                    rotation={[0.04, 0, 0.04]}
                  />
                  
                  {isAncient && (
                    <group>
                      {/* Secondary even wider aerial pillars for Ancient Banyan trees */}
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                        position={[0.42 * trunkScaleMultiplier, 0.3 * trunkScaleMultiplier, -0.32]} 
                        scale={[0.06 * trunkScaleMultiplier, 0.7 * trunkScaleMultiplier, 0.06 * trunkScaleMultiplier]} 
                        rotation={[0.1, 0, -0.15]}
                      />
                      <mesh castShadow receiveShadow geometry={cylinderGeo} material={barkMaterial} 
                        position={[-0.42 * trunkScaleMultiplier, 0.3 * trunkScaleMultiplier, 0.32]} 
                        scale={[0.06 * trunkScaleMultiplier, 0.7 * trunkScaleMultiplier, 0.06 * trunkScaleMultiplier]} 
                        rotation={[-0.1, 0, 0.15]}
                      />
                    </group>
                  )}
                </group>

                {/* Gigantic Sprawling Overlapping Canopies */}
                <group ref={canopyRef} position={[0, 0.85 * trunkScaleMultiplier, 0]} scale={[canopyScaleMultiplier, canopyScaleMultiplier, canopyScaleMultiplier]}>
                  {/* Central mammoth dome split */}
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0, 0.22, 0]} 
                    scale={[1.05 * trunkScaleMultiplier, 0.35, 1.05 * trunkScaleMultiplier]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.42, 0.08, 0.25]} 
                    scale={[0.62, 0.26, 0.62]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.42, 0.08, -0.25]} 
                    scale={[0.62, 0.26, 0.62]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[-0.32, 0.12, 0.4]} 
                    scale={[0.55, 0.24, 0.55]} 
                  />
                  <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                    position={[0.32, 0.12, -0.4]} 
                    scale={[0.55, 0.24, 0.55]} 
                  />
                  
                  {isAncient && (
                    <group>
                      {/* Enormous outer tier matching ancient national crown canopy extension */}
                      <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                        position={[0.7, -0.06, 0]} 
                        scale={[0.5, 0.22, 0.5]} 
                      />
                      <mesh castShadow receiveShadow geometry={sphereGeo} material={leavesMaterial} 
                        position={[-0.7, -0.06, 0]} 
                        scale={[0.5, 0.22, 0.5]} 
                      />
                    </group>
                  )}
                </group>
              </group>
            );

          default:
            return null;
        }
      })()}

      {/* 6. Canopy petals/leaves falling drift for autumnal/flowering types */}
      {growthStage >= 3 && (
        <CanopyPetalDrop type={type} canopyHeight={canopyHeight} x={x} y={y} hash={hash} />
      )}
    </group>
    {fallingTree && (
      <FallingTreeModel 
        type={fallingTree.type} 
        growthStage={fallingTree.stage} 
        startTime={fallingTree.startTime}
        x={x}
        y={y}
      />
    )}
    </>
  );
});

// --- 2. Flying Pollinators (Butterflies System) ---

const ButterflySystem = ({ count = 6 }: { count?: number }) => {
  const ref = useRef<THREE.Group>(null);
  
  // Butterfly trajectories
  const pathRadius = GRID_SIZE / 2.5;

  const butterflies = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      yOff: getRandomRange(1.0, 3.5),
      speed: getRandomRange(0.4, 0.9),
      phase: i * (Math.PI / 3),
      rScale: getRandomRange(0.7, 1.3),
      color: ['#f43f5e', '#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#a855f7'][i % 6]
    }));
  }, [count]);

  useFrame((state) => {
    if (ref.current) {
      const time = state.clock.getElapsedTime();
      ref.current.children.forEach((child, i) => {
        const b = butterflies[i % butterflies.length];
        const theta = time * b.speed + b.phase;
        
        // Circular flying paths in the middle of field
        const r = pathRadius * b.rScale;
        child.position.x = Math.sin(theta) * r + Math.sin(time * 0.3) * 1.5;
        child.position.z = Math.cos(theta) * r + Math.cos(time * 0.4) * 1.5;
        child.position.y = b.yOff + Math.sin(time * 3 + i) * 0.4;
        
        // Flapping motion of wings
        const leftWing = child.children[0] as THREE.Mesh;
        const rightWing = child.children[1] as THREE.Mesh;
        if (leftWing && rightWing) {
          const flap = Math.sin(time * 24 + i) * 0.8;
          leftWing.rotation.y = flap;
          rightWing.rotation.y = -flap;
        }
      });
    }
  });

  return (
    <group ref={ref}>
      {butterflies.map((b, i) => (
        <group key={i} scale={0.12}>
          {/* Left Wing */}
          <mesh position={[-0.4, 0, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.4, 0.02, 0.4]} />
            <meshBasicMaterial color={b.color} side={THREE.DoubleSide} />
          </mesh>
          {/* Right Wing */}
          <mesh position={[0.4, 0, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.4, 0.02, 0.4]} />
            <meshBasicMaterial color={b.color} side={THREE.DoubleSide} />
          </mesh>
          {/* Butterfly thorax body */}
          <mesh position={[0, 0, 0]} scale={[0.1, 0.1, 0.5]}>
            <boxGeometry />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
        </group>
      ))}
    </group>
  );
};


// --- 3. Soil Critters (Wildlife System) ---

const WildlifeSystem = ({ population, grid }: { population: number, grid: Grid }) => {
  // Spawns up to 16 critters depending on forest size/biomass (raised from 12)
  const critterCount = Math.min(Math.max(3, Math.floor(population / 25)), 16);
  const groupRef = useRef<THREE.Group>(null);

  const grassTiles = useMemo(() => {
    const list: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      list.push({ x: tile.x, y: tile.y });
    }));
    return list;
  }, [grid]);

  const critters = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => {
      const tile = grassTiles[Math.floor(Math.random() * grassTiles.length)] || { x: 4, y: 4 };
      const variant = i % 4; // 0: Deer, 1: Rabbit, 2: Chipmunk/Squirrel, 3: Forest Bird
      const colors = ["#b45309", "#ffffff", "#d97706", "#60a5fa"];
      return {
        slug: i,
        curX: tile.x + getRandomRange(-0.3, 0.3),
        curZ: tile.y + getRandomRange(-0.3, 0.3),
        tx: tile.x + getRandomRange(-0.3, 0.3),
        tz: tile.y + getRandomRange(-0.3, 0.3),
        speed: variant === 3 ? getRandomRange(1.0, 1.6) : (variant === 2 ? getRandomRange(0.65, 1.25) : getRandomRange(0.4, 0.95)),
        color: colors[variant],
        variant,
        scale: variant === 0 ? getRandomRange(0.18, 0.28) : (variant === 1 ? getRandomRange(0.18, 0.25) : (variant === 2 ? getRandomRange(0.14, 0.21) : getRandomRange(0.13, 0.23)))
      };
    });
  }, [grassTiles]);

  useFrame((state, delta) => {
    if (!groupRef.current || grassTiles.length === 0) return;
    const time = state.clock.getElapsedTime();

    groupRef.current.children.forEach((child, i) => {
      if (i >= critterCount) {
        child.visible = false;
        return;
      }
      child.visible = true;

      const c = critters[i];
      let dx = c.tx - c.curX;
      let dz = c.tz - c.curZ;
      let dist = Math.sqrt(dx * dx + dz * dz);

      // Pick new wander target if cozy or arrived
      if (dist < 0.1 || Math.random() < 0.005) {
        const nextTile = grassTiles[Math.floor(Math.random() * grassTiles.length)];
        c.tx = nextTile.x + getRandomRange(-0.4, 0.4);
        c.tz = nextTile.y + getRandomRange(-0.4, 0.4);
      } else {
        c.curX += (dx / dist) * c.speed * delta;
        c.curZ += (dz / dist) * c.speed * delta;
      }

      const [wx, _, wz] = gridToWorld(c.curX, c.curZ);
      const angle = Math.atan2(dz, dx);
      
      // Hopping physics for rabbits, scampering for squirrels, low flight for birds
      let yOffset = -0.32; // ground level
      if (c.variant === 1) { // rabbit jumps!
        yOffset += Math.abs(Math.sin(time * 6 + i)) * 0.12;
      } else if (c.variant === 2) { // squirrel bounding scurry
        yOffset += Math.abs(Math.cos(time * 10 + i)) * 0.04;
      } else if (c.variant === 3) { // birds flutter/fly up and down
        yOffset += 0.22 + Math.abs(Math.sin(time * 4 + i)) * 0.22;
      }

      child.position.set(wx, yOffset, wz);
      child.rotation.y = -angle;

      // Animate bird wings if bird variant is active
      if (c.variant === 3) {
        const variantGroup = child.children[0];
        if (variantGroup && variantGroup.children && variantGroup.children.length >= 5) {
          const leftWing = variantGroup.children[3];
          const rightWing = variantGroup.children[4];
          if (leftWing && rightWing) {
            const flap = Math.sin(time * 18 + i) * 0.9;
            leftWing.rotation.x = flap;
            rightWing.rotation.x = -flap;
          }
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {critters.map((c, i) => (
        <group key={i} scale={c.scale}>
          {c.variant === 0 ? (
            /* Little procedural Fawn Deer */
            <group>
              {/* Torso */}
              <mesh position={[0, 0.22, 0]} scale={[0.4, 0.25, 0.22]} geometry={boxGeo}>
                <meshStandardMaterial color={c.color} roughness={0.9} />
              </mesh>
              {/* Neck & Head */}
              <mesh position={[0.15, 0.42, 0]} scale={[0.15, 0.25, 0.15]} geometry={boxGeo}>
                <meshStandardMaterial color={c.color} roughness={0.9} />
              </mesh>
              <mesh position={[0.22, 0.52, 0]} scale={[0.22, 0.16, 0.15]} geometry={boxGeo}>
                <meshStandardMaterial color={c.color} roughness={0.9} />
              </mesh>
              {/* Antlers / Ears */}
              <mesh position={[0.18, 0.61, 0.05]} scale={[0.04, 0.15, 0.04]} geometry={cylinderGeo}>
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0.18, 0.61, -0.05]} scale={[0.04, 0.15, 0.04]} geometry={cylinderGeo}>
                <meshStandardMaterial color="#78350f" />
              </mesh>
              {/* Slender legs */}
              <mesh position={[-0.12, 0.07, 0.07]} scale={[0.05, 0.18, 0.05]} geometry={cylinderGeo}><meshBasicMaterial color="#3f2305" /></mesh>
              <mesh position={[-0.12, 0.07, -0.07]} scale={[0.05, 0.18, 0.05]} geometry={cylinderGeo}><meshBasicMaterial color="#3f2305" /></mesh>
              <mesh position={[0.12, 0.07, 0.07]} scale={[0.05, 0.18, 0.05]} geometry={cylinderGeo}><meshBasicMaterial color="#3f2305" /></mesh>
              <mesh position={[0.12, 0.07, -0.07]} scale={[0.05, 0.18, 0.05]} geometry={cylinderGeo}><meshBasicMaterial color="#3f2305" /></mesh>
            </group>
          ) : c.variant === 1 ? (
            /* Little bouncy forest rabbit */
            <group>
              {/* Rounded body */}
              <mesh position={[0, 0.15, 0]} scale={[0.25, 0.25, 0.25]} geometry={sphereGeo}>
                <meshStandardMaterial color={c.color} roughness={0.9} />
              </mesh>
              {/* Cute head sphere */}
              <mesh position={[0.15, 0.24, 0]} scale={[0.15, 0.15, 0.15]} geometry={sphereGeo}>
                <meshStandardMaterial color={c.color} roughness={0.9} />
              </mesh>
              {/* Tall floppy rabbit ears */}
              <mesh position={[0.12, 0.38, 0.04]} scale={[0.04, 0.18, 0.04]} rotation={[0,0,-0.1]} geometry={cylinderGeo}>
                <meshStandardMaterial color="#fca5a5" />
              </mesh>
              <mesh position={[0.12, 0.38, -0.04]} scale={[0.04, 0.18, 0.04]} rotation={[0,0,-0.1]} geometry={cylinderGeo}>
                <meshStandardMaterial color="#fca5a5" />
              </mesh>
            </group>
          ) : c.variant === 2 ? (
            /* Squirrel or Chipmunk scampering in woodlands */
            <group>
              {/* Body */}
              <mesh position={[0, 0.12, 0]} scale={[0.3, 0.18, 0.18]} geometry={boxGeo}>
                <meshStandardMaterial color={c.color} roughness={0.8} />
              </mesh>
              {/* Head */}
              <mesh position={[0.16, 0.24, 0]} scale={[0.14, 0.14, 0.14]} geometry={sphereGeo}>
                <meshStandardMaterial color={c.color} roughness={0.8} />
              </mesh>
              {/* Bushy vertical tail curving upwards */}
              <mesh position={[-0.15, 0.26, 0]} scale={[0.1, 0.28, 0.12]} rotation={[0.4, 0, 0]} geometry={boxGeo}>
                <meshStandardMaterial color="#b45309" roughness={0.9} />
              </mesh>
              {/* Tiny ears */}
              <mesh position={[0.15, 0.34, 0.04]} scale={[0.03, 0.08, 0.03]} geometry={boxGeo}><meshStandardMaterial color="#fca5a5" /></mesh>
              <mesh position={[0.15, 0.34, -0.04]} scale={[0.03, 0.08, 0.03]} geometry={boxGeo}><meshStandardMaterial color="#fca5a5" /></mesh>
            </group>
          ) : (
            /* Cute flapping Blue Jay / Forest Songbird */
            <group>
              {/* Feathered body sphere */}
              <mesh position={[0, 0.15, 0]} scale={[0.22, 0.18, 0.2]} geometry={sphereGeo}>
                <meshStandardMaterial color={c.color} roughness={0.7} />
              </mesh>
              {/* Tiny avian head */}
              <mesh position={[0.14, 0.24, 0]} scale={[0.12, 0.12, 0.12]} geometry={sphereGeo}>
                <meshStandardMaterial color="#ffffff" roughness={0.7} />
              </mesh>
              {/* Orange beak cone */}
              <mesh position={[0.22, 0.24, 0]} scale={[0.06, 0.06, 0.1]} rotation={[0, Math.PI/2, 0]} geometry={coneGeo}>
                <meshStandardMaterial color="#ea580c" roughness={0.5} />
              </mesh>
              {/* Wings flapping on left & right */}
              <group position={[0, 0.15, 0.12]}>
                <mesh scale={[0.16, 0.02, 0.15]} position={[0, 0, 0.08]} geometry={boxGeo}>
                  <meshStandardMaterial color="#1e40af" />
                </mesh>
              </group>
              <group position={[0, 0.15, -0.12]}>
                <mesh scale={[0.16, 0.02, 0.15]} position={[0, 0, -0.08]} geometry={boxGeo}>
                  <meshStandardMaterial color="#1e40af" />
                </mesh>
              </group>
            </group>
          )}
        </group>
      ))}
    </group>
  );
};


// --- 4. Ecosystem Weather Effects (Rain & Clouds) ---

interface EnvironmentProps {
  weather: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew';
}

const WeatherEffects = ({ weather }: EnvironmentProps) => {
  const rainRef = useRef<THREE.Group>(null);
  const dewRef = useRef<THREE.Group>(null);

  // Generate rain arrays
  const raindrops = useMemo(() => {
    return Array.from({ length: 120 }).map(() => ({
      pos: [
        getRandomRange(-GRID_SIZE * 1.5, GRID_SIZE * 1.5),
        getRandomRange(5, 15),
        getRandomRange(-GRID_SIZE * 1.5, GRID_SIZE * 1.5),
      ] as [number, number, number],
      speed: getRandomRange(7.5, 12.0)
    }));
  }, []);

  // Golden autumn dew dusts
  const amberDewDusts = useMemo(() => {
    return Array.from({ length: 45 }).map(() => ({
      pos: [
        getRandomRange(-GRID_SIZE, GRID_SIZE),
        getRandomRange(0.5, 5.0),
        getRandomRange(-GRID_SIZE, GRID_SIZE),
      ] as [number, number, number],
      driftSpeedX: getRandomRange(0.1, 0.4),
      driftSpeedY: getRandomRange(0.08, 0.22),
    }));
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    
    // Animate falling rain
    if (weather === 'Raining' && rainRef.current) {
      rainRef.current.children.forEach((drop, i) => {
        drop.position.y -= raindrops[i].speed * delta;
        
        // Slight sideways drift to look like windy rain
        drop.position.x += Math.sin(time + i) * 0.01;
        
        if (drop.position.y < -0.4) {
          drop.position.y = getRandomRange(10, 15);
          drop.position.x = getRandomRange(-GRID_SIZE * 1.5, GRID_SIZE * 1.5);
          drop.position.z = getRandomRange(-GRID_SIZE * 1.5, GRID_SIZE * 1.5);
        }
      });
    }

    // Animate golden amber drifting particles (Autumn Dew / Pollen Season)
    if (weather === 'Autumn_Dew' && dewRef.current) {
      dewRef.current.children.forEach((pollen, i) => {
        const d = amberDewDusts[i];
        pollen.position.y += Math.sin(time * 0.5 + i) * 0.005 - d.driftSpeedY * delta;
        pollen.position.x += d.driftSpeedX * delta + Math.sin(time + i) * 0.005;
        
        if (pollen.position.y < -0.3) {
          pollen.position.y = getRandomRange(4.0, 6.0);
          pollen.position.x = getRandomRange(-GRID_SIZE, GRID_SIZE);
        }
      });
    }
  });

  return (
    <group raycast={() => null}>
      {/* 1. Fluffy White Weather Clouds & Corresponding Dynamic Ground Projections */}
      <Cloud position={[-10, 7.5, 3]} scale={1.2} speed={0.25} color={weather === 'Raining' ? '#cbd5e1' : '#ffffff'} />
      <Cloud position={[4, 8.5, -6]} scale={0.9} speed={0.4} color={weather === 'Raining' ? '#94a3b8' : '#ffffff'} />
      <Cloud position={[10, 6.8, 8]} scale={1.4} speed={0.18} color={weather === 'Raining' ? '#cbd5e1' : '#ffffff'} />

      {/* 2. Falling Rain drops */}
      {weather === 'Raining' && (
        <group ref={rainRef}>
          {raindrops.map((r, i) => (
            <mesh key={i} position={r.pos}>
              <boxGeometry args={[0.012, 0.38, 0.012]} />
              <meshBasicMaterial color="#7dd3fc" transparent opacity={0.65} />
            </mesh>
          ))}
        </group>
      )}

      {/* 3. Golden Amber Pollen Dew / Autumn breezes */}
      {weather === 'Autumn_Dew' && (
        <group ref={dewRef}>
          {amberDewDusts.map((d, i) => (
            <mesh key={i} position={d.pos} scale={0.065}>
              <sphereGeometry />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Ambient Oceanic Island Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
        <planeGeometry args={[GRID_SIZE * 5, GRID_SIZE * 5]} />
        <meshStandardMaterial color="#0284c7" roughness={0.15} metalness={0.62} opacity={0.88} transparent />
      </mesh>
    </group>
  );
};

const Cloud = ({ position, scale, speed, color = 'white' }: { position: [number, number, number], scale: number, speed: number, color?: string }) => {
  const group = useRef<THREE.Group>(null);
  const shadowGroupRef = useRef<THREE.Group>(null);
  
  const bubbles = useMemo(() => Array.from({ length: 5 }).map(() => ({
    pos: [getRandomRange(-0.8, 0.8), getRandomRange(-0.4, 0.4), getRandomRange(-0.8, 0.8)] as [number, number, number],
    scale: getRandomRange(0.4, 1.0)
  })), []);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.x += speed * delta;
      
      // Wrap around grid boundaries seamlessly
      const maxBound = GRID_SIZE * 2.2;
      if (group.current.position.x > maxBound) {
        group.current.position.x = -maxBound;
      }
      
      // Compute projected dynamic cloud shadow positions along the Sunlight vector [12, 18, 8]
      if (shadowGroupRef.current) {
        const cx = group.current.position.x;
        const cy = group.current.position.y;
        const cz = group.current.position.z;
        const sY = -0.26; // Floats slightly above the ground/water height
        const dy = cy - sY;
        const t = dy / 18; // Derived projection scalar
        const sX = cx - t * 12;
        const sZ = cz - t * 8;
        shadowGroupRef.current.position.set(sX, sY, sZ);
      }
    }
  });

  return (
    <>
      {/* 3D Cloud Mesh */}
      <group ref={group} position={position} scale={scale}>
        {bubbles.map((b, i) => (
          <mesh key={i} geometry={sphereGeo} position={b.pos} scale={b.scale} castShadow>
            <meshStandardMaterial color={color} flatShading opacity={0.88} transparent />
          </mesh>
        ))}
      </group>

      {/* Live Projected Ground Shadow Mesh */}
      <group ref={shadowGroupRef} scale={scale}>
        {bubbles.map((b, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[b.pos[0], 0, b.pos[2]]} scale={[b.scale * 1.8, b.scale * 1.8, 1]} raycast={() => null}>
            <planeGeometry />
            <meshBasicMaterial color="#0b1329" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
};


// --- 5. Custom Soil & Ground Tiles ---

interface GroundTileProps {
  type: EcosystemType;
  growthStage: number;
  moisture: number;
  nutrients: number;
  x: number;
  y: number;
  grid: Grid;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
  onClick: (x: number, y: number) => void;
  day?: number;
  weather?: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew';
  showFertilityHeatmap?: boolean;
}

const RiverParticle = ({ x, y, index, thickness, weather }: { x: number; y: number; index: number; thickness: number; weather?: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Deterministic seed based on coordinate and index
  const seed = useMemo(() => getHash(x * 12.3 + index * 4.7, y * 19.5 - index * 6.2), [x, y, index]);
  const isDebris = seed > 0.45; // 55% organic leaves/debris, 45% white foam particles
  
  // River bends and shallows have more foam density
  const riverY = x + Math.sin(x * 0.6) * 1.25;
  const distanceToCenter = Math.abs(y - riverY);
  const bendFactor = Math.abs(Math.sin(x * 0.6)); 
  const shallowFactor = Math.min(1.0, distanceToCenter / 1.45);
  
  const isBendsOrShallows = bendFactor > 0.4 || shallowFactor > 0.55;

  const particleColor = useMemo(() => {
    if (isDebris) {
      if (seed < 0.6) return '#ca8a04'; // Amber autumn leaf
      if (seed < 0.8) return '#b45309'; // Rusty brown twig
      return '#15803d'; // Forest dark green
    }
    // High turbidity/shallow areas have sparkling bright foam clusters
    return isBendsOrShallows ? '#ffffff' : '#f1f5f9'; // White foam bubble
  }, [isDebris, seed, isBendsOrShallows]);

  // Expand foam particle sizes at bends and shallow banks
  const size = useMemo(() => {
    const baseSize = 0.015 + seed * 0.025;
    if (!isDebris) {
      // Scale foam size up significantly in shallow bank zones or sharp bends
      return baseSize * (1.0 + bendFactor * 0.7 + shallowFactor * 1.3);
    }
    return baseSize;
  }, [isDebris, seed, bendFactor, shallowFactor]);

  // Adjust lateralOffset so foam particles drift closer to shallow shores due to eddies
  const lateralOffset = useMemo(() => {
    const baseOffset = (seed - 0.5) * 0.72;
    if (!isDebris) {
      // Float towards the shoreline shallow banks: pushing outwards based on shallowFactor
      return baseOffset * (1.1 - shallowFactor * 0.6) + (seed > 0.5 ? 0.16 : -0.16) * shallowFactor;
    }
    return baseOffset;
  }, [seed, isDebris, shallowFactor]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const flowSpeed = weather === 'Windy' ? 0.62 : weather === 'Raining' ? 0.44 : 0.30;
    const waveSpeed = weather === 'Windy' ? 3.4 : weather === 'Raining' ? 1.8 : 1.4;
    const waveHeight = weather === 'Windy' ? 0.018 : weather === 'Raining' ? 0.012 : 0.008;

    // Movement progress (0 to 1 looping)
    const progress = (t * flowSpeed + seed) % 1.0;
    
    // Diagonal river flow path coordinates running along the channel bed
    const flowPos = -0.48 + progress * 0.96;
    meshRef.current.position.x = flowPos;
    // Gentle floating drift offset from left to right bank
    meshRef.current.position.z = lateralOffset + Math.sin(t * 1.6 + seed * 12) * 0.05;
    
    // Vertical floating bounce synchronized with underlying swell with custom buoyancy bobbing & drag lag
    const wave = Math.sin(t * waveSpeed + (x * 12.3 + y * 17.5) * 0.3) * waveHeight;
    const buoyancyBob = isDebris 
      ? Math.sin(t * (waveSpeed * 1.6) + seed * 8.0) * (waveHeight * 0.45) 
      : Math.sin(t * (waveSpeed * 2.2) + seed * 3.0) * (waveHeight * 0.2); // Foam has a faster water-surface tension vibration
    
    meshRef.current.position.y = (thickness / 2) - 0.05 + wave + buoyancyBob;

    // Fade out smoothly near borders of the tile to spawn and loop cleanly
    if (meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const baseOpacity = isDebris ? 0.85 : 0.7;
      // Boost foam opacity at turbid clusters
      const opacityBoost = !isDebris ? (bendFactor * 0.15 + shallowFactor * 0.24) : 0;
      mat.opacity = Math.sin(progress * Math.PI) * Math.min(0.98, baseOpacity + opacityBoost);
    }

    // Dynamic rotation of debris leaf representing hydrodynamic rotational drag and water rocking torque
    if (isDebris) {
      meshRef.current.rotation.y = t * (0.8 + seed * 1.2) + seed * 10;
      const waveSlope = Math.cos(t * waveSpeed + (x * 12.3 + y * 17.5) * 0.3);
      meshRef.current.rotation.x = waveSlope * 0.22 + Math.sin(t * 2.5 + seed * 6) * 0.08;
      meshRef.current.rotation.z = waveSlope * 0.16 + Math.cos(t * 1.9 + seed * 14) * 0.08;
    } else {
      meshRef.current.rotation.y = t * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      {isDebris ? (
        <boxGeometry args={[size * 1.7, 0.006, size * 0.95]} />
      ) : (
        <sphereGeometry args={[size, 4, 4]} />
      )}
      <meshStandardMaterial 
        color={particleColor} 
        roughness={isDebris ? 0.7 : 0.05} 
        metalness={isDebris ? 0.0 : 0.7} 
        transparent 
      />
    </mesh>
  );
};

const RiverWater = ({ thickness, weather, x, y }: { thickness: number; weather?: string; x: number; y: number }) => {
  const waterRef = useRef<THREE.Mesh>(null);
  const foamRef1 = useRef<THREE.Mesh>(null);
  const foamRef2 = useRef<THREE.Mesh>(null);
  
  // Calculate flow direction along the diagonal river axis
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (waterRef.current) {
      // Dynamic vertical oscillation representing swell/tide waves
      const waveSpeed = weather === 'Windy' ? 3.4 : weather === 'Raining' ? 1.8 : 1.4;
      const waveHeight = weather === 'Windy' ? 0.018 : weather === 'Raining' ? 0.012 : 0.008;
      
      const wave = Math.sin(t * waveSpeed + (x * 12.3 + y * 17.5) * 0.3) * waveHeight;
      const capillary = Math.cos(t * waveSpeed * 2.1 + (x - y) * 1.5) * (waveHeight * 0.28);
      
      // Update water layer position slightly below the surrounding land to give depth
      waterRef.current.position.y = (thickness / 2) - 0.07 + wave + capillary;
      
      // Flowing ripples / wave stretching stretching/contracting physics
      const stretchSpeed = weather === 'Windy' ? 4.0 : 2.0;
      const stretchAmount = weather === 'Windy' ? 0.04 : 0.015;
      waterRef.current.scale.x = 1.0 + Math.sin(t * stretchSpeed + (x + y)) * stretchAmount;
      waterRef.current.scale.y = 1.0 + Math.cos(t * stretchSpeed * 1.1 + (x - y)) * stretchAmount;
    }

    // Flowing foam and bubble streams running down the channel
    const flowSpeed = weather === 'Windy' ? 0.52 : weather === 'Raining' ? 0.38 : 0.28;
    
    // Calculate river bend and shallow factor
    const riverY = x + Math.sin(x * 0.6) * 1.25;
    const distanceToCenter = Math.abs(y - riverY);
    const bendFactor = Math.abs(Math.sin(x * 0.6)); 
    const shallowFactor = Math.min(1.0, distanceToCenter / 1.45);
    
    // Accumulate foam size at turbid bend areas and shallows
    const foamClusterMultiplier = 1.0 + bendFactor * 0.75 + shallowFactor * 1.1;

    if (foamRef1.current) {
      const p1 = (t * flowSpeed + (x * 0.7 + y * 0.5)) % 1.0;
      foamRef1.current.position.x = -0.38 + p1 * 0.76;
      foamRef1.current.position.z = -0.38 + p1 * 0.76;
      foamRef1.current.position.y = (thickness / 2) - 0.055;
      
      const pulse = Math.sin(p1 * Math.PI) * (weather === 'Raining' ? 0.11 : 0.08) * foamClusterMultiplier;
      foamRef1.current.scale.set(pulse, 0.012, pulse * 0.5);
    }

    if (foamRef2.current) {
      const p2 = ((t * flowSpeed * 1.15) + (x * 1.33 + y * 2.17)) % 1.0;
      foamRef2.current.position.x = 0.38 - p2 * 0.76;
      foamRef2.current.position.z = -0.15 + p2 * 0.3;
      foamRef2.current.position.y = (thickness / 2) - 0.057;
      
      const pulse = Math.sin(p2 * Math.PI) * (weather === 'Raining' ? 0.09 : 0.06) * foamClusterMultiplier;
      foamRef2.current.scale.set(pulse * 0.4, 0.012, pulse);
    }

    // Dynamic micro bubble splash sound generator
    // Check rare frame occurrence on dynamic riverbed to trigger procedural water sound
    if (Math.random() < 0.00015) {
      ecosystemAudio.synthesizeWaterBubble();
    }
  });

  const waterColor = useMemo(() => {
    if (weather === 'Sunny') return '#0284c7';
    if (weather === 'Raining') return '#0369a1';
    if (weather === 'Autumn_Dew') return '#0c4a6e';
    return '#075985';
  }, [weather]);

  // Generate 4 drifting organic/debris particles per tile (deterministic)
  const floaters = useMemo(() => [0, 1, 2, 3], []);

  return (
    <group>
      {/* Deep Bedrock Floor Base */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[0.965, thickness - 0.02, 0.965]} />
        <meshStandardMaterial color="#0b1e36" roughness={0.95} flatShading />
      </mesh>

      {/* Sub-surface deep gradient layer */}
      <mesh position={[0, (thickness / 2) - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.96, 0.96]} />
        <meshStandardMaterial color="#082e54" roughness={0.4} metalness={0.7} transparent opacity={0.6} />
      </mesh>

      {/* Mirror Gloss Surface Liquid */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[0.965, 0.965]} />
        <meshStandardMaterial 
          color={waterColor}
          roughness={0.01}
          metalness={0.95}
          transparent
          opacity={0.80}
        />
      </mesh>

      {/* Sparkling Drift Foam Waves */}
      <mesh ref={foamRef1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.88} roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh ref={foamRef2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#bfeafe" transparent opacity={0.75} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Refined bank foam and floating organic debris particles */}
      {floaters.map((index) => (
        <RiverParticle 
          key={`part-${index}`} 
          x={x} 
          y={y} 
          index={index} 
          thickness={thickness} 
          weather={weather} 
        />
      ))}
    </group>
  );
};

const GroundTile = React.memo(({ type, growthStage, moisture, nutrients, x, y, onHover, onLeave, onClick, day, weather, showFertilityHeatmap = false }: GroundTileProps) => {
  const [wx, _, wz] = gridToWorld(x, y);
  
  const cycle = day !== undefined ? ((day - 1) % 40) : 0;
  const season = day !== undefined ? (
    cycle < 10 ? 'spring' :
    cycle < 20 ? 'summer' : // simulated dry season
    cycle < 30 ? 'autumn' : 'winter'
  ) : 'spring';

  const isDrySeason = season === 'summer';
  const isAutumnActive = weather === 'Autumn_Dew' || season === 'autumn';
  const isWinterActive = season === 'winter';

  const isRiver = useMemo(() => {
    const riverY = x + Math.sin(x * 0.6) * 1.25;
    return Math.abs(y - riverY) < 1.45;
  }, [x, y]);

  // Grass Color changes based on Soil Moisture, Season and Weather events, or Soil Fertility Heatmap overlay:
  const baseColor = useMemo(() => {
    if (isRiver) {
      return '#0b253b'; // Deep Indigo-Slate riverbed channel
    }

    if (showFertilityHeatmap) {
      // Calculate smooth gradient interpolation between light beige (#f5ebd0) and deep brown (#3e1b04) reference colors
      const ratio = Math.min(100, Math.max(0, nutrients)) / 100;
      const r = Math.round(245 - (245 - 62) * ratio);
      const g = Math.round(235 - (235 - 27) * ratio);
      const b = Math.round(208 - (208 - 4) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }

    let tint = '#16a34a'; // default hydrated grass (green-600)
    
    if (moisture >= 65) {
      tint = '#10b981'; // wet: emerald-500
    } else if (moisture <= 25) {
      tint = '#d97706'; // dry: amber-600
    }

    // Season offsets
    if (isAutumnActive) {
      // Golden auburn/rust forest floor
      if (moisture >= 65) return '#854d0e'; // wet autumn: golden-olive
      return '#b45309'; // typical autumn: rust-brown
    } else if (isWinterActive) {
      // Cold, desaturated frost-sage green or frosty teal
      if (moisture >= 65) return '#0d9488'; 
      return '#475569'; // slate gray-green floor
    } else if (isDrySeason) {
      // Summer dry season: parched olive or straw-golden
      if (moisture <= 45) return '#ca8a04'; // yellow-brown
    }

    return tint;
  }, [isRiver, moisture, isDrySeason, isAutumnActive, isWinterActive, showFertilityHeatmap, nutrients]);

  // Adjust grass height slightly depending on coordinate variety
  const noise = getHash(x, y);
  const thickness = 0.45;
  const topY = -0.3 + (noise * 0.04);
  const centerY = topY - thickness / 2;

  // Render nutrient multiplier (circular dark organic mound in the middle)
  const isFertile = nutrients > 65;

  // Dense foliages when moisture is good and NOT dry season
  // Sparse or dry when moisture is low or in dry season
  const coverCount = useMemo(() => {
    if (moisture <= 15) return 0; // completely dry/arid: no living ground cover
    if (isDrySeason || moisture <= 35) {
      return 1; // dry season or poor moisture: sparser ground cover (just 1 sprout/twig)
    }
    // Healthy, hydrated non-dry season tile: dense green ground cover (3 elements!)
    return 3;
  }, [moisture, isDrySeason]);

  const groundCoverElements = useMemo(() => {
    // Generate deterministic values for 3 ground cover items on top of the tile
    return Array.from({ length: 3 }).map((_, i) => {
      const gHash = getHash(x + i * 36, y - i * 14);
      const angle = gHash * Math.PI * 2;
      
      // Offset from center of tile (tile is 0.96 x 0.96)
      const ox = (gHash - 0.5) * 0.6; 
      const oz = (((gHash * 11.7) % 1) - 0.5) * 0.6;
      
      const visualType = i; 
      
      // Height and thickness scale
      const heightScale = 0.06 + ((gHash * 7) % 1) * 0.06;
      const thicknessScale = 0.03 + ((gHash * 3) % 1) * 0.02;
      
      // Determine ground cover color
      let coverColor = '#4ade80'; // soft lime green
      if (isDrySeason || moisture <= 35) {
        // Dried straw yellow / parched brown
        coverColor = i === 1 ? '#d97706' : '#b45309'; 
      } else if (isAutumnActive) {
        // Warm fiery orange/golden blossoms on the forest floor
        coverColor = i === 0 ? '#ea580c' : (i === 1 ? '#eab308' : '#ca8a04');
      } else if (isWinterActive) {
        // Desaturated cold spruce bluish-green or frosty white
        coverColor = i === 0 ? '#e2e8f0' : '#475569';
      } else if (moisture >= 65) {
        // Vibrant lush moss green or small colorful bloom
        coverColor = i === 0 ? '#fb7185' : (i === 1 ? '#34d399' : '#059669');
      } else {
        // Standard forest grass green
        coverColor = i === 0 ? '#10b981' : '#15803d';
      }

      return {
        ox,
        oz,
        angle,
        visualType,
        heightScale,
        thicknessScale,
        color: coverColor
      };
    });
  }, [x, y, isDrySeason, moisture, isAutumnActive, isWinterActive]);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTime = useRef<number>(0);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    pointerStart.current = { x: e.clientX, y: e.clientY };
    pointerDownTime.current = Date.now();
  }, []);

  const handlePointerUp = useCallback((e: any) => {
    e.stopPropagation();
    if (!pointerStart.current) return;
    
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pressDuration = Date.now() - pointerDownTime.current;
    
    pointerStart.current = null;
    
    // Moderate movement threshold to qualify as a tap (12px), preventing triggers on minor drag-to-pan finger jitter on mobile
    // If held too long (e.g., > 450ms), do not trigger standard click to let the long-press radial menu capture it
    if (distance < 12 && pressDuration < 450) {
      if (e.button === 0 || e.button === undefined) {
        onClick(x, y);
      }
    }
  }, [onClick, x, y]);

  return (
    <mesh 
      position={[wx, centerY, wz]} 
      receiveShadow castShadow
      onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
      onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={[0.96, thickness, 0.96]} />
      <meshStandardMaterial color={baseColor} flatShading roughness={1} />
      
      {/* Dynamic Water Liquid Overlay on top of the river tile */}
      {isRiver && (
        <group>
          {/* Wave-animated glossy current flows with physical depth and foam bubbles */}
          <RiverWater thickness={thickness} weather={weather} x={x} y={y} />
          {/* Scatter smooth granite boulders on river banks, lowered to match the bed channel */}
          <mesh position={[0.24, thickness / 2 - 0.06, -0.15]} scale={[0.16, 0.09, 0.16]}>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshStandardMaterial color="#64748b" roughness={0.65} />
          </mesh>
          <mesh position={[-0.28, thickness / 2 - 0.05, 0.22]} scale={[0.11, 0.07, 0.11]}>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshStandardMaterial color="#475569" roughness={0.75} />
          </mesh>
        </group>
      )}
      
      {/* Dark fertilized peat patch overlay on top */}
      {isFertile && (
        <mesh position={[0, thickness/2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshStandardMaterial color="#422006" roughness={0.9} />
        </mesh>
      )}

      {/* Tiny water puddle shine when highly saturated */}
      {moisture >= 85 && (
        <mesh position={[0.2, thickness/2 + 0.006, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.22, 0.18]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.1} metalness={0.8} />
        </mesh>
      )}

      {/* Dynamic Ground Cover Micro-Foliage (Sparser/Drier in dry season) */}
      {Array.from({ length: coverCount }).map((_, i) => {
        const item = groundCoverElements[i];
        if (!item) return null;
        
        // Render different shapes of micro cover
        if (item.visualType === 0) {
          // Flower bud / sprout (tiny double-leaf)
          return (
            <group key={i} position={[item.ox, thickness/2 + 0.01, item.oz]} rotation={[0, item.angle, 0]}>
              <mesh castShadow geometry={coneGeo} scale={[item.thicknessScale, item.heightScale, item.thicknessScale]} position={[-0.02, item.heightScale/2, 0]} rotation={[0, 0, -0.2]}>
                <meshStandardMaterial color={item.color} flatShading roughness={1} />
              </mesh>
              <mesh castShadow geometry={coneGeo} scale={[item.thicknessScale * 0.8, item.heightScale * 0.8, item.thicknessScale * 0.8]} position={[0.02, item.heightScale * 0.4, 0]} rotation={[0, 0, 0.2]}>
                <meshStandardMaterial color={item.color} flatShading roughness={1} />
              </mesh>
            </group>
          );
        } else if (item.visualType === 1) {
          // Tall slender grass blade
          return (
            <mesh key={i} castShadow geometry={coneGeo} position={[item.ox, thickness/2 + item.heightScale/2, item.oz]} rotation={[0.05, 0, -0.05]} scale={[item.thicknessScale, item.heightScale * 1.5, item.thicknessScale]}>
              <meshStandardMaterial color={item.color} flatShading roughness={1} />
            </mesh>
          );
        } else {
          // Moss bead / small pebble
          return (
            <mesh key={i} castShadow geometry={sphereGeo} position={[item.ox, thickness/2 + item.thicknessScale * 0.3, item.oz]} scale={[item.thicknessScale * 1.5, item.thicknessScale * 0.8, item.thicknessScale * 1.2]}>
              <meshStandardMaterial color={item.color} flatShading roughness={1} />
            </mesh>
          );
        }
      })}
    </mesh>
  );
});


const getStageLabel = (stage: number) => {
  switch (stage) {
    case 1: return 'Sprout';
    case 2: return 'Sapling';
    case 3: return 'Mature';
    case 4: return 'Ancient';
    default: return 'Empty Soil';
  }
};

const getToolEmoji = (type: EcosystemType) => {
  switch (type) {
    case EcosystemType.Pine: return '🌲';
    case EcosystemType.Oak: return '🌳';
    case EcosystemType.CherryBlossom: return '🌸';
    case EcosystemType.Maple: return '🍁';
    case EcosystemType.Redwood: return '🪵';
    case EcosystemType.Bonsai: return '🪴';
    case EcosystemType.Willow: return '🍃';
    case EcosystemType.Baobab: return '🌴';
    case EcosystemType.Jacaranda: return '🪻';
    case EcosystemType.Alder: return '🌿';
    case EcosystemType.Acacia: return '🌾';
    case EcosystemType.Birch: return '🪶';
    case EcosystemType.Bamboo: return '🎋';
    case EcosystemType.Cypress: return '🌲';
    case EcosystemType.DeadTree: return '🍄';
    default: return '🌱';
  }
};


// Legacy cursor logic removed for refined tech-reticle.


// Helper component to apply a vertical interaction offset on touch devices
// This ensures that the user's finger (usually below the point) doesn't obscure the selection
const TouchInteractionOffset = () => {
  const { mouse, gl } = useThree();

  useEffect(() => {
    const glElement = gl.domElement;

    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = glElement.getBoundingClientRect();
        
        // Vertical offset in pixels - shifts the selection point ~65px ABOVE the finger
        const vOffset = 65; 
        
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((touch.clientY - vOffset - rect.top) / rect.height) * 2 + 1;
        
        mouse.set(x, y);
      }
    };

    glElement.addEventListener('touchstart', handleTouch, { passive: true });
    glElement.addEventListener('touchmove', handleTouch, { passive: true });
    
    return () => {
      glElement.removeEventListener('touchstart', handleTouch);
      glElement.removeEventListener('touchmove', handleTouch);
    };
  }, [gl, mouse]);

  return null;
};


// Responsive Camera Component
const ResponsiveCamera = () => {
  const { size } = useThree();
  const isMobile = size.width < 768;
  const zoom = isMobile ? 36 : 52;
  
  return <OrthographicCamera makeDefault zoom={zoom} position={[21, 17, 21]} near={-100} far={230} />;
};


// --- 6. Principal IsoMap Component ---

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: EcosystemType;
  population: number; // Ecosystem Biomass Points
  weather: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew';
  onHoverCoords?: (coords: { x: number, y: number } | null) => void;
  day: number;
  subDayProgress?: number;
  showFertilityHeatmap?: boolean;
}

// --- High-Performance Targeting Reticle & Tile Cursor ---
const Cursor = ({ x, y, color, tile, day, weather }: { 
  x: number; 
  y: number; 
  color: string; 
  tile: TileData;
  day: number;
  weather: any;
}) => {
  const [wx, _, wz] = gridToWorld(x, y);
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.position.y = -0.1 + Math.sin(t * 3) * 0.02;
    }
    if (ringRef.current) {
      const s = 1.0 + Math.sin(t * 4) * 0.05;
      ringRef.current.scale.set(s, s, s);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.3 + Math.sin(t * 4) * 0.2;
    }
  });

  return (
    <group position={[wx, 0, wz]}>
      {/* Primary Grid Bracket */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.02, 0.05, 1.02)]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </lineSegments>

      {/* Floating Corner Brackets for "Locked" feel */}
      {[
        [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]
      ].map(([ox, oz], i) => (
        <mesh key={i} position={[ox * 1.02, 0.1, oz * 1.02]} scale={0.06}>
          <boxGeometry />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}

      {/* Pulsing Scan Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// --- Placement Ripple Effect ---
const PlacementRipple = ({ position, color }: { position: [number, number, number], color: string }) => {
  const ref = useRef<THREE.Mesh>(null);
  const [active, setActive] = useState(true);

  useFrame((_, delta) => {
    if (ref.current && active) {
      ref.current.scale.x += delta * 4;
      ref.current.scale.y += delta * 4;
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity -= delta * 1.5;
      if (mat.opacity <= 0) setActive(false);
    }
  });

  if (!active) return null;

  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.1, 0.2, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
};

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, weather, onHoverCoords, day, subDayProgress, showFertilityHeatmap = false }) => {
  const [hoveredTile, setHoveredTile] = useState<{ x: number, y: number } | null>(null);
  const [ripples, setRipples] = useState<{ id: number, pos: [number, number, number], color: string }[]>([]);
  const lastGrid = useRef<Grid | null>(null);

  // Track placement ripples
  useEffect(() => {
    if (lastGrid.current) {
      grid.forEach((row, y) => {
        row.forEach((tile, x) => {
          const lastTile = lastGrid.current?.[y]?.[x];
          if (tile && lastTile && tile.type !== lastTile.type && tile.type !== EcosystemType.None) {
            const [wx, _, wz] = gridToWorld(x, y);
            setRipples(prev => [...prev.slice(-10), {
              id: Date.now() + Math.random(),
              pos: [wx, 0.1, wz],
              color: BUILDINGS[tile.type]?.color || '#4ade80'
            }]);
          }
        });
      });
    }
    lastGrid.current = JSON.parse(JSON.stringify(grid));
  }, [grid]);

  // Dynamic calculations for sub-day time angles and celestial light illumination intensity
  const lighting = useMemo(() => {
    const progress = subDayProgress !== undefined ? subDayProgress : 0.4; // default noonish if undefined
    
    // Smooth angle path for sunlight.
    // Progress 0.0 starts at dawn (east), 0.35 is midday (high), 0.7 is sunset (west), and remaining is night.
    const angle = progress * Math.PI * 2 - Math.PI / 3;
    
    let isNight = false;
    
    // Is night?
    if (progress > 0.72 || progress < 0.2) {
      isNight = true;
    }

    // Rotating position vectors of our celestial sun/moon
    let x = Math.cos(angle) * 14;
    let y = Math.max(0.3, Math.sin(angle)) * 16;
    let z = Math.sin(angle) * 9;

    if (isNight) {
      // Moon rises and shines from a steep diagonal angle to cast crisp, elongated moonlit shadows
      const moonProgress = (progress > 0.72) ? (progress - 0.72) / 0.48 : (progress + 0.28) / 0.48;
      const moonAngle = moonProgress * Math.PI + Math.PI / 4;
      x = Math.cos(moonAngle) * 12;
      y = Math.max(0.5, Math.sin(moonAngle)) * 15;
      z = Math.sin(moonAngle) * 10;
    }
    
    let ambientColor = '#f0fdf4';
    let ambientIntensity = 0.52;
    let dirColor = '#fffbe8';
    let dirIntensity = 2.1;
    let bgOverrideColor = '#0c4a6e';
    let fogColor = '#0c4a6e';
    let environmentIntensity = 1.0;

    if (weather === 'Raining') {
      if (isNight) {
        // Deep rainy midnight storm - elegant dark stormproper
        ambientColor = '#03050a';
        ambientIntensity = 0.05;
        dirColor = '#2d3345';
        dirIntensity = 0.15;
        bgOverrideColor = '#010204';
        fogColor = '#010204';
        environmentIntensity = 0.02;
      } else {
        ambientColor = '#94a3b8';
        ambientIntensity = 0.4;
        dirColor = '#64748b';
        dirIntensity = 0.9;
        bgOverrideColor = '#0b0f19';
        fogColor = '#0b0f19';
        environmentIntensity = 0.25;
      }
    } else if (weather === 'Autumn_Dew') {
      if (isNight) {
        // Golden/foggy autumn night dewy aura
        ambientColor = '#0d0805';
        ambientIntensity = 0.08;
        dirColor = '#92400e';
        dirIntensity = 0.35;
        bgOverrideColor = '#050302';
        fogColor = '#050302';
        environmentIntensity = 0.05;
      } else {
        ambientColor = '#fef3c7';
        ambientIntensity = 0.5;
        dirColor = '#f59e0b';
        dirIntensity = 1.5;
        bgOverrideColor = '#141210';
        fogColor = '#141210';
        environmentIntensity = 0.5;
      }
    } else if (isNight) {
      // Midnight cool indigo-sapphire sky - beautifully enhanced moonlit glow & dark proper shadows
      ambientColor = '#050614'; // Extreme deep obsidian cosmos bounce (dark proper shadow areas)
      ambientIntensity = 0.06;   // Properly calibrated darkness in occlusion/shadow zones
      dirColor = '#bfdbfe';      // Glistening, rich silver-gilded soft blue moonlight
      dirIntensity = 1.15;       // Heightened directional moonrays casting prominent, crisp, elegant shadows
      bgOverrideColor = '#010103'; // Pristine celestial deep cosmic background
      fogColor = '#010103';
      environmentIntensity = 0.05; // Dim reflection profiles for perfect evening contrast
    } else {
      // Dynamic Day-Night transition segments for Sunny / Windy weather
      if (progress >= 0.2 && progress < 0.35) {
        // Sunrise: pinkish peach transitioning to clear warm gold
        const ratio = (progress - 0.2) / 0.15;
        ambientColor = '#ffedd5'; // glowing morning apricot
        ambientIntensity = 0.55;
        dirColor = '#fdba74'; // warm rose dawn sun
        dirIntensity = 1.5 + ratio * 0.8;
        bgOverrideColor = '#1f142e'; // deep sunrise cosmos sky gradient
        fogColor = '#1f142e';
        environmentIntensity = 0.4 + ratio * 0.6;
      } else if (progress >= 0.35 && progress < 0.60) {
        // Midday / Peak sunshine: Brilliant rich daylight
        ambientColor = '#e0f2fe'; // Sky dome scattering ambient bounce (fills shadow zones with elegant blue sky light)
        ambientIntensity = 0.72;   // Radiant and healthy model light
        dirColor = '#fffbeb';      // Pristine warm golden solar rays (glorious sunlight proper)
        dirIntensity = 2.45;       // Extreme definition and crisp isometric contrast
        bgOverrideColor = '#87ceeb'; // Fresh, premium, clear daytime atmosphere sky color (looks fantastic on desktop/mobile)
        fogColor = '#87ceeb';
        environmentIntensity = 1.25; // Fully-saturated, leaves and flora highlight probes reflect wonderfully
      } else {
        // Sunset: gorgeous crimson-magenta / golden dusk aura
        const ratio = (progress - 0.6) / 0.12;
        ambientColor = '#ffe4e6'; // soft rosy dusk ambient
        ambientIntensity = 0.55;
        dirColor = '#f43f5e'; // burning magenta-crimson core solar rays
        dirIntensity = 2.45 - (ratio * 1.8);
        bgOverrideColor = '#181024'; // deep purple dawning dark canvas
        fogColor = '#181024';
        environmentIntensity = 1.25 - (ratio * 0.8);
      }
    }
    
    return {
      position: [x, y, z] as [number, number, number],
      ambientColor,
      ambientIntensity,
      dirColor,
      dirIntensity,
      bgOverrideColor,
      fogColor,
      isNight,
      environmentIntensity,
      useFog: true
    };
  }, [subDayProgress, weather]);

  const lastHoveredTile = useRef<{ x: number, y: number } | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    const isNewTile = !lastHoveredTile.current || lastHoveredTile.current.x !== x || lastHoveredTile.current.y !== y;
    if (isNewTile) {
      lastHoveredTile.current = { x, y };
      ecosystemAudio.init();
      const tileType = grid?.[y]?.[x]?.type;
      ecosystemAudio.synthesizeHoverTile(x, y, tileType);
    }
    setHoveredTile({ x, y });
    if (onHoverCoords) onHoverCoords({ x, y });
  }, [onHoverCoords, grid]);

  const handleLeave = useCallback(() => {
    lastHoveredTile.current = null;
    setHoveredTile(null);
    if (onHoverCoords) onHoverCoords(null);
  }, [onHoverCoords]);

  // Previewing item configurations
  const isUtil = hoveredTool === EcosystemType.None || hoveredTool === EcosystemType.WateringCan || hoveredTool === EcosystemType.NutrientMulch;
  const showPreview = hoveredTile && grid?.[hoveredTile.y]?.[hoveredTile.x]?.type === EcosystemType.None && !isUtil;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0, 0, 0];

  const getCursorColor = () => {
    if (!hoveredTile) return 'white';
    if (hoveredTool === EcosystemType.None) return '#ef4444'; // Shovel red
    if (hoveredTool === EcosystemType.WateringCan) return '#38bdf8'; // Water blue
    if (hoveredTool === EcosystemType.NutrientMulch) return '#eab308'; // Mulch yellow
    return showPreview ? '#34d399' : '#000000';
  };

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <TouchInteractionOffset />
        <ResponsiveCamera />
        
        <OrbitControls 
          enablePan={true}
          enableRotate={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={120}
          maxPolarAngle={1.2}
          minPolarAngle={0.4}
          target={[0, -0.6, 0]}
          makeDefault
          dampingFactor={0.1}
          rotateSpeed={0.8}
          panSpeed={1.2}
          zoomSpeed={1.2}
          screenSpacePanning={true}
        />

        {/* Dynamic Ambient & Directional Skylights */}
        <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
        <directionalLight
          castShadow
          position={lighting.position}
          intensity={lighting.dirIntensity}
          color={lighting.dirColor}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12} shadow-camera-right={12}
          shadow-camera-top={12} shadow-camera-bottom={-12}
        />
        
        <Environment preset="forest" intensity={lighting.environmentIntensity} />

        {/* Dynamic Climate Atmosphere & Sky color with Fog */}
        <color attach="background" args={[lighting.bgOverrideColor]} />
        {lighting.useFog ? (
          <fogExp2 attach="fog" args={[lighting.fogColor, weather === 'Autumn_Dew' ? 0.015 : 0.008]} />
        ) : (
          <fogExp2 attach="fog" args={[lighting.fogColor, lighting.isNight ? 0.009 : 0.002]} />
        )}

        {/* Render Weather Systems & Sky clouds */}
        <WeatherEffects weather={weather} />

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const [wx, _, wz] = gridToWorld(x, y);
              
              return (
                <React.Fragment key={`${x}-${y}`}>
                  <GroundTile 
                    type={tile.type}
                    growthStage={tile.growthStage}
                    moisture={tile.moisture}
                    nutrients={tile.nutrients}
                    x={x} y={y} 
                    grid={grid}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                    day={day}
                    weather={weather}
                    showFertilityHeatmap={showFertilityHeatmap}
                  />
                  
                   {/* Planted Flora Model */}
                  {tile.type !== EcosystemType.None && (
                    <group position={[wx, 0, wz]} raycast={() => null}>
                      <ProceduralTree 
                        type={tile.type} 
                        growthStage={tile.growthStage}
                        x={x} y={y} 
                        weather={weather}
                        growthProgress={tile.growthProgress}
                        nutrients={tile.nutrients}
                        day={day}
                      />
                    </group>
                  )}

                </React.Fragment>
              );
            })
          )}

          {/* Environmental Organisms (Birds, Rabbits, Insects, butterflies) */}
          <group raycast={() => null}>
            <ButterflySystem count={6} />
            <WildlifeSystem population={population} grid={grid} />

            {/* Placement Ripples */}
            {ripples.map(r => (
              <PlacementRipple key={r.id} position={r.pos} color={r.color} />
            ))}

            {/* Seeds Placement Floating Preview */}
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <ProceduralTree 
                  type={hoveredTool} 
                  growthStage={3} // Preview what the tree looks like at maturity
                  x={hoveredTile.x} 
                  y={hoveredTile.y} 
                  transparent 
                  opacity={0.6} 
                  weather={weather}
                  day={day}
                />
              </group>
            )}

            {/* Selective ground cursor */}
            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={getCursorColor()} 
                tile={grid[hoveredTile.y][hoveredTile.x]}
                day={day}
                weather={weather}
              />
            )}
          </group>
        </group>
        
        <SoftShadows size={8} samples={6} />
      </Canvas>
    </div>
  );
};

export default IsoMap;
