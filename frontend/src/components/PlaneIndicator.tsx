import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { SketchPlane } from '../types'
import { PLANE_COLORS } from '../types'

interface Props {
  activePlane: SketchPlane
}

const PLANE_ROTATION: Record<SketchPlane, [number, number, number]> = {
  XY: [0, 0, 0],
  XZ: [-Math.PI / 2, 0, 0],
  YZ: [0, Math.PI / 2, 0],
}

export function PlaneIndicator({ activePlane }: Props) {
  const matRef   = useRef<THREE.MeshBasicMaterial>(null)
  const pulseRef = useRef(0)

  // Pulse the opacity up briefly when plane changes — handled via a key change
  useFrame((_, delta) => {
    if (!matRef.current) return
    pulseRef.current = Math.min(pulseRef.current + delta * 2, 1)
    // Settle from 0.14 → 0.04 over ~1s
    const t = pulseRef.current
    matRef.current.opacity = 0.04 + 0.10 * Math.max(0, 1 - t)
  })

  const geometry = useMemo(() => new THREE.PlaneGeometry(22, 22), [])
  const color = PLANE_COLORS[activePlane]

  return (
    // key forces remount (and pulse restart) on plane change
    <mesh
      key={activePlane}
      rotation={PLANE_ROTATION[activePlane]}
      geometry={geometry}
    >
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.14}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
