import type { Vertex2D } from '../types'

// ── Douglas-Peucker path simplification ──────────────────────
// Removes redundant collinear points within epsilon distance of
// the line between endpoints, preserving shape fidelity.

function perpDist(pt: Vertex2D, a: Vertex2D, b: Vertex2D): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
  return Math.abs(dy * pt.x - dx * pt.y + b.x * a.y - b.y * a.x) / len
}

export function douglasPeucker(pts: Vertex2D[], epsilon: number): Vertex2D[] {
  if (pts.length <= 2) return [...pts]

  let maxDist = 0, maxIdx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }

  if (maxDist > epsilon) {
    const left  = douglasPeucker(pts.slice(0, maxIdx + 1), epsilon)
    const right = douglasPeucker(pts.slice(maxIdx),         epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0], pts[pts.length - 1]]
}

// ── Chaikin corner-cutting smoothing ─────────────────────────
// Each iteration inserts two new points per edge, rounding corners.
// 2–3 iterations give a good smooth curve.

export function chaikin(pts: Vertex2D[], closed: boolean, iterations = 2): Vertex2D[] {
  let cur = [...pts]
  for (let iter = 0; iter < iterations; iter++) {
    const next: Vertex2D[] = []
    const len = closed ? cur.length : cur.length - 1
    for (let i = 0; i < len; i++) {
      const a = cur[i]
      const b = cur[(i + 1) % cur.length]
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y })
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y })
    }
    if (!closed) {
      next.unshift(cur[0])
      next.push(cur[cur.length - 1])
    }
    cur = next
  }
  return cur
}

// ── Laplacian smoothing ───────────────────────────────────────
// Moves each vertex toward the average of its two neighbours.
// Applied in-place on closed polygon vertices.

export function laplacianSmooth(verts: Vertex2D[], iterations = 2, factor = 0.5): Vertex2D[] {
  let pts = [...verts]
  const n = pts.length
  if (n < 3) return pts

  for (let iter = 0; iter < iterations; iter++) {
    pts = pts.map((p, i) => {
      const prev = pts[(i - 1 + n) % n]
      const next = pts[(i + 1) % n]
      const avgX = (prev.x + next.x) / 2
      const avgY = (prev.y + next.y) / 2
      return {
        x: p.x + factor * (avgX - p.x),
        y: p.y + factor * (avgY - p.y),
      }
    })
  }
  return pts
}

// ── Raw stroke → polygon ──────────────────────────────────────
// Simplify, optionally close, then Chaikin-smooth a raw freehand stroke.

const DP_EPSILON = 4   // canvas px — tighten for more vertices, loosen for fewer

export function strokeToPolygon(
  rawPoints: Vertex2D[],
  closed = false,
  smoothIterations = 2,
): Vertex2D[] {
  if (rawPoints.length < 2) return rawPoints
  const simplified = douglasPeucker(rawPoints, DP_EPSILON)
  if (simplified.length < 2) return simplified
  return chaikin(simplified, closed, smoothIterations)
}
