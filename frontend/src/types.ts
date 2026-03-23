// ── Primitives ───────────────────────────────────────────────
export type Vertex2D   = { x: number; y: number }
export type ShapeMode  = 'extrude' | 'apex'
export type ApexAnchor = 'centroid' | { vertexIndex: number }
export type ModelId    = string

// ── Per-model world-space translation ────────────────────────
export interface ModelOffset {
  x: number   // world units (canvas px ÷ 20)
  y: number
  z: number   // direct Three.js units — used for stacking
}

// ── Full model state ─────────────────────────────────────────
export interface ModelState {
  id:         ModelId
  name:       string
  vertices:   Vertex2D[]
  isClosed:   boolean
  shapeMode:  ShapeMode
  depth:      number      // extrude depth
  height:     number      // apex height
  apexAnchor: ApexAnchor
  visible:    boolean
  locked:     boolean
  color:      string      // hex, e.g. "#4E86D4"
  opacity:    number      // 0–1
  parentId:   ModelId | null
  offset:     ModelOffset
}

// ── App-level state ──────────────────────────────────────────
export type ActivePanel = 'sketch' | 'viewport' | 'layers' | 'parameters'

export interface AppState {
  models:        ModelState[]
  activeModelId: ModelId | null
  activePlane:   'XY' | 'XZ' | 'YZ'
  activePanel:   ActivePanel
}

// ── Computed display entry (derived, never stored) ───────────
export interface DisplayEntry {
  model: ModelState
  depth: number   // 0 = root, 1 = child, …
}

// ── Palette ──────────────────────────────────────────────────
export const MODEL_COLORS: readonly string[] = [
  '#4E86D4',  // steel blue
  '#D45E4E',  // terracotta
  '#4ED48A',  // emerald
  '#D4B44E',  // amber
  '#9B4ED4',  // violet
  '#4ECBD4',  // teal
  '#D48B4E',  // warm orange
  '#4E4ED4',  // indigo
]

// ── Factory ──────────────────────────────────────────────────
export function makeModel(
  name: string,
  index: number,
  overrides: Partial<Omit<ModelState, 'id'>> = {},
): ModelState {
  return {
    id:         crypto.randomUUID(),
    name,
    vertices:   [],
    isClosed:   false,
    shapeMode:  'extrude',
    depth:      3,
    height:     4,
    apexAnchor: 'centroid',
    visible:    true,
    locked:     false,
    color:      MODEL_COLORS[index % MODEL_COLORS.length],
    opacity:    1,
    parentId:   null,
    offset:     { x: 0, y: 0, z: 0 },
    ...overrides,
  }
}

export function makeDefaultAppState(): AppState {
  const first = makeModel('Model 1', 0)
  return {
    models:        [first],
    activeModelId: first.id,
    activePlane:   'XY',
    activePanel:   'sketch',
  }
}
