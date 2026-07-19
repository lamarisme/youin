import type { ElementAnchorPoint } from "./element-fingerprint"

export interface MarkerPosition {
  center: { x: number; y: number }
  left: number
  top: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function collisionOffsets(): Array<{ x: number; y: number }> {
  const offsets = [{ x: 0, y: 0 }]
  for (let ring = 1; ring <= 6; ring++) {
    const steps = ring * 8
    const radius = ring * 20
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2 - Math.PI / 2
      offsets.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      })
    }
  }
  return offsets
}

const OFFSETS = collisionOffsets()

export function isAnchorNearViewport(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  anchorPoint: ElementAnchorPoint,
  viewport: { width: number; height: number },
  margin = 22
): boolean {
  const x = rect.left + rect.width * anchorPoint.x
  const y = rect.top + rect.height * anchorPoint.y
  return (
    x >= -margin &&
    x <= viewport.width + margin &&
    y >= -margin &&
    y <= viewport.height + margin
  )
}

export function computeMarkerPosition(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  anchorPoint: ElementAnchorPoint,
  viewport: { width: number; height: number },
  occupied: Array<{ x: number; y: number }>,
  hitTarget = 44
): MarkerPosition {
  const visualRadius = 8
  const desired = {
    x: rect.left + rect.width * anchorPoint.x,
    y: rect.top + rect.height * anchorPoint.y
  }
  let center = {
    x: clamp(desired.x, visualRadius, viewport.width - visualRadius),
    y: clamp(desired.y, visualRadius, viewport.height - visualRadius)
  }

  for (const offset of OFFSETS) {
    const candidate = {
      x: clamp(
        desired.x + offset.x,
        visualRadius,
        viewport.width - visualRadius
      ),
      y: clamp(
        desired.y + offset.y,
        visualRadius,
        viewport.height - visualRadius
      )
    }
    if (
      occupied.every(
        (position) =>
          Math.hypot(candidate.x - position.x, candidate.y - position.y) >= 18
      )
    ) {
      center = candidate
      break
    }
  }

  return {
    center,
    left: center.x - hitTarget / 2,
    top: center.y - hitTarget / 2
  }
}
