import { useEffect, useRef } from 'react';
import type { ViewEventKind, ViewSnapshot } from '../view/model';

type AmberSoundCue = ViewEventKind | 'ui' | 'confirm' | 'pause';

let context: AudioContext | null = null;
const lastPlayedAt = new Map<AmberSoundCue, number>();

const ensureContext = () => {
  if (typeof window === 'undefined') return null;
  if (!context || context.state === 'closed') {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass({ latencyHint: 'interactive' });
  }
  return context;
};

const scheduleTone = (
  audio: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) => {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

const renderCue = (audio: AudioContext, cue: AmberSoundCue) => {
  const now = audio.currentTime + 0.008;
  switch (cue) {
    case 'ui':
      scheduleTone(audio, now, 260, 0.055, 0.025, 'triangle');
      break;
    case 'pause':
      scheduleTone(audio, now, 210, 0.09, 0.03, 'triangle');
      break;
    case 'confirm':
      scheduleTone(audio, now, 392, 0.12, 0.035, 'triangle');
      scheduleTone(audio, now + 0.055, 523.25, 0.16, 0.032, 'triangle');
      break;
    case 'coin':
      scheduleTone(audio, now, 659.25, 0.11, 0.04, 'sine');
      scheduleTone(audio, now + 0.055, 987.77, 0.16, 0.032, 'sine');
      break;
    case 'upgrade':
      [440, 554.37, 659.25].forEach((frequency, index) => {
        scheduleTone(audio, now + index * 0.055, frequency, 0.17, 0.035, 'triangle');
      });
      break;
    case 'unlock':
      [261.63, 329.63, 392].forEach((frequency, index) => {
        scheduleTone(audio, now + index * 0.035, frequency, 0.32, 0.028, 'triangle');
      });
      break;
    case 'service':
      scheduleTone(audio, now, 330, 0.07, 0.02, 'triangle');
      break;
    case 'warning':
      scheduleTone(audio, now, 145, 0.16, 0.035, 'square');
      scheduleTone(audio, now + 0.08, 132, 0.15, 0.025, 'square');
      break;
    case 'karaoke':
      scheduleTone(audio, now, 523.25, 0.2, 0.025, 'sine');
      scheduleTone(audio, now + 0.07, 659.25, 0.22, 0.022, 'sine');
      break;
    case 'steam':
      scheduleTone(audio, now, 92, 0.24, 0.016, 'sine');
      break;
    case 'aroma':
      scheduleTone(audio, now, 349.23, 0.28, 0.018, 'sine');
      break;
  }
};

export const primeAmberAudio = () => {
  const audio = ensureContext();
  if (audio?.state === 'suspended') void audio.resume();
};

export const playAmberSound = (cue: AmberSoundCue, allowCreate = false) => {
  const audio = allowCreate ? ensureContext() : context;
  if (!audio || audio.state === 'closed') return;
  const minimumGap = cue === 'ui' ? 0.04 : cue === 'service' ? 0.12 : 0.2;
  const previous = lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
  if (audio.currentTime - previous < minimumGap) return;
  lastPlayedAt.set(cue, audio.currentTime);
  if (audio.state === 'running') {
    renderCue(audio, cue);
    return;
  }
  if (allowCreate) void audio.resume().then(() => renderCue(audio, cue));
};

export const useAmberAudio = (snapshot: ViewSnapshot) => {
  const lastEventId = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot.soundEnabled || !snapshot.lastEvent) return;
    if (snapshot.lastEvent.id === lastEventId.current) return;
    lastEventId.current = snapshot.lastEvent.id;
    playAmberSound(snapshot.lastEvent.kind);
  }, [snapshot.lastEvent, snapshot.soundEnabled]);
};
