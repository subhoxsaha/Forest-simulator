/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ExternalLink, Smartphone, Copy, Check, Terminal, Shield, Zap, Package } from 'lucide-react';

interface AndroidApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkExportModal: React.FC<AndroidApkExportModalProps> = ({ isOpen, onClose }) => {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const bubblewrapCode = `# 1. Install Google Bubblewrap CLI
npm i -g @bubblewrap/cli

# 2. Initialize Android Project from EverGreen PWA Manifest
bubblewrap init --manifest="${window.location.origin}/manifest.webmanifest"

# 3. Build signed Android APK or Google Play AAB
bubblewrap build`;

  const capacitorCode = `# 1. Install Capacitor in your project
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor Android config
npx cap init "EverGreen 3D" "com.evergreen.simulator" --web-dir dist

# 3. Add Android platform & build APK
npx cap add android
npx cap sync
npx cap open android`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Android App Packaging & APK Export
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Play Store Ready
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Export EverGreen 3D as a native Android APK or Google Play (.AAB) bundle
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
            {/* Quick Option 1: PWA Builder (Zero-Code 1-Click) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-white">Instant 1-Click APK via PWABuilder</h3>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Microsoft & Google's official open-source tool generates a signed Android APK package directly from this URL with full Android TWA (Trusted Web Activity) support.
                  </p>
                </div>
                <a
                  href={`https://www.pwabuilder.com?url=${encodeURIComponent(window.location.origin)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Generate APK
                </a>
              </div>
            </div>

            {/* Quick Option 2: Google Bubblewrap CLI */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    Google Bubblewrap CLI (Official Google TWA)
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(bubblewrapCode, 'bubblewrap')}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 text-[11px] border border-white/10 transition"
                >
                  {copiedSection === 'bubblewrap' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy Commands
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 bg-black/60 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-white/5">
                {bubblewrapCode}
              </pre>
            </div>

            {/* Quick Option 3: Capacitor Native Bridge */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-400" />
                    Capacitor Native Android Project
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(capacitorCode, 'capacitor')}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 text-[11px] border border-white/10 transition"
                >
                  {copiedSection === 'capacitor' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy Commands
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 bg-black/60 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto leading-relaxed border border-white/5">
                {capacitorCode}
              </pre>
            </div>

            {/* Android Manifest Status */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/10 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 text-[11px]">
                  Web App Manifest: <strong className="text-white">/manifest.webmanifest</strong> (192px, 512px & maskable icons active)
                </span>
              </div>
              <a
                href="/manifest.webmanifest"
                download="manifest.json"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] flex items-center gap-1.5 transition"
              >
                <Download className="w-3 h-3" />
                Download Manifest
              </a>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-slate-950/80">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition text-xs"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
