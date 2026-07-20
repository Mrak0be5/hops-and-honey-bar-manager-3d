export type Vec2 = { x: number; z: number };

export type PatronState =
  | 'walking_in'
  | 'waiting_order'
  | 'ordering'
  | 'waiting_drink'
  | 'drinking'
  | 'ready_to_pay'
  | 'paying'
  | 'walking_to_room'
  | 'waiting_room'
  | 'in_room'
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

export type RoomId = 'karaoke' | 'sauna' | 'massage';
export type VenueView = 'bar' | RoomId;
export type RoomUpgradeKey = 'staffSpeed' | 'capacity' | 'quality';
export type RoomUpgradeLevels = Record<RoomUpgradeKey, number>;
export type RoomStaffState = 'locked' | 'waiting' | 'welcoming' | 'serving' | 'resetting';
export type MilestoneMetric = 'served' | 'roomsUnlocked' | 'roomRevenue' | 'day';

export type MilestoneDefinition = {
  id: string;
  label: string;
  metric: MilestoneMetric;
  target: number;
  rewardLabel?: string;
};

export type MilestoneProgress = {
  id: string;
  label: string;
  current: number;
  target: number;
  rewardLabel?: string;
};

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
  barServed: boolean;
  roomId: RoomId | null;
  roomSlot: number | null;
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
  kind: 'payment' | 'reputation' | 'upgrade' | 'day' | 'full' | 'room_income' | 'room_unlock';
  amount?: number;
  roomId?: RoomId;
  message: string;
};

export type RoomState = {
  id: RoomId;
  unlocked: boolean;
  staffState: RoomStaffState;
  guests: number;
  capacity: number;
  progress: number;
  completedSessions: number;
  revenue: number;
  perGuestProfit: number;
  maxSessionProfit: number;
  upgrades: RoomUpgradeLevels;
};

export type RoomDefinition = {
  id: RoomId;
  name: string;
  shortName: string;
  tagline: string;
  staffRole: string;
  icon: string;
  unlockCost: number;
  baseProfit: number;
  sessionDuration: number;
  maxCapacity: number;
  upgradeBaseCosts: Record<RoomUpgradeKey, number>;
  color: string;
  accent: string;
};

export type RoomLayout = {
  center: Vec2;
  size: Vec2;
  connectionSide: 'east' | 'west' | 'south';
  barPortal: Vec2;
  roomPortal: Vec2;
  guestSpots: Vec2[];
  cameraOffset: Vec2;
};

export type RoomUpgradeDefinition = {
  key: RoomUpgradeKey;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
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
  rooms: RoomState[];
  roomRevenue: number;
  totalOperatingRevenue: number;
  totalDayBonus: number;
  nextMilestone: MilestoneProgress | null;
  achievedMilestoneCount: number;
  totalMilestoneCount: number;
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
