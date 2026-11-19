/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GRID_SIZE } from '../constants';
import { SeasonType } from '../types';

export const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;

export function gridToWorld(x: number, y: number): [number, number, number] {
  return [x - WORLD_OFFSET, 0, y - WORLD_OFFSET];
}

export function getHash(x: number, y: number): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
}

export function getRandomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Precomputed deterministic river mask for 15x15 grid (O(1) lookup)
export const RIVER_MASK: boolean[][] = Array.from({ length: GRID_SIZE }, (_, y) =>
  Array.from({ length: GRID_SIZE }, (_, x) => {
    const riverY = x + Math.sin(x * 0.6) * 1.25;
    return Math.abs(y - riverY) < 1.45;
  })
);

export const NEAR_RIVER_MASK: boolean[][] = Array.from({ length: GRID_SIZE }, (_, y) =>
  Array.from({ length: GRID_SIZE }, (_, x) => {
    if (RIVER_MASK[y][x]) return false;
    const dirs = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    return dirs.some(([nx, ny]) => nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && RIVER_MASK[ny][nx]);
  })
);

export function isRiverTile(x: number, y: number): boolean {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  return RIVER_MASK[y][x];
}

export function getRiverMetrics(x: number, y: number) {
  const riverY = x + Math.sin(x * 0.6) * 1.25;
  const distanceToCenter = Math.abs(y - riverY);
  const bendFactor = Math.abs(Math.sin(x * 0.6));
  const shallowFactor = Math.min(1.0, distanceToCenter / 1.45);
  return { distanceToCenter, bendFactor, shallowFactor };
}

export function getSeasonForDay(day: number): SeasonType {
  const cycle = ((day - 1) % 40 + 40) % 40;
  if (cycle < 10) return 'spring';
  if (cycle < 20) return 'summer';
  if (cycle < 30) return 'autumn';
  return 'winter';
}

export function getTileTopY(x: number, y: number): number {
  return -0.3 + getHash(x, y) * 0.04;
}

// Software WebGL detector inspecting the GPU renderer string (never User-Agent)
let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') {
    cachedSoftwareGl = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = false;
    return false;
  }
}
