import type { GridCell } from '../level/types';
import { BinaryMinHeap } from './BinaryMinHeap';
import type { CellReservations } from './CellReservations';
import type { NavGrid } from './NavGrid';

export type FindPathOptions = Readonly<{
  clearanceCells?: number;
  reservations?: CellReservations;
  reservationOwnerId?: string;
  allowGoalReserved?: boolean;
  maxVisited?: number;
}>;

export type PathResult = Readonly<{
  cells: readonly GridCell[];
  cost: number;
  visited: number;
}>;

const octileDistance = (a: GridCell, b: GridCell) => {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
};

const movementCost = (a: GridCell, b: GridCell) => a.x !== b.x && a.z !== b.z ? Math.SQRT2 : 1;

export const findPath = (
  grid: NavGrid,
  start: GridCell,
  goal: GridCell,
  options: FindPathOptions = {},
): PathResult | null => {
  const clearanceCells = Math.max(0, Math.floor(options.clearanceCells ?? 0));
  if (!grid.isCellWalkable(start, clearanceCells) || !grid.isCellWalkable(goal, clearanceCells)) return null;
  const startIndex = grid.toIndex(start);
  const goalIndex = grid.toIndex(goal);
  if (startIndex < 0 || goalIndex < 0) return null;
  if (startIndex === goalIndex) return { cells: [{ ...start }], cost: 0, visited: 1 };

  const gScore = new Float64Array(grid.cellCount);
  gScore.fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(grid.cellCount);
  cameFrom.fill(-1);
  const closed = new Uint8Array(grid.cellCount);
  const open = new BinaryMinHeap<number>();
  gScore[startIndex] = 0;
  open.push(startIndex, octileDistance(start, goal));
  let visited = 0;
  const maxVisited = Math.max(1, Math.floor(options.maxVisited ?? grid.cellCount));

  while (open.size > 0 && visited < maxVisited) {
    const currentIndex = open.pop()!;
    if (closed[currentIndex]) continue;
    closed[currentIndex] = 1;
    visited += 1;
    if (currentIndex === goalIndex) {
      const indices = [currentIndex];
      let cursor = currentIndex;
      while (cursor !== startIndex) {
        cursor = cameFrom[cursor];
        if (cursor < 0) return null;
        indices.push(cursor);
      }
      indices.reverse();
      return {
        cells: indices.map((index) => grid.fromIndex(index)),
        cost: gScore[currentIndex],
        visited,
      };
    }

    const current = grid.fromIndex(currentIndex);
    for (const neighbor of grid.neighbors(current, clearanceCells)) {
      const neighborIndex = grid.toIndex(neighbor);
      if (closed[neighborIndex]) continue;
      const goalException = options.allowGoalReserved === true && neighborIndex === goalIndex;
      if (!goalException && options.reservations?.isReserved(neighbor, options.reservationOwnerId)) continue;
      const tentative = gScore[currentIndex] + movementCost(current, neighbor);
      if (tentative >= gScore[neighborIndex]) continue;
      cameFrom[neighborIndex] = currentIndex;
      gScore[neighborIndex] = tentative;
      open.push(neighborIndex, tentative + octileDistance(neighbor, goal));
    }
  }

  return null;
};
