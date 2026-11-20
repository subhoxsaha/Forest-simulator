/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Trees, Sprout, Sparkles, Compass, Users } from 'lucide-react';

interface StartScreenProps {
  onStart: (options: {
    aiEnabled: boolean;
    startWithNaturalForest: boolean;
    wildSeedingEnabled: boolean;
    humansEnabled: boolean;
  }) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [startWithNaturalForest, setStartWithNaturalForest] = useState(true);
  const [wildSeedingEnabled, setWildSeedingEnabled] = useState(true);
  const [humansEnabled, setHumansEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040d0b]/70 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/20 bg-[#071512]/95 p-6 sm:p-7 shadow-2xl shadow-black/60 text-emerald-50">
        {/* Title Block */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-950/90 text-emerald-300">
            <Trees className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              EverGreen 3D
            </h1>
            <p className="text-xs text-emerald-200/75">
              4-Season Living Woodland &amp; Human History Simulator
            </p>
          </div>
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-emerald-100/80">
          Watch an algorithmic sanctuary shift smoothly through Spring, Summer, Autumn, and Winter as wildlife thrives and human settlers evolve from the dawn of history.
        </p>

        {/* Starting Terrain Mode */}
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
            Starting Sanctuary
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStartWithNaturalForest(true)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                startWithNaturalForest
                  ? 'border-emerald-400/60 bg-emerald-900/50 text-white'
                  : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-200/75 hover:border-emerald-400/30 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Trees className="h-3.5 w-3.5 text-emerald-300" />
                <span>Natural Forest</span>
              </div>
              <span className="text-[11px] leading-snug text-emerald-200/70">
                Organic groves, riverbanks &amp; wildlife ready to explore.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStartWithNaturalForest(false)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                !startWithNaturalForest
                  ? 'border-emerald-400/60 bg-emerald-900/50 text-white'
                  : 'border-emerald-500/15 bg-[#0b1e1a] text-emerald-200/75 hover:border-emerald-400/30 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Sprout className="h-3.5 w-3.5 text-amber-300" />
                <span>Blank Meadow</span>
              </div>
              <span className="text-[11px] leading-snug text-emerald-200/70">
                Untouched river valley to plant from your first seed.
              </span>
            </button>
          </div>
        </div>

        {/* Autonomous Nature & History Options */}
        <div className="mt-3.5 space-y-2">
          <button
            type="button"
            onClick={() => setHumansEnabled((prev) => !prev)}
            role="switch"
            aria-checked={humansEnabled}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-[#0b1e1a] px-3.5 py-2.5 text-left transition-colors hover:border-emerald-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <div className="text-xs font-semibold text-emerald-50">Autonomous Human History</div>
                <div className="text-[11px] text-emerald-200/70">
                  Humans evolve organically from Paleolithic foragers to Solarpunk stewards.
                </div>
              </div>
            </div>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                humansEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  humansEnabled ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setWildSeedingEnabled((prev) => !prev)}
            role="switch"
            aria-checked={wildSeedingEnabled}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-[#0b1e1a] px-3.5 py-2.5 text-left transition-colors hover:border-emerald-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-start gap-2.5">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div>
                <div className="text-xs font-semibold text-emerald-50">Wild Nature Seeding</div>
                <div className="text-[11px] text-emerald-200/70">
                  Trees naturally disperse seeds into fertile adjacent soil.
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

          <button
            type="button"
            onClick={() => setAiEnabled((prev) => !prev)}
            role="switch"
            aria-checked={aiEnabled}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-[#0b1e1a] px-3.5 py-2.5 text-left transition-colors hover:border-emerald-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <div>
                <div className="text-xs font-semibold text-emerald-50">Ecosystem Quests</div>
                <div className="text-[11px] text-emerald-200/70">
                  Earn Solar Energy bonuses for biodiversity milestones.
                </div>
              </div>
            </div>
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
        </div>

        {/* Primary Action */}
        <button
          type="button"
          onClick={() =>
            onStart({
              aiEnabled,
              startWithNaturalForest,
              wildSeedingEnabled,
              humansEnabled,
            })
          }
          className="mt-5 w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/60 transition-colors hover:bg-emerald-400 active:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
        >
          Start Simulation
        </button>
      </div>
    </div>
  );
};

export default StartScreen;
