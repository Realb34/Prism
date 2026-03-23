import { useReducer, useEffect, useRef } from 'react'
import { reducer, getActiveModel } from './store'
import { makeDefaultAppState } from './types'
import { postActiveShape } from './api'
import { SketchPanel }    from './components/SketchPanel'
import { ViewportPanel }  from './components/ViewportPanel'
import { Controls }       from './components/Controls'
import { LayersPanel }    from './components/LayersPanel'
import type { AppState }  from './types'
import type { StoreAction } from './store'
import React from 'react'

// ── Header status pills ──────────────────────────────────────

function Pill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-txt-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: accent ? 'var(--c-accent)' : 'var(--c-txt-1)', letterSpacing: '0.02em' }}>
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: '1px', height: '18px', background: 'var(--c-border)', margin: '0 14px', flexShrink: 0 }} />
}

// ── Mobile bottom tab bar ────────────────────────────────────

const TAB_PANELS = [
  { id: 'layers' as const,     label: 'Layers' },
  { id: 'sketch' as const,     label: 'Sketch' },
  { id: 'viewport' as const,   label: '3D' },
  { id: 'parameters' as const, label: 'Params' },
]

function MobileTabBar({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<StoreAction> }) {
  return (
    <nav className="mobile-tab-bar" aria-label="Panel navigation">
      {TAB_PANELS.map(tab => (
        <button
          key={tab.id}
          onClick={() => dispatch({ type: 'SET_PANEL', panel: tab.id })}
          aria-pressed={state.activePanel === tab.id}
          className={`mobile-tab${state.activePanel === tab.id ? ' active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

// ── Root component ───────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeDefaultAppState)

  // Debounced API sync — fires when active model has a closed, valid polygon
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const active = getActiveModel(state)
    if (!active || !active.isClosed || active.vertices.length < 3) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => postActiveShape(state, active), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [state])

  const activeModel = getActiveModel(state)
  const isLive = !!activeModel?.isClosed && (activeModel.vertices.length >= 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>

      {/* ── Header bar ── */}
      <header style={{
        height: '44px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        paddingRight: '18px',
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '0 18px', height: '100%',
          borderRight: '1px solid var(--c-border)', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 1L14 7.5L7.5 14L1 7.5Z" stroke="var(--c-accent)" strokeWidth="1.2" />
            <path d="M7.5 4.5L10.5 7.5L7.5 10.5L4.5 7.5Z" fill="var(--c-accent)" opacity="0.3" />
          </svg>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '12px', letterSpacing: '0.2em', color: 'var(--c-txt-1)', textTransform: 'uppercase' }}>
            Prism
          </span>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px', height: '100%', gap: '0', overflow: 'hidden' }}>
          <Pill label="Models" value={String(state.models.length)} />
          {activeModel && (
            <>
              <Divider />
              <Pill label="Active" value={activeModel.name} />
              <Divider />
              <Pill label="Verts" value={String(activeModel.vertices.length)} />
              {isLive && (
                <>
                  <Divider />
                  <Pill label="Mode" value={activeModel.shapeMode.toUpperCase()} accent />
                </>
              )}
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Live indicator */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', animation: 'fade-in 0.25s ease' }} aria-label="Shape is live">
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--c-accent)', animation: 'pulse-live 2.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-txt-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Live
            </span>
          </div>
        )}
      </header>

      {/* ── Main panels (desktop) ── */}
      <div className="main-panels" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LayersPanel
          state={state}
          dispatch={dispatch}
          className={`panel-layers${state.activePanel === 'layers' ? ' panel-active' : ''}`}
        />
        <SketchPanel
          state={state}
          dispatch={dispatch}
          className={`panel-sketch${state.activePanel === 'sketch' ? ' panel-active' : ''}`}
        />
        <ViewportPanel
          state={state}
          className={`panel-viewport${state.activePanel === 'viewport' ? ' panel-active' : ''}`}
        />
        <Controls
          state={state}
          dispatch={dispatch}
          className={`panel-controls${state.activePanel === 'parameters' ? ' panel-active' : ''}`}
        />
      </div>

      {/* ── Mobile tab bar ── */}
      <MobileTabBar state={state} dispatch={dispatch} />
    </div>
  )
}
