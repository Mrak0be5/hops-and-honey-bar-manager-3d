# Connected-room expansion checkpoint — 2026-07-19

## Objective

Expand the 3D bar into a purchasable entertainment and wellness complex, enlarge the new rooms, connect them physically to the main bar and make real patrons visit them only after bar service.

## Decisions

- Added three optional rooms with profitability-scaled repair prices: karaoke (280 / 20 per base session), sauna (750 / 42), massage (1500 / 70).
- Enlarged every room to `8 × 7.2` world units and moved the three wings outside the main bar footprint so their shells and props do not overlap.
- Added explicit 2.4-unit door openings and thresholds: karaoke through the west bar wall, sauna through the east edge and massage through the rear wall.
- Replaced autonomous decorative room customers with real patrons. The flow is now entrance → table → drink → payment → optional room choice → portal route → room session → exit.
- Every unlocked room runs a staff cycle driven by arrived patrons: waiting, welcoming, serving and resetting. Capacity is reserved before a guest starts walking, so rooms cannot overbook.
- Every room owns persistent revenue, completed sessions, capacity and three upgrade tracks: staff speed, capacity and service quality.
- Capacity and quality increase future profit; staff training shortens the session. Room state is migrated safely into the existing save format.
- Added distinct procedural 3D interiors, locked renovation states, staff/guest animation, particles, emissive lighting, room income bursts and room-specific camera angles that keep walls from hiding furniture.
- Added a responsive venue selector, repair preview, affordability feedback, staff progress, economy cards and room-specific upgrade copy.
- On portrait screens, room development uses a compact scrollable bottom-sheet while the selected 3D room remains visible above it.
- Extended A* navigation across the union of the bar floor, three room floors and their door connectors. Exterior void is non-walkable; room furniture is included as obstacles.
- Added distinct audio cues for room repair and room income.

## Changed files

- `src/App.tsx`
- `src/components/BarScene.tsx`
- `src/components/Character.tsx`
- `src/components/Environment.tsx`
- `src/components/RoomWing.tsx`
- `src/game/GameEngine.ts`
- `src/game/audio.ts`
- `src/game/config.ts`
- `src/game/navigation.ts`
- `src/game/types.ts`
- `src/styles.css`
- `src/ui/Hud.tsx`
- `tests/game-engine.test.ts`
- `tests/e2e/rooms.spec.ts`

## Verification

- `npm.cmd run build`: PASS.
- `npm.cmd test -- --reporter=verbose`: 13/13 PASS, including every room doorway/exit route, the real post-payment guest flow and a capacity-3 reserved group.
- Room purchase, layout and real-guest Playwright checks: PASS on desktop and mobile.
- Full Playwright regression: 17 PASS, 1 intentional skip across desktop and mobile.
- Reviewed focused screenshots for karaoke, sauna and massage plus a live sauna session on desktop and mobile.

## Unresolved / next action

- Two independent read-only reviews found no remaining P1/P2 issue after fixes; the only P3 fallback is a safe on-the-spot despawn if a theoretically impossible exit route disappears at runtime.
- No release blocker remains.

## Publication — 2026-07-20

- Committed and pushed the exact validated source state at `ef5e34283578c237b20e14631604a8b88115d754` on `main`.
- Saved Sites version 11 and deployed it successfully to production.
- Public URL: `https://hops-and-honey-3d-bar.aimc1.chatgpt.site`.
- Post-deploy HTTP check returned 200 and the served HTML contains the game title.
- Removed the temporary deployment archive after upload.

## Full polish pass — 2026-07-20 (published)

### Objective

Fix every issue found in the production playtest: onboarding overlap, mobile HUD truncation, misleading room capacity, runaway day bonuses, sparse interiors, weak room-specific animation, awkward room framing and missing late-game direction.

### Implemented so far

- Day bonuses are now 20% of real shift revenue with a hard 60-coin cap; operating revenue and bonus totals migrate safely.
- Natural guests fill an already forming room group first, so capacity upgrades reach 2/2+ in ordinary play and payouts use the real participant count.
- Added eight long-term milestones and rebalanced room speed/quality upgrades.
- Added per-guest and maximum-session profit fields for unambiguous UI copy.
- Rebuilt all three interiors with themed floor zones, capacity-dependent furniture, quality decor, staff equipment and distinct active effects.
- Added room-specific karaoke and sauna patron poses plus staff actions for karaoke, sauna and massage.
- Adjusted camera insets/zoom, added a full venue ground plane, aggregated mobile world statuses and avoided the start-time WebGL remount.
- Start HUD and development panel are now isolated; UI assets preload with fixed intrinsic sizes; mobile numbers use compact notation; audio no longer creates an AudioContext before input.

### Verification at this checkpoint

- Final `npm.cmd run build`: PASS after all source, metadata and asset changes.
- `npm.cmd test -- --reporter=verbose`: 18/18 PASS after reducing the navigation-heavy long-run test from 60 to 18 simulated shifts (same bounded-ratio assertion, comfortably below CI timeout).
- Manual desktop walkthrough: purchased and upgraded karaoke, sauna and massage; observed 2/2 room groups, real room income, staff actions and obstacle-safe portal movement; browser console 0 errors / 0 warnings.
- Manual 390×844 walkthrough: compact HUD, visible room scene, contained development sheet and scrollable room upgrades all verified.
- Long room E2E: PASS separately on desktop and mobile; mobile compact-HUD test PASS; portrait dock PASS; desktop/mobile visual tests PASS; the remaining smoke/service scenarios produced 12 PASS before two stale/timeout assertions were corrected and rerun successfully.
- WebGL context-loss callback is now stable across snapshot updates; massage staff and guest transitions are damped instead of teleporting.
- New built-in GPT Image 2 social preview saved as `public/og-polish.png`; legacy `public/og.png` preserved.

### Exact next actions

1. Monitor real-player pacing and late-game retention; no release blocker remains.

### Publication result

- Commit `c417fead0fe1365f5c207be9af49779ef127d712` pushed to `main`.
- Sites version 12 saved from the exact validated commit and archive.
- Production deployment `appgdep_6a5e8332d1a481919a9d18961316a11d` succeeded.
- Public URL: `https://hops-and-honey-3d-bar.aimc1.chatgpt.site`.
- Production root and `og-polish.png` both returned HTTP 200; served HTML references the new JS bundle and social-preview asset.
- Temporary release archive removed after upload.
