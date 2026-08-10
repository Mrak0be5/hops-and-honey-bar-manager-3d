import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'scene_contract.dart';
import 'venue_3d_controller.dart';

/// Bounded host for the 3D venue. It owns the only ticker in this scene stack;
/// the nested flutter_scene view is configured with `autoTick: false`.
class Venue3DSurface extends StatefulWidget {
  const Venue3DSurface({
    super.key,
    required this.controller,
    this.onVenueSelected,
  });

  final Venue3DController controller;
  final ValueChanged<SceneVenue>? onVenueSelected;

  @override
  State<Venue3DSurface> createState() => _Venue3DSurfaceState();
}

class _Venue3DSurfaceState extends State<Venue3DSurface>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  SceneVenueRenderer? _renderer;
  Duration? _lastElapsed;
  Object? _error;
  StackTrace? _errorStack;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    _attach();
  }

  @override
  void didUpdateWidget(Venue3DSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (identical(oldWidget.controller, widget.controller)) return;
    oldWidget.controller.detachSurface(this);
    _lastElapsed = null;
    _error = null;
    _errorStack = null;
    _attach();
  }

  void _attach() {
    try {
      _renderer = widget.controller.attachSurface(this);
      if (!_ticker.isActive) _ticker.start();
    } catch (error, stack) {
      _renderer = null;
      _error = error;
      _errorStack = stack;
      if (_ticker.isActive) _ticker.stop();
    }
  }

  void _onTick(Duration elapsed) {
    if (_renderer == null || _error != null) return;
    final previous = _lastElapsed;
    _lastElapsed = elapsed;
    final delta = previous == null
        ? 0.0
        : (elapsed - previous).inMicroseconds / Duration.microsecondsPerSecond;
    try {
      widget.controller.advanceFrame(elapsed, delta);
      if (mounted) setState(() {});
    } catch (error, stack) {
      _ticker.stop();
      if (!mounted) return;
      setState(() {
        _error = error;
        _errorStack = stack;
      });
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    widget.controller.detachSurface(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedWidth ||
            !constraints.hasBoundedHeight ||
            !constraints.maxWidth.isFinite ||
            !constraints.maxHeight.isFinite) {
          final fallbackWidth = constraints.hasBoundedWidth
              ? constraints.maxWidth.clamp(1.0, 360.0)
              : 360.0;
          final fallbackHeight = constraints.hasBoundedHeight
              ? constraints.maxHeight.clamp(1.0, 240.0)
              : 240.0;
          return SizedBox(
            width: fallbackWidth,
            height: fallbackHeight,
            child: const _VenueSurfaceMessage(
              key: Key('venue-3d-unbounded-error'),
              icon: Icons.aspect_ratio_rounded,
              title: '3D-сцене нужен ограниченный размер',
              details: 'Поместите Venue3DSurface в Expanded или SizedBox.',
            ),
          );
        }

        final size = constraints.biggest;
        if (size.isEmpty) return const SizedBox.shrink();
        widget.controller.resize(size);

        final error = _error;
        if (error != null || _renderer == null) {
          return _VenueSurfaceError(
            error: error ?? StateError('3D renderer was not created.'),
            stackTrace: _errorStack,
            onRetry: _retry,
          );
        }

        final view = _renderer!.buildView();
        return Semantics(
          container: true,
          label: 'Трёхмерный зал «Хмель и мёд»',
          child: RepaintBoundary(
            key: const Key('venue-3d-surface'),
            child: ClipRect(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapDown: (details) {
                  final picked = widget.controller.hitTest(
                    details.localPosition,
                    size,
                  );
                  if (picked == null) return;
                  final onVenueSelected = widget.onVenueSelected;
                  if (onVenueSelected == null) {
                    widget.controller.setFocus(picked);
                  } else {
                    onVenueSelected(picked);
                  }
                },
                child: view,
              ),
            ),
          ),
        );
      },
    );
  }

  void _retry() {
    try {
      final renderer = widget.controller.retryRenderer(this);
      setState(() {
        _renderer = renderer;
        _error = null;
        _errorStack = null;
        _lastElapsed = null;
      });
      if (!_ticker.isActive) _ticker.start();
    } catch (error, stack) {
      setState(() {
        _error = error;
        _errorStack = stack;
      });
    }
  }
}

class Venue3DLoadingSurface extends StatelessWidget {
  const Venue3DLoadingSurface({super.key, required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final value = progress.isFinite ? progress.clamp(0.0, 1.0) : 0.0;
    return ColoredBox(
      key: const Key('venue-3d-loading'),
      color: const Color(0xFF062A34),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 240),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.view_in_ar_rounded,
                color: Color(0xFFFFCF71),
                size: 42,
              ),
              const SizedBox(height: 14),
              LinearProgressIndicator(
                value: value > 0 ? value : null,
                color: const Color(0xFFFFB955),
                backgroundColor: const Color(0xFF174B53),
                borderRadius: BorderRadius.circular(99),
              ),
              const SizedBox(height: 10),
              const Text(
                'Готовим 3D-залы…',
                style: TextStyle(
                  color: Color(0xFFFFF0CB),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VenueSurfaceError extends StatelessWidget {
  const _VenueSurfaceError({
    required this.error,
    required this.stackTrace,
    required this.onRetry,
  });

  final Object error;
  final StackTrace? stackTrace;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    assert(() {
      final origin = stackTrace?.toString().split('\n').first;
      debugPrint(
        'Venue3D renderer error: $error${origin == null ? '' : ' ($origin)'}',
      );
      return true;
    }());
    return _VenueSurfaceMessage(
      key: const Key('venue-3d-render-error'),
      icon: Icons.error_outline_rounded,
      title: 'Не удалось запустить 3D',
      details: 'Проверьте поддержку Flutter GPU и попробуйте ещё раз.',
      action: FilledButton.tonalIcon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Повторить'),
      ),
    );
  }
}

class _VenueSurfaceMessage extends StatelessWidget {
  const _VenueSurfaceMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.details,
    this.action,
  });

  final IconData icon;
  final String title;
  final String details;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 1, minHeight: 1),
      child: ColoredBox(
        color: const Color(0xFF062A34),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: const Color(0xFFFFCA69), size: 38),
                const SizedBox(height: 10),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFFF0CB),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  details,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFB7D9D8)),
                ),
                if (action != null) ...[const SizedBox(height: 14), action!],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
