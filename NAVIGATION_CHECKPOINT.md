# Navigation and level-design checkpoint — 2026-07-19

## Objective

Recalculate the bar layout and character movement so guests and staff travel on a real grid and avoid furniture correctly.

## Decisions and changes

- Replaced hand-authored straight-line routes with a shared 0.4 m navigation grid and A* pathfinding.
- Added level bounds, collision clearance, table/counter/planter blockers and diagonal corner-cut prevention.
- Recalculated the six-table layout into two aligned rows with wider service and guest aisles.
- Moved chairs and the bartender work point outside collision clearance.
- Guests calculate independent entrance and exit paths; every bartender trip is recalculated through the counter gate.
- Added regression coverage for every entrance-to-seat and gate-to-service route.

## Changed files

- `src/game/navigation.ts`
- `src/game/config.ts`
- `src/game/GameEngine.ts`
- `tests/game-engine.test.ts`

## Verification

- `npm.cmd test`: 7/7 PASS.
- `npm.cmd run build`: PASS.
- Playwright reported all 15 applicable checks passed with one intended mobile skip. The runner stayed alive after printing every completed case and was stopped by the outer timeout; there were no failed browser cases.
- Latest mobile WebGL/DOM capture reviewed at `output/playwright/running-mobile-chromium.png`.

## Unresolved

- Investigate the Playwright process shutdown leak separately; it does not affect the shipped game runtime.
