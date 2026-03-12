-- Promote stats_json to proper columns on fps_attachments

ALTER TABLE fps_attachments ADD COLUMN zoom_scale REAL;
ALTER TABLE fps_attachments ADD COLUMN second_zoom_scale REAL;
ALTER TABLE fps_attachments ADD COLUMN damage_multiplier REAL;
ALTER TABLE fps_attachments ADD COLUMN sound_radius_multiplier REAL;

-- Populate from existing stats_json
UPDATE fps_attachments SET
  zoom_scale = json_extract(stats_json, '$.zoom_scale'),
  second_zoom_scale = json_extract(stats_json, '$.second_zoom_scale'),
  damage_multiplier = json_extract(stats_json, '$.damage_multiplier'),
  sound_radius_multiplier = json_extract(stats_json, '$.sound_radius_multiplier')
WHERE stats_json IS NOT NULL;
