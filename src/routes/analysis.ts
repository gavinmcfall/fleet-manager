import { Hono } from "hono";
import type { Env, UserFleetEntry, Vehicle, FleetAnalysis } from "../lib/types";

/**
 * /api/analysis/* — Fleet analysis, LLM analysis
 */
export function analysisRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/analysis — fleet gap analysis, redundancies, insurance summary
  routes.get("/analysis", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const fleetResult = await db
      .prepare(
        `SELECT uf.id, uf.vehicle_id, uf.warbond, uf.is_loaner,
          uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
          v.name as vehicle_name, v.slug as vehicle_slug, v.focus, v.size_label, v.cargo,
          v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
          m.name as manufacturer_name, m.code as manufacturer_code,
          it.label as insurance_label, it.duration_months, it.is_lifetime,
          ps.key as production_status
        FROM user_fleet uf
        JOIN vehicles v ON v.id = uf.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        WHERE uf.user_id = ?
        ORDER BY v.name`,
      )
      .bind(userID)
      .all();

    const fleet = fleetResult.results as unknown as UserFleetEntry[];

    const allVehiclesResult = await db
      .prepare(
        `SELECT v.id, v.slug, v.name, v.focus, v.size_label, v.classification,
          ps.key as production_status
        FROM vehicles v
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        ORDER BY v.name`,
      )
      .all();

    const allVehicles = allVehiclesResult.results as unknown as Vehicle[];

    const analysis = analyzeFleet(fleet, allVehicles);
    return c.json(analysis);
  });

  // POST /api/llm/test-connection
  routes.post("/llm/test-connection", async (c) => {
    // TODO: Phase 5 — LLM test connection
    return c.json({ error: "LLM integration not yet implemented" }, 501);
  });

  // POST /api/llm/generate-analysis
  routes.post("/llm/generate-analysis", async (c) => {
    // TODO: Phase 5 — LLM fleet analysis
    return c.json({ error: "LLM integration not yet implemented" }, 501);
  });

  // GET /api/llm/latest-analysis
  routes.get("/llm/latest-analysis", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const row = await db
      .prepare(
        "SELECT id, user_id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(userID)
      .first();

    if (!row) {
      return c.json({ analysis: null });
    }
    return c.json(row);
  });

  // GET /api/llm/analysis-history
  routes.get("/llm/analysis-history", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const result = await db
      .prepare(
        "SELECT id, user_id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(userID)
      .all();

    return c.json({ history: result.results });
  });

  // DELETE /api/llm/analysis/:id
  routes.delete("/llm/analysis/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid analysis ID" }, 400);
    }

    const db = c.env.DB;
    await db.prepare("DELETE FROM ai_analyses WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  });

  return routes;
}

async function getDefaultUserID(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM users WHERE username = 'default'")
    .first<{ id: number }>();
  return row?.id ?? null;
}

/**
 * Fleet analysis — ported from internal/analysis/analysis.go
 */
function analyzeFleet(fleet: UserFleetEntry[], _allVehicles: Vehicle[]): FleetAnalysis {
  // Overview stats
  let flightReady = 0;
  let inConcept = 0;
  let totalCargo = 0;
  let totalPledgeValue = 0;
  let minCrew = 0;
  let maxCrew = 0;
  let ltiCount = 0;
  let nonLtiCount = 0;

  const sizeDistribution: Record<string, number> = {};
  const roleCategories: Record<string, string[]> = {};
  const ltiShips: Array<{
    ship_name: string;
    custom_name?: string;
    pledge_cost?: string;
    pledge_name?: string;
    pledge_date?: string;
    insurance_label?: string;
    duration_months?: number;
    is_lifetime: boolean;
    warbond: boolean;
  }> = [];
  const nonLtiShips: typeof ltiShips = [];
  const unknownShips: typeof ltiShips = [];

  for (const entry of fleet) {
    // Production status
    if (entry.production_status === "flight_ready") flightReady++;
    if (entry.production_status === "in_concept") inConcept++;

    // Cargo
    totalCargo += entry.cargo ?? 0;
    totalPledgeValue += entry.pledge_price ?? 0;

    // Crew
    minCrew += entry.crew_min ?? 0;
    maxCrew += entry.crew_max ?? 0;

    // Size distribution
    const size = entry.size_label || "Unknown";
    sizeDistribution[size] = (sizeDistribution[size] ?? 0) + 1;

    // Role categories
    const focus = entry.focus || "Unknown";
    if (!roleCategories[focus]) {
      roleCategories[focus] = [];
    }
    roleCategories[focus].push(entry.vehicle_name ?? "Unknown");

    // Insurance
    const insEntry = {
      ship_name: entry.vehicle_name ?? "Unknown",
      custom_name: entry.custom_name,
      pledge_cost: entry.pledge_cost,
      pledge_name: entry.pledge_name,
      pledge_date: entry.pledge_date,
      insurance_label: entry.insurance_label,
      duration_months: entry.duration_months,
      is_lifetime: entry.is_lifetime ?? false,
      warbond: entry.warbond,
    };

    if (entry.is_lifetime) {
      ltiCount++;
      ltiShips.push(insEntry);
    } else if (entry.insurance_label) {
      nonLtiCount++;
      nonLtiShips.push(insEntry);
    } else {
      unknownShips.push(insEntry);
    }
  }

  // Gap analysis — check for missing key roles
  const ownedFocuses = new Set(Object.keys(roleCategories).map((f) => f.toLowerCase()));
  const keyRoles = [
    { role: "Mining", priority: "high", description: "No dedicated mining ship" },
    { role: "Salvage", priority: "high", description: "No salvage capability" },
    { role: "Medical", priority: "medium", description: "No medical ship" },
    { role: "Refueling", priority: "medium", description: "No refueling capability" },
    { role: "Exploration", priority: "medium", description: "No dedicated exploration ship" },
    { role: "Cargo", priority: "low", description: "No dedicated cargo hauler" },
  ];

  const gaps = keyRoles
    .filter((kr) => {
      const term = kr.role.toLowerCase();
      // Check if any owned focus contains this term
      for (const focus of ownedFocuses) {
        if (focus.includes(term)) return false;
      }
      return true;
    })
    .map((kr) => ({
      role: kr.role,
      priority: kr.priority,
      description: kr.description,
      suggestions: [] as string[],
    }));

  // Redundancies — roles with 3+ ships
  const redundancies = Object.entries(roleCategories)
    .filter(([, ships]) => ships.length >= 3)
    .map(([role, ships]) => ({
      role,
      ships,
      notes: `${ships.length} ships in this role`,
    }));

  return {
    overview: {
      total_vehicles: fleet.length,
      flight_ready: flightReady,
      in_concept: inConcept,
      total_cargo: totalCargo,
      total_pledge_value: totalPledgeValue,
      min_crew: minCrew,
      max_crew: maxCrew,
      lti_count: ltiCount,
      non_lti_count: nonLtiCount,
    },
    size_distribution: sizeDistribution,
    role_categories: roleCategories,
    gap_analysis: gaps,
    redundancies,
    insurance_summary: {
      lti_ships: ltiShips,
      non_lti_ships: nonLtiShips,
      unknown_ships: unknownShips,
    },
  };
}
