/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./popup.tsx", "./contents/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        paper: "var(--yi-paper)",
        "paper-2": "var(--yi-paper-2)",
        "paper-3": "var(--yi-paper-3)",
        "paper-elevated": "var(--yi-paper-elevated)",
        ink: "var(--yi-ink)",
        "ink-hover": "var(--yi-ink-hover)",
        "ink-2": "var(--yi-ink-2)",
        "ink-3": "var(--yi-ink-3)",
        rule: "var(--yi-rule)",
        "rule-strong": "var(--yi-rule-strong)",
        mark: "var(--yi-mark)",
        "mark-bright": "var(--yi-mark-bright)",
        "mark-soft": "var(--yi-mark-soft)",
        "mark-ink": "var(--yi-mark-ink)",
        destructive: "var(--yi-destructive)",
        "destructive-soft": "var(--yi-destructive-soft)",
        ok: "var(--yi-ok)",
        "ok-soft": "var(--yi-ok-soft)",
        warn: "var(--yi-warn)",
        "warn-soft": "var(--yi-warn-soft)",
        info: "var(--yi-info)",
        "info-soft": "var(--yi-info-soft)"
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "sans-serif"
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace"
        ]
      },
      boxShadow: {
        "widget-fab":
          "0 2px 8px -2px oklch(18% 0.012 264 / 0.12), 0 8px 24px -8px oklch(56.74% 0.1585 275.21 / 0.32), inset 0 0 0 2px oklch(98.81% 0.0005 197 / 0.45)",
        "widget-panel":
          "0 1px 2px oklch(18% 0.012 264 / 0.04), 0 12px 32px -8px oklch(18% 0.012 264 / 0.12)",
        "widget-review":
          "0 4px 16px -4px oklch(18% 0.012 264 / 0.12)"
      },
      borderRadius: {
        xs: "var(--yi-radius-xs)",
        sm: "var(--yi-radius-sm)",
        md: "var(--yi-radius-md)",
        lg: "var(--yi-radius-lg)",
        xl: "var(--yi-radius-xl)",
        "2xl": "var(--yi-radius-2xl)"
      },
      fontSize: {
        "ui-2xs": "var(--yi-font-ui-2xs)",
        "ui-xs": "var(--yi-font-ui-xs)",
        "ui-sm": "var(--yi-font-ui-sm)",
        "ui-md": "var(--yi-font-ui-md)",
        "ui-lg": "var(--yi-font-ui-lg)"
      }
    }
  },
  plugins: []
}
