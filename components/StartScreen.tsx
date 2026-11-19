/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';

interface StartScreenProps {
  onStart: (aiEnabled: boolean) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-sans p-6 bg-black/40 backdrop-blur-sm transition-all duration-1000">
      <div className="max-w-md w-full bg-emerald-950/90 p-8 rounded-3xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)] backdrop-blur-2xl relative overflow-hidden animate-fade-in">
        {/* Poetic background ambient glows */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 text-center">
            {/* Elegant Nature Icon Badge */}
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-800/60 rounded-full border border-emerald-400/40 mb-4 shadow-inner text-2xl">
              🌿
            </div>

            <h1 className="text-4xl font-extrabold mb-1 bg-gradient-to-br from-white via-emerald-100 to-teal-300 bg-clip-text text-transparent tracking-tight leading-none font-display">
              EverGreen 3D
            </h1>
            <p className="text-emerald-400 mb-8 text-xs font-bold uppercase tracking-widest leading-relaxed">
              Ecosystem & Tree Growth Simulator
            </p>

            <div className="text-left text-xs text-emerald-200/80 mb-6 space-y-2 bg-emerald-900/40 p-4 rounded-xl border border-emerald-800/50">
              <p>🌱 Planting seeds generates tiny <strong className="text-white">Sprouts</strong> which grow sequentially into mature foliage trees.</p>
              <p>💧 Soil moisture and nutrient parameters drive tree growth. Use your <strong className="text-white">Watering Can</strong> and <strong className="text-white">Mulch</strong>!</p>
              <p>☀️ Grow trees to harvest <strong className="text-white">Solar Energy</strong> and raise total <strong className="text-white">Ecosystem Biomass</strong>.</p>
            </div>

            <div className="bg-emerald-900/60 p-4 rounded-xl border border-emerald-700/40 mb-8 hover:border-emerald-600/60 transition-colors shadow-inner text-left">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors flex items-center gap-1.5">
                    Ecosystem Challenges
                    {aiEnabled && <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                  </span>
                  <span className="text-[11px] text-emerald-300/70 group-hover:text-emerald-300 transition-colors">
                    Receive procedural botanical challenges, news notifications, and woodland quests.
                  </span>
                </div>
                
                <div className="relative flex-shrink-0">
                  <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-emerald-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-400/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-emerald-300 after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                </div>
              </label>
            </div>

            <button 
              onClick={() => onStart(aiEnabled)}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-950/40 transform transition-all hover:scale-[1.02] active:scale-[0.98] text-base tracking-wide"
            >
              Cultivate Sanctuary
            </button>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
