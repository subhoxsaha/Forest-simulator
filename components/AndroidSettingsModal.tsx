/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Vibrate, 
  Volume2, 
  VolumeX, 
  Gauge, 
  Smartphone, 
  Trash2, 
  Palette, 
  Check, 
  Info,
  Navigation
} from 'lucide-react';
import { androidHaptics } from '../services/haptics';
import { ecosystemAudio } from '../services/audio';

interface AndroidSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallpaper: string;
  onSelectWallpaper: (wp: string) => void;
  navMode: 'gestures' | 'buttons';
  onSelectNavMode: (mode: 'gestures' | 'buttons') => void;
  onResetGame: () => void;
}

export const wallpapersList = [
  { id: 'emerald', name: 'Emerald Canopy', bg: 'from-emerald-950 via-teal-950 to-slate-950', accent: '#10b981' },
  { id: 'midnight', name: 'Midnight Pines', bg: 'from-slate-950 via-indigo-950 to-emerald-950', accent: '#6366f1' },
  { id: 'bamboo', name: 'Bamboo Mist', bg: 'from-teal-950 via-emerald-900 to-green-950', accent: '#14b8a6' },
  { id: 'solar', name: 'Golden Sol', bg: 'from-amber-950 via-orange-950 to-slate-950', accent: '#f59e0b' },
];

export const AndroidSettingsModal: React.FC<AndroidSettingsModalProps> = ({
  isOpen,
  onClose,
  wallpaper,
  onSelectWallpaper,
  navMode,
  onSelectNavMode,
  onResetGame,
}) => {
  const [hapticsOn, setHapticsOn] = React.useState(androidHaptics.isEnabled());
  const [audioMuted, setAudioMuted] = React.useState(ecosystemAudio.getMuted());
  const [volume, setVolume] = React.useState(Math.round(ecosystemAudio.getVolume() * 100));

  if (!isOpen) return null;

  const toggleHaptics = (val: boolean) => {
    setHapticsOn(val);
    androidHaptics.setEnabled(val);
    if (val) androidHaptics.trigger('heavy');
  };

  const toggleAudio = (val: boolean) => {
    setAudioMuted(val);
    ecosystemAudio.setMute(val);
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    ecosystemAudio.setVolume(newVal / 100);
    if (audioMuted && newVal > 0) {
      setAudioMuted(false);
      ecosystemAudio.setMute(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-emerald-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Android System & Simulation Settings</h2>
                <p className="text-[11px] text-slate-400">EverGreen Android OS Preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
            {/* Sound & Haptics Section */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Sound & Vibration
              </h3>

              {/* Volume Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Master Audio Volume</span>
                  <span className="font-mono text-emerald-400">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Mute toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-300 flex items-center gap-2">
                  {audioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  Mute All Audio
                </span>
                <input
                  type="checkbox"
                  checked={audioMuted}
                  onChange={(e) => toggleAudio(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Haptics toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[11px] text-slate-300 flex items-center gap-2">
                  <Vibrate className="w-4 h-4 text-teal-400" />
                  Tactile Haptic Feedback
                </span>
                <input
                  type="checkbox"
                  checked={hapticsOn}
                  onChange={(e) => toggleHaptics(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Navigation Bar Style */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" /> System Navigation Style
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSelectNavMode('gestures')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    navMode === 'gestures'
                      ? 'border-emerald-500 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>Gesture Bar</span>
                    {navMode === 'gestures' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400">Android 14+ navigation pill with swipe gestures</span>
                </button>

                <button
                  onClick={() => onSelectNavMode('buttons')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    navMode === 'buttons'
                      ? 'border-emerald-500 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>3-Button Bar</span>
                    {navMode === 'buttons' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400">Classic Android Back ◀, Home ⚪, Recents ◻ buttons</span>
                </button>
              </div>
            </div>

            {/* Wallpaper Selection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-400" /> Android Home Wallpaper
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {wallpapersList.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => onSelectWallpaper(wp.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition text-left ${
                      wallpaper === wp.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                        : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg bg-gradient-to-br ${wp.bg} border border-white/20 flex-shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[11px] truncate">{wp.name}</div>
                    </div>
                    {wallpaper === wp.id && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Storage & Reset */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  Reset Simulation Storage
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to reset your EverGreen forest sanctuary?")) {
                      onResetGame();
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Data
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-slate-950">
            <span className="text-[10px] text-slate-500">EverGreen Android OS Build 2.4.0</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition text-xs"
            >
              Save & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
