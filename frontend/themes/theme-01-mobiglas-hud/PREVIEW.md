# Theme 01: Mobiglas HUD

Star Citizen's in-game mobiglas personal device UI. Thin angular borders, scan-line overlay, cyan-on-dark, monospace-heavy. Feels like a ship terminal or heads-up display projected onto glass.

## Inspiration
The mobiglas interface in Star Citizen — personal device UI, ship MFDs, and quantum travel overlay.

## Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `sc-dark` | `#040a0f` | Main background |
| `sc-darker` | `#020608` | Deepest background |
| `sc-panel` | `#081418` | Panel backgrounds |
| `sc-border` | `#0e3a40` | Border color (dark teal) |
| `sc-accent` | `#00e5ff` | Primary accent (cyan) |
| `sc-accent2` | `#00b8d4` | Secondary accent (darker cyan) |
| `sc-warn` | `#ffab00` | Warning (amber) |
| `sc-danger` | `#ff1744` | Danger (red) |
| `sc-success` | `#00e676` | Success (green) |
| `sc-lti` | `#18ffff` | LTI badge (bright cyan) |
| `sc-melt` | `#ff6d00` | Melt value (orange) |

## Fonts

| Role | Font | Fallback |
|------|------|----------|
| Display | Orbitron | Share Tech Mono |
| Body | Share Tech Mono | Rajdhani |
| Mono | Share Tech Mono | JetBrains Mono |

## Special Effects
- **Scan-line overlay:** CSS `::after` pseudo-element on body with repeating-linear-gradient and slow vertical scroll animation
- **Text glow:** `text-shadow` with cyan glow on accent text, stat values, and badges
- **Angular clip-path:** Panel headers use `clip-path: polygon()` for angled top-right corner
- **Box glow:** Subtle cyan box-shadow on panels and primary buttons
- **No border-radius:** Sharp 2px corners throughout
