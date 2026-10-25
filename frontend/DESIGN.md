---
name: Ofix
description: Calm neutral SaaS operations panel for mechanic-shop management, one accent reserved for action and real state.
colors:
  ofix-yellow: "#ffbe00"
  ofix-graphite: "#0f171f"
  ofix-gray: "#27323d"
  ofix-offwhite: "#f4f6f8"
  yellow-ink: "#7a5800"
  state-success: "#16a34a"
  state-warning: "#d97706"
  state-danger: "#dc2626"
  state-info: "#2563eb"
typography:
  display:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ofix-yellow}"
    textColor: "#0f171f"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "#9a3412"
  card:
    backgroundColor: "{colors.oficina-paper}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: Ofix

> Identidade vigente: pasta `/Logo` (prancha de marca). Grafite `#0F171F`, cinza `#27323D`, amarelo `#FFBE00`, off-white `#F4F6F8`; Montserrat. Sidebar sempre grafite, botão primário amarelo com texto grafite, texto/link em amarelo usa `--primary-ink` (`#7A5800`) no tema claro. Logo: `components/brand/ofix-logo.tsx` e `public/brand/*.svg`.

## Overview

**Creative North Star: "The Calm Shop Floor"**

Ofix rejects two ruts at once: the generic Tailwind-starter-kit look the product shipped with, and any theatrical "mechanic shop" costume (wrenches, caution-stripe yellow-and-black). What replaces both is the restraint of the best operational SaaS panels — a near-white/near-black neutral scale, a single confident accent reserved for action and real state, and typography carrying the entire hierarchy. The finish bar is explicitly Linear: full fidelity to that level of polish and calm, no ironic or "customized" flourish layered on top.

The system was built code-led (no comp), refined and finish-reviewed in this session: a calm hairline-and-soft-shadow elevation model, one authored entrance motion, tabular-numeral KPI typography, and — as of this review — color that communicates only real state, never decoration or position. An empty state is not automatically "success"; a KPI tile's icon chip is not colored unless it represents a genuine warning, danger, success, or the one reserved primary/active accent.

**Key Characteristics:**
- Near-white/near-black neutral scale (slate ramp) carries almost everything; color is the exception, not the texture.
- One accent (orange) is reserved for the primary action and genuinely active/open state — it does not decorate.
- Hairline 1px borders do the primary separating; soft real shadows (never a colored halo) add elevation only where it means something (resting card, hover, popover).
- Every KPI and table figure uses tabular numerals.
- One authored entrance motion plays once per screen mount; nothing else moves on its own.

## Colors

The palette is almost entirely neutral; state colors and the single accent are spent deliberately, never as ambient decoration.

### Primary
- **Operational Orange** (`#c2410c` light / `#fb923c` dark): the one accent. Reserved for the primary call-to-action, the active navigation item, and metrics that represent genuinely active/open work. Never used to decorate an icon chip that has no real state behind it.

### Neutral
- **Oficina Paper** (`#ffffff` light / `#0b0f17` dark): page background.
- **Oficina Surface** (`#f8fafc` light / `#111827` dark): sidebar and secondary surface fill.
- **Oficina Card** (`#ffffff` light / `#111827` dark): card background, same as paper in light mode, lifted one step in dark mode.
- **Oficina Border** (`#e2e8f0` light / `#1f2937` dark): the hairline that separates almost everything.
- **Oficina Ink** (`#0f172a` light / `#f1f5f9` dark): primary text.
- **Oficina Muted** (`#64748b` light / `#94a3b8` dark): secondary text, captions, timestamps.

### State (success / warning / danger / info)
- **Success** (`#16a34a` light / `#4ade80` dark): a genuinely positive outcome only — "operação em dia," "nenhum contato pendente." Never a default/placeholder tone for an empty or neutral state.
- **Warning** (`#d97706` light / `#fbbf24` dark): a real due-soon condition (an installment approaching its date), not a label for ordinary informational content.
- **Danger** (`#dc2626` light / `#f87171` dark): overdue deliveries, blocked execution, destructive actions.
- **Info** (`#2563eb` light / `#60a5fa` dark): informational badges (e.g. an appointment "em atendimento").

Each state color ships three steps — `-subtle` (tinted background), the solid default, and `-strong` (high-contrast text on the subtle background) — defined as CSS custom properties per theme, never hardcoded per component.

### Named Rules
**The State-Only Color Rule.** Color communicates a real, present state — success, warning, danger, info, or the one reserved active/primary accent — and nothing else. An icon chip, an empty-state illustration, or a KPI tile never takes a saturated color because it looks good or fills a grid; it earns color only when it is actually reporting that state. (This rule was enforced as a fix during this session's finish review: empty states and KPI tones were auditing against it and corrected.)

**The One Accent Rule.** Operational Orange is spent on at most one primary action and one "active work" metric per view. When a hero row needs more than one saturated tile at once, the extra tiles must each be answering a real success/warning/danger question — never simultaneous decoration.

## Typography

**Family:** Montserrat (weights 400/500/600/700/800), loaded via `next/font/google`, with `font-feature-settings: 'cv11', 'ss01'` enabled globally and system `sans-serif` as fallback. One family for the whole system — no separate display face.

**Character:** A clean, slightly geometric grotesk at every scale; the hierarchy comes from size, weight, and tracking, not from mixing faces.

### Hierarchy
- **Display** (700, tight leading, −0.01em tracking): hero KPI numerals use 24px on mobile, 30px on tablet and 36px on desktop. Currency uses 20/24/30px, with smaller text for long amounts. Always `tabular-nums`; preserve the complete value and allow wrapping for exceptional lengths.
- **Headline** (700, 1.5rem / 24px, −0.01em tracking): the page's own H2 ("Operação de hoje").
- **Title** (600, 1.125rem / 18px, line-height 1.33, −0.01em tracking): `CardTitle` — every card and panel heading.
- **Body** (400–600, 0.875rem / 14px, line-height 1.43): row content, descriptions, button labels.
- **Label** (600, 0.75rem / 12px): captions, badge text, nav group headers (the latter additionally uppercase with ~0.05em tracking).

### Named Rules
**The Tabular Numeral Rule.** Every KPI value, table figure, and currency amount is set with `tabular-nums`. A number that moves (refresh, live update) never reflows its neighbors.

## Layout

Content sits in a `max-w-[1440px]` container inside the main scroll region. Section rhythm runs on Tailwind's 4px scale rather than a strict 8px grid: card padding and section gaps land at 20px (`gap-5` / `p-5`) stepping up to 24px (`p-6`) at larger breakpoints, row padding inside cards at 14px (`py-3.5`), icon-to-label gaps at 8–12px.

Grids are responsive by column count, not fixed width: the KPI hero runs 2-up on mobile to 4-up at `xl`; secondary panel rows run 1-up to 2- or 3-up depending on how many panels a role can see (permission-gated panels collapse the grid rather than leaving an empty cell).

**Navigation chrome:** a fixed 16rem sidebar on desktop (collapsible to 5rem, persisted in `localStorage`), replaced below `md` by a fixed 64px-tall, 5-item bottom tab bar. The sidebar groups links under uppercase tracked labels (OPERAÇÃO / RELACIONAMENTO / GESTÃO) matching the product's own information architecture, not a generic nav taxonomy.

## Elevation & Depth

Hybrid: hairline 1px borders (`--border`) are the primary separator at rest — most cards are visually "flat" until examined closely. A soft, real (offset + blur, never a flat colored halo) shadow sits underneath every card and deepens only in response to interaction (hover) or when a surface actually floats above content (popover/dialog). Dark mode does not reuse the light shadow values scaled down; it defines deeper, higher-opacity black shadows of its own, because a translucent-black shadow that reads at 4% opacity on white is invisible on a near-black surface.

### Shadow Vocabulary
- **card** (`0 1px 2px rgb(15 23 42 / .04), 0 1px 1px rgb(15 23 42 / .03)` light; `0 1px 2px rgb(0 0 0 / .32), 0 1px 1px rgb(0 0 0 / .24)` dark): resting elevation for every `Card`.
- **card-hover** (`0 4px 10px rgb(15 23 42 / .06), 0 1px 2px rgb(15 23 42 / .04)` light; `0 6px 16px rgb(0 0 0 / .36), 0 1px 2px rgb(0 0 0 / .3)` dark): interactive lift on hover for card-shaped links/buttons.
- **popover** (`0 12px 24px rgb(15 23 42 / .10), 0 2px 6px rgb(15 23 42 / .06)` light; `0 16px 32px rgb(0 0 0 / .5), 0 2px 8px rgb(0 0 0 / .4)` dark): floating surfaces — menus, popovers, dialogs.
- **inner-subtle** (`inset 0 1px 2px rgb(15 23 42 / .04)`): recessed detail, same value in both themes.

### Named Rules
**The Real Shadow Rule.** A shadow is always a genuine offset-plus-blur pair sampled from the neutral ink color, never a flat colored glow or a border-radius trick standing in for depth.

## Shapes

Three radius steps, applied by role rather than by component size: `--radius-button` (0.5rem / 8px) for buttons, inputs, and icon chips; `--radius-card` (0.75rem / 12px) for cards and panels; `--radius-dialog` (1rem / 16px) for dialogs and sheets. Badges and pills use a full 999px radius. Icon chips are small (36–40px) squares or circles holding exactly one Lucide glyph — never an illustration, gradient tile, or multi-color icon.

## Components

### Buttons
- **Shape:** `rounded-button` (8px).
- **Primary:** `bg-primary` (Operational Orange) on `primary-foreground`, `hover:bg-primary-hover`, `active:bg-primary-active` — the one call-to-action per view, anchored at the page header's top-right, never duplicated elsewhere in the chrome (a duplicate full-width copy in the sidebar was removed during this session's review).
- **Secondary / Outline / Ghost / Link / Destructive:** outline uses a hairline border on `--input` with `background`; ghost is borderless with an `accent` hover fill; destructive maps to the danger-strong background.
- **Sizes:** `sm` (36px), default (40px), `lg` (48px), `icon` (40px square).
- **Focus:** 2px `ring` in the accent color, 2px offset from the background.

### Chips / Badges
- **Style:** full-pill (999px), `text-xs font-semibold`, 1px border at low opacity over a `-subtle` tint background.
- **State mapping:** `success` / `attention` (warning) / `critical` (danger) / `info` map 1:1 to the state color tokens (`-subtle` background, `-strong` text); `neutral` uses the muted neutral pair; `default` is solid primary. Variant choice follows the State-Only Color Rule above.

### Cards / Containers
- **Corner:** `rounded-card` (12px).
- **Background:** `--card` (near-white light / lifted dark surface).
- **Shadow:** `shadow-card` at rest, `shadow-card-hover` when the whole card is an interactive link/button.
- **Border:** 1px hairline, `--border`.
- **Internal padding:** `p-4` → `p-5`/`p-6` across breakpoints for header/content; KPI tiles use `p-3.5` → `p-5` → `p-6`, with vertically centered icons and arrows and equal-height areas for values, labels and captions.

### Navigation
- **Desktop sidebar:** fixed width (16rem / 5rem collapsed), grouped links under uppercase 11px tracked section labels, active item gets a tinted `--selection` background with `--accent-foreground` text. Collapsed state persists per browser.
- **Mobile tab bar:** fixed, 64px tall, 5 icon+label items, active item colored in the primary accent, everything else neutral.
- **Primary action placement:** exactly one, in the content header's top-right — the signature rule this session enforced by removing a sidebar duplicate.

### Signature: entrance motion
A single authored reveal plays once per screen mount via `[data-reveal]` + an inline `--reveal-order` custom property: `opacity 0→1` with a 6px rise, 420ms, eased with a custom "settle" curve (`cubic-bezier(0.16, 1, 0.3, 1)`), staggered ~45ms per element in reading order. It is not re-triggered on scroll or per-section — one authorial moment per view, not a repeated scroll effect. Fully disabled under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** reserve Operational Orange for the primary action and genuinely active/open state — nothing else earns it.
- **Do** set every KPI, table figure, and currency amount in tabular numerals.
- **Do** pair every shadow with a real offset + blur sampled from ink; define dark-mode shadows independently rather than scaling the light values.
- **Do** keep icon chips to one small Lucide glyph on a flat tint — never an illustration or gradient.
- **Do** place exactly one primary call-to-action per view, anchored top-right of the page header.

### Don't:
- **Don't** color an empty or neutral state success-green by default — reserve success for a genuinely positive outcome (confirmed fix: `EmptyBlock` now defaults to a neutral tone).
- **Don't** assign a warning/danger/primary tone to a metric that isn't actually reporting that state.
- **Don't** duplicate a primary call-to-action between the page header and the navigation chrome.
- **Don't** ship two card panels presenting the same underlying list from different angles when one prioritized list says it clearly (confirmed fix: a redundant "aguardando peças" panel was folded into the single prioritized operational list).
