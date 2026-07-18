import { describe, expect, it } from 'vitest';
import { BAR_STATION, ENTRANCE, SERVICE_GATE, GUEST_CHAIR_OFFSET, TABLE_LAYOUT, TABLE_RADIUS } from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';
import { findGridPath, isWalkable, makeLevelObstacles, NAV_CELL_SIZE } from '../src/game/navigation';

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

  it('finds obstacle-safe grid routes from the entrance to every seat', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    for (const table of TABLE_LAYOUT) {
      const route = findGridPath(ENTRANCE, table.seat, obstacles);
      expect(route.length, `table ${table.id} has no route`).toBeGreaterThan(0);
      for (const point of route.slice(0, -1)) {
        expect(isWalkable(point, obstacles), `table ${table.id} route clips at ${point.x},${point.z}`).toBe(true);
      }
      for (let index = 1; index < route.length; index += 1) {
        const dx = Math.abs(route[index].x - route[index - 1].x);
        const dz = Math.abs(route[index].z - route[index - 1].z);
        expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(NAV_CELL_SIZE * Math.SQRT2 + 0.06);
      }
    }
  });

  it('routes the bartender only through the open end of the counter', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    const toGate = findGridPath(BAR_STATION, SERVICE_GATE, obstacles);
    expect(toGate.length).toBeGreaterThan(0);
    for (const point of toGate.slice(0, -1)) expect(isWalkable(point, obstacles)).toBe(true);

    for (const table of TABLE_LAYOUT) {
      const route = findGridPath(SERVICE_GATE, table.service, obstacles);
      expect(route.length, `bar to table ${table.id} has no route`).toBeGreaterThan(0);
      for (const point of route) expect(isWalkable(point, obstacles, 0.26, [table.service])).toBe(true);
    }
  });
});
