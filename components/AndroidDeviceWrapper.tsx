/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  BatteryCharging, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  Sun, 
  Moon, 
  RotateCw, 
  Search, 
  Mic, 
  Camera, 
  Settings, 
  Sliders, 
  Maximize2, 
  Minimize2, 
  Download, 
  Package, 
  X, 
  Check, 
  Play, 
  Pause, 
  Sparkles, 
  TreePine, 
  Layers, 
  Smartphone, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Radio,
  Flame,
  Circle,
  Square,
  Triangle
} from 'lucide-react';
import { androidHaptics } from '../services/haptics';
import { ecosystemAudio } from '../services/audio';
import { usePWAInstall } from '../services/usePWAInstall';
import { AndroidApkExportModal } from './AndroidApkExportModal';
import { AndroidPlayStoreModal } from './AndroidPlayStoreModal';
import { AndroidSettingsModal, wallpapersList } from './AndroidSettingsModal';
import { CityStats } from '../types';

export type DeviceModel = 'pixel' | 'galaxy' | 'tablet' | 'fullscreen';
export type Orientation = 'portrait' | 'landscape';
export type NavStyle = 'gestures' | 'buttons';

interface AndroidDeviceWrapperProps {
  children: React.ReactNode;
  stats?: CityStats;
  onResetGame: () => void;
}

export const AndroidDeviceWrapper: React.FC<AndroidDeviceWrapperProps> = ({
  children,
  stats,
  onResetGame,
}) => {
  // Device Frame States
  const [deviceModel, setDeviceModel] = useState<DeviceModel>(() => {
    try {
      const saved = localStorage.getItem('android_device_model');
      return (saved as DeviceModel) || 'pixel';
    } catch {
      return 'pixel';
    }
  });

  const [orientation, setOrientation] = useState<Orientation>(() => {
    try {
      const saved = localStorage.getItem('android_orientation');
      return (saved as Orientation) || 'portrait';
    } catch {
      return 'portrait';
    }
  });

  const [navStyle, setNavStyle] = useState<NavStyle>(() => {
    try {
      const saved = localStorage.getItem('android_nav_style');
      return (saved as NavStyle) || 'gestures';
    } catch {
      return 'gestures';
    }
  });

  const [scaleMode, setScaleMode] = useState<'fit' | '100' | '85' | '75'>('fit');
  const [fitScale, setFitScale] = useState<number>(1);

  // Android OS States
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [isHomeScreen, setIsHomeScreen] = useState(false);
  const [isRecentsOpen, setIsRecentsOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [activeWallpaper, setActiveWallpaper] = useState('emerald');

  // Android Dynamic Pill (Punch-hole) notification
  const [pillNotice, setPillNotice] = useState<{ icon: string; text: string; sub?: string } | null>(null);

  // Floating Android Volume Slider
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(Math.round(ecosystemAudio.getVolume() * 100));
  const volumeTimeoutRef = useRef<any>(null);

  // Quick Settings Toggles
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(androidHaptics.isEnabled());
  const [audioMuted, setAudioMuted] = useState(ecosystemAudio.getMuted());
  const [brightness, setBrightness] = useState(100);

  // Modals
  const [showApkModal, setShowApkModal] = useState(false);
  const [showPlayStoreModal, setShowPlayStoreModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // PWA Install Hook
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();

  // Clock
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('android_device_model', deviceModel);
  }, [deviceModel]);

  useEffect(() => {
    localStorage.setItem('android_orientation', orientation);
  }, [orientation]);

  useEffect(() => {
    localStorage.setItem('android_nav_style', navStyle);
  }, [navStyle]);

  // Window resize to calculate auto-fit scale
  useEffect(() => {
    const calcScale = () => {
      if (scaleMode !== 'fit' || deviceModel === 'fullscreen') {
        const val = scaleMode === '100' ? 1 : scaleMode === '85' ? 0.85 : 0.75;
        setFitScale(val);
        return;
      }

      // Height of target device
      let baseHeight = orientation === 'portrait' ? 892 : 460;
      let baseWidth = orientation === 'portrait' ? 412 : 920;

      if (deviceModel === 'tablet') {
        baseWidth = orientation === 'portrait' ? 700 : 960;
        baseHeight = orientation === 'portrait' ? 960 : 680;
      }

      // Extra room for frame bezel (~50px) and top control toolbar (~60px)
      const availH = window.innerHeight - 85;
      const availW = window.innerWidth - 30;

      const scaleH = availH / (baseHeight + 40);
      const scaleW = availW / (baseWidth + 40);
      const computed = Math.min(1.0, Math.max(0.48, Math.min(scaleH, scaleW)));
      setFitScale(computed);
    };

    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, [scaleMode, orientation, deviceModel]);

  // Dynamic Island notice triggers from custom events or stats changes
  useEffect(() => {
    if (!stats) return;
    if (stats.day > 1) {
      triggerPillNotice('☀️', `Day ${stats.day} Dawn`, `Weather: ${stats.weather}`);
    }
  }, [stats?.day]);

  useEffect(() => {
    if (!stats) return;
    if (stats.weather) {
      const wIcon = stats.weather === 'Raining' ? '🌧️' : stats.weather === 'Windy' ? '🍃' : '☀️';
      triggerPillNotice(wIcon, `Climate: ${stats.weather}`, `Solar gen updated`);
    }
  }, [stats?.weather]);

  const triggerPillNotice = (icon: string, text: string, sub?: string) => {
    setPillNotice({ icon, text, sub });
    androidHaptics.trigger('light');
    setTimeout(() => {
      setPillNotice(null);
    }, 3800);
  };

  // Hardware buttons handlers
  const handleVolumeChange = (delta: number) => {
    const newVol = Math.max(0, Math.min(100, currentVolume + delta));
    setCurrentVolume(newVol);
    ecosystemAudio.setVolume(newVol / 100);
    if (audioMuted && newVol > 0) {
      setAudioMuted(false);
      ecosystemAudio.setMute(false);
    }
    androidHaptics.trigger('light');
    setShowVolumeSlider(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 2400);
  };

  const handlePowerButton = () => {
    androidHaptics.trigger('medium');
    setIsScreenLocked((prev) => !prev);
  };

  // Navigation handlers
  const handleHomeClick = () => {
    androidHaptics.trigger('light');
    setIsRecentsOpen(false);
    setIsQuickSettingsOpen(false);
    setIsHomeScreen(true);
  };

  const handleBackClick = () => {
    androidHaptics.trigger('light');
    if (isQuickSettingsOpen) {
      setIsQuickSettingsOpen(false);
      return;
    }
    if (isRecentsOpen) {
      setIsRecentsOpen(false);
      return;
    }
    if (isHomeScreen) {
      setIsHomeScreen(false);
      return;
    }
  };

  const handleRecentsClick = () => {
    androidHaptics.trigger('medium');
    setIsQuickSettingsOpen(false);
    setIsRecentsOpen((prev) => !prev);
  };

  const handleLaunchEverGreen = () => {
    androidHaptics.trigger('success');
    setIsHomeScreen(false);
    setIsRecentsOpen(false);
    triggerPillNotice('🌿', 'EverGreen 3D Resumed', 'Woodland simulation active');
  };

  // Device dimensions
  const getDeviceDimensions = () => {
    if (deviceModel === 'fullscreen') {
      return { width: '100vw', height: '100vh', rx: '0px' };
    }
    if (deviceModel === 'tablet') {
      return orientation === 'portrait'
        ? { width: 720, height: 960, rx: '36px' }
        : { width: 980, height: 680, rx: '36px' };
    }
    // Pixel & Galaxy Phone
    return orientation === 'portrait'
      ? { width: 412, height: 892, rx: deviceModel === 'galaxy' ? '28px' : '44px' }
      : { width: 892, height: 412, rx: deviceModel === 'galaxy' ? '28px' : '44px' };
  };

  const dims = getDeviceDimensions();
  const currentWp = wallpapersList.find((w) => w.id === activeWallpaper) || wallpapersList[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none flex flex-col items-center justify-start">
      {/* ============================================================== */}
      {/* TOP DESKTOP TOOLBAR (Device controls, PWA install, APK export) */}
      {/* ============================================================== */}
      <header className="w-full z-50 flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-white/10 text-slate-200 text-xs shadow-md backdrop-blur-md flex-shrink-0">
        {/* Left: Brand & Device Preset */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 pr-2 border-r border-white/10">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xs">
              🤖
            </span>
            <span className="font-extrabold text-white text-xs tracking-tight hidden sm:inline">
              EverGreen <span className="text-emerald-400 font-mono">Android OS</span>
            </span>
          </div>

          {/* Model Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-white/10">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value as DeviceModel)}
              className="bg-transparent text-white text-[11px] font-semibold outline-none cursor-pointer"
            >
              <option value="pixel" className="bg-slate-900 text-white">Google Pixel 9 Pro</option>
              <option value="galaxy" className="bg-slate-900 text-white">Samsung Galaxy S24 Ultra</option>
              <option value="tablet" className="bg-slate-900 text-white">Android Tablet</option>
              <option value="fullscreen" className="bg-slate-900 text-white">Full Screen (Direct PWA)</option>
            </select>
          </div>

          {/* Orientation Toggle */}
          {deviceModel !== 'fullscreen' && (
            <button
              onClick={() => {
                androidHaptics.trigger('light');
                setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
              }}
              title="Toggle Portrait / Landscape"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-[11px] font-medium text-slate-200 transition active:scale-95"
            >
              <RotateCw className="w-3 h-3 text-cyan-400" />
              <span className="hidden md:inline">{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
            </button>
          )}

          {/* Scale Selector */}
          {deviceModel !== 'fullscreen' && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-white/10 text-[11px]">
              <span className="text-slate-400">Scale:</span>
              <select
                value={scaleMode}
                onChange={(e) => setScaleMode(e.target.value as any)}
                className="bg-transparent text-emerald-400 font-mono font-bold outline-none cursor-pointer"
              >
                <option value="fit" className="bg-slate-900">Auto-Fit</option>
                <option value="100" className="bg-slate-900">100%</option>
                <option value="85" className="bg-slate-900">85%</option>
                <option value="75" className="bg-slate-900">75%</option>
              </select>
            </div>
          )}
        </div>

        {/* Right Actions: Google Play, APK Export, Install PWA */}
        <div className="flex items-center gap-2">
          {/* Google Play Store button */}
          <button
            onClick={() => {
              androidHaptics.trigger('light');
              setShowPlayStoreModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.609 1.814L13.793 12 3.61 22.186a2.036 2.036 0 0 1-.61-1.464V3.278c0-.573.228-1.094.61-1.464zm11.603 11.603l2.673 2.673-12.023 6.941 9.35-9.614zm0-2.834L5.862.969l12.022 6.941-2.672 2.673zm1.414 1.414l3.856 2.226c1.173.677 1.173 1.777 0 2.455l-3.856 2.226-2.455-2.455 2.455-2.452z" />
            </svg>
            <span className="hidden sm:inline">Play Store</span>
          </button>

          {/* Export APK button */}
          <button
            onClick={() => {
              androidHaptics.trigger('light');
              setShowApkModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-cyan-300 font-bold text-[11px] transition active:scale-95"
          >
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export APK</span>
          </button>

          {/* Install PWA button */}
          <button
            onClick={() => {
              androidHaptics.trigger('medium');
              if (isInstallable) {
                install();
              } else {
                setShowPlayStoreModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstalled ? 'Installed' : 'Install PWA'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN CONTAINER: Centered Android Device Frame                  */}
      {/* ============================================================== */}
      <main className="flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden relative">
        {/* Subtle background ambient desk glow */}
        <div className="absolute inset-0 bg-radial from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none" />

        {/* Scaled Device Wrapper */}
        <div
          style={{
            transform: deviceModel === 'fullscreen' ? 'none' : `scale(${fitScale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative flex items-center justify-center"
        >
          {/* HARDWARE BUTTONS on the Outer Frame (Volume Rocker + Power Button) */}
          {deviceModel !== 'fullscreen' && (
            <>
              {/* Right Side Buttons (Power & Volume) */}
              <div
                className={`absolute ${
                  orientation === 'portrait' ? '-right-[14px] top-28' : '-top-[14px] right-32 flex flex-row'
                } flex flex-col gap-3 z-30`}
              >
                {/* Power Button */}
                <button
                  onClick={handlePowerButton}
                  title="Android Power Button (Sleep/Wake)"
                  className="w-3.5 h-14 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-800 rounded-r-md border border-slate-500/40 shadow-md active:scale-95 transition hover:brightness-125 cursor-pointer"
                />

                {/* Volume Rocker (Up & Down) */}
                <div className="flex flex-col bg-slate-800 rounded-r-md border border-slate-500/40 overflow-hidden shadow-md">
                  <button
                    onClick={() => handleVolumeChange(10)}
                    title="Volume Up"
                    className="w-3.5 h-12 bg-slate-700 hover:bg-slate-600 active:bg-emerald-500 transition cursor-pointer"
                  />
                  <div className="w-full h-px bg-slate-900" />
                  <button
                    onClick={() => handleVolumeChange(-10)}
                    title="Volume Down"
                    className="w-3.5 h-12 bg-slate-700 hover:bg-slate-600 active:bg-emerald-500 transition cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* CHASSIS FRAME (Bezel, Titanium Rim, Screen Border)           */}
          {/* ============================================================ */}
          <div
            style={{
              width: typeof dims.width === 'number' ? `${dims.width + 24}px` : dims.width,
              height: typeof dims.height === 'number' ? `${dims.height + 24}px` : dims.height,
              borderRadius: deviceModel === 'fullscreen' ? '0px' : deviceModel === 'galaxy' ? '32px' : '52px',
            }}
            className={`relative flex items-center justify-center ${
              deviceModel === 'fullscreen'
                ? 'p-0 w-full h-full'
                : 'p-[12px] bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_0_2px_rgba(255,255,255,0.08),inset_0_0_0_2px_rgba(0,0,0,0.8)] border border-slate-700/60'
            }`}
          >
            {/* Top Speaker Slit for Phone */}
            {deviceModel !== 'fullscreen' && orientation === 'portrait' && (
              <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-800 rounded-full border border-black/40 z-40" />
            )}

            {/* ========================================================== */}
            {/* ANDROID SCREEN VIEWPORT                                     */}
            {/* ========================================================== */}
            <div
              style={{
                width: typeof dims.width === 'number' ? `${dims.width}px` : '100%',
                height: typeof dims.height === 'number' ? `${dims.height}px` : '100%',
                borderRadius: dims.rx,
              }}
              className="relative overflow-hidden bg-black flex flex-col shadow-inner select-none"
            >
              {/* Optional Flashlight boost overlay */}
              {flashlightOn && (
                <div className="absolute inset-0 bg-amber-100/15 pointer-events-none z-30 mix-blend-screen" />
              )}

              {/* ======================================================== */}
              {/* ANDROID STATUS BAR (Top)                                */}
              {/* ======================================================== */}
              <div
                onClick={() => {
                  androidHaptics.trigger('light');
                  setIsQuickSettingsOpen((prev) => !prev);
                }}
                className="relative w-full h-8 z-40 flex items-center justify-between px-4 text-[11px] font-bold text-white bg-gradient-to-b from-black/85 via-black/40 to-transparent cursor-pointer select-none transition-colors hover:bg-black/40"
              >
                {/* Left: Time & notification icons */}
                <div className="flex items-center gap-2">
                  <span className="tracking-tight font-medium">{timeStr}</span>
                  <div className="flex items-center gap-1.5 opacity-80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <TreePine className="w-3 h-3 text-emerald-400" />
                    {stats && (
                      <span className="text-[9px] font-mono text-emerald-300 hidden sm:inline">
                        D{stats.day}
                      </span>
                    )}
                  </div>
                </div>

                {/* Center: Punch-Hole Camera & Interactive Dynamic Pill */}
                <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-50">
                  <AnimatePresence>
                    {pillNotice ? (
                      <motion.div
                        initial={{ width: 30, height: 18, opacity: 0 }}
                        animate={{ width: 'auto', height: 26, opacity: 1 }}
                        exit={{ width: 30, height: 18, opacity: 0 }}
                        className="px-3 py-1 bg-slate-900/95 border border-emerald-500/40 rounded-full flex items-center gap-2 shadow-lg shadow-black/80 backdrop-blur-xl"
                      >
                        <span className="text-xs">{pillNotice.icon}</span>
                        <div className="flex flex-col text-left leading-none">
                          <span className="text-[10px] font-bold text-emerald-300">{pillNotice.text}</span>
                          {pillNotice.sub && (
                            <span className="text-[8px] text-slate-400 font-mono">{pillNotice.sub}</span>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 bg-black rounded-full border border-slate-800 shadow-inner flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-slate-900 rounded-full border border-cyan-500/20" />
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right: Android System Status Icons */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold text-slate-300">5G</span>
                  <Wifi className="w-3.5 h-3.5 text-white" />
                  {audioMuted && <VolumeX className="w-3 h-3 text-rose-400" />}
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] font-mono">94%</span>
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* ANDROID QUICK SETTINGS & NOTIFICATION SHADE              */}
              {/* ======================================================== */}
              <AnimatePresence>
                {isQuickSettingsOpen && (
                  <motion.div
                    initial={{ y: '-100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col text-white p-4 overflow-y-auto custom-scrollbar"
                  >
                    {/* Pull-down header */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <div className="text-2xl font-light font-display">{timeStr}</div>
                        <div className="text-xs text-emerald-400">
                          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            androidHaptics.trigger('light');
                            setShowSettingsModal(true);
                          }}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setIsQuickSettingsOpen(false)}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Settings 4x2 Grid */}
                    <div className="grid grid-cols-2 gap-2.5 my-4">
                      {/* Internet Tile */}
                      <div className="p-3 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center gap-3">
                        <Wifi className="w-5 h-5 text-emerald-400" />
                        <div className="text-left">
                          <div className="text-xs font-bold">EverGreen Net</div>
                          <div className="text-[10px] text-emerald-300">5G Sylvan Mesh</div>
                        </div>
                      </div>

                      {/* Sound Tile */}
                      <button
                        onClick={() => {
                          const next = !audioMuted;
                          setAudioMuted(next);
                          ecosystemAudio.setMute(next);
                          androidHaptics.trigger('medium');
                        }}
                        className={`p-3 rounded-2xl border flex items-center gap-3 transition text-left ${
                          !audioMuted
                            ? 'bg-emerald-600/30 border-emerald-500/40 text-white'
                            : 'bg-slate-900 border-white/10 text-slate-400'
                        }`}
                      >
                        {!audioMuted ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
                        <div>
                          <div className="text-xs font-bold">Sound</div>
                          <div className="text-[10px] text-slate-400">{!audioMuted ? `${currentVolume}%` : 'Muted'}</div>
                        </div>
                      </button>

                      {/* Haptics Tile */}
                      <button
                        onClick={() => {
                          const next = !hapticsEnabled;
                          setHapticsEnabled(next);
                          androidHaptics.setEnabled(next);
                          if (next) androidHaptics.trigger('heavy');
                        }}
                        className={`p-3 rounded-2xl border flex items-center gap-3 transition text-left ${
                          hapticsEnabled
                            ? 'bg-emerald-600/30 border-emerald-500/40 text-white'
                            : 'bg-slate-900 border-white/10 text-slate-400'
                        }`}
                      >
                        <Vibrate className="w-5 h-5 text-cyan-400" />
                        <div>
                          <div className="text-xs font-bold">Vibration</div>
                          <div className="text-[10px] text-slate-400">{hapticsEnabled ? 'Active' : 'Off'}</div>
                        </div>
                      </button>

                      {/* Flashlight / Sun Glow */}
                      <button
                        onClick={() => {
                          setFlashlightOn((prev) => !prev);
                          androidHaptics.trigger('light');
                        }}
                        className={`p-3 rounded-2xl border flex items-center gap-3 transition text-left ${
                          flashlightOn
                            ? 'bg-amber-500/30 border-amber-400/50 text-amber-200'
                            : 'bg-slate-900 border-white/10 text-slate-400'
                        }`}
                      >
                        <Sun className="w-5 h-5 text-amber-400" />
                        <div>
                          <div className="text-xs font-bold">Flashlight</div>
                          <div className="text-[10px] text-slate-400">{flashlightOn ? 'Glowing' : 'Off'}</div>
                        </div>
                      </button>
                    </div>

                    {/* Volume Slider in Shade */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/5 space-y-2 mb-4">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> System Audio
                        </span>
                        <span className="font-mono text-emerald-400">{currentVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentVolume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setCurrentVolume(v);
                          ecosystemAudio.setVolume(v / 100);
                          if (audioMuted && v > 0) {
                            setAudioMuted(false);
                            ecosystemAudio.setMute(false);
                          }
                        }}
                        className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    {/* Android Notifications Stack */}
                    <div className="space-y-2 flex-1">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Android Notifications
                      </div>

                      {/* Simulation Notification Card */}
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TreePine className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-white">EverGreen Simulation</span>
                          </div>
                          <span className="text-[10px] text-slate-400">now</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Woodland sanctuary active. Biomass: <strong className="text-emerald-400">{stats?.population || 0} kg</strong> • Solar Energy: <strong className="text-amber-400">☀️{stats?.money || 0}</strong>.
                        </p>
                      </div>

                      {/* Play Store Info Card */}
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-white">Android Application Bundle</span>
                          </div>
                          <span className="text-[10px] text-slate-400">v2.4.0</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          PWA manifest active. Ready for native APK packaging via Bubblewrap or Capacitor.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ======================================================== */}
              {/* FLOATING ANDROID VOLUME SLIDER (Right side)              */}
              {/* ======================================================== */}
              <AnimatePresence>
                {showVolumeSlider && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute right-3 top-24 z-50 bg-slate-900/90 border border-white/20 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-2 w-11"
                  >
                    <div className="text-[9px] font-mono text-emerald-400 font-bold">{currentVolume}</div>
                    <div className="h-28 w-2 bg-slate-800 rounded-full relative overflow-hidden flex flex-col justify-end">
                      <div
                        style={{ height: `${currentVolume}%` }}
                        className="w-full bg-emerald-400 rounded-full transition-all"
                      />
                    </div>
                    {audioMuted || currentVolume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ======================================================== */}
              {/* SCREEN CONTENT: 1) GAME, 2) HOME SCREEN, 3) RECENTS     */}
              {/* ======================================================== */}
              <div className="relative flex-1 w-full overflow-hidden flex flex-col">
                {/* 1. RUNNING GAME VIEW */}
                <div
                  className={`w-full h-full transition-all duration-300 ${
                    isHomeScreen || isRecentsOpen ? 'scale-90 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
                  }`}
                >
                  {children}
                </div>

                {/* 2. ANDROID HOME SCREEN LAUNCHER */}
                <AnimatePresence>
                  {isHomeScreen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      className={`absolute inset-0 z-30 bg-gradient-to-br ${currentWp.bg} flex flex-col justify-between p-6 text-white`}
                    >
                      {/* Top: Google Search & Weather Widget */}
                      <div className="space-y-4 pt-6">
                        {/* At a Glance Widget */}
                        <div className="flex flex-col text-left space-y-0.5">
                          <div className="text-3xl font-light font-display">{timeStr}</div>
                          <div className="text-xs text-emerald-300 font-medium">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                          </div>
                          <div className="text-[11px] text-slate-300 flex items-center gap-1.5 pt-0.5">
                            <span>🌤️ 72°F</span>
                            <span>•</span>
                            <span className="text-emerald-400">EverGreen Forest: Healthy</span>
                          </div>
                        </div>

                        {/* Google Pill Search Bar Widget */}
                        <div className="w-full bg-white/10 hover:bg-white/15 border border-white/15 rounded-full px-4 py-2.5 flex items-center justify-between shadow-lg backdrop-blur-md transition">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">G</span>
                            <span className="text-xs text-slate-300">Search sanctuary or ask AI...</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-slate-300">
                            <Mic className="w-4 h-4 hover:text-white cursor-pointer" />
                            <Camera className="w-4 h-4 hover:text-white cursor-pointer" />
                          </div>
                        </div>
                      </div>

                      {/* Middle: Android Home Apps Grid */}
                      <div className="grid grid-cols-4 gap-4 text-center my-auto py-4">
                        {/* EverGreen 3D (Main Game Icon) */}
                        <button
                          onClick={handleLaunchEverGreen}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-90 transition"
                        >
                          <div className="relative w-14 h-14 rounded-2xl bg-emerald-950 border-2 border-emerald-400 p-1.5 shadow-xl shadow-emerald-500/20 group-hover:scale-105 transition">
                            <img src="/icon.svg" alt="EverGreen" className="w-full h-full object-contain" />
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping" />
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                          </div>
                          <span className="text-[11px] font-bold text-white tracking-tight">EverGreen 3D</span>
                        </button>

                        {/* Google Play Store */}
                        <button
                          onClick={() => {
                            androidHaptics.trigger('light');
                            setShowPlayStoreModal(true);
                          }}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-90 transition"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/20 p-3 shadow-lg flex items-center justify-center group-hover:scale-105 transition">
                            <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3.609 1.814L13.793 12 3.61 22.186a2.036 2.036 0 0 1-.61-1.464V3.278c0-.573.228-1.094.61-1.464zm11.603 11.603l2.673 2.673-12.023 6.941 9.35-9.614zm0-2.834L5.862.969l12.022 6.941-2.672 2.673zm1.414 1.414l3.856 2.226c1.173.677 1.173 1.777 0 2.455l-3.856 2.226-2.455-2.455 2.455-2.452z" />
                            </svg>
                          </div>
                          <span className="text-[11px] font-medium text-slate-200">Play Store</span>
                        </button>

                        {/* Android Settings */}
                        <button
                          onClick={() => {
                            androidHaptics.trigger('light');
                            setShowSettingsModal(true);
                          }}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-90 transition"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/20 p-3 shadow-lg flex items-center justify-center group-hover:scale-105 transition">
                            <Settings className="w-7 h-7 text-slate-200" />
                          </div>
                          <span className="text-[11px] font-medium text-slate-200">Settings</span>
                        </button>

                        {/* APK Packaging */}
                        <button
                          onClick={() => {
                            androidHaptics.trigger('light');
                            setShowApkModal(true);
                          }}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-90 transition"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-400/30 p-3 shadow-lg flex items-center justify-center group-hover:scale-105 transition">
                            <Package className="w-7 h-7 text-cyan-400" />
                          </div>
                          <span className="text-[11px] font-medium text-slate-200">Export APK</span>
                        </button>
                      </div>

                      {/* Bottom Dock */}
                      <div className="w-full bg-white/10 border border-white/10 rounded-3xl p-3 flex items-center justify-around backdrop-blur-md">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-base">
                          📞
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-base">
                          💬
                        </div>
                        <button
                          onClick={handleLaunchEverGreen}
                          className="w-12 h-12 rounded-xl bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center p-1 shadow-lg active:scale-95 transition"
                        >
                          <img src="/icon.svg" alt="EverGreen" className="w-full h-full object-contain" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white text-base">
                          🌐
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white text-base">
                          📷
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3. ANDROID RECENTS / MULTITASKING CAROUSEL */}
                <AnimatePresence>
                  {isRecentsOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-30 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 text-white"
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Running Android Apps
                      </div>

                      {/* App Card Preview */}
                      <motion.div
                        initial={{ scale: 0.85, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="w-64 sm:w-72 h-96 bg-slate-900 border border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                      >
                        <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <TreePine className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-white">EverGreen 3D</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono">Running</span>
                        </div>
                        <div
                          onClick={handleLaunchEverGreen}
                          className="flex-1 bg-gradient-to-br from-emerald-950 to-slate-950 p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:brightness-110 transition"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-400/50 p-2 shadow-xl mb-3">
                            <img src="/icon.svg" alt="EverGreen" className="w-full h-full object-contain" />
                          </div>
                          <div className="text-sm font-bold text-white">Cultivating Forest</div>
                          <div className="text-xs text-emerald-300 mt-1">Tap to resume simulation</div>
                        </div>
                      </motion.div>

                      {/* Recents Actions */}
                      <div className="flex items-center gap-3 mt-5">
                        <button
                          onClick={handleLaunchEverGreen}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                        >
                          Resume Game
                        </button>
                        <button
                          onClick={() => {
                            setIsRecentsOpen(false);
                            setIsHomeScreen(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
                        >
                          Close All
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 4. ALWAYS-ON DISPLAY / SCREEN LOCK OVERLAY */}
                <AnimatePresence>
                  {isScreenLocked && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={handlePowerButton}
                      className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white cursor-pointer select-none"
                    >
                      <div className="text-5xl font-extralight font-display tracking-tight mb-2">{timeStr}</div>
                      <div className="text-xs text-slate-400 mb-6">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <BatteryCharging className="w-4 h-4" />
                        <span>94% • Charging</span>
                      </div>
                      <div className="mt-12 text-[11px] text-slate-600 animate-pulse">
                        Tap anywhere or click Power to wake
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ======================================================== */}
              {/* ANDROID SYSTEM NAVIGATION BAR (Bottom)                  */}
              {/* ======================================================== */}
              <div className="w-full h-9 bg-black/90 flex items-center justify-center px-6 z-40 select-none flex-shrink-0">
                {navStyle === 'gestures' ? (
                  /* Android Gesture Pill */
                  <button
                    onClick={handleHomeClick}
                    title="Swipe or Tap to go to Android Home Screen"
                    className="w-32 h-1 bg-white/50 hover:bg-white rounded-full transition-all active:scale-95 active:h-1.5 cursor-pointer shadow-sm"
                  />
                ) : (
                  /* Android 3-Button Nav: Back, Home, Recents */
                  <div className="w-full flex items-center justify-between px-8 text-white/70">
                    {/* Back Triangle */}
                    <button
                      onClick={handleBackClick}
                      title="Back"
                      className="p-1 hover:text-white active:scale-75 transition cursor-pointer"
                    >
                      <Triangle className="w-3.5 h-3.5 -rotate-90 fill-current" />
                    </button>

                    {/* Home Circle */}
                    <button
                      onClick={handleHomeClick}
                      title="Home"
                      className="p-1 hover:text-white active:scale-75 transition cursor-pointer"
                    >
                      <Circle className="w-4 h-4 fill-current" />
                    </button>

                    {/* Recents Square */}
                    <button
                      onClick={handleRecentsClick}
                      title="Recents"
                      className="p-1 hover:text-white active:scale-75 transition cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================== */}
      {/* POPUP MODALS                                                   */}
      {/* ============================================================== */}
      <AndroidApkExportModal
        isOpen={showApkModal}
        onClose={() => setShowApkModal(false)}
      />

      <AndroidPlayStoreModal
        isOpen={showPlayStoreModal}
        onClose={() => setShowPlayStoreModal(false)}
        onOpenApkExport={() => {
          setShowPlayStoreModal(false);
          setShowApkModal(true);
        }}
        onInstallPwa={() => {
          if (isInstallable) {
            install();
          } else {
            alert("To install on Android: Tap Chrome's ⋮ menu -> 'Install app' or 'Add to Home screen'.");
          }
        }}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
      />

      <AndroidSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        wallpaper={activeWallpaper}
        onSelectWallpaper={setActiveWallpaper}
        navMode={navStyle}
        onSelectNavMode={setNavStyle}
        onResetGame={onResetGame}
      />
    </div>
  );
};
