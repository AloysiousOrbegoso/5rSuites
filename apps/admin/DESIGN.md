# DESIGN.md — 5R Suites Admin

Design system for `apps/admin` only. The public site has its own look. Format follows
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Agents building or
changing admin UI must read this first and use the tokens in `src/admin.css`, never raw hex.

## 1. Visual Theme & Atmosphere

**"Quiet luxury, working tool."** A hospitality brand's back office: calm, spacious, confident.
Mostly white (light) or near-black (dark), with **navy** for action, **black** for emphasis and
structure, and **gold** used sparingly as the jewel: one small spark per view, never a fill.

- Light mode is the default feel: white surfaces, hairline borders, soft shadows.
- Dark mode is a first-class theme, not an inversion: layered near-black surfaces, lifted
  blue for action, softened status colors. Follows the OS by default; the topbar toggle overrides
  and persists it (`localStorage: admin-theme`, applied pre-paint in `index.html`).
- One dark "moment" per screen at most (the Dashboard hero). Everything else stays quiet.
- Density: comfortable. Generous padding, short lines, clear grouping. Never cramped.

## 2. Color Palette & Roles

Components use semantic tokens only. Brand constants: `--navy #183b5f`, `--ink #0b0f14`,
`--gold #d4c284`.

| Role | Token | Light | Dark |
|---|---|---|---|
| Page background | `--bg` | `#f6f7f9` | `#090b0e` |
| Panel / card | `--panel` | `#ffffff` | `#101318` |
| Inset / hover surface | `--surface-2`, `--surface-3` | `#f9fafb`, `#f1f3f6` | `#151920`, `#1c212a` |
| Primary text | `--text` | `#0b0f14` | `#eef1f5` |
| Secondary / muted / faint | `--text-soft`, `--muted`, `--faint` | `#3f4854`, `#667085`, `#98a2b3` | `#b6bfcb`, `#8b95a5`, `#626c7b` |
| Hairline / strong line | `--line`, `--line-strong` | `#e6e8ec`, `#d0d5dd` | `#1f242d`, `#2d3541` |
| Primary action | `--primary` / `--on-primary` | navy / white | `#7fb0ea` / `#08111c` |
| Active nav | `--nav-active-bg` | ink `#0b0f14` | `#1c212a` |
| Accent (sparingly) | `--gold`, `--gold-soft`, `--gold-text` | `#d4c284` family | same hue, text lifted `#e3d49c` |
| Success / warning / danger | `--ok-*`, `--warn-*`, `--danger*` | classic pastel bg + dark text | translucent bg + lightened text |

Rules:
- **Navy = do something** (primary buttons, links, focus). **Black = where you are** (active nav,
  avatar, hero, headings). **Gold = notice this** (active-nav marker, attention ring, eyebrow dot).
- Never put gold text on white at small sizes; use `--gold-text`.
- Status is never color alone: pair with a word or icon.
- Data viz uses one hue (`--viz`), lifted in dark mode.

## 3. Typography Rules

- **Inter** (400/500/600/700), system fallback. Base 14px / 1.5.
- Page title `h1` 1.75rem / 700 / -0.025em. Hero title up to 2.15rem.
- Panel title `h2` 1.05rem / 700 / -0.01em.
- Big numbers: 2.1rem / 700 / -0.03em, `font-variant-numeric: tabular-nums`.
- Eyebrows and nav group labels: 0.68–0.74rem / 600 / uppercase / 0.1em tracking.
- Metadata: 0.78–0.82rem in `--muted`. Never go below 0.75rem.

## 4. Component Stylings

- **Sidebar**: white (dark: panel) with hairline border. Logo on a black rounded tile. Active item
  is a solid ink pill with a gold icon and a gold edge marker. Footer is a bordered user card.
- **Topbar**: 60px, translucent glass blur, breadcrumb left; theme toggle, "View site", avatar right.
- **Cards / panels**: `--panel`, 1px `--line`, radius 12–14px, `--shadow-sm`. Interactive cards lift
  3px with `--shadow-md` on hover.
- **Buttons**: radius 8px, 600 weight. Primary = `--primary`. Secondary = panel + `--line-strong`.
  Ghost = text only. Gold button is reserved for the single hero call to action.
- **Stat cards**: icon chip, label, big count-up number, note. Hover inverts the chip to ink/gold and
  reveals an arrow. A card needing attention gets a 1px gold ring.
- **Forms**: 8px radius, `--line-strong` border, focus = primary border + `--ring` glow.
- **Tables**: rounded container, uppercase 0.74rem header on `--surface-2`, row hover tint.
- **Badges**: pill; ok / warn / accent variants from status tokens.
- **Activity feed**: avatar-style icon nodes on a thin vertical rail; gold node = submission.
- **Modals / toasts**: panel surface + `--shadow-lg`; toast is inverted (ink on light, light on dark).

## 5. Layout Principles

- Shell: 252px sidebar + fluid workspace; content max-width 1240px; page padding 2–2.25rem.
- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32. Section gaps 1.25–1.5rem.
- Page pattern: **hero or title row → stat strip → two-column content (≈1.55fr / 1fr)**.
- Lead with what needs attention (unread, errors), then overview, then history.
- Two-column grids collapse to one at 960px; the sidebar becomes a drawer at 900px.

## 6. Depth & Elevation

Three levels, no more: **flat** (page) → **panel** (`--shadow-sm`, hairline border) → **raised**
(`--shadow-md`, hover/popover) → **overlay** (`--shadow-lg`, modal/drawer). In dark mode depth comes
from lighter surfaces plus a hairline border, with shadow only as reinforcement.

## 7. Do's and Don'ts

Do
- Use tokens; verify every new screen in both themes.
- Keep gold to one or two small touches per view.
- Give every interactive element hover, focus-visible and disabled states.
- Show skeletons for loading and a friendly line for empty states.

Don't
- Don't hardcode hex in components or inline styles.
- Don't use navy as a large background (that was the old look); ink and white carry the layout.
- Don't animate layout properties or loop anything except the single live-dot pulse and skeletons.
- Don't use color alone to convey status.

## 8. Responsive Behavior

- ≥1240px: full layout. ≤960px: stacked columns, stats wrap by `minmax(210px, 1fr)`.
- ≤900px: sidebar becomes an off-canvas drawer (menu button, scrim); topbar "View site" hides.
- Touch targets ≥36px. Tables scroll horizontally inside their container below 760px.

## 9. Motion

- Easing: `--ease: cubic-bezier(0.22, 1, 0.36, 1)`. Durations: 150ms color, 250ms transform, 550ms entrance.
- Entrance: `.rise` fades up 10px with a 70ms stagger (`--i`). Numbers count up over 900ms.
- Hover: cards lift, icons scale/rotate slightly, arrows slide in.
- `prefers-reduced-motion: reduce` disables all of it (global rule plus the count-up skips to its value).

## 10. Agent Prompt Guide

- "Build X in the admin" → read this file, reuse classes in `src/admin.css` (`.panel`, `.stat`,
  `.btn`, `.badge`, `.table`, `.rise`), and add tokens rather than literals.
- Quick palette: white/near-black surfaces, navy (`--primary`) for actions, ink for emphasis,
  gold for one accent.
- Check list before finishing: both themes, keyboard focus, 390px width, reduced motion, no raw hex.
- Prompt seed: *"Refined hospitality back-office: calm white surfaces, navy actions, black structure,
  one gold accent, subtle rise-in motion, full dark mode."*
