import 'dart:math' as math;

import 'package:flutter/material.dart' hide Material;
import 'package:flutter_scene/scene.dart';
import 'package:vector_math/vector_math.dart' as vm;

import '../domain/game_config.dart';
import '../domain/models.dart';
import 'scene_contract.dart';

/// flutter_scene implementation of the complete venue.
///
/// Everything is procedural so the web and mobile builds do not depend on a
/// heavyweight model download. Geometry and materials are cached and shared;
/// only actor roots and a few state indicators change every frame.
class FlutterSceneVenue implements SceneVenueRenderer {
  /// The renderer deliberately keeps no private copy of room geometry.
  static Map<RoomId, RoomLayout> get roomLayoutSource => roomLayouts;

  /// Caps Retina/WebGL render targets without reducing logical UI resolution.
  @visibleForTesting
  static double pixelRatioForDevice(double devicePixelRatio) {
    if (!devicePixelRatio.isFinite) return 1;
    return devicePixelRatio.clamp(1.0, 2.0).toDouble();
  }

  @visibleForTesting
  static ({double renderScale, int shadowCascades, int shadowResolution})
  qualityForViewport(Size size) {
    final compact = size.shortestSide < 520;
    return (
      renderScale: compact ? 0.78 : 0.92,
      shadowCascades: compact ? 2 : 3,
      shadowResolution: compact ? 768 : 1024,
    );
  }

  @visibleForTesting
  static List<List<vm.Matrix4>> barFloorTileTransforms() {
    final batches = List.generate(3, (_) => <vm.Matrix4>[]);
    for (var ix = 0; ix < 8; ix++) {
      for (var iz = 0; iz < 6; iz++) {
        final colorIndex = (ix * 7 + iz * 3).abs() % batches.length;
        batches[colorIndex].add(
          _transform(-6.5 + ix * 1.86, 0.12, -4.6 + iz * 1.86),
        );
      }
    }
    return batches;
  }

  @visibleForTesting
  static List<vm.Matrix4> chairLegTransforms() => [
    for (final legX in [-0.27, 0.27])
      for (final legZ in [-0.27, 0.27]) _transform(legX, 0.27, legZ),
  ];

  FlutterSceneVenue() {
    _scene = Scene()
      ..exposure = 1.08
      ..toneMapping = ToneMappingMode.pbrNeutral
      ..antiAliasingMode = AntiAliasingMode.auto
      ..directionalLight = DirectionalLight(
        direction: vm.Vector3(-0.42, -1, -0.34),
        color: _linear3(0xFFFFE7BE),
        intensity: 2.5,
        castsShadow: true,
        shadowCascadeCount: 3,
        shadowMapResolution: 1024,
        shadowMaxDistance: 76,
        shadowFadeRange: 7,
        shadowSoftness: 0.16,
        shadowDepthBias: 0.018,
        shadowNormalBias: 0.035,
        shadowAmbientStrength: 0.38,
        shadowCasterFaces: ShadowCasterFaces.back,
      );
    _camera = PerspectiveCamera(
      position: vm.Vector3(15, 18, 20),
      target: vm.Vector3(0, 0.4, 0),
      fovRadiansY: 42 * vm.degrees2Radians,
      fovNear: 0.15,
      fovFar: 120,
    );
    _buildVenue();
  }

  late final Scene _scene;
  late final PerspectiveCamera _camera;
  final _GeometryLibrary _geometry = _GeometryLibrary();
  final _MaterialLibrary _materials = _MaterialLibrary();

  final Map<int, _TableVisual> _tables = {};
  final Map<String, _ActorVisual> _actors = {};
  final Map<RoomId, _RoomVisual> _rooms = {};
  final Map<RoomId, _ActorVisual> _roomStaff = {};
  final List<Node> _bottles = [];
  final List<Node> _taps = [];
  final List<Node> _advertisingBulbs = [];

  late final Node _orderTerminal;
  late final Node _glassWasher;
  late final Node _eventRing;
  late final PhysicallyBasedMaterial _eventMaterial;
  late final PointLight _barWarmLight;
  late final PointLight _barFillLight;
  late final PointLight _signLight;

  SceneVenue _focus = SceneVenue.bar;
  Size _viewport = Size.zero;
  double _time = 0;
  bool _snapCamera = true;
  bool _disposed = false;
  int? _lastEventId;
  double _eventAge = 99;

  @override
  Widget buildView({SceneVenueFrameCallback? onFrame}) {
    return Builder(
      builder: (context) => SceneView(
        _scene,
        key: const ValueKey('flutter-scene-venue-view'),
        camera: _camera,
        autoTick: onFrame != null,
        onTick: onFrame,
        pixelRatio: pixelRatioForDevice(MediaQuery.devicePixelRatioOf(context)),
        warmUp: true,
        revealMinDuration: const Duration(milliseconds: 180),
        loadingBuilder: (context, progress) =>
            _SceneLoading(progress: progress),
      ),
    );
  }

  @override
  void focus(SceneVenue venue) {
    if (_focus == venue) return;
    _focus = venue;
    _snapCamera = false;
    for (final entry in _rooms.entries) {
      final selected = SceneVenueRoom.fromRoom(entry.key) == venue;
      entry.value.floor.highlightColor = selected
          ? _linear4(roomDefinition(entry.key).accent, alpha: 0.72)
          : null;
    }
  }

  @override
  void resize(Size size) {
    if (size == _viewport || size.isEmpty) return;
    final portraitChanged = _isPortrait(size) != _isPortrait(_viewport);
    _viewport = size;
    final quality = qualityForViewport(size);
    _scene.renderScale = quality.renderScale;
    final sun = _scene.directionalLight;
    if (sun != null) {
      sun
        ..shadowCascadeCount = quality.shadowCascades
        ..shadowMapResolution = quality.shadowResolution;
    }
    if (portraitChanged) _snapCamera = true;
  }

  @override
  void sync(GameSnapshot snapshot, double deltaSeconds) {
    if (_disposed) return;
    final dt = deltaSeconds.isFinite ? deltaSeconds.clamp(0.0, 0.25) : 0.0;
    _time += dt;
    _syncCamera(dt);
    _syncBar(snapshot);
    _syncTables(snapshot);
    _syncRooms(snapshot, dt);
    _syncActors(snapshot, dt);
    _syncEvent(snapshot, dt);
    _pulseLights(snapshot);
    _scene.update(dt);
  }

  @override
  SceneVenue? hitTest(Offset localPosition, Size viewport) {
    if (_disposed || viewport.isEmpty) return null;
    final hit = _scene.raycast(
      _camera.screenPointToRay(localPosition, viewport),
      where: (node) => node.name.startsWith('pick:'),
    );
    final raw = hit?.node.name;
    if (raw == null) return null;
    final name = raw.substring('pick:'.length);
    for (final venue in SceneVenue.values) {
      if (venue.name == name) return venue;
    }
    return null;
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
  }

  void _buildVenue() {
    final root = _scene.root;
    _meshNode(
      root,
      name: 'ground',
      geometry: _geometry.plane(54, 40),
      material: _materials.pbr(0xFF9FD6CE, roughness: 1),
      transform: _transform(0, -0.23, -4.8),
      staticShadow: true,
      pickable: false,
    );
    _buildConnections(root);
    _buildBar(root);
    for (final entry in roomLayoutSource.entries) {
      _rooms[entry.key] = _buildRoom(root, entry.key, entry.value);
    }
    _buildLighting(root);
    _eventMaterial = _materials.pbr(
      0xFFFFD35C,
      roughness: 0.28,
      metallic: 0.08,
      emissive: 0xFFFF9D3D,
      emission: 2.2,
      uniqueKey: 'event-burst',
    );
    _eventRing = _meshNode(
      root,
      name: 'effect:event-ring',
      geometry: _geometry.ring(0.58, 0.72),
      material: _eventMaterial,
      transform: _transform(0, 0.16, 0),
      staticShadow: false,
      pickable: false,
    )..visible = false;
  }

  void _buildConnections(Node root) {
    for (final entry in roomLayoutSource.entries) {
      final layout = entry.value;
      final centerX = (layout.barPortal.x + layout.roomPortal.x) / 2;
      final centerZ = (layout.barPortal.z + layout.roomPortal.z) / 2;
      final material = switch (entry.key) {
        RoomId.karaoke => _materials.pbr(0xFFE8A76C, roughness: 0.88),
        RoomId.sauna => _materials.pbr(0xFFD9A35F, roughness: 0.9),
        RoomId.massage => _materials.pbr(0xFF88B5A3, roughness: 0.92),
      };
      final alongX = layout.connectionSide != RoomConnectionSide.south;
      final length = alongX
          ? (layout.barPortal.x - layout.roomPortal.x).abs() + 1.3
          : (layout.barPortal.z - layout.roomPortal.z).abs() + 1.3;
      _box(
        root,
        name: 'corridor:${entry.key.name}',
        size: alongX
            ? (length, 0.16, layout.connectorWidth)
            : (layout.connectorWidth, 0.16, length),
        at: (centerX, 0.0, centerZ),
        material: material,
      );
    }
  }

  void _buildBar(Node root) {
    final bar = Node(name: 'venue:bar');
    root.add(bar);
    final floor = _materials.pbr(0xFFE7B07B, roughness: 0.91);
    _box(
      bar,
      name: 'pick:bar',
      size: const (16, 0.2, 12),
      at: const (0, 0, 0),
      material: floor,
      pickable: true,
    );
    const tileColors = [0xFFF7E1BB, 0xFFFFD9B9, 0xFFF2CDA4];
    final tileTransforms = barFloorTileTransforms();
    for (var index = 0; index < tileColors.length; index++) {
      _instancedMeshNode(
        bar,
        name: 'bar-tiles:$index',
        geometry: _geometry.box(1.86, 0.035, 1.86),
        material: _materials.pbr(tileColors[index], roughness: 0.96),
        transforms: tileTransforms[index],
        pickable: false,
      );
    }
    final wall = _materials.pbr(0xFF087B81, roughness: 0.8);
    final trim = _materials.pbr(0xFFF1BD61, roughness: 0.46, metallic: 0.12);
    // Rear wall leaves a wide portal toward massage. Side walls stop below
    // the camera-facing corners so no furniture is hidden.
    _wallSegment(bar, -2.35, -5.88, 11.3, wall, horizontal: true);
    _wallSegment(bar, 7.15, -5.88, 1.7, wall, horizontal: true);
    _wallSegment(bar, -7.88, -2.55, 3.0, wall, horizontal: false);
    _wallSegment(bar, -7.88, 4.15, 3.2, wall, horizontal: false);
    _lowTrim(bar, 0, 5.9, 16, trim, horizontal: true);
    _lowTrim(bar, 7.9, 0, 12, trim, horizontal: false);
    for (final entry in roomLayoutSource.entries) {
      final layout = entry.value;
      _portal(
        bar,
        layout.barPortal.x,
        layout.barPortal.z,
        layout.connectionSide == RoomConnectionSide.south
            ? _PortalAxis.x
            : _PortalAxis.z,
        roomDefinition(entry.key).accent,
      );
    }
    _buildBarCounter(bar);
  }

  void _buildBarCounter(Node bar) {
    final red = _materials.pbr(0xFFB83F3E, roughness: 0.67);
    final gold = _materials.pbr(0xFFF4BD68, roughness: 0.44, metallic: 0.08);
    _box(
      bar,
      name: 'bar-counter',
      size: const (6.3, 1.22, 0.88),
      at: const (-0.25, 0.66, -3.63),
      material: red,
    );
    _box(
      bar,
      name: 'bar-counter-top',
      size: const (6.58, 0.18, 1.1),
      at: const (-0.25, 1.34, -3.63),
      material: gold,
    );
    _box(
      bar,
      name: 'back-shelf',
      size: const (4.9, 2.25, 0.34),
      at: const (-1.35, 1.18, -5.2),
      material: _materials.pbr(0xFF0B6B72, roughness: 0.76),
    );
    for (final y in [0.64, 1.23, 1.82]) {
      _box(
        bar,
        name: 'shelf:$y',
        size: const (4.45, 0.1, 0.44),
        at: (-1.35, y, -4.98),
        material: gold,
      );
    }
    const bottleColors = [
      0xFFF6AD2F,
      0xFFDFF25B,
      0xFF5D2B27,
      0xFFD43C72,
      0xFFF06D38,
    ];
    for (var index = 0; index < 11; index++) {
      final x = -3.25 + (index % 6) * 0.72;
      final y = index < 6 ? 1.05 : 1.65;
      final bottle = _bottle(
        bar,
        name: 'upgrade:bottle:$index',
        x: x,
        y: y,
        z: -4.72,
        color: bottleColors[index % bottleColors.length],
      );
      _bottles.add(bottle);
    }
    for (var index = 0; index < 3; index++) {
      final tap = Node(name: 'upgrade:tap:$index');
      bar.add(tap);
      _cylinder(
        tap,
        name: 'tap-stem',
        bottomRadius: 0.075,
        topRadius: 0.075,
        height: 0.55,
        at: (0, 0.28, 0),
        material: _materials.pbr(0xFF334D53, roughness: 0.34, metallic: 0.38),
      );
      _cylinder(
        tap,
        name: 'tap-handle',
        bottomRadius: 0.055,
        topRadius: 0.055,
        height: 0.38,
        at: (0.17, 0.55, 0),
        material: gold,
        rotationZ: math.pi / 2,
      );
      tap.localTransform = _transform(-1.25 + index * 0.5, 1.43, -3.45);
      _taps.add(tap);
    }
    _orderTerminal = _buildTerminal(bar);
    _glassWasher = _buildWasher(bar);
    for (var index = 0; index < 8; index++) {
      final angle = index / 8 * math.pi * 2;
      final bulb = _sphere(
        bar,
        name: 'upgrade:ad-bulb:$index',
        radius: 0.09,
        at: (
          -0.25 + math.cos(angle) * 2.25,
          2.62 + math.sin(angle) * 0.36,
          -5.02,
        ),
        material: _materials.pbr(
          index.isEven ? 0xFFFFD36A : 0xFF6DE3FF,
          roughness: 0.32,
          emissive: index.isEven ? 0xFFFFB13D : 0xFF31BFD2,
          emission: 1.5,
        ),
        staticShadow: false,
      );
      _advertisingBulbs.add(bulb);
    }
  }

  Node _buildTerminal(Node bar) {
    final root = Node(
      name: 'upgrade:order-terminal',
      localTransform: _transform(1.75, 1.62, -3.12, rotationX: -0.18),
    );
    bar.add(root);
    _box(
      root,
      name: 'terminal-body',
      size: const (0.75, 0.12, 0.54),
      at: const (0, 0, 0),
      material: _materials.pbr(0xFF193F4B, roughness: 0.38, metallic: 0.24),
    );
    _box(
      root,
      name: 'terminal-screen',
      size: const (0.61, 0.035, 0.41),
      at: const (0, 0.075, 0),
      material: _materials.pbr(
        0xFF9AF4DD,
        roughness: 0.25,
        emissive: 0xFF23BEA2,
        emission: 1.1,
      ),
      staticShadow: false,
    );
    return root;
  }

  Node _buildWasher(Node bar) {
    final root = Node(
      name: 'upgrade:glass-washer',
      localTransform: _transform(2.15, 0.62, -4.93),
    );
    bar.add(root);
    _box(
      root,
      name: 'washer-body',
      size: const (1.12, 0.74, 0.8),
      at: const (0, 0, 0),
      material: _materials.pbr(0xFF85B7B0, roughness: 0.34, metallic: 0.36),
    );
    _box(
      root,
      name: 'washer-lid',
      size: const (0.9, 0.08, 0.58),
      at: const (0, 0.41, 0),
      material: _materials.pbr(0xFFE8FBF5, roughness: 0.28, metallic: 0.2),
    );
    return root;
  }

  _RoomVisual _buildRoom(Node root, RoomId id, RoomLayout layout) {
    final definition = roomDefinition(id);
    final roomRoot = Node(
      name: 'venue:${id.name}',
      localTransform: _transform(layout.center.x, 0, layout.center.z),
    );
    root.add(roomRoot);
    final floorColor = switch (id) {
      RoomId.karaoke => 0xFFCEC2DB,
      RoomId.sauna => 0xFFE4BD80,
      RoomId.massage => 0xFFCFE8DF,
    };
    final floor = _box(
      roomRoot,
      name: 'pick:${id.name}',
      size: (layout.size.x, 0.2, layout.size.z),
      at: const (0, 0, 0),
      material: _materials.pbr(floorColor, roughness: 0.92),
      pickable: true,
    );
    final wallMaterial = _materials.pbr(definition.color, roughness: 0.82);
    final trim = _materials.pbr(
      definition.accent,
      roughness: 0.5,
      metallic: 0.08,
    );
    final halfWidth = layout.size.x / 2;
    final halfDepth = layout.size.z / 2;
    final localPortal = layout.toLocal(layout.roomPortal);
    _wallSegment(
      roomRoot,
      0,
      -halfDepth + 0.12,
      layout.size.x,
      wallMaterial,
      horizontal: true,
    );
    switch (layout.connectionSide) {
      case RoomConnectionSide.east:
        _wallSegment(
          roomRoot,
          halfWidth - 0.12,
          localPortal.z - 3.45,
          3.2,
          wallMaterial,
          horizontal: false,
        );
        _wallSegment(
          roomRoot,
          halfWidth - 0.12,
          localPortal.z + 3.45,
          3.2,
          wallMaterial,
          horizontal: false,
        );
        _portal(
          roomRoot,
          localPortal.x,
          localPortal.z,
          _PortalAxis.z,
          definition.accent,
        );
      case RoomConnectionSide.west:
        _wallSegment(
          roomRoot,
          -halfWidth + 0.12,
          localPortal.z - 3.45,
          3.2,
          wallMaterial,
          horizontal: false,
        );
        _wallSegment(
          roomRoot,
          -halfWidth + 0.12,
          localPortal.z + 3.45,
          3.2,
          wallMaterial,
          horizontal: false,
        );
        _portal(
          roomRoot,
          localPortal.x,
          localPortal.z,
          _PortalAxis.z,
          definition.accent,
        );
      case RoomConnectionSide.south:
        _wallSegment(
          roomRoot,
          localPortal.x - 4.2,
          halfDepth - 0.12,
          3.3,
          wallMaterial,
          horizontal: true,
        );
        _wallSegment(
          roomRoot,
          localPortal.x + 2.8,
          halfDepth - 0.12,
          2.4,
          wallMaterial,
          horizontal: true,
        );
        _portal(
          roomRoot,
          localPortal.x,
          localPortal.z,
          _PortalAxis.x,
          definition.accent,
        );
    }
    _lowTrim(
      roomRoot,
      0,
      halfDepth - 0.08,
      layout.size.x,
      trim,
      horizontal: true,
    );

    final unlocked = Node(name: 'room:${id.name}:interior');
    final locked = Node(name: 'room:${id.name}:repair');
    roomRoot.add(locked);
    final capacity = <Node>[];
    final quality = <Node>[];
    final staffSpeed = <Node>[];
    switch (id) {
      case RoomId.karaoke:
        _buildKaraoke(unlocked, definition, capacity, quality, staffSpeed);
      case RoomId.sauna:
        _buildSauna(unlocked, definition, capacity, quality, staffSpeed);
      case RoomId.massage:
        _buildMassage(unlocked, definition, capacity, quality, staffSpeed);
    }
    _buildRepairSite(locked, definition.accent);
    final progress = _meshNode(
      unlocked,
      name: 'room:${id.name}:progress',
      geometry: _geometry.ring(2.65, 2.76),
      material: _materials.pbr(
        definition.accent,
        roughness: 0.3,
        emissive: definition.accent,
        emission: 1.3,
      ),
      transform: _transform(0, 0.16, 0),
      staticShadow: false,
      pickable: false,
    )..visible = false;
    final staff = _buildPerson(
      unlocked,
      id: 'staff:${id.name}',
      primary: definition.color,
      secondary: definition.accent,
      bartender: false,
    );
    final localStaffSpot = layout.toLocal(layout.staffSpot);
    staff.root.localTransform = _transform(
      localStaffSpot.x,
      0.02,
      localStaffSpot.z,
    );
    _roomStaff[id] = staff;

    final light = PointLight(
      color: _linear3(definition.accent),
      intensity: 5.5,
      range: 9,
      falloffExponent: 1.65,
    );
    final lightNode = Node(
      name: 'light:${id.name}',
      localTransform: _transform(1.35, 3.2, 1.2),
    )..addComponent(PointLightComponent(light));
    roomRoot.add(lightNode);
    return _RoomVisual(
      layout: layout,
      root: roomRoot,
      floor: floor,
      unlockedRoot: unlocked,
      lockedRoot: locked,
      progress: progress,
      capacity: capacity,
      quality: quality,
      staffSpeed: staffSpeed,
      light: light,
    );
  }

  void _buildKaraoke(
    Node root,
    RoomDefinition definition,
    List<Node> capacity,
    List<Node> quality,
    List<Node> staffSpeed,
  ) {
    _box(
      root,
      name: 'karaoke-stage',
      size: const (5.7, 0.42, 2.15),
      at: const (-0.35, 0.3, -3.25),
      material: _materials.pbr(0xFF62469A, roughness: 0.68),
    );
    _box(
      root,
      name: 'karaoke-screen-frame',
      size: const (4.4, 2.1, 0.26),
      at: const (-0.35, 1.72, -4.92),
      material: _materials.pbr(0xFF241C40, roughness: 0.42, metallic: 0.18),
    );
    _box(
      root,
      name: 'karaoke-screen',
      size: const (3.92, 1.62, 0.08),
      at: const (-0.35, 1.72, -4.74),
      material: _materials.pbr(
        0xFF4CC8D9,
        roughness: 0.22,
        emissive: 0xFF2E7CCB,
        emission: 1.35,
      ),
      staticShadow: false,
    );
    for (var index = 0; index < 3; index++) {
      final seat = Node(
        name: 'karaoke-seat:$index',
        localTransform: _transform(-2.3 + index * 2.25, 0, 2.22),
      );
      root.add(seat);
      _box(
        seat,
        name: 'sofa-base',
        size: const (1.72, 0.5, 1.05),
        at: const (0, 0.38, 0),
        material: _materials.pbr(
          index.isEven ? 0xFFB04D82 : 0xFF437B9D,
          roughness: 0.8,
        ),
      );
      _box(
        seat,
        name: 'sofa-back',
        size: const (1.72, 0.82, 0.32),
        at: const (0, 0.77, 0.48),
        material: _materials.pbr(
          index.isEven ? 0xFFD165A1 : 0xFF58A5C8,
          roughness: 0.78,
        ),
      );
      capacity.add(seat);
    }
    for (var index = 0; index < 5; index++) {
      final speaker = Node(
        name: 'karaoke-quality:$index',
        localTransform: _transform(
          index.isEven ? -3.65 : 3.2,
          0,
          -3.75 + (index ~/ 2) * 1.18,
        ),
      );
      root.add(speaker);
      _box(
        speaker,
        name: 'speaker-body',
        size: const (0.7, 1.18, 0.58),
        at: const (0, 0.64, 0),
        material: _materials.pbr(0xFF20293F, roughness: 0.54),
      );
      for (final y in [0.42, 0.8]) {
        _cylinder(
          speaker,
          name: 'speaker-cone',
          bottomRadius: 0.19,
          topRadius: 0.19,
          height: 0.045,
          at: (0, y, 0.31),
          material: _materials.pbr(
            definition.accent,
            roughness: 0.42,
            emissive: definition.accent,
            emission: 0.45,
          ),
          rotationX: math.pi / 2,
          staticShadow: false,
        );
      }
      quality.add(speaker);
    }
    _sphere(
      root,
      name: 'karaoke-disco-ball',
      radius: 0.48,
      at: const (-0.25, 3.05, -0.25),
      material: _materials.pbr(
        0xFFD8F1FF,
        roughness: 0.12,
        metallic: 0.82,
        emissive: 0xFF8B75FF,
        emission: 0.65,
      ),
      staticShadow: false,
    );
    for (var index = 0; index < 5; index++) {
      final microphone = Node(
        name: 'karaoke-staff-upgrade:$index',
        localTransform: _transform(-1.35 + index * 0.4, 0.22, -2.05),
      );
      root.add(microphone);
      _cylinder(
        microphone,
        name: 'mic-stand',
        bottomRadius: 0.035,
        topRadius: 0.035,
        height: 0.8,
        at: const (0, 0.4, 0),
        material: _materials.pbr(0xFF253741, roughness: 0.35, metallic: 0.42),
      );
      _sphere(
        microphone,
        name: 'mic-head',
        radius: 0.105,
        at: const (0, 0.84, 0),
        material: _materials.pbr(definition.accent, roughness: 0.46),
      );
      staffSpeed.add(microphone);
    }
  }

  void _buildSauna(
    Node root,
    RoomDefinition definition,
    List<Node> capacity,
    List<Node> quality,
    List<Node> staffSpeed,
  ) {
    for (final z in [-3.7, -2.25]) {
      _box(
        root,
        name: 'sauna-bench:$z',
        size: const (6.7, 0.3, 1.0),
        at: (0.3, z == -3.7 ? 0.47 : 0.29, z),
        material: _materials.pbr(
          z == -3.7 ? 0xFFD69A59 : 0xFFC88346,
          roughness: 0.88,
        ),
      );
    }
    for (var index = 0; index < 4; index++) {
      final mat = Node(
        name: 'sauna-place:$index',
        localTransform: _transform(-2.35 + index * 1.57, 0, 0.8),
      );
      root.add(mat);
      _box(
        mat,
        name: 'sauna-mat',
        size: const (1.05, 0.22, 0.68),
        at: const (0, 0.18, 0),
        material: _materials.pbr(
          index.isEven ? 0xFFC98546 : 0xFFB66F37,
          roughness: 0.9,
        ),
      );
      _box(
        mat,
        name: 'sauna-towel',
        size: const (0.63, 0.055, 0.4),
        at: const (0, 0.33, 0),
        material: _materials.pbr(0xFFFFF1DC, roughness: 0.98),
      );
      capacity.add(mat);
    }
    _cylinder(
      root,
      name: 'sauna-stove',
      bottomRadius: 0.68,
      topRadius: 0.57,
      height: 1.12,
      at: const (-3.15, 0.63, 2.9),
      material: _materials.pbr(0xFF555B59, roughness: 0.82, metallic: 0.28),
    );
    for (var index = 0; index < 9; index++) {
      _sphere(
        root,
        name: 'sauna-stone:$index',
        radius: 0.16 + (index % 3) * 0.025,
        at: (
          -3.45 + (index % 3) * 0.28,
          1.16 + (index ~/ 3) * 0.13,
          2.72 + (index % 2) * 0.26,
        ),
        material: _materials.pbr(0xFF6D5D55, roughness: 0.98),
      );
    }
    for (var index = 0; index < 5; index++) {
      final panel = _box(
        root,
        name: 'sauna-quality:$index',
        size: const (0.64, 0.34, 0.12),
        at: (3.55, 0.55 + index * 0.4, -2.65 + (index % 2) * 0.72),
        material: _materials.pbr(
          index.isEven ? 0xFFFFF0B8 : 0xFFF5C07D,
          roughness: 0.72,
          emissive: 0xFFE78442,
          emission: 0.22 + index * 0.04,
        ),
        staticShadow: false,
      );
      quality.add(panel);
    }
    for (var index = 0; index < 5; index++) {
      final vial = _cylinder(
        root,
        name: 'sauna-staff-upgrade:$index',
        bottomRadius: 0.11,
        topRadius: 0.08,
        height: 0.38,
        at: (-2.8 + index * 0.36, 0.29, 1.82),
        material: _materials.pbr(
          index.isEven ? 0xFF65A690 : 0xFFA7633B,
          roughness: 0.66,
        ),
      );
      staffSpeed.add(vial);
    }
  }

  void _buildMassage(
    Node root,
    RoomDefinition definition,
    List<Node> capacity,
    List<Node> quality,
    List<Node> staffSpeed,
  ) {
    for (var index = 0; index < 2; index++) {
      final x = index == 0 ? -1.85 : 1.85;
      final table = Node(
        name: 'massage-place:$index',
        localTransform: _transform(x, 0, -0.45),
      );
      root.add(table);
      _box(
        table,
        name: 'massage-rug',
        size: const (2.2, 0.06, 3.6),
        at: const (0, 0.08, 0),
        material: _materials.pbr(
          index == 0 ? 0xFFD1EEE4 : 0xFFEDDAC9,
          roughness: 0.98,
        ),
      );
      _box(
        table,
        name: 'massage-table',
        size: const (1.45, 0.44, 2.7),
        at: const (0, 0.58, 0),
        material: _materials.pbr(0xFFF3D6B3, roughness: 0.86),
      );
      _box(
        table,
        name: 'massage-pillow',
        size: const (0.84, 0.23, 0.54),
        at: const (0, 0.92, -0.78),
        material: _materials.pbr(0xFFC4EEE0, roughness: 0.82),
      );
      capacity.add(table);
    }
    _box(
      root,
      name: 'massage-cabinet',
      size: const (2.4, 0.82, 0.68),
      at: const (0.1, 0.45, -4.65),
      material: _materials.pbr(0xFFA87552, roughness: 0.86),
    );
    for (var index = 0; index < 5; index++) {
      final lamp = Node(
        name: 'massage-quality:$index',
        localTransform: _transform(
          -0.82 + index * 0.4,
          1.02 + (index ~/ 5) * 0.2,
          -4.58,
        ),
      );
      root.add(lamp);
      _cylinder(
        lamp,
        name: 'oil-bottle',
        bottomRadius: 0.07,
        topRadius: 0.055,
        height: 0.23 + (index % 2) * 0.07,
        at: const (0, 0, 0),
        material: _materials.pbr(
          index.isEven ? definition.accent : 0xFFF0B676,
          roughness: 0.46,
          emissive: 0xFFFFD08A,
          emission: 0.32,
        ),
        staticShadow: false,
      );
      quality.add(lamp);
    }
    for (var index = 0; index < 5; index++) {
      final oil = _cylinder(
        root,
        name: 'massage-staff-upgrade:$index',
        bottomRadius: 0.075,
        topRadius: 0.052,
        height: 0.3,
        at: (0.78 + index * 0.23, 0.98, -4.56),
        material: _materials.pbr(
          index.isEven ? 0xFF7BBDAA : 0xFFE7B57C,
          roughness: 0.5,
        ),
      );
      staffSpeed.add(oil);
    }
    for (final x in [-3.35, 3.35]) {
      _cylinder(
        root,
        name: 'massage-planter:$x',
        bottomRadius: 0.32,
        topRadius: 0.27,
        height: 0.58,
        at: (x, 0.34, -3.85),
        material: _materials.pbr(0xFFE9B06B, roughness: 0.8),
      );
      _sphere(
        root,
        name: 'massage-plant:$x',
        radius: 0.48,
        at: (x, 0.95, -3.85),
        material: _materials.pbr(0xFF63B87F, roughness: 0.88),
      );
    }
  }

  void _buildRepairSite(Node root, int accent) {
    _box(
      root,
      name: 'repair-crate',
      size: const (2.2, 1.1, 1.4),
      at: const (-1.65, 0.62, 0.2),
      material: _materials.pbr(0xFF8A6D52, roughness: 0.94),
    );
    for (final x in [-3.0, 3.0]) {
      _cylinder(
        root,
        name: 'repair-post:$x',
        bottomRadius: 0.11,
        topRadius: 0.11,
        height: 2.7,
        at: (x, 1.4, 0.6),
        material: _materials.pbr(0xFF62564D, roughness: 0.88),
      );
    }
    _box(
      root,
      name: 'repair-sign',
      size: const (4.9, 0.48, 0.2),
      at: const (0, 1.55, 0.6),
      material: _materials.pbr(
        accent,
        roughness: 0.54,
        emissive: accent,
        emission: 0.28,
      ),
    );
  }

  void _buildLighting(Node root) {
    _barWarmLight = PointLight(
      color: _linear3(0xFFFFBD62),
      intensity: 17,
      range: 11,
      falloffExponent: 1.65,
    );
    root.add(
      Node(name: 'light:bar-warm', localTransform: _transform(0, 4.2, -3))
        ..addComponent(PointLightComponent(_barWarmLight)),
    );
    _barFillLight = PointLight(
      color: _linear3(0xFF46D4C4),
      intensity: 8.5,
      range: 8,
      falloffExponent: 1.7,
    );
    root.add(
      Node(name: 'light:bar-fill', localTransform: _transform(-5, 3.2, 3))
        ..addComponent(PointLightComponent(_barFillLight)),
    );
    _signLight = PointLight(
      color: _linear3(0xFFFFA84D),
      intensity: 5,
      range: 6,
      falloffExponent: 1.6,
    );
    root.add(
      Node(name: 'light:sign', localTransform: _transform(-0.25, 3.35, -4.85))
        ..addComponent(PointLightComponent(_signLight)),
    );
  }

  void _syncCamera(double dt) {
    final pose = _cameraPose(_focus, _isPortrait(_viewport));
    if (_snapCamera || dt <= 0) {
      _camera.position.setFrom(pose.position);
      _camera.target.setFrom(pose.target);
      _camera.fovRadiansY = pose.fovRadians;
      _snapCamera = false;
      return;
    }
    final blend = 1 - math.exp(-dt * 4.2);
    _camera.position.setValues(
      _lerp(_camera.position.x, pose.position.x, blend),
      _lerp(_camera.position.y, pose.position.y, blend),
      _lerp(_camera.position.z, pose.position.z, blend),
    );
    _camera.target.setValues(
      _lerp(_camera.target.x, pose.target.x, blend),
      _lerp(_camera.target.y, pose.target.y, blend),
      _lerp(_camera.target.z, pose.target.z, blend),
    );
    _camera.fovRadiansY = _lerp(_camera.fovRadiansY, pose.fovRadians, blend);
  }

  _CameraPose _cameraPose(SceneVenue venue, bool portrait) {
    final target = switch (venue) {
      SceneVenue.overview => vm.Vector3(0, 0.28, -4.65),
      SceneVenue.bar => vm.Vector3(-0.25, 0.44, 0.05),
      SceneVenue.karaoke => _roomCameraTarget(
        RoomId.karaoke,
        offsetX: 0.65,
        offsetZ: -0.05,
      ),
      SceneVenue.sauna => _roomCameraTarget(
        RoomId.sauna,
        offsetX: -0.65,
        offsetZ: 0.05,
      ),
      SceneVenue.massage => _roomCameraTarget(RoomId.massage, offsetZ: 0.15),
    };
    final offset = switch (venue) {
      SceneVenue.overview =>
        portrait ? vm.Vector3(43, 51, 51) : vm.Vector3(34, 39, 41),
      SceneVenue.bar =>
        portrait ? vm.Vector3(19, 25, 27) : vm.Vector3(13.3, 17.2, 19.1),
      SceneVenue.karaoke =>
        portrait ? vm.Vector3(-16.5, 23, 22) : vm.Vector3(-11.2, 15.5, 15.2),
      SceneVenue.sauna =>
        portrait ? vm.Vector3(16.5, 23, 22) : vm.Vector3(11.2, 15.5, 15.2),
      SceneVenue.massage =>
        portrait ? vm.Vector3(16.5, 23, -22) : vm.Vector3(11.2, 15.5, -15.2),
    };
    final fovDegrees = switch (venue) {
      SceneVenue.overview => portrait ? 58.0 : 46.0,
      SceneVenue.bar => portrait ? 51.0 : 43.0,
      SceneVenue.karaoke ||
      SceneVenue.sauna ||
      SceneVenue.massage => portrait ? 48.0 : 41.5,
    };
    return _CameraPose(
      position: target + offset,
      target: target,
      fovRadians: fovDegrees * vm.degrees2Radians,
    );
  }

  vm.Vector3 _roomCameraTarget(
    RoomId id, {
    double offsetX = 0,
    double offsetZ = 0,
  }) {
    final center = roomLayoutSource[id]!.center;
    return vm.Vector3(center.x + offsetX, 0.42, center.z + offsetZ);
  }

  void _syncBar(GameSnapshot snapshot) {
    final upgrades = snapshot.upgrades;
    final bottleCount = math.min(
      _bottles.length,
      3 + (upgrades.assortment - 1) * 2,
    );
    for (var index = 0; index < _bottles.length; index++) {
      _bottles[index].visible = index < bottleCount;
    }
    final tapCount = math.min(
      _taps.length,
      1 + ((upgrades.prepSpeed - 1) / 2).floor(),
    );
    for (var index = 0; index < _taps.length; index++) {
      _taps[index].visible = index < tapCount;
    }
    _orderTerminal.visible = upgrades.orderSpeed > 1;
    _glassWasher.visible = upgrades.cleanSpeed > 1;
    for (var index = 0; index < _advertisingBulbs.length; index++) {
      _advertisingBulbs[index].visible = index < upgrades.advertising;
    }
  }

  void _syncTables(GameSnapshot snapshot) {
    for (final table in snapshot.tables) {
      final visual = _tables.putIfAbsent(
        table.id,
        () => _buildTable(_scene.root, table),
      );
      visual.dirty.visible = table.dirty;
      if (table.dirty) {
        final pulse = 0.86 + math.sin(_time * 4.8 + table.id) * 0.12;
        visual.dirty.localTransform = _transform(
          0.2,
          1.12 + pulse * 0.04,
          0.02,
          scale: pulse,
        );
      }
    }
  }

  _TableVisual _buildTable(Node root, TableSnapshot table) {
    final tableRoot = Node(
      name: 'table:${table.id}',
      localTransform: _transform(table.position.x, 0.11, table.position.z),
    );
    root.add(tableRoot);
    _cylinder(
      tableRoot,
      name: 'table-top',
      bottomRadius: 0.76,
      topRadius: 0.72,
      height: 0.18,
      at: const (0, 0.78, 0),
      material: _materials.pbr(0xFFB84E3F, roughness: 0.66),
      radialSegments: 24,
    );
    _cylinder(
      tableRoot,
      name: 'table-stem',
      bottomRadius: 0.24,
      topRadius: 0.13,
      height: 0.72,
      at: const (0, 0.42, 0),
      material: _materials.pbr(0xFF6F3A32, roughness: 0.82),
    );
    _cylinder(
      tableRoot,
      name: 'table-foot',
      bottomRadius: 0.48,
      topRadius: 0.42,
      height: 0.14,
      at: const (0, 0.08, 0),
      material: _materials.pbr(0xFF4F3530, roughness: 0.92),
    );
    _buildChair(tableRoot, 0, 0, guestChairOffset, math.pi);
    _buildChair(tableRoot, 1, -0.98, -0.05, -math.pi / 2);
    _cylinder(
      tableRoot,
      name: 'candle',
      bottomRadius: 0.08,
      topRadius: 0.07,
      height: 0.23,
      at: const (0.3, 1.02, -0.18),
      material: _materials.pbr(0xFFFFF0C9, roughness: 0.65),
    );
    _sphere(
      tableRoot,
      name: 'candle-flame',
      radius: 0.075,
      at: const (0.3, 1.19, -0.18),
      material: _materials.pbr(
        0xFFFFD35C,
        roughness: 0.3,
        emissive: 0xFFFF9D3D,
        emission: 1.7,
      ),
      staticShadow: false,
    );
    final dirty = Node(name: 'table:${table.id}:dirty');
    tableRoot.add(dirty);
    _cylinder(
      dirty,
      name: 'dirty-mug',
      bottomRadius: 0.12,
      topRadius: 0.15,
      height: 0.34,
      at: const (0, 0, 0),
      material: _materials.pbr(0xFF90724F, roughness: 0.72),
      staticShadow: false,
    );
    dirty.visible = table.dirty;
    return _TableVisual(dirty: dirty);
  }

  void _buildChair(Node parent, int id, double x, double z, double rotation) {
    final chair = Node(
      name: 'chair:$id',
      localTransform: _transform(x, 0, z, rotationY: rotation),
    );
    parent.add(chair);
    _box(
      chair,
      name: 'chair-seat',
      size: const (0.74, 0.16, 0.74),
      at: const (0, 0.55, 0),
      material: _materials.pbr(0xFF157F80, roughness: 0.74),
    );
    _box(
      chair,
      name: 'chair-cushion',
      size: const (0.59, 0.1, 0.58),
      at: const (0, 0.67, 0.02),
      material: _materials.pbr(0xFFF4A33E, roughness: 0.58),
    );
    _box(
      chair,
      name: 'chair-back',
      size: const (0.74, 0.76, 0.16),
      at: const (0, 0.88, -0.32),
      material: _materials.pbr(0xFFEF5C4F, roughness: 0.72),
    );
    _instancedMeshNode(
      chair,
      name: 'chair-legs',
      geometry: _geometry.cylinder(0.055, 0.045, 0.56, 8),
      material: _materials.pbr(0xFF43382F, roughness: 0.92),
      transforms: chairLegTransforms(),
    );
  }

  void _syncRooms(GameSnapshot snapshot, double dt) {
    for (final room in snapshot.rooms) {
      final visual = _rooms[room.id];
      if (visual == null) continue;
      _attachRoomState(visual, unlocked: room.unlocked);
      if (!room.unlocked) {
        visual.progress.visible = false;
        visual.light.intensity = 2.2;
        continue;
      }
      for (var index = 0; index < visual.capacity.length; index++) {
        visual.capacity[index].visible = index < room.capacity;
      }
      for (var index = 0; index < visual.quality.length; index++) {
        visual.quality[index].visible = index < room.upgrades.quality;
      }
      for (var index = 0; index < visual.staffSpeed.length; index++) {
        visual.staffSpeed[index].visible = index < room.upgrades.staffSpeed;
      }
      visual.progress.visible =
          room.guests > 0 && room.staffState == RoomStaffState.serving;
      if (visual.progress.visible) {
        final scale = 0.7 + room.progress.clamp(0.0, 1.0) * 0.5;
        visual.progress.localTransform = _transform(
          0,
          0.16,
          0,
          rotationY: _time * 0.35,
          scale: scale,
        );
      }
      visual.light.intensity =
          (SceneVenueRoom.fromRoom(room.id) == _focus ? 13.0 : 6.2) +
          room.upgrades.quality * 0.7;
      final staff = _roomStaff[room.id];
      if (staff != null) {
        final waitingSpot = visual.layout.toLocal(visual.layout.staffSpot);
        final active =
            room.staffState == RoomStaffState.serving ||
            room.staffState == RoomStaffState.welcoming;
        final phase = _time * (active ? 7 + room.upgrades.staffSpeed : 2);
        final x = switch (room.id) {
          RoomId.karaoke || RoomId.sauna => waitingSpot.x,
          RoomId.massage =>
            room.staffState == RoomStaffState.serving
                ? (room.guests > 1 ? 2.6 : -1.0)
                : waitingSpot.x,
        };
        final z = room.id == RoomId.massage && active ? 1.05 : waitingSpot.z;
        staff.root.localTransform = _transform(
          x,
          0.03 + math.sin(phase) * (active ? 0.045 : 0.018),
          z,
          rotationY: room.id == RoomId.sauna ? -2.2 : math.pi,
        );
        _poseLimbs(staff, phase, active ? 0.7 : 0.14);
        staff.carried.visible = active;
      }
    }
  }

  void _attachRoomState(_RoomVisual visual, {required bool unlocked}) {
    final active = unlocked ? visual.unlockedRoot : visual.lockedRoot;
    final inactive = unlocked ? visual.lockedRoot : visual.unlockedRoot;
    inactive.parent?.remove(inactive);
    if (!identical(active.parent, visual.root)) {
      active.parent?.remove(active);
      visual.root.add(active);
    }
    active.visible = true;
  }

  void _syncActors(GameSnapshot snapshot, double dt) {
    final seen = <String>{};
    final bartender = snapshot.bartender;
    final bartenderVisual = _actors.putIfAbsent(
      'bartender',
      () => _buildPerson(
        _scene.root,
        id: 'bartender',
        primary: 0xFF0E7C82,
        secondary: 0xFFFFC456,
        bartender: true,
      ),
    );
    seen.add('bartender');
    _updateActor(
      bartenderVisual,
      bartender.position,
      dt,
      movingState: bartender.state.name,
      carrying: bartender.carryingDrink != null || bartender.carryingDirty,
      happiness: 1,
      speedBoost: snapshot.upgrades.moveSpeed,
    );

    for (var index = 0; index < snapshot.patrons.length; index++) {
      final patron = snapshot.patrons[index];
      seen.add(patron.id);
      final palette =
          _patronPalettes[(patron.id.hashCode.abs() + index) %
              _patronPalettes.length];
      final actor = _actors.putIfAbsent(
        patron.id,
        () => _buildPerson(
          _scene.root,
          id: patron.id,
          primary: palette.$1,
          secondary: palette.$2,
          skin: palette.$3,
          bartender: false,
        ),
      );
      _updateActor(
        actor,
        patron.position,
        dt,
        movingState: patron.state.name,
        carrying: patron.drink != null && patron.state == PatronState.drinking,
        happiness: patron.happiness,
        speedBoost: 1,
      );
    }
    final stale = _actors.keys.where((id) => !seen.contains(id)).toList();
    for (final id in stale) {
      final actor = _actors.remove(id);
      if (actor != null) actor.root.parent?.remove(actor.root);
    }
  }

  void _updateActor(
    _ActorVisual actor,
    Vec2 target,
    double dt, {
    required String movingState,
    required bool carrying,
    required double happiness,
    required int speedBoost,
  }) {
    if (!actor.initialized) {
      actor
        ..x = target.x
        ..z = target.z
        ..initialized = true;
    }
    final previousX = actor.x;
    final previousZ = actor.z;
    final blend = dt <= 0 ? 1.0 : 1 - math.exp(-dt * 12);
    actor
      ..x += (target.x - actor.x) * blend
      ..z += (target.z - actor.z) * blend;
    final dx = actor.x - previousX;
    final dz = actor.z - previousZ;
    final moving = dx.abs() + dz.abs() > 0.0004;
    final phaseRate = moving ? 8.2 + speedBoost * 0.45 : 2.05;
    actor.phase += dt * phaseRate;
    final swing = moving ? 0.62 : 0.1;
    final bob = math.sin(actor.phase * 2) * (moving ? 0.055 : 0.018);
    if (moving) actor.facing = math.atan2(dx, dz);
    actor.root.localTransform = _transform(
      actor.x,
      0.04 + bob,
      actor.z,
      rotationY: actor.facing,
    );
    _poseLimbs(actor, actor.phase, swing);
    actor.carried.visible = carrying;
    actor.root.highlightColor = happiness < 0.24
        ? _linear4(0xFFFF5A54, alpha: 0.42)
        : null;
    actor.body.localTransform = _transform(
      0,
      1.02 + (movingState.contains('prepar') ? math.sin(_time * 8) * 0.035 : 0),
      0,
    );
  }

  void _poseLimbs(_ActorVisual actor, double phase, double amount) {
    final swing = math.sin(phase) * amount;
    actor.leftLeg.localTransform = _transform(
      -0.15,
      0.36,
      0,
      rotationX: swing,
      rotationZ: 0.025,
    );
    actor.rightLeg.localTransform = _transform(
      0.15,
      0.36,
      0,
      rotationX: -swing,
      rotationZ: -0.025,
    );
    actor.leftArm.localTransform = _transform(
      -0.36,
      1.03,
      0,
      rotationX: -swing * 0.8,
      rotationZ: -0.14,
    );
    actor.rightArm.localTransform = _transform(
      0.36,
      1.03,
      0,
      rotationX: swing * 0.8,
      rotationZ: 0.14,
    );
  }

  _ActorVisual _buildPerson(
    Node parent, {
    required String id,
    required int primary,
    required int secondary,
    int skin = 0xFFFFC99F,
    required bool bartender,
  }) {
    final root = Node(name: 'actor:$id');
    parent.add(root);
    final legMaterial = _materials.pbr(0xFF173A45, roughness: 0.88);
    final leftLeg = _cylinder(
      root,
      name: 'left-leg',
      bottomRadius: 0.095,
      topRadius: 0.11,
      height: 0.68,
      at: const (-0.15, 0.36, 0),
      material: legMaterial,
      radialSegments: 8,
      staticShadow: false,
    );
    final rightLeg = _cylinder(
      root,
      name: 'right-leg',
      bottomRadius: 0.095,
      topRadius: 0.11,
      height: 0.68,
      at: const (0.15, 0.36, 0),
      material: legMaterial,
      radialSegments: 8,
      staticShadow: false,
    );
    final body = _cylinder(
      root,
      name: 'body',
      bottomRadius: 0.31,
      topRadius: 0.25,
      height: 0.74,
      at: const (0, 1.02, 0),
      material: _materials.pbr(primary, roughness: 0.72),
      radialSegments: 12,
      staticShadow: false,
    );
    if (bartender) {
      _box(
        body,
        name: 'apron',
        size: const (0.45, 0.44, 0.08),
        at: const (0, -0.08, 0.27),
        material: _materials.pbr(secondary, roughness: 0.76),
        staticShadow: false,
      );
    }
    final armMaterial = _materials.pbr(skin, roughness: 0.82);
    final leftArm = _cylinder(
      root,
      name: 'left-arm',
      bottomRadius: 0.07,
      topRadius: 0.085,
      height: 0.62,
      at: const (-0.36, 1.03, 0),
      material: armMaterial,
      radialSegments: 8,
      rotationZ: -0.14,
      staticShadow: false,
    );
    final rightArm = _cylinder(
      root,
      name: 'right-arm',
      bottomRadius: 0.07,
      topRadius: 0.085,
      height: 0.62,
      at: const (0.36, 1.03, 0),
      material: armMaterial,
      radialSegments: 8,
      rotationZ: 0.14,
      staticShadow: false,
    );
    _sphere(
      root,
      name: 'head',
      radius: 0.27,
      at: const (0, 1.62, 0),
      material: armMaterial,
      staticShadow: false,
    );
    _sphere(
      root,
      name: 'hair',
      radius: 0.275,
      at: const (0, 1.72, -0.02),
      material: _materials.pbr(secondary, roughness: 0.84),
      scale: const (1.01, 0.52, 1.01),
      staticShadow: false,
    );
    final carried = Node(
      name: 'carried-item',
      localTransform: _transform(0.48, 1.02, 0.24),
    );
    root.add(carried);
    _cylinder(
      carried,
      name: 'carried-cup',
      bottomRadius: 0.11,
      topRadius: 0.14,
      height: 0.29,
      at: const (0, 0, 0),
      material: _materials.pbr(
        0xFFF4A92F,
        roughness: 0.36,
        emissive: 0xFFD56F18,
        emission: 0.2,
      ),
      staticShadow: false,
    );
    carried.visible = false;
    return _ActorVisual(
      root: root,
      body: body,
      leftArm: leftArm,
      rightArm: rightArm,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      carried: carried,
    );
  }

  void _syncEvent(GameSnapshot snapshot, double dt) {
    final event = snapshot.lastEvent;
    if (event != null && event.id != _lastEventId) {
      _lastEventId = event.id;
      _eventAge = 0;
      final room = event.roomId;
      final position = room == null
          ? snapshot.bartender.position
          : _rooms[room]!.layout.center;
      _eventRing.localTransform = _transform(position.x, 0.2, position.z);
      _eventRing.visible = true;
    }
    _eventAge += dt;
    if (_eventAge >= 1.25) {
      _eventRing.visible = false;
      return;
    }
    final scale = 0.45 + _eventAge * 2.3;
    final translation = _eventRing.localTransform.getTranslation();
    _eventRing.localTransform = _transform(
      translation.x,
      0.18 + math.sin(_eventAge * math.pi) * 0.16,
      translation.z,
      rotationY: _eventAge * 2.4,
      scale: scale,
    );
  }

  void _pulseLights(GameSnapshot snapshot) {
    _barWarmLight.intensity = 15.5 + math.sin(_time * 2.4) * 1.1;
    _barFillLight.intensity = 8.2 + math.sin(_time * 1.7 + 1.2) * 0.7;
    _signLight.intensity =
        3.5 + snapshot.upgrades.advertising * 0.75 + math.sin(_time * 4) * 0.4;
  }

  void _wallSegment(
    Node parent,
    double x,
    double z,
    double length,
    PhysicallyBasedMaterial material, {
    required bool horizontal,
  }) {
    _box(
      parent,
      name: 'wall',
      size: horizontal ? (length, 2.9, 0.24) : (0.24, 2.9, length),
      at: (x, 1.52, z),
      material: material,
    );
  }

  void _lowTrim(
    Node parent,
    double x,
    double z,
    double length,
    PhysicallyBasedMaterial material, {
    required bool horizontal,
  }) {
    _box(
      parent,
      name: 'low-trim',
      size: horizontal ? (length, 0.25, 0.2) : (0.2, 0.25, length),
      at: (x, 0.22, z),
      material: material,
    );
  }

  void _portal(Node parent, double x, double z, _PortalAxis axis, int accent) {
    final vertical = axis == _PortalAxis.z;
    final cream = _materials.pbr(0xFFFFF1CB, roughness: 0.68);
    final accentMaterial = _materials.pbr(
      accent,
      roughness: 0.48,
      emissive: accent,
      emission: 0.32,
    );
    for (final offset in [-1.32, 1.32]) {
      _box(
        parent,
        name: 'portal-pillar',
        size: const (0.29, 2.44, 0.29),
        at: vertical ? (x, 1.24, z + offset) : (x + offset, 1.24, z),
        material: cream,
      );
    }
    _box(
      parent,
      name: 'portal-header',
      size: vertical ? const (0.31, 0.31, 2.95) : const (2.95, 0.31, 0.31),
      at: (x, 2.42, z),
      material: accentMaterial,
    );
    _box(
      parent,
      name: 'portal-threshold',
      size: vertical ? const (1.3, 0.09, 2.42) : const (2.42, 0.09, 1.3),
      at: (x, 0.12, z),
      material: accentMaterial,
      pickable: false,
    );
  }

  Node _bottle(
    Node parent, {
    required String name,
    required double x,
    required double y,
    required double z,
    required int color,
  }) {
    final root = Node(name: name, localTransform: _transform(x, y, z));
    parent.add(root);
    final glass = _materials.pbr(color, roughness: 0.26, metallic: 0.04);
    _cylinder(
      root,
      name: 'bottle-body',
      bottomRadius: 0.14,
      topRadius: 0.11,
      height: 0.55,
      at: const (0, 0.28, 0),
      material: glass,
      radialSegments: 10,
    );
    _cylinder(
      root,
      name: 'bottle-neck',
      bottomRadius: 0.075,
      topRadius: 0.055,
      height: 0.2,
      at: const (0, 0.65, 0),
      material: glass,
      radialSegments: 10,
    );
    _cylinder(
      root,
      name: 'bottle-cap',
      bottomRadius: 0.063,
      topRadius: 0.063,
      height: 0.055,
      at: const (0, 0.78, 0),
      material: _materials.pbr(0xFFF2C05A, roughness: 0.32, metallic: 0.3),
      radialSegments: 10,
    );
    return root;
  }

  Node _box(
    Node parent, {
    required String name,
    required (double, double, double) size,
    required (double, double, double) at,
    required PhysicallyBasedMaterial material,
    bool staticShadow = true,
    bool pickable = false,
  }) {
    return _meshNode(
      parent,
      name: name,
      geometry: _geometry.box(size.$1, size.$2, size.$3),
      material: material,
      transform: _transform(at.$1, at.$2, at.$3),
      staticShadow: staticShadow,
      pickable: pickable,
    );
  }

  Node _cylinder(
    Node parent, {
    required String name,
    required double bottomRadius,
    required double topRadius,
    required double height,
    required (double, double, double) at,
    required PhysicallyBasedMaterial material,
    int radialSegments = 12,
    double rotationX = 0,
    double rotationY = 0,
    double rotationZ = 0,
    bool staticShadow = true,
  }) {
    return _meshNode(
      parent,
      name: name,
      geometry: _geometry.cylinder(
        bottomRadius,
        topRadius,
        height,
        radialSegments,
      ),
      material: material,
      transform: _transform(
        at.$1,
        at.$2,
        at.$3,
        rotationX: rotationX,
        rotationY: rotationY,
        rotationZ: rotationZ,
      ),
      staticShadow: staticShadow,
      pickable: false,
    );
  }

  Node _sphere(
    Node parent, {
    required String name,
    required double radius,
    required (double, double, double) at,
    required PhysicallyBasedMaterial material,
    (double, double, double) scale = const (1, 1, 1),
    bool staticShadow = true,
  }) {
    return _meshNode(
      parent,
      name: name,
      geometry: _geometry.sphere(radius),
      material: material,
      transform: _transform(
        at.$1,
        at.$2,
        at.$3,
        scaleX: scale.$1,
        scaleY: scale.$2,
        scaleZ: scale.$3,
      ),
      staticShadow: staticShadow,
      pickable: false,
    );
  }

  Node _meshNode(
    Node parent, {
    required String name,
    required Geometry geometry,
    required PhysicallyBasedMaterial material,
    required vm.Matrix4 transform,
    required bool staticShadow,
    required bool pickable,
  }) {
    final node =
        Node(
            name: name,
            localTransform: transform,
            mesh: Mesh(geometry, material),
          )
          ..shadowStatic = staticShadow
          ..raycastable = pickable;
    parent.add(node);
    return node;
  }

  InstancedMesh _instancedMeshNode(
    Node parent, {
    required String name,
    required Geometry geometry,
    required PhysicallyBasedMaterial material,
    required Iterable<vm.Matrix4> transforms,
    bool staticShadow = true,
    bool pickable = false,
  }) {
    final mesh = InstancedMesh(geometry: geometry, material: material);
    for (final transform in transforms) {
      mesh.addInstance(transform);
    }
    final node = Node(name: name)
      ..shadowStatic = staticShadow
      ..raycastable = pickable
      ..addComponent(InstancedMeshComponent(mesh));
    parent.add(node);
    return mesh;
  }
}

class _SceneLoading extends StatelessWidget {
  const _SceneLoading({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final value = progress.isFinite ? progress.clamp(0.0, 1.0) : 0.0;
    return ColoredBox(
      color: const Color(0xFF062A34),
      child: Center(
        child: SizedBox(
          width: 210,
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
              ),
              const SizedBox(height: 10),
              const Text(
                'Готовим 3D-залы…',
                textAlign: TextAlign.center,
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

class _CameraPose {
  const _CameraPose({
    required this.position,
    required this.target,
    required this.fovRadians,
  });

  final vm.Vector3 position;
  final vm.Vector3 target;
  final double fovRadians;
}

class _RoomVisual {
  const _RoomVisual({
    required this.layout,
    required this.root,
    required this.floor,
    required this.unlockedRoot,
    required this.lockedRoot,
    required this.progress,
    required this.capacity,
    required this.quality,
    required this.staffSpeed,
    required this.light,
  });

  final RoomLayout layout;
  final Node root;
  final Node floor;
  final Node unlockedRoot;
  final Node lockedRoot;
  final Node progress;
  final List<Node> capacity;
  final List<Node> quality;
  final List<Node> staffSpeed;
  final PointLight light;
}

class _TableVisual {
  const _TableVisual({required this.dirty});

  final Node dirty;
}

class _ActorVisual {
  _ActorVisual({
    required this.root,
    required this.body,
    required this.leftArm,
    required this.rightArm,
    required this.leftLeg,
    required this.rightLeg,
    required this.carried,
  });

  final Node root;
  final Node body;
  final Node leftArm;
  final Node rightArm;
  final Node leftLeg;
  final Node rightLeg;
  final Node carried;
  bool initialized = false;
  double x = 0;
  double z = 0;
  double facing = math.pi;
  double phase = 0;
}

enum _PortalAxis { x, z }

class _GeometryLibrary {
  final Map<String, CuboidGeometry> _boxes = {};
  final Map<String, PlaneGeometry> _planes = {};
  final Map<String, CylinderGeometry> _cylinders = {};
  final Map<String, SphereGeometry> _spheres = {};
  final Map<String, RingGeometry> _rings = {};

  CuboidGeometry box(double width, double height, double depth) =>
      _boxes.putIfAbsent(
        '$width:$height:$depth',
        () => CuboidGeometry(vm.Vector3(width, height, depth)),
      );

  PlaneGeometry plane(double width, double depth) => _planes.putIfAbsent(
    '$width:$depth',
    () => PlaneGeometry(width: width, depth: depth),
  );

  CylinderGeometry cylinder(
    double bottomRadius,
    double topRadius,
    double height,
    int radialSegments,
  ) => _cylinders.putIfAbsent(
    '$bottomRadius:$topRadius:$height:$radialSegments',
    () => CylinderGeometry(
      bottomRadius: bottomRadius,
      topRadius: topRadius,
      height: height,
      radialSegments: radialSegments,
    ),
  );

  SphereGeometry sphere(double radius) => _spheres.putIfAbsent(
    '$radius',
    () => SphereGeometry(radius: radius, segments: 14, rings: 10),
  );

  RingGeometry ring(double inner, double outer) => _rings.putIfAbsent(
    '$inner:$outer',
    () => RingGeometry(innerRadius: inner, outerRadius: outer, segments: 48),
  );
}

class _MaterialLibrary {
  final Map<String, PhysicallyBasedMaterial> _materials = {};

  PhysicallyBasedMaterial pbr(
    int color, {
    double roughness = 0.75,
    double metallic = 0,
    int? emissive,
    double emission = 0,
    String? uniqueKey,
  }) {
    final key = uniqueKey ?? '$color:$roughness:$metallic:$emissive:$emission';
    return _materials.putIfAbsent(key, () {
      final material = PhysicallyBasedMaterial()
        ..baseColorFactor = _linear4(color)
        ..roughnessFactor = roughness
        ..metallicFactor = metallic;
      if (emissive != null && emission > 0) {
        final value = _linear4(emissive);
        material.emissiveFactor = vm.Vector4(
          value.x * emission,
          value.y * emission,
          value.z * emission,
          1,
        );
      }
      return material;
    });
  }
}

vm.Matrix4 _transform(
  double x,
  double y,
  double z, {
  double rotationX = 0,
  double rotationY = 0,
  double rotationZ = 0,
  double scale = 1,
  double? scaleX,
  double? scaleY,
  double? scaleZ,
}) {
  final matrix = vm.Matrix4.identity()..translateByDouble(x, y, z, 1);
  if (rotationX != 0) matrix.rotateX(rotationX);
  if (rotationY != 0) matrix.rotateY(rotationY);
  if (rotationZ != 0) matrix.rotateZ(rotationZ);
  matrix.scaleByDouble(scaleX ?? scale, scaleY ?? scale, scaleZ ?? scale, 1);
  return matrix;
}

vm.Vector3 _linear3(int color) {
  final value = _linear4(color);
  return vm.Vector3(value.x, value.y, value.z);
}

vm.Vector4 _linear4(int color, {double? alpha}) {
  final r = ((color >> 16) & 0xff) / 255;
  final g = ((color >> 8) & 0xff) / 255;
  final b = (color & 0xff) / 255;
  final a = alpha ?? ((color >>> 24) & 0xff) / 255;
  return vm.Vector4(
    math.pow(r, 2.2).toDouble(),
    math.pow(g, 2.2).toDouble(),
    math.pow(b, 2.2).toDouble(),
    a,
  );
}

double _lerp(double from, double to, double amount) =>
    from + (to - from) * amount;

bool _isPortrait(Size size) => !size.isEmpty && size.height > size.width * 1.16;

const _patronPalettes = <(int, int, int)>[
  (0xFFEF6A55, 0xFF52354D, 0xFFFFC89E),
  (0xFF43A99D, 0xFF243F55, 0xFFA96D4B),
  (0xFFF0B449, 0xFF6B3C2F, 0xFFF3B47E),
  (0xFF8B76D8, 0xFF2F3158, 0xFF8A553D),
  (0xFF4E9ED5, 0xFF5B3043, 0xFFFFD0AA),
  (0xFFDF6CA6, 0xFF303B4B, 0xFFC8865F),
];
