import React from 'react'
import type { ActiveTool, AppState, MirrorAxis, PrimitiveShape } from '../types'
import type { StoreAction } from '../store'
import { getActiveModel } from '../store'

interface Props {
  state:    AppState
  dispatch: React.Dispatch<StoreAction>
}

// ── SVG icons ────────────────────────────────────────────────

function IconPolygon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      <polygon points="10,2 18,7 15,17 5,17 2,7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function IconFreehand() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      <path d="M3 15 C5 10, 7 6, 10 8 C13 10, 12 13, 15 11 C17 9, 17 7, 17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="7" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconShapes() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      <rect x="2" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconContour() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      <ellipse cx="10" cy="10" rx="7" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="10" cy="10" rx="5" ry="2.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <ellipse cx="10" cy="10" rx="2.5" ry="1" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    </svg>
  )
}

const TOOLS: { tool: ActiveTool; label: string; Icon: () => React.ReactElement }[] = [
  { tool: 'polygon',  label: 'Polygon',  Icon: IconPolygon  },
  { tool: 'freehand', label: 'Freehand', Icon: IconFreehand },
  { tool: 'shapes',   label: 'Shapes',   Icon: IconShapes   },
  { tool: 'contour',  label: 'Contour',  Icon: IconContour  },
]

const PRIMITIVES: { shape: PrimitiveShape; label: string; sym: string }[] = [
  { shape: 'rect',     label: 'Rectangle', sym: '▬' },
  { shape: 'circle',   label: 'Circle',    sym: '●' },
  { shape: 'triangle', label: 'Triangle',  sym: '▲' },
  { shape: 'hex',      label: 'Hexagon',   sym: '⬡' },
  { shape: 'pentagon', label: 'Pentagon',  sym: '⬠' },
  { shape: 'star',     label: 'Star',      sym: '★' },
]

const MIRROR_CYCLE: MirrorAxis[] = ['none', 'x', 'y', 'xy']
const MIRROR_LABELS: Record<MirrorAxis, string> = {
  none: '⊘', x: '↔', y: '↕', xy: '⊞',
}
const MIRROR_TITLES: Record<MirrorAxis, string> = {
  none: 'Mirror: off', x: 'Mirror: X axis', y: 'Mirror: Y axis', xy: 'Mirror: both axes',
}

export function ToolBar({ state, dispatch }: Props) {
  const activeModel = getActiveModel(state)
  const mirrorAxis  = activeModel?.mirrorAxis ?? 'none'

  function nextMirror() {
    if (!activeModel) return
    const idx = MIRROR_CYCLE.indexOf(mirrorAxis)
    const next = MIRROR_CYCLE[(idx + 1) % MIRROR_CYCLE.length]
    dispatch({ type: 'SET_MIRROR', id: activeModel.id, axis: next })
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      {/* Tool buttons */}
      <div className="toolbar-group">
        {TOOLS.map(({ tool, label, Icon }) => (
          <button
            key={tool}
            className={`tool-btn${state.activeTool === tool ? ' active' : ''}`}
            title={label}
            aria-pressed={state.activeTool === tool}
            onClick={() => dispatch({ type: 'SET_TOOL', tool })}
          >
            <Icon />
          </button>
        ))}
      </div>

      {/* Primitive shape picker (only when shapes tool is active) */}
      {state.activeTool === 'shapes' && (
        <div className="toolbar-group toolbar-primitives">
          {PRIMITIVES.map(({ shape, label, sym }) => (
            <button
              key={shape}
              className={`tool-btn tool-btn-sm${state.primitiveShape === shape ? ' active' : ''}`}
              title={label}
              aria-pressed={state.primitiveShape === shape}
              onClick={() => dispatch({ type: 'SET_PRIMITIVE', shape })}
            >
              <span style={{ fontSize: '11px' }}>{sym}</span>
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Mirror toggle */}
      <div className="toolbar-group">
        <button
          className={`tool-btn${mirrorAxis !== 'none' ? ' active' : ''}`}
          title={MIRROR_TITLES[mirrorAxis]}
          aria-pressed={mirrorAxis !== 'none'}
          onClick={nextMirror}
          disabled={!activeModel}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {MIRROR_LABELS[mirrorAxis]}
          </span>
        </button>
      </div>

      {/* Snap toggle */}
      <div className="toolbar-group">
        <button
          className={`tool-btn${state.snapEnabled ? ' active' : ''}`}
          title={state.snapEnabled ? 'Snap: on' : 'Snap: off'}
          aria-pressed={state.snapEnabled}
          onClick={() => dispatch({ type: 'TOGGLE_SNAP' })}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="12" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
