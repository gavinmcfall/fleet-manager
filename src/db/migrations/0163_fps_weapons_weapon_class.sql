-- Add weapon_class to fps_weapons (derived from class_name pattern)
ALTER TABLE fps_weapons ADD COLUMN weapon_class TEXT;

UPDATE fps_weapons SET weapon_class = CASE
  WHEN class_name LIKE '%sniper%' THEN 'Sniper'
  WHEN class_name LIKE '%shotgun%' OR class_name LIKE '%spewgun%' THEN 'Shotgun'
  WHEN class_name LIKE '%smg%' THEN 'SMG'
  WHEN class_name LIKE '%lmg%' OR class_name LIKE '%hmg%' THEN 'LMG'
  WHEN class_name LIKE '%assault%' OR (class_name LIKE '%rifle%' AND class_name NOT LIKE '%sniper%') THEN 'Assault Rifle'
  WHEN class_name LIKE '%launcher%' OR class_name LIKE '%railgun%' THEN 'Launcher'
  WHEN class_name LIKE '%pistol%' THEN 'Pistol'
  WHEN class_name LIKE '%multitool%' OR class_name LIKE '%medical%' OR class_name LIKE '%paramed%' THEN 'Multi-Tool'
  WHEN class_name LIKE '%special%' OR class_name LIKE '%rangefinder%' OR class_name LIKE '%monocular%' THEN 'Gadget'
  ELSE 'Other'
END;

-- Add component_class to vehicle_components (extracted from description "Class: X" line)
ALTER TABLE vehicle_components ADD COLUMN component_class TEXT;

UPDATE vehicle_components SET component_class = CASE
  WHEN description LIKE '%Class: Military%' THEN 'Military'
  WHEN description LIKE '%Class: Stealth%' THEN 'Stealth'
  WHEN description LIKE '%Class: Industrial%' THEN 'Industrial'
  WHEN description LIKE '%Class: Civilian%' THEN 'Civilian'
  WHEN description LIKE '%Class: Competition%' THEN 'Competition'
  ELSE NULL
END;
