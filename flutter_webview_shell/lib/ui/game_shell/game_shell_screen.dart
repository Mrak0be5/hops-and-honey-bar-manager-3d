import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/game_source_repository.dart';
import 'game_shell_view_model.dart';
import 'game_web_view.dart';

typedef GameBrowserViewBuilder =
    Widget Function(GameSourceRepository source, GameShellViewModel viewModel);

class GameShellScreen extends StatefulWidget {
  const GameShellScreen({
    super.key,
    required this.source,
    this.browserViewBuilder,
    this.onExitRequested,
  });

  final GameSourceRepository source;
  final GameBrowserViewBuilder? browserViewBuilder;
  final Future<void> Function()? onExitRequested;

  @override
  State<GameShellScreen> createState() => _GameShellScreenState();
}

class _GameShellScreenState extends State<GameShellScreen> {
  late final GameShellViewModel _viewModel;
  late final Widget _browserView;

  @override
  void initState() {
    super.initState();
    _viewModel = GameShellViewModel();
    _browserView =
        widget.browserViewBuilder?.call(widget.source, _viewModel) ??
        GameWebView(
          source: widget.source,
          onBrowserReady: _viewModel.attachBrowser,
          onPageStarted: _viewModel.pageStarted,
          onProgress: _viewModel.loadingProgress,
          onPageFinished: _viewModel.pageFinished,
          onMainFrameError: _viewModel.mainFrameFailed,
        );
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  Future<void> _handleSystemBack() async {
    if (await _viewModel.handleBack()) {
      return;
    }
    await (widget.onExitRequested ?? SystemNavigator.pop)();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (!didPop) {
          _handleSystemBack();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF071D22),
        body: AnimatedBuilder(
          animation: _viewModel,
          builder: (BuildContext context, Widget? child) {
            return Stack(
              fit: StackFit.expand,
              children: <Widget>[
                child!,
                if (_viewModel.phase == GameShellPhase.loading)
                  _LoadingOverlay(progress: _viewModel.progress),
                if (_viewModel.phase == GameShellPhase.error)
                  _ErrorOverlay(
                    message: _viewModel.errorMessage!,
                    onRetry: _viewModel.retry,
                  ),
              ],
            );
          },
          child: _browserView,
        ),
      ),
    );
  }
}

class _LoadingOverlay extends StatelessWidget {
  const _LoadingOverlay({required this.progress});

  final int progress;

  @override
  Widget build(BuildContext context) {
    final double? value = progress == 0 ? null : progress / 100;
    return ColoredBox(
      key: const ValueKey<String>('loading-overlay'),
      color: const Color(0xFF071D22),
      child: Center(
        child: Semantics(
          label: 'Загрузка игры, $progress процентов',
          child: SizedBox(
            width: 220,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Text(
                  'ХМЕЛЬ И МЁД',
                  style: TextStyle(
                    color: Color(0xFFFFD889),
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 18),
                LinearProgressIndicator(
                  value: value,
                  minHeight: 7,
                  borderRadius: BorderRadius.circular(99),
                  color: const Color(0xFFE99A3D),
                  backgroundColor: const Color(0xFF17444B),
                ),
                const SizedBox(height: 12),
                Text(
                  progress == 0 ? 'Загружаем бар…' : '$progress%',
                  style: const TextStyle(color: Color(0xFFB8D5D3)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      key: const ValueKey<String>('error-overlay'),
      color: const Color(0xF5071D22),
      child: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(
                  Icons.cloud_off_rounded,
                  size: 52,
                  color: Color(0xFFFFD889),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Игра не загрузилась',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xFFB8D5D3)),
                ),
                const SizedBox(height: 22),
                FilledButton.icon(
                  key: const ValueKey<String>('retry-game'),
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Повторить'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
