import 'package:flutter/foundation.dart';

import '../../data/game_browser_commands.dart';

enum GameShellPhase { loading, ready, error }

class GameShellViewModel extends ChangeNotifier {
  GameBrowserCommands? _browser;
  GameShellPhase _phase = GameShellPhase.loading;
  int _progress = 0;
  String? _errorMessage;
  bool _mainFrameFailed = false;

  GameShellPhase get phase => _phase;
  int get progress => _progress;
  String? get errorMessage => _errorMessage;

  void attachBrowser(GameBrowserCommands browser) {
    _browser = browser;
  }

  void pageStarted() {
    _phase = GameShellPhase.loading;
    _progress = 0;
    _errorMessage = null;
    _mainFrameFailed = false;
    notifyListeners();
  }

  void loadingProgress(int value) {
    final int next = value.clamp(0, 100);
    if (_phase != GameShellPhase.loading || _progress == next) {
      return;
    }
    _progress = next;
    notifyListeners();
  }

  void pageFinished() {
    if (_mainFrameFailed) {
      return;
    }
    _phase = GameShellPhase.ready;
    _progress = 100;
    _errorMessage = null;
    notifyListeners();
  }

  void mainFrameFailed(String message) {
    _mainFrameFailed = true;
    _phase = GameShellPhase.error;
    _errorMessage = message.trim().isEmpty
        ? 'Не удалось загрузить игру.'
        : message.trim();
    notifyListeners();
  }

  Future<void> retry() async {
    final GameBrowserCommands? browser = _browser;
    if (browser == null) {
      return;
    }
    pageStarted();
    await browser.reload();
  }

  Future<bool> handleBack() async {
    final GameBrowserCommands? browser = _browser;
    if (browser == null) {
      return false;
    }
    if (await browser.dismissPageOverlayIfPossible()) {
      return true;
    }
    return browser.goBackIfPossible();
  }
}
