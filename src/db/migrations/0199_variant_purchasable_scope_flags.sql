-- Migration 0199: denormalized boolean flags for cleaner queries + scoped
-- d1-review applicable_sql.
--
-- 1. vehicles.is_variant — 1 if this ship is a variant (parent_vehicle_id IS NOT NULL).
--    Canonical variant indicator is parent_vehicle_id; this column is a denorm
--    for convenience (faster predicate, scopes applicable_sql cleanly).
--    Examples: Carrack (base, is_variant=0), Carrack Expedition (is_variant=1,
--    parent_vehicle_id → Carrack), PYAM Carrack (is_variant=1).
--
-- 2. vehicles.is_purchasable_ingame — 1 if aUEC-purchasable (price_auec > 0).
--    Complements is_pledgeable (RSI store purchasable). Some ships are
--    in-game-only reward variants (Wikelo Special, PU-hijacked) that aren't
--    pledgeable but may be aUEC-acquirable.
--
-- 3. fps_weapons.has_builtin_scope — 1 if the weapon has a built-in scope
--    (sniper rifles, marksman rifles). Distinct from "accepts a scope
--    attachment". For now, seeded from zoom_factor IS NOT NULL; the pipeline
--    will refine via aimAction inspection to exclude weapons that only zoom
--    via attached accessories.

-- ── vehicles ─────────────────────────────────────────────────────────────
ALTER TABLE vehicles ADD COLUMN is_variant INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN is_purchasable_ingame INTEGER NOT NULL DEFAULT 0;

UPDATE vehicles SET is_variant = 1 WHERE parent_vehicle_id IS NOT NULL;
UPDATE vehicles SET is_purchasable_ingame = 1
 WHERE price_auec IS NOT NULL AND price_auec > 0;

CREATE INDEX IF NOT EXISTS idx_vehicles_is_variant ON vehicles(is_variant);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_purchasable_ingame ON vehicles(is_purchasable_ingame);

-- ── fps_weapons ──────────────────────────────────────────────────────────
ALTER TABLE fps_weapons ADD COLUMN has_builtin_scope INTEGER NOT NULL DEFAULT 0;

-- Seed from zoom_factor (circular-ish — extractor will tighten later).
UPDATE fps_weapons SET has_builtin_scope = 1
 WHERE zoom_factor IS NOT NULL AND zoom_factor > 1;

CREATE INDEX IF NOT EXISTS idx_fps_weapons_has_builtin_scope ON fps_weapons(has_builtin_scope);
