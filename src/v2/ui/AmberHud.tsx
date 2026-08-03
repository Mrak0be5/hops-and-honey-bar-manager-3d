import type { CSSProperties, MouseEvent } from 'react';
import {
  clampProgress,
  getRoomView,
  type RoomVenueId,
  type VenueId,
  type ViewAction,
  type ViewRoom,
  type ViewRoomStatus,
  type ViewSnapshot,
  type ViewUpgrade,
} from '../view/model';

export type AmberHudProps = {
  snapshot: ViewSnapshot;
  focus: VenueId;
  drawerOpen: boolean;
  onAction: (action: ViewAction) => void;
};

type GlyphName =
  | 'bar'
  | 'karaoke'
  | 'sauna'
  | 'massage'
  | 'coin'
  | 'star'
  | 'pause'
  | 'play'
  | 'speed'
  | 'sound'
  | 'mute'
  | 'lock'
  | 'upgrade'
  | 'people'
  | 'close'
  | 'chevron';

const GLYPH_PATHS: Record<GlyphName, string> = {
  bar: 'M4 5h16l-2 5H6L4 5Zm3 7h10v7H7v-7Zm-2 7h14v2H5v-2Z',
  karaoke: 'M14.7 3.3a5 5 0 0 1 0 7.1l-1.2 1.2-1.4-1.4 1.2-1.2a3 3 0 1 0-4.2-4.2L7.8 6.1 6.4 4.7l1.3-1.4a5 5 0 0 1 7 0ZM6.2 8.1l9.7 9.7-2.1 2.1-2.4-2.4-2.8 2.8-1.4-1.4 2.8-2.8-6-5.9 2.2-2.1Z',
  sauna: 'M5 19h14v2H5v-2Zm1-4h12v2H6v-2Zm1-4h10v2H7v-2Zm3.2-8c2 1.6-.4 2.6.9 4.1.7.8 1.8.2 1.9-.7.1-.8-.6-1.2-.8-1.8-.4-1.1.4-2 .4-2s2.5 1.6 1.9 4.1c-.5 2.3-3.7 3.2-5.1 1.1C7.6 5.7 10.2 3 10.2 3Z',
  massage: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 11h14v2h-2v8h-2v-6h-2v6h-2v-6H9v6H7v-8H5v-2Z',
  coin: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm1 2v1.1c1.5.3 2.5 1.3 2.5 2.7h-2c0-.6-.6-1-1.5-1s-1.5.4-1.5 1c0 .5.5.7 1.9 1 2.1.5 3.1 1.3 3.1 2.8 0 1.4-1 2.4-2.5 2.7V18h-2v-1.1c-1.6-.3-2.7-1.3-2.7-2.8h2c0 .7.7 1.1 1.7 1.1s1.5-.4 1.5-1c0-.5-.5-.8-1.9-1.1-2-.5-3.1-1.2-3.1-2.7 0-1.3 1-2.3 2.5-2.6V7h2Z',
  star: 'm12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3Z',
  pause: 'M7 5h4v14H7V5Zm6 0h4v14h-4V5Z',
  play: 'm8 5 11 7-11 7V5Z',
  speed: 'M12 4a9 9 0 0 1 8.7 11.2h-2.1A7 7 0 1 0 5.4 15.2H3.3A9 9 0 0 1 12 4Zm4.9 3.7-3.2 6.1a2.4 2.4 0 1 1-1.8-1.8l5-4.3Z',
  sound: 'M4 9h4l5-4v14l-5-4H4V9Zm11.5.1a4 4 0 0 1 0 5.8l-1.4-1.4a2 2 0 0 0 0-3l1.4-1.4Zm2.8-2.8a8 8 0 0 1 0 11.4l-1.4-1.4a6 6 0 0 0 0-8.6l1.4-1.4Z',
  mute: 'M4 9h4l5-4v14l-5-4H4V9Zm12.2.2 1.6 1.6 1.6-1.6 1.4 1.4-1.6 1.6 1.6 1.6-1.4 1.4-1.6-1.6-1.6 1.6-1.4-1.4 1.6-1.6-1.6-1.6 1.4-1.4Z',
  lock: 'M7 10V8a5 5 0 0 1 10 0v2h2v11H5V10h2Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 3a2 2 0 0 0-1 3.7V19h2v-2.3A2 2 0 0 0 12 13Z',
  upgrade: 'm12 3 5 5h-3v5h-4V8H7l5-5Zm-7 12h14v6H5v-6Zm2 2v2h10v-2H7Z',
  people: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm7 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1Zm14.2-5.7c3.3.1 5.8 2.2 5.8 4.9V21h-4v-1c0-2.2-.7-4.2-1.8-5.7Z',
  close: 'm6.3 4.9 5.7 5.7 5.7-5.7 1.4 1.4-5.7 5.7 5.7 5.7-1.4 1.4-5.7-5.7-5.7 5.7-1.4-1.4 5.7-5.7-5.7-5.7 1.4-1.4Z',
  chevron: 'm9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5Z',
};

const ROOM_LABELS: Record<VenueId, { title: string; eyebrow: string; glyph: GlyphName }> = {
  bar: { title: 'Главный бар', eyebrow: 'Всегда открыт', glyph: 'bar' },
  karaoke: { title: 'Караоке', eyebrow: 'Шоу и напитки', glyph: 'karaoke' },
  sauna: { title: 'Сауна', eyebrow: 'Пар и отдых', glyph: 'sauna' },
  massage: { title: 'Массаж', eyebrow: 'Премиум-сервис', glyph: 'massage' },
};

const STATUS_LABELS: Record<ViewRoomStatus, string> = {
  locked: 'Требует ремонта',
  renovating: 'Идёт ремонт',
  open: 'Открыта',
  welcoming: 'Встречает гостей',
  serving: 'Обслуживание',
  resetting: 'Подготовка',
};

const LIFECYCLE_STEP: Record<ViewRoom['lifecycle'], number> = {
  locked: 0,
  permitted: 1,
  renovating: 2,
  equipping: 3,
  open: 4,
};

const LIFECYCLE_ACTIONS: Record<NonNullable<ViewRoom['nextStageId']>, { button: string; description: string; title: string }> = {
  permit: {
    title: 'Проект и разрешение',
    button: 'Оплатить проект',
    description: 'Открывает доступ к работам и показывает будущую экономику помещения.',
  },
  renovate: {
    title: 'Основной ремонт',
    button: 'Начать ремонт',
    description: 'Строители приводят стены, пол, коммуникации и вход в рабочее состояние.',
  },
  equip: {
    title: 'Оснащение комнаты',
    button: 'Купить оснащение',
    description: 'Добавляет мебель, оборудование, фирменный свет и сервисные станции.',
  },
  hire: {
    title: 'Найм специалиста',
    button: 'Нанять и открыть',
    description: 'Закрепляет сотрудника за комнатой и разрешает гостям выбирать её после бара.',
  },
};

const COMPACT_NUMBER = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatAmberNumber = (value: number) => (
  COMPACT_NUMBER.format(Number.isFinite(value) ? Math.max(0, value) : 0)
);

function Glyph({ name, size = 22 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="amber-glyph"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={GLYPH_PATHS[name]} />
    </svg>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const progress = clampProgress(value);
  const style = { '--amber-progress': `${progress * 100}%` } as CSSProperties;

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress * 100)}
      className="amber-progress"
      role="progressbar"
      style={style}
    >
      <span />
    </div>
  );
}

function ResourceChip({ glyph, label, value }: { glyph: GlyphName; label: string; value: number }) {
  return (
    <div className="amber-resource" title={`${label}: ${Math.max(0, value).toLocaleString('ru-RU')}`}>
      <span className="amber-resource__glyph"><Glyph name={glyph} size={18} /></span>
      <span className="amber-resource__value">{formatAmberNumber(value)}</span>
      <span className="amber-sr-only">{label}</span>
    </div>
  );
}

function IconButton({
  glyph,
  label,
  onClick,
  pressed,
  children,
}: {
  glyph: GlyphName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="amber-icon-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <Glyph name={glyph} size={20} />
      {children}
    </button>
  );
}

function RoomRail({
  snapshot,
  focus,
  drawerOpen,
  onAction,
}: AmberHudProps) {
  const handleRoomClick = (venueId: VenueId) => {
    if (focus === venueId) {
      onAction({ type: 'toggle-drawer' });
      return;
    }
    onAction({ type: 'focus', venueId });
  };

  return (
    <nav aria-label="Комнаты клуба" className="amber-room-rail">
      {(['bar', 'karaoke', 'sauna', 'massage'] as const).map((venueId) => {
        const meta = ROOM_LABELS[venueId];
        const room = venueId === 'bar' ? null : getRoomView(snapshot, venueId);
        const locked = room ? !room.unlocked : false;
        const active = focus === venueId;

        return (
          <button
            aria-current={active ? 'location' : undefined}
            aria-expanded={active ? drawerOpen : undefined}
            className={`amber-room-tab${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
            key={venueId}
            onClick={() => handleRoomClick(venueId)}
            title={meta.title}
            type="button"
          >
            <span className="amber-room-tab__icon"><Glyph name={meta.glyph} size={23} /></span>
            <span className="amber-room-tab__label">{meta.title}</span>
            {locked ? <span className="amber-room-tab__lock"><Glyph name="lock" size={11} /></span> : null}
            {room?.unlocked ? (
              <span className="amber-room-tab__count">{room.guests}/{room.capacity}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function UpgradeCard({
  upgrade,
  venueId,
  onAction,
}: {
  upgrade: ViewUpgrade;
  venueId: VenueId;
  onAction: (action: ViewAction) => void;
}) {
  const complete = upgrade.level >= upgrade.maxLevel;
  const disabled = complete || !upgrade.affordable;

  return (
    <article className={`amber-upgrade${complete ? ' is-complete' : ''}`}>
      <div className="amber-upgrade__icon"><Glyph name="upgrade" size={19} /></div>
      <div className="amber-upgrade__copy">
        <div className="amber-upgrade__title-row">
          <h4>{upgrade.title}</h4>
          <span>ур. {upgrade.level}/{upgrade.maxLevel}</span>
        </div>
        <p>{upgrade.description}</p>
        <ProgressBar
          label={`Уровень улучшения ${upgrade.title}`}
          value={upgrade.maxLevel > 0 ? upgrade.level / upgrade.maxLevel : 1}
        />
      </div>
      <button
        className="amber-buy-button"
        disabled={disabled}
        onClick={() => onAction({ type: 'purchase-upgrade', venueId, upgradeId: upgrade.id })}
        title={!upgrade.affordable && !complete ? 'Недостаточно монет' : undefined}
        type="button"
      >
        {complete ? (
          'Готово'
        ) : (
          <><Glyph name="coin" size={14} /> {formatAmberNumber(upgrade.cost)}</>
        )}
      </button>
    </article>
  );
}

function RoomDrawer({
  snapshot,
  focus,
  drawerOpen,
  onAction,
}: AmberHudProps) {
  const meta = ROOM_LABELS[focus];
  const room = focus === 'bar' ? null : getRoomView(snapshot, focus as RoomVenueId);
  const upgrades = focus === 'bar' ? (snapshot.barUpgrades ?? []) : (room?.upgrades ?? []);
  const isLocked = room ? !room.unlocked : false;
  const roomProgress = room?.sessionProgress ?? 0;

  return (
    <aside
      aria-hidden={!drawerOpen}
      aria-label={`Управление: ${meta.title}`}
      className={`amber-room-drawer${drawerOpen ? ' is-open' : ''}`}
    >
      <header className="amber-room-drawer__header">
        <span className="amber-room-drawer__hero"><Glyph name={meta.glyph} size={27} /></span>
        <div>
          <span className="amber-eyebrow">{meta.eyebrow}</span>
          <h2>{meta.title}</h2>
        </div>
        <IconButton
          glyph="close"
          label="Закрыть панель"
          onClick={() => onAction({ type: 'toggle-drawer' })}
        />
      </header>

      {room ? (
        <div className="amber-room-drawer__status">
          <span className={`amber-status amber-status--${room.status}`}>{STATUS_LABELS[room.status]}</span>
          <span><Glyph name="people" size={16} /> {room.guests}/{room.capacity}</span>
          <span><Glyph name="coin" size={16} /> {formatAmberNumber(room.revenue)}</span>
        </div>
      ) : (
        <div className="amber-room-drawer__status">
          <span className="amber-status amber-status--open">Сердце клуба</span>
          <span><Glyph name="people" size={16} /> {snapshot.served} обслужено</span>
        </div>
      )}

      {room?.staffLabel ? (
        <p className="amber-staff-line">
          <span>Персонал</span>
          {room.staffLabel}{room.staffHired ? ` · ${formatAmberNumber(room.salaryPerShift)} / смену` : ''}
        </p>
      ) : null}

      {room && !isLocked && roomProgress > 0 ? (
        <div className="amber-session-progress">
          <div><span>Текущая сессия</span><strong>{Math.round(clampProgress(roomProgress) * 100)}%</strong></div>
          <ProgressBar label="Прогресс обслуживания" value={roomProgress} />
        </div>
      ) : null}

      {room && isLocked ? (
        <div className="amber-unlock-card">
          <span className="amber-unlock-card__icon"><Glyph name="lock" size={27} /></span>
          <h3>{room.nextStageId ? LIFECYCLE_ACTIONS[room.nextStageId].title : 'Комната готова'}</h3>
          <p>{room.nextStageId ? LIFECYCLE_ACTIONS[room.nextStageId].description : 'Все этапы подготовки завершены.'}</p>
          <div className="amber-room-economy">
            <span>Доход с гостя <strong>{formatAmberNumber(room.projectedRevenuePerGuest)}</strong></span>
            <span>Сеанс <strong>{room.serviceSeconds} сек.</strong></span>
            <span>Полное открытие <strong>{formatAmberNumber(room.totalOpenCost)}</strong></span>
          </div>
          <div className="amber-renovation-steps" aria-label={`Открытие: ${LIFECYCLE_STEP[room.lifecycle]} из 4 этапов`}>
            {[1, 2, 3, 4].map((stage) => (
              <span className={stage <= LIFECYCLE_STEP[room.lifecycle] ? 'is-complete' : ''} key={stage}>{stage}</span>
            ))}
          </div>
          <button
            className="amber-primary-button"
            disabled={!room.nextStageId || snapshot.coins < room.nextStageCost}
            onClick={() => onAction({ type: 'purchase-room', roomId: room.id })}
            type="button"
          >
            {room.nextStageId ? LIFECYCLE_ACTIONS[room.nextStageId].button : 'Готово'} <span><Glyph name="coin" size={16} /> {formatAmberNumber(room.nextStageCost)}</span>
          </button>
          {snapshot.coins < room.nextStageCost ? <small>Нужно ещё {formatAmberNumber(room.nextStageCost - snapshot.coins)}</small> : null}
        </div>
      ) : (
        <section className="amber-upgrades" aria-label="Улучшения комнаты">
          <div className="amber-section-title">
            <h3>Улучшения</h3>
            <span>{upgrades.length}</span>
          </div>
          {upgrades.length > 0 ? upgrades.map((upgrade) => (
            <UpgradeCard key={upgrade.id} onAction={onAction} upgrade={upgrade} venueId={focus} />
          )) : (
            <p className="amber-empty-copy">Новые улучшения появятся после следующего этапа клуба.</p>
          )}
        </section>
      )}
    </aside>
  );
}

function ObjectiveCard({ snapshot }: { snapshot: ViewSnapshot }) {
  const objective = snapshot.objective;
  if (!objective) return null;

  const target = Math.max(1, objective.target);

  return (
    <section aria-label="Цель смены" className="amber-objective">
      <span className="amber-eyebrow">Цель смены</span>
      <div className="amber-objective__row">
        <strong>{objective.label}</strong>
        <span>{Math.max(0, objective.current)}/{target}</span>
      </div>
      <ProgressBar label={objective.label} value={objective.current / target} />
      {objective.reward ? <small>Награда · {objective.reward}</small> : null}
    </section>
  );
}

function StartShiftCard({ onAction }: Pick<AmberHudProps, 'onAction'>) {
  return (
    <section className="amber-start-card">
      <span className="amber-start-card__mark"><Glyph name="bar" size={30} /></span>
      <span className="amber-eyebrow">Amber Club</span>
      <h1>Вечер начинается</h1>
      <p>Сначала гости знакомятся с баром, затем сами выбирают караоке, сауну или массаж.</p>
      <button className="amber-primary-button" onClick={() => onAction({ type: 'start-shift' })} type="button">
        Открыть смену <Glyph name="chevron" size={17} />
      </button>
    </section>
  );
}

export function AmberHud(props: AmberHudProps) {
  const { snapshot, focus, drawerOpen, onAction } = props;

  const stopBackdrop = (event: MouseEvent<HTMLElement>) => {
    if (event.currentTarget === event.target && drawerOpen) onAction({ type: 'toggle-drawer' });
  };

  return (
    <div className="amber-hud" onClick={stopBackdrop}>
      <header className="amber-hud__top">
        <div className="amber-shift-card">
          <span className="amber-shift-card__logo"><Glyph name="bar" size={20} /></span>
          <div>
            <div className="amber-shift-card__line">
              <strong>День {Math.max(1, snapshot.day)}</strong>
              <span>{Math.round(clampProgress(snapshot.shiftProgress) * 100)}%</span>
            </div>
            <ProgressBar label="Прогресс смены" value={snapshot.shiftProgress} />
          </div>
        </div>

        <div aria-label="Ресурсы клуба" className="amber-resources">
          <ResourceChip glyph="coin" label="Монеты" value={snapshot.coins} />
          <ResourceChip glyph="star" label="Престиж" value={snapshot.prestige} />
        </div>

        <div className="amber-controls">
          <IconButton
            glyph={snapshot.paused ? 'play' : 'pause'}
            label={snapshot.paused ? 'Продолжить игру' : 'Пауза'}
            onClick={() => onAction({ type: 'toggle-pause' })}
            pressed={snapshot.paused}
          />
          <IconButton glyph="speed" label="Изменить скорость" onClick={() => onAction({ type: 'toggle-speed' })}>
            <span className="amber-icon-button__badge">×{snapshot.speed}</span>
          </IconButton>
          <IconButton
            glyph={snapshot.soundEnabled ? 'sound' : 'mute'}
            label={snapshot.soundEnabled ? 'Выключить звук' : 'Включить звук'}
            onClick={() => onAction({ type: 'toggle-sound' })}
            pressed={snapshot.soundEnabled}
          />
        </div>
      </header>

      <RoomRail {...props} />
      <ObjectiveCard snapshot={snapshot} />
      <RoomDrawer {...props} />

      {snapshot.paused && snapshot.started ? (
        <button className="amber-paused-chip" onClick={() => onAction({ type: 'toggle-pause' })} type="button">
          <Glyph name="play" size={16} /> Продолжить
        </button>
      ) : null}

      {!snapshot.started ? <StartShiftCard onAction={onAction} /> : null}
    </div>
  );
}
