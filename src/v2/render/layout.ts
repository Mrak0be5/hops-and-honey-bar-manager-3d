import type { RoomVenueId, VenueId, ViewPoint } from '../view/model';
import { AMBER_CLUB_VENUE, getSlotsByKind } from '../level/venueBlueprint';

export type AmberRoomLayout = {
  id: VenueId;
  center: ViewPoint;
  size: ViewPoint;
  cameraTarget: ViewPoint;
  door: ViewPoint;
};

const getZone = (venueId: VenueId) => {
  const zone = AMBER_CLUB_VENUE.zones.find((candidate) => candidate.id === venueId);
  if (!zone) throw new Error(`VenueBlueprint is missing visual zone ${venueId}.`);
  return zone;
};

const getDoor = (venueId: VenueId): ViewPoint => {
  if (venueId === 'bar') {
    const entrance = getSlotsByKind(AMBER_CLUB_VENUE, 'entrance')[0];
    if (!entrance) throw new Error('VenueBlueprint is missing an entrance slot.');
    return { ...entrance.position };
  }
  const portal = AMBER_CLUB_VENUE.portals.find((candidate) => candidate.zoneA === venueId || candidate.zoneB === venueId);
  if (!portal) throw new Error(`VenueBlueprint is missing portal for ${venueId}.`);
  return { ...portal.center };
};

const makeLayout = (venueId: VenueId): AmberRoomLayout => {
  const zone = getZone(venueId);
  const center = { ...zone.footprint.center };
  const focusDepth = venueId === 'bar' ? -0.8 : venueId === 'massage' ? -0.1 : -0.4;
  return {
    id: venueId,
    center,
    size: { ...zone.footprint.size },
    cameraTarget: { x: center.x, z: center.z + focusDepth },
    door: getDoor(venueId),
  };
};

export const AMBER_LAYOUT: Record<VenueId, AmberRoomLayout> = {
  bar: makeLayout('bar'),
  karaoke: makeLayout('karaoke'),
  sauna: makeLayout('sauna'),
  massage: makeLayout('massage'),
};

export const ROOM_ORDER: RoomVenueId[] = ['karaoke', 'sauna', 'massage'];

export const getVenueCenter = (venueId: VenueId) => ({ ...AMBER_LAYOUT[venueId].center });

export type CameraFrame = {
  lookAt: [number, number, number];
  position: [number, number, number];
  zoom: number;
};

export const getCameraFrame = (
  venueId: VenueId,
  width: number,
  height: number,
  drawerOpen: boolean,
): CameraFrame => {
  const target = AMBER_LAYOUT[venueId].cameraTarget;
  const portrait = height > width * 1.1;
  const roomFocused = venueId !== 'bar';
  const drawerOffset = drawerOpen && !portrait ? -1.8 : drawerOpen ? 2.2 : 0;
  const lookX = target.x + drawerOffset;
  const lookZ = target.z + drawerOffset * 0.35;
  const distanceScale = portrait ? 1.16 : 1;
  const offsetX = 23 * distanceScale;
  const offsetZ = 26 * distanceScale;

  return {
    lookAt: [lookX, 0.25, lookZ],
    position: [lookX + offsetX, roomFocused ? 22 : 25, lookZ + offsetZ],
    zoom: portrait
      ? (roomFocused ? 34 : 25)
      : width < 900
        ? (roomFocused ? 40 : 31)
        : roomFocused ? 52 : 42,
  };
};
