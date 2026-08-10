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
const makeFundedEngine = (coins = 5_000, upgrades = INITIAL_UPGRADES, rng = () => 0.5) => {
  const storage = new MemoryStorage();
  storage.setItem('hops-and-honey-save-v1', JSON.stringify({
    coins,
    reputation: 3,
    served: 0,
    day: 1,
    upgrades,
    soundEnabled: true,
  }));
  return { engine: new GameEngine({ rng, storage }), storage };
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

  it('keeps the simulation running without a pause state', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(4);
    const before = engine.getSnapshot();

    engine.advance(1);
    const after = engine.getSnapshot();
    expect(after.shiftProgress).toBeGreaterThan(before.shiftProgress);
    expect(after).not.toHaveProperty('paused');
    expect(engine).not.toHaveProperty('togglePause');
  });

  it('unlocks a new day and awards the shift bonus', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(151);

    const state = engine.getSnapshot();
    expect(state.day).toBe(2);
    expect(state.lastEvent).not.toBeNull();
    expect(state.served).toBeGreaterThan(1);
    expect(state.lastShiftSummary).toMatchObject({
      dayNumber: 1,
      operatingRevenue: expect.any(Number),
      servedThisShift: expect.any(Number),
      roomRevenueThisShift: 0,
      blockedArrivals: expect.any(Number),
      bonus: expect.any(Number),
    });
    expect(state.lastShiftSummary!.operatingRevenue).toBeGreaterThan(0);
    expect(state.lastShiftSummary!.servedThisShift).toBeGreaterThan(0);
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
    const karaoke = ROOM_DEFINITIONS.find((room) => room.id === 'karaoke')!;

    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoom('karaoke')).toBe(false);
    expect(engine.getSnapshot().coins).toBe(5_000 - karaoke.unlockCost);
    expect(engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')?.staffState).toBe('waiting');

    engine.start();
    let sawWalkToRoom = false;
    let sawWaitingRoom = false;
    let sawInRoom = false;
    for (let tick = 0; tick < 720; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      expect(assigned.length).toBeLessThanOrEqual(snapshot.rooms.find((room) => room.id === 'karaoke')!.capacity);
      expect(assigned.every((patron) => patron.order !== null && patron.barServed)).toBe(true);
      sawWalkToRoom ||= assigned.some((patron) => patron.state === 'walking_to_room');
      sawWaitingRoom ||= assigned.some((patron) => patron.state === 'waiting_room');
      sawInRoom ||= assigned.some((patron) => patron.state === 'in_room');
      const activeGuests = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke' && patron.state === 'in_room').length;
      expect(snapshot.rooms.find((room) => room.id === 'karaoke')!.guests).toBe(activeGuests);
      if (snapshot.rooms.find((room) => room.id === 'karaoke')!.completedSessions > 0) break;
    }
    const room = engine.getSnapshot().rooms.find((item) => item.id === 'karaoke')!;
    expect(sawWalkToRoom).toBe(true);
    expect(sawWaitingRoom).toBe(true);
    expect(sawInRoom).toBe(true);
    expect(engine.getSnapshot().served).toBeGreaterThan(0);
    expect(room.completedSessions).toBeGreaterThanOrEqual(1);
    expect(room.revenue).toBe(room.completedSessions * karaoke.baseProfit);
    expect(engine.getSnapshot().roomRevenue).toBe(room.revenue);
  });

  it('guarantees a real bar-served first guest for every newly opened room at x2', () => {
    for (const definition of ROOM_DEFINITIONS) {
      // This roll would reject every normal optional room visit, proving that
      // the one-time opening priority—not random luck—drives the first visit.
      const { engine } = makeFundedEngine(5_000, INITIAL_UPGRADES, () => 0.999);
      expect(engine.purchaseRoom(definition.id)).toBe(true);
      expect(engine.getSnapshot().rooms.find((room) => room.id === definition.id)?.awaitingFirstGuest).toBe(true);
      engine.toggleSpeed();
      engine.start();

      let realSeconds = 0;
      while (realSeconds < 20) {
        engine.advance(0.25);
        realSeconds += 0.25;
        if (engine.getSnapshot().rooms.find((room) => room.id === definition.id)?.staffState === 'serving') break;
      }

      const snapshot = engine.getSnapshot();
      const room = snapshot.rooms.find((candidate) => candidate.id === definition.id)!;
      const firstGuests = snapshot.patrons.filter((patron) => patron.roomId === definition.id && patron.state === 'in_room');
      expect(room.staffState, `${definition.id} did not start within ${realSeconds}s`).toBe('serving');
      expect(realSeconds, `${definition.id} first-session latency`).toBeGreaterThanOrEqual(10);
      expect(realSeconds, `${definition.id} first-session latency`).toBeLessThanOrEqual(20);
      expect(room.awaitingFirstGuest).toBe(false);
      expect(firstGuests.length).toBeGreaterThan(0);
      expect(firstGuests.every((patron) => patron.barServed && patron.order !== null)).toBe(true);
    }
  });

  it('keeps reserved walkers queued and excludes them from the active session payout', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 10,
      orderSpeed: 10,
      prepSpeed: 10,
      cleanSpeed: 10,
      advertising: 8,
    };
    const { engine } = makeFundedEngine(5_000, fastUpgrades);
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    engine.start();

    let sawQueuedGuest = false;
    let targetSession = 0;
    let revenueBefore = 0;
    let expectedIncome = 0;
    let verifiedPayout = false;
    for (let tick = 0; tick < 1_200; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const room = snapshot.rooms.find((item) => item.id === 'karaoke')!;
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      if (room.staffState === 'serving') {
        expect(assigned.every((patron) => patron.barServed)).toBe(true);
        const activeGuests = assigned.filter((patron) => patron.state === 'in_room');
        const queuedGuests = assigned.filter((patron) => patron.state === 'walking_to_room' || patron.state === 'waiting_room');
        expect(activeGuests).toHaveLength(room.guests);
        if (targetSession === 0 && queuedGuests.length > 0) {
          sawQueuedGuest = true;
          targetSession = room.completedSessions + 1;
          revenueBefore = room.revenue;
          expectedIncome = room.perGuestProfit * activeGuests.length;
        }
      }
      if (targetSession > 0 && room.completedSessions >= targetSession) {
        expect(room.revenue - revenueBefore).toBe(expectedIncome);
        verifiedPayout = true;
        break;
      }
    }
    expect(sawQueuedGuest).toBe(true);
    expect(verifiedPayout).toBe(true);
  });

  it('pays only for the guests in the active batch, never for empty capacity', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 10,
      orderSpeed: 10,
      prepSpeed: 10,
      cleanSpeed: 10,
      advertising: 8,
    };
    const { engine } = makeFundedEngine(5_000, fastUpgrades);
    const definition = ROOM_DEFINITIONS.find((room) => room.id === 'karaoke')!;
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    engine.start();

    let targetSession = 0;
    let revenueBeforeFullSession = 0;
    let expectedIncome = 0;
    let verifiedFullPayout = false;
    for (let tick = 0; tick < 1_600; tick += 1) {
      engine.advance(0.25);
      const room = engine.getSnapshot().rooms.find((item) => item.id === 'karaoke')!;
      if (targetSession === 0 && room.staffState === 'serving' && room.guests > 0) {
        targetSession = room.completedSessions + 1;
        revenueBeforeFullSession = room.revenue;
        expectedIncome = room.perGuestProfit * room.guests;
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
    expect(engine.purchaseRoomUpgrade('sauna', 'quality')).toBe(false);
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'quality')).toBe(true);
    expect(engine.getSnapshot().lastEvent?.roomId).toBe('karaoke');

    engine.start();
    for (let tick = 0; tick < 720 && engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')!.completedSessions === 0; tick += 1) {
      engine.advance(0.25);
    }
    const restored = makeEngine(storage).getSnapshot();
    const karaoke = restored.rooms.find((room) => room.id === 'karaoke')!;
    const sauna = restored.rooms.find((room) => room.id === 'sauna')!;
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

  it('uses the approved first-step room expansion prices', () => {
    expect(ROOM_DEFINITIONS.find((room) => room.id === 'karaoke')?.unlockCost).toBe(230);
    expect(getRoomUpgradeCost('karaoke', 'capacity', 1)).toBe(140);
    expect(getRoomUpgradeCost('sauna', 'capacity', 1)).toBe(320);
    expect(getRoomUpgradeCost('massage', 'capacity', 1)).toBe(650);
    expect(getRoomUpgradeCost('massage', 'staffSpeed', 1)).toBe(110);
  });

  it('uses the correct grammatical form when the sauna opens', () => {
    const { engine } = makeFundedEngine();
    expect(engine.purchaseRoom('sauna')).toBe(true);
    expect(engine.getSnapshot().lastEvent?.message).toContain('Финская сауна открыта!');
  });

  it('prices the first speed and quality upgrades from the room balance table', () => {
    expect(getRoomUpgradeCost('karaoke', 'staffSpeed', 1)).toBe(60);
    expect(getRoomUpgradeCost('karaoke', 'quality', 1)).toBe(70);
    expect(getRoomUpgradeCost('sauna', 'staffSpeed', 1)).toBe(110);
    expect(getRoomUpgradeCost('sauna', 'quality', 1)).toBe(130);
    expect(getRoomUpgradeCost('massage', 'staffSpeed', 1)).toBe(110);
    expect(getRoomUpgradeCost('massage', 'quality', 1)).toBe(200);
  });

  it('derives milestones and new economy counters from a legacy save', () => {
    const storage = new MemoryStorage();
    storage.setItem('hops-and-honey-save-v1', JSON.stringify({
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
    expect(state.lastShiftSummary).toBeNull();
    expect(state.barDiagnostics.blockedArrivals).toBe(0);
    expect(state.totalMilestoneCount).toBe(MILESTONE_DEFINITIONS.length);
    expect(state.achievedMilestoneCount).toBeGreaterThan(0);
    expect(state.nextMilestone).not.toBeNull();
    expect(state.nextMilestone!.current).toBeLessThan(state.nextMilestone!.target);
    expect(state.rooms.every((room) => !room.unlocked)).toBe(true);
    expect(state.rooms.every((room) => room.recentSessions.length === 0)).toBe(true);
  });

  it('reports honest rolling room utilization and persists the last ten sessions', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 6,
      orderSpeed: 6,
      prepSpeed: 6,
      cleanSpeed: 6,
      advertising: 5,
    };
    const { engine, storage } = makeFundedEngine(5_000, fastUpgrades);
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    engine.start();

    for (let tick = 0; tick < 3_000; tick += 1) {
      engine.advance(0.25);
      if (engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')!.completedSessions >= 12) break;
    }

    const karaoke = engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')!;
    expect(karaoke.completedSessions).toBeGreaterThanOrEqual(12);
    expect(karaoke.recentSessions).toHaveLength(10);
    const recentGuests = karaoke.recentSessions.reduce((total, session) => total + session.guests, 0);
    const recentCapacity = karaoke.recentSessions.reduce((total, session) => total + session.capacity, 0);
    const recentRevenue = karaoke.recentSessions.reduce((total, session) => total + session.revenue, 0);
    expect(karaoke.recentUtilization).toBeCloseTo(recentGuests / recentCapacity, 8);
    expect(karaoke.recentAverageRevenuePerSession).toBeCloseTo(recentRevenue / 10, 8);
    expect(karaoke.realizedRevenuePerSession).toBeCloseTo(karaoke.revenue / karaoke.completedSessions, 8);
    expect(JSON.parse(JSON.stringify(engine.getSnapshot())).rooms[0].recentSessions).toEqual(karaoke.recentSessions);

    const restored = makeEngine(storage).getSnapshot().rooms.find((room) => room.id === 'karaoke')!;
    expect(restored.recentSessions).toEqual(karaoke.recentSessions);
    expect(restored.recentUtilization).toBeCloseTo(karaoke.recentUtilization, 8);
  });

  it('exposes bar queue, table and blocked-arrival diagnostics', () => {
    const { engine } = makeFundedEngine(5_000, { ...INITIAL_UPGRADES, advertising: 5 });
    engine.start();
    engine.advance(120);

    const snapshot = engine.getSnapshot();
    const diagnostics = snapshot.barDiagnostics;
    expect(diagnostics.waitingOrders).toBe(snapshot.patrons.filter((patron) => patron.state === 'waiting_order').length);
    expect(diagnostics.waitingDrinks).toBe(snapshot.patrons.filter((patron) => patron.state === 'waiting_drink').length);
    expect(diagnostics.waitingPayments).toBe(snapshot.patrons.filter((patron) => patron.state === 'ready_to_pay').length);
    expect(diagnostics.occupiedTables + diagnostics.dirtyTables + diagnostics.openTables).toBe(snapshot.tables.length);
    expect(diagnostics.blockedArrivals).toBeGreaterThan(0);
    expect(['none', 'orders', 'drinks', 'payments', 'cleaning', 'tables']).toContain(diagnostics.primaryBottleneck);
  });
});
