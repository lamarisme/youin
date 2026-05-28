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
  /* Paper — light inspection surfaces with a faint warm cast */
  paper:   "oklch(98.7% 0.003 78)",
  paper2:  "oklch(96.4% 0.004 78)",
  paper3:  "oklch(93.8% 0.005 78)",
  paperElevated: "oklch(99.2% 0.002 78)",

  /* Ink — foreground text */
  ink:     "oklch(18.8% 0.01 62)",
  /** Filled control hover (primary buttons on paper) */
  inkHover: "oklch(23% 0.012 62)",
  ink2:    "oklch(42% 0.009 62)",
  ink3:    "oklch(57% 0.007 62)",

  /* Rule — hairline dividers; panels use ruleStrong */
  rule:    "oklch(88.6% 0.005 78 / 0.55)",
  ruleStrong: "oklch(80.8% 0.007 78 / 0.72)",

  /* Mark — annotation ink, not generic danger red */
  mark:       "oklch(53.5% 0.19 24)",
  markBright: "oklch(59% 0.2 24)",
  markSoft:   "oklch(95.8% 0.032 24)",
  markInk:    "oklch(42% 0.14 24)",

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

  focusRing: "oklch(53.5% 0.19 24 / 0.35)",
} as const;

export const colorDark = {
  paper:   "oklch(13.5% 0.018 62)",
  paper2:  "oklch(17.2% 0.02 62)",
  paper3:  "oklch(22.5% 0.022 62)",
  paperElevated: "oklch(15.8% 0.02 62)",

  ink:     "oklch(91.8% 0.008 78)",
  inkHover: "oklch(84% 0.01 78)",
  ink2:    "oklch(70% 0.012 78)",
  ink3:    "oklch(56% 0.014 78)",

  rule:    "oklch(28% 0.024 62 / 0.65)",
  ruleStrong: "oklch(36% 0.027 62 / 0.85)",

  mark:       "oklch(63% 0.21 24)",
  markBright: "oklch(69% 0.22 24)",
  markSoft:   "oklch(25.5% 0.075 24)",
  markInk:    "oklch(78% 0.12 24)",

  destructive: "oklch(62% 0.17 28)",
  destructiveSoft: "oklch(24% 0.06 28)",

  ok:       "oklch(64% 0.13 154)",
  okSoft:   "oklch(25.5% 0.05 154)",
  warn:     "oklch(73% 0.135 82)",
  warnSoft: "oklch(27.5% 0.06 82)",
  info:     "oklch(68% 0.04 78)",
  infoSoft: "oklch(24% 0.02 62)",

  focusRing: "oklch(63% 0.21 24 / 0.4)",
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
