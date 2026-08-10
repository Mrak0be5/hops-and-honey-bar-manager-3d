import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../audio/audio_feedback.dart';
import '../data/game_save_repository.dart';
import '../domain/bar_simulation.dart';

class GameController extends ChangeNotifier {
  GameController._({
    required this.simulation,
    required this._repository,
    required SharedPreferences preferences,
  }) : _preferences = preferences,
       soundEnabled = preferences.getBool(_soundKey) ?? true,
       portraitPreview = preferences.getBool(_portraitKey) ?? false {
    _audio = AudioFeedback(enabled: soundEnabled);
    _lastSoundEventId = simulation.snapshot.lastEvent?.id;
    _uiTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      _syncEventAudio();
      notifyListeners();
    });
    _saveTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(saveNow());
    });
  }

  static const _soundKey = 'hops-and-honey-sound-enabled';
  static const _portraitKey = 'hops-and-honey-portrait-preview';

  final BarSimulation simulation;
  final GameSaveRepository _repository;
  final SharedPreferences _preferences;
  late final Timer _uiTimer;
  late final Timer _saveTimer;
  late final AudioFeedback _audio;
  int? _lastSoundEventId;

  bool soundEnabled;
  bool portraitPreview;

  static Future<GameController> create() async {
    final repository = await GameSaveRepository.create();
    final preferences = await SharedPreferences.getInstance();
    return GameController._(
      simulation: BarSimulation(save: repository.load()),
      repository: repository,
      preferences: preferences,
    );
  }

  GameSnapshot get snapshot => simulation.snapshot;

  void start() {
    simulation.start();
    _audio.play(GameSound.unlock);
    notifyListeners();
  }

  void toggleSpeed() {
    simulation.toggleSpeed();
    _audio.play(GameSound.tap);
    notifyListeners();
  }

  Future<void> setSoundEnabled(bool value) async {
    soundEnabled = value;
    _audio.setEnabled(value);
    if (value) _audio.play(GameSound.tap);
    notifyListeners();
    await _preferences.setBool(_soundKey, value);
  }

  Future<void> setPortraitPreview(bool value) async {
    portraitPreview = value;
    notifyListeners();
    await _preferences.setBool(_portraitKey, value);
  }

  bool purchaseUpgrade(UpgradeKey key) {
    final purchased = simulation.purchaseUpgrade(key);
    if (purchased) _afterPurchase(GameSound.purchase);
    return purchased;
  }

  bool purchaseRoom(RoomId roomId) {
    final purchased = simulation.purchaseRoom(roomId);
    if (purchased) _afterPurchase(GameSound.unlock);
    return purchased;
  }

  bool purchaseRoomUpgrade(RoomId roomId, RoomUpgradeKey key) {
    final purchased = simulation.purchaseRoomUpgrade(roomId, key);
    if (purchased) _afterPurchase(GameSound.purchase);
    return purchased;
  }

  void _afterPurchase(GameSound sound) {
    _audio.play(sound);
    notifyListeners();
    unawaited(saveNow());
  }

  Future<void> reset() async {
    simulation.reset();
    _lastSoundEventId = null;
    _audio.play(GameSound.tap);
    await _repository.clear();
    notifyListeners();
  }

  Future<void> saveNow() async {
    if (!snapshot.started) return;
    await _repository.saveSimulation(simulation);
  }

  void _syncEventAudio() {
    final event = simulation.snapshot.lastEvent;
    if (event == null || event.id == _lastSoundEventId) return;
    _lastSoundEventId = event.id;
    if (event.kind == GameEventKind.payment ||
        event.kind == GameEventKind.roomIncome) {
      _audio.play(GameSound.income);
    }
  }

  @override
  void dispose() {
    _uiTimer.cancel();
    _saveTimer.cancel();
    _audio.dispose();
    unawaited(saveNow());
    super.dispose();
  }
}
