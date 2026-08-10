import '../../domain/config.dart';
import '../../domain/models.dart';
import '../core/formatters.dart';

class UpgradeEffectView {
  const UpgradeEffectView({
    required this.title,
    required this.iconAsset,
    required this.primary,
    required this.secondary,
  });

  final String title;
  final String iconAsset;
  final String primary;
  final String secondary;
}

UpgradeEffectView barUpgradeEffect(UpgradeKey key, int level) {
  final definition = upgradeDefinition(key);
  final maxed = level >= definition.maxLevel;
  final nextLevel = maxed ? level : level + 1;
  final suffix = maxed ? ' · максимум' : '';

  return switch (key) {
    UpgradeKey.moveSpeed => UpgradeEffectView(
      title: 'Ловкие ноги',
      iconAsset: 'move-speed',
      primary:
          'Скорость ${formatDecimal(getBartenderMoveSpeed(level))}${maxed ? '' : ' → ${formatDecimal(getBartenderMoveSpeed(nextLevel))}'} м/с$suffix',
      secondary: maxed
          ? 'Бармен перемещается с максимальной скоростью.'
          : 'Экономия времени на каждом маршруте по бару.',
    ),
    UpgradeKey.orderSpeed => UpgradeEffectView(
      title: 'Быстрый заказ',
      iconAsset: 'order-speed',
      primary:
          'Приём ${formatDecimal(getOrderDuration(level))}${maxed ? '' : ' → ${formatDecimal(getOrderDuration(nextLevel))}'} с$suffix',
      secondary: maxed
          ? 'Минимальное время приёма заказа.'
          : 'На 17% меньше времени у каждого столика.',
    ),
    UpgradeKey.prepSpeed => UpgradeEffectView(
      title: 'Шустрый кран',
      iconAsset: 'prep-speed',
      primary:
          'Напиток ${formatDecimal(getPreparationDuration(level))}${maxed ? '' : ' → ${formatDecimal(getPreparationDuration(nextLevel))}'} с$suffix',
      secondary: maxed
          ? 'Максимальная скорость приготовления.'
          : 'На 18% быстрее каждый приготовленный напиток.',
    ),
    UpgradeKey.cleanSpeed => UpgradeEffectView(
      title: 'Чистая стойка',
      iconAsset: 'clean-speed',
      primary:
          'Уборка ${formatDecimal(getCleaningDuration(level))}${maxed ? '' : ' → ${formatDecimal(getCleaningDuration(nextLevel))}'} с$suffix',
      secondary: maxed
          ? 'Максимальная скорость уборки.'
          : 'На 20% быстрее освобождает грязный стол.',
    ),
    UpgradeKey.assortment => UpgradeEffectView(
      title: 'Новые напитки',
      iconAsset: 'assortment',
      primary:
          'Средний чек ≈${formatDecimal(getAverageDrinkPrice(level), digits: 1)}${maxed ? '' : ' → ≈${formatDecimal(getAverageDrinkPrice(nextLevel), digits: 1)}'} мон.$suffix',
      secondary: maxed
          ? '${getUnlockedDrinks(level).length} напитков · самый дорогой ${drinks.last.price} мон.'
          : 'Откроется: ${drinks.firstWhere((drink) => drink.level == nextLevel).name} · ${drinks.firstWhere((drink) => drink.level == nextLevel).price} мон.',
    ),
    UpgradeKey.advertising => UpgradeEffectView(
      title: 'Реклама бара',
      iconAsset: 'advertising',
      primary:
          'Приход ${formatDecimal(getArrivalInterval(level))}${maxed ? '' : ' → ${formatDecimal(getArrivalInterval(nextLevel))}'} с$suffix',
      secondary: maxed
          ? 'Поток ≈${formatDecimal(60 / getArrivalInterval(level), digits: 1)} гостя/мин.'
          : 'Поток ≈${formatDecimal(60 / getArrivalInterval(level), digits: 1)} → ${formatDecimal(60 / getArrivalInterval(nextLevel), digits: 1)} гостя/мин.',
    ),
  };
}

UpgradeEffectView roomUpgradeEffect(
  RoomId roomId,
  RoomUpgradeKey key,
  RoomUpgradeLevels levels,
) {
  final definition = roomDefinition(roomId);
  final level = levels.levelFor(key);
  final maxLevel = key == RoomUpgradeKey.capacity ? definition.maxCapacity : 5;
  final maxed = level >= maxLevel;
  final nextLevel = maxed ? level : level + 1;
  final suffix = maxed ? ' · максимум' : '';

  return switch (key) {
    RoomUpgradeKey.staffSpeed => UpgradeEffectView(
      title: 'Мастерство персонала',
      iconAsset: 'time-speed',
      primary:
          'Сеанс ${formatDecimal(getRoomSessionDuration(roomId, level), digits: 1)}${maxed ? '' : ' → ${formatDecimal(getRoomSessionDuration(roomId, nextLevel), digits: 1)}'} с$suffix',
      secondary: maxed
          ? 'Сеанс, уборка и подготовка ускорены максимально.'
          : 'Сеанс, уборка и подготовка комнаты быстрее на 15%.',
    ),
    RoomUpgradeKey.capacity => UpgradeEffectView(
      title: 'Дополнительное место',
      iconAsset: 'customers',
      primary: 'Мест $level${maxed ? '' : ' → $nextLevel'}$suffix',
      secondary: maxed
          ? 'Доход полного сеанса: ${getRoomProfit(roomId, levels.quality, level)} мон.'
          : 'Полный сеанс: ${getRoomProfit(roomId, levels.quality, level)} → ${getRoomProfit(roomId, levels.quality, nextLevel)} мон.',
    ),
    RoomUpgradeKey.quality => UpgradeEffectView(
      title: 'Премиум-сервис',
      iconAsset: 'reputation',
      primary:
          'С гостя ${getRoomProfit(roomId, level, 1)}${maxed ? '' : ' → ${getRoomProfit(roomId, nextLevel, 1)}'} мон.$suffix',
      secondary: maxed
          ? 'Полный сеанс: ${getRoomProfit(roomId, level, levels.capacity)} мон.'
          : 'Полный сеанс: ${getRoomProfit(roomId, level, levels.capacity)} → ${getRoomProfit(roomId, nextLevel, levels.capacity)} мон.',
    ),
  };
}
