# YouIn Design System

## Direction

YouIn uses a **Spatial OS** system: a quiet technical product interface with a precise red annotation layer.

The product should feel like a trusted work surface for UI tasks. The red pin is the protagonist, but the rest of the interface stays calm, dense, and useful.

## Registers

### Product UI

Use the product register for authenticated surfaces, the Chrome extension, dashboards, settings, tables, command menus, forms, and overlay tools.

- System sans for UI text.
- Fixed rem type scale.
- Tight controls and predictable density.
- Divided surfaces before decorative cards.
- Red only for pins, primary actions, active states, focus rings, and unresolved work.

### Marketing

Use the brand register for the homepage and public positioning pages.

- Bricolage Grotesque can carry large headlines.
- The layout can be more editorial and asymmetric.
- The same red mark language should appear, but never as generic decoration.

## Color Strategy

Product uses a **Restrained** color strategy.

- Base: technical warm-gray neutrals, cleaner than the old manuscript paper.
- Accent: manuscript red, used sparingly.
- Semantics: green for resolved/success, amber for warning/stale, blue for info.
- Dark mode exists for product surfaces, but it is not the default brand mood.

## Palette Roles

- `paper`: app canvas.
- `paper-2`: sidebars, low panels, subtle bands.
- `paper-3`: selected rows, input fills, hover surfaces.
- `ink`: primary text.
- `ink-2`: secondary text.
- `ink-3`: metadata, placeholders, quiet labels.
- `rule`: borders and dividers.
- `mark`: pins, primary actions, unresolved marks.
- `mark-soft`: quiet red wash for active mark context only.
- `ok`: resolved and success states.
- `warn`: stale anchors and attention states.
- `info`: neutral informational states.

## Typography

Product UI uses the native system stack. It should feel fast and familiar.

Marketing display uses Bricolage Grotesque for the product voice.

Rules:

- Do not use display fonts in buttons, dense labels, tables, sidebars, or form controls.
- Body copy maxes out at 65-75ch.
- Product headings use a tighter scale than landing page headings.
- Monospace is for IDs, shortcuts, technical metadata, and timestamps.

## Shape

- Buttons, inputs, panels: 6px radius by default.
- Larger panels: 8px maximum unless a component has a clear reason.
- Pins and avatars may stay round.
- Avoid nested cards. Use dividers, panes, and rows.

## Layout

Product surfaces should feel like a working cockpit:

- Left sidebar.
- Dense toolbar.
- Lists and tables built for scanning.
- Detail panes for selected marks.
- Overlay pins as the spatial layer.

Marketing can breathe more, but it should still avoid generic SaaS card grids.

## Motion

- 150-250ms for product state changes.
- Ease out with quart or expo curves.
- Motion should communicate state: open, close, select, save, resolve.
- No decorative page-load choreography inside authenticated app surfaces.

## Component Rules

- Primary buttons use red only for conversion or decisive product actions.
- Default product buttons use ink or neutral surfaces.
- Focus rings use mark red, but softly.
- Inputs use neutral surfaces, not white islands.
- Empty states should explain the next action without sounding instructional.
- Table/list hover states should be visible but quiet.

## Anti-References

- Generic SaaS blue-purple gradients.
- Dark developer-tool chrome with neon accents.
- Beige editorial everywhere.
- Icon-card feature grids.
- Playful illustrations.
- Heavy rounded glass panels.
