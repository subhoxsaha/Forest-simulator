/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Grid, EcosystemType, WeatherType, CameraPreset } from '../types';
import { GRID_SIZE } from '../constants';
import { detectSoftwareWebGL, gridToWorld, RIVER_MASK } from '../utils/webgl';
import { sharedGeos } from './scene/MaterialLibrary';
import { InstancedTerrain } from './scene/InstancedTerrain';
import { ProceduralEnvironment, DynamicAtmosphereRig, WeatherEffects } from './scene/AtmosphereAndWeather';
import { ProceduralTree, TreeWindController, InstancedCanopyPetals } from './scene/ProceduralTrees';
import { ButterflySystem, WildlifeSystem } from './scene/Wildlife';

interface RippleData {
  id: number;
  x: number;
  y: number;
  color: string;
}

const PlacementRipple: React.FC<{ x: number; y: number; color: string; onComplete: () => void }> = React.memo(
  ({ x, y, color, onComplete }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const matRef = useRef<THREE.MeshBasicMaterial>(null);
    const startTimeRef = useRef<number>(-1);
    const finishedRef = useRef(false);
    const [wx, , wz] = gridToWorld(x, y);

    useFrame((state) => {
      if (finishedRef.current) return;
      if (startTimeRef.current < 0) startTimeRef.current = state.clock.getElapsedTime();
      const elapsed = state.clock.getElapsedTime() - startTimeRef.current;
      const progress = Math.min(1, elapsed / 0.55);

      if (meshRef.current) {
        const s = 1 + progress * 2.5;
        meshRef.current.scale.set(s, s, 1);
      }
      if (matRef.current) {
        matRef.current.opacity = (1 - progress) * 0.85;
      }
      if (progress >= 1) {
        finishedRef.current = true;
        onComplete();
      }
    });

    return (
      <mesh
        ref={meshRef}
        position={[wx, -0.26, wz]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={sharedGeos.rippleRing}
        raycast={() => null}
      >
        <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    );
  }
);

const Cursor: React.FC<{ x: number; y: number; tool: EcosystemType; isInvalidRiver: boolean }> = React.memo(
  ({ x, y, tool, isInvalidRiver }) => {
    const [wx, , wz] = gridToWorld(x, y);
    const groupRef = useRef<THREE.Group>(null);

    const color = isInvalidRiver
      ? '#f87171'
      : tool === EcosystemType.None
      ? '#ef4444'
      : tool === EcosystemType.WateringCan
      ? '#38bdf8'
      : tool === EcosystemType.NutrientMulch
      ? '#f59e0b'
      : '#34d399';

    useFrame((state) => {
      if (!groupRef.current) return;
      const pulse = 1 + Math.sin(state.clock.getElapsedTime() * 5) * 0.025;
      groupRef.current.scale.set(pulse, 1, pulse);
    });

    return (
      <group ref={groupRef} position={[wx, -0.25, wz]} raycast={() => null}>
        <lineSegments geometry={sharedGeos.cursorEdges}>
          <lineBasicMaterial color={color} transparent opacity={0.95} />
        </lineSegments>
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={sharedGeos.plane} scale={[0.92, 0.92, 1]}>
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
        </mesh>
      </group>
    );
  }
);

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; zoom: number }
> = {
  iso: { pos: [20, 20, 20], target: [0, 0, 0], zoom: 48 },
  scenic: { pos: [23, 10.5, 16], target: [0, 0.3, 0], zoom: 56 },
  top: { pos: [0.01, 28, 4], target: [0, 0, 0], zoom: 44 },
};

const CameraRig: React.FC<{ preset: CameraPreset; presetNonce: number }> = ({ preset, presetNonce }) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera, size } = useThree();

  // Compute responsive base zoom so the entire 15x15 island fits cleanly on mobile and desktop
  const getResponsiveZoom = useCallback(
    (baseZoom: number) => {
      const minDim = Math.min(size.width, size.height);
      const factor = Math.max(0.62, Math.min(1.18, minDim / 820));
      return baseZoom * factor;
    },
    [size.width, size.height]
  );

  const transitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
  }>({
    active: false,
    pos: new THREE.Vector3(20, 20, 20),
    target: new THREE.Vector3(0, 0, 0),
    zoom: 48,
  });

  // Trigger smooth transition when preset or presetNonce changes
  const isFirstMount = useRef(true);
  useEffect(() => {
    const cfg = CAMERA_PRESETS[preset];
    const targetZoom = getResponsiveZoom(cfg.zoom);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      camera.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      if ('zoom' in camera) {
        (camera as THREE.OrthographicCamera).zoom = targetZoom;
        camera.updateProjectionMatrix();
      }
      if (controlsRef.current) {
        controlsRef.current.target.set(cfg.target[0], cfg.target[1], cfg.target[2]);
        controlsRef.current.update();
      }
      return;
    }

    transitionRef.current = {
      active: true,
      pos: new THREE.Vector3(...cfg.pos),
      target: new THREE.Vector3(...cfg.target),
      zoom: targetZoom,
    };
  }, [preset, presetNonce, camera, getResponsiveZoom]);

  // Cancel scripted camera transition immediately when user grabs the scene
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const onStart = () => {
      transitionRef.current.active = false;
    };
    ctrl.addEventListener('start', onStart);
    return () => {
      ctrl.removeEventListener('start', onStart);
    };
  }, []);

  useFrame((_, delta) => {
    const tr = transitionRef.current;
    const ctrl = controlsRef.current;
    if (!tr.active || !ctrl) return;

    const dt = Math.min(delta, 0.05);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tr.pos.x, 5.5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, tr.pos.y, 5.5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tr.pos.z, 5.5, dt);

    ctrl.target.x = THREE.MathUtils.damp(ctrl.target.x, tr.target.x, 5.5, dt);
    ctrl.target.y = THREE.MathUtils.damp(ctrl.target.y, tr.target.y, 5.5, dt);
    ctrl.target.z = THREE.MathUtils.damp(ctrl.target.z, tr.target.z, 5.5, dt);

    if ('zoom' in camera) {
      const ortho = camera as THREE.OrthographicCamera;
      ortho.zoom = THREE.MathUtils.damp(ortho.zoom, tr.zoom, 5.5, dt);
      ortho.updateProjectionMatrix();
    }

    ctrl.update();

    const posErr = camera.position.distanceTo(tr.pos);
    const tgtErr = ctrl.target.distanceTo(tr.target);
    const zoomErr = 'zoom' in camera ? Math.abs((camera as THREE.OrthographicCamera).zoom - tr.zoom) : 0;
    if (posErr < 0.05 && tgtErr < 0.03 && zoomErr < 0.15) {
      tr.active = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate
      enableZoom
      enablePan
      enableDamping
      dampingFactor={0.07}
      minZoom={24}
      maxZoom={115}
      maxPolarAngle={Math.PI / 2.25}
      minPolarAngle={0.22}
    />
  );
};

// Keep mobile viewport centered comfortably above the collapsible bottom dock
const TouchInteractionOffset: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { size } = useThree();
  const isCompact = size.width < 640;
  return <group position={[0, isCompact ? 0.85 : 0, 0]}>{children}</group>;
};

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: EcosystemType;
  population: number;
  weather: WeatherType;
  day: number;
  showFertilityHeatmap?: boolean;
  onTileHover?: (coords: { x: number; y: number } | null) => void;
  cameraPreset: CameraPreset;
  cameraPresetNonce: number;
}

const IsoMap: React.FC<IsoMapProps> = React.memo(
  ({
    grid,
    onTileClick,
    hoveredTool,
    population,
    weather,
    day,
    showFertilityHeatmap = false,
    onTileHover,
    cameraPreset,
    cameraPresetNonce,
  }) => {
    const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const [ripples, setRipples] = useState<RippleData[]>([]);
    const [contextLost, setContextLost] = useState(false);

    const handleHover = useCallback(
      (x: number, y: number) => {
        setHoveredTile((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
        onTileHover?.({ x, y });
      },
      [onTileHover]
    );

    const handleLeave = useCallback(() => {
      setHoveredTile(null);
      onTileHover?.(null);
    }, [onTileHover]);

    const handleClick = useCallback(
      (x: number, y: number) => {
        const isRiver = RIVER_MASK[y]?.[x] ?? false;
        const rippleColor = isRiver
          ? '#f87171'
          : hoveredTool === EcosystemType.WateringCan
          ? '#38bdf8'
          : hoveredTool === EcosystemType.NutrientMulch
          ? '#eab308'
          : hoveredTool === EcosystemType.None
          ? '#ef4444'
          : '#34d399';

        const id = Date.now() + Math.random();
        setRipples((prev) => [...prev.slice(-10), { id, x, y, color: rippleColor }]);
        onTileClick(x, y);
      },
      [hoveredTool, onTileClick]
    );

    const removeRipple = useCallback((id: number) => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const isTreeSpecies =
      hoveredTool !== EcosystemType.None &&
      hoveredTool !== EcosystemType.WateringCan &&
      hoveredTool !== EcosystemType.NutrientMulch &&
      hoveredTool !== EcosystemType.DeadTree;

    const hoveredIsRiver = hoveredTile ? RIVER_MASK[hoveredTile.y]?.[hoveredTile.x] ?? false : false;
    const hoveredTileData = hoveredTile ? grid[hoveredTile.y]?.[hoveredTile.x] : null;
    const showPreview =
      Boolean(hoveredTile) &&
      !hoveredIsRiver &&
      isTreeSpecies &&
      hoveredTileData?.type === EcosystemType.None;

    const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0, 0, 0];

    // Flatten only occupied tiles for tree mounting (zero empty tile components)
    const occupiedTiles = useMemo(() => {
      const list: { x: number; y: number; type: EcosystemType; growthStage: number; growthProgress: number }[] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        for (let x = 0; x < GRID_SIZE; x++) {
          const tile = row[x];
          if (tile.type !== EcosystemType.None) {
            list.push({
              x: tile.x,
              y: tile.y,
              type: tile.type,
              growthStage: tile.growthStage,
              growthProgress: tile.growthProgress,
            });
          }
        }
      }
      return list;
    }, [grid]);

    return (
      <div className="relative w-full h-full touch-none select-none bg-[#071512]">
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: isSoftwareGl ? 'default' : 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.04,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const onLost = (e: Event) => {
              e.preventDefault();
              setContextLost(true);
            };
            const onRestored = () => {
              setContextLost(false);
            };
            canvas.addEventListener('webglcontextlost', onLost, false);
            canvas.addEventListener('webglcontextrestored', onRestored, false);
          }}
        >
          <OrthographicCamera makeDefault zoom={48} position={[20, 20, 20]} near={-120} far={260} />
          <CameraRig preset={cameraPreset} presetNonce={cameraPresetNonce} />

          {/* Procedural Studio/Sky PMREM Reflections & 60fps Zero-Rerender Celestial Rig */}
          <ProceduralEnvironment />
          <DynamicAtmosphereRig weather={weather} isSoftwareGl={isSoftwareGl} />

          <TouchInteractionOffset>
            {/* Batched Instanced Terrain, River, Grass, Rocks & Single Picking Plane */}
            <InstancedTerrain
              grid={grid}
              day={day}
              weather={weather}
              showFertilityHeatmap={showFertilityHeatmap}
              onHover={handleHover}
              onLeave={handleLeave}
              onClick={handleClick}
            />

            {/* Single Centralized Wind Controller & Instanced Canopy Petals */}
            <TreeWindController weather={weather} />
            <InstancedCanopyPetals grid={grid} weather={weather} />

            {/* Living Botanical Models (only mounted for occupied tiles) */}
            <group raycast={() => null}>
              {occupiedTiles.map((tile) => {
                const [wx, , wz] = gridToWorld(tile.x, tile.y);
                return (
                  <group key={`${tile.x}-${tile.y}`} position={[wx, -0.3, wz]}>
                    <ProceduralTree
                      type={tile.type}
                      growthStage={tile.growthStage}
                      x={tile.x}
                      y={tile.y}
                      weather={weather}
                      growthProgress={tile.growthProgress}
                      day={day}
                    />
                  </group>
                );
              })}
            </group>

            {/* Interactive Placement Preview & Cursor */}
            {hoveredTile && (
              <>
                <Cursor
                  x={hoveredTile.x}
                  y={hoveredTile.y}
                  tool={hoveredTool}
                  isInvalidRiver={hoveredIsRiver && isTreeSpecies}
                />
                {showPreview && (
                  <group position={[previewPos[0], -0.28, previewPos[2]]} raycast={() => null}>
                    <ProceduralTree
                      type={hoveredTool}
                      growthStage={2}
                      x={hoveredTile.x}
                      y={hoveredTile.y}
                      transparent
                      opacity={0.58}
                      weather={weather}
                      day={day}
                      isPreview
                    />
                  </group>
                )}
              </>
            )}

            {/* Action Ripples */}
            {ripples.map((r) => (
              <PlacementRipple
                key={r.id}
                x={r.x}
                y={r.y}
                color={r.color}
                onComplete={() => removeRipple(r.id)}
              />
            ))}

            {/* Atmospheric Effects & Ecosystem Fauna */}
            <WeatherEffects weather={weather} />
            <ButterflySystem count={9} weather={weather} />
            <WildlifeSystem population={population} grid={grid} weather={weather} />
          </TouchInteractionOffset>
        </Canvas>

        {contextLost && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#071512]/95 p-6 text-center">
            <div className="max-w-sm rounded-2xl border border-emerald-500/30 bg-[#0b1f1b] p-6 shadow-2xl">
              <p className="font-display text-lg font-semibold text-emerald-50">Graphics Context Paused</p>
              <p className="mt-2 text-xs text-emerald-200/75 leading-relaxed">
                Your browser paused WebGL rendering. It will resume automatically, or you can reload to restore the sanctuary.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default IsoMap;
