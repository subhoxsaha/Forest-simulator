/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIGoal, CityStats, EcosystemType, Grid, NewsItem, TileData, WeatherType } from '../types';
import { BUILDINGS, GRID_SIZE } from '../constants';
import { NEAR_RIVER_MASK, RIVER_MASK } from '../utils/webgl';

const NEIGHBOR_OFFSETS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function createInitialGrid(): Grid {
  const grid: Grid = [];
  const getHashLocal = (x: number, y: number) =>
    Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 4375) % 1;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const hash = getHashLocal(x, y);
      const isRiver = RIVER_MASK[y][x];
      const isNear = NEAR_RIVER_MASK[y][x];
      row.push({
        x,
        y,
        type: EcosystemType.None,
        growthStage: 0,
        growthProgress: 0,
        moisture: isRiver ? 100 : isNear ? Math.floor(75 + hash * 15) : Math.floor(45 + hash * 25),
        nutrients: Math.floor(65 + hash * 20),
        variant: Math.floor(hash * 100),
      });
    }
    grid.push(row);
  }
  return grid;
}

// Simple smooth 2D value noise for organic natural forest groves
function smoothNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const hash = (ix: number, iy: number) =>
    Math.abs(Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453) % 1;

  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Generates an ecologically authentic random forest according to natural biome rules:
 * - Riverbanks: Willow, Cypress, Bamboo, Alder
 * - Rich Moist Valleys: Oak, Maple, Cherry Blossom, Peepal, Banyan, Jacaranda
 * - Drier Uplands & Edges: Pine, Birch, Redwood, Acacia, Neem, Baobab
 * - Natural clearings (~28% open meadow), mixed growth ages, and decomposing logs
 */
export function generateNaturalForestGrid(seed = Math.random() * 1000): { grid: Grid; initialBiomass: number } {
  const grid = createInitialGrid();
  const center = (GRID_SIZE - 1) / 2;
  let initialBiomass = 0;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = grid[y][x];
      const isRiver = RIVER_MASK[y][x];
      const isNearRiver = NEAR_RIVER_MASK[y][x];

      // Organic moisture & elevation/nutrient gradients
      const groveNoise = smoothNoise2D(x * 0.34, y * 0.34, seed);
      const speciesNoise = smoothNoise2D(x * 0.28 + 13.7, y * 0.28 + 5.1, seed + 41.3);
      const rand = Math.random();
      const distFromCenter = Math.hypot(x - center, y - center) / (GRID_SIZE * 0.72);

      // Enrich soil moisture/nutrients organically around river & groves
      if (!isRiver) {
        const baseMoisture = isNearRiver
          ? 78 + Math.floor(rand * 20)
          : Math.max(18, Math.min(92, Math.round(52 + (groveNoise - 0.45) * 42 - distFromCenter * 18)));
        const baseNutrients = Math.max(
          28,
          Math.min(98, Math.round(62 + (speciesNoise - 0.4) * 44))
        );
        tile.moisture = baseMoisture;
        tile.nutrients = baseNutrients;
      }

      // River tiles never grow land trees
      if (isRiver) continue;

      // Leave natural sunlit meadows & clearings (~28% of land tiles)
      const densityThreshold = isNearRiver ? 0.24 : 0.30 + distFromCenter * 0.1;
      if (groveNoise < densityThreshold && rand > 0.22) continue;

      // Rare natural fallen timber enriching soil humus (~3.5% of forested spots)
      if (rand < 0.035) {
        tile.type = EcosystemType.DeadTree;
        tile.growthStage = 1;
        tile.growthProgress = Math.floor(Math.random() * 75);
        tile.nutrients = Math.min(100, tile.nutrients + 20);
        continue;
      }

      // Ecological niche species selection
      let chosen: EcosystemType;
      if (isNearRiver || tile.moisture >= 74) {
        // Riparian / Wetland niche
        const riparianPool = [
          EcosystemType.Willow,
          EcosystemType.Cypress,
          EcosystemType.Bamboo,
          EcosystemType.Alder,
          EcosystemType.Banyan,
        ];
        chosen = riparianPool[Math.floor((speciesNoise * 0.65 + rand * 0.35) * riparianPool.length) % riparianPool.length];
      } else if (tile.moisture <= 36) {
        // Dry upland / savanna edge niche
        const dryPool = [
          EcosystemType.Pine,
          EcosystemType.Acacia,
          EcosystemType.Baobab,
          EcosystemType.Neem,
          EcosystemType.Birch,
        ];
        chosen = dryPool[Math.floor((speciesNoise * 0.6 + rand * 0.4) * dryPool.length) % dryPool.length];
      } else if (tile.nutrients >= 72) {
        // Lush fertile woodland heart
        const fertilePool = [
          EcosystemType.Oak,
          EcosystemType.CherryBlossom,
          EcosystemType.Maple,
          EcosystemType.Redwood,
          EcosystemType.Peepal,
          EcosystemType.Jacaranda,
          EcosystemType.Bonsai,
        ];
        chosen = fertilePool[Math.floor((speciesNoise * 0.7 + rand * 0.3) * fertilePool.length) % fertilePool.length];
      } else {
        // Temperate mixed forest
        const mixedPool = [
          EcosystemType.Pine,
          EcosystemType.Oak,
          EcosystemType.Birch,
          EcosystemType.Maple,
          EcosystemType.Alder,
          EcosystemType.Neem,
        ];
        chosen = mixedPool[Math.floor((speciesNoise * 0.65 + rand * 0.35) * mixedPool.length) % mixedPool.length];
      }

      // Natural forest age pyramid (some sprouts, saplings, abundant mature trees, select ancient patriarchs)
      const ageRoll = Math.random();
      let stage = 3;
      if (ageRoll < 0.16) stage = 1; // Sprout
      else if (ageRoll < 0.40) stage = 2; // Sapling
      else if (ageRoll < 0.84) stage = 3; // Mature
      else stage = 4; // Ancient Titan matriarch

      tile.type = chosen;
      tile.growthStage = stage;
      tile.growthProgress = stage === 4 ? 0 : Math.floor(Math.random() * 85);

      const cfg = BUILDINGS[chosen];
      if (cfg) {
        if (stage === 1) initialBiomass += 2;
        else if (stage === 2) initialBiomass += 8;
        else if (stage === 3) initialBiomass += cfg.healthGen;
        else if (stage === 4) initialBiomass += Math.round(cfg.healthGen * 2.5);
      }
    }
  }

  return { grid, initialBiomass };
}

export interface TickResult {
  nextGrid: Grid;
  nextStats: CityStats;
  goalCompletedNow: boolean;
  newsEvents: NewsItem[];
}

export function stepEcosystemTick(
  currentGrid: Grid,
  currentStats: CityStats,
  currentGoal: AIGoal | null,
  aiEnabled: boolean,
  wildSeedingEnabled = false
): TickResult {
  const newsEvents: NewsItem[] = [];
  const nowId = Date.now();
  let idSeq = 0;
  const pushNews = (text: string, type: NewsItem['type']) => {
    newsEvents.push({ id: `${nowId}-${idSeq++}`, text, type });
  };

  // 1. Weather Shift (12% daily probability)
  let newWeather: WeatherType = currentStats.weather;
  if (Math.random() < 0.12) {
    const weathers: WeatherType[] = ['Sunny', 'Raining', 'Windy', 'Autumn_Dew'];
    const weights = [0.55, 0.22, 0.18, 0.05];
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < weathers.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) {
        newWeather = weathers[i];
        break;
      }
    }
    if (newWeather !== currentStats.weather) {
      let weatherDesc = 'The clouds part, introducing warm golden sunlight.';
      if (newWeather === 'Raining') weatherDesc = 'Heavy gray clouds gather. A cool rain begins soaking the earth.';
      if (newWeather === 'Windy') weatherDesc = 'A brisk wind sweeps through the forest canopy, making leaves wave.';
      if (newWeather === 'Autumn_Dew') weatherDesc = 'An autumn chill settles. Golden pollen and dew dance in the air.';
      pushNews(`Climate Shift: ${weatherDesc}`, 'neutral');
    }
  }

  let totalDailySolarGen = 0;
  let totalForestBiomass = 0;
  let wildSproutsToday = 0;
  const speciesCounts: Record<string, number> = {};
  const maxStageBySpecies: Record<string, number> = {};
  const ancientCounts: Record<string, number> = {};

  const nextGrid: Grid = new Array(GRID_SIZE);

  for (let y = 0; y < GRID_SIZE; y++) {
    const srcRow = currentGrid[y];
    const dstRow: TileData[] = new Array(GRID_SIZE);
    nextGrid[y] = dstRow;

    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = srcRow[x];
      let tileType = tile.type;
      let tileMoisture = tile.moisture;
      let tileNutrients = tile.nutrients;
      let tileProgress = tile.growthProgress;
      let tileStage = tile.growthStage;

      const isRiver = RIVER_MASK[y][x];
      const isNearRiver = NEAR_RIVER_MASK[y][x];

      // Single pass over the 4 cardinal neighbors
      let neighborMoistureSum = 0;
      let validNeighbors = 0;
      let neighborCypressCount = 0;
      let neighborBanyanCount = 0;
      let neighborDecomposing = false;
      let neighborAlderCount = 0;
      let neighborAcaciaCount = 0;
      let neighborNeemCount = 0;
      let adjacentHighMoisture = false;
      let occupiedNeighborCount = 0;
      const matureNeighborSpecies: EcosystemType[] = [];

      for (let k = 0; k < 4; k++) {
        const nx = x + NEIGHBOR_OFFSETS[k][0];
        const ny = y + NEIGHBOR_OFFSETS[k][1];
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          const nTile = currentGrid[ny][nx];
          validNeighbors++;
          neighborMoistureSum += nTile.moisture;
          if (nTile.moisture >= 75) adjacentHighMoisture = true;

          if (nTile.type !== EcosystemType.None && nTile.type !== EcosystemType.DeadTree) {
            occupiedNeighborCount++;
            if (nTile.growthStage >= 3 && nTile.type !== EcosystemType.Bonsai) {
              matureNeighborSpecies.push(nTile.type);
            }
          }

          if (nTile.type === EcosystemType.DeadTree) {
            neighborDecomposing = true;
          } else if (nTile.type === EcosystemType.Cypress && nTile.growthStage >= 3) {
            neighborCypressCount++;
          } else if (nTile.type === EcosystemType.Banyan && nTile.growthStage >= 3) {
            neighborBanyanCount++;
          } else if (nTile.type === EcosystemType.Alder && nTile.growthStage >= 2) {
            neighborAlderCount++;
          } else if (nTile.type === EcosystemType.Acacia && nTile.growthStage >= 2) {
            neighborAcaciaCount++;
          } else if (nTile.type === EcosystemType.Neem && nTile.growthStage >= 2) {
            neighborNeemCount++;
          }
        }
      }

      // A. Moisture dynamics
      if (isRiver) {
        tileMoisture = 100;
      } else if (isNearRiver) {
        tileMoisture = newWeather === 'Raining' ? Math.min(100, tileMoisture + 25) : Math.max(75, tileMoisture);
      } else if (newWeather === 'Raining') {
        tileMoisture = Math.min(100, tileMoisture + 20);
      } else {
        const drying = newWeather === 'Sunny' ? 12 : newWeather === 'Windy' ? 6 : 4;
        if (tileType === EcosystemType.None) {
          if (tileMoisture < 40) {
            tileMoisture = Math.min(40, tileMoisture + Math.max(1, 4 - drying));
          } else {
            tileMoisture = Math.max(10, tileMoisture - drying);
          }
        } else {
          tileMoisture = Math.max(5, tileMoisture - drying);
        }
      }

      if (
        (neighborCypressCount > 0 || neighborBanyanCount > 0) &&
        !isRiver &&
        tileType !== EcosystemType.Cypress &&
        tileType !== EcosystemType.Banyan
      ) {
        tileMoisture = Math.min(100, tileMoisture + neighborCypressCount * 5 + neighborBanyanCount * 8);
      }

      if (validNeighbors > 0) {
        const avgNeighborMoisture = neighborMoistureSum / validNeighbors;
        tileMoisture = Math.max(0, Math.min(100, tileMoisture + (avgNeighborMoisture - tileMoisture) * 0.18));
      }

      // B. Nutrient dynamics
      if (tileType === EcosystemType.None) {
        tileNutrients = Math.min(100, tileNutrients + 1);
      } else if (tileType === EcosystemType.DeadTree) {
        tileNutrients = Math.min(100, tileNutrients + 5);
      } else if (tileType === EcosystemType.Alder) {
        tileNutrients = Math.min(100, tileNutrients + (tileStage === 1 ? 1 : tileStage === 2 ? 2 : 3));
      } else if (tileType === EcosystemType.Acacia) {
        tileNutrients = Math.min(100, tileNutrients + (tileStage === 1 ? 1 : tileStage === 2 ? 3 : 5));
      } else if (tileType === EcosystemType.Neem) {
        tileNutrients = Math.min(100, tileNutrients + (tileStage === 1 ? 1 : tileStage === 2 ? 2 : 4));
      } else {
        let intake = tileStage === 1 ? 1 : tileStage === 2 ? 2 : tileStage === 3 ? 3 : 4;
        if (tileType === EcosystemType.Bonsai) intake = Math.round(intake * 2.5);
        tileNutrients = Math.max(5, tileNutrients - intake);
      }

      if (neighborDecomposing && tileType !== EcosystemType.DeadTree) {
        tileNutrients = Math.min(100, tileNutrients + 6);
      }
      if (neighborAlderCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Alder) {
        tileNutrients = Math.min(100, tileNutrients + neighborAlderCount * 2);
      }
      if (neighborAcaciaCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Acacia) {
        tileNutrients = Math.min(100, tileNutrients + neighborAcaciaCount * 4);
      }
      if (neighborNeemCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Neem) {
        tileNutrients = Math.min(100, tileNutrients + neighborNeemCount * 3);
      }

      // C1. Decomposition of DeadTree
      if (tileType === EcosystemType.DeadTree) {
        let decayInc = BUILDINGS[EcosystemType.DeadTree]?.growthRate || 12;
        if (tileMoisture >= 55) decayInc = Math.round(decayInc * 1.8);
        else if (tileMoisture <= 20) decayInc = Math.round(decayInc * 0.4);
        tileProgress = Math.min(100, tileProgress + decayInc);

        if (tileProgress >= 100) {
          tileType = EcosystemType.None;
          tileStage = 0;
          tileProgress = 0;
          tileNutrients = 100;
          pushNews(
            `Nutrient Recycled: Decaying wood at [${x}, ${y}] has fully decomposed, enriching the loam with premium humus.`,
            'positive'
          );
        }
      }
      // C2. Living Tree Growth
      else if (tileType !== EcosystemType.None && tileStage < 4) {
        const config = BUILDINGS[tileType];
        if (config) {
          let moistureMult = 1.0;
          if (tileMoisture >= 60) moistureMult = 1.5;
          else if (tileMoisture <= 20) {
            moistureMult = tileType === EcosystemType.Baobab ? 0.6 : 0.15;
          }

          let nutrientMult = 1.0;
          if (tileType === EcosystemType.Bonsai) {
            nutrientMult = tileNutrients >= 75 ? 1.4 : tileNutrients <= 45 ? 0.05 : 0.4;
          } else if (tileType === EcosystemType.Alder || tileType === EcosystemType.Acacia) {
            nutrientMult = tileNutrients >= 70 ? 1.25 : tileNutrients <= 15 ? 0.8 : 1.0;
          } else {
            if (tileNutrients >= 70) nutrientMult = 1.3;
            else if (tileNutrients <= 15) nutrientMult = 0.1;
          }

          let weatherMult = 1.0;
          if (newWeather === 'Sunny') weatherMult = 1.25;
          if (
            newWeather === 'Autumn_Dew' &&
            (tileType === EcosystemType.Maple ||
              tileType === EcosystemType.Oak ||
              tileType === EcosystemType.Jacaranda)
          ) {
            weatherMult = 1.4;
          }

          let willowMult = 1.0;
          if (tileType === EcosystemType.Willow) {
            willowMult = adjacentHighMoisture || tileMoisture >= 75 ? 2.0 : 0.4;
          }

          let bambooMult = 1.0;
          if (tileType === EcosystemType.Bamboo) {
            if (tileMoisture >= 60) bambooMult = 2.2;
            else if (tileMoisture <= 25) bambooMult = 0.3;
          }

          tileProgress += config.growthRate * moistureMult * nutrientMult * weatherMult * willowMult * bambooMult;

          if (tileProgress >= 100) {
            tileProgress = 0;
            tileStage += 1;
            if (tileStage === 3) {
              pushNews(`Botanical Maturity: A ${config.name} has reached maturity at [${x}, ${y}].`, 'positive');
            } else if (tileStage === 4) {
              pushNews(`Ancient Titan: A colossal ${config.name} now towers at [${x}, ${y}].`, 'positive');
            }
          }
        }
      }

      // C3. Natural Mortality
      if (tileType !== EcosystemType.None && tileType !== EcosystemType.DeadTree) {
        let die = false;
        let cause = '';

        if (tileMoisture <= 15) {
          const droughtCap =
            tileType === EcosystemType.Baobab ||
            tileType === EcosystemType.Peepal ||
            tileType === EcosystemType.Neem ||
            tileType === EcosystemType.Banyan
              ? 0.004
              : 0.035;
          if (Math.random() < droughtCap) {
            die = true;
            cause = 'severe drought dehydration';
          }
        }

        if (!die && tileNutrients <= 10 && tileStage >= 2 && Math.random() < 0.024) {
          die = true;
          cause = 'nutrient starvation in depleted soil';
        }

        if (!die && tileStage >= 3 && tileType !== EcosystemType.Bonsai) {
          const ageCap = tileStage === 4 ? 0.006 : 0.0016;
          if (Math.random() < ageCap) {
            die = true;
            cause = 'reaching the natural end of its life cycle';
          }
        }

        if (die) {
          const oldName = BUILDINGS[tileType]?.name || tileType;
          pushNews(
            `Ecosystem Cycle: The ${oldName} at [${x}, ${y}] has fallen due to ${cause}, returning as decomposing timber.`,
            'negative'
          );
          tileType = EcosystemType.DeadTree;
          tileStage = 1;
          tileProgress = 0;
        }
      }

      // C4. Optional Wild Nature Seeding (natural ecological dispersal)
      if (
        wildSeedingEnabled &&
        wildSproutsToday < 2 &&
        tileType === EcosystemType.None &&
        !isRiver &&
        tileMoisture >= 32 &&
        tileNutrients >= 28
      ) {
        const weatherSeedBoost = newWeather === 'Windy' ? 1.55 : newWeather === 'Raining' ? 1.35 : 1.0;
        // Keep natural sunlit clearings when surrounding tiles are already dense
        const spacingFactor = occupiedNeighborCount >= 3 ? 0.35 : 1.0;

        if (matureNeighborSpecies.length > 0) {
          const spreadChance = 0.024 * weatherSeedBoost * spacingFactor;
          if (Math.random() < spreadChance) {
            const parentSpecies =
              matureNeighborSpecies[Math.floor(Math.random() * matureNeighborSpecies.length)];
            tileType = parentSpecies;
            tileStage = 1;
            tileProgress = 0;
            wildSproutsToday++;
            const name = BUILDINGS[parentSpecies]?.name || parentSpecies;
            pushNews(`Wild Seeding: Wind dispersed a ${name} sprout at [${x}, ${y}].`, 'positive');
          }
        } else if (Math.random() < 0.0028 * weatherSeedBoost) {
          // Rare pioneer seed carried by birds/wind suited to local soil moisture
          let pioneerPool: EcosystemType[];
          if (isNearRiver || tileMoisture >= 72) {
            pioneerPool = [EcosystemType.Willow, EcosystemType.Cypress, EcosystemType.Alder, EcosystemType.Bamboo];
          } else if (tileMoisture <= 40) {
            pioneerPool = [EcosystemType.Pine, EcosystemType.Acacia, EcosystemType.Birch, EcosystemType.Neem];
          } else {
            pioneerPool = [EcosystemType.Pine, EcosystemType.Oak, EcosystemType.Birch, EcosystemType.Alder, EcosystemType.Maple];
          }
          const pioneer = pioneerPool[Math.floor(Math.random() * pioneerPool.length)];
          tileType = pioneer;
          tileStage = 1;
          tileProgress = 0;
          wildSproutsToday++;
          const name = BUILDINGS[pioneer]?.name || pioneer;
          pushNews(`Natural Pioneer: A wild ${name} seedling took root at [${x}, ${y}].`, 'positive');
        }
      }

      // D. Resource & Species Accounting
      if (tileType !== EcosystemType.None) {
        const config = BUILDINGS[tileType];
        if (config) {
          speciesCounts[tileType] = (speciesCounts[tileType] || 0) + 1;
          if (tileStage > (maxStageBySpecies[tileType] || 0)) {
            maxStageBySpecies[tileType] = tileStage;
          }
          if (tileStage === 4) {
            ancientCounts[tileType] = (ancientCounts[tileType] || 0) + 1;
          }

          if (tileStage === 2) totalDailySolarGen += Math.round(config.solarGen * 0.25);
          else if (tileStage === 3) totalDailySolarGen += config.solarGen;
          else if (tileStage === 4) totalDailySolarGen += config.solarGen * 2;

          if (tileStage === 1) totalForestBiomass += 2;
          else if (tileStage === 2) totalForestBiomass += 8;
          else if (tileStage === 3) totalForestBiomass += config.healthGen;
          else if (tileStage === 4) totalForestBiomass += Math.round(config.healthGen * 2.5);
        }
      }

      dstRow[x] = {
        ...tile,
        type: tileType,
        moisture: tileMoisture,
        nutrients: tileNutrients,
        growthProgress: tileProgress,
        growthStage: tileStage,
      };
    }
  }

  const nextStats: CityStats = {
    money: currentStats.money + totalDailySolarGen,
    population: totalForestBiomass,
    day: currentStats.day + 1,
    weather: newWeather,
  };

  let goalCompletedNow = false;
  if (aiEnabled && currentGoal && !currentGoal.completed) {
    const targetSpecies = currentGoal.speciesType || currentGoal.buildingType;
    if (currentGoal.targetType === 'biomass' && nextStats.population >= currentGoal.targetValue) {
      goalCompletedNow = true;
    } else if (currentGoal.targetType === 'energy' && nextStats.money >= currentGoal.targetValue) {
      goalCompletedNow = true;
    } else if (currentGoal.targetType === 'species_count' && targetSpecies) {
      if ((speciesCounts[targetSpecies] || 0) >= currentGoal.targetValue) {
        goalCompletedNow = true;
      }
    } else if (currentGoal.targetType === 'growth_stage' && targetSpecies) {
      if ((maxStageBySpecies[targetSpecies] || 0) >= currentGoal.targetValue) {
        goalCompletedNow = true;
      }
    }

    if (goalCompletedNow) {
      pushNews('Challenge Accomplished! Open the Quests panel to claim your Solar Energy reward.', 'positive');
    }
  }

  return {
    nextGrid,
    nextStats,
    goalCompletedNow,
    newsEvents,
  };
}

export function computeGoalProgress(
  goal: AIGoal | null,
  stats: CityStats,
  grid: Grid
): { current: number; target: number; percent: number; label: string } | null {
  if (!goal) return null;
  const targetSpecies = goal.speciesType || goal.buildingType;

  if (goal.targetType === 'biomass') {
    const pct = Math.min(100, Math.round((stats.population / Math.max(1, goal.targetValue)) * 100));
    return { current: stats.population, target: goal.targetValue, percent: pct, label: 'Biomass' };
  }
  if (goal.targetType === 'energy') {
    const pct = Math.min(100, Math.round((stats.money / Math.max(1, goal.targetValue)) * 100));
    return { current: stats.money, target: goal.targetValue, percent: pct, label: 'Solar' };
  }
  if (goal.targetType === 'species_count' && targetSpecies) {
    let count = 0;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x].type === targetSpecies) count++;
      }
    }
    const pct = Math.min(100, Math.round((count / Math.max(1, goal.targetValue)) * 100));
    return { current: count, target: goal.targetValue, percent: pct, label: BUILDINGS[targetSpecies]?.name || 'Trees' };
  }
  if (goal.targetType === 'growth_stage' && targetSpecies) {
    let bestStage = 0;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x].type === targetSpecies && grid[y][x].growthStage > bestStage) {
          bestStage = grid[y][x].growthStage;
        }
      }
    }
    const pct = Math.min(100, Math.round((bestStage / Math.max(1, goal.targetValue)) * 100));
    return { current: bestStage, target: goal.targetValue, percent: pct, label: 'Stage' };
  }

  return null;
}
