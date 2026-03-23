import * as THREE from 'three'
import type { Vertex2D } from '../types'
import { toVec3, triangulatePolygon, trianglesToBufferGeometry } from './utils'

// Extrude any closed polygon along +Z by `depth`.
// Produces: bottom cap + top cap + n side quads (2 tris each).
export function buildExtrudeGeometry(
  verts: Vertex2D[],
  depth: number,
): THREE.BufferGeometry {
  const n = verts.length
  const bottom = verts.map(v => toVec3(v, 0))
  const top = verts.map(v => toVec3(v, depth))

  const tris: THREE.Vector3[][] = []

  // Bottom cap (winding: clockwise when viewed from -Z, i.e. CCW from +Z)
  for (const tri of triangulatePolygon(verts, 0)) {
    tris.push([tri[0], tri[2], tri[1]])  // flip winding for outward normal
  }

  // Top cap
  tris.push(...triangulatePolygon(verts, depth))

  // Side quads: for each edge i → (i+1)%n, two triangles
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const bl = bottom[i], br = bottom[j]
    const tl = top[i],   tr = top[j]
    tris.push([bl, br, tr], [bl, tr, tl])
  }

  return trianglesToBufferGeometry(tris)
}
