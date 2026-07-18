import {
  BAR_STATION,
  DRINKS,
  ENTRANCE,
  ENTRY_AISLE,
  getArrivalInterval,
  getUnlockedDrinks,
  getUpgradeCost,
  INITIAL_UPGRADES,
  SERVICE_GATE,
  SHIFT_DURATION,
  TABLE_LAYOUT,
  UPGRADE_DEFS,
} from './config';
import type {
  Bartender,
  BartenderState,
  Drink,
  GameEvent,
  GameSnapshot,
  Patron,
  TableState,
  UpgradeKey,
  UpgradeLevels,
  Vec2,
} from './types';
import { findGridPath, makeLevelObstacles } from './navigation';

type Listener = () => void;
type RandomSource = () => number;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type MutablePatron = Patron & { route: Vec2[] };
type MutableBartender = Bartender & { route: Vec2[]; timer: number };

type SavedProgress = {
  coins: number;
  reputation: number;
  served: number;
  day: number;
  upgrades: UpgradeLevels;
  soundEnabled: boolean;
};

const SAVE_KEY = 'hops-and-honey-save-v1';
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
      route: [],
      timer: 0,
    };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  start = () => {
    this.started = true;
    this.paused = false;
    this.pushEvent('day', `День ${this.day}: бар открыт!`);
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
    this.spawnTimer = 1.3;
    this.patrons = [];
    this.tables = TABLE_LAYOUT.map((table) => ({ ...table, position: cloneVec(table.position), seat: cloneVec(table.seat), service: cloneVec(table.service) }));
    this.bartender = this.makeBartender();
    this.upgrades = { ...INITIAL_UPGRADES };
    this.lastEvent = null;
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
      const bonus = 16 + this.day * 4;
      this.coins += bonus;
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

    this.publishTimer += delta;
    if (this.publishTimer >= PUBLISH_INTERVAL) {
      this.publishTimer = 0;
      this.publish();
    }
  }

  private trySpawnPatron() {
    const openTables = this.tables.filter((table) => !table.occupantId && !table.dirty);
    if (openTables.length === 0) return;
    const table = openTables[Math.floor(this.rng() * openTables.length)] ?? openTables[0];
    const id = `guest-${++this.patronSequence}`;
    const initialPatience = 34 + this.rng() * 10;
    const patron: MutablePatron = {
      id,
      tableId: table.id,
      state: 'walking_in',
      position: cloneVec(ENTRANCE),
      target: cloneVec(ENTRY_AISLE),
      route: this.makeRoute(ENTRANCE, table.seat),
      timer: 0,
      patience: initialPatience,
      initialPatience,
      order: null,
      palette: this.patronSequence % 6,
      happiness: 1,
    };
    table.occupantId = id;
    this.patrons.push(patron);
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
    const moving = this.bartender.state.startsWith('to_') || this.bartender.state === 'returning_dirty';
    if (moving) {
      const speed = 2.15 * (1 + (this.upgrades.moveSpeed - 1) * 0.16);
      if (this.moveAlongRoute(this.bartender, speed, delta)) this.finishBartenderMove();
      return;
    }

    if (this.bartender.state !== 'idle') {
      this.bartender.timer -= delta;
      if (this.bartender.timer <= 0) this.finishBartenderAction();
      return;
    }

    this.chooseBartenderJob();
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
        this.bartender.timer = 2.15 * 0.83 ** (this.upgrades.orderSpeed - 1);
        break;
      case 'to_bar':
        this.bartender.target = { x: BAR_STATION.x, z: -3.35 };
        this.bartender.state = 'preparing';
        this.bartender.timer = 3.35 * 0.82 ** (this.upgrades.prepSpeed - 1);
        break;
      case 'to_deliver':
        if (!patron || patron.state !== 'waiting_drink') return this.setBartenderIdle();
        this.bartender.state = 'delivering';
        this.bartender.timer = 0.52;
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
        this.bartender.timer = 2.65 * 0.8 ** (this.upgrades.cleanSpeed - 1);
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
        this.startBartenderMove('to_deliver', this.tables[patron.tableId].service, [cloneVec(SERVICE_GATE), cloneVec(this.tables[patron.tableId].service)]);
        break;
      case 'delivering':
        if (patron?.order) {
          patron.state = 'drinking';
          patron.timer = patron.order.drinkTime;
        }
        this.bartender.carryingDrink = null;
        this.setBartenderIdle();
        break;
      case 'taking_payment':
        if (patron?.order && table) {
          const tip = Math.round(patron.order.price * Math.max(0, patron.happiness - 0.38) * 0.32);
          const payment = patron.order.price + tip;
          this.coins += payment;
          this.served += 1;
          table.dirty = true;
          patron.state = 'leaving';
          patron.route = this.makeRoute(patron.position, ENTRANCE);
          patron.target = cloneVec(patron.route[0]);
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

  private setBartenderIdle() {
    this.bartender.state = 'idle';
    this.bartender.route = [];
    this.bartender.target = cloneVec(this.bartender.position);
    this.bartender.targetPatronId = null;
    this.bartender.targetTableId = null;
    this.bartender.timer = 0;
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

  private makeRoute(start: Vec2, destination: Vec2, requiredStops: Vec2[] = []) {
    const obstacles = makeLevelObstacles(this.tables.map((table) => table.position));
    const stops = requiredStops.length > 0 ? requiredStops : [destination];
    const route: Vec2[] = [];
    let cursor = cloneVec(start);
    for (const stop of stops) {
      const segment = findGridPath(cursor, stop, obstacles);
      if (segment.length === 0) return [];
      route.push(...segment);
      cursor = cloneVec(stop);
    }
    return route;
  }

  private pushEvent(kind: GameEvent['kind'], message: string, amount?: number) {
    this.lastEvent = { id: ++this.eventSequence, kind, message, amount };
  }

  private buildSnapshot(): GameSnapshot {
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
      },
      upgrades: { ...this.upgrades },
      queueCount: this.patrons.filter((patron) => patron.state === 'waiting_order' || patron.state === 'waiting_drink' || patron.state === 'ready_to_pay').length,
      unlockedDrinks: getUnlockedDrinks(this.upgrades.assortment),
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null,
      soundEnabled: this.soundEnabled,
    };
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
      if (typeof saved.coins === 'number' && saved.coins >= 0) this.coins = Math.floor(saved.coins);
      if (typeof saved.reputation === 'number' && saved.reputation >= 0) this.reputation = Math.floor(saved.reputation);
      if (typeof saved.served === 'number' && saved.served >= 0) this.served = Math.floor(saved.served);
      if (typeof saved.day === 'number' && saved.day >= 1) this.day = Math.floor(saved.day);
      if (typeof saved.soundEnabled === 'boolean') this.soundEnabled = saved.soundEnabled;
      if (saved.upgrades) {
        const levels = { ...INITIAL_UPGRADES };
        for (const definition of UPGRADE_DEFS) {
          const candidate = saved.upgrades[definition.key];
          if (typeof candidate === 'number') levels[definition.key] = clamp(Math.floor(candidate), 1, definition.maxLevel);
        }
        this.upgrades = levels;
      }
    } catch {
      this.storage?.removeItem(SAVE_KEY);
    }
  }
}

export const gameEngine = new GameEngine();
