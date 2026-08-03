import type { RoomId } from '../content/rooms';

export type Vec2 = Readonly<{ x: number; z: number }>;
export type GridCell = Readonly<{ x: number; z: number }>;

export type GridSpec = Readonly<{
  cellSize: 0.5;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

export type RectFootprint = Readonly<{
  center: Vec2;
  size: Vec2;
}>;

export type VenueZoneId = 'bar' | RoomId;

export type VenueZoneBlueprint = Readonly<{
  id: VenueZoneId;
  kind: 'central_bar' | 'room_wing';
  roomId?: RoomId;
  footprint: RectFootprint;
}>;

export type RectObstacle = Readonly<{
  id: string;
  kind: 'rect';
  zoneId: VenueZoneId;
  center: Vec2;
  size: Vec2;
}>;

export type CircleObstacle = Readonly<{
  id: string;
  kind: 'circle';
  zoneId: VenueZoneId;
  center: Vec2;
  radius: number;
}>;

export type VenueObstacle = RectObstacle | CircleObstacle;

export type PortalBlueprint = Readonly<{
  id: string;
  zoneA: VenueZoneId;
  zoneB: VenueZoneId;
  axis: 'x' | 'z';
  center: Vec2;
  width: number;
  sideA: Vec2;
  sideB: Vec2;
}>;

export type InteractionSlotKind =
  | 'entrance'
  | 'exit'
  | 'bar_guest'
  | 'bar_service'
  | 'bar_prep'
  | 'room_guest'
  | 'room_staff';

export type InteractionSlot = Readonly<{
  id: string;
  zoneId: VenueZoneId;
  roomId?: RoomId;
  kind: InteractionSlotKind;
  position: Vec2;
  facing?: Vec2;
}>;

export type VenueBlueprint = Readonly<{
  id: string;
  displayName: string;
  units: 'meters';
  grid: GridSpec;
  zones: readonly VenueZoneBlueprint[];
  obstacles: readonly VenueObstacle[];
  portals: readonly PortalBlueprint[];
  slots: readonly InteractionSlot[];
}>;

export type VenueValidationIssue = Readonly<{
  code: string;
  message: string;
  sourceId?: string;
}>;
