import type { GridCell } from '../level/types';

const cellKey = (cell: GridCell) => `${cell.x}:${cell.z}`;

/**
 * Runtime occupancy for agents. Static blockers belong to NavGrid; this class
 * only owns short-lived cell claims and can therefore be cleared on reset.
 */
export class CellReservations {
  private readonly ownersByCell = new Map<string, string>();
  private readonly cellsByOwner = new Map<string, Set<string>>();

  get size() {
    return this.ownersByCell.size;
  }

  reserve(cell: GridCell, ownerId: string) {
    const key = cellKey(cell);
    const currentOwner = this.ownersByCell.get(key);
    if (currentOwner && currentOwner !== ownerId) return false;
    this.ownersByCell.set(key, ownerId);
    const owned = this.cellsByOwner.get(ownerId) ?? new Set<string>();
    owned.add(key);
    this.cellsByOwner.set(ownerId, owned);
    return true;
  }

  reserveMany(cells: readonly GridCell[], ownerId: string) {
    if (cells.some((cell) => this.isReserved(cell, ownerId))) return false;
    for (const cell of cells) this.reserve(cell, ownerId);
    return true;
  }

  release(cell: GridCell, ownerId?: string) {
    const key = cellKey(cell);
    const currentOwner = this.ownersByCell.get(key);
    if (!currentOwner || (ownerId !== undefined && currentOwner !== ownerId)) return false;
    this.ownersByCell.delete(key);
    const owned = this.cellsByOwner.get(currentOwner);
    owned?.delete(key);
    if (owned?.size === 0) this.cellsByOwner.delete(currentOwner);
    return true;
  }

  releaseOwner(ownerId: string) {
    const owned = this.cellsByOwner.get(ownerId);
    if (!owned) return;
    for (const key of owned) this.ownersByCell.delete(key);
    this.cellsByOwner.delete(ownerId);
  }

  isReserved(cell: GridCell, exceptOwnerId?: string) {
    const owner = this.ownersByCell.get(cellKey(cell));
    return owner !== undefined && owner !== exceptOwnerId;
  }

  getOwner(cell: GridCell) {
    return this.ownersByCell.get(cellKey(cell)) ?? null;
  }

  clear() {
    this.ownersByCell.clear();
    this.cellsByOwner.clear();
  }

  snapshot() {
    return [...this.ownersByCell.entries()].map(([cell, ownerId]) => ({ cell, ownerId }));
  }
}
