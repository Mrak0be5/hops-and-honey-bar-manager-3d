import {
  cellToWorld,
  getGridDimensions,
  worldToCell,
} from '../level/venueBlueprint';
import type {
  GridCell,
  Vec2,
  VenueBlueprint,
  VenueObstacle,
  VenueZoneId,
} from '../level/types';

const CARDINAL_DIRECTIONS: readonly GridCell[] = [
  { x: -1, z: 0 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: 0, z: 1 },
];

const transitionKey = (from: GridCell, to: GridCell) => `${from.x}:${from.z}>${to.x}:${to.z}`;

const pointInZone = (point: Vec2, venue: VenueBlueprint): VenueZoneId | null => {
  for (const zone of venue.zones) {
    const halfX = zone.footprint.size.x / 2;
    const halfZ = zone.footprint.size.z / 2;
    if (
      point.x >= zone.footprint.center.x - halfX
      && point.x < zone.footprint.center.x + halfX
      && point.z >= zone.footprint.center.z - halfZ
      && point.z < zone.footprint.center.z + halfZ
    ) return zone.id;
  }
  return null;
};

const pointInObstacle = (point: Vec2, obstacle: VenueObstacle) => {
  if (obstacle.kind === 'circle') {
    return Math.hypot(point.x - obstacle.center.x, point.z - obstacle.center.z) <= obstacle.radius;
  }
  return Math.abs(point.x - obstacle.center.x) <= obstacle.size.x / 2
    && Math.abs(point.z - obstacle.center.z) <= obstacle.size.z / 2;
};

export class NavGrid {
  readonly venue: VenueBlueprint;
  readonly width: number;
  readonly height: number;
  readonly cellCount: number;
  private readonly walkable: Uint8Array;
  private readonly zoneIndexByCell: Int16Array;
  private readonly zoneIds: readonly VenueZoneId[];
  private readonly zoneIndexById: ReadonlyMap<VenueZoneId, number>;
  private readonly portalTransitions = new Set<string>();

  private constructor(venue: VenueBlueprint) {
    this.venue = venue;
    const dimensions = getGridDimensions(venue);
    this.width = dimensions.width;
    this.height = dimensions.height;
    this.cellCount = this.width * this.height;
    this.walkable = new Uint8Array(this.cellCount);
    this.zoneIndexByCell = new Int16Array(this.cellCount);
    this.zoneIndexByCell.fill(-1);
    this.zoneIds = venue.zones.map((zone) => zone.id);
    this.zoneIndexById = new Map(this.zoneIds.map((zoneId, index) => [zoneId, index]));
    this.bakeStaticCells();
    this.bakePortalTransitions();
  }

  static fromVenue(venue: VenueBlueprint) {
    return new NavGrid(venue);
  }

  isInBounds(cell: GridCell) {
    return Number.isInteger(cell.x)
      && Number.isInteger(cell.z)
      && cell.x >= 0
      && cell.x < this.width
      && cell.z >= 0
      && cell.z < this.height;
  }

  toIndex(cell: GridCell) {
    return this.isInBounds(cell) ? cell.z * this.width + cell.x : -1;
  }

  fromIndex(index: number): GridCell {
    if (!Number.isInteger(index) || index < 0 || index >= this.cellCount) throw new Error(`Invalid nav cell index: ${index}`);
    return { x: index % this.width, z: Math.floor(index / this.width) };
  }

  toCell(point: Vec2) {
    return worldToCell(this.venue, point);
  }

  toWorld(cell: GridCell) {
    if (!this.isInBounds(cell)) throw new Error(`Cell is outside the navigation grid: ${cell.x},${cell.z}`);
    return cellToWorld(this.venue, cell);
  }

  getZoneId(cell: GridCell): VenueZoneId | null {
    const index = this.toIndex(cell);
    if (index < 0) return null;
    const zoneIndex = this.zoneIndexByCell[index];
    return zoneIndex >= 0 ? this.zoneIds[zoneIndex] : null;
  }

  isCellWalkable(cell: GridCell, clearanceCells = 0) {
    const radius = Math.max(0, Math.floor(clearanceCells));
    if (!this.isBaseWalkable(cell)) return false;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.isBaseWalkable({ x: cell.x + dx, z: cell.z + dz })) return false;
      }
    }
    return true;
  }

  isPortalTransition(from: GridCell, to: GridCell, clearanceCells = 0) {
    if (!this.portalTransitions.has(transitionKey(from, to))) return false;
    const radius = Math.max(0, Math.floor(clearanceCells));
    const crossingX = from.x !== to.x;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const shiftedFrom = crossingX
        ? { x: from.x, z: from.z + offset }
        : { x: from.x + offset, z: from.z };
      const shiftedTo = crossingX
        ? { x: to.x, z: to.z + offset }
        : { x: to.x + offset, z: to.z };
      if (!this.portalTransitions.has(transitionKey(shiftedFrom, shiftedTo))) return false;
    }
    return true;
  }

  canTraverse(from: GridCell, to: GridCell, clearanceCells = 0) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if ((dx === 0 && dz === 0) || Math.abs(dx) > 1 || Math.abs(dz) > 1) return false;
    if (!this.isCellWalkable(from, clearanceCells) || !this.isCellWalkable(to, clearanceCells)) return false;

    const fromZone = this.getZoneId(from);
    const toZone = this.getZoneId(to);
    if (!fromZone || !toZone) return false;
    if (fromZone !== toZone) {
      // Rooms share an entire wall with the bar. Only explicitly baked portal
      // aperture pairs may cross that wall, and never diagonally.
      return dx === 0 || dz === 0 ? this.isPortalTransition(from, to, clearanceCells) : false;
    }

    if (dx !== 0 && dz !== 0) {
      const horizontal = { x: from.x + dx, z: from.z };
      const vertical = { x: from.x, z: from.z + dz };
      if (!this.isCellWalkable(horizontal, clearanceCells) || !this.isCellWalkable(vertical, clearanceCells)) return false;
      if (this.getZoneId(horizontal) !== fromZone || this.getZoneId(vertical) !== fromZone) return false;
    }
    return true;
  }

  neighbors(cell: GridCell, clearanceCells = 0) {
    const result: GridCell[] = [];
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        const candidate = { x: cell.x + dx, z: cell.z + dz };
        if (this.canTraverse(cell, candidate, clearanceCells)) result.push(candidate);
      }
    }
    return result;
  }

  getPortalTransitionPairs() {
    const pairs: Array<Readonly<{ from: GridCell; to: GridCell }>> = [];
    for (const key of this.portalTransitions) {
      const [fromKey, toKey] = key.split('>');
      const [fromX, fromZ] = fromKey.split(':').map(Number);
      const [toX, toZ] = toKey.split(':').map(Number);
      pairs.push({ from: { x: fromX, z: fromZ }, to: { x: toX, z: toZ } });
    }
    return pairs;
  }

  private isBaseWalkable(cell: GridCell) {
    const index = this.toIndex(cell);
    return index >= 0 && this.walkable[index] === 1;
  }

  private bakeStaticCells() {
    for (let index = 0; index < this.cellCount; index += 1) {
      const cell = this.fromIndex(index);
      const point = cellToWorld(this.venue, cell);
      const zoneId = pointInZone(point, this.venue);
      if (!zoneId) continue;
      const blocked = this.venue.obstacles.some((obstacle) => obstacle.zoneId === zoneId && pointInObstacle(point, obstacle));
      if (blocked) continue;
      this.walkable[index] = 1;
      this.zoneIndexByCell[index] = this.zoneIndexById.get(zoneId) ?? -1;
    }
  }

  private bakePortalTransitions() {
    for (let index = 0; index < this.cellCount; index += 1) {
      const from = this.fromIndex(index);
      if (!this.isBaseWalkable(from)) continue;
      const fromZone = this.getZoneId(from);
      if (!fromZone) continue;
      for (const direction of CARDINAL_DIRECTIONS) {
        const to = { x: from.x + direction.x, z: from.z + direction.z };
        if (!this.isBaseWalkable(to)) continue;
        const toZone = this.getZoneId(to);
        if (!toZone || fromZone === toZone) continue;
        const fromWorld = this.toWorld(from);
        const toWorld = this.toWorld(to);
        const midpoint = { x: (fromWorld.x + toWorld.x) / 2, z: (fromWorld.z + toWorld.z) / 2 };
        const matchingPortal = this.venue.portals.some((portal) => {
          const zonesMatch = (portal.zoneA === fromZone && portal.zoneB === toZone)
            || (portal.zoneA === toZone && portal.zoneB === fromZone);
          if (!zonesMatch) return false;
          if (portal.axis === 'x') {
            return direction.x !== 0
              && Math.abs(midpoint.x - portal.center.x) < this.venue.grid.cellSize * 0.51
              && Math.abs(midpoint.z - portal.center.z) < portal.width / 2;
          }
          return direction.z !== 0
            && Math.abs(midpoint.z - portal.center.z) < this.venue.grid.cellSize * 0.51
            && Math.abs(midpoint.x - portal.center.x) < portal.width / 2;
        });
        if (matchingPortal) this.portalTransitions.add(transitionKey(from, to));
      }
    }
  }
}
