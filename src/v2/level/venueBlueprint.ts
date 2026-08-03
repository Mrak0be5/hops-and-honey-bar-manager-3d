import { ROOM_BLUEPRINTS, ROOM_IDS } from '../content/rooms';
import type {
  GridCell,
  InteractionSlot,
  RectFootprint,
  Vec2,
  VenueBlueprint,
  VenueValidationIssue,
  VenueZoneBlueprint,
} from './types';

const centralBar: VenueZoneBlueprint = {
  id: 'bar',
  kind: 'central_bar',
  footprint: { center: { x: 0, z: 0 }, size: { x: 18, z: 14 } },
};

const roomZones: readonly VenueZoneBlueprint[] = [
  {
    id: 'karaoke',
    kind: 'room_wing',
    roomId: 'karaoke',
    footprint: { center: { x: -15, z: 0 }, size: ROOM_BLUEPRINTS.karaoke.wingSize },
  },
  {
    id: 'sauna',
    kind: 'room_wing',
    roomId: 'sauna',
    footprint: { center: { x: 15, z: 0 }, size: ROOM_BLUEPRINTS.sauna.wingSize },
  },
  {
    id: 'massage',
    kind: 'room_wing',
    roomId: 'massage',
    footprint: { center: { x: 0, z: -12 }, size: ROOM_BLUEPRINTS.massage.wingSize },
  },
];

const barGuestSlots: readonly InteractionSlot[] = [
  { id: 'bar-guest-1', zoneId: 'bar', kind: 'bar_guest', position: { x: -2.25, z: -3.25 }, facing: { x: -2.25, z: -4.85 } },
  { id: 'bar-guest-2', zoneId: 'bar', kind: 'bar_guest', position: { x: 0.25, z: -3.25 }, facing: { x: 0.25, z: -4.85 } },
  { id: 'bar-guest-3', zoneId: 'bar', kind: 'bar_guest', position: { x: 2.75, z: -3.25 }, facing: { x: 2.75, z: -4.85 } },
];

export const AMBER_CLUB_VENUE: VenueBlueprint = {
  id: 'amber-club-v2',
  displayName: 'Amber Club',
  units: 'meters',
  grid: {
    cellSize: 0.5,
    minX: -21,
    maxX: 21,
    minZ: -17,
    maxZ: 7,
  },
  zones: [centralBar, ...roomZones],
  obstacles: [
    { id: 'bar-counter', kind: 'rect', zoneId: 'bar', center: { x: 0, z: -4.85 }, size: { x: 9, z: 1.5 } },
    { id: 'bar-table-west-north', kind: 'circle', zoneId: 'bar', center: { x: -4.55, z: -1.1 }, radius: 1.1 },
    { id: 'bar-table-east-north', kind: 'circle', zoneId: 'bar', center: { x: 4.55, z: -1.1 }, radius: 1.1 },
    { id: 'bar-table-west-center', kind: 'circle', zoneId: 'bar', center: { x: -4.55, z: 2.25 }, radius: 1.1 },
    { id: 'bar-table-east-center', kind: 'circle', zoneId: 'bar', center: { x: 4.55, z: 2.25 }, radius: 1.1 },
    { id: 'bar-table-west-south', kind: 'circle', zoneId: 'bar', center: { x: -4.55, z: 5.05 }, radius: 1.1 },
    { id: 'bar-table-east-south', kind: 'circle', zoneId: 'bar', center: { x: 4.55, z: 5.05 }, radius: 1.1 },
    { id: 'bar-planter-west', kind: 'circle', zoneId: 'bar', center: { x: -7.7, z: -5.65 }, radius: 0.65 },
    { id: 'bar-planter-east', kind: 'circle', zoneId: 'bar', center: { x: 7.55, z: 5.7 }, radius: 0.65 },
    { id: 'karaoke-stage', kind: 'rect', zoneId: 'karaoke', center: { x: -15.4, z: -3.68 }, size: { x: 9, z: 2.2 } },
    { id: 'karaoke-speaker-west', kind: 'circle', zoneId: 'karaoke', center: { x: -19.25, z: -3.82 }, radius: 0.55 },
    { id: 'karaoke-speaker-east', kind: 'circle', zoneId: 'karaoke', center: { x: -11.55, z: -3.82 }, radius: 0.55 },
    { id: 'karaoke-sofa', kind: 'rect', zoneId: 'karaoke', center: { x: -16.1, z: 3.55 }, size: { x: 6.7, z: 1.3 } },
    { id: 'sauna-benches', kind: 'rect', zoneId: 'sauna', center: { x: 15.25, z: -3.95 }, size: { x: 8.5, z: 1.7 } },
    { id: 'sauna-heater', kind: 'circle', zoneId: 'sauna', center: { x: 17.65, z: 1.2 }, radius: 0.7 },
    { id: 'sauna-plunge', kind: 'rect', zoneId: 'sauna', center: { x: 11.3, z: 2.75 }, size: { x: 2.3, z: 2.3 } },
    { id: 'massage-bed-left', kind: 'rect', zoneId: 'massage', center: { x: -2.05, z: -13.2 }, size: { x: 1.7, z: 3.35 } },
    { id: 'massage-bed-right', kind: 'rect', zoneId: 'massage', center: { x: 2.05, z: -13.2 }, size: { x: 1.7, z: 3.35 } },
  ],
  portals: [
    {
      id: 'portal-bar-karaoke',
      zoneA: 'bar',
      zoneB: 'karaoke',
      axis: 'x',
      center: { x: -9, z: 0 },
      width: 2,
      sideA: { x: -8.75, z: 0.25 },
      sideB: { x: -9.25, z: 0.25 },
    },
    {
      id: 'portal-bar-sauna',
      zoneA: 'bar',
      zoneB: 'sauna',
      axis: 'x',
      center: { x: 9, z: 0 },
      width: 2,
      sideA: { x: 8.75, z: 0.25 },
      sideB: { x: 9.25, z: 0.25 },
    },
    {
      id: 'portal-bar-massage',
      zoneA: 'bar',
      zoneB: 'massage',
      axis: 'z',
      center: { x: 0, z: -7 },
      width: 2,
      sideA: { x: 0.25, z: -6.75 },
      sideB: { x: 0.25, z: -7.25 },
    },
  ],
  slots: [
    { id: 'venue-entrance', zoneId: 'bar', kind: 'entrance', position: { x: -0.75, z: 5.75 }, facing: { x: -0.75, z: 4.25 } },
    { id: 'venue-exit', zoneId: 'bar', kind: 'exit', position: { x: 0.75, z: 5.75 }, facing: { x: 0.75, z: 6.25 } },
    ...barGuestSlots,
    { id: 'bar-service-1', zoneId: 'bar', kind: 'bar_service', position: { x: -2.25, z: -2.75 } },
    { id: 'bar-service-2', zoneId: 'bar', kind: 'bar_service', position: { x: 0.25, z: -2.75 } },
    { id: 'bar-service-3', zoneId: 'bar', kind: 'bar_service', position: { x: 2.75, z: -2.75 } },
    { id: 'bar-prep', zoneId: 'bar', kind: 'bar_prep', position: { x: 4.25, z: -5.75 } },
    { id: 'karaoke-guest-1', zoneId: 'karaoke', roomId: 'karaoke', kind: 'room_guest', position: { x: -12.75, z: 2.25 } },
    { id: 'karaoke-guest-2', zoneId: 'karaoke', roomId: 'karaoke', kind: 'room_guest', position: { x: -14.75, z: 2.25 } },
    { id: 'karaoke-guest-3', zoneId: 'karaoke', roomId: 'karaoke', kind: 'room_guest', position: { x: -16.75, z: 2.25 } },
    { id: 'karaoke-guest-4', zoneId: 'karaoke', roomId: 'karaoke', kind: 'room_guest', position: { x: -18.75, z: 2.25 } },
    { id: 'karaoke-staff', zoneId: 'karaoke', roomId: 'karaoke', kind: 'room_staff', position: { x: -10.75, z: 2.25 } },
    { id: 'sauna-guest-1', zoneId: 'sauna', roomId: 'sauna', kind: 'room_guest', position: { x: 11.25, z: -2.25 } },
    { id: 'sauna-guest-2', zoneId: 'sauna', roomId: 'sauna', kind: 'room_guest', position: { x: 13.75, z: -2.25 } },
    { id: 'sauna-guest-3', zoneId: 'sauna', roomId: 'sauna', kind: 'room_guest', position: { x: 16.25, z: -2.25 } },
    { id: 'sauna-guest-4', zoneId: 'sauna', roomId: 'sauna', kind: 'room_guest', position: { x: 18.75, z: -2.25 } },
    { id: 'sauna-staff', zoneId: 'sauna', roomId: 'sauna', kind: 'room_staff', position: { x: 19.25, z: 2.25 } },
    { id: 'massage-guest-1', zoneId: 'massage', roomId: 'massage', kind: 'room_guest', position: { x: -2.25, z: -10.25 } },
    { id: 'massage-guest-2', zoneId: 'massage', roomId: 'massage', kind: 'room_guest', position: { x: 2.25, z: -10.25 } },
    { id: 'massage-staff', zoneId: 'massage', roomId: 'massage', kind: 'room_staff', position: { x: 4.25, z: -9.25 } },
  ],
};

const containsPoint = (footprint: RectFootprint, point: Vec2) => {
  const halfX = footprint.size.x / 2;
  const halfZ = footprint.size.z / 2;
  return point.x >= footprint.center.x - halfX
    && point.x <= footprint.center.x + halfX
    && point.z >= footprint.center.z - halfZ
    && point.z <= footprint.center.z + halfZ;
};

const positiveAreaOverlap = (a: RectFootprint, b: RectFootprint) => {
  const overlapX = Math.min(a.center.x + a.size.x / 2, b.center.x + b.size.x / 2)
    - Math.max(a.center.x - a.size.x / 2, b.center.x - b.size.x / 2);
  const overlapZ = Math.min(a.center.z + a.size.z / 2, b.center.z + b.size.z / 2)
    - Math.max(a.center.z - a.size.z / 2, b.center.z - b.size.z / 2);
  return overlapX > 1e-6 && overlapZ > 1e-6;
};

const pointInsideObstacle = (point: Vec2, obstacle: VenueBlueprint['obstacles'][number]) => {
  if (obstacle.kind === 'circle') {
    return Math.hypot(point.x - obstacle.center.x, point.z - obstacle.center.z) < obstacle.radius;
  }
  return Math.abs(point.x - obstacle.center.x) < obstacle.size.x / 2
    && Math.abs(point.z - obstacle.center.z) < obstacle.size.z / 2;
};

export const worldToCell = (venue: VenueBlueprint, point: Vec2): GridCell | null => {
  const { grid } = venue;
  if (point.x < grid.minX || point.x >= grid.maxX || point.z < grid.minZ || point.z >= grid.maxZ) return null;
  return {
    x: Math.floor((point.x - grid.minX) / grid.cellSize),
    z: Math.floor((point.z - grid.minZ) / grid.cellSize),
  };
};

export const cellToWorld = (venue: VenueBlueprint, cell: GridCell): Vec2 => ({
  x: venue.grid.minX + (cell.x + 0.5) * venue.grid.cellSize,
  z: venue.grid.minZ + (cell.z + 0.5) * venue.grid.cellSize,
});

export const getGridDimensions = (venue: VenueBlueprint) => ({
  width: Math.round((venue.grid.maxX - venue.grid.minX) / venue.grid.cellSize),
  height: Math.round((venue.grid.maxZ - venue.grid.minZ) / venue.grid.cellSize),
});

export const getSlot = (venue: VenueBlueprint, slotId: string): InteractionSlot => {
  const slot = venue.slots.find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error(`Unknown venue slot: ${slotId}`);
  return slot;
};

export const getSlotsByKind = (venue: VenueBlueprint, kind: InteractionSlot['kind']) =>
  venue.slots.filter((slot) => slot.kind === kind);

export const validateVenueBlueprint = (venue: VenueBlueprint): readonly VenueValidationIssue[] => {
  const issues: VenueValidationIssue[] = [];
  const dimensions = getGridDimensions(venue);
  if (venue.grid.cellSize !== 0.5) issues.push({ code: 'grid.cell_size', message: 'Amber Club v2 requires a 0.5 m grid.' });
  if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height)) {
    issues.push({ code: 'grid.dimensions', message: 'Grid bounds must be exact multiples of the cell size.' });
  }

  const ids = new Set<string>();
  for (const source of [...venue.zones, ...venue.obstacles, ...venue.portals, ...venue.slots]) {
    if (ids.has(source.id)) issues.push({ code: 'id.duplicate', message: `Duplicate venue id: ${source.id}`, sourceId: source.id });
    ids.add(source.id);
  }

  for (let index = 0; index < venue.zones.length; index += 1) {
    const zone = venue.zones[index];
    if (!containsPoint({
      center: { x: (venue.grid.minX + venue.grid.maxX) / 2, z: (venue.grid.minZ + venue.grid.maxZ) / 2 },
      size: { x: venue.grid.maxX - venue.grid.minX, z: venue.grid.maxZ - venue.grid.minZ },
    }, zone.footprint.center)) {
      issues.push({ code: 'zone.out_of_bounds', message: `Zone ${zone.id} is outside grid bounds.`, sourceId: zone.id });
    }
    for (const other of venue.zones.slice(index + 1)) {
      if (positiveAreaOverlap(zone.footprint, other.footprint)) {
        issues.push({ code: 'zone.overlap', message: `Zones ${zone.id} and ${other.id} overlap.`, sourceId: zone.id });
      }
    }
  }

  const zoneById = new Map(venue.zones.map((zone) => [zone.id, zone]));
  for (const roomId of ROOM_IDS) {
    const zone = zoneById.get(roomId);
    const expected = ROOM_BLUEPRINTS[roomId].wingSize;
    if (!zone || zone.kind !== 'room_wing' || zone.footprint.size.x !== expected.x || zone.footprint.size.z !== expected.z) {
      issues.push({ code: 'room.footprint', message: `Room ${roomId} must have a 12 x 10 m wing.`, sourceId: roomId });
    }
  }
  const validatedBar = zoneById.get('bar');
  if (!validatedBar || validatedBar.footprint.size.x !== 18 || validatedBar.footprint.size.z !== 14) {
    issues.push({ code: 'bar.footprint', message: 'Central bar must have an 18 x 14 m footprint.', sourceId: 'bar' });
  }

  for (const obstacle of venue.obstacles) {
    const zone = zoneById.get(obstacle.zoneId);
    if (!zone || !containsPoint(zone.footprint, obstacle.center)) {
      issues.push({ code: 'obstacle.zone', message: `Obstacle ${obstacle.id} is outside zone ${obstacle.zoneId}.`, sourceId: obstacle.id });
    }
  }

  for (const slot of venue.slots) {
    const zone = zoneById.get(slot.zoneId);
    if (!zone || !containsPoint(zone.footprint, slot.position)) {
      issues.push({ code: 'slot.zone', message: `Slot ${slot.id} is outside zone ${slot.zoneId}.`, sourceId: slot.id });
    }
    if (venue.obstacles.some((obstacle) => obstacle.zoneId === slot.zoneId && pointInsideObstacle(slot.position, obstacle))) {
      issues.push({ code: 'slot.obstacle', message: `Slot ${slot.id} overlaps an obstacle.`, sourceId: slot.id });
    }
    if (!worldToCell(venue, slot.position)) {
      issues.push({ code: 'slot.grid', message: `Slot ${slot.id} is outside the navigation grid.`, sourceId: slot.id });
    }
  }

  for (const portal of venue.portals) {
    const zoneA = zoneById.get(portal.zoneA);
    const zoneB = zoneById.get(portal.zoneB);
    if (!zoneA || !zoneB || !containsPoint(zoneA.footprint, portal.sideA) || !containsPoint(zoneB.footprint, portal.sideB)) {
      issues.push({ code: 'portal.zones', message: `Portal ${portal.id} does not connect its declared zones.`, sourceId: portal.id });
    }
    const sideDistance = Math.hypot(portal.sideA.x - portal.sideB.x, portal.sideA.z - portal.sideB.z);
    if (Math.abs(sideDistance - venue.grid.cellSize) > 1e-6) {
      issues.push({ code: 'portal.gap', message: `Portal ${portal.id} sides must be one cell apart.`, sourceId: portal.id });
    }
    if (portal.width < venue.grid.cellSize * 2) {
      issues.push({ code: 'portal.width', message: `Portal ${portal.id} is too narrow.`, sourceId: portal.id });
    }
  }

  return issues;
};

export const assertValidVenueBlueprint = (venue: VenueBlueprint) => {
  const issues = validateVenueBlueprint(venue);
  if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
};
