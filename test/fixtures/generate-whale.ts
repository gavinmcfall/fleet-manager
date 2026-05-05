#!/usr/bin/env tsx
/**
 * Whale fixture generator — queries all vehicles from the DB and generates
 * a HangarXplor JSON fixture with one of every ship.
 *
 * Usage: source ~/.secrets && npx tsx test/fixtures/generate-whale.ts
 */
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VehicleRow {
  slug: string;
  name: string;
  manufacturer_code: string | null;
  manufacturer_name: string | null;
  pledge_price: number | null;
  size_label: string | null;
}

interface HangarXplorEntry {
  ship_code: string;
  manufacturer_code: string;
  manufacturer_name: string;
  name: string;
  lti: boolean;
  insurance?: string;
  warbond: boolean;
  pledge_id: string;
  pledge_name: string;
  pledge_date: string;
  pledge_cost: string;
  entity_type: string;
}

// Insurance distribution: 60% LTI, 15% 120-month, 10% 72-month, 15% mixed shorter
function assignInsurance(index: number, total: number): { lti: boolean; insurance?: string } {
  const pct = index / total;
  if (pct < 0.6) return { lti: true };
  if (pct < 0.75) return { lti: false, insurance: "120 Month Insurance" };
  if (pct < 0.85) return { lti: false, insurance: "72 Month Insurance" };
  if (pct < 0.92) return { lti: false, insurance: "6 Month Insurance" };
  if (pct < 0.97) return { lti: false, insurance: "3 Month Insurance" };
  return { lti: false, insurance: "Standard Insurance" };
}

// Pledge dates distributed across 2013–2025
function assignPledgeDate(index: number, total: number): string {
  const startYear = 2013;
  const endYear = 2025;
  const yearSpan = endYear - startYear + 1;
  const year = startYear + Math.floor((index / total) * yearSpan);
  const month = (index % 12) + 1;
  const day = (index % 28) + 1;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[month - 1]} ${String(day).padStart(2, "0")}, ${year}`;
}

// Convert slug to ship_code format: "aegs-gladius" -> "AEGS_Gladius"
function slugToShipCode(slug: string, mfgCode: string | null): string {
  const prefix = mfgCode ?? "UNKN";
  const shipPart = slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("_");
  // Remove manufacturer prefix if slug already starts with it
  const prefixLower = prefix.toLowerCase();
  if (slug.startsWith(prefixLower + "-")) {
    const rest = slug.slice(prefixLower.length + 1);
    const restPart = rest
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("_");
    return `${prefix}_${restPart}`;
  }
  return `${prefix}_${shipPart}`;
}

function formatPledgeCost(price: number | null): string {
  if (!price) return "$100.00 USD";
  return `$${price.toFixed(2)} USD`;
}

async function main() {
  console.log("Querying vehicles from production DB...");

  const sql = `SELECT v.slug, v.name, m.code as manufacturer_code, m.name as manufacturer_name, v.pledge_price, v.size_label
    FROM vehicles v
    LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
    ORDER BY v.name`;

  let rawOutput: string;
  try {
    rawOutput = execSync(
      `. ~/.secrets && npx wrangler d1 execute scbridge-production --remote --env production --config wrangler.toml --command "${sql}" --json`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, shell: "/bin/bash" },
    );
  } catch (err) {
    console.error("Failed to query DB. Make sure CLOUDFLARE_API_TOKEN is available.");
    console.error(err);
    process.exit(1);
  }

  // Parse wrangler JSON output — array of result sets
  const parsed = JSON.parse(rawOutput);
  const results: VehicleRow[] = parsed[0]?.results ?? [];

  if (results.length === 0) {
    console.error("No vehicles found in DB!");
    process.exit(1);
  }

  console.log(`Found ${results.length} vehicles. Generating fixture...`);

  let pledgeCounter = 500000;
  const entries: HangarXplorEntry[] = results.map((v, i) => {
    const ins = assignInsurance(i, results.length);
    return {
      ship_code: slugToShipCode(v.slug, v.manufacturer_code),
      manufacturer_code: v.manufacturer_code ?? "UNKN",
      manufacturer_name: v.manufacturer_name ?? "Unknown Manufacturer",
      name: v.name,
      lti: ins.lti,
      ...(ins.insurance ? { insurance: ins.insurance } : {}),
      warbond: i % 3 === 0,
      pledge_id: String(pledgeCounter++),
      pledge_name: `Standalone Ship - ${v.name}`,
      pledge_date: assignPledgeDate(i, results.length),
      pledge_cost: formatPledgeCost(v.pledge_price),
      entity_type: v.size_label === "Vehicle" ? "vehicle" : "ship",
    };
  });

  const outPath = join(__dirname, "fleet-whale.json");
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Wrote ${entries.length} entries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
