/**
 * Youin Design Tokens — Single source of truth
 *
 * Both the web app (Tailwind/CSS) and Chrome extension (inline styles)
 * consume these tokens. Edit here, not in globals.css or getStyle().
 *
 * Color space: OKLCH for perceptual uniformity.
 */

/* ─── Primitive palette ────────────────────────────────────────── */

export const color = {
  /* Paper — background surfaces */
  paper:   "oklch(97.5% 0.007 65)",
  paper2:  "oklch(94.8% 0.009 65)",
  paper3:  "oklch(91% 0.011 65)",

  /* Ink — foreground text */
  ink:     "oklch(17% 0.01 50)",
  ink2:    "oklch(40% 0.009 50)",
  ink3:    "oklch(50% 0.008 50)",

  /* Rule — borders, dividers */
  rule:    "oklch(86% 0.009 65)",

  /* Mark — brand / accent (warm red) */
  mark:       "oklch(52% 0.19 25)",
  markBright: "oklch(58% 0.21 25)",
  markSoft:   "oklch(95% 0.03 25)",

  /* Semantic */
  ok:     "oklch(52% 0.14 155)",
  okSoft: "oklch(95% 0.025 155)",
} as const;

export const colorDark = {
  paper:   "oklch(15% 0.012 50)",
  paper2:  "oklch(19% 0.014 50)",
  paper3:  "oklch(24% 0.014 50)",

  ink:     "oklch(93% 0.008 65)",
  ink2:    "oklch(75% 0.008 65)",
  ink3:    "oklch(58% 0.008 65)",

  rule:    "oklch(30% 0.012 50)",

  mark:       "oklch(62% 0.2 25)",
  markBright: "oklch(68% 0.22 25)",
  markSoft:   "oklch(25% 0.06 25)",

  ok:     "oklch(62% 0.14 155)",
  okSoft: "oklch(25% 0.04 155)",
} as const;

/* ─── Typography ───────────────────────────────────────────────── */

export const fontFamily = {
  sans:    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
  display: 'var(--font-bricolage), ui-sans-serif, system-ui, sans-serif',
  mono:    'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/* ─── Spacing ──────────────────────────────────────────────────── */

export const space = {
  "2xs": "0.25rem",
  xs:    "0.5rem",
  sm:    "0.75rem",
  md:    "1rem",
  lg:    "1.5rem",
  xl:    "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
  "4xl": "6rem",
} as const;

/* ─── Radius ───────────────────────────────────────────────────── */

export const radius = {
  sm:   "0.3rem",
  md:   "0.4rem",
  lg:   "0.5rem",
  xl:   "0.7rem",
  "2xl": "0.9rem",
  pill: "999px",
} as const;

/* ─── Easing ───────────────────────────────────────────────────── */

export const easing = {
  outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
  outExpo:  "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/* ─── Shadows ──────────────────────────────────────────────────── */

export const shadow = {
  panel:
    "0 1px 2px oklch(0% 0 0 / 0.04), 0 12px 32px -8px oklch(0% 0 0 / 0.18)",
  popover:
    "0 1px 2px oklch(0% 0 0 / 0.04), 0 16px 40px -10px oklch(0% 0 0 / 0.22)",
  fab:
    "0 2px 8px -2px oklch(0% 0 0 / 0.18), 0 8px 24px -8px oklch(52% 0.19 25 / 0.45), inset 0 0 0 2px oklch(100% 0 0 / 0.4)",
  banner:
    "0 6px 24px -8px oklch(0% 0 0 / 0.32)",
  reviewFab:
    "0 4px 16px -4px oklch(0% 0 0 / 0.18)",
} as const;

/* ─── CSS custom-property name map (for generating CSS vars) ──── */

const tokenToVar: Record<string, string> = {
  paper:      "--yi-paper",
  paper2:     "--yi-paper-2",
  paper3:     "--yi-paper-3",
  ink:        "--yi-ink",
  ink2:       "--yi-ink-2",
  ink3:       "--yi-ink-3",
  rule:       "--yi-rule",
  mark:       "--yi-mark",
  markBright: "--yi-mark-bright",
  markSoft:   "--yi-mark-soft",
  ok:         "--yi-ok",
  okSoft:     "--yi-ok-soft",
};

/**
 * Generate a CSS string of custom property declarations from a color palette.
 *
 * Usage (extension inline styles):
 *   style.textContent = cssVars(color) + " …rest of rules…"
 *
 * Usage (web app, raw @theme import):
 *   import "@youin/design-tokens/css"
 */
export function cssVars(
  palette: typeof color | typeof colorDark = color
): string {
  return Object.entries(palette)
    .map(([key, val]) => {
      const prop = tokenToVar[key];
      return prop ? `${prop}: ${val};` : "";
    })
    .filter(Boolean)
    .join("\n  ");
}

/**
 * Build a complete CSS block for use inside a Plasmo content-script
 * shadow DOM root. Includes the CSS vars and shared base resets.
 */
export function extensionRootCSS(rootSelector: string = ".youin-root"): string {
  return `
  :host { all: initial; }
  ${rootSelector}, ${rootSelector} * {
    box-sizing: border-box;
    font-family: ${fontFamily.sans};
    font-feature-settings: "ss01", "cv11";
  }
  ${rootSelector} {
    ${cssVars(color)}
  }`;
}
