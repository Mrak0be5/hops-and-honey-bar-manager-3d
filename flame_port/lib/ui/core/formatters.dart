import 'package:flutter/material.dart';

import '../../domain/models.dart';

String formatInt(int value) {
  final source = value.toString();
  final buffer = StringBuffer();
  for (var index = 0; index < source.length; index += 1) {
    if (index > 0 && (source.length - index) % 3 == 0) buffer.write(' ');
    buffer.write(source[index]);
  }
  return buffer.toString();
}

String formatDecimal(double value, {int digits = 2}) =>
    value.toStringAsFixed(digits).replaceAll('.', ',');

String roomName(RoomId roomId) => switch (roomId) {
  RoomId.karaoke => 'Караоке',
  RoomId.sauna => 'Сауна',
  RoomId.massage => 'Массаж',
};

IconData roomIcon(RoomId roomId) => switch (roomId) {
  RoomId.karaoke => Icons.mic_rounded,
  RoomId.sauna => Icons.hot_tub_rounded,
  RoomId.massage => Icons.spa_rounded,
};

String roomStatus(RoomSnapshot room) {
  if (!room.unlocked) return 'Требуется ремонт';
  if (room.awaitingFirstGuest) return 'Ждём первого гостя';
  return switch (room.staffState) {
    RoomStaffState.locked => 'Закрыто',
    RoomStaffState.waiting => 'Готово к гостям',
    RoomStaffState.welcoming => 'Встречает гостей',
    RoomStaffState.serving => 'Сеанс идёт',
    RoomStaffState.resetting => 'Подготовка комнаты',
  };
}

String bottleneckLabel(BarBottleneck bottleneck) => switch (bottleneck) {
  BarBottleneck.none => 'Бар работает ровно',
  BarBottleneck.orders => 'Узкое место: приём заказов',
  BarBottleneck.drinks => 'Узкое место: приготовление',
  BarBottleneck.payments => 'Узкое место: расчёт гостей',
  BarBottleneck.cleaning => 'Узкое место: уборка',
  BarBottleneck.tables => 'Узкое место: свободные столы',
};
