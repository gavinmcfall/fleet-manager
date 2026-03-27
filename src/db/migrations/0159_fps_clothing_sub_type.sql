-- Add sub_type column to fps_clothing for consistency with all other FPS tables.
-- Values come from AttachDef.SubType in game data: Male, Female, Medium, Heavy, or NULL.
-- Previously the gamedata.ts query worked around this by aliasing cl.slot as sub_type.

ALTER TABLE fps_clothing ADD COLUMN sub_type TEXT;
