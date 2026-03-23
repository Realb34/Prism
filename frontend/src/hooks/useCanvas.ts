import { useEffect, useRef } from 'react'
import type { AppState, Vertex2D } from '../types'
import type { StoreAction } from '../store'
import { getActiveModel } from '../store'
import { strokeToPolygon } from '../geometry/smooth'
import { buildPrimitive } from '../geometry/primitives'

const GRID       = 20
const HIT_RADIUS = 14
const SNAP_RADIUS = 16

function snapG(v: number): number { return Math.round(v / GRID) * GRID }

function toWorld(ix: number, iy: number, w: number, h: number): Vertex2D {
  return { x: snapG(ix - w / 2), y: snapG(h / 2 - iy) }
}

function toWorldRaw(ix: number, iy: number, w: number, h: number): Vertex2D {
  return { x: ix - w / 2, y: h / 2 - iy }
}

function dist(a: Vertex2D, b: Vertex2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function toCanvas(v: Vertex2D, w: number, h: number): [number, number] {
  return [v.x + w / 2, h / 2 - v.y]
}

function findSnapPoint(state: AppState, coord: Vertex2D, excludeId?: string): Vertex2D | null {
  if (!state.snapEnabled) return null
  let best: Vertex2D | null = null
  let bestDist = SNAP_RADIUS

  for (const model of state.models) {
    if (model.id === excludeId || model.vertices.length === 0) continue
    for (const v of model.vertices) {
      const d = dist(v, coord)
      if (d < bestDist) { bestDist = d; best = v }
    }
    for (let i = 0; i < model.vertices.length - 1; i++) {
      const mid: Vertex2D = {
        x: (model.vertices[i].x + model.vertices[i + 1].x) / 2,
        y: (model.vertices[i].y + model.vertices[i + 1].y) / 2,
      }
      const d = dist(mid, coord)
      if (d < bestDist) { bestDist = d; best = mid }
    }
  }
  return best
}

interface UseCanvasOptions {
  canvasRef:  React.RefObject<HTMLCanvasElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  state:      AppState
  dispatch:   React.Dispatch<StoreAction>
}

export function useCanvas({ canvasRef, overlayRef, state, dispatch }: UseCanvasOptions): void {
  const stateRef      = useRef(state)
  stateRef.current    = state

  const dragIndexRef  = useRef<number>(-1)
  const freehandRef   = useRef<Vertex2D[]>([])
  const contourRef    = useRef<Vertex2D[]>([])
  const shapeDragRef  = useRef<{ cx: number; cy: number } | null>(null)
  const isDrawingRef  = useRef(false)

  // ── Overlay drawing helpers ─────────────────────────────────

  const drawOverlayRef = useRef<(liveStroke: Vertex2D[] | null, snapPt: Vertex2D | null, previewVerts: Vertex2D[] | null) => void>(() => {})

  drawOverlayRef.current = (liveStroke, snapPt, previewVerts) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    const W = overlay.width, H = overlay.height
    ctx.clearRect(0, 0, W, H)

    const s = stateRef.current
    const model = getActiveModel(s)

    // Mirror guide lines
    const mirrorAxis = model?.mirrorAxis ?? 'none'
    if (mirrorAxis !== 'none') {
      ctx.strokeStyle = 'rgba(255, 210, 80, 0.38)'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      if (mirrorAxis === 'x' || mirrorAxis === 'xy') {
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      }
      if (mirrorAxis === 'y' || mirrorAxis === 'xy') {
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // Live freehand / contour stroke
    if (liveStroke && liveStroke.length >= 2) {
      const pts = liveStroke.map(v => toCanvas(v, W, H))
      ctx.strokeStyle = 'rgba(232, 88, 32, 0.65)'
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.stroke()
    }

    // Shape preview
    if (previewVerts && previewVerts.length >= 3) {
      const pts = previewVerts.map(v => toCanvas(v, W, H))
      ctx.strokeStyle = 'rgba(232, 88, 32, 0.75)'
      ctx.fillStyle   = 'rgba(232, 88, 32, 0.06)'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([5, 3])
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Snap indicator crosshair
    if (snapPt) {
      const [cx, cy] = toCanvas(snapPt, W, H)
      ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)'
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke()
    }
  }

  // ── Static overlay (mirror guides only, no interaction) ─────

  useEffect(() => {
    drawOverlayRef.current(null, null, null)
  }, [state.activeModelId, state.models])

  // ── Pointer events ──────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.touchAction = 'none'

    function getCoord(clientX: number, clientY: number): Vertex2D {
      const rect   = canvas!.getBoundingClientRect()
      const scaleX = canvas!.width  / rect.width
      const scaleY = canvas!.height / rect.height
      return toWorld(
        (clientX - rect.left) * scaleX,
        (clientY - rect.top)  * scaleY,
        canvas!.width, canvas!.height,
      )
    }

    function getRawCoord(clientX: number, clientY: number): Vertex2D {
      const rect   = canvas!.getBoundingClientRect()
      const scaleX = canvas!.width  / rect.width
      const scaleY = canvas!.height / rect.height
      return toWorldRaw(
        (clientX - rect.left) * scaleX,
        (clientY - rect.top)  * scaleY,
        canvas!.width, canvas!.height,
      )
    }

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary) return
      const s     = stateRef.current
      const model = getActiveModel(s)
      if (!model || model.locked) return

      const coord     = getCoord(e.clientX, e.clientY)
      const rawCoord  = getRawCoord(e.clientX, e.clientY)
      const snapPt    = findSnapPoint(s, coord, model.id)
      const effective = snapPt ?? coord

      switch (s.activeTool) {
        case 'polygon': {
          const { vertices, isClosed } = model
          const hitIdx = vertices.findIndex(v => dist(v, effective) <= HIT_RADIUS)

          if (hitIdx !== -1) {
            if (hitIdx === 0 && vertices.length >= 3) {
              dragIndexRef.current = -1
              dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { isClosed: !isClosed } })
              return
            }
            dragIndexRef.current = hitIdx
            return
          }
          if (isClosed) return
          dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { vertices: [...vertices, effective] } })
          break
        }

        case 'freehand': {
          isDrawingRef.current  = true
          freehandRef.current   = [rawCoord]
          canvas!.setPointerCapture(e.pointerId)
          break
        }

        case 'shapes': {
          isDrawingRef.current  = true
          shapeDragRef.current  = { cx: effective.x, cy: effective.y }
          canvas!.setPointerCapture(e.pointerId)
          break
        }

        case 'contour': {
          isDrawingRef.current  = true
          contourRef.current    = [rawCoord]
          canvas!.setPointerCapture(e.pointerId)
          break
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!e.isPrimary) return
      const s     = stateRef.current
      const model = getActiveModel(s)
      if (!model || model.locked) return

      const coord    = getCoord(e.clientX, e.clientY)
      const rawCoord = getRawCoord(e.clientX, e.clientY)
      const snapPt   = findSnapPoint(s, coord, model.id)

      switch (s.activeTool) {
        case 'polygon': {
          if (dragIndexRef.current === -1) {
            drawOverlayRef.current(null, snapPt, null)
            return
          }
          const effective = snapPt ?? coord
          const updated   = model.vertices.map((v, i) =>
            i === dragIndexRef.current ? effective : v
          )
          dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { vertices: updated } })
          break
        }

        case 'freehand': {
          if (!isDrawingRef.current) break
          freehandRef.current = [...freehandRef.current, rawCoord]
          drawOverlayRef.current(freehandRef.current, null, null)
          break
        }

        case 'shapes': {
          if (!isDrawingRef.current || !shapeDragRef.current) break
          const { cx, cy } = shapeDragRef.current
          const size = Math.max(GRID, snapG(Math.hypot(coord.x - cx, coord.y - cy)))
          const preview = buildPrimitive(s.primitiveShape, cx, cy, size)
          drawOverlayRef.current(null, null, preview)
          break
        }

        case 'contour': {
          if (!isDrawingRef.current) break
          contourRef.current = [...contourRef.current, rawCoord]
          drawOverlayRef.current(contourRef.current, null, null)
          break
        }
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!e.isPrimary) return
      const s     = stateRef.current
      const model = getActiveModel(s)

      switch (s.activeTool) {
        case 'polygon': {
          dragIndexRef.current = -1
          break
        }

        case 'freehand': {
          if (!isDrawingRef.current || !model || model.locked) break
          isDrawingRef.current = false
          const pts = freehandRef.current
          if (pts.length >= 3) {
            const smoothed = strokeToPolygon(pts, false, 2)
            if (smoothed.length >= 3) {
              dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { vertices: smoothed, isClosed: false } })
            }
          }
          freehandRef.current = []
          drawOverlayRef.current(null, null, null)
          break
        }

        case 'shapes': {
          if (!isDrawingRef.current || !model || model.locked || !shapeDragRef.current) break
          isDrawingRef.current = false
          const endCoord = getCoord(e.clientX, e.clientY)
          const { cx, cy } = shapeDragRef.current
          const size = Math.max(GRID, snapG(Math.hypot(endCoord.x - cx, endCoord.y - cy)))
          const verts = buildPrimitive(s.primitiveShape, cx, cy, size)
          dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { vertices: verts, isClosed: true } })
          shapeDragRef.current = null
          drawOverlayRef.current(null, null, null)
          break
        }

        case 'contour': {
          if (!isDrawingRef.current || !model || model.locked) break
          isDrawingRef.current = false
          const pts = contourRef.current
          if (pts.length >= 3) {
            const simplified = strokeToPolygon(pts, false, 1)
            dispatch({
              type:   'ADD_CONTOUR',
              id:     model.id,
              stroke: { id: crypto.randomUUID(), plane: s.activePlane, points: simplified },
            })
          }
          contourRef.current = []
          drawOverlayRef.current(null, null, null)
          break
        }
      }
    }

    canvas.addEventListener('pointerdown',   onPointerDown)
    canvas.addEventListener('pointermove',   onPointerMove)
    canvas.addEventListener('pointerup',     onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown',   onPointerDown)
      canvas.removeEventListener('pointermove',   onPointerMove)
      canvas.removeEventListener('pointerup',     onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvasRef, overlayRef, dispatch])
}
