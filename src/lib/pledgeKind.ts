/**
 * Best-effort fallback classifier for pledge items whose `kind` field
 * was missing from RSI's hangar markup. Used at INSERT time when the
 * extension's scrape returned `null`.
 *
 * Coverage gap context: ~16% of `user_pledge_items` rows have NULL
 * kind because RSI's `.kind` element is absent on newer products
 * (recent armour sets like Monde Keystone, festival cosmetics, hangar
 * skus, etc.). The DATA was still scraped — only the classifier
 * label is missing — so any UI that filters by kind misses these.
 *
 * Design rule: precision over recall. A wrong label corrupts
 * downstream filters more than NULL does. Only return a non-null
 * value when the title contains an unambiguous token. Anything else
 * stays NULL.
 *
 * Returns one of the canonical `kind` values that already appear in
 * the production distribution (e.g., "FPS Equipment", "Hangar
 * decoration") so this stays consistent with rows that DO get RSI's
 * scraped value.
 */
export function inferKind(title: string | null | undefined): string | null {
  if (!title || typeof title !== "string") return null;

  // Hangar SKUs come first — "VFG Hangar", "Self-Land Hangar",
  // "Aeroview Hangar", and standalone "Plushie" / "Statue".
  if (/\b(?:Hangar|Plushie|Statue|Trophy|Centerpiece)\b/i.test(title)) {
    return "Hangar decoration";
  }

  // FPS armour pieces — Helmet, Backpack, Undersuit, Boots, plus
  // generic "Armor Set" / "Armour Set" SKUs and the Monde-style
  // "Keystone" suffix that marks all four armour pieces in newer sets.
  if (
    /\b(?:Helmet|Backpack|Undersuit|Boots)\b/i.test(title) ||
    /\b(?:Armor|Armour)\s+Set\b/i.test(title) ||
    /\bKeystone\b/i.test(title)
  ) {
    return "FPS Equipment";
  }

  return null;
}
