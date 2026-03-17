/**
 * RSI Org page scraper — extracts structured data from the public org page.
 *
 * Used by the verify-then-create flow and the sync-from-RSI feature.
 * Scrapes: name, logo, banner, member count, model/commitment/roleplay,
 * primary/secondary focus, and the history/manifesto/charter tab content.
 *
 * SECURITY: All scraped HTML content is sanitized before storage to prevent
 * stored XSS when rendered via dangerouslySetInnerHTML on the frontend.
 * CSP blocks inline scripts but NOT inline styles or <meta> redirects.
 */

const RSI_BASE = "https://robertsspaceindustries.com";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface RsiOrgData {
  name: string;
  sid: string;
  logo: string | null;
  bannerUrl: string | null;
  memberCount: number | null;
  model: string | null;
  commitment: string | null;
  roleplay: string | null;
  primaryFocus: string | null;
  secondaryFocus: string | null;
  historyHtml: string | null;
  manifestoHtml: string | null;
  charterHtml: string | null;
  /** Raw full-page HTML — used for verification key search (not stored in DB). */
  rawHtml: string;
}

/**
 * Fetch and parse an RSI org page by SID.
 * Throws on network errors or if the org page can't be found.
 */
export async function scrapeRsiOrg(sid: string): Promise<RsiOrgData> {
  const url = `${RSI_BASE}/en/orgs/${encodeURIComponent(sid)}`;
  const resp = await fetch(url, { headers: FETCH_HEADERS });

  if (!resp.ok) {
    throw new Error(`RSI returned ${resp.status} for org ${sid}`);
  }

  const html = await resp.text();

  // Check for 404-style content
  if (html.includes('class="page-not-found"') || html.includes("404 - Page not found")) {
    throw new Error(`Org not found on RSI: ${sid}`);
  }

  return parseOrgHtml(html, sid);
}

function parseOrgHtml(html: string, sid: string): RsiOrgData {
  // Name: <h1>OrgName / <span class="symbol">SID</span></h1>
  const nameMatch = html.match(/<h1>(.+?)\s*\/\s*<span class="symbol">/s);
  // Strip HTML tags from name as defense-in-depth
  const name = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, "").trim() : sid;

  // Logo: class="logo noshadow"><img src="...">
  let logo: string | null = null;
  const logoMatch = html.match(/class="logo\s+noshadow"[^>]*>\s*<img[^>]+src="([^"]+)"/);
  if (logoMatch) {
    logo = resolveUrl(logoMatch[1]);
  }

  // Banner: class="banner"><img src="...">
  let bannerUrl: string | null = null;
  const bannerMatch = html.match(/class="banner"[^>]*>\s*<img[^>]+src="([^"]+)"/);
  if (bannerMatch) {
    bannerUrl = resolveUrl(bannerMatch[1]);
  }

  // Member count: class="count">N members
  let memberCount: number | null = null;
  const countMatch = html.match(/class="count"[^>]*>(\d+)\s+members?/i);
  if (countMatch) {
    memberCount = parseInt(countMatch[1], 10);
  }

  // Model/Commitment/Roleplay: <span class="value">...</span> near their labels
  const model = extractLabelledValue(html, "model");
  const commitment = extractLabelledValue(html, "commitment");
  const roleplay = extractLabelledValue(html, "roleplay");

  // Focus: class="primary tooltip-wrap" ... alt="Focus Name"
  // and class="secondary tooltip-wrap" ... alt="Focus Name"
  let primaryFocus: string | null = null;
  const primaryMatch = html.match(/class="primary\s+tooltip-wrap"[\s\S]{0,300}?alt="([^"]+)"/);
  if (primaryMatch) primaryFocus = primaryMatch[1];

  let secondaryFocus: string | null = null;
  const secondaryMatch = html.match(/class="secondary\s+tooltip-wrap"[\s\S]{0,300}?alt="([^"]+)"/);
  if (secondaryMatch) secondaryFocus = secondaryMatch[1];

  // Tab content: history, manifesto, charter — sanitized to prevent stored XSS
  const historyHtml = sanitizeTabContent(html, "history");
  const manifestoHtml = sanitizeTabContent(html, "manifesto");
  const charterHtml = sanitizeTabContent(html, "charter");

  return {
    name,
    sid: sid.toUpperCase(),
    logo,
    bannerUrl,
    memberCount,
    model,
    commitment,
    roleplay,
    primaryFocus,
    secondaryFocus,
    historyHtml,
    manifestoHtml,
    charterHtml,
    rawHtml: html,
  };
}

function extractLabelledValue(html: string, className: string): string | null {
  // Pattern: class="model" or similar, then the value text
  const pattern = new RegExp(`class="${className}"[^>]*>([^<]+)<`, "i");
  const match = html.match(pattern);
  if (match) {
    const val = match[1].trim();
    return val || null;
  }
  return null;
}

function extractTabContent(html: string, tabName: string): string | null {
  // Find the tab section start
  const tabIdx = html.indexOf(`id="tab-${tabName}"`);
  if (tabIdx === -1) return null;

  // Find the markitup-text div within this tab (search a reasonable window)
  const window = html.slice(tabIdx, tabIdx + 50000);
  const markitupIdx = window.indexOf('class="markitup-text">');
  if (markitupIdx === -1) return null;

  const contentStart = markitupIdx + 'class="markitup-text">'.length;

  // Find the closing </div> by tracking nesting depth.
  // The markitup-text div's content may contain nested <div> tags.
  let depth = 1;
  let pos = contentStart;
  while (pos < window.length && depth > 0) {
    const nextOpen = window.indexOf("<div", pos);
    const nextClose = window.indexOf("</div>", pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        const content = window.slice(contentStart, nextClose).trim();
        return content || null;
      }
      pos = nextClose + 6;
    }
  }

  // Fallback: grab everything from content start to first </div> (old behavior)
  const fallbackEnd = window.indexOf("</div>", contentStart);
  if (fallbackEnd !== -1) {
    const content = window.slice(contentStart, fallbackEnd).trim();
    return content || null;
  }

  return null;
}

/** Extract and sanitize tab content in one step. */
function sanitizeTabContent(html: string, tabName: string): string | null {
  const raw = extractTabContent(html, tabName);
  return raw ? sanitizeHtml(raw) : null;
}

function resolveUrl(url: string): string {
  if (url.startsWith("/")) return `${RSI_BASE}${url}`;
  return url;
}

/**
 * Sanitize HTML content from RSI — allowlist of safe tags only.
 * Prevents stored XSS via scraped charter/history/manifesto content.
 *
 * Strips: script, style, meta, iframe, form, input, button, object, embed,
 * link, base, svg, math, and all event handler attributes (on*).
 * Allows: p, br, strong, em, b, i, u, a, ul, ol, li, h1-h6, blockquote,
 * div, span, table, tr, td, th, thead, tbody, img, hr.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;

  // Remove dangerous tags entirely (tag + content for script/style/svg/math)
  let clean = html;
  for (const tag of ["script", "style", "svg", "math"]) {
    clean = clean.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
  }

  // Remove self-closing and open-only dangerous tags
  const DANGEROUS_TAGS = [
    "script", "style", "meta", "iframe", "frame", "frameset",
    "form", "input", "button", "select", "textarea",
    "object", "embed", "applet", "link", "base",
    "svg", "math", "template", "slot",
  ];
  const tagPattern = new RegExp(
    `<\\/?(${DANGEROUS_TAGS.join("|")})[^>]*>`,
    "gi",
  );
  clean = clean.replace(tagPattern, "");

  // Remove all event handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Remove style attributes (prevents CSS injection via inline styles)
  clean = clean.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Remove javascript: and data: in href/src attributes
  clean = clean.replace(
    /\s+(href|src)\s*=\s*(?:"(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*')/gi,
    "",
  );

  return clean;
}
