import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getRoomDefinition, getRoomUpgradeCost, getUpgradeCost, ROOM_DEFINITIONS, ROOM_UPGRADE_DEFS, UPGRADE_DEFS } from '../game/config';
import type { GameEngine } from '../game/GameEngine';
import { gameAudio } from '../game/audio';
import type { BartenderState, GameSnapshot, RoomId, RoomState, RoomUpgradeKey, UpgradeDefinition, VenueView } from '../game/types';
import { Icon } from './Icon';
import { getBarUpgradeRecommendation, getRoomUpgradeGuidance } from './recommendations';
import { getBarUpgradeEffect, getRoomUpgradeEffect } from './upgradeEffects';
import type { UpgradeEffect } from './upgradeEffects';

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
  venueView: VenueView;
  onVenueView: (view: VenueView) => void;
  upgradesOpen: boolean;
  onUpgradesOpen: (open: boolean) => void;
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
};

const ROOM_UPGRADE_COPY: Record<RoomId, Record<RoomUpgradeKey, { name: string; icon: string }>> = {
  karaoke: {
    staffSpeed: { name: 'Опытный ведущий', icon: '⚡' },
    capacity: { name: 'Доп. микрофон', icon: '🎙️' },
    quality: { name: 'Звук и каталог', icon: '🎵' },
  },
  sauna: {
    staffSpeed: { name: 'Умелый банщик', icon: '🧖' },
    capacity: { name: 'Новая лавка', icon: '🪵' },
    quality: { name: 'Печь и кедр', icon: '🔥' },
  },
  massage: {
    staffSpeed: { name: 'Техника мастера', icon: '🙌' },
    capacity: { name: 'Второй стол', icon: '🛏️' },
    quality: { name: 'Масла и ароматы', icon: '🌿' },
  },
};

const ROOM_STAFF_LABELS = {
  locked: 'Помещение закрыто',
  waiting: 'Готовит комнату',
  welcoming: 'Встречает гостей',
  serving: 'Проводит сеанс',
  resetting: 'Наводит порядок',
} as const;

const BARTENDER_STATUS: Record<BartenderState, { emoji: string; label: string }> = {
  idle: { emoji: '👀', label: 'Смотрит за залом' },
  to_order: { emoji: '🏃', label: 'Идёт за заказом' },
  taking_order: { emoji: '📝', label: 'Принимает заказ' },
  to_bar: { emoji: '🏃', label: 'Спешит к стойке' },
  preparing: { emoji: '🍺', label: 'Наливает напиток' },
  to_deliver: { emoji: '🍻', label: 'Несёт напиток' },
  delivering: { emoji: '🤝', label: 'Подаёт заказ' },
  to_payment: { emoji: '🏃', label: 'Идёт за оплатой' },
  taking_payment: { emoji: '💰', label: 'Принимает оплату' },
  to_cleanup: { emoji: '🧽', label: 'Идёт убирать' },
  cleaning: { emoji: '✨', label: 'Убирает кружки' },
  returning_dirty: { emoji: '🫧', label: 'Несёт кружки на мойку' },
};

const ROOM_UNLOCK_VERB: Record<RoomId, 'открыт' | 'открыта'> = {
  karaoke: 'открыт',
  sauna: 'открыта',
  massage: 'открыт',
};

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

function UpgradeEffectView({ effect }: { effect: UpgradeEffect }) {
  return (
    <span
      className="upgrade-effect"
      data-current-value={effect.currentValue}
      data-next-value={effect.nextValue ?? undefined}
    >
      <span className="upgrade-effect-row">
        <small className="upgrade-effect-label">{effect.label}</small>
        <span className="upgrade-effect-values">
          <span className="upgrade-effect-current">{effect.current}</span>
          {effect.next !== null && (
            <>
              <i aria-hidden="true">→</i>
              <strong className="upgrade-effect-next">{effect.next}</strong>
            </>
          )}
          <span className="upgrade-effect-unit">{effect.unit}</span>
        </span>
      </span>
      <span className="upgrade-effect-detail">{effect.detail}</span>
    </span>
  );
}

function UpgradeCard({
  definition,
  snapshot,
  engine,
  recommendationReason,
}: {
  definition: UpgradeDefinition;
  snapshot: GameSnapshot;
  engine: GameEngine;
  recommendationReason?: string;
}) {
  const level = snapshot.upgrades[definition.key];
  const maxed = level >= definition.maxLevel;
  const cost = getUpgradeCost(definition, level);
  const effect = getBarUpgradeEffect(definition, level, cost);
  const balance = definition.currency === 'coins' ? snapshot.coins : snapshot.reputation;
  const affordable = !maxed && balance >= cost;

  const purchase = () => {
    gameAudio.unlock();
    if (engine.purchaseUpgrade(definition.key)) gameAudio.click();
  };

  return (
    <button
      className={`upgrade-card ${affordable ? 'is-affordable' : ''} ${recommendationReason && !maxed ? 'is-recommended' : ''}`}
      data-upgrade-key={definition.key}
      onClick={purchase}
      disabled={!affordable}
      aria-label={`${definition.name}, уровень ${level}. ${effect.ariaLabel}. ${recommendationReason && !maxed ? `Рекомендуется: ${recommendationReason}. ` : ''}${maxed ? 'Максимум' : `Цена ${cost} ${definition.currency === 'coins' ? 'монет' : 'репутации'}`}`}
    >
      <Icon name={definition.icon} className="upgrade-icon" />
      <span className="upgrade-copy">
        <span className="upgrade-name">
          {definition.name}
          <em>ур. {level}</em>
        </span>
        {recommendationReason && !maxed && <span className="upgrade-guidance is-recommended">Рекомендуется · {recommendationReason}</span>}
        <UpgradeEffectView effect={effect} />
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
  const guidance = getRoomUpgradeGuidance(room);
  const utilizationPercent = Math.round(room.recentUtilization * 100);
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
          <span><small>С гостя</small><b>{definition.baseProfit} 🪙</b></span>
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
        <span className={`staff-avatar state-${room.staffState}`}>🧑‍💼</span>
        <span>
          <small>ПЕРСОНАЛ · {definition.staffRole}</small>
          <b>{ROOM_STAFF_LABELS[room.staffState]}</b>
          <i><span style={{ width: `${Math.round(room.progress * 100)}%` }} /></i>
        </span>
        <strong>{room.guests}/{room.capacity}</strong>
      </div>
      {room.awaitingFirstGuest && (
        <div className="grand-opening-status" role="status">
          <span aria-hidden="true">🎉</span>
          <span><small>ПЕРВОЕ ПОСЕЩЕНИЕ</small><b>Следующий обслуженный гость уже приглашён</b></span>
        </div>
      )}
      <div className="room-telemetry" aria-label={`Статистика последних ${room.recentSessions.length} сеансов`}>
        <span><small>Загрузка</small><b>{room.recentSessions.length ? `${utilizationPercent}%` : '—'}</b></span>
        <span><small>Средний сеанс</small><b>{room.recentSessions.length ? `${Math.round(room.recentAverageRevenuePerSession)} 🪙` : 'нет данных'}</b></span>
        <span><small>Выборка</small><b>{room.recentSessions.length}/10</b></span>
      </div>
      <div className="room-upgrade-list">
        {ROOM_UPGRADE_DEFS.map((upgrade) => {
          const copy = ROOM_UPGRADE_COPY[room.id][upgrade.key];
          const level = room.upgrades[upgrade.key];
          const maxLevel = upgrade.key === 'capacity' ? definition.maxCapacity : upgrade.maxLevel;
          const maxed = level >= maxLevel;
          const cost = getRoomUpgradeCost(room.id, upgrade.key, level);
          const effect = getRoomUpgradeEffect(
            room.id,
            upgrade.key,
            level,
            maxLevel,
            room.capacity,
            room.upgrades.quality,
            cost,
          );
          const affordable = !maxed && snapshot.coins >= cost;
          const recommendationReason = guidance.recommendation?.key === upgrade.key ? guidance.recommendation.reason : null;
          const capacityWarning = upgrade.key === 'capacity' ? guidance.capacityWarning : null;
          return (
            <button
              key={upgrade.key}
              className={`room-upgrade-card ${affordable ? 'is-affordable' : ''} ${recommendationReason && !maxed ? 'is-recommended' : ''} ${capacityWarning && !maxed ? 'is-caution' : ''}`}
              data-room-upgrade-key={upgrade.key}
              disabled={!affordable}
              onClick={() => {
                gameAudio.unlock();
                if (engine.purchaseRoomUpgrade(room.id, upgrade.key)) gameAudio.click();
              }}
              aria-label={`${definition.shortName}: ${copy.name}, уровень ${level}. ${effect.ariaLabel}. ${recommendationReason && !maxed ? `Рекомендуется: ${recommendationReason}. ` : ''}${capacityWarning && !maxed ? `Внимание: ${capacityWarning}. ` : ''}${maxed ? 'Максимум' : `Цена ${cost} монет`}`}
            >
              <span className="room-upgrade-glyph">{copy.icon}</span>
              <span className="room-upgrade-copy">
                <b>{copy.name}<em>ур. {level}</em></b>
                {recommendationReason && !maxed && <span className="upgrade-guidance is-recommended">Рекомендуется · {recommendationReason}</span>}
                {capacityWarning && !maxed && <span className="upgrade-guidance is-caution">Не спешите · {capacityWarning}</span>}
                <UpgradeEffectView effect={effect} />
              </span>
              <strong>{maxed ? 'MAX' : <><Icon name="coins" />{cost}</>}</strong>
            </button>
          );
        })}
      </div>
      <div className="room-economy-grid is-live room-history-grid">
        <span><small>За гостя</small><b>{room.perGuestProfit} 🪙</b></span>
        <span><small>Макс. сеанс</small><b>{room.maxSessionProfit} 🪙</b></span>
        <span><small>Выручка</small><b>{room.revenue} 🪙</b></span>
        <span><small>Сеансов</small><b>{room.completedSessions}</b></span>
      </div>
    </div>
  );
}

export function Hud({ engine, snapshot, venueView, onVenueView, upgradesOpen, onUpgradesOpen, settingsOpen, onSettingsOpen }: Props) {
  const bartenderStatus = BARTENDER_STATUS[snapshot.bartender.state];
  const activeRoom = venueView === 'bar' ? null : snapshot.rooms.find((room) => room.id === venueView) ?? null;
  const activeRoomDefinition = activeRoom ? getRoomDefinition(activeRoom.id) : null;
  const nextLockedRoom = ROOM_DEFINITIONS.find((definition) => !snapshot.rooms.find((room) => room.id === definition.id)?.unlocked) ?? null;
  const barRecommendation = getBarUpgradeRecommendation(snapshot);
  const developmentVisible = snapshot.started && upgradesOpen;
  const settingsVisible = snapshot.started && settingsOpen;
  const [resetConfirming, setResetConfirming] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const click = (action: () => void) => {
    gameAudio.setEnabled(snapshot.soundEnabled);
    gameAudio.click();
    action();
  };

  const selectVenue = (view: VenueView) => click(() => onVenueView(view));

  const toggleSound = () => {
    const enabled = !snapshot.soundEnabled;
    engine.toggleSound();
    gameAudio.setEnabled(enabled);
    if (enabled) gameAudio.click();
  };

  const closeSettings = (restoreFocus = true) => {
    setResetConfirming(false);
    onSettingsOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const cancelReset = () => {
    setResetConfirming(false);
    window.requestAnimationFrame(() => resetButtonRef.current?.focus());
  };

  useEffect(() => {
    if (!settingsVisible) return;
    const focusFrame = window.requestAnimationFrame(() => settingsCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (resetConfirming) {
          cancelReset();
        } else {
          onSettingsOpen(false);
          window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(settingsDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onSettingsOpen, resetConfirming, settingsVisible]);

  useEffect(() => {
    if (!settingsVisible || !resetConfirming) return;
    const focusFrame = window.requestAnimationFrame(() => resetCancelRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [resetConfirming, settingsVisible]);

  const confirmReset = () => {
    engine.resetProgress();
    onVenueView('bar');
    closeSettings(false);
  };

  return (
    <div className={`hud ${snapshot.started ? 'is-running' : 'is-welcome'} ${developmentVisible ? 'is-development-open' : ''} ${settingsVisible ? 'is-settings-open' : ''}`}>
      {snapshot.started && (
        <>
      <header className="top-hud">
        <div className="brand-card">
          <button className="brand-speed-button speed-button" onClick={() => click(engine.toggleSpeed)} aria-label={`Скорость игры x${snapshot.speedMultiplier}`}>
            <Icon name="time-speed" />
            <b>×{snapshot.speedMultiplier}</b>
          </button>
          <span className="brand-copy">
            <strong>ХМЕЛЬ &amp; МЁД</strong>
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

        <div className="top-actions">
          <nav className="control-strip" aria-label="Управление игрой">
            <button
              className={`icon-button upgrades-toggle ${developmentVisible ? 'is-active' : ''}`}
              onClick={() => click(() => onUpgradesOpen(!upgradesOpen))}
              aria-label="Улучшения бара"
              aria-expanded={developmentVisible}
              aria-controls="upgrade-panel"
            >
              <Icon name="upgrade-arrow" />
              <span className="control-label" aria-hidden="true">Развитие</span>
            </button>
          </nav>
          <button
            ref={settingsButtonRef}
            type="button"
            className={`icon-button settings-button ${settingsVisible ? 'is-active' : ''}`}
            onClick={() => click(() => onSettingsOpen(!settingsOpen))}
            aria-label="Настройки"
            aria-expanded={settingsVisible}
            aria-controls="settings-dialog"
          >
            <span className="settings-glyph" aria-hidden="true">⚙</span>
            <span className="control-label" aria-hidden="true">Настройки</span>
          </button>
        </div>
      </header>

      {nextLockedRoom && !developmentVisible && !settingsVisible && (
        <button
          type="button"
          className={`expansion-progress ${snapshot.coins >= nextLockedRoom.unlockCost ? 'is-ready' : ''}`}
          onClick={() => click(() => {
            onVenueView(nextLockedRoom.id);
            onUpgradesOpen(true);
          })}
          aria-label={`Следующее расширение: ${nextLockedRoom.name}. ${snapshot.coins} из ${nextLockedRoom.unlockCost} монет`}
        >
          <span className="expansion-progress-icon" aria-hidden="true">{nextLockedRoom.icon}</span>
          <span className="expansion-progress-copy">
            <small>СЛЕДУЮЩЕЕ РАСШИРЕНИЕ</small>
            <b>{nextLockedRoom.shortName} · {formatCompactNumber(snapshot.coins)} / {formatCompactNumber(nextLockedRoom.unlockCost)}</b>
            <i aria-hidden="true"><span style={{ width: `${Math.min(100, snapshot.coins / nextLockedRoom.unlockCost * 100)}%` }} /></i>
          </span>
        </button>
      )}

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
              <h2 id="upgrade-panel-title">{venueView === 'bar' ? 'Улучшения бара' : activeRoomDefinition?.name}</h2>
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
            <button className={venueView === 'bar' ? 'is-active' : ''} onClick={() => selectVenue('bar')} role="tab" aria-selected={venueView === 'bar'}><span>🍺</span>Бар</button>
            {ROOM_DEFINITIONS.map((room) => {
              const state = snapshot.rooms.find((item) => item.id === room.id)!;
              return <button key={room.id} className={venueView === room.id ? 'is-active' : ''} onClick={() => selectVenue(room.id)} role="tab" aria-selected={venueView === room.id}><span>{room.icon}</span>{room.shortName}<i className={state.unlocked ? 'is-open' : ''} /></button>;
            })}
          </div>
        </div>
        {venueView === 'bar' ? (
          <>
            <div className="bar-analytics" data-bottleneck={snapshot.barDiagnostics.primaryBottleneck}>
              <span className="bar-analytics-icon" aria-hidden="true">📊</span>
              <span className="bar-analytics-copy">
                <small>{snapshot.barDiagnostics.primaryBottleneck === 'none' ? 'БАР РАБОТАЕТ РОВНО' : 'ТЕКУЩЕЕ УЗКОЕ МЕСТО'}</small>
                <b>{barRecommendation?.reason ?? 'Все доступные улучшения куплены'}</b>
                <em>Заказы {snapshot.barDiagnostics.waitingOrders} · напитки {snapshot.barDiagnostics.waitingDrinks} · грязные столы {snapshot.barDiagnostics.dirtyTables}</em>
              </span>
            </div>
            {snapshot.lastShiftSummary && (
              <div className="shift-summary" aria-label={`Итог ${snapshot.lastShiftSummary.dayNumber} дня`}>
                <span><small>ПРОШЛАЯ СМЕНА</small><b>+{snapshot.lastShiftSummary.operatingRevenue + snapshot.lastShiftSummary.bonus} 🪙</b></span>
                <span><small>Гостей</small><b>{snapshot.lastShiftSummary.servedThisShift}</b></span>
                <span><small>Комнаты</small><b>+{snapshot.lastShiftSummary.roomRevenueThisShift} 🪙</b></span>
                <span><small>Потеряно</small><b>{snapshot.lastShiftSummary.blockedArrivals}</b></span>
              </div>
            )}
            <div className="upgrade-list">
              {UPGRADE_DEFS.map((definition) => (
                <UpgradeCard
                  key={definition.key}
                  definition={definition}
                  snapshot={snapshot}
                  engine={engine}
                  recommendationReason={barRecommendation?.key === definition.key ? barRecommendation.reason : undefined}
                />
              ))}
            </div>
          </>
        ) : activeRoom ? <RoomDevelopment room={activeRoom} snapshot={snapshot} engine={engine} /> : null}
      </aside>

      <div className={`settings-layer ${settingsVisible ? 'is-open' : ''}`} aria-hidden={!settingsVisible} inert={!settingsVisible}>
        <button
          type="button"
          className="settings-backdrop"
          onClick={() => click(closeSettings)}
          aria-label="Закрыть настройки"
          tabIndex={settingsVisible ? 0 : -1}
        />
        <section ref={settingsDialogRef} id="settings-dialog" className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header className="settings-heading">
            <span className="settings-heading-icon" aria-hidden="true">⚙</span>
            <span>
              <small>ИГРА</small>
              <h2 id="settings-title">Настройки</h2>
            </span>
            <button
              ref={settingsCloseRef}
              type="button"
              className="panel-close settings-close"
              onClick={() => click(closeSettings)}
              aria-label="Закрыть настройки"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          {resetConfirming ? (
            <div className="reset-confirmation" role="alert" aria-labelledby="reset-confirm-title" aria-describedby="reset-confirm-description">
              <span className="reset-confirmation-icon" aria-hidden="true"><Icon name="reset" /></span>
              <h3 id="reset-confirm-title">Сбросить весь прогресс?</h3>
              <p id="reset-confirm-description">Будут удалены монеты, комнаты и все прокачки. Отменить это действие после подтверждения нельзя.</p>
              <div className="reset-confirmation-actions">
                <button ref={resetCancelRef} type="button" className="reset-cancel-button" onClick={() => click(cancelReset)}>Отмена</button>
                <button type="button" className="reset-confirm-button" onClick={() => click(confirmReset)}>
                  <Icon name="reset" />
                  Да, сбросить
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`settings-sound-toggle ${snapshot.soundEnabled ? 'is-on' : ''}`}
                onClick={toggleSound}
                aria-label={snapshot.soundEnabled ? 'Выключить звук' : 'Включить звук'}
                aria-pressed={snapshot.soundEnabled}
              >
                <span className="settings-sound-icon"><Icon name="sound" /></span>
                <span className="settings-sound-copy">
                  <b>Звук</b>
                  <small>{snapshot.soundEnabled ? 'Звуки интерфейса и событий включены' : 'Звуки интерфейса и событий выключены'}</small>
                </span>
                <span className="settings-switch" aria-hidden="true"><i /></span>
              </button>
              <div className="settings-save-note">
                <span aria-hidden="true">✓</span>
                <span><b>Автосохранение включено</b><small>Прогресс хранится в этом браузере.</small></span>
              </div>
              <div className="settings-danger-zone">
                <span className="eyebrow">ДАННЫЕ ИГРЫ</span>
                <p>Сброс удалит все покупки, комнаты и улучшения. Это действие нельзя отменить.</p>
                <button ref={resetButtonRef} className="reset-button" onClick={() => click(() => setResetConfirming(true))}>
                  <Icon name="reset" />
                  Сбросить прогресс
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {snapshot.started && (
        <div className="bottom-status">
          {activeRoom && activeRoomDefinition ? (
            <>
              <button className="bartender-pill focus-pill" onClick={() => selectVenue('bar')}>
                <span className="status-emoji">🍺</span>
                <span><small>КОМПЛЕКС</small><b>Вернуться в главный зал</b></span>
              </button>
              <button className="room-pill focus-pill" onClick={() => click(() => onUpgradesOpen(true))}>
                <span className="status-emoji">{activeRoomDefinition.icon}</span>
                <span><small>{activeRoomDefinition.staffRole}</small><b>{ROOM_STAFF_LABELS[activeRoom.staffState]} · {activeRoom.guests}/{activeRoom.capacity}</b></span>
              </button>
            </>
          ) : (
            <>
              <div className="bartender-pill">
                <span className="status-emoji">{bartenderStatus.emoji}</span>
                <span><small>БАРМЕН</small><b>{bartenderStatus.label}</b></span>
              </div>
              <button className="room-pill focus-pill" onClick={() => selectVenue(snapshot.rooms.find((room) => room.unlocked)?.id ?? 'karaoke')}>
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

        </>
      )}

      {!snapshot.started && (
        <div className="welcome-layer">
          <section className="welcome-card">
            <span className="welcome-kicker">3D БАР-МЕНЕДЖЕР</span>
            <h1>Хмель <i>&amp;</i> Мёд</h1>
            <p>Откройте бар, развивайте персонал и превратите маленький паб в комплекс с караоке, сауной и массажем.</p>
            <div className="welcome-loop">
              <span>🙋</span><i>→</i><span>📝</span><i>→</i><span>🍺</span><i>→</i><span>💰</span><i>→</i><span>😊</span>
            </div>
            <button className="start-button" onClick={() => click(engine.start)}>
              <Icon name="play" />
              Открыть бар
            </button>
            <small>Прогресс сохраняется автоматически</small>
          </section>
        </div>
      )}
    </div>
  );
}
