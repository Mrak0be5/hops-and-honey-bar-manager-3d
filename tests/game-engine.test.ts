import { describe, expect, it } from 'vitest';
import {
  BAR_STATION,
  DAY_BONUS_CAP,
  ENTRANCE,
  ENTRY_AISLE,
  getRoomUpgradeCost,
  SERVICE_GATE,
  GUEST_CHAIR_OFFSET,
  INITIAL_UPGRADES,
  MILESTONE_DEFINITIONS,
  ROOM_DEFINITIONS,
  ROOM_LAYOUTS,
  SHIFT_DURATION,
  TABLE_LAYOUT,
  TABLE_RADIUS,
} from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';
import { findGridPath, isInsideWalkableZone, isWalkable, makeLevelObstacles, NAV_CELL_SIZE } from '../src/game/navigation';

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
const makeFundedEngine = (coins = 5_000, upgrades = INITIAL_UPGRADES) => {
  const storage = new MemoryStorage();
  storage.setItem('brothel-christopher-v1', JSON.stringify({
    coins,
    reputation: 3,
    served: 0,
    day: 1,
    upgrades,
    soundEnabled: true,
  }));
  return { engine: makeEngine(storage), storage };
};

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

  it('caps day bonuses and keeps them below a quarter of long-run income', () => {
    const engine = makeEngine();
    engine.start();
    // Eighteen complete shifts are enough to prove the bounded ratio while
    // keeping the navigation-heavy simulation comfortably below CI timeouts.
    engine.advance(SHIFT_DURATION * 18 + 1);

    const state = engine.getSnapshot();
    expect(state.totalOperatingRevenue).toBeGreaterThan(0);
    expect(state.totalDayBonus).toBeLessThanOrEqual((state.day - 1) * DAY_BONUS_CAP);
    expect(state.totalDayBonus / (state.totalOperatingRevenue + state.totalDayBonus)).toBeLessThanOrEqual(0.25);
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

  it('connects every room to the bar through its doorway without crossing exterior void', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    expect(isInsideWalkableZone({ x: 0, z: 8 })).toBe(false);
    expect(isWalkable({ x: 0, z: 8 }, obstacles)).toBe(false);

    for (const definition of ROOM_DEFINITIONS) {
      const layout = ROOM_LAYOUTS[definition.id];
      for (const guestSpot of layout.guestSpots) {
        expect(isWalkable(guestSpot, obstacles), `${definition.id} guest spot overlaps furniture`).toBe(true);
        let cursor = TABLE_LAYOUT[0].seat;
        for (const stop of [layout.barPortal, layout.roomPortal, guestSpot]) {
          const route = findGridPath(cursor, stop, obstacles);
          expect(route.length, `${definition.id} cannot reach ${stop.x},${stop.z}`).toBeGreaterThan(0);
          for (const point of route) {
            expect(
              isWalkable(point, obstacles),
              `${definition.id} route clips at ${point.x},${point.z}`,
            ).toBe(true);
          }
          cursor = stop;
        }

        cursor = guestSpot;
        for (const stop of [layout.roomPortal, layout.barPortal, ENTRY_AISLE, ENTRANCE]) {
          const route = findGridPath(cursor, stop, obstacles);
          expect(route.length, `${definition.id} cannot exit through ${stop.x},${stop.z}`).toBeGreaterThan(0);
          for (const point of route) expect(isWalkable(point, obstacles)).toBe(true);
          cursor = stop;
        }
      }
    }
  });

  it('keeps optional rooms locked and inactive until they are repaired', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().rooms).toHaveLength(3);
    expect(engine.getSnapshot().rooms.every((room) => !room.unlocked && room.staffState === 'locked')).toBe(true);

    engine.start();
    engine.advance(100);
    expect(engine.getSnapshot().roomRevenue).toBe(0);
  });

  it('charges the repair price and sends only served bar guests into a room', () => {
    const { engine } = makeFundedEngine();
    const karaoke = ROOM_DEFINITIONS.find((room) => room.id === 'strip')!;

    expect(engine.purchaseRoom('strip')).toBe(true);
    expect(engine.purchaseRoom('strip')).toBe(false);
    expect(engine.getSnapshot().coins).toBe(5_000 - karaoke.unlockCost);
    expect(engine.getSnapshot().rooms.find((room) => room.id === 'strip')?.staffState).toBe('waiting');

    engine.start();
    let sawWalkToRoom = false;
    let sawWaitingRoom = false;
    let sawInRoom = false;
    for (let tick = 0; tick < 720; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'strip'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      expect(assigned.length).toBeLessThanOrEqual(snapshot.rooms.find((room) => room.id === 'strip')!.capacity);
      expect(assigned.every((patron) => patron.order !== null && patron.barServed)).toBe(true);
      sawWalkToRoom ||= assigned.some((patron) => patron.state === 'walking_to_room');
      sawWaitingRoom ||= assigned.some((patron) => patron.state === 'waiting_room');
      sawInRoom ||= assigned.some((patron) => patron.state === 'in_room');
      const activeGuests = snapshot.patrons.filter((patron) => patron.roomId === 'strip' && patron.state === 'in_room').length;
      expect(snapshot.rooms.find((room) => room.id === 'strip')!.guests).toBe(activeGuests);
      if (snapshot.rooms.find((room) => room.id === 'strip')!.completedSessions > 0) break;
    }
    const room = engine.getSnapshot().rooms.find((item) => item.id === 'strip')!;
    expect(sawWalkToRoom).toBe(true);
    expect(sawWaitingRoom).toBe(true);
    expect(sawInRoom).toBe(true);
    expect(engine.getSnapshot().served).toBeGreaterThan(0);
    expect(room.completedSessions).toBeGreaterThanOrEqual(1);
    expect(room.revenue).toBe(room.completedSessions * karaoke.baseProfit);
    expect(engine.getSnapshot().roomRevenue).toBe(room.revenue);
  });

  it('waits for every reserved room guest before starting a larger session', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 10,
      orderSpeed: 10,
      prepSpeed: 10,
      cleanSpeed: 10,
      advertising: 8,
    };
    const { engine } = makeFundedEngine(5_000, fastUpgrades);
    expect(engine.purchaseRoom('strip')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'capacity')).toBe(true);
    engine.start();

    let sawApproachingReservation = false;
    let verifiedServingBatch = false;
    for (let tick = 0; tick < 1_200; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const room = snapshot.rooms.find((item) => item.id === 'strip')!;
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'strip'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      if (room.staffState === 'welcoming' && assigned.some((patron) => patron.state === 'walking_to_room')) {
        sawApproachingReservation = true;
      }
      if (room.staffState === 'serving') {
        expect(assigned.some((patron) => patron.state === 'walking_to_room' || patron.state === 'waiting_room')).toBe(false);
        expect(assigned.every((patron) => patron.barServed)).toBe(true);
        expect(assigned.filter((patron) => patron.state === 'in_room')).toHaveLength(room.guests);
        if (sawApproachingReservation) {
          verifiedServingBatch = true;
          break;
        }
      }
    }
    expect(sawApproachingReservation).toBe(true);
    expect(verifiedServingBatch).toBe(true);
  });

  it('naturally fills a two-seat room and pays for the actual full batch', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 10,
      orderSpeed: 10,
      prepSpeed: 10,
      cleanSpeed: 10,
      advertising: 8,
    };
    const { engine } = makeFundedEngine(5_000, fastUpgrades);
    const definition = ROOM_DEFINITIONS.find((room) => room.id === 'strip')!;
    expect(engine.purchaseRoom('strip')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'capacity')).toBe(true);
    engine.start();

    let targetSession = 0;
    let revenueBeforeFullSession = 0;
    let expectedIncome = 0;
    let verifiedFullPayout = false;
    for (let tick = 0; tick < 1_600; tick += 1) {
      engine.advance(0.25);
      const room = engine.getSnapshot().rooms.find((item) => item.id === 'strip')!;
      if (targetSession === 0 && room.staffState === 'serving' && room.guests === 2) {
        targetSession = room.completedSessions + 1;
        revenueBeforeFullSession = room.revenue;
        expectedIncome = room.maxSessionProfit;
        expect(room.perGuestProfit).toBe(definition.baseProfit);
        expect(room.maxSessionProfit).toBe(room.perGuestProfit * room.capacity);
      }
      if (targetSession > 0 && room.completedSessions >= targetSession) {
        expect(room.revenue - revenueBeforeFullSession).toBe(expectedIncome);
        verifiedFullPayout = true;
        break;
      }
    }
    expect(targetSession).toBeGreaterThan(0);
    expect(verifiedFullPayout).toBe(true);
  });

  it('keeps room upgrades independent and restores them with room revenue', () => {
    const { engine, storage } = makeFundedEngine();
    expect(engine.purchaseRoomUpgrade('sex', 'quality')).toBe(false);
    expect(engine.purchaseRoom('strip')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('strip', 'quality')).toBe(true);

    engine.start();
    for (let tick = 0; tick < 720 && engine.getSnapshot().rooms.find((room) => room.id === 'strip')!.completedSessions === 0; tick += 1) {
      engine.advance(0.25);
    }
    const restored = makeEngine(storage).getSnapshot();
    const karaoke = restored.rooms.find((room) => room.id === 'strip')!;
    const sauna = restored.rooms.find((room) => room.id === 'sex')!;
    expect(karaoke.unlocked).toBe(true);
    expect(karaoke.upgrades).toEqual({ staffSpeed: 2, capacity: 2, quality: 2 });
    expect(karaoke.capacity).toBe(2);
    expect(karaoke.completedSessions).toBeGreaterThanOrEqual(1);
    expect(karaoke.revenue).toBeGreaterThan(0);
    expect(sauna.unlocked).toBe(false);
    expect(sauna.upgrades).toEqual({ staffSpeed: 1, capacity: 1, quality: 1 });
  });

  it('prices higher-profit rooms above lower-profit rooms', () => {
    for (let index = 1; index < ROOM_DEFINITIONS.length; index += 1) {
      expect(ROOM_DEFINITIONS[index].baseProfit).toBeGreaterThan(ROOM_DEFINITIONS[index - 1].baseProfit);
      expect(ROOM_DEFINITIONS[index].unlockCost).toBeGreaterThan(ROOM_DEFINITIONS[index - 1].unlockCost);
    }
  });

  it('uses the correct grammatical form when the sex room opens', () => {
    const { engine } = makeFundedEngine();
    expect(engine.purchaseRoom('sex')).toBe(true);
    expect(engine.getSnapshot().lastEvent?.message).toContain('Комната удовольствий открыта!');
  });

  it('prices the first speed and quality upgrades for a six-to-eight shift payoff', () => {
    expect(getRoomUpgradeCost('strip', 'staffSpeed', 1)).toBe(60);
    expect(getRoomUpgradeCost('strip', 'quality', 1)).toBe(70);
    expect(getRoomUpgradeCost('sex', 'staffSpeed', 1)).toBe(110);
    expect(getRoomUpgradeCost('sex', 'quality', 1)).toBe(130);
    expect(getRoomUpgradeCost('gangbang', 'staffSpeed', 1)).toBe(180);
    expect(getRoomUpgradeCost('gangbang', 'quality', 1)).toBe(200);
  });

  it('derives milestones and new economy counters from a legacy save', () => {
    const storage = new MemoryStorage();
    storage.setItem('brothel-christopher-v1', JSON.stringify({
      coins: 432,
      reputation: 18,
      served: 120,
      day: 12,
      upgrades: INITIAL_UPGRADES,
      soundEnabled: true,
    }));

    const state = makeEngine(storage).getSnapshot();
    expect(state.coins).toBe(432);
    expect(state.served).toBe(120);
    expect(state.totalOperatingRevenue).toBe(0);
    expect(state.totalDayBonus).toBe(0);
    expect(state.totalMilestoneCount).toBe(MILESTONE_DEFINITIONS.length);
    expect(state.achievedMilestoneCount).toBeGreaterThan(0);
    expect(state.nextMilestone).not.toBeNull();
    expect(state.nextMilestone!.current).toBeLessThan(state.nextMilestone!.target);
    expect(state.rooms.every((room) => !room.unlocked)).toBe(true);
  });
});
