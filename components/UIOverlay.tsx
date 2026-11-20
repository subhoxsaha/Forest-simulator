/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Sun,
  Snowflake,
  Leaf,
  Flower2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Focus,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Zap,
  X,
  Sprout,
  Shovel,
  Trees,
  Eye,
  EyeOff,
  Feather,
  Compass,
} from 'lucide-react';
import {
  CityStats,
  EcosystemType,
  SeasonMode,
  SeasonType,
  CivilizationState,
  EraMode,
} from '../types';
import { BUILDINGS } from '../constants';
import { simClock } from '../simulation/clock';
import { ERA_METADATA } from '../simulation/civilization';
import { SPECIES_PROFILES, wildlifeTracker, WildlifeSpeciesId } from '../simulation/wildlifeTracker';
import { birdFlightState, BirdSpotPreset } from '../simulation/birdFlightState';
import { ecosystemAudio } from '../services/audio';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: EcosystemType;
  onSelectTool: (tool: EcosystemType) => void;
  plantingOpen: boolean;
  onTogglePlantingOpen: () => void;
  onGenerateNaturalForest: () => void;
  seasonMode: SeasonMode;
  onChangeSeasonMode: (mode: SeasonMode) => void;
  civilization: CivilizationState;
  onChangeEraMode: (mode: EraMode) => void;
  tickRateMs: number;
  onChangeTickRate: (rateMs: number) => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  wildlifeCamActive: boolean;
  trackedAnimalId: string | null;
  controlMode: boolean;
  onToggleWildlifeCam: () => void;
  onCycleAnimal: (dir: 1 | -1) => void;
  onTrackNearestAnimal: () => void;
  onToggleControlMode: () => void;
  birdMode: boolean;
  onToggleBirdMode: () => void;
  onFlyToSpot: (spot: Exclude<BirdSpotPreset, 'free'>) => void;
}

const PLANT_PALETTE: EcosystemType[] = [
  EcosystemType.Pine,
  EcosystemType.Oak,
  EcosystemType.Birch,
  EcosystemType.Maple,
  EcosystemType.Willow,
  EcosystemType.CherryBlossom,
  EcosystemType.Jacaranda,
  EcosystemType.Bamboo,
  EcosystemType.Redwood,
  EcosystemType.Baobab,
  EcosystemType.Banyan,
  EcosystemType.None,
];

const SEASON_OPTIONS: { id: SeasonMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
];

const ERA_OPTIONS: { id: EraMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 0, label: 'Paleolithic' },
  { id: 1, label: 'Neolithic' },
  { id: 2, label: 'Classical' },
  { id: 3, label: 'Eco-Sanctuary' },
];

function SeasonIcon({ season, className = 'h-3.5 w-3.5' }: { season: SeasonType; className?: string }) {
  switch (season) {
    case 'spring':
      return <Flower2 className={`${className} text-pink-300`} />;
    case 'summer':
      return <Sun className={`${className} text-amber-300`} />;
    case 'autumn':
      return <Leaf className={`${className} text-orange-400`} />;
    case 'winter':
      return <Snowflake className={`${className} text-sky-200`} />;
  }
}

/**
 * Isolated 4Hz clock & season readout so the 3D scene stays zero-rerender.
 */
const MinimalWorldChip: React.FC<{ day: number; eraLabel: string }> = React.memo(({ day, eraLabel }) => {
  const [snap, setSnap] = useState(() => ({
    time: simClock.getFormattedTime(),
    season: simClock.getSeasonWeights().dominant,
  }));

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextTime = simClock.getFormattedTime();
      const nextSeason = simClock.getSeasonWeights().dominant;
      setSnap((prev) =>
        prev.time.hour === nextTime.hour &&
        prev.time.minute === nextTime.minute &&
        prev.time.ampm === nextTime.ampm &&
        prev.season === nextSeason
          ? prev
          : { time: nextTime, season: nextSeason }
      );
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  const seasonLabel =
    snap.season === 'spring'
      ? 'Spring'
      : snap.season === 'summer'
      ? 'Summer'
      : snap.season === 'autumn'
      ? 'Autumn'
      : 'Winter';

  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-[#071512]/90 px-3 py-1.5 text-xs shadow-lg shadow-black/40">
      <span className="flex items-center gap-1.5 font-medium text-emerald-50">
        <SeasonIcon season={snap.season} className="h-3.5 w-3.5" />
        <span>{seasonLabel}</span>
      </span>
      <span className="h-3 w-px bg-emerald-500/25" />
      <span className="font-mono font-medium tabular-nums text-emerald-200/90">Day {day}</span>
      <span className="hidden sm:inline font-mono tabular-nums text-emerald-300/75">
        {snap.time.hour}:{snap.time.minute} {snap.time.ampm}
      </span>
      <span className="hidden md:block h-3 w-px bg-emerald-500/25" />
      <span className="hidden md:inline text-amber-200/90 font-medium">{eraLabel}</span>
    </div>
  );
});

/**
 * Isolated Wildlife Species Mini-Profile & Direct Control panel.
 */
const WildlifeProfileCard: React.FC<{
  trackedAnimalId: string | null;
  controlMode: boolean;
  onCycleAnimal: (dir: 1 | -1) => void;
  onTrackNearestAnimal: () => void;
  onToggleControlMode: () => void;
  onClose: () => void;
}> = React.memo(
  ({
    trackedAnimalId,
    controlMode,
    onCycleAnimal,
    onTrackNearestAnimal,
    onToggleControlMode,
    onClose,
  }) => {
    const [snapshot, setSnapshot] = useState<{
      speciesId: WildlifeSpeciesId;
      activity: string;
      index: number;
      total: number;
    } | null>(null);

    useEffect(() => {
      const sync = () => {
        const active = wildlifeTracker.getActiveAnimals();
        active.sort((a, b) => a.id.localeCompare(b.id));
        const animal = wildlifeTracker.getAnimal(trackedAnimalId);
        if (!animal) {
          setSnapshot(null);
          return;
        }
        const idx = active.findIndex((a) => a.id === animal.id);
        setSnapshot((prev) =>
          prev &&
          prev.speciesId === animal.speciesId &&
          prev.activity === animal.activity &&
          prev.index === idx &&
          prev.total === active.length
            ? prev
            : {
                speciesId: animal.speciesId,
                activity: animal.activity,
                index: idx >= 0 ? idx : 0,
                total: active.length,
              }
        );
      };

      sync();
      const id = window.setInterval(sync, 250);
      return () => window.clearInterval(id);
    }, [trackedAnimalId]);

    if (!snapshot) return null;
    const profile = SPECIES_PROFILES[snapshot.speciesId];

    const bindHold = (key: 'forward' | 'backward' | 'left' | 'right' | 'boost') => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        wildlifeTracker.input[key] = true;
      },
      onPointerUp: () => {
        wildlifeTracker.input[key] = false;
      },
      onPointerLeave: () => {
        wildlifeTracker.input[key] = false;
      },
      onPointerCancel: () => {
        wildlifeTracker.input[key] = false;
      },
    });

    return (
      <div className="pointer-events-auto fixed left-3 sm:left-4 top-14 z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-emerald-400/25 bg-[#071512]/94 p-3.5 shadow-2xl shadow-black/60 text-emerald-50">
        <div className="flex items-start justify-between gap-2 border-b border-emerald-500/15 pb-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className="mt-0.5 h-7 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: controlMode ? '#fbbf24' : profile.accentColor }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-sm font-semibold text-white">
                  {profile.name}
                </h3>
                <span className="font-mono text-[10px] tabular-nums text-emerald-300/70">
                  {snapshot.index + 1}/{snapshot.total}
                </span>
              </div>
              <p className="truncate text-[11px] italic text-emerald-200/70">
                {profile.scientificName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit Wildlife Camera"
            title="Exit Wildlife Camera (Esc)"
            className="rounded-lg p-1 text-emerald-300/70 hover:bg-emerald-900/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={`mt-2 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[11px] ${
            controlMode
              ? 'border-amber-400/35 bg-amber-950/50 text-amber-100'
              : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-100'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider opacity-70">
            {controlMode ? 'Control' : 'Now'}
          </span>
          <span className="truncate font-medium">
            {controlMode ? 'Direct Guidance' : snapshot.activity}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-lg border border-emerald-500/15 bg-[#0b1e1a] px-2 py-1">
            <div className="text-[9px] uppercase tracking-wider text-emerald-300/65">Habitat</div>
            <div className="truncate font-medium text-emerald-50">{profile.habitat}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/15 bg-[#0b1e1a] px-2 py-1">
            <div className="text-[9px] uppercase tracking-wider text-emerald-300/65">Diet</div>
            <div className="truncate font-medium text-emerald-50">{profile.diet}</div>
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/80">{profile.fact}</p>

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCycleAnimal(-1)}
            title="Previous Creature ([)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-[#0b1e1a] text-emerald-200 hover:border-emerald-400/50 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onTrackNearestAnimal}
            title="Focus Nearest Creature"
            className="flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-500/20 bg-[#0b1e1a] px-2 text-[11px] font-medium text-emerald-100 hover:border-emerald-400/50 hover:text-white"
          >
            <Crosshair className="h-3.5 w-3.5 text-emerald-300" />
            <span>Nearest</span>
          </button>

          <button
            type="button"
            onClick={() => onCycleAnimal(1)}
            title="Next Creature (])"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-[#0b1e1a] text-emerald-200 hover:border-emerald-400/50 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleControlMode}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              controlMode
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            <span>{controlMode ? 'Release' : 'Control'}</span>
          </button>
        </div>

        {controlMode && (
          <div className="mt-2.5 rounded-xl border border-amber-400/25 bg-[#121c17] p-2">
            <div className="flex items-center justify-between text-[10px] text-amber-200/85">
              <span>WASD / Arrows</span>
              <span>Shift: Sprint</span>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button
                  type="button"
                  aria-label="Move Forward"
                  {...bindHold('forward')}
                  className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-amber-400/30 bg-[#071512] text-amber-200 active:bg-amber-400 active:text-slate-950"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <div />
                <button
                  type="button"
                  aria-label="Move Left"
                  {...bindHold('left')}
                  className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-amber-400/30 bg-[#071512] text-amber-200 active:bg-amber-400 active:text-slate-950"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move Backward"
                  {...bindHold('backward')}
                  className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-amber-400/30 bg-[#071512] text-amber-200 active:bg-amber-400 active:text-slate-950"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move Right"
                  {...bindHold('right')}
                  className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-amber-400/30 bg-[#071512] text-amber-200 active:bg-amber-400 active:text-slate-950"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                {...bindHold('boost')}
                className="flex h-11 flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-400/30 bg-[#071512] px-2 text-[11px] font-medium text-amber-200 active:bg-amber-400 active:text-slate-950"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Sprint</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

/**
 * Ultra-minimal Bird Flight HUD (polls birdFlightState at 4Hz, zero 60fps re-renders).
 */
const BirdFlightHUD: React.FC<{
  onFlyToSpot: (spot: Exclude<BirdSpotPreset, 'free'>) => void;
  onExit: () => void;
}> = React.memo(({ onFlyToSpot, onExit }) => {
  const [snap, setSnap] = useState(() => ({
    spotLabel: birdFlightState.spotLabel,
    altitude: birdFlightState.altitude,
    autoSoar: birdFlightState.autoSoar,
    firstPerson: birdFlightState.firstPerson,
    activeSpot: birdFlightState.activeSpotPreset,
  }));

  useEffect(() => {
    const sync = () => {
      const nextAlt = Math.round(birdFlightState.altitude * 10) / 10;
      setSnap((prev) =>
        prev.spotLabel === birdFlightState.spotLabel &&
        prev.altitude === nextAlt &&
        prev.autoSoar === birdFlightState.autoSoar &&
        prev.firstPerson === birdFlightState.firstPerson &&
        prev.activeSpot === birdFlightState.activeSpotPreset
          ? prev
          : {
              spotLabel: birdFlightState.spotLabel,
              altitude: nextAlt,
              autoSoar: birdFlightState.autoSoar,
              firstPerson: birdFlightState.firstPerson,
              activeSpot: birdFlightState.activeSpotPreset,
            }
      );
    };
    sync();
    const id = window.setInterval(sync, 220);
    return () => window.clearInterval(id);
  }, []);

  const bindFlightHold = (key: 'left' | 'right' | 'climb' | 'descend' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      birdFlightState.input[key] = true;
    },
    onPointerUp: () => {
      birdFlightState.input[key] = false;
    },
    onPointerLeave: () => {
      birdFlightState.input[key] = false;
    },
    onPointerCancel: () => {
      birdFlightState.input[key] = false;
    },
  });

  const spots: { id: Exclude<BirdSpotPreset, 'free'>; label: string }[] = [
    { id: 'river', label: 'River' },
    { id: 'canopy', label: 'Canopy' },
    { id: 'village', label: 'Village' },
    { id: 'clouds', label: 'Clouds' },
  ];

  return (
    <div className="pointer-events-auto fixed bottom-3 sm:bottom-4 left-1/2 z-40 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-sky-400/25 bg-[#071512]/92 px-3 py-2.5 shadow-2xl shadow-black/60 text-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <Feather className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="truncate font-medium text-white">{snap.spotLabel}</span>
          <span className="font-mono text-[11px] tabular-nums text-sky-300/90">
            {snap.altitude.toFixed(1)}m
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              birdFlightState.autoSoar = !birdFlightState.autoSoar;
              if (birdFlightState.autoSoar) {
                birdFlightState.flyToTarget = null;
                birdFlightState.activeSpotPreset = 'free';
              }
              setSnap((prev) => ({ ...prev, autoSoar: birdFlightState.autoSoar }));
            }}
            className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition-colors ${
              snap.autoSoar
                ? 'border-sky-400/70 bg-sky-500/25 text-sky-100'
                : 'border-emerald-500/20 bg-[#0b1e1a] text-emerald-200 hover:text-white'
            }`}
          >
            <Compass className="h-3 w-3" />
            <span>Auto Soar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              birdFlightState.firstPerson = !birdFlightState.firstPerson;
              setSnap((prev) => ({ ...prev, firstPerson: birdFlightState.firstPerson }));
            }}
            title="Toggle 1st / 3rd Person View (V)"
            className="flex h-7 items-center rounded-lg border border-emerald-500/20 bg-[#0b1e1a] px-2 text-[11px] font-medium text-emerald-200 hover:text-white"
          >
            {snap.firstPerson ? '1st View' : '3rd View'}
          </button>

          <button
            type="button"
            onClick={onExit}
            title="Exit Bird Flight (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-[#0b1e1a] text-emerald-200 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Swoop Spots + Compact Flight Controls */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/15 pt-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-emerald-300/65 mr-0.5">
            Swoop
          </span>
          {spots.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onFlyToSpot(s.id)}
              className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                snap.activeSpot === s.id
                  ? 'border-amber-400/70 bg-amber-500/25 text-amber-100'
                  : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-200/80 hover:border-emerald-400/45 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Desktop compact key hint */}
        <div className="hidden md:flex items-center gap-2 text-[10px] text-emerald-200/70">
          <span>Drag sky to steer</span>
          <span>WASD / Space / Q</span>
          <span>Shift boost</span>
        </div>

        {/* Mobile/touch compact flight buttons */}
        <div className="flex md:hidden items-center gap-1">
          <button
            type="button"
            {...bindFlightHold('left')}
            className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-emerald-500/25 bg-[#0b1e1a] text-emerald-100 active:bg-emerald-500 active:text-slate-950"
            aria-label="Turn Left"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            {...bindFlightHold('right')}
            className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-emerald-500/25 bg-[#0b1e1a] text-emerald-100 active:bg-emerald-500 active:text-slate-950"
            aria-label="Turn Right"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            {...bindFlightHold('climb')}
            className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-emerald-500/25 bg-[#0b1e1a] text-emerald-100 active:bg-emerald-500 active:text-slate-950"
            aria-label="Climb"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            {...bindFlightHold('descend')}
            className="flex h-7 w-7 select-none items-center justify-center rounded-md border border-emerald-500/25 bg-[#0b1e1a] text-emerald-100 active:bg-emerald-500 active:text-slate-950"
            aria-label="Descend"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            {...bindFlightHold('boost')}
            className="flex h-7 px-2 select-none items-center justify-center rounded-md border border-amber-400/35 bg-[#0b1e1a] text-amber-200 active:bg-amber-400 active:text-slate-950"
            aria-label="Boost"
          >
            <Zap className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  plantingOpen,
  onTogglePlantingOpen,
  onGenerateNaturalForest,
  seasonMode,
  onChangeSeasonMode,
  civilization,
  onChangeEraMode,
  tickRateMs,
  onChangeTickRate,
  zenMode,
  onToggleZenMode,
  wildlifeCamActive,
  trackedAnimalId,
  controlMode,
  onToggleWildlifeCam,
  onCycleAnimal,
  onTrackNearestAnimal,
  onToggleControlMode,
  birdMode,
  onToggleBirdMode,
  onFlyToSpot,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => ecosystemAudio.getMuted());
  const [volume, setVolume] = useState(() => ecosystemAudio.getVolume());

  const isPaused = tickRateMs >= 99999999;
  const lastActiveSpeedRef = React.useRef(1500);
  if (!isPaused) lastActiveSpeedRef.current = tickRateMs;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOptionsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const eraMeta = ERA_METADATA[civilization.era];

  const handleTogglePause = () => {
    onChangeTickRate(isPaused ? lastActiveSpeedRef.current || 1500 : 99999999);
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

  if (zenMode) {
    return (
      <div className="pointer-events-none fixed inset-0 z-30 flex items-start justify-end p-3 sm:p-4">
        <button
          type="button"
          onClick={onToggleZenMode}
          title="Show UI (H)"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/25 bg-[#071512]/85 text-emerald-200 shadow-lg hover:border-emerald-400/50 hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-4">
      {/* MINIMAL TOP BAR */}
      <div className="flex items-center justify-between gap-2">
        <MinimalWorldChip day={stats.day} eraLabel={eraMeta.shortName} />

        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Fly as Bird (Perspective 3D Flight Camera) */}
          <button
            type="button"
            onClick={onToggleBirdMode}
            title="Become a Bird & Fly Around the Sanctuary (B)"
            className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium shadow-lg transition-colors ${
              birdMode
                ? 'border-sky-400/75 bg-sky-900/85 text-sky-100'
                : 'border-emerald-400/20 bg-[#071512]/90 text-emerald-100 hover:border-sky-400/50'
            }`}
          >
            <Feather className={`h-3.5 w-3.5 ${birdMode ? 'text-amber-300' : 'text-sky-300'}`} />
            <span className="hidden sm:inline">{birdMode ? 'Flying' : 'Fly as Bird'}</span>
          </button>

          {/* Wildlife Camera */}
          <button
            type="button"
            onClick={onToggleWildlifeCam}
            title="Wildlife Camera: Track & Control Creature (C)"
            className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium shadow-lg transition-colors ${
              wildlifeCamActive
                ? controlMode
                  ? 'border-amber-400/70 bg-amber-950/90 text-amber-100'
                  : 'border-emerald-400/70 bg-emerald-800/85 text-white'
                : 'border-emerald-400/20 bg-[#071512]/90 text-emerald-100 hover:border-emerald-400/50'
            }`}
          >
            <Focus
              className={`h-3.5 w-3.5 ${
                wildlifeCamActive && controlMode ? 'text-amber-300' : 'text-emerald-300'
              }`}
            />
            <span className="hidden sm:inline">
              {wildlifeCamActive ? (controlMode ? 'Controlling' : 'Wildlife') : 'Wildlife Cam'}
            </span>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={handleTogglePause}
            title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-lg transition-colors ${
              isPaused
                ? 'border-amber-400/50 bg-amber-950/90 text-amber-200'
                : 'border-emerald-400/20 bg-[#071512]/90 text-emerald-100 hover:border-emerald-400/50'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>

          {/* Audio Mute */}
          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Ambience' : 'Mute Ambience'}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/20 bg-[#071512]/90 text-emerald-100 shadow-lg transition-colors hover:border-emerald-400/50"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5 text-slate-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-300" />}
          </button>

          {/* Compact Options Popover Toggle */}
          <button
            type="button"
            onClick={() => setOptionsOpen((prev) => !prev)}
            title="World Controls"
            className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-lg transition-colors ${
              optionsOpen
                ? 'border-emerald-400/60 bg-emerald-900/80 text-white'
                : 'border-emerald-400/20 bg-[#071512]/90 text-emerald-100 hover:border-emerald-400/50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* WILDLIFE MINI-PROFILE (only when Wildlife Cam is active) */}
      {wildlifeCamActive && (
        <WildlifeProfileCard
          trackedAnimalId={trackedAnimalId}
          controlMode={controlMode}
          onCycleAnimal={onCycleAnimal}
          onTrackNearestAnimal={onTrackNearestAnimal}
          onToggleControlMode={onToggleControlMode}
          onClose={onToggleWildlifeCam}
        />
      )}

      {/* COMPACT OPTIONS POPOVER (hidden by default) */}
      {optionsOpen && (
        <div className="pointer-events-auto fixed right-3 sm:right-4 top-14 z-40 w-[min(18.5rem,calc(100vw-1.5rem))] rounded-2xl border border-emerald-400/25 bg-[#071512]/96 p-3.5 shadow-2xl shadow-black/60 text-emerald-50 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
            <span className="font-display text-xs font-semibold text-white">World Controls</span>
            <button
              type="button"
              onClick={() => setOptionsOpen(false)}
              className="rounded-lg p-1 text-emerald-300/70 hover:text-white"
              aria-label="Close options"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Season */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/75">
              Season
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {SEASON_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeSeasonMode(opt.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                    seasonMode === opt.id
                      ? 'border-emerald-400/60 bg-emerald-600/30 text-white'
                      : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-200/75 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Human Era */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
              Human Era
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {ERA_OPTIONS.map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => onChangeEraMode(opt.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                    civilization.eraMode === opt.id
                      ? 'border-amber-400/65 bg-amber-500/25 text-amber-100'
                      : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-200/75 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed & Volume */}
          <div className="space-y-2 border-t border-emerald-500/15 pt-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-200/85">Time Speed</span>
              <span className="font-mono text-[10px] tabular-nums text-emerald-300">
                {isPaused ? 'Paused' : `${(tickRateMs / 1000).toFixed(1)}s/day`}
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

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-emerald-200/85">Ambience</span>
              <span className="font-mono text-[10px] tabular-nums text-emerald-300">
                {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
              </span>
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

          {/* Quick Actions */}
          <div className="flex gap-1.5 border-t border-emerald-500/15 pt-2.5">
            <button
              type="button"
              onClick={() => {
                onGenerateNaturalForest();
                setOptionsOpen(false);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              <Trees className="h-3.5 w-3.5" />
              <span>New Forest</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOptionsOpen(false);
                onToggleZenMode();
              }}
              title="Hide UI (H)"
              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/20 bg-[#0b1e1a] px-2.5 py-1.5 text-xs text-emerald-200 hover:text-white"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Hide</span>
            </button>
          </div>
        </div>
      )}

      {/* BIRD FLIGHT MINIMAL HUD (only when flying as bird) */}
      {birdMode && <BirdFlightHUD onFlyToSpot={onFlyToSpot} onExit={onToggleBirdMode} />}

      {/* OPTIONAL COLLAPSED PLANTING PALETTE (hidden during Bird Flight) */}
      {!birdMode && (
        <div className="flex items-end justify-end">
          {!plantingOpen ? (
            <button
              type="button"
              onClick={onTogglePlantingOpen}
              title="Plant or Prune Trees"
              className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-[#071512]/90 px-3 text-xs font-medium text-emerald-100 shadow-lg transition-colors hover:border-emerald-400/50 hover:text-white"
            >
              <Sprout className="h-3.5 w-3.5 text-emerald-300" />
              <span>Plant</span>
            </button>
          ) : (
            <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-2xl border border-emerald-400/25 bg-[#071512]/94 p-2 shadow-2xl shadow-black/60">
              <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
                {PLANT_PALETTE.map((type) => {
                  const cfg = BUILDINGS[type];
                  const isSelected = selectedTool === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onSelectTool(type)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-900/70 text-white'
                          : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-100/85 hover:border-emerald-400/40 hover:text-white'
                      }`}
                    >
                      {type === EcosystemType.None ? (
                        <Shovel className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                      )}
                      <span>{type === EcosystemType.None ? 'Clear' : cfg.name}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onTogglePlantingOpen}
                aria-label="Close planting bar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-[#0b1e1a] text-emerald-200 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
