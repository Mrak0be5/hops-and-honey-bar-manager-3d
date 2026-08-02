import { describe, expect, it } from 'vitest';
import { loadOrMigrateProgress, migrateLegacyProgress, parseProgressV2, type SaveStorage } from '../../src/v2/save/migrateV1';
import { LEGACY_BACKUP_KEY, LEGACY_SAVE_KEY, V2_SAVE_KEY, makeDefaultProgressV2 } from '../../src/v2/save/schema';

class MemoryStorage implements SaveStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('v1 save migration', () => {
  it('preserves progress and maps an unlocked room to a fully repaired staffed room', () => {
    const legacy = JSON.stringify({
      coins: 812.8,
      reputation: 27,
      served: 104,
      day: 12,
      soundEnabled: false,
      upgrades: { moveSpeed: 4, assortment: 3 },
      rooms: {
        karaoke: {
          unlocked: true,
          completedSessions: 17,
          revenue: 730,
          upgrades: { staffSpeed: 3, capacity: 3, quality: 4 },
        },
      },
    });

    const migrated = migrateLegacyProgress(legacy)!;

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.coins).toBe(812);
    expect(migrated.prestige).toBe(27);
    expect(migrated.rooms.karaoke.lifecycle).toBe('open');
    expect(migrated.rooms.karaoke.renovationStage).toBe(3);
    expect(migrated.rooms.karaoke.staff).toEqual({ hired: true, level: 3 });
    expect(migrated.rooms.karaoke.upgrades.quality).toBe(4);
    expect(migrated.rooms.sauna.lifecycle).toBe('locked');
    expect(migrated.migratedFromV1).toBe(true);
  });

  it('backs up v1, writes v2 and never deletes the legacy payload', () => {
    const storage = new MemoryStorage();
    const legacy = JSON.stringify({ coins: 240, reputation: 8 });
    storage.values.set(LEGACY_SAVE_KEY, legacy);

    const result = loadOrMigrateProgress(storage);

    expect(result.source).toBe('v1');
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(legacy);
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(legacy);
    expect(parseProgressV2(storage.getItem(V2_SAVE_KEY)!)).toEqual(result.progress);
  });

  it('is idempotent once a valid v2 save exists', () => {
    const storage = new MemoryStorage();
    const existing = makeDefaultProgressV2();
    existing.coins = 9_999;
    storage.values.set(V2_SAVE_KEY, JSON.stringify(existing));
    storage.values.set(LEGACY_SAVE_KEY, JSON.stringify({ coins: 1 }));

    const result = loadOrMigrateProgress(storage);

    expect(result.source).toBe('v2');
    expect(result.progress.coins).toBe(9_999);
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBeNull();
  });

  it('preserves invalid saves and falls back safely', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_SAVE_KEY, '{broken-json');

    const result = loadOrMigrateProgress(storage);

    expect(result.source).toBe('default');
    expect(result.warnings).toContain('The legacy save is invalid; it was preserved and ignored.');
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe('{broken-json');
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe('{broken-json');
  });

  it('clamps unsafe numeric values during migration', () => {
    const migrated = migrateLegacyProgress(JSON.stringify({
      coins: -20,
      reputation: Number.POSITIVE_INFINITY,
      day: 0,
      rooms: { massage: { unlocked: true, upgrades: { capacity: 99, quality: -3 } } },
    }))!;

    expect(migrated.coins).toBe(64);
    expect(migrated.prestige).toBe(3);
    expect(migrated.day).toBe(1);
    expect(migrated.rooms.massage.upgrades.capacity).toBe(2);
    expect(migrated.rooms.massage.upgrades.quality).toBe(1);
  });
});
