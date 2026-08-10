import 'dart:async';
import 'dart:math' as math;

import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../domain/models.dart';
import '../game/hops_honey_game.dart';
import '../game/venue_scene_renderer.dart';
import 'core/app_theme.dart';
import 'core/formatters.dart';
import 'core/game_widgets.dart';
import 'development/development_panel.dart';
import 'game_controller.dart';
import 'settings/settings_panel.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({super.key, required this.controller});

  final GameController controller;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final HopsHoneyGame _game;
  bool _developmentOpen = false;
  bool _settingsOpen = false;
  RoomId? _selectedRoom;

  GameController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _game = HopsHoneyGame(
      simulation: controller.simulation,
      soundEnabled: controller.soundEnabled,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final snapshot = controller.snapshot;
        return LayoutBuilder(
          builder: (context, outer) {
            final wideViewport = outer.maxWidth >= 760;
            final usePortraitFrame = wideViewport && controller.portraitPreview;
            final frameSize = _frameSize(outer.biggest, usePortraitFrame);
            return ColoredBox(
              color: const Color(0xFF011820),
              child: Stack(
                children: [
                  Center(
                    child: SizedBox(
                      key: const Key('game-frame'),
                      width: frameSize.width,
                      height: frameSize.height,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(
                          usePortraitFrame ? 24 : 0,
                        ),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: GameColors.deepNavy,
                            border: usePortraitFrame
                                ? Border.all(
                                    color: GameColors.cream.withValues(
                                      alpha: 0.72,
                                    ),
                                    width: 2,
                                  )
                                : null,
                            borderRadius: BorderRadius.circular(
                              usePortraitFrame ? 24 : 0,
                            ),
                          ),
                          child: _GameSurface(
                            snapshot: snapshot,
                            game: _game,
                            developmentOpen: _developmentOpen,
                            settingsOpen: _settingsOpen,
                            selectedRoom: _selectedRoom,
                            onToggleSpeed: controller.toggleSpeed,
                            onOpenDevelopment: _openDevelopment,
                            onCloseDevelopment: _closeDevelopment,
                            onOpenSettings: _openSettings,
                            onCloseSettings: _closeSettings,
                            onSelectRoom: _selectRoom,
                            onBuyBarUpgrade: controller.purchaseUpgrade,
                            onUnlockRoom: _unlockRoom,
                            onBuyRoomUpgrade: controller.purchaseRoomUpgrade,
                            onStart: controller.start,
                            onSoundChanged: _setSound,
                            onReset: _reset,
                            portraitPreview: controller.portraitPreview,
                            canTogglePortrait: wideViewport,
                            onPortraitChanged: controller.setPortraitPreview,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (wideViewport)
                    Positioned(
                      right: 12,
                      bottom: 12,
                      child: FilledButton.tonalIcon(
                        key: const Key('portrait-preview-toggle'),
                        onPressed: () => controller.setPortraitPreview(
                          !controller.portraitPreview,
                        ),
                        icon: Icon(
                          controller.portraitPreview
                              ? Icons.fit_screen_rounded
                              : Icons.stay_current_portrait_rounded,
                        ),
                        label: Text(
                          controller.portraitPreview ? 'Адаптивно' : 'Вид 9:16',
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Size _frameSize(Size available, bool portrait) {
    if (!portrait) return available;
    var height = available.height;
    var width = height * 9 / 16;
    if (width > available.width) {
      width = available.width;
      height = width * 16 / 9;
    }
    return Size(width, height);
  }

  void _openDevelopment() {
    setState(() {
      _settingsOpen = false;
      _developmentOpen = true;
    });
  }

  void _closeDevelopment() {
    final selectedRoom = _selectedRoom;
    if (selectedRoom != null &&
        !controller.snapshot.room(selectedRoom).unlocked) {
      _selectedRoom = null;
      _game.setVenueFocus(SceneVenue.bar);
    }
    setState(() => _developmentOpen = false);
  }

  void _openSettings() {
    setState(() {
      _developmentOpen = false;
      _settingsOpen = true;
    });
  }

  void _closeSettings() => setState(() => _settingsOpen = false);

  void _selectRoom(RoomId? roomId) {
    setState(() => _selectedRoom = roomId);
    if (roomId == null || !controller.snapshot.room(roomId).unlocked) {
      _game.setVenueFocus(SceneVenue.bar);
      return;
    }
    _game.setVenueFocus(switch (roomId) {
      RoomId.karaoke => SceneVenue.karaoke,
      RoomId.sauna => SceneVenue.sauna,
      RoomId.massage => SceneVenue.massage,
    });
  }

  void _unlockRoom(RoomId roomId) {
    if (!controller.purchaseRoom(roomId)) return;
    _selectRoom(roomId);
  }

  Future<void> _setSound(bool value) async {
    _game.setSoundEnabled(value);
    await controller.setSoundEnabled(value);
  }

  Future<void> _reset() async {
    await controller.reset();
    _game.setVenueFocus(SceneVenue.bar);
    if (!mounted) return;
    setState(() {
      _selectedRoom = null;
      _settingsOpen = false;
      _developmentOpen = false;
    });
  }
}

class _GameSurface extends StatelessWidget {
  const _GameSurface({
    required this.snapshot,
    required this.game,
    required this.developmentOpen,
    required this.settingsOpen,
    required this.selectedRoom,
    required this.onToggleSpeed,
    required this.onOpenDevelopment,
    required this.onCloseDevelopment,
    required this.onOpenSettings,
    required this.onCloseSettings,
    required this.onSelectRoom,
    required this.onBuyBarUpgrade,
    required this.onUnlockRoom,
    required this.onBuyRoomUpgrade,
    required this.onStart,
    required this.onSoundChanged,
    required this.onReset,
    required this.portraitPreview,
    required this.canTogglePortrait,
    required this.onPortraitChanged,
  });

  final GameSnapshot snapshot;
  final HopsHoneyGame game;
  final bool developmentOpen;
  final bool settingsOpen;
  final RoomId? selectedRoom;
  final VoidCallback onToggleSpeed;
  final VoidCallback onOpenDevelopment;
  final VoidCallback onCloseDevelopment;
  final VoidCallback onOpenSettings;
  final VoidCallback onCloseSettings;
  final ValueChanged<RoomId?> onSelectRoom;
  final ValueChanged<UpgradeKey> onBuyBarUpgrade;
  final ValueChanged<RoomId> onUnlockRoom;
  final void Function(RoomId roomId, RoomUpgradeKey key) onBuyRoomUpgrade;
  final VoidCallback onStart;
  final ValueChanged<bool> onSoundChanged;
  final VoidCallback onReset;
  final bool portraitPreview;
  final bool canTogglePortrait;
  final ValueChanged<bool> onPortraitChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 700;
        final menuOpen = developmentOpen || settingsOpen;
        return CallbackShortcuts(
          bindings: {
            const SingleActivator(LogicalKeyboardKey.escape): () {
              if (developmentOpen) onCloseDevelopment();
              if (settingsOpen) onCloseSettings();
            },
          },
          child: Focus(
            autofocus: true,
            child: Stack(
              fit: StackFit.expand,
              children: [
                RepaintBoundary(
                  child: GameWidget<HopsHoneyGame>(
                    key: const Key('flame-game'),
                    game: game,
                  ),
                ),
                if (snapshot.started)
                  _Hud(
                    snapshot: snapshot,
                    menuOpen: menuOpen,
                    onToggleSpeed: onToggleSpeed,
                    onOpenDevelopment: onOpenDevelopment,
                    onOpenSettings: onOpenSettings,
                  ),
                if (!snapshot.started) _WelcomeOverlay(onStart: onStart),
                if (developmentOpen) ...[
                  Positioned.fill(
                    child: GestureDetector(
                      key: const Key('development-backdrop'),
                      onTap: onCloseDevelopment,
                      child: ColoredBox(
                        color: Colors.black.withValues(alpha: 0.28),
                      ),
                    ),
                  ),
                  if (compact)
                    Positioned(
                      left: 8,
                      right: 8,
                      top: math.max(8, MediaQuery.paddingOf(context).top + 4),
                      bottom: 8,
                      child: DevelopmentPanel(
                        snapshot: snapshot,
                        selectedRoom: selectedRoom,
                        onClose: onCloseDevelopment,
                        onSelectRoom: onSelectRoom,
                        onBuyBarUpgrade: onBuyBarUpgrade,
                        onUnlockRoom: onUnlockRoom,
                        onBuyRoomUpgrade: onBuyRoomUpgrade,
                      ),
                    )
                  else
                    Positioned(
                      right: 12,
                      top: 12,
                      bottom: 12,
                      width: math.min(430, constraints.maxWidth * 0.38),
                      child: DevelopmentPanel(
                        snapshot: snapshot,
                        selectedRoom: selectedRoom,
                        onClose: onCloseDevelopment,
                        onSelectRoom: onSelectRoom,
                        onBuyBarUpgrade: onBuyBarUpgrade,
                        onUnlockRoom: onUnlockRoom,
                        onBuyRoomUpgrade: onBuyRoomUpgrade,
                      ),
                    ),
                ],
                if (settingsOpen) ...[
                  Positioned.fill(
                    child: GestureDetector(
                      key: const Key('settings-backdrop'),
                      onTap: onCloseSettings,
                      child: ColoredBox(
                        color: Colors.black.withValues(alpha: 0.42),
                      ),
                    ),
                  ),
                  Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: compact ? constraints.maxWidth - 16 : 430,
                        maxHeight: constraints.maxHeight - 20,
                      ),
                      child: SingleChildScrollView(
                        child: SettingsPanel(
                          soundEnabled: game.soundEnabled,
                          portraitPreview: portraitPreview,
                          canTogglePortrait: canTogglePortrait,
                          onSoundChanged: onSoundChanged,
                          onPortraitChanged: onPortraitChanged,
                          onReset: onReset,
                          onClose: onCloseSettings,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Hud extends StatelessWidget {
  const _Hud({
    required this.snapshot,
    required this.menuOpen,
    required this.onToggleSpeed,
    required this.onOpenDevelopment,
    required this.onOpenSettings,
  });

  final GameSnapshot snapshot;
  final bool menuOpen;
  final VoidCallback onToggleSpeed;
  final VoidCallback onOpenDevelopment;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.all(8),
      child: IgnorePointer(
        ignoring: menuOpen,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 160),
          opacity: menuOpen ? 0 : 1,
          child: Stack(
            children: [
              Align(
                alignment: Alignment.topCenter,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CornerButton(
                      key: const Key('speed-button'),
                      tooltip: 'Скорость игры ×${snapshot.speedMultiplier}',
                      onPressed: onToggleSpeed,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const GameAssetIcon('time-speed', size: 29),
                          Text(
                            '×${snapshot.speedMultiplier}',
                            style: const TextStyle(
                              color: GameColors.ink,
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 5,
                        runSpacing: 5,
                        children: [
                          MetricChip(
                            icon: 'coins',
                            value: formatInt(snapshot.coins),
                            semanticLabel: 'Монеты',
                          ),
                          MetricChip(
                            icon: 'reputation',
                            value: formatInt(snapshot.reputation),
                            semanticLabel: 'Репутация',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    _CornerButton(
                      key: const Key('settings-button'),
                      tooltip: 'Настройки',
                      onPressed: onOpenSettings,
                      child: const Icon(
                        Icons.settings_rounded,
                        color: GameColors.ink,
                        size: 27,
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                top: 55,
                left: 62,
                right: 62,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 270),
                    child: _ShiftChip(snapshot: snapshot),
                  ),
                ),
              ),
              if (snapshot.lastEvent != null)
                Positioned(
                  left: 8,
                  right: 8,
                  bottom: 70,
                  child: Center(child: _EventToast(event: snapshot.lastEvent!)),
                ),
              Align(
                alignment: Alignment.bottomCenter,
                child: FilledButton.icon(
                  key: const Key('development-button'),
                  onPressed: onOpenDevelopment,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(190, 54),
                    backgroundColor: GameColors.gold,
                    foregroundColor: GameColors.ink,
                    side: const BorderSide(color: GameColors.cream, width: 2),
                    elevation: 8,
                  ),
                  icon: const GameAssetIcon('upgrades', size: 36),
                  label: const Text(
                    'РАЗВИТИЕ',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CornerButton extends StatelessWidget {
  const _CornerButton({
    super.key,
    required this.tooltip,
    required this.onPressed,
    required this.child,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: GameColors.paper,
        elevation: 7,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(15),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              border: Border.all(color: GameColors.cream, width: 2),
              borderRadius: BorderRadius.circular(15),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _ShiftChip extends StatelessWidget {
  const _ShiftChip({required this.snapshot});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 5, 10, 6),
      decoration: BoxDecoration(
        color: GameColors.navy.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Colors.white24),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'ДЕНЬ ${snapshot.day}',
                style: const TextStyle(
                  color: GameColors.cream,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${snapshot.served} гостей',
                style: const TextStyle(
                  color: GameColors.mint,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: LinearProgressIndicator(
              value: snapshot.shiftProgress.clamp(0, 1),
              minHeight: 4,
              color: GameColors.gold,
              backgroundColor: Colors.white12,
            ),
          ),
        ],
      ),
    );
  }
}

class _EventToast extends StatelessWidget {
  const _EventToast({required this.event});

  final GameEvent event;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 330),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: GameColors.deepNavy.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: GameColors.mint.withValues(alpha: 0.65)),
      ),
      child: Text(
        event.message,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: GameColors.cream,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _WelcomeOverlay extends StatelessWidget {
  const _WelcomeOverlay({required this.onStart});

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0x94001820),
      child: SafeArea(
        minimum: const EdgeInsets.all(18),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 470),
            child: GamePanel(
              radius: 28,
              padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const GameAssetIcon('assortment', size: 58),
                  const SizedBox(height: 4),
                  const SectionEyebrow('Flame edition', color: GameColors.gold),
                  const Text(
                    'HOPS & HONEY',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: GameColors.cream,
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Развивайте бар, обслуживайте гостей и открывайте караоке, сауну и массажный кабинет.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      height: 1.35,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    key: const Key('start-game'),
                    onPressed: onStart,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(double.infinity, 56),
                      backgroundColor: GameColors.gold,
                      foregroundColor: GameColors.ink,
                    ),
                    icon: const GameAssetIcon('play', size: 36),
                    label: const Text(
                      'ОТКРЫТЬ БАР',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Прогресс сохраняется автоматически',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class GameAppHost extends StatefulWidget {
  const GameAppHost({super.key});

  @override
  State<GameAppHost> createState() => _GameAppHostState();
}

class _GameAppHostState extends State<GameAppHost> with WidgetsBindingObserver {
  late final Future<GameController> _controllerFuture;
  GameController? _controller;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controllerFuture = GameController.create().then((controller) {
      _controller = controller;
      return controller;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(_controller?.saveNow());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<GameController>(
      future: _controllerFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) return _LoadFailure(error: snapshot.error);
        final controller = snapshot.data;
        if (controller == null) return const _LoadingScreen();
        return GameScreen(controller: controller);
      },
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: GameColors.deepNavy,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GameAssetIcon('assortment', size: 52),
            SizedBox(height: 12),
            CircularProgressIndicator(color: GameColors.gold),
          ],
        ),
      ),
    );
  }
}

class _LoadFailure extends StatelessWidget {
  const _LoadFailure({required this.error});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: GameColors.deepNavy,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Не удалось загрузить игру.\n$error',
            textAlign: TextAlign.center,
            style: const TextStyle(color: GameColors.cream),
          ),
        ),
      ),
    );
  }
}
