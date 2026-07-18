import { useMemo, useState } from 'react';
import { getUpgradeCost, UPGRADE_DEFS } from '../game/config';
import type { GameEngine } from '../game/GameEngine';
import { gameAudio } from '../game/audio';
import type { BartenderState, GameSnapshot, UpgradeDefinition } from '../game/types';
import { Icon } from './Icon';

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
};

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

export function Hud({ engine, snapshot }: Props) {
  const [upgradesOpen, setUpgradesOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 980);
  const bartenderStatus = BARTENDER_STATUS[snapshot.bartender.state];
  const nextDrink = useMemo(() => {
    const currentLevel = snapshot.upgrades.assortment;
    return currentLevel < 5 ? `Следующий напиток на ${currentLevel + 1} уровне` : 'Вся карта открыта';
  }, [snapshot.upgrades.assortment]);

  const click = (action: () => void) => {
    gameAudio.unlock();
    gameAudio.click();
    action();
  };

  const reset = () => {
    if (window.confirm('Сбросить прогресс бара и начать заново?')) engine.resetProgress();
  };

  return (
    <div className={`hud ${snapshot.started ? 'is-running' : 'is-welcome'}`}>
      <header className="top-hud" inert={!snapshot.started}>
        <div className="brand-card">
          <span className="brand-mark">H&amp;H</span>
          <span className="brand-copy">
            <strong>ХМЕЛЬ &amp; МЁД</strong>
            <small>день {snapshot.day} · уютный бар</small>
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
            onClick={() => click(() => setUpgradesOpen((value) => !value))}
            aria-label="Улучшения бара"
            aria-expanded={snapshot.started && upgradesOpen}
            aria-controls="upgrade-panel"
          >
            <Icon name="upgrade-arrow" />
            <span className="control-label" aria-hidden="true">Апгрейд</span>
          </button>
        </nav>
      </header>

      <button
        type="button"
        className={`upgrade-backdrop ${snapshot.started && upgradesOpen ? 'is-open' : ''}`}
        onClick={() => click(() => setUpgradesOpen(false))}
        aria-label="Закрыть меню улучшений"
        aria-hidden={!snapshot.started || !upgradesOpen}
        tabIndex={snapshot.started && upgradesOpen ? 0 : -1}
        inert={!snapshot.started || !upgradesOpen}
      />

      <aside
        id="upgrade-panel"
        className={`upgrade-panel ${upgradesOpen ? 'is-open' : ''}`}
        aria-hidden={!snapshot.started || !upgradesOpen}
        inert={!snapshot.started || !upgradesOpen}
        aria-labelledby="upgrade-panel-title"
      >
        <span className="panel-handle" aria-hidden="true" />
        <div className="panel-heading">
          <div>
            <span className="eyebrow">МЕНЮ РАЗВИТИЯ</span>
            <h2 id="upgrade-panel-title">Улучшения бара</h2>
          </div>
          <Icon name="upgrade-arrow" />
          <button
            type="button"
            className="panel-close"
            onClick={() => click(() => setUpgradesOpen(false))}
            aria-label="Закрыть улучшения"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
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
        <button className="reset-button" onClick={() => click(reset)}>
          <Icon name="reset" />
          Сбросить прогресс
        </button>
      </aside>

      {snapshot.started && (
        <div className="bottom-status">
          <div className="bartender-pill">
            <span className="status-emoji">{bartenderStatus.emoji}</span>
            <span>
              <small>БАРМЕН</small>
              <b>{bartenderStatus.label}</b>
            </span>
          </div>
          <div className="room-pill">
            <Icon name="customers" />
            <span>
              <small>ЗАЛ</small>
              <b>{snapshot.patrons.length}/6 гостей · {snapshot.queueCount} ждут</b>
            </span>
          </div>
        </div>
      )}

      {snapshot.lastEvent && (
        <div className={`event-toast event-${snapshot.lastEvent.kind}`} key={snapshot.lastEvent.id} aria-live="polite" role="status">
          <span>{snapshot.lastEvent.kind === 'payment' ? '🪙' : snapshot.lastEvent.kind === 'upgrade' ? '⬆️' : snapshot.lastEvent.kind === 'reputation' ? '⭐' : '🎉'}</span>
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
            <p>Гости уже у двери. Прокачивайте бармена, открывайте напитки и превращайте маленький паб в любимое место города.</p>
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
