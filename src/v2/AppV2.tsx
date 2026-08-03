import { useCallback, useEffect, useRef, useState } from 'react';
import { useAmberRuntime } from './runtime/useAmberRuntime';
import { playAmberSound, primeAmberAudio, useAmberAudio } from './effects/useAmberAudio';
import type { RoomId } from './content/rooms';
import { AmberClubView } from './view/AmberClubView';
import type { AmberQuality, VenueId, ViewAction, ViewSnapshot } from './view/model';
import type { SimulationSnapshot } from './simulation/types';

type AmberTestBridge = {
  start(): void;
  advanceTicks(ticks: number): void;
  unlockRoom(roomId: RoomId): void;
  getSimulationSnapshot(): SimulationSnapshot;
  getViewSnapshot(): ViewSnapshot;
};

declare global {
  interface Window {
    __HH_TEST__?: AmberTestBridge;
  }
}

const detectQuality = (): AmberQuality => {
  if (typeof window === 'undefined') return 'auto';
  const compact = window.matchMedia('(max-width: 760px), (max-height: 620px)').matches;
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4;
  return compact || lowPower ? 'mobile' : 'auto';
};

const detectReducedMotion = () => (
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export default function AppV2() {
  const runtime = useAmberRuntime();
  useAmberAudio(runtime.viewSnapshot);
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const [focus, setFocus] = useState<VenueId>('bar');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quality, setQuality] = useState<AmberQuality>(detectQuality);
  const [reducedMotion, setReducedMotion] = useState(detectReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px), (max-height: 620px)');
    const update = () => setQuality(detectQuality());
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const onAction = useCallback((action: ViewAction) => {
    const soundEnabled = runtimeRef.current.viewSnapshot.soundEnabled;
    if (action.type === 'toggle-sound') {
      if (!soundEnabled) {
        primeAmberAudio();
        playAmberSound('confirm', true);
      }
    } else if (soundEnabled) {
      primeAmberAudio();
      playAmberSound(action.type === 'start-shift' ? 'confirm' : action.type === 'toggle-pause' ? 'pause' : 'ui', true);
    }
    if (action.type === 'focus') {
      setFocus(action.venueId);
      setDrawerOpen(true);
      return;
    }
    if (action.type === 'toggle-drawer') {
      setDrawerOpen((open) => !open);
      return;
    }
    if (action.type === 'start-shift') {
      setFocus('bar');
      setDrawerOpen(false);
    }
    runtime.dispatch(action);
  }, [runtime.dispatch]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const testBridge: AmberTestBridge = {
      start: () => runtimeRef.current.dispatch({ type: 'start-shift' }),
      advanceTicks: (ticks) => runtimeRef.current.advanceTicks(ticks),
      unlockRoom: (roomId) => {
        runtimeRef.current.simulation.unlockRoom(roomId);
        runtimeRef.current.refresh();
      },
      getSimulationSnapshot: () => runtimeRef.current.simulation.getState(),
      getViewSnapshot: () => runtimeRef.current.viewSnapshot,
    };
    window.__HH_TEST__ = testBridge;
    return () => {
      if (window.__HH_TEST__ === testBridge) delete window.__HH_TEST__;
    };
  }, []);

  return (
    <AmberClubView
      drawerOpen={drawerOpen}
      focus={focus}
      onAction={onAction}
      quality={quality}
      reducedMotion={reducedMotion}
      snapshot={runtime.viewSnapshot}
    />
  );
}
