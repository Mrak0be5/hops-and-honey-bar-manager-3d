import 'package:flutter/material.dart';

import '../core/app_theme.dart';
import '../core/game_widgets.dart';

class SettingsPanel extends StatefulWidget {
  const SettingsPanel({
    super.key,
    required this.soundEnabled,
    required this.portraitPreview,
    required this.canTogglePortrait,
    required this.onSoundChanged,
    required this.onPortraitChanged,
    required this.onReset,
    required this.onClose,
  });

  final bool soundEnabled;
  final bool portraitPreview;
  final bool canTogglePortrait;
  final ValueChanged<bool> onSoundChanged;
  final ValueChanged<bool> onPortraitChanged;
  final VoidCallback onReset;
  final VoidCallback onClose;

  @override
  State<SettingsPanel> createState() => _SettingsPanelState();
}

class _SettingsPanelState extends State<SettingsPanel> {
  bool _confirmingReset = false;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: GamePanel(
        radius: 24,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.settings_rounded,
                  color: GameColors.gold,
                  size: 30,
                ),
                const SizedBox(width: 9),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionEyebrow('Игра продолжает работать'),
                      Text(
                        'Настройки',
                        key: Key('settings-title'),
                        style: TextStyle(
                          color: GameColors.cream,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  key: const Key('settings-close'),
                  autofocus: true,
                  tooltip: 'Закрыть настройки',
                  onPressed: widget.onClose,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _SettingsTile(
              key: const Key('sound-setting'),
              icon: const GameAssetIcon('sound', size: 42),
              title: 'Звук',
              subtitle: widget.soundEnabled
                  ? 'Эффекты включены'
                  : 'Эффекты выключены',
              trailing: Switch.adaptive(
                value: widget.soundEnabled,
                onChanged: widget.onSoundChanged,
              ),
            ),
            if (widget.canTogglePortrait) ...[
              const SizedBox(height: 8),
              _SettingsTile(
                key: const Key('portrait-setting'),
                icon: const Icon(
                  Icons.stay_current_portrait_rounded,
                  color: GameColors.teal,
                  size: 35,
                ),
                title: 'Предпросмотр 9:16',
                subtitle: widget.portraitPreview
                    ? 'Телефонная рамка включена'
                    : 'Адаптивная ширина',
                trailing: Switch.adaptive(
                  value: widget.portraitPreview,
                  onChanged: widget.onPortraitChanged,
                ),
              ),
            ],
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GameColors.coral.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: GameColors.coral.withValues(alpha: 0.45),
                ),
              ),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: !_confirmingReset
                    ? Row(
                        key: const ValueKey('reset-idle'),
                        children: [
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Новая игра',
                                  style: TextStyle(
                                    color: GameColors.cream,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                Text(
                                  'Монеты, комнаты и улучшения будут удалены.',
                                  style: TextStyle(
                                    color: Colors.white60,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            key: const Key('reset-progress'),
                            onPressed: () =>
                                setState(() => _confirmingReset = true),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(48, 46),
                              foregroundColor: const Color(0xFFFFB3A7),
                              side: const BorderSide(color: GameColors.coral),
                            ),
                            child: const Text('Сбросить'),
                          ),
                        ],
                      )
                    : Column(
                        key: const ValueKey('reset-confirm'),
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Точно начать заново?',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: GameColors.cream,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  key: const Key('cancel-reset'),
                                  onPressed: () =>
                                      setState(() => _confirmingReset = false),
                                  child: const Text('Отмена'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: FilledButton(
                                  key: const Key('confirm-reset'),
                                  onPressed: widget.onReset,
                                  style: FilledButton.styleFrom(
                                    backgroundColor: GameColors.coral,
                                  ),
                                  child: const Text('Да, сбросить'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  final Widget icon;
  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 62),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: GameColors.paper,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          SizedBox(width: 44, height: 44, child: Center(child: icon)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: GameColors.ink,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF64716E),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}
