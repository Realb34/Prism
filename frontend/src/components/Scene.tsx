import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import type { AppState, ModelState } from '../types'
import { getWorldOffset } from '../store'
import { buildExtrudeGeometry } from '../geometry/extrude'
import { buildApexGeometry } from '../geometry/apex'

const GRID = 20  // canvas px per world unit — must match useCanvas.ts

interface ModelMeshProps {
  model:       ModelState
  worldOffset: { x: number; y: number; z: number }
  isActive:    boolean
}

function ModelMesh({ model, worldOffset, isActive }: ModelMeshProps) {
  const geometry = useMemo<THREE.BufferGeometry | null>(() => {
    if (!model.isClosed || model.vertices.length < 3) return null
    try {
      return model.shapeMode === 'extrude'
        ? buildExtrudeGeometry(model.vertices, model.depth)
        : buildApexGeometry(model.vertices, model.height, model.apexAnchor)
    } catch {
      return null
    }
  }, [model.vertices, model.isClosed, model.shapeMode, model.depth, model.height, model.apexAnchor])

  useEffect(() => {
    return () => { geometry?.dispose() }
  }, [geometry])

  if (!geometry) return null

  // Convert world-unit offset to Three.js scene units
  const pos: [number, number, number] = [
    worldOffset.x / GRID,
    worldOffset.y / GRID,
    worldOffset.z,
  ]

  return (
    <group position={pos}>
      {/* Solid mesh */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={model.color}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.18}
          transparent={model.opacity < 1}
          opacity={model.opacity}
          emissive={model.color}
          emissiveIntensity={isActive ? 0.06 : 0}
        />
      </mesh>

      {/* Wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={model.color}
          wireframe
          transparent
          opacity={isActive ? 0.28 : 0.10}
        />
      </mesh>
    </group>
  )
}

interface Props {
  state: AppState
}

export function Scene({ state }: Props) {
  const visibleModels = state.models.filter(m => m.visible)

  return (
    <>
      {/* ── Lighting — warm key, cool fill ── */}
      <ambientLight intensity={0.35} color="#F5EAD8" />
      <directionalLight position={[8, 10, 6]}   intensity={1.5}  color="#FFFFFF" />
      <directionalLight position={[-4, -2, -5]} intensity={0.25} color="#B8D0FF" />

      {/* ── Grid on XY plane ── */}
      <gridHelper
        args={[24, 24, '#1C1A17', '#161410']}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* ── Axis helper ── */}
      <axesHelper args={[2.5]} />

      {/* ── One mesh per visible model ── */}
      {visibleModels.map(model => (
        <ModelMesh
          key={model.id}
          model={model}
          worldOffset={getWorldOffset(state, model.id)}
          isActive={model.id === state.activeModelId}
        />
      ))}
    </>
  )
}
