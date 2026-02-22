# Theme 10: Retro CRT Terminal

Phosphor green CRT monitor. The kind of terminal a Crusader Industries intern used in 2947 before they upgraded to quantum-core displays. Green-on-black, scanlines, text glow, monospace everything. Pure nostalgia.

## Inspiration
Classic CRT terminal displays, old-school green phosphor monitors, retro sci-fi computer interfaces.

## Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `sc-dark` | `#000000` | Main background (pure black) |
| `sc-darker` | `#000000` | Deepest background (pure black) |
| `sc-panel` | `#0a1a0a` | Panel backgrounds (faint green) |
| `sc-border` | `#1a3a1a` | Border color (dark green) |
| `sc-accent` | `#33ff33` | Primary accent (phosphor green) |
| `sc-accent2` | `#22cc22` | Secondary accent (dim green) |
| `sc-warn` | `#cccc00` | Warning (yellow-green) |
| `sc-danger` | `#ff3333` | Danger (red, CRT red) |
| `sc-success` | `#33ff33` | Success (same as accent) |
| `sc-lti` | `#66ff66` | LTI badge (bright green) |
| `sc-melt` | `#ffaa00` | Melt value (amber) |

## Fonts

| Role | Font | Fallback |
|------|------|----------|
| Display | VT323 | monospace |
| Body | VT323 | Fira Code |
| Mono | VT323 | Fira Code |

## Special Effects
- **CRT scanlines:** `body::after` with tight 2px repeating gradient for visible scan-line effect
- **Screen curve:** `body::before` with deep inset box-shadow simulating CRT screen curvature
- **Phosphor glow:** Aggressive text-shadow on all accent text (green double-glow: close + distant)
- **CRT flicker:** Subtle opacity animation on stat-values — very occasional micro-flicker
- **All monospace:** VT323 (pixel font) used for display, body, AND mono — uniform CRT feel
- **Larger text:** Slightly larger base sizes (text-lg buttons, text-3xl stat values) to match VT323's pixel grid
- **No border-radius:** Zero rounded corners
