-- Add item kind to image_captures (Ship, Skin, FPS Equipment, Hangar decoration, etc.)
ALTER TABLE image_captures ADD COLUMN kind TEXT;
CREATE INDEX idx_image_captures_kind ON image_captures(kind);
