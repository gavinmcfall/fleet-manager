import { describe, it, expect } from "vitest";
import { inferKind } from "../src/lib/pledgeKind";

describe("inferKind", () => {
  describe("FPS Equipment", () => {
    it.each([
      ["Monde Helmet Keystone", "FPS Equipment"],
      ["Monde Core Keystone", "FPS Equipment"],
      ["Monde Arms Keystone", "FPS Equipment"],
      ["Monde Legs Keystone", "FPS Equipment"],
      ["Warden Backpack", "FPS Equipment"],
      ["Calva Helmet Red Festival", "FPS Equipment"],
      ["Sabine Undersuit Red Festival", "FPS Equipment"],
      ["Pyro RYT Boots", "FPS Equipment"],
      ["Custom Armor Set", "FPS Equipment"],
      ["RSI Armour Set", "FPS Equipment"],
    ])("classifies %s as FPS Equipment", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("Hangar decoration", () => {
    it.each([
      ["VFG Industrial Hangar", "Hangar decoration"],
      ["Self-Land Hangar", "Hangar decoration"],
      ["Aeroview Hangar", "Hangar decoration"],
      ["Plushie", "Hangar decoration"],
    ])("classifies %s as Hangar decoration", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("returns null for ambiguous or unknown titles", () => {
    it.each([
      ["TBD Fabricator"],
      [""],
      ["Random Mystery Item"],
      ["Aurora MR LN"],
    ])("returns null for %s", (title) => {
      expect(inferKind(title)).toBeNull();
    });
  });

  describe("preserves null on empty input", () => {
    it("returns null when title is empty", () => {
      expect(inferKind("")).toBeNull();
    });

    it("returns null for non-string input", () => {
      expect(inferKind(null as unknown as string)).toBeNull();
      expect(inferKind(undefined as unknown as string)).toBeNull();
    });
  });
});
