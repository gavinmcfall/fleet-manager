-- Add location_label column to shops table.
-- Previously applied out-of-band via wrangler d1 execute on production.
-- Formalized as migration for test database consistency.

ALTER TABLE shops ADD COLUMN location_label TEXT;
