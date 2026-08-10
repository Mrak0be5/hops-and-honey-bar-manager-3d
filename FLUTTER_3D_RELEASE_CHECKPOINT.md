# Flutter 3D release checkpoint

## Objective

Ship a separate, fully 3D Flutter port of Hops & Honey without Flame, playtest
it on desktop and iPhone-sized layouts, and publish it without replacing the
existing React or Flame versions.

## Decisions

- Renderer: pinned `flutter_scene 0.20.0` on Flutter master revision
  `467ec59b25` (`3.47.0-0.4.pre`).
- Simulation, economy, A* navigation, persistence, audio and HUD stay pure
  Dart/Flutter layers.
- `RoomLayout` is the single source of truth for the simulation, renderer and
  pathfinder. Large room bounds, portals, furniture obstacles, guest spots and
  staff spots are shared.
- Mobile GPU budget caps the 3D render target at DPR 2 while keeping Flutter UI
  at native resolution; compact viewports use two 768px shadow cascades.
- Sites hosts an isolated vinext wrapper. Flutter is built under `/game/`; old
  deployments and IDs are untouched.
- The new Sites project remains owner-only (`custom`, one owner, no groups or
  external visitors).

## Primary files

- `flutter_3d_port/lib/domain/**`
- `flutter_3d_port/lib/scene/**`
- `flutter_3d_port/lib/ui/**`
- `flutter_3d_port/lib/data/**`
- `flutter_3d_port/test/**`
- `flutter_3d_port/integration_test/**`
- `flutter_3d_port/.openai/hosting.json`
- `flutter_3d_port/README.md`

## Verification

- Direct master Dart analyzer: `No issues found`.
- Full Flutter test suite: `37/37` passed.
- Release build: `flutter build web --release --base-href /game/` passed.
- Vinext wrapper build passed and contains `dist/server/index.js`, Flutter JS,
  CanvasKit WASM and the `flutter_scene` shader bundle.
- Local production wrapper: root redirect, game HTML, bootstrap, JS, shader
  bundle, CanvasKit WASM and OG image all returned HTTP 200.
- Browser playtest covered boot, start, running simulation, settings, reset
  confirmation, 9:16, mobile development, all bar upgrade cards, locked room
  panels, raycast room selection and return to desktop overview. No runtime
  warnings or errors were recorded.
- Published endpoints were checked with owner authorization: root/game HTML,
  bootstrap, main JS, shader bundle and CanvasKit WASM all returned HTTP 200.

## Publication

- URL: `https://hops-and-honey-flutter-3d.aimc1.chatgpt.site`
- Sites project: `appgprj_6a79e8fc77348191b81b4f629a3c1288`
- Version: `appgprj_6a79e8fc77348191b81b4f629a3c1288~appgver_c9745d1022048191b29a5482cb8d66e4`
- Deployment: `appgdep_6a79ee0bad508191b3941a4a818d2fcc`
- Wrapper source commit: `c73093e5b05b6b8ad9a11aab2f24ae6776dc3bc7`
- Wrapper workspace: `C:\Users\hebp\AppData\Local\Temp\hops-honey-flutter3d-sites`

## Remaining optional improvements

- Batch/instance repeated chairs, floor tiles and bottle meshes after gathering
  real low-end device GPU timings.
- Add export/import if progress must move between the old and new Sites origins.
- Replace the deliberately clean procedural art with authored GLB assets only
  if a higher-detail art pass is desired.

## Exact next action

Commit and push the verified project sources on branch
`codex/restore-pre-remake`; do not stage `.superpowers/` or generated build and
playtest output.
