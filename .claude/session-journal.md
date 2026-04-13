# Session Journal

## Current Focus
**PHASE A LOAD-ORDER PLAN WRITTEN. Ready to execute 2026-04-14+ when Gavin resumes.**

2026-04-13 end-of-night — after the earlier milestones (gap closure, RSI poller extension, DNS zone import), the session closed with two extractor hardenings + Phase A runbook:

**Tonight's additions (session tail):**
1. **Promoter script built + committed** — `tools/db-ops/promote_game_data.py` dumps game-data tables from scbridge-staging → scbridge-production, preserves source ids verbatim, 47+11 table exclude list. Dry-run against scbridge-staging found 130 game tables.
2. **Companion tables gap found and closed** — while dry-running promoter, discovered 11 `companion_*` telemetry tables were missing from `extract_user_data.py` + YAML FK matrix. NERDZ prod has **~11,413 rows** of real companion data (315 sessions, 5,872 events, ...). All FKs are text_stable (user_id → user.id), no chain remap needed. Added to extractor, YAML, and promoter exclude list. Commit `7b3bde0`.
3. **Full extractor dry-run against NERDZ prod** — 58 tables, 0 failures, **25,860 SQL statements** totalling 9.1 MB. Zero orphan FKs on the three biggest self-ref chains (user_pledges.sync_id, user_pledge_items.user_pledge_id, user_pledge_upgrades.user_pledge_id). Output at `/tmp/nerdz-prod-full-dryrun.sql`.
4. **Phase A load-order plan written** — `/home/gavin/scbridge/tools/docs/plan/2026-04-14-phase-a-load-order.md`, commit `14c1005`. Covers BA bootstrap → migrations → game data → (optional RSI re-sync) → user data → verify → cleanup.

**Earlier this session:**
1. **Close-every-gap plan executed** — 7/7 coverage rules green on scbridge-staging.
2. **RSI poller extended** to populate cargo + vehicle_type + scm_speed from ship-matrix. Deploy run `24329962693` green.
3. **DNS zone** imported into SC Bridge account (17 records). Awaiting registrar transfer post-Phase A.

### State of play at session break (2026-04-13 ~20:30 NZ)

**Commits landed:**
| SHA | Repo | What |
|---|---|---|
| `4f1e3b8` | fleet-manager | P1: drop dead tables (commodities, fps_ammo) — migration 0194 |
| `260f01f` | tools | P2: 7 pipeline gap fixes bundled |
| `85559de` | tools | new d1-review baseline after pipeline fixes |
| `d781db4` | tools | P3-A: coverage rules engine + ship-family fuel fallback |
| `116c488` | tools | P3-C: cargo family fallback + tighten applicability |
| `8dfa511` | fleet-manager | P3-T16: RSI poller extends cargo/vehicle_type/scm; on staging branch |
| `e5d03dc` | tools | db-ops/ba-bootstrap.sql — BA schema (twoFactorEnabled stripped) |
| `a37ca92` | tools | db-ops/extract_user_data.py — NERDZ→SC Bridge user extractor |
| `1435a4e` | tools | db-ops/extract_strategy.md + user_data_fk_remap.yaml |
| `7b3bde0` | tools | 11 companion_* tables added to extractor + promoter |
| `14c1005` | tools | Phase A load-order plan (2026-04-14) |

**Migration 0195** (`0195_user_two_factor_enabled.sql`) — applied to scbridge-staging ONLY. NOT yet applied to scbridge-production (DB is empty). When loading scbridge-production, BA bootstrap must run FIRST with `twoFactorEnabled` removed from `user` CREATE TABLE so 0195 does its ADD COLUMN cleanly.

**Cutover status:**
- scbridge.app zone exists in SC Bridge account, 17 records loaded, status Pending
- SC Bridge workers deployed (scbridge, scbridge-staging), no Custom Domain bindings yet
- NERDZ still authoritative for scbridge.app, still serving 34 users + 8 staging test users
- Zone file exported to `/mnt/c/Users/gavin/Downloads/scbridge.app.txt` (17 records)
- Inter-account transfer NOT yet submitted — waits for Phase A data load + Worker bindings

**Next up when session resumes (2026-04-14+):**
**Primary reference:** `tools/docs/plan/2026-04-14-phase-a-load-order.md`

Strict load order for scbridge-production:
1. **BA bootstrap** (`ba-bootstrap.sql`) — creates 9 BA tables WITHOUT `twoFactorEnabled`
2. **Migrations 0001-0195** — schema + migration 0195 ADD COLUMN twoFactorEnabled
3. **Game data promoter** — `promote_game_data.py --source-db scbridge-staging --output /tmp/scbridge-prod-game-data.sql` then apply
4. **(Optional) RSI seed re-sync** — skip unless specific need; scbridge-staging data is current
5. **User data extractor** — `extract_user_data.py --source-db sc-companion-v2` then apply
6. **Verification** — every orphan-FK query must return 0; d1-review gate must pass
7. **Cleanup migration 0196** — DROP _nerdz_id columns after green verification

**Open decisions for tomorrow:** (1) rehearse on scbridge-staging first? (2) regenerate game-data SQL day-of vs reuse tonight's output? (3) fresh NERDZ extract day-of vs reuse tonight's 25,860-stmt file?

**Validated row counts (2026-04-13 dry-run):** 34 users, 3,024 pledges, 6,897 pledge items, 1,107 fleet rows, 11,413 companion rows, 25,860 total statements, 9.1 MB.

### Molasses rule (2026-04-13) — Gavin directive
> "we take this like molasses, slow and steady. one step at a time, we pause throughout, we update we asssess, we validate we move... You must NEVER assume ANYTHING, treat the wirten word in your documentation as stale, you validate every ID, every env var, every data point"

Has caught 3 doc/assumption bugs this session: wrong staging UUID in CLAUDE.md, misleading "staging deploy verified" claim, wrong "user_rsi_profiles is deprecated" assumption.

### Memory files with full detail
- `project_close_every_gap_plan.md` — 17-gap P1/P2/P3 execution
- `project_coverage_rules_engine.md` — d1-review YAML type:coverage rules
- `project_nerdz_cutover_validation.md` — 40+ validated facts, commits, preconditions, procedure
- Plan doc: `/home/gavin/scbridge/tools/docs/plan/2026-04-13-close-every-gap.md`
- Plan doc: `/home/gavin/scbridge/tools/docs/plan/2026-04-13-nerdz-to-scbridge-cutover.md`

### Previous focus (carry forward for context)

### Session 2026-04-12 afternoon — Completion of overnight remediation

**Root-caused + fixed silent 0-row loads:**
- Migration 0190 created `idx_nli_natural_key` / `idx_lil_natural_key` with `COALESCE(col,'')` but pipeline SQL uses `ON CONFLICT(col)`. SQLite refuses textual match → every UPSERT errored silently (stderr redirected to /dev/null in the batch loader).
- Dropped + recreated both indexes without COALESCE. Test file went 0→39 rows immediately.
- Lesson saved as `feedback_on_conflict_exact_match.md`.

**Load top-ups:**
- Pre-filtered lil chunks against actual DB loot_map UUIDs (dropped 57,458 rows whose FK subquery would have returned NULL).
- Re-ran all 230 loot_map upsert files → 11,167 → **11,467** (picked up the 300 that silently failed the first pass).
- Re-filtered + loaded a top-up of 51,410 lil rows for those 300 newly-added loot_map UUIDs → lil at **1,109,321**.
- Resolved NPC loadout item names from loot_map: **16,976 / 19,417 (87.4%)**.

**Final validated scbridge-staging counts (13:17):**
- vehicles 308 (274 p4k + 34 RSI), all short_slug, 247 pledgeable
- loot_map 11,467 | loot_item_locations 1,109,321
- fps_weapons 372 | fps_armour 1,660 | fps_helmets 635 | fps_melee 28 | fps_ammo_types 59
- vehicle_components 7,532 | npc_loadouts 3,114 | npc_loadout_items 19,417
- shops 382 | terminals 197 | terminal_inventory 26,296
- crafting_blueprints 1,044 | crafting_blueprint_slots 2,589 | crafting_blueprint_reward_pools 45
- **crafting_blueprint_reward_pool_items 0** ← next target
- contracts 546 | missions 1,978 | reputation_standings 371
- user_fleet 1,970 preserved

### Previous focus
**Overnight autonomous execution: Data Integrity Remediation**
Plan: `tools/docs/plan/2026-04-11-data-integrity-remediation.md`
14 tasks, 5 phases. Subagent-driven execution.

### Session 2026-04-11 — Single-version migration + gap remediation

**Completed this session:**
1. Single-version architecture migration (migrations 0187-0188, API changes, PTU infrastructure) — fleet-manager commit `9625005`, pushed to staging
2. 10 pipeline fixes committed and pushed to tools repo:
   - FPS weapon DPS: recursive fire action extraction (`c819f73`) + beam DPS (`d83c8ab`)
   - NPC loadout FK: class_name match (`7d90fa4`) + sql_writer FK lookup (`def36e4`)
   - FPS manufacturer_id: tag alias map 26 entries (`def36e4`, `f7775d8`) + load_staging backup (`e3c3e15`)
   - Crafting output_item: 3 fixes — wrong file, correct file, flatten step (`94046eb`, `ef3338d`, `e6f17ff`)
   - Vehicle cargo falsy-zero (`749f0eb`)
3. Comprehensive DB gap analysis — found pipeline re-loads causing tripled junction tables + FK regression
4. Plan written and approved for overnight execution

**Phase 1: COMPLETE**
- Task 1: DONE — 74 tables rebuilt, migration 0189. Also fixed ON CONFLICT in uex.ts + tests.
- Task 2: DONE — Pipeline sql_writer.py ON CONFLICT updated. Commit `3216f37`.
- Task 3: DONE — 34 pledge ships got production_status_id=3. All 317 vehicles have short_slug.

**Phase 2: IN PROGRESS**
- Task 4: DONE — weapon_racks 276→99, suit_lockers 22→12. loot_item_locations deferred to Phase 5 wipe.
- Task 5: IN PROGRESS — pipeline running (scan ~80%)

**Phase 3: COMPLETE**
- vehicle_components type: DONE — `4ca92eb`
- fps_ammo_types: DONE — `24063ee`
- npc_loadout_items names: DONE — SQL applied
- missions FKs: DONE — `721da9e`
- fps_melee damage: DEFERRED — stub extractor needs full rewrite

**Phase 4: COMPLETE**
- paints.manufacturer_code: DONE — `a063d97` (71%→~1.6% NULL, derived from vehicle)
- shops.location_label: handled in Phase 5 via post-load backfill

**Phase 5: IN PROGRESS — wipe + reload**
- Wipe: DONE (3,947,927 game rows deleted. 33 users + 1,970 fleet preserved.)
- Pipeline: RUNNING (final clean run with ALL extractor fixes)
- Load attempt 1: FAILED — damage_thermal column. Fixed with ALTER TABLE.
- Load attempt 2: FAILED — type on all tables. Fixed in `2c9b0be`.
- Load attempt 3: Step 4 OK, Step 5 (FK batch) failed — loaded tables individually.
- terminal_inventory ON CONFLICT fix `fd0eb7b` (hardcoded game_version_id in write_terminal_inventory).
- **FINAL STATE:** 274 vehicles, 11,687 loot_map, 1.8M locations, 373 weapons, 1,660 armour, 1,044 blueprints, 7,910 components (100% typed). Users preserved (33/1,970).
- **Remaining gaps:** contracts 0 (v1 data), reputation_standings 0 (scope_id FK), 43 pledge ships need re-seed.

**Pipeline commits since plan started:** 4ca92eb, 24063ee, 721da9e, a063d97, 3216f37

**Queued:**
- Phase 2 (Tasks 4-5): Dedup + clean pipeline re-run
- Phase 3 (Tasks 6-10): New gaps (vehicle_components type, missions FKs, melee damage, ammo stats, NPC names)
- Phase 4 (Tasks 11-13): Known gaps (shops location_label, paints manufacturer_code)
- Phase 5 (Task 14): Wipe all game-data tables, full pipeline reload, final validation

### Key decisions made this session
- Single-version truth: no multi-version data, UPSERT updates in place
- PTU via ptu_* prefix tables in same DB (Option A)
- Soft-delete: is_deleted column, vehicles stay visible with badge, everything else filtered
- Before marking deleted: check removed, moved, or renamed
- Canonical slug: manufacturer-prefixed (misc-hull-b), short_slug for RSI matching
- Only RSI + UEX as ongoing external sources, Fleetyards one-time seed only
- Fleetyards cron removed from wrangler.toml

### What's Next (after overnight)
- Vehicle production status: run RSI ship-matrix poller against staging
- Vehicle components classification: proper type assignment in pipeline resolver
- UX Overhaul program continues (sub-project 2: list-view rollout)
