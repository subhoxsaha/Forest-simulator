/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

export type BirdSpotPreset = 'free' | 'river' | 'canopy' | 'village' | 'clouds';

export interface BirdFlightInput {
  forward: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  climb: boolean;
  descend: boolean;
  boost: boolean;
}

/**
 * Zero-rerender 60fps state store for Bird Flight camera & articulated player bird.
 */
class BirdFlightState {
  public active = false;
  public autoSoar = false;
  public firstPerson = false;

  public pos = new THREE.Vector3(0, 4.6, 8.5);
  public yaw = 0; // 0 faces -Z
  public pitch = -0.14;
  public roll = 0;
  public speed = 3.2;
  public altitude = 4.6;
  public spotLabel = 'Over Woodland Canopy';

  // Optional one-shot swoop destination (cleared once reached or on manual steering)
  public flyToTarget: THREE.Vector3 | null = null;
  public activeSpotPreset: BirdSpotPreset = 'free';

  // Mouse/touch drag deltas accumulated between frames
  public dragYawDelta = 0;
  public dragPitchDelta = 0;

  public input: BirdFlightInput = {
    forward: false,
    brake: false,
    left: false,
    right: false,
    climb: false,
    descend: false,
    boost: false,
  };

  public clearInput() {
    this.input.forward = false;
    this.input.brake = false;
    this.input.left = false;
    this.input.right = false;
    this.input.climb = false;
    this.input.descend = false;
    this.input.boost = false;
    this.dragYawDelta = 0;
    this.dragPitchDelta = 0;
  }

  public hasManualInput(): boolean {
    return (
      this.input.forward ||
      this.input.brake ||
      this.input.left ||
      this.input.right ||
      this.input.climb ||
      this.input.descend ||
      Math.abs(this.dragYawDelta) > 0.0005 ||
      Math.abs(this.dragPitchDelta) > 0.0005
    );
  }

  public resetForTakeoff(x = 0, y = 4.6, z = 8.2) {
    this.pos.set(x, y, z);
    this.yaw = Math.atan2(-x, -z);
    this.pitch = -0.14;
    this.roll = 0;
    this.speed = 3.2;
    this.altitude = y;
    this.autoSoar = false;
    this.flyToTarget = null;
    this.activeSpotPreset = 'free';
    this.clearInput();
  }

  public setSpotTarget(preset: BirdSpotPreset, x: number, y: number, z: number) {
    this.activeSpotPreset = preset;
    this.autoSoar = false;
    this.flyToTarget = new THREE.Vector3(x, y, z);
  }
}

export const birdFlightState = new BirdFlightState();
