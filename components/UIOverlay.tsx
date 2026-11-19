/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Leaf, 
  CloudRain, 
  Wind, 
  Sparkles, 
  Calendar, 
  RotateCcw, 
  Compass, 
  Bot, 
  Droplet, 
  Gauge, 
  AlertTriangle, 
  HelpCircle, 
  Terminal, 
  Wrench, 
  Sprout, 
  Eye,
  Info,
  Layers,
  ArrowRight,
  TrendingUp,
  Heart,
  ChevronDown,
  ChevronUp,
  Settings,
  Volume2,
  VolumeX,
  X,
  Package,
  Activity,
  Play,
  Pause,
  Clock,
  Timer,
  Zap,
} from 'lucide-react';
import { EcosystemType, CityStats, AIGoal, NewsItem, TileData } from '../types';
import { BUILDINGS, GRID_SIZE } from '../constants';
import { ecosystemAudio } from '../services/audio';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: EcosystemType;
  onSelectTool: (type: EcosystemType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  hoveredTile: TileData | null;
  onReset: () => void;
  tickRateMs: number;
  onSetTickRateMs: (rate: number) => void;
  onToggleAI: () => void;
  subDayProgress?: number;
  showFertilityHeatmap?: boolean;
  onToggleFertilityHeatmap?: () => void;
}

const tools = [
  EcosystemType.None, // Spade Tool
  EcosystemType.WateringCan, // Moisture tool
  EcosystemType.NutrientMulch, // Nutrient tool
  EcosystemType.Pine,
  EcosystemType.Oak,
  EcosystemType.CherryBlossom,
  EcosystemType.Maple,
  EcosystemType.Redwood,
  EcosystemType.Bonsai,
  EcosystemType.Willow,
  EcosystemType.Baobab,
  EcosystemType.Jacaranda,
  EcosystemType.Alder,
  EcosystemType.Acacia,
  EcosystemType.Birch,
  EcosystemType.Bamboo,
  EcosystemType.Cypress,
  EcosystemType.Peepal,
  EcosystemType.Neem,
  EcosystemType.Banyan,
];

// Returns appropriate emoji indicator for species/tools
const getToolEmoji = (type: EcosystemType) => {
  switch (type) {
    case EcosystemType.None: return '✂️';
    case EcosystemType.WateringCan: return '💧';
    case EcosystemType.NutrientMulch: return '🟫';
    case EcosystemType.Pine: return '🌲';
    case EcosystemType.Oak: return '🌳';
    case EcosystemType.CherryBlossom: return '🌸';
    case EcosystemType.Maple: return '🍁';
    case EcosystemType.Redwood: return '🪵';
    case EcosystemType.Bonsai: return '🪴';
    case EcosystemType.Willow: return '🍃';
    case EcosystemType.Baobab: return '🌴';
    case EcosystemType.Jacaranda: return '🪻';
    case EcosystemType.Alder: return '🌿';
    case EcosystemType.Acacia: return '🌾';
    case EcosystemType.Birch: return '🪶';
    case EcosystemType.Bamboo: return '🎋';
    case EcosystemType.Cypress: return '🌲';
    case EcosystemType.Peepal: return '🧘';
    case EcosystemType.Neem: return '🌿';
    case EcosystemType.Banyan: return '🌳';
    case EcosystemType.DeadTree: return '🍄';
    default: return '🌱';
  }
};

// Growth Stage helper
const getStageLabel = (stage: number) => {
  switch (stage) {
    case 1: return 'Sprout 🌱';
    case 2: return 'Sapling 🌿';
    case 3: return 'Mature Tree 🌳';
    case 4: return 'Ancient Titan 👑';
    default: return 'Empty Soil';
  }
};

const ToolButton: React.FC<{
  type: EcosystemType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
}> = ({ type, isSelected, onClick, money }) => {
  const config = BUILDINGS[type];
  const canAfford = money >= config.cost;
  const emoji = getToolEmoji(type);

  return (
    <button
      onClick={onClick}
      disabled={!canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded-xl border transition-all duration-300 shadow-lg flex-shrink-0
        w-13 h-15 sm:w-14 sm:h-16 md:w-16 md:h-18 select-none group focus:outline-none focus:ring-2 focus:ring-emerald-400/50 active:scale-90
        ${isSelected 
          ? 'border-emerald-400 bg-emerald-500/25 scale-105 shadow-[0_0_12px_rgba(52,211,153,0.35)] text-white' 
          : 'border-white/10 bg-slate-950/40 hover:bg-slate-900/60 text-emerald-100 hover:scale-[1.03]'}
        ${!canAfford ? 'opacity-30 cursor-not-allowed border-rose-950 bg-slate-950/25' : 'cursor-pointer'}
      `}
      title={config.description}
    >
      <div className="text-xl sm:text-2xl mb-0.5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
        {emoji}
      </div>
      
      <span className="text-[7.5px] sm:text-[8.5px] md:text-[9.5px] font-bold text-slate-200 tracking-wide text-center px-1 truncate max-w-full leading-none">
        {config.name.split(' ')[0]}
      </span>

      {config.cost > 0 && (
        <span className={`text-[7px] md:text-[8px] font-mono font-black mt-0.5 ${canAfford ? 'text-amber-400' : 'text-rose-400'}`}>
          ☀️{config.cost}
        </span>
      )}
      
      {/* Active dot glow indicator */}
      {isSelected && (
        <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
        </span>
      )}
    </button>
  );
};

// Tick speed presets ranging from 0.5 seconds up to 1 hour
const TICK_PRESETS = [
  500,     // 0.5s
  800,     // 0.8s
  1000,    // 1s
  1500,    // 1.5s
  2000,    // 2s
  3000,    // 3s
  5000,    // 5s
  10000,   // 10s
  30000,   // 30s
  60000,   // 1m
  180000,  // 3s
  300000,  // 5m
  600000,  // 10m
  1800000, // 30m
  3600000  // 1h
];

const formatTickRate = (ms: number) => {
  if (ms >= 99999999) return 'Paused';
  if (ms >= 3600000) {
    const hrs = ms / 3600000;
    return `${hrs.toFixed(1).replace('.0', '')} ${hrs === 1 ? 'hr' : 'hrs'}`;
  }
  if (ms >= 60000) {
    const mins = ms / 60000;
    return `${mins.toFixed(1).replace('.0', '')} min${mins === 1 ? '' : 's'}`;
  }
  const secs = ms / 1000;
  return `${secs.toFixed(1).replace('.0', '')}s`;
};

const getClosestPresetIndex = (currentMs: number) => {
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < TICK_PRESETS.length; i++) {
    const diff = Math.abs(TICK_PRESETS[i] - currentMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  return closestIdx;
};

const getSpeciesPassive = (type: EcosystemType) => {
  switch (type) {
    case EcosystemType.Pine: return "Evergreen needles: robust core resilient to mild conditions";
    case EcosystemType.Oak: return "Grand trunk: stores high carbon biomass for biodiversity score";
    case EcosystemType.CherryBlossom: return "Photosynthesis crown: radiates abundant energy under sunlight";
    case EcosystemType.Maple: return "Autumnal rustle: grows faster under soft fall wind dews";
    case EcosystemType.Redwood: return "Cathedral monument: ultimate long-life titan wood density";
    case EcosystemType.Bonsai: return "Zen harmony: needs high nutrient loam, small clean base";
    case EcosystemType.Willow: return "Weeping boughs: thrives and grows 2.0x speed close to water pools";
    case EcosystemType.Baobab: return "Arid bottle trunk: absorbs extreme moisture, avoids dry-out death";
    case EcosystemType.Jacaranda: return "Lavender shield: multiplies its health values under autumn wind";
    case EcosystemType.Alder: return "Nitrogen root: adds local nutrients & diffuses +2 to adjacent cells";
    case EcosystemType.Acacia: return "Savanna taproot: dry-resistant, enriches adjacent fields (+4 nutrients)";
    case EcosystemType.Birch: return "Pioneer silver bark: fast wood build-up, reliable steady output";
    case EcosystemType.Bamboo: return "Hollow joint nodes: grows 2.2x speed in highly hydrated loam";
    case EcosystemType.Cypress: return "Swamp root-knees: naturally retains moisture across adjacent cells (+5%)";
    case EcosystemType.Peepal: return "Oxygen aura: supercharges solar currency yields (+19) and resists drought";
    case EcosystemType.Neem: return "Medicinal loam: fixes local root nutrients and disinfects neighbor terrain (+3)";
    case EcosystemType.Banyan: return "Aerial pillars: preserves great neighbor moisture (+8) and adds legendary biomass";
    default: return "Ecological plant specimen";
  }
};

const getTileGrowthMultiplier = (type: EcosystemType, moisture: number, nutrients: number, weather: string) => {
  if (type === EcosystemType.None || type === EcosystemType.DeadTree) return 1.0;
  
  // Moisture effect
  let moistureMult = 1.0;
  if (moisture >= 60) moistureMult = 1.5;
  else if (moisture <= 20) {
    moistureMult = type === EcosystemType.Baobab ? 0.6 : 0.15;
  }

  // Nutrient effect
  let nutrientMult = 1.0;
  if (type === EcosystemType.Bonsai) {
    if (nutrients >= 75) {
      nutrientMult = 1.4;
    } else if (nutrients <= 45) {
      nutrientMult = 0.05;
    } else {
      nutrientMult = 0.4;
    }
  } else if (type === EcosystemType.Alder || type === EcosystemType.Acacia) {
    if (nutrients >= 70) {
      nutrientMult = 1.25;
    } else if (nutrients <= 15) {
      nutrientMult = 0.8;
    }
  } else {
    if (nutrients >= 70) {
      nutrientMult = 1.3;
    } else if (nutrients <= 15) {
      nutrientMult = 0.1;
    }
  }

  // Weather effect
  let weatherMult = 1.0;
  if (weather === 'Sunny') weatherMult = 1.25;
  if (weather === 'Autumn_Dew' && (type === EcosystemType.Maple || type === EcosystemType.Oak || type === EcosystemType.Jacaranda)) {
    weatherMult = 1.4;
  }

  return moistureMult * nutrientMult * weatherMult;
};

const getTreeKeyPoints = (type: EcosystemType): string[] => {
  switch (type) {
    case EcosystemType.Pine:
      return [
        "🌲 Highly resilient: grows steady under harsh climes",
        "⚙️ High basic photosynthesis: reliable early energy source",
        "❄️ High frost resistance: unaffected by cold season drafts"
      ];
    case EcosystemType.Oak:
      return [
        "🌳 Huge wood volume: yields massive 🌿 Carbon Biomass Score",
        "🐿️ Biodiversity haven: increases wildlife spawn probabilities",
        "🔒 Sturdy posture: resists windstorms and sudden dewatering"
      ];
    case EcosystemType.CherryBlossom:
      return [
        "🌸 Solar dynamo: produces extra high ☀️ Solar Energy",
        "✨ Petal wind: creates scenic pink ambient flora visual accents",
        "⚖️ Nutrient dependent: struggles in unfertilized soils"
      ];
    case EcosystemType.Maple:
      return [
        "🍁 Dew drinker: growth rate scales up rapidly in Autumn Dew",
        "🍂 Soil aerator: gradually adds nutrients to nearby ground",
        "🎨 Scenic foliage: elevates ecosystem beauty rating"
      ];
    case EcosystemType.Redwood:
      return [
        "👑 Forest patriarch: doubles all yields upon reaching Ancient Titan era",
        "🧱 Ultimate density: massive, permanent contribution to Biomass",
        "⏳ High initial cost: requiring significant energy pool to plant"
      ];
    case EcosystemType.Bonsai:
      return [
        "🪴 Zen microscale: extremely compact base allows precision spacing",
        "🧪 Sophisticated: growth is highly sensitive to loam fertilizer NTR",
        "🏵️ Aesthetic focus: yields high prestige energy when fully matured"
      ];
    case EcosystemType.Willow:
      return [
        "🌿 Aquatic affinity: grows at 2.0x speed when near water columns/lakes",
        "💧 Moisture absorber: reduces waterlogging of neighbor cells",
        "🐦 Avain nesting: provides shelter to rare seasonal singing birds"
      ];
    case EcosystemType.Baobab:
      return [
        "🌴 Arid master: stores high moisture inside its giant corky trunk",
        "☀️ Drought champion: completely immune to sunny dehydration fatalities",
        "🐢 Ancient lifespan: remains living in low rain conditions for weeks"
      ];
    case EcosystemType.Jacaranda:
      return [
        "💜 Purple canopy: beautiful purple foliage that enriches biome tier",
        "🌪️ Wind buffer: reduces adverse windstorm tile moisture loss",
        "🍂 Fall multiplier: multiplies health value points under autumn wind"
      ];
    case EcosystemType.Alder:
      return [
        "🪵 Nitrogen fixer: naturally synthesizes nutrients inside ground roots",
        "📈 Soil rejuvenator: automatically diffuses +2 NTR to adjacent cells",
        "🌱 Pioneer: very fast early progress helps quick forestation"
      ];
    case EcosystemType.Acacia:
      return [
        "🌾 Xerophytic taproot: penetrates deep, bringing up nutrients",
        "🔋 Loam enriching: diffuses +4 nutrients to adjacent cells every tick",
        "🦒 Wildlife shade: attracts curious savanna fauna to your sanctuary"
      ];
    case EcosystemType.Birch:
      return [
        "🪶 Silver bark: rapid growth, providing quick solar returns",
        "🧹 Ground sweeper: gradually extracts toxins from over-fertilized loam",
        "🎯 Beginner-friendly: low energy costs, high early-season return rate"
      ];
    case EcosystemType.Bamboo:
      return [
        "🎋 Rapid stalk: grows at crazy 2.2x speed in highly hydrated loam",
        "🔗 Invasive roots: stabilizes soil and prevents erosion landslides",
        "🐼 Wildlife feed: panda-friendly habitats that elevate biodiversity score"
      ];
    case EcosystemType.Cypress:
      return [
        "🌲 Wetland buffer: swamp-adapted root knees that retain moisture",
        "💧 Hydration diffuser: preserves and radiates +5% moisture to neighbors",
        "🛡️ Rot-resistant: highly immune to decaying rot under swampy conditions"
      ];
    case EcosystemType.Peepal:
      return [
        "🍃 Oxygen powerhouse: supercharges solar currency yields with +19 bonus",
        "🌞 Climate buffer: resists extreme heatwaves and drought spells",
        "🛕 Legendary history: revered species that boosts overall ecosystem harmony"
      ];
    case EcosystemType.Neem:
      return [
        "🌱 Medicinal roots: naturally fixes and sanitizes soil nutrients",
        "🩺 Disinfectant field: protects neighboring terrain with +3 nutrient gains",
        "🐛 Natural pest repellent: keeps wood-boring pests away from neighbor trees"
      ];
    case EcosystemType.Banyan:
      return [
        "🌳 Canopy giant: legendary lateral expansion using aerial prop roots",
        "💦 Moisture trap: traps and preserves moisture for adjacent fields (+8%)",
        "🌿 Legendary biomass: provides massive continuous Biomass Points"
      ];
    default:
      return [
        "🍃 Custom plant: beautiful addition to your sanctuary ecosystem",
        "☀️ Active photosynthesis: converts sunshine to solar coin currency",
        "🌿 Biomass contribution: expands sanctuary carbon absorption index"
      ];
  }
};

const getUnoccupiedTileSuggestion = (tile: TileData) => {
  if (tile.moisture >= 60 && tile.nutrients >= 50) {
    return {
      title: "Super-Fertile Lot",
      text: "Plant high-tier species like Cherry Blossom 🌸 or Willow 🍃 to maximize growth speed!",
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_12px_rgba(16,185,129,0.05)]"
    };
  }
  if (tile.moisture <= 20) {
    return {
      title: "Arid & Dehydrated",
      text: "Use Watering Can 💧 to increase hydration, or plant drought-resilient Grand Baobab 🌴.",
      color: "text-amber-400 border-amber-500/20 bg-amber-500/5 shadow-[0_0_12px_rgba(245,158,11,0.05)]"
    };
  }
  if (tile.nutrients <= 30) {
    return {
      title: "Depleted Nutrients",
      text: "Apply Nutrient Mulch 🟫, or plant a nitrogen-fixing Red Alder 🌿 or Umbrella Acacia 🌾.",
      color: "text-orange-400 border-orange-500/20 bg-orange-500/5 shadow-[0_0_12px_rgba(249,115,22,0.05)]"
    };
  }
  if (tile.moisture >= 65) {
    return {
      title: "Water-Cozy Clay",
      text: "Weeping Willow 🍃 or Swamp Cypress 🌲 will thrive wonderfully in this damp soil (+2.0x growth)!",
      color: "text-sky-400 border-sky-500/20 bg-sky-500/5 shadow-[0_0_12px_rgba(56,189,248,0.05)]"
    };
  }
  // Default suggestion
  return {
    title: "Standard Loam",
    text: "Fully ready for planting! Conifer Pine 🌲 grows fastest, while Silver Birch 🪶 offers a robust start.",
    color: "text-slate-300 border-white/5 bg-white/5"
  };
};

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  hoveredTile,
  onReset,
  tickRateMs,
  onSetTickRateMs,
  onToggleAI,
  subDayProgress,
  showFertilityHeatmap = false,
  onToggleFertilityHeatmap
}) => {
  const newsRef = useRef<HTMLDivElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [activeHubTab, setActiveHubTab] = useState<'quests' | 'logs'>('quests');
  const [isHubCollapsed, setIsHubCollapsed] = useState(() => typeof window !== 'undefined' ? (window.innerWidth < 1280 || window.innerHeight < 700) : false);
  const [isSpecCollapsed, setIsSpecCollapsed] = useState(() => typeof window !== 'undefined' ? (window.innerWidth < 1280 || window.innerHeight < 700) : false);

  // Audio state management
  const [audioVolume, setAudioVolume] = useState(() => ecosystemAudio.getVolume());
  const [audioMuted, setAudioMuted] = useState(() => ecosystemAudio.getMuted());

  const handleVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    ecosystemAudio.setVolume(vol);
    if (vol > 0 && audioMuted) {
      setAudioMuted(false);
      ecosystemAudio.setMute(false);
    }
  };

  const handleMuteToggle = () => {
    const nextMute = !audioMuted;
    setAudioMuted(nextMute);
    ecosystemAudio.setMute(nextMute);
  };

  useEffect(() => {
    setAudioVolume(ecosystemAudio.getVolume());
    setAudioMuted(ecosystemAudio.getMuted());
  }, [isSettingsOpen]);

  const lastSpeedRef = useRef<number>(1500);
  useEffect(() => {
    if (tickRateMs < 99999999) {
      lastSpeedRef.current = tickRateMs;
    }
  }, [tickRateMs]);

  // Dynamic calculations for season and time-of-day clock
  const { seasonName, seasonColor, seasonEmoji, dayInSeason } = useMemo(() => {
    const cycle = ((stats.day - 1) % 40);
    let sName = 'Spring';
    let sColor = 'text-pink-400';
    let sEmoji = '🌸';
    if (cycle >= 10 && cycle < 20) {
      sName = 'Summer';
      sColor = 'text-amber-400';
      sEmoji = '☀️';
    } else if (cycle >= 20 && cycle < 30) {
      sName = 'Autumn';
      sColor = 'text-orange-400';
      sEmoji = '🍂';
    } else if (cycle >= 30) {
      sName = 'Winter';
      sColor = 'text-sky-300';
      sEmoji = '❄️';
    }

    const dInSeason = (cycle % 10) + 1;
    return { seasonName: sName, seasonColor: sColor, seasonEmoji: sEmoji, dayInSeason: dInSeason };
  }, [stats.day]);

  const { hourString, minuteString, ampm } = useMemo(() => {
    const progress = subDayProgress !== undefined ? subDayProgress : 0;
    const totalMinutes = Math.floor(progress * 1440);
    const h24 = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const displayHour = h12 < 10 ? `0${h12}` : `${h12}`;
    const displayMinute = m < 10 ? `0${m}` : `${m}`;
    const displayAmpm = h24 >= 12 ? 'PM' : 'AM';

    return {
      hourString: displayHour,
      minuteString: displayMinute,
      ampm: displayAmpm
    };
  }, [subDayProgress]);

  // Auto-reset confirmation timer after 4 seconds
  useEffect(() => {
    if (showResetConfirm) {
      const timer = setTimeout(() => setShowResetConfirm(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showResetConfirm]);

  // Auto-scroll news feed in the hub log tab
  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed, activeHubTab, isHubOpen]);

  // Weather configuration details
  const weather = useMemo(() => {
    switch (stats.weather) {
      case 'Sunny': 
        return { 
          icon: <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />, 
          emoji: '☀️', 
          color: 'text-amber-400', 
          label: 'Sunny Skydome', 
          bgGlow: 'shadow-[0_0_24px_rgba(245,158,11,0.15)] border-amber-500/20' 
        };
      case 'Raining': 
        return { 
          icon: <CloudRain className="w-4 h-4 text-sky-400 animate-bounce" />, 
          emoji: '🌧️', 
          color: 'text-sky-400', 
          label: 'Rain Squall', 
          bgGlow: 'shadow-[0_0_24px_rgba(56,189,248,0.15)] border-sky-500/20' 
        };
      case 'Windy': 
        return { 
          icon: <Wind className="w-4 h-4 text-teal-300 animate-pulse" />, 
          emoji: '💨', 
          color: 'text-teal-300', 
          label: 'Alpine Drafts', 
          bgGlow: 'shadow-[0_0_24px_rgba(45,212,191,0.12)] border-teal-500/20' 
        };
      case 'Autumn_Dew': 
        return { 
          icon: <Leaf className="w-4 h-4 text-orange-400" />, 
          emoji: '🍁', 
          color: 'text-orange-400', 
          label: 'Autumn Dewfall', 
          bgGlow: 'shadow-[0_0_24px_rgba(249,115,22,0.12)] border-orange-500/20' 
        };
      default: 
        return { 
          icon: <Sun className="w-4 h-4 text-slate-300" />, 
          emoji: '⛅', 
          color: 'text-white', 
          label: 'Temperate Cloud', 
          bgGlow: 'border-white/10' 
        };
    }
  }, [stats.weather]);

  // Quest milestone tracking percentage
  const questProgress = useMemo(() => {
    if (!currentGoal) return null;
    let currentScore = 0;
    if (currentGoal.targetType === 'biomass') {
      currentScore = stats.population;
    } else if (currentGoal.targetType === 'energy') {
      currentScore = stats.money;
    } else {
      return null;
    }
    const percent = Math.min(100, Math.round((currentScore / currentGoal.targetValue) * 100));
    return { current: currentScore, target: currentGoal.targetValue, percent };
  }, [currentGoal, stats.population, stats.money]);

  // Selected tool detailed specification lookup
  const activeToolConfig = useMemo(() => {
    return BUILDINGS[selectedTool];
  }, [selectedTool]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 md:p-5 font-sans z-10 select-none overflow-hidden">
      
      {/* Top Banner Row */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start pointer-events-auto gap-3 w-full max-w-full relative z-30">
        
        {/* Left Side: Dynamic Ecology Dashboard (Polished Glassmorphism) */}
        <div 
          className="bg-slate-950/70 text-white p-2 sm:p-2.5 rounded-3xl border border-white/15 hover:border-emerald-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl flex gap-3 sm:gap-4 items-center justify-start lg:justify-start w-full lg:w-auto overflow-x-auto no-scrollbar flex-nowrap mask-image-h transition-all duration-350 ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          
          {/* Solar Energy */}
          <div className="flex items-center gap-2 flex-shrink-0 hover:bg-white/5 px-2 py-1.5 rounded-2xl transition-all duration-300 group">
            <div className="flex flex-col">
              <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1 group-hover:text-amber-300 transition-colors">Solar</span>
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                <span className="text-xs font-black text-amber-300 font-mono tracking-tight leading-none drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  {stats.money.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-white/15 self-center flex-shrink-0" />
          
          {/* Forest Biomass */}
          <div className="flex items-center gap-2 flex-shrink-0 hover:bg-white/5 px-2 py-1.5 rounded-2xl transition-all duration-300 group">
            <div className="flex flex-col">
              <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1 group-hover:text-emerald-300 transition-colors">Biomass</span>
              <div className="flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="text-xs font-black text-emerald-400 font-mono tracking-tight leading-none drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                  {stats.population.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-white/15 self-center flex-shrink-0" />

          {/* Current Weather status */}
          <div className="flex items-center gap-2 cursor-help flex-shrink-0 hover:bg-white/5 px-2 py-1.5 rounded-2xl transition-all duration-300 group" title={weather.label}>
            <div className="flex flex-col">
              <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1 group-hover:text-emerald-300 transition-colors">Atmosphere</span>
              <div className="flex items-center gap-1.5 font-mono text-xs font-black leading-none">
                <span className="text-sm select-none drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">{weather.emoji}</span>
                <span className={`tracking-tight ${weather.color} drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]`}>
                  {weather.label.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-white/15 self-center flex-shrink-0" />

          {/* Detailed Chronology (Season, Day, Time) */}
          <div className="flex items-center gap-2 flex-shrink-0 hover:bg-white/5 px-2 py-1.5 rounded-2xl transition-all duration-300 group">
            <div className="flex flex-col select-none">
              <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1 group-hover:text-white/90 transition-colors">Chronology</span>
              <div className="flex items-center gap-1.5 font-mono text-xs font-black leading-none text-white">
                <span className="text-sm -mt-0.5 select-none drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">{seasonEmoji}</span>
                <span className={`${seasonColor} drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]`}>{seasonName}</span>
                <span className="text-white/10 font-light">|</span>
                <span>Day {stats.day}</span>
                <span className="text-white/10 font-light">|</span>
                <span className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">{hourString}:{minuteString} {ampm}</span>
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-white/15 self-center flex-shrink-0" />

          {/* Settings button section (replacing reset button) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
            <button
              onClick={() => setIsHubCollapsed(prev => !prev)}
              className={`p-1.5 sm:p-2 rounded-xl border cursor-pointer pointer-events-auto transition-all duration-300 flex items-center justify-center shadow-inner hover:scale-105 active:scale-95 ${
                !isHubCollapsed 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                  : 'bg-white/5 hover:bg-white/12 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Ecosystem Analytics & Quest Hub"
            >
              <Compass className={`w-3.5 h-3.5 ${!isHubCollapsed ? 'animate-spin-slow' : ''}`} />
            </button>

            <button
              onClick={() => setIsSettingsOpen(prev => !prev)}
              className={`p-1.5 sm:p-2 rounded-xl border cursor-pointer pointer-events-auto transition-all duration-300 flex items-center justify-center shadow-inner hover:scale-105 active:scale-95 ${
                isSettingsOpen 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                  : 'bg-white/5 hover:bg-white/12 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Sanctuary Settings & Speed Configuration"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Ecosystem Hub Popover */}
        <AnimatePresence>
          {!isHubCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-2.5 sm:right-4 top-[84px] md:top-[92px] z-50 w-72 sm:w-80 bg-slate-950/40 border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl pointer-events-auto flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
               <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-100">Ecosystem Hub</span>
                </div>
                <button 
                  onClick={() => setIsHubCollapsed(true)}
                  className="text-slate-400 hover:text-white text-xs font-mono font-black select-none pointer-events-auto cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quest Section */}
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/45 to-slate-900/40 border border-white/10 p-3.5 rounded-xl flex flex-col gap-2 shadow-[0_4px_20px_rgba(30,27,75,0.2)]">
                {/* Decorative glow ring backdrop */}
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-[8px] font-black text-indigo-300 uppercase tracking-[0.15em] leading-none flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    ACTIVE OBJECTIVE
                  </span>
                  {aiEnabled && currentGoal && (
                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      currentGoal.completed 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse' 
                        : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono'
                    }`}>
                      {currentGoal.completed ? 'READY' : 'ACTIVE'}
                    </span>
                  )}
                </div>
                
                {aiEnabled ? (
                  currentGoal ? (
                    <div className="flex flex-col gap-2.5 relative z-10 font-sans">
                      <p className="text-[10px] font-bold text-cyan-200/90 leading-snug italic bg-cyan-950/25 p-2 rounded-lg border border-cyan-500/10 shadow-inner">
                        "{currentGoal.description}"
                      </p>
                      
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-mono">
                          <span className="font-bold text-slate-400 flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-indigo-400" /> Goal Biome Progress
                          </span>
                          <span className="font-extrabold text-slate-100 flex items-center gap-1">
                            <span className="text-indigo-300">{questProgress ? questProgress.current.toLocaleString() : '0'}</span> 
                            <span className="text-slate-600">/</span> 
                            <span className="text-slate-300">{currentGoal.targetValue.toLocaleString()}</span>
                          </span>
                        </div>
                        {questProgress && (
                          <div className="w-full space-y-1">
                            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5 p-[1px] relative shadow-inner">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${questProgress.percent}%` }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                className={`h-full rounded-full ${
                                  currentGoal.completed 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                                    : 'bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                                }`}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[7.5px] font-mono font-bold leading-none">
                              <span className="text-slate-500">Progress</span>
                              <span className={currentGoal.completed ? 'text-emerald-400 animate-pulse font-black' : 'text-indigo-300'}>
                                {questProgress.percent}% {currentGoal.completed ? 'COMPLETED' : 'ENGAGED'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {currentGoal.completed && (
                        <button
                          onClick={onClaimReward}
                          className="w-full relative overflow-hidden bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black py-2 rounded-lg text-[9px] uppercase tracking-wider active:scale-95 transition-all mt-1 shadow-[0_4px_12px_rgba(16,185,129,0.3)] border border-emerald-400/40 group cursor-pointer pointer-events-auto"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <Sparkles className="w-3 h-3 animate-pulse" />
                            Claim Reward (+☀️{currentGoal.reward})
                          </div>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-600 italic animate-pulse">Syncing biome objective...</span>
                  )
                ) : (
                   <div className="text-[9px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg font-mono flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                     Sandbox Mode: Quests Offline
                   </div>
                )}
              </div>

              {/* Logs Section */}
              <div className="bg-slate-900/30 border border-white/5 p-3 rounded-xl flex flex-col gap-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">TELEMETRY FEED</span>
                <div ref={newsRef} className="h-24 overflow-y-auto space-y-1 text-[8px] font-mono scroll-smooth pr-1 custom-scrollbar">
                  {newsFeed.map((news) => (
                    <div key={news.id} className={`
                      pl-2 py-0.5 border-l-2
                      ${news.type === 'positive' ? 'border-emerald-500 text-emerald-400/80' : ''}
                      ${news.type === 'negative' ? 'border-rose-500 text-rose-400/80' : ''}
                      ${news.type === 'neutral' ? 'border-sky-500 text-sky-300/80' : ''}
                    `}>
                      {news.text}
                    </div>
                  ))}
                  {newsFeed.length === 0 && <span className="text-slate-600 italic">Standby...</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Popover Menu (Independent Floating Panel to avoid overflow clipping) */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-2.5 sm:left-4 top-[84px] md:top-[92px] z-50 w-72 sm:w-80 bg-slate-950/40 border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl pointer-events-auto flex flex-col gap-3.5"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-100">Sanctuary Control</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSettingsOpen(false);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-5 h-5 rounded-full bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center transition-all duration-300 hover:rotate-90 active:scale-90 pointer-events-auto cursor-pointer shadow-sm"
                  title="Close Controls"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Day Span Control: Speed selections */}
              <div className="bg-slate-900/30 border border-white/5 p-3 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">DAY SPAN SIMULATION</span>
                  <span className="text-[8.5px] font-mono font-bold text-indigo-350 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/25 flex items-center gap-1">
                    {tickRateMs >= 99999999 ? (
                      <Pause className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
                    ) : tickRateMs >= 3600000 ? (
                      <Clock className="w-2.5 h-2.5 text-sky-400" />
                    ) : (
                      <Timer className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    )}
                    {formatTickRate(tickRateMs)}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={TICK_PRESETS.length - 1}
                    value={tickRateMs >= 99999999 ? TICK_PRESETS.length - 1 : getClosestPresetIndex(tickRateMs)}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      onSetTickRateMs(TICK_PRESETS[idx]);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-indigo-400 hover:accent-indigo-300 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                  />
                  
                  {/* Play/Pause Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tickRateMs >= 99999999) {
                        onSetTickRateMs(lastSpeedRef.current); // Resume to last known active speed
                      } else {
                        onSetTickRateMs(99999999); // Pause
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`px-3 py-1.5 rounded-lg border text-[8px] font-bold uppercase tracking-wider active:scale-95 transition-all duration-300 cursor-pointer pointer-events-auto flex items-center justify-center gap-1.5 ${
                      tickRateMs >= 99999999
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:bg-amber-500/25'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-400/40 shadow-[0_4px_12px_rgba(99,102,241,0.08)]'
                    }`}
                    title={tickRateMs >= 99999999 ? "Resume Simulation" : "Pause Simulation"}
                  >
                    {tickRateMs >= 99999999 ? (
                      <>
                        <Play className="w-2.5 h-2.5 text-amber-300 fill-amber-300/10" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-2.5 h-2.5 text-indigo-300 fill-indigo-300/10" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-between text-[7px] text-slate-400 px-1 font-mono leading-none">
                  <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5 text-amber-400/80" /> 0.5s</span>
                  <span className="flex items-center gap-0.5"><Timer className="w-2.5 h-2.5 text-indigo-400/80" /> 1m</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-sky-450/80" /> 1h</span>
                </div>
              </div>

              {/* Visual Observation & Overlays */}
              <div className="bg-slate-900/30 border border-white/5 p-3 rounded-xl flex flex-col gap-2.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ECOLOGY OVERLAYS</span>
                
                {/* AI Assistant Switch */}
                <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-extrabold text-slate-200">Eco-AI Quests</span>
                    <span className="text-[7px] text-slate-400 leading-none mt-0.5">Weather shifts & active challenges</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAI();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`relative inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-full border border-white/10 transition-all duration-300 pointer-events-auto focus:outline-none focus:ring-1 focus:ring-emerald-400/30 p-0.5 ${
                      aiEnabled 
                        ? 'bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.25)] border-emerald-400/30' 
                        : 'bg-slate-800 hover:bg-slate-750'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out ${
                        aiEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      }`}
                    />
                  </button>
                </div>

                {/* Heatmap Switch & Legend */}
                {onToggleFertilityHeatmap && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-extrabold text-slate-200">Soil Heatmap</span>
                        <span className="text-[7px] text-slate-400 leading-none mt-0.5">Show real-time fertility levels</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFertilityHeatmap();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`relative inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-full border border-white/10 transition-all duration-300 pointer-events-auto focus:outline-none focus:ring-1 focus:ring-amber-400/30 p-0.5 ${
                          showFertilityHeatmap 
                            ? 'bg-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)] border-amber-400/30' 
                            : 'bg-slate-800 hover:bg-slate-750'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out ${
                            showFertilityHeatmap ? 'translate-x-[18px]' : 'translate-x-[2px]'
                          }`}
                        />
                      </button>
                    </div>

                    {showFertilityHeatmap && (
                      <div className="bg-slate-950/60 backdrop-blur-xl p-3 rounded-xl border border-white/10 flex flex-col gap-2.5 relative shadow-xl overflow-hidden animate-fade-in">
                        {/* Elegant corner accents */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-400/40"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400/40"></div>
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400/40"></div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400/40"></div>
                        
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span className="text-[8px] font-black text-amber-300 uppercase tracking-widest leading-none">Soil Fertility Spectrum</span>
                        </div>
                        {/* Continuous Color block progress gradient with a sleek inner shadow */}
                        <div className="h-2 w-full rounded-md border border-white/5 shadow-[inner_0_1px_2px_rgba(0,0,0,0.5)]" style={{ background: 'linear-gradient(to right, #f5ebd0, #3e1b04)' }} />
                        {/* Left and Right level scales */}
                        <div className="flex justify-between items-center text-[7.5px] font-mono leading-none">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-amber-100/60 font-semibold">0% Low</span>
                            <span className="text-[6.5px] text-slate-500 font-extrabold uppercase tracking-tight">Depleted</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-amber-300 font-extrabold animate-pulse">100% Rich</span>
                            <span className="text-[6.5px] text-amber-500 font-extrabold uppercase tracking-tight">Humus Loam</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Soundscape Ambient System */}
              <div className="bg-slate-900/30 border border-white/5 p-3 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">AMBIENT SOUNDSCAPE</span>
                    <span className="text-[7.2px] text-slate-400">Wind, birds, and river acoustic flows</span>
                  </div>
                  <button
                    onClick={handleMuteToggle}
                    className={`p-1.5 rounded-lg border cursor-pointer pointer-events-auto transition-all ${
                      audioMuted ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    }`}
                    title={audioMuted ? "Unmute acoustic soundscape" : "Mute acoustic soundscape"}
                  >
                    {audioMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 animate-pulse" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-slate-400 font-bold uppercase font-mono">Vol</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioMuted ? 0 : audioVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-emerald-500 focus:outline-none"
                  />
                  <span className="text-[8px] font-mono font-bold text-slate-300 w-7 text-right">
                    {audioMuted ? 'OFF' : `${Math.round(audioVolume * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Reset Canopy Option */}
              <div className="bg-slate-900/30 border border-white/5 p-3 rounded-xl flex flex-col gap-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SANCTUARY RESET</span>
                {showResetConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onReset();
                        setShowResetConfirm(false);
                        setIsSettingsOpen(false);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase py-2 rounded-lg border border-rose-500/20 cursor-pointer pointer-events-auto text-center transition-all shadow"
                    >
                      Yes, Reset!
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-[9px] uppercase px-3 py-2 rounded-lg border border-white/5 cursor-pointer pointer-events-auto"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full bg-rose-950/20 text-rose-300 border border-rose-800/30 hover:bg-rose-900/20 hover:text-rose-200 font-extrabold text-[9px] uppercase py-1.5 rounded-lg cursor-pointer pointer-events-auto transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Progress
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>



      {/* Unified Botanical Console: Clean multi-segment panel hosting both Info and Inventory */}
      <div 
        className="w-full pointer-events-auto mt-auto flex flex-col gap-2 relative"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="w-full max-w-full bg-slate-950/40 p-2 sm:p-3 rounded-l-xl rounded-r-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          
          {/* Segment 1: High-Performance Loam HUD (Hovered Tile Info) */}
          <div className="w-full min-h-[4.5rem] sm:min-h-[5.5rem] md:min-h-[6rem] h-auto bg-slate-950/40 rounded-xl border border-white/10 flex items-center px-3 py-2.5 sm:px-4 sm:py-3 overflow-hidden relative group shadow-inner">
            {/* HUD Corner Brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-400/30"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-400/30"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-400/30"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-400/30"></div>
            
            <AnimatePresence mode="wait">
              {hoveredTile ? (
                <motion.div
                  key="vitals-hud-active"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 items-center relative z-10 animate-fade-in"
                >
                  {/* Column 1: Botanio-Species ID & Coordinates */}
                  <div className="flex items-center gap-2 sm:gap-3 border-r border-white/10 pr-1.5 sm:pr-2 lg:pr-4 font-sans h-full col-span-1 min-w-0">
                    <span className="text-2xl sm:text-3xl md:text-4xl drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] select-none">
                      {getToolEmoji(hoveredTile.type)}
                    </span>
                    <div className="flex flex-col min-w-0 w-full">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[7px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none mb-0.5">
                          {hoveredTile.type === EcosystemType.None ? 'TERRAIN' : 'SPECIES'}
                        </span>
                        <span className="text-[7.5px] font-mono text-slate-500 font-extrabold bg-slate-900 px-1 py-0.5 overflow-hidden rounded leading-none">
                          X:{hoveredTile.x} Y:{hoveredTile.y}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-white leading-tight tracking-tight truncate mt-0.5">
                        {hoveredTile.type === EcosystemType.None ? 'Fertile Ground' : (BUILDINGS[hoveredTile.type]?.name || hoveredTile.type)}
                      </span>
                      {hoveredTile.type !== EcosystemType.None ? (
                        <div className="flex flex-col gap-1 mt-1 w-full">
                          <span className="text-[8.5px] font-bold text-emerald-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {getStageLabel(hoveredTile.growthStage)}
                          </span>
                          {hoveredTile.growthStage < 4 ? (
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-1.5 w-full">
                                <div className="flex-grow bg-slate-900 border border-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-emerald-400 h-full rounded-full" 
                                    style={{ width: `${hoveredTile.growthProgress}%` }} 
                                  />
                                </div>
                                <span className="text-[7.5px] font-mono font-bold text-slate-400">
                                  {Math.round(hoveredTile.growthProgress)}%
                                </span>
                              </div>
                              <span className="text-[7.5px] font-mono font-bold text-emerald-400/90 tracking-wide flex items-center gap-1 animate-fade-in hidden sm:flex">
                                <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                                Growth Pace: <span className="font-extrabold text-white">{(getTileGrowthMultiplier(hoveredTile.type, hoveredTile.moisture, hoveredTile.nutrients, stats.weather)).toFixed(2)}x</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[7.5px] font-bold text-amber-400 animate-pulse uppercase tracking-wider flex items-center gap-1 leading-none mt-0.5">
                                ★ Peak Maturation (Max)
                              </span>
                              <span className="text-[7.3px] font-mono text-emerald-500 opacity-80 leading-none hidden sm:inline">
                                Max Photosynthesis Active
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                          Available Lot
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Soil Bio-Vitals */}
                  <div className="flex flex-col gap-2.5 sm:gap-3 font-sans border-r-0 sm:border-r border-white/10 pr-0 sm:pr-2 lg:pr-4 h-full justify-center col-span-1 min-w-0">
                    {/* H2O / Moisture */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[7.5px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1">
                          <Droplet className="w-2.5 h-2.5" /> Soil Moisture (H2O)
                        </span>
                        <div className="flex items-center gap-1">
                          {hoveredTile.moisture <= 15 ? (
                            <span className="text-[6.5px] px-1 py-0.2 bg-rose-500/25 border border-rose-500/40 text-rose-300 font-extrabold animate-pulse rounded uppercase tracking-tighter">
                              dehydrated
                            </span>
                          ) : hoveredTile.moisture >= 60 ? (
                            <span className="text-[6.5px] px-1 py-0.2 bg-sky-500/15 border border-sky-500/20 text-sky-300 font-semibold rounded uppercase tracking-tighter">
                              saturated
                            </span>
                          ) : null}
                          <span className="text-[9.5px] font-black font-mono text-white leading-none">
                            {Math.round(hoveredTile.moisture)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${hoveredTile.moisture}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            hoveredTile.moisture <= 15 
                              ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                              : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]'
                          }`} 
                        />
                      </div>
                    </div>

                    {/* NTR / Nutrients */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[7.5px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Soil Nutrients (NTR)
                        </span>
                        <div className="flex items-center gap-1">
                          {hoveredTile.nutrients <= 15 ? (
                            <span className="text-[6.5px] px-1 py-0.2 bg-rose-500/25 border border-rose-500/40 text-rose-300 font-extrabold animate-pulse rounded uppercase tracking-tighter">
                              depleted
                            </span>
                          ) : hoveredTile.nutrients >= 70 ? (
                            <span className="text-[6.5px] px-1 py-0.2 bg-amber-500/15 border border-amber-500/20 text-amber-300 font-semibold rounded uppercase tracking-tighter font-extrabold">
                              rich loam
                            </span>
                          ) : null}
                          <span className="text-[9.5px] font-black font-mono text-white leading-none">
                            {Math.round(hoveredTile.nutrients)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${hoveredTile.nutrients}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            hoveredTile.nutrients <= 15 
                              ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                              : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                          }`} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Botanical Passive Trait & Yields */}
                  <div className="flex flex-col gap-1.5 font-sans justify-center h-full col-span-2 sm:col-span-1 border-t border-white/5 sm:border-t-0 pt-2 sm:pt-0">
                    {hoveredTile.type !== EcosystemType.None ? (
                      (() => {
                        const config = BUILDINGS[hoveredTile.type];
                        if (!config) return null;
                        const isMature = hoveredTile.growthStage >= 3;
                        return (
                          <div className="flex flex-col gap-1 bg-slate-900/50 p-2 sm:p-2.5 rounded-lg border border-white/5 min-h-[3.8rem] sm:min-h-[4.2rem] justify-center overflow-y-auto max-h-[5.5rem] no-scrollbar">
                            {/* Yields indicators */}
                            <div className="flex items-center gap-2 border-b border-white/5 pb-1 justify-between flex-wrap">
                              <span className="text-[7.2px] text-slate-450 font-black uppercase tracking-wider">Silviculture Passive</span>
                              <div className="flex gap-1.5">
                                <span className="text-[7.5px] font-black text-amber-300 font-mono flex items-center gap-0.5">
                                  ☀️{isMature ? `+${config.solarGen}` : '0'}
                                </span>
                                <span className="text-[7.5px] font-black text-emerald-300 font-mono flex items-center gap-0.5">
                                  🌿{isMature ? `+${config.healthGen}` : '0'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Detailed bullet facts list (as requested: "tree important points") */}
                            <div className="flex flex-col gap-1 mt-1 text-[7.5px] text-slate-300 leading-tight">
                              {getTreeKeyPoints(hoveredTile.type).map((pt, idx) => (
                                <div key={idx} className="flex items-start gap-1">
                                  <span className="text-emerald-400 font-extrabold select-none">•</span>
                                  <span>{pt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* Unoccupied Block Suggestion */
                      (() => {
                        const suggestion = getUnoccupiedTileSuggestion(hoveredTile);
                        return (
                          <div className={`flex flex-col gap-1 p-2 rounded-lg border min-h-[3.8rem] sm:min-h-[4.2rem] justify-center font-sans ${suggestion.color}`}>
                            <div className="flex items-center gap-1 border-b border-white/5 pb-1">
                              <Bot className="w-3 h-3 animate-pulse text-emerald-400" />
                              <span className="text-[7.3px] font-black uppercase tracking-wide text-slate-300">
                                Eco-AI Advice Recommendation
                              </span>
                            </div>
                            <div className="text-[7.8px] font-semibold leading-normal font-sans">
                              <strong className="block text-[8px] font-black text-white">{suggestion.title}</strong>
                              {suggestion.text}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-3 opacity-30 select-none">
                  <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span className="text-[8.5px] font-black uppercase text-white/50 tracking-[0.2em] font-mono">Hover map tiles to analyze loam</span>
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
