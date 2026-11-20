/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  EcosystemType,
  CityStats,
  CameraPreset,
  SeasonMode,
  CivilizationState,
  EraMode,
} from './types';
import { GRID_SIZE, INITIAL_MONEY } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import { ecosystemAudio } from './services/audio';
import { simClock } from './simulation/clock';
import { generateNaturalForestGrid, stepEcosystemTick } from './simulation/engine';
import {
  createInitialCivilization,
  isTileReservedBySettlement,
  setCivilizationEraOverride,
  stepCivilizationTick,
} from './simulation/civilization';
import { gridToWorld, RIVER_MASK } from './utils/webgl';
import { wildlifeTracker } from './simulation/wildlifeTracker';
import { birdFlightState, BirdSpotPreset } from './simulation/birdFlightState';
import { getBirdSpotCoordinates } from './components/scene/BirdFlight';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function clearSettlementFootprints(grid: Grid, civ: CivilizationState): Grid {
  const clearedSet = new Set(
    civ.settlements.filter((s) => s.kind !== 'bridge').map((s) => `${s.x},${s.y}`)
  );
  if (clearedSet.size === 0) return grid;
  return grid.map((row, y) =>
    row.map((cell, x) =>
      clearedSet.has(`${x},${y}`) && cell.type !== EcosystemType.None
        ? { ...cell, type: EcosystemType.None, growthStage: 0, growthProgress: 0 }
        : cell
    )
  );
}

function createBootState(): {
  grid: Grid;
  civilization: CivilizationState;
  stats: CityStats;
} {
  const savedGrid = readStorage<Grid | null>('eg_grid', null);
  const savedStats = readStorage<CityStats | null>('eg_stats', null);
  const savedCiv = readStorage<CivilizationState | null>('eg_civilization', null);

  const hasValidGrid =
    Array.isArray(savedGrid) &&
    savedGrid.length === GRID_SIZE &&
    Array.isArray(savedGrid[0]) &&
    savedGrid[0].length === GRID_SIZE;

  // Ensure the island always boots into a lush living forest rather than a blank empty meadow
  let treeCount = 0;
  if (hasValidGrid) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (savedGrid[y][x].type !== EcosystemType.None) treeCount++;
      }
    }
  }

  if (hasValidGrid && treeCount >= 12 && savedStats) {
    const civ =
      savedCiv && typeof savedCiv.era === 'number' && Array.isArray(savedCiv.settlements)
        ? { ...savedCiv, enabled: true }
        : createInitialCivilization(savedGrid, true, 0);
    return {
      grid: clearSettlementFootprints(savedGrid, civ),
      civilization: civ,
      stats: savedStats,
    };
  }

  const generated = generateNaturalForestGrid(Math.random() * 1000);
  const freshCiv = createInitialCivilization(generated.grid, true, 0);
  return {
    grid: clearSettlementFootprints(generated.grid, freshCiv),
    civilization: freshCiv,
    stats: {
      money: INITIAL_MONEY,
      population: generated.initialBiomass,
      day: 1,
      weather: 'Sunny',
    },
  };
}

function App() {
  const bootRef = useRef<ReturnType<typeof createBootState> | null>(null);
  if (!bootRef.current) {
    bootRef.current = createBootState();
  }

  // --- Fully Autonomous Ecosystem State (starts live immediately) ---
  const [seasonMode, setSeasonMode] = useState<SeasonMode>(() =>
    readStorage('eg_seasonMode', 'auto')
  );
  const [tickRateMs, setTickRateMs] = useState<number>(() => {
    const saved = readStorage('eg_tickRateMs', 1500);
    return saved >= 99999999 ? 1500 : saved;
  });
  const [grid, setGrid] = useState<Grid>(() => bootRef.current!.grid);
  const [civilization, setCivilization] = useState<CivilizationState>(
    () => bootRef.current!.civilization
  );
  const [stats, setStats] = useState<CityStats>(() => bootRef.current!.stats);

  // --- Minimal UI Interaction State ---
  const [plantingOpen, setPlantingOpen] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<EcosystemType>(EcosystemType.Pine);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [cameraPresetNonce, setCameraPresetNonce] = useState<number>(0);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [wildlifeCamActive, setWildlifeCamActive] = useState<boolean>(false);
  const [trackedAnimalId, setTrackedAnimalId] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<boolean>(false);
  const [birdMode, setBirdMode] = useState<boolean>(false);

  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const civRef = useRef(civilization);
  const plantingOpenRef = useRef(plantingOpen);
  const wildlifeCamActiveRef = useRef(wildlifeCamActive);
  const trackedAnimalIdRef = useRef(trackedAnimalId);
  const controlModeRef = useRef(controlMode);
  const birdModeRef = useRef(birdMode);
  const lastActiveTickRateRef = useRef(tickRateMs < 99999999 ? tickRateMs : 1500);

  gridRef.current = grid;
  statsRef.current = stats;
  civRef.current = civilization;
  plantingOpenRef.current = plantingOpen;
  wildlifeCamActiveRef.current = wildlifeCamActive;
  trackedAnimalIdRef.current = trackedAnimalId;
  controlModeRef.current = controlMode;
  birdModeRef.current = birdMode;
  if (tickRateMs < 99999999) {
    lastActiveTickRateRef.current = tickRateMs;
  }

  // Start zero-rerender 60fps simulation clock immediately on mount
  useEffect(() => {
    simClock.setGameStarted(true);
    simClock.resetDayStart();
  }, []);

  useEffect(() => {
    simClock.setTickRate(tickRateMs);
  }, [tickRateMs]);

  useEffect(() => {
    simClock.setSeasonMode(seasonMode);
  }, [seasonMode]);

  useEffect(() => {
    simClock.setCurrentDay(stats.day);
  }, [stats.day]);

  // Sync Wildlife Camera & Direct Control state with zero-rerender tracker singleton
  useEffect(() => {
    wildlifeTracker.trackedAnimalId = wildlifeCamActive ? trackedAnimalId : null;
    wildlifeTracker.controlledAnimalId = wildlifeCamActive && controlMode ? trackedAnimalId : null;
    if (!wildlifeCamActive || !controlMode) {
      wildlifeTracker.clearInput();
    }
  }, [wildlifeCamActive, trackedAnimalId, controlMode]);

  // Lazy-start procedural ambient audio on first pointer interaction
  useEffect(() => {
    const initAudioOnInteraction = () => {
      ecosystemAudio.init();
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('touchstart', initAudioOnInteraction);
    };
    window.addEventListener('click', initAudioOnInteraction);
    window.addEventListener('touchstart', initAudioOnInteraction);
    return () => {
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('touchstart', initAudioOnInteraction);
    };
  }, []);

  useEffect(() => {
    ecosystemAudio.updateState(stats.population, stats.weather);
  }, [stats.population, stats.weather]);

  // Debounced persistence to localStorage
  const persistState = useCallback(() => {
    try {
      localStorage.setItem('eg_seasonMode', JSON.stringify(seasonMode));
      localStorage.setItem('eg_tickRateMs', JSON.stringify(tickRateMs));
      localStorage.setItem('eg_grid', JSON.stringify(gridRef.current));
      localStorage.setItem('eg_stats', JSON.stringify(statsRef.current));
      localStorage.setItem('eg_civilization', JSON.stringify(civRef.current));
    } catch {
      // Ignore storage quota restrictions
    }
  }, [seasonMode, tickRateMs]);

  useEffect(() => {
    const timer = window.setTimeout(persistState, 1500);
    return () => window.clearTimeout(timer);
  }, [persistState, grid, stats, civilization]);

  useEffect(() => {
    window.addEventListener('beforeunload', persistState);
    return () => window.removeEventListener('beforeunload', persistState);
  }, [persistState]);

  // Main autonomous daily ecosystem + human civilization loop (always wild-seeding & self-balancing)
  useEffect(() => {
    if (tickRateMs >= 99999999) return;

    const interval = window.setInterval(() => {
      const ecoResult = stepEcosystemTick(
        gridRef.current,
        statsRef.current,
        null,
        false,
        true
      );

      const civResult = stepCivilizationTick(
        civRef.current,
        ecoResult.nextGrid,
        ecoResult.nextStats
      );

      const finalStats: CityStats = {
        ...ecoResult.nextStats,
        money: ecoResult.nextStats.money + civResult.solarBonus,
      };

      setGrid(civResult.nextGrid);
      setStats(finalStats);
      setCivilization(civResult.nextCiv);
      simClock.setCurrentDay(finalStats.day);
      simClock.resetDayStart();

      if (civResult.eraAdvanced) {
        ecosystemAudio.playActionChime('reward');
      }
    }, tickRateMs);

    return () => window.clearInterval(interval);
  }, [tickRateMs]);

  // Bird Flight Mode handlers
  const handleToggleBirdMode = useCallback(() => {
    if (birdModeRef.current) {
      birdFlightState.active = false;
      birdFlightState.clearInput();
      setBirdMode(false);
      setCameraPresetNonce((n) => n + 1);
      ecosystemAudio.playActionChime('water');
      return;
    }

    setWildlifeCamActive(false);
    setControlMode(false);
    setPlantingOpen(false);
    wildlifeTracker.clearInput();
    birdFlightState.resetForTakeoff(0, 4.4, 8.2);
    birdFlightState.active = true;
    setBirdMode(true);
    ecosystemAudio.playActionChime('reward');
  }, []);

  const handleFlyToSpot = useCallback((spot: Exclude<BirdSpotPreset, 'free'>) => {
    const [x, y, z] = getBirdSpotCoordinates(spot, civRef.current);
    birdFlightState.setSpotTarget(spot, x, y, z);
    ecosystemAudio.playActionChime('water');
  }, []);

  // Wildlife Camera & Direct Control handlers
  const handleToggleWildlifeCam = useCallback(() => {
    if (wildlifeCamActiveRef.current) {
      setWildlifeCamActive(false);
      setControlMode(false);
      wildlifeTracker.clearInput();
      setCameraPresetNonce((n) => n + 1);
      return;
    }

    const nearest = wildlifeTracker.findNearestAnimal();
    if (!nearest) return;

    if (birdModeRef.current) {
      birdFlightState.active = false;
      birdFlightState.clearInput();
      setBirdMode(false);
    }
    setPlantingOpen(false);
    setTrackedAnimalId(nearest.id);
    setWildlifeCamActive(true);
    setControlMode(false);
    ecosystemAudio.playActionChime('water');
  }, []);

  const handleTrackNearestAnimal = useCallback(() => {
    const nearest = wildlifeTracker.findNearestAnimal();
    if (!nearest) return;
    setTrackedAnimalId(nearest.id);
    setWildlifeCamActive(true);
    ecosystemAudio.playActionChime('water');
  }, []);

  const handleCycleAnimal = useCallback((dir: 1 | -1) => {
    const next = wildlifeTracker.cycleAnimal(trackedAnimalIdRef.current, dir);
    if (!next) return;
    setTrackedAnimalId(next.id);
    setWildlifeCamActive(true);
    ecosystemAudio.playActionChime('water');
  }, []);

  const handleToggleControlMode = useCallback(() => {
    if (!wildlifeCamActiveRef.current || !trackedAnimalIdRef.current) return;
    setControlMode((prev) => {
      const next = !prev;
      if (!next) {
        wildlifeTracker.clearInput();
        ecosystemAudio.playActionChime('water');
      } else {
        ecosystemAudio.playActionChime('plant');
      }
      return next;
    });
  }, []);

  const handleTrackedAnimalLost = useCallback(() => {
    const fallback = wildlifeTracker.findNearestAnimal();
    if (fallback) {
      setTrackedAnimalId(fallback.id);
    } else {
      setWildlifeCamActive(false);
      setControlMode(false);
      wildlifeTracker.clearInput();
    }
  }, []);

  // Keyboard shortcuts + direct Bird Flight & Wildlife Control steering
  useEffect(() => {
    const setWildlifeKey = (code: string, pressed: boolean): boolean => {
      if (code === 'KeyW' || code === 'ArrowUp') {
        wildlifeTracker.input.forward = pressed;
        return true;
      }
      if (code === 'KeyS' || code === 'ArrowDown') {
        wildlifeTracker.input.backward = pressed;
        return true;
      }
      if (code === 'KeyA' || code === 'ArrowLeft') {
        wildlifeTracker.input.left = pressed;
        return true;
      }
      if (code === 'KeyD' || code === 'ArrowRight') {
        wildlifeTracker.input.right = pressed;
        return true;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        wildlifeTracker.input.boost = pressed;
        return true;
      }
      return false;
    };

    const setBirdKey = (code: string, pressed: boolean): boolean => {
      if (code === 'KeyW' || code === 'ArrowUp') {
        birdFlightState.input.forward = pressed;
        return true;
      }
      if (code === 'KeyS' || code === 'ArrowDown') {
        birdFlightState.input.brake = pressed;
        return true;
      }
      if (code === 'KeyA' || code === 'ArrowLeft') {
        birdFlightState.input.left = pressed;
        return true;
      }
      if (code === 'KeyD' || code === 'ArrowRight') {
        birdFlightState.input.right = pressed;
        return true;
      }
      if (code === 'Space' || code === 'KeyE') {
        birdFlightState.input.climb = pressed;
        return true;
      }
      if (code === 'KeyQ' || code === 'ControlLeft') {
        birdFlightState.input.descend = pressed;
        return true;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        birdFlightState.input.boost = pressed;
        return true;
      }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (birdModeRef.current) {
        if (e.key === 'v' || e.key === 'V') {
          birdFlightState.firstPerson = !birdFlightState.firstPerson;
          return;
        }
        if (e.key === 'b' || e.key === 'B' || e.key === 'Escape') {
          handleToggleBirdMode();
          return;
        }
        if (setBirdKey(e.code, true)) {
          if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
          return;
        }
      }

      if (wildlifeCamActiveRef.current && controlModeRef.current) {
        if (setWildlifeKey(e.code, true)) {
          if (e.code.startsWith('Arrow')) e.preventDefault();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setTickRateMs((prev) => (prev >= 99999999 ? lastActiveTickRateRef.current : 99999999));
      } else if (e.key === 'b' || e.key === 'B') {
        handleToggleBirdMode();
      } else if (e.key === 'c' || e.key === 'C') {
        handleToggleWildlifeCam();
      } else if (e.key === 'Escape') {
        if (controlModeRef.current) {
          setControlMode(false);
          wildlifeTracker.clearInput();
        } else if (wildlifeCamActiveRef.current) {
          setWildlifeCamActive(false);
          setCameraPresetNonce((n) => n + 1);
        } else if (plantingOpenRef.current) {
          setPlantingOpen(false);
        }
      } else if (wildlifeCamActiveRef.current && (e.key === '[' || e.key === ',')) {
        handleCycleAnimal(-1);
      } else if (wildlifeCamActiveRef.current && (e.key === ']' || e.key === '.')) {
        handleCycleAnimal(1);
      } else if (e.key === 'h' || e.key === 'H') {
        setZenMode((prev) => !prev);
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        setWildlifeCamActive(false);
        setControlMode(false);
        wildlifeTracker.clearInput();
        setCameraPreset(e.key === '1' ? 'iso' : e.key === '2' ? 'scenic' : 'top');
        setCameraPresetNonce((n) => n + 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      setWildlifeKey(e.code, false);
      setBirdKey(e.code, false);
    };

    const onBlur = () => {
      wildlifeTracker.clearInput();
      birdFlightState.clearInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      wildlifeTracker.clearInput();
      birdFlightState.clearInput();
    };
  }, [handleToggleBirdMode, handleToggleWildlifeCam, handleCycleAnimal]);

  // Generate fresh random natural forest biome
  const handleGenerateNaturalForest = useCallback(() => {
    const { grid: wildGrid, initialBiomass } = generateNaturalForestGrid(Math.random() * 1000);
    const nextCiv = createInitialCivilization(wildGrid, true, civRef.current.era);
    const updatedCiv: CivilizationState = {
      ...nextCiv,
      eraMode: civRef.current.eraMode,
      eraProgress: civRef.current.eraProgress,
    };

    const finalGrid = clearSettlementFootprints(wildGrid, updatedCiv);
    setGrid(finalGrid);
    setCivilization(updatedCiv);
    setStats((prev) => ({
      ...prev,
      population: initialBiomass,
    }));
    ecosystemAudio.playActionChime('reward');
  }, []);

  const handleChangeSeasonMode = useCallback((mode: SeasonMode) => {
    setSeasonMode(mode);
    simClock.setSeasonMode(mode);
    ecosystemAudio.playActionChime('water');
  }, []);

  const handleChangeEraMode = useCallback((mode: EraMode) => {
    const updated = setCivilizationEraOverride(civRef.current, gridRef.current, mode);
    setCivilization(updated);
    setGrid((prev) => clearSettlementFootprints(prev, updated));
    ecosystemAudio.playActionChime('reward');
  }, []);

  // Tile click: focus creature in Wildlife Cam mode, or free plant/clear when Plant palette is open
  const handleTileClick = useCallback(
    (x: number, y: number) => {
      if (wildlifeCamActiveRef.current) {
        const [wx, , wz] = gridToWorld(x, y);
        const nearest = wildlifeTracker.findNearestAnimal(wx, wz);
        if (nearest) {
          setTrackedAnimalId(nearest.id);
          ecosystemAudio.playActionChime('water');
        }
        return;
      }

      if (!plantingOpenRef.current) return;

      const currentGrid = gridRef.current;
      const tile = currentGrid[y]?.[x];
      if (!tile) return;

      if (RIVER_MASK[y]?.[x] || isTileReservedBySettlement(civRef.current, x, y)) {
        return;
      }

      const cloneGridWithTile = (updatedTile: typeof tile): Grid =>
        currentGrid.map((row, ry) =>
          ry === y ? row.map((cell, rx) => (rx === x ? updatedTile : cell)) : row
        );

      if (selectedTool === EcosystemType.None) {
        if (tile.type === EcosystemType.None) return;
        setGrid(
          cloneGridWithTile({
            ...tile,
            type: EcosystemType.None,
            growthStage: 0,
            growthProgress: 0,
          })
        );
        ecosystemAudio.playActionChime('prune');
        return;
      }

      if (tile.type !== EcosystemType.None) return;

      setGrid(
        cloneGridWithTile({
          ...tile,
          type: selectedTool,
          growthStage: 1,
          growthProgress: 0,
        })
      );
      setStats((prev) => ({ ...prev, population: prev.population + 2 }));
      ecosystemAudio.playActionChime('plant');
    },
    [selectedTool]
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#071512]">
      <IsoMap
        grid={grid}
        onTileClick={handleTileClick}
        hoveredTool={selectedTool}
        population={stats.population}
        weather={stats.weather}
        day={stats.day}
        civilization={civilization}
        cameraPreset={cameraPreset}
        cameraPresetNonce={cameraPresetNonce}
        wildlifeCamActive={wildlifeCamActive}
        trackedAnimalId={trackedAnimalId}
        onTrackedAnimalLost={handleTrackedAnimalLost}
        plantingActive={plantingOpen}
        birdMode={birdMode}
      />

      <UIOverlay
        stats={stats}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        plantingOpen={plantingOpen}
        onTogglePlantingOpen={() => {
          setPlantingOpen((prev) => {
            const next = !prev;
            if (next && wildlifeCamActiveRef.current) {
              setWildlifeCamActive(false);
              setControlMode(false);
              wildlifeTracker.clearInput();
            }
            return next;
          });
        }}
        onGenerateNaturalForest={handleGenerateNaturalForest}
        seasonMode={seasonMode}
        onChangeSeasonMode={handleChangeSeasonMode}
        civilization={civilization}
        onChangeEraMode={handleChangeEraMode}
        tickRateMs={tickRateMs}
        onChangeTickRate={setTickRateMs}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode((prev) => !prev)}
        wildlifeCamActive={wildlifeCamActive}
        trackedAnimalId={trackedAnimalId}
        controlMode={controlMode}
        onToggleWildlifeCam={handleToggleWildlifeCam}
        onCycleAnimal={handleCycleAnimal}
        onTrackNearestAnimal={handleTrackNearestAnimal}
        onToggleControlMode={handleToggleControlMode}
        birdMode={birdMode}
        onToggleBirdMode={handleToggleBirdMode}
        onFlyToSpot={handleFlyToSpot}
      />
    </div>
  );
}

export default App;
