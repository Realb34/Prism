import { MODEL_COLORS } from '../types'

interface Props {
  value:    string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="color-picker">
      <div className="color-swatches">
        {MODEL_COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`color-swatch${value === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`Set color to ${c}`}
            aria-pressed={value === c}
          />
        ))}
      </div>
      <label className="color-custom-label" title="Custom color">
        <span className="color-well" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="color-custom-input"
          aria-label="Custom color"
        />
      </label>
    </div>
  )
}
