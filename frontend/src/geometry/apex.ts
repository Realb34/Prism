import * as THREE from 'three'
import type { Vertex2D, ApexAnchor } from '../types'
import { SCALE, toVec3, triangulatePolygon, trianglesToBufferGeometry } from './utils'

function getApexXY(verts: Vertex2D[], anchor: ApexAnchor): { x: number; y: number } {
  if (anchor === 'centroid') {
    const x = verts.reduce((s, v) => s + v.x, 0) / verts.length
    const y = verts.reduce((s, v) => s + v.y, 0) / verts.length
    return { x, y }
  }
  const idx = Math.min(anchor.vertexIndex, verts.length - 1)
  return verts[idx]
}

// Build an apex (pyramid-like) solid for any closed polygon.
// Base sits at Z=0; apex is placed at (apexX, apexY, height).
export function buildApexGeometry(
  verts: Vertex2D[],
  height: number,
  anchor: ApexAnchor,
): THREE.BufferGeometry {
  const n = verts.length
  const base = verts.map(v => toVec3(v, 0))

  const { x: ax, y: ay } = getApexXY(verts, anchor)
  const apex = new THREE.Vector3(ax * SCALE, ay * SCALE, height)

  const tris: THREE.Vector3[][] = []

  // Base cap (flip winding so normal points down / outward from -Z)
  for (const tri of triangulatePolygon(verts, 0)) {
    tris.push([tri[0], tri[2], tri[1]])
  }

  // Side faces: each base edge connects to the apex
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    tris.push([base[i], base[j], apex])
  }

  return trianglesToBufferGeometry(tris)
}
