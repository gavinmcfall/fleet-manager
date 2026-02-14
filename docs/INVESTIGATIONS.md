# Fleet Manager - Investigation Backlog

**Status**: Brain dump / No action planned
**Last Updated**: 2026-02-14 06:50 NZDT

These are investigation items for future consideration. No immediate action required.

---

## Infrastructure & Deployment

### Hybrid Hosting Model
- **Question**: Can we host on Cloudflare while maintaining self-host option?
  - Cloudflare Pages + Workers for hosted version
  - Same codebase, different deployment targets
  - Environment-based feature flags (multi-tenant vs single-user)
  - Shared SQLite for self-host, Cloudflare D1 for hosted?

### Database Strategy
- **Question**: What's actually the best DB for our workload?
  - Current: SQLite (self-host), PostgreSQL option
  - Workload: Mostly reads, periodic bulk writes (sync), JSON-heavy ship data
  - Evaluate: Relational (current) vs Document (MongoDB) vs Graph (Neo4j) vs Hybrid
  - Considerations: Ship relationships, fleet composition queries, user data isolation

### Cloudflare Database Solutions
- **Question**: Does Cloudflare offer appropriate DB solutions?
  - D1 (SQLite-compatible, serverless SQL)
  - Durable Objects (state + coordination)
  - KV (key-value, fast reads)
  - R2 (object storage for assets/backups)
  - Workers Analytics Engine (time-series data)
  - Evaluate: Performance, cost, multi-tenant support, data residency

---

## Authentication & Security

### SSO Integration
- **Providers to support**:
  - ✅ Google (OAuth2)
  - ✅ GitHub (OAuth2)
  - ✅ Facebook (OAuth2)
  - ✅ Discord (OAuth2)
  - ⚠️ Roberts Space Industries (RSI) - investigate if OAuth available
- **Implementation**: NextAuth.js, Lucia, or custom OAuth flow?

### Advanced Security
- **2FA**: TOTP (authenticator apps), SMS backup
- **Passkeys**: WebAuthn support (biometric, hardware keys)
- **Session management**: JWT vs server-side sessions
- **API security**: Rate limiting, API keys for programmatic access

---

## RSI Integration Deep Dive

### RSI Internal API Reverse Engineering
- **Hypothesis**: RSI website uses internal APIs we could access with session token
- **Investigation steps**:
  1. Capture network traffic on RSI website (DevTools)
  2. Identify API endpoints for hangar, organization, ship matrix
  3. Analyze authentication (session cookies, tokens)
  4. Test if session token can be reused outside browser
  5. Document API schema and rate limits
- **Potential endpoints**:
  - Hangar inventory (ships, items, credits)
  - Organization roster and ranks
  - Ship matrix data (specs, prices)
  - Account billing/pledge history
  - Spectrum posts and announcements

### RSI Data Monitoring
- **Ship price changes**: Track pledge store price fluctuations
- **New ship releases**: Detect when concept/flight-ready ships launch
- **Warbond tracking**: Monitor limited-time warbond offers
- **CCU availability**: Track which ships are CCU-able
- **Implementation options**:
  - RSS feeds (if RSI provides)
  - Polling RSI API/pages (respectful rate limiting)
  - Webhook subscriptions (if available)
  - Community data aggregation (PSU, FleetYards)

### Blue Post Tracker
- **Spectrum integration**: Monitor official CIG staff posts
- **Reddit/Discord scraping**: Track dev comments outside Spectrum
- **PSU integration**: Aggregate data from existing trackers
- **Notification system**: Alert users to relevant announcements

---

## LLM & AI Features

### Contextual Fleet Chat
- **Concept**: LLM chat interface with full DB access
- **Capabilities**:
  - Answer questions about user's fleet ("Do I have a medical ship?")
  - Compare ships ("Carrack vs 600i Explorer for solo play?")
  - Query ship database ("Show me all Drake ships under $200")
  - Analyze gameplay readiness ("Can I run cargo missions with my fleet?")
  - Historical analysis ("How has my fleet changed since January?")
- **Implementation**: RAG (Retrieval Augmented Generation) with vector DB?

### Advanced CCU Planning
- **Smart CCU chain generation**:
  - Calculate cheapest path from Ship A → Ship B
  - Factor in Warbond discounts, IAE/event sales
  - Loaner awareness ("This upgrade gets you X as loaner until ship is flyable")
  - Budget planning (staged upgrades over time)
- **Example**: "Want an Arrastra? Get it now for the Prospector + Mole loaners. Farm 31M aUEC in-game for a Reclaimer while you wait for Arrastra to be flight-ready."
- **Data sources**: Historical CCU pricing, current loaner matrix, in-game ship prices

### Loaner Ship Intelligence
- **Loaner matrix tracking**: Which ships get which loaners
- **Strategic recommendations**: Buy concept ships for valuable loaners
- **Flight-ready timeline predictions**: Estimate when loaners will be replaced

---

## Social & Org Features

### Organization Management
- **RSI org sync**:
  - Import org name, tag (SID), logo
  - Sync member roster and ranks
  - Affiliate org relationships
- **Fleet aggregation**:
  - Org fleet view (all members' ships combined)
  - Role coverage analysis at org level
  - Duplicate detection across members

### Privacy & Sharing Tiers
1. **Public**: Anyone with link can view
2. **Private**: Owner only
3. **Org Shared**: Members of user's primary org
4. **Alliance Shared**: Members of affiliated orgs
5. **Custom**: Specific users/orgs granted access

**Permissions matrix**:
| Visibility Level | Ship List | Owner Names | Pledge Costs | Insurance Status |
|------------------|-----------|-------------|--------------|------------------|
| Public | ✅ | ❌ | ❌ | ❌ |
| Private | ✅ | ✅ | ✅ | ✅ |
| Org Shared | ✅ | ✅ | ❌ | ✅ |
| Alliance Shared | ✅ | Org-level only | ❌ | ❌ |

### Alliance Fleet View
- **Multi-org aggregation**: Show combined fleet across alliance
- **Org contribution breakdown**: Which org provides which capabilities
- **Strategic planning**: Identify alliance-level gaps
- **Coordination**: "Which org should field X ship for this operation?"

---

## In-Game Integration

### Log File Parsing
- **Star Citizen log locations**:
  - `\Roberts Space Industries\StarCitizen\LIVE\Game.log`
  - `\Roberts Space Industries\StarCitizen\LIVE\logbackups\`
- **Potential data extraction**:
  - Session playtime
  - Ships spawned/destroyed
  - Locations visited
  - Credits earned/spent
  - Missions completed
  - Deaths/respawns
- **Privacy concerns**: Opt-in only, sanitize sensitive data
- **Upload methods**: Manual upload, auto-sync via desktop app, scheduled polling

### Real-Time Data Push
- **WebSocket connection**: Push log events as they happen
- **Fleet activity feed**: "User spawned Carrack at Port Olisar"
- **Org coordination**: Live view of who's online, what they're flying
- **Analytics**: Playtime per ship, most-used loadouts

---

## UI/UX Overhaul

### RSI Website Aesthetic
- **Design language**: Match RSI's futuristic, military-tech aesthetic
- **Color palette**: Blues, teals, dark grays (RSI brand colors)
- **Typography**: Orbitron/Michroma vibes (similar to RSI headings)
- **Components**:
  - Hexagonal panels (RSI loves hexagons)
  - Animated scan-lines and glitch effects
  - Holographic/glass-morphism cards
  - Ship silhouettes and technical schematics
- **Inspiration sources**: RSI Pledge Store, Ship Matrix, Spectrum

### FleetYards Comparison
- **What FleetYards does well**:
  - Comprehensive ship database
  - Hangar sync (FleetYards API)
  - Public hangar sharing
  - Wishlist tracking
- **How we could do it better**:
  - RSI visual aesthetic (vs FleetYards' simpler design)
  - AI-powered insights (CCU planning, fleet optimization)
  - Real-time RSI integration (if we crack the API)
  - Org/alliance fleet coordination
  - In-game log integration
  - Better mobile experience
- **Question**: Effort required to match feature parity + our enhancements?

---

## Open Questions

1. **Legal/ToS**: Does RSI allow third-party API access or scraping?
2. **Rate limiting**: How aggressive can we be with RSI endpoints without causing issues?
3. **Data ownership**: Who owns the fleet data - user, RSI, or us?
4. **Multi-tenancy**: Architecture changes needed for hosted version?
5. **Monetization**: If we host on Cloudflare, how do we cover costs? (ads, donations, premium features?)
6. **Community**: Should we open-source? Build a community around it?

---

## Prioritization (When We Get to It)

**High Impact, Lower Effort**:
- RSI API investigation (could unlock massive value)
- LLM chat with DB context (builds on existing AI work)
- Public/private hangar links (relatively simple, high value)

**High Impact, Higher Effort**:
- Org management + fleet aggregation
- SSO integration (multiple providers)
- UI overhaul to RSI aesthetic

**Medium Impact**:
- CCU chain planning
- In-game log parsing
- Blue post tracker

**Research Needed**:
- Database strategy evaluation
- Cloudflare vs self-host architecture
- FleetYards feature parity analysis

---

## Notes

- These are **investigative** items, not commitments
- Priorities may change based on user feedback
- Some items (RSI API) depend on external factors beyond our control
- Focus remains on core fleet management experience first

**User's original brain dump preserved for reference** ✓
