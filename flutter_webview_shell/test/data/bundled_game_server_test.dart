import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_shell/data/bundled_game_server.dart';

void main() {
  late BundledGameServer server;
  late Uri origin;

  setUp(() async {
    final Map<String, List<int>> assets = <String, List<int>>{
      'test-game/index.html': utf8.encode('<main>Хмель & Мёд</main>'),
      'test-game/assets/app.js': utf8.encode('globalThis.ready = true;'),
    };
    server = BundledGameServer(
      assetPrefix: 'test-game',
      port: 0,
      assetLoader: (String key) async {
        final List<int>? bytes = assets[key];
        if (bytes == null) {
          throw StateError('Missing test asset: $key');
        }
        final Uint8List typed = Uint8List.fromList(bytes);
        return ByteData.view(typed.buffer);
      },
    );
    origin = await server.start();
  });

  tearDown(() => server.close());

  test('serves the game entry point and module MIME types', () async {
    final HttpClient client = HttpClient();
    addTearDown(client.close);

    final HttpClientResponse indexResponse = await (await client.getUrl(
      origin,
    )).close();
    expect(indexResponse.statusCode, HttpStatus.ok);
    expect(indexResponse.headers.contentType?.mimeType, 'text/html');
    expect(await utf8.decoder.bind(indexResponse).join(), contains('Хмель'));

    final Uri moduleUri = origin.resolve('assets/app.js');
    final HttpClientResponse moduleResponse = await (await client.getUrl(
      moduleUri,
    )).close();
    expect(moduleResponse.statusCode, HttpStatus.ok);
    expect(moduleResponse.headers.contentType?.mimeType, 'text/javascript');
  });

  test('falls back to index only for client routes', () async {
    final HttpClient client = HttpClient();
    addTearDown(client.close);

    final HttpClientResponse routeResponse = await (await client.getUrl(
      origin.resolve('room/karaoke'),
    )).close();
    expect(routeResponse.statusCode, HttpStatus.ok);

    final HttpClientResponse missingAsset = await (await client.getUrl(
      origin.resolve('assets/missing.js'),
    )).close();
    expect(missingAsset.statusCode, HttpStatus.notFound);
  });
}
