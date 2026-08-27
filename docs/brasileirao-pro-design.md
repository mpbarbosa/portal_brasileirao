> **Imported document — not this project's design system.**
>
> This is the design specification shipped inside `brasileirao-pro.zip`, an AI
> Studio prototype of a Série A analytics dashboard, reproduced here verbatim so
> that [`brasileirao-pro-proposal.md`](brasileirao-pro-proposal.md) can cite it.
> Nothing below describes Portal Brasileirão as built. Where the two disagree —
> the colour tokens, the typeface pair, the navigation shape — **this repo's
> `docs/roadmap.md` and `CLAUDE.md` are authoritative**, and the proposal says
> which of these ideas are worth taking and which are not.
>
> Source: `brasileirao-pro.zip`, `DESIGN.md`, imported 2026-08-27. Unedited below this rule.

---

# DESIGN SYSTEM SPECIFICATION: Brasileirão Pro
**Design Framework**: Campeão Data System  
**Methodology**: DESIGNmd  
**Version**: 1.0.0  
**Target Platform**: Responsive Web / Mobile / Desktop Sports SaaS  

---

## 1. Executive Summary & Brand Identity

### 1.1 Brand Essence
**Brasileirão Pro** is a high-performance sports intelligence and analytics platform tailored for the Campeonato Brasileiro Série A. The design balances the vibrant passion of Brazilian football with the precision and data density of a modern enterprise SaaS dashboard.

### 1.2 Design Archetype
* **Primary Archetype**: Modern Corporate Analytics / Broadcast Control Room.
* **Secondary Archetype**: Minimalist Dark-First Editorial.
* **Atmosphere**: Authoritative, fast, dependable, and immersive. Deep dark ink tones avoid eye strain during extended analytical sessions, while deep emerald and warm gold accents evoke trophies and pitch-level excitement.

### 1.3 Core Pillars
1. **Uncompromised Data Density**: Clear numerical alignments, mono-spaced tables, and scannable visual structures that reveal insights at a glance.
2. **Real-Time Responsiveness**: Explicit visual states for live match time, scoring changes, and tournament position fluctuations.
3. **Open Media Architecture**: Full support for native direct image links (`<img>`), vectorized SVG club badges, and low-latency CDN image ingestion.

---

## 2. Color System & Token Architecture

The color system is derived from the *Campeão Data System* palette, optimized specifically for dark-mode interfaces (`#121414` base) to avoid pure black `#000000` harshness.

### 2.1 Color Tokens

| Token Name | Hex Code | Semantic Role | Usage Context |
| :--- | :--- | :--- | :--- |
| `surface` | `#121414` | Neutral Base 0 | Main application background canvas |
| `surface-dim` | `#0d0f0f` | Neutral Lowest | Embedded code blocks, inset scoreboard trays |
| `surface-container-low` | `#1a1c1c` | Neutral Base 1 | Primary card containers, hero wrappers |
| `surface-container` | `#1e2020` | Neutral Base 2 | Interactive card containers, sub-elements |
| `surface-container-high` | `#232727` | Neutral Base 3 | Hover row states, active interactive tiles |
| `surface-container-highest`| `#282a2a` | Neutral Base 4 | Badge pills, secondary button surfaces |
| `border-subtle` | `#2D3232` | Structural Divider | 1px border lines between cards and columns |
| `outline-variant` | `#404943` | Interactive Border | Focus rings, hover outlines |
| `primary` | `#96d4b1` | Brand Primary | Accent icons, positive numbers, active tabs |
| `primary-container` | `#00472d` | Brand Tinted Fill | Active sidebar items, primary badge fills |
| `on-primary` | `#002113` | Contrast Ink | Text on primary solid green buttons |
| `secondary` | `#ffdf0a` | Gold Accent | Live match badge, #1 ranking, trophy highlights |
| `on-secondary` | `#211b00` | Contrast Ink Dark | Text on gold badges |
| `on-surface` | `#e2e2e2` | High-contrast Text | Primary headings, club names, scores |
| `on-surface-variant` | `#8a938c` | Medium-contrast Text | Table headers, secondary metadata, timestamps |
| `success-green` | `#22C55E` | Semantic Positive | Win form badge ('V'), Libertadores G4 zone |
| `error-red` | `#EF4444` | Semantic Negative | Loss form badge ('D'), Relegation Z4 zone |
| `info-blue` | `#70b0ff` | Semantic Neutral | Sul-Americana zone, defense stats |

### 2.2 Contrast & Accessibility (WCAG AA Compliance)
- **Primary Body Text** (`#e2e2e2` on `#121414`): Contrast ratio **13.8:1** (Exceeds AAA).
- **Secondary Metadata** (`#8a938c` on `#1A1D1D`): Contrast ratio **4.9:1** (Passes AA for small text).
- **Primary Accent** (`#96d4b1` on `#121414`): Contrast ratio **9.2:1** (Passes AAA).
- **Gold Accent** (`#ffdf0a` on `#211b00`): Contrast ratio **12.1:1** (Passes AAA).

---

## 3. Typography & Font Pairing

A dual-font hierarchy ensures readability in textual editorial content while maintaining mathematical alignment for tabular match data.

### 3.1 Font Family Declarations
* **Display & Body Font**: `Inter`, system-ui, -apple-system, sans-serif
* **Data & Numerical Font**: `JetBrains Mono`, monospace

### 3.2 Typographic Hierarchy Scale

| Style Level | Font Family | Size | Weight | Line Height | Letter Spacing | CSS Utility / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Headline LG** | Inter | 32px (2rem) | 700 | 40px (1.25) | -0.02em | Main Hero titles, modal titles |
| **Headline MD** | Inter | 24px (1.5rem) | 600 | 32px (1.33) | -0.01em | Section titles, match scores |
| **Headline SM** | Inter | 18px (1.125rem) | 600 | 24px (1.33) | -0.01em | Card headers, team detail titles |
| **Body LG** | Inter | 16px (1rem) | 500/600 | 24px (1.5) | normal | Team names in standings, club list |
| **Body MD** | Inter | 14px (0.875rem) | 400/500 | 20px (1.43) | normal | General descriptions, timeline text |
| **Body SM** | Inter | 12px (0.75rem) | 400 | 16px (1.33) | normal | Footers, hints, stadium capacities |
| **Data Mono** | JetBrains Mono | 14px (0.875rem) | 500/700 | 20px (1.43) | 0.02em | Standings points (P, J, V, E, D, SG) |
| **Label Caps** | JetBrains Mono | 11px (0.6875rem) | 700 | 16px (1.45) | 0.05em | Table headers (POS, CLUBE, FORMA) |

---

## 4. Spacing, Layout & Grid Architecture

### 4.1 Spacing Scale (4px Baseline)
* `xs`: 4px
* `sm`: 8px
* `md`: 16px
* `lg`: 24px
* `xl`: 32px
* `2xl`: 48px

### 4.2 Grid Structure
* **Container Max Width**: `1600px` centered with auto margins.
* **Fixed Left Sidebar**: `280px` (Desktop `lg:`), collapsible on tablet, hamburger/modal on mobile.
* **Primary Dashboard Layout**: 12-column responsive layout with `24px` gutter:
  * **Hero Row**: 8 Columns (Highlight Hero Banner) + 4 Columns (Top Scorers Card).
  * **Data Row**: 8 Columns (Classificação Standings Table) + 4 Columns (Live & Recent + Upcoming).

### 4.3 Padding Mathematics & Corner Radius
* **Outer Cards**: `border-radius: 12px (0.75rem)`, `padding: 20px (1.25rem)` to `24px (1.5rem)`.
* **Inner Containers (Score Trays / Sub-Cards)**: `border-radius: 8px (0.5rem)`, `padding: 12px (0.75rem)`.
* **Interactive Badges / Form Pills**: `border-radius: 4px (0.25rem)`, `padding: 2px 6px`.

---

## 5. Elevation & Surface Hierarchy

In compliance with anti-slop guidelines, the interface avoids heavy glowing drop shadows or colored borders. Elevation is achieved through **tonal surface stepping** and **1px low-contrast outlines**.

```
Level 0: Background Base (#121414)
  └─ Level 1: Surface Container (#1A1D1D + 1px border #2D3232)
       └─ Level 2: Inset Sub-Containers (#232727 + 1px border #2D3232)
            └─ Level 3: Active Hover / Highlight Focus (#282a2a)
```

* **Modal Elevation**: `#1A1D1D` surface with black 80% backdrop blur (`backdrop-blur-md`) and 24px diffused black shadow (`rgba(0,0,0,0.6)`).

---

## 6. Component Design Specifications

### 6.1 Highlight Hero Card (Destaque da Rodada)
* **Visual Construction**: Cinematic background image with multi-step linear gradient:
  * Left-to-right gradient: `#121414` (solid) → `#121414`/90 → transparent at 80% width.
* **Badge**: Pill with `#ffdf0a` gold background and `#211b00` black bold text.
* **Primary CTA**: `#96d4b1` background, `#002113` bold text with `Play` icon.

### 6.2 Standings Table (Classificação Série A)
* **Table Header**: Monospace uppercase labels (`POS`, `CLUBE`, `P`, `J`, `V`, `E`, `D`, `SG`, `FORMA`).
* **Position Badges**:
  * Position 1 (Champion): `#00472d` background, `#96d4b1` border and text.
  * Positions 2–4 (G4 Libertadores): `#182320` background, `#96d4b1` text.
  * Positions 5–6 (Pré-Libertadores): `#182025` background, `#70b0ff` text.
  * Positions 17–20 (Z4 Rebaixamento): `#2a1a1a` background, `#ffb4ab` text.
* **Form Pills**:
  * `V` (Vitória): `#22C55E` green fill with `#002113` dark text.
  * `E` (Empate): `#404943` dark grey fill with `#e2e2e2` light text.
  * `D` (Derrota): `#EF4444` red fill with `#ffffff` text.

### 6.3 Match Cards (Live, Recent & Upcoming)
* **Live Status Pill**: `#ffdf0a` gold badge with pulse dot indicator.
* **Scoreboard Numerals**: JetBrains Mono `font-extrabold`, inset inside `#121414` rounded pill.
* **Team Badges**: Standardized `24px` to `48px` circular/square SVG wrappers with fallback monograms.

---

## 7. Media & HTML Direct Image Link Architecture

### 7.1 Policy & Security
To enable seamless embedding of direct external images (e.g., Wikimedia club badges, Unsplash sports photos, official CDNs) without hotlink blocking or referrer leakage:

1. **Required HTML/React Attribute**:
   ```html
   <img 
     src="https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_braz_logo.svg" 
     alt="Escudo Flamengo" 
     referrerpolicy="no-referrer"
     loading="lazy" 
     width="48" 
     height="48" 
   />
   ```
2. **Fallback Mechanism**: All club badges and player avatars implement `onError` handlers falling back to stylized monogram tokens with club primary colors.
3. **Local Storage Synchronization**: Custom user-configured image URLs are persisted under `brasileirao_pro_custom_images_v1` in `localStorage`.

---

## 8. Micro-Interactions & Transitions

* **Hover Transitions**: Standard `150ms ease-out` on all row highlights and buttons (`transition-colors duration-150`).
* **Active Press Feedback**: `active:scale-[0.98]` on primary CTA buttons.
* **Live Match Pulsing**: `animate-pulse` and `animate-ping` for real-time match events.
* **Modal Entry**: `animate-in fade-in zoom-in-95 duration-150` for crisp window openings.

---

## 9. Design System Compliance Checklist
- [x] No generic AI slop gradients (e.g., purple-to-blue or arbitrary glows).
- [x] High-contrast neutral palette (`#121414` base).
- [x] Double-font typographic harmony (Inter + JetBrains Mono).
- [x] Fully functional Direct Image Link Manager with instant live preview.
- [x] Mathematically aligned table columns and scoreboards.
- [x] 100% WCAG AA color contrast compliance.
