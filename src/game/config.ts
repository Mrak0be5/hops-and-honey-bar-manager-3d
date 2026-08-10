import type { Drink, MilestoneDefinition, RoomDefinition, RoomId, RoomLayout, RoomUpgradeDefinition, RoomUpgradeKey, TableState, UpgradeDefinition, UpgradeLevels, Vec2 } from './types';

export const ENTRANCE: Vec2 = { x: 7.15, z: 4.5 };
export const ENTRY_AISLE: Vec2 = { x: 5.35, z: 3.45 };
export const BAR_STATION: Vec2 = { x: -1.25, z: -4.72 };
export const SERVICE_GATE: Vec2 = { x: 3.55, z: -3.2 };
export const SHIFT_DURATION = 150;
export const DAY_BONUS_CAP = 60;
export const DAY_BONUS_RATE = 0.2;
export const ROOM_MIN_WELCOME_DURATION = 0.8;
export const ROOM_RESET_DURATION = 1.15;
export const ROOM_COOLDOWN_DURATION = 2.4;
export const ROOM_STAFF_TIME_FACTOR = 0.85;
export const BAR_ACTION_MAX_LEVEL = 6;
export const TABLE_RADIUS = 0.76;
export const GUEST_CHAIR_OFFSET = 1.16;

export const getDayBonus = (shiftOperatingRevenue: number) =>
  Math.min(DAY_BONUS_CAP, Math.max(0, Math.round(shiftOperatingRevenue * DAY_BONUS_RATE)));

const makeTable = (id: number, x: number, z: number): TableState => ({
  id,
  position: { x, z },
  seat: { x, z: z + GUEST_CHAIR_OFFSET },
  service: { x: x + 1.18, z: z - 0.08 },
  occupantId: null,
  dirty: false,
});

export const TABLE_LAYOUT: TableState[] = [
  // Two clean rows with a 1.45 m cross-aisle and a wide central service lane.
  makeTable(0, -4.75, -0.45),
  makeTable(1, -1.35, -0.45),
  makeTable(2, 2.05, -0.45),
  makeTable(3, -4.75, 3.15),
  makeTable(4, -1.35, 3.15),
  makeTable(5, 2.05, 3.15),
];

export const DRINKS: Drink[] = [
  { id: 'sunny-lager', name: 'Солнечный лагер', level: 1, price: 12, color: '#f6ad2f', drinkTime: 7.2 },
  { id: 'pear-cider', name: 'Грушевый сидр', level: 2, price: 17, color: '#dff25b', drinkTime: 7.8 },
  { id: 'velvet-stout', name: 'Бархатный стаут', level: 3, price: 23, color: '#5d2b27', drinkTime: 8.4 },
  { id: 'berry-ale', name: 'Ягодный эль', level: 4, price: 31, color: '#d43c72', drinkTime: 9.2 },
  { id: 'aurora-ipa', name: 'Аврора IPA', level: 5, price: 42, color: '#f06d38', drinkTime: 10 },
];

export const INITIAL_UPGRADES: UpgradeLevels = {
  moveSpeed: 1,
  orderSpeed: 1,
  prepSpeed: 1,
  cleanSpeed: 1,
  assortment: 1,
  advertising: 1,
};

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    id: 'karaoke',
    name: 'Караоке-зал',
    shortName: 'Караоке',
    tagline: 'Песни, сцена и вечерние чаевые',
    staffRole: 'Ведущий караоке',
    icon: '🎤',
    unlockCost: 230,
    baseProfit: 20,
    sessionDuration: 36,
    maxCapacity: 3,
    upgradeBaseCosts: { staffSpeed: 60, capacity: 140, quality: 70 },
    color: '#7357d9',
    accent: '#ff74bf',
  },
  {
    id: 'sauna',
    name: 'Финская сауна',
    shortName: 'Сауна',
    tagline: 'Горячий пар и премиальные сеансы',
    staffRole: 'Банщик',
    icon: '♨️',
    unlockCost: 750,
    baseProfit: 42,
    sessionDuration: 42,
    maxCapacity: 4,
    upgradeBaseCosts: { staffSpeed: 110, capacity: 320, quality: 130 },
    color: '#d97839',
    accent: '#ffd36a',
  },
  {
    id: 'massage',
    name: 'Массажный кабинет',
    shortName: 'Массаж',
    tagline: 'Дорогой уход и высокий средний чек',
    staffRole: 'Массажист',
    icon: '💆',
    unlockCost: 1500,
    baseProfit: 70,
    sessionDuration: 45,
    maxCapacity: 2,
    upgradeBaseCosts: { staffSpeed: 110, capacity: 650, quality: 200 },
    color: '#2ba99a',
    accent: '#a9f0d8',
  },
];

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  { id: 'serve-25', label: 'Обслужить 25 гостей', metric: 'served', target: 25 },
  { id: 'open-first-room', label: 'Открыть первую дополнительную комнату', metric: 'roomsUnlocked', target: 1 },
  { id: 'serve-100', label: 'Обслужить 100 гостей', metric: 'served', target: 100 },
  { id: 'room-revenue-1000', label: 'Заработать 1 000 монет в комнатах', metric: 'roomRevenue', target: 1_000 },
  { id: 'open-all-rooms', label: 'Открыть все дополнительные комнаты', metric: 'roomsUnlocked', target: 3 },
  { id: 'reach-day-30', label: 'Довести бар до 30-го дня', metric: 'day', target: 30 },
  { id: 'serve-500', label: 'Обслужить 500 гостей', metric: 'served', target: 500 },
  { id: 'room-revenue-10000', label: 'Заработать 10 000 монет в комнатах', metric: 'roomRevenue', target: 10_000 },
];

/**
 * One shared level-layout contract for rendering and pathfinding. The three
 * larger rooms touch the bar footprint exactly and connect through explicit
 * two-sided portals, so visitors cannot cut across the exterior void.
 */
export const ROOM_LAYOUTS: Record<RoomId, RoomLayout> = {
  karaoke: {
    center: { x: -12.2, z: 1.5 },
    size: { x: 8, z: 7.2 },
    connectionSide: 'east',
    barPortal: { x: -7.55, z: 1.5 },
    roomPortal: { x: -8.55, z: 1.5 },
    guestSpots: [
      { x: -10.35, z: 1.2 },
      { x: -12.15, z: 1.35 },
      { x: -13.95, z: 1.5 },
    ],
    cameraOffset: { x: -10.8, z: 14.6 },
  },
  sauna: {
    center: { x: 12.2, z: 1 },
    size: { x: 8, z: 7.2 },
    connectionSide: 'west',
    barPortal: { x: 7.55, z: 1 },
    roomPortal: { x: 8.55, z: 1 },
    guestSpots: [
      { x: 10.15, z: 1.45 },
      { x: 11.5, z: 1.6 },
      { x: 12.85, z: 1.55 },
      { x: 14, z: 2.55 },
    ],
    cameraOffset: { x: 10.8, z: 14.6 },
  },
  massage: {
    center: { x: 4.2, z: -9.8 },
    size: { x: 8, z: 7.2 },
    connectionSide: 'south',
    barPortal: { x: 4.8, z: -5.55 },
    roomPortal: { x: 4.8, z: -6.55 },
    guestSpots: [
      { x: 2.4, z: -8.25 },
      { x: 6, z: -8.25 },
    ],
    cameraOffset: { x: 10.8, z: -14.6 },
  },
};

export const ROOM_UPGRADE_DEFS: RoomUpgradeDefinition[] = [
  { key: 'staffSpeed', name: 'Мастерство персонала', description: 'Сеанс, уборка и подготовка короче на 15% за уровень.', icon: '⚡', maxLevel: 5 },
  { key: 'capacity', name: 'Дополнительное место', description: 'Добавляет место; доход растёт при заполненном сеансе.', icon: '👥', maxLevel: 4 },
  { key: 'quality', name: 'Премиум-сервис', description: 'Базовый доход с каждого гостя выше на 15% за уровень.', icon: '✨', maxLevel: 5 },
];

export const getRoomDefinition = (roomId: RoomId) => ROOM_DEFINITIONS.find((room) => room.id === roomId)!;

export const getRoomUpgradeCost = (roomId: RoomId, key: RoomUpgradeKey, currentLevel: number) => {
  const room = getRoomDefinition(roomId);
  const growth = key === 'capacity' ? 1.62 : 1.45;
  return Math.ceil(room.upgradeBaseCosts[key] * growth ** (currentLevel - 1));
};

export const getRoomProfit = (roomId: RoomId, qualityLevel: number, guests: number) => {
  const room = getRoomDefinition(roomId);
  return Math.round(room.baseProfit * guests * (1 + (qualityLevel - 1) * 0.15));
};

const normalizedLevel = (level: number, maxLevel = Number.POSITIVE_INFINITY) =>
  Math.min(maxLevel, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));

/** Exact simulation values shared by the engine and the upgrade UI. */
export const getBartenderMoveSpeed = (level: number) =>
  2.15 * (1 + (normalizedLevel(level, BAR_ACTION_MAX_LEVEL) - 1) * 0.16);

export const getOrderDuration = (level: number) =>
  2.15 * 0.83 ** (normalizedLevel(level, BAR_ACTION_MAX_LEVEL) - 1);

export const getPreparationDuration = (level: number) =>
  3.35 * 0.82 ** (normalizedLevel(level, BAR_ACTION_MAX_LEVEL) - 1);

export const getCleaningDuration = (level: number) =>
  2.65 * 0.8 ** (normalizedLevel(level, BAR_ACTION_MAX_LEVEL) - 1);

const getRoomStaffTimeMultiplier = (staffLevel: number) =>
  ROOM_STAFF_TIME_FACTOR ** (normalizedLevel(staffLevel, 5) - 1);

export const getRoomSessionDuration = (roomId: RoomId, staffLevel: number) =>
  getRoomDefinition(roomId).sessionDuration * getRoomStaffTimeMultiplier(staffLevel);

export const getRoomResetDuration = (staffLevel: number) =>
  ROOM_RESET_DURATION * getRoomStaffTimeMultiplier(staffLevel);

export const getRoomCooldownDuration = (staffLevel: number) =>
  ROOM_COOLDOWN_DURATION * getRoomStaffTimeMultiplier(staffLevel);

/**
 * Larger rooms get a longer maximum batching window, while a full group can
 * still start after the short minimum welcome beat.
 */
export const getRoomGroupWindow = (capacity: number) =>
  8 + (Math.min(4, Math.max(1, Math.floor(capacity))) - 1) * 2;

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    key: 'moveSpeed',
    name: 'Ловкие ноги',
    description: 'Скорость ходьбы бармена выше на 0,34 м/с за уровень.',
    icon: 'move-speed',
    currency: 'coins',
    baseCost: 38,
    maxLevel: BAR_ACTION_MAX_LEVEL,
  },
  {
    key: 'orderSpeed',
    name: 'Быстрый заказ',
    description: 'Приём заказа короче на 17% за уровень.',
    icon: 'order-speed',
    currency: 'coins',
    baseCost: 44,
    maxLevel: BAR_ACTION_MAX_LEVEL,
  },
  {
    key: 'prepSpeed',
    name: 'Шустрый кран',
    description: 'Приготовление напитка короче на 18% за уровень.',
    icon: 'prep-speed',
    currency: 'coins',
    baseCost: 52,
    maxLevel: BAR_ACTION_MAX_LEVEL,
  },
  {
    key: 'cleanSpeed',
    name: 'Чистая стойка',
    description: 'Уборка стола короче на 20% за уровень.',
    icon: 'clean-speed',
    currency: 'coins',
    baseCost: 35,
    maxLevel: BAR_ACTION_MAX_LEVEL,
  },
  {
    key: 'assortment',
    name: 'Новые напитки',
    description: 'Открывает напиток и повышает среднюю цену заказа.',
    icon: 'assortment',
    currency: 'coins',
    baseCost: 92,
    maxLevel: 5,
  },
  {
    key: 'advertising',
    name: 'Реклама бара',
    description: 'Средний интервал прихода гостя короче на 0,82 секунды.',
    icon: 'advertising',
    currency: 'reputation',
    baseCost: 4,
    maxLevel: 8,
  },
];

export const getUpgradeCost = (definition: UpgradeDefinition, currentLevel: number) => {
  if (currentLevel >= definition.maxLevel) return 0;
  const growth = definition.currency === 'coins' ? 1.52 : 1.45;
  return Math.ceil(definition.baseCost * growth ** (currentLevel - 1));
};

export const getUnlockedDrinks = (assortmentLevel: number) =>
  DRINKS.filter((drink) => drink.level <= assortmentLevel);

/**
 * Expected base menu price under the same premium-biased random selection as
 * GameEngine.pickDrink (tips are intentionally excluded).
 */
export const getAverageDrinkPrice = (assortmentLevel: number) => {
  const unlocked = getUnlockedDrinks(normalizedLevel(assortmentLevel, DRINKS.length));
  const count = unlocked.length;
  if (count === 0) return DRINKS[0].price;
  const inverseBias = 1 / 0.72;
  return unlocked.reduce((average, drink, index) => {
    const upper = ((index + 1) / count) ** inverseBias;
    const lower = (index / count) ** inverseBias;
    return average + drink.price * (upper - lower);
  }, 0);
};

export const getArrivalInterval = (advertisingLevel: number) =>
  Math.max(3.4, 9.5 - (advertisingLevel - 1) * 0.82);
