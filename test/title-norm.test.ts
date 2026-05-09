import { describe, it, expect } from "vitest";
import { normaliseTitle } from "../src/lib/titleNorm";

/**
 * Canonical-form normalisation used to JOIN pledge titles to their
 * matching paints / media entries. Tolerates RSI's data quirks:
 * stray whitespace, unicode dash variants, mixed case, and the
 * "Paint" / "Skin" / "Livery" naming inconsistency.
 */
describe("normaliseTitle", () => {
  describe("paint title quirks (the original case)", () => {
    it("collapses double-space-after-dash to match Livery name", () => {
      expect(normaliseTitle("Apollo -  Alliance Aid Red & Gold Paint"))
        .toBe(normaliseTitle("Apollo Alliance Aid Red & Gold Livery"));
    });

    it("matches single-space-dash variants", () => {
      expect(normaliseTitle("Caterpillar - IceBreak Paint"))
        .toBe(normaliseTitle("Caterpillar IceBreak Livery"));
    });

    it("matches no-dash variants", () => {
      expect(normaliseTitle("Mustang IceBreak Paint"))
        .toBe(normaliseTitle("Mustang IceBreak Livery"));
    });
  });

  describe("unicode dash variants", () => {
    it("treats em-dash, en-dash, and hyphen as the same separator", () => {
      const hyphen = normaliseTitle("Apollo - Alliance Aid Paint");
      const enDash = normaliseTitle("Apollo – Alliance Aid Paint");
      const emDash = normaliseTitle("Apollo — Alliance Aid Paint");
      const minus = normaliseTitle("Apollo − Alliance Aid Paint");
      expect(enDash).toBe(hyphen);
      expect(emDash).toBe(hyphen);
      expect(minus).toBe(hyphen);
    });
  });

  describe("case folding", () => {
    it("is case-insensitive", () => {
      expect(normaliseTitle("APOLLO ALLIANCE AID LIVERY"))
        .toBe(normaliseTitle("apollo alliance aid livery"));
      expect(normaliseTitle("Apollo Alliance Aid Livery"))
        .toBe(normaliseTitle("apollo ALLIANCE aid LIVERY"));
    });
  });

  describe("whitespace handling", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normaliseTitle("  Apollo Livery  "))
        .toBe(normaliseTitle("Apollo Livery"));
    });

    it("collapses runs of whitespace into a single space", () => {
      expect(normaliseTitle("Apollo    Alliance     Livery"))
        .toBe(normaliseTitle("Apollo Alliance Livery"));
    });

    it("treats tabs and newlines as whitespace", () => {
      expect(normaliseTitle("Apollo\tAlliance\nLivery"))
        .toBe(normaliseTitle("Apollo Alliance Livery"));
    });
  });

  describe("Paint/Skin → Livery rewrite", () => {
    it("rewrites trailing 'Paint' to 'Livery' (RSI naming inconsistency)", () => {
      expect(normaliseTitle("Apollo Paint")).toBe(normaliseTitle("Apollo Livery"));
    });

    it("rewrites trailing 'Skin' to 'Livery'", () => {
      expect(normaliseTitle("Apollo Skin")).toBe(normaliseTitle("Apollo Livery"));
    });

    it("does not touch 'Paint' inside another word", () => {
      // "Spaint" or similar — paint must be at word boundary
      expect(normaliseTitle("Repainted Item")).not.toContain("livery");
    });
  });

  describe("non-distinguishing", () => {
    it("does NOT strip all whitespace (preserves SKU separators)", () => {
      // Aurora MkI vs Aurora Mk I — these may be distinct SKUs.
      // We only collapse multiple spaces, never remove single ones.
      expect(normaliseTitle("Aurora MkI"))
        .not.toBe(normaliseTitle("Aurora Mk I"));
    });

    it("does NOT strip non-alphanumerics — ampersand stays", () => {
      // "Red & Gold" must not collapse to "Red Gold"
      expect(normaliseTitle("Red & Gold"))
        .not.toBe(normaliseTitle("Red Gold"));
    });
  });

  describe("empty / nullish", () => {
    it("returns empty string for null / undefined / empty", () => {
      expect(normaliseTitle(null)).toBe("");
      expect(normaliseTitle(undefined)).toBe("");
      expect(normaliseTitle("")).toBe("");
      expect(normaliseTitle("   ")).toBe("");
    });
  });

  describe("idempotent", () => {
    it("running normaliseTitle twice produces the same result", () => {
      const samples = [
        "Apollo - Alliance Aid Red & Gold Paint",
        "Caterpillar — IceBreak Paint",
        "  Mustang  IceBreak  Paint  ",
      ];
      for (const s of samples) {
        const once = normaliseTitle(s);
        const twice = normaliseTitle(once);
        expect(twice).toBe(once);
      }
    });
  });
});
