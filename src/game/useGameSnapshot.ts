import { useSyncExternalStore } from 'react';
import type { GameEngine } from './GameEngine';

export const useGameSnapshot = (engine: GameEngine) =>
  useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
