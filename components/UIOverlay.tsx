/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  CloudRain,
  Wind,
  Sparkles,
  Trees,
  Sprout,
  Droplets,
  Layers,
  Shovel,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  ScrollText,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Camera,
  X,
  Check,
  Compass,
  Bird,
  Flame,
} from 'lucide-react';
import {
  CityStats,
  EcosystemType,
  AIGoal,
  NewsItem,
  Grid,
  CameraPreset,
} from '../types';
import { BUILDINGS } from '../constants';
import { simClock } from '../simulation/clock';
import { computeGoalProgress } from '../simulation/engine';
import { getSeasonForDay, RIVER_MASK } from '../utils/webgl';
import { ecosystemAudio } from '../services/audio';

interface UIOverlayProps {
  stats: CityStats;
  grid: Grid;
  selectedTool: EcosystemType;
  onSelectTool: (tool: EcosystemType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  onToggleAi: (enabled: boolean) => void;
  wildSeedingEnabled: boolean;
  onToggleWildSeeding: (enabled: boolean) => void;
  onGenerateNaturalForest: () => void;
  tickRateMs: number;
  onChangeTickRate: (rateMs: number) => void;
  showFertilityHeatmap: boolean;
  onToggleFertilityHeatmap: () => void;
  hoveredCoords: { x: number; y: number } | null;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onResetGame: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
}

type ToolCategory = 'tools' | 'woodland' | 'exotic';

const CATEGORY_ITEMS: Record<ToolCategory, EcosystemType[]> = {
  tools: [EcosystemType.WateringCan, EcosystemType.NutrientMulch, EcosystemType.None],
  woodland: [
    EcosystemType.Pine,
    EcosystemType.Oak,
    EcosystemType.Birch,
    EcosystemType.Maple,
    EcosystemType.Alder,
    EcosystemType.Willow,
    EcosystemType.Cypress,
    EcosystemType.Redwood,
  ],
  exotic: [
    EcosystemType.CherryBlossom,
    EcosystemType.Jacaranda,
    EcosystemType.Bamboo,
    EcosystemType.Acacia,
    EcosystemType.Baobab,
    EcosystemType.Bonsai,
    EcosystemType.Peepal,
    EcosystemType.Neem,
    EcosystemType.Banyan,
  ],
};

const STAGE_LABELS = ['Soil', 'Sprout', 'Sapling', 'Mature', 'Ancient'];

/**
 * Isolated HUD clock reading directly from simClock at ~4Hz.
 * Prevents App and IsoMap from ever re-rendering for clock ticks.
 */
const ChronologyClock: React.FC<{ day: number }> = React.memo(({ day }) => {
  const [timeObj, setTimeObj] = useState(() => simClock.getFormattedTime());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = simClock.getFormattedTime();
      setTimeObj((prev) =>
        prev.hour === next.hour && prev.minute === next.minute && prev.ampm === next.ampm ? prev : next
      );
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  const season = getSeasonForDay(day);
  const seasonLabel =
    season === 'spring'
      ? 'Spring'
      : season === 'summer'
      ? 'Summer'
      : season === 'autumn'
      ? 'Autumn'
      : 'Winter';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono font-semibold tabular-nums text-emerald-100">
        Day {day}
      </span>
      <span className="text-emerald-400/50">/</span>
      <span className="text-emerald-200/80">{seasonLabel}</span>
      <span className="hidden sm:inline font-mono tabular-nums text-emerald-300/80">
        {timeObj.hour}:{timeObj.minute} {timeObj.ampm}
      </span>
    </div>
  );
});

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  grid,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  onToggleAi,
  wildSeedingEnabled,
  onToggleWildSeeding,
  onGenerateNaturalForest,
  tickRateMs,
  onChangeTickRate,
  showFertilityHeatmap,
  onToggleFertilityHeatmap,
  hoveredCoords,
  cameraPreset,
  onSelectCameraPreset,
  onResetGame,
  zenMode,
  onToggleZenMode,
}) => {
  const [dockExpanded, setDockExpanded] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('woodland');
  const [openDrawer, setOpenDrawer] = useState<'none' | 'quests' | 'settings'>('none');
  const [confirmReset, setConfirmReset] = useState(false);
  const [isMuted, setIsMuted] = useState(() => ecosystemAudio.getMuted());
  const [volume, setVolume] = useState(() => ecosystemAudio.getVolume());

  const isPaused = tickRateMs >= 99999999;
  const lastActiveSpeedRef = React.useRef(1500);
  if (!isPaused) lastActiveSpeedRef.current = tickRateMs;

  // Close open drawers on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDrawer('none');
        setConfirmReset(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Compute live wildlife presence matching WildlifeSystem counts
  const wildlifeCount = useMemo(() => {
    const landCritters = Math.min(Math.max(8, 7 + Math.floor(stats.population / 32)), 24);
    const riverFauna = 9; // 6 Koi + 3 Mallard Ducks
    const insects = stats.weather === 'Raining' ? 0 : 13; // 9 Butterflies + 4 Dragonflies
    const raptors = stats.population >= 120 ? 2 : 1;
    return landCritters + riverFauna + insects + raptors;
  }, [stats.population, stats.weather]);

  const goalProgress = useMemo(
    () => computeGoalProgress(currentGoal, stats, grid),
    [currentGoal, stats, grid]
  );

  const selectedConfig = BUILDINGS[selectedTool];

  const hoveredTile = hoveredCoords ? grid[hoveredCoords.y]?.[hoveredCoords.x] ?? null : null;
  const hoveredIsRiver = hoveredCoords ? RIVER_MASK[hoveredCoords.y]?.[hoveredCoords.x] ?? false : false;

  const handleTogglePause = () => {
    if (isPaused) {
      onChangeTickRate(lastActiveSpeedRef.current || 1500);
    } else {
      onChangeTickRate(99999999);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    ecosystemAudio.setMute(next);
    setIsMuted(next);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    ecosystemAudio.setVolume(val);
    if (val > 0 && isMuted) {
      ecosystemAudio.setMute(false);
      setIsMuted(false);
    }
  };

  const renderWeatherIcon = () => {
    switch (stats.weather) {
      case 'Raining':
        return <CloudRain className="h-3.5 w-3.5 text-sky-400" />;
      case 'Windy':
        return <Wind className="h-3.5 w-3.5 text-teal-300" />;
      case 'Autumn_Dew':
        return <Sparkles className="h-3.5 w-3.5 text-amber-300" />;
      default:
        return <Sun className="h-3.5 w-3.5 text-amber-300" />;
    }
  };

  const weatherLabel =
    stats.weather === 'Autumn_Dew' ? 'Golden Dew' : stats.weather;

  if (zenMode) {
    return (
      <div className="pointer-events-none fixed inset-0 z-30 flex items-start justify-end p-4">
        <button
          type="button"
          onClick={onToggleZenMode}
          title="Show Interface (H)"
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-[#071512]/92 px-3.5 py-2 text-xs font-medium text-emerald-100 shadow-lg hover:border-emerald-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Eye className="h-3.5 w-3.5 text-emerald-300" />
          <span>Show HUD</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP HUD BAR */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        {/* Left: Primary Ecological Telemetry */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl border border-emerald-400/20 bg-[#071512]/94 px-3.5 py-2 shadow-xl shadow-black/40">
          <div className="flex items-center gap-1.5 pr-1 border-r border-emerald-500/20">
            <Trees className="h-4 w-4 text-emerald-400" />
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              EverGreen
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Solar Energy">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-mono text-xs font-semibold tabular-nums text-amber-200">
              {stats.money.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Forest Biomass">
            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-xs font-semibold tabular-nums text-emerald-200">
              {stats.population.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Living Sanctuary Creatures">
            <Bird className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-mono text-xs font-semibold tabular-nums text-sky-200">
              {wildlifeCount}
            </span>
          </div>

          <div className="hidden md:block h-3.5 w-px bg-emerald-500/20" />

          <div className="flex items-center gap-1.5" title={`Weather: ${weatherLabel}`}>
            {renderWeatherIcon()}
            <span className="text-xs text-emerald-100/90">{weatherLabel}</span>
          </div>

          <div className="hidden lg:block h-3.5 w-px bg-emerald-500/20" />

          <div className="hidden sm:block">
            <ChronologyClock day={stats.day} />
          </div>
        </div>

        {/* Right: World Controls & Popover Triggers */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={handleTogglePause}
            title={isPaused ? 'Resume Simulation (Space)' : 'Pause Simulation (Space)'}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              isPaused
                ? 'border-amber-400/50 bg-amber-950/90 text-amber-200'
                : 'border-emerald-400/20 bg-[#071512]/94 text-emerald-100 hover:border-emerald-400/45'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isPaused ? 'Paused' : 'Live'}</span>
          </button>

          {/* Camera Presets */}
          <div className="hidden md:flex items-center rounded-xl border border-emerald-400/20 bg-[#071512]/94 p-1 shadow-lg">
            <Camera className="mx-1.5 h-3.5 w-3.5 text-emerald-300/70" />
            {(['iso', 'scenic', 'top'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onSelectCameraPreset(preset)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  cameraPreset === preset
                    ? 'bg-emerald-500/25 text-emerald-200'
                    : 'text-emerald-200/70 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* One-click Natural Forest Generator */}
          <button
            type="button"
            onClick={onGenerateNaturalForest}
            title="Generate a fresh random forest arranged naturally by biome"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-[#0b231d]/95 px-3 text-xs font-medium text-emerald-100 shadow-lg transition-colors hover:border-emerald-400/60 hover:bg-emerald-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Trees className="h-3.5 w-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Natural Forest</span>
          </button>

          {/* Soil Fertility Heatmap */}
          <button
            type="button"
            onClick={onToggleFertilityHeatmap}
            title="Toggle Soil Fertility Heatmap (F)"
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              showFertilityHeatmap
                ? 'border-emerald-400/60 bg-emerald-800/80 text-white'
                : 'border-emerald-400/20 bg-[#071512]/94 text-emerald-100 hover:border-emerald-400/45'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-emerald-300" />
            <span className="hidden lg:inline">Fertility</span>
          </button>

          {/* Quests & Field Log */}
          <button
            type="button"
            onClick={() => setOpenDrawer((prev) => (prev === 'quests' ? 'none' : 'quests'))}
            title="Quests & Ecological Log"
            className={`relative flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              openDrawer === 'quests'
                ? 'border-emerald-400/60 bg-emerald-900/80 text-white'
                : 'border-emerald-400/20 bg-[#071512]/94 text-emerald-100 hover:border-emerald-400/45'
            }`}
          >
            <ScrollText className="h-3.5 w-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Journal</span>
            {currentGoal?.completed && (
              <span className="ml-0.5 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-slate-950">
                Claim
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              setOpenDrawer((prev) => (prev === 'settings' ? 'none' : 'settings'));
              setConfirmReset(false);
            }}
            title="Simulation Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              openDrawer === 'settings'
                ? 'border-emerald-400/60 bg-emerald-900/80 text-white'
                : 'border-emerald-400/20 bg-[#071512]/94 text-emerald-100 hover:border-emerald-400/45'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Zen Mode */}
          <button
            type="button"
            onClick={onToggleZenMode}
            title="Hide Interface (H)"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-[#071512]/94 text-emerald-100 shadow-lg transition-colors hover:border-emerald-400/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* RIGHT-ALIGNED POPOVER DRAWERS (Only shown on demand, never permanently blocking the 3D scene) */}
      {openDrawer !== 'none' && (
        <div className="pointer-events-auto fixed right-3 sm:right-4 top-16 z-40 w-[min(22rem,calc(100vw-1.5rem))] max-h-[calc(100vh-11rem)] overflow-y-auto custom-scrollbar rounded-2xl border border-emerald-400/25 bg-[#071512]/96 p-4 shadow-2xl shadow-black/60 text-emerald-50">
          {openDrawer === 'quests' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2.5">
                <h2 className="font-display text-sm font-semibold text-white">
                  Sanctuary Journal
                </h2>
                <button
                  type="button"
                  onClick={() => setOpenDrawer('none')}
                  className="rounded-lg p-1 text-emerald-300/70 hover:bg-emerald-900/50 hover:text-white"
                  aria-label="Close journal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Active Ecosystem Quest */}
              {aiEnabled && (
                <div className="rounded-xl border border-emerald-500/20 bg-[#0b1e1a] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                      Current Milestone
                    </span>
                    {currentGoal && (
                      <span className="font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
                        +{currentGoal.reward} Solar
                      </span>
                    )}
                  </div>

                  {isGeneratingGoal ? (
                    <p className="mt-2 text-xs text-emerald-200/75">
                      Evaluating woodland ecology...
                    </p>
                  ) : currentGoal ? (
                    <>
                      <p className="mt-1.5 text-xs leading-relaxed text-emerald-50">
                        {currentGoal.description}
                      </p>

                      {goalProgress && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[11px] text-emerald-200/80">
                            <span>{goalProgress.label}</span>
                            <span className="font-mono tabular-nums">
                              {goalProgress.current} / {goalProgress.target} ({goalProgress.percent}%)
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-emerald-950">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                currentGoal.completed ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${goalProgress.percent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {currentGoal.completed && (
                        <button
                          type="button"
                          onClick={onClaimReward}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Claim {currentGoal.reward} Solar Energy</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-200/70">
                      Plant or generate trees to unlock your next botanical goal.
                    </p>
                  )}
                </div>
              )}

              {/* Ecological Field Log */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                  Recent Events
                </h3>
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {newsFeed.length === 0 ? (
                    <p className="text-xs text-emerald-200/60">
                      The valley is quiet. Plant seeds or generate a natural forest to begin.
                    </p>
                  ) : (
                    [...newsFeed].reverse().map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-emerald-500/15 bg-[#0b1e1a]/80 px-2.5 py-2 text-xs leading-snug"
                      >
                        <span
                          className={
                            item.type === 'positive'
                              ? 'text-emerald-200'
                              : item.type === 'negative'
                              ? 'text-rose-300'
                              : 'text-slate-200'
                          }
                        >
                          {item.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* SETTINGS DRAWER */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2.5">
                <h2 className="font-display text-sm font-semibold text-white">
                  Sanctuary Settings
                </h2>
                <button
                  type="button"
                  onClick={() => setOpenDrawer('none')}
                  className="rounded-lg p-1 text-emerald-300/70 hover:bg-emerald-900/50 hover:text-white"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nature Generation & Wild Seeding */}
              <div className="space-y-2.5 rounded-xl border border-emerald-500/20 bg-[#0b1e1a] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                  Natural Ecosystem
                </div>
                <button
                  type="button"
                  onClick={onGenerateNaturalForest}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  <Trees className="h-3.5 w-3.5" />
                  <span>Generate Natural Forest</span>
                </button>
                <p className="text-[11px] leading-snug text-emerald-200/70">
                  Randomly populates the island by natural biome niches: riparian willows &amp; cypress by the river, pines &amp; acacias on dry ridges, oaks &amp; blossoms in rich loam.
                </p>

                <button
                  type="button"
                  onClick={() => onToggleWildSeeding(!wildSeedingEnabled)}
                  role="switch"
                  aria-checked={wildSeedingEnabled}
                  className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-500/15 bg-[#071512] px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5 text-emerald-300" />
                    <div>
                      <div className="text-xs font-medium text-emerald-50">Wild Nature Seeding</div>
                      <div className="text-[10px] text-emerald-200/65">
                        Mature trees spread seeds organically
                      </div>
                    </div>
                  </div>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      wildSeedingEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        wildSeedingEnabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </div>

              {/* Time Speed */}
              <div className="space-y-2 rounded-xl border border-emerald-500/15 bg-[#0b1e1a] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-emerald-100">Day Cycle Speed</span>
                  <span className="font-mono text-[11px] tabular-nums text-emerald-300">
                    {isPaused ? 'Paused' : `${(tickRateMs / 1000).toFixed(1)}s / day`}
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={250}
                  value={isPaused ? lastActiveSpeedRef.current : tickRateMs}
                  onChange={(e) => onChangeTickRate(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] text-emerald-300/60">
                  <span>Fast (0.5s)</span>
                  <span>Normal (1.5s)</span>
                  <span>Relaxed (5.0s)</span>
                </div>
              </div>

              {/* Sound */}
              <div className="space-y-2 rounded-xl border border-emerald-500/15 bg-[#0b1e1a] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-100">Ambient Forest Audio</span>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-[#071512] px-2 py-1 text-[11px] text-emerald-200 hover:text-white"
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    <span>{isMuted ? 'Muted' : 'On'}</span>
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              {/* Quests & Fertility Overlay */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onToggleAi(!aiEnabled)}
                  role="switch"
                  aria-checked={aiEnabled}
                  className="flex w-full items-center justify-between rounded-xl border border-emerald-500/15 bg-[#0b1e1a] px-3 py-2 text-xs text-emerald-100"
                >
                  <span>Ecosystem Quests</span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      aiEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        aiEnabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>

                {showFertilityHeatmap && (
                  <div className="rounded-xl border border-emerald-500/15 bg-[#0b1e1a] p-3">
                    <div className="text-[11px] font-medium text-emerald-200">Soil Fertility Spectrum</div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" />
                    <div className="mt-1 flex justify-between text-[10px] text-emerald-300/70">
                      <span>Depleted</span>
                      <span>Balanced</span>
                      <span>Rich Loam</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Sanctuary */}
              <div className="border-t border-emerald-500/15 pt-3">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-950/70"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Sanctuary</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        setOpenDrawer('none');
                        onResetGame();
                      }}
                      className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-xl border border-emerald-500/20 bg-[#0b1e1a] px-3 py-2 text-xs text-emerald-200 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK */}
      <div className="flex flex-col items-center gap-1.5">
        {/* Collapse / Expand Handle + Live Hovered Tile Inspector */}
        <div className="pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-2 px-1">
          {/* Compact Hovered Tile Bio-Vitals */}
          <div className="flex min-h-[2rem] items-center gap-3 rounded-xl border border-emerald-400/20 bg-[#071512]/94 px-3 py-1 text-[11px] shadow-lg">
            {hoveredTile ? (
              hoveredIsRiver ? (
                <div className="flex items-center gap-2 text-sky-200">
                  <Droplets className="h-3.5 w-3.5 text-sky-400" />
                  <span className="font-medium">Flowing River Stream</span>
                  <span className="text-sky-300/70">Hydrates adjacent banks</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-emerald-100">
                  <span className="font-semibold text-white">
                    {hoveredTile.type === EcosystemType.None
                      ? 'Open Loam'
                      : `${BUILDINGS[hoveredTile.type]?.name || hoveredTile.type} (${STAGE_LABELS[hoveredTile.growthStage] || 'Soil'})`}
                  </span>
                  <span className="font-mono tabular-nums text-sky-300">
                    H₂O {Math.round(hoveredTile.moisture)}%
                  </span>
                  <span className="font-mono tabular-nums text-amber-300">
                    Soil {Math.round(hoveredTile.nutrients)}%
                  </span>
                  {hoveredTile.type !== EcosystemType.None && hoveredTile.growthStage < 4 && (
                    <span className="font-mono tabular-nums text-emerald-300">
                      Growth {Math.round(hoveredTile.growthProgress)}%
                    </span>
                  )}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-emerald-200/80">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: selectedConfig?.color || '#34d399' }}
                />
                <span className="font-medium text-emerald-50">{selectedConfig?.name}</span>
                <span className="hidden sm:inline text-emerald-200/70">
                  — {selectedConfig?.description}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDockExpanded((prev) => !prev)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-[#071512]/94 px-3 py-1.5 text-[11px] font-medium text-emerald-100 shadow-lg hover:border-emerald-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {dockExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-emerald-300" />
                <span>Hide Dock</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-emerald-300" />
                <span>Plant &amp; Tools</span>
              </>
            )}
          </button>
        </div>

        {/* Expandable Species & Tools Palette */}
        {dockExpanded && (
          <div className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-emerald-400/20 bg-[#071512]/95 p-2.5 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'tools', label: 'Care Tools' },
                    { id: 'woodland', label: 'Woodland' },
                    { id: 'exotic', label: 'Exotic Flora' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      activeCategory === tab.id
                        ? 'bg-emerald-500/25 text-emerald-100'
                        : 'text-emerald-200/70 hover:bg-emerald-950 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="hidden md:flex items-center gap-3 text-[11px] text-emerald-300/70">
                <span>Drag to orbit</span>
                <span>Scroll to zoom</span>
                <span>Click soil to act</span>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {CATEGORY_ITEMS[activeCategory].map((type) => {
                const cfg = BUILDINGS[type];
                const isSelected = selectedTool === type;
                const canAfford = stats.money >= cfg.cost;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onSelectTool(type)}
                    className={`group flex min-w-[7.25rem] shrink-0 flex-col justify-between rounded-xl border px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-900/60 text-white shadow-md'
                        : canAfford
                        ? 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-100 hover:border-emerald-400/40'
                        : 'border-slate-700/40 bg-[#0b1715]/70 text-slate-400 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black/30">
                        {type === EcosystemType.WateringCan ? (
                          <Droplets className="h-3.5 w-3.5 text-sky-400" />
                        ) : type === EcosystemType.NutrientMulch ? (
                          <Layers className="h-3.5 w-3.5 text-amber-400" />
                        ) : type === EcosystemType.None ? (
                          <Shovel className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cfg.color }}
                          />
                        )}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-semibold tabular-nums ${
                          canAfford ? 'text-amber-300' : 'text-rose-400'
                        }`}
                      >
                        {cfg.cost}
                      </span>
                    </div>

                    <div className="mt-1.5 truncate text-xs font-semibold">
                      {cfg.name}
                    </div>

                    {cfg.solarGen > 0 || cfg.healthGen > 0 ? (
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] tabular-nums text-emerald-300/80">
                        <span>+{cfg.solarGen} sun</span>
                        <span>+{cfg.healthGen} bio</span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[10px] text-emerald-300/70">
                        {type === EcosystemType.WateringCan
                          ? '+40% moisture'
                          : type === EcosystemType.NutrientMulch
                          ? '+45% nutrients'
                          : 'Clear tile'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UIOverlay;
