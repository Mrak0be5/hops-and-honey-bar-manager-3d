import { describe, expect, it } from 'vitest';
import {
  getRoomDefinition,
  getRoomUpgradeCost,
  getUpgradeCost,
  ROOM_DEFINITIONS,
  ROOM_UPGRADE_DEFS,
  UPGRADE_DEFS,
} from '../src/game/config';
import type { RoomUpgradeKey, UpgradeKey } from '../src/game/types';
import { getBarUpgradeEffect, getRoomUpgradeEffect } from '../src/ui/upgradeEffects';

const barDefinition = (key: UpgradeKey) => UPGRADE_DEFS.find((definition) => definition.key === key)!;

describe('numeric upgrade copy', () => {
  it('shows exact current and next values for every initial bar upgrade', () => {
    const expected = {
      moveSpeed: ['Скорость бармена', '2,15', '2,49', 'м/с'],
      orderSpeed: ['Приём заказа', '2,15', '1,78', 'с'],
      prepSpeed: ['Приготовление', '3,35', '2,75', 'с'],
      cleanSpeed: ['Уборка стола', '2,65', '2,12', 'с'],
      assortment: ['Средняя цена без чаевых', '≈12,0', '≈15,1', '🪙'],
      advertising: ['Средний приход гостя', '9,50', '8,68', 'с'],
    } satisfies Record<UpgradeKey, [string, string, string, string]>;

    for (const definition of UPGRADE_DEFS) {
      const effect = getBarUpgradeEffect(definition, 1, getUpgradeCost(definition, 1));
      expect([effect.label, effect.current, effect.next, effect.unit]).toEqual(expected[definition.key]);
      expect(effect.nextValue).not.toBeNull();
      expect(effect.nextValue).not.toBe(effect.currentValue);
      expect(effect.ariaLabel).toContain(effect.current);
      expect(effect.ariaLabel).toContain(effect.next!);
    }
  });

  it('keeps a concrete final value instead of a vague effect at every bar maximum', () => {
    for (const definition of UPGRADE_DEFS) {
      const effect = getBarUpgradeEffect(definition, definition.maxLevel, 0);
      expect(effect.current).not.toBe('');
      expect(Number.isFinite(effect.currentValue)).toBe(true);
      expect(effect.next).toBeNull();
      expect(effect.nextValue).toBeNull();
      expect(effect.detail.length).toBeGreaterThan(8);
    }
  });

  it('updates the displayed bartender speed from one level to the next', () => {
    const definition = barDefinition('moveSpeed');
    const levelOne = getBarUpgradeEffect(definition, 1, getUpgradeCost(definition, 1));
    const levelTwo = getBarUpgradeEffect(definition, 2, getUpgradeCost(definition, 2));

    expect(levelOne.current).toBe('2,15');
    expect(levelOne.next).toBe('2,49');
    expect(levelTwo.current).toBe(levelOne.next);
    expect(levelTwo.next).toBe('2,84');
  });

  it('shows numeric staff, capacity and quality outcomes in every room', () => {
    const expected = {
      karaoke: {
        staffSpeed: ['36,00', '30,60', 'с'],
        capacity: ['1', '2', 'мест'],
        quality: ['20', '23', '🪙'],
      },
      sauna: {
        staffSpeed: ['42,00', '35,70', 'с'],
        capacity: ['1', '2', 'мест'],
        quality: ['42', '48', '🪙'],
      },
      massage: {
        staffSpeed: ['45,00', '38,25', 'с'],
        capacity: ['1', '2', 'мест'],
        quality: ['70', '81', '🪙'],
      },
    } satisfies Record<string, Record<RoomUpgradeKey, [string, string, string]>>;

    for (const room of ROOM_DEFINITIONS) {
      for (const upgrade of ROOM_UPGRADE_DEFS) {
        const maxLevel = upgrade.key === 'capacity' ? room.maxCapacity : upgrade.maxLevel;
        const effect = getRoomUpgradeEffect(
          room.id,
          upgrade.key,
          1,
          maxLevel,
          1,
          1,
          getRoomUpgradeCost(room.id, upgrade.key, 1),
        );

        expect([effect.current, effect.next, effect.unit]).toEqual(expected[room.id][upgrade.key]);
        expect(effect.nextValue).not.toBeNull();
        expect(effect.nextValue).not.toBe(effect.currentValue);
        expect(effect.detail).toMatch(/→|−/);
      }
    }
  });

  it('retains an exact numeric room result at MAX for all nine upgrade cards', () => {
    for (const room of ROOM_DEFINITIONS) {
      for (const upgrade of ROOM_UPGRADE_DEFS) {
        const maxLevel = upgrade.key === 'capacity' ? room.maxCapacity : upgrade.maxLevel;
        const capacity = upgrade.key === 'capacity' ? room.maxCapacity : 1;
        const quality = upgrade.key === 'quality' ? maxLevel : 1;
        const effect = getRoomUpgradeEffect(room.id, upgrade.key, maxLevel, maxLevel, capacity, quality, 0);

        expect(effect.current).not.toBe('');
        expect(Number.isFinite(effect.currentValue)).toBe(true);
        expect(effect.next).toBeNull();
        expect(effect.nextValue).toBeNull();
      }
    }
  });

  it('uses each room definition when calculating full-session capacity income', () => {
    for (const room of ROOM_DEFINITIONS) {
      const definition = getRoomDefinition(room.id);
      const effect = getRoomUpgradeEffect(
        room.id,
        'capacity',
        1,
        definition.maxCapacity,
        1,
        1,
        getRoomUpgradeCost(room.id, 'capacity', 1),
      );
      expect(effect.detail).toContain(`${definition.baseProfit} → ${definition.baseProfit * 2}`);
    }
  });

  it('uses correct Russian wording for places at maximum quality', () => {
    for (const room of ROOM_DEFINITIONS) {
      const quality = ROOM_UPGRADE_DEFS.find((upgrade) => upgrade.key === 'quality')!;
      const effect = getRoomUpgradeEffect(
        room.id,
        'quality',
        quality.maxLevel,
        quality.maxLevel,
        room.maxCapacity,
        quality.maxLevel,
        0,
      );

      expect(effect.detail).toContain(`при ${room.maxCapacity} местах`);
      expect(effect.detail).not.toMatch(/мест\./);
      expect(effect.ariaLabel).not.toContain('..');
    }
  });
});
