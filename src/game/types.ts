export type Vec2 = { x: number; z: number };

export type PatronState =
  | 'walking_in'
  | 'waiting_order'
  | 'ordering'
  | 'waiting_drink'
  | 'drinking'
  | 'ready_to_pay'
  | 'paying'
  | 'leaving';

export type BartenderState =
  | 'idle'
  | 'to_order'
  | 'taking_order'
  | 'to_bar'
  | 'preparing'
  | 'to_deliver'
  | 'delivering'
  | 'to_payment'
  | 'taking_payment'
  | 'to_cleanup'
  | 'cleaning'
  | 'returning_dirty';

export type UpgradeKey =
  | 'moveSpeed'
  | 'orderSpeed'
  | 'prepSpeed'
  | 'cleanSpeed'
  | 'assortment'
  | 'advertising';

export type Currency = 'coins' | 'reputation';

export type Drink = {
  id: string;
  name: string;
  level: number;
  price: number;
  color: string;
  drinkTime: number;
};

export type Patron = {
  id: string;
  tableId: number;
  state: PatronState;
  position: Vec2;
  target: Vec2;
  timer: number;
  patience: number;
  initialPatience: number;
  order: Drink | null;
  palette: number;
  happiness: number;
};

export type TableState = {
  id: number;
  position: Vec2;
  seat: Vec2;
  service: Vec2;
  occupantId: string | null;
  dirty: boolean;
};

export type Bartender = {
  position: Vec2;
  target: Vec2;
  state: BartenderState;
  targetPatronId: string | null;
  targetTableId: number | null;
  carryingDrink: Drink | null;
  carryingDirty: boolean;
};

export type UpgradeLevels = Record<UpgradeKey, number>;

export type GameEvent = {
  id: number;
  kind: 'payment' | 'reputation' | 'upgrade' | 'day' | 'full';
  amount?: number;
  message: string;
};

export type GameSnapshot = {
  started: boolean;
  paused: boolean;
  speedMultiplier: 1 | 2;
  coins: number;
  reputation: number;
  served: number;
  day: number;
  shiftProgress: number;
  patrons: Patron[];
  tables: TableState[];
  bartender: Bartender;
  upgrades: UpgradeLevels;
  queueCount: number;
  unlockedDrinks: Drink[];
  lastEvent: GameEvent | null;
  soundEnabled: boolean;
};

export type UpgradeDefinition = {
  key: UpgradeKey;
  name: string;
  description: string;
  icon: string;
  currency: Currency;
  baseCost: number;
  maxLevel: number;
};
