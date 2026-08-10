# Shared room layout / navigation checkpoint

## Objective

Remove the renderer-to-simulation/A* room geometry mismatch and make every
large rendered room reachable without routes crossing walls or furniture.

## Decisions

- `RoomLayout` in the domain is the single room geometry source. It now owns
  typed connection side, portals, connector width, guest spots, and staff spot.
- The 3D renderer consumes the exact shared map for room floors, roots,
  corridors, portals, camera targets, staff placement, and room event centers;
  the private `_RoomLayout3D` copy was removed.
- Navigation zones and bounds are derived from shared room footprints.
- Room furniture obstacles use renderer-local fixture footprints translated by
  each shared room center. A* validates the continuous segment between cells.

## Changed files

- `lib/domain/models.dart`
- `lib/domain/game_config.dart`
- `lib/domain/grid_navigation.dart`
- `lib/scene/flutter_scene_venue.dart`
- `test/domain/room_layout_navigation_parity_test.dart`
- `test/scene/flutter_scene_room_layout_parity_test.dart`

## Verification

- `C:\Users\hebp\flutter_master\bin\cache\dart-sdk\bin\dart.exe analyze`:
  PASS, no issues.
- Targeted Flutter tests (`navigation_test`, room layout/navigation parity,
  renderer parity, and `bar_simulation_test`): PASS, 16/16.

## Unresolved work / exact next actions

- No focused layout/navigation issue remains.
- Run the repository-level full Flutter suite and release build as the final
  integration gate.
