# Design: Бордель у Кристофера (theme branch)

Branch: `theme/brothel-christopher`  
Date: 2026-08-03

## Goal

Retheme the Hops & Honey bar manager into an adult venue — **«Бордель у Кристофера»** — keeping the same simulation loop, upgrades, navigation, and progression. Deep visual rewrite (approach 3): new character meshes, explicit low-poly room animations, new copy/UI.

## Locked decisions

- **Brand:** Бордель у Кристофера
- **Front staff:** Кристина (female Christopher), same bartender FSM
- **Tone:** Explicit adult stylized low-poly (C)
- **Rooms (3 slots):** strip → sex → gangbang (no BDSM)
- **Drinks:** mixed beer + adult cocktails (5 levels)
- **Save key:** `brothel-christopher-v1` (isolated from bar save)
- **Gangbang capacity:** maxCapacity 4 (raised from massage’s 2)

## Room mapping

| Slot | Old id | New id | Staff | maxCapacity |
|------|--------|--------|-------|-------------|
| west | karaoke | strip | Танцовщица | 3 |
| east | sauna | sex | Куртизанка | 4 |
| south | massage | gangbang | Ведущая | 4 |

Layout portals/centers stay; south wing gains 4 guest spots.

## Drink card + delivery performance

| Level | Drink | Delivery show |
|-------|-------|---------------|
| 1 | Солнечный лагер | Uniform handoff (~0.5s) |
| 2 | Грушевый сидр | Top off, flash breasts (~2s) |
| 3 | Поцелуй Кристины | Turn, skirt up, bare ass (~2.2s) |
| 4 | Красная комната | Fully nude walk + handoff |
| 5 | После полуночи | Nude, climb guest table, strip 5s, then handoff |

Engine: extend `delivering` timer by drink level; expose `outfit` + `onTable` on bartender snapshot for renderers. Economy/prices unchanged except renamed drinks and gangbang capacity.

## Visual scope

- Kristina female body (breasts/hips/skirt/top states)
- Strip stage + pole; sex room bed; gangbang platform with multi-body poses
- Darker/warmer bar palette; venue signage
- HUD/welcome/emoji/status copy retheme
- UI atlas: reuse existing icon slots where possible; update labels

## Non-goals

- No 4th room / BDSM
- No economy rebalance beyond gangbang capacity
- No dual-theme abstraction layer
- Bar save migration not required

## Verification

- `npm test` — update room ids / copy assertions
- `npm run build`
- Playwright smokes: welcome brand, room tabs, service cycle (allow longer waits for L5 show)

## Done when

Playable shift: drink → escalating Kristina delivery → optional room sessions → upgrades/save work on the brothel save key.
