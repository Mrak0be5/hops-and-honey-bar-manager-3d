import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { getRoomCapacityMaxLevel, getRoomDefinition, getRoomUpgradeCost, getStaffDefinition, getUpgradeCost, ROOM_DEFINITIONS, ROOM_UPGRADE_DEFS, STAFF_DEFINITIONS, UPGRADE_DEFS } from '../game/config';
import type { GameEngine } from '../game/GameEngine';
import { gameAudio } from '../game/audio';
import type { BartenderState, GameSnapshot, RoomId, RoomState, RoomUpgradeKey, StaffCharacterId, UpgradeDefinition, VenueId, VenueView } from '../game/types';
import { Icon } from './Icon';

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
  venueView: VenueView;
  onVenueView: (view: VenueView) => void;
  upgradesOpen: boolean;
  onUpgradesOpen: (open: boolean) => void;
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
} as const;

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
  return 'Резерв';
}

function VenueSlotAssigner({
  venue,
  snapshot,
  engine,
}: {
  venue: VenueId;
  snapshot: GameSnapshot;
  engine: GameEngine;
}) {
  const slots = snapshot.venueSlots[venue];
  const freeHired = snapshot.roster.filter((entry) => {
    if (!entry.hired) return false;
    return !Object.values(snapshot.venueSlots).some((pair) => pair.includes(entry.id));
  });
  return (
    <div className="staff-slots">
      <small className="staff-slots-label">Рабочие места · 2 (хватит 1)</small>
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
  return (
    <div className="staff-roster">
      <div className="drink-ribbon">
        <span className="status-emoji">💋</span>
        <span>
          <b>Штат · {snapshot.roster.filter((entry) => entry.hired).length} / 9</b>
          <small>Нанимай и ставь в бар или комнаты</small>
        </span>
      </div>
      <div className="staff-roster-list">
        {STAFF_DEFINITIONS.map((definition) => {
          const entry = snapshot.roster.find((item) => item.id === definition.id)!;
          const assignment = findStaffAssignment(snapshot, definition.id);
          const canHire = !entry.hired && snapshot.coins >= definition.hireCost;
          return (
            <div key={definition.id} className={`staff-roster-card ${entry.hired ? 'is-hired' : ''}`}>
              <span className="staff-roster-emoji">{definition.emoji}</span>
              <span>
                <b>{definition.name}</b>
                <small>{entry.hired ? assignment : definition.blurb}</small>
              </span>
              {entry.hired ? (
                <em className="hired-tag">в штате</em>
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
        <small>СЛЕДУЮЩАЯ ЦЕЛЬ · {ordinal}</small>
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

function RoomDevelopment({ room, snapshot, engine }: { room: RoomState; snapshot: GameSnapshot; engine: GameEngine }) {
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
        <span className={`staff-avatar state-${room.staffState}`}>{definition.icon}</span>
        <span>
          <small>ПЕРСОНАЛ</small>
          <b>{ROOM_STAFF_LABELS[room.staffState === 'locked' ? 'locked' : room.staffState === 'waiting' || room.staffState === 'welcoming' || room.staffState === 'serving' || room.staffState === 'resetting' ? room.staffState : 'waiting']}</b>
          <i><span style={{ width: `${Math.round(room.progress * 100)}%` }} /></i>
        </span>
        <strong>{room.guests}/{room.capacity}</strong>
      </div>
      <VenueSlotAssigner venue={room.id} snapshot={snapshot} engine={engine} />
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
              <span><b>{copy.name}<em>ур. {level}</em></b><small>{copy.description}</small></span>
              <strong>{maxed ? 'MAX' : <><Icon name="coins" />{cost}</>}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Hud({ engine, snapshot, venueView, onVenueView, upgradesOpen, onUpgradesOpen }: Props) {
  const bartenderStatus = BARTENDER_STATUS[snapshot.bartender.state];
  const activeRoom = venueView === 'bar' ? null : snapshot.rooms.find((room) => room.id === venueView) ?? null;
  const activeRoomDefinition = activeRoom ? getRoomDefinition(activeRoom.id) : null;
  const developmentVisible = snapshot.started && upgradesOpen;
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

  const reset = () => {
    if (window.confirm('Сбросить прогресс борделя и начать заново?')) {
      engine.resetProgress();
      onVenueView('bar');
    }
  };

  return (
    <div className={`hud ${snapshot.started ? 'is-running' : 'is-welcome'} ${developmentVisible ? 'is-development-open' : ''}`}>
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

        <nav className="control-strip" aria-label="Управление игрой">
          <button className="icon-button speed-button" onClick={() => click(engine.toggleSpeed)} aria-label={`Скорость игры x${snapshot.speedMultiplier}`}>
            <Icon name="time-speed" />
            <b>×{snapshot.speedMultiplier}</b>
            <span className="control-label" aria-hidden="true">Скорость</span>
          </button>
          <button className="icon-button" onClick={() => click(engine.togglePause)} aria-label={snapshot.paused ? 'Продолжить' : 'Пауза'}>
            <Icon name={snapshot.paused ? 'play' : 'pause'} />
            <span className="control-label" aria-hidden="true">{snapshot.paused ? 'Играть' : 'Пауза'}</span>
          </button>
          <button
            className={`icon-button ${snapshot.soundEnabled ? '' : 'is-muted'}`}
            onClick={() => {
              engine.toggleSound();
              gameAudio.setEnabled(!snapshot.soundEnabled);
            }}
            aria-label={snapshot.soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            <Icon name="sound" />
            <span className="control-label" aria-hidden="true">Звук</span>
          </button>
          <button
            className={`icon-button upgrades-toggle ${developmentVisible ? 'is-active' : ''}`}
            onClick={() => click(() => onUpgradesOpen(!upgradesOpen))}
            aria-label="Улучшения борделя"
            aria-expanded={developmentVisible}
            aria-controls="upgrade-panel"
          >
            <Icon name="upgrade-arrow" />
            <span className="control-label" aria-hidden="true">Развитие</span>
          </button>
        </nav>
      </header>

      <button
        type="button"
        className={`upgrade-backdrop ${developmentVisible ? 'is-open' : ''}`}
        onClick={() => click(() => onUpgradesOpen(false))}
        aria-label="Закрыть меню улучшений"
        aria-hidden={!developmentVisible}
        tabIndex={developmentVisible ? 0 : -1}
        inert={!developmentVisible}
      />

      <aside
        id="upgrade-panel"
        className={`upgrade-panel ${developmentVisible ? 'is-open' : ''} ${venueView === 'bar' ? '' : 'is-room-view'}`}
        aria-hidden={!developmentVisible}
        inert={!developmentVisible}
        aria-labelledby="upgrade-panel-title"
      >
        <div className="panel-sticky-header">
          <span className="panel-handle" aria-hidden="true" />
          <div className="panel-heading">
            <div>
              <span className="eyebrow">МЕНЮ РАЗВИТИЯ</span>
              <h2 id="upgrade-panel-title">{venueView === 'bar' ? 'Улучшения зала' : activeRoomDefinition?.name}</h2>
            </div>
            <Icon name="upgrade-arrow" />
            <button
              type="button"
              className="panel-close"
              onClick={() => click(() => onUpgradesOpen(false))}
              aria-label="Закрыть улучшения"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="venue-tabs" role="tablist" aria-label="Помещения комплекса">
            <button className={venueView === 'bar' ? 'is-active' : ''} onClick={() => selectVenue('bar')} role="tab" aria-selected={venueView === 'bar'}><span>🏠</span>Зал</button>
            {ROOM_DEFINITIONS.map((room) => {
              const state = snapshot.rooms.find((item) => item.id === room.id)!;
              return <button key={room.id} className={venueView === room.id ? 'is-active' : ''} onClick={() => selectVenue(room.id)} role="tab" aria-selected={venueView === room.id}><span>{room.icon}</span>{room.shortName}<i className={state.unlocked ? 'is-open' : ''} /></button>;
            })}
          </div>
        </div>
        <MilestoneCard snapshot={snapshot} />
        {venueView === 'bar' ? (
          <>
            <StaffRosterPanel snapshot={snapshot} engine={engine} />
            <VenueSlotAssigner venue="bar" snapshot={snapshot} engine={engine} />
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
        ) : activeRoom ? <RoomDevelopment room={activeRoom} snapshot={snapshot} engine={engine} /> : null}
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
        <button className="reset-button" onClick={() => click(reset)}>
          <Icon name="reset" />
          Сбросить прогресс
        </button>
      </aside>

      {snapshot.started && (
        <div className="bottom-status">
          {activeRoom && activeRoomDefinition ? (
            <>
              <button className="bartender-pill focus-pill" onClick={() => selectVenue('bar')}>
                <span className="status-emoji">🏠</span>
                <span><small>КОМПЛЕКС</small><b>Вернуться в главный зал</b></span>
              </button>
              <button className="room-pill focus-pill" onClick={() => click(() => onUpgradesOpen(true))}>
                <span className="status-emoji">{activeRoomDefinition.icon}</span>
                <span>
                  <small>{
                    snapshot.venueSlots[activeRoom.id].filter(Boolean).map((id) => getStaffDefinition(id!).name).join(' + ')
                    || activeRoomDefinition.staffRole
                  }</small>
                  <b>{ROOM_STAFF_LABELS[activeRoom.staffState === 'locked' ? 'locked' : activeRoom.staffState === 'waiting' || activeRoom.staffState === 'welcoming' || activeRoom.staffState === 'serving' || activeRoom.staffState === 'resetting' ? activeRoom.staffState : 'waiting']} · {activeRoom.guests}/{activeRoom.capacity}</b>
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
                <span><small>КОМПЛЕКС · +{snapshot.roomRevenue} 🪙</small><b>{snapshot.patrons.length}/6 гостей · {snapshot.rooms.filter((room) => room.unlocked).length}/3 комнат</b></span>
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
            <p>Откройте зал, развивайте Кристину и комнаты: стрип, секс и оргию. Гости пьют — потом идут в услуги.</p>
            <div className="welcome-loop">
              <span>🙋</span><i>→</i><span>🍸</span><i>→</i><span>🔥</span><i>→</i><span>💃</span><i>→</i><span>💰</span>
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
