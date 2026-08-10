import {
  DRINKS,
  getArrivalInterval,
  getAverageDrinkPrice,
  getBartenderMoveSpeed,
  getCleaningDuration,
  getOrderDuration,
  getPreparationDuration,
  getRoomDefinition,
  getRoomProfit,
  getRoomSessionDuration,
} from '../game/config';
import type { RoomId, RoomUpgradeKey, UpgradeDefinition } from '../game/types';

export type UpgradeEffect = {
  label: string;
  current: string;
  next: string | null;
  unit: string;
  detail: string;
  ariaLabel: string;
  currentValue: number;
  nextValue: number | null;
};

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');
const percent = (value: number) => Math.round(value * 100);
const signedDecimal = (value: number, digits: number) => `${value >= 0 ? '+' : '−'}${decimal(Math.abs(value), digits)}`;

const speedEffect = (
  label: string,
  level: number,
  maxLevel: number,
  getter: (targetLevel: number) => number,
  context: string,
): UpgradeEffect => {
  const currentValue = getter(level);
  const nextValue = level < maxLevel ? getter(level + 1) : null;
  const baseline = getter(1);
  const current = decimal(currentValue, 2);
  const next = nextValue === null ? null : decimal(nextValue, 2);
  const detail = nextValue === null
    ? `От старта ${signedDecimal(currentValue - baseline, 2)} м/с (${signedDecimal((currentValue / baseline - 1) * 100, 0)}%)`
    : `${context}: ${signedDecimal(nextValue - currentValue, 2)} м/с (${signedDecimal((nextValue / currentValue - 1) * 100, 0)}%)`;

  return {
    label,
    current,
    next,
    unit: 'м/с',
    detail,
    ariaLabel: `${label}: ${current}${next ? ` → ${next}` : ''} м/с. ${detail}`,
    currentValue,
    nextValue,
  };
};

const durationEffect = (
  label: string,
  level: number,
  maxLevel: number,
  getter: (targetLevel: number) => number,
  context: string,
): UpgradeEffect => {
  const currentValue = getter(level);
  const nextValue = level < maxLevel ? getter(level + 1) : null;
  const baseline = getter(1);
  const current = decimal(currentValue, 2);
  const next = nextValue === null ? null : decimal(nextValue, 2);
  const detail = nextValue === null
    ? `От старта −${decimal(baseline - currentValue, 2)} с (−${percent(1 - currentValue / baseline)}%)`
    : `${context}: −${decimal(currentValue - nextValue, 2)} с (−${percent(1 - nextValue / currentValue)}%)`;

  return {
    label,
    current,
    next,
    unit: 'с',
    detail,
    ariaLabel: `${label}: ${current}${next ? ` → ${next}` : ''} секунды. ${detail}`,
    currentValue,
    nextValue,
  };
};

export function getBarUpgradeEffect(definition: UpgradeDefinition, level: number, cost: number): UpgradeEffect {
  const maxLevel = definition.maxLevel;
  switch (definition.key) {
    case 'moveSpeed':
      return speedEffect('Скорость бармена', level, maxLevel, getBartenderMoveSpeed, 'Ходьба к столам');
    case 'orderSpeed':
      return durationEffect('Приём заказа', level, maxLevel, getOrderDuration, 'Разговор с гостем');
    case 'prepSpeed':
      return durationEffect('Приготовление', level, maxLevel, getPreparationDuration, 'Налив напитка');
    case 'cleanSpeed':
      return durationEffect('Уборка стола', level, maxLevel, getCleaningDuration, 'Освобождение стола');
    case 'assortment': {
      const currentValue = getAverageDrinkPrice(level);
      const nextValue = level < maxLevel ? getAverageDrinkPrice(level + 1) : null;
      const current = `≈${decimal(currentValue, 1)}`;
      const next = nextValue === null ? null : `≈${decimal(nextValue, 1)}`;
      const nextDrink = nextValue === null ? null : DRINKS.find((drink) => drink.level === level + 1) ?? null;
      const ordersToPayback = nextValue === null ? null : Math.ceil(cost / Math.max(0.01, nextValue - currentValue));
      const detail = nextDrink && ordersToPayback
        ? `Новый: ${nextDrink.name} · ${nextDrink.price} 🪙 · окуп. ≈${ordersToPayback} заказов`
        : `${DRINKS.filter((drink) => drink.level <= level).length} напитков · максимум чека ${DRINKS[Math.min(level, DRINKS.length) - 1]?.price ?? DRINKS[0].price} 🪙`;
      return {
        label: 'Средняя цена без чаевых',
        current,
        next,
        unit: '🪙',
        detail,
        ariaLabel: `Средняя цена напитка без чаевых: ${current}${next ? ` → ${next}` : ''} монет. ${detail}`,
        currentValue,
        nextValue,
      };
    }
    case 'advertising': {
      const currentValue = getArrivalInterval(level);
      const nextValue = level < maxLevel ? getArrivalInterval(level + 1) : null;
      const current = decimal(currentValue, 2);
      const next = nextValue === null ? null : decimal(nextValue, 2);
      const currentFlow = 60 / currentValue;
      const nextFlow = nextValue === null ? null : 60 / nextValue;
      const detail = nextFlow === null
        ? `Поток до ${decimal(currentFlow, 1)} гостя/мин · при свободном столе`
        : `Поток ${decimal(currentFlow, 1)} → ${decimal(nextFlow, 1)} гостя/мин · при свободном столе`;
      return {
        label: 'Средний приход гостя',
        current,
        next,
        unit: 'с',
        detail,
        ariaLabel: `Средний приход гостя: ${current}${next ? ` → ${next}` : ''} секунды. ${detail}`,
        currentValue,
        nextValue,
      };
    }
  }
}

export function getRoomUpgradeEffect(
  roomId: RoomId,
  key: RoomUpgradeKey,
  level: number,
  maxLevel: number,
  capacity: number,
  quality: number,
  cost: number,
): UpgradeEffect {
  const definition = getRoomDefinition(roomId);
  if (key === 'staffSpeed') {
    const currentValue = getRoomSessionDuration(roomId, level);
    const nextValue = level < maxLevel ? getRoomSessionDuration(roomId, level + 1) : null;
    const current = decimal(currentValue, 2);
    const next = nextValue === null ? null : decimal(nextValue, 2);
    const detail = nextValue === null
      ? `Рабочие этапы −${percent(1 - currentValue / definition.sessionDuration)}% · ожидание не меняется`
      : `Сеанс, уборка, подготовка −${percent(1 - nextValue / currentValue)}% · без ожидания гостей`;
    return {
      label: 'Длительность сеанса',
      current,
      next,
      unit: 'с',
      detail,
      ariaLabel: `Длительность сеанса: ${current}${next ? ` → ${next}` : ''} секунды. ${detail}`,
      currentValue,
      nextValue,
    };
  }

  if (key === 'capacity') {
    const currentValue = capacity;
    const nextValue = level < maxLevel ? Math.min(definition.maxCapacity, capacity + 1) : null;
    const currentProfit = getRoomProfit(roomId, quality, currentValue);
    const nextProfit = nextValue === null ? null : getRoomProfit(roomId, quality, nextValue);
    const sessionsToPayback = nextProfit === null ? null : Math.ceil(cost / Math.max(1, nextProfit - currentProfit));
    const detail = nextProfit === null
      ? `Полный сеанс: ${currentProfit} 🪙 · при полном составе`
      : `Полный сеанс: ${currentProfit} → ${nextProfit} 🪙 · окуп. ≈${sessionsToPayback} полн. сеансов`;
    return {
      label: 'Вместимость',
      current: String(currentValue),
      next: nextValue === null ? null : String(nextValue),
      unit: 'мест',
      detail,
      ariaLabel: `Вместимость: ${currentValue}${nextValue === null ? '' : ` → ${nextValue}`} мест. ${detail}`,
      currentValue,
      nextValue,
    };
  }

  const currentValue = getRoomProfit(roomId, quality, 1);
  const nextValue = level < maxLevel ? getRoomProfit(roomId, quality + 1, 1) : null;
  const currentSession = getRoomProfit(roomId, quality, capacity);
  const nextSession = nextValue === null ? null : getRoomProfit(roomId, quality + 1, capacity);
  const guestsToPayback = nextValue === null ? null : Math.ceil(cost / Math.max(1, nextValue - currentValue));
  const detail = nextSession === null
    ? `Полный сеанс: ${currentSession} 🪙 при ${capacity} мест.`
    : `Полный сеанс: ${currentSession} → ${nextSession} 🪙 · окуп. ≈${guestsToPayback} гостей`;
  return {
    label: 'Доход с гостя',
    current: String(currentValue),
    next: nextValue === null ? null : String(nextValue),
    unit: '🪙',
    detail,
    ariaLabel: `Доход с гостя: ${currentValue}${nextValue === null ? '' : ` → ${nextValue}`} монет. ${detail}`,
    currentValue,
    nextValue,
  };
}
