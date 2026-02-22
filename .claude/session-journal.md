# Session Journal

This file maintains running context across compactions.

## Current Focus

**Font preference settings + code review fixes — all implemented, build verified, ready for deploy.**

## Recent Changes

- **Font preferences:** User-selectable body/display fonts (Default, Lexend, Atkinson Hyperlegible, OpenDyslexic) via Settings page. CSS custom properties (`--font-body`, `--font-display`) swapped at runtime, persisted in localStorage via `useFontPreference` hook.
- **Code review fixes (all 8 findings + 5 minor notes):**
  - Removed unused `FONT_PRESETS` import/export
  - Self-hosted OpenDyslexic via `@fontsource/opendyslexic` npm package (replaced unreliable CDN)
  - Synced root `tailwind.config.js` color tokens to match frontend palette
  - Fixed `col-span-2` overflow on single-column mobile grids
  - FleetTable selection now tracks by stable `id`/`vehicle_id` instead of array index
  - Removed unused `panel-angular` CSS and variant prop
  - Added arrow key (Up/Down) navigation on FleetTable rows + `role="row"` + `aria-selected`
  - Removed Figma capture script from production HTML
  - Fixed Dashboard JSX whitespace, reordered chart colors for hue differentiation

## Production

- **URL:** `fleet.nerdz.cloud` (behind Zero Trust)
- **Worker:** `sc-companion` on NERDZ account
- **D1:** `sc-companion` (26 tables, Oceania region)
- **Branch:** `main`
- **CI/CD:** Push to main → GitHub Actions → `wrangler deploy`

## Key Decisions

- Font system uses CSS custom properties so Tailwind classes (`font-body`, `font-display`) work unchanged — only `:root` vars get swapped
- OpenDyslexic self-hosted via `@fontsource/opendyslexic` instead of `fonts.cdnfonts.com` CDN (SIL license, no external dependency)
- FleetTable selection by ID not index — stable across sort/filter changes
- Chart colors reordered to alternate hues (cyan→violet→amber→teal→pink→blue) for better data distinguishability

## What's Next

- **Deploy** to production via git push

---
**Session compacted at:** 2026-02-22 15:12:41


---
**Session compacted at:** 2026-02-22 17:46:51

