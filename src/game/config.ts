import type { Drink, TableState, UpgradeDefinition, UpgradeLevels, Vec2 } from './types';

export const ENTRANCE: Vec2 = { x: 7.15, z: 4.5 };
export const ENTRY_AISLE: Vec2 = { x: 5.35, z: 3.45 };
export const BAR_STATION: Vec2 = { x: -1.25, z: -4.72 };
export const SERVICE_GATE: Vec2 = { x: 3.55, z: -3.2 };
export const SHIFT_DURATION = 150;
export const TABLE_RADIUS = 0.76;
export const GUEST_CHAIR_OFFSET = 1.16;

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

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    key: 'moveSpeed',
    name: 'Ловкие ноги',
    description: 'Бармен быстрее ходит между столами.',
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
    description: 'Гости выбирают дороже и платят больше.',
    icon: 'assortment',
    currency: 'coins',
    baseCost: 92,
    maxLevel: 5,
  },
  {
    key: 'advertising',
    name: 'Реклама бара',
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
