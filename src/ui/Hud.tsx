import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { getRoomDefinition, getRoomProfit, getRoomUpgradeCost, getUpgradeCost, ROOM_DEFINITIONS, ROOM_UPGRADE_DEFS, UPGRADE_DEFS } from '../game/config';
import type { GameEngine } from '../game/GameEngine';
import { gameAudio } from '../game/audio';
import type { BartenderState, GameSnapshot, RoomId, RoomState, RoomUpgradeKey, UpgradeDefinition, VenueView } from '../game/types';
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
  karaoke: {
    staffSpeed: { name: 'Опытный ведущий', description: 'Быстрее заводит публику и меняет песни.', icon: '⚡' },
    capacity: { name: 'Доп. микрофон', description: 'Ещё один гость поёт в каждом сеансе.', icon: '🎙️' },
    quality: { name: 'Звук и каталог', description: 'Хиты и чистый звук повышают средний чек.', icon: '🎵' },
  },
  sauna: {
    staffSpeed: { name: 'Умелый банщик', description: 'Быстрее готовит пар и обслуживает гостей.', icon: '🧖' },
    capacity: { name: 'Новая лавка', description: 'Добавляет место в каждом сеансе.', icon: '🪵' },
    quality: { name: 'Печь и кедр', description: 'Лучший жар и аромат повышают цену.', icon: '🔥' },
  },
  massage: {
    staffSpeed: { name: 'Техника мастера', description: 'Сокращает длительность процедуры.', icon: '🙌' },
    capacity: { name: 'Второй стол', description: 'Позволяет принять ещё одного клиента.', icon: '🛏️' },
    quality: { name: 'Масла и ароматы', description: 'Премиальный уход увеличивает оплату.', icon: '🌿' },
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

function CurrencyChip({ icon, value, label }: { icon: 'coins' | 'reputation' | 'customers'; value: number; label: string }) {
  return (
    <div className="currency-chip" title={label} aria-label={`${label}: ${value}`}>
      <Icon name={icon} />
      <strong>{value.toLocaleString('ru-RU')}</strong>
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
  const nextIncome = getRoomProfit(room.id, room.upgrades.quality, room.capacity);
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
        <span className={`staff-avatar state-${room.staffState}`}>🧑‍💼</span>
        <span>
          <small>ПЕРСОНАЛ · {definition.staffRole}</small>
          <b>{ROOM_STAFF_LABELS[room.staffState]}</b>
          <i><span style={{ width: `${Math.round(room.progress * 100)}%` }} /></i>
        </span>
        <strong>{room.guests}/{room.capacity}</strong>
      </div>
      <div className="room-economy-grid">
        <span><small>За сеанс</small><b>{nextIncome} 🪙</b></span>
        <span><small>Выручка</small><b>{room.revenue} 🪙</b></span>
        <span><small>Сеансов</small><b>{room.completedSessions}</b></span>
      </div>
      <div className="room-upgrade-list">
        {ROOM_UPGRADE_DEFS.map((upgrade) => {
          const copy = ROOM_UPGRADE_COPY[room.id][upgrade.key];
          const level = room.upgrades[upgrade.key];
          const maxLevel = upgrade.key === 'capacity' ? definition.maxCapacity : upgrade.maxLevel;
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
  const nextDrink = useMemo(() => {
    const currentLevel = snapshot.upgrades.assortment;
    return currentLevel < 5 ? `Следующий напиток на ${currentLevel + 1} уровне` : 'Вся карта открыта';
  }, [snapshot.upgrades.assortment]);

  const click = (action: () => void) => {
    gameAudio.unlock();
    gameAudio.click();
    action();
  };

  const selectVenue = (view: VenueView) => click(() => onVenueView(view));

  const reset = () => {
    if (window.confirm('Сбросить прогресс бара и начать заново?')) {
      engine.resetProgress();
      onVenueView('bar');
    }
  };

  return (
    <div className={`hud ${snapshot.started ? 'is-running' : 'is-welcome'}`}>
      <header className="top-hud" inert={!snapshot.started}>
        <div className="brand-card">
          <span className="brand-mark">H&amp;H</span>
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
            className={`icon-button upgrades-toggle ${upgradesOpen ? 'is-active' : ''}`}
            onClick={() => click(() => onUpgradesOpen(!upgradesOpen))}
            aria-label="Улучшения бара"
            aria-expanded={snapshot.started && upgradesOpen}
            aria-controls="upgrade-panel"
          >
            <Icon name="upgrade-arrow" />
            <span className="control-label" aria-hidden="true">Развитие</span>
          </button>
        </nav>
      </header>

      <button
        type="button"
        className={`upgrade-backdrop ${snapshot.started && upgradesOpen ? 'is-open' : ''}`}
        onClick={() => click(() => onUpgradesOpen(false))}
        aria-label="Закрыть меню улучшений"
        aria-hidden={!snapshot.started || !upgradesOpen}
        tabIndex={snapshot.started && upgradesOpen ? 0 : -1}
        inert={!snapshot.started || !upgradesOpen}
      />

      <aside
        id="upgrade-panel"
        className={`upgrade-panel ${upgradesOpen ? 'is-open' : ''} ${venueView === 'bar' ? '' : 'is-room-view'}`}
        aria-hidden={!snapshot.started || !upgradesOpen}
        inert={!snapshot.started || !upgradesOpen}
        aria-labelledby="upgrade-panel-title"
      >
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
        {venueView === 'bar' ? (
          <>
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
          {snapshot.lastEvent.message}
        </div>
      )}

      {snapshot.paused && snapshot.started && (
        <div className="pause-scrim">
          <div className="pause-card">
            <Icon name="pause" />
            <b>Бар на паузе</b>
            <span>Гости терпеливо подождут.</span>
          </div>
        </div>
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
