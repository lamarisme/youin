# YouIn Design System

## Direction

YouIn uses a **Spatial OS** system inspired by Linear light: a quiet technical product interface with a precise red annotation layer.

The product should feel like a trusted work surface for UI tasks. The red pin is the protagonist, but the rest of the interface stays calm, dense, and useful.

## Registers

### Product UI

Use the product register for authenticated surfaces, the Chrome extension, dashboards, settings, tables, command menus, forms, and overlay tools.

- System sans for UI text.
- Fixed rem type scale.
- Tight controls, low-radius shapes, and predictable density.
- Divided surfaces and rows before decorative cards.
- Red only for pins, primary actions, active states, focus rings, and unresolved work.

### Marketing

Use the brand register for the homepage and public positioning pages.

- Bricolage Grotesque can carry large headlines.
- The layout can be more editorial and asymmetric.
- The same red mark language should appear, but never as generic decoration.

## Color Strategy

Product uses a **Restrained** color strategy.

- Scene: a designer, PM, or client is reviewing a mostly light live app in the browser and needs a calm inspection layer where one red mark can land with confidence.
- Base: warm technical neutrals, closer to Linear light than paper or generic cool-gray SaaS chrome.
- Accent: annotation red, used sparingly. It should feel like a precise mark on the interface, not a destructive state.
- Semantics: green for resolved/success, amber for warning/stale, blue for info.
- Dark mode exists for product surfaces, but it is not the default brand mood.

## Core Palette

All core colors use OKLCH. Neutrals carry a faint warm cast so the product feels hand-worked and precise without becoming beige.

- `paper`: `oklch(98.7% 0.003 78)`
- `paper-2`: `oklch(96.4% 0.004 78)`
- `paper-3`: `oklch(93.8% 0.005 78)`
- `paper-elevated`: `oklch(99.2% 0.002 78)`
- `ink`: `oklch(18.8% 0.01 62)`
- `rule`: `oklch(88.6% 0.005 78 / 0.55)` (list/table hairlines)
- `mark`: `oklch(53.5% 0.19 24)`
- `mark-soft`: `oklch(95.8% 0.032 24)`

## Palette Roles

- `paper`: app canvas.
- `paper-2`: sidebars, toolbars, subtle bands.
- `paper-3`: selected rows, input fills, hover surfaces.
- `paper-elevated`: popovers, menus, landing product scenes.
- `ink`: primary text.
- `ink-2`: secondary text.
- `ink-3`: metadata, placeholders, quiet labels.
- `rule`: invisible layout token for places that still need a class hook.
- `mark`: pins, primary actions, unresolved marks.
- `mark-soft`: quiet red wash for active mark context only.
- `ok`: resolved and success states.
- `warn`: stale anchors and attention states.
- `info`: neutral informational states.

## Typography

Product UI uses the **native system stack** (`ui-sans-serif`, `-apple-system`, etc.). Marketing display uses **Bricolage Grotesque** only via `.font-display` / `.text-editorial*`.

Semantic scale (Tailwind utilities — do not use arbitrary `text-[0.*]` sizes):

| Class | Use |
|-------|-----|
| `text-ui-2xs` | Badges, pin labels, kbd hints |
| `text-ui-xs` | Metadata, eyebrows, table secondary |
| `text-ui-sm` | Default UI body, nav, tables |
| `text-ui-md` | Emphasized body, mobile primary |
| `text-ui-lg` | Lead paragraphs |
| `text-title-sm` / `md` / `lg` | Section headings (product) |
| `text-editorial*` | Landing display only |

Rules:

- Do not use display fonts in buttons, dense labels, tables, sidebars, or form controls.
- Body copy maxes out at 65-75ch.
- Product headings use a tighter scale than landing page headings.
- Monospace is for IDs, shortcuts, technical metadata, and timestamps.

## Shape

- Buttons, inputs, panels: 6px radius by default.
- Larger panels: 8px maximum unless a component has a clear reason.
- Avoid visible borders and heavy shadows. Prefer subtle filled states, spacing, and hover fills.
- Pins and avatars may stay round.
- Avoid nested cards. Use dividers, panes, and rows.

## Layout

Product surfaces should feel like a working cockpit:

- Light gray sidebar on a slightly lighter canvas.
- Dense toolbar with segmented filtering.
- Lists and tables built for scanning with spacing and hover fills.
- Detail panes for selected marks.
- Overlay pins as the spatial layer.

Marketing can breathe more, but it should still avoid generic SaaS card grids.

## Motion

- 150-250ms for product state changes.
- Ease out with quart or expo curves.
- Motion should communicate state: open, close, select, save, resolve.
- No decorative page-load choreography inside authenticated app surfaces.

## Component Rules

### Buttons (`Button`)

| Variant | When |
|---------|------|
| `default` | Ink fill — standard primary action in product UI |
| `mark` | Red fill — signup, capture, one decisive CTA per view |
| `outline` / `secondary` / `ghost` | Neutral actions |
| `destructive` | Delete/remove — uses `--yi-destructive`, not brand mark |

### Surfaces

- Product UI: `Surface` + `divide-y` + row hover fills. **No** shadcn `Card` in workspace routes.
- `paper-elevated` only for popovers, menus, and landing product scenes.

### Mark pin (`MarkPin`)

- Canonical red annotation dot. Sizes: `sm` | `md` | `lg`. `pulse` for hero/unresolved emphasis only.

### General

- Focus rings use `--yi-focus-ring` (soft mark), not full-strength mark on every element.
- Inputs use `paper-3` filled surfaces.
- Empty states should explain the next action without sounding instructional.
- Table/list hover states should be visible but quiet.
- `rule` tokens are visible hairlines for dividers; panels stay borderless.

## Anti-References

- Generic SaaS blue-purple gradients.
- Dark developer-tool chrome with neon accents.
- Beige editorial everywhere.
- Icon-card feature grids.
- Playful illustrations.
- Heavy rounded glass panels.
