import * as THREE from 'three'
import { Suspense, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import type { AppState, ImportedAsset, ModelState, SketchPlane } from '../types'
import { getWorldOffset } from '../store'
import { buildExtrudeGeometry } from '../geometry/extrude'
import { buildApexGeometry } from '../geometry/apex'
import { PlaneIndicator } from './PlaneIndicator'

// Lazy imports for loaders (tree-shaken in production)
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader }  from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader }  from 'three/examples/jsm/loaders/STLLoader.js'

const GRID = 20  // canvas px per world unit

/** Plane rotation in Three.js world space. Geometry is always built in XY; this
 *  group rotation orients it onto the correct plane. */
const PLANE_ROTATION: Record<SketchPlane, [number, number, number]> = {
  XY: [0, 0, 0],
  XZ: [-Math.PI / 2, 0, 0],
  YZ: [0, Math.PI / 2, 0],
}

// ── Per-model mesh ───────────────────────────────────────────

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

  // World position (always in world XY/Z space, independent of plane)
  const pos: [number, number, number] = [
    worldOffset.x / GRID,
    worldOffset.y / GRID,
    worldOffset.z,
  ]

  const planeRot = PLANE_ROTATION[model.plane ?? 'XY']

  return (
    <group position={pos}>
      <group rotation={planeRot}>
        {/* Solid */}
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={model.color}
            side={THREE.DoubleSide}
            roughness={0.28}
            metalness={0.15}
            transparent={model.opacity < 1}
            opacity={model.opacity}
            emissive={model.color}
            emissiveIntensity={isActive ? 0.055 : 0}
          />
        </mesh>
        {/* Wireframe */}
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color={model.color}
            wireframe
            transparent
            opacity={isActive ? 0.26 : 0.09}
          />
        </mesh>
      </group>
    </group>
  )
}

// ── Imported asset meshes ────────────────────────────────────

function GltfMesh({ asset }: { asset: ImportedAsset }) {
  const gltf = useLoader(GLTFLoader, asset.dataUrl) as { scene: THREE.Group }
  const clone = useMemo(() => gltf.scene.clone(), [gltf.scene])
  const { offset } = asset
  return (
    <primitive
      object={clone}
      position={[offset.x, offset.y, offset.z] as [number, number, number]}
    />
  )
}

function ObjMesh({ asset }: { asset: ImportedAsset }) {
  const obj = useLoader(OBJLoader, asset.dataUrl) as THREE.Group
  const clone = useMemo(() => obj.clone(), [obj])
  const { offset } = asset
  return (
    <primitive
      object={clone}
      position={[offset.x, offset.y, offset.z] as [number, number, number]}
    />
  )
}

function StlMesh({ asset }: { asset: ImportedAsset }) {
  const geo = useLoader(STLLoader, asset.dataUrl) as THREE.BufferGeometry
  const { offset } = asset
  return (
    <mesh
      geometry={geo}
      position={[offset.x, offset.y, offset.z] as [number, number, number]}
    >
      <meshStandardMaterial color="#888" side={THREE.DoubleSide} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function ImportedMesh({ asset }: { asset: ImportedAsset }) {
  if (!asset.visible) return null
  if (asset.format === 'glb' || asset.format === 'gltf') return <GltfMesh asset={asset} />
  if (asset.format === 'obj') return <ObjMesh asset={asset} />
  if (asset.format === 'stl') return <StlMesh asset={asset} />
  return null
}

// ── Scene root ───────────────────────────────────────────────

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

      {/* ── Active plane indicator ── */}
      <PlaneIndicator activePlane={state.activePlane} />

      {/* ── Grid helper ── */}
      <gridHelper args={[24, 24, '#1C1A17', '#161410']} />

      {/* ── Axis helper ── */}
      <axesHelper args={[2.5]} />

      {/* ── One mesh per visible sketched model ── */}
      {visibleModels.map(model => (
        <ModelMesh
          key={model.id}
          model={model}
          worldOffset={getWorldOffset(state, model.id)}
          isActive={model.id === state.activeModelId}
        />
      ))}

      {/* ── Imported assets ── */}
      {state.importedAssets.map(asset => (
        <Suspense key={asset.id} fallback={null}>
          <ImportedMesh asset={asset} />
        </Suspense>
      ))}
    </>
  )
}
