import * as THREE from 'three'
import type { Vertex2D } from '../types'

// Pixels-per-world-unit: 1 grid cell (20px) = 1 three.js unit
export const SCALE = 1 / 20

export function toVec3(v: Vertex2D, z = 0): THREE.Vector3 {
  return new THREE.Vector3(v.x * SCALE, v.y * SCALE, z)
}

// Fan-triangulate a convex polygon: vertex 0 as the hub.
// Works correctly for any convex n-gon (triangle, quad, pentagon, ...).
// For concave polygons a proper ear-clipping triangulation would be needed.
export function triangulatePolygon(verts: Vertex2D[], z = 0): THREE.Vector3[][] {
  const pts = verts.map(v => toVec3(v, z))
  const tris: THREE.Vector3[][] = []
  for (let i = 1; i < pts.length - 1; i++) {
    tris.push([pts[0], pts[i], pts[i + 1]])
  }
  return tris
}

// Build a non-indexed BufferGeometry from a flat list of triangles.
// Non-indexed → computeVertexNormals gives per-face flat normals.
export function trianglesToBufferGeometry(tris: THREE.Vector3[][]): THREE.BufferGeometry {
  const positions: number[] = []
  for (const [a, b, c] of tris) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}
