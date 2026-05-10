import type { Pin } from "./storage"

export function buildMarkDescription(pin: Pin): string {
  const lines: string[] = []
  if (pin.outerHTMLPreview) {
    lines.push("```html\n" + pin.outerHTMLPreview + "\n```")
  }
  if (pin.selector) {
    lines.push(`Selector: \`${pin.selector}\` (${pin.strategy})`)
  }
  return lines.join("\n\n")
}
