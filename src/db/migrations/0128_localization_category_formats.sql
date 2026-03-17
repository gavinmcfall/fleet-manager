-- Per-category label format configuration for the Localization Builder.
-- Stores a JSON object mapping each category to its field order and visibility.
-- Example: {"vehicle_components":{"fields":["manufacturer","size","grade"],"format":"suffix"}}

ALTER TABLE user_localization_configs ADD COLUMN category_formats_json TEXT;
