/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIGoal, EcosystemType, CityStats, Grid, NewsItem } from "../types";
import { BUILDINGS } from "../constants";

// Purely local, procedural ecosystem goal generator ensuring rich variations of quests.
export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  // Wait a small bit to simulate standard local calculation and provide pleasant cadence
  await new Promise(r => setTimeout(r, 600));

  // Analyze the current sanctuary state
  const counts: Record<EcosystemType, number> = {} as any;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let tileCount = 0;
  let highestGrowthStage = 0;
  let maxStageSpecies: EcosystemType = EcosystemType.Pine;

  grid.flat().forEach(tile => {
    if (tile) {
      if (tile.type !== EcosystemType.None && tile.type !== EcosystemType.WateringCan && tile.type !== EcosystemType.NutrientMulch) {
        counts[tile.type] = (counts[tile.type] || 0) + 1;
        if (tile.growthStage > highestGrowthStage) {
          highestGrowthStage = tile.growthStage;
          maxStageSpecies = tile.type;
        }
      }
      totalMoisture += tile.moisture;
      totalNutrients += tile.nutrients;
      tileCount++;
    }
  });

  const avgMoisture = Math.round(totalMoisture / (tileCount || 1));
  const avgNutrients = Math.round(totalNutrients / (tileCount || 1));

  // Determine a clever deterministic/procedural goal based on the day or current progress
  // We alternate targetTypes to keep gameplay fresh
  const goalsPool = [
    {
      type: 'biomass',
      getEligible: () => true,
      generate: () => {
        const currentBiomass = stats.population;
        const targetValue = Math.max(currentBiomass + 250, Math.floor((currentBiomass + 150) / 100) * 100 + 100);
        const reward = Math.min(250, Math.max(80, Math.round(targetValue * 0.3)));
        const descriptions = [
          "Spotted forest owlets are seeking thicker twig crowns. Increase total Forest Biomass to help shelter nesting families.",
          "Ancient root webs are glowing. Raise our total Forest Biomass to strengthen the floor mycelium network.",
          "Fragrant micro-climates are forming. Enhance the Forest Biomass to cultivate rare moss canopies on high trunks."
        ];
        const description = descriptions[stats.day % descriptions.length];
        return { description, targetType: 'biomass' as const, targetValue, reward, completed: false };
      }
    },
    {
      type: 'energy',
      getEligible: () => stats.day > 1,
      generate: () => {
        const currentEnergy = stats.money;
        const targetValue = Math.max(currentEnergy + 120, Math.floor((currentEnergy + 100) / 50) * 50 + 100);
        const reward = Math.min(150, Math.max(60, Math.round(targetValue * 0.15)));
        const descriptions = [
          "Save up Solar Energy from fully photosynthesizing foliage leaves to construct secondary deep well reservoirs.",
          "The solar atmosphere is peaking. Amass Solar Energy points to activate geothermal warmth channels in the clay beds.",
          "Harvest sunlight and accumulate Solar Energy points to satisfy seasonal light-well thresholds."
        ];
        const description = descriptions[stats.day % descriptions.length];
        return { description, targetType: 'energy' as const, targetValue, reward, completed: false };
      }
    },
    {
      type: 'species_count',
      getEligible: () => true,
      generate: () => {
        // Select an appropriate species to request based on day or budget
        // Let's alternate through beautiful flora
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
        ];
        const selectedSpecies = eligibleFlora[stats.day % eligibleFlora.length];
        const speciesName = BUILDINGS[selectedSpecies]?.name || "Specimens";
        const currentCount = counts[selectedSpecies] || 0;
        const targetValue = currentCount + 2;
        const reward = (BUILDINGS[selectedSpecies]?.cost || 40) * 2 + 30;
        const descriptions = [
          `Honeybees are searching for specific pollination structures. Plant and maintain a total of ${targetValue} ${speciesName} specimens.`,
          `Nesting mountain finches are seeking shelters. Cultivate at least ${targetValue} ${speciesName} trees to invite them.`,
          `Soil mycelium requires organic minerals. Plant a total of ${targetValue} ${speciesName} trees to enrich this woodland sector.`
        ];
        const description = descriptions[stats.day % descriptions.length];
        return {
          description,
          targetType: 'species_count' as const,
          targetValue,
          buildingType: selectedSpecies,
          reward,
          completed: false
        };
      }
    },
    {
      type: 'growth_stage',
      getEligible: () => highestGrowthStage > 0 && highestGrowthStage < 4,
      generate: () => {
        const targetStage = Math.min(4, highestGrowthStage + 1);
        const speciesName = BUILDINGS[maxStageSpecies]?.name || "Foliage";
        const reward = targetStage === 4 ? 200 : 120;
        const descriptions = [
          `Promote the maturation of existing plant cells. Nurture a majestic ${speciesName} until it achieves ${targetStage === 4 ? 'Ancient Titan Stage 4' : `Stage ${targetStage} (Sapling/Mature)`} or above.`,
          `Provide sufficient subterranean hydration and organic nutrient mulch to guide a ${speciesName} to growth stage ${targetStage}.`
        ];
        const description = descriptions[stats.day % descriptions.length];
        return {
          description,
          targetType: 'growth_stage' as const,
          targetValue: targetStage,
          buildingType: maxStageSpecies,
          reward,
          completed: false
        };
      }
    }
  ];

  const eligible = goalsPool.filter(g => g.getEligible());
  const selectedGoalTemplate = eligible[stats.day % eligible.length] || goalsPool[0];
  const goal = selectedGoalTemplate.generate();

  return goal as AIGoal;
};

// Purely local, procedural forestry news generator
export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  // Small lag delay to feel authentic
  await new Promise(r => setTimeout(r, 300));

  const positiveNews = [
    "Ladybugs relocate to a warm southern cluster to assist with friendly aphid control.",
    "A cozy family of forest mice has settled beneath a majestic oak root cave.",
    "Local honeybees report that the air currents carry excellent floral honey perfumes.",
    "Warm daylight beams stimulate a burst of subterranean mycelium expansion.",
    "A local woodpecker finds an ideal tree trunk and begins a syncopated morning rhythm.",
    "Sprout root depths have successfully breached the primary underground water shelf.",
    "A rare woodland red panda is seen napping peacefully on a sunny branch.",
    "Garden worms express supreme gratitude for the airy nutrient soil mixtures.",
    "A flock of migrating songbirds inspects the blossom canopies and nests happily."
  ];

  const negativeNews = [
    "A dry high-pressure breeze slightly evaporates moisture from exposed clay soils.",
    "Local forest snails report extreme thirst and solicit water splashes from the gardener.",
    "Ecosystem surveyors observe light mineral depletion in tightly crowded tree sectors.",
    "Chilly alpine draft currents temporarily dry out some of the eastern loams.",
    "Nutrient-hungry wild ferns compete with young tree sprouts for soil peat mulch."
  ];

  const neutralNews = [
    "Early morning forest damp makes tree needles shimmer like pale green jade crystals.",
    "Golden maple and red oak leaf showers perform a delicate dance in the autumn drafts.",
    "Soft fog drifts silently across the isometric ridges, holding ambient soil moisture steady.",
    "Deep-root subterranean aquifers remain stable and replenish central clay coordinates.",
    "The woodland sanctuary completes another serene cycle of photosynthesis and quiet growth."
  ];

  let pool = neutralNews;
  let type: 'positive' | 'negative' | 'neutral' = 'neutral';

  const rand = Math.random();
  if (stats.weather === 'Raining') {
    pool = [
      "Heavy rainwater saturates the topsoil. Moisture scales show a delightful recovery.",
      "Young leaf sprouts extend to drink the fresh, cool rainfall droplets.",
      "Local forest frogs organize an enthusiastic celebratory choir in the moist clover lawns."
    ];
    type = 'positive';
  } else if (stats.weather === 'Windy') {
    pool = [
      "Gusty mountain drafts toss maple foliage, causing beautiful golden leaves to flutter.",
      "Strong wind gusts evaporate ambient topsoil loam moisture slightly faster today."
    ];
    type = 'neutral';
  } else if (rand < 0.45) {
    pool = positiveNews;
    type = 'positive';
  } else if (rand < 0.75) {
    pool = negativeNews;
    type = 'negative';
  }

  const text = pool[Math.floor(Math.random() * pool.length)];

  return {
    id: Date.now().toString() + Math.random().toString(),
    text,
    type
  };
};
