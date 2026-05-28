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
  /* Paper — Linear-inspired inverse surfaces for light product UI */
  paper:   "oklch(98.81% 0.0005 197)",
  paper2:  "oklch(97.24% 0.0011 197.14)",
  paper3:  "oklch(96.04% 0.0011 197.14)",
  paperElevated: "oklch(99.25% 0.0005 197)",

  /* Ink — foreground text */
  ink:     "oklch(23.20% 0.0057 285.95)",
  /** Filled control hover (primary buttons on paper) */
  inkHover: "oklch(28% 0.007 285.95)",
  ink2:    "oklch(52.71% 0.0135 264.45)",
  ink3:    "oklch(64.88% 0.0146 262.36)",

  /* Rule — hairline dividers; panels use ruleStrong */
  rule:    "oklch(88% 0.004 264 / 0.62)",
  ruleStrong: "oklch(80% 0.006 264 / 0.76)",

  /* Mark — Linear lavender accent, used sparingly for primary/focus/active */
  mark:       "oklch(56.74% 0.1585 275.21)",
  markBright: "oklch(69.06% 0.1637 276.24)",
  markSoft:   "oklch(94.6% 0.035 276)",
  markInk:    "oklch(45% 0.135 275.21)",

  /* Destructive — separate from brand mark */
  destructive: "oklch(48% 0.16 28)",
  destructiveSoft: "oklch(96% 0.03 28)",

  /* Semantic */
  ok:       "oklch(51% 0.12 154)",
  okSoft:   "oklch(95.4% 0.03 154)",
  warn:     "oklch(65% 0.13 82)",
  warnSoft: "oklch(95.2% 0.045 82)",
  info:     "oklch(48% 0.04 62)",
  infoSoft: "oklch(95.5% 0.012 62)",

  focusRing: "oklch(56.48% 0.1585 275.56 / 0.42)",
} as const;

export const colorDark = {
  paper:   "oklch(6.92% 0.0080 284.11)",
  paper2:  "oklch(17.23% 0.0026 247.98)",
  paper3:  "oklch(19.50% 0.0026 247.96)",
  paperElevated: "oklch(21.27% 0.0025 247.94)",

  ink:     "oklch(97.8% 0.003 197)",
  inkHover: "oklch(90% 0.006 264)",
  ink2:    "oklch(84% 0.012 264)",
  ink3:    "oklch(64.88% 0.0146 262.36)",

  rule:    "oklch(26.45% 0.0098 268.31)",
  ruleStrong: "oklch(32.74% 0.0105 285.81)",

  mark:       "oklch(56.74% 0.1585 275.21)",
  markBright: "oklch(69.06% 0.1637 276.24)",
  markSoft:   "oklch(27% 0.075 276)",
  markInk:    "oklch(78% 0.095 276)",

  destructive: "oklch(62% 0.17 28)",
  destructiveSoft: "oklch(24% 0.06 28)",

  ok:       "oklch(64% 0.13 154)",
  okSoft:   "oklch(25.5% 0.05 154)",
  warn:     "oklch(73% 0.135 82)",
  warnSoft: "oklch(27.5% 0.06 82)",
  info:     "oklch(68% 0.04 78)",
  infoSoft: "oklch(24% 0.02 62)",

  focusRing: "oklch(56.48% 0.1585 275.56 / 0.5)",
} as const;

/* ─── Typography ───────────────────────────────────────────────── */

export const fontFamily = {
  sans:    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  display: 'var(--font-display-family), ui-sans-serif, system-ui, sans-serif',
  mono:    'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Product UI type scale (rem) */
export const fontSize = {
  ui2xs: "0.5625rem",
  uiXs:  "0.6875rem",
  uiSm:  "0.8125rem",
  uiMd:  "0.875rem",
  uiLg:  "0.9375rem",
  titleSm: "1rem",
  titleMd: "1.125rem",
  titleLg: "1.25rem",
} as const;

export const lineHeight = {
  uiTight: "1.2",
  uiSnug:  "1.35",
  uiNormal: "1.5",
  uiRelaxed: "1.65",
  title: "1.25",
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
  xs:   "0.25rem",
  sm:   "0.375rem",
  md:   "0.5rem",
  lg:   "0.75rem",
  xl:   "1rem",
  "2xl": "1.5rem",
  pill: "999px",
} as const;

/* ─── Easing ───────────────────────────────────────────────────── */

export const easing = {
  outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
  outExpo:  "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/* ─── Motion ───────────────────────────────────────────────────── */

export const duration = {
  fast: "150ms",
  normal: "200ms",
  slow: "250ms",
} as const;

/* ─── Shadows ──────────────────────────────────────────────────── */

export const shadow = {
  panel:
    "none",
  popover:
    "0 16px 36px -28px oklch(12% 0.02 264 / 0.42)",
  fab:
    "0 10px 24px -16px oklch(56.74% 0.1585 275.21 / 0.42)",
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
  markInk:    "--yi-mark-ink",
  destructive: "--yi-destructive",
  destructiveSoft: "--yi-destructive-soft",
  ok:         "--yi-ok",
  okSoft:     "--yi-ok-soft",
  warn:       "--yi-warn",
  warnSoft:   "--yi-warn-soft",
  info:       "--yi-info",
  infoSoft:   "--yi-info-soft",
  focusRing:  "--yi-focus-ring",
};

/**
 * Generate a CSS string of custom property declarations from a color palette.
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
 * Typography + motion CSS vars (palette-independent).
 */
export function cssTypographyVars(): string {
  return `
  --yi-font-ui-2xs: ${fontSize.ui2xs};
  --yi-font-ui-xs: ${fontSize.uiXs};
  --yi-font-ui-sm: ${fontSize.uiSm};
  --yi-font-ui-md: ${fontSize.uiMd};
  --yi-font-ui-lg: ${fontSize.uiLg};
  --yi-font-title-sm: ${fontSize.titleSm};
  --yi-font-title-md: ${fontSize.titleMd};
  --yi-font-title-lg: ${fontSize.titleLg};
  --yi-leading-ui-tight: ${lineHeight.uiTight};
  --yi-leading-ui-snug: ${lineHeight.uiSnug};
  --yi-leading-ui-normal: ${lineHeight.uiNormal};
  --yi-leading-ui-relaxed: ${lineHeight.uiRelaxed};
  --yi-leading-title: ${lineHeight.title};
  --yi-duration-fast: ${duration.fast};
  --yi-duration-normal: ${duration.normal};
  --yi-duration-slow: ${duration.slow};
  `.trim();
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
    ${cssTypographyVars()}
  }`;
}
