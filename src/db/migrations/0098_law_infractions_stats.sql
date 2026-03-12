-- Eliminate stats_json from law_infractions by extracting to typed columns
ALTER TABLE law_infractions ADD COLUMN is_felony INTEGER;
ALTER TABLE law_infractions ADD COLUMN grace_allowance REAL;
ALTER TABLE law_infractions ADD COLUMN grace_allowance_cooldown REAL;
ALTER TABLE law_infractions ADD COLUMN grace_period REAL;
ALTER TABLE law_infractions ADD COLUMN grace_cooloff_scale REAL;
ALTER TABLE law_infractions ADD COLUMN display_grace_time INTEGER;
ALTER TABLE law_infractions ADD COLUMN escalated_fine_multiplier REAL;
ALTER TABLE law_infractions ADD COLUMN early_payment_period REAL;
ALTER TABLE law_infractions ADD COLUMN lifetime REAL;
ALTER TABLE law_infractions ADD COLUMN cool_off_time REAL;
ALTER TABLE law_infractions ADD COLUMN press_charges_notification_time REAL;
ALTER TABLE law_infractions ADD COLUMN remove_time_seconds REAL;
ALTER TABLE law_infractions ADD COLUMN felony_merits REAL;
ALTER TABLE law_infractions ADD COLUMN ignore_party_member INTEGER;
ALTER TABLE law_infractions ADD COLUMN hide_crime_notification INTEGER;
ALTER TABLE law_infractions ADD COLUMN hide_crime_journal INTEGER;

UPDATE law_infractions SET
  is_felony = json_extract(stats_json, '$.isFelony'),
  grace_allowance = json_extract(stats_json, '$.graceAllowance'),
  grace_allowance_cooldown = json_extract(stats_json, '$.graceAllowanceCooldown'),
  grace_period = json_extract(stats_json, '$.gracePeriod'),
  grace_cooloff_scale = json_extract(stats_json, '$.graceCooloffScale'),
  display_grace_time = json_extract(stats_json, '$.displayGraceTime'),
  escalated_fine_multiplier = json_extract(stats_json, '$.escalatedPaymentFineMultiplier'),
  early_payment_period = json_extract(stats_json, '$.earlyPaymentPeriod'),
  lifetime = json_extract(stats_json, '$.lifetime'),
  cool_off_time = json_extract(stats_json, '$.coolOffTime'),
  press_charges_notification_time = json_extract(stats_json, '$.pressChargesNotificationTime'),
  remove_time_seconds = json_extract(stats_json, '$.removeTimeSeconds'),
  felony_merits = json_extract(stats_json, '$.felonyMerits'),
  ignore_party_member = json_extract(stats_json, '$.ignoreIfAgainstPartyMember'),
  hide_crime_notification = json_extract(stats_json, '$.hideCrimeNotification'),
  hide_crime_journal = json_extract(stats_json, '$.hideCrimeInJournal')
WHERE stats_json IS NOT NULL;
