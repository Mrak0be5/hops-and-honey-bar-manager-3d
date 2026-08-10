import 'package:web/web.dart' as web;

enum GameSound { tap, purchase, income, unlock }

class AudioFeedback {
  AudioFeedback({required this._enabled});

  bool _enabled;
  web.AudioContext? _context;

  void setEnabled(bool value) => _enabled = value;

  void play(GameSound sound) {
    if (!_enabled) return;
    final context = _context ??= web.AudioContext();
    context.resume();
    switch (sound) {
      case GameSound.tap:
        _tone(context, 380, 0.055, 0.035, 'triangle');
      case GameSound.purchase:
        _tone(context, 520, 0.09, 0.045, 'sine');
        _tone(context, 720, 0.12, 0.04, 'sine', delay: 0.065);
      case GameSound.income:
        _tone(context, 880, 0.075, 0.028, 'triangle');
      case GameSound.unlock:
        _tone(context, 392, 0.16, 0.045, 'sine');
        _tone(context, 523, 0.18, 0.042, 'sine', delay: 0.09);
        _tone(context, 659, 0.24, 0.04, 'sine', delay: 0.18);
    }
  }

  void _tone(
    web.AudioContext context,
    double frequency,
    double duration,
    double volume,
    String waveform, {
    double delay = 0,
  }) {
    final start = context.currentTime + delay;
    final oscillator = context.createOscillator()..type = waveform;
    final gain = context.createGain();
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain
      ..setValueAtTime(0.0001, start)
      ..exponentialRampToValueAtTime(volume, start + 0.012)
      ..exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  void dispose() {
    _context?.close();
    _context = null;
  }
}
