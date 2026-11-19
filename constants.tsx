/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { SpeciesConfig, EcosystemType } from './types';

// Grid Dimensions
export const GRID_SIZE = 15; // 15x15 spacious high-fidelity canvas block grid

// Game Speed Loops
export const TICK_RATE_MS = 1500; // Updates every 1.5s for snappy simulation progress
export const INITIAL_MONEY = 350; // Starting Solar Energy (☀️)

// Export species configurations under the variable name BUILDINGS to maintain import compatibility
export const BUILDINGS: Record<EcosystemType, SpeciesConfig> = {
  [EcosystemType.None]: {
    type: EcosystemType.None,
    cost: 5,
    name: 'Spade / Prune',
    description: 'Dig up a tree or prune a dead root. Cost: ☀️5',
    color: '#f87171',
    solarGen: 0,
    healthGen: 0,
    growthRate: 0,
  },
  [EcosystemType.WateringCan]: {
    type: EcosystemType.WateringCan,
    cost: 15,
    name: 'Watering Can',
    description: 'Shower land to restore soil moisture. Cost: ☀️15',
    color: '#38bdf8',
    solarGen: 0,
    healthGen: 0,
    growthRate: 0,
  },
  [EcosystemType.NutrientMulch]: {
    type: EcosystemType.NutrientMulch,
    cost: 30,
    name: 'Nutrient Mulch',
    description: 'Apply organic peat woodchips to enrich soil. Cost: ☀️30',
    color: '#ca8a04',
    solarGen: 0,
    healthGen: 0,
    growthRate: 0,
  },
  [EcosystemType.Pine]: {
    type: EcosystemType.Pine,
    cost: 40,
    name: 'Conifer Pine',
    description: 'Sturdy evergreen. Fast growth, modest solar output. Cost: ☀️40',
    color: '#0d9488', // Teal-600
    solarGen: 4,
    healthGen: 15,
    growthRate: 15, // Grows fastest
  },
  [EcosystemType.Oak]: {
    type: EcosystemType.Oak,
    cost: 80,
    name: 'Ancient Oak',
    description: 'Grand leafy canopy. High biomass multiplier. Cost: ☀️80',
    color: '#16a34a', // Green-600
    solarGen: 8,
    healthGen: 42,
    growthRate: 7, // Slow
  },
  [EcosystemType.CherryBlossom]: {
    type: EcosystemType.CherryBlossom,
    cost: 160,
    name: 'Cherry Blossom',
    description: 'Vibrant pink foliage. Massive photosynthesis yield. Cost: ☀️160',
    color: '#db2777', // Pink-600
    solarGen: 22,
    healthGen: 55,
    growthRate: 10, // Medium-fast
  },
  [EcosystemType.Maple]: {
    type: EcosystemType.Maple,
    cost: 110,
    name: 'Sugar Maple',
    description: 'Stunning autumn colors. Attracts birds, reliable energy. Cost: ☀️110',
    color: '#ea580c', // Orange-600
    solarGen: 12,
    healthGen: 30,
    growthRate: 12, // Medium-fast
  },
  [EcosystemType.Redwood]: {
    type: EcosystemType.Redwood,
    cost: 250,
    name: 'Giant Redwood',
    description: 'Cathedral of nature. Slowest growth, monumental biomass. Cost: ☀️250',
    color: '#15803d', // Green-700
    solarGen: 30,
    healthGen: 160,
    growthRate: 4, // Extremely slow but majestic
  },
  [EcosystemType.Bonsai]: {
    type: EcosystemType.Bonsai,
    cost: 60,
    name: 'Zen Bonsai',
    description: 'Resilient miniature art. Growth is slow & requires high nutrients, tiny footprint. Cost: ☀️60',
    color: '#84cc16', // Lime-500
    solarGen: 6,
    healthGen: 25,
    growthRate: 6, // Slow
  },
  [EcosystemType.Willow]: {
    type: EcosystemType.Willow,
    cost: 130,
    name: 'Weeping Willow',
    description: 'Elegant drooping branches. Thrives exceptionally near water and damp soils. Cost: ☀️130',
    color: '#2fd4c1', // Tealish-Green
    solarGen: 14,
    healthGen: 48,
    growthRate: 8, // Standard slow, grows much faster if hydrated
  },
  [EcosystemType.Baobab]: {
    type: EcosystemType.Baobab,
    cost: 200,
    name: 'Grand Baobab',
    description: 'Bottle-shaped ancient giant. Extremely slow growth, colossal biomass storage. Cost: ☀️200',
    color: '#047857', // Deep Emerald/Forest green
    solarGen: 25,
    healthGen: 120,
    growthRate: 5, // Slow growth
  },
  [EcosystemType.Jacaranda]: {
    type: EcosystemType.Jacaranda,
    cost: 180,
    name: 'Purple Jacaranda',
    description: 'Dazzling lavender-purple canopies. Superior energy generation, thrives under dynamic wind and dews. Cost: ☀️180',
    color: '#a855f7', // vibrant purple-500
    solarGen: 28,
    healthGen: 75,
    growthRate: 8, // moderate growth
  },
  [EcosystemType.Alder]: {
    type: EcosystemType.Alder,
    cost: 70,
    name: 'Red Alder',
    description: 'Nitrogen-fixing pioneer tree. Naturally replenishes its local root loam with active soil nutrients (+3/day). Cost: ☀️70',
    color: '#22c55e', // Emerald/Lime green
    solarGen: 6,
    healthGen: 22,
    growthRate: 13, // Fast growth
  },
  [EcosystemType.Acacia]: {
    type: EcosystemType.Acacia,
    cost: 125,
    name: 'Umbrella Acacia',
    description: 'Leguminous nitrogen-fixer. Highly drought-resilient and enriches surrounding tiles with soil nutrients (+4/day). Cost: ☀️125',
    color: '#84cc16', // Bright lime
    solarGen: 14,
    healthGen: 46,
    growthRate: 9, // Steady growth
  },
  [EcosystemType.Birch]: {
    type: EcosystemType.Birch,
    cost: 50,
    name: 'Silver Birch',
    description: 'Elegant slender tree with distinctive white bark. Fast-growing and yields steady Solar output. Cost: ☀️50',
    color: '#a3e635', // Light lime-green
    solarGen: 7,
    healthGen: 20,
    growthRate: 12,
  },
  [EcosystemType.Bamboo]: {
    type: EcosystemType.Bamboo,
    cost: 90,
    name: 'Golden Bamboo',
    description: 'Ultra-fast growing woody grass. Thrives on watered spots and quickly accumulates Biomass score. Cost: ☀️90',
    color: '#bef264', // Lime-300
    solarGen: 10,
    healthGen: 28,
    growthRate: 16,
  },
  [EcosystemType.Cypress]: {
    type: EcosystemType.Cypress,
    cost: 145,
    name: 'Swamp Cypress',
    description: 'Tall evergreen conifer. Acts as a natural moisture retainer, keeping adjacent soil watered. Cost: ☀️145',
    color: '#0f766e', // Teal-700
    solarGen: 16,
    healthGen: 58,
    growthRate: 8,
  },
  [EcosystemType.Peepal]: {
    type: EcosystemType.Peepal,
    cost: 155,
    name: 'Sacred Peepal',
    description: 'Venerated fig tree; a continuous source of energy and air purification. High growth, supreme solar yield. Cost: ☀️155',
    color: '#4ade80', // bright green
    solarGen: 19,
    healthGen: 52,
    growthRate: 11,
  },
  [EcosystemType.Neem]: {
    type: EcosystemType.Neem,
    cost: 85,
    name: 'Margosa Neem',
    description: 'A miraculous medicinal tree. Self-heals the surrounding root loam with powerful nutrients (+4/day) and repels drying. Cost: ☀️85',
    color: '#15803d', // deep rich green
    solarGen: 9,
    healthGen: 33,
    growthRate: 13,
  },
  [EcosystemType.Banyan]: {
    type: EcosystemType.Banyan,
    cost: 210,
    name: 'Grand Banyan',
    description: 'Sprawling national canopy supporting multi-pillar aerial roots. Retains massive adjacent local moisture and stores gigantic Biomass. Cost: ☀️210',
    color: '#166534', // very deep forest green
    solarGen: 25,
    healthGen: 135,
    growthRate: 5,
  },
  [EcosystemType.DeadTree]: {
    type: EcosystemType.DeadTree,
    cost: 0,
    name: 'Decaying Wood',
    description: 'Decomposing wood. Diffuses massive nutrients to adjacent soil tiles over time. Cost: ☀️0',
    color: '#713f12', // warm brown (yellow-900 / amber-950)
    solarGen: 0,
    healthGen: -10, // slightly counters biomass value until completely decomposed
    growthRate: 12, // decomposes at 12% per day
  },
};
