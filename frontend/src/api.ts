import type { AppState, ModelState } from './types'

export function postActiveShape(state: AppState, activeModel: ModelState): void {
  if (!activeModel.isClosed || activeModel.vertices.length < 3) return

  const body = {
    vertices:     activeModel.vertices,
    is_closed:    activeModel.isClosed,
    shape_mode:   activeModel.shapeMode,
    depth:        activeModel.depth,
    height:       activeModel.height,
    apex_anchor:  activeModel.apexAnchor,
    active_plane: state.activePlane,
    model_id:     activeModel.id,
    model_name:   activeModel.name,
  }

  fetch('/api/shape', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => { /* fire-and-forget */ })
}
