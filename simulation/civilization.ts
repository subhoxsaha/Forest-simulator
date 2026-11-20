/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  CityStats,
  CivilizationState,
  EcosystemType,
  EraMode,
  Grid,
  HumanEra,
  NewsItem,
  SettlementKind,
  SettlementSite,
} from '../types';
import { GRID_SIZE } from '../constants';
import { NEAR_RIVER_MASK, RIVER_MASK } from '../utils/webgl';

export interface EraMeta {
  era: HumanEra;
  name: string;
  shortName: string;
  period: string;
  targetHumans: number;
  minDay: number;
  minBiomass: number;
  summary: string;
}

export const ERA_METADATA: Record<HumanEra, EraMeta> = {
  0: {
    era: 0,
    name: 'Paleolithic Foragers',
    shortName: 'Paleolithic',
    period: 'Dawn of History',
    targetHumans: 3,
    minDay: 1,
    minBiomass: 0,
    summary: 'Nomadic gatherers forage clearings and light warm dusk campfires beside hide lean-tos.',
  },
  1: {
    era: 1,
    name: 'Neolithic River Village',
    shortName: 'Neolithic',
    period: 'Early Settlement',
    targetHumans: 5,
    minDay: 12,
    minBiomass: 180,
    summary: 'Settlers raise timber-and-thatch huts, bridge the river, and irrigate dry valley loam.',
  },
  2: {
    era: 2,
    name: 'Classical Timber Guild',
    shortName: 'Classical',
    period: 'Woodland Craft',
    targetHumans: 7,
    minDay: 26,
    minBiomass: 420,
    summary: 'Artisans build framed cottages and a lantern watchtower, mulching soil and tending groves.',
  },
  3: {
    era: 3,
    name: 'Solarpunk Eco-Sanctuary',
    shortName: 'Eco-Sanctuary',
    period: 'Living Harmony',
    targetHumans: 10,
    minDay: 44,
    minBiomass: 780,
    summary: 'Conservationists craft solar lodges and canopy observatories in peak balance with nature.',
  },
};

function isOccupiedBySettlement(settlements: SettlementSite[], x: number, y: number): boolean {
  return settlements.some((s) => s.x === x && s.y === y);
}

/**
 * Finds an ecologically gentle land tile for a human settlement:
 * - Prefers open clearings or young sprouts (never overwrites Ancient Stage 4 trees)
 * - Prefers tiles near the river with comfortable spacing from other settlements
 */
function findSettlementSpot(
  grid: Grid,
  existing: SettlementSite[],
  preferNearRiver: boolean
): { x: number; y: number } | null {
  let best: { x: number; y: number; score: number } | null = null;

  for (let y = 1; y < GRID_SIZE - 1; y++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      if (RIVER_MASK[y][x]) continue;
      if (isOccupiedBySettlement(existing, x, y)) continue;

      const tile = grid[y]?.[x];
      if (!tile) continue;
      // Never disturb Ancient Titan trees
      if (tile.type !== EcosystemType.None && tile.growthStage >= 4) continue;

      // Minimum comfortable distance from other settlements
      let tooClose = false;
      for (const s of existing) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < 2.6) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      let score = 0;
      if (tile.type === EcosystemType.None) score += 45;
      else if (tile.type === EcosystemType.DeadTree) score += 30;
      else if (tile.growthStage <= 1) score += 10;
      else score -= 25;

      if (preferNearRiver && NEAR_RIVER_MASK[y][x]) score += 35;
      else if (!preferNearRiver && !NEAR_RIVER_MASK[y][x]) score += 12;

      // Slight preference toward the scenic interior of the island
      const distCenter = Math.hypot(x - 7, y - 7);
      score += Math.max(0, 20 - distCenter * 2.4);

      // Tiny deterministic tie-breaker
      score += ((Math.sin(x * 19.3 + y * 37.1) + 1) * 0.5) * 4;

      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Finds a scenic central river tile flanked by land on opposite sides for a wooden footbridge.
 */
function findBridgeSpot(existing: SettlementSite[]): { x: number; y: number } | null {
  let best: { x: number; y: number; score: number } | null = null;

  for (let y = 3; y < GRID_SIZE - 3; y++) {
    for (let x = 3; x < GRID_SIZE - 3; x++) {
      if (!RIVER_MASK[y][x]) continue;
      if (isOccupiedBySettlement(existing, x, y)) continue;

      const leftLand = !RIVER_MASK[y][x - 1];
      const rightLand = !RIVER_MASK[y][x + 1];
      const upLand = !RIVER_MASK[y - 1][x];
      const downLand = !RIVER_MASK[y + 1][x];

      const bankScore = (leftLand ? 1 : 0) + (rightLand ? 1 : 0) + (upLand ? 1 : 0) + (downLand ? 1 : 0);
      const centerDist = Math.hypot(x - 7, y - 7);
      const score = bankScore * 15 - centerDist * 3;

      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

function ensureSettlementsForEra(
  grid: Grid,
  existing: SettlementSite[],
  era: HumanEra
): { settlements: SettlementSite[]; addedKind: SettlementKind | null } {
  const next = [...existing];
  let addedKind: SettlementKind | null = null;

  // Era 0+: Always have the foundational Hearth Camp
  if (!next.some((s) => s.kind === 'camp')) {
    const spot = findSettlementSpot(grid, next, true);
    if (spot) {
      next.push({ id: 'camp-0', x: spot.x, y: spot.y, kind: 'camp', builtEra: 0 });
      addedKind = 'camp';
    }
  }

  // Era 1+: Add River Footbridge & First Homestead Dwelling
  if (era >= 1) {
    if (!next.some((s) => s.kind === 'bridge')) {
      const bSpot = findBridgeSpot(next);
      if (bSpot) {
        next.push({ id: 'bridge-1', x: bSpot.x, y: bSpot.y, kind: 'bridge', builtEra: 1 });
        addedKind = 'bridge';
      }
    }
    if (next.filter((s) => s.kind === 'dwelling').length < 1) {
      const dSpot = findSettlementSpot(grid, next, true);
      if (dSpot) {
        next.push({ id: 'dwelling-1', x: dSpot.x, y: dSpot.y, kind: 'dwelling', builtEra: 1 });
        addedKind = 'dwelling';
      }
    }
  }

  // Era 2+: Add Watchtower & Second Dwelling
  if (era >= 2) {
    if (!next.some((s) => s.kind === 'tower')) {
      const tSpot = findSettlementSpot(grid, next, false);
      if (tSpot) {
        next.push({ id: 'tower-2', x: tSpot.x, y: tSpot.y, kind: 'tower', builtEra: 2 });
        addedKind = 'tower';
      }
    }
    if (next.filter((s) => s.kind === 'dwelling').length < 2) {
      const dSpot = findSettlementSpot(grid, next, false);
      if (dSpot) {
        next.push({ id: 'dwelling-2', x: dSpot.x, y: dSpot.y, kind: 'dwelling', builtEra: 2 });
        addedKind = 'dwelling';
      }
    }
  }

  // Era 3: Ensure full harmonious sanctuary layout (camp -> plaza, 2 solar lodges, bridge, canopy observatory)
  return { settlements: next, addedKind };
}

export function createInitialCivilization(
  grid: Grid,
  enabled = true,
  initialEra: HumanEra = 0
): CivilizationState {
  const { settlements } = enabled
    ? ensureSettlementsForEra(grid, [], initialEra)
    : { settlements: [] };

  return {
    enabled,
    era: initialEra,
    eraMode: 'auto',
    eraProgress: 0,
    humanCount: enabled ? ERA_METADATA[initialEra].targetHumans : 0,
    settlements,
  };
}

export function setCivilizationEraOverride(
  civ: CivilizationState,
  grid: Grid,
  mode: EraMode
): CivilizationState {
  if (!civ.enabled) {
    return { ...civ, eraMode: mode };
  }
  const targetEra: HumanEra = mode === 'auto' ? civ.era : mode;
  const { settlements } = ensureSettlementsForEra(grid, civ.settlements, targetEra);
  return {
    ...civ,
    era: targetEra,
    eraMode: mode,
    eraProgress: targetEra === 3 ? 100 : 0,
    humanCount: ERA_METADATA[targetEra].targetHumans,
    settlements,
  };
}

export function isTileReservedBySettlement(civ: CivilizationState, x: number, y: number): boolean {
  if (!civ.enabled) return false;
  return civ.settlements.some((s) => s.x === x && s.y === y);
}

export interface CivilizationTickResult {
  nextCiv: CivilizationState;
  nextGrid: Grid;
  solarBonus: number;
  eraAdvanced: boolean;
  newsEvents: NewsItem[];
}

/**
 * Runs automatically every simulation day:
 * 1. Computes algorithmic progress toward the next historical epoch from elapsed days & forest vitality
 * 2. Evolves human settlements & river footbridge automatically
 * 3. Applies gentle human stewardship (irrigating dry tiles in Neolithic+, mulching loam in Classical+, eco-harmony solar bonus in Solarpunk)
 */
export function stepCivilizationTick(
  civ: CivilizationState,
  grid: Grid,
  stats: CityStats
): CivilizationTickResult {
  if (!civ.enabled) {
    return { nextCiv: civ, nextGrid: grid, solarBonus: 0, eraAdvanced: false, newsEvents: [] };
  }

  const newsEvents: NewsItem[] = [];
  const nowId = Date.now();
  let seq = 0;
  const pushNews = (text: string, type: NewsItem['type']) => {
    newsEvents.push({ id: `civ-${nowId}-${seq++}`, text, type });
  };

  let nextEra: HumanEra = civ.era;
  let eraProgress = 100;
  let eraAdvanced = false;

  if (civ.eraMode === 'auto') {
    if (civ.era < 3) {
      const nextMeta = ERA_METADATA[(civ.era + 1) as HumanEra];
      const dayRatio = Math.min(1, stats.day / nextMeta.minDay);
      const bioRatio = Math.min(1, stats.population / Math.max(1, nextMeta.minBiomass));
      // Algorithmic progression combines time & flourishing nature (or steady time passage even on quiet meadows)
      const combined = dayRatio * 0.62 + bioRatio * 0.38;
      eraProgress = Math.min(100, Math.round(combined * 100));

      if (
        (stats.day >= nextMeta.minDay && stats.population >= nextMeta.minBiomass * 0.65) ||
        stats.day >= nextMeta.minDay + 10
      ) {
        nextEra = (civ.era + 1) as HumanEra;
        eraAdvanced = true;
        eraProgress = nextEra === 3 ? 100 : 0;
        pushNews(
          `New Historical Era — ${nextMeta.name}: ${nextMeta.summary}`,
          'positive'
        );
      }
    }
  } else {
    nextEra = civ.eraMode;
    eraProgress = nextEra === 3 ? 100 : 0;
  }

  const { settlements, addedKind } = ensureSettlementsForEra(grid, civ.settlements, nextEra);

  // Clear non-ancient trees cleanly only on newly claimed settlement footprints so shelters sit on tidy clearings
  let nextGrid = grid;
  const clearTiles = new Set<string>();
  for (const s of settlements) {
    if (s.kind === 'bridge') continue;
    const t = grid[s.y]?.[s.x];
    if (t && t.type !== EcosystemType.None) {
      clearTiles.add(`${s.x},${s.y}`);
    }
  }

  // Algorithmic Human Stewardship: villagers actively nurture nearby soil!
  const waterBoosts = new Map<string, number>();
  const nutrientBoosts = new Map<string, number>();

  if (nextEra >= 1) {
    const careRadius = nextEra === 3 ? 3 : 2;
    let tendedCount = 0;
    const maxTend = nextEra === 1 ? 2 : nextEra === 2 ? 4 : 6;

    for (const s of settlements) {
      if (s.kind === 'bridge' || tendedCount >= maxTend) continue;
      for (let dy = -careRadius; dy <= careRadius && tendedCount < maxTend; dy++) {
        for (let dx = -careRadius; dx <= careRadius && tendedCount < maxTend; dx++) {
          const nx = s.x + dx;
          const ny = s.y + dy;
          if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
          if (RIVER_MASK[ny][nx]) continue;
          const tile = grid[ny][nx];
          const key = `${nx},${ny}`;

          if (tile.moisture < 45) {
            waterBoosts.set(key, 12);
            tendedCount++;
          } else if (nextEra >= 2 && tile.nutrients < 48) {
            nutrientBoosts.set(key, 10);
            tendedCount++;
          }
        }
      }
    }
  }

  if (clearTiles.size > 0 || waterBoosts.size > 0 || nutrientBoosts.size > 0) {
    nextGrid = grid.map((row, y) =>
      row.map((tile, x) => {
        const key = `${x},${y}`;
        if (clearTiles.has(key)) {
          return { ...tile, type: EcosystemType.None, growthStage: 0, growthProgress: 0 };
        }
        const wAdd = waterBoosts.get(key) || 0;
        const nAdd = nutrientBoosts.get(key) || 0;
        if (wAdd > 0 || nAdd > 0) {
          return {
            ...tile,
            moisture: Math.min(100, tile.moisture + wAdd),
            nutrients: Math.min(100, tile.nutrients + nAdd),
          };
        }
        return tile;
      })
    );
  }

  if (addedKind && !eraAdvanced) {
    const landmarkName =
      addedKind === 'bridge'
        ? 'a wooden footbridge across the stream'
        : addedKind === 'tower'
        ? 'a timber lookout tower'
        : addedKind === 'dwelling'
        ? 'a new woodland shelter'
        : 'a sheltered hearth camp';
    pushNews(`Human Settlement: Villagers constructed ${landmarkName}.`, 'neutral');
  }

  const solarBonus = nextEra === 3 ? 10 : nextEra === 2 ? 4 : 0;

  return {
    nextCiv: {
      ...civ,
      era: nextEra,
      eraProgress,
      humanCount: ERA_METADATA[nextEra].targetHumans,
      settlements,
    },
    nextGrid,
    solarBonus,
    eraAdvanced,
    newsEvents,
  };
}
