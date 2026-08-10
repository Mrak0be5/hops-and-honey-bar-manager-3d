import 'dart:math' as math;
import 'dart:ui';

/// A point on the venue floor. `x` runs west/east and `z` north/south.
class IsoWorldPoint {
  const IsoWorldPoint(this.x, this.z, [this.height = 0]);

  final double x;
  final double z;
  final double height;
}

/// The screen-space footprint of an axis-aligned floor rectangle.
class IsoWorldRect {
  const IsoWorldRect({
    required this.left,
    required this.top,
    required this.right,
    required this.bottom,
  });

  final double left;
  final double top;
  final double right;
  final double bottom;

  double get centerX => (left + right) * .5;
  double get centerZ => (top + bottom) * .5;

  Iterable<IsoWorldPoint> corners({double height = 0}) sync* {
    yield IsoWorldPoint(left, top, height);
    yield IsoWorldPoint(right, top, height);
    yield IsoWorldPoint(right, bottom, height);
    yield IsoWorldPoint(left, bottom, height);
  }
}

/// Stateless isometric projection used by both the game and geometry tests.
class IsoProjector {
  const IsoProjector({
    this.tileWidth = 56,
    this.tileHeight = 28,
    this.heightStep = 28,
  });

  final double tileWidth;
  final double tileHeight;
  final double heightStep;

  Offset project(IsoWorldPoint point) => Offset(
    (point.x - point.z) * tileWidth * .5,
    (point.x + point.z) * tileHeight * .5 - point.height * heightStep,
  );

  /// Projected bounds, including wall height, for camera fitting.
  Rect projectedBounds(IsoWorldRect rect, {double wallHeight = 0}) {
    final points = <Offset>[
      ...rect.corners().map(project),
      if (wallHeight > 0) ...rect.corners(height: wallHeight).map(project),
    ];
    var minX = double.infinity;
    var minY = double.infinity;
    var maxX = double.negativeInfinity;
    var maxY = double.negativeInfinity;
    for (final point in points) {
      minX = math.min(minX, point.dx);
      minY = math.min(minY, point.dy);
      maxX = math.max(maxX, point.dx);
      maxY = math.max(maxY, point.dy);
    }
    return Rect.fromLTRB(minX, minY, maxX, maxY);
  }

  /// Returns a scale which fits [bounds] without cropping.
  double fitScale(
    Rect bounds,
    Size viewport, {
    double horizontalPadding = 24,
    double verticalPadding = 24,
    double minScale = .12,
    double maxScale = 1.35,
  }) {
    if (bounds.isEmpty || viewport.isEmpty) return 1;
    final width = math.max(1, viewport.width - horizontalPadding * 2);
    final height = math.max(1, viewport.height - verticalPadding * 2);
    return math
        .min(width / bounds.width, height / bounds.height)
        .clamp(minScale, maxScale)
        .toDouble();
  }
}
