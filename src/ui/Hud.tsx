import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  getRoomCapacity,
  getRoomCapacityMaxLevel,
  getRoomDefinition,
  getRoomProfit,
  getRoomUpgradeCost,
  getStaffDefinition,
  getUpgradeCost,
  ROOM_DEFINITIONS,
  ROOM_UPGRADE_DEFS,
  STAFF_DEFINITIONS,
  UPGRADE_DEFS,
} from '../game/config';
import type { GameEngine } from '../game/GameEngine';
import { gameAudio } from '../game/audio';
import type {
  BartenderState,
  GameSnapshot,
  RoomId,
  RoomState,
  RoomUpgradeKey,
  StaffCharacterId,
  UpgradeDefinition,
  VenueId,
  VenueView,
} from '../game/types';
import { Icon } from './Icon';

export type SheetMode = null | 'manage' | 'staff';

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
  venueView: VenueView;
  onVenueView: (view: VenueView) => void;
  sheetMode: SheetMode;
  onSheetMode: (mode: SheetMode) => void;
};

const ROOM_UPGRADE_COPY: Record<RoomId, Record<RoomUpgradeKey, { name: string; description: string; icon: string }>> = {
  strip: {
    staffSpeed: { name: 'Темп шоу', description: 'Быстрее крутятся у шеста и меняют номера.', icon: '⚡' },
    capacity: { name: 'Лишний стул у сцены', description: 'Ещё один гость смотрит стриптиз.', icon: '💺' },
    quality: { name: 'Свет и музыка', description: 'Шоу ярче — средний чек выше.', icon: '💡' },
  },
  sex: {
    staffSpeed: { name: 'Ловкость', description: 'Быстрее заканчивает приватный сеанс.', icon: '⚡' },
    capacity: { name: 'Ещё одна кушетка', description: 'Добавляет место в очереди.', icon: '🛏️' },
    quality: { name: 'Бельё и ароматы', description: 'Премиум-секс повышает цену.', icon: '✨' },
  },
  gangbang: {
    staffSpeed: { name: 'Темп сцены', description: 'Оргия проходит быстрее и жарче.', icon: '⚡' },
    capacity: { name: 'Больше мест на платформе', description: 'Ещё один участник гангбенга.', icon: '👥' },
    quality: { name: 'Сцена и камеры', description: 'Порно-атмосфера — выше оплата.', icon: '🎬' },
  },
};

const ROOM_STAFF_LABELS = {
  locked: 'Помещение закрыто',
  waiting: 'Готова принимать',
  welcoming: 'Зазывает гостей',
  serving: 'В деле',
  resetting: 'Наводит порядок',
  needsStaff: 'Нужен персонал',
} as const;

function roomWorkerIds(snapshot: GameSnapshot, roomId: RoomId): StaffCharacterId[] {
  return snapshot.venueSlots[roomId].filter((id): id is StaffCharacterId => id !== null);
}

function roomArrivedCount(snapshot: GameSnapshot, roomId: RoomId): number {
  return snapshot.patrons.filter((patron) => patron.roomId === roomId
    && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room')).length;
}

function roomStatusLabel(snapshot: GameSnapshot, room: RoomState): string {
  if (room.staffState === 'locked' || !room.unlocked) return ROOM_STAFF_LABELS.locked;
  if (roomWorkerIds(snapshot, room.id).length === 0) return ROOM_STAFF_LABELS.needsStaff;
  if (room.staffState === 'waiting' || room.staffState === 'welcoming' || room.staffState === 'serving' || room.staffState === 'resetting') {
    return ROOM_STAFF_LABELS[room.staffState];
  }
  return ROOM_STAFF_LABELS.waiting;
}

const BARTENDER_STATUS: Record<BartenderState, { emoji: string; label: string }> = {
  idle: { emoji: '👀', label: 'Смотрит за залом' },
  to_order: { emoji: '🏃', label: 'Идёт за заказом' },
  taking_order: { emoji: '📝', label: 'Принимает заказ' },
  to_bar: { emoji: '🏃', label: 'Спешит к стойке' },
  preparing: { emoji: '🍸', label: 'Готовит напиток' },
  to_deliver: { emoji: '🥂', label: 'Несёт напиток' },
  delivering: { emoji: '🔥', label: 'Шоу при подаче' },
  to_payment: { emoji: '🏃', label: 'Идёт за оплатой' },
  taking_payment: { emoji: '💰', label: 'Принимает оплату' },
  to_cleanup: { emoji: '🧽', label: 'Идёт убирать' },
  cleaning: { emoji: '✨', label: 'Убирает кружки' },
  returning_dirty: { emoji: '🫧', label: 'Несёт кружки на мойку' },
};

const ROOM_UNLOCK_VERB: Record<RoomId, 'открыт' | 'открыта'> = {
  strip: 'открыт',
  sex: 'открыта',
  gangbang: 'открыт',
};

const VENUE_TITLE: Record<VenueId, string> = {
  bar: 'Бар',
  strip: 'Стрип',
  sex: 'Секс',
  gangbang: 'Оргия',
};

function findStaffAssignment(snapshot: GameSnapshot, id: StaffCharacterId): string {
  for (const venue of Object.keys(snapshot.venueSlots) as VenueId[]) {
    const slots = snapshot.venueSlots[venue];
    const slot = slots.findIndex((item) => item === id);
    if (slot >= 0) return `${VENUE_TITLE[venue]} · ${slot + 1}`;
  }
  return 'Свободна';
}

function findStaffLocation(snapshot: GameSnapshot, id: StaffCharacterId): { venue: VenueId; slotIndex: 0 | 1 } | null {
  for (const venue of Object.keys(snapshot.venueSlots) as VenueId[]) {
    const slots = snapshot.venueSlots[venue];
    const index = slots.findIndex((item) => item === id);
    if (index === 0 || index === 1) return { venue, slotIndex: index };
  }
  return null;
}

function barHasAffordableUpgrade(snapshot: GameSnapshot): boolean {
  return UPGRADE_DEFS.some((definition) => {
    const level = snapshot.upgrades[definition.key];
    if (level >= definition.maxLevel) return false;
    const cost = getUpgradeCost(definition, level);
    const balance = definition.currency === 'coins' ? snapshot.coins : snapshot.reputation;
    return balance >= cost;
  });
}

function roomHasAffordableAction(snapshot: GameSnapshot, room: RoomState): boolean {
  const definition = getRoomDefinition(room.id);
  if (!room.unlocked) return snapshot.coins >= definition.unlockCost;
  return ROOM_UPGRADE_DEFS.some((upgrade) => {
    const level = room.upgrades[upgrade.key];
    const maxLevel = upgrade.key === 'capacity' ? getRoomCapacityMaxLevel(room.id) : upgrade.maxLevel;
    if (level >= maxLevel) return false;
    return snapshot.coins >= getRoomUpgradeCost(room.id, upgrade.key, level);
  });
}

function anyManageAffordance(snapshot: GameSnapshot): boolean {
  if (barHasAffordableUpgrade(snapshot)) return true;
  return snapshot.rooms.some((room) => roomHasAffordableAction(snapshot, room));
}

function roomUpgradeProgress(room: RoomState): number {
  if (!room.unlocked) return 0;
  let current = 0;
  let total = 0;
  for (const upgrade of ROOM_UPGRADE_DEFS) {
    const maxLevel = upgrade.key === 'capacity' ? getRoomCapacityMaxLevel(room.id) : upgrade.maxLevel;
    total += maxLevel;
    current += Math.min(room.upgrades[upgrade.key], maxLevel);
  }
  return total > 0 ? current / total : 0;
}

function roomUpgradeDelta(room: RoomState, key: RoomUpgradeKey): { current: number; next: number; unit: string } | null {
  const quality = room.upgrades.quality;
  const capacity = getRoomCapacity(room.id, room.upgrades.capacity);
  if (key === 'quality') {
    const current = getRoomProfit(room.id, quality, 1);
    const next = getRoomProfit(room.id, quality + 1, 1);
    return { current, next, unit: 'за гостя' };
  }
  if (key === 'capacity') {
    const current = getRoomProfit(room.id, quality, capacity);
    const next = getRoomProfit(room.id, quality, capacity + 1);
    return { current, next, unit: 'макс. сеанс' };
  }
  return null;
}

function VenueSlotAssigner({
  venue,
  snapshot,
  engine,
  onOpenStaff,
}: {
  venue: VenueId;
  snapshot: GameSnapshot;
  engine: GameEngine;
  onOpenStaff?: () => void;
}) {
  const slots = snapshot.venueSlots[venue];
  const freeHired = snapshot.roster.filter((entry) => {
    if (!entry.hired) return false;
    return !Object.values(snapshot.venueSlots).some((pair) => pair.includes(entry.id));
  });
  const hiredCount = snapshot.roster.filter((entry) => entry.hired).length;
  const needsHire = freeHired.length === 0 && slots.some((id) => id === null);
  const bothFilled = Boolean(slots[0]) && Boolean(slots[1]);
  const secondSlotEmpty = Boolean(slots[0]) && !slots[1];
  return (
    <div className="staff-slots">
      <small className="staff-slots-label">
        Рабочие места · 2 (хватит 1)
        {bothFilled ? ' · бонус 2-го активен: скорость/доход' : secondSlotEmpty ? ' · +2-й работник = ×1.5 доход' : ''}
      </small>
      {needsHire && onOpenStaff && (
        <>
          <button
            type="button"
            className="hire-cta-button"
            onClick={() => {
              gameAudio.unlock();
              gameAudio.click();
              onOpenStaff();
            }}
          >
            {hiredCount === 0 ? '💋 Нанять в Штате' : '💋 Освободить / нанять в Штате'}
          </button>
          <small className="staff-empty-hint">
            {hiredCount === 0
              ? 'Слоты пустые: сначала найми кого-то во вкладке Штат, потом назначь сюда.'
              : 'Свободных нет — все уже заняты. Открой Штат и переставь или найми ещё.'}
          </small>
        </>
      )}
      {([0, 1] as const).map((slotIndex) => {
        const assigned = slots[slotIndex];
        const def = assigned ? getStaffDefinition(assigned) : null;
        return (
          <div key={slotIndex} className="staff-slot-row">
            <span className="staff-slot-index">Слот {slotIndex + 1}</span>
            {def ? (
              <>
                <b>{def.emoji} {def.name}</b>
                <button
                  type="button"
                  className="slot-clear"
                  onClick={() => {
                    gameAudio.unlock();
                    if (engine.assignStaff(venue, slotIndex, null)) gameAudio.click();
                  }}
                >
                  Убрать
                </button>
              </>
            ) : (
              <select
                aria-label={`Назначить на ${VENUE_TITLE[venue]} слот ${slotIndex + 1}`}
                value=""
                onChange={(event) => {
                  const id = event.target.value as StaffCharacterId;
                  if (!id) return;
                  gameAudio.unlock();
                  if (engine.assignStaff(venue, slotIndex, id)) gameAudio.click();
                }}
              >
                <option value="">— выбрать —</option>
                {freeHired.map((entry) => {
                  const staff = getStaffDefinition(entry.id);
                  return <option key={entry.id} value={entry.id}>{staff.emoji} {staff.name}</option>;
                })}
                {assigned === null && freeHired.length === 0 && <option value="" disabled>Нет свободных</option>}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaffRosterPanel({ snapshot, engine }: { snapshot: GameSnapshot; engine: GameEngine }) {
  const availableVenues: { id: VenueId; title: string }[] = [
    { id: 'bar', title: 'Бар' },
    ...ROOM_DEFINITIONS
      .filter((def) => snapshot.rooms.find((r) => r.id === def.id)?.unlocked)
      .map((def) => ({ id: def.id, title: def.shortName })),
  ];
  const [filter, setFilter] = useState<'all' | 'free' | 'bar' | 'rooms'>('all');

  const visibleStaff = STAFF_DEFINITIONS.filter((definition) => {
    if (filter === 'all') return true;
    const location = findStaffLocation(snapshot, definition.id);
    if (filter === 'free') return location === null;
    if (filter === 'bar') return location?.venue === 'bar';
    return location !== null && location.venue !== 'bar';
  });

  return (
    <div className="staff-roster">
      <div className="drink-ribbon">
        <span className="status-emoji">💋</span>
        <span>
          <b>Штат · {snapshot.roster.filter((entry) => entry.hired).length} / 9</b>
          <small>Нанимай и ставь в бар или комнаты</small>
        </span>
      </div>
      <div className="staff-roster-filter" role="group" aria-label="Фильтр персонала">
        {(['all', 'free', 'bar', 'rooms'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? 'is-active' : ''}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'Все' : key === 'free' ? 'Свободные' : key === 'bar' ? 'Бар' : 'Комнаты'}
          </button>
        ))}
      </div>
      <div className="staff-roster-list">
        {visibleStaff.map((definition) => {
          const entry = snapshot.roster.find((item) => item.id === definition.id)!;
          const location = findStaffLocation(snapshot, definition.id);
          const assignmentText = findStaffAssignment(snapshot, definition.id);
          const canHire = !entry.hired && snapshot.coins >= definition.hireCost;
          const selectedValue = location ? `${location.venue}:${location.slotIndex}` : '';

          return (
            <div key={definition.id} className={`staff-roster-card ${entry.hired ? 'is-hired' : ''}`}>
              <span className="staff-roster-emoji">{definition.emoji}</span>
              <span>
                <b>{definition.name}</b>
                <small>{entry.hired ? assignmentText : definition.blurb}</small>
              </span>
              {entry.hired ? (
                <select
                  aria-label={`Место работы для ${definition.name}`}
                  className="roster-assign-select"
                  value={selectedValue}
                  onChange={(event) => {
                    const val = event.target.value;
                    gameAudio.unlock();
                    if (!val) {
                      if (location) engine.assignStaff(location.venue, location.slotIndex, null);
                    } else {
                      const [venue, slotStr] = val.split(':') as [VenueId, string];
                      const slotIndex = Number.parseInt(slotStr, 10) as 0 | 1;
                      engine.assignStaff(venue, slotIndex, definition.id);
                    }
                    gameAudio.click();
                  }}
                >
                  <option value="">— Свободна —</option>
                  {availableVenues.map((v) => (
                    <optgroup key={v.id} label={v.title}>
                      <option value={`${v.id}:0`}>{v.title} · Слот 1</option>
                      <option value={`${v.id}:1`}>{v.title} · Слот 2</option>
                    </optgroup>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  className={`hire-button ${canHire ? 'is-affordable' : ''}`}
                  disabled={!canHire}
                  onClick={() => {
                    gameAudio.unlock();
                    if (engine.hireStaff(definition.id)) gameAudio.click();
                  }}
                >
                  {definition.hireCost === 0 ? 'Своя' : <>🪙 {definition.hireCost}</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCompactNumber(value: number) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const formatScaled = (scaled: number) => {
    const digits = scaled >= 100 ? 0 : 1;
    return Number(scaled.toFixed(digits)).toString();
  };
  if (absolute >= 1_000_000_000) return `${sign}${formatScaled(absolute / 1_000_000_000)}B`;
  if (absolute >= 1_000_000) return `${sign}${formatScaled(absolute / 1_000_000)}M`;
  if (absolute >= 1_000) return `${sign}${formatScaled(absolute / 1_000)}K`;
  return Math.trunc(value).toString();
}

function getEventMessage(event: NonNullable<GameSnapshot['lastEvent']>) {
  if (event.kind !== 'room_unlock' || !event.roomId) return event.message;
  const definition = getRoomDefinition(event.roomId);
  return `${definition.icon} ${definition.name} ${ROOM_UNLOCK_VERB[event.roomId]}!`;
}

function CurrencyChip({ icon, value, label }: { icon: 'coins' | 'reputation' | 'customers'; value: number; label: string }) {
  return (
    <div className="currency-chip" title={label} aria-label={`${label}: ${value}`}>
      <Icon name={icon} />
      <strong className="currency-value">
        <span className="currency-value-full">{value.toLocaleString('ru-RU')}</span>
        <span className="currency-value-compact" aria-hidden="true">{formatCompactNumber(value)}</span>
      </strong>
    </div>
  );
}

function MilestoneCard({ snapshot }: { snapshot: GameSnapshot }) {
  const milestone = snapshot.nextMilestone;
  const achieved = snapshot.achievedMilestoneCount;
  const total = snapshot.totalMilestoneCount;

  if (!milestone) {
    if (total === 0 || achieved < total) return null;
    return (
      <div className="milestone-card is-complete" aria-label={`Все цели выполнены: ${achieved} из ${total}`}>
        <span className="milestone-icon" aria-hidden="true">🏆</span>
        <span className="milestone-copy"><small>ЦЕЛИ · {achieved}/{total}</small><b>Все этапы развития пройдены</b></span>
        <strong>ГОТОВО</strong>
      </div>
    );
  }

  const progress = milestone.target > 0 ? Math.max(0, Math.min(1, milestone.current / milestone.target)) : 1;
  const ordinal = total > 0 ? `${Math.min(achieved + 1, total)}/${total}` : `${achieved + 1}`;
  return (
    <div
      className="milestone-card"
      aria-label={`Следующая цель: ${milestone.label}. ${milestone.current} из ${milestone.target}${milestone.rewardLabel ? `. Награда: ${milestone.rewardLabel}` : ''}`}
    >
      <span className="milestone-icon" aria-hidden="true">🎯</span>
      <span className="milestone-copy">
        <small>ВЕХА · {ordinal}</small>
        <b>{milestone.label}</b>
        <i aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></i>
      </span>
      <strong>
        <span>{formatCompactNumber(milestone.current)} / {formatCompactNumber(milestone.target)}</span>
        {milestone.rewardLabel && <small>{milestone.rewardLabel}</small>}
      </strong>
    </div>
  );
}

function UpgradeCard({ definition, snapshot, engine }: { definition: UpgradeDefinition; snapshot: GameSnapshot; engine: GameEngine }) {
  const level = snapshot.upgrades[definition.key];
  const maxed = level >= definition.maxLevel;
  const cost = getUpgradeCost(definition, level);
  const balance = definition.currency === 'coins' ? snapshot.coins : snapshot.reputation;
  const affordable = !maxed && balance >= cost;

  const purchase = () => {
    gameAudio.unlock();
    if (engine.purchaseUpgrade(definition.key)) gameAudio.click();
  };

  return (
    <button
      className={`upgrade-card ${affordable ? 'is-affordable' : ''}`}
      onClick={purchase}
      disabled={!affordable}
      aria-label={`${definition.name}, уровень ${level}${maxed ? ', максимум' : `, цена ${cost}`}`}
    >
      <Icon name={definition.icon} className="upgrade-icon" />
      <span className="upgrade-copy">
        <span className="upgrade-name">
          {definition.name}
          <em>ур. {level}</em>
        </span>
        <span className="upgrade-description">{definition.description}</span>
        <span className="level-pips" aria-hidden="true">
          {Array.from({ length: definition.maxLevel }, (_, index) => (
            <i key={index} className={index < level ? 'is-filled' : ''} />
          ))}
        </span>
      </span>
      <span className={`upgrade-price ${maxed ? 'is-maxed' : ''}`}>
        {maxed ? (
          'MAX'
        ) : (
          <>
            <Icon name={definition.currency === 'coins' ? 'coins' : 'reputation'} />
            {cost}
          </>
        )}
      </span>
    </button>
  );
}

function RoomDevelopment({
  room,
  snapshot,
  engine,
  onOpenStaff,
}: {
  room: RoomState;
  snapshot: GameSnapshot;
  engine: GameEngine;
  onOpenStaff?: () => void;
}) {
  const definition = getRoomDefinition(room.id);
  const clickPurchase = () => {
    gameAudio.unlock();
    if (engine.purchaseRoom(room.id)) gameAudio.click();
  };

  if (!room.unlocked) {
    const affordable = snapshot.coins >= definition.unlockCost;
    return (
      <div className="room-development is-locked" style={{ '--room-color': definition.color, '--room-accent': definition.accent } as CSSProperties}>
        <div className="room-hero">
          <span className="room-hero-icon">{definition.icon}</span>
          <span>
            <small>НОВОЕ ПОМЕЩЕНИЕ</small>
            <h3>{definition.name}</h3>
            <p>{definition.tagline}</p>
          </span>
        </div>
        <div className="renovation-preview" aria-hidden="true">
          <span>🔒</span>
          <i /><i /><i />
          <b>ТРЕБУЕТ РЕМОНТА</b>
        </div>
        <div className="room-economy-grid">
          <span><small>Доход</small><b>до {definition.baseProfit} 🪙</b></span>
          <span><small>Сеанс</small><b>{definition.sessionDuration} сек.</b></span>
          <span><small>Персонал</small><b>{definition.staffRole}</b></span>
        </div>
        <button className={`unlock-room-button ${affordable ? 'is-affordable' : ''}`} disabled={!affordable} onClick={clickPurchase}>
          <span>🔨 Открыть и отремонтировать</span>
          <b><Icon name="coins" />{definition.unlockCost}</b>
        </button>
        {!affordable && <small className="need-coins">Нужно ещё {definition.unlockCost - snapshot.coins} монет</small>}
      </div>
    );
  }

  return (
    <div className="room-development is-open" style={{ '--room-color': definition.color, '--room-accent': definition.accent } as CSSProperties}>
      <div className="room-hero compact">
        <span className="room-hero-icon">{definition.icon}</span>
        <span>
          <small>КОМНАТА РАБОТАЕТ</small>
          <h3>{definition.name}</h3>
          <p>{definition.tagline}</p>
        </span>
        <em className="open-badge">ОТКРЫТО</em>
      </div>
      <div className="staff-card">
        <span className={`staff-avatar state-${room.staffState}`}>
          {roomWorkerIds(snapshot, room.id)[0]
            ? getStaffDefinition(roomWorkerIds(snapshot, room.id)[0]!).emoji
            : definition.icon}
        </span>
        <span>
          <small>ПЕРСОНАЛ{roomWorkerIds(snapshot, room.id).length ? ` · ${roomWorkerIds(snapshot, room.id).map((id) => getStaffDefinition(id).name).join(' + ')}` : ''}</small>
          <b>{roomStatusLabel(snapshot, room)}</b>
          <i><span style={{ width: `${Math.round(room.progress * 100)}%` }} /></i>
        </span>
        <strong>гости {roomArrivedCount(snapshot, room.id)}/{room.capacity}</strong>
      </div>
      <VenueSlotAssigner venue={room.id} snapshot={snapshot} engine={engine} onOpenStaff={onOpenStaff} />
      {(roomWorkerIds(snapshot, room.id).length > 0) && (
        <button
          type="button"
          className="room-quick-clear"
          onClick={() => {
            gameAudio.unlock();
            engine.assignStaff(room.id, 0, null);
            engine.assignStaff(room.id, 1, null);
            gameAudio.click();
          }}
        >
          🚪 Освободить комнату
        </button>
      )}
      <div className="room-economy-grid is-live">
        <span><small>За гостя</small><b>{room.perGuestProfit} 🪙</b></span>
        <span><small>Макс. сеанс</small><b>{room.maxSessionProfit} 🪙</b></span>
        <span><small>Выручка</small><b>{room.revenue} 🪙</b></span>
        <span><small>Сеансов</small><b>{room.completedSessions}</b></span>
      </div>
      <div className="room-upgrade-list">
        {ROOM_UPGRADE_DEFS.map((upgrade) => {
          const copy = ROOM_UPGRADE_COPY[room.id][upgrade.key];
          const level = room.upgrades[upgrade.key];
          const maxLevel = upgrade.key === 'capacity' ? getRoomCapacityMaxLevel(room.id) : upgrade.maxLevel;
          const maxed = level >= maxLevel;
          const cost = getRoomUpgradeCost(room.id, upgrade.key, level);
          const affordable = !maxed && snapshot.coins >= cost;
          const delta = !maxed ? roomUpgradeDelta(room, upgrade.key) : null;
          return (
            <button
              key={upgrade.key}
              className={`room-upgrade-card ${affordable ? 'is-affordable' : ''}`}
              disabled={!affordable}
              onClick={() => {
                gameAudio.unlock();
                if (engine.purchaseRoomUpgrade(room.id, upgrade.key)) gameAudio.click();
              }}
              aria-label={`${definition.shortName}: ${copy.name}, уровень ${level}${maxed ? ', максимум' : `, цена ${cost}`}`}
            >
              <span className="room-upgrade-glyph">{copy.icon}</span>
              <span>
                <b>{copy.name}<em>ур. {level}</em></b>
                <small>{copy.description}</small>
                {delta && (
                  <span className="upgrade-delta">
                    <span className="upgrade-delta-current">{delta.current} 🪙</span>
                    <span className="upgrade-delta-next">+{delta.next - delta.current} {delta.unit}</span>
                  </span>
                )}
                {upgrade.key === 'staffSpeed' && !maxed && (
                  <span className="upgrade-delta">
                    <span className="upgrade-delta-next">сеанс быстрее</span>
                  </span>
                )}
              </span>
              <strong>{maxed ? 'MAX' : <><Icon name="coins" />{cost}</>}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VenueChips({
  snapshot,
  venueView,
  onSelect,
}: {
  snapshot: GameSnapshot;
  venueView: VenueView;
  onSelect: (view: VenueView) => void;
}) {
  return (
    <div className="venue-tabs" role="tablist" aria-label="Помещения комплекса">
      <button
        className={venueView === 'bar' ? 'is-active' : ''}
        onClick={() => onSelect('bar')}
        role="tab"
        aria-selected={venueView === 'bar'}
      >
        <span>🏠</span>Зал
        {barHasAffordableUpgrade(snapshot) && <em className="affordance-badge" aria-label="Доступно улучшение">!</em>}
        <i className="is-open" />
        <span className="venue-chip-progress" aria-hidden="true">
          <i style={{ width: `${Math.round((Object.values(snapshot.upgrades).reduce((a, b) => a + b, 0) / (UPGRADE_DEFS.reduce((a, d) => a + d.maxLevel, 0))) * 100)}%` }} />
        </span>
      </button>
      {ROOM_DEFINITIONS.map((room) => {
        const state = snapshot.rooms.find((item) => item.id === room.id)!;
        const arrived = state.unlocked ? roomArrivedCount(snapshot, room.id) : 0;
        const progress = roomUpgradeProgress(state);
        const afford = roomHasAffordableAction(snapshot, state);
        return (
          <button
            key={room.id}
            className={venueView === room.id ? 'is-active' : ''}
            onClick={() => onSelect(room.id)}
            role="tab"
            aria-selected={venueView === room.id}
          >
            <span>{room.icon}</span>{room.shortName}
            {state.unlocked && arrived > 0 && <em className="tab-load">{arrived}/{state.capacity}</em>}
            {afford && <em className="affordance-badge" aria-label="Доступно улучшение">!</em>}
            <i className={state.unlocked ? 'is-open' : ''} />
            <span className="venue-chip-progress" aria-hidden="true">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Hud({ engine, snapshot, venueView, onVenueView, sheetMode, onSheetMode }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bartenderStatus = BARTENDER_STATUS[snapshot.bartender.state];
  const activeRoom = venueView === 'bar' ? null : snapshot.rooms.find((room) => room.id === venueView) ?? null;
  const activeRoomDefinition = activeRoom ? getRoomDefinition(activeRoom.id) : null;
  const manageOpen = snapshot.started && sheetMode === 'manage';
  const staffOpen = snapshot.started && sheetMode === 'staff';
  const sheetOpen = manageOpen || staffOpen;
  const manageAffordance = anyManageAffordance(snapshot);
  const staffAffordance = snapshot.roster.some((entry) => !entry.hired && snapshot.coins >= getStaffDefinition(entry.id).hireCost);
  const nextDrink = useMemo(() => {
    const currentLevel = snapshot.upgrades.assortment;
    return currentLevel < 5 ? `Следующий напиток на ${currentLevel + 1} уровне` : 'Вся карта открыта';
  }, [snapshot.upgrades.assortment]);

  const click = (action: () => void) => {
    gameAudio.setEnabled(snapshot.soundEnabled);
    gameAudio.click();
    action();
  };

  const selectVenue = (view: VenueView) => click(() => onVenueView(view));

  const toggleManage = () => click(() => {
    setSettingsOpen(false);
    onSheetMode(sheetMode === 'manage' ? null : 'manage');
  });
  const toggleStaff = () => click(() => {
    setSettingsOpen(false);
    onSheetMode(sheetMode === 'staff' ? null : 'staff');
  });
  const closeSheet = () => click(() => onSheetMode(null));
  const goToScene = () => click(() => onSheetMode(null));
  const toggleSettings = () => click(() => {
    onSheetMode(null);
    setSettingsOpen((open) => !open);
  });
  const closeSettings = () => click(() => setSettingsOpen(false));

  const reset = () => {
    if (window.confirm('Сбросить прогресс борделя и начать заново?')) {
      engine.resetProgress();
      onVenueView('bar');
      onSheetMode(null);
      setSettingsOpen(false);
    }
  };

  return (
    <div className={`hud ${snapshot.started ? 'is-running' : 'is-welcome'} ${sheetOpen ? 'is-development-open' : ''} ${manageOpen ? 'is-manage-open' : ''} ${staffOpen ? 'is-staff-open' : ''} ${settingsOpen ? 'is-settings-open' : ''}`}>
      {snapshot.started && (
        <>
      <header className="top-hud">
        <div className="brand-card">
          <span className="brand-mark">БК</span>
          <span className="brand-copy">
            <strong>БОРДЕЛЬ У КРИСТОФЕРА</strong>
            <small>день {snapshot.day} · {activeRoomDefinition?.shortName ?? 'главный зал'}</small>
          </span>
          <span className="day-track" aria-label={`Смена завершена на ${Math.round(snapshot.shiftProgress * 100)}%`}>
            <i style={{ width: `${snapshot.shiftProgress * 100}%` }} />
          </span>
        </div>

        <div className="currency-strip">
          <CurrencyChip icon="coins" value={snapshot.coins} label="Монеты" />
          <CurrencyChip icon="reputation" value={snapshot.reputation} label="Репутация" />
          <CurrencyChip icon="customers" value={snapshot.served} label="Обслужено гостей" />
        </div>

        <div className="top-tools">
          <button
            type="button"
            className={`settings-button ${settingsOpen ? 'is-active' : ''}`}
            onClick={toggleSettings}
            aria-label="Настройки"
            aria-expanded={settingsOpen}
            aria-controls="settings-popover"
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <div className="meta-rail" aria-label="Статус смены">
        <b>День {snapshot.day}</b>
        <span>{activeRoomDefinition?.shortName ?? 'Главный зал'}</span>
        <span className="meta-rail-track" aria-hidden="true">
          <i style={{ width: `${snapshot.shiftProgress * 100}%` }} />
        </span>
        <em>×{snapshot.speedMultiplier}</em>
      </div>

      {settingsOpen && (
        <>
          <button type="button" className="settings-backdrop" onClick={closeSettings} aria-label="Закрыть настройки" />
          <div id="settings-popover" className="settings-popover" role="dialog" aria-label="Настройки">
            <button type="button" className="settings-row" onClick={() => click(engine.togglePause)}>
              <Icon name={snapshot.paused ? 'play' : 'pause'} />
              <span>{snapshot.paused ? 'Продолжить' : 'Пауза'}</span>
            </button>
            <button type="button" className="settings-row" onClick={() => click(engine.toggleSpeed)}>
              <Icon name="time-speed" />
              <span>Скорость ×{snapshot.speedMultiplier}</span>
            </button>
            <button
              type="button"
              className={`settings-row ${snapshot.soundEnabled ? '' : 'is-muted'}`}
              onClick={() => {
                engine.toggleSound();
                gameAudio.setEnabled(!snapshot.soundEnabled);
              }}
            >
              <Icon name="sound" />
              <span>{snapshot.soundEnabled ? 'Звук вкл.' : 'Звук выкл.'}</span>
            </button>
            <button type="button" className="settings-row is-danger" onClick={() => click(reset)}>
              <Icon name="reset" />
              <span>Сбросить прогресс</span>
            </button>
          </div>
        </>
      )}

      <nav className="bottom-actions" aria-label="Действия">
        <button
          type="button"
          className={`round-fab fab-staff ${staffOpen ? 'is-active' : ''}`}
          onClick={toggleStaff}
          aria-label="Штат"
          aria-expanded={staffOpen}
          aria-controls="staff-panel"
        >
          <span className="round-fab-icon" aria-hidden="true">💋</span>
          <span className="round-fab-label">Штат</span>
          {staffAffordance && <em className="affordance-badge dock-badge" aria-label="Можно нанять">!</em>}
        </button>
        <button
          type="button"
          className={`round-fab fab-manage ${manageOpen ? 'is-active' : ''}`}
          onClick={toggleManage}
          aria-label="Улучшения"
          aria-expanded={manageOpen}
          aria-controls="upgrade-panel"
        >
          <Icon name="upgrade-arrow" />
          <span className="round-fab-label">Апгрейд</span>
          {manageAffordance && <em className="affordance-badge dock-badge" aria-label="Есть доступные покупки">!</em>}
        </button>
      </nav>

      <button
        type="button"
        className={`upgrade-backdrop ${sheetOpen ? 'is-open' : ''}`}
        onClick={closeSheet}
        aria-label="Закрыть меню"
        aria-hidden={!sheetOpen}
        tabIndex={sheetOpen ? 0 : -1}
        inert={!sheetOpen}
      />

      <aside
        id="upgrade-panel"
        className={`upgrade-panel ${manageOpen ? 'is-open' : ''} ${venueView === 'bar' ? '' : 'is-room-view'}`}
        aria-hidden={!manageOpen}
        inert={!manageOpen}
        aria-labelledby="upgrade-panel-title"
      >
        <div className="panel-sticky-header">
          <span className="panel-handle" aria-hidden="true" />
          <div className="panel-heading">
            <div>
              <span className="eyebrow">УПРАВЛЕНИЕ</span>
              <h2 id="upgrade-panel-title">{venueView === 'bar' ? 'Улучшения зала' : activeRoomDefinition?.name}</h2>
            </div>
            <Icon name="upgrade-arrow" />
            <button
              type="button"
              className="panel-close"
              onClick={closeSheet}
              aria-label="Закрыть управление"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <VenueChips snapshot={snapshot} venueView={venueView} onSelect={selectVenue} />
          <button type="button" className="goto-scene-button" onClick={goToScene}>
            К сцене · {venueView === 'bar' ? 'Зал' : activeRoomDefinition?.shortName}
          </button>
        </div>
        <MilestoneCard snapshot={snapshot} />
        {venueView === 'bar' ? (
          <>
            <VenueSlotAssigner venue="bar" snapshot={snapshot} engine={engine} onOpenStaff={() => onSheetMode('staff')} />
            <div className="drink-ribbon">
              <Icon name="assortment" />
              <span>
                <b>{snapshot.unlockedDrinks.length} / 5 напитков</b>
                <small>{nextDrink}</small>
              </span>
            </div>
            <div className="upgrade-list">
              {UPGRADE_DEFS.map((definition) => (
                <UpgradeCard key={definition.key} definition={definition} snapshot={snapshot} engine={engine} />
              ))}
            </div>
          </>
        ) : activeRoom ? <RoomDevelopment room={activeRoom} snapshot={snapshot} engine={engine} onOpenStaff={() => onSheetMode('staff')} /> : null}
        {import.meta.env.DEV && (
        <div className="cheat-row">
          <button
            type="button"
            className="cheat-button"
            onClick={() => click(() => engine.cheatMoney(99_999_999))}
            aria-label="Чит: получить 99999999 монет"
          >
            💰 Чит: 99 999 999 монет
          </button>
          <button
            type="button"
            className="cheat-button cheat-button-alt"
            onClick={() => click(() => engine.cheatRich())}
            aria-label="Чит: деньги и репутация"
          >
            👑 Чит: богатство
          </button>
        </div>
        )}
        <button className="reset-button" onClick={() => click(reset)}>
          <Icon name="reset" />
          Сбросить прогресс
        </button>
      </aside>

      <aside
        id="staff-panel"
        className={`upgrade-panel staff-panel ${staffOpen ? 'is-open' : ''}`}
        aria-hidden={!staffOpen}
        inert={!staffOpen}
        aria-labelledby="staff-panel-title"
      >
        <div className="panel-sticky-header">
          <span className="panel-handle" aria-hidden="true" />
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ПЕРСОНАЛ</span>
              <h2 id="staff-panel-title">Штат</h2>
            </div>
            <span className="dock-emoji heading-emoji" aria-hidden="true">💋</span>
            <button
              type="button"
              className="panel-close"
              onClick={closeSheet}
              aria-label="Закрыть штат"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
        <StaffRosterPanel snapshot={snapshot} engine={engine} />
      </aside>

      {snapshot.started && (
        <div className="bottom-status">
          {activeRoom && activeRoomDefinition ? (
            <>
              <button className="bartender-pill focus-pill" onClick={() => selectVenue('bar')}>
                <span className="status-emoji">🏠</span>
                <span><small>КОМПЛЕКС</small><b>Вернуться в главный зал</b></span>
              </button>
              <button className="room-pill focus-pill" onClick={toggleManage}>
                <span className="status-emoji">{activeRoomDefinition.icon}</span>
                <span>
                  <small>{
                    snapshot.venueSlots[activeRoom.id].filter(Boolean).map((id) => getStaffDefinition(id!).name).join(' + ')
                    || activeRoomDefinition.staffRole
                  }</small>
                  <b>{roomStatusLabel(snapshot, activeRoom)} · гости {roomArrivedCount(snapshot, activeRoom.id)}/{activeRoom.capacity}</b>
                </span>
              </button>
            </>
          ) : (
            <>
              <div className="bartender-pill">
                <span className="status-emoji">{bartenderStatus.emoji}</span>
                <span>
                  <small>{
                    snapshot.bartender.staffId
                      ? getStaffDefinition(snapshot.bartender.staffId).name.toUpperCase()
                      : (snapshot.entranceQueue > 0 ? 'ОЧЕРЕДЬ' : 'БАР ПУСТ')
                  }</small>
                  <b>{
                    snapshot.bartender.staffId
                      ? bartenderStatus.label
                      : (snapshot.entranceQueue > 0 ? `У входа · ${snapshot.entranceQueue}` : 'Нет персонала у стойки')
                  }</b>
                </span>
              </div>
              <button className="room-pill focus-pill" onClick={() => selectVenue(snapshot.rooms.find((room) => room.unlocked)?.id ?? 'strip')}>
                <Icon name="customers" />
                <span><small>КОМПЛЕКС · +{snapshot.roomRevenue} 🪙</small><b>зал {snapshot.patrons.filter((patron) => patron.state !== 'queued_entrance' && patron.state !== 'leaving').length}/6 · очередь {snapshot.entranceQueue} · {snapshot.rooms.filter((room) => room.unlocked).length}/3 комнат</b></span>
              </button>
            </>
          )}
        </div>
      )}

      {snapshot.lastEvent && (
        <div className={`event-toast event-${snapshot.lastEvent.kind}`} key={snapshot.lastEvent.id} aria-live="polite" role="status">
          <span>{snapshot.lastEvent.kind === 'payment' || snapshot.lastEvent.kind === 'room_income' ? '🪙' : snapshot.lastEvent.kind === 'room_unlock' ? '🔨' : snapshot.lastEvent.kind === 'upgrade' ? '⬆️' : snapshot.lastEvent.kind === 'reputation' ? '⭐' : '🎉'}</span>
          {getEventMessage(snapshot.lastEvent)}
        </div>
      )}

      {snapshot.paused && (
        <div className="pause-scrim">
          <div className="pause-card">
            <Icon name="pause" />
            <b>Бордель на паузе</b>
            <span>Гости терпеливо подождут.</span>
          </div>
        </div>
      )}
        </>
      )}

      {!snapshot.started && (
        <div className="welcome-layer">
          <section className="welcome-card">
            <span className="welcome-kicker">3D БОРДЕЛЬ-МЕНЕДЖЕР</span>
            <h1>Бордель <i>у</i> Кристофера</h1>
            <p>Нанимай персонал и ставь в бар или комнаты. Без бара гости идут сразу в услуги; без сотрудников — очередь у входа.</p>
            <div className="welcome-loop">
              <span>👩</span><i>→</i><span>🍸</span><i>→</i><span>🔥</span><i>→</i><span>🪙</span>
            </div>
            <button className="start-button" onClick={() => click(engine.start)}>
              <Icon name="play" />
              Открыть бордель
            </button>
            <small>Прогресс сохраняется автоматически</small>
          </section>
        </div>
      )}
    </div>
  );
}
