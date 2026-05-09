/**
 * Best-effort fallback classifier for pledge items whose `kind` field
 * was missing from RSI's hangar markup. Used at INSERT time when the
 * extension's scrape returned `null`.
 *
 * Coverage gap context: ~16% of `user_pledge_items` rows had NULL
 * kind because RSI's `.kind` element is absent on newer products
 * (recent armour sets like Monde Keystone, festival cosmetics, hangar
 * skus, etc.). The DATA was still scraped — only the classifier
 * label is missing — so any UI that filters by kind misses these.
 *
 * Design rule: precision over recall for canonical kinds. Anything
 * that doesn't match a specific rule lands in "Other" — never NULL —
 * so the Hangar UI's filter chips always cover 100% of items.
 *
 * Returns one of the canonical `kind` values that already appear in
 * the production distribution (e.g., "FPS Equipment", "Hangar
 * decoration", "Skin", "Other") so this stays consistent with rows
 * that DO get RSI's scraped value.
 *
 * Rule order matters: decorative items run first so "Helmet Statue"
 * lands as decoration, not armour. Within FPS Equipment we don't
 * need fine-grained sub-typing — RSI uses one bucket and we match.
 *
 * Returns null only when the title itself is missing — there's
 * nothing to classify in that case, and the row stays NULL so the
 * data-quality issue stays visible.
 */
export function inferKind(title: string | null | undefined): string | null {
  if (!title || typeof title !== "string") return null;

  // ── Hangar decoration ───────────────────────────────────────────
  // Hangar SKUs ("VFG Hangar", "Self-Land Hangar"), display models
  // (Takuetsu toy line, "Origin X1 Model"), posters, wallpaper,
  // squadron badges, themed bedroom items, decorative containers.
  if (
    /\b(?:Hangar|Plushie|Statue|Trophy|Centerpiece|Centrepiece)\b/i.test(title) ||
    /\b(?:Poster|Wallpaper|Display|Artifact|Fishtank|Prop)\b/i.test(title) ||
    /\bModel\b/i.test(title) ||
    /\b(?:Coin|Skull)\b/i.test(title) ||
    /\bSq\.\s*(?:Badge|\.+)/i.test(title) ||
    /\bSquadron Badge\b/i.test(title) ||
    /\bStorage Chest\b/i.test(title) ||
    /\bThemed\s+\w+\s*(?:Bed|Chair)\b/i.test(title) ||
    /\bCargo Chair\b/i.test(title) ||
    /\bFish School\b/i.test(title) ||
    /\bSpace Plant\b/i.test(title) ||
    /^Takuetsu\b/i.test(title) ||
    /^H-DECO\b/i.test(title)
  ) {
    return "Hangar decoration";
  }

  // ── Skin (paints) ──────────────────────────────────────────────
  // "Caterpillar - IceBreak Paint", "Mustang - IceBreak Paint".
  // Word boundary so "Painting" doesn't match.
  if (/\bPaint\b/i.test(title)) {
    return "Skin";
  }

  // ── FPS Equipment — armour pieces ──────────────────────────────
  // Original tokens (Helmet/Backpack/Undersuit/Boots/Armor Set/
  // Keystone) plus the triplet pattern (X Arms/Core/Legs) which
  // covers Strata, Chiron, Wrecker Payback, ORC-mkX, Geist, etc.
  if (
    /\b(?:Helmet|Backpack|Undersuit|Boots|Boot)\b/i.test(title) ||
    /\b(?:Armor|Armour)\s+Set\b/i.test(title) ||
    /\bKeystone\b/i.test(title) ||
    /\b(?:Armor|Armour)\s+(?:Arms|Core|Legs)\b/i.test(title) ||
    /\b(?:Arm|Leg)\s+Armor\b/i.test(title) ||
    /\b(?:Combat|Tactical)\s+(?:Armor|Armour)\b/i.test(title) ||
    /\b(?:Arms|Legs|Core)\b/.test(title) // case-sensitive on capitalised tokens to avoid "lawcore" etc.
  ) {
    return "FPS Equipment";
  }

  // ── FPS Equipment — suits + clothing ───────────────────────────
  if (
    /\b(?:Jumpsuit|Flight Suit|Flightsuit|Hazard Suit)\b/i.test(title) ||
    /\bSuit\b/i.test(title) ||
    /\b(?:Hat|Top Hat|Monocle)\b/i.test(title) ||
    /\b(?:T-Shirt|Tshirt|Tee)\b/i.test(title) ||
    /\b(?:Shirt|Pants|Jacket|Gloves|Coat|Hood|Mask|Vest|Sweater|Hoodie|Outfit)\b/i.test(title) ||
    /\b(?:MobiGlas|Mobiglas)\b/i.test(title) ||
    /\bHead\s*Gear\b/i.test(title)
  ) {
    return "FPS Equipment";
  }

  // ── FPS Equipment — handheld weapons + attachments ─────────────
  // RSI normally labels these but newer/event SKUs slip through.
  if (
    /\b(?:Rifle|SMG|Pistol|Repeater|Shotgun|Sniper|Carbine|Launcher|Gatling)\b/i.test(title) ||
    /\bCannon\b/i.test(title) ||
    /\bAttachment\b/i.test(title) ||
    /\bWeapon\b/i.test(title)
  ) {
    return "FPS Equipment";
  }

  // Catch-all: title exists but doesn't match any canonical bucket.
  // Items like CCU upgrade tokens, digital downloads, ship name
  // reservations, schematics, "Sneak-Peek", "Legacy Alpha" land here.
  return "Other";
}
