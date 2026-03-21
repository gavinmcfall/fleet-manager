-- 0140_stable_ptu_versions.sql
--
-- Add build_number column to game_versions for PTU build tracking.
-- PTU/EPTU versions get stable codes (e.g., "4.7.0-ptu" without build number)
-- so user preferences survive PTU data refreshes.
--
-- Changes:
--   1. Add build_number TEXT column
--   2. Backfill build_number from existing codes (extract digits after last dot in channel part)
--   3. Strip build number from PTU/EPTU codes to make them stable

-- Step 1: Add the column
ALTER TABLE game_versions ADD COLUMN build_number TEXT;

-- Step 2: Backfill build_number for codes that have a dot after the channel separator.
-- Format: "4.7.0-ptu.11475995" → build_number = "11475995"
-- Logic: find '-', then find '.' after it, then take everything after that dot.
-- INSTR(code, '-') gives position of channel separator.
-- SUBSTR(code, INSTR(code,'-')) gives e.g. "-ptu.11475995"
-- INSTR(that, '.') gives position of dot within that substring.
-- Combined: SUBSTR(code, INSTR(code,'-') + INSTR(SUBSTR(code, INSTR(code,'-')), '.'))
UPDATE game_versions
SET build_number = SUBSTR(code, INSTR(code, '-') + INSTR(SUBSTR(code, INSTR(code, '-')), '.'))
WHERE INSTR(code, '-') > 0
  AND INSTR(SUBSTR(code, INSTR(code, '-')), '.') > 0;

-- Step 3: Strip build number from PTU/EPTU codes to make them stable.
-- "4.7.0-ptu.11475995" → "4.7.0-ptu"
-- Take everything up to (but not including) the dot after the channel.
UPDATE game_versions
SET code = SUBSTR(code, 1, INSTR(code, '-') + INSTR(SUBSTR(code, INSTR(code, '-')), '.') - 2)
WHERE channel IN ('PTU', 'EPTU')
  AND INSTR(SUBSTR(code, INSTR(code, '-')), '.') > 0;
