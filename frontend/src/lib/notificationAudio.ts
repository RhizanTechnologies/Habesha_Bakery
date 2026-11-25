/**
 * Web Audio API Sound Synthesizer & Haptic Vibration Engine
 *
 * Provides zero-latency melodic audio chimes and mobile vibration
 * without requiring external sound file assets or network downloads.
 */

export type SoundTheme = 'CHIME' | 'BELL' | 'POP' | 'ALARM';
export type VibrationIntensity = 'normal' | 'double' | 'urgent';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesizes and plays a melodic notification sound.
 */
export function playNotificationSound(theme: SoundTheme = 'CHIME') {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    switch (theme) {
      case 'CHIME': {
        // Warm Caramel Harmonic Chime (C5 -> E5)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1046.5, now); // C6 overtone
        osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);

        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(0.28, now + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.56);
        osc2.stop(now + 0.56);
        break;
      }

      case 'BELL': {
        // High clarity digital ping (A5 -> C6)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(1046.5, now + 0.08); // C6

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.46);
        break;
      }

      case 'POP': {
        // Subtle Acoustic Pop (Soft Marimba Droplet)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);
        break;
      }

      case 'ALARM': {
        // Tri-tone urgent audit alert (A4 -> C#5 -> E5)
        [440, 554.37, 659.25].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.1;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(start);
          osc.stop(start + 0.19);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('[AudioSynthesizer] Failed to play tone:', err);
  }
}

/**
 * Triggers mobile device haptic vibration if supported by the browser.
 */
export function triggerVibration(intensity: VibrationIntensity = 'normal') {
  if (typeof window === 'undefined' || !('navigator' in window) || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (intensity) {
      case 'normal':
        navigator.vibrate([120]);
        break;
      case 'double':
        navigator.vibrate([150, 75, 150]);
        break;
      case 'urgent':
        navigator.vibrate([250, 100, 250, 100, 250]);
        break;
    }
  } catch {}
}

/**
 * Helper to test audio chime directly from settings
 */
export function testNotificationSound(theme: SoundTheme = 'CHIME') {
  playNotificationSound(theme);
}

/**
 * Helper to test haptic vibration directly from settings
 */
export function testVibration(intensity: VibrationIntensity = 'double') {
  triggerVibration(intensity);
}
