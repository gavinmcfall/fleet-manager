-- Add magazine_uuid to fps_weapons for linking weapon → magazine in detail panel.
-- Populated by extraction script from ammoContainerRecord → magazine JSON _RecordId_.
ALTER TABLE fps_weapons ADD COLUMN magazine_uuid TEXT;
