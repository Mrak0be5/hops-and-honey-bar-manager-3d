import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../data/game_browser_commands.dart';
import '../../data/game_source_repository.dart';

class GameWebView extends StatefulWidget {
  const GameWebView({
    super.key,
    required this.source,
    required this.onBrowserReady,
    required this.onPageStarted,
    required this.onProgress,
    required this.onPageFinished,
    required this.onMainFrameError,
  });

  final GameSourceRepository source;
  final ValueChanged<GameBrowserCommands> onBrowserReady;
  final VoidCallback onPageStarted;
  final ValueChanged<int> onProgress;
  final VoidCallback onPageFinished;
  final ValueChanged<String> onMainFrameError;

  @override
  State<GameWebView> createState() => _GameWebViewState();
}

class _GameWebViewState extends State<GameWebView>
    implements GameBrowserCommands {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = _createController();
    widget.onBrowserReady(this);
    _controller.loadRequest(widget.source.initialUri);
  }

  WebViewController _createController() {
    final PlatformWebViewControllerCreationParams params =
        WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true)
        : const PlatformWebViewControllerCreationParams();

    final WebViewController controller =
        WebViewController.fromPlatformCreationParams(params)
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(const Color(0xFF071D22))
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) => widget.onPageStarted(),
              onProgress: widget.onProgress,
              onPageFinished: (_) => widget.onPageFinished(),
              onWebResourceError: (WebResourceError error) {
                if (error.isForMainFrame == true) {
                  widget.onMainFrameError(error.description);
                }
              },
              onNavigationRequest: (NavigationRequest request) {
                final Uri? uri = Uri.tryParse(request.url);
                if (uri != null &&
                    widget.source.allowsTopLevelNavigation(uri)) {
                  return NavigationDecision.navigate;
                }
                return NavigationDecision.prevent;
              },
            ),
          );

    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(kDebugMode);
      platform
        ..setVerticalScrollBarEnabled(false)
        ..setHorizontalScrollBarEnabled(false);
    }
    return controller;
  }

  @override
  Future<void> reload() => _controller.reload();

  @override
  Future<bool> goBackIfPossible() async {
    if (!await _controller.canGoBack()) {
      return false;
    }
    await _controller.goBack();
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(
      key: const ValueKey<String>('original-html5-game'),
      controller: _controller,
    );
  }
}
