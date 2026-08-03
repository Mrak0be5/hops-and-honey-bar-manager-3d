import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROOM_IDS, type RoomId, type RoomUpgradeId } from '../content/rooms';
import { loadOrMigrateProgress, type SaveStorage } from '../save/migrateV1';
import { V2_SAVE_KEY, makeDefaultProgressV2, type ProgressV2 } from '../save/schema';
import { AmberClubSimulation } from '../simulation/AmberClubSimulation';
import type { SimulationSnapshot } from '../simulation/types';
import type { ViewAction, ViewSnapshot } from '../view/model';
import { mapSimulationToView } from './mapSimulationToView';
import { useFixedStepLoop } from './useFixedStepLoop';

const safeBrowserStorage = (): SaveStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const persistRuntimeProgress = (
  storage: SaveStorage | null,
  progress: ProgressV2,
  statBaselines: Readonly<{
    day: number;
    prestige: number;
    served: number;
    totalOperatingRevenue: number;
  }>,
  snapshot: SimulationSnapshot,
  soundEnabled: boolean,
) => {
  if (!storage) return;
  const departed = snapshot.servedGuests;
  const operatingRevenue = snapshot.ledger
    .filter((entry) => entry.kind === 'bar_revenue' || entry.kind === 'room_revenue')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const next: ProgressV2 = {
    ...progress,
    coins: snapshot.balance,
    day: statBaselines.day + Math.floor(snapshot.simulationTimeSeconds / 150),
    prestige: statBaselines.prestige + Math.floor(departed / 3),
    served: statBaselines.served + departed,
    soundEnabled,
    totalOperatingRevenue: statBaselines.totalOperatingRevenue + operatingRevenue,
    rooms: { ...progress.rooms },
  };
  for (const room of snapshot.rooms) {
    const previous = progress.rooms[room.id];
    next.rooms[room.id] = {
      ...previous,
      lifecycle: room.lifecycle,
      renovationStage: room.renovationStage,
      completedSessions: room.completedSessions,
      revenue: room.revenue,
      staff: { hired: room.staff.hired, level: room.staff.level },
      upgrades: { ...room.upgrades },
    };
  }
  try {
    storage.setItem(V2_SAVE_KEY, JSON.stringify(next));
    Object.assign(progress, next);
  } catch {
    // Runtime stays playable when private mode or storage quota blocks writes.
  }
};

type RuntimeState = {
  simulation: AmberClubSimulation;
  progress: ProgressV2;
  storage: SaveStorage | null;
  initialSoundEnabled: boolean;
  statBaselines: Readonly<{
    day: number;
    prestige: number;
    served: number;
    totalOperatingRevenue: number;
  }>;
};

const createRuntimeState = (): RuntimeState => {
  const storage = safeBrowserStorage();
  const loaded = storage ? loadOrMigrateProgress(storage) : null;
  const progress = loaded?.progress ?? makeDefaultProgressV2();
  const simulation = new AmberClubSimulation({
    seed: 0x0a6be2,
    initialBalance: progress.coins,
    initialRooms: Object.fromEntries(ROOM_IDS.map((roomId) => [roomId, {
      lifecycle: progress.rooms[roomId].lifecycle,
      renovationStage: progress.rooms[roomId].renovationStage,
      upgrades: { ...progress.rooms[roomId].upgrades },
      completedSessions: progress.rooms[roomId].completedSessions,
      revenue: progress.rooms[roomId].revenue,
    }])),
  });
  const statBaselines = {
    day: progress.day,
    prestige: progress.prestige,
    served: progress.served,
    totalOperatingRevenue: progress.totalOperatingRevenue,
  };

  return { simulation, progress, storage, initialSoundEnabled: progress.soundEnabled, statBaselines };
};

export type AmberRuntimeController = {
  simulation: AmberClubSimulation;
  simulationSnapshot: SimulationSnapshot;
  viewSnapshot: ViewSnapshot;
  dispatch(action: ViewAction): void;
  advanceTicks(ticks: number): void;
  refresh(): void;
};

export function useAmberRuntime(): AmberRuntimeController {
  const [runtime] = useState(createRuntimeState);
  const [simulationSnapshot, setSimulationSnapshot] = useState(() => runtime.simulation.getState());
  const [soundEnabled, setSoundEnabled] = useState(runtime.initialSoundEnabled);

  const publish = useCallback(() => {
    setSimulationSnapshot(runtime.simulation.getState());
  }, [runtime]);

  useFixedStepLoop({
    hz: 25,
    maxCatchUpSteps: 6,
    paused: !simulationSnapshot.started || simulationSnapshot.paused,
    // AmberClubSimulation applies its own integer game-speed multiplier.
    speed: 1,
    onStep: () => {
      runtime.simulation.tick();
      publish();
    },
  });

  const dispatch = useCallback((action: ViewAction) => {
    switch (action.type) {
      case 'start-shift':
        runtime.simulation.start();
        break;
      case 'toggle-pause':
        runtime.simulation.setPaused(!runtime.simulation.getState().paused);
        break;
      case 'toggle-speed': {
        const current = runtime.simulation.getState().speed;
        runtime.simulation.setSpeed(current === 1 ? 2 : current === 2 ? 3 : 1);
        break;
      }
      case 'toggle-sound':
        setSoundEnabled((enabled) => !enabled);
        break;
      case 'purchase-room':
        runtime.simulation.advanceRoomLifecycle(action.roomId);
        break;
      case 'reset':
        runtime.simulation.reset();
        break;
      case 'purchase-upgrade':
        if (action.venueId !== 'bar' && ROOM_IDS.includes(action.venueId)) {
          runtime.simulation.purchaseRoomUpgrade(action.venueId, action.upgradeId as RoomUpgradeId);
        }
        break;
      case 'focus':
      case 'toggle-drawer':
        break;
    }
    publish();
  }, [publish, runtime]);

  const advanceTicks = useCallback((ticks: number) => {
    runtime.simulation.advanceTicks(ticks);
    publish();
  }, [publish, runtime]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden || !runtime.simulation.getState().started) return;
      runtime.simulation.setPaused(true);
      publish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [publish, runtime]);

  const persistSignature = `${simulationSnapshot.balance}:${soundEnabled}:${simulationSnapshot.rooms
    .map((room) => `${room.id},${room.lifecycle},${room.renovationStage},${room.staff.hired},${room.completedSessions},${room.revenue},${room.upgrades.staffSpeed},${room.upgrades.capacity},${room.upgrades.quality}`)
    .join('|')}:${Math.floor(simulationSnapshot.simulationTimeSeconds / 150)}:${simulationSnapshot.servedGuests}`;

  useEffect(() => {
    persistRuntimeProgress(
      runtime.storage,
      runtime.progress,
      runtime.statBaselines,
      simulationSnapshot,
      soundEnabled,
    );
  }, [persistSignature, runtime]);

  const viewSnapshot = useMemo(() => mapSimulationToView(simulationSnapshot, {
    soundEnabled,
    prestigeBase: runtime.statBaselines.prestige,
    servedBase: runtime.statBaselines.served,
    dayBase: runtime.statBaselines.day,
  }), [runtime, simulationSnapshot, soundEnabled]);

  return {
    simulation: runtime.simulation,
    simulationSnapshot,
    viewSnapshot,
    dispatch,
    advanceTicks,
    refresh: publish,
  };
}
