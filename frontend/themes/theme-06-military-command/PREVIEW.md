# Theme 06: Military Command

Battleship bridge console. The kind of display a Bengal carrier XO stares at during fleet operations. Dark greens and ambers on near-black, angular thick borders, grid-heavy. Aggressive, utilitarian, built to survive a hull breach.

## Inspiration
Military command interfaces, CIC (Combat Information Center) displays, Star Citizen Bengal/Javelin bridge aesthetic.

## Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `sc-dark` | `#050807` | Main background (near-black green) |
| `sc-darker` | `#020403` | Deepest background |
| `sc-panel` | `#0a120a` | Panel backgrounds (OD green) |
| `sc-border` | `#1a2e1a` | Border color (dark military green) |
| `sc-accent` | `#4ade80` | Primary accent (military green) |
| `sc-accent2` | `#d4a017` | Secondary accent (amber/gold) |
| `sc-warn` | `#d4a017` | Warning (military amber) |
| `sc-danger` | `#dc2626` | Danger (deep red) |
| `sc-success` | `#22c55e` | Success (green) |
| `sc-lti` | `#86efac` | LTI badge (light green) |
| `sc-melt` | `#f59e0b` | Melt value (amber) |

## Fonts

| Role | Font | Fallback |
|------|------|----------|
| Display | Teko | Rajdhani |
| Body | Rajdhani | Inter |
| Mono | Source Code Pro | JetBrains Mono |

## Special Effects
- **2px borders everywhere:** Thick border-2 on panels, badges, buttons, table cells
- **Zero border-radius:** Completely angular, no rounded corners
- **Green phosphor glow:** text-shadow and box-shadow with green tint on accent elements
- **Wide letter-spacing:** 0.25em tracking on panel headers for stencil-weight feel
- **Bold everything:** Font-bold on labels, badges, table headers for aggressive readability
- **Thicker glow-line:** h-0.5 (2px) instead of h-px for visible dividers
