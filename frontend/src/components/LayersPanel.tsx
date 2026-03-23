import { useState, useRef } from 'react'
import type { AppState } from '../types'
import type { StoreAction } from '../store'
import { getDisplayOrder } from '../store'
import React from 'react'

interface Props {
  state:      AppState
  dispatch:   React.Dispatch<StoreAction>
  className?: string
}

export function LayersPanel({ state, dispatch, className }: Props) {
  const entries = getDisplayOrder(state)

  // Inline name editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')

  // HTML5 drag-and-drop reorder
  const dragEntryIdRef = useRef<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  function commitName(id: string) {
    if (editName.trim()) {
      dispatch({ type: 'PATCH_MODEL', id, patch: { name: editName.trim() } })
    }
    setEditingId(null)
  }

  function onDragStart(e: React.DragEvent, displayIdx: number, modelId: string) {
    dragEntryIdRef.current = modelId
    setDragIdx(displayIdx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragEnter(displayIdx: number) {
    setDropIdx(displayIdx)
  }

  function onDrop(e: React.DragEvent, displayIdx: number) {
    e.preventDefault()
    const sourceId = dragEntryIdRef.current
    if (!sourceId) return
    const targetId = entries[displayIdx]?.model.id
    if (!targetId || sourceId === targetId) return
    const fromIndex = state.models.findIndex(m => m.id === sourceId)
    const toIndex   = state.models.findIndex(m => m.id === targetId)
    if (fromIndex !== -1 && toIndex !== -1) {
      dispatch({ type: 'REORDER_MODELS', fromIndex, toIndex })
    }
  }

  function onDragEnd() {
    setDragIdx(null)
    setDropIdx(null)
    dragEntryIdRef.current = null
  }

  // Footer action context for the active model
  const activeIdx         = entries.findIndex(e => e.model.id === state.activeModelId)
  const activeModel       = activeIdx !== -1 ? entries[activeIdx].model : null
  const prevEntry         = activeIdx > 0 ? entries[activeIdx - 1] : null
  const canIndent         = !!prevEntry && prevEntry.model.parentId === activeModel?.parentId
  const canOutdent        = !!activeModel?.parentId
  const otherModels       = entries.filter(e => e.model.id !== state.activeModelId)

  return (
    <div
      role="region"
      aria-label="Layers"
      className={className}
      style={{
        width: '200px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        height: '40px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px 0 16px',
        borderBottom: '1px solid var(--c-border)',
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: '9px',
          letterSpacing: '0.18em',
          color: 'var(--c-txt-3)',
          textTransform: 'uppercase',
        }}>
          Layers
        </span>
        <button
          onClick={() => dispatch({ type: 'ADD_MODEL' })}
          className="layer-add-btn"
          title="Add model"
          aria-label="Add new model"
        >
          +
        </button>
      </div>

      {/* ── Layer list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.map(({ model, depth }, displayIdx) => {
          const isActive     = model.id === state.activeModelId
          const isDragging   = dragIdx === displayIdx
          const isDropTarget = dropIdx === displayIdx && dragIdx !== displayIdx
          const isEditing    = editingId === model.id

          return (
            <div
              key={model.id}
              draggable
              onDragStart={e => onDragStart(e, displayIdx, model.id)}
              onDragEnter={() => onDragEnter(displayIdx)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => onDrop(e, displayIdx)}
              onDragEnd={onDragEnd}
              onClick={() => { if (!isEditing) dispatch({ type: 'SET_ACTIVE', id: model.id }) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: `5px 8px 5px ${14 + depth * 12}px`,
                borderBottom: '1px solid var(--c-border)',
                cursor: 'default',
                background: isActive
                  ? 'var(--c-raised)'
                  : isDropTarget
                    ? 'var(--c-hover)'
                    : 'transparent',
                opacity: isDragging ? 0.35 : 1,
                transition: 'background 0.08s, opacity 0.12s',
                borderLeft: isActive ? '2px solid var(--c-accent)' : '2px solid transparent',
                boxSizing: 'border-box',
                userSelect: 'none',
              }}
            >
              {/* Drag handle */}
              <span style={{
                color: 'var(--c-txt-3)',
                fontSize: '10px',
                cursor: 'grab',
                flexShrink: 0,
                lineHeight: 1,
                opacity: 0.6,
              }}>
                ⠿
              </span>

              {/* Color dot */}
              <div style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: model.color,
                flexShrink: 0,
                opacity: model.visible ? 1 : 0.35,
              }} />

              {/* Name — editable on double-click */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => commitName(model.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitName(model.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: 'var(--c-base)',
                      border: '1px solid var(--c-accent)',
                      borderRadius: '2px',
                      color: 'var(--c-txt-1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      padding: '1px 4px',
                      width: '100%',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={e => {
                      e.stopPropagation()
                      setEditingId(model.id)
                      setEditName(model.name)
                    }}
                    title={model.name}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: isActive ? 'var(--c-txt-1)' : 'var(--c-txt-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      cursor: 'pointer',
                      opacity: model.visible ? 1 : 0.45,
                    }}
                  >
                    {model.name}
                  </span>
                )}
              </div>

              {/* Visibility toggle */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { visible: !model.visible } })
                }}
                title={model.visible ? 'Hide' : 'Show'}
                aria-label={model.visible ? 'Hide model' : 'Show model'}
                className="layer-icon-btn"
                style={{ opacity: model.visible ? 0.7 : 0.3 }}
              >
                {model.visible ? '◉' : '○'}
              </button>

              {/* Lock toggle */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  dispatch({ type: 'PATCH_MODEL', id: model.id, patch: { locked: !model.locked } })
                }}
                title={model.locked ? 'Unlock' : 'Lock'}
                aria-label={model.locked ? 'Unlock model' : 'Lock model'}
                className="layer-icon-btn"
                style={{ color: model.locked ? '#C8A840' : undefined }}
              >
                {model.locked ? '⊘' : '·'}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Footer actions ── */}
      {activeModel && (
        <div style={{
          padding: '7px 8px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex',
          gap: '3px',
          flexShrink: 0,
          background: 'var(--c-surface)',
        }}>
          {/* Duplicate */}
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_MODEL', id: activeModel.id })}
            className="layer-action-btn"
            title="Duplicate"
            aria-label="Duplicate model"
          >
            ⧉
          </button>

          {/* Indent — nest under previous sibling */}
          <button
            onClick={() => canIndent && dispatch({ type: 'NEST_MODEL', childId: activeModel.id, parentId: prevEntry!.model.id })}
            className="layer-action-btn"
            disabled={!canIndent}
            title="Nest under previous"
            aria-label="Nest under previous model"
          >
            →
          </button>

          {/* Outdent — remove from parent */}
          <button
            onClick={() => canOutdent && dispatch({ type: 'NEST_MODEL', childId: activeModel.id, parentId: null })}
            className="layer-action-btn"
            disabled={!canOutdent}
            title="Remove from parent"
            aria-label="Remove from parent"
          >
            ←
          </button>

          {/* Merge into — only when other models exist */}
          {otherModels.length > 0 && (
            <button
              onClick={() => {
                const target = otherModels[0].model
                dispatch({ type: 'MERGE_INTO', sourceId: activeModel.id, targetId: target.id })
              }}
              className="layer-action-btn"
              title={`Merge into ${otherModels[0].model.name}`}
              aria-label="Merge into first other model"
            >
              ⊕
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Delete */}
          <button
            onClick={() => dispatch({ type: 'REMOVE_MODEL', id: activeModel.id })}
            className="layer-action-btn layer-delete-btn"
            title="Delete model"
            aria-label="Delete model"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
