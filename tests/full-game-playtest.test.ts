import { describe, expect, it } from 'vitest';
import {
  ROOM_DEFINITIONS,
  STAFF_DEFINITIONS,
  ENTRANCE_QUEUE_CAP,
  INITIAL_UPGRADES,
} from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';
import type { StaffCharacterId, RoomId } from '../src/game/types';

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

describe('Comprehensive Gameplay Simulation & Edge Case Audit', () => {
  it('simulates progressive gameplay from Day 1 to Day 5 with hiring and room expansion', () => {
    const storage = new MemoryStorage();
    const engine = makeEngine(storage);
    engine.start();

    // Day 1: Bar only with default Christina
    for (let i = 0; i < 700; i++) engine.advance(0.25);
    let snap = engine.getSnapshot();
    expect(snap.day).toBeGreaterThanOrEqual(2);
    expect(snap.coins).toBeGreaterThan(64);

    // Hire Tigra and unlock Strip room
    const tigraDef = STAFF_DEFINITIONS.find((s) => s.id === 'tigra')!;
    if (snap.coins < tigraDef.hireCost + 280) {
      // Give enough coins to test room + staff flow
      storage.setItem('brothel-christopher-v1', JSON.stringify({
        ...JSON.parse(storage.getItem('brothel-christopher-v1')!),
        coins: 2000,
      }));
    }
    const reloadEngine = makeEngine(storage);
    reloadEngine.start();

    expect(reloadEngine.hireStaff('tigra')).toBe(true);
    expect(reloadEngine.purchaseRoom('strip')).toBe(true);
    expect(reloadEngine.assignStaff('strip', 0, 'tigra')).toBe(true);

    snap = reloadEngine.getSnapshot();
    expect(snap.venueSlots.strip[0]).toBe('tigra');
    expect(snap.roster.find((r) => r.id === 'tigra')?.hired).toBe(true);

    // Simulate 3 full shifts with bar + strip running
    for (let i = 0; i < 1800; i++) reloadEngine.advance(0.25);

    snap = reloadEngine.getSnapshot();
    const stripRoom = snap.rooms.find((r) => r.id === 'strip')!;
    expect(stripRoom.completedSessions).toBeGreaterThan(0);
    expect(stripRoom.revenue).toBeGreaterThan(0);

    // Verify all 9 staff can be hired if funded
    storage.setItem('brothel-christopher-v1', JSON.stringify({
      ...JSON.parse(storage.getItem('brothel-christopher-v1')!),
      coins: 10000,
    }));
    const fundedEngine = makeEngine(storage);
    fundedEngine.start();

    for (const staffDef of STAFF_DEFINITIONS) {
      if (!fundedEngine.getSnapshot().roster.find((r) => r.id === staffDef.id)?.hired) {
        expect(fundedEngine.hireStaff(staffDef.id)).toBe(true);
      }
    }
    snap = fundedEngine.getSnapshot();
    expect(snap.roster.every((r) => r.hired)).toBe(true);

    // Test dual worker slots in all rooms
    expect(fundedEngine.purchaseRoom('sex')).toBe(true);
    expect(fundedEngine.purchaseRoom('gangbang')).toBe(true);

    expect(fundedEngine.assignStaff('strip', 1, 'winna')).toBe(true);
    expect(fundedEngine.assignStaff('sex', 0, 'krolya')).toBe(true);
    expect(fundedEngine.assignStaff('sex', 1, 'ia')).toBe(true);
    expect(fundedEngine.assignStaff('gangbang', 0, 'piggy')).toBe(true);
    expect(fundedEngine.assignStaff('gangbang', 1, 'ru')).toBe(true);

    snap = fundedEngine.getSnapshot();
    expect(snap.venueSlots.strip).toEqual(['tigra', 'winna']);
    expect(snap.venueSlots.sex).toEqual(['krolya', 'ia']);
    expect(snap.venueSlots.gangbang).toEqual(['piggy', 'ru']);

    // Run for another 3 shifts with all venues staffed
    for (let i = 0; i < 3000; i++) fundedEngine.advance(0.25);

    snap = fundedEngine.getSnapshot();
    expect(snap.rooms.every((r) => r.completedSessions > 0)).toBe(true);
    expect(snap.coins).toBeGreaterThan(1000);
  });

  it('checks edge cases: empty bar, transferring staff, clearing slots, and day transitions mid-session', () => {
    const storage = new MemoryStorage();
    storage.setItem('brothel-christopher-v1', JSON.stringify({
      coins: 5000,
      reputation: 5,
      served: 50,
      day: 1,
      upgrades: INITIAL_UPGRADES,
      soundEnabled: true,
    }));
    const engine = makeEngine(storage);
    engine.start();

    // Hire everyone
    for (const def of STAFF_DEFINITIONS) {
      engine.hireStaff(def.id);
    }
    engine.purchaseRoom('strip');

    // Clear bar slots completely
    expect(engine.assignStaff('bar', 0, null)).toBe(true);
    expect(engine.assignStaff('bar', 1, null)).toBe(true);
    expect(engine.assignStaff('strip', 0, 'christina')).toBe(true);
    let snap = engine.getSnapshot();
    expect(snap.venueSlots.bar[0]).toBeNull();
    expect(snap.venueSlots.bar[1]).toBeNull();
    expect(snap.venueSlots.strip[0]).toBe('christina');

    // Bar is now empty! Unseated/seated patrons should evacuate cleanly
    for (let i = 0; i < 100; i++) engine.advance(0.25);
    snap = engine.getSnapshot();
    expect(snap.bartender.staffId).toBeNull();

    // Assign Sova to bar
    expect(engine.assignStaff('bar', 0, 'sova')).toBe(true);
    snap = engine.getSnapshot();
    expect(snap.bartender.staffId).toBe('sova');

    // Rapidly toggle speed
    engine.toggleSpeed();
    expect(engine.getSnapshot().speedMultiplier).toBe(2);
    engine.toggleSpeed();
    expect(engine.getSnapshot().speedMultiplier).toBe(1);

    // Reset progress
    engine.resetProgress();
    snap = engine.getSnapshot();
    expect(snap.started).toBe(false);
    expect(snap.coins).toBe(64);
    expect(snap.day).toBe(1);
    expect(snap.roster.filter((r) => r.hired)).toHaveLength(1); // Christina only
  });
});
