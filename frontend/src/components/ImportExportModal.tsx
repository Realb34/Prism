import { useRef, useState } from 'react'
import * as THREE from 'three'
import type { AppState, ImportedAsset, ImportedAssetFormat } from '../types'
import type { StoreAction } from '../store'
import { getWorldOffset } from '../store'
import { buildExtrudeGeometry } from '../geometry/extrude'
import { buildApexGeometry } from '../geometry/apex'
import React from 'react'

const PLANE_ROTATION: Record<string, [number, number, number]> = {
  XY: [0, 0, 0],
  XZ: [-Math.PI / 2, 0, 0],
  YZ: [0, Math.PI / 2, 0],
}

const ACCEPTED = '.glb,.gltf,.obj,.stl'

function detectFormat(name: string): ImportedAssetFormat | null {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'glb' || ext === 'gltf') return 'glb'
  if (ext === 'obj') return 'obj'
  if (ext === 'stl') return 'stl'
  return null
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportGLB(state: AppState): Promise<void> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const scene = new THREE.Scene()

  for (const m of state.models) {
    if (!m.visible || !m.isClosed || m.vertices.length < 3) continue
    try {
      const geo = m.shapeMode === 'extrude'
        ? buildExtrudeGeometry(m.vertices, m.depth)
        : buildApexGeometry(m.vertices, m.height, m.apexAnchor)
      const mat  = new THREE.MeshStandardMaterial({ color: m.color, transparent: m.opacity < 1, opacity: m.opacity })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name  = m.name
      const [rx, ry, rz] = PLANE_ROTATION[m.plane ?? 'XY']
      mesh.rotation.set(rx, ry, rz)
      const wo = getWorldOffset(state, m.id)
      mesh.position.set(wo.x / 20, wo.y / 20, wo.z)
      scene.add(mesh)
    } catch { /* skip invalid geometry */ }
  }

  const exporter = new GLTFExporter()
  exporter.parse(
    scene,
    result => {
      const data = result instanceof ArrayBuffer ? result : JSON.stringify(result)
      downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), 'prism-export.glb')
    },
    err => console.error('GLTFExporter:', err),
    { binary: true },
  )
}

async function exportSTL(state: AppState): Promise<void> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js')
  const scene = new THREE.Scene()

  for (const m of state.models) {
    if (!m.visible || !m.isClosed || m.vertices.length < 3) continue
    try {
      const geo  = m.shapeMode === 'extrude'
        ? buildExtrudeGeometry(m.vertices, m.depth)
        : buildApexGeometry(m.vertices, m.height, m.apexAnchor)
      const mesh = new THREE.Mesh(geo)
      mesh.name  = m.name
      const [rx, ry, rz] = PLANE_ROTATION[m.plane ?? 'XY']
      mesh.rotation.set(rx, ry, rz)
      scene.add(mesh)
    } catch { /* skip */ }
  }

  const exporter = new STLExporter()
  const result   = exporter.parse(scene, { binary: false })
  downloadBlob(new Blob([result], { type: 'text/plain' }), 'prism-export.stl')
}

interface Props {
  open:     boolean
  onClose:  () => void
  state:    AppState
  dispatch: React.Dispatch<StoreAction>
}

export function ImportExportModal({ open, onClose, state, dispatch }: Props) {
  const [tab,         setTab]         = useState<'import' | 'export'>('import')
  const [dragOver,    setDragOver]    = useState(false)
  const [exportFmt,   setExportFmt]   = useState<'glb' | 'stl'>('glb')
  const [exporting,   setExporting]   = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function processFile(file: File) {
    setImportError(null)
    const format = detectFormat(file.name)
    if (!format) {
      setImportError(`Unsupported format: .${file.name.split('.').pop()}`)
      return
    }
    const dataUrl = URL.createObjectURL(file)
    const asset: ImportedAsset = {
      id:      crypto.randomUUID(),
      name:    file.name.replace(/\.[^.]+$/, ''),
      format,
      dataUrl,
      visible: true,
      locked:  false,
      offset:  { x: 0, y: 0, z: 0 },
    }
    dispatch({ type: 'IMPORT_ASSET', asset })
    onClose()
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    processFile(files[0])
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (exportFmt === 'glb') await exportGLB(state)
      else await exportSTL(state)
    } finally {
      setExporting(false)
      onClose()
    }
  }

  const visibleCount = state.models.filter(m => m.visible && m.isClosed && m.vertices.length >= 3).length

  return (
    <div
      className="io-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="io-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="io-modal-header">
          <div className="io-modal-tabs">
            {(['import', 'export'] as const).map(t => (
              <button
                key={t}
                className={`io-tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'import' ? '↓ Import' : '↑ Export'}
              </button>
            ))}
          </div>
          <button className="io-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Import tab */}
        {tab === 'import' && (
          <div className="io-modal-body">
            <p className="io-hint">Supported formats: GLB, GLTF, OBJ, STL</p>

            {/* Drop zone */}
            <div
              className={`io-dropzone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                onFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Drop file here or click to browse"
            >
              <span className="io-dropzone-icon">⊕</span>
              <span className="io-dropzone-primary">Drop a 3D file here</span>
              <span className="io-dropzone-secondary">or click to browse</span>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                style={{ display: 'none' }}
                onChange={e => onFiles(e.target.files)}
              />
            </div>

            {importError && (
              <p className="io-error">{importError}</p>
            )}

            {state.importedAssets.length > 0 && (
              <div className="io-asset-list">
                <p className="io-section-label">Imported assets</p>
                {state.importedAssets.map(asset => (
                  <div key={asset.id} className="io-asset-row">
                    <span className="io-asset-format">{asset.format.toUpperCase()}</span>
                    <span className="io-asset-name">{asset.name}</span>
                    <button
                      className="io-asset-remove"
                      onClick={() => {
                        URL.revokeObjectURL(asset.dataUrl)
                        dispatch({ type: 'REMOVE_ASSET', id: asset.id })
                      }}
                      aria-label={`Remove ${asset.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export tab */}
        {tab === 'export' && (
          <div className="io-modal-body">
            <p className="io-hint">
              {visibleCount === 0
                ? 'No closed models to export — draw and close a polygon first.'
                : `Exporting ${visibleCount} model${visibleCount > 1 ? 's' : ''}`}
            </p>

            <div className="io-section-label" style={{ marginTop: '16px' }}>Format</div>
            <div className="io-format-btns">
              {(['glb', 'stl'] as const).map(fmt => (
                <button
                  key={fmt}
                  className={`io-format-btn${exportFmt === fmt ? ' active' : ''}`}
                  onClick={() => setExportFmt(fmt)}
                >
                  <span className="io-format-ext">{fmt.toUpperCase()}</span>
                  <span className="io-format-desc">
                    {fmt === 'glb' ? 'Binary GLTF · preserves color' : 'STL mesh · universal'}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="io-export-btn"
              onClick={handleExport}
              disabled={visibleCount === 0 || exporting}
            >
              {exporting ? 'Exporting…' : `Export as .${exportFmt}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
