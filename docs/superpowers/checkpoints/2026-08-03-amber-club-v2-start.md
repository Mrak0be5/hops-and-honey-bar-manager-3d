# Checkpoint: Amber Club v2 start

## Objective

Rebuild Hops & Honey as the approved Amber Social Club v2 while keeping the published v1 untouched until v2 passes functional, visual, migration and performance checks.

## Approved decisions

- visual direction: Amber Social Club;
- layout: central 18×14 m bar with 12×10 m karaoke, sauna and massage wings;
- gameplay: accessible tycoon;
- migration strategy: parallel v2 in branch `codex/amber-club-v2`;
- guest invariant: bar completion precedes any optional room visit.

## Recorded artifacts

- design: `docs/superpowers/specs/2026-08-03-amber-club-v2-design.md`;
- implementation plan: `docs/superpowers/plans/2026-08-03-amber-club-v2-implementation.md`;
- design commit: `00e5281`;
- initial runtime commit: `cc5abf7`.

## Current changes

- legacy application moved to `src/LegacyApp.tsx` and remains the active fallback;
- `src/App.tsx` is now a temporary adapter;
- fixed-step clock and React driver added under `src/v2/runtime/`;
- deterministic clock tests added under `tests/v2-runtime/`;
- `.superpowers/` visual-companion artifacts are ignored.

## Verification

- `npm.cmd test -- tests/v2-runtime/fixed-step-clock.test.ts`: 4/4 passed;
- `npm.cmd run build`: passed;
- production build still renders legacy v1 while v2 is incomplete.

## Unresolved work

- integrate content/level/navigation/simulation modules;
- integrate view model, Amber R3F scene and responsive HUD;
- create AppV2 runtime adapter and enable it by default on the v2 branch;
- add v2 save migration, test bridge and vertical-slice E2E;
- complete rooms, staff, upgrades, assets, animation, VFX/audio and balance;
- playtest, optimize, publish and push only after release gates pass.

## Exact next actions

1. Merge the independently authored simulation/navigation and render/UI modules.
2. Resolve TypeScript/API mismatches and add `useAmberRuntime`.
3. Run focused unit tests and production build.
4. Launch the v2 app locally, play through bar → karaoke → exit, and record defects.
