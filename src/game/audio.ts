import type { GameEvent } from './types';

class GameAudio {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.unlock();
  }

  unlock() {
    if (!this.enabled || typeof window === 'undefined') return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  click() {
    this.tone(440, 0.045, 'sine', 0.035, 620);
  }

  event(event: GameEvent) {
    if (event.kind === 'payment') {
      this.tone(740, 0.08, 'triangle', 0.055, 980);
      window.setTimeout(() => this.tone(1040, 0.07, 'triangle', 0.04), 65);
    } else if (event.kind === 'upgrade') {
      this.tone(420, 0.1, 'sine', 0.05, 700);
      window.setTimeout(() => this.tone(820, 0.12, 'sine', 0.05), 90);
    } else if (event.kind === 'reputation') {
      this.tone(880, 0.09, 'sine', 0.035, 1180);
    } else if (event.kind === 'day') {
      this.tone(320, 0.18, 'triangle', 0.05, 520);
    } else if (event.kind === 'room_income') {
      this.tone(520, 0.09, 'triangle', 0.045, 680);
      window.setTimeout(() => this.tone(780, 0.1, 'sine', 0.035, 920), 72);
    } else if (event.kind === 'room_unlock') {
      this.tone(330, 0.13, 'triangle', 0.055, 520);
      window.setTimeout(() => this.tone(520, 0.13, 'triangle', 0.05, 720), 95);
      window.setTimeout(() => this.tone(780, 0.18, 'sine', 0.045, 1040), 190);
    }
  }

  private tone(frequency: number, duration: number, type: OscillatorType, gainValue: number, endFrequency = frequency) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

export const gameAudio = new GameAudio();
