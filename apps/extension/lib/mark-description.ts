import type { Pin } from "./storage"

function escapePlainTextHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildMarkDescription(pin: Pin): string {
  const lines: string[] = []
  const selected = pin.domSnapshot?.selectedElement
  const context = pin.domSnapshot?.context

  if (selected?.outerHTML) {
    lines.push(
      "Selected element DOM:\n```html\n" +
        escapePlainTextHtml(selected.outerHTML.slice(0, 1500)) +
        "\n```"
    )
  } else if (pin.outerHTMLPreview) {
    lines.push(
      "Selected element DOM:\n```html\n" +
        escapePlainTextHtml(pin.outerHTMLPreview) +
        "\n```"
    )
  }

  if (context?.nearbyText) {
    lines.push(`Nearby text: ${context.nearbyText.slice(0, 500)}`)
  }

  if (pin.selector) {
    lines.push(`Selector: \`${pin.selector}\` (${pin.strategy})`)
  }
  if (pin.viewport) {
    lines.push(
      `Viewport: ${pin.viewport.width}x${pin.viewport.height}@${pin.viewport.dpr}`
    )
  }
  return lines.join("\n\n")
}
