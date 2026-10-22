import { useEffect, useId, useState, type ReactNode } from 'react'

export const usd = (x: number) => (x < 0 ? '-$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US')
export const usdK = (x: number) => (Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : `$${Math.round(x / 1000).toLocaleString('en-US')}k`)
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`

/** Small "i" button that reveals where a number comes from. */
export function SourceTip({ source }: { source: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="tip-btn" aria-label={`Source: ${source}`} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>
        i
      </button>
      {open && <span role="tooltip" className="tip-pop">{source}</span>}
    </span>
  )
}

interface MoneyProps {
  label: string
  value: number
  onChange: (v: number) => void
  source?: string
  hint?: string
  suffix?: string
  prefix?: string
}

/** Editable input styled like a workbook input cell (blue). */
export function MoneyInput({ label, value, onChange, source, hint, suffix, prefix = '$' }: MoneyProps) {
  const id = useId()
  const [text, setText] = useState(value.toLocaleString('en-US'))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value.toLocaleString('en-US'))
  }, [value, focused])
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {source && <SourceTip source={source} />}
      </label>
      <div className="input-wrap">
        {prefix && <span className="affix">{prefix}</span>}
        <input
          id={id}
          className="input-cell"
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value.replace(/[^0-9.]/g, ''))
            if (Number.isFinite(n)) onChange(n)
          }}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Stepper({ label, value, onChange, min = 0, max = 10 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="input-cell">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  )
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="hint block">{hint}</span>}
      </span>
    </label>
  )
}

export function Panel({ title, children, aside, className = '' }: { title: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="disclosure">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  )
}
