# Code Review: Star Citizen Fleet Manager (Cloudflare Workers Migration)

## Security Issues

### Substring Matching in CORS Origin Validation
- **Location**: `src/index.ts:22`
- **Severity**: High
- **Category**: Security
- **Issue**: The CORS middleware validates origins using `origin.includes(host)`. This allow-list check is vulnerable to substring bypass. An attacker could use an origin like `https://yourdomain.com.attacker.com` or `https://attacker-yourdomain.com`, both of which would satisfy the condition.
- **Impact**: Unauthorized cross-origin requests can be made to the API from malicious domains, potentially leading to CSRF or data exfiltration if other protections are missing.
- **Fix**:
```typescript
const originUrl = new URL(origin);
const allowed = originUrl.hostname === host || originUrl.hostname === "localhost" || originUrl.hostname.endsWith(".localhost");
```

### Timing-Unsafe Token Comparison
- **Location**: `src/index.ts:108`
- **Severity**: Medium
- **Category**: Security
- **Issue**: The `authMiddleware` uses the standard `!==` operator for comparing the provided API key with the configured `API_TOKEN`. This is vulnerable to timing attacks where an attacker can infer the token character by character based on response time.
- **Impact**: Potential leakage of the `API_TOKEN` through repeated, precisely timed requests.
- **Fix**:
```typescript
import { timingSafeEqual } from "node:crypto"; // Or use a Web Crypto alternative
// ...
const encoder = new TextEncoder();
const a = encoder.encode(provided);
const b = encoder.encode(token);
if (a.length !== b.length || !crypto.subtle.timingSafeEqual(a, b)) {
  return c.json({ error: "Unauthorized" }, 401);
}
```

### Plaintext API Key Storage Fallback
- **Location**: `src/routes/settings.ts:98` and `src/routes/analysis.ts:253`
- **Severity**: High
- **Category**: Security
- **Issue**: If `ENCRYPTION_KEY` is not configured, the application falls back to storing and retrieving LLM API keys in plaintext. While it prevents storage in "production" (when `API_TOKEN` is set), it allows plaintext storage in any other environment (e.g., staging or dev).
- **Impact**: Exposure of sensitive third-party API keys (Anthropic, OpenAI) if the database is compromised or accessed by unauthorized users.
- **Fix**: Mandatory encryption for sensitive keys. Fail hard if `ENCRYPTION_KEY` is missing, regardless of environment.

---

## Correctness Issues

### Broken Batch Atomicity in Import
- **Location**: `src/routes/import.ts:133-140`
- **Severity**: High
- **Category**: Correctness
- **Issue**: The HangarXplor import process chunks `INSERT` statements into multiple `db.batch()` calls if they exceed `BATCH_SIZE` (90). However, the `DELETE` statement is only included in the *first* batch. If a subsequent batch fails (e.g., D1 timeout, constraint violation), the old fleet is deleted but the new fleet is only partially imported.
- **Impact**: Data loss or corrupted user fleets. The "all-or-nothing" guarantee of a transaction is broken.
- **Fix**: Wrap the entire operation in a single `db.batch()` if possible, or use a "staging table" approach where data is inserted into a temporary table and then swapped/moved to the main table in a single atomic statement.

### Stale `last_row_id` on UPSERT
- **Location**: `src/db/queries.ts:46`, `src/db/queries.ts:119`, etc.
- **Severity**: Medium
- **Category**: Correctness
- **Issue**: In SQLite (and D1), `last_row_id` is only reliably updated when an actual `INSERT` occurs. If an `ON CONFLICT DO UPDATE` path is taken, `last_row_id` may return the ID of the last *actually inserted* row or remain unchanged. The code uses a manual `SELECT` fallback, but this is inefficient and technically prone to race conditions (though less likely in Workers).
- **Impact**: Potential to return incorrect IDs or 0, leading to broken foreign key relationships in downstream sync steps.
- **Fix**: Use `RETURNING id` in the UPSERT statement (supported by D1/SQLite 3.35+).
```sql
INSERT INTO manufacturers (...) VALUES (...) 
ON CONFLICT(uuid) DO UPDATE SET ... 
RETURNING id;
```

---

## Performance & Architecture

### N+1 Fetch in scunpacked Sync
- **Location**: `src/sync/scunpacked.ts:94`
- **Severity**: Medium
- **Category**: Performance
- **Issue**: The sync process fetches the file list from GitHub and then performs an individual `fetch` for *every* paint file (500+ files). This is slow and risks hitting GitHub rate limits (if token is missing) or Worker CPU limits.
- **Impact**: Extremely slow sync times and high probability of Worker termination due to CPU/Time limits.
- **Fix**: Use the GitHub "Data" API or fetch a single archive/combined JSON if available. At minimum, implement concurrency control and batching for the fetches.

### Full Fleet JSON Sent to LLM
- **Location**: `src/routes/analysis.ts:121`
- **Severity**: Low
- **Category**: Performance / Privacy
- **Issue**: `JSON.stringify(fleet, null, 2)` sends the entire fleet record to the LLM, including `pledge_cost`, `pledge_id`, `pledge_date`, and `custom_name`. This increases token usage and leaks financial/personal data to a third-party provider.
- **Impact**: Increased latency/cost and unnecessary data exposure.
- **Fix**: Map the fleet to a minimal representation (ship name, focus, size, insurance status) before sending to the LLM.

---

## Maintainability

### Hardcoded Sync Source IDs
- **Location**: `src/sync/scunpacked.ts:182` and `src/sync/rsi.ts:25`
- **Severity**: Low
- **Category**: Maintainability
- **Issue**: Magic numbers like `4` and `5` are used for `SYNC_SOURCE_SCUNPACKED` and `SYNC_SOURCE_RSI` instead of using the keys defined in the `sync_sources` table or a TypeScript enum.
- **Impact**: Risk of ID mismatch if the seed data changes or new sources are added.
- **Fix**: Use an Enum or look up the ID by the `key` string.

---

## VERDICT: NEEDS_WORK

## SUMMARY
The migration from Go to Cloudflare Workers is structurally sound but introduces critical security vulnerabilities in CORS and authentication. The import process lacks transactional integrity due to improper batching, and the sync logic is highly inefficient, risking Worker resource exhaustion.

## CONFIDENCE: 0.95
