-- New FPS armour columns from v2 pipeline extractors:
-- protected_body_parts: comma-separated body part names (Torso, Arms, Legs, etc.)
-- armor_weight: Heavy/Medium/Light from actorAimLimits path
-- integrity_threshold: durability breakpoint from integrityMilestoneToBreak
ALTER TABLE fps_armour ADD COLUMN protected_body_parts TEXT;
ALTER TABLE fps_armour ADD COLUMN armor_weight TEXT;
ALTER TABLE fps_armour ADD COLUMN integrity_threshold REAL;

-- Same columns on fps_helmets and fps_clothing (share extract_armour() in pipeline)
ALTER TABLE fps_helmets ADD COLUMN protected_body_parts TEXT;
ALTER TABLE fps_helmets ADD COLUMN armor_weight TEXT;
ALTER TABLE fps_helmets ADD COLUMN integrity_threshold REAL;

ALTER TABLE fps_clothing ADD COLUMN protected_body_parts TEXT;
ALTER TABLE fps_clothing ADD COLUMN armor_weight TEXT;
ALTER TABLE fps_clothing ADD COLUMN integrity_threshold REAL;
