/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Zero-rerender simulation clock.
 * Three.js useFrame hooks read getProgress() directly at 60fps without triggering React renders.
 * UI clock displays subscribe to coarse minute updates (~2–6 times per second max).
 */
class SimulationClock {
  private dayStartTime = Date.now();
  private tickRateMs = 1500;
  private paused = false;
  private frozenProgress = 0.42; // Pleasant bright daylight when paused on start screen
  private gameStarted = false;

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

  public resetDayStart() {
    this.dayStartTime = Date.now();
    this.frozenProgress = 0;
  }

  public resetAll() {
    this.dayStartTime = Date.now();
    this.frozenProgress = 0.42;
    this.paused = false;
    this.gameStarted = false;
  }

  public getProgress(): number {
    if (!this.gameStarted) {
      return 0.42; // Showcase bright golden daylight on StartScreen
    }
    if (this.paused) {
      return this.frozenProgress;
    }
    const elapsed = Date.now() - this.dayStartTime;
    return Math.min(1.0, Math.max(0.0, elapsed / this.tickRateMs));
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
