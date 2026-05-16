/**
 * PART I test - Fleetyards slug fallback for new 4.8 ships.
 *
 * Audit 2026-05-17 found the 6 new 4.8 ships (orig-m80, misc-starlite, etc.)
 * never get production_status_id set because our slug includes manufacturer
 * prefix but Fleetyards' may not. The fallback strips the mfr-prefix segment
 * (everything up to first '-') and retries the lookup.
 */
import { describe, it, expect } from "vitest";

// Replicate the fallback logic from fleetyards.ts so it can be unit-tested
// without importing the whole worker handler.
function resolveStatus(slug: string, targetMap: Map<string, number>): number | undefined {
  const direct = targetMap.get(slug);
  if (direct) return direct;
  const base = slug
    .replace(/-wikelo-.*$/, "")
    .replace(/-2949-.*$/, "")
    .replace(/-2950-.*$/, "")
    .replace(/-2951-.*$/, "");
  let baseTarget = targetMap.get(base);
  if (!baseTarget) {
    const hyphen = base.indexOf("-");
    if (hyphen > 0) {
      baseTarget = targetMap.get(base.slice(hyphen + 1));
    }
  }
  return baseTarget;
}

describe("Fleetyards slug fallback", () => {
  it("direct hit returns the status", () => {
    const map = new Map([["aegs-hammerhead", 1]]);
    expect(resolveStatus("aegs-hammerhead", map)).toBe(1);
  });

  it("variant suffix strip - wikelo", () => {
    const map = new Map([["mrai-guardian", 1]]);
    expect(resolveStatus("mrai-guardian-wikelo-special", map)).toBe(1);
  });

  it("mfr-prefix strip - new 4.8 ship orig-m80 matches Fleetyards m80", () => {
    const map = new Map([["m80", 1]]);
    expect(resolveStatus("orig-m80", map)).toBe(1);
  });

  it("mfr-prefix strip - misc-starlite matches starlite", () => {
    const map = new Map([["starlite", 1]]);
    expect(resolveStatus("misc-starlite", map)).toBe(1);
  });

  it("mfr-prefix strip - drak-pitbull matches pitbull", () => {
    const map = new Map([["pitbull", 1]]);
    expect(resolveStatus("drak-pitbull", map)).toBe(1);
  });

  it("combined suffix + prefix strip - drak-pitbull-wikelo-x matches pitbull", () => {
    const map = new Map([["pitbull", 1]]);
    expect(resolveStatus("drak-pitbull-wikelo-x", map)).toBe(1);
  });

  it("no match returns undefined", () => {
    const map = new Map([["other-ship", 1]]);
    expect(resolveStatus("orig-m80", map)).toBeUndefined();
  });

  it("never strips the only segment - slug without dash returns undefined if no match", () => {
    const map = new Map<string, number>();
    expect(resolveStatus("solo", map)).toBeUndefined();
  });
});
