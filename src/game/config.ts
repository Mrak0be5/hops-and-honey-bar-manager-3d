import type { Drink, MilestoneDefinition, RoomDefinition, RoomId, RoomLayout, RoomUpgradeDefinition, RoomUpgradeKey, TableState, UpgradeDefinition, UpgradeLevels, Vec2 } from './types';

export const ENTRANCE: Vec2 = { x: 7.15, z: 4.5 };
export const ENTRY_AISLE: Vec2 = { x: 5.35, z: 3.45 };
export const BAR_STATION: Vec2 = { x: -1.25, z: -4.72 };
export const SERVICE_GATE: Vec2 = { x: 3.55, z: -3.2 };
export const SHIFT_DURATION = 150;
export const DAY_BONUS_CAP = 60;
export const DAY_BONUS_RATE = 0.2;
export const ROOM_GROUP_WINDOW = 4.8;
export const ROOM_MIN_WELCOME_DURATION = 0.8;
export const ROOM_RESET_DURATION = 1.15;
export const TABLE_RADIUS = 0.76;
export const GUEST_CHAIR_OFFSET = 1.16;
export const VENUE_NAME = 'Бордель у Кристофера';
export const BARTENDER_NAME = 'Кристина';

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
  { id: 'christina-kiss', name: 'Поцелуй Кристины', level: 3, price: 23, color: '#e85a9b', drinkTime: 8.4 },
  { id: 'red-room', name: 'Красная комната', level: 4, price: 31, color: '#c41e5a', drinkTime: 9.2 },
  { id: 'after-midnight', name: 'После полуночи', level: 5, price: 42, color: '#7b2cbf', drinkTime: 10 },
];

/** Seconds for Kristina's table-side delivery performance by drink level. */
export const getDeliveryDuration = (level: number) => {
  switch (level) {
    case 2: return 2;
    case 3: return 2.2;
    case 4: return 1;
    case 5: return 5.5;
    default: return 0.52;
  }
};

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
    id: 'strip',
    name: 'Стрип-зал',
    shortName: 'Стрип',
    tagline: 'Медведица танцует у шеста — чаевые летят',
    staffRole: 'Медведица-стриптизёрша',
    icon: '🐻',
    unlockCost: 280,
    baseProfit: 20,
    sessionDuration: 36,
    startCapacity: 1,
    maxCapacity: 3,
    upgradeBaseCosts: { staffSpeed: 60, capacity: 238, quality: 70 },
    color: '#9b3d6d',
    accent: '#ff74bf',
  },
  {
    id: 'sex',
    name: 'Комната удовольствий',
    shortName: 'Секс',
    tagline: 'Крольчиха принимает гостей на кровати',
    staffRole: 'Крольчиха-проститутка',
    icon: '🐰',
    unlockCost: 750,
    baseProfit: 42,
    sessionDuration: 42,
    startCapacity: 2,
    maxCapacity: 4,
    upgradeBaseCosts: { staffSpeed: 110, capacity: 638, quality: 130 },
    color: '#b8456b',
    accent: '#ff8fb8',
  },
  {
    id: 'gangbang',
    name: 'Зал оргии',
    shortName: 'Оргия',
    tagline: 'Тигрица ведёт гангбенг на платформе',
    staffRole: 'Тигрица-порноактриса',
    icon: '🐯',
    unlockCost: 1500,
    baseProfit: 70,
    sessionDuration: 45,
    startCapacity: 2,
    maxCapacity: 4,
    upgradeBaseCosts: { staffSpeed: 180, capacity: 638, quality: 200 },
    color: '#6b2d5c',
    accent: '#ff5c8a',
  },
];

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  { id: 'serve-25', label: 'Обслужить 25 гостей', metric: 'served', target: 25 },
  { id: 'open-first-room', label: 'Открыть первую комнату услуг', metric: 'roomsUnlocked', target: 1 },
  { id: 'serve-100', label: 'Обслужить 100 гостей', metric: 'served', target: 100 },
  { id: 'room-revenue-1000', label: 'Заработать 1 000 монет в комнатах', metric: 'roomRevenue', target: 1_000 },
  { id: 'open-all-rooms', label: 'Открыть все комнаты услуг', metric: 'roomsUnlocked', target: 3 },
  { id: 'reach-day-30', label: 'Довести бордель до 30-го дня', metric: 'day', target: 30 },
  { id: 'serve-500', label: 'Обслужить 500 гостей', metric: 'served', target: 500 },
  { id: 'room-revenue-10000', label: 'Заработать 10 000 монет в комнатах', metric: 'roomRevenue', target: 10_000 },
];

/**
 * One shared level-layout contract for rendering and pathfinding. The three
 * larger rooms touch the bar footprint exactly and connect through explicit
 * two-sided portals, so visitors cannot cut across the exterior void.
 */
export const ROOM_LAYOUTS: Record<RoomId, RoomLayout> = {
  strip: {
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
  sex: {
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
  gangbang: {
    center: { x: 4.2, z: -9.8 },
    size: { x: 8, z: 7.2 },
    connectionSide: 'south',
    barPortal: { x: 4.8, z: -5.55 },
    roomPortal: { x: 4.8, z: -6.55 },
    guestSpots: [
      { x: 2.0, z: -7.15 },
      { x: 3.5, z: -7.15 },
      { x: 5.0, z: -7.15 },
      { x: 6.5, z: -7.15 },
    ],
    cameraOffset: { x: 10.8, z: -14.6 },
  },
};

export const ROOM_UPGRADE_DEFS: RoomUpgradeDefinition[] = [
  { key: 'staffSpeed', name: 'Скорость персонала', description: 'Сотрудница быстрее завершает сеанс.', icon: '⚡', maxLevel: 5 },
  { key: 'capacity', name: 'Дополнительное место', description: 'Больше гостей обслуживаются одновременно.', icon: '👥', maxLevel: 4 },
  { key: 'quality', name: 'Премиум-услуга', description: 'Каждый гость оставляет больше денег.', icon: '✨', maxLevel: 5 },
];

export const getRoomDefinition = (roomId: RoomId) => ROOM_DEFINITIONS.find((room) => room.id === roomId)!;

/** Effective guest slots from startCapacity + purchased capacity levels. */
export const getRoomCapacity = (roomId: RoomId, capacityUpgradeLevel: number) => {
  const room = getRoomDefinition(roomId);
  return Math.min(room.maxCapacity, room.startCapacity + Math.max(1, capacityUpgradeLevel) - 1);
};

/** Max upgrade level for capacity so effective capacity never exceeds maxCapacity. */
export const getRoomCapacityMaxLevel = (roomId: RoomId) => {
  const room = getRoomDefinition(roomId);
  return room.maxCapacity - room.startCapacity + 1;
};

export const getRoomUpgradeCost = (roomId: RoomId, key: RoomUpgradeKey, currentLevel: number) => {
  const room = getRoomDefinition(roomId);
  const growth = key === 'capacity' ? 1.62 : 1.45;
  return Math.ceil(room.upgradeBaseCosts[key] * growth ** (currentLevel - 1));
};

export const getRoomProfit = (roomId: RoomId, qualityLevel: number, guests: number) => {
  const room = getRoomDefinition(roomId);
  return Math.round(room.baseProfit * guests * (1 + (qualityLevel - 1) * 0.15));
};

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    key: 'moveSpeed',
    name: 'Ловкие ноги',
    description: 'Кристина быстрее ходит между столами.',
    icon: 'move-speed',
    currency: 'coins',
    baseCost: 38,
    maxLevel: 10,
  },
  {
    key: 'orderSpeed',
    name: 'Быстрый заказ',
    description: 'Меньше времени на разговор с гостем.',
    icon: 'order-speed',
    currency: 'coins',
    baseCost: 44,
    maxLevel: 10,
  },
  {
    key: 'prepSpeed',
    name: 'Шустрый кран',
    description: 'Напитки готовятся заметно быстрее.',
    icon: 'prep-speed',
    currency: 'coins',
    baseCost: 52,
    maxLevel: 10,
  },
  {
    key: 'cleanSpeed',
    name: 'Чистая стойка',
    description: 'Грязные кружки исчезают быстрее.',
    icon: 'clean-speed',
    currency: 'coins',
    baseCost: 35,
    maxLevel: 10,
  },
  {
    key: 'assortment',
    name: 'Новые напитки',
    description: 'Гости выбирают дороже — и шоу Кристины горячее.',
    icon: 'assortment',
    currency: 'coins',
    baseCost: 92,
    maxLevel: 5,
  },
  {
    key: 'advertising',
    name: 'Реклама борделя',
    description: 'Новые гости приходят чаще.',
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

export const getArrivalInterval = (advertisingLevel: number) =>
  Math.max(3.4, 9.5 - (advertisingLevel - 1) * 0.82);
