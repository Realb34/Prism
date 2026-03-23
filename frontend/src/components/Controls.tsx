import type { ApexAnchor, AppState } from '../types'
import type { StoreAction } from '../store'
import { getActiveModel } from '../store'
import { AccordionSection } from './AccordionSection'
import { ShapeModeCard }    from './ShapeModeCard'
import { ColorPicker }      from './ColorPicker'
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

function SliderRow({
  label, value, displayValue, min, max, step, onChange, ariaLabel,
}: {
  label:        string
  value:        number
  displayValue: string
  min:          number
  max:          number
  step:         number
  onChange:     (v: number) => void
  ariaLabel:    string
}) {
  return (
    <div className="slider-row">
      <div className="slider-row-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{displayValue}</span>
      </div>
      <input
        type="range"
        className="slider-lg"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ background: trackBg(value, min, max) }}
        aria-label={ariaLabel}
      />
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
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-surface)',
        borderLeft: '1px solid var(--c-border)',
        overflowY: 'auto',
      }}
    >
      {/* Panel header */}
      <div style={{
        height: '40px', display: 'flex', alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid var(--c-border)', flexShrink: 0, gap: '8px',
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--c-txt-3)', textTransform: 'uppercase', flex: 1 }}>
          Shape
        </span>
        {activeModel && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeModel.color, flexShrink: 0 }} />
        )}
      </div>

      {!activeModel ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: '12px' }}>
          <div style={{ fontSize: '32px', opacity: 0.2 }}>◈</div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--c-txt-3)', textAlign: 'center', lineHeight: 1.6 }}>
            Select a model<br />to edit its shape
          </span>
        </div>
      ) : (
        <>
          {/* ── Shape mode ── */}
          <AccordionSection title="Form" icon="◈" defaultOpen>
            <div className="mode-card-row">
              <ShapeModeCard
                mode="extrude"
                isActive={activeModel.shapeMode === 'extrude'}
                onClick={() => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { shapeMode: 'extrude' } })}
              />
              <ShapeModeCard
                mode="apex"
                isActive={activeModel.shapeMode === 'apex'}
                onClick={() => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { shapeMode: 'apex' } })}
              />
            </div>

            {activeModel.shapeMode === 'extrude' ? (
              <SliderRow
                label="Depth"
                value={activeModel.depth}
                displayValue={`${activeModel.depth.toFixed(1)} u`}
                min={0.1} max={15} step={0.1}
                onChange={v => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { depth: v } })}
                ariaLabel={`Extrusion depth: ${activeModel.depth.toFixed(1)}`}
              />
            ) : (
              <SliderRow
                label="Height"
                value={activeModel.height}
                displayValue={`${activeModel.height.toFixed(1)} u`}
                min={0.1} max={20} step={0.1}
                onChange={v => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { height: v } })}
                ariaLabel={`Apex height: ${activeModel.height.toFixed(1)}`}
              />
            )}
          </AccordionSection>

          {/* ── Apex anchor ── */}
          {activeModel.shapeMode === 'apex' && (
            <AccordionSection title="Anchor" icon="⊙" defaultOpen>
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
                    Add vertices to unlock
                  </span>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ── Color ── */}
          <AccordionSection title="Color" icon="◼" defaultOpen>
            <ColorPicker
              value={activeModel.color}
              onChange={c => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { color: c } })}
            />
            <div style={{ marginTop: '12px' }}>
              <SliderRow
                label="Opacity"
                value={activeModel.opacity}
                displayValue={`${Math.round(activeModel.opacity * 100)}%`}
                min={0} max={1} step={0.01}
                onChange={v => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { opacity: v } })}
                ariaLabel={`Opacity: ${Math.round(activeModel.opacity * 100)}%`}
              />
            </div>
          </AccordionSection>

          {/* ── Position ── */}
          <AccordionSection title="Position" icon="⊞" defaultOpen={false}>
            <SliderRow
              label="Z Offset"
              value={activeModel.offset.z}
              displayValue={`${activeModel.offset.z > 0 ? '+' : ''}${activeModel.offset.z.toFixed(1)}`}
              min={-10} max={10} step={0.5}
              onChange={v => dispatch({ type: 'PATCH_MODEL', id: activeModel.id, patch: { offset: { ...activeModel.offset, z: v } } })}
              ariaLabel={`Z offset: ${activeModel.offset.z.toFixed(1)}`}
            />
          </AccordionSection>

          {/* ── Info ── */}
          <AccordionSection title="Info" icon="·" defaultOpen={false}>
            <div className="info-grid">
              {[
                { label: 'Vertices', value: String(activeModel.vertices.length) },
                { label: 'Status',   value: activeModel.isClosed ? 'Closed' : 'Open', accent: activeModel.isClosed },
                { label: 'Plane',    value: activeModel.plane ?? 'XY' },
                { label: 'Mode',     value: activeModel.shapeMode },
              ].map(({ label, value, accent }) => (
                <div key={label} className="info-row">
                  <span className="info-label">{label}</span>
                  <span className={`info-value${accent ? ' accent' : ''}`}>{value}</span>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* ── Clear ── */}
          <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '1px solid var(--c-border)' }}>
            <button
              className="btn-clear"
              onClick={() => dispatch({ type: 'CLEAR_MODEL', id: activeModel.id })}
              aria-label="Clear the current sketch"
            >
              Clear sketch
            </button>
          </div>
        </>
      )}
    </div>
  )
}
