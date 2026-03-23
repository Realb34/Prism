import * as THREE from 'three'
import { Suspense, useEffect, useRef, useMemo } from 'react'
import { useLoader, useThree, useFrame } from '@react-three/fiber'
import type { AppState, ImportedAsset, ModelState, SketchPlane } from '../types'
import { getWorldOffset } from '../store'
import { buildExtrudeGeometry } from '../geometry/extrude'
import { buildApexGeometry } from '../geometry/apex'
import { synthesizeOrganic } from '../geometry/organic'
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

// Camera positions that face each sketch plane while keeping depth cues.
// XY lives in the Z-forward face → look from +Z.
// XZ is the horizontal plane → look from above (+Y).
// YZ is the right-side face → look from +X.
const PLANE_CAMERA: Record<SketchPlane, THREE.Vector3> = {
  XY: new THREE.Vector3( 2,  4, 13),
  XZ: new THREE.Vector3( 2, 13,  3),
  YZ: new THREE.Vector3(13,  4,  2),
}

/** Smoothly repositions the camera when the active sketch plane changes.
 *  Uses useFrame to lerp so OrbitControls keeps its target at the origin. */
function CameraController({ activePlane }: { activePlane: SketchPlane }) {
  const { camera, controls } = useThree()
  const targetPos  = useRef(PLANE_CAMERA[activePlane].clone())
  const isLerping  = useRef(false)

  useEffect(() => {
    targetPos.current = PLANE_CAMERA[activePlane].clone()
    isLerping.current = true
  }, [activePlane])

  useFrame(() => {
    if (!isLerping.current) return
    camera.position.lerp(targetPos.current, 0.07)
    if (camera.position.distanceTo(targetPos.current) < 0.08) {
      camera.position.copy(targetPos.current)
      isLerping.current = false
    }
    // Keep OrbitControls in sync so it doesn't snap back
    if (controls) (controls as unknown as { update: () => void }).update()
  })

  return null
}

// ── Per-model mesh ───────────────────────────────────────────

interface ModelMeshProps {
  model:       ModelState
  worldOffset: { x: number; y: number; z: number }
  isActive:    boolean
}

function ModelMesh({ model, worldOffset, isActive }: ModelMeshProps) {
  const geometry = useMemo<THREE.BufferGeometry | null>(() => {
    try {
      if (model.shapeMode === 'organic') {
        if (model.contourStrokes.length === 0) return null
        return synthesizeOrganic(model.contourStrokes)
      }
      if (!model.isClosed || model.vertices.length < 3) return null
      return model.shapeMode === 'extrude'
        ? buildExtrudeGeometry(model.vertices, model.depth)
        : buildApexGeometry(model.vertices, model.height, model.apexAnchor)
    } catch {
      return null
    }
  }, [model.vertices, model.isClosed, model.shapeMode, model.depth, model.height, model.apexAnchor, model.contourStrokes])

  useEffect(() => {
    return () => { geometry?.dispose() }
  }, [geometry])

  if (!geometry) return null

  const pos: [number, number, number] = [
    worldOffset.x / GRID,
    worldOffset.y / GRID,
    worldOffset.z,
  ]

  // Organic geometry is already synthesized in 3D; no plane rotation needed.
  const planeRot = model.shapeMode === 'organic' ? ([0, 0, 0] as [number, number, number]) : PLANE_ROTATION[model.plane ?? 'XY']

  // Build mirror scale variants
  const mirrorAxis   = model.mirrorAxis ?? 'none'
  const mirrorScales: Array<[number, number, number]> = []
  if (mirrorAxis === 'x' || mirrorAxis === 'xy')  mirrorScales.push([-1,  1, 1])
  if (mirrorAxis === 'y' || mirrorAxis === 'xy')  mirrorScales.push([ 1, -1, 1])
  if (mirrorAxis === 'xy')                        mirrorScales.push([-1, -1, 1])

  function MeshContent({ opacity, emissiveIntensity }: { opacity: number; emissiveIntensity: number }) {
    return (
      <>
        <mesh geometry={geometry!}>
          <meshStandardMaterial
            color={model.color}
            side={THREE.DoubleSide}
            roughness={0.28}
            metalness={0.15}
            transparent={opacity < 1}
            opacity={opacity}
            emissive={model.color}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>
        <mesh geometry={geometry!}>
          <meshBasicMaterial
            color={model.color}
            wireframe
            transparent
            opacity={isActive ? 0.26 : 0.09}
          />
        </mesh>
      </>
    )
  }

  return (
    <group position={pos}>
      {/* Primary instance */}
      <group rotation={planeRot}>
        <MeshContent opacity={model.opacity} emissiveIntensity={isActive ? 0.055 : 0} />
      </group>
      {/* Mirror instances */}
      {mirrorScales.map((scale, i) => (
        <group key={i} rotation={planeRot} scale={scale}>
          <MeshContent opacity={model.opacity * 0.7} emissiveIntensity={0} />
        </group>
      ))}
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

      {/* ── Camera follows active plane ── */}
      <CameraController activePlane={state.activePlane} />

      {/* ── Active plane indicator ── */}
      <PlaneIndicator activePlane={state.activePlane} />

      {/* ── Grid helper — floor reference (XZ plane in Three.js world) ── */}
      <gridHelper args={[24, 24, '#3C3830', '#302C28']} />

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
