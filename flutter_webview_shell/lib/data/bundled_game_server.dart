import 'dart:io';

import 'package:flutter/services.dart';

typedef GameAssetLoader = Future<ByteData> Function(String key);

class BundledGameServer {
  BundledGameServer({
    required this.assetPrefix,
    required this.port,
    GameAssetLoader? assetLoader,
  }) : _assetLoader = assetLoader ?? rootBundle.load;

  final String assetPrefix;
  final int port;
  final GameAssetLoader _assetLoader;

  HttpServer? _server;

  Future<Uri> start() async {
    final HttpServer? existing = _server;
    if (existing != null) {
      return _originFor(existing.port);
    }

    final HttpServer server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      port,
      shared: false,
    );
    _server = server;
    server.listen(_handleRequest);
    return _originFor(server.port);
  }

  Future<void> close() async {
    final HttpServer? server = _server;
    _server = null;
    await server?.close(force: true);
  }

  Uri _originFor(int boundPort) => Uri(
    scheme: 'http',
    host: InternetAddress.loopbackIPv4.address,
    port: boundPort,
    path: '/',
  );

  Future<void> _handleRequest(HttpRequest request) async {
    final HttpResponse response = request.response;
    response.headers.set('X-Content-Type-Options', 'nosniff');

    if (!request.connectionInfo!.remoteAddress.isLoopback) {
      response.statusCode = HttpStatus.forbidden;
      await response.close();
      return;
    }
    if (request.method != 'GET' && request.method != 'HEAD') {
      response.statusCode = HttpStatus.methodNotAllowed;
      response.headers.set(HttpHeaders.allowHeader, 'GET, HEAD');
      await response.close();
      return;
    }

    final String? relativePath = _assetPathFor(request.uri.path);
    if (relativePath == null) {
      response.statusCode = HttpStatus.notFound;
      await response.close();
      return;
    }

    ByteData data;
    String servedPath = relativePath;
    try {
      data = await _assetLoader('$assetPrefix/$servedPath');
    } on Object {
      if (_looksLikeClientRoute(servedPath)) {
        servedPath = 'index.html';
        try {
          data = await _assetLoader('$assetPrefix/$servedPath');
        } on Object {
          response.statusCode = HttpStatus.notFound;
          await response.close();
          return;
        }
      } else {
        response.statusCode = HttpStatus.notFound;
        await response.close();
        return;
      }
    }

    final Uint8List bytes = data.buffer.asUint8List(
      data.offsetInBytes,
      data.lengthInBytes,
    );
    response.headers.contentType = _contentTypeFor(servedPath);
    response.headers.set(
      HttpHeaders.cacheControlHeader,
      servedPath == 'index.html'
          ? 'no-store'
          : 'public, max-age=31536000, immutable',
    );
    response.contentLength = bytes.length;
    if (request.method == 'GET') {
      response.add(bytes);
    }
    await response.close();
  }

  String? _assetPathFor(String rawPath) {
    final String path;
    try {
      path = Uri.decodeComponent(rawPath);
    } on FormatException {
      return null;
    }
    final List<String> segments = path
        .split('/')
        .where((String segment) => segment.isNotEmpty)
        .toList(growable: false);
    if (segments.any(
      (String segment) =>
          segment == '.' || segment == '..' || segment.contains(r'\'),
    )) {
      return null;
    }
    return segments.isEmpty ? 'index.html' : segments.join('/');
  }

  bool _looksLikeClientRoute(String path) {
    return !path.split('/').last.contains('.');
  }

  ContentType _contentTypeFor(String path) {
    final String extension = path.contains('.')
        ? path.substring(path.lastIndexOf('.') + 1).toLowerCase()
        : '';
    return switch (extension) {
      'html' => ContentType.html,
      'js' || 'mjs' => ContentType('text', 'javascript', charset: 'utf-8'),
      'css' => ContentType('text', 'css', charset: 'utf-8'),
      'json' || 'map' => ContentType.json,
      'svg' => ContentType('image', 'svg+xml'),
      'png' => ContentType('image', 'png'),
      'webp' => ContentType('image', 'webp'),
      'woff' => ContentType('font', 'woff'),
      'woff2' => ContentType('font', 'woff2'),
      _ => ContentType.binary,
    };
  }
}
