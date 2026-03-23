import * as THREE from 'three'
import type { Vertex2D, ContourStroke } from '../types'
import { SCALE } from './utils'

// ── Convex hull (Graham scan) ─────────────────────────────────
// Returns the convex hull of a point set in CCW order.
export function convexHull(pts: Vertex2D[]): Vertex2D[] {
  if (pts.length <= 2) return [...pts]

  // Find pivot: lowest y, then leftmost x
  const pivot = pts.reduce((a, b) =>
    a.y < b.y || (a.y === b.y && a.x < b.x) ? a : b
  )

  const sorted = [...pts]
    .filter(p => p !== pivot)
    .sort((a, b) => {
      const aa = Math.atan2(a.y - pivot.y, a.x - pivot.x)
      const ab = Math.atan2(b.y - pivot.y, b.x - pivot.x)
      if (aa !== ab) return aa - ab
      return Math.hypot(a.x - pivot.x, a.y - pivot.y) - Math.hypot(b.x - pivot.x, b.y - pivot.y)
    })

  const hull: Vertex2D[] = [pivot]
  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2]
      const b = hull[hull.length - 1]
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
      if (cross <= 0) hull.pop()
      else break
    }
    hull.push(p)
  }
  return hull
}

// ── Cross-section extent query ────────────────────────────────
// Given a closed polygon and a horizontal scan level (v.y ≈ level),
// returns [xMin, xMax] of intersection x values.
// Used to slice XZ/YZ contours at a given depth (Z level).
export function getExtentAtLevel(hull: Vertex2D[], level: number): [number, number] | null {
  const xs: number[] = []
  const n = hull.length
  for (let i = 0; i < n; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % n]
    if ((a.y <= level && b.y >= level) || (a.y >= level && b.y <= level)) {
      if (Math.abs(b.y - a.y) < 1e-9) continue
      const t = (level - a.y) / (b.y - a.y)
      xs.push(a.x + t * (b.x - a.x))
    }
  }
  if (xs.length === 0) return null
  return [Math.min(...xs), Math.max(...xs)]
}

// ── Ring-to-geometry ──────────────────────────────────────────
// Connects a sequence of rings into a closed tube geometry.
function ringsToGeometry(rings: THREE.Vector3[][], segments: number): THREE.BufferGeometry {
  const positions: number[] = []

  function push(...verts: THREE.Vector3[]) {
    for (const v of verts) positions.push(v.x, v.y, v.z)
  }

  // Side quads between rings
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r]
    const b = rings[r + 1]
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments
      push(a[i], b[i], a[j])
      push(a[j], b[i], b[j])
    }
  }

  // Bottom cap
  const bot = rings[0]
  const botC = bot.reduce((acc, v) => acc.clone().add(v), new THREE.Vector3()).divideScalar(segments)
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments
    push(botC.clone(), bot[j].clone(), bot[i].clone())
  }

  // Top cap
  const top = rings[rings.length - 1]
  const topC = top.reduce((acc, v) => acc.clone().add(v), new THREE.Vector3()).divideScalar(segments)
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments
    push(topC.clone(), top[i].clone(), top[j].clone())
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

// ── Organic synthesis ─────────────────────────────────────────
// Synthesises a 3D volume from multi-plane contour strokes by
// ellipse-lofting: for each Z slice, XZ strokes give X extent and
// YZ strokes give Y extent; the cross-section is an ellipse.
//
// Coordinate convention (matches canvas → world mapping):
//   XZ stroke: v.x = world X (canvas units), v.y = world Z
//   YZ stroke: v.x = world Y (canvas units), v.y = world Z
//   XY stroke: v.x = world X, v.y = world Y  (not used for lofting)

export function synthesizeOrganic(
  contours: ContourStroke[],
  slices = 16,
  ringSegments = 24,
): THREE.BufferGeometry {
  const xzAll = contours.filter(c => c.plane === 'XZ').flatMap(c => c.points)
  const yzAll = contours.filter(c => c.plane === 'YZ').flatMap(c => c.points)

  if (xzAll.length < 3 && yzAll.length < 3) return new THREE.BufferGeometry()

  // Z range from available contours
  const zPts = [...xzAll, ...yzAll].map(p => p.y)
  const zMin = Math.min(...zPts)
  const zMax = Math.max(...zPts)
  if (Math.abs(zMax - zMin) < 1) return new THREE.BufferGeometry()

  const xzHull = xzAll.length >= 3 ? convexHull(xzAll) : null
  const yzHull = yzAll.length >= 3 ? convexHull(yzAll) : null

  // Default extent fallback from bounding box of existing points
  const xAllVals = xzAll.map(p => p.x)
  const yAllVals = yzAll.map(p => p.x)
  const xDef: [number, number] = xzAll.length > 0
    ? [Math.min(...xAllVals), Math.max(...xAllVals)]
    : [-40, 40]
  const yDef: [number, number] = yzAll.length > 0
    ? [Math.min(...yAllVals), Math.max(...yAllVals)]
    : [-40, 40]

  const rings: THREE.Vector3[][] = []

  for (let s = 0; s <= slices; s++) {
    const z = zMin + (s / slices) * (zMax - zMin)

    const xExt = xzHull ? (getExtentAtLevel(xzHull, z) ?? xDef) : xDef
    const yExt = yzHull ? (getExtentAtLevel(yzHull, z) ?? yDef) : yDef

    const cx = (xExt[0] + xExt[1]) / 2
    const cy = (yExt[0] + yExt[1]) / 2
    const rx = Math.max(1, (xExt[1] - xExt[0]) / 2)
    const ry = Math.max(1, (yExt[1] - yExt[0]) / 2)

    const ring: THREE.Vector3[] = []
    for (let i = 0; i < ringSegments; i++) {
      const angle = (2 * Math.PI * i) / ringSegments
      ring.push(new THREE.Vector3(
        (cx + rx * Math.cos(angle)) * SCALE,
        (cy + ry * Math.sin(angle)) * SCALE,
        z * SCALE,
      ))
    }
    rings.push(ring)
  }

  return ringsToGeometry(rings, ringSegments)
}
