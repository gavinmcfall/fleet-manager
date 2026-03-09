/**
 * Test persona definitions for multi-persona fleet testing.
 *
 * Each persona represents a different user archetype with a specific fleet
 * configuration designed to exercise different code paths and edge cases.
 */
import type { z } from "zod";
import type { HangarXplorEntrySchema } from "../../src/lib/validation";

export type HangarXplorEntry = z.infer<typeof HangarXplorEntrySchema>;

export interface Persona {
  key: string;
  email: string;
  password: string;
  displayName: string;
  role: "user" | "super_admin";
  fleetFile: string; // relative import path (empty = no fleet)
  orgName?: string;
}

export const PERSONAS: Record<string, Persona> = {
  empty: {
    key: "empty",
    email: "e2e-test@scbridge.app",
    password: "E2ETestPass123!",
    displayName: "E2E Test User",
    role: "user",
    fleetFile: "",
  },
  casual: {
    key: "casual",
    email: "e2e-casual@scbridge.app",
    password: "E2ECasual123!",
    displayName: "Casual Player",
    role: "user",
    fleetFile: "./fleet-casual",
  },
  enthusiast: {
    key: "enthusiast",
    email: "e2e-enthusiast@scbridge.app",
    password: "E2EEnthusiast123!",
    displayName: "SC Enthusiast",
    role: "user",
    fleetFile: "./fleet-enthusiast",
  },
  whale: {
    key: "whale",
    email: "e2e-whale@scbridge.app",
    password: "E2EWhale123!",
    displayName: "Space Whale",
    role: "user",
    fleetFile: "./fleet-whale.json",
  },
  hoarder: {
    key: "hoarder",
    email: "e2e-hoarder@scbridge.app",
    password: "E2EHoarder123!",
    displayName: "Ship Hoarder",
    role: "user",
    fleetFile: "./fleet-hoarder",
  },
  "edge-case": {
    key: "edge-case",
    email: "e2e-edge@scbridge.app",
    password: "E2EEdge123!",
    displayName: "Edge Case User",
    role: "user",
    fleetFile: "./fleet-edge-case",
  },
  admin: {
    key: "admin",
    email: "e2e-admin@scbridge.app",
    password: "E2EAdmin123!",
    displayName: "Admin User",
    role: "super_admin",
    fleetFile: "./fleet-admin",
  },
  "org-leader": {
    key: "org-leader",
    email: "e2e-org@scbridge.app",
    password: "E2EOrg123!",
    displayName: "Org Leader",
    role: "user",
    fleetFile: "./fleet-org-leader",
    orgName: "Test Squadron",
  },
};

/** Insurance string values matching HangarXplor format */
export const INSURANCE = {
  LTI: undefined, // LTI is indicated by lti: true, no insurance string
  "120_MONTH": "120 Month Insurance",
  "72_MONTH": "72 Month Insurance",
  "6_MONTH": "6 Month Insurance",
  "3_MONTH": "3 Month Insurance",
  STANDARD: "Standard Insurance",
} as const;

/** Helper to generate a unique pledge_id */
let pledgeCounter = 100000;
export function nextPledgeId(): string {
  return String(pledgeCounter++);
}

/** Helper to build a HangarXplor entry with sensible defaults */
export function makeEntry(overrides: {
  ship_code: string;
  manufacturer_code: string;
  manufacturer_name: string;
  name: string;
  lti?: boolean;
  insurance?: string;
  warbond?: boolean;
  pledge_id?: string;
  pledge_name?: string;
  pledge_date?: string;
  pledge_cost?: string;
  entity_type?: string;
  ship_name?: string;
  lookup?: string;
  unidentified?: string;
}): HangarXplorEntry {
  return {
    ship_code: overrides.ship_code,
    manufacturer_code: overrides.manufacturer_code,
    manufacturer_name: overrides.manufacturer_name,
    name: overrides.name,
    lti: overrides.lti ?? false,
    insurance: overrides.insurance,
    warbond: overrides.warbond ?? false,
    pledge_id: overrides.pledge_id ?? nextPledgeId(),
    pledge_name: overrides.pledge_name ?? `Standalone Ship - ${overrides.name}`,
    pledge_date: overrides.pledge_date ?? "January 01, 2024",
    pledge_cost: overrides.pledge_cost ?? "$100.00 USD",
    entity_type: overrides.entity_type ?? "ship",
    ship_name: overrides.ship_name,
    lookup: overrides.lookup,
    unidentified: overrides.unidentified,
  };
}
