import {
  getRoomBlueprint,
  getRoomCapacity,
  getRoomLifecycleStageCost,
  getRoomSessionProfit,
  getRoomStaffSpeedMultiplier,
  getRoomUpgradeCost,
  ROOM_LIFECYCLE_STAGE_IDS,
  ROOM_IDS,
} from '../content/rooms';
import type {
  RoomId,
  RoomLifecycleStageId,
  RoomLifecycleState,
  RoomRenovationStage,
  RoomUpgradeId,
  RoomUpgradeLevels,
} from '../content/rooms';
import {
  AMBER_CLUB_VENUE,
  assertValidVenueBlueprint,
  getSlot,
  getSlotsByKind,
  worldToCell,
} from '../level/venueBlueprint';
import type { GridCell, VenueBlueprint } from '../level/types';
import { CellReservations } from '../navigation/CellReservations';
import { NavGrid } from '../navigation/NavGrid';
import { findPath } from '../navigation/findPath';
import { Ledger } from './Ledger';
import { SeededRandom } from './SeededRandom';
import { FIXED_DELTA_SECONDS, secondsToTicks } from './time';
import type {
  GuestPhase,
  GuestSnapshot,
  LedgerEntry,
  RoomChoiceUtility,
  RoomRuntimeSnapshot,
  SimulationEvent,
  SimulationSnapshot,
  SimulationSpeed,
  StaffRole,
  StaffSnapshot,
  StaffTaskKind,
  StaffTaskSnapshot,
} from './types';

export { FIXED_DELTA_SECONDS, FIXED_TICKS_PER_SECOND, secondsToTicks, ticksToSeconds } from './time';
export const BAR_SALE_PRICE = 24;
export const GUEST_MOVE_SPEED_METERS_PER_SECOND = 2.5;

export type InitialRoomProgress = Readonly<{
  lifecycle: RoomLifecycleState;
  renovationStage?: RoomRenovationStage;
  upgrades?: Readonly<Partial<RoomUpgradeLevels>>;
  completedSessions?: number;
  revenue?: number;
}>;

export type AmberClubSimulationOptions = Readonly<{
  seed?: number;
  venue?: VenueBlueprint;
  initialBalance?: number;
  unlockedRooms?: readonly RoomId[];
  initialRooms?: Readonly<Partial<Record<RoomId, InitialRoomProgress>>>;
  autoSpawn?: boolean;
  spawnIntervalTicks?: number;
  maxActiveGuests?: number;
  roomVisitChance?: number;
}>;

type MutableGuest = {
  id: string;
  phase: GuestPhase;
  cell: GridCell;
  route: GridCell[];
  targetSlotId: string | null;
  seatSlotId: string | null;
  roomSlotId: string | null;
  ticksRemaining: number;
  blockedTicks: number;
  movementCredits: number;
  barVisit: {
    completed: boolean;
    paidAtTick: number | null;
  };
  roomVisit: {
    roomId: RoomId;
    completed: boolean;
  } | null;
};

type MutableTask = {
  id: string;
  kind: StaffTaskKind;
  guestId: string;
  roomId: RoomId | null;
  assignedRole: StaffRole;
  totalTicks: number;
  remainingTicks: number;
};

type MutableStaff = {
  id: string;
  role: StaffRole;
  roomId: RoomId | null;
  level: number;
  salaryPerShift: number;
  task: MutableTask | null;
};

type MutableRoom = {
  id: RoomId;
  unlocked: boolean;
  lifecycle: RoomLifecycleState;
  renovationStage: RoomRenovationStage;
  capacity: number;
  staffHired: boolean;
  upgrades: RoomUpgradeLevels;
  reservedGuestIds: Set<string>;
  activeGuestIds: Set<string>;
  completedSessions: number;
  revenue: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const sameCell = (a: GridCell, b: GridCell) => a.x === b.x && a.z === b.z;
const cloneCell = (cell: GridCell): GridCell => ({ x: cell.x, z: cell.z });

const ROOM_PHASES = new Set<GuestPhase>(['walking_to_room', 'waiting_room', 'in_room']);

const NEXT_LIFECYCLE_STAGE: Readonly<Partial<Record<RoomLifecycleState, RoomLifecycleStageId>>> = {
  locked: 'permit',
  permitted: 'renovate',
  renovating: 'equip',
  equipping: 'hire',
};

const DEFAULT_RENOVATION_STAGE: Readonly<Record<RoomLifecycleState, RoomRenovationStage>> = {
  locked: 0,
  permitted: 1,
  renovating: 2,
  equipping: 3,
  open: 3,
};

export class AmberClubSimulation {
  readonly venue: VenueBlueprint;
  readonly navigation: NavGrid;
  readonly fixedDeltaSeconds = FIXED_DELTA_SECONDS;

  private initialSeed: number;
  private readonly initialBalance: number;
  private readonly initialUnlockedRooms: readonly RoomId[];
  private readonly initialRooms: Readonly<Partial<Record<RoomId, InitialRoomProgress>>>;
  private readonly autoSpawn: boolean;
  private readonly spawnIntervalTicks: number;
  private readonly maxActiveGuests: number;
  private readonly roomVisitChance: number;
  private rng!: SeededRandom;
  private ledger!: Ledger;
  private reservations = new CellReservations();
  private guests: MutableGuest[] = [];
  private staff: MutableStaff[] = [];
  private rooms = {} as Record<RoomId, MutableRoom>;
  private queuedTasks: MutableTask[] = [];
  private readonly slotOwners = new Map<string, string>();
  private events: SimulationEvent[] = [];
  private started = false;
  private paused = false;
  private speed: SimulationSpeed = 1;
  private logicalTick = 0;
  private nextSpawnTick = 1;
  private guestSequence = 0;
  private taskSequence = 0;
  private eventSequence = 0;
  private servedGuests = 0;

  constructor(options: AmberClubSimulationOptions = {}) {
    this.venue = options.venue ?? AMBER_CLUB_VENUE;
    assertValidVenueBlueprint(this.venue);
    this.navigation = NavGrid.fromVenue(this.venue);
    this.initialSeed = Math.trunc(options.seed ?? 0x0a6be2);
    this.initialBalance = Math.max(0, Math.floor(options.initialBalance ?? 600));
    this.initialUnlockedRooms = [...new Set<RoomId>(options.unlockedRooms ?? [])];
    this.initialRooms = Object.fromEntries(ROOM_IDS.flatMap((roomId) => {
      const initial = options.initialRooms?.[roomId];
      return initial ? [[roomId, { ...initial, upgrades: { ...initial.upgrades } }]] : [];
    })) as Partial<Record<RoomId, InitialRoomProgress>>;
    this.autoSpawn = options.autoSpawn ?? true;
    this.spawnIntervalTicks = Math.max(1, Math.floor(options.spawnIntervalTicks ?? secondsToTicks(11)));
    this.maxActiveGuests = Math.max(1, Math.floor(options.maxActiveGuests ?? 3));
    this.roomVisitChance = clamp(options.roomVisitChance ?? 0.68, 0, 1);
    this.initializeState(this.initialSeed);
  }

  start = () => {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.nextSpawnTick = this.logicalTick + 1;
    this.pushEvent({ kind: 'simulation_started' });
  };

  setPaused = (paused: boolean) => {
    if (!this.started) return;
    this.paused = paused;
  };

  setSpeed = (speed: SimulationSpeed) => {
    this.speed = speed;
  };

  reset = (seed = this.initialSeed) => {
    this.initialSeed = Math.trunc(seed);
    this.initializeState(this.initialSeed);
  };

  /** One runtime pulse. Speed is applied as an integer number of fixed steps. */
  tick = () => {
    if (!this.started || this.paused) return;
    for (let step = 0; step < this.speed; step += 1) this.stepOnce();
  };

  advanceTicks = (runtimeTicks: number) => {
    const ticks = Math.max(0, Math.floor(runtimeTicks));
    for (let index = 0; index < ticks; index += 1) this.tick();
  };

  getState = (): SimulationSnapshot => ({
    started: this.started,
    paused: this.paused,
    speed: this.speed,
    tick: this.logicalTick,
    fixedDeltaSeconds: this.fixedDeltaSeconds,
    simulationTimeSeconds: this.logicalTick * this.fixedDeltaSeconds,
    balance: this.ledger.balance,
    servedGuests: this.servedGuests,
    guests: this.guests.map((guest): GuestSnapshot => ({
      id: guest.id,
      phase: guest.phase,
      cell: cloneCell(guest.cell),
      route: guest.route.map(cloneCell),
      targetSlotId: guest.targetSlotId,
      seatSlotId: guest.seatSlotId,
      roomSlotId: guest.roomSlotId,
      ticksRemaining: guest.ticksRemaining,
      barVisit: { ...guest.barVisit },
      roomVisit: guest.roomVisit ? { ...guest.roomVisit } : null,
    })),
    staff: this.staff.map((member): StaffSnapshot => ({
      id: member.id,
      role: member.role,
      roomId: member.roomId,
      level: member.level,
      salaryPerShift: member.salaryPerShift,
      task: member.task ? this.cloneTask(member.task) : null,
    })),
    rooms: ROOM_IDS.map((roomId): RoomRuntimeSnapshot => {
      const room = this.rooms[roomId];
      return {
        id: room.id,
        unlocked: room.unlocked,
        lifecycle: room.lifecycle,
        renovationStage: room.renovationStage,
        capacity: room.capacity,
        staff: {
          hired: room.staffHired,
          role: getRoomBlueprint(roomId).staff.role,
          level: room.upgrades.staffSpeed,
          salaryPerShift: getRoomBlueprint(roomId).staff.salaryPerShift,
        },
        upgrades: { ...room.upgrades },
        reservedGuestIds: [...room.reservedGuestIds],
        activeGuestIds: [...room.activeGuestIds],
        completedSessions: room.completedSessions,
        revenue: room.revenue,
      };
    }),
    queuedTasks: this.queuedTasks.map((task) => this.cloneTask(task)),
    ledger: this.ledger.snapshot(),
    events: this.events.map((event) => ({ ...event })),
  });

  getGuestRoute = (guestId: string): readonly GridCell[] => {
    const guest = this.guests.find((candidate) => candidate.id === guestId);
    return guest ? guest.route.map(cloneCell) : [];
  };

  /** Read-only diagnostics used by UI/tests to explain the deterministic choice. */
  getRoomChoiceUtilities = (guestId: string): readonly RoomChoiceUtility[] => (
    ROOM_IDS.flatMap((roomId): RoomChoiceUtility[] => {
      const room = this.rooms[roomId];
      if (!this.isRoomOperational(room) || room.reservedGuestIds.size >= room.capacity) return [];
      const qualityLevel = room.upgrades.quality;
      const sessionProfit = getRoomSessionProfit(roomId, qualityLevel, 1);
      const occupancy = room.reservedGuestIds.size;
      const waitingTasks = this.queuedTasks.filter((task) => (
        task.kind === 'host_room' && task.roomId === roomId
      )).length;
      const seededPreference = this.getSeededRoomPreference(guestId, roomId);
      const loadRatio = occupancy / Math.max(1, room.capacity);
      const utility = (
        sessionProfit / 10
        + (qualityLevel - 1) * 5
        + seededPreference * 12
        - loadRatio * 14
        - waitingTasks * 2
      );
      return [{
        roomId,
        utility: Number(utility.toFixed(6)),
        sessionProfit,
        qualityLevel,
        occupancy,
        capacity: room.capacity,
        waitingTasks,
        seededPreference,
      }];
    }).sort((left, right) => (
      right.utility - left.utility || ROOM_IDS.indexOf(left.roomId) - ROOM_IDS.indexOf(right.roomId)
    ))
  );

  spawnGuest = () => {
    if (!this.started || this.paused) return null;
    const activeGuests = this.guests.filter((guest) => guest.phase !== 'departed').length;
    if (activeGuests >= this.maxActiveGuests) return null;
    const entranceSlot = getSlotsByKind(this.venue, 'entrance')[0];
    if (!entranceSlot) return null;
    const entranceCell = worldToCell(this.venue, entranceSlot.position);
    if (!entranceCell || this.reservations.isReserved(entranceCell)) return null;

    const freeSeats = getSlotsByKind(this.venue, 'bar_guest').filter((slot) => !this.slotOwners.has(slot.id));
    if (freeSeats.length === 0) return null;
    const firstSeat = this.rng.int(0, freeSeats.length);
    const orderedSeats = [...freeSeats.slice(firstSeat), ...freeSeats.slice(0, firstSeat)];
    const id = `guest-${++this.guestSequence}`;
    for (const seat of orderedSeats) {
      const seatCell = worldToCell(this.venue, seat.position);
      if (!seatCell) continue;
      const path = findPath(this.navigation, entranceCell, seatCell, {
        clearanceCells: 1,
        reservations: this.reservations,
        reservationOwnerId: id,
      });
      if (!path) continue;
      if (!this.reservations.reserve(entranceCell, id)) return null;
      this.slotOwners.set(seat.id, id);
      const guest: MutableGuest = {
        id,
        phase: 'walking_to_bar',
        cell: cloneCell(entranceCell),
        route: path.cells.slice(1).map(cloneCell),
        targetSlotId: seat.id,
        seatSlotId: seat.id,
        roomSlotId: null,
        ticksRemaining: 0,
        blockedTicks: 0,
        movementCredits: 0,
        barVisit: { completed: false, paidAtTick: null },
        roomVisit: null,
      };
      this.guests.push(guest);
      this.pushEvent({ kind: 'guest_spawned', guestId: id });
      return id;
    }
    return null;
  };

  /**
   * Public command used by UI/tests. It is deliberately rejected until the
   * guest has completed and paid for the mandatory bar visit.
   */
  requestRoomVisit = (guestId: string, roomId: RoomId) => {
    const guest = this.guests.find((candidate) => candidate.id === guestId);
    const room = this.rooms[roomId];
    if (
      !guest
      || !guest.barVisit.completed
      || guest.phase !== 'choosing_room'
      || !this.isRoomOperational(room)
    ) return false;
    if (room.reservedGuestIds.size >= room.capacity) return false;
    const freeSlots = this.venue.slots.filter((slot) => (
      slot.kind === 'room_guest'
      && slot.roomId === roomId
      && !this.slotOwners.has(slot.id)
    ));
    if (freeSlots.length === 0) return false;
    const roomSlot = freeSlots[0];
    const destination = worldToCell(this.venue, roomSlot.position);
    if (!destination) return false;
    const path = findPath(this.navigation, guest.cell, destination, {
      clearanceCells: 1,
      reservations: this.reservations,
      reservationOwnerId: guest.id,
    });
    if (!path) return false;

    this.slotOwners.set(roomSlot.id, guest.id);
    room.reservedGuestIds.add(guest.id);
    guest.roomSlotId = roomSlot.id;
    guest.roomVisit = { roomId, completed: false };
    guest.targetSlotId = roomSlot.id;
    guest.route = path.cells.slice(1).map(cloneCell);
    guest.blockedTicks = 0;
    this.changeGuestPhase(guest, 'walking_to_room');
    this.pushEvent({ kind: 'room_visit_requested', guestId: guest.id, roomId });
    return true;
  };

  advanceRoomLifecycle = (roomId: RoomId) => {
    const room = this.rooms[roomId];
    const stageId = NEXT_LIFECYCLE_STAGE[room.lifecycle];
    if (!stageId) return false;
    const cost = getRoomLifecycleStageCost(roomId, stageId);
    if (!this.ledger.canAfford(cost)) return false;
    const entry = this.ledger.post({
      tick: this.logicalTick,
      kind: 'room_lifecycle',
      amount: -cost,
      sourceId: `room:${roomId}:lifecycle:${stageId}`,
      roomId,
    });
    this.applyLifecycleStage(room, stageId);
    this.pushLedgerEvent(entry);
    this.pushEvent({
      kind: 'room_lifecycle_advanced',
      roomId,
      lifecycleStageId: stageId,
      lifecycle: room.lifecycle,
    });
    if (room.unlocked) this.pushEvent({ kind: 'room_unlocked', roomId });
    return true;
  };

  /** Compatibility helper: buys every still-missing stage in one ledger posting. */
  unlockRoom = (roomId: RoomId) => {
    const room = this.rooms[roomId];
    const missingStages = this.getMissingLifecycleStages(room);
    if (missingStages.length === 0) return false;
    const cost = missingStages.reduce(
      (total, stageId) => total + getRoomLifecycleStageCost(roomId, stageId),
      0,
    );
    if (!this.ledger.canAfford(cost)) return false;
    const entry = this.ledger.post({
      tick: this.logicalTick,
      kind: 'room_unlock',
      amount: -cost,
      sourceId: `room:${roomId}:unlock-bundle`,
      roomId,
    });
    for (const stageId of missingStages) this.applyLifecycleStage(room, stageId);
    this.pushLedgerEvent(entry);
    this.pushEvent({
      kind: 'room_lifecycle_advanced',
      roomId,
      lifecycleStageId: 'hire',
      lifecycle: room.lifecycle,
    });
    this.pushEvent({ kind: 'room_unlocked', roomId });
    return true;
  };

  purchaseRoomUpgrade = (roomId: RoomId, upgradeId: RoomUpgradeId) => {
    const room = this.rooms[roomId];
    if (!this.isRoomOperational(room)) return false;
    const track = getRoomBlueprint(roomId).upgrades.find((candidate) => candidate.id === upgradeId);
    if (!track) return false;
    const currentLevel = room.upgrades[upgradeId];
    if (currentLevel >= track.maxLevel) return false;
    const cost = getRoomUpgradeCost(roomId, upgradeId, currentLevel);
    if (cost <= 0 || !this.ledger.canAfford(cost)) return false;
    const entry = this.ledger.post({
      tick: this.logicalTick,
      kind: 'upgrade_purchase',
      amount: -cost,
      sourceId: `room:${roomId}:upgrade:${upgradeId}:${currentLevel + 1}`,
      roomId,
    });
    room.upgrades[upgradeId] = currentLevel + 1;
    if (upgradeId === 'capacity') this.refreshRoomCapacity(room);
    if (upgradeId === 'staffSpeed') {
      const staffMember = this.staff.find((member) => member.roomId === roomId);
      if (staffMember) staffMember.level = room.upgrades.staffSpeed;
    }
    this.pushLedgerEvent(entry);
    this.pushEvent({
      kind: 'room_upgrade_purchased',
      roomId,
      upgradeId,
      upgradeLevel: room.upgrades[upgradeId],
    });
    return true;
  };

  private initializeState(seed: number) {
    this.rng = new SeededRandom(seed);
    this.ledger = new Ledger(this.initialBalance);
    this.reservations = new CellReservations();
    this.guests = [];
    this.staff = [{
      id: 'bartender-1',
      role: 'bartender',
      roomId: null,
      level: 1,
      salaryPerShift: 0,
      task: null,
    }];
    this.rooms = {} as Record<RoomId, MutableRoom>;
    for (const roomId of ROOM_IDS) {
      const definition = getRoomBlueprint(roomId);
      const hydrated = this.initialRooms[roomId];
      const lifecycle = hydrated?.lifecycle
        ?? (this.initialUnlockedRooms.includes(roomId) ? 'open' : 'locked');
      const initiallyOpen = lifecycle === 'open';
      const upgrades = this.normalizeUpgradeLevels(roomId, hydrated?.upgrades);
      this.rooms[roomId] = {
        id: roomId,
        unlocked: initiallyOpen,
        lifecycle,
        renovationStage: hydrated?.renovationStage ?? DEFAULT_RENOVATION_STAGE[lifecycle],
        capacity: definition.baseCapacity,
        staffHired: initiallyOpen,
        upgrades,
        reservedGuestIds: new Set<string>(),
        activeGuestIds: new Set<string>(),
        completedSessions: this.nonNegativeInteger(hydrated?.completedSessions),
        revenue: this.nonNegativeInteger(hydrated?.revenue),
      };
      this.refreshRoomCapacity(this.rooms[roomId]);
      if (this.rooms[roomId].staffHired) this.ensureRoomStaff(roomId);
    }
    this.queuedTasks = [];
    this.slotOwners.clear();
    this.events = [];
    this.started = false;
    this.paused = false;
    this.speed = 1;
    this.logicalTick = 0;
    this.nextSpawnTick = 1;
    this.guestSequence = 0;
    this.taskSequence = 0;
    this.eventSequence = 0;
    this.servedGuests = 0;
  }

  private stepOnce() {
    this.logicalTick += 1;
    if (this.autoSpawn && this.logicalTick >= this.nextSpawnTick) {
      this.spawnGuest();
      this.nextSpawnTick = this.logicalTick + this.spawnIntervalTicks;
    }
    this.progressGuestTimers();
    this.progressRoomChoices();
    this.progressStaffTasks();
    this.moveGuests();
    this.assignStaffTasks();
  }

  private progressGuestTimers() {
    for (const guest of this.guests) {
      if (guest.phase !== 'drinking') continue;
      guest.ticksRemaining = Math.max(0, guest.ticksRemaining - 1);
      if (guest.ticksRemaining > 0) continue;
      this.changeGuestPhase(guest, 'waiting_payment');
      this.enqueueTask('take_payment', guest.id);
    }
  }

  private progressRoomChoices() {
    for (const guest of this.guests) {
      if (guest.phase !== 'choosing_room') continue;
      if (this.rng.next() < this.roomVisitChance) {
        const chosenRoom = this.getRoomChoiceUtilities(guest.id)[0]?.roomId;
        if (chosenRoom && this.requestRoomVisit(guest.id, chosenRoom)) continue;
      }
      this.startGuestExit(guest);
    }
  }

  private progressStaffTasks() {
    for (const member of this.staff) {
      if (!member.task) continue;
      member.task.remainingTicks -= 1;
      if (member.task.remainingTicks > 0) continue;
      const completed = member.task;
      member.task = null;
      this.completeTask(completed);
      this.pushEvent({
        kind: 'task_completed',
        guestId: completed.guestId,
        roomId: completed.roomId ?? undefined,
        taskKind: completed.kind,
      });
    }
  }

  private assignStaffTasks() {
    for (const member of this.staff) {
      if (member.task) continue;
      const taskIndex = this.queuedTasks.findIndex((task) => (
        task.assignedRole === member.role && this.taskIsRelevant(task)
      ));
      if (taskIndex < 0) continue;
      const [task] = this.queuedTasks.splice(taskIndex, 1);
      member.task = task;
      const guest = this.getMutableGuest(task.guestId);
      if (guest && task.kind === 'take_order') this.changeGuestPhase(guest, 'ordering');
      if (guest && task.kind === 'take_payment') this.changeGuestPhase(guest, 'paying');
      if (guest && task.kind === 'host_room' && task.roomId) {
        this.changeGuestPhase(guest, 'in_room');
        this.rooms[task.roomId].activeGuestIds.add(guest.id);
      }
      this.pushEvent({
        kind: 'task_started',
        guestId: task.guestId,
        roomId: task.roomId ?? undefined,
        taskKind: task.kind,
      });
    }
  }

  private completeTask(task: MutableTask) {
    const guest = this.getMutableGuest(task.guestId);
    if (!guest) return;
    switch (task.kind) {
      case 'take_order':
        this.changeGuestPhase(guest, 'waiting_drink');
        this.enqueueTask('prepare_drink', guest.id);
        break;
      case 'prepare_drink':
        this.enqueueTask('deliver_drink', guest.id);
        break;
      case 'deliver_drink':
        this.changeGuestPhase(guest, 'drinking');
        guest.ticksRemaining = secondsToTicks(7);
        break;
      case 'take_payment':
        this.completeBarPayment(guest);
        break;
      case 'host_room':
        if (task.roomId) this.completeRoomSession(guest, task.roomId);
        break;
    }
  }

  private completeBarPayment(guest: MutableGuest) {
    const entry = this.ledger.post({
      tick: this.logicalTick,
      kind: 'bar_revenue',
      amount: BAR_SALE_PRICE,
      sourceId: 'bar:drink-sale',
      guestId: guest.id,
    });
    guest.barVisit.completed = true;
    guest.barVisit.paidAtTick = this.logicalTick;
    if (guest.seatSlotId) this.releaseSlot(guest.seatSlotId, guest.id);
    guest.seatSlotId = null;
    this.pushLedgerEvent(entry);
    this.changeGuestPhase(guest, 'choosing_room');
  }

  private completeRoomSession(guest: MutableGuest, roomId: RoomId) {
    if (!guest.barVisit.completed) throw new Error(`Invariant violation: ${guest.id} entered ${roomId} before completing the bar visit.`);
    const room = this.rooms[roomId];
    const profit = getRoomSessionProfit(roomId, room.upgrades.quality, 1);
    const entry = this.ledger.post({
      tick: this.logicalTick,
      kind: 'room_revenue',
      amount: profit,
      sourceId: `room:${roomId}:session`,
      guestId: guest.id,
      roomId,
    });
    room.revenue += profit;
    room.completedSessions += 1;
    room.activeGuestIds.delete(guest.id);
    room.reservedGuestIds.delete(guest.id);
    if (guest.roomSlotId) this.releaseSlot(guest.roomSlotId, guest.id);
    guest.roomSlotId = null;
    if (guest.roomVisit) guest.roomVisit.completed = true;
    this.pushLedgerEvent(entry);
    this.startGuestExit(guest);
  }

  private moveGuests() {
    const creditsPerTick = (
      GUEST_MOVE_SPEED_METERS_PER_SECOND * this.fixedDeltaSeconds / this.venue.grid.cellSize
    );
    for (const guest of this.guests) {
      if (!this.isMoving(guest.phase)) continue;
      const targetCell = guest.targetSlotId
        ? worldToCell(this.venue, getSlot(this.venue, guest.targetSlotId).position)
        : null;
      if (!targetCell) continue;
      if (sameCell(guest.cell, targetCell)) {
        this.arriveAtTarget(guest);
        continue;
      }
      if (guest.route.length === 0) {
        this.replanGuest(guest, targetCell);
        continue;
      }

      const next = guest.route[0];
      const diagonal = next.x !== guest.cell.x && next.z !== guest.cell.z;
      const stepCost = diagonal ? Math.SQRT2 : 1;
      guest.movementCredits += creditsPerTick;
      if (guest.movementCredits + 1e-9 < stepCost) continue;
      if (this.reservations.isReserved(next, guest.id)) {
        guest.movementCredits = Math.min(guest.movementCredits, stepCost);
        guest.blockedTicks += 1;
        if (guest.blockedTicks % 6 === 0) {
          this.pushEvent({ kind: 'guest_blocked', guestId: guest.id, roomId: guest.roomVisit?.roomId });
          this.replanGuest(guest, targetCell);
        }
        continue;
      }
      if (!this.reservations.reserve(next, guest.id)) continue;
      this.reservations.release(guest.cell, guest.id);
      guest.cell = cloneCell(next);
      guest.route.shift();
      guest.movementCredits = Math.max(0, guest.movementCredits - stepCost);
      guest.blockedTicks = 0;
      if (sameCell(guest.cell, targetCell)) this.arriveAtTarget(guest);
    }
  }

  private replanGuest(guest: MutableGuest, targetCell: GridCell) {
    const path = findPath(this.navigation, guest.cell, targetCell, {
      clearanceCells: 1,
      reservations: this.reservations,
      reservationOwnerId: guest.id,
      allowGoalReserved: true,
    });
    if (path) guest.route = path.cells.slice(1).map(cloneCell);
  }

  private arriveAtTarget(guest: MutableGuest) {
    if (guest.phase === 'walking_to_bar') {
      this.changeGuestPhase(guest, 'waiting_order');
      this.enqueueTask('take_order', guest.id);
      return;
    }
    if (guest.phase === 'walking_to_room') {
      const roomId = guest.roomVisit?.roomId;
      if (!roomId || !guest.barVisit.completed) throw new Error(`Invariant violation: invalid room arrival for ${guest.id}.`);
      this.changeGuestPhase(guest, 'waiting_room');
      this.enqueueTask('host_room', guest.id, roomId);
      return;
    }
    if (guest.phase === 'leaving') this.markGuestDeparted(guest);
  }

  private startGuestExit(guest: MutableGuest) {
    if (guest.seatSlotId) this.releaseSlot(guest.seatSlotId, guest.id);
    if (guest.roomSlotId) this.releaseSlot(guest.roomSlotId, guest.id);
    guest.seatSlotId = null;
    guest.roomSlotId = null;
    const exitSlot = getSlotsByKind(this.venue, 'exit')[0];
    if (!exitSlot) throw new Error('Venue has no exit slot.');
    const destination = worldToCell(this.venue, exitSlot.position);
    if (!destination) throw new Error('Venue exit is outside the navigation grid.');
    const path = findPath(this.navigation, guest.cell, destination, {
      clearanceCells: 1,
      reservations: this.reservations,
      reservationOwnerId: guest.id,
      allowGoalReserved: true,
    });
    guest.targetSlotId = exitSlot.id;
    guest.route = path ? path.cells.slice(1).map(cloneCell) : [];
    guest.blockedTicks = 0;
    this.changeGuestPhase(guest, 'leaving');
  }

  private markGuestDeparted(guest: MutableGuest) {
    this.reservations.releaseOwner(guest.id);
    if (guest.seatSlotId) this.releaseSlot(guest.seatSlotId, guest.id);
    if (guest.roomSlotId) this.releaseSlot(guest.roomSlotId, guest.id);
    guest.targetSlotId = null;
    guest.route = [];
    this.changeGuestPhase(guest, 'departed');
    this.servedGuests += 1;
    this.pushEvent({ kind: 'guest_departed', guestId: guest.id, roomId: guest.roomVisit?.roomId });
    const departed = this.guests.filter((candidate) => candidate.phase === 'departed');
    if (departed.length > 64) {
      const staleIds = new Set(departed.slice(0, departed.length - 64).map((candidate) => candidate.id));
      this.guests = this.guests.filter((candidate) => !staleIds.has(candidate.id));
    }
  }

  private enqueueTask(kind: StaffTaskKind, guestId: string, roomId: RoomId | null = null) {
    const duplicate = this.queuedTasks.some((task) => task.kind === kind && task.guestId === guestId)
      || this.staff.some((member) => member.task?.kind === kind && member.task.guestId === guestId);
    if (duplicate) return;
    const assignedRole = this.getTaskRole(kind, roomId);
    const totalTicks = this.getTaskDuration(kind, roomId);
    const task: MutableTask = {
      id: `task-${++this.taskSequence}`,
      kind,
      guestId,
      roomId,
      assignedRole,
      totalTicks,
      remainingTicks: totalTicks,
    };
    this.queuedTasks.push(task);
    this.pushEvent({ kind: 'task_queued', guestId, roomId: roomId ?? undefined, taskKind: kind });
  }

  private taskIsRelevant(task: MutableTask) {
    const guest = this.getMutableGuest(task.guestId);
    if (!guest) return false;
    switch (task.kind) {
      case 'take_order': return guest.phase === 'waiting_order';
      case 'prepare_drink': return guest.phase === 'waiting_drink';
      case 'deliver_drink': return guest.phase === 'waiting_drink';
      case 'take_payment': return guest.phase === 'waiting_payment';
      case 'host_room': return guest.phase === 'waiting_room' && guest.roomVisit?.roomId === task.roomId;
    }
  }

  private getTaskRole(kind: StaffTaskKind, roomId: RoomId | null): StaffRole {
    if (kind !== 'host_room') return 'bartender';
    if (!roomId) throw new Error('Room host task requires a room id.');
    return getRoomBlueprint(roomId).staff.role;
  }

  private getTaskDuration(kind: StaffTaskKind, roomId: RoomId | null) {
    switch (kind) {
      case 'take_order': return secondsToTicks(1);
      case 'prepare_drink': return secondsToTicks(1.5);
      case 'deliver_drink': return secondsToTicks(0.5);
      case 'take_payment': return secondsToTicks(0.75);
      case 'host_room':
        if (!roomId) throw new Error('Room host task requires a room id.');
        return secondsToTicks(
          getRoomBlueprint(roomId).serviceSeconds
          * getRoomStaffSpeedMultiplier(roomId, this.rooms[roomId].upgrades.staffSpeed),
        );
    }
  }

  private ensureRoomStaff(roomId: RoomId) {
    if (this.staff.some((member) => member.roomId === roomId)) return;
    const definition = getRoomBlueprint(roomId);
    const room = this.rooms[roomId];
    if (!room.staffHired) return;
    this.staff.push({
      id: `${roomId}-staff-1`,
      role: definition.staff.role,
      roomId,
      level: room.upgrades.staffSpeed,
      salaryPerShift: definition.staff.salaryPerShift,
      task: null,
    });
  }

  private normalizeUpgradeLevels(
    roomId: RoomId,
    source: Readonly<Partial<RoomUpgradeLevels>> | undefined,
  ): RoomUpgradeLevels {
    const definition = getRoomBlueprint(roomId);
    const level = (upgradeId: RoomUpgradeId) => {
      const track = definition.upgrades.find((candidate) => candidate.id === upgradeId)!;
      const candidate = source?.[upgradeId];
      if (!Number.isFinite(candidate)) return 1;
      return Math.max(1, Math.min(track.maxLevel, Math.floor(candidate!)));
    };
    return {
      staffSpeed: level('staffSpeed'),
      capacity: level('capacity'),
      quality: level('quality'),
    };
  }

  private nonNegativeInteger(value: number | undefined) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
  }

  private applyLifecycleStage(room: MutableRoom, stageId: RoomLifecycleStageId) {
    switch (stageId) {
      case 'permit':
        room.lifecycle = 'permitted';
        room.renovationStage = 1;
        break;
      case 'renovate':
        room.lifecycle = 'renovating';
        room.renovationStage = 2;
        break;
      case 'equip':
        room.lifecycle = 'equipping';
        room.renovationStage = 3;
        break;
      case 'hire':
        room.lifecycle = 'open';
        room.renovationStage = 3;
        room.staffHired = true;
        room.unlocked = true;
        this.ensureRoomStaff(room.id);
        break;
    }
  }

  private getMissingLifecycleStages(room: MutableRoom): readonly RoomLifecycleStageId[] {
    const nextStage = NEXT_LIFECYCLE_STAGE[room.lifecycle];
    if (!nextStage) return [];
    return ROOM_LIFECYCLE_STAGE_IDS.slice(ROOM_LIFECYCLE_STAGE_IDS.indexOf(nextStage));
  }

  private refreshRoomCapacity(room: MutableRoom) {
    const physicalSlotCount = this.venue.slots.filter((slot) => (
      slot.kind === 'room_guest' && slot.roomId === room.id
    )).length;
    room.capacity = getRoomCapacity(room.id, room.upgrades.capacity, physicalSlotCount);
  }

  private isRoomOperational(room: MutableRoom) {
    return (
      room.unlocked
      && room.lifecycle === 'open'
      && room.staffHired
      && this.staff.some((member) => member.roomId === room.id)
    );
  }

  private getSeededRoomPreference(guestId: string, roomId: RoomId) {
    const value = `${this.initialSeed}:${guestId}:${roomId}`;
    let hash = (2_166_136_261 ^ this.initialSeed) >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
    return (hash >>> 0) / 4_294_967_296;
  }

  private releaseSlot(slotId: string, ownerId: string) {
    if (this.slotOwners.get(slotId) === ownerId) this.slotOwners.delete(slotId);
  }

  private getMutableGuest(guestId: string) {
    return this.guests.find((guest) => guest.id === guestId) ?? null;
  }

  private isMoving(phase: GuestPhase) {
    return phase === 'walking_to_bar' || phase === 'walking_to_room' || phase === 'leaving';
  }

  private changeGuestPhase(guest: MutableGuest, nextPhase: GuestPhase) {
    if (ROOM_PHASES.has(nextPhase) && !guest.barVisit.completed) {
      throw new Error(`Invariant violation: ${guest.id} cannot enter phase ${nextPhase} before barVisit.completed.`);
    }
    const previous = guest.phase;
    if (previous === nextPhase) return;
    if (!this.isMoving(previous) && this.isMoving(nextPhase)) guest.movementCredits = 0;
    guest.phase = nextPhase;
    this.pushEvent({
      kind: 'guest_phase_changed',
      guestId: guest.id,
      roomId: guest.roomVisit?.roomId,
      fromPhase: previous,
      toPhase: nextPhase,
    });
  }

  private pushLedgerEvent(entry: LedgerEntry) {
    this.pushEvent({
      kind: 'ledger_posted',
      guestId: entry.guestId,
      roomId: entry.roomId,
      ledgerEntryId: entry.id,
    });
  }

  private pushEvent(event: Omit<SimulationEvent, 'id' | 'tick'>) {
    this.events.push({ id: ++this.eventSequence, tick: this.logicalTick, ...event });
    if (this.events.length > 512) this.events.shift();
  }

  private cloneTask(task: MutableTask): StaffTaskSnapshot {
    return {
      id: task.id,
      kind: task.kind,
      guestId: task.guestId,
      roomId: task.roomId,
      assignedRole: task.assignedRole,
      totalTicks: task.totalTicks,
      remainingTicks: task.remainingTicks,
    };
  }
}
