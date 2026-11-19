/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Grid, WeatherType } from '../../types';
import { GRID_SIZE } from '../../constants';
import {
  WORLD_OFFSET,
  getHash,
  getRiverMetrics,
  getSeasonForDay,
  getTileTopY,
  RIVER_MASK,
} from '../../utils/webgl';
import {
  sharedGeos,
  createAnimatedWaterMaterial,
  getOrganicBumpTexture,
  waterUniforms,
  _dummy,
  _color,
} from './MaterialLibrary';
import { ecosystemAudio } from '../../services/audio';

const TILE_COUNT = GRID_SIZE * GRID_SIZE;
const TILE_THICKNESS = 0.45;
const FLOATERS_PER_RIVER_TILE = 4;

interface InstancedTerrainProps {
  grid: Grid;
  day: number;
  weather: WeatherType;
  showFertilityHeatmap: boolean;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
  onClick: (x: number, y: number) => void;
}

// Precomputed static topology for river tiles, rocks, floaters, and ground cover slots
const RIVER_TILES: { x: number; y: number; wx: number; wz: number; topY: number; bend: number; shallow: number }[] = [];
const LAND_TILES: { x: number; y: number; wx: number; wz: number; topY: number }[] = [];

for (let y = 0; y < GRID_SIZE; y++) {
  for (let x = 0; x < GRID_SIZE; x++) {
    const wx = x - WORLD_OFFSET;
    const wz = y - WORLD_OFFSET;
    const topY = getTileTopY(x, y);
    if (RIVER_MASK[y][x]) {
      const m = getRiverMetrics(x, y);
      RIVER_TILES.push({ x, y, wx, wz, topY, bend: m.bendFactor, shallow: m.shallowFactor });
    } else {
      LAND_TILES.push({ x, y, wx, wz, topY });
    }
  }
}

const RIVER_COUNT = RIVER_TILES.length;
const TOTAL_FLOATERS = RIVER_COUNT * FLOATERS_PER_RIVER_TILE;
const MAX_BLADES = LAND_TILES.length * 3; // Up to 3 blades/flowers per land tile
const MAX_MOSS = LAND_TILES.length; // 1 moss pebble per land tile

interface FloaterSpec {
  wx: number;
  wz: number;
  topY: number;
  x: number;
  y: number;
  seed: number;
  isDebris: boolean;
  bend: number;
  shallow: number;
  size: number;
  lateralOffset: number;
  color: THREE.Color;
}

const FLOATER_SPECS: FloaterSpec[] = [];
for (let rIdx = 0; rIdx < RIVER_COUNT; rIdx++) {
  const rt = RIVER_TILES[rIdx];
  for (let i = 0; i < FLOATERS_PER_RIVER_TILE; i++) {
    const seed = getHash(rt.x * 12.3 + i * 4.7, rt.y * 19.5 - i * 6.2);
    const isDebris = seed > 0.45;
    const isBendsOrShallows = rt.bend > 0.4 || rt.shallow > 0.55;
    const baseSize = 0.02 + seed * 0.026;
    const size = isDebris ? baseSize : baseSize * (1.0 + rt.bend * 0.65 + rt.shallow * 1.15);
    const baseOffset = (seed - 0.5) * 0.72;
    const lateralOffset = isDebris
      ? baseOffset
      : baseOffset * (1.1 - rt.shallow * 0.6) + (seed > 0.5 ? 0.16 : -0.16) * rt.shallow;
    const hex = isDebris
      ? seed < 0.6
        ? '#ca8a04'
        : seed < 0.8
        ? '#b45309'
        : '#15803d'
      : isBendsOrShallows
      ? '#ffffff'
      : '#e2e8f0';

    FLOATER_SPECS.push({
      wx: rt.wx,
      wz: rt.wz,
      topY: rt.topY,
      x: rt.x,
      y: rt.y,
      seed,
      isDebris,
      bend: rt.bend,
      shallow: rt.shallow,
      size,
      lateralOffset,
      color: new THREE.Color(hex),
    });
  }
}

function computeTileColor(
  isRiver: boolean,
  moisture: number,
  nutrients: number,
  isDrySeason: boolean,
  isAutumnActive: boolean,
  isWinterActive: boolean,
  showFertilityHeatmap: boolean,
  out: THREE.Color
): THREE.Color {
  if (isRiver) {
    return out.set('#0b253b');
  }
  if (showFertilityHeatmap) {
    const ratio = Math.min(1, Math.max(0, nutrients / 100));
    const r = (245 - (245 - 62) * ratio) / 255;
    const g = (235 - (235 - 27) * ratio) / 255;
    const b = (208 - (208 - 4) * ratio) / 255;
    return out.setRGB(r, g, b);
  }
  if (isAutumnActive) {
    return out.set(moisture >= 65 ? '#854d0e' : '#b45309');
  }
  if (isWinterActive) {
    return out.set(moisture >= 65 ? '#0d9488' : '#475569');
  }
  if (isDrySeason && moisture <= 45) {
    return out.set('#ca8a04');
  }
  if (moisture >= 65) return out.set('#10b981');
  if (moisture <= 25) return out.set('#d97706');
  return out.set('#16a34a');
}

export const InstancedTerrain: React.FC<InstancedTerrainProps> = React.memo(
  ({ grid, day, weather, showFertilityHeatmap, onHover, onLeave, onClick }) => {
    const tileMeshRef = useRef<THREE.InstancedMesh>(null);
    const humusMeshRef = useRef<THREE.InstancedMesh>(null);
    const puddleMeshRef = useRef<THREE.InstancedMesh>(null);
    const bladeMeshRef = useRef<THREE.InstancedMesh>(null);
    const mossMeshRef = useRef<THREE.InstancedMesh>(null);
    const riverBedMeshRef = useRef<THREE.InstancedMesh>(null);
    const riverWaterMeshRef = useRef<THREE.InstancedMesh>(null);
    const riverRockMeshRef = useRef<THREE.InstancedMesh>(null);
    const floaterMeshRef = useRef<THREE.InstancedMesh>(null);

    // Smooth color lerping buffers (225 * 3 floats) so tile moisture/season/heatmap transitions glide
    const currentColorsRef = useRef<Float32Array>(new Float32Array(TILE_COUNT * 3));
    const targetColorsRef = useRef<Float32Array>(new Float32Array(TILE_COUNT * 3));
    const colorsInitializedRef = useRef(false);
    const colorsDirtyRef = useRef(true);

    // Materials (created once, properly disposed on unmount)
    const materials = useMemo(() => {
      const bumpMap = getOrganicBumpTexture();
      const terrainMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        roughness: 0.92,
        metalness: 0.02,
        bumpMap,
        bumpScale: 0.012,
      });
      const humusMat = new THREE.MeshStandardMaterial({
        color: '#3f2209',
        roughness: 0.96,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const puddleMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        roughness: 0.08,
        metalness: 0.82,
        transparent: true,
        opacity: 0.78,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const coverMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        roughness: 0.85,
        metalness: 0.02,
      });
      const riverBedMat = new THREE.MeshStandardMaterial({
        color: '#091f38',
        roughness: 0.95,
        flatShading: true,
      });
      const riverWaterMat = createAnimatedWaterMaterial({
        color: '#0284c7',
        opacity: 0.82,
        roughness: 0.08,
        metalness: 0.78,
        waveScale: 1.0,
        isRiver: true,
      });
      const riverRockMat = new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.72,
        metalness: 0.08,
        flatShading: true,
      });
      const floaterMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.25,
        metalness: 0.35,
        transparent: true,
        opacity: 0.85,
      });

      return {
        terrainMat,
        humusMat,
        puddleMat,
        coverMat,
        riverBedMat,
        riverWaterMat,
        riverRockMat,
        floaterMat,
      };
    }, []);

    useEffect(() => {
      return () => {
        Object.values(materials).forEach((m) => m.dispose());
      };
    }, [materials]);

    // Update river tint based on weather
    useEffect(() => {
      const targetHex =
        weather === 'Sunny'
          ? '#0284c7'
          : weather === 'Raining'
          ? '#0369a1'
          : weather === 'Autumn_Dew'
          ? '#0e5a7a'
          : '#075985';
      materials.riverWaterMat.color.set(targetHex);
    }, [weather, materials.riverWaterMat]);

    // Initialize static base matrices once (tiles, riverbeds, river surface, rocks, floater colors)
    useEffect(() => {
      if (tileMeshRef.current) {
        let idx = 0;
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const wx = x - WORLD_OFFSET;
            const wz = y - WORLD_OFFSET;
            const topY = getTileTopY(x, y);
            const centerY = topY - TILE_THICKNESS / 2;
            _dummy.position.set(wx, centerY, wz);
            _dummy.rotation.set(0, 0, 0);
            _dummy.scale.set(1, 1, 1);
            _dummy.updateMatrix();
            tileMeshRef.current.setMatrixAt(idx++, _dummy.matrix);
          }
        }
        tileMeshRef.current.instanceMatrix.needsUpdate = true;
        tileMeshRef.current.computeBoundingSphere();
      }

      if (riverBedMeshRef.current && riverWaterMeshRef.current && riverRockMeshRef.current) {
        for (let i = 0; i < RIVER_COUNT; i++) {
          const rt = RIVER_TILES[i];
          const centerY = rt.topY - TILE_THICKNESS / 2;

          // Deep riverbed block
          _dummy.position.set(rt.wx, centerY - 0.06, rt.wz);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(0.965, TILE_THICKNESS - 0.02, 0.965);
          _dummy.updateMatrix();
          riverBedMeshRef.current.setMatrixAt(i, _dummy.matrix);

          // River water surface (rotated flat, animated on GPU via shader)
          _dummy.position.set(rt.wx, rt.topY - 0.065, rt.wz);
          _dummy.rotation.set(-Math.PI / 2, 0, 0);
          _dummy.scale.set(0.97, 0.97, 1);
          _dummy.updateMatrix();
          riverWaterMeshRef.current.setMatrixAt(i, _dummy.matrix);

          // 2 granite boulders per river tile
          _dummy.position.set(rt.wx + 0.24, rt.topY - 0.06, rt.wz - 0.15);
          _dummy.rotation.set(0, rt.x * 0.7, 0);
          _dummy.scale.set(0.16, 0.09, 0.16);
          _dummy.updateMatrix();
          riverRockMeshRef.current.setMatrixAt(i * 2, _dummy.matrix);
          riverRockMeshRef.current.setColorAt(i * 2, _color.set('#64748b'));

          _dummy.position.set(rt.wx - 0.28, rt.topY - 0.05, rt.wz + 0.22);
          _dummy.rotation.set(0, rt.y * 1.1, 0);
          _dummy.scale.set(0.11, 0.07, 0.11);
          _dummy.updateMatrix();
          riverRockMeshRef.current.setMatrixAt(i * 2 + 1, _dummy.matrix);
          riverRockMeshRef.current.setColorAt(i * 2 + 1, _color.set('#475569'));
        }
        riverBedMeshRef.current.instanceMatrix.needsUpdate = true;
        riverWaterMeshRef.current.instanceMatrix.needsUpdate = true;
        riverRockMeshRef.current.instanceMatrix.needsUpdate = true;
        if (riverRockMeshRef.current.instanceColor) {
          riverRockMeshRef.current.instanceColor.needsUpdate = true;
        }
        riverBedMeshRef.current.computeBoundingSphere();
        riverWaterMeshRef.current.computeBoundingSphere();
        riverRockMeshRef.current.computeBoundingSphere();
      }

      if (floaterMeshRef.current) {
        for (let i = 0; i < TOTAL_FLOATERS; i++) {
          floaterMeshRef.current.setColorAt(i, FLOATER_SPECS[i].color);
        }
        if (floaterMeshRef.current.instanceColor) {
          floaterMeshRef.current.instanceColor.needsUpdate = true;
        }
      }
    }, []);

    // Update target tile colors, humus patches, puddles, and ground cover when grid/day/weather/heatmap changes
    useEffect(() => {
      const season = getSeasonForDay(day);
      const isDrySeason = season === 'summer';
      const isAutumnActive = weather === 'Autumn_Dew' || season === 'autumn';
      const isWinterActive = season === 'winter';

      const targets = targetColorsRef.current;
      const currents = currentColorsRef.current;
      const firstRun = !colorsInitializedRef.current;

      let humusIdx = 0;
      let puddleIdx = 0;
      let bladeIdx = 0;
      let mossIdx = 0;

      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        for (let x = 0; x < GRID_SIZE; x++) {
          const tile = row[x];
          const idx = y * GRID_SIZE + x;
          const isRiver = RIVER_MASK[y][x];
          const wx = x - WORLD_OFFSET;
          const wz = y - WORLD_OFFSET;
          const topY = getTileTopY(x, y);

          computeTileColor(
            isRiver,
            tile.moisture,
            tile.nutrients,
            isDrySeason,
            isAutumnActive,
            isWinterActive,
            showFertilityHeatmap,
            _color
          );

          const base = idx * 3;
          targets[base] = _color.r;
          targets[base + 1] = _color.g;
          targets[base + 2] = _color.b;

          if (firstRun && tileMeshRef.current) {
            currents[base] = _color.r;
            currents[base + 1] = _color.g;
            currents[base + 2] = _color.b;
            tileMeshRef.current.setColorAt(idx, _color);
          }

          if (!isRiver) {
            // Fertile humus patch
            if (tile.nutrients > 65 && humusMeshRef.current) {
              _dummy.position.set(wx, topY + 0.008, wz);
              _dummy.rotation.set(-Math.PI / 2, 0, 0);
              _dummy.scale.set(0.54, 0.54, 1);
              _dummy.updateMatrix();
              humusMeshRef.current.setMatrixAt(humusIdx++, _dummy.matrix);
            }

            // Saturated water puddle
            if (tile.moisture >= 85 && puddleMeshRef.current) {
              _dummy.position.set(wx + 0.2, topY + 0.012, wz - 0.2);
              _dummy.rotation.set(-Math.PI / 2, 0, 0);
              _dummy.scale.set(0.24, 0.2, 1);
              _dummy.updateMatrix();
              puddleMeshRef.current.setMatrixAt(puddleIdx++, _dummy.matrix);
            }

            // Micro ground cover (blades, sprouts, moss pebbles)
            const coverCount = tile.moisture <= 15 ? 0 : isDrySeason || tile.moisture <= 35 ? 1 : 3;
            for (let i = 0; i < coverCount; i++) {
              const gHash = getHash(x + i * 36, y - i * 14);
              const ox = (gHash - 0.5) * 0.62;
              const oz = (((gHash * 11.7) % 1) - 0.5) * 0.62;
              const hScale = 0.06 + ((gHash * 7) % 1) * 0.06;
              const tScale = 0.03 + ((gHash * 3) % 1) * 0.02;

              if (isDrySeason || tile.moisture <= 35) {
                _color.set(i === 1 ? '#d97706' : '#b45309');
              } else if (isAutumnActive) {
                _color.set(i === 0 ? '#ea580c' : i === 1 ? '#eab308' : '#ca8a04');
              } else if (isWinterActive) {
                _color.set(i === 0 ? '#e2e8f0' : '#475569');
              } else if (tile.moisture >= 65) {
                _color.set(i === 0 ? '#fb7185' : i === 1 ? '#34d399' : '#059669');
              } else {
                _color.set(i === 0 ? '#10b981' : '#15803d');
              }

              if (i < 2 && bladeMeshRef.current) {
                const height = i === 1 ? hScale * 1.55 : hScale;
                _dummy.position.set(wx + ox, topY + height * 0.5, wz + oz);
                _dummy.rotation.set(0.06, gHash * Math.PI * 2, i === 0 ? -0.18 : 0.06);
                _dummy.scale.set(tScale, height, tScale);
                _dummy.updateMatrix();
                bladeMeshRef.current.setMatrixAt(bladeIdx, _dummy.matrix);
                bladeMeshRef.current.setColorAt(bladeIdx, _color);
                bladeIdx++;
              } else if (i === 2 && mossMeshRef.current) {
                _dummy.position.set(wx + ox, topY + tScale * 0.3, wz + oz);
                _dummy.rotation.set(0, gHash * Math.PI, 0);
                _dummy.scale.set(tScale * 1.5, tScale * 0.8, tScale * 1.2);
                _dummy.updateMatrix();
                mossMeshRef.current.setMatrixAt(mossIdx, _dummy.matrix);
                mossMeshRef.current.setColorAt(mossIdx, _color);
                mossIdx++;
              }
            }
          }
        }
      }

      if (firstRun && tileMeshRef.current?.instanceColor) {
        tileMeshRef.current.instanceColor.needsUpdate = true;
        colorsInitializedRef.current = true;
      }
      colorsDirtyRef.current = true;

      if (humusMeshRef.current) {
        humusMeshRef.current.count = humusIdx;
        humusMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      if (puddleMeshRef.current) {
        puddleMeshRef.current.count = puddleIdx;
        puddleMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      if (bladeMeshRef.current) {
        bladeMeshRef.current.count = bladeIdx;
        bladeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (bladeMeshRef.current.instanceColor) bladeMeshRef.current.instanceColor.needsUpdate = true;
      }
      if (mossMeshRef.current) {
        mossMeshRef.current.count = mossIdx;
        mossMeshRef.current.instanceMatrix.needsUpdate = true;
        if (mossMeshRef.current.instanceColor) mossMeshRef.current.instanceColor.needsUpdate = true;
      }
    }, [grid, day, weather, showFertilityHeatmap]);

    // Single zero-GC frame loop for: water shader uniforms, smooth tile color damping, and all 160 river floaters
    useFrame((state, delta) => {
      const dt = Math.min(delta, 0.05);
      const t = state.clock.getElapsedTime();

      // 1. Update shared GLSL water shader uniforms
      waterUniforms.uTime.value = t;
      const targetWaveAmp = weather === 'Windy' ? 0.022 : weather === 'Raining' ? 0.015 : 0.01;
      const targetFlow = weather === 'Windy' ? 0.85 : weather === 'Raining' ? 0.65 : 0.45;
      waterUniforms.uWaveAmp.value = THREE.MathUtils.damp(waterUniforms.uWaveAmp.value, targetWaveAmp, 3, dt);
      waterUniforms.uFlowSpeed.value = THREE.MathUtils.damp(waterUniforms.uFlowSpeed.value, targetFlow, 3, dt);

      // 2. Smoothly damp tile colors toward targetColors (eliminates sudden color pops!)
      if (colorsDirtyRef.current && tileMeshRef.current) {
        const currents = currentColorsRef.current;
        const targets = targetColorsRef.current;
        const alpha = 1 - Math.exp(-5.5 * dt);
        let maxDiff = 0;

        for (let i = 0; i < TILE_COUNT; i++) {
          const b = i * 3;
          const dr = targets[b] - currents[b];
          const dg = targets[b + 1] - currents[b + 1];
          const db = targets[b + 2] - currents[b + 2];
          const diff = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
          if (diff > maxDiff) maxDiff = diff;
          currents[b] += dr * alpha;
          currents[b + 1] += dg * alpha;
          currents[b + 2] += db * alpha;
          _color.setRGB(currents[b], currents[b + 1], currents[b + 2]);
          tileMeshRef.current.setColorAt(i, _color);
        }

        if (tileMeshRef.current.instanceColor) {
          tileMeshRef.current.instanceColor.needsUpdate = true;
        }
        if (maxDiff < 0.002) {
          colorsDirtyRef.current = false;
        }
      }

      // 3. Animate all river foam & autumn leaf floaters in 1 single InstancedMesh pass
      if (floaterMeshRef.current) {
        const flowSpeed = weather === 'Windy' ? 0.58 : weather === 'Raining' ? 0.42 : 0.28;
        const waveSpeed = weather === 'Windy' ? 3.2 : weather === 'Raining' ? 1.8 : 1.4;
        const waveHeight = weather === 'Windy' ? 0.016 : weather === 'Raining' ? 0.011 : 0.007;

        for (let i = 0; i < TOTAL_FLOATERS; i++) {
          const f = FLOATER_SPECS[i];
          const progress = (t * flowSpeed + f.seed) % 1.0;
          const fade = Math.sin(progress * Math.PI);
          const flowPos = -0.46 + progress * 0.92;
          const lat = f.lateralOffset + Math.sin(t * 1.6 + f.seed * 12) * 0.045;
          const wave = Math.sin(t * waveSpeed + (f.x * 12.3 + f.y * 17.5) * 0.3) * waveHeight;
          const bob = Math.sin(t * (waveSpeed * (f.isDebris ? 1.6 : 2.1)) + f.seed * 8) * waveHeight * 0.35;

          _dummy.position.set(f.wx + flowPos, f.topY - 0.048 + wave + bob, f.wz + lat);
          if (f.isDebris) {
            _dummy.rotation.set(wave * 10, t * (0.8 + f.seed) + f.seed * 10, wave * 7);
            _dummy.scale.set(f.size * 1.8 * fade, 0.008, f.size * 1.0 * fade);
          } else {
            _dummy.rotation.set(0, t * 0.3, 0);
            const s = f.size * fade;
            _dummy.scale.set(s, s * 0.35, s);
          }
          _dummy.updateMatrix();
          floaterMeshRef.current.setMatrixAt(i, _dummy.matrix);
        }
        floaterMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // 4. Occasional organic river bubble audio pop
      if (Math.random() < 0.004) {
        ecosystemAudio.synthesizeWaterBubble();
      }
    });

    // --- O(1) Mathematical Raycast Picking on a Single Invisible Ground Plane ---
    const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
    const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);

    const worldPointToTile = useCallback((point: THREE.Vector3): { x: number; y: number } | null => {
      const gx = Math.round(point.x + WORLD_OFFSET);
      const gy = Math.round(point.z + WORLD_OFFSET);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        return { x: gx, y: gy };
      }
      return null;
    }, []);

    const handlePointerMove = useCallback(
      (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const coords = worldPointToTile(e.point);
        if (!coords) {
          if (lastCoordsRef.current) {
            lastCoordsRef.current = null;
            onLeave();
          }
          return;
        }
        if (!lastCoordsRef.current || lastCoordsRef.current.x !== coords.x || lastCoordsRef.current.y !== coords.y) {
          lastCoordsRef.current = coords;
          onHover(coords.x, coords.y);
        }
      },
      [worldPointToTile, onHover, onLeave]
    );

    const handlePointerOut = useCallback(() => {
      if (lastCoordsRef.current) {
        lastCoordsRef.current = null;
        onLeave();
      }
    }, [onLeave]);

    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      pointerStart.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    }, []);

    const handlePointerUp = useCallback(
      (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (!pointerStart.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        const distSq = dx * dx + dy * dy;
        const duration = performance.now() - pointerStart.current.time;
        pointerStart.current = null;

        if (distSq < 144 && duration < 450 && (e.button === 0 || e.button === undefined)) {
          const coords = worldPointToTile(e.point);
          if (coords) {
            onClick(coords.x, coords.y);
          }
        }
      },
      [worldPointToTile, onClick]
    );

    return (
      <group>
        {/* Single O(1) Picking Plane — eliminates raycasting against 1,000+ meshes */}
        <mesh
          position={[0, -0.28, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        {/* 1. All 225 Terrain Blocks in 1 Draw Call */}
        <instancedMesh
          ref={tileMeshRef}
          args={[sharedGeos.tileBox, materials.terrainMat, TILE_COUNT]}
          receiveShadow
          castShadow
          raycast={() => null}
        />

        {/* 2. Fertile Humus Loam Patches in 1 Draw Call */}
        <instancedMesh
          ref={humusMeshRef}
          args={[sharedGeos.plane, materials.humusMat, TILE_COUNT]}
          receiveShadow
          raycast={() => null}
        />

        {/* 3. Saturated Water Puddles in 1 Draw Call */}
        <instancedMesh
          ref={puddleMeshRef}
          args={[sharedGeos.plane, materials.puddleMat, TILE_COUNT]}
          raycast={() => null}
        />

        {/* 4. Ground Cover Grass Blades & Flowers in 1 Draw Call */}
        <instancedMesh
          ref={bladeMeshRef}
          args={[sharedGeos.blade, materials.coverMat, MAX_BLADES]}
          raycast={() => null}
        />

        {/* 5. Ground Cover Moss & Pebbles in 1 Draw Call */}
        <instancedMesh
          ref={mossMeshRef}
          args={[sharedGeos.sphere, materials.coverMat, MAX_MOSS]}
          raycast={() => null}
        />

        {/* 6. Riverbeds in 1 Draw Call */}
        <instancedMesh
          ref={riverBedMeshRef}
          args={[sharedGeos.box, materials.riverBedMat, RIVER_COUNT]}
          receiveShadow
          raycast={() => null}
        />

        {/* 7. Custom GLSL Flowing River Water Surface in 1 Draw Call */}
        <instancedMesh
          ref={riverWaterMeshRef}
          args={[sharedGeos.plane, materials.riverWaterMat, RIVER_COUNT]}
          receiveShadow
          raycast={() => null}
        />

        {/* 8. Riverbank Granite Boulders in 1 Draw Call */}
        <instancedMesh
          ref={riverRockMeshRef}
          args={[sharedGeos.sphere, materials.riverRockMat, RIVER_COUNT * 2]}
          castShadow
          receiveShadow
          raycast={() => null}
        />

        {/* 9. All ~160 Drifting River Foam & Leaf Floaters in 1 Draw Call */}
        <instancedMesh
          ref={floaterMeshRef}
          args={[sharedGeos.box, materials.floaterMat, TOTAL_FLOATERS]}
          frustumCulled={false}
          raycast={() => null}
        />
      </group>
    );
  }
);
