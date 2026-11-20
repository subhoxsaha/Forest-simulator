/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CivilizationState, Grid } from '../../types';
import { GRID_SIZE } from '../../constants';
import { WORLD_OFFSET, getTileTopY, gridToWorld, RIVER_MASK } from '../../utils/webgl';
import { birdFlightState } from '../../simulation/birdFlightState';
import { sharedGeos, _dummy } from './MaterialLibrary';

const TRAIL_POINTS = 28;
const _forward = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _camCurrent = new THREE.Vector3();
const _lookCurrent = new THREE.Vector3();
const _wingTipL = new THREE.Vector3();
const _wingTipR = new THREE.Vector3();
const _localTip = new THREE.Vector3();

function shortestAngleDiff(current: number, target: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

interface BirdFlightSystemProps {
  active: boolean;
  grid: Grid;
  civilization: CivilizationState;
}

/**
 * Full 3D Bird Flight camera & articulated Golden Forest Falcon:
 * - PerspectiveCamera (smooth chase cam OR 1st-person bird's-eye view via V)
 * - Articulated 2-joint flapping/gliding wings, fanning tail, banking roll
 * - Wingtip slipstream wind particles
 * - Intuitive keyboard + pointer-drag flight + Auto-Soar scenic island tour
 */
export const BirdFlightSystem: React.FC<BirdFlightSystemProps> = React.memo(
  ({ active, grid, civilization }) => {
    const { gl } = useThree();
    const camRef = useRef<THREE.PerspectiveCamera | null>(null);
    const birdGroupRef = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const tailRef = useRef<THREE.Group>(null);
    const leftInnerWingRef = useRef<THREE.Group>(null);
    const rightInnerWingRef = useRef<THREE.Group>(null);
    const leftOuterWingRef = useRef<THREE.Group>(null);
    const rightOuterWingRef = useRef<THREE.Group>(null);
    const trailMeshRef = useRef<THREE.InstancedMesh>(null);

    const gridRef = useRef(grid);
    const civRef = useRef(civilization);
    gridRef.current = grid;
    civRef.current = civilization;

    const camInitializedRef = useRef(false);
    const flapPhaseRef = useRef(0);
    const flapEnergyRef = useRef(0.6);
    const soarClockRef = useRef(0);
    const trailCursorRef = useRef(0);
    const trailTimerRef = useRef(0);

    // Pre-allocated wingtip trail ring buffer (left + right = TRAIL_POINTS * 2)
    const trailBuffer = useMemo(
      () =>
        Array.from({ length: TRAIL_POINTS * 2 }, () => ({
          x: 0,
          y: -100,
          z: 0,
          age: 1,
        })),
      []
    );

    const birdMats = useMemo(() => {
      const plumageBack = new THREE.MeshStandardMaterial({
        color: '#8a4b1f',
        roughness: 0.62,
        metalness: 0.06,
      });
      const plumageChest = new THREE.MeshStandardMaterial({
        color: '#f5e6cc',
        roughness: 0.72,
        metalness: 0.02,
      });
      const plumageTips = new THREE.MeshStandardMaterial({
        color: '#2b2019',
        roughness: 0.58,
        metalness: 0.08,
      });
      const goldAccent = new THREE.MeshStandardMaterial({
        color: '#eab308',
        roughness: 0.35,
        metalness: 0.18,
      });
      const eyeMat = new THREE.MeshStandardMaterial({
        color: '#09090b',
        roughness: 0.1,
        metalness: 0.3,
      });
      const trailMat = new THREE.MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      return { plumageBack, plumageChest, plumageTips, goldAccent, eyeMat, trailMat };
    }, []);

    useEffect(() => {
      return () => {
        Object.values(birdMats).forEach((m) => m.dispose());
      };
    }, [birdMats]);

    // Smooth pointer-drag steering directly on the WebGL canvas while flying
    useEffect(() => {
      if (!active) return;
      camInitializedRef.current = false;
      const dom = gl.domElement;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        birdFlightState.dragYawDelta -= dx * 0.0042;
        birdFlightState.dragPitchDelta -= dy * 0.0032;
      };

      const onPointerUp = () => {
        dragging = false;
      };

      const onWheel = (e: WheelEvent) => {
        birdFlightState.dragPitchDelta -= Math.sign(e.deltaY) * 0.045;
      };

      dom.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      dom.addEventListener('wheel', onWheel, { passive: true });

      return () => {
        dom.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        dom.removeEventListener('wheel', onWheel);
      };
    }, [active, gl]);

    useFrame((_, delta) => {
      if (!active) return;
      const dt = Math.min(delta, 0.05);
      const st = birdFlightState;
      const inp = st.input;

      // Cancel auto-soar / waypoint swoop immediately if player takes manual control
      if (st.hasManualInput()) {
        if (st.autoSoar) st.autoSoar = false;
        if (st.flyToTarget) {
          st.flyToTarget = null;
          st.activeSpotPreset = 'free';
        }
      }

      let targetRoll = 0;
      let targetSpeed = 3.1;
      let climbingNow = false;

      if (st.autoSoar) {
        // Scenic continuous figure-8 & spiral tour covering river, village, canopy, and coastal islets
        soarClockRef.current += dt * 0.24;
        const p = soarClockRef.current;
        const goalX = Math.sin(p) * 8.2 + Math.sin(p * 2.1) * 1.8;
        const goalZ = Math.sin(p * 2) * 5.8 + Math.cos(p * 0.7) * 2.2;
        const goalY = 3.6 + Math.sin(p * 1.45) * 2.3 + (Math.cos(p * 0.5) + 1) * 0.8;

        const dx = goalX - st.pos.x;
        const dy = goalY - st.pos.y;
        const dz = goalZ - st.pos.z;
        const desiredYaw = Math.atan2(-dx, -dz);
        const yawDiff = shortestAngleDiff(st.yaw, desiredYaw);
        st.yaw += yawDiff * Math.min(1, dt * 2.4);

        const horizDist = Math.max(0.5, Math.hypot(dx, dz));
        const desiredPitch = THREE.MathUtils.clamp(Math.atan2(dy, horizDist), -0.45, 0.45);
        st.pitch = THREE.MathUtils.damp(st.pitch, desiredPitch, 2.8, dt);
        targetRoll = THREE.MathUtils.clamp(-yawDiff * 1.1, -0.58, 0.58);
        targetSpeed = 3.55;
        climbingNow = dy > 0.35;
      } else if (st.flyToTarget) {
        // Smooth swoop toward chosen island spot (River / Canopy / Village / Clouds)
        const dx = st.flyToTarget.x - st.pos.x;
        const dy = st.flyToTarget.y - st.pos.y;
        const dz = st.flyToTarget.z - st.pos.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 1.3) {
          st.flyToTarget = null;
          st.activeSpotPreset = 'free';
        } else {
          const desiredYaw = Math.atan2(-dx, -dz);
          const yawDiff = shortestAngleDiff(st.yaw, desiredYaw);
          st.yaw += yawDiff * Math.min(1, dt * 3.8);
          const horizDist = Math.max(0.4, Math.hypot(dx, dz));
          const desiredPitch = THREE.MathUtils.clamp(Math.atan2(dy, horizDist), -0.55, 0.52);
          st.pitch = THREE.MathUtils.damp(st.pitch, desiredPitch, 3.6, dt);
          targetRoll = THREE.MathUtils.clamp(-yawDiff * 1.25, -0.65, 0.65);
          targetSpeed = Math.min(5.6, 2.8 + dist * 0.32);
          climbingNow = dy > 0.25;
        }
      } else {
        // Direct manual flight controls (WASD / Arrows + Space/E climb + Q/C descend + Shift boost + Mouse Drag)
        const turnInput = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
        const yawRate = turnInput * 1.85;
        st.yaw += yawRate * dt + st.dragYawDelta;

        const pitchInput = (inp.climb ? 1 : 0) - (inp.descend ? 1 : 0);
        const nextPitch = st.pitch + pitchInput * 1.15 * dt + st.dragPitchDelta;
        // Gently level pitch back toward neutral horizon when no vertical keys are pressed
        st.pitch = THREE.MathUtils.clamp(
          pitchInput === 0 && Math.abs(st.dragPitchDelta) < 0.0001
            ? THREE.MathUtils.damp(nextPitch, -0.05, 0.75, dt)
            : nextPitch,
          -0.68,
          0.62
        );

        targetRoll = THREE.MathUtils.clamp(turnInput * 0.55 + st.dragYawDelta * 8.0, -0.68, 0.68);

        if (inp.boost) {
          targetSpeed = 6.2;
        } else if (inp.forward) {
          targetSpeed = 4.6;
        } else if (inp.brake) {
          targetSpeed = 1.05;
        } else {
          targetSpeed = 2.85;
        }

        climbingNow = inp.climb || st.pitch > 0.12 || inp.boost;
      }

      // Consume accumulated drag deltas
      st.dragYawDelta = 0;
      st.dragPitchDelta = 0;

      // Smooth speed & roll damping
      st.speed = THREE.MathUtils.damp(st.speed, targetSpeed, 4.2, dt);
      st.roll = THREE.MathUtils.damp(st.roll, targetRoll, 5.5, dt);

      // Compute forward direction vector from yaw & pitch (yaw=0 -> -Z)
      const cosPitch = Math.cos(st.pitch);
      _forward.set(
        -Math.sin(st.yaw) * cosPitch,
        Math.sin(st.pitch),
        -Math.cos(st.yaw) * cosPitch
      );

      // Integrate bird position
      st.pos.addScaledVector(_forward, st.speed * dt);

      // Soft radial boundary over surrounding archipelago (radius 26)
      const radialDist = Math.hypot(st.pos.x, st.pos.z);
      if (radialDist > 25) {
        const pull = (radialDist - 25) * 0.4;
        st.pos.x -= (st.pos.x / radialDist) * pull;
        st.pos.z -= (st.pos.z / radialDist) * pull;
        const toCenterYaw = Math.atan2(-st.pos.x, -st.pos.z);
        st.yaw += shortestAngleDiff(st.yaw, toCenterYaw) * dt * 1.8;
      }

      // Dynamic terrain / ocean clearance floor so the bird skims water & meadows gracefully without clipping
      const gx = Math.round(st.pos.x + WORLD_OFFSET);
      const gy = Math.round(st.pos.z + WORLD_OFFSET);
      let floorY = 0.25;
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        const tileTop = getTileTopY(gx, gy);
        floorY = tileTop + 0.42;
      } else {
        floorY = -0.15; // Skimming just above the sparkling archipelago ocean
      }

      if (st.pos.y < floorY) {
        st.pos.y = THREE.MathUtils.damp(st.pos.y, floorY, 12, dt);
        if (st.pitch < 0) st.pitch = THREE.MathUtils.damp(st.pitch, 0.05, 8, dt);
      } else if (st.pos.y > 14.5) {
        st.pos.y = THREE.MathUtils.damp(st.pos.y, 14.5, 6, dt);
        if (st.pitch > 0) st.pitch = THREE.MathUtils.damp(st.pitch, -0.05, 6, dt);
      }

      st.altitude = Math.max(0.2, st.pos.y + 0.3);

      // Update descriptive spot label for HUD
      let spot = 'Coastal Archipelago';
      if (st.pos.y > 8.2) {
        spot = 'High Among the Clouds';
      } else if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        const nearSettlement = civRef.current.settlements.some(
          (s) => Math.hypot(s.x - gx, s.y - gy) <= 2.3
        );
        if (RIVER_MASK[gy]?.[gx]) {
          spot = 'Skimming River Stream';
        } else if (nearSettlement) {
          spot = 'Over Human Settlement';
        } else if (gridRef.current[gy]?.[gx]?.type !== 'None') {
          spot = 'Above Forest Canopy';
        } else {
          spot = 'Over Sunlit Meadow';
        }
      }
      st.spotLabel = spot;

      // Animate 3D articulated Golden Falcon mesh
      if (birdGroupRef.current) {
        birdGroupRef.current.visible = !st.firstPerson;
        birdGroupRef.current.position.copy(st.pos);
        birdGroupRef.current.rotation.set(st.pitch, st.yaw, st.roll, 'YXZ');

        // Flap strongly when climbing, hovering slow, or boosting; glide smoothly when diving/cruising
        const wantFlap = climbingNow || st.speed < 1.8 || st.pitch > 0.06 ? 1.0 : 0.22;
        flapEnergyRef.current = THREE.MathUtils.damp(flapEnergyRef.current, wantFlap, 3.8, dt);
        const flapFreq = 5.5 + flapEnergyRef.current * 5.2 + (inp.boost ? 2.5 : 0);
        flapPhaseRef.current += dt * flapFreq;

        const wingWave = Math.sin(flapPhaseRef.current);
        const outerLag = Math.sin(flapPhaseRef.current - 0.75);
        const innerAngle = wingWave * (0.14 + flapEnergyRef.current * 0.52) + 0.08;
        const outerAngle = outerLag * (0.1 + flapEnergyRef.current * 0.42) - 0.06;

        if (leftInnerWingRef.current && rightInnerWingRef.current) {
          leftInnerWingRef.current.rotation.z = innerAngle;
          rightInnerWingRef.current.rotation.z = -innerAngle;
        }
        if (leftOuterWingRef.current && rightOuterWingRef.current) {
          leftOuterWingRef.current.rotation.z = outerAngle;
          rightOuterWingRef.current.rotation.z = -outerAngle;
        }
        if (tailRef.current) {
          tailRef.current.rotation.x = -st.pitch * 0.45 + 0.06;
          tailRef.current.rotation.z = -st.roll * 0.35;
        }
        if (headRef.current) {
          headRef.current.rotation.y = -st.roll * 0.35;
        }

        // Emit subtle wingtip wind trails
        trailTimerRef.current += dt;
        if (trailTimerRef.current > 0.032 && !st.firstPerson) {
          trailTimerRef.current = 0;
          birdGroupRef.current.updateMatrixWorld();

          _localTip.set(-0.62, Math.sin(innerAngle) * 0.25, 0.05);
          _wingTipL.copy(_localTip).applyMatrix4(birdGroupRef.current.matrixWorld);

          _localTip.set(0.62, Math.sin(innerAngle) * 0.25, 0.05);
          _wingTipR.copy(_localTip).applyMatrix4(birdGroupRef.current.matrixWorld);

          const iL = (trailCursorRef.current % TRAIL_POINTS) * 2;
          trailBuffer[iL].x = _wingTipL.x;
          trailBuffer[iL].y = _wingTipL.y;
          trailBuffer[iL].z = _wingTipL.z;
          trailBuffer[iL].age = 0;

          trailBuffer[iL + 1].x = _wingTipR.x;
          trailBuffer[iL + 1].y = _wingTipR.y;
          trailBuffer[iL + 1].z = _wingTipR.z;
          trailBuffer[iL + 1].age = 0;

          trailCursorRef.current++;
        }
      }

      // Update wingtip slipstream ribbon particles
      if (trailMeshRef.current) {
        for (let i = 0; i < TRAIL_POINTS * 2; i++) {
          const tp = trailBuffer[i];
          tp.age = Math.min(1, tp.age + dt * 1.65);
          const s = (1 - tp.age) * (0.022 + (st.speed / 6.2) * 0.022);
          if (s <= 0.002 || st.firstPerson) {
            _dummy.position.set(0, -100, 0);
            _dummy.scale.set(0.001, 0.001, 0.001);
          } else {
            _dummy.position.set(tp.x, tp.y, tp.z);
            _dummy.rotation.set(0, 0, 0);
            _dummy.scale.set(s, s, s);
          }
          _dummy.updateMatrix();
          trailMeshRef.current.setMatrixAt(i, _dummy.matrix);
        }
        trailMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Smooth spring-damped PerspectiveCamera tracking (3rd-person chase or 1st-person bird's-eye)
      if (camRef.current) {
        if (st.firstPerson) {
          _camGoal.copy(st.pos).addScaledVector(_forward, 0.25);
          _camGoal.y += 0.09;
          _lookGoal.copy(st.pos).addScaledVector(_forward, 6.5);
        } else {
          const chaseDist = 2.45 + (st.speed - 2.8) * 0.14;
          const chaseLift = 0.72 - st.pitch * 0.45;
          _camGoal.set(
            st.pos.x - _forward.x * chaseDist,
            Math.max(floorY + 0.15, st.pos.y - _forward.y * chaseDist + chaseLift),
            st.pos.z - _forward.z * chaseDist
          );
          _lookGoal.set(
            st.pos.x + _forward.x * 3.8,
            st.pos.y + _forward.y * 2.4 + 0.08,
            st.pos.z + _forward.z * 3.8
          );
        }

        if (!camInitializedRef.current) {
          _camCurrent.copy(_camGoal);
          _lookCurrent.copy(_lookGoal);
          camInitializedRef.current = true;
        } else {
          const dampK = st.firstPerson ? 14 : 6.2;
          _camCurrent.x = THREE.MathUtils.damp(_camCurrent.x, _camGoal.x, dampK, dt);
          _camCurrent.y = THREE.MathUtils.damp(_camCurrent.y, _camGoal.y, dampK, dt);
          _camCurrent.z = THREE.MathUtils.damp(_camCurrent.z, _camGoal.z, dampK, dt);

          _lookCurrent.x = THREE.MathUtils.damp(_lookCurrent.x, _lookGoal.x, 8.5, dt);
          _lookCurrent.y = THREE.MathUtils.damp(_lookCurrent.y, _lookGoal.y, 8.5, dt);
          _lookCurrent.z = THREE.MathUtils.damp(_lookCurrent.z, _lookGoal.z, 8.5, dt);
        }

        camRef.current.position.copy(_camCurrent);
        camRef.current.lookAt(_lookCurrent);

        // Dynamic speed FOV sensation (58° calm glide -> 72° rapid swoop)
        const targetFov = THREE.MathUtils.clamp(58 + (st.speed - 2.5) * 3.4, 56, 73);
        if (Math.abs(camRef.current.fov - targetFov) > 0.05) {
          camRef.current.fov = THREE.MathUtils.damp(camRef.current.fov, targetFov, 4.5, dt);
          camRef.current.updateProjectionMatrix();
        }
      }
    });

    if (!active) return null;

    return (
      <group raycast={() => null}>
        <PerspectiveCamera
          ref={camRef}
          makeDefault
          fov={60}
          near={0.08}
          far={340}
          position={[0, 5.4, 11]}
        />

        {/* Detailed Articulated Golden Forest Falcon (local -Z is forward!) */}
        <group ref={birdGroupRef}>
          {/* Sculpted Aerodynamic Torso */}
          <mesh scale={[0.16, 0.14, 0.44]} geometry={sharedGeos.smoothSphere} material={birdMats.plumageBack} castShadow />
          {/* Warm Speckled Breast */}
          <mesh position={[0, -0.04, -0.05]} scale={[0.13, 0.11, 0.34]} geometry={sharedGeos.smoothSphere} material={birdMats.plumageChest} />

          {/* Sculpted Head, Eyes & Curved Raptor Beak */}
          <group ref={headRef} position={[0, 0.055, -0.23]}>
            <mesh scale={[0.105, 0.095, 0.13]} geometry={sharedGeos.smoothSphere} material={birdMats.plumageBack} castShadow />
            <mesh position={[0, -0.02, -0.02]} scale={[0.08, 0.065, 0.1]} geometry={sharedGeos.smoothSphere} material={birdMats.plumageChest} />
            {/* Upper curved beak */}
            <mesh position={[0, -0.012, -0.1]} rotation={[-Math.PI / 2 - 0.18, 0, 0]} scale={[0.042, 0.095, 0.042]} geometry={sharedGeos.cone} material={birdMats.goldAccent} />
            {/* Expressive dark eyes */}
            <mesh position={[0.045, 0.015, -0.035]} scale={0.022} geometry={sharedGeos.smoothSphere} material={birdMats.eyeMat} />
            <mesh position={[-0.045, 0.015, -0.035]} scale={0.022} geometry={sharedGeos.smoothSphere} material={birdMats.eyeMat} />
          </group>

          {/* Left Articulated 2-Segment Wing */}
          <group ref={leftInnerWingRef} position={[-0.07, 0.03, -0.04]}>
            {/* Inner wing covert */}
            <mesh position={[-0.17, 0, 0.02]} scale={[0.34, 0.032, 0.19]} geometry={sharedGeos.box} material={birdMats.plumageBack} castShadow />
            <mesh position={[-0.17, -0.012, 0.02]} scale={[0.31, 0.018, 0.16]} geometry={sharedGeos.box} material={birdMats.plumageChest} />
            {/* Outer wing & dark flight feathers */}
            <group ref={leftOuterWingRef} position={[-0.33, 0, 0.02]}>
              <mesh position={[-0.14, 0, 0.03]} rotation={[0, 0.16, 0]} scale={[0.29, 0.022, 0.14]} geometry={sharedGeos.box} material={birdMats.plumageTips} castShadow />
              <mesh position={[-0.27, 0, 0.06]} rotation={[0, 0.32, 0]} scale={[0.14, 0.016, 0.07]} geometry={sharedGeos.box} material={birdMats.plumageTips} />
            </group>
          </group>

          {/* Right Articulated 2-Segment Wing */}
          <group ref={rightInnerWingRef} position={[0.07, 0.03, -0.04]}>
            <mesh position={[0.17, 0, 0.02]} scale={[0.34, 0.032, 0.19]} geometry={sharedGeos.box} material={birdMats.plumageBack} castShadow />
            <mesh position={[0.17, -0.012, 0.02]} scale={[0.31, 0.018, 0.16]} geometry={sharedGeos.box} material={birdMats.plumageChest} />
            <group ref={rightOuterWingRef} position={[0.33, 0, 0.02]}>
              <mesh position={[0.14, 0, 0.03]} rotation={[0, -0.16, 0]} scale={[0.29, 0.022, 0.14]} geometry={sharedGeos.box} material={birdMats.plumageTips} castShadow />
              <mesh position={[0.27, 0, 0.06]} rotation={[0, -0.32, 0]} scale={[0.14, 0.016, 0.07]} geometry={sharedGeos.box} material={birdMats.plumageTips} />
            </group>
          </group>

          {/* Fanned Tail Feathers */}
          <group ref={tailRef} position={[0, 0.01, 0.21]}>
            <mesh position={[0, 0, 0.1]} scale={[0.16, 0.02, 0.22]} geometry={sharedGeos.box} material={birdMats.plumageTips} castShadow />
            <mesh position={[-0.07, 0, 0.11]} rotation={[0, -0.22, 0]} scale={[0.09, 0.018, 0.2]} geometry={sharedGeos.box} material={birdMats.plumageBack} />
            <mesh position={[0.07, 0, 0.11]} rotation={[0, 0.22, 0]} scale={[0.09, 0.018, 0.2]} geometry={sharedGeos.box} material={birdMats.plumageBack} />
          </group>
        </group>

        {/* Wingtip Slipstream Particles */}
        <instancedMesh
          ref={trailMeshRef}
          args={[sharedGeos.smoothSphere, birdMats.trailMat, TRAIL_POINTS * 2]}
          frustumCulled={false}
        />
      </group>
    );
  }
);

/**
 * Helper to compute scenic world coordinates for quick Bird Flight spot jumps.
 */
export function getBirdSpotCoordinates(
  preset: 'river' | 'canopy' | 'village' | 'clouds',
  civilization: CivilizationState
): [number, number, number] {
  if (preset === 'village' && civilization.settlements.length > 0) {
    const camp = civilization.settlements[0];
    const [wx, , wz] = gridToWorld(camp.x, camp.y);
    return [wx, 2.5, wz + 1.2];
  }
  if (preset === 'river') {
    return [0.2, 1.35, 0.4];
  }
  if (preset === 'clouds') {
    return [-4.5, 9.2, -3.5];
  }
  // canopy
  return [2.8, 3.3, -2.5];
}
