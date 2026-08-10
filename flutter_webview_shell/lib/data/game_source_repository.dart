import '../config/game_shell_config.dart';

class GameSourceRepository {
  GameSourceRepository({required this.config});

  final GameShellConfig config;

  Uri get initialUri => config.gameUri;

  bool allowsTopLevelNavigation(Uri candidate) {
    final Uri source = config.gameUri;
    return candidate.scheme.toLowerCase() == source.scheme.toLowerCase() &&
        candidate.host.toLowerCase() == source.host.toLowerCase() &&
        candidate.hasPort == source.hasPort &&
        (!candidate.hasPort || candidate.port == source.port);
  }
}
