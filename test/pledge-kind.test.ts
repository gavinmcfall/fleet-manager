import { describe, it, expect } from "vitest";
import { inferKind } from "../src/lib/pledgeKind";

describe("inferKind", () => {
  describe("FPS Equipment — armour pieces (v1 originals)", () => {
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

  describe("FPS Equipment — armour triplets (v2)", () => {
    it.each([
      ["Geist Armor Arms Epoque", "FPS Equipment"],
      ["Geist Armor Core Epoque", "FPS Equipment"],
      ["Geist Armor Legs Epoque", "FPS Equipment"],
      ["Strata Arms ArcCorp Edition", "FPS Equipment"],
      ["Strata Core Hurston Edition", "FPS Equipment"],
      ["Strata Legs microTech Edition", "FPS Equipment"],
      ["Chiron Arms AA Support", "FPS Equipment"],
      ["Wrecker Payback Arms", "FPS Equipment"],
      ["ORC-mkX Core Singularity", "FPS Equipment"],
      ["RSI Venture Explorer Suit Legs", "FPS Equipment"],
      ["CitizenCon 2949 Arm Armor", "FPS Equipment"],
      ["CitizenCon 2949 Leg Armor", "FPS Equipment"],
      ["Omni Role Combat Armor (ORC) mk9", "FPS Equipment"],
      ["Artimex Armor Core - Chairman's Club Edition", "FPS Equipment"],
    ])("classifies %s as FPS Equipment", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("FPS Equipment — suits + clothing (v2)", () => {
    it.each([
      ["OMNI-AFS-Sapphire Armored Flight Suit", "FPS Equipment"],
      ["Stirling Hazard Suit", "FPS Equipment"],
      ["CitizenCon 2949 Suit", "FPS Equipment"],
      ["Sol-III Flight Suit", "FPS Equipment"],
      ["Falston Jumpsuit \"microTech Edition\"", "FPS Equipment"],
      ["Crusader Hat", "FPS Equipment"],
      ["IAE 2954 T-Shirt White", "FPS Equipment"],
      ["Headhunter Veritas Outfit Jacket", "FPS Equipment"],
      ["ThermoWeave Pants ASD Edition", "FPS Equipment"],
      ["ThermoWeave Hood ASD Edition", "FPS Equipment"],
      ["ThermoWeave Gloves ASD Edition", "FPS Equipment"],
      ["ThermoWeave Coat ASD Edition", "FPS Equipment"],
      ["Stegman's IndVest \"Pathfinder\" Shirt", "FPS Equipment"],
      ["Oxhorn Service Sweater InterSec", "FPS Equipment"],
      ["Top Hat", "FPS Equipment"],
      ["Monocle", "FPS Equipment"],
      ["Explorer-Class MobiGlas Rig", "FPS Equipment"],
      ["Chrome Dome Head Gear Striker", "FPS Equipment"],
    ])("classifies %s as FPS Equipment", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("FPS Equipment — weapons + attachments (v2)", () => {
    it.each([
      ["P8-AR \"Blackguard\" Rifle", "FPS Equipment"],
      ["P8-SC \"Epoque\" SMG", "FPS Equipment"],
      ["Karna \"Ascension\" Rifle", "FPS Equipment"],
      ["Ardor-3 Salvaged Repeater", "FPS Equipment"],
      ["Preacher Armament Inquisition XXII Gatling", "FPS Equipment"],
      ["CitizenCon 2948 Weapon", "FPS Equipment"],
      ["Cambio-Lite SRT Attachment", "FPS Equipment"],
      ["Mining attachment", "FPS Equipment"],
    ])("classifies %s as FPS Equipment", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("Skin (paints) (v2)", () => {
    it.each([
      ["Caterpillar - Deck the Hull Paint", "Skin"],
      ["Caterpillar - IceBreak Paint", "Skin"],
      ["Mustang - IceBreak Paint", "Skin"],
    ])("classifies %s as Skin", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("Hangar decoration (v1 originals)", () => {
    it.each([
      ["VFG Industrial Hangar", "Hangar decoration"],
      ["Self-Land Hangar", "Hangar decoration"],
      ["Aeroview Hangar", "Hangar decoration"],
      ["Plushie", "Hangar decoration"],
    ])("classifies %s as Hangar decoration", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });
  });

  describe("Hangar decoration (v2 expansions)", () => {
    it.each([
      ["Origin X1 Poster", "Hangar decoration"],
      ["Origin X1 Model", "Hangar decoration"],
      ["Takuetsu Nox Model", "Hangar decoration"],
      ["Takuetsu Consolidated Outland Mustang", "Hangar decoration"],
      ["Luminalia-Wallpaper", "Hangar decoration"],
      ["CitizenCon 2954 Challenge Coin", "Hangar decoration"],
      ["Death Mask '54 Coin", "Hangar decoration"],
      ["Vanduul Broken Skull", "Hangar decoration"],
      ["Salvaged Skull 8 SCU Container", "Hangar decoration"],
      ["36th Fighter Wing Sq. Badge", "Hangar decoration"],
      ["CitizenCon 2954 Themed Storage Chest", "Hangar decoration"],
      ["CitizenCon 2954 Themed Double Bed", "Hangar decoration"],
      ["Hazardous Cargo Chair", "Hangar decoration"],
      ["Cockpit Recorder Prop", "Hangar decoration"],
      ["Pyro Resupply Commemorative Display", "Hangar decoration"],
      ["Hadesian Artifact", "Hangar decoration"],
      ["Referral Fishtank", "Hangar decoration"],
      ["Fish School Referral", "Hangar decoration"],
      ["Xi'An Space Plant", "Hangar decoration"],
      ["H-DECO - Jacopo Top Hat & Monocle", "Hangar decoration"],
    ])("classifies %s as Hangar decoration", (title, expected) => {
      expect(inferKind(title)).toBe(expected);
    });

    it("Helmet Statue lands as decoration, not armour (order matters)", () => {
      expect(inferKind("Helmet Statue Display")).toBe("Hangar decoration");
    });
  });

  describe("Other — fallback for titles outside the canonical taxonomy", () => {
    it.each([
      ["TBD Fabricator"],
      ["Aurora MR LN"],
      ["Star Citizen Digital Download"],
      ["Squadron 42 Digital Download"],
      ["Digital Star Map"],
      ["Digital Game Soundtrack"],
      ["Upgrade - 315p Explorer To Nomad"],
      ["Upgrade - Cutlass Black To C1 Spirit"],
      ["Carrack Name Reservation"],
      ["Schematic RSI Polaris"],
      ["Schematic Drake Caterpillar"],
      ["Sneak-Peek"],
      ["Legacy Alpha"],
      ["Spectrum-Badge"], // forum badge, not a hangar decoration
      ["Engine Tuning Kit"],
      ["BB-12 Manned Maneuvering Unit"],
    ])("classifies %s as Other", (title) => {
      expect(inferKind(title)).toBe("Other");
    });
  });

  describe("returns null only when title is missing", () => {
    it("null title", () => {
      expect(inferKind(null as unknown as string)).toBeNull();
    });
    it("undefined title", () => {
      expect(inferKind(undefined as unknown as string)).toBeNull();
    });
    it("empty string title", () => {
      expect(inferKind("")).toBeNull();
    });
  });

});
