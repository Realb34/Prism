import { useEffect, useRef } from 'react'
import type { ModelState } from '../types'
import type { StoreAction } from '../store'

const GRID       = 20   // canvas internal px per world unit
const HIT_RADIUS = 14   // px in canvas internal space

function snap(v: number): number {
  return Math.round(v / GRID) * GRID
}

function toWorld(ix: number, iy: number, w: number, h: number): { x: number; y: number } {
  return { x: snap(ix - w / 2), y: snap(h / 2 - iy) }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface UseCanvasOptions {
  canvasRef:   React.RefObject<HTMLCanvasElement | null>
  activeModel: ModelState | null
  dispatch:    React.Dispatch<StoreAction>
}

export function useCanvas({ canvasRef, activeModel, dispatch }: UseCanvasOptions): void {
  const dragIndexRef   = useRef<number>(-1)
  const activeModelRef = useRef(activeModel)

  // Keep ref in sync with latest prop on every render — avoids stale closure
  // without re-registering the event listeners on every state update.
  activeModelRef.current = activeModel

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Prevent scroll/zoom on touch devices when interacting with the canvas
    canvas.style.touchAction = 'none'

    /** Map a client-space point to canvas internal coordinates. Works for both
     *  mouse (PointerEvent from mouse) and touch (PointerEvent from touch). */
    function getCoord(clientX: number, clientY: number): { x: number; y: number } {
      const rect   = canvas!.getBoundingClientRect()
      const cssX   = clientX - rect.left
      const cssY   = clientY - rect.top
      // Scale CSS pixels → canvas internal pixels to fix the coordinate mismatch
      // that occurs when the canvas element is displayed smaller than its resolution.
      const scaleX = canvas!.width  / rect.width
      const scaleY = canvas!.height / rect.height
      return toWorld(cssX * scaleX, cssY * scaleY, canvas!.width, canvas!.height)
    }

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary) return   // ignore secondary touches
      const model = activeModelRef.current
      if (!model || model.locked) return

      const coord             = getCoord(e.clientX, e.clientY)
      const { vertices, isClosed } = model

      // Hit test existing vertices
      const hitIdx = vertices.findIndex(v => dist(v, coord) <= HIT_RADIUS)
      if (hitIdx !== -1) {
        if (hitIdx === 0 && vertices.length >= 3) {
          // Click vertex 0 → toggle closed
          dragIndexRef.current = -1
          dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { isClosed: !isClosed } })
          return
        }
        dragIndexRef.current = hitIdx
        return
      }

      // No vertex hit — if closed, only dragging is allowed
      if (isClosed) return

      // Append new vertex
      dispatch({
        type:  'PATCH_MODEL',
        id:    model.id,
        patch: { vertices: [...vertices, coord] },
      })
    }

    function onPointerMove(e: PointerEvent) {
      if (!e.isPrimary) return
      if (dragIndexRef.current === -1) return
      const model = activeModelRef.current
      if (!model || model.locked) return

      const coord   = getCoord(e.clientX, e.clientY)
      const updated = model.vertices.map((v, i) =>
        i === dragIndexRef.current ? coord : v
      )
      dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { vertices: updated } })
    }

    function onPointerUp(e: PointerEvent) {
      if (e.isPrimary) dragIndexRef.current = -1
    }

    canvas.addEventListener('pointerdown',  onPointerDown)
    canvas.addEventListener('pointermove',  onPointerMove)
    canvas.addEventListener('pointerup',    onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown',   onPointerDown)
      canvas.removeEventListener('pointermove',   onPointerMove)
      canvas.removeEventListener('pointerup',     onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvasRef, dispatch])  // dispatch is stable; activeModel accessed via ref
}
