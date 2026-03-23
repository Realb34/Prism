import type { Vertex2D } from '../types'

const GRID = 20

function gridSnap(v: number): number {
  return Math.round(v / GRID) * GRID
}

function snapV(v: Vertex2D): Vertex2D {
  return { x: gridSnap(v.x), y: gridSnap(v.y) }
}

// Regular n-gon centered at (cx, cy) with circumradius r.
// rotOffset shifts all vertices by the given angle (radians).
export function ngon(cx: number, cy: number, r: number, sides: number, rotOffset = 0): Vertex2D[] {
  const pts: Vertex2D[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i / sides) - Math.PI / 2 + rotOffset
    pts.push(snapV({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }))
  }
  return pts
}

// Axis-aligned rectangle centered at (cx, cy) with given width and height.
export function rect(cx: number, cy: number, w: number, h: number): Vertex2D[] {
  const hw = gridSnap(w / 2)
  const hh = gridSnap(h / 2)
  return [
    snapV({ x: cx - hw, y: cy - hh }),
    snapV({ x: cx + hw, y: cy - hh }),
    snapV({ x: cx + hw, y: cy + hh }),
    snapV({ x: cx - hw, y: cy + hh }),
  ]
}

// Star polygon with `points` points, outer and inner radii.
export function star(cx: number, cy: number, outer: number, inner: number, points: number): Vertex2D[] {
  const pts: Vertex2D[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i / points) - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(snapV({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }))
  }
  return pts
}

export type PrimitiveType = 'rect' | 'circle' | 'triangle' | 'hex' | 'pentagon' | 'star'

// Build a primitive from a center point, type, and bounding half-size (canvas px).
// The size parameter is the outer radius (or half-extent for rect).
export function buildPrimitive(
  type: PrimitiveType,
  cx: number,
  cy: number,
  size: number,
): Vertex2D[] {
  const s = Math.max(GRID, size)
  switch (type) {
    case 'rect':     return rect(cx, cy, s * 2, s * 2)
    case 'circle':   return ngon(cx, cy, s, 24)
    case 'triangle': return ngon(cx, cy, s, 3)
    case 'hex':      return ngon(cx, cy, s, 6, Math.PI / 6)
    case 'pentagon': return ngon(cx, cy, s, 5)
    case 'star':     return star(cx, cy, s, s * 0.45, 5)
  }
}
