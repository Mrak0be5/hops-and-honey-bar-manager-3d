import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_shell/config/game_shell_config.dart';
import 'package:hops_and_honey_shell/data/game_browser_commands.dart';
import 'package:hops_and_honey_shell/data/game_source_repository.dart';
import 'package:hops_and_honey_shell/ui/game_shell/game_shell_screen.dart';
import 'package:hops_and_honey_shell/ui/game_shell/game_shell_view_model.dart';

void main() {
  late FakeGameBrowser browser;
  late GameShellViewModel viewModel;
  late int exitCount;

  setUp(() {
    browser = FakeGameBrowser();
    exitCount = 0;
  });

  Future<void> pumpShell(WidgetTester tester) async {
    final GameSourceRepository source = GameSourceRepository(
      config: GameShellConfig(gameUri: Uri.parse('https://game.example.com')),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: GameShellScreen(
          source: source,
          browserViewBuilder:
              (GameSourceRepository source, GameShellViewModel model) {
                viewModel = model..attachBrowser(browser);
                return const ColoredBox(
                  key: ValueKey<String>('fake-browser'),
                  color: Colors.black,
                );
              },
          onExitRequested: () async {
            exitCount += 1;
          },
        ),
      ),
    );
  }

  testWidgets('shows loading until the original game finishes', (
    WidgetTester tester,
  ) async {
    await pumpShell(tester);

    expect(find.byKey(const ValueKey<String>('fake-browser')), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('loading-overlay')),
      findsOneWidget,
    );

    viewModel.pageFinished();
    await tester.pump();

    expect(find.byKey(const ValueKey<String>('loading-overlay')), findsNothing);
    expect(find.byKey(const ValueKey<String>('fake-browser')), findsOneWidget);
  });

  testWidgets('offers retry after a main-frame load error', (
    WidgetTester tester,
  ) async {
    await pumpShell(tester);
    viewModel.mainFrameFailed('Нет подключения');
    await tester.pump();

    expect(find.text('Игра не загрузилась'), findsOneWidget);
    expect(find.text('Нет подключения'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('retry-game')));
    await tester.pump();

    expect(browser.reloadCount, 1);
    expect(
      find.byKey(const ValueKey<String>('loading-overlay')),
      findsOneWidget,
    );
  });

  testWidgets('system back exits only when WebView has no history', (
    WidgetTester tester,
  ) async {
    await pumpShell(tester);

    browser.canGoBack = true;
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(browser.goBackCount, 1);
    expect(exitCount, 0);

    browser.canGoBack = false;
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(exitCount, 1);
  });
}

class FakeGameBrowser implements GameBrowserCommands {
  int reloadCount = 0;
  int goBackCount = 0;
  bool canGoBack = false;

  @override
  Future<bool> dismissPageOverlayIfPossible() async => false;

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
