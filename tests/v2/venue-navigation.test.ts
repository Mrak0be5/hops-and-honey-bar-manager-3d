import { describe, expect, it } from 'vitest';
import { ROOM_BLUEPRINTS, ROOM_IDS } from '../../src/v2/content/rooms';
import {
  AMBER_CLUB_VENUE,
  getGridDimensions,
  getSlot,
  validateVenueBlueprint,
  worldToCell,
} from '../../src/v2/level/venueBlueprint';
import type { GridCell } from '../../src/v2/level/types';
import { CellReservations } from '../../src/v2/navigation/CellReservations';
import { NavGrid } from '../../src/v2/navigation/NavGrid';
import { findPath } from '../../src/v2/navigation/findPath';

const getCellForSlot = (slotId: string) => {
  const slot = getSlot(AMBER_CLUB_VENUE, slotId);
  const cell = worldToCell(AMBER_CLUB_VENUE, slot.position);
  if (!cell) throw new Error(`Slot ${slotId} is outside the grid.`);
  return cell;
};

const expectValidPath = (grid: NavGrid, cells: readonly GridCell[], clearanceCells = 1) => {
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells) expect(grid.isCellWalkable(cell, clearanceCells)).toBe(true);
  for (let index = 1; index < cells.length; index += 1) {
    expect(grid.canTraverse(cells[index - 1], cells[index], clearanceCells)).toBe(true);
  }
};

const cellKey = (cell: GridCell) => `${cell.x}:${cell.z}`;

describe('Amber Club v2 venue blueprint', () => {
  it('defines the requested 18 x 14 bar, three 12 x 10 wings and a 0.5 m grid', () => {
    expect(validateVenueBlueprint(AMBER_CLUB_VENUE)).toEqual([]);
    expect(AMBER_CLUB_VENUE.grid.cellSize).toBe(0.5);
    expect(getGridDimensions(AMBER_CLUB_VENUE)).toEqual({ width: 84, height: 48 });
    const bar = AMBER_CLUB_VENUE.zones.find((zone) => zone.id === 'bar');
    expect(bar?.footprint.size).toEqual({ x: 18, z: 14 });
    for (const roomId of ROOM_IDS) {
      const roomZone = AMBER_CLUB_VENUE.zones.find((zone) => zone.id === roomId);
      expect(roomZone?.footprint.size).toEqual({ x: 12, z: 10 });
      expect(ROOM_BLUEPRINTS[roomId].wingSize).toEqual({ x: 12, z: 10 });
      expect(ROOM_BLUEPRINTS[roomId].upgrades.map((upgrade) => upgrade.id)).toEqual([
        'staffSpeed',
        'capacity',
        'quality',
      ]);
    }
  });
});

describe('Amber Club v2 navigation', () => {
  const grid = NavGrid.fromVenue(AMBER_CLUB_VENUE);

  it('connects every guest-facing interaction slot with clearance-safe paths', () => {
    const slotIds = [
      'venue-entrance',
      'venue-exit',
      'bar-guest-1',
      'bar-guest-2',
      'bar-guest-3',
      'karaoke-guest-1',
      'karaoke-guest-2',
      'karaoke-guest-3',
      'karaoke-guest-4',
      'sauna-guest-1',
      'sauna-guest-2',
      'sauna-guest-3',
      'sauna-guest-4',
      'massage-guest-1',
      'massage-guest-2',
    ];
    const cells = slotIds.map(getCellForSlot);
    for (let startIndex = 0; startIndex < cells.length; startIndex += 1) {
      // Property-like coverage: deterministic ring offsets cover every slot as
      // start and several destinations without relying on one hand-picked path.
      for (const offset of [1, 3, 7]) {
        const goalIndex = (startIndex + offset) % cells.length;
        const result = findPath(grid, cells[startIndex], cells[goalIndex], { clearanceCells: 1 });
        expect(result, `${slotIds[startIndex]} -> ${slotIds[goalIndex]}`).not.toBeNull();
        expectValidPath(grid, result!.cells);
      }
    }
  });

  it('allows every inter-zone transition only through a declared portal aperture', () => {
    const bakedPairs = grid.getPortalTransitionPairs();
    // Each 2 m aperture owns four 0.5 m crossing rows in both directions.
    expect(bakedPairs).toHaveLength(24);

    for (let z = 0; z < grid.height; z += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const from = { x, z };
        const fromZone = grid.getZoneId(from);
        if (!fromZone) continue;
        for (const direction of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
          const to = { x: x + direction.x, z: z + direction.z };
          const toZone = grid.getZoneId(to);
          if (!toZone || fromZone === toZone) continue;
          expect(grid.canTraverse(from, to, 0)).toBe(grid.isPortalTransition(from, to, 0));
          expect(grid.canTraverse(to, from, 0)).toBe(grid.isPortalTransition(to, from, 0));
        }
      }
    }

    for (const roomSlotId of ['karaoke-guest-1', 'sauna-guest-1', 'massage-guest-1']) {
      const result = findPath(grid, getCellForSlot('bar-guest-1'), getCellForSlot(roomSlotId), { clearanceCells: 1 });
      expect(result).not.toBeNull();
      const crossZoneSteps = result!.cells.slice(1).filter((cell, index) => (
        grid.getZoneId(cell) !== grid.getZoneId(result!.cells[index])
      ));
      expect(crossZoneSteps).toHaveLength(1);
      const crossingIndex = result!.cells.findIndex((cell, index) => (
        index > 0 && grid.getZoneId(cell) !== grid.getZoneId(result!.cells[index - 1])
      ));
      expect(grid.isPortalTransition(result!.cells[crossingIndex - 1], result!.cells[crossingIndex], 1)).toBe(true);
    }
  });

  it('routes around static obstacles without diagonal corner cutting', () => {
    const start = getCellForSlot('venue-entrance');
    const goal = getCellForSlot('karaoke-guest-2');
    const result = findPath(grid, start, goal, { clearanceCells: 1 });
    expect(result).not.toBeNull();
    expectValidPath(grid, result!.cells);

    const counterCenter = worldToCell(AMBER_CLUB_VENUE, { x: 0, z: -4.85 })!;
    expect(grid.isCellWalkable(counterCenter)).toBe(false);
    expect(result!.cells).not.toContainEqual(counterCenter);
    for (let index = 1; index < result!.cells.length; index += 1) {
      const from = result!.cells[index - 1];
      const to = result!.cells[index];
      if (from.x === to.x || from.z === to.z) continue;
      expect(grid.isCellWalkable({ x: to.x, z: from.z }, 1)).toBe(true);
      expect(grid.isCellWalkable({ x: from.x, z: to.z }, 1)).toBe(true);
    }
  });

  it('honors dynamic reservations and finds an alternate route', () => {
    const start = getCellForSlot('venue-entrance');
    const goal = getCellForSlot('bar-guest-1');
    const baseline = findPath(grid, start, goal, { clearanceCells: 1 });
    expect(baseline).not.toBeNull();
    const blockedCell = baseline!.cells[Math.floor(baseline!.cells.length / 2)];
    const reservations = new CellReservations();
    expect(reservations.reserve(blockedCell, 'other-guest')).toBe(true);
    const rerouted = findPath(grid, start, goal, { clearanceCells: 1, reservations });
    expect(rerouted).not.toBeNull();
    expect(rerouted!.cells).not.toContainEqual(blockedCell);
    expectValidPath(grid, rerouted!.cells);
  });

  it('keeps the entire clearance-safe floor connected across 512 deterministic route samples', () => {
    const start = getCellForSlot('venue-entrance');
    const queue: GridCell[] = [start];
    const reachable = new Map([[cellKey(start), start]]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const neighbor of grid.neighbors(queue[cursor], 1)) {
        const key = cellKey(neighbor);
        if (reachable.has(key)) continue;
        reachable.set(key, neighbor);
        queue.push(neighbor);
      }
    }

    const clearanceSafeCells: GridCell[] = [];
    for (let index = 0; index < grid.cellCount; index += 1) {
      const cell = grid.fromIndex(index);
      if (grid.isCellWalkable(cell, 1)) clearanceSafeCells.push(cell);
    }
    expect(reachable.size).toBe(clearanceSafeCells.length);

    let randomState = 0x6d2b79f5;
    const nextIndex = () => {
      randomState = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
      randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), randomState | 61);
      return ((randomState ^ (randomState >>> 14)) >>> 0) % clearanceSafeCells.length;
    };
    for (let sample = 0; sample < 512; sample += 1) {
      const from = clearanceSafeCells[nextIndex()];
      const to = clearanceSafeCells[nextIndex()];
      const result = findPath(grid, from, to, { clearanceCells: 1 });
      expect(result, `${cellKey(from)} -> ${cellKey(to)}`).not.toBeNull();
      expectValidPath(grid, result!.cells);
    }
  });
});
