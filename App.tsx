/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, EcosystemType, CityStats, AIGoal, NewsItem } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, INITIAL_MONEY } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { SelectorPanel } from './components/SelectorPanel';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';
import { ecosystemAudio } from './services/audio';

// Generates an island-like circular land grid with soil moisture and nutrient variables
const createInitialGrid = (): Grid => {
  const grid: Grid = [];
  const center = GRID_SIZE / 2;

  // Simple deterministic offset hash for initial variance
  const getHashLocal = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 4375) % 1;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const hash = getHashLocal(x, y);
      
      row.push({
        x,
        y,
        type: EcosystemType.None,
        growthStage: 0,
        growthProgress: 0,
        moisture: Math.floor(45 + hash * 25), // 45% - 70% starter soil moisture
        nutrients: Math.floor(65 + hash * 20), // 65% - 85% starter soil nutrients
        variant: Math.floor(hash * 100),
      });
    }
    grid.push(row);
  }
  return grid;
};

function App() {
  // --- Simulation Management States ---
  const [gameStarted, setGameStarted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('eg_gameStarted');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [aiEnabled, setAiEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('eg_aiEnabled');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [tickRateMs, setTickRateMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('eg_tickRateMs');
      return saved ? JSON.parse(saved) : 1500;
    } catch {
      return 1500;
    }
  });

  const [grid, setGrid] = useState<Grid>(() => {
    try {
      const saved = localStorage.getItem('eg_grid');
      return saved ? JSON.parse(saved) : createInitialGrid();
    } catch {
      return createInitialGrid();
    }
  });
  const [stats, setStats] = useState<CityStats>(() => {
    try {
      const saved = localStorage.getItem('eg_stats');
      return saved ? JSON.parse(saved) : {
        money: INITIAL_MONEY, // money tracks Solar Energy (☀️)
        population: 0, // population tracks Forest Biomass (🌿)
        day: 1,
        weather: 'Sunny',
      };
    } catch {
      return {
        money: INITIAL_MONEY,
        population: 0,
        day: 1,
        weather: 'Sunny',
      };
    }
  });
  const [selectedTool, setSelectedTool] = useState<EcosystemType>(EcosystemType.Pine);
  const [showFertilityHeatmap, setShowFertilityHeatmap] = useState<boolean>(false);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number, y: number } | null>(null);
  const [dayStartTime, setDayStartTime] = useState<number>(() => Date.now());
  const [subDayProgress, setSubDayProgress] = useState<number>(0);

  // Lazy initialization of procedural ecosystem audio system on any click/gesture
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

  // Update procedural synthesizer states based on real-time weather and tree biomass score
  useEffect(() => {
    ecosystemAudio.updateState(stats.population, stats.weather);
  }, [stats.population, stats.weather]);

  // Smoothly drive the 24-hour sub-day progression based on simulation speed
  useEffect(() => {
    if (!gameStarted) return;
    let animFrame: number;
    const update = () => {
      const elapsed = Date.now() - dayStartTime;
      const progress = Math.min(1.0, Math.max(0.0, elapsed / tickRateMs));
      setSubDayProgress(progress);
      animFrame = requestAnimationFrame(update);
    };
    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, [gameStarted, dayStartTime, tickRateMs]);
  
  // --- AI / Quest Logs ---
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(() => {
    try {
      const saved = localStorage.getItem('eg_currentGoal');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>(() => {
    try {
      const saved = localStorage.getItem('eg_newsFeed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // States references for real-time consistency in the tick loops
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);

  // Synchronize ref bindings on render updates
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { goalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  // Synchronize state data to localStorage
  useEffect(() => {
    localStorage.setItem('eg_gameStarted', JSON.stringify(gameStarted));
  }, [gameStarted]);

  useEffect(() => {
    localStorage.setItem('eg_aiEnabled', JSON.stringify(aiEnabled));
  }, [aiEnabled]);

  useEffect(() => {
    localStorage.setItem('eg_tickRateMs', JSON.stringify(tickRateMs));
  }, [tickRateMs]);

  useEffect(() => {
    localStorage.setItem('eg_grid', JSON.stringify(grid));
  }, [grid]);

  useEffect(() => {
    localStorage.setItem('eg_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('eg_currentGoal', JSON.stringify(currentGoal));
  }, [currentGoal]);

  useEffect(() => {
    localStorage.setItem('eg_newsFeed', JSON.stringify(newsFeed));
  }, [newsFeed]);

  // --- Logger helpers ---
  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-14), item]); // Maintain a clean list of recent logs
  }, []);

  // Fetch a new botanical task from Gemini AI
  const fetchNewGoal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    await new Promise(r => setTimeout(r, 600)); // slight visual breathing delay
    
    // Map grid stats
    const newGoal = await generateCityGoal(statsRef.current, gridRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      if (aiEnabledRef.current) setTimeout(fetchNewGoal, 6000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  // Generates automatic poetic news events regarding local forest changes
  const fetchNews = useCallback(async () => {
    if (!aiEnabledRef.current || Math.random() > 0.14) return; 
    const news = await generateNewsEvent(statsRef.current, null);
    if (news) addNewsItem(news);
  }, [addNewsItem]);


  // --- Initial Start Logger ---
  useEffect(() => {
    if (!gameStarted) return;

    // Check if the forest was loaded from local state cache or newly initialized
    const existing = localStorage.getItem('eg_grid');
    if (existing) {
      addNewsItem({
        id: Date.now().toString(),
        text: "Deep-root memory interface connected. Woodland sanctuary restored from local archives.",
        type: 'positive'
      });
      if (aiEnabled && !currentGoal) {
        fetchNewGoal();
      }
      return;
    }

    addNewsItem({
      id: Date.now().toString(),
      text: "Woodland sanctuary coordinates locked. Soil beds fertilized. Welcome to EverGreen.",
      type: 'positive'
    });
    
    if (aiEnabled) {
      fetchNewGoal();
    }
  }, [gameStarted]);


  // --- Central Day-Cycle Game Loop ---
  useEffect(() => {
    if (!gameStarted) return;

    const intervalId = setInterval(() => {
      const currentGrid = gridRef.current;
      const currentStats = statsRef.current;
      const currentGoalObj = goalRef.current;

      // 1. Calculate random seasonal Weather shifts (12% chance per day)
      let newWeather = currentStats.weather;
      if (Math.random() < 0.12) {
        const weathers: ('Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew')[] = ['Sunny', 'Raining', 'Windy', 'Autumn_Dew'];
        const weights = [0.55, 0.22, 0.18, 0.05]; // Sunset weights
        
        let r = Math.random();
        let cumulative = 0;
        for (let i = 0; i < weathers.length; i++) {
          cumulative += weights[i];
          if (r <= cumulative) {
            newWeather = weathers[i];
            break;
          }
        }

        // Only log if the weather actually changed
        if (newWeather !== currentStats.weather) {
          let weatherDesc = "The clouds part, introducing warm golden sunlight.";
          if (newWeather === 'Raining') weatherDesc = "Heavy gray clouds gather. A cool rain begins soaking the earth.";
          if (newWeather === 'Windy') weatherDesc = "A brisk wind sweeps through the forest canopy, making leaves wave.";
          if (newWeather === 'Autumn_Dew') weatherDesc = "An autumn chill settles. Golden pollen and dew dance in the air.";

          addNewsItem({
            id: (Date.now() + Math.random()).toString(),
            text: `Climate Shift: ${weatherDesc}`,
            type: 'neutral'
          });
        }
      }

      // 2. Photosynthesis (Solar Energy Currency) & Biomass Score Calculations
      let totalDailySolarGen = 0;
      let totalForestBiomass = 0;
      let speciesCounts: Record<string, number> = {};
      let ancientCounts: Record<string, number> = {};

      // Map tile-by-tile calculations
      const nextGrid = currentGrid.map((row, y) =>
        row.map((tile, x) => {
          let tileType = tile.type;
          let tileMoisture = tile.moisture;
          let tileNutrients = tile.nutrients;
          let tileProgress = tile.growthProgress;
          let tileStage = tile.growthStage;

          // Neighborhood helper for diffusion and siphoning
          const neighbors = [
            [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
          ];

          // A. Update soil moisture based on the global weather condition (diagonal river)
          const riverY = x + Math.sin(x * 0.6) * 1.25;
          const isRiver = Math.abs(y - riverY) < 1.45;
          const isNearRiver = neighbors.some(([nx, ny]) => {
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              const rY = nx + Math.sin(nx * 0.6) * 1.25;
              return Math.abs(ny - rY) < 1.45;
            }
            return false;
          });

          if (isRiver) {
            tileMoisture = 100; // River tiles are always fully saturated
          } else if (isNearRiver) {
            if (newWeather === 'Raining') {
              tileMoisture = Math.min(100, tileMoisture + 25);
            } else {
              tileMoisture = Math.max(75, tileMoisture); // Saturated riverbanks maintain 75% baseline moisture
            }
          } else if (newWeather === 'Raining') {
            tileMoisture = Math.min(100, tileMoisture + 20); // Rain hydrates faster (increased rain absorption rate)
          } else {
            // Sunny evaporates faster, windy exerts moderate drying, empty tiles absorb moderate subterranean baseline moisture
            let drying = newWeather === 'Sunny' ? 12 : newWeather === 'Windy' ? 6 : 4;
            if (tileType === EcosystemType.None) {
              // Empty land absorbs ambient ground moisture to slowly return to a baseline of 40%
              if (tileMoisture < 40) {
                // Recover slowly: +2 moisture per day (subtracting drying)
                tileMoisture = Math.min(40, tileMoisture + Math.max(1, 4 - drying));
              } else {
                tileMoisture = Math.max(10, tileMoisture - drying);
              }
            } else {
              tileMoisture = Math.max(5, tileMoisture - drying);
            }
          }

          // Cypress and Banyan active root osmosis retains moisture on adjacent cells
          let neighborCypressCount = 0;
          let neighborBanyanCount = 0;
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              const nTile = currentGrid?.[ny]?.[nx];
              if (nTile) {
                if (nTile.type === EcosystemType.Cypress && nTile.growthStage >= 3) {
                  neighborCypressCount++;
                } else if (nTile.type === EcosystemType.Banyan && nTile.growthStage >= 3) {
                  neighborBanyanCount++;
                }
              }
            }
          }
          if ((neighborCypressCount > 0 || neighborBanyanCount > 0) && !isRiver && tileType !== EcosystemType.Cypress && tileType !== EcosystemType.Banyan) {
            tileMoisture = Math.min(100, tileMoisture + neighborCypressCount * 5 + neighborBanyanCount * 8);
          }

          // Subterranean moisture diffusion between adjacent tiles
          let neighboringMoistureSum = 0;
          let validNeighborsCount = 0;
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              neighboringMoistureSum += currentGrid[ny][nx].moisture;
              validNeighborsCount++;
            }
          }
          if (validNeighborsCount > 0) {
            const averageNeighborMoisture = neighboringMoistureSum / validNeighborsCount;
            // Diffuse 18% of the gradient difference to adjacent soils
            const moistureDiffusion = (averageNeighborMoisture - tileMoisture) * 0.18;
            tileMoisture = Math.max(0, Math.min(100, tileMoisture + moistureDiffusion));
          }

          // B. Soil Nutrients & Decomposition Math & Neighbor Diffusion
          if (tileType === EcosystemType.None) {
            // Empty soil slowly naturally regenerates nutrients
            tileNutrients = Math.min(100, tileNutrients + 1);
          } else if (tileType === EcosystemType.DeadTree) {
            // Decomposing wood heavily saturates its own root loam tile
            tileNutrients = Math.min(100, tileNutrients + 5);
          } else if (tileType === EcosystemType.Alder) {
            // Alder fixes nitrogen directly to its own coordinate!
            const boost = tileStage === 1 ? 1 : tileStage === 2 ? 2 : 3;
            tileNutrients = Math.min(100, tileNutrients + boost);
          } else if (tileType === EcosystemType.Acacia) {
            // Acacia fixes nitrogen directly to its own coordinate!
            const boost = tileStage === 1 ? 1 : tileStage === 2 ? 3 : 5;
            tileNutrients = Math.min(100, tileNutrients + boost);
          } else if (tileType === EcosystemType.Neem) {
            // Neem heals local root loam node with rich nutrients
            const boost = tileStage === 1 ? 1 : tileStage === 2 ? 2 : 4;
            tileNutrients = Math.min(100, tileNutrients + boost);
          } else {
            // Growing/active flora consume nutrients based on size stage
            let intake = tileStage === 1 ? 1 : tileStage === 2 ? 2 : tileStage === 3 ? 3 : 4;
            if (tileType === EcosystemType.Bonsai) {
              intake = Math.round(intake * 2.5); // Bonsai consumes higher nutrients
            }
            tileNutrients = Math.max(5, tileNutrients - intake);
          }

          // Neighborhood Nutrient Siphoning & Nitrogen-Fixing boost
          let neighborDecomposing = false;
          let neighborAlderCount = 0;
          let neighborAcaciaCount = 0;
          let neighborNeemCount = 0;
          
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              const nTile = currentGrid?.[ny]?.[nx];
              if (nTile) {
                if (nTile.type === EcosystemType.DeadTree) {
                  neighborDecomposing = true;
                } else if (nTile.type === EcosystemType.Alder && nTile.growthStage >= 2) {
                  neighborAlderCount++;
                } else if (nTile.type === EcosystemType.Acacia && nTile.growthStage >= 2) {
                  neighborAcaciaCount++;
                } else if (nTile.type === EcosystemType.Neem && nTile.growthStage >= 2) {
                  neighborNeemCount++;
                }
              }
            }
          }
          if (neighborDecomposing && tileType !== EcosystemType.DeadTree) {
            tileNutrients = Math.min(100, tileNutrients + 6); // Diffuses rich humus nutrients
          }
          if (neighborAlderCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Alder) {
            tileNutrients = Math.min(100, tileNutrients + neighborAlderCount * 2); // Alder nitrogen diffusion boost (+2 per neighbor Alder)
          }
          if (neighborAcaciaCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Acacia) {
            tileNutrients = Math.min(100, tileNutrients + neighborAcaciaCount * 4); // Acacia nitrogen diffusion boost (+4 per neighbor Acacia)
          }
          if (neighborNeemCount > 0 && tileType !== EcosystemType.DeadTree && tileType !== EcosystemType.Neem) {
            tileNutrients = Math.min(100, tileNutrients + neighborNeemCount * 3); // Neem medicinal nitrogen/nutrient diffusion boost (+3)
          }

          // C1. Handle Decomposition of Dead Tree
          if (tileType === EcosystemType.DeadTree) {
            let decayInc = BUILDINGS[EcosystemType.DeadTree]?.growthRate || 12;
            if (tileMoisture >= 55) {
              decayInc = Math.round(decayInc * 1.8); // decomposes faster in damp cozy conditions!
            } else if (tileMoisture <= 20) {
              decayInc = Math.round(decayInc * 0.4); // extremely slow in arid environment
            }
            tileProgress = Math.min(100, tileProgress + decayInc);

            if (tileProgress >= 100) {
              // Complete Decomposition -> Soil is left super fertilized!
              tileType = EcosystemType.None;
              tileStage = 0;
              tileProgress = 0;
              tileNutrients = 100;
              addNewsItem({
                id: (Date.now() + Math.random()).toString(),
                text: `Nutrient Recycled: Decaying wood at [${x}, ${y}] has fully decomposed, enriching the loam with premium dark soil mulch!`,
                type: 'positive'
              });
            }
          }

          // C2. Calculate growth pace for living plants
          else if (tileType !== EcosystemType.None && tileStage < 4) {
            const config = BUILDINGS[tileType];
            if (config) {
              // Moisture effect on growth rate
              let moistureMult = 1.0;
              if (tileMoisture >= 60) moistureMult = 1.5; // Healthy damp environment
              else if (tileMoisture <= 20) {
                // Baobab is resilient to dry conditions
                moistureMult = tileType === EcosystemType.Baobab ? 0.6 : 0.15;
              }

               // Nutrient effect on growth rate
              let nutrientMult = 1.0;
              if (tileType === EcosystemType.Bonsai) {
                // Bonsai requires rich soil (high nutrients) to grow
                if (tileNutrients >= 75) {
                  nutrientMult = 1.4;
                } else if (tileNutrients <= 45) {
                  nutrientMult = 0.05; // Growth stalls heavily without premium nutrients
                } else {
                  nutrientMult = 0.4;
                }
              } else if (tileType === EcosystemType.Alder || tileType === EcosystemType.Acacia) {
                // Nitrogen fixers are robust to low soil nutrient levels!
                if (tileNutrients >= 70) {
                  nutrientMult = 1.25;
                } else if (tileNutrients <= 15) {
                  nutrientMult = 0.8; // Grows steadily even in poor soils!
                } else {
                  nutrientMult = 1.0;
                }
              } else {
                if (tileNutrients >= 70) nutrientMult = 1.3; // Nutrient rich soil compost
                else if (tileNutrients <= 15) nutrientMult = 0.1; // Malnutrition stalls growth
              }

              // Weather multipliers
              let weatherMult = 1.0;
              if (newWeather === 'Sunny') weatherMult = 1.25; // Sunlight fuels photosynthesis!
              if (newWeather === 'Autumn_Dew' && (tileType === EcosystemType.Maple || tileType === EcosystemType.Oak || tileType === EcosystemType.Jacaranda)) {
                weatherMult = 1.4; // Maple/Oak/Jacaranda thrive in autumn breezes
              }

              // Willow: thrives near wet soil/water tiles (adjacent tiles with moisture >= 75, or self moisture >= 75)
              let willowProximityMult = 1.0;
              if (tileType === EcosystemType.Willow) {
                let adjacentWater = false;
                for (const [nx, ny] of neighbors) {
                  if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    if (currentGrid[ny][nx].moisture >= 75) {
                      adjacentWater = true;
                      break;
                    }
                  }
                }
                if (adjacentWater || tileMoisture >= 75) {
                  willowProximityMult = 2.0; // Grows much faster near water sources!
                } else {
                  willowProximityMult = 0.4; // Depressed growth in drier and isolated areas
                }
              }

              // Bamboo: grows incredibly fast on well-hydrated slots
              let bambooSpeedMult = 1.0;
              if (tileType === EcosystemType.Bamboo) {
                if (tileMoisture >= 60) {
                  bambooSpeedMult = 2.2; 
                } else if (tileMoisture <= 25) {
                  bambooSpeedMult = 0.3;
                }
              }

              // Apply development progress increment
              const baseGrowth = config.growthRate;
              const actualGrowth = baseGrowth * moistureMult * nutrientMult * weatherMult * willowProximityMult * bambooSpeedMult;
              tileProgress += actualGrowth;

              // Growth Stage transitions
              if (tileProgress >= 100) {
                tileProgress = 0;
                tileStage += 1;

                // Log botanical milestone alerts in news feed
                if (tileStage === 3) {
                  addNewsItem({
                    id: (Date.now() + Math.random()).toString(),
                    text: `Botanical Maturity: A gorgeous ${config.name} is fully mature at [${x}, ${y}]!`,
                    type: 'positive'
                  });
                } else if (tileStage === 4) {
                  addNewsItem({
                    id: (Date.now() + Math.random()).toString(),
                    text: `Majestic Spectacle: A colossal Ancient ${config.name} towers in the glen! Wild animals gather.`,
                    type: 'positive'
                  });
                }
              }
            }
          }

          // C3. Natural Mortality & Environmental Tree Death System (Drought/Starvation/OldAge)
          if (tileType !== EcosystemType.None && tileType !== EcosystemType.DeadTree) {
            let die = false;
            let cause = "";

            // Check Drought Dehydration (highly dry soil)
            if (tileMoisture <= 15) {
              const droughtCap = (tileType === EcosystemType.Baobab || tileType === EcosystemType.Peepal || tileType === EcosystemType.Neem || tileType === EcosystemType.Banyan) ? 0.004 : 0.035;
              if (Math.random() < droughtCap) {
                die = true;
                cause = `severe drought dehydration`;
              }
            }

            // Check Nutrient Exhaustion/Starvation
            if (!die && tileNutrients <= 10 && tileStage >= 2) {
              if (Math.random() < 0.024) {
                die = true;
                cause = `nutrient starvation in fully depleted soil`;
              }
            }

            // Check Age Mortality (natural forest mortality for mature & ancient seniors)
            if (!die && tileStage >= 3 && tileType !== EcosystemType.Bonsai) {
              const ageCap = tileStage === 4 ? 0.006 : 0.0016; // 0.6% ancient death daily chance, 0.16% mature
              if (Math.random() < ageCap) {
                die = true;
                cause = `reaching the natural end of its magnificent life cycle`;
              }
            }

            // Transition living tree to standing deadwood decomposing lumber
            if (die) {
              const oldConfig = BUILDINGS[tileType];
              const oldName = oldConfig ? oldConfig.name : tileType;
              
              addNewsItem({
                id: (Date.now() + Math.random()).toString(),
                text: `Ecosystem Cycle: The ${oldName} at [${x}, ${y}] has fallen due to ${cause}. It returns as decomposing timber.`,
                type: 'negative'
              });

              tileType = EcosystemType.DeadTree;
              tileStage = 1; // start stage at 1 (DeadTree stump model)
              tileProgress = 0; // decomposes starting from 0%
            }
          }

          // D. Assess stats generated by current state
          if (tileType !== EcosystemType.None) {
            const config = BUILDINGS[tileType];
            if (config) {
              // Species registries
              speciesCounts[tileType] = (speciesCounts[tileType] || 0) + 1;
              if (tileStage === 4) {
                ancientCounts[tileType] = (ancientCounts[tileType] || 0) + 1;
              }

              // Photosynthetic Solar Energy generated
              if (tileStage === 2) totalDailySolarGen += Math.round(config.solarGen * 0.25);
              else if (tileStage === 3) totalDailySolarGen += config.solarGen;
              else if (tileStage === 4) totalDailySolarGen += config.solarGen * 2; // Ancient yields double energy output!

              // Biomass Point contributions
              if (tileStage === 1) totalForestBiomass += 2;
              else if (tileStage === 2) totalForestBiomass += 8;
              else if (tileStage === 3) totalForestBiomass += config.healthGen;
              else if (tileStage === 4) totalForestBiomass += Math.round(config.healthGen * 2.5); // Giant carbon footprint points
            }
          }

          return {
            ...tile,
            type: tileType,
            moisture: tileMoisture,
            nutrients: tileNutrients,
            growthProgress: tileProgress,
            growthStage: tileStage,
          };
        })
      );

      // Sync the modified matrix back to state
      setGrid(nextGrid);

      // 3. Accumulate stats and perform task tracking
      setStats(prev => {
        const nextStats = {
          money: prev.money + totalDailySolarGen, // add photosynthesized energy
          population: totalForestBiomass, // set computed weight score
          day: prev.day + 1,
          weather: newWeather,
        };

        // 4. Verify quest completion goals
        if (aiEnabledRef.current && currentGoalObj && !currentGoalObj.completed) {
          let met = false;
          
          if (currentGoalObj.targetType === 'biomass' && nextStats.population >= currentGoalObj.targetValue) {
            met = true;
          }
          if (currentGoalObj.targetType === 'energy' && nextStats.money >= currentGoalObj.targetValue) {
            met = true;
          }
          if (currentGoalObj.targetType === 'species_count' && currentGoalObj.buildingType) {
            const count = speciesCounts[currentGoalObj.buildingType] || 0;
            if (count >= currentGoalObj.targetValue) met = true;
          }
          if (currentGoalObj.targetType === 'growth_stage' && currentGoalObj.buildingType) {
            // Tracks if target value is the amount of ancient species
            const ancientCount = ancientCounts[currentGoalObj.buildingType] || 0;
            if (ancientCount >= currentGoalObj.targetValue) met = true;
          }

          if (met) {
            setCurrentGoal({ ...currentGoalObj, completed: true });
            addNewsItem({
              id: Date.now().toString(),
              text: `🔔 Challenge Accomplished! Open the Ecosystem Quests panel to claim your reward.`,
              type: 'positive'
            });
          }
        }

        return nextStats;
      });

      // Daily chance to trigger simulated ecosystem tidbits
      fetchNews();
      setDayStartTime(Date.now());

    }, tickRateMs);

    return () => clearInterval(intervalId);
  }, [fetchNews, gameStarted, tickRateMs]);


  // --- Interactive Garden Tools Handling ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; 

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool;
    
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const currentTile = currentGrid[y][x];
    const itemConfig = BUILDINGS[tool];

    // Shovel / Prune clear tile logic
    if (tool === EcosystemType.None) {
      if (currentTile.type !== EcosystemType.None) {
        if (currentStats.money >= itemConfig.cost) {
          const nextGrid = currentGrid.map(row => [...row]);
          nextGrid[y][x] = {
            ...currentTile,
            type: EcosystemType.None,
            growthStage: 0,
            growthProgress: 0
          };
          setGrid(nextGrid);
          setStats(prev => ({ ...prev, money: prev.money - itemConfig.cost }));
          
          addNewsItem({
            id: (Date.now() + Math.random()).toString(),
            text: `Shoveled soil at [${x}, ${y}], returning space to empty meadow dirt.`,
            type: 'neutral'
          });
        } else {
          addNewsItem({
            id: Date.now().toString(),
            text: "Declined shovel operation: Inefficient energy, cost: ☀️5.",
            type: 'negative'
          });
        }
      }
      return;
    }

    // Watering Can Hydration spray: saturates clicked cell and provides splash moisture to neighbors
    if (tool === EcosystemType.WateringCan) {
      if (currentStats.money >= itemConfig.cost) {
        const nextGrid = currentGrid.map((row, myY) => 
          row.map((cell, myX) => {
            // Clicked cell goes 100%
            if (myX === x && myY === y) {
              return { ...cell, moisture: 100 };
            }
            // Immediate neighbors get +40% splash moisture
            const isNeighbor = Math.abs(myX - x) + Math.abs(myY - y) === 1;
            if (isNeighbor) {
              return { ...cell, moisture: Math.min(100, cell.moisture + 40) };
            }
            return cell;
          })
        );
        setGrid(nextGrid);
        setStats(prev => ({ ...prev, money: prev.money - itemConfig.cost }));
        
        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: `Showered land at [${x}, ${y}] with fresh springwater. Soil moistures enriched.`,
          type: 'neutral'
        });
      } else {
        addNewsItem({
          id: Date.now().toString(),
          text: `Insufficient energy to water glen! Need: ☀️${itemConfig.cost}.`,
          type: 'negative'
        });
      }
      return;
    }

    // Nutrient Mulch Application: enriches clicked soil and adjacent spots
    if (tool === EcosystemType.NutrientMulch) {
      if (currentStats.money >= itemConfig.cost) {
        const nextGrid = currentGrid.map((row, myY) =>
          row.map((cell, myX) => {
            if (myX === x && myY === y) {
              return { ...cell, nutrients: 100 };
            }
            const isNeighbor = Math.abs(myX - x) + Math.abs(myY - y) === 1;
            if (isNeighbor) {
              return { ...cell, nutrients: Math.min(100, cell.nutrients + 30) };
            }
            return cell;
          })
        );
        setGrid(nextGrid);
        setStats(prev => ({ ...prev, money: prev.money - itemConfig.cost }));
        
        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: `Laid nutrient wood chips and compost at [${x}, ${y}]. Natural roots nourished.`,
          type: 'neutral'
        });
      } else {
        addNewsItem({
          id: Date.now().toString(),
          text: `Insufficient energy to spread organic peat! Need: ☀️${itemConfig.cost}.`,
          type: 'negative'
        });
      }
      return;
    }

    // Seeds Planting Logic (Pine, Oak, Cherry Blossom, Maple, Redwood)
    if (currentTile.type === EcosystemType.None) {
      if (currentStats.money >= itemConfig.cost) {
        // Plant seeds as Sprouts (Stage 1)
        const nextGrid = currentGrid.map(row => [...row]);
        nextGrid[y][x] = {
          ...currentTile,
          type: tool,
          growthStage: 1, // Start as Sprout
          growthProgress: 0,
        };
        setGrid(nextGrid);
        setStats(prev => ({ ...prev, money: prev.money - itemConfig.cost }));

        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: `Sowed seed: A fresh ${itemConfig.name} sprout has sprouted at [${x}, ${y}].`,
          type: 'positive'
        });
      } else {
        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: `Ecosystem energy pool too low for ${itemConfig.name} seed. Need: ☀️${itemConfig.cost}.`,
          type: 'negative'
        });
      }
    } else {
      addNewsItem({
        id: (Date.now() + Math.random()).toString(),
        text: "Tile occupied! Use Spade tool to prune old trees first.",
        type: 'negative'
      });
    }
  }, [selectedTool, addNewsItem, gameStarted]);

  // Claim Advisor rewards
  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      setStats(prev => ({ ...prev, money: prev.money + currentGoal.reward }));
      addNewsItem({
        id: Date.now().toString(),
        text: `Quest Claimed! Added ☀️${currentGoal.reward} Solar Energy by chief warden's decree.`,
        type: 'positive'
      });
      setCurrentGoal(null);
      fetchNewGoal(); // Queue up the next dynamic botanist request
    }
  };

  // Reset current sanctuary progress
  const handleReset = useCallback(() => {
    // We clean everything to default state
    localStorage.removeItem('eg_gameStarted');
    localStorage.removeItem('eg_aiEnabled');
    localStorage.removeItem('eg_grid');
    localStorage.removeItem('eg_stats');
    localStorage.removeItem('eg_currentGoal');
    localStorage.removeItem('eg_newsFeed');

    setGameStarted(false);
    setAiEnabled(true);
    setGrid(createInitialGrid());
    setStats({
      money: INITIAL_MONEY,
      population: 0,
      day: 1,
      weather: 'Sunny',
    });
    setDayStartTime(Date.now());
    setCurrentGoal(null);
    setNewsFeed([]);
  }, []);

  const handleStart = (enabled: boolean) => {
    setAiEnabled(enabled);
    setDayStartTime(Date.now());
    setGameStarted(true);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const activeHoveredTile = hoveredCoords ? (grid?.[hoveredCoords.y]?.[hoveredCoords.x] || null) : null;

  return (
    <div 
      onContextMenu={handleContextMenu}
      className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-emerald-950"
    >
      {/* 3D Isometric Rendering Ecosystem Layer */}
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population} // Biomass points
        weather={stats.weather}
        onHoverCoords={setHoveredCoords}
        day={stats.day}
        subDayProgress={subDayProgress}
        showFertilityHeatmap={showFertilityHeatmap}
      />
      
      {/* Overlay Home / Setup Menu */}
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {/* Main Gameplay HUD HUD/Overlay */}
      {gameStarted && (
        <UIOverlay
          stats={stats}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          hoveredTile={activeHoveredTile}
          onReset={handleReset}
          tickRateMs={tickRateMs}
          onSetTickRateMs={setTickRateMs}
          onToggleAI={() => setAiEnabled(prev => !prev)}
          subDayProgress={subDayProgress}
          showFertilityHeatmap={showFertilityHeatmap}
          onToggleFertilityHeatmap={() => setShowFertilityHeatmap(prev => !prev)}
        />
      )}

      {/* Sylvan Blueprint Selector Panel on Middle Right */}
      {gameStarted && (
        <SelectorPanel
          money={stats.money}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
        />
      )}

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .mask-image-b { -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 12%); mask-image: linear-gradient(to bottom, transparent 0%, black 12%); }
        .mask-image-h { -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); }
        
        /* Vertical writing text alignment for UI drawer tags */
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        
        /* Tailored dark-moss scrollbar controls */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(6, 78, 59, 0.15); }
        ::-webkit-scrollbar-thumb { background: rgba(52, 211, 153, 0.25); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(52, 211, 153, 0.4); }
      `}</style>
    </div>
  );
}

export default App;
