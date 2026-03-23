import type { ApexAnchor, AppState } from '../types'
import type { StoreAction } from '../store'
import { getActiveModel } from '../store'
import React from 'react'

function trackBg(value: number, min: number, max: number): string {
  const pct = Math.round(((value - min) / (max - min)) * 100)
  return `linear-gradient(to right, var(--c-accent) ${pct}%, var(--c-border-mid) ${pct}%)`
}

function apexLabel(a: ApexAnchor): string {
  return a === 'centroid' ? 'Centroid' : `Vertex ${a.vertexIndex}`
}

function apexEqual(a: ApexAnchor, b: ApexAnchor): boolean {
  if (a === 'centroid' && b === 'centroid') return true
  if (typeof a === 'object' && typeof b === 'object') return a.vertexIndex === b.vertexIndex
  return false
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '9px',
      letterSpacing: '0.16em', color: 'var(--c-txt-3)', textTransform: 'uppercase',
      marginBottom: '10px',
    }}>
      {children}
    </div>
  )
}

function Section({ children, noBorder = false }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: noBorder ? 'none' : '1px solid var(--c-border)' }}>
      {children}
    </div>
  )
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--c-txt-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--c-txt-1)', letterSpacing: '0.02em' }}>
        {value}
      </span>
    </div>
  )
}

interface Props {
  state:      AppState
  dispatch:   React.Dispatch<StoreAction>
  className?: string
}

export function Controls({ state, dispatch, className }: Props) {
  const activeModel = getActiveModel(state)

  return (
    <div
      role="complementary"
      aria-label="Shape parameters"
      className={className}
      style={{
        width: '210px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)', overflowY: 'auto',
      }}
    >
      {/* Panel label */}
      <div style={{
        height: '40px', display: 'flex', alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid var(--c-border)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--c-txt-3)', textTransform: 'uppercase' }}>
          Parameters
        </span>
      </div>

      {!activeModel ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--c-txt-3)', textAlign: 'center', lineHeight: 1.6 }}>
            No model<br />selected
          </span>
        </div>
      ) : (
        <>
          {/* ── Mode toggle ── */}
          <Section>
            <SectionLabel>Mode</SectionLabel>
            <div style={{ display: 'flex' }} role="group" aria-label="Shape mode">
              {(['extrude', 'apex'] as const).map(mode => (
                <button
                  key={mode}
                  className={`mode-btn${activeModel.shapeMode === mode ? ' mode-active' : ''}`}
                  onClick={() => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { shapeMode: mode } })}
                  aria-pressed={activeModel.shapeMode === mode}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Extrude depth ── */}
          {activeModel.shapeMode === 'extrude' && (
            <Section>
              <SectionLabel>Geometry</SectionLabel>
              <ParamRow label="Depth" value={activeModel.depth.toFixed(1)} />
              <input
                type="range" min={0.1} max={15} step={0.1}
                value={activeModel.depth}
                onChange={e => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { depth: parseFloat(e.target.value) } })}
                style={{ background: trackBg(activeModel.depth, 0.1, 15) }}
                aria-label={`Extrusion depth: ${activeModel.depth.toFixed(1)}`}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-txt-3)' }}>
                <span>0.1</span><span>15</span>
              </div>
            </Section>
          )}

          {/* ── Apex height + anchor ── */}
          {activeModel.shapeMode === 'apex' && (
            <>
              <Section>
                <SectionLabel>Geometry</SectionLabel>
                <ParamRow label="Height" value={activeModel.height.toFixed(1)} />
                <input
                  type="range" min={0.1} max={20} step={0.1}
                  value={activeModel.height}
                  onChange={e => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { height: parseFloat(e.target.value) } })}
                  style={{ background: trackBg(activeModel.height, 0.1, 20) }}
                  aria-label={`Apex height: ${activeModel.height.toFixed(1)}`}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-txt-3)' }}>
                  <span>0.1</span><span>20</span>
                </div>
              </Section>

              <Section>
                <SectionLabel>Anchor over</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {([
                    'centroid' as ApexAnchor,
                    ...activeModel.vertices.map((_, i) => ({ vertexIndex: i } as ApexAnchor)),
                  ]).map((opt, idx) => {
                    const isSelected = apexEqual(activeModel.apexAnchor, opt)
                    return (
                      <label key={idx} className={`apex-opt${isSelected ? ' apex-selected' : ''}`}>
                        <input
                          type="radio" name="apexAnchor" checked={isSelected}
                          onChange={() => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { apexAnchor: opt } })}
                        />
                        {apexLabel(opt)}
                      </label>
                    )
                  })}
                  {activeModel.vertices.length === 0 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--c-txt-3)', padding: '4px 7px', fontStyle: 'italic' }}>
                      Place vertices to add more
                    </span>
                  )}
                </div>
              </Section>
            </>
          )}

          {/* ── Appearance ── */}
          <Section>
            <SectionLabel>Appearance</SectionLabel>
            <ParamRow label="Opacity" value={`${Math.round(activeModel.opacity * 100)}%`} />
            <input
              type="range" min={0} max={1} step={0.01}
              value={activeModel.opacity}
              onChange={e => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { opacity: parseFloat(e.target.value) } })}
              style={{ background: trackBg(activeModel.opacity, 0, 1) }}
              aria-label={`Opacity: ${Math.round(activeModel.opacity * 100)}%`}
            />
          </Section>

          {/* ── Position ── */}
          <Section>
            <SectionLabel>Position</SectionLabel>
            <ParamRow label="Z Offset" value={activeModel.offset.z.toFixed(1)} />
            <input
              type="range" min={-10} max={10} step={0.5}
              value={activeModel.offset.z}
              onChange={e => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { offset: { ...activeModel.offset, z: parseFloat(e.target.value) } } })}
              style={{ background: trackBg(activeModel.offset.z + 10, 0, 20) }}
              aria-label={`Z offset: ${activeModel.offset.z.toFixed(1)}`}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-txt-3)' }}>
              <span>−10</span><span>+10</span>
            </div>
          </Section>

          {/* ── Info ── */}
          <div style={{ flex: 1 }} />
          <Section>
            <SectionLabel>Info</SectionLabel>
            {[
              { label: 'Vertices', value: String(activeModel.vertices.length) },
              { label: 'Status',   value: activeModel.isClosed ? 'Closed' : 'Open' },
              { label: 'Plane',    value: state.activePlane },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--c-txt-3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: activeModel.isClosed && label === 'Status' ? 'var(--c-accent)' : 'var(--c-txt-2)' }}>
                  {value}
                </span>
              </div>
            ))}
          </Section>

          {/* ── Clear ── */}
          <Section noBorder>
            <button
              className="btn-clear"
              onClick={() => dispatch({ type: 'CLEAR_MODEL', id: activeModel.id })}
              aria-label="Clear the current sketch"
            >
              Clear sketch
            </button>
          </Section>
        </>
      )}
    </div>
  )
}
