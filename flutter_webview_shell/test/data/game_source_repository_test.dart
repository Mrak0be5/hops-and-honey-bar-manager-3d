import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_shell/config/game_shell_config.dart';
import 'package:hops_and_honey_shell/data/game_source_repository.dart';

void main() {
  final GameSourceRepository source = GameSourceRepository(
    config: GameShellConfig(
      gameUri: Uri.parse('https://game.example.com/play'),
    ),
  );

  test('allows only HTTPS navigation on the original host', () {
    expect(
      source.allowsTopLevelNavigation(
        Uri.parse('https://game.example.com/room?tab=karaoke'),
      ),
      isTrue,
    );
    expect(
      source.allowsTopLevelNavigation(Uri.parse('http://game.example.com')),
      isFalse,
    );
    expect(
      source.allowsTopLevelNavigation(Uri.parse('https://other.example.com')),
      isFalse,
    );
    expect(
      source.allowsTopLevelNavigation(
        Uri.parse('https://sub.game.example.com'),
      ),
      isFalse,
    );
    expect(
      source.allowsTopLevelNavigation(
        Uri.parse('https://game.example.com:444/play'),
      ),
      isFalse,
    );
  });
}
