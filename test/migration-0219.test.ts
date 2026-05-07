import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS crafting_quality_quantization (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      resource_name TEXT NOT NULL,
      bands_json TEXT NOT NULL,
      game_version_id INTEGER REFERENCES game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ptu_crafting_quality_quantization (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      resource_name TEXT NOT NULL,
      bands_json TEXT NOT NULL,
      game_version_id INTEGER REFERENCES ptu_game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS transport_carriage_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      area_key TEXT,
      pre_arrival_alert_time REAL,
      pre_departure_alert_time REAL,
      post_departure_alert_time REAL,
      announcements_json TEXT,
      game_version_id INTEGER REFERENCES game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ptu_transport_carriage_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      area_key TEXT,
      pre_arrival_alert_time REAL,
      pre_departure_alert_time REAL,
      post_departure_alert_time REAL,
      announcements_json TEXT,
      game_version_id INTEGER REFERENCES ptu_game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS transport_destination_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      categories_json TEXT NOT NULL,
      game_version_id INTEGER REFERENCES game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ptu_transport_destination_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      categories_json TEXT NOT NULL,
      game_version_id INTEGER REFERENCES ptu_game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS unified_shake_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT,
      position_amplitude_json TEXT,
      rotation_amplitude_json TEXT,
      first_person_scale REAL,
      third_person_scale REAL,
      game_version_id INTEGER REFERENCES game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ptu_unified_shake_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT,
      position_amplitude_json TEXT,
      rotation_amplitude_json TEXT,
      first_person_scale REAL,
      third_person_scale REAL,
      game_version_id INTEGER REFERENCES ptu_game_versions(id),
      data_source TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_in_patch TEXT
  )`,
];

async function applyMigration() {
  const db = env.DB as D1Database;
  for (const s of MIGRATION_STATEMENTS) await db.prepare(s).run();
}

async function getColumns(table: string) {
  const db = env.DB as D1Database;
  const r = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set(r.results.map(c => c.name));
}

describe("migration 0219 — 4.8 new types", () => {
  beforeAll(async () => { await applyMigration(); });

  it("creates crafting_quality_quantization with required cols", async () => {
    const cols = await getColumns("crafting_quality_quantization");
    expect(cols.has("uuid")).toBe(true);
    expect(cols.has("resource_name")).toBe(true);
    expect(cols.has("bands_json")).toBe(true);
  });

  it("creates transport_carriage_announcements with timing cols", async () => {
    const cols = await getColumns("transport_carriage_announcements");
    expect(cols.has("area_key")).toBe(true);
    expect(cols.has("pre_arrival_alert_time")).toBe(true);
    expect(cols.has("pre_departure_alert_time")).toBe(true);
    expect(cols.has("post_departure_alert_time")).toBe(true);
    expect(cols.has("announcements_json")).toBe(true);
  });

  it("creates transport_destination_categories with json blob", async () => {
    const cols = await getColumns("transport_destination_categories");
    expect(cols.has("categories_json")).toBe(true);
  });

  it("creates unified_shake_params with amplitude + scale cols", async () => {
    const cols = await getColumns("unified_shake_params");
    expect(cols.has("name")).toBe(true);
    expect(cols.has("position_amplitude_json")).toBe(true);
    expect(cols.has("rotation_amplitude_json")).toBe(true);
    expect(cols.has("first_person_scale")).toBe(true);
    expect(cols.has("third_person_scale")).toBe(true);
  });

  it("mirrors all 4 tables on ptu_*", async () => {
    for (const t of ["ptu_crafting_quality_quantization", "ptu_transport_carriage_announcements", "ptu_transport_destination_categories", "ptu_unified_shake_params"]) {
      const cols = await getColumns(t);
      expect(cols.has("uuid")).toBe(true);
    }
  });
});
