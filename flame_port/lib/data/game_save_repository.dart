import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/bar_simulation.dart';

class GameSaveCodec {
  const GameSaveCodec();

  String encode(GameSave save) => jsonEncode(save.toJson());

  GameSave decode(String source) {
    final decoded = jsonDecode(source);
    if (decoded is! Map) {
      throw const FormatException('Game save must be a JSON object.');
    }
    return GameSave.fromJson(
      decoded.map((key, value) => MapEntry(key.toString(), value)),
    );
  }
}

class GameSaveRepository {
  GameSaveRepository(
    this._preferences, {
    this.storageKey = defaultStorageKey,
    this.codec = const GameSaveCodec(),
  });

  static const defaultStorageKey = 'hops-and-honey-flame-save-v1';

  final SharedPreferences _preferences;
  final String storageKey;
  final GameSaveCodec codec;

  static Future<GameSaveRepository> create({String? storageKey}) async =>
      GameSaveRepository(
        await SharedPreferences.getInstance(),
        storageKey: storageKey ?? defaultStorageKey,
      );

  GameSave? load() {
    final source = _preferences.getString(storageKey);
    if (source == null || source.isEmpty) return null;
    try {
      return codec.decode(source);
    } on FormatException {
      _preferences.remove(storageKey);
      return null;
    } on TypeError {
      _preferences.remove(storageKey);
      return null;
    }
  }

  Future<bool> save(GameSave save) =>
      _preferences.setString(storageKey, codec.encode(save));

  Future<bool> saveSimulation(BarSimulation simulation) =>
      save(simulation.createSave());

  Future<bool> clear() => _preferences.remove(storageKey);
}
