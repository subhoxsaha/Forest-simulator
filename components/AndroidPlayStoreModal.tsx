/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  Download, 
  Share2, 
  CheckCircle2, 
  Smartphone, 
  ShieldCheck, 
  Sparkles, 
  TreePine, 
  SunMedium, 
  Droplet,
  ExternalLink
} from 'lucide-react';

interface AndroidPlayStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApkExport: () => void;
  onInstallPwa: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
}

export const AndroidPlayStoreModal: React.FC<AndroidPlayStoreModalProps> = ({
  isOpen,
  onClose,
  onOpenApkExport,
  onInstallPwa,
  isInstallable,
  isInstalled,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl max-h-[92vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 font-sans"
        >
          {/* Google Play Store Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950 flex-shrink-0">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.793 12 3.61 22.186a2.036 2.036 0 0 1-.61-1.464V3.278c0-.573.228-1.094.61-1.464zm11.603 11.603l2.673 2.673-12.023 6.941 9.35-9.614zm0-2.834L5.862.969l12.022 6.941-2.672 2.673zm1.414 1.414l3.856 2.226c1.173.677 1.173 1.777 0 2.455l-3.856 2.226-2.455-2.455 2.455-2.452z" />
              </svg>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Google Play
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'EverGreen 3D Android App',
                      text: 'Check out EverGreen 3D Forest Growing Simulator on Android!',
                      url: window.location.href,
                    }).catch(() => {});
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* App Header */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-emerald-950 border border-emerald-500/40 p-2 shadow-xl flex items-center justify-center flex-shrink-0">
                <img src="/icon.svg" alt="EverGreen Icon" className="w-full h-full object-contain" />
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                  EverGreen 3D: Forest Growth
                </h1>
                <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                  EverGreen Studio • Simulation & Eco
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                  <span>Contains simulated botanical systems</span>
                </div>

                {/* Rating & Stats Strip */}
                <div className="flex items-center gap-3 sm:gap-4 mt-3 text-center border-t border-b border-white/10 py-2">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-white">
                      <span>4.9</span>
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="text-[10px] text-slate-400">12K reviews</div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-xs font-bold text-white">100K+</div>
                    <div className="text-[10px] text-slate-400">Downloads</div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-xs font-bold text-emerald-400">Rated E</div>
                    <div className="text-[10px] text-slate-400">Everyone</div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <div className="text-xs font-bold text-white">8.4 MB</div>
                    <div className="text-[10px] text-slate-400">Size</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {isInstalled ? (
                <div className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  App Installed on Android
                </div>
              ) : isInstallable ? (
                <button
                  onClick={onInstallPwa}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Install App on Device
                </button>
              ) : (
                <button
                  onClick={onInstallPwa}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Add to Android Home Screen
                </button>
              )}

              <button
                onClick={onOpenApkExport}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition active:scale-95"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                Build Native APK / AAB
              </button>
            </div>

            {/* Feature Highlights Carousel */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-200">About this game</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Step into an interactive 3D woodland paradise. Plant seeds, irrigate drought-sensitive loam, fertilize ancient root systems, and cultivate a living, breathing forest ecosystem with adaptive Gemini AI botanical quests!
              </p>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center gap-2.5">
                  <TreePine className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] text-slate-200 font-medium">20+ Botanical Species</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center gap-2.5">
                  <SunMedium className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] text-slate-200 font-medium">Solar Photosynthesis</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center gap-2.5">
                  <Droplet className="w-4 h-4 text-sky-400" />
                  <span className="text-[11px] text-slate-200 font-medium">Soil Moisture Diffusion</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span className="text-[11px] text-slate-200 font-medium">Gemini AI Quests</span>
                </div>
              </div>
            </div>

            {/* Security Verification */}
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-[11px]">
                <div className="font-bold text-white">Play Protect Verified</div>
                <div className="text-slate-400">Zero telemetry, local storage save, safe for all ages.</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
