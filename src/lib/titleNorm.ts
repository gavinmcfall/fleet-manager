/**
 * Canonical-form normalisation for pledge / paint / item titles.
 *
 * RSI's pledge data has known quirks that make naïve string equality
 * unreliable when matching capture titles to reference rows:
 *   - Stray whitespace ("Apollo -  Alliance Aid Red & Gold Paint")
 *   - Unicode dash variants (em-dash, en-dash, minus sign vs hyphen)
 *   - Mixed case
 *   - "Paint" / "Skin" / "Livery" naming inconsistency between
 *     pledge items and the paints reference table
 *
 * `normaliseTitle()` produces a stable, idempotent canonical form so
 * `image_captures.title_norm = paints.title_norm` is a clean JOIN
 * without per-query REPLACE chains.
 *
 * Deliberately NOT done — keep these as legitimate distinguishers:
 *   - Stripping all whitespace ("Aurora MkI" vs "Aurora Mk I")
 *   - Stripping non-alphanumerics ("Red & Gold" vs "Red Gold")
 *   - Removing manufacturer prefixes
 *
 * The function is pure — useful from any insert / upsert site as well
 * as from migrations that need to backfill existing rows.
 */
export function normaliseTitle(input: string | null | undefined): string {
  if (typeof input !== "string") return "";
  return input
    // Case fold
    .toLowerCase()
    // Unicode dash family → ASCII hyphen.
    // Covers HYPHEN-MINUS (-), HYPHEN (‐), NON-BREAKING HYPHEN
    // (‑), FIGURE DASH (‒), EN DASH (–), EM DASH
    // (—), HORIZONTAL BAR (―), MINUS SIGN (−).
    .replace(/[‐-―−]/g, "-")
    // Drop dashes used as word separators ("Apollo - Alliance" →
    // "Apollo Alliance"). We don't strip dashes inside words like
    // "Aeroview-Hangar" — only when they're flanked by spaces.
    .replace(/\s*-\s*/g, " ")
    // Collapse all whitespace runs (tabs / newlines / multi-space)
    // to a single space.
    .replace(/\s+/g, " ")
    // Trim before the Paint/Skin rewrite so trailing whitespace
    // doesn't disrupt the suffix match.
    .trim()
    // Suffix rewrite: "X Paint" / "X Skin" → "X Livery".
    // \b ensures we only match the standalone word.
    .replace(/\b(?:paint|skin)$/g, "livery");
}
