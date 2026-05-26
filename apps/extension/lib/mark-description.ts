import type { Mark } from "./storage"

function escapePlainTextHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildMarkDescription(mark: Mark): string {
  const lines: string[] = []
  const selected = mark.domSnapshot?.selectedElement
  const context = mark.domSnapshot?.context

  if (mark.captureKind === "region") {
    lines.push(
      `Screenshot region: ${Math.round(mark.bbox.width)}x${Math.round(
        mark.bbox.height
      )} at ${Math.round(mark.bbox.x)},${Math.round(mark.bbox.y)}`
    )
    if (mark.pageTitle) {
      lines.push(`Page title: ${mark.pageTitle.slice(0, 280)}`)
    }
  }

  if (selected?.outerHTML) {
    lines.push(
      "Selected element DOM:\n```html\n" +
        escapePlainTextHtml(selected.outerHTML.slice(0, 1500)) +
        "\n```"
    )
  } else if (mark.outerHTMLPreview) {
    lines.push(
      "Selected element DOM:\n```html\n" +
        escapePlainTextHtml(mark.outerHTMLPreview) +
        "\n```"
    )
  }

  if (context?.nearbyText) {
    lines.push(`Nearby text: ${context.nearbyText.slice(0, 500)}`)
  }

  if (mark.selector) {
    lines.push(`Selector: \`${mark.selector}\` (${mark.strategy})`)
  }
  if (mark.viewport) {
    lines.push(
      `Viewport: ${mark.viewport.width}x${mark.viewport.height}@${mark.viewport.dpr}`
    )
  }
  return lines.join("\n\n")
}
