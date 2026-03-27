-- Add faction description, focus, HQ, and leadership from localization
ALTER TABLE contract_generators ADD COLUMN description TEXT;
ALTER TABLE contract_generators ADD COLUMN focus TEXT;
ALTER TABLE contract_generators ADD COLUMN headquarters TEXT;
ALTER TABLE contract_generators ADD COLUMN leadership TEXT;
