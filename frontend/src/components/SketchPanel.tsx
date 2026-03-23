import { useRef, useEffect } from 'react'
import type { AppState, Vertex2D, ModelState } from '../types'
import type { StoreAction } from '../store'
import { getActiveModel, getWorldOffset } from '../store'
import { useCanvas } from '../hooks/useCanvas'

const GRID        = 20
const CANVAS_SIZE = 600

function toCanvas(v: Vertex2D, size: number): [number, number] {
  return [v.x + size / 2, size / 2 - v.y]
}

// Convert world-unit offset (from getWorldOffset) to canvas pixel offset
function worldOffsetToPx(ox: number, oy: number): [number, number] {
  return [ox * GRID, -oy * GRID]   // Y is inverted in canvas space
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/** Draw a ghost outline for a non-active model. */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  model: ModelState,
  pxOffsetX: number,
  pxOffsetY: number,
  W: number,
): void {
  if (model.vertices.length < 2) return
  const pts = model.vertices.map(v =>
    toCanvas({ x: v.x + pxOffsetX, y: v.y + pxOffsetY }, W) as [number, number]
  )

  const [r, g, b] = hexToRgb(model.color)

  // Subtle fill
  if (model.isClosed && pts.length >= 3) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath()
    ctx.fillStyle = `rgba(${r},${g},${b},0.06)`
    ctx.fill()
  }

  // Stroke
  ctx.strokeStyle = `rgba(${r},${g},${b},0.30)`
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  if (model.isClosed) ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  // Name label at centroid
  if (pts.length >= 3) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
    ctx.fillStyle = `rgba(${r},${g},${b},0.55)`
    ctx.font      = "9px 'Syne', system-ui"
    ctx.textAlign = 'center'
    ctx.fillText(model.name, cx, cy)
  }
}

interface Props {
  state:    AppState
  dispatch: React.Dispatch<StoreAction>
  className?: string
}

export function SketchPanel({ state, dispatch, className }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const activeModel = getActiveModel(state)

  useCanvas({ canvasRef, activeModel, dispatch })

  // Redraw canvas whenever relevant state changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // ── Background — warm drafting paper ──
    ctx.fillStyle = '#EDE9E1'
    ctx.fillRect(0, 0, W, H)

    // ── Grid ──
    ctx.strokeStyle = '#D5D1C8'
    ctx.lineWidth   = 0.5
    for (let x = W / 2 % GRID; x <= W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = H / 2 % GRID; y <= H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // ── Axes ──
    ctx.strokeStyle = '#B4B0A8'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()

    // ── Axis labels ──
    ctx.fillStyle = '#C0BCB4'
    ctx.font      = "9px 'Syne Mono', monospace"
    ctx.textAlign = 'left'
    ctx.fillText('X', W - 14, H / 2 - 5)
    ctx.fillText('Y', W / 2 + 5, 12)

    // ── Vignette ──
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.055)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, W, H)

    // ── Ghost outlines for other visible models ──
    const otherModels = state.models.filter(
      m => m.id !== state.activeModelId && m.visible && m.vertices.length >= 2
    )
    for (const m of otherModels) {
      const wo = getWorldOffset(state, m.id)
      const [ox, oy] = worldOffsetToPx(wo.x, wo.y)
      drawGhost(ctx, m, ox, oy, W)
    }

    // ── Active model ──
    const { vertices, isClosed } = activeModel ?? { vertices: [], isClosed: false }

    if (vertices.length === 0) {
      const cx = W / 2, cy = H / 2, r = 52
      ctx.strokeStyle = '#C4C0B8'
      ctx.lineWidth   = 0.75
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy)
      ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy)
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#A09890'
      ctx.font      = "13px 'Syne', system-ui"
      ctx.textAlign = 'center'
      ctx.fillText(
        activeModel
          ? `${activeModel.name} — click to place vertices`
          : 'Select or add a model',
        cx, cy + r + 26
      )
      ctx.font      = "11px 'Syne', system-ui"
      ctx.fillStyle = '#78736C'
      ctx.fillText('≥ 3 pts · click vertex 0 to close', cx, cy + r + 44)
      return
    }

    const pts = vertices.map(v => toCanvas(v, W))

    // Polygon fill (closed only)
    if (isClosed && pts.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fillStyle = 'rgba(232, 88, 32, 0.07)'
      ctx.fill()
    }

    // Edges
    ctx.lineWidth = 1.5
    if (isClosed) {
      ctx.strokeStyle = '#2A2620'
      ctx.setLineDash([])
    } else {
      ctx.strokeStyle = '#E85820'
      ctx.setLineDash([5, 4])
    }
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    if (isClosed) ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])

    // Locked overlay indicator
    if (activeModel?.locked) {
      ctx.fillStyle = 'rgba(200,160,80,0.08)'
      ctx.fillRect(0, 0, W, H)
    }

    // Vertices
    pts.forEach(([cx, cy], i) => {
      const isFirst  = i === 0
      const canClose = isFirst && !isClosed && vertices.length >= 3

      if (canClose) {
        // Crosshair close-affordance
        ctx.strokeStyle = 'rgba(42, 158, 106, 0.32)'
        ctx.lineWidth   = 0.75
        ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.fillStyle   = '#2A9E6A'
        ctx.fill()
        ctx.strokeStyle = '#EDE9E1'
        ctx.lineWidth   = 1.5
        ctx.stroke()
      } else if (isFirst && isClosed) {
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(232, 88, 32, 0.25)'
        ctx.lineWidth   = 1.5
        ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle   = '#E85820'
        ctx.fill()
        ctx.strokeStyle = '#EDE9E1'
        ctx.lineWidth   = 1.5
        ctx.stroke()
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle   = '#E85820'
        ctx.fill()
        ctx.strokeStyle = '#EDE9E1'
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      ctx.fillStyle = '#6B6760'
      ctx.font      = "9px 'Syne Mono', monospace"
      ctx.textAlign = 'left'
      ctx.fillText(String(i), cx + 9, cy - 5)
    })

    // Status hint
    ctx.fillStyle = '#9A9590'
    ctx.font      = "11px 'Syne', system-ui"
    ctx.textAlign = 'left'
    if (activeModel?.locked) {
      ctx.fillStyle = '#C8A840'
      ctx.fillText('Model is locked', 12, H - 13)
    } else if (!isClosed && vertices.length >= 3) {
      ctx.fillText('Click vertex 0 to close polygon', 12, H - 13)
    } else if (isClosed) {
      ctx.fillText('Drag to reshape  ·  Click vertex 0 to re-open', 12, H - 13)
    } else if (vertices.length > 0) {
      ctx.fillText(`${vertices.length} pt${vertices.length > 1 ? 's' : ''} — need ${3 - vertices.length} more`, 12, H - 13)
    }
  }, [state, activeModel])   // redraws when any model changes or active model changes

  return (
    <div
      role="region"
      aria-label="2D sketch canvas"
      className={className}
      style={{
        flex: '0 0 auto',
        width: '500px',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border)',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div style={{ height: '40px', flexShrink: 0, display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderRight: '1px solid var(--c-border)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--c-txt-3)', textTransform: 'uppercase' }}>
            Sketch
          </span>
        </div>
        {(['XY', 'XZ', 'YZ'] as const).map(plane => (
          <button
            key={plane}
            className={[
              'plane-tab',
              state.activePlane === plane ? 'active' : '',
              plane === 'XY' ? 'interactive' : '',
            ].join(' ')}
            onClick={() => plane === 'XY' && dispatch({ type: 'SET_PLANE', plane })}
            disabled={plane !== 'XY'}
            aria-pressed={state.activePlane === plane}
          >
            {plane}
          </button>
        ))}
        {activeModel && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '12px', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeModel.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-txt-2)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeModel.name}
            </span>
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden', background: 'var(--c-base)' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            cursor: activeModel?.locked ? 'not-allowed' : 'crosshair',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            boxShadow: '0 2px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)',
          }}
          aria-label="Drawing canvas — click to place vertices"
        />
      </div>
    </div>
  )
}
