import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { AppState } from '../types'
import { Scene } from './Scene'

interface Props {
  state:      AppState
  className?: string
}

export function ViewportPanel({ state, className }: Props) {
  return (
    <div
      role="region"
      aria-label="3D viewport"
      className={className}
      style={{ flex: 1, position: 'relative', background: '#090908' }}
    >
      <Canvas
        camera={{ position: [6, 5, 10], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#090908']} />
        <Scene state={state} />
        <OrbitControls makeDefault />
      </Canvas>

      {/* Panel label — unobtrusive, bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        color: 'rgba(255,255,255,0.12)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        3D · Orbit · Scroll · Pan
      </div>
    </div>
  )
}
