/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum EcosystemType {
  None = 'None',
  Pine = 'Pine',
  Oak = 'Oak',
  CherryBlossom = 'CherryBlossom',
  Maple = 'Maple',
  Redwood = 'Redwood',
  Bonsai = 'Bonsai',
  Willow = 'Willow',
  Baobab = 'Baobab',
  Jacaranda = 'Jacaranda',
  Alder = 'Alder',
  Acacia = 'Acacia',
  Birch = 'Birch',
  Bamboo = 'Bamboo',
  Cypress = 'Cypress',
  Peepal = 'Peepal',
  Neem = 'Neem',
  Banyan = 'Banyan',
  WateringCan = 'WateringCan',
  NutrientMulch = 'NutrientMulch',
  DeadTree = 'DeadTree',
}

export type WeatherType = 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew';

export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';

export type SeasonMode = 'auto' | SeasonType;

export interface SeasonWeights {
  phase: number; // Continuous 0.0 -> 4.0 circular seasonal clock
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
  dominant: SeasonType;
}

export type CameraPreset = 'iso' | 'scenic' | 'top';

export type HumanEra = 0 | 1 | 2 | 3; // 0: Paleolithic, 1: Neolithic, 2: Classical, 3: Eco-Sanctuary

export type EraMode = 'auto' | HumanEra;

export type SettlementKind = 'camp' | 'dwelling' | 'tower' | 'bridge';

export interface SettlementSite {
  id: string;
  x: number;
  y: number;
  kind: SettlementKind;
  builtEra: HumanEra;
}

export interface CivilizationState {
  enabled: boolean;
  era: HumanEra;
  eraMode: EraMode;
  eraProgress: number; // 0 to 100% progress toward next era
  humanCount: number;
  settlements: SettlementSite[];
}

export interface SpeciesConfig {
  type: EcosystemType;
  cost: number;
  name: string;
  description: string;
  color: string; // Principal hex color for 3D leaves
  solarGen: number; // Solar energy yield per tick when mature
  healthGen: number; // Biomass points added when mature
  growthRate: number; // Base growth % increased per tick
}

export interface TileData {
  x: number;
  y: number;
  type: EcosystemType; // What's planted here
  growthStage: number; // 0: Soil, 1: Sprout, 2: Sapling, 3: Mature, 4: Ancient
  growthProgress: number; // 0 to 100% progress inside the current stage
  moisture: number; // 0 to 100% soil moisture
  nutrients: number; // 0 to 100% soil nutrient level
  variant?: number; // Visual variant ID for 3D randomized offsets
}

export type Grid = TileData[][];

export interface CityStats {
  money: number; // Solar energy currency
  population: number; // Forest biomass score
  day: number;
  weather: WeatherType;
}

export interface AIGoal {
  description: string;
  targetType: 'biomass' | 'energy' | 'growth_stage' | 'species_count';
  targetValue: number;
  speciesType?: EcosystemType; // Species tracked if targetType is species_count or growth_stage
  buildingType?: EcosystemType; // Legacy localStorage compatibility alias
  reward: number;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}
