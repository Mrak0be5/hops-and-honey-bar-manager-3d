import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_shell/data/game_browser_commands.dart';
import 'package:hops_and_honey_shell/ui/game_shell/game_shell_view_model.dart';

void main() {
  test('tracks loading, ready, and main-frame error states', () {
    final GameShellViewModel viewModel = GameShellViewModel();

    expect(viewModel.phase, GameShellPhase.loading);
    viewModel.loadingProgress(47);
    expect(viewModel.progress, 47);

    viewModel.pageFinished();
    expect(viewModel.phase, GameShellPhase.ready);
    expect(viewModel.progress, 100);

    viewModel.mainFrameFailed('Нет сети');
    expect(viewModel.phase, GameShellPhase.error);
    expect(viewModel.errorMessage, 'Нет сети');

    viewModel.pageFinished();
    expect(
      viewModel.phase,
      GameShellPhase.error,
      reason: 'a late page-finished callback must not hide a main-frame error',
    );
  });

  test('retry resets loading state and reloads the browser', () async {
    final FakeGameBrowser browser = FakeGameBrowser();
    final GameShellViewModel viewModel = GameShellViewModel()
      ..attachBrowser(browser)
      ..mainFrameFailed('offline');

    await viewModel.retry();

    expect(viewModel.phase, GameShellPhase.loading);
    expect(viewModel.progress, 0);
    expect(browser.reloadCount, 1);
  });

  test('delegates back navigation to the browser', () async {
    final FakeGameBrowser browser = FakeGameBrowser()..canGoBack = true;
    final GameShellViewModel viewModel = GameShellViewModel()
      ..attachBrowser(browser);

    expect(await viewModel.handleBack(), isTrue);
    expect(browser.goBackCount, 1);
  });
}

class FakeGameBrowser implements GameBrowserCommands {
  int reloadCount = 0;
  int goBackCount = 0;
  bool canGoBack = false;

  @override
  Future<bool> goBackIfPossible() async {
    if (!canGoBack) {
      return false;
    }
    goBackCount += 1;
    return true;
  }

  @override
  Future<void> reload() async {
    reloadCount += 1;
  }
}
