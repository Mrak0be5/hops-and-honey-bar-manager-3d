import type { Vec2 } from './types';

export const NAV_CELL_SIZE = 0.4;
export const NAV_BOUNDS = { minX: -7.2, maxX: 7.2, minZ: -5.4, maxZ: 5.4 } as const;

type RectObstacle = { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number };
type CircleObstacle = { kind: 'circle'; x: number; z: number; radius: number };
export type NavObstacle = RectObstacle | CircleObstacle;

const STATIC_OBSTACLES: NavObstacle[] = [
  // Bar counter. The open right-hand end is the only service gate.
  { kind: 'rect', minX: -3.65, maxX: 3.05, minZ: -4.28, maxZ: -2.88 },
  // Decorative planters in the three accessible corners.
  { kind: 'circle', x: -6.9, z: -4.9, radius: 0.68 },
  { kind: 'circle', x: 6.7, z: -4.9, radius: 0.62 },
  { kind: 'circle', x: -6.95, z: 5.05, radius: 0.58 },
];

const key = (x: number, z: number) => `${x},${z}`;
const toCell = (value: Vec2) => ({
  x: Math.round((value.x - NAV_BOUNDS.minX) / NAV_CELL_SIZE),
  z: Math.round((value.z - NAV_BOUNDS.minZ) / NAV_CELL_SIZE),
});
const toWorld = (cell: { x: number; z: number }): Vec2 => ({
  x: NAV_BOUNDS.minX + cell.x * NAV_CELL_SIZE,
  z: NAV_BOUNDS.minZ + cell.z * NAV_CELL_SIZE,
});

const insideObstacle = (point: Vec2, obstacle: NavObstacle, clearance: number) => {
  if (obstacle.kind === 'circle') {
    return Math.hypot(point.x - obstacle.x, point.z - obstacle.z) < obstacle.radius + clearance;
  }
  return point.x > obstacle.minX - clearance && point.x < obstacle.maxX + clearance
    && point.z > obstacle.minZ - clearance && point.z < obstacle.maxZ + clearance;
};

export const makeLevelObstacles = (tablePositions: Vec2[]): NavObstacle[] => [
  ...STATIC_OBSTACLES,
  ...tablePositions.map((position): CircleObstacle => ({
    kind: 'circle', x: position.x, z: position.z, radius: 0.82,
  })),
];

export const isWalkable = (
  point: Vec2,
  obstacles: NavObstacle[],
  clearance = 0.26,
  allowedEndpoints: Vec2[] = [],
) => {
  if (point.x < NAV_BOUNDS.minX || point.x > NAV_BOUNDS.maxX || point.z < NAV_BOUNDS.minZ || point.z > NAV_BOUNDS.maxZ) return false;
  if (allowedEndpoints.some((endpoint) => Math.hypot(endpoint.x - point.x, endpoint.z - point.z) <= 0.05)) return true;
  return !obstacles.some((obstacle) => insideObstacle(point, obstacle, clearance));
};

const nearestWalkableCell = (point: Vec2, obstacles: NavObstacle[], endpoints: Vec2[]) => {
  const origin = toCell(point);
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const cell = { x: origin.x + dx, z: origin.z + dz };
        if (isWalkable(toWorld(cell), obstacles, 0.26, endpoints)) return cell;
      }
    }
  }
  return origin;
};

const canTraverse = (a: { x: number; z: number }, b: { x: number; z: number }, obstacles: NavObstacle[], endpoints: Vec2[]) => {
  const destination = toWorld(b);
  if (!isWalkable(destination, obstacles, 0.26, endpoints)) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (dx !== 0 && dz !== 0) {
    // Diagonal steps may not squeeze through the corner of two blockers.
    if (!isWalkable(toWorld({ x: a.x + dx, z: a.z }), obstacles, 0.26, endpoints)) return false;
    if (!isWalkable(toWorld({ x: a.x, z: a.z + dz }), obstacles, 0.26, endpoints)) return false;
  }
  return true;
};

export const findGridPath = (start: Vec2, goal: Vec2, obstacles: NavObstacle[]): Vec2[] => {
  const endpoints = [start, goal];
  const startCell = nearestWalkableCell(start, obstacles, endpoints);
  const goalCell = nearestWalkableCell(goal, obstacles, endpoints);
  const open = new Set([key(startCell.x, startCell.z)]);
  const cells = new Map([[key(startCell.x, startCell.z), startCell]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map([[key(startCell.x, startCell.z), 0]]);
  const fScore = new Map([[key(startCell.x, startCell.z), Math.hypot(goalCell.x - startCell.x, goalCell.z - startCell.z)]]);
  const directions = [-1, 0, 1].flatMap((z) => [-1, 0, 1].map((x) => ({ x, z }))).filter(({ x, z }) => x !== 0 || z !== 0);

  while (open.size > 0) {
    let currentKey = [...open][0];
    for (const candidate of open) if ((fScore.get(candidate) ?? Infinity) < (fScore.get(currentKey) ?? Infinity)) currentKey = candidate;
    const current = cells.get(currentKey)!;
    if (current.x === goalCell.x && current.z === goalCell.z) {
      const route = [currentKey];
      while (cameFrom.has(route[route.length - 1])) route.push(cameFrom.get(route[route.length - 1])!);
      route.reverse();
      const points = route.slice(1).map((cellKey) => toWorld(cells.get(cellKey)!));
      if (points.length === 0 || Math.hypot(points[points.length - 1].x - goal.x, points[points.length - 1].z - goal.z) > 0.01) points.push({ ...goal });
      else points[points.length - 1] = { ...goal };
      return points;
    }

    open.delete(currentKey);
    for (const direction of directions) {
      const neighbor = { x: current.x + direction.x, z: current.z + direction.z };
      if (!canTraverse(current, neighbor, obstacles, endpoints)) continue;
      const neighborKey = key(neighbor.x, neighbor.z);
      cells.set(neighborKey, neighbor);
      const tentative = (gScore.get(currentKey) ?? Infinity) + (direction.x !== 0 && direction.z !== 0 ? Math.SQRT2 : 1);
      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + Math.hypot(goalCell.x - neighbor.x, goalCell.z - neighbor.z));
      open.add(neighborKey);
    }
  }
  return [];
};
