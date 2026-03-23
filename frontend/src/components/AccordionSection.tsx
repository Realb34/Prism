import { useState } from 'react'
import React from 'react'

interface Props {
  title:        string
  icon?:        string
  defaultOpen?: boolean
  children:     React.ReactNode
}

export function AccordionSection({ title, icon, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="accordion-section">
      <button
        className="accordion-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {icon && <span className="accordion-icon">{icon}</span>}
        <span className="accordion-title">{title}</span>
        <span className={`accordion-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      <div className={`accordion-body${open ? ' open' : ''}`}>
        {children}
      </div>
    </div>
  )
}
