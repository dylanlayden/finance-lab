import { useMemo, useState } from 'react'
import { MarginalChart, SplitBar, type MarginalPoint } from '../components/charts'
import { Disclosure, Panel, SourceTip, Stat, pct, usd } from '../components/ui'
import { totalPay, toTaxInput, useProfile } from '../lib/profile'
import { computeTax, marginalSplit, withTotalPay, type TaxInput, type TaxResult } from '../lib/tax/engine'
import { CA_BRACKETS, FED_BRACKETS, P, type Bracket } from '../lib/tax/params2026'

const C = { fed: 'var(--s1)', ca: 'var(--s2)', pay: 'var(--s3)', save: 'var(--s4)', keep: 'var(--keep)', eff: 'var(--ink-2)' }

function BracketLadder({ title, brackets, taxable, source }: { title: string; brackets: Bracket[]; taxable: number; source: string }) {
  const rows = brackets.map((b, i) => {
    const hi = i + 1 < brackets.length ? brackets[i + 1].over : Infinity
    const inB = Math.max(0, Math.min(taxable, hi) - b.over)
    return { ...b, hi, inB, tax: inB * b.rate, current: taxable > b.over && taxable <= hi }
  })
  return (
    <div className="ladder">
      <h3>
        {title} <SourceTip source={source} />
      </h3>
      <table>
        <thead>
          <tr>
            <th>Taxable income</th>
            <th className="r">Rate</th>
            <th>Your income in this bracket</th>
            <th className="r">Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.over} className={r.current ? 'current' : ''}>
              <td>
                {usd(r.over)}
                {r.hi === Infinity ? '+' : ` to ${usd(r.hi)}`}
              </td>
              <td className="r">{pct(r.rate, Math.round(r.rate * 1000) % 10 ? 1 : 0)}</td>
              <td>
                <div className="fill">
                  <span style={{ width: `${taxable > 0 ? (r.inB / taxable) * 100 : 0}%` }} />
                  <em>{r.inB > 0 ? usd(r.inB) : ''}</em>
                </div>
              </td>
              <td className="r">{r.tax > 0 ? usd(r.tax) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MathTable({ r }: { r: TaxResult }) {
  const sections = [...new Set(r.lines.map((l) => l.section))]
  return (
    <table className="math">
      <tbody>
        {sections.map((s) => [
          <tr key={s} className="sec">
            <td colSpan={2}>{s}</td>
          </tr>,
          ...r.lines
            .filter((l) => l.section === s)
            .map((l, i) => (
              <tr key={s + i} className={l.bold ? 'b' : ''}>
                <td>
                  {l.label}
                  {l.note && <span className="hint block">{l.note}</span>}
                </td>
                <td className="r">{usd(l.value)}</td>
              </tr>
            )),
        ])}
      </tbody>
    </table>
  )
}

function bumpYou(input: TaxInput, dWages: number, dPretax: number): TaxInput {
  return { ...input, earners: input.earners.map((e, i) => (i === 0 ? { ...e, wages: e.wages + dWages, pretaxRetirement: e.pretaxRetirement + dPretax } : e)) }
}

export default function TaxExplorer() {
  const { profile } = useProfile()
  const input = useMemo(() => toTaxInput(profile), [profile])
  const r = useMemo(() => computeTax(input), [input])
  const next = useMemo(() => marginalSplit(input, 1000), [input])
  const pay = totalPay(profile)
  const nextRate = 1 - next.keep / 1000

  const curve = useMemo<MarginalPoint[]>(() => {
    const maxX = Math.min(1500000, Math.max(500000, Math.ceil((pay * 2) / 100000) * 100000))
    const n = 240
    const pts: MarginalPoint[] = []
    for (let i = 0; i <= n; i++) {
      const x = (maxX * i) / n
      const inp = withTotalPay(input, x)
      const d = 2500
      const m = marginalSplit(inp, d, true)
      const t = computeTax(inp, { continuous: true })
      pts.push({ x, fed: Math.max(0, m.federal / d), ca: Math.max(0, m.california / d), pay: Math.max(0, m.payroll / d), eff: t.effectiveRate })
    }
    return pts
  }, [input, pay])

  const [raise, setRaise] = useState(10000)
  const raiseRes = useMemo(() => computeTax(bumpYou(input, raise, 0)), [input, raise])
  const raiseKeep = raise - (raiseRes.total - r.total)

  const limit = P.lim401k.value + (profile.age >= 50 ? 8000 : 0)
  const room = Math.max(0, limit - profile.you.pretaxRetirement)
  const [extra, setExtra] = useState(Math.min(5000, room))
  const extraClamped = Math.min(extra, room)
  const extraRes = useMemo(() => computeTax(bumpYou(input, 0, extraClamped)), [input, extraClamped])
  const taxSaved = r.total - extraRes.total

  const status = profile.status
  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Tax bracket explorer · 2026 federal + California</p>
        <h1>Where does your next dollar go?</h1>
        <p className="lede">
          Brackets only tax the dollars inside them. The rate that matters for a raise, a 401(k) contribution or a side gig is your <b>marginal</b> rate: federal, California and payroll taxes combined.
        </p>
      </header>

      <section className="answer">
        <p className="headline">
          Of your next $1,000 of salary you keep <b>{usd(next.keep)}</b>. That's a combined marginal rate of <b>{pct(nextRate)}</b>, while your overall effective rate is <b>{pct(r.effectiveRate)}</b>.
        </p>
        <div className="stats">
          <Stat label="Total 2026 tax" value={usd(r.total)} sub={`on ${usd(r.gross)} of income`} />
          <Stat label="Effective rate" value={pct(r.effectiveRate)} sub="total tax ÷ gross income" />
          <Stat label="Marginal rate" value={pct(nextRate)} sub={`fed ${pct(next.federal / 1000)} · CA ${pct(next.california / 1000)} · payroll ${pct(next.payroll / 1000)}`} />
          <Stat label="Take-home per month" value={usd(r.takeHome / 12)} sub="after tax, pre-tax savings, premiums" />
        </div>
      </section>

      <Panel title="Your rate at every income level">
        <MarginalChart
          data={curve}
          stack={[
            { key: 'fed', label: 'Federal income tax', color: C.fed },
            { key: 'ca', label: 'California income tax', color: C.ca },
            { key: 'pay', label: 'Payroll (SS, Medicare, SDI)', color: C.pay },
          ]}
          line={{ key: 'eff', label: 'Effective rate (all taxes)', color: C.eff }}
          youX={pay}
          youLabel={`You · ${usd(pay)}`}
        />
        <p className="note">
          The stacked bands are the tax on one more dollar of pay for your household at each income, holding your deductions fixed. Bumps that look odd are real: Social Security stops at {usd(P.ssWageBase.value)} of wages per earner,
          Additional Medicare starts at {usd(P.addMedThreshold[status].value)}, the child tax credit phases out above {usd(P.ctcPhase[status].value)}, and the SALT cap shrinks above {usd(P.saltPhaseStart[status].value)}, which pushes the
          federal rate up for a while. The effective rate always stays below the marginal rate.
        </p>
      </Panel>

      <div className="two-col">
        <Panel title="Your next $1,000 of salary">
          <SplitBar
            total={1000}
            segments={[
              { label: 'Federal income tax', value: next.federal, color: C.fed },
              { label: 'California income tax', value: next.california, color: C.ca },
              { label: 'Payroll taxes', value: next.payroll, color: C.pay },
              { label: 'You keep', value: next.keep, color: C.keep },
            ]}
          />
        </Panel>
        <Panel title="Your whole paycheck">
          <SplitBar
            total={r.gross}
            segments={[
              { label: 'Federal income tax', value: Math.max(0, r.fedIncomeTax), color: C.fed },
              { label: 'California income tax', value: r.caIncomeTax, color: C.ca },
              { label: 'Payroll taxes', value: r.payroll, color: C.pay },
              { label: 'Pre-tax savings (401k, HSA)', value: r.pretaxSavings, color: C.save },
              { label: 'Take-home (incl. premiums paid)', value: r.takeHome + profile.healthPremiums, color: C.keep },
            ]}
          />
        </Panel>
      </div>

      <Panel title="What if…">
        <div className="whatif">
          <div>
            <label className="field-label" htmlFor="raise">
              You get a raise of <b className="input-text">{usd(raise)}</b>
            </label>
            <input id="raise" type="range" min={0} max={100000} step={1000} value={raise} onChange={(e) => setRaise(+e.target.value)} />
            <p className="result">
              You keep <b>{usd(raiseKeep)}</b> ({pct(raise ? raiseKeep / raise : 0, 0)}), or <b>{usd(raiseKeep / 12)}</b> more per month. Taxes take {usd(raise - raiseKeep)}.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="extra">
              You add <b className="input-text">{usd(extraClamped)}</b> more to your pre-tax 401(k)
              <SourceTip source={`${P.lim401k.source}${profile.age >= 50 ? ' + $8,000 age-50 catch-up' : ''}. Your room left: ${usd(room)}.`} />
            </label>
            <input id="extra" type="range" min={0} max={Math.max(room, 0)} step={500} value={extraClamped} disabled={room === 0} onChange={(e) => setExtra(+e.target.value)} />
            <p className="result">
              {room === 0 ? (
                'You are already at the 2026 limit.'
              ) : (
                <>
                  Your taxes fall by <b>{usd(taxSaved)}</b>, so saving {usd(extraClamped)} only costs <b>{usd(extraClamped - taxSaved)}</b> of take-home pay ({usd((extraClamped - taxSaved) / 12)}/month).
                </>
              )}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="How the brackets fill up">
        <p className="note">Each rate applies only to the slice of taxable income inside that bracket. Your current bracket is highlighted.</p>
        <div className="two-col tight">
          <BracketLadder title="Federal" brackets={FED_BRACKETS[status].value} taxable={r.fedTaxable} source={FED_BRACKETS[status].source} />
          <BracketLadder title="California" brackets={CA_BRACKETS[status].value} taxable={r.caTaxable} source={CA_BRACKETS[status].source} />
        </div>
      </Panel>

      <Disclosure title="Show the math (line by line)">
        <MathTable r={r} />
      </Disclosure>
      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>Federal brackets & standard deduction ({usd(P.fedStd[status].value)}): {P.fedStd[status].source}</li>
          <li>California schedules & standard deduction ({usd(P.caStd[status].value)}): {CA_BRACKETS[status].source}</li>
          <li>SALT cap {usd(P.saltCap[status].value)}: {P.saltCap[status].source}</li>
          <li>Child tax credit {usd(P.ctcPerChild.value)}/child: {P.ctcPerChild.source}</li>
          <li>Social Security wage base: {P.ssWageBase.source}. SDI: {P.caSdiRate.source}</li>
          <li>Charity: {P.charityFloorPct.source}; {P.nonItemizerCharity[status].source}</li>
          <li>CA exemption-credit phase-out: {P.caCreditPhase[status].source}</li>
          <li>
            Not modeled: AMT, capital gains & qualified dividends (all investment income treated as ordinary), self-employment tax, the OBBBA tips/overtime/senior/car-loan deductions, the dependent-care credit, the CA renter's credit and local taxes. HSA and health premiums are
            attributed to the first earner for payroll tax.
          </li>
        </ul>
      </Disclosure>
    </article>
  )
}
