import 'package:flame/game.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/domain/bar_simulation.dart';
import 'package:hops_and_honey_flame/game/hops_honey_game.dart';
import 'package:hops_and_honey_flame/game/venue_scene_renderer.dart';

void main() {
  testWidgets('game advances and renders the procedural venue', (tester) async {
    final simulation = BarSimulation()..start();
    final game = HopsHoneyGame(simulation: simulation);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
            width: 390,
            height: 700,
            child: GameWidget(game: game),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(game.snapshot.started, isTrue);
    expect(game.cameraState.scale, greaterThan(0));
    expect(tester.takeException(), isNull);

    game.setVenueFocus(SceneVenue.karaoke);
    await tester.pump(const Duration(milliseconds: 300));
    expect(game.venueFocus, SceneVenue.karaoke);
    expect(tester.takeException(), isNull);
  });
}
