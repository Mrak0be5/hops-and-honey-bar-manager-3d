import {
  getRoomLifecycleStageCost,
  getRoomSessionProfit,
  getRoomUpgradeCost,
  ROOM_BLUEPRINTS,
  type RoomId,
  type RoomLifecycleStageId,
  type RoomLifecycleState,
  type RoomUpgradeId,
} from '../content/rooms';
import { AMBER_CLUB_VENUE, cellToWorld, getSlotsByKind } from '../level/venueBlueprint';
import type { GuestPhase, GuestSnapshot, RoomRuntimeSnapshot, SimulationEvent, SimulationSnapshot, StaffSnapshot } from '../simulation/types';
import type {
  CharacterActivity,
  CharacterPalette,
  RoomVenueId,
  VenueId,
  ViewCharacter,
  ViewEvent,
  ViewEventKind,
  ViewPoint,
  ViewRoom,
  ViewSnapshot,
  ViewUpgrade,
} from '../view/model';

const CHARACTER_PALETTES: readonly CharacterPalette[] = [
  { skin: '#c98763', hair: '#35251f', primary: '#2b7a78', secondary: '#f3e7d3' },
  { skin: '#f0b68d', hair: '#6f4433', primary: '#c85c3c', secondary: '#123b3b' },
  { skin: '#8d573f', hair: '#1e2021', primary: '#6b4cc2', secondary: '#f4b740' },
  { skin: '#e0a079', hair: '#b1683e', primary: '#4f9f85', secondary: '#fff4dc' },
];

const hashString = (value: string) => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const paletteForId = (id: string) => CHARACTER_PALETTES[hashString(id) % CHARACTER_PALETTES.length];

const activityForGuest = (guest: GuestSnapshot): CharacterActivity => {
  const phaseMap: Partial<Record<GuestPhase, CharacterActivity>> = {
    walking_to_bar: 'walk',
    ordering: 'order',
    drinking: 'drink',
    paying: 'pay',
    walking_to_room: 'walk',
    leaving: 'walk',
  };
  if (guest.phase === 'in_room' && guest.roomVisit) return guest.roomVisit.roomId;
  return phaseMap[guest.phase] ?? 'idle';
};

const roomForGuest = (guest: GuestSnapshot): VenueId => guest.roomVisit?.roomId ?? 'bar';

const BAR_SEATED_PHASES = new Set<GuestPhase>([
  'waiting_order',
  'ordering',
  'waiting_drink',
  'drinking',
  'waiting_payment',
  'paying',
]);

const mapGuest = (guest: GuestSnapshot): ViewCharacter => {
  const position = cellToWorld(AMBER_CLUB_VENUE, guest.cell);
  const nextCell = guest.route[0];
  return {
    id: guest.id,
    role: 'patron',
    position,
    target: nextCell ? cellToWorld(AMBER_CLUB_VENUE, nextCell) : undefined,
    activity: activityForGuest(guest),
    roomId: roomForGuest(guest),
    mood: guest.roomVisit?.completed ? 'delighted' : guest.barVisit.completed ? 'happy' : 'calm',
    palette: paletteForId(guest.id),
    activityProgress: guest.phase === 'drinking' ? 1 - Math.min(1, guest.ticksRemaining / 175) : undefined,
    seated: BAR_SEATED_PHASES.has(guest.phase) || (guest.phase === 'in_room' && guest.roomVisit?.roomId !== 'karaoke'),
    visible: guest.phase !== 'departed',
  };
};

const fixedStaffPosition = (staff: StaffSnapshot): ViewPoint => {
  if (staff.role === 'bartender') {
    return getSlotsByKind(AMBER_CLUB_VENUE, 'bar_prep')[0]?.position ?? { x: 0, z: -5.7 };
  }
  const slot = getSlotsByKind(AMBER_CLUB_VENUE, 'room_staff').find((candidate) => candidate.roomId === staff.roomId);
  return slot?.position ?? { x: 0, z: 0 };
};

const mapStaff = (staff: StaffSnapshot): ViewCharacter => {
  const roleMap = {
    bartender: 'bartender',
    karaoke_host: 'karaoke-host',
    sauna_attendant: 'sauna-attendant',
    massage_therapist: 'massage-therapist',
  } as const;
  const serviceActivity: Record<RoomId, CharacterActivity> = {
    karaoke: 'karaoke',
    sauna: 'sauna',
    massage: 'massage',
  };
  const activity = staff.task?.kind === 'host_room' && staff.roomId
    ? serviceActivity[staff.roomId]
    : staff.task ? 'serve' : 'idle';

  return {
    id: staff.id,
    role: roleMap[staff.role],
    position: fixedStaffPosition(staff),
    activity,
    roomId: staff.roomId ?? 'bar',
    activityProgress: staff.task
      ? 1 - Math.min(1, staff.task.remainingTicks / Math.max(1, staff.task.totalTicks))
      : undefined,
    palette: staff.role === 'bartender'
      ? { skin: '#c98763', hair: '#2b211d', primary: '#123b3b', secondary: '#f4b740' }
      : paletteForId(staff.id),
  };
};

const makeRoomUpgrades = (room: RoomRuntimeSnapshot, balance: number): ViewUpgrade[] => (
  ROOM_BLUEPRINTS[room.id].upgrades.map((upgrade) => {
    const level = room.upgrades[upgrade.id];
    const cost = getRoomUpgradeCost(room.id, upgrade.id as RoomUpgradeId, level);
    const title = upgrade.id === 'staffSpeed'
      ? 'Мастерство персонала'
      : upgrade.id === 'capacity'
        ? 'Оснащение помещения'
        : 'Премиальный сервис';
    return ({
    id: upgrade.id,
    title,
    description: upgrade.id === 'staffSpeed'
      ? 'Сотрудник обслуживает быстрее, получает новый уровень формы и реквизита.'
      : upgrade.id === 'capacity'
        ? 'Добавляет реальные места, мебель и премиальные зоны комнаты.'
        : 'Повышает средний чек и визуально улучшает свет, атмосферу и оборудование.',
    level,
    maxLevel: upgrade.maxLevel,
    cost,
    affordable: cost > 0 && balance >= cost,
    visualCue: upgrade.id,
    });
  })
);

const NEXT_LIFECYCLE_STAGE: Readonly<Partial<Record<RoomLifecycleState, RoomLifecycleStageId>>> = {
  locked: 'permit',
  permitted: 'renovate',
  renovating: 'equip',
  equipping: 'hire',
};

const mapRooms = (snapshot: SimulationSnapshot): ViewRoom[] => snapshot.rooms.map((room) => {
  const definition = ROOM_BLUEPRINTS[room.id];
  const nextStageId = NEXT_LIFECYCLE_STAGE[room.lifecycle] ?? null;
  const nextStageCost = nextStageId ? getRoomLifecycleStageCost(room.id, nextStageId) : 0;
  const activeTask = snapshot.staff.find((member) => member.roomId === room.id)?.task;
  return {
    id: room.id as RoomVenueId,
    title: definition.displayName,
    unlocked: room.unlocked,
    lifecycle: room.lifecycle,
    status: room.activeGuestIds.length > 0
      ? 'serving'
      : room.unlocked
        ? 'open'
        : room.lifecycle === 'locked'
          ? 'locked'
          : 'renovating',
    renovationStage: room.renovationStage,
    nextStageId,
    nextStageCost,
    totalOpenCost: definition.totalOpenCost,
    unlockCost: nextStageCost,
    guests: room.activeGuestIds.length + room.reservedGuestIds.length,
    capacity: room.capacity,
    revenue: room.revenue,
    projectedRevenuePerGuest: getRoomSessionProfit(room.id, room.upgrades.quality, 1),
    serviceSeconds: definition.serviceSeconds,
    sessionProgress: activeTask?.kind === 'host_room'
      ? 1 - Math.min(1, activeTask.remainingTicks / Math.max(1, activeTask.totalTicks))
      : undefined,
    staffLabel: room.staff.hired
      ? `${definition.staff.displayName} · ур. ${room.staff.level}`
      : 'Не нанят',
    staffHired: room.staff.hired,
    salaryPerShift: room.staff.salaryPerShift,
    upgrades: makeRoomUpgrades(room, snapshot.balance),
  };
});

const eventPosition = (event: SimulationEvent, guests: readonly GuestSnapshot[]): ViewPoint => {
  const guest = event.guestId ? guests.find((candidate) => candidate.id === event.guestId) : null;
  if (guest) return cellToWorld(AMBER_CLUB_VENUE, guest.cell);
  if (event.roomId) {
    const zone = AMBER_CLUB_VENUE.zones.find((candidate) => candidate.id === event.roomId);
    if (zone) return zone.footprint.center;
  }
  return { x: 0, z: -3.5 };
};

const mapLastEvent = (snapshot: SimulationSnapshot): ViewEvent | null => {
  const event = snapshot.events.at(-1);
  if (!event) return null;
  const ledgerEntry = event.ledgerEntryId
    ? snapshot.ledger.find((entry) => entry.id === event.ledgerEntryId)
    : null;
  const kindMap: Partial<Record<SimulationEvent['kind'], ViewEventKind>> = {
    ledger_posted: ledgerEntry?.amount && ledgerEntry.amount > 0 ? 'coin' : 'service',
    room_lifecycle_advanced: event.lifecycle === 'open' ? 'unlock' : 'service',
    room_unlocked: 'unlock',
    room_upgrade_purchased: 'upgrade',
    room_visit_requested: event.roomId === 'karaoke' ? 'karaoke' : 'service',
    guest_blocked: 'warning',
    task_completed: 'service',
  };
  const kind = kindMap[event.kind];
  if (!kind) return null;

  return {
    id: event.id,
    kind,
    position: eventPosition(event, snapshot.guests),
    amount: ledgerEntry?.amount && ledgerEntry.amount > 0 ? ledgerEntry.amount : undefined,
    venueId: event.roomId ?? 'bar',
  };
};

export type ViewProjectionOptions = {
  soundEnabled?: boolean;
  prestigeBase?: number;
  servedBase?: number;
  dayBase?: number;
  roomRevenueBase?: number;
};

export const mapSimulationToView = (
  snapshot: SimulationSnapshot,
  options: ViewProjectionOptions = {},
): ViewSnapshot => {
  const departed = snapshot.servedGuests;
  const day = (options.dayBase ?? 1) + Math.floor(snapshot.simulationTimeSeconds / 150);
  const shiftSeconds = snapshot.simulationTimeSeconds % 150;
  const roomRevenue = (options.roomRevenueBase ?? 0)
    + snapshot.rooms.reduce((total, room) => total + room.revenue, 0);
  const served = (options.servedBase ?? 0) + departed;

  return {
    started: snapshot.started,
    paused: snapshot.paused,
    speed: snapshot.speed,
    soundEnabled: options.soundEnabled ?? true,
    day,
    shiftProgress: shiftSeconds / 150,
    coins: snapshot.balance,
    prestige: (options.prestigeBase ?? 0) + Math.floor(departed / 3),
    served,
    roomRevenue,
    objective: {
      label: 'Обслужить пять гостей Amber Club',
      current: Math.min(5, served),
      target: 5,
      reward: '+1 к престижу',
    },
    characters: [
      ...snapshot.staff.map(mapStaff),
      ...snapshot.guests.map(mapGuest),
    ],
    rooms: mapRooms(snapshot),
    lastEvent: mapLastEvent(snapshot),
  };
};
