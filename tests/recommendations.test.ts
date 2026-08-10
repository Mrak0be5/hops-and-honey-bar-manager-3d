import { describe, expect, it } from 'vitest';
import type { GameSnapshot, RoomState } from '../src/game/types';
import { getBarUpgradeRecommendation, getRoomUpgradeGuidance } from '../src/ui/recommendations';

const snapshotWith = (overrides: Partial<GameSnapshot['barDiagnostics']>): GameSnapshot => ({
  upgrades: { moveSpeed: 1, orderSpeed: 1, prepSpeed: 1, cleanSpeed: 1, assortment: 1, advertising: 1 },
  barDiagnostics: {
    waitingOrders: 0,
    waitingDrinks: 0,
    waitingPayments: 0,
    occupiedTables: 2,
    dirtyTables: 0,
    openTables: 2,
    blockedArrivals: 0,
    primaryBottleneck: 'none',
    ...overrides,
  },
} as GameSnapshot);

const roomWith = (overrides: Partial<RoomState>): RoomState => ({
  id: 'karaoke',
  unlocked: true,
  awaitingFirstGuest: false,
  staffState: 'waiting',
  guests: 0,
  capacity: 2,
  progress: 0,
  completedSessions: 4,
  revenue: 80,
  perGuestProfit: 20,
  maxSessionProfit: 40,
  recentSessions: [
    { guests: 1, capacity: 2, revenue: 20 },
    { guests: 1, capacity: 2, revenue: 20 },
    { guests: 1, capacity: 2, revenue: 20 },
  ],
  recentUtilization: 0.5,
  realizedRevenuePerSession: 20,
  recentAverageRevenuePerSession: 20,
  upgrades: { staffSpeed: 1, capacity: 2, quality: 1 },
  ...overrides,
});

describe('upgrade recommendations', () => {
  it('prioritizes an observed drink queue over generic income upgrades', () => {
    expect(getBarUpgradeRecommendation(snapshotWith({ waitingDrinks: 3, primaryBottleneck: 'drinks' }))?.key).toBe('prepSpeed');
  });

  it('recommends advertising only when the bar has room for more guests', () => {
    expect(getBarUpgradeRecommendation(snapshotWith({ openTables: 3 }))?.key).toBe('advertising');
  });

  it('warns against capacity and recommends quality in an underfilled room', () => {
    const guidance = getRoomUpgradeGuidance(roomWith({}));
    expect(guidance.recommendation?.key).toBe('quality');
    expect(guidance.capacityWarning).toContain('50%');
  });

  it('recommends capacity when recent sessions are almost full', () => {
    const guidance = getRoomUpgradeGuidance(roomWith({ recentUtilization: 0.9 }));
    expect(guidance.recommendation?.key).toBe('capacity');
    expect(guidance.capacityWarning).toBeNull();
  });
});
