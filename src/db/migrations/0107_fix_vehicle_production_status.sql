-- Fix vehicles incorrectly marked as "In Production" (status_id=2) that are actually "Flight Ready" (status_id=1).
-- Affects Carrack, Idris-P, and potentially others that were extracted with stale status data.
-- Only updates vehicles with a non-concept status that have been in-game for years.
UPDATE vehicles SET production_status_id = 1
WHERE slug IN ('carrack', 'idris-p')
  AND production_status_id = 2;
