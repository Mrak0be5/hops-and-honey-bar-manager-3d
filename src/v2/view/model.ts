import type { RoomLifecycleStageId, RoomLifecycleState } from '../content/rooms';

export const VENUE_IDS = ['bar', 'karaoke', 'sauna', 'massage'] as const;

export type VenueId = (typeof VENUE_IDS)[number];
export type RoomVenueId = Exclude<VenueId, 'bar'>;

export type ViewPoint = {
  x: number;
  z: number;
};

export type CharacterActivity =
  | 'idle'
  | 'walk'
  | 'order'
  | 'drink'
  | 'pay'
  | 'karaoke'
  | 'sauna'
  | 'massage'
  | 'serve'
  | 'clean';

export type CharacterRole =
  | 'bartender'
  | 'patron'
  | 'karaoke-host'
  | 'sauna-attendant'
  | 'massage-therapist';

export type CharacterMood = 'calm' | 'happy' | 'impatient' | 'delighted';

export type CharacterPalette = {
  skin: string;
  hair: string;
  primary: string;
  secondary: string;
};

export type ViewCharacter = {
  id: string;
  role: CharacterRole;
  position: ViewPoint;
  target?: ViewPoint;
  activity: CharacterActivity;
  roomId?: VenueId;
  mood?: CharacterMood;
  palette?: Partial<CharacterPalette>;
  activityProgress?: number;
  seated?: boolean;
  visible?: boolean;
};

export type ViewUpgrade = {
  id: string;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number;
  affordable: boolean;
  visualCue?: string;
};

export type ViewRoomStatus = 'locked' | 'renovating' | 'open' | 'welcoming' | 'serving' | 'resetting';

export type ViewRoom = {
  id: RoomVenueId;
  title: string;
  unlocked: boolean;
  lifecycle: RoomLifecycleState;
  status: ViewRoomStatus;
  renovationStage: 0 | 1 | 2 | 3;
  nextStageId: RoomLifecycleStageId | null;
  nextStageCost: number;
  totalOpenCost: number;
  unlockCost: number;
  guests: number;
  capacity: number;
  revenue: number;
  projectedRevenuePerGuest: number;
  serviceSeconds: number;
  sessionProgress?: number;
  staffLabel?: string;
  staffHired: boolean;
  salaryPerShift: number;
  upgrades: ViewUpgrade[];
};

export type ViewEventKind =
  | 'coin'
  | 'upgrade'
  | 'unlock'
  | 'service'
  | 'warning'
  | 'karaoke'
  | 'steam'
  | 'aroma';

export type ViewEvent = {
  id: number;
  kind: ViewEventKind;
  position: ViewPoint;
  amount?: number;
  venueId?: VenueId;
  label?: string;
};

export type ViewObjective = {
  label: string;
  current: number;
  target: number;
  reward?: string;
};

export type ViewSnapshot = {
  started: boolean;
  paused: boolean;
  speed: 1 | 2 | 3;
  soundEnabled: boolean;
  day: number;
  shiftProgress: number;
  coins: number;
  prestige: number;
  served: number;
  roomRevenue?: number;
  objective?: ViewObjective | null;
  characters: ViewCharacter[];
  rooms: ViewRoom[];
  barUpgrades?: ViewUpgrade[];
  lastEvent?: ViewEvent | null;
};

export type ViewAction =
  | { type: 'focus'; venueId: VenueId }
  | { type: 'toggle-drawer' }
  | { type: 'toggle-pause' }
  | { type: 'toggle-speed' }
  | { type: 'toggle-sound' }
  | { type: 'start-shift' }
  | { type: 'purchase-upgrade'; venueId: VenueId; upgradeId: string }
  | { type: 'purchase-room'; roomId: RoomVenueId }
  | { type: 'reset' };

export type AmberQuality = 'auto' | 'high' | 'mobile';

export type AmberClubViewProps = {
  snapshot: ViewSnapshot;
  focus: VenueId;
  drawerOpen: boolean;
  reducedMotion?: boolean;
  onAction: (action: ViewAction) => void;
  quality?: AmberQuality;
  className?: string;
};

export const clampProgress = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const getRoomView = (snapshot: ViewSnapshot, roomId: RoomVenueId) => (
  snapshot.rooms.find((room) => room.id === roomId) ?? null
);
