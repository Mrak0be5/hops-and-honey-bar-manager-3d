# Amber Club v2 release checkpoint

## Objective

Ship the rebuilt 3D bar-management game to the existing public GPT Sites project.

## Decisions

- Amber Club v2 is the default experience; the previous game remains available through `?legacy=1` for save compatibility.
- Navigation uses a 0.5 m grid, clearance-safe A* routes, portal-only room transitions, and dynamic reservations.
- Guests always visit the bar before optionally choosing karaoke, sauna, or massage.
- Each optional room has its own permit, renovation, equipment, staff, price, profit, and upgrades.

## Changed areas

- `src/v2/`: level, navigation, simulation, runtime, rendering, effects, audio, UI, content, and save migration.
- `src/App.tsx`, `src/LegacyApp.tsx`, `src/main.tsx`: v2 routing with the legacy fallback.
- `tests/v2*` and `tests/e2e/`: deterministic routing, simulation, visual contracts, save migration, and browser playtests.

## Verification

- `npm.cmd test`: 65 tests passed.
- `npm.cmd run build`: production build passed.
- `npx.cmd playwright test amber-v2.spec.ts --project=desktop-chromium --project=mobile-chromium --reporter=line`: 10 tests passed with real WebGL frame checks.
- The first attempted browser run was invalid because an unrelated stale Vite server occupied port 4187; after stopping that exact process, the clean run passed without source changes.

## Remaining release actions

1. Commit the exact verified source while excluding the unrelated root `ROOM_EXPANSION_CHECKPOINT.md`.
2. Push the commit to the existing Sites source repository.
3. Package, save, deploy, and poll the public production version to success.
