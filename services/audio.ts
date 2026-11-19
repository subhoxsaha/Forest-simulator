/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class EcosystemAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Synthesizer structures
  private windNoise: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private waterNoise: AudioBufferSourceNode | null = null;
  private waterGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;

  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.45;
  private lastHoverSoundMs: number = 0;

  public init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.currentVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      const bufferSize = this.ctx.sampleRate * 2;
      const windBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const waterBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);

      const windData = windBuffer.getChannelData(0);
      const waterData = waterBuffer.getChannelData(0);

      // Pink noise approximation for warm woodland wind
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        windData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      // Brown noise approximation for flowing river rumble
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        waterData[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = waterData[i];
        waterData[i] *= 3.5;
      }

      // 1. Wind Synthesizer
      this.windNoise = this.ctx.createBufferSource();
      this.windNoise.buffer = windBuffer;
      this.windNoise.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windNoise.start();

      const windLFO = this.ctx.createOscillator();
      const windLFOGain = this.ctx.createGain();
      windLFO.frequency.setValueAtTime(0.12, this.ctx.currentTime);
      windLFOGain.gain.setValueAtTime(110, this.ctx.currentTime);
      windLFO.connect(windLFOGain);
      windLFOGain.connect(this.windFilter.frequency);
      windLFO.start();

      // 2. River Water Synthesizer
      this.waterNoise = this.ctx.createBufferSource();
      this.waterNoise.buffer = waterBuffer;
      this.waterNoise.loop = true;

      this.waterFilter = this.ctx.createBiquadFilter();
      this.waterFilter.type = 'bandpass';
      this.waterFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.waterFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.setValueAtTime(0.1, this.ctx.currentTime);

      this.waterNoise.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.masterGain);
      this.waterNoise.start();

      // 3. Procedural Bird Song Loop
      this.startBirdsLoop();
      this.resume();
    } catch {
      // Gracefully ignored if AudioContext blocked
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private canPlay(): boolean {
    return Boolean(this.ctx && this.masterGain && !this.isMuted && this.ctx.state === 'running');
  }

  private startBirdsLoop() {
    if (this.birdTimer) clearTimeout(this.birdTimer);
    const scheduleNextBird = () => {
      const delay = 4500 + Math.random() * 6500;
      this.birdTimer = setTimeout(() => {
        this.synthesizeBirdChirp();
        scheduleNextBird();
      }, delay);
    };
    scheduleNextBird();
  }

  private synthesizeBirdChirp() {
    if (!this.canPlay() || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3500, now);
      filter.Q.setValueAtTime(2.0, now);

      osc.type = Math.random() > 0.6 ? 'triangle' : 'sine';
      const startFreq = 2800 + Math.random() * 1200;
      const endFreq = startFreq + 1500;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
      osc.frequency.setValueAtTime(startFreq - 200, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(endFreq + 500, now + 0.18);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // Ignored
    }
  }

  public synthesizeWaterBubble() {
    if (!this.canPlay() || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const bubbleFreq = 800 + Math.random() * 1400;
      osc.frequency.setValueAtTime(bubbleFreq, now);
      osc.frequency.exponentialRampToValueAtTime(bubbleFreq + 600, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Ignored
    }
  }

  // Reuses the shared AudioContext (fixes browser AudioContext cap crash!)
  public playWoodCrack() {
    if (!this.canPlay() || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const delay = i * 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140 - i * 28 + Math.random() * 20, now + delay);
        osc.frequency.exponentialRampToValueAtTime(30, now + delay + 0.11);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(0.11, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now + delay);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.onended = () => {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
        osc.start(now + delay);
        osc.stop(now + delay + 0.13);
      }

      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      const thudFilter = this.ctx.createBiquadFilter();

      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(70, now + 0.52);
      thudOsc.frequency.exponentialRampToValueAtTime(16, now + 0.94);

      thudGain.gain.setValueAtTime(0.0001, now + 0.52);
      thudGain.gain.linearRampToValueAtTime(0.15, now + 0.54);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

      thudFilter.type = 'lowpass';
      thudFilter.frequency.setValueAtTime(120, now + 0.52);

      thudOsc.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(this.masterGain);
      thudOsc.onended = () => {
        thudOsc.disconnect();
        thudFilter.disconnect();
        thudGain.disconnect();
      };
      thudOsc.start(now + 0.52);
      thudOsc.stop(now + 0.96);
    } catch {
      // Ignored
    }
  }

  public playActionChime(kind: 'plant' | 'water' | 'mulch' | 'prune' | 'reward') {
    this.init();
    if (!this.canPlay() || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const notes =
        kind === 'plant'
          ? [392, 523.25]
          : kind === 'water'
          ? [587.33, 783.99]
          : kind === 'mulch'
          ? [293.66, 349.23]
          : kind === 'prune'
          ? [246.94, 196.0]
          : [523.25, 659.25, 783.99];

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = now + idx * 0.055;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = kind === 'prune' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.065, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.17);
      });
    } catch {
      // Ignored
    }
  }

  public updateState(biomass: number, weather: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew') {
    if (!this.ctx || !this.windGain || !this.waterGain || !this.windFilter) return;

    const now = this.ctx.currentTime;
    const forestDensityMult = Math.min(2.0, Math.max(0.25, biomass / 150));

    let targetWindVol = 0.06 * forestDensityMult;
    let targetWindFreq = 350;
    let targetWaterVol = 0.1;

    if (weather === 'Windy') {
      targetWindVol = 0.25 * forestDensityMult;
      targetWindFreq = 480;
    } else if (weather === 'Raining') {
      targetWindVol = 0.14 * forestDensityMult;
      targetWindFreq = 260;
      targetWaterVol = 0.17;
    } else if (weather === 'Autumn_Dew') {
      targetWindVol = 0.05 * forestDensityMult;
      targetWindFreq = 220;
    }

    this.windGain.gain.setTargetAtTime(targetWindVol, now, 1.2);
    this.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.8);
    this.waterGain.gain.setTargetAtTime(targetWaterVol, now, 1.0);
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.masterGain && !this.isMuted && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public synthesizeHoverTile(x: number, y: number, tileType?: string) {
    if (!this.canPlay() || !this.ctx || !this.masterGain) return;
    // Throttle hover chimes to prevent audio node saturation during fast mouse sweeps
    const nowMs = performance.now();
    if (nowMs - this.lastHoverSoundMs < 45) return;
    this.lastHoverSoundMs = nowMs;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
      let freq = pentatonic[Math.abs(x + y) % pentatonic.length];
      if (tileType && tileType !== 'None') freq *= 1.5;

      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 1.8, now);
      filter.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.011, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Ignored
    }
  }
}

export const ecosystemAudio = new EcosystemAudioSystem();
