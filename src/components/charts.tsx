import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { pct, usd, usdK } from './ui'

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export interface Series {
  key: string
  label: string
  color: string // CSS var
}

export interface MarginalPoint {
  x: number
  [k: string]: number
}

interface MarginalChartProps {
  data: MarginalPoint[]
  stack: Series[]
  line: Series
  youX: number
  youLabel?: string
}

/** Stacked step-area of marginal rate components + an effective-rate line, with crosshair hover. */
export function MarginalChart({ data, stack, line, youX, youLabel = 'You' }: MarginalChartProps) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const h = 300
  const m = { l: 44, r: 12, t: 14, b: 34 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const maxX = data[data.length - 1].x
  const totals = data.map((d) => stack.reduce((a, s) => a + d[s.key], 0))
  const yMax = Math.min(1, Math.ceil((Math.max(...totals, 0.1) + 0.02) * 10) / 10)
  const X = (x: number) => m.l + (x / maxX) * iw
  const Y = (y: number) => m.t + ih - (Math.max(0, y) / yMax) * ih

  const bands = stack.map((s, si) => {
    const lower = data.map((d) => stack.slice(0, si).reduce((a, t) => a + d[t.key], 0))
    const upper = lower.map((l, i) => l + data[i][s.key])
    let top = ''
    let bot = ''
    data.forEach((d, i) => {
      const x0 = X(d.x)
      const x1 = X(i + 1 < data.length ? data[i + 1].x : d.x)
      top += `${i === 0 ? 'M' : 'L'}${x0},${Y(upper[i])}L${x1},${Y(upper[i])}`
    })
    for (let i = data.length - 1; i >= 0; i--) {
      const x0 = X(data[i].x)
      const x1 = X(i + 1 < data.length ? data[i + 1].x : data[i].x)
      bot += `L${x1},${Y(lower[i])}L${x0},${Y(lower[i])}`
    }
    return { s, d: top + bot + 'Z', edge: top }
  })
  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${X(d.x)},${Y(d[line.key])}`).join('')

  const maxTicks = Math.max(3, Math.floor(iw / 64))
  const xStep = [25000, 50000, 100000, 200000, 250000, 500000].find((st) => maxX / st <= maxTicks) ?? 500000
  const xticks = Array.from({ length: Math.floor(maxX / xStep) + 1 }, (_, i) => i * xStep)
  const yticks = Array.from({ length: Math.round(yMax * 10) + 1 }, (_, i) => i / 10)

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * maxX
    let best = 0
    for (let i = 0; i < data.length; i++) if (data[i].x <= x) best = i
    setHover(best)
  }
  const hp = hover != null ? data[hover] : null
  const youIdx = data.reduce((b, d, i) => (d.x <= youX ? i : b), 0)
  const youTotal = totals[youIdx]

  return (
    <div className="chart" ref={ref}>
      <div className="legend">
        {stack.map((s) => (
          <span key={s.key}>
            <i className="sw" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span>
          <i className="sw line" style={{ background: line.color }} /> {line.label}
        </span>
      </div>
      <svg width={w} height={h} role="img" aria-label="Marginal and effective tax rate by income">
        {yticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={Y(t)} y2={Y(t)} className="grid" />
            <text x={m.l - 8} y={Y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {xticks.map((t) => (
          <text key={t} x={X(t)} y={h - m.b + 18} className="tick" textAnchor="middle">
            {t === 0 ? '$0' : usdK(t)}
          </text>
        ))}
        {bands.map((b) => (
          <path key={b.s.key} d={b.d} fill={b.s.color} />
        ))}
        {bands.map((b) => (
          <path key={b.s.key + 'e'} d={b.edge} fill="none" className="band-gap" />
        ))}
        <path d={linePath} fill="none" stroke={line.color} strokeWidth={2} />
        <line x1={m.l} x2={w - m.r} y1={Y(0)} y2={Y(0)} className="axis" />
        {/* you marker */}
        <line x1={X(youX)} x2={X(youX)} y1={m.t} y2={m.t + ih} className="you-line" />
        <g transform={`translate(${X(youX)},${Y(youTotal)})`}>
          <circle r={5} className="you-dot" />
        </g>
        <text x={Math.min(X(youX) + 6, w - m.r - 40)} y={m.t + 10} className="you-label">
          {youLabel}
        </text>
        {hp && (
          <line x1={X(hp.x)} x2={X(hp.x)} y1={m.t} y2={m.t + ih} className="crosshair" />
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }} />
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: Math.min(X(hp.x) + 12, w - 210), top: 40 }}>
          <strong>{usd(hp.x)} of pay</strong>
          {[...stack].reverse().map((s) => (
            <div key={s.key} className="tt-row">
              <i className="sw" style={{ background: s.color }} /> {s.label} <span>{pct(hp[s.key])}</span>
            </div>
          ))}
          <div className="tt-row total">
            Next-dollar total <span>{pct(totals[hover!])}</span>
          </div>
          <div className="tt-row">
            <i className="sw line" style={{ background: line.color }} /> {line.label} <span>{pct(hp[line.key])}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export interface Segment {
  label: string
  value: number
  color: string
}

/** One horizontal stacked bar with a value legend underneath (labels never color-only). */
export function SplitBar({ segments, total, caption }: { segments: Segment[]; total: number; caption?: string }) {
  const visible = segments.filter((s) => s.value > 0.5)
  return (
    <figure className="splitbar">
      <div className="bar" role="img" aria-label={caption}>
        {visible.map((s) => (
          <span key={s.label} style={{ flexGrow: s.value, background: s.color }} title={`${s.label}: ${usd(s.value)}`} />
        ))}
      </div>
      <ul className="bar-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i className="sw" style={{ background: s.color }} />
            <span className="lab">{s.label}</span>
            <span className="num">{usd(s.value)}</span>
            <span className="share">{total > 0 ? pct(s.value / total, 0) : ''}</span>
          </li>
        ))}
      </ul>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
