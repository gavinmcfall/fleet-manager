# Browser Extension Analysis

## Summary

Both extensions scrape robertsspaceindustries.com hangar data, but with very different approaches.

---

## FleetYards-Sync (Simple Proxy)

### Architecture
- **Content Script** (runs on fleetyards.net): Message relay
- **Background Script**: Does the actual scraping

### How It Works
1. FleetYards website sends commands via `postMessage` to the content script
2. Content script forwards to background script
3. Background script:
   - Extracts `Rsi-Token` cookie from RSI
   - Fetches `/account/pledges?page={N}` HTML with auth headers
   - Returns raw HTML to FleetYards website
4. FleetYards.net parses the HTML server-side

### Data Access
- Returns **raw HTML** from RSI pledges page
- Controlled entirely by FleetYards website
- Extension is just a **proxy for cookie access**

### Potential for Fleet Manager
**Could we intercept this?** Yes, but:
- Would need to run FleetYards locally or reverse-engineer their parsing
- They control the sync flow from their website
- Better to just use their public API (which we already do)

---

## HangarXplor (Rich DOM Parser)

### Architecture
- **Content Script** (runs on RSI pledges page): Parses DOM directly
- Has `ship-codes.json` with 500+ ship mappings
- Multiple specialized parsers (ParseShip, ParsePledge, ParseUpgrade, etc.)

### How It Works
1. Loads when you visit `robertsspaceindustries.com/account/pledges`
2. Scrapes the page DOM using jQuery selectors
3. Extracts:
   - Ship name (cleaned of "LTI", "Warbond" suffixes)
   - Custom nicknames
   - Pledge ID, name, cost, date
   - Insurance status (detects "Lifetime Insurance" text)
   - Warbond detection (name contains "warbond"/"wb")
   - Manufacturer codes
4. Maps ship names to `ship_code` using `ship-codes.json`
5. Exports to JSON or CSV

### JSON Export Format
```json
[
  {
    "ship_code": "MISC_Hull_D",
    "ship_name": "Hull D",
    "manufacturer_code": "MISC",
    "manufacturer_name": "Musashi Industrial & Starflight Concern",
    "lti": true,
    "warbond": false,
    "pledge_id": "12345",
    "pledge_name": "Standalone Ship - Hull D",
    "pledge_cost": "$350.00 USD",
    "pledge_date": "2020-01-15"
  }
]
```

### Ship Matching Logic
1. Strips manufacturer prefix from ship name
2. Looks up in `_shipMatrix` (loaded from somewhere, not in code)
3. Falls back to `ship-codes.json` by lowercase name match
4. Generates `ship_code` if unmatched: `{manufacturer}_{ship_name}`

### Potential for Fleet Manager

**Option 1: Use their ship-codes.json**
- We could import their mappings to improve our slug matching
- Would reduce "ship not found" errors

**Option 2: Build our own scraper extension**
- Copy their DOM selectors
- Parse RSI pledges page ourselves
- Auto-POST to our Fleet Manager API
- **Advantage:** No manual JSON export/import

**Option 3: Companion extension**
- Detect when HangarXplor exports JSON
- Auto-upload to Fleet Manager
- Minimal code, leverages their work

---

## Key Files in HangarXplor

| File | Purpose |
|------|---------|
| `web_resources/ship-codes.json` | 500+ ship mappings (ship_code → name/manufacturer) |
| `web_resources/HangarXPLOR.ParseShip.js` | Ship parsing, LTI detection, nickname extraction |
| `web_resources/HangarXPLOR.ParsePledge.js` | Pledge parsing, warbond detection, cost extraction |
| `web_resources/HangarXPLOR.Download.js` | JSON/CSV export logic |

---

## Recommendations

### Short Term (Low Effort)
1. **Import ship-codes.json** into Fleet Manager
   - Use as fallback for slug matching
   - Reduces "ship not found" errors
   - Ships already extracted to: `/tmp/extension-analysis/hangarxplor/web_resources/ship-codes.json`

### Medium Term (Moderate Effort)
2. **Build a companion extension** that:
   - Listens for HangarXplor JSON downloads
   - Shows a notification: "Upload to Fleet Manager?"
   - POSTs to `http://localhost:8080/api/import/hangarxplor` (or prod URL)
   - **Benefit:** User still uses HangarXplor UI, but no manual import

### Long Term (Higher Effort)
3. **Build our own scraper extension**
   - Copy HangarXplor's selectors
   - Add "Sync to Fleet Manager" button on RSI pledges page
   - Auto-sync on page load (if user enables it)
   - **Benefit:** Full control, can add Fleet Manager-specific features

---

## Security Note

Both extensions are legitimate tools:
- FleetYards-Sync: Proxy for FleetYards.net (open source project)
- HangarXplor: Popular RSI hangar enhancement tool (GitHub: dolkensp/HangarXPLOR)

No malicious behavior detected. Both only access robertsspaceindustries.com with user's existing session cookies.
