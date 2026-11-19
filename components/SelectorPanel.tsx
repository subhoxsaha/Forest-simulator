/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Trees, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Activity,
  Droplet,
  Info
} from 'lucide-react';
import { EcosystemType } from '../types';
import { BUILDINGS } from '../constants';

interface SelectorPanelProps {
  money: number;
  selectedTool: EcosystemType;
  onSelectTool: (type: EcosystemType) => void;
}

// Returns appropriate emoji indicator for species/tools
const getSelectorEmoji = (type: EcosystemType) => {
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

// Sylvan Passive Traits dictionary
const getSylvanTrait = (type: EcosystemType) => {
  switch (type) {
    case EcosystemType.Pine: return "Evergreen: High resilience to dry & hard winters.";
    case EcosystemType.Oak: return "Canopy: Promotes immense biodiversity bonus.";
    case EcosystemType.CherryBlossom: return "Solar Flare: Exceptional photosynthesis conversion.";
    case EcosystemType.Maple: return "Sylvan: Expands rapid leafing in soft autumn wind.";
    case EcosystemType.Redwood: return "Cathedral: Imposing long-life titan score anchor.";
    case EcosystemType.Bonsai: return "Chamber Zen: High nutrient seeker, zero spread.";
    case EcosystemType.Willow: return "Shed-Canopy: Multiplies growth near water channels.";
    case EcosystemType.Baobab: return "Reservoir: Conserves great moisture, avoids drought.";
    case EcosystemType.Jacaranda: return "Aura: Sky-high yields under active autumn dews.";
    case EcosystemType.Alder: return "Nitrogen Fix: Regenerates soil nutrients every night.";
    case EcosystemType.Acacia: return "Taproot: Generates nutrients on nearby fields.";
    case EcosystemType.Birch: return "Pioneer: Ultra steady biomass generation flow.";
    case EcosystemType.Bamboo: return "Joint Nodes: Phenomenon speed on wet soil.";
    case EcosystemType.Cypress: return "Reservoir-root: Automatically locks moisture levels.";
    case EcosystemType.Peepal: return "Oxygen Aura: Explodes with high solar currency yields (+19) in heat.";
    case EcosystemType.Neem: return "Medicinal: Actively disinfects soil to fertilize adjacent blocks (+3).";
    case EcosystemType.Banyan: return "Prop Roots: Deep network retains massive surrounding moisture (+8).";
    case EcosystemType.DeadTree: return "Biolyse: Spreads heavy nutrients till decayed.";
    default: return "";
  }
};

type PanelCategory = 'tools' | 'woodland' | 'adaptive';

export const SelectorPanel: React.FC<SelectorPanelProps> = ({
  money,
  selectedTool,
  onSelectTool,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<PanelCategory>('woodland');
  const [hoveredType, setHoveredType] = useState<EcosystemType | null>(null);

  // Groupings conform to the original game classification mechanics
  const toolsList = [
    EcosystemType.None,
    EcosystemType.WateringCan,
    EcosystemType.NutrientMulch,
  ];

  const woodlandList = [
    EcosystemType.Pine,
    EcosystemType.Oak,
    EcosystemType.Maple,
    EcosystemType.Birch,
    EcosystemType.CherryBlossom,
    EcosystemType.Redwood,
    EcosystemType.Peepal,
  ];

  const adaptiveList = [
    EcosystemType.Bonsai,
    EcosystemType.Willow,
    EcosystemType.Baobab,
    EcosystemType.Jacaranda,
    EcosystemType.Alder,
    EcosystemType.Acacia,
    EcosystemType.Bamboo,
    EcosystemType.Cypress,
    EcosystemType.Neem,
    EcosystemType.Banyan,
  ];

  const getItemsForCategory = () => {
    switch (activeCategory) {
      case 'tools': return toolsList;
      case 'woodland': return woodlandList;
      case 'adaptive': return adaptiveList;
    }
  };

  const getCategoryColor = (cat: PanelCategory) => {
    switch (cat) {
      case 'tools': return { text: 'text-teal-400', border: 'border-teal-500/20', bg: 'bg-teal-500/10', glow: 'shadow-[0_0_12px_rgba(20,184,166,0.3)]', active: 'border-teal-400 bg-teal-500/20' };
      case 'woodland': return { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]', active: 'border-emerald-400 bg-emerald-500/20' };
      case 'adaptive': return { text: 'text-sky-400', border: 'border-sky-500/20', bg: 'bg-sky-500/10', glow: 'shadow-[0_0_12px_rgba(14,165,233,0.3)]', active: 'border-sky-400 bg-sky-500/20' };
    }
  };

  const items = getItemsForCategory();
  const theme = getCategoryColor(activeCategory);
  
  // Highlight currently hovered node or active selection
  const activeFocusType = hoveredType || selectedTool;
  const focusConfig = BUILDINGS[activeFocusType];
  const traitText = getSylvanTrait(activeFocusType);
  const canAffordCurrent = money >= (BUILDINGS[selectedTool]?.cost || 0);

  return (
    <div className="fixed right-0 top-0 bottom-0 z-[100] flex items-center pointer-events-none select-none font-sans">
      
      {/* Collapse Handle Tab */}
      <div className="pointer-events-auto mr-[-1px] relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(prev => !prev);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-10 sm:w-12 py-3 sm:py-4 bg-slate-950/70 backdrop-blur-xl border border-white/10 hover:border-emerald-400/50 rounded-l-2xl flex flex-col justify-center items-center cursor-pointer pointer-events-auto font-sans shadow-[-5px_0_20px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-slate-900/90 group text-center gap-1.5 sm:gap-2 relative"
          title={isCollapsed ? "Expand Blueprint Dock" : "Collapse Blueprint Dock"}
        >
          {/* Active status glow dot & indicator */}
          <div className="absolute top-2 left-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${canAffordCurrent ? 'bg-emerald-400' : 'bg-amber-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${canAffordCurrent ? 'bg-emerald-500' : 'bg-amber-600'}`}></span>
            </span>
          </div>

          {/* Chevron */}
          <div className="text-emerald-400/85 group-hover:text-emerald-300 transition-colors">
            {isCollapsed ? (
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 animate-pulse" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-450" />
            )}
          </div>

          <div className="h-px w-5 sm:w-8 bg-white/15" />

          {/* Equipped Active Tool Badge on button */}
          <div className="flex flex-col items-center">
            <span className="text-[14px] sm:text-[18px] drop-shadow-[0_0_8px_rgba(255,255,255,0.25)] select-none transform hover:scale-110 transition-transform duration-200">
              {getSelectorEmoji(selectedTool)}
            </span>
            <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-tight text-amber-300 mt-1 font-mono uppercase bg-amber-400/10 px-1 rounded-sm leading-none shrink-0" title={`${BUILDINGS[selectedTool]?.name} Cost`}>
              ☀️{BUILDINGS[selectedTool]?.cost}
            </span>
          </div>
        </button>
      </div>

      {/* Floating Panel Box */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: 280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 280 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="w-[245px] min-[340px]:w-[270px] sm:w-80 h-[84vh] md:h-[90vh] max-h-[720px] mr-1 min-[340px]:mr-2 sm:mr-4 bg-slate-950/60 border border-white/10 rounded-2xl p-2.5 sm:p-3.5 shadow-[-10px_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl pointer-events-auto flex flex-col gap-2 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Ambient Tech Brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-400/40"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-400/40"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-400/40"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-400/40"></div>

            {/* Panel Heading */}
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <div className="w-2 h-1.5 rounded-full bg-emerald-400 animate-ping absolute" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[7.5px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">DOCK SELECTOR</span>
                </div>
              </div>
              <div className="flex gap-1 items-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                <span className="text-[8px] font-mono font-bold text-emerald-300">☀️ {money}</span>
              </div>
            </div>

            {/* Multi-category Filtering Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5 flex-shrink-0">
              <button
                onClick={() => setActiveCategory('tools')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 rounded-lg border transition-all duration-300 select-none cursor-pointer text-center ${
                  activeCategory === 'tools'
                    ? 'border-teal-500/35 bg-teal-500/15 text-teal-300'
                    : 'border-transparent bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 mb-0.5" />
                <span className="text-[7px] sm:text-[7.5px] font-black tracking-wider uppercase">Tools</span>
              </button>
              
              <button
                onClick={() => setActiveCategory('woodland')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 rounded-lg border transition-all duration-300 select-none cursor-pointer text-center ${
                  activeCategory === 'woodland'
                    ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                    : 'border-transparent bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trees className="w-3.5 h-3.5 mb-0.5" />
                <span className="text-[7px] sm:text-[7.5px] font-black tracking-wider uppercase">Woodland</span>
              </button>

              <button
                onClick={() => setActiveCategory('adaptive')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 rounded-lg border transition-all duration-300 select-none cursor-pointer text-center ${
                  activeCategory === 'adaptive'
                    ? 'border-sky-500/35 bg-sky-500/15 text-sky-450'
                    : 'border-transparent bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 mb-0.5" />
                <span className="text-[7px] sm:text-[7.5px] font-black tracking-wider uppercase">Exotic</span>
              </button>
            </div>

            {/* Scrollable grid of seeds and gear */}
            <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {items.map((type) => {
                const config = BUILDINGS[type];
                const isSelected = selectedTool === type;
                const isItemHovered = hoveredType === type;
                const canAfford = money >= config.cost;

                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (canAfford) onSelectTool(type);
                    }}
                    onMouseEnter={() => setHoveredType(type)}
                    onMouseLeave={() => setHoveredType(null)}
                    className={`w-full p-1.5 sm:p-2 rounded-xl border flex items-center justify-between text-left transition-all duration-200 select-none ${
                      isSelected
                        ? theme.active + ' ' + theme.glow + ' scale-[1.01]'
                        : 'border-white/5 bg-slate-900/10 hover:bg-slate-900/40 hover:border-white/10'
                    } ${!canAfford ? 'opacity-35 cursor-not-allowed border-rose-950/20' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-xl bg-slate-950/40 border ${isSelected ? 'border-amber-400/40' : 'border-white/5'} flex-shrink-0 relative`}>
                        {getSelectorEmoji(type)}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-950 shadow flex items-center justify-center">
                            <div className="w-1 h-1 bg-slate-950 rounded-full animate-ping" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] sm:text-[10px] font-black text-white leading-tight truncate">{config.name}</span>
                        <span className="text-[6.5px] sm:text-[7.5px] text-slate-400 leading-none mt-0.5 line-clamp-1">{config.description.split('.')[0]}</span>
                      </div>
                    </div>

                    <div className={`flex flex-col items-end flex-shrink-0 ${canAfford ? 'text-amber-300' : 'text-rose-455'}`}>
                      <span className="text-[8.5px] sm:text-[9.5px] font-mono font-black">☀️ {config.cost}</span>
                      <span className="text-[6px] sm:text-[6.5px] font-black tracking-tighter uppercase opacity-50 mt-1 leading-none">{isSelected ? 'Active' : !canAfford ? 'Lock' : 'Ready'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Focus Information Inspector */}
            <div className="bg-slate-950/30 p-2 sm:p-3 rounded-xl border border-white/5 flex flex-col gap-1 sm:gap-1.5 flex-shrink-0">
              <div className="flex justify-between items-start border-b border-white/5 pb-1 sm:pb-1.5">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7.3px] sm:text-[7.5px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">SPECIES BLUEPRINT</span>
                    {hoveredType && (
                      <span className="text-[6px] font-bold text-amber-400/80 px-1 py-0.2 bg-amber-400/10 rounded uppercase tracking-tighter">Preview</span>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-black text-white uppercase mt-0.5 tracking-tight">{focusConfig?.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">DOCK COST</span>
                  <span className="text-[9.5px] sm:text-[10px] font-black font-mono text-amber-300 mt-0.5 leading-none">☀️ {focusConfig?.cost}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-500 uppercase tracking-wider block">Functionality:</span>
                <p className="text-[7.5px] sm:text-[8px] text-slate-350 leading-relaxed font-sans">{focusConfig?.description}</p>
                
                {traitText && (
                  <div className="border-t border-white/5 mt-1 sm:mt-1.5 pt-1 sm:pt-1.5">
                    <span className="text-[6.5px] sm:text-[7px] font-bold text-emerald-400 uppercase tracking-wider block">Sylvan Adaptivity:</span>
                    <p className="text-[7.5px] sm:text-[8px] font-medium text-emerald-250 italic leading-snug">{traitText}</p>
                  </div>
                )}

                {/* Sylvan Growth details (only for true trees config properties) */}
                {focusConfig && focusConfig.solarGen > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-1.5 sm:mt-2 pt-1 border-t border-white/5 text-[7px] font-mono text-slate-400 justify-between">
                    <div>
                      <span className="text-slate-500 block">SOLAR:</span>
                      <span className="text-amber-300 font-extrabold">+{focusConfig.solarGen}/tick</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">BIOMASS:</span>
                      <span className="text-emerald-400 font-extrabold">+{focusConfig.healthGen}/tick</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">SPEED:</span>
                      <span className="text-cyan-400 font-extrabold">+{focusConfig.growthRate}% rate</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
