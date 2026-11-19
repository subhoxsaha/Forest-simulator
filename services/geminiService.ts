/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIGoal, EcosystemType, CityStats, Grid, NewsItem } from '../types';
import { BUILDINGS } from '../constants';

// Procedural ecosystem quest generator with accurate speciesType tracking
export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  const counts: Record<string, number> = {};
  let highestGrowthStage = 0;
  let maxStageSpecies: EcosystemType = EcosystemType.Pine;

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (
        tile &&
        tile.type !== EcosystemType.None &&
        tile.type !== EcosystemType.DeadTree &&
        tile.type !== EcosystemType.WateringCan &&
        tile.type !== EcosystemType.NutrientMulch
      ) {
        counts[tile.type] = (counts[tile.type] || 0) + 1;
        if (tile.growthStage > highestGrowthStage) {
          highestGrowthStage = tile.growthStage;
          maxStageSpecies = tile.type;
        }
      }
    }
  }

  const goalsPool = [
    {
      getEligible: () => true,
      generate: (): AIGoal => {
        const currentBiomass = stats.population;
        const targetValue = Math.max(
          currentBiomass + 220,
          Math.floor((currentBiomass + 150) / 100) * 100 + 100
        );
        const reward = Math.min(260, Math.max(85, Math.round(targetValue * 0.28)));
        const descriptions = [
          'Spotted forest owlets are seeking thicker twig crowns. Raise total Forest Biomass to shelter nesting families.',
          'Ancient root webs are strengthening. Increase total Forest Biomass to nourish the forest floor mycelium network.',
          'Fragrant micro-climates are emerging. Grow your Forest Biomass to cultivate moss canopies across the glade.',
        ];
        return {
          description: descriptions[stats.day % descriptions.length],
          targetType: 'biomass',
          targetValue,
          reward,
          completed: false,
        };
      },
    },
    {
      getEligible: () => stats.day > 1,
      generate: (): AIGoal => {
        const currentEnergy = stats.money;
        const targetValue = Math.max(
          currentEnergy + 120,
          Math.floor((currentEnergy + 100) / 50) * 50 + 100
        );
        const reward = Math.min(180, Math.max(65, Math.round(targetValue * 0.16)));
        const descriptions = [
          'Store Solar Energy from photosynthesizing canopies to prepare for upcoming seasonal shifts.',
          'Sunlight is peaking across the valley. Accumulate Solar Energy to sustain future exotic plantings.',
          'Harvest golden daylight and amass Solar Energy reserves for your woodland sanctuary.',
        ];
        return {
          description: descriptions[stats.day % descriptions.length],
          targetType: 'energy',
          targetValue,
          reward,
          completed: false,
        };
      },
    },
    {
      getEligible: () => true,
      generate: (): AIGoal => {
        const eligibleFlora = [
          EcosystemType.Pine,
          EcosystemType.Oak,
          EcosystemType.CherryBlossom,
          EcosystemType.Maple,
          EcosystemType.Willow,
          EcosystemType.Bonsai,
          EcosystemType.Peepal,
          EcosystemType.Neem,
          EcosystemType.Banyan,
          EcosystemType.Birch,
          EcosystemType.Bamboo,
        ];
        const selectedSpecies = eligibleFlora[stats.day % eligibleFlora.length];
        const speciesName = BUILDINGS[selectedSpecies]?.name || 'Specimens';
        const currentCount = counts[selectedSpecies] || 0;
        const targetValue = currentCount + 2;
        const reward = (BUILDINGS[selectedSpecies]?.cost || 40) * 2 + 35;
        const descriptions = [
          `Pollinators are seeking fresh blooms. Cultivate a total of ${targetValue} ${speciesName} trees.`,
          `Migrating mountain finches are scouting new nesting sites. Maintain at least ${targetValue} ${speciesName} specimens.`,
          `Subterranean mycelium thrives on species diversity. Grow a total of ${targetValue} ${speciesName} trees.`,
        ];
        return {
          description: descriptions[stats.day % descriptions.length],
          targetType: 'species_count',
          targetValue,
          speciesType: selectedSpecies,
          buildingType: selectedSpecies,
          reward,
          completed: false,
        };
      },
    },
    {
      getEligible: () => highestGrowthStage > 0 && highestGrowthStage < 4,
      generate: (): AIGoal => {
        const targetStage = Math.min(4, highestGrowthStage + 1);
        const speciesName = BUILDINGS[maxStageSpecies]?.name || 'Foliage';
        const reward = targetStage === 4 ? 220 : 125;
        const stageText =
          targetStage === 4 ? 'Ancient Titan (Stage 4)' : targetStage === 3 ? 'Mature Tree (Stage 3)' : 'Sapling (Stage 2)';
        const descriptions = [
          `Nurture an existing ${speciesName} with moisture and rich loam until it reaches ${stageText}.`,
          `Guide a ${speciesName} specimen to ${stageText} by keeping its surrounding soil hydrated and fertilized.`,
        ];
        return {
          description: descriptions[stats.day % descriptions.length],
          targetType: 'growth_stage',
          targetValue: targetStage,
          speciesType: maxStageSpecies,
          buildingType: maxStageSpecies,
          reward,
          completed: false,
        };
      },
    },
  ];

  const eligible = goalsPool.filter((g) => g.getEligible());
  const selected = eligible[stats.day % eligible.length] || goalsPool[0];
  return selected.generate();
};

export const generateNewsEvent = async (
  stats: CityStats,
  _recentAction: string | null
): Promise<NewsItem | null> => {
  const positiveNews = [
    'Ladybugs gather along warm southern groves, keeping young foliage healthy.',
    'A family of woodland field mice settles beneath a sheltered oak root hollow.',
    'Honeybees follow fragrant floral currents drifting across the central glade.',
    'Warm sunlight stimulates a wave of subterranean mycelium network expansion.',
    'A woodpecker discovers a sturdy trunk and taps out a steady morning rhythm.',
    'Deep tree roots reach the primary underground water shelf along the valley.',
    'A flock of migrating songbirds inspects the blossom canopies and nests above the stream.',
  ];

  const negativeNews = [
    'A dry high-pressure breeze evaporates moisture faster from exposed uplands.',
    'Dry clay ridges near the perimeter could benefit from a fresh watering pass.',
    'Dense woodland clusters are drawing heavily on local topsoil nutrients.',
    'Cool alpine gusts temporarily dry out open meadow clearings.',
  ];

  const neutralNews = [
    'Morning dew catches the sunlight, giving conifer needles a pale jade sheen.',
    'Autumn breezes carry drifting leaves gently across the winding stream.',
    'Soft valley mist lingers over the riverbank, steadying ambient soil moisture.',
    'Subterranean aquifers replenish central riverbanks after another quiet cycle.',
    'The woodland sanctuary completes another balanced cycle of photosynthesis.',
  ];

  let pool = neutralNews;
  let type: NewsItem['type'] = 'neutral';

  const rand = Math.random();
  if (stats.weather === 'Raining') {
    pool = [
      'Steady rainfall saturates the topsoil, lifting soil moisture across the entire island.',
      'Young sprouts unfurl fresh leaves to drink in the cool rain.',
      'Riverbank frogs chorus softly along the swollen stream channel.',
    ];
    type = 'positive';
  } else if (stats.weather === 'Windy') {
    pool = [
      'Brisk valley drafts sweep through the canopy, sending ripples across the treetops.',
      'Stronger winds accelerate surface evaporation across unwatered loam.',
    ];
    type = 'neutral';
  } else if (rand < 0.45) {
    pool = positiveNews;
    type = 'positive';
  } else if (rand < 0.75) {
    pool = negativeNews;
    type = 'negative';
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: pool[Math.floor(Math.random() * pool.length)],
    type,
  };
};
