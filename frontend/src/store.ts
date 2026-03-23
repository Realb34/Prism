import type { AppState, ImportedAsset, ModelId, ModelState, DisplayEntry, SketchPlane } from './types'
import { makeModel } from './types'

// ── Action union ─────────────────────────────────────────────
export type StoreAction =
  | { type: 'ADD_MODEL';          name?: string }
  | { type: 'REMOVE_MODEL';       id: ModelId }
  | { type: 'PATCH_MODEL';        id: ModelId; patch: Partial<ModelState> }
  | { type: 'SET_ACTIVE';         id: ModelId | null }
  | { type: 'REORDER_MODELS';     fromIndex: number; toIndex: number }
  | { type: 'NEST_MODEL';         childId: ModelId; parentId: ModelId | null }
  | { type: 'MERGE_INTO';         sourceId: ModelId; targetId: ModelId }
  | { type: 'DUPLICATE_MODEL';    id: ModelId }
  | { type: 'CLEAR_MODEL';        id: ModelId }
  | { type: 'SET_PLANE';          plane: AppState['activePlane'] }
  | { type: 'SET_PANEL';          panel: AppState['activePanel'] }
  | { type: 'IMPORT_ASSET';       asset: ImportedAsset }
  | { type: 'REMOVE_ASSET';       id: string }
  | { type: 'PATCH_ASSET';        id: string; patch: Partial<ImportedAsset> }

// ── Root reducer ─────────────────────────────────────────────
export function reducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case 'ADD_MODEL':       return addModel(state, action.name)
    case 'REMOVE_MODEL':    return removeModel(state, action.id)
    case 'PATCH_MODEL':     return patchModel(state, action.id, action.patch)
    case 'SET_ACTIVE':      return { ...state, activeModelId: action.id }
    case 'REORDER_MODELS':  return reorderModels(state, action.fromIndex, action.toIndex)
    case 'NEST_MODEL':      return nestModel(state, action.childId, action.parentId)
    case 'MERGE_INTO':      return mergeInto(state, action.sourceId, action.targetId)
    case 'DUPLICATE_MODEL': return duplicateModel(state, action.id)
    case 'CLEAR_MODEL':     return clearModel(state, action.id)
    case 'SET_PLANE':       return { ...state, activePlane: action.plane }
    case 'SET_PANEL':       return { ...state, activePanel: action.panel }
    case 'IMPORT_ASSET':    return { ...state, importedAssets: [...state.importedAssets, action.asset] }
    case 'REMOVE_ASSET':    return { ...state, importedAssets: state.importedAssets.filter(a => a.id !== action.id) }
    case 'PATCH_ASSET':     return {
      ...state,
      importedAssets: state.importedAssets.map(a =>
        a.id === action.id ? { ...a, ...action.patch } : a
      ),
    }
  }
}

// ── Pure state functions (all exported for testing) ──────────

export function addModel(state: AppState, name?: string): AppState {
  const m = makeModel(
    name ?? `Model ${state.models.length + 1}`,
    state.models.length,
    { plane: state.activePlane },
  )
  return { ...state, models: [...state.models, m], activeModelId: m.id, activePanel: 'sketch' }
}

export function removeModel(state: AppState, id: ModelId): AppState {
  // Collect the target + all descendants
  const toRemove = new Set<ModelId>()
  const collect = (pid: ModelId) => {
    toRemove.add(pid)
    state.models.forEach(m => { if (m.parentId === pid) collect(m.id) })
  }
  collect(id)

  // Re-parent direct children to the deleted model's parent (not orphan)
  const deletedParent = state.models.find(m => m.id === id)?.parentId ?? null
  const remaining = state.models
    .filter(m => !toRemove.has(m.id))
    .map(m => m.parentId && toRemove.has(m.parentId) ? { ...m, parentId: deletedParent } : m)

  if (remaining.length === 0) {
    const fresh = makeModel('Model 1', 0, { plane: state.activePlane })
    return { ...state, models: [fresh], activeModelId: fresh.id }
  }

  const newActive = toRemove.has(state.activeModelId ?? '')
    ? remaining[remaining.length - 1].id
    : state.activeModelId

  return { ...state, models: remaining, activeModelId: newActive }
}

export function patchModel(state: AppState, id: ModelId, patch: Partial<ModelState>): AppState {
  return {
    ...state,
    models: state.models.map(m => {
      if (m.id !== id) return m
      const next = { ...m, ...patch }
      // Merge offset sub-object rather than replace to allow partial offset patches
      if (patch.offset) next.offset = { ...m.offset, ...patch.offset }
      return next
    }),
  }
}

export function reorderModels(state: AppState, fromIndex: number, toIndex: number): AppState {
  if (fromIndex === toIndex) return state
  if (fromIndex < 0 || toIndex < 0) return state
  if (fromIndex >= state.models.length || toIndex >= state.models.length) return state
  const arr = [...state.models]
  const [moved] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, moved)
  return { ...state, models: arr }
}

function wouldCreateCycle(models: ModelState[], childId: ModelId, newParentId: ModelId): boolean {
  let current: ModelId | null = newParentId
  let guard = 0
  while (current !== null && guard < 100) {
    if (current === childId) return true
    current = models.find(m => m.id === current)?.parentId ?? null
    guard++
  }
  return false
}

export function nestModel(state: AppState, childId: ModelId, parentId: ModelId | null): AppState {
  if (childId === parentId) return state
  if (parentId !== null && wouldCreateCycle(state.models, childId, parentId)) return state
  return patchModel(state, childId, { parentId })
}

export function mergeInto(state: AppState, sourceId: ModelId, targetId: ModelId): AppState {
  if (sourceId === targetId) return state
  const source = state.models.find(m => m.id === sourceId)
  const target = state.models.find(m => m.id === targetId)
  if (!source || !target) return state

  const afterPatch = patchModel(state, targetId, {
    vertices: [...target.vertices, ...source.vertices],
    isClosed: false,  // merged polygon needs manual re-closing
  })
  return removeModel(afterPatch, sourceId)
}

export function duplicateModel(state: AppState, id: ModelId): AppState {
  const src = state.models.find(m => m.id === id)
  if (!src) return state
  const copy: ModelState = {
    ...src,
    id:     crypto.randomUUID(),
    name:   `${src.name} copy`,
    offset: { ...src.offset, x: src.offset.x + 1, z: src.offset.z + 0.5 },
  }
  const idx = state.models.findIndex(m => m.id === id)
  const arr = [...state.models]
  arr.splice(idx + 1, 0, copy)
  return { ...state, models: arr, activeModelId: copy.id }
}

export function clearModel(state: AppState, id: ModelId): AppState {
  return patchModel(state, id, { vertices: [], isClosed: false })
}

// ── Derived / computed helpers ────────────────────────────────

/** Returns models in display order (top layer = index 0).
 *  Roots shown in reverse of storage order; children immediately follow parent. */
export function getDisplayOrder(state: AppState): DisplayEntry[] {
  const result: DisplayEntry[] = []

  function add(m: ModelState, depth: number) {
    result.push({ model: m, depth })
    state.models.filter(c => c.parentId === m.id).forEach(c => add(c, depth + 1))
  }

  const roots = state.models.filter(m => m.parentId === null)
  ;[...roots].reverse().forEach(r => add(r, 0))
  return result
}

/** Accumulates world-space offsets up the parent chain. */
export function getWorldOffset(state: AppState, id: ModelId): { x: number; y: number; z: number } {
  const model = state.models.find(m => m.id === id)
  if (!model) return { x: 0, y: 0, z: 0 }
  if (!model.parentId) return { ...model.offset }
  const parent = getWorldOffset(state, model.parentId)
  return {
    x: parent.x + model.offset.x,
    y: parent.y + model.offset.y,
    z: parent.z + model.offset.z,
  }
}

export function getActiveModel(state: AppState): ModelState | null {
  if (!state.activeModelId) return null
  return state.models.find(m => m.id === state.activeModelId) ?? null
}

/** Returns models that share the given sketch plane. */
export function getSamePlaneModels(state: AppState, plane: SketchPlane): ModelState[] {
  return state.models.filter(m => (m.plane ?? 'XY') === plane)
}
