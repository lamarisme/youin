/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./popup.tsx", "./contents/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        paper: "var(--yi-paper)",
        "paper-2": "var(--yi-paper-2)",
        "paper-3": "var(--yi-paper-3)",
        ink: "var(--yi-ink)",
        "ink-hover": "var(--yi-ink-hover)",
        "ink-2": "var(--yi-ink-2)",
        "ink-3": "var(--yi-ink-3)",
        rule: "var(--yi-rule)",
        mark: "var(--yi-mark)",
        "mark-bright": "var(--yi-mark-bright)",
        "mark-soft": "var(--yi-mark-soft)",
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
          "0 2px 8px -2px oklch(17.5% 0.014 255 / 0.18), 0 8px 24px -8px oklch(54% 0.2 25 / 0.45), inset 0 0 0 2px oklch(98.4% 0.003 255 / 0.4)",
        "widget-panel":
          "0 1px 2px oklch(17.5% 0.014 255 / 0.04), 0 12px 32px -8px oklch(17.5% 0.014 255 / 0.18)",
        "widget-review":
          "0 4px 16px -4px oklch(17.5% 0.014 255 / 0.18)"
      }
    }
  },
  plugins: []
}
