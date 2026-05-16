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
  /* Paper — technical neutral surfaces */
  paper:   "oklch(97.8% 0.004 286)",
  paper2:  "oklch(95.2% 0.006 286)",
  paper3:  "oklch(91.4% 0.008 286)",
  paperElevated: "oklch(96.2% 0.006 286)",

  /* Ink — foreground text */
  ink:     "oklch(18.2% 0.012 286)",
  /** Filled control hover (primary buttons on paper) */
  inkHover: "oklch(24% 0.014 286)",
  ink2:    "oklch(42% 0.011 286)",
  ink3:    "oklch(57% 0.01 286)",

  /* Rule — borders, dividers */
  rule:    "oklch(88% 0.007 286)",
  ruleStrong: "oklch(81.5% 0.009 286)",

  /* Mark — brand / accent (warm red) */
  mark:       "oklch(53% 0.19 26)",
  markBright: "oklch(59% 0.21 26)",
  markSoft:   "oklch(95.2% 0.035 26)",

  /* Semantic */
  ok:       "oklch(53% 0.13 155)",
  okSoft:   "oklch(96% 0.026 155)",
  warn:     "oklch(68% 0.14 75)",
  warnSoft: "oklch(96% 0.04 75)",
  info:     "oklch(57% 0.12 245)",
  infoSoft: "oklch(96% 0.025 245)",
} as const;

export const colorDark = {
  paper:   "oklch(15.2% 0.015 286)",
  paper2:  "oklch(18.4% 0.016 286)",
  paper3:  "oklch(22.8% 0.017 286)",
  paperElevated: "oklch(19.8% 0.016 286)",

  ink:     "oklch(92% 0.006 286)",
  inkHover: "oklch(84% 0.007 286)",
  ink2:    "oklch(70% 0.009 286)",
  ink3:    "oklch(56% 0.011 286)",

  rule:    "oklch(25.5% 0.018 286)",
  ruleStrong: "oklch(32% 0.02 286)",

  mark:       "oklch(63% 0.2 25)",
  markBright: "oklch(69% 0.22 25)",
  markSoft:   "oklch(25% 0.065 25)",

  ok:       "oklch(64% 0.14 155)",
  okSoft:   "oklch(25% 0.045 155)",
  warn:     "oklch(74% 0.14 75)",
  warnSoft: "oklch(27% 0.055 75)",
  info:     "oklch(68% 0.12 245)",
  infoSoft: "oklch(25% 0.045 245)",
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
    "0 16px 40px -24px oklch(8% 0.012 286 / 0.72)",
  fab:
    "0 10px 24px -16px oklch(53% 0.19 26 / 0.72)",
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
