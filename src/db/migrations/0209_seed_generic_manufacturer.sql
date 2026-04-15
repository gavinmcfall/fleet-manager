-- 0209_seed_generic_manufacturer.sql
--
-- Seed a `Generic` manufacturer for items genuinely unbranded in p4k (after
-- the full waterfall in tools/scripts/lib/tags.py::TagDatabase.resolve_manufacturer
-- — tags, AttachDef ref, filename segments, _STATIC_MANUFACTURER — all miss).
--
-- Reflects reality: the item exists, has no consumer brand, is not scavenged.
-- Commodity/generic gear that needs SOMETHING in the manufacturer FK.
--
-- Pipeline extractor emits manufacturer_code = "GENERIC" when the waterfall
-- returns None. Without this seed, the FK resolution would set manufacturer_id
-- to NULL and the audit would flag it critical.

INSERT OR IGNORE INTO manufacturers (uuid, name, slug, code, description, game_version_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'Generic',
  'generic',
  'GENERIC',
  'Unbranded / commodity gear with no specific consumer manufacturer in p4k. Assigned by the extractor when tag-, AttachDef-, filename-segment, and static-prefix lookups all return None.',
  (SELECT id FROM game_versions WHERE code = (SELECT MAX(code) FROM game_versions))
WHERE NOT EXISTS (SELECT 1 FROM manufacturers WHERE code = 'GENERIC');
