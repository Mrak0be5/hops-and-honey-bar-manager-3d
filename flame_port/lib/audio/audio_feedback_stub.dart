import 'package:flutter/services.dart';

enum GameSound { tap, purchase, income, unlock }

class AudioFeedback {
  AudioFeedback({required this._enabled});

  bool _enabled;

  void setEnabled(bool value) => _enabled = value;

  void play(GameSound sound) {
    if (!_enabled) return;
    SystemSound.play(SystemSoundType.click);
  }

  void dispose() {}
}
