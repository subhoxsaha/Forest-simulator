/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  EcosystemType,
  CityStats,
  AIGoal,
  NewsItem,
  CameraPreset,
} from './types';
import { GRID_SIZE, BUILDINGS, INITIAL_MONEY } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';
import { ecosystemAudio } from './services/audio';
import { simClock } from './simulation/clock';
import {
  createInitialGrid,
  generateNaturalForestGrid,
  stepEcosystemTick,
} from './simulation/engine';
import { RIVER_MASK } from './utils/webgl';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadInitialGrid(): Grid {
  const saved = readStorage<Grid | null>('eg_grid', null);
  if (
    Array.isArray(saved) &&
    saved.length === GRID_SIZE &&
    Array.isArray(saved[0]) &&
    saved[0].length === GRID_SIZE
  ) {
    return saved;
  }
  // Show a scenic natural forest in the background on first visit behind the Start Screen
  return generateNaturalForestGrid(42).grid;
}

function App() {
  // --- Core Simulation State ---
  const [gameStarted, setGameStarted] = useState<boolean>(() =>
    readStorage('eg_gameStarted', false)
  );
  const [aiEnabled, setAiEnabled] = useState<boolean>(() =>
    readStorage('eg_aiEnabled', true)
  );
  const [wildSeedingEnabled, setWildSeedingEnabled] = useState<boolean>(() =>
    readStorage('eg_wildSeedingEnabled', true)
  );
  const [tickRateMs, setTickRateMs] = useState<number>(() =>
    readStorage('eg_tickRateMs', 1500)
  );
  const [grid, setGrid] = useState<Grid>(loadInitialGrid);
  const [stats, setStats] = useState<CityStats>(() =>
    readStorage('eg_stats', {
      money: INITIAL_MONEY,
      population: 0,
      day: 1,
      weather: 'Sunny',
    })
  );
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(() =>
    readStorage('eg_currentGoal', null)
  );
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>(() =>
    readStorage('eg_newsFeed', [])
  );

  // --- UI Interaction State ---
  const [selectedTool, setSelectedTool] = useState<EcosystemType>(EcosystemType.Pine);
  const [showFertilityHeatmap, setShowFertilityHeatmap] = useState<boolean>(false);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [cameraPresetNonce, setCameraPresetNonce] = useState<number>(0);
  const [zenMode, setZenMode] = useState<boolean>(false);

  // Refs for stable simulation loop reads
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);
  const wildSeedingRef = useRef(wildSeedingEnabled);
  const lastActiveTickRateRef = useRef(tickRateMs < 99999999 ? tickRateMs : 1500);

  gridRef.current = grid;
  statsRef.current = stats;
  goalRef.current = currentGoal;
  aiEnabledRef.current = aiEnabled;
  wildSeedingRef.current = wildSeedingEnabled;
  if (tickRateMs < 99999999) {
    lastActiveTickRateRef.current = tickRateMs;
  }

  // Sync zero-rerender simulation clock
  useEffect(() => {
    simClock.setGameStarted(gameStarted);
  }, [gameStarted]);

  useEffect(() => {
    simClock.setTickRate(tickRateMs);
  }, [tickRateMs]);

  // Lazy initialization of procedural ecosystem audio on first user gesture
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

  // Update procedural audio ambience based on biomass and weather
  useEffect(() => {
    ecosystemAudio.updateState(stats.population, stats.weather);
  }, [stats.population, stats.weather]);

  // Debounced persistence to localStorage (prevents synchronous JSON.stringify stalls on every click/tick)
  const persistState = useCallback(() => {
    try {
      localStorage.setItem('eg_gameStarted', JSON.stringify(gameStarted));
      localStorage.setItem('eg_aiEnabled', JSON.stringify(aiEnabled));
      localStorage.setItem('eg_wildSeedingEnabled', JSON.stringify(wildSeedingEnabled));
      localStorage.setItem('eg_tickRateMs', JSON.stringify(tickRateMs));
      localStorage.setItem('eg_grid', JSON.stringify(gridRef.current));
      localStorage.setItem('eg_stats', JSON.stringify(statsRef.current));
      localStorage.setItem('eg_currentGoal', JSON.stringify(goalRef.current));
      localStorage.setItem('eg_newsFeed', JSON.stringify(newsFeed));
    } catch {
      // Ignore quota or private mode storage restrictions
    }
  }, [gameStarted, aiEnabled, wildSeedingEnabled, tickRateMs, newsFeed]);

  useEffect(() => {
    const timer = window.setTimeout(persistState, 1200);
    return () => window.clearTimeout(timer);
  }, [persistState, grid, stats, currentGoal]);

  useEffect(() => {
    window.addEventListener('beforeunload', persistState);
    return () => window.removeEventListener('beforeunload', persistState);
  }, [persistState]);

  const addNewsItems = useCallback((items: NewsItem[]) => {
    if (items.length === 0) return;
    setNewsFeed((prev) => [...prev, ...items].slice(-20));
  }, []);

  const addNewsItem = useCallback((text: string, type: NewsItem['type'] = 'neutral') => {
    setNewsFeed((prev) => [
      ...prev.slice(-19),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, type },
    ]);
  }, []);

  // Fetch a botanical milestone quest
  const fetchNewGoal = useCallback(async (targetStats?: CityStats, targetGrid?: Grid) => {
    if (!aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    try {
      const nextGoal = await generateCityGoal(
        targetStats || statsRef.current,
        targetGrid || gridRef.current
      );
      if (nextGoal) {
        setCurrentGoal(nextGoal);
      }
    } finally {
      setIsGeneratingGoal(false);
    }
  }, []);

  // Main daily ecosystem simulation loop
  useEffect(() => {
    if (!gameStarted || tickRateMs >= 99999999) return;

    const interval = window.setInterval(() => {
      const result = stepEcosystemTick(
        gridRef.current,
        statsRef.current,
        goalRef.current,
        aiEnabledRef.current,
        wildSeedingRef.current
      );

      setGrid(result.nextGrid);
      setStats(result.nextStats);
      simClock.resetDayStart();

      if (result.goalCompletedNow) {
        setCurrentGoal((prev) => (prev ? { ...prev, completed: true } : null));
        ecosystemAudio.playActionChime('reward');
      }

      if (result.newsEvents.length > 0) {
        addNewsItems(result.newsEvents);
      }

      // Occasional poetic ecological commentary
      if (aiEnabledRef.current && result.nextStats.day % 9 === 0 && Math.random() < 0.65) {
        generateNewsEvent(result.nextStats, null).then((item) => {
          if (item) addNewsItems([item]);
        });
      }
    }, tickRateMs);

    return () => window.clearInterval(interval);
  }, [gameStarted, tickRateMs, addNewsItems]);

  // Keyboard shortcuts (Space pause/resume, H Zen Mode, F Fertility Heatmap, 1/2/3 Camera Presets)
  useEffect(() => {
    if (!gameStarted) return;
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

      if (e.code === 'Space') {
        e.preventDefault();
        setTickRateMs((prev) => (prev >= 99999999 ? lastActiveTickRateRef.current : 99999999));
      } else if (e.key === 'h' || e.key === 'H') {
        setZenMode((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        setShowFertilityHeatmap((prev) => !prev);
      } else if (e.key === '1') {
        setCameraPreset('iso');
        setCameraPresetNonce((n) => n + 1);
      } else if (e.key === '2') {
        setCameraPreset('scenic');
        setCameraPresetNonce((n) => n + 1);
      } else if (e.key === '3') {
        setCameraPreset('top');
        setCameraPresetNonce((n) => n + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameStarted]);

  // Start simulation handler from StartScreen
  const handleStart = useCallback(
    ({
      aiEnabled: enableAi,
      startWithNaturalForest,
      wildSeedingEnabled: enableWildSeeding,
    }: {
      aiEnabled: boolean;
      startWithNaturalForest: boolean;
      wildSeedingEnabled: boolean;
    }) => {
      ecosystemAudio.init();
      setAiEnabled(enableAi);
      setWildSeedingEnabled(enableWildSeeding);
      aiEnabledRef.current = enableAi;
      wildSeedingRef.current = enableWildSeeding;

      let nextGrid: Grid;
      let initialBiomass = 0;

      if (startWithNaturalForest) {
        const generated = generateNaturalForestGrid(Math.random() * 1000);
        nextGrid = generated.grid;
        initialBiomass = generated.initialBiomass;
      } else {
        nextGrid = createInitialGrid();
      }

      const initialStats: CityStats = {
        money: INITIAL_MONEY,
        population: initialBiomass,
        day: 1,
        weather: 'Sunny',
      };

      setGrid(nextGrid);
      setStats(initialStats);
      setCurrentGoal(null);
      setNewsFeed([
        {
          id: `${Date.now()}-welcome`,
          text: startWithNaturalForest
            ? 'Welcome to EverGreen 3D. A natural forest sanctuary with deer, foxes, songbirds, and river koi awaits.'
            : 'Welcome to EverGreen 3D. Plant your first seeds along the fertile river valley and watch wildlife arrive.',
          type: 'positive',
        },
      ]);
      setGameStarted(true);
      simClock.resetDayStart();
      simClock.setGameStarted(true);
      ecosystemAudio.playActionChime('reward');

      if (enableAi) {
        fetchNewGoal(initialStats, nextGrid);
      }
    },
    [fetchNewGoal]
  );

  // One-click Natural Forest generator (usable anytime during simulation)
  const handleGenerateNaturalForest = useCallback(() => {
    const { grid: wildGrid, initialBiomass } = generateNaturalForestGrid(Math.random() * 1000);
    const updatedStats: CityStats = {
      ...statsRef.current,
      money: Math.max(statsRef.current.money, INITIAL_MONEY),
      population: initialBiomass,
    };

    setGrid(wildGrid);
    setStats(updatedStats);
    ecosystemAudio.playActionChime('reward');
    addNewsItem(
      'Natural Biome Generated: Riparian groves, sunlit meadows, upland pines, and wild fauna have settled across the island.',
      'positive'
    );

    if (aiEnabledRef.current) {
      fetchNewGoal(updatedStats, wildGrid);
    }
  }, [addNewsItem, fetchNewGoal]);

  // Tile interaction handler
  const handleTileClick = useCallback(
    (x: number, y: number) => {
      const currentGrid = gridRef.current;
      const currentStats = statsRef.current;
      const tile = currentGrid[y]?.[x];
      if (!tile) return;

      const isRiver = RIVER_MASK[y]?.[x] ?? false;
      const toolConfig = BUILDINGS[selectedTool];
      if (!toolConfig) return;

      if (currentStats.money < toolConfig.cost) {
        addNewsItem(
          `Insufficient Solar Energy for ${toolConfig.name} (needs ${toolConfig.cost}).`,
          'negative'
        );
        return;
      }

      // River guard
      if (isRiver) {
        if (
          selectedTool !== EcosystemType.WateringCan &&
          selectedTool !== EcosystemType.NutrientMulch &&
          selectedTool !== EcosystemType.None
        ) {
          addNewsItem('Cannot plant terrestrial trees inside the flowing river channel.', 'neutral');
        }
        return;
      }

      const cloneGridWithTile = (updatedTile: typeof tile): Grid =>
        currentGrid.map((row, ry) =>
          ry === y ? row.map((cell, rx) => (rx === x ? updatedTile : cell)) : row
        );

      // 1. Watering Can
      if (selectedTool === EcosystemType.WateringCan) {
        const nextMoisture = Math.min(100, tile.moisture + 40);
        setGrid(cloneGridWithTile({ ...tile, moisture: nextMoisture }));
        setStats((prev) => ({ ...prev, money: prev.money - toolConfig.cost }));
        ecosystemAudio.playActionChime('water');
        return;
      }

      // 2. Nutrient Mulch
      if (selectedTool === EcosystemType.NutrientMulch) {
        const nextNutrients = Math.min(100, tile.nutrients + 45);
        setGrid(cloneGridWithTile({ ...tile, nutrients: nextNutrients }));
        setStats((prev) => ({ ...prev, money: prev.money - toolConfig.cost }));
        ecosystemAudio.playActionChime('mulch');
        return;
      }

      // 3. Spade / Prune
      if (selectedTool === EcosystemType.None) {
        if (tile.type === EcosystemType.None) return;
        const removedName = BUILDINGS[tile.type]?.name || tile.type;
        setGrid(
          cloneGridWithTile({
            ...tile,
            type: EcosystemType.None,
            growthStage: 0,
            growthProgress: 0,
          })
        );
        setStats((prev) => ({ ...prev, money: prev.money - toolConfig.cost }));
        ecosystemAudio.playActionChime('prune');
        addNewsItem(`Cleared ${removedName} at [${x}, ${y}].`, 'neutral');
        return;
      }

      // 4. Plant a tree species
      if (tile.type !== EcosystemType.None) {
        addNewsItem(
          `Tile [${x}, ${y}] is occupied. Use Spade / Prune first to clear space.`,
          'neutral'
        );
        return;
      }

      setGrid(
        cloneGridWithTile({
          ...tile,
          type: selectedTool,
          growthStage: 1,
          growthProgress: 0,
        })
      );
      setStats((prev) => ({
        ...prev,
        money: prev.money - toolConfig.cost,
        population: prev.population + 2,
      }));
      ecosystemAudio.playActionChime('plant');
    },
    [selectedTool, addNewsItem]
  );

  const handleClaimReward = useCallback(() => {
    const goal = goalRef.current;
    if (!goal || !goal.completed) return;

    const reward = goal.reward;
    const nextStats = { ...statsRef.current, money: statsRef.current.money + reward };
    setStats(nextStats);
    setCurrentGoal(null);
    ecosystemAudio.playActionChime('reward');
    addNewsItem(`Milestone Complete: Claimed +${reward} Solar Energy.`, 'positive');
    fetchNewGoal(nextStats, gridRef.current);
  }, [addNewsItem, fetchNewGoal]);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraPresetNonce((n) => n + 1);
  }, []);

  const handleResetGame = useCallback(() => {
    const keys = [
      'eg_gameStarted',
      'eg_aiEnabled',
      'eg_wildSeedingEnabled',
      'eg_tickRateMs',
      'eg_grid',
      'eg_stats',
      'eg_currentGoal',
      'eg_newsFeed',
    ];
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // Ignore storage error
      }
    });

    const fresh = generateNaturalForestGrid(Math.random() * 1000);
    setGrid(fresh.grid);
    setStats({
      money: INITIAL_MONEY,
      population: fresh.initialBiomass,
      day: 1,
      weather: 'Sunny',
    });
    setCurrentGoal(null);
    setNewsFeed([]);
    setTickRateMs(1500);
    setShowFertilityHeatmap(false);
    setZenMode(false);
    setGameStarted(false);
    simClock.resetAll();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#071512]">
      <IsoMap
        grid={grid}
        onTileClick={handleTileClick}
        hoveredTool={selectedTool}
        population={stats.population}
        weather={stats.weather}
        day={stats.day}
        showFertilityHeatmap={showFertilityHeatmap}
        onTileHover={setHoveredCoords}
        cameraPreset={cameraPreset}
        cameraPresetNonce={cameraPresetNonce}
      />

      {!gameStarted ? (
        <StartScreen onStart={handleStart} />
      ) : (
        <UIOverlay
          stats={stats}
          grid={grid}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          onToggleAi={(enabled) => {
            setAiEnabled(enabled);
            aiEnabledRef.current = enabled;
            if (enabled && !goalRef.current) {
              fetchNewGoal();
            }
          }}
          wildSeedingEnabled={wildSeedingEnabled}
          onToggleWildSeeding={setWildSeedingEnabled}
          onGenerateNaturalForest={handleGenerateNaturalForest}
          tickRateMs={tickRateMs}
          onChangeTickRate={setTickRateMs}
          showFertilityHeatmap={showFertilityHeatmap}
          onToggleFertilityHeatmap={() => setShowFertilityHeatmap((prev) => !prev)}
          hoveredCoords={hoveredCoords}
          cameraPreset={cameraPreset}
          onSelectCameraPreset={handleSelectCameraPreset}
          onResetGame={handleResetGame}
          zenMode={zenMode}
          onToggleZenMode={() => setZenMode((prev) => !prev)}
        />
      )}
    </div>
  );
}

export default App;
