import { describe, expect, it } from 'vitest';
import {
  BAR_ACTION_MAX_LEVEL,
  getAverageDrinkPrice,
  getBartenderMoveSpeed,
  getCleaningDuration,
  getOrderDuration,
  getPreparationDuration,
  getRoomCooldownDuration,
  getRoomGroupWindow,
  getRoomResetDuration,
  getRoomSessionDuration,
  INITIAL_UPGRADES,
  ROOM_DEFINITIONS,
  UPGRADE_DEFS,
} from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';
import type { RoomId, UpgradeLevels } from '../src/game/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
};

const simulateRoomRevenue = (roomId: RoomId, capacity: number, upgrades: UpgradeLevels) => {
  const storage = new MemoryStorage();
  storage.setItem('hops-and-honey-save-v1', JSON.stringify({
    coins: 0,
    reputation: 0,
    served: 0,
    day: 1,
    soundEnabled: false,
    upgrades,
    rooms: {
      [roomId]: {
        unlocked: true,
        completedSessions: 0,
        revenue: 0,
        upgrades: { staffSpeed: 1, capacity, quality: 1 },
      },
    },
  }));
  const engine = new GameEngine({ storage, rng: seededRandom(17) });
  engine.start();
  engine.advance(600);
  return engine.getSnapshot().rooms.find((room) => room.id === roomId)!.revenue;
};

describe('numeric upgrade formulas', () => {
  it('exposes the exact bartender values used by the simulation', () => {
    expect(getBartenderMoveSpeed(1)).toBeCloseTo(2.15, 6);
    expect(getBartenderMoveSpeed(2)).toBeCloseTo(2.494, 6);
    expect(getOrderDuration(2)).toBeCloseTo(1.7845, 6);
    expect(getPreparationDuration(2)).toBeCloseTo(2.747, 6);
    expect(getCleaningDuration(2)).toBeCloseTo(2.12, 6);
  });

  it('caps every bartender movement/action upgrade at level six', () => {
    for (const key of ['moveSpeed', 'orderSpeed', 'prepSpeed', 'cleanSpeed'] as const) {
      expect(UPGRADE_DEFS.find((definition) => definition.key === key)?.maxLevel).toBe(BAR_ACTION_MAX_LEVEL);
    }
    expect(getBartenderMoveSpeed(99)).toBe(getBartenderMoveSpeed(BAR_ACTION_MAX_LEVEL));
    expect(getOrderDuration(99)).toBe(getOrderDuration(BAR_ACTION_MAX_LEVEL));
    expect(getPreparationDuration(99)).toBe(getPreparationDuration(BAR_ACTION_MAX_LEVEL));
    expect(getCleaningDuration(99)).toBe(getCleaningDuration(BAR_ACTION_MAX_LEVEL));
  });

  it('clamps over-levelled legacy saves to each current definition', () => {
    const storage = new MemoryStorage();
    storage.setItem('hops-and-honey-save-v1', JSON.stringify({
      coins: 0,
      reputation: 0,
      served: 0,
      day: 1,
      soundEnabled: true,
      upgrades: Object.fromEntries(Object.keys(INITIAL_UPGRADES).map((key) => [key, 99])),
    }));

    const upgrades = new GameEngine({ storage, rng: () => 0.5 }).getSnapshot().upgrades;
    expect(upgrades).toEqual({
      moveSpeed: 6,
      orderSpeed: 6,
      prepSpeed: 6,
      cleanSpeed: 6,
      assortment: 5,
      advertising: 8,
    });
  });

  it('makes room staff reduce every timed part of the work cycle', () => {
    const cycleDuration = (level: number) => (
      getRoomSessionDuration('karaoke', level)
      + getRoomResetDuration(level)
      + getRoomCooldownDuration(level)
    );

    expect(getRoomSessionDuration('karaoke', 2)).toBeCloseTo(30.6, 6);
    expect(getRoomResetDuration(2)).toBeCloseTo(0.9775, 6);
    expect(getRoomCooldownDuration(2)).toBeCloseTo(2.04, 6);
    for (let level = 1; level < 5; level += 1) {
      expect(cycleDuration(level + 1)).toBeLessThan(cycleDuration(level));
      expect(cycleDuration(level + 1) / cycleDuration(level)).toBeCloseTo(0.85, 6);
    }
  });

  it('gives larger capacities a larger maximum batch window without changing the minimum beat', () => {
    expect(getRoomGroupWindow(1)).toBeCloseTo(8, 6);
    expect(getRoomGroupWindow(2)).toBeCloseTo(10, 6);
    expect(getRoomGroupWindow(3)).toBeCloseTo(12, 6);
    expect(getRoomGroupWindow(4)).toBeCloseTo(14, 6);
    expect(getRoomGroupWindow(99)).toBeCloseTo(14, 6);
  });

  it('matches the premium-biased expected drink prices used by the menu', () => {
    expect(getAverageDrinkPrice(1)).toBe(12);
    expect(getAverageDrinkPrice(2)).toBeCloseTo(15.0907, 4);
    expect(getAverageDrinkPrice(3)).toBeCloseTo(18.4963, 4);
    expect(getAverageDrinkPrice(4)).toBeCloseTo(22.6148, 4);
    expect(getAverageDrinkPrice(5)).toBeCloseTo(27.7809, 4);
    expect(getAverageDrinkPrice(99)).toBe(getAverageDrinkPrice(5));
  });

  it('keeps every capacity step non-negative at base demand and useful at strong demand', () => {
    const strongDemand: UpgradeLevels = {
      moveSpeed: 6,
      orderSpeed: 6,
      prepSpeed: 6,
      cleanSpeed: 6,
      assortment: 1,
      advertising: 8,
    };

    for (const definition of ROOM_DEFINITIONS) {
      const baseRevenue: number[] = [];
      const strongRevenue: number[] = [];
      for (let capacity = 1; capacity <= definition.maxCapacity; capacity += 1) {
        baseRevenue.push(simulateRoomRevenue(definition.id, capacity, INITIAL_UPGRADES));
        strongRevenue.push(simulateRoomRevenue(definition.id, capacity, strongDemand));
      }
      for (let index = 1; index < baseRevenue.length; index += 1) {
        expect(baseRevenue[index], `${definition.id} base capacity ${index + 1}`).toBeGreaterThanOrEqual(baseRevenue[index - 1]);
        expect(strongRevenue[index], `${definition.id} strong capacity ${index + 1}`).toBeGreaterThan(strongRevenue[index - 1]);
      }
    }
  }, 20_000);
});
