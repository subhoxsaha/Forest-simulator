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
  
  private birdTimer: any = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.5;

  constructor() {
    // Lazy initialisation on user gesture
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.currentVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Create continuous noise buffers
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of pinkish noise
      const windBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const waterBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      
      const windData = windBuffer.getChannelData(0);
      const waterData = waterBuffer.getChannelData(0);

      // Generate Pink noise approximation for warm wind
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        windData[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        windData[i] *= 0.11; // normalise pink noise
        b6 = white * 0.115926;
      }

      // Generate Brown noise approximation for water rumble
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        waterData[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = waterData[i];
        waterData[i] *= 3.5; // normalise brown noise
      }

      // 1. Setup Wind Synthesizer
      this.windNoise = this.ctx.createBufferSource();
      this.windNoise.buffer = windBuffer;
      this.windNoise.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windNoise.start();

      // Setup sweeping wind LFO sweep
      const windLFO = this.ctx.createOscillator();
      const windLFOGain = this.ctx.createGain();
      windLFO.frequency.setValueAtTime(0.12, this.ctx.currentTime); // very slow 0.12Hz
      windLFOGain.gain.setValueAtTime(110, this.ctx.currentTime); // swing filter by +/-110Hz

      windLFO.connect(windLFOGain);
      windLFOGain.connect(this.windFilter.frequency);
      windLFO.start();

      // 2. Setup Water Synthesizer (Flowing River)
      this.waterNoise = this.ctx.createBufferSource();
      this.waterNoise.buffer = waterBuffer;
      this.waterNoise.loop = true;

      this.waterFilter = this.ctx.createBiquadFilter();
      this.waterFilter.type = 'bandpass';
      this.waterFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.waterFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.setValueAtTime(0.11, this.ctx.currentTime);

      this.waterNoise.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.masterGain);
      this.waterNoise.start();

      // 3. Start Procedural Bird Song Routine
      this.startBirdsLoop();
      
      this.resume();
    } catch (e) {
      console.warn("Ecosystem Audio system failed to initialize:", e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private startBirdsLoop() {
    if (this.birdTimer) clearTimeout(this.birdTimer);

    const scheduleNextBird = () => {
      // Birds chirp between 4 and 10 seconds based on noise
      const delay = 4000 + Math.random() * 6000;
      this.birdTimer = setTimeout(() => {
        this.synthesizeBirdChirp();
        scheduleNextBird();
      }, delay);
    };

    scheduleNextBird();
  }

  private synthesizeBirdChirp() {
    if (!this.ctx || this.isMuted || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      // Spawn tiny chirping synth nodes to avoid build-up
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3500, now);
      filter.Q.setValueAtTime(2.0, now);

      osc.type = Math.random() > 0.6 ? 'triangle' : 'sine';
      
      // Starting bird frequency
      const startFreq = 2800 + Math.random() * 1200;
      const endFreq = startFreq + 1500;
      
      osc.frequency.setValueAtTime(startFreq, now);
      // Bird sweep pattern (fast chatter chirp)
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
      osc.frequency.setValueAtTime(startFreq - 200, now + 0.10);
      osc.frequency.exponentialRampToValueAtTime(endFreq + 500, now + 0.18);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (error) {
      // Silently catch node limits
    }
  }

  // Bubble stream splash pop synthesizer
  public synthesizeWaterBubble() {
    if (!this.ctx || this.isMuted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const bubbleFreq = 800 + Math.random() * 1400; // high crystalline water splash
      
      osc.frequency.setValueAtTime(bubbleFreq, now);
      osc.frequency.exponentialRampToValueAtTime(bubbleFreq + 600, now + 0.04);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.033, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // Ignored
    }
  }

  // Update soundscape volumes dynamically based on gamestate variables!
  public updateState(biomass: number, weather: 'Sunny' | 'Raining' | 'Windy' | 'Autumn_Dew') {
    if (!this.ctx || !this.windGain || !this.waterGain || !this.windFilter) return;

    const now = this.ctx.currentTime;
    
    // Scale parameters based on dynamic forest size/biomass
    // Larger forests = more dense rustling and busy chirping birds!
    const forestDensityMult = Math.min(2.0, Math.max(0.2, biomass / 150));
    
    let targetWindVol = 0.07;
    let targetWindFreq = 350;
    let targetWaterVol = 0.11;

    if (weather === 'Windy') {
      targetWindVol = 0.28 * forestDensityMult; // high energetic wind!
      targetWindFreq = 480; // slightly higher pitch rush
    } else if (weather === 'Raining') {
      targetWindVol = 0.14 * forestDensityMult; // heavy rain downfalls/brushing
      targetWindFreq = 260; // deep muffled rain patter sound
      targetWaterVol = 0.18; // rushing filled up river
    } else if (weather === 'Autumn_Dew') {
      targetWindVol = 0.05 * forestDensityMult;
      targetWindFreq = 220; // soft heavy humid draft
    } else {
      // Sunny baseline
      targetWindVol = 0.06 * forestDensityMult;
    }

    // Set transitions smoothly over 1.2 seconds to prevent sudden click artifacts
    this.windGain.gain.setTargetAtTime(targetWindVol, now, 1.2);
    this.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.8);
    this.waterGain.gain.setTargetAtTime(targetWaterVol, now, 1.0);
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain) {
      const vol = mute ? 0 : this.currentVolume;
      this.masterGain.gain.setValueAtTime(vol, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Soft, haptic-like synthesised hover sound on tile exploration
  public synthesizeHoverTile(x: number, y: number, tileType?: string) {
    if (!this.ctx || this.isMuted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Pure sine wave for a clean, glass-like marimba/kalimba mallet chime
      osc.type = 'sine';

      // Map (x + y) to a pentatonic scale to create beautiful adaptive harmonies as mouse glides
      const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
      const index = Math.abs(x + y) % pentatonic.length;
      let freq = pentatonic[index];

      // Octave higher for planted tiles to give diverse haptic response
      if (tileType && tileType !== 'None') {
        freq *= 2.0;
      }

      osc.frequency.setValueAtTime(freq, now);

      // Lowpass filter decay to soften the transient click and sound organic
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 1.8, now);
      filter.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.04);

      // Extremely soft, micro-dose volume haptic envelope with fast decay
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.012, now + 0.003); // very subtle
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05); // quick envelope fade out in 50ms

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // Catch silently on context overflow/node limits
    }
  }
}

export const ecosystemAudio = new EcosystemAudioSystem();
