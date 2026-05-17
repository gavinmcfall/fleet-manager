import { describe, it, expect } from "vitest";
import { stripManufacturer, findVehicleSlugLocal, type VehicleMap } from "../src/lib/fleet-import";

/**
 * Issue #161 — Mirai/Vanduul/Xian ships not matched on hangar-sync.
 *
 * Root cause: MFR_PREFIX regex was missing "Mirai" (and Vanduul, Xi'an, MRAI,
 * VNCL, XNAA), so the preloadVehicleMap step only indexed names WITH the
 * manufacturer prefix. RSI sends titles WITHOUT the prefix ("Guardian MX"
 * not "Mirai Guardian MX"), causing nameToSlug.get("guardian mx") to miss.
 */
describe("fleet-import — manufacturer prefix stripping (issue #161)", () => {
  describe("stripManufacturer", () => {
    it("strips Mirai prefix", () => {
      expect(stripManufacturer("Mirai Guardian MX")).toBe("Guardian MX");
      expect(stripManufacturer("Mirai Fury")).toBe("Fury");
      expect(stripManufacturer("Mirai Fury MX")).toBe("Fury MX");
      expect(stripManufacturer("Mirai Pulse")).toBe("Pulse");
      expect(stripManufacturer("Mirai Pulse LX")).toBe("Pulse LX");
    });

    it("strips Vanduul prefix", () => {
      expect(stripManufacturer("Vanduul Mauler Destroyer")).toBe("Mauler Destroyer");
    });

    it("strips Xian / Xi'an prefix", () => {
      expect(stripManufacturer("Xian Scout")).toBe("Scout");
      expect(stripManufacturer("Xi'an Khartu-Al")).toBe("Khartu-Al");
    });

    it("strips short code prefixes (MRAI / VNCL / XNAA)", () => {
      expect(stripManufacturer("MRAI Guardian MX")).toBe("Guardian MX");
      expect(stripManufacturer("VNCL Mauler")).toBe("Mauler");
      expect(stripManufacturer("XNAA Nox")).toBe("Nox");
    });

    it("keeps existing prefixes working (regression)", () => {
      expect(stripManufacturer("Anvil Carrack")).toBe("Carrack");
      expect(stripManufacturer("Drake Cutlass Black")).toBe("Cutlass Black");
      expect(stripManufacturer("RSI Aurora Mk I MR")).toBe("Aurora Mk I MR");
      expect(stripManufacturer("MISC Hull A")).toBe("Hull A");
    });

    it("leaves non-prefixed names unchanged", () => {
      expect(stripManufacturer("Hull D")).toBe("Hull D");
      expect(stripManufacturer("Guardian MX")).toBe("Guardian MX");
    });
  });

  describe("findVehicleSlugLocal end-to-end for issue #161 ships", () => {
    function makeMap(): VehicleMap {
      const slugToID = new Map<string, number>();
      const nameToSlug = new Map<string, string>();
      const compactToSlug = new Map<string, string>();
      // Simulate the same indexing preloadVehicleMap does:
      const ships = [
        { id: 1, slug: "mrai-guardian-mx", name: "Mirai Guardian MX" },
        { id: 2, slug: "mrai-pulse", name: "Mirai Pulse" },
        { id: 3, slug: "mrai-pulse-lx", name: "Mirai Pulse LX" },
        { id: 4, slug: "misc-fury", name: "Mirai Fury" },
        { id: 5, slug: "misc-fury-miru", name: "Mirai Fury MX" },
      ];
      for (const s of ships) {
        slugToID.set(s.slug, s.id);
        nameToSlug.set(s.name.toLowerCase(), s.slug);
        const stripped = stripManufacturer(s.name);
        if (stripped.toLowerCase() !== s.name.toLowerCase()) {
          nameToSlug.set(stripped.toLowerCase(), s.slug);
        }
      }
      return { slugToID, nameToSlug, compactToSlug };
    }

    // RSI sends titles without manufacturer prefix — matcher must still find the ship
    const cases = [
      { title: "Guardian MX",  expected: "mrai-guardian-mx" },
      { title: "Pulse",        expected: "mrai-pulse" },
      { title: "Pulse LX",     expected: "mrai-pulse-lx" },
      { title: "Fury",         expected: "misc-fury" },
      { title: "Fury MX",      expected: "misc-fury-miru" },
    ];

    for (const c of cases) {
      it(`matches RSI title "${c.title}" → slug "${c.expected}"`, () => {
        const map = makeMap();
        const slug = findVehicleSlugLocal(map, [], c.title);
        expect(slug).toBe(c.expected);
      });
    }
  });
});
