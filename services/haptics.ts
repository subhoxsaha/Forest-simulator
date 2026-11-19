/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Android Web Haptic feedback helper
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection' | 'shutter';

class HapticsService {
  private enabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('android_haptics_enabled');
      if (saved !== null) {
        this.enabled = JSON.parse(saved);
      }
    } catch {
      this.enabled = true;
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    try {
      localStorage.setItem('android_haptics_enabled', JSON.stringify(val));
    } catch {}
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public trigger(type: HapticType = 'light') {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        switch (type) {
          case 'light':
          case 'selection':
            navigator.vibrate(12);
            break;
          case 'medium':
            navigator.vibrate(28);
            break;
          case 'heavy':
            navigator.vibrate(55);
            break;
          case 'success':
            navigator.vibrate([20, 40, 30, 60, 45]);
            break;
          case 'warning':
            navigator.vibrate([40, 60, 40]);
            break;
          case 'shutter':
            navigator.vibrate([15, 25, 20]);
            break;
        }
      } catch {
        // Ignored on platforms where vibrate fails or is blocked by permissions
      }
    }

    // Dispatch custom event for visual haptic effect
    window.dispatchEvent(new CustomEvent('android-haptic-pulse', { detail: { type } }));
  }
}

export const androidHaptics = new HapticsService();
