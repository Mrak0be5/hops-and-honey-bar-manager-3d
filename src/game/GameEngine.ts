import {
  BAR_STATION,
  countVenueWorkers,
  DRINKS,
  ENTRANCE,
  ENTRANCE_QUEUE_CAP,
  ENTRY_AISLE,
  getArrivalInterval,
  getDayBonus,
  getDeliveryDuration,
  getStaffDefinition,
  getUnlockedDrinks,
  getUpgradeCost,
  INITIAL_UPGRADES,
  getRoomCapacity,
  getRoomCapacityMaxLevel,
  getRoomDefinition,
  getRoomProfit,
  getRoomUpgradeCost,
  makeDefaultVenueSlots,
  MILESTONE_DEFINITIONS,
  ROOM_DEFINITIONS,
  ROOM_GROUP_WINDOW,
  ROOM_LAYOUTS,
  ROOM_MIN_WELCOME_DURATION,
  ROOM_RESET_DURATION,
  ROOM_UPGRADE_DEFS,
  SECOND_BAR_WORKER_SPEED,
  SECOND_ROOM_WORKER_INCOME,
  SECOND_ROOM_WORKER_SPEED,
  SERVICE_GATE,
  SHIFT_DURATION,
  STAFF_DEFINITIONS,
  TABLE_LAYOUT,
  UPGRADE_DEFS,
  VENUE_IDS,
  venueHasStaff,
} from './config';
import type {
  Bartender,
  BartenderState,
  Drink,
  GameEvent,
  GameSnapshot,
  Patron,
  RoomDefinition,
  RoomId,
  RoomState,
  RoomUpgradeKey,
  RoomUpgradeLevels,
  StaffCharacterId,
  StaffRosterEntry,
  TableState,
  UpgradeKey,
  UpgradeLevels,
  Vec2,
  VenueId,
  VenueSlots,
} from './types';
import { findGridPath, makeLevelObstacles } from './navigation';

type Listener = () => void;
type RandomSource = () => number;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type MutablePatron = Patron & { route: Vec2[] };
type MutableBartender = Bartender & { route: Vec2[]; timer: number; deliveryDuration: number };
type MutableRoom = RoomState & { timer: number; phaseDuration: number; cooldown: number; guestIds: string[]; sessionWorkers: number };

type SavedProgress = {
  coins: number;
  reputation: number;
  served: number;
  day: number;
  upgrades: UpgradeLevels;
  soundEnabled: boolean;
  totalOperatingRevenue?: number;
  totalDayBonus?: number;
  rooms?: Partial<Record<RoomId, { unlocked: boolean; completedSessions: number; revenue: number; upgrades: RoomUpgradeLevels }>>;
  hired?: StaffCharacterId[];
  venueSlots?: Partial<Record<VenueId, [StaffCharacterId | null, StaffCharacterId | null]>>;
};

const SAVE_KEY = 'brothel-christopher-v1';
const PUBLISH_INTERVAL = 1 / 12;

const cloneVec = (value: Vec2): Vec2 => ({ x: value.x, z: value.z });
const distance = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.z - a.z);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const safeStorage = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export class GameEngine {
  private readonly listeners = new Set<Listener>();
  private readonly rng: RandomSource;
  private readonly storage: StorageLike | null;
  private patrons: MutablePatron[] = [];
  private tables: TableState[] = TABLE_LAYOUT.map((table) => ({ ...table, position: cloneVec(table.position), seat: cloneVec(table.seat), service: cloneVec(table.service) }));
  private bartender: MutableBartender = this.makeBartender();
  private snapshot: GameSnapshot;
  private started = false;
  private paused = false;
  private speedMultiplier: 1 | 2 = 1;
  private coins = 64;
  private reputation = 3;
  private served = 0;
  private day = 1;
  private shiftElapsed = 0;
  private spawnTimer = 1.3;
  private publishTimer = 0;
  private patronSequence = 0;
  private eventSequence = 0;
  private lastEvent: GameEvent | null = null;
  private upgrades: UpgradeLevels = { ...INITIAL_UPGRADES };
  private soundEnabled = true;
  private rooms: Record<RoomId, MutableRoom> = this.makeRooms();
  private totalOperatingRevenue = 0;
  private totalDayBonus = 0;
  private shiftOperatingRevenue = 0;
  private hiredStaff: Set<StaffCharacterId> = new Set(['christina']);
  private venueSlots: VenueSlots = makeDefaultVenueSlots();

  constructor(options: { rng?: RandomSource; storage?: StorageLike | null } = {}) {
    this.rng = options.rng ?? Math.random;
    this.storage = options.storage === undefined ? safeStorage() : options.storage;
    this.load();
    this.snapshot = this.buildSnapshot();
  }

  private makeBartender(): MutableBartender {
    return {
      position: cloneVec(BAR_STATION),
      target: cloneVec(BAR_STATION),
      state: 'idle',
      targetPatronId: null,
      targetTableId: null,
      carryingDrink: null,
      carryingDirty: false,
      outfit: 'uniform',
      onTable: false,
      deliveryProgress: 0,
      staffId: 'christina',
      route: [],
      timer: 0,
      deliveryDuration: 0,
    };
  }

  private makeRooms(): Record<RoomId, MutableRoom> {
    const rooms = {} as Record<RoomId, MutableRoom>;
    for (const definition of ROOM_DEFINITIONS) {
      rooms[definition.id] = {
        id: definition.id,
        unlocked: false,
        staffState: 'locked',
        guests: 0,
        capacity: getRoomCapacity(definition.id, 1),
        progress: 0,
        completedSessions: 0,
        revenue: 0,
        perGuestProfit: definition.baseProfit,
        maxSessionProfit: definition.baseProfit,
        upgrades: { staffSpeed: 1, capacity: 1, quality: 1 },
        timer: 0,
        phaseDuration: 1,
        cooldown: 0,
        guestIds: [],
        sessionWorkers: 0,
      };
    }
    return rooms;
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  start = () => {
    this.started = true;
    this.paused = false;
    this.pushEvent('day', `День ${this.day}: бордель открыт!`);
    this.publish();
  };

  togglePause = () => {
    if (!this.started) return;
    this.paused = !this.paused;
    this.publish();
  };

  setPaused = (paused: boolean) => {
    if (!this.started || this.paused === paused) return;
    this.paused = paused;
    this.publish();
  };

  toggleSpeed = () => {
    this.speedMultiplier = this.speedMultiplier === 1 ? 2 : 1;
    this.publish();
  };

  toggleSound = () => {
    this.soundEnabled = !this.soundEnabled;
    this.persist();
    this.publish();
  };

  purchaseUpgrade = (key: UpgradeKey) => {
    const definition = UPGRADE_DEFS.find((item) => item.key === key);
    if (!definition) return false;

    const level = this.upgrades[key];
    if (level >= definition.maxLevel) return false;
    const cost = getUpgradeCost(definition, level);
    const balance = definition.currency === 'coins' ? this.coins : this.reputation;
    if (balance < cost) return false;

    if (definition.currency === 'coins') this.coins -= cost;
    else this.reputation -= cost;
    this.upgrades = { ...this.upgrades, [key]: level + 1 };
    this.pushEvent('upgrade', `${definition.name} · ур. ${level + 1}`);
    this.persist();
    this.publish();
    return true;
  };

  purchaseRoom = (roomId: RoomId) => {
    const room = this.rooms[roomId];
    const definition = getRoomDefinition(roomId);
    if (!room || room.unlocked || this.coins < definition.unlockCost) return false;
    this.coins -= definition.unlockCost;
    room.unlocked = true;
    room.staffState = 'waiting';
    room.cooldown = 1.1;
    room.progress = 0;
    const openedWord = definition.id === 'sex' ? 'открыта' : 'открыт';
    this.pushEvent('room_unlock', `${definition.icon} ${definition.name} ${openedWord}!`, undefined, roomId);
    this.persist();
    this.publish();
    return true;
  };

  purchaseRoomUpgrade = (roomId: RoomId, key: RoomUpgradeKey) => {
    const room = this.rooms[roomId];
    const definition = getRoomDefinition(roomId);
    const upgrade = ROOM_UPGRADE_DEFS.find((item) => item.key === key);
    if (!room?.unlocked || !upgrade) return false;
    const currentLevel = room.upgrades[key];
    const maxLevel = key === 'capacity' ? getRoomCapacityMaxLevel(roomId) : upgrade.maxLevel;
    if (currentLevel >= maxLevel) return false;
    const cost = getRoomUpgradeCost(roomId, key, currentLevel);
    if (this.coins < cost) return false;
    this.coins -= cost;
    room.upgrades = { ...room.upgrades, [key]: currentLevel + 1 };
    room.capacity = getRoomCapacity(roomId, room.upgrades.capacity);
    this.pushEvent('upgrade', `${definition.icon} ${upgrade.name} · ур. ${currentLevel + 1}`);
    this.persist();
    this.publish();
    return true;
  };

  /** Hire a paid roster character; the free starter (Christina) is already hired. */
  hireStaff = (id: StaffCharacterId): boolean => {
    if (this.hiredStaff.has(id)) return false;
    const definition = getStaffDefinition(id);
    if (this.coins < definition.hireCost) return false;
    this.coins -= definition.hireCost;
    this.hiredStaff.add(id);
    this.pushEvent('hire', `${definition.emoji} ${definition.name} нанята!`);
    this.autoAssignFirstEmptySlot(id);
    this.persist();
    this.publish();
    return true;
  };

  private autoAssignFirstEmptySlot(staffId: StaffCharacterId) {
    if (this.venueSlots.bar[0] === null && this.venueSlots.bar[1] === null) {
      this.assignStaff('bar', 0, staffId);
      return;
    }
    for (const definition of ROOM_DEFINITIONS) {
      const room = this.rooms[definition.id];
      if (room?.unlocked) {
        const slots = this.venueSlots[definition.id];
        if (slots[0] === null) {
          this.assignStaff(definition.id, 0, staffId);
          return;
        }
        if (slots[1] === null) {
          this.assignStaff(definition.id, 1, staffId);
          return;
        }
      }
    }
    if (this.venueSlots.bar[1] === null) {
      this.assignStaff('bar', 1, staffId);
      return;
    }
  }

  /** Assign (or clear with `null`) a hired character into a venue slot; unassigns her from any other slot first. */
  assignStaff = (venue: VenueId, slotIndex: 0 | 1, staffId: StaffCharacterId | null): boolean => {
    if (staffId !== null && !this.hiredStaff.has(staffId)) return false;
    const barHadStaff = this.barStaffCount() > 0;
    if (staffId !== null) {
      for (const otherVenue of VENUE_IDS) {
        const slots = this.venueSlots[otherVenue];
        for (let index = 0; index < slots.length; index += 1) {
          if (slots[index] === staffId && !(otherVenue === venue && index === slotIndex)) {
            slots[index] = null;
          }
        }
      }
    }
    this.venueSlots[venue][slotIndex] = staffId;
    this.syncBartenderStaff();
    if (barHadStaff && this.barStaffCount() === 0) this.evacuateBarPatrons();
    this.persist();
    this.publish();
    return true;
  };

  /** Primary bar worker driving the bartender FSM (slot 0 preferred). */
  getPrimaryBarStaff = (): StaffCharacterId | null => this.venueSlots.bar[0] ?? this.venueSlots.bar[1] ?? null;

  barStaffCount = (): number => countVenueWorkers(this.venueSlots, 'bar');

  roomStaffCount = (roomId: RoomId): number => countVenueWorkers(this.venueSlots, roomId);

  /** True if the bar or any service room currently has at least one worker. */
  anyServiceStaffed = (): boolean => (
    this.barStaffCount() > 0 || ROOM_DEFINITIONS.some((definition) => venueHasStaff(this.venueSlots, definition.id))
  );

  private syncBartenderStaff() {
    this.bartender.staffId = this.barStaffCount() > 0 ? this.getPrimaryBarStaff() : null;
  }

  /**
   * When the bar loses its last worker, release seated guests so they are not stuck
   * waiting for drinks forever — send them to a staffed room or out the door.
   */
  private evacuateBarPatrons() {
    this.setBartenderIdle();
    this.bartender.carryingDrink = null;
    this.bartender.carryingDirty = false;
    this.bartender.outfit = 'uniform';
    this.bartender.onTable = false;
    this.bartender.deliveryProgress = 0;
    this.bartender.deliveryDuration = 0;

    const barCycle: Patron['state'][] = [
      'walking_in',
      'waiting_order',
      'ordering',
      'waiting_drink',
      'drinking',
      'ready_to_pay',
      'paying',
    ];
    for (const patron of this.patrons) {
      if (!barCycle.includes(patron.state)) continue;
      const table = patron.tableId >= 0 ? this.tables[patron.tableId] : null;
      if (table?.occupantId === patron.id) {
        table.occupantId = null;
        // Abandoned mid-service tables stay dirty only if a drink was already delivered.
        if (patron.state === 'drinking' || patron.state === 'ready_to_pay' || patron.state === 'paying') {
          table.dirty = true;
        }
      }
      patron.tableId = -1;
      patron.order = null;
      patron.barServed = true;
      patron.route = [];
      if (!this.trySendPatronToRoom(patron)) this.startPatronExit(patron);
    }
  }

  resetProgress = () => {
    this.storage?.removeItem(SAVE_KEY);
    this.started = false;
    this.paused = false;
    this.speedMultiplier = 1;
    this.coins = 64;
    this.reputation = 3;
    this.served = 0;
    this.day = 1;
    this.shiftElapsed = 0;
    this.totalOperatingRevenue = 0;
    this.totalDayBonus = 0;
    this.shiftOperatingRevenue = 0;
    this.spawnTimer = 1.3;
    this.patrons = [];
    this.tables = TABLE_LAYOUT.map((table) => ({ ...table, position: cloneVec(table.position), seat: cloneVec(table.seat), service: cloneVec(table.service) }));
    this.hiredStaff = new Set(['christina']);
    this.venueSlots = makeDefaultVenueSlots();
    this.bartender = this.makeBartender();
    this.rooms = this.makeRooms();
    this.upgrades = { ...INITIAL_UPGRADES };
    this.lastEvent = null;
    this.publish();
  };

  /** Debug/cheat: set coins instantly (default 99_999_999). */
  cheatMoney = (amount = 99_999_999) => {
    this.coins = Math.max(0, Math.floor(amount));
    this.pushEvent('upgrade', `Чит: ${this.coins.toLocaleString('ru-RU')} монет`);
    this.persist();
    this.publish();
  };

  /** Debug/cheat: also top up reputation for room unlocks. */
  cheatRich = (coins = 99_999_999, reputation = 99_999) => {
    this.coins = Math.max(0, Math.floor(coins));
    this.reputation = Math.max(0, Math.floor(reputation));
    this.pushEvent('upgrade', `Чит: богатство · ${this.coins.toLocaleString('ru-RU')} 🪙`);
    this.persist();
    this.publish();
  };

  update = (realDelta: number) => {
    if (!this.started || this.paused || !Number.isFinite(realDelta) || realDelta <= 0) return;
    let remaining = Math.min(realDelta, 0.5) * this.speedMultiplier;
    while (remaining > 0) {
      const step = Math.min(remaining, 0.05);
      this.step(step);
      remaining -= step;
    }
  };

  /** Deterministic helper for tests and scripted smoke runs. */
  advance = (seconds: number) => {
    let remaining = Math.max(0, seconds);
    while (remaining > 0) {
      const step = Math.min(remaining, 0.05);
      if (this.started && !this.paused) this.step(step * this.speedMultiplier);
      remaining -= step;
    }
    this.publish();
  };

  private step(delta: number) {
    this.shiftElapsed += delta;
    if (this.shiftElapsed >= SHIFT_DURATION) {
      this.shiftElapsed -= SHIFT_DURATION;
      this.day += 1;
      const bonus = getDayBonus(this.shiftOperatingRevenue);
      this.coins += bonus;
      this.totalDayBonus += bonus;
      this.shiftOperatingRevenue = 0;
      this.pushEvent('day', `День ${this.day} · бонус ${bonus}` , bonus);
      this.persist();
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.trySpawnPatron();
      this.spawnTimer = getArrivalInterval(this.upgrades.advertising) * (0.82 + this.rng() * 0.36);
    }

    this.updatePatrons(delta);
    this.updateBartender(delta);
    this.updateRooms(delta);
    this.promoteQueuedPatrons();

    this.publishTimer += delta;
    if (this.publishTimer >= PUBLISH_INTERVAL) {
      this.publishTimer = 0;
      this.publish();
    }
  }

  private updateRooms(delta: number) {
    for (const definition of ROOM_DEFINITIONS) {
      const room = this.rooms[definition.id];
      if (!room.unlocked) continue;
      room.capacity = getRoomCapacity(definition.id, room.upgrades.capacity);
      const workers = countVenueWorkers(this.venueSlots, definition.id);

      room.guestIds = room.guestIds.filter((guestId) => this.patrons.some((patron) => patron.id === guestId && patron.state === 'in_room'));
      room.guests = room.guestIds.length;

      if (room.staffState === 'waiting') {
        room.progress = 0;
        room.cooldown = Math.max(0, room.cooldown - delta);
        const arrived = this.patrons.filter((patron) => patron.roomId === definition.id && patron.state === 'waiting_room');
        // Never start a greeting without at least one assigned worker.
        if (workers > 0 && arrived.length > 0 && room.cooldown <= 0) {
          room.staffState = 'welcoming';
          // A short gathering window lets several real bar guests form one
          // session instead of conjuring a full decorative batch.
          room.phaseDuration = ROOM_GROUP_WINDOW;
          room.timer = room.phaseDuration;
        }
        continue;
      }

      if (room.staffState === 'welcoming' && workers === 0) {
        // Staff pulled mid-greeting: hold reserved guests without committing a session.
        room.staffState = 'waiting';
        room.cooldown = 0.4;
        room.progress = 0;
        continue;
      }

      room.timer -= delta;
      // Staff pulled mid-session: wrap up the current session immediately
      // instead of stranding guests indefinitely.
      if (room.staffState === 'serving' && workers === 0) room.timer = Math.min(room.timer, 0);
      room.progress = clamp(1 - room.timer / Math.max(0.01, room.phaseDuration), 0, 1);

      if (room.staffState === 'welcoming') {
        const arrived = this.patrons.filter((patron) => patron.roomId === definition.id && patron.state === 'waiting_room');
        const approaching = this.patrons.some((patron) => patron.roomId === definition.id && patron.state === 'walking_to_room');
        const welcomeElapsed = room.phaseDuration - room.timer;
        // Keep the greeting visible even when a one-seat room is already full;
        // larger groups may start early after that minimum beat, but every
        // already-reserved guest must arrive before the session begins.
        if (approaching || (room.timer > 0 && (arrived.length < room.capacity || welcomeElapsed < ROOM_MIN_WELCOME_DURATION))) continue;
        const participants = arrived.slice(0, room.capacity);
        if (participants.length === 0) {
          room.staffState = 'waiting';
          room.cooldown = 0.5;
          room.progress = 0;
          continue;
        }
        room.guestIds = participants.map((patron) => patron.id);
        room.guests = participants.length;
        for (const patron of participants) {
          patron.state = 'in_room';
          patron.target = cloneVec(patron.position);
        }
        room.staffState = 'serving';
        room.sessionWorkers = workers;
        const sessionSpeedBonus = workers >= 2 ? SECOND_ROOM_WORKER_SPEED : 1;
        room.phaseDuration = definition.sessionDuration * 0.88 ** (room.upgrades.staffSpeed - 1) * sessionSpeedBonus;
        room.timer = room.phaseDuration;
        room.progress = 0;
      } else if (room.staffState === 'serving') {
        if (room.timer > 0) continue;
        const participants = room.guestIds
          .map((guestId) => this.patrons.find((patron) => patron.id === guestId))
          .filter((patron): patron is MutablePatron => Boolean(patron));
        const incomeBonus = room.sessionWorkers >= 2 ? SECOND_ROOM_WORKER_INCOME : 1;
        const income = Math.round(getRoomProfit(definition.id, room.upgrades.quality, participants.length) * incomeBonus);
        this.coins += income;
        this.totalOperatingRevenue += income;
        this.shiftOperatingRevenue += income;
        room.revenue += income;
        room.completedSessions += 1;
        if (room.completedSessions % 3 === 0) this.reputation += 1;
        this.pushEvent('room_income', `${definition.icon} ${definition.shortName} +${income}`, income, definition.id);
        for (const patron of participants) this.startPatronExit(patron);
        room.guestIds = [];
        room.guests = 0;
        this.persist();
        room.staffState = 'resetting';
        room.phaseDuration = ROOM_RESET_DURATION;
        room.timer = room.phaseDuration;
        room.progress = 0;
      } else if (room.staffState === 'resetting') {
        if (room.timer > 0) continue;
        room.guests = 0;
        room.staffState = 'waiting';
        room.cooldown = Math.max(1.2, 3.2 - this.upgrades.advertising * 0.22);
        room.progress = 0;
      }
    }
  }

  private countRoomAssignments(roomId: RoomId) {
    return this.patrons.filter((patron) => (
      patron.roomId === roomId
      && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room')
    )).length;
  }

  /** Unlocked, staffed rooms with an open reservation slot, ready to receive a new guest. */
  private getStaffedRoomCandidates(): { definition: RoomDefinition; room: MutableRoom; assignments: number }[] {
    return ROOM_DEFINITIONS.map((definition) => {
      const room = this.rooms[definition.id];
      return { definition, room, assignments: this.countRoomAssignments(definition.id) };
    }).filter(({ room, assignments }) => (
      room.unlocked
        && venueHasStaff(this.venueSlots, room.id)
        && (room.staffState === 'waiting' || room.staffState === 'welcoming')
        && assignments < room.capacity
    ));
  }

  private findFreeRoomSlot(roomId: RoomId, capacity: number): number {
    const layout = ROOM_LAYOUTS[roomId];
    const reservedSlots = new Set(this.patrons
      .filter((item) => item.roomId === roomId && item.roomSlot !== null && item.state !== 'leaving')
      .map((item) => item.roomSlot));
    return layout.guestSpots.findIndex((_, index) => index < capacity && !reservedSlots.has(index));
  }

  private trySendPatronToRoom(patron: MutablePatron) {
    if (!patron.barServed) return false;
    const available = this.getStaffedRoomCandidates();
    const visitChance = clamp(0.38 + patron.happiness * 0.42, 0.42, 0.8);
    if (available.length === 0 || this.rng() > visitChance) return false;

    // Fill an already forming group before opening another room queue. This
    // makes upgraded capacity visible in normal play and avoids scattering
    // consecutive guests across several one-person sessions.
    const highestFill = Math.max(...available.map(({ assignments }) => assignments));
    const preferred = highestFill > 0
      ? available.filter(({ assignments }) => assignments === highestFill)
      : available;
    const firstIndex = Math.min(preferred.length - 1, Math.floor(this.rng() * preferred.length));
    const ordered = [
      ...preferred.slice(firstIndex),
      ...preferred.slice(0, firstIndex),
      ...available.filter((candidate) => !preferred.includes(candidate)),
    ];
    for (const { definition, room } of ordered) {
      const slot = this.findFreeRoomSlot(definition.id, room.capacity);
      if (slot < 0) continue;
      const layout = ROOM_LAYOUTS[definition.id];
      const destination = layout.guestSpots[slot];
      const route = this.makeRoute(patron.position, destination, [layout.barPortal, layout.roomPortal, destination]);
      if (!route) continue;
      patron.roomId = definition.id;
      patron.roomSlot = slot;
      patron.state = 'walking_to_room';
      patron.route = route;
      patron.target = cloneVec(route[0] ?? destination);
      return true;
    }
    return false;
  }

  /** Route a patron straight from the entrance into a staffed room, skipping the bar entirely. */
  private assignPatronToRoomFromEntrance(patron: MutablePatron, definition: RoomDefinition, slot: number): boolean {
    const layout = ROOM_LAYOUTS[definition.id];
    const destination = layout.guestSpots[slot];
    const route = this.makeRoute(patron.position, destination, [ENTRY_AISLE, layout.barPortal, layout.roomPortal, destination]);
    if (!route) return false;
    patron.roomId = definition.id;
    patron.roomSlot = slot;
    patron.barServed = true;
    patron.state = 'walking_to_room';
    patron.route = route;
    patron.target = cloneVec(route[0] ?? destination);
    return true;
  }

  private startPatronExit(patron: MutablePatron) {
    const layout = patron.roomId ? ROOM_LAYOUTS[patron.roomId] : null;
    const requiredStops = layout
      ? [layout.roomPortal, layout.barPortal, ENTRY_AISLE, ENTRANCE]
      : [ENTRY_AISLE, ENTRANCE];
    const route = this.makeRoute(patron.position, ENTRANCE, requiredStops);
    patron.state = 'leaving';
    patron.roomSlot = null;
    // Never turn a failed A* result into a straight line through geometry.
    // An empty leaving route despawns safely on the next simulation update.
    patron.route = route ?? [];
    patron.target = cloneVec(patron.route[0] ?? patron.position);
  }

  private makeBasePatron(): MutablePatron {
    const id = `guest-${++this.patronSequence}`;
    const initialPatience = 34 + this.rng() * 10;
    return {
      id,
      tableId: -1,
      state: 'queued_entrance',
      position: cloneVec(ENTRANCE),
      target: cloneVec(ENTRANCE),
      route: [],
      timer: 0,
      patience: initialPatience,
      initialPatience,
      order: null,
      palette: this.patronSequence % 6,
      happiness: 1,
      barServed: false,
      roomId: null,
      roomSlot: null,
    };
  }

  private spawnPatronAtTable(openTables: TableState[]): boolean {
    const table = openTables[Math.floor(this.rng() * openTables.length)] ?? openTables[0];
    const route = this.makeRoute(ENTRANCE, table.seat);
    if (!route) return false;
    const patron = this.makeBasePatron();
    patron.tableId = table.id;
    patron.state = 'walking_in';
    patron.route = route;
    patron.target = cloneVec(ENTRY_AISLE);
    table.occupantId = patron.id;
    this.patrons.push(patron);
    return true;
  }

  private spawnPatronDirectlyToRoom(): boolean {
    for (const { definition, room } of this.getStaffedRoomCandidates()) {
      const slot = this.findFreeRoomSlot(definition.id, room.capacity);
      if (slot < 0) continue;
      const patron = this.makeBasePatron();
      if (!this.assignPatronToRoomFromEntrance(patron, definition, slot)) continue;
      this.patrons.push(patron);
      return true;
    }
    return false;
  }

  private entranceQueueCount() {
    return this.patrons.filter((patron) => patron.state === 'queued_entrance').length;
  }

  private spawnPatronToEntranceQueue() {
    if (this.entranceQueueCount() >= ENTRANCE_QUEUE_CAP) return;
    this.patrons.push(this.makeBasePatron());
  }

  private trySpawnPatron() {
    const openTables = this.tables.filter((table) => !table.occupantId && !table.dirty);
    if (this.barStaffCount() > 0) {
      // Bar is open: guests only sit for drinks. Never skip to rooms while the bar is staffed.
      if (openTables.length > 0) this.spawnPatronAtTable(openTables);
      else this.spawnPatronToEntranceQueue();
      return;
    }
    if (this.spawnPatronDirectlyToRoom()) return;
    this.spawnPatronToEntranceQueue();
  }

  /** Try to move guests waiting at the entrance into a table or a staffed room as capacity opens up. */
  private promoteQueuedPatrons() {
    for (const patron of this.patrons) {
      if (patron.state !== 'queued_entrance') continue;
      if (this.barStaffCount() > 0) {
        const table = this.tables.find((item) => !item.occupantId && !item.dirty);
        if (table) {
          const route = this.makeRoute(patron.position, table.seat);
          if (route) {
            table.occupantId = patron.id;
            patron.tableId = table.id;
            patron.state = 'walking_in';
            patron.route = route;
            patron.target = cloneVec(route[0] ?? table.seat);
          }
        }
        continue;
      }
      for (const { definition, room } of this.getStaffedRoomCandidates()) {
        const slot = this.findFreeRoomSlot(definition.id, room.capacity);
        if (slot < 0) continue;
        if (this.assignPatronToRoomFromEntrance(patron, definition, slot)) break;
      }
    }
  }

  private updatePatrons(delta: number) {
    const departed: MutablePatron[] = [];
    for (const patron of this.patrons) {
      if (patron.state === 'walking_in') {
        if (this.moveAlongRoute(patron, 1.62, delta)) {
          patron.state = 'waiting_order';
          // Keep seated guests facing the table instead of preserving the
          // direction of their final walking segment.
          patron.target = cloneVec(this.tables[patron.tableId].position);
        }
      } else if (patron.state === 'walking_to_room') {
        if (this.moveAlongRoute(patron, 1.68, delta)) {
          patron.state = 'waiting_room';
          patron.target = cloneVec(patron.position);
        }
      } else if (patron.state === 'leaving') {
        if (this.moveAlongRoute(patron, 1.76, delta)) departed.push(patron);
      } else if (patron.state === 'drinking') {
        patron.timer -= delta;
        if (patron.timer <= 0) patron.state = 'ready_to_pay';
      }

      if (patron.state === 'waiting_order') patron.patience -= delta;
      if (patron.state === 'waiting_drink') patron.patience -= delta * 0.72;
      patron.patience = Math.max(0, patron.patience);
      patron.happiness = clamp(patron.patience / patron.initialPatience, 0.18, 1);
    }

    if (departed.length > 0) {
      const departedIds = new Set(departed.map((patron) => patron.id));
      for (const patron of departed) {
        const table = this.tables[patron.tableId];
        if (table?.occupantId === patron.id) table.occupantId = null;
        const reputationEarned = patron.happiness >= 0.82 ? 2 : 1;
        this.reputation += reputationEarned;
        this.pushEvent('reputation', `Счастливый гость +${reputationEarned}`, reputationEarned);
      }
      this.patrons = this.patrons.filter((patron) => !departedIds.has(patron.id));
      this.persist();
    }
  }

  private updateBartender(delta: number) {
    this.syncBartenderStaff();
    if (this.barStaffCount() === 0) {
      // No one at the bar: force idle, drop any route, never take new orders.
      if (this.bartender.state !== 'idle') this.setBartenderIdle();
      return;
    }

    const moving = this.bartender.state.startsWith('to_') || this.bartender.state === 'returning_dirty';
    if (moving) {
      const speed = (2.15 * (1 + (this.upgrades.moveSpeed - 1) * 0.16)) / this.barSpeedFactor();
      if (this.moveAlongRoute(this.bartender, speed, delta)) this.finishBartenderMove();
      return;
    }

    if (this.bartender.state !== 'idle') {
      this.bartender.timer -= delta;
      if (this.bartender.state === 'delivering' && this.bartender.deliveryDuration > 0) {
        this.bartender.deliveryProgress = clamp(
          1 - this.bartender.timer / this.bartender.deliveryDuration,
          0,
          1,
        );
      }
      if (this.bartender.timer <= 0) this.finishBartenderAction();
      return;
    }

    this.chooseBartenderJob();
  }

  /** Multiplier applied to bar timers/speed; <1 shortens durations with a second worker. */
  private barSpeedFactor() {
    return this.barStaffCount() >= 2 ? SECOND_BAR_WORKER_SPEED : 1;
  }

  private chooseBartenderJob() {
    const payment = this.patrons.find((patron) => patron.state === 'ready_to_pay');
    if (payment) {
      this.bartender.targetPatronId = payment.id;
      this.bartender.targetTableId = payment.tableId;
      this.startBartenderMove('to_payment', this.tables[payment.tableId].service);
      return;
    }

    const order = this.patrons.find((patron) => patron.state === 'waiting_order');
    if (order) {
      this.bartender.targetPatronId = order.id;
      this.bartender.targetTableId = order.tableId;
      this.startBartenderMove('to_order', this.tables[order.tableId].service);
      return;
    }

    const dirtyTable = this.tables.find((table) => table.dirty && !table.occupantId);
    if (dirtyTable) {
      this.bartender.targetPatronId = null;
      this.bartender.targetTableId = dirtyTable.id;
      this.startBartenderMove('to_cleanup', dirtyTable.service);
    }
  }

  private startBartenderMove(state: BartenderState, destination: Vec2, explicitRoute?: Vec2[]) {
    const route = this.makeRoute(this.bartender.position, destination, explicitRoute);
    if (!route) {
      this.setBartenderIdle();
      return;
    }
    this.bartender.state = state;
    this.bartender.route = route;
    this.bartender.target = cloneVec(route[0] ?? destination);
  }

  private finishBartenderMove() {
    const patron = this.patrons.find((item) => item.id === this.bartender.targetPatronId);
    const table = this.bartender.targetTableId === null ? null : this.tables[this.bartender.targetTableId];
    if (patron) this.bartender.target = cloneVec(patron.position);
    else if (table) this.bartender.target = cloneVec(table.position);
    switch (this.bartender.state) {
      case 'to_order':
        if (!patron || patron.state !== 'waiting_order') return this.setBartenderIdle();
        patron.state = 'ordering';
        this.bartender.state = 'taking_order';
        this.bartender.timer = 2.15 * 0.83 ** (this.upgrades.orderSpeed - 1) * this.barSpeedFactor();
        break;
      case 'to_bar':
        this.bartender.target = { x: BAR_STATION.x, z: -3.35 };
        this.bartender.state = 'preparing';
        this.bartender.timer = 3.35 * 0.82 ** (this.upgrades.prepSpeed - 1) * this.barSpeedFactor();
        break;
      case 'to_deliver':
        if (!patron || patron.state !== 'waiting_drink') return this.setBartenderIdle();
        this.beginDeliveryShow(patron, table);
        break;
      case 'to_payment':
        if (!patron || patron.state !== 'ready_to_pay') return this.setBartenderIdle();
        patron.state = 'paying';
        this.bartender.state = 'taking_payment';
        this.bartender.timer = 0.82;
        break;
      case 'to_cleanup':
        if (!table || !table.dirty || table.occupantId) return this.setBartenderIdle();
        this.bartender.state = 'cleaning';
        this.bartender.timer = 2.65 * 0.8 ** (this.upgrades.cleanSpeed - 1) * this.barSpeedFactor();
        break;
      case 'returning_dirty':
        this.bartender.carryingDirty = false;
        this.setBartenderIdle();
        break;
      default:
        this.setBartenderIdle();
    }
  }

  private finishBartenderAction() {
    const patron = this.patrons.find((item) => item.id === this.bartender.targetPatronId);
    const table = this.bartender.targetTableId === null ? null : this.tables[this.bartender.targetTableId];
    switch (this.bartender.state) {
      case 'taking_order': {
        if (!patron) return this.setBartenderIdle();
        patron.order = this.pickDrink();
        patron.state = 'waiting_drink';
        this.startBartenderMove('to_bar', BAR_STATION, [cloneVec(SERVICE_GATE), cloneVec(BAR_STATION)]);
        break;
      }
      case 'preparing':
        if (!patron?.order) return this.setBartenderIdle();
        this.bartender.carryingDrink = patron.order;
        // Levels 4–5 walk nude from the bar; lower tiers strip at the table.
        this.bartender.outfit = patron.order.level >= 4 ? 'nude' : 'uniform';
        this.bartender.onTable = false;
        this.bartender.deliveryProgress = 0;
        this.startBartenderMove('to_deliver', this.tables[patron.tableId].service, [cloneVec(SERVICE_GATE), cloneVec(this.tables[patron.tableId].service)]);
        break;
      case 'delivering':
        if (patron?.order) {
          patron.state = 'drinking';
          patron.timer = patron.order.drinkTime;
        }
        this.bartender.carryingDrink = null;
        this.bartender.outfit = 'uniform';
        this.bartender.onTable = false;
        this.bartender.deliveryProgress = 0;
        this.bartender.deliveryDuration = 0;
        this.setBartenderIdle();
        break;
      case 'taking_payment':
        if (patron?.order && table) {
          const tip = Math.round(patron.order.price * Math.max(0, patron.happiness - 0.38) * 0.32);
          const payment = patron.order.price + tip;
          this.coins += payment;
          this.totalOperatingRevenue += payment;
          this.shiftOperatingRevenue += payment;
          this.served += 1;
          patron.barServed = true;
          table.dirty = true;
          table.occupantId = null;
          if (!this.trySendPatronToRoom(patron)) this.startPatronExit(patron);
          this.pushEvent('payment', `${patron.order.name} +${payment}`, payment);
          this.persist();
        }
        this.setBartenderIdle();
        break;
      case 'cleaning':
        if (table) table.dirty = false;
        this.bartender.carryingDirty = true;
        this.startBartenderMove('returning_dirty', BAR_STATION, [cloneVec(SERVICE_GATE), cloneVec(BAR_STATION)]);
        break;
      default:
        this.setBartenderIdle();
    }
  }

  private beginDeliveryShow(patron: MutablePatron, table: TableState | null) {
    const level = this.bartender.carryingDrink?.level ?? patron.order?.level ?? 1;
    const duration = getDeliveryDuration(level);
    this.bartender.state = 'delivering';
    this.bartender.timer = duration;
    this.bartender.deliveryDuration = duration;
    this.bartender.deliveryProgress = 0;
    this.bartender.onTable = level >= 5;
    if (level === 2) this.bartender.outfit = 'topless';
    else if (level === 3) this.bartender.outfit = 'skirt_up';
    else if (level >= 4) this.bartender.outfit = 'nude';
    else this.bartender.outfit = 'uniform';
    if (level >= 5 && table) {
      this.bartender.position = cloneVec(table.position);
      this.bartender.target = cloneVec(table.position);
      this.bartender.route = [];
    }
  }

  private setBartenderIdle() {
    this.bartender.state = 'idle';
    this.bartender.route = [];
    this.bartender.target = cloneVec(this.bartender.position);
    this.bartender.targetPatronId = null;
    this.bartender.targetTableId = null;
    this.bartender.timer = 0;
    this.bartender.outfit = 'uniform';
    this.bartender.onTable = false;
    this.bartender.deliveryProgress = 0;
    this.bartender.deliveryDuration = 0;
  }

  private pickDrink(): Drink {
    const unlocked = getUnlockedDrinks(this.upgrades.assortment);
    const premiumBias = this.rng() ** 0.72;
    return unlocked[Math.min(unlocked.length - 1, Math.floor(premiumBias * unlocked.length))] ?? DRINKS[0];
  }

  private moveAlongRoute(entity: { position: Vec2; target: Vec2; route: Vec2[] }, speed: number, delta: number) {
    let remaining = speed * delta;
    while (entity.route.length > 0 && remaining > 0) {
      const destination = entity.route[0];
      const gap = distance(entity.position, destination);
      if (gap <= remaining || gap < 0.001) {
        entity.position.x = destination.x;
        entity.position.z = destination.z;
        remaining -= gap;
        entity.route.shift();
      } else {
        entity.position.x += ((destination.x - entity.position.x) / gap) * remaining;
        entity.position.z += ((destination.z - entity.position.z) / gap) * remaining;
        remaining = 0;
      }
    }
    entity.target = cloneVec(entity.route[0] ?? entity.position);
    return entity.route.length === 0;
  }

  private makeRoute(start: Vec2, destination: Vec2, requiredStops: Vec2[] = []): Vec2[] | null {
    const obstacles = makeLevelObstacles(this.tables.map((table) => table.position));
    const stops = requiredStops.length > 0 ? requiredStops : [destination];
    const route: Vec2[] = [];
    let cursor = cloneVec(start);
    for (const stop of stops) {
      const segment = findGridPath(cursor, stop, obstacles);
      if (segment.length === 0) return null;
      route.push(...segment);
      cursor = cloneVec(stop);
    }
    return route;
  }

  private pushEvent(kind: GameEvent['kind'], message: string, amount?: number, roomId?: RoomId) {
    this.lastEvent = { id: ++this.eventSequence, kind, message, amount, roomId };
  }

  private buildSnapshot(): GameSnapshot {
    const roomRevenue = ROOM_DEFINITIONS.reduce(
      (total, definition) => total + this.rooms[definition.id].revenue,
      0,
    );
    const roomsUnlocked = ROOM_DEFINITIONS.filter((definition) => this.rooms[definition.id].unlocked).length;
    const milestones = MILESTONE_DEFINITIONS.map((definition) => {
      let current = 0;
      switch (definition.metric) {
        case 'served':
          current = this.served;
          break;
        case 'roomsUnlocked':
          current = roomsUnlocked;
          break;
        case 'roomRevenue':
          current = roomRevenue;
          break;
        case 'day':
          current = this.day;
          break;
      }
      const { metric: _metric, ...milestone } = definition;
      return { ...milestone, current };
    });
    const achievedMilestoneCount = milestones.filter((milestone) => milestone.current >= milestone.target).length;

    return {
      started: this.started,
      paused: this.paused,
      speedMultiplier: this.speedMultiplier,
      coins: this.coins,
      reputation: this.reputation,
      served: this.served,
      day: this.day,
      shiftProgress: this.shiftElapsed / SHIFT_DURATION,
      patrons: this.patrons.map(({ route: _route, ...patron }) => ({
        ...patron,
        position: cloneVec(patron.position),
        target: cloneVec(patron.target),
      })),
      tables: this.tables.map((table) => ({
        ...table,
        position: cloneVec(table.position),
        seat: cloneVec(table.seat),
        service: cloneVec(table.service),
      })),
      bartender: {
        position: cloneVec(this.bartender.position),
        target: cloneVec(this.bartender.target),
        state: this.bartender.state,
        targetPatronId: this.bartender.targetPatronId,
        targetTableId: this.bartender.targetTableId,
        carryingDrink: this.bartender.carryingDrink,
        carryingDirty: this.bartender.carryingDirty,
        outfit: this.bartender.outfit,
        onTable: this.bartender.onTable,
        deliveryProgress: this.bartender.deliveryProgress,
        staffId: this.bartender.staffId,
      },
      upgrades: { ...this.upgrades },
      rooms: ROOM_DEFINITIONS.map((definition) => {
        const { timer: _timer, phaseDuration: _phaseDuration, cooldown: _cooldown, guestIds: _guestIds, sessionWorkers: _sessionWorkers, ...room } = this.rooms[definition.id];
        const perGuestProfit = getRoomProfit(definition.id, room.upgrades.quality, 1);
        const maxSessionProfit = getRoomProfit(definition.id, room.upgrades.quality, room.capacity);
        return { ...room, perGuestProfit, maxSessionProfit, upgrades: { ...room.upgrades } };
      }),
      roomRevenue,
      totalOperatingRevenue: this.totalOperatingRevenue,
      totalDayBonus: this.totalDayBonus,
      nextMilestone: milestones.find((milestone) => milestone.current < milestone.target) ?? null,
      achievedMilestoneCount,
      totalMilestoneCount: milestones.length,
      queueCount: this.patrons.filter((patron) => patron.state === 'waiting_order' || patron.state === 'waiting_drink' || patron.state === 'ready_to_pay').length,
      unlockedDrinks: getUnlockedDrinks(this.upgrades.assortment),
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null,
      soundEnabled: this.soundEnabled,
      roster: STAFF_DEFINITIONS.map((definition): StaffRosterEntry => ({ id: definition.id, hired: this.hiredStaff.has(definition.id) })),
      venueSlots: this.cloneVenueSlots(),
      entranceQueue: this.entranceQueueCount(),
    };
  }

  private cloneVenueSlots(): VenueSlots {
    const clone = {} as VenueSlots;
    for (const venue of VENUE_IDS) {
      clone[venue] = [...this.venueSlots[venue]] as [StaffCharacterId | null, StaffCharacterId | null];
    }
    return clone;
  }

  private publish() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private persist() {
    const progress: SavedProgress = {
      coins: this.coins,
      reputation: this.reputation,
      served: this.served,
      day: this.day,
      upgrades: this.upgrades,
      soundEnabled: this.soundEnabled,
      totalOperatingRevenue: this.totalOperatingRevenue,
      totalDayBonus: this.totalDayBonus,
      rooms: Object.fromEntries(ROOM_DEFINITIONS.map((definition) => {
        const room = this.rooms[definition.id];
        return [definition.id, {
          unlocked: room.unlocked,
          completedSessions: room.completedSessions,
          revenue: room.revenue,
          upgrades: room.upgrades,
        }];
      })) as SavedProgress['rooms'],
      hired: [...this.hiredStaff],
      venueSlots: this.cloneVenueSlots(),
    };
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch {
      // The game remains playable if storage is unavailable or full.
    }
  }

  private load() {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedProgress>;
      const knownStaffIds = new Set(STAFF_DEFINITIONS.map((definition) => definition.id));
      if (typeof saved.coins === 'number' && saved.coins >= 0) this.coins = Math.floor(saved.coins);
      if (typeof saved.reputation === 'number' && saved.reputation >= 0) this.reputation = Math.floor(saved.reputation);
      if (typeof saved.served === 'number' && saved.served >= 0) this.served = Math.floor(saved.served);
      if (typeof saved.day === 'number' && saved.day >= 1) this.day = Math.floor(saved.day);
      if (typeof saved.soundEnabled === 'boolean') this.soundEnabled = saved.soundEnabled;
      if (typeof saved.totalOperatingRevenue === 'number' && Number.isFinite(saved.totalOperatingRevenue) && saved.totalOperatingRevenue >= 0) {
        this.totalOperatingRevenue = Math.floor(saved.totalOperatingRevenue);
      }
      if (typeof saved.totalDayBonus === 'number' && Number.isFinite(saved.totalDayBonus) && saved.totalDayBonus >= 0) {
        this.totalDayBonus = Math.floor(saved.totalDayBonus);
      }
      if (saved.upgrades) {
        const levels = { ...INITIAL_UPGRADES };
        for (const definition of UPGRADE_DEFS) {
          const candidate = saved.upgrades[definition.key];
          if (typeof candidate === 'number') levels[definition.key] = clamp(Math.floor(candidate), 1, definition.maxLevel);
        }
        this.upgrades = levels;
      }
      if (saved.rooms) {
        for (const definition of ROOM_DEFINITIONS) {
          const candidate = saved.rooms[definition.id];
          if (!candidate) continue;
          const room = this.rooms[definition.id];
          room.unlocked = candidate.unlocked === true;
          room.staffState = room.unlocked ? 'waiting' : 'locked';
          room.cooldown = room.unlocked ? 1.2 : 0;
          room.completedSessions = typeof candidate.completedSessions === 'number' ? Math.max(0, Math.floor(candidate.completedSessions)) : 0;
          room.revenue = typeof candidate.revenue === 'number' ? Math.max(0, Math.floor(candidate.revenue)) : 0;
          if (candidate.upgrades) {
            for (const upgrade of ROOM_UPGRADE_DEFS) {
              const value = candidate.upgrades[upgrade.key];
              const max = upgrade.key === 'capacity' ? getRoomCapacityMaxLevel(definition.id) : upgrade.maxLevel;
              if (typeof value === 'number') room.upgrades[upgrade.key] = clamp(Math.floor(value), 1, max);
            }
          }
          room.capacity = getRoomCapacity(definition.id, room.upgrades.capacity);
        }
      }
      // Legacy saves predate the roster feature: no `hired`/`venueSlots` means
      // "keep the defaults" (only Christina hired, at bar slot 0).
      if (Array.isArray(saved.hired)) {
        const hired = saved.hired.filter((id): id is StaffCharacterId => knownStaffIds.has(id));
        this.hiredStaff = new Set(hired);
      }
      this.hiredStaff.add('christina');
      if (saved.venueSlots) {
        const slots = makeDefaultVenueSlots();
        for (const venue of VENUE_IDS) {
          const candidate = saved.venueSlots[venue];
          if (!Array.isArray(candidate)) continue;
          slots[venue] = [0, 1].map((index) => {
            const staffId = candidate[index];
            return typeof staffId === 'string' && knownStaffIds.has(staffId as StaffCharacterId) ? (staffId as StaffCharacterId) : null;
          }) as [StaffCharacterId | null, StaffCharacterId | null];
        }
        this.venueSlots = slots;
      }
    } catch {
      this.storage?.removeItem(SAVE_KEY);
    }
    this.sanitizeVenueSlots();
    this.syncBartenderStaff();
  }

  /** Guarantee "one body, one slot": drop unhired or duplicate assignments left over from a corrupt/legacy save. */
  private sanitizeVenueSlots() {
    const seen = new Set<StaffCharacterId>();
    for (const venue of VENUE_IDS) {
      const slots = this.venueSlots[venue];
      for (let index = 0; index < slots.length; index += 1) {
        const staffId = slots[index];
        if (staffId === null) continue;
        if (!this.hiredStaff.has(staffId) || seen.has(staffId)) {
          slots[index] = null;
        } else {
          seen.add(staffId);
        }
      }
    }
  }
}

export const gameEngine = new GameEngine();
