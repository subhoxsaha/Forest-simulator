/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { SeasonMode, SeasonType, SeasonWeights } from '../types';

const SEASON_TARGET_PHASE: Record<SeasonType, number> = {
  spring: 0.5,
  summer: 1.5,
  autumn: 2.5,
  winter: 3.5,
};

function circularDiff(current: number, target: number, period = 4): number {
  let diff = ((target - current) % period + period) % period;
  if (diff > period / 2) diff -= period;
  return diff;
}

function seasonWeight(phase: number, center: number): number {
  const dist = Math.abs(circularDiff(phase, center, 4));
  if (dist >= 1) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * dist));
}

/**
 * Zero-rerender simulation clock + continuous 4-season visual phase engine.
 * Three.js useFrame hooks read getProgress() and getSeasonWeights() directly at 60fps
 * without triggering React renders.
 */
class SimulationClock {
  private dayStartTime = Date.now();
  private tickRateMs = 1500;
  private paused = false;
  private frozenProgress = 0.42; // Pleasant bright daylight when paused on start screen
  private gameStarted = false;

  // Continuous 4-season transition state (0.0 -> 4.0)
  private currentDay = 1;
  private seasonMode: SeasonMode = 'auto';
  private seasonPhase = 0.5; // Starts in peak vibrant Spring

  // Pre-allocated weights object (zero per-frame allocations)
  private readonly weights: SeasonWeights = {
    phase: 0.5,
    spring: 1,
    summer: 0,
    autumn: 0,
    winter: 0,
    dominant: 'spring',
  };

  public setGameStarted(started: boolean) {
    this.gameStarted = started;
    if (started) {
      this.dayStartTime = Date.now() - this.frozenProgress * this.tickRateMs;
    }
  }

  public setTickRate(rateMs: number) {
    const currentProgress = this.getProgress();
    const isNowPaused = rateMs >= 99999999;
    this.paused = isNowPaused;
    if (!isNowPaused) {
      this.tickRateMs = Math.max(250, rateMs);
      this.dayStartTime = Date.now() - currentProgress * this.tickRateMs;
    } else {
      this.frozenProgress = currentProgress;
    }
  }

  public setCurrentDay(day: number) {
    this.currentDay = Math.max(1, day);
  }

  public setSeasonMode(mode: SeasonMode) {
    this.seasonMode = mode;
  }

  public getSeasonMode(): SeasonMode {
    return this.seasonMode;
  }

  public resetDayStart() {
    this.dayStartTime = Date.now();
    this.frozenProgress = 0;
  }

  public resetAll() {
    this.dayStartTime = Date.now();
    this.frozenProgress = 0.42;
    this.paused = false;
    this.gameStarted = false;
    this.currentDay = 1;
    this.seasonMode = 'auto';
    this.seasonPhase = 0.5;
    this.recomputeWeights();
  }

  public getProgress(): number {
    if (!this.gameStarted) {
      return 0.42; // Showcase bright daylight on StartScreen
    }
    if (this.paused) {
      return this.frozenProgress;
    }
    const elapsed = Date.now() - this.dayStartTime;
    return Math.min(1.0, Math.max(0.0, elapsed / this.tickRateMs));
  }

  /**
   * Called once per animation frame by DynamicAtmosphereRig to smoothly damp
   * the continuous 4-season phase toward either the natural annual cycle or
   * the user's manual season override.
   */
  public advanceFrame(dt: number) {
    let targetPhase: number;
    if (this.seasonMode === 'auto') {
      // 40-day annual cycle (10 days per season), offset +0.35 so Day 1 opens in lively Spring
      const progress = this.getProgress();
      targetPhase = ((((this.currentDay - 1) + progress) / 10) + 0.35) % 4;
    } else {
      targetPhase = SEASON_TARGET_PHASE[this.seasonMode];
    }

    const diff = circularDiff(this.seasonPhase, targetPhase, 4);
    const lambda = this.seasonMode === 'auto' ? 3.2 : 2.3;
    const step = diff * (1 - Math.exp(-lambda * dt));
    this.seasonPhase = ((this.seasonPhase + step) % 4 + 4) % 4;
    this.recomputeWeights();
  }

  private recomputeWeights() {
    const p = this.seasonPhase;
    const sp = seasonWeight(p, 0.5);
    const su = seasonWeight(p, 1.5);
    const au = seasonWeight(p, 2.5);
    const wi = seasonWeight(p, 3.5);

    this.weights.phase = p;
    this.weights.spring = sp;
    this.weights.summer = su;
    this.weights.autumn = au;
    this.weights.winter = wi;

    if (sp >= su && sp >= au && sp >= wi) this.weights.dominant = 'spring';
    else if (su >= au && su >= wi) this.weights.dominant = 'summer';
    else if (au >= wi) this.weights.dominant = 'autumn';
    else this.weights.dominant = 'winter';
  }

  public getSeasonWeights(): SeasonWeights {
    return this.weights;
  }

  public getFormattedTime(): { hour: string; minute: string; ampm: string } {
    const progress = this.getProgress();
    const totalMinutes = Math.floor(progress * 1440);
    const h24 = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      hour: h12 < 10 ? `0${h12}` : `${h12}`,
      minute: m < 10 ? `0${m}` : `${m}`,
      ampm: h24 >= 12 ? 'PM' : 'AM',
    };
  }
}

export const simClock = new SimulationClock();
