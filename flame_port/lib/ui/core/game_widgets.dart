import 'package:flutter/material.dart';

import 'app_theme.dart';

class GamePanel extends StatelessWidget {
  const GamePanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(12),
    this.color,
    this.borderColor,
    this.radius = 18,
  });

  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color ?? GameColors.navy.withValues(alpha: 0.94),
        border: Border.all(
          color: borderColor ?? GameColors.cream.withValues(alpha: 0.82),
          width: 2,
        ),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40001B22),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class GameAssetIcon extends StatelessWidget {
  const GameAssetIcon(this.name, {super.key, this.size = 42});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.24),
      child: Image.asset(
        'assets/ui/$name.webp',
        width: size,
        height: size,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}

class MetricChip extends StatelessWidget {
  const MetricChip({
    super.key,
    required this.icon,
    required this.value,
    required this.semanticLabel,
  });

  final String icon;
  final String value;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$semanticLabel: $value',
      child: Container(
        constraints: const BoxConstraints(minHeight: 46, minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: GameColors.navy.withValues(alpha: 0.94),
          border: Border.all(
            color: GameColors.cream.withValues(alpha: 0.6),
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GameAssetIcon(icon, size: 32),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                value,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: GameColors.cream,
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SectionEyebrow extends StatelessWidget {
  const SectionEyebrow(this.text, {super.key, this.color = GameColors.mint});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: color,
      fontSize: 9,
      fontWeight: FontWeight.w900,
      letterSpacing: 1.2,
    ),
  );
}
