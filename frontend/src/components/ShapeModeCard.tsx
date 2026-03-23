interface Props {
  mode:     'extrude' | 'apex'
  isActive: boolean
  onClick:  () => void
}

function ExtrudeIcon() {
  return (
    <svg viewBox="0 0 44 38" fill="none" aria-hidden="true">
      {/* Top face */}
      <path d="M22 5 L38 14 L22 23 L6 14 Z"
        fill="currentColor" opacity="0.75" />
      {/* Left face */}
      <path d="M6 14 L22 23 L22 33 L6 24 Z"
        fill="currentColor" opacity="0.45" />
      {/* Right face */}
      <path d="M38 14 L22 23 L22 33 L38 24 Z"
        fill="currentColor" opacity="0.28" />
    </svg>
  )
}

function ApexIcon() {
  return (
    <svg viewBox="0 0 44 38" fill="none" aria-hidden="true">
      {/* Left slope */}
      <path d="M22 5 L6 31 L22 31 Z"
        fill="currentColor" opacity="0.55" />
      {/* Right slope */}
      <path d="M22 5 L38 31 L22 31 Z"
        fill="currentColor" opacity="0.32" />
      {/* Base edge */}
      <line x1="6" y1="31" x2="38" y2="31" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      {/* Center ridge line */}
      <line x1="22" y1="5" x2="22" y2="31" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {/* Apex dot */}
      <circle cx="22" cy="5" r="2" fill="currentColor" />
    </svg>
  )
}

export function ShapeModeCard({ mode, isActive, onClick }: Props) {
  return (
    <button
      className={`shape-mode-card${isActive ? ' active' : ''}`}
      onClick={onClick}
      aria-pressed={isActive}
      type="button"
    >
      <div className="shape-mode-card-icon">
        {mode === 'extrude' ? <ExtrudeIcon /> : <ApexIcon />}
      </div>
      <span className="shape-mode-card-label">
        {mode === 'extrude' ? 'Extrude' : 'Apex'}
      </span>
    </button>
  )
}
