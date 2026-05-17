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

  /** Issue #161 follow-up — the 11 OTHER missing ships in TheWhiteWolves' hangar.
   * Each represents a distinct matcher gap. The fixes:
   *   - C.O. in MFR_PREFIX (HoverQuad, Nomad)
   *   - Period-stripping fallback (A.T.L.S.)
   *   - Drop-last-word fallback (Nova Tank, Dragonfly Black, Star Kitten Edition, Ursa Rover, Ares Inferno, Ares Ion)
   *   - mfr-prefixed candidate slugs in import.ts caller (C8R Pisces → anvl-c8r-pisces-rescue) — tested via candidate prefix here
   */
  describe("Issue #161 follow-up — 11 other naming mismatches", () => {
    function makeFullMap(): VehicleMap {
      const ships = [
        // C.O. (CNOU)
        { id: 10, slug: "cnou-hoverquad", name: "C.O. HoverQuad" },
        { id: 11, slug: "cnou-nomad", name: "C.O. Nomad" },
        // Argo ATLS
        { id: 20, slug: "argo-atls", name: "Argo ATLS" },
        // Crusader Ares variants — DB names normalised to RSI convention (drop "Star Fighter" middle word)
        { id: 30, slug: "crus-starfighter-inferno", name: "Crusader Ares Inferno" },
        { id: 31, slug: "crus-starfighter-ion", name: "Crusader Ares Ion" },
        // Drake Dragonfly family (no Black variant — Black is base in DB)
        { id: 40, slug: "drak-dragonfly", name: "Drake Dragonfly" },
        { id: 41, slug: "drak-dragonfly-pink", name: "Drake Dragonfly Star Kitten" },
        // RSI Ursa
        { id: 50, slug: "rsi-ursa-rover", name: "RSI Ursa" },
        // Tumbril Nova
        { id: 60, slug: "tmbl-nova", name: "Tumbril Nova" },
        // Anvil C8R Pisces (DB has trailing "Rescue", pledge title doesn't)
        { id: 70, slug: "anvl-c8r-pisces-rescue", name: "Anvil C8R Pisces Rescue" },
      ];
      const slugToID = new Map<string, number>();
      const nameToSlug = new Map<string, string>();
      const compactToSlug = new Map<string, string>();
      for (const s of ships) {
        slugToID.set(s.slug, s.id);
        nameToSlug.set(s.name.toLowerCase(), s.slug);
        const stripped = stripManufacturer(s.name);
        if (stripped.toLowerCase() !== s.name.toLowerCase()) {
          nameToSlug.set(stripped.toLowerCase(), s.slug);
        }
        // compactToSlug is built from compact slug
        const compact = s.slug.replace(/-/g, "");
        compactToSlug.set(compact, s.slug);
      }
      return { slugToID, nameToSlug, compactToSlug };
    }

    const cases = [
      // C.O. ships (fixed by C\.O\. in MFR_PREFIX → "HoverQuad" indexed)
      { title: "HoverQuad",                   expected: "cnou-hoverquad", note: "C.O. strip" },
      { title: "Nomad",                       expected: "cnou-nomad",     note: "C.O. strip" },
      // Period-stripped name match
      { title: "A.T.L.S.",                    expected: "argo-atls",      note: "period strip" },
      // Drop-last-word fallback
      { title: "Nova Tank",                   expected: "tmbl-nova",      note: "drop Tank" },
      { title: "Dragonfly Black",             expected: "drak-dragonfly", note: "drop Black (base variant)" },
      { title: "Dragonfly Star Kitten Edition", expected: "drak-dragonfly-pink", note: "drop Edition" },
      { title: "Ursa Rover",                  expected: "rsi-ursa-rover", note: "drop Rover" },
      // Ares variants: rely on DB rename ("Star Fighter" dropped) so stripManufacturer-indexed "Ares Inferno"/"Ares Ion" match
      { title: "Ares Inferno",                expected: "crus-starfighter-inferno", note: "DB renamed to drop Star Fighter" },
      { title: "Ares Ion",                    expected: "crus-starfighter-ion",     note: "same as Inferno" },
    ];

    for (const c of cases) {
      it(`matches "${c.title}" → "${c.expected}" (${c.note})`, () => {
        const map = makeFullMap();
        const slug = findVehicleSlugLocal(map, [], c.title);
        expect(slug).toBe(c.expected);
      });
    }

    // C8R Pisces requires the mfr-prefixed candidate slug passed by import.ts caller.
    // Simulate the caller's candidate generation:
    it('matches "C8R Pisces" via mfr-prefixed candidate "anvl-c8r-pisces" → prefix-matches DB "anvl-c8r-pisces-rescue"', () => {
      const map = makeFullMap();
      // Candidate added by import.ts: `${mfr_lower}-${nameSlug}` = "anvl-c8r-pisces"
      const candidates = ["c8r-pisces", "anvl-c8r-pisces"];
      const slug = findVehicleSlugLocal(map, candidates, "C8R Pisces");
      expect(slug).toBe("anvl-c8r-pisces-rescue");
    });
  });
});
