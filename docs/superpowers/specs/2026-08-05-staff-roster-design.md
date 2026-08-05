# Design: Assignable staff roster (Winnie-Pooh ladies)

Branch: `theme/brothel-christopher`  
Date: 2026-08-05  
Status: approved

## Goal

Replace hardcoded one-species-per-room staff with a **hireable roster of 9 adult female characters**. Any hired character can be assigned to any venue slot. Guest flow depends on who is staffed where.

## Locked decisions

- **Approach:** venue slots + shared roster (bar + 3 service rooms).
- **Characters (9):** Кристина, Тигра, Винна, Кроля, ИА, Пигги, Ру, Мама Ру, Сова.
- **Start:** only Кристина hired; auto-assigned to **bar slot 0**.
- **Slots:** bar ×2, strip ×2, sex ×2, gangbang ×2.
- **Minimum to operate:** ≥1 worker on that venue. Second worker = performance bonus (service speed / session speed / slight income).
- **Empty bar + staffed open room:** guests **skip the bar** and go straight to a staffed room.
- **No staff anywhere usable:** guests **queue at the entrance** (no tables, no rooms).
- **Visuals:** unique low-poly adult mesh per character (no shared palette-only placeholders as the final look).
- **One body, one slot:** a character cannot occupy two slots at once.

## Character ids

| id | Display name | Hire |
|----|--------------|------|
| `christina` | Кристина | free (start) |
| `tigra` | Тигра | paid |
| `winna` | Винна | paid |
| `krolya` | Кроля | paid |
| `ia` | ИА | paid |
| `piggy` | Пигги | paid |
| `ru` | Ру | paid |
| `mama_ru` | Мама Ру | paid |
| `sova` | Сова | paid |

Hire costs: escalating ladder in config (cheaper early hires → expensive late). Exact numbers chosen at implement time to stay reachable mid-game with cheats optional.

## Data model

### StaffCharacterId

Union of the 9 ids above.

### StaffDefinition (config)

`id`, `name`, `hireCost`, `emoji`/`icon`, mesh key, accent color, short blurb.

### Roster entry (runtime + save)

```ts
{
  id: StaffCharacterId;
  hired: boolean;
  // derived from slots while live; persist assignment via venue slots only
}
```

### VenueId

`'bar' | 'strip' | 'sex' | 'gangbang'`

### Venue worker slots (runtime + save)

```ts
Record<VenueId, [StaffCharacterId | null, StaffCharacterId | null]>
```

Empty slot = `null`.

### RoomState changes

Remove implicit “species owns room”. Keep guest `capacity` / upgrades. Session FSM runs only if room unlocked **and** `slots` has ≥1 assigned hired staff.

### Bartender FSM

- Driven by **bar slots**, not a singleton named Kristina.
- If bar has ≥1 worker: existing order/prep/deliver/clean loop (primary worker = slot0 if filled else slot1; second worker shortens timers via bonus).
- Delivery “show” / outfit escalation uses the **active bar worker’s** mesh identity (not hardcoded Christina body only — Christina mesh remains one of nine).
- If bar has 0 workers: bartender FSM idle; patrons never claim tables for drinks.

### Patron flow

1. Spawn → entrance.
2. If `barHasStaff`: walk to table → drink cycle → after `barServed`, may go to staffed unlocked room.
3. Else if any unlocked room has ≥1 staff and free capacity: `walking_to_room` directly (skip drink).
4. Else: stay in entrance queue / overflow waiting (visible crowd).

### Second-worker bonus (concrete)

- **Bar, 2 workers:** ~20% faster move/order/prep/clean (multiplicative on existing upgrade curves).
- **Room, 2 workers:** ~20% shorter session duration and +10% session profit (on top of quality upgrade).

## UI

- New **«Штат»** panel (from upgrades/dev area or bottom status): list 9, hire button + cost, show assignment (“Бар · 1”, “Стрип · 2”, “Резерв”).
- Per-venue (bar tab + each room tab): two slot pickers — assign / clear from hired free pool.
- Bottom pills / 3D labels use **assigned character names**, not old “Медведица-стриптизёрша” fixed roles.
- Locked room still shows unlock cost; after unlock, empty slots until player assigns.

## Rendering

- `RoomWing`: up to 2 `StaffCharacter` meshes from slots; poses by room activity (strip/sex/gangbang) + serving state.
- Bar: up to 2 staff at bar station (primary runs delivery path; secondary stays near bar with idle/help pose).
- Each character: dedicated component or mesh variant under `src/components/staff/` with shared animation hooks.
- Nude/dressed rules for rooms stay: dressed until `serving`, then nude/active poses as today.

## Persistence

- Bump save key to `brothel-christopher-v2` **or** migrate `v1` → add default roster + `bar: ['christina', null]` and empty room slots.
- Prefer migrate-in-place on `v1` load so existing rich saves keep coins; if corrupt, reset roster defaults only.

## Non-goals

- No firing/selling characters permanently (unassign to reserve only) in v1 of this feature.
- No per-character stats beyond identity (all same base speed; only slot-count bonus differs).
- No 4th service room.
- No male roster.

## Engine / file touch list

- `src/game/types.ts` — ids, slots, snapshot roster
- `src/game/config.ts` — `STAFF_DEFINITIONS`, hire costs, bonus constants
- `src/game/GameEngine.ts` — hire/assign/unassign; patron routing; bar/room gating; save
- `src/ui/Hud.tsx` — Штат + slot UI
- `src/components/RoomWing.tsx`, `FurryStaff.tsx` → generalize to character id
- `src/components/Character.tsx` / bar staff render path
- `src/components/staff/*` — 9 unique meshes
- Tests: hire, assign exclusivity, skip-bar path, entrance queue, save restore

## Verification

- `npm test` covers hire/assign and routing branches.
- `npm run build`
- Manual / Playwright: start → only Christina at bar; hire Tigra → assign to strip; clear bar → guests skip to strip; clear all → entrance queue.

## Done when

Player can hire the eight paid ladies, assign any hired character into any of the 8 venue slots (4×2), see unique meshes, and guest routing matches the three flow rules above with save/load intact.
