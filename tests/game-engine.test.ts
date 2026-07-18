import { describe, expect, it } from 'vitest';
import { GUEST_CHAIR_OFFSET, TABLE_LAYOUT, TABLE_RADIUS } from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const makeEngine = (storage: Storage | null = null) => new GameEngine({ rng: () => 0.5, storage });

describe('GameEngine', () => {
  it('runs the complete autonomous service loop and earns money', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(100);

    const state = engine.getSnapshot();
    expect(state.served).toBeGreaterThan(0);
    expect(state.coins).toBeGreaterThan(64);
    expect(state.patrons.length).toBeLessThanOrEqual(6);
    expect(state.tables.filter((table) => table.occupantId).length).toBeLessThanOrEqual(6);
  });

  it('buys and persists upgrades without saving transient renderer state', () => {
    const storage = new MemoryStorage();
    const first = makeEngine(storage);

    expect(first.purchaseUpgrade('moveSpeed')).toBe(true);
    expect(first.getSnapshot().upgrades.moveSpeed).toBe(2);
    expect(first.getSnapshot().coins).toBe(26);

    const restored = makeEngine(storage);
    expect(restored.getSnapshot().upgrades.moveSpeed).toBe(2);
    expect(restored.getSnapshot().coins).toBe(26);
    expect(restored.getSnapshot().patrons).toEqual([]);
    expect(restored.getSnapshot().bartender.state).toBe('idle');
  });

  it('freezes simulation time and actors while paused', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(4);
    engine.setPaused(true);
    const before = engine.getSnapshot();

    engine.advance(20);
    const after = engine.getSnapshot();
    expect(after.shiftProgress).toBe(before.shiftProgress);
    expect(after.patrons).toEqual(before.patrons);
  });

  it('unlocks a new day and awards the shift bonus', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(151);

    const state = engine.getSnapshot();
    expect(state.day).toBe(2);
    expect(state.lastEvent).not.toBeNull();
    expect(state.served).toBeGreaterThan(1);
  });

  it('keeps seated guests clear of the tabletop and facing their table', () => {
    for (const table of TABLE_LAYOUT) {
      const seatDistance = Math.hypot(table.seat.x - table.position.x, table.seat.z - table.position.z);
      const serviceDistance = Math.hypot(table.service.x - table.position.x, table.service.z - table.position.z);
      expect(seatDistance).toBeCloseTo(GUEST_CHAIR_OFFSET, 4);
      expect(seatDistance).toBeGreaterThan(TABLE_RADIUS + 0.2);
      expect(serviceDistance).toBeGreaterThan(TABLE_RADIUS + 0.35);
    }

    const engine = makeEngine();
    engine.start();
    engine.advance(14);
    const snapshot = engine.getSnapshot();
    const seatedPatron = snapshot.patrons.find((patron) => patron.state !== 'walking_in' && patron.state !== 'leaving');
    expect(seatedPatron).toBeDefined();
    const table = snapshot.tables[seatedPatron!.tableId];
    expect(seatedPatron!.target).toEqual(table.position);
  });
});
