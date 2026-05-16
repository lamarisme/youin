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
  /* Paper — inspection surfaces with a faint warm technical cast */
  paper:   "oklch(98.3% 0.006 78)",
  paper2:  "oklch(96.4% 0.008 78)",
  paper3:  "oklch(93.5% 0.011 78)",
  paperElevated: "oklch(97.4% 0.007 78)",

  /* Ink — foreground text */
  ink:     "oklch(18.4% 0.018 62)",
  /** Filled control hover (primary buttons on paper) */
  inkHover: "oklch(24% 0.02 62)",
  ink2:    "oklch(42% 0.016 62)",
  ink3:    "oklch(56% 0.013 62)",

  /* Rule — borders, dividers */
  rule:    "oklch(87.2% 0.012 78)",
  ruleStrong: "oklch(79.8% 0.016 78)",

  /* Mark — annotation ink, not generic danger red */
  mark:       "oklch(52.5% 0.205 24)",
  markBright: "oklch(59.5% 0.215 24)",
  markSoft:   "oklch(94.4% 0.045 24)",

  /* Semantic */
  ok:       "oklch(51% 0.12 154)",
  okSoft:   "oklch(95.4% 0.03 154)",
  warn:     "oklch(65% 0.13 82)",
  warnSoft: "oklch(95.2% 0.045 82)",
  info:     "oklch(55% 0.11 236)",
  infoSoft: "oklch(95.2% 0.026 236)",
} as const;

export const colorDark = {
  paper:   "oklch(15.4% 0.018 62)",
  paper2:  "oklch(18.6% 0.02 62)",
  paper3:  "oklch(22.8% 0.022 62)",
  paperElevated: "oklch(19.8% 0.02 62)",

  ink:     "oklch(91.8% 0.008 78)",
  inkHover: "oklch(84% 0.01 78)",
  ink2:    "oklch(70% 0.012 78)",
  ink3:    "oklch(56% 0.014 78)",

  rule:    "oklch(26% 0.024 62)",
  ruleStrong: "oklch(33% 0.027 62)",

  mark:       "oklch(63% 0.21 24)",
  markBright: "oklch(69% 0.22 24)",
  markSoft:   "oklch(25.5% 0.075 24)",

  ok:       "oklch(64% 0.13 154)",
  okSoft:   "oklch(25.5% 0.05 154)",
  warn:     "oklch(73% 0.135 82)",
  warnSoft: "oklch(27.5% 0.06 82)",
  info:     "oklch(67% 0.11 236)",
  infoSoft: "oklch(25.5% 0.05 236)",
} as const;

/* ─── Typography ───────────────────────────────────────────────── */

export const fontFamily = {
  sans:    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
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
  sm:   "0.25rem",
  md:   "0.375rem",
  lg:   "0.5rem",
  xl:   "0.625rem",
  "2xl": "0.75rem",
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
    "none",
  popover:
    "0 16px 40px -24px oklch(12% 0.02 62 / 0.48)",
  fab:
    "0 10px 24px -16px oklch(52.5% 0.205 24 / 0.72)",
  banner:
    "none",
  reviewFab:
    "none",
} as const;

/* ─── CSS custom-property name map (for generating CSS vars) ──── */

const tokenToVar: Record<string, string> = {
  paper:      "--yi-paper",
  paper2:     "--yi-paper-2",
  paper3:     "--yi-paper-3",
  paperElevated: "--yi-paper-elevated",
  ink:        "--yi-ink",
  inkHover:   "--yi-ink-hover",
  ink2:       "--yi-ink-2",
  ink3:       "--yi-ink-3",
  rule:       "--yi-rule",
  ruleStrong: "--yi-rule-strong",
  mark:       "--yi-mark",
  markBright: "--yi-mark-bright",
  markSoft:   "--yi-mark-soft",
  ok:         "--yi-ok",
  okSoft:     "--yi-ok-soft",
  warn:       "--yi-warn",
  warnSoft:   "--yi-warn-soft",
  info:       "--yi-info",
  infoSoft:   "--yi-info-soft",
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
