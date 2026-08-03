import type {
  RoomId,
  RoomLifecycleStageId,
  RoomLifecycleState,
  RoomRenovationStage,
  RoomUpgradeId,
  RoomUpgradeLevels,
} from '../content/rooms';
import type { GridCell } from '../level/types';

export type SimulationSpeed = 1 | 2 | 3;

export type GuestPhase =
  | 'walking_to_bar'
  | 'waiting_order'
  | 'ordering'
  | 'waiting_drink'
  | 'drinking'
  | 'waiting_payment'
  | 'paying'
  | 'choosing_room'
  | 'walking_to_room'
  | 'waiting_room'
  | 'in_room'
  | 'leaving'
  | 'departed';

export type StaffRole =
  | 'bartender'
  | 'karaoke_host'
  | 'sauna_attendant'
  | 'massage_therapist';

export type StaffTaskKind =
  | 'take_order'
  | 'prepare_drink'
  | 'deliver_drink'
  | 'take_payment'
  | 'host_room';

export type StaffTaskSnapshot = Readonly<{
  id: string;
  kind: StaffTaskKind;
  guestId: string;
  roomId: RoomId | null;
  assignedRole: StaffRole;
  totalTicks: number;
  remainingTicks: number;
}>;

export type StaffSnapshot = Readonly<{
  id: string;
  role: StaffRole;
  roomId: RoomId | null;
  level: number;
  salaryPerShift: number;
  task: StaffTaskSnapshot | null;
}>;

export type GuestSnapshot = Readonly<{
  id: string;
  phase: GuestPhase;
  cell: GridCell;
  route: readonly GridCell[];
  targetSlotId: string | null;
  seatSlotId: string | null;
  roomSlotId: string | null;
  ticksRemaining: number;
  barVisit: Readonly<{
    completed: boolean;
    paidAtTick: number | null;
  }>;
  roomVisit: Readonly<{
    roomId: RoomId;
    completed: boolean;
  }> | null;
}>;

export type RoomRuntimeSnapshot = Readonly<{
  id: RoomId;
  unlocked: boolean;
  lifecycle: RoomLifecycleState;
  renovationStage: RoomRenovationStage;
  capacity: number;
  staff: Readonly<{
    hired: boolean;
    role: Exclude<StaffRole, 'bartender'>;
    level: number;
    salaryPerShift: number;
  }>;
  upgrades: Readonly<RoomUpgradeLevels>;
  reservedGuestIds: readonly string[];
  activeGuestIds: readonly string[];
  completedSessions: number;
  revenue: number;
}>;

export type LedgerEntryKind =
  | 'opening_balance'
  | 'bar_revenue'
  | 'room_revenue'
  | 'room_lifecycle'
  | 'room_unlock'
  | 'staff_salary'
  | 'upgrade_purchase';

export type LedgerEntry = Readonly<{
  id: string;
  tick: number;
  kind: LedgerEntryKind;
  amount: number;
  balanceAfter: number;
  sourceId: string;
  guestId?: string;
  roomId?: RoomId;
}>;

export type SimulationEventKind =
  | 'simulation_started'
  | 'guest_spawned'
  | 'guest_phase_changed'
  | 'room_visit_requested'
  | 'task_queued'
  | 'task_started'
  | 'task_completed'
  | 'ledger_posted'
  | 'room_lifecycle_advanced'
  | 'room_unlocked'
  | 'room_upgrade_purchased'
  | 'guest_blocked'
  | 'guest_departed';

export type SimulationEvent = Readonly<{
  id: number;
  tick: number;
  kind: SimulationEventKind;
  guestId?: string;
  roomId?: RoomId;
  taskKind?: StaffTaskKind;
  lifecycleStageId?: RoomLifecycleStageId;
  lifecycle?: RoomLifecycleState;
  upgradeId?: RoomUpgradeId;
  upgradeLevel?: number;
  ledgerEntryId?: string;
  fromPhase?: GuestPhase;
  toPhase?: GuestPhase;
}>;

export type RoomChoiceUtility = Readonly<{
  roomId: RoomId;
  utility: number;
  sessionProfit: number;
  qualityLevel: number;
  occupancy: number;
  capacity: number;
  waitingTasks: number;
  seededPreference: number;
}>;

export type SimulationSnapshot = Readonly<{
  started: boolean;
  paused: boolean;
  speed: SimulationSpeed;
  tick: number;
  fixedDeltaSeconds: number;
  simulationTimeSeconds: number;
  balance: number;
  servedGuests: number;
  guests: readonly GuestSnapshot[];
  staff: readonly StaffSnapshot[];
  rooms: readonly RoomRuntimeSnapshot[];
  queuedTasks: readonly StaffTaskSnapshot[];
  ledger: readonly LedgerEntry[];
  events: readonly SimulationEvent[];
}>;
