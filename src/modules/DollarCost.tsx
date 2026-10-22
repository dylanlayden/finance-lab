import { useMemo, useState } from 'react'
import { LineChart } from '../components/charts'
import { Disclosure, MoneyInput, Panel, PctInput, Segmented, Stat, pct, usd, usdK } from '../components/ui'
import { CHANNELS, PLAN_DEFAULTS, planCost, savedPerDollar, type Plan, type Saved } from '../lib/channels'
import { totalPay, toTaxInput, useProfile } from '../lib/profile'
import { withTotalPay } from '../lib/tax/engine'
import { P } from '../lib/tax/params2026'

const C = { fed: 'var(--s1)', ca: 'var(--s2)', pay: 'var(--s3)', keep: 'var(--keep)' }
const cents = (x: number) => `$${x.toFixed(2)}`
const tot = (s: Saved) => s.fed + s.ca + s.payroll

function PlanInputs({ title, plan, onChange, hsa }: { title: string; plan: Plan; onChange: (p: Plan) => void; hsa: boolean }) {
  const set = (k: keyof Plan) => (v: number) => onChange({ ...plan, [k]: v })
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      <div className="inputs-grid">
        <MoneyInput label="Your premium / yr" value={plan.premium} onChange={set('premium')} />
        <MoneyInput label="Deductible" value={plan.deductible} onChange={set('deductible')} />
        <PctInput label="Coinsurance (you pay)" value={plan.coinsurance} onChange={set('coinsurance')} digits={0} />
        <MoneyInput label="Out-of-pocket max" value={plan.oopMax} onChange={set('oopMax')} />
        {hsa && <MoneyInput label="Employer HSA deposit / yr" value={plan.employerHsa} onChange={set('employerHsa')} />}
      </div>
    </fieldset>
  )
}

export default function DollarCost() {
  const { profile } = useProfile()
  const s = profile.status
  const base = useMemo(() => toTaxInput(profile), [profile])
  const rows = useMemo(
    () => CHANNELS.map((ch) => ({ ch, saved: savedPerDollar(base, ch) })).sort((a, b) => tot(b.saved) - tot(a.saved)),
    [base],
  )
  const best = rows[0]
  const worst = rows.filter((r) => r.ch.key !== '529').slice(-1)[0]
  const pay = totalPay(profile)

  const curveKeys = ['premium', 'k401', 'hsa', 'mortgage']
  const curveSeries = [
    { key: 'premium', label: 'Pre-tax premiums', color: 'var(--s1)' },
    { key: 'k401', label: 'Traditional 401(k)', color: 'var(--s2)' },
    { key: 'hsa', label: 'HSA', color: 'var(--s3)' },
    { key: 'mortgage', label: 'Mortgage interest', color: 'var(--s4)' },
  ]
  const curve = useMemo(() => {
    const maxX = Math.max(500000, Math.ceil((pay * 1.5) / 100000) * 100000)
    return Array.from({ length: 41 }, (_, i) => {
      const x = 40000 + ((maxX - 40000) * i) / 40
      const inp = withTotalPay(base, x)
      const pt: Record<string, number> = { x }
      for (const k of curveKeys) pt[k] = 1 - tot(savedPerDollar(inp, CHANNELS.find((c) => c.key === k)!))
      return pt as { x: number }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, pay])

  // ---------------------------------------------------------------- HDHP vs PPO
  const [tier, setTier] = useState<'self' | 'family'>(s === 'mfj' || profile.kidsUnder17 > 0 ? 'family' : 'self')
  const [hdhp, setHdhp] = useState<Plan>(PLAN_DEFAULTS[tier].hdhp)
  const [ppo, setPpo] = useState<Plan>(PLAN_DEFAULTS[tier].ppo)
  const hsaLimit = (tier === 'family' ? P.limHsaFamily : P.limHsaSelf).value
  const [hsaContrib, setHsaContrib] = useState(hsaLimit - PLAN_DEFAULTS[tier].hdhp.employerHsa)
  const [spend, setSpend] = useState(4000)
  const pickTier = (t: 'self' | 'family') => {
    setTier(t)
    setHdhp(PLAN_DEFAULTS[t].hdhp)
    setPpo(PLAN_DEFAULTS[t].ppo)
    setHsaContrib((t === 'family' ? P.limHsaFamily : P.limHsaSelf).value - PLAN_DEFAULTS[t].hdhp.employerHsa)
  }
  const premRate = tot(rows.find((r) => r.ch.key === 'premium')!.saved)
  const hsaRate = tot(rows.find((r) => r.ch.key === 'hsa')!.saved)
  const hsaYours = Math.max(0, Math.min(hsaContrib, hsaLimit - hdhp.employerHsa))
  const cH = planCost(hdhp, spend, premRate, hsaYours, hsaRate)
  const cP = planCost(ppo, spend, premRate, 0, 0)
  const planCurve = useMemo(
    () => Array.from({ length: 81 }, (_, i) => ({ x: i * 500, hdhp: planCost(hdhp, i * 500, premRate, hsaYours, hsaRate).total, ppo: planCost(ppo, i * 500, premRate, 0, 0).total })),
    [hdhp, ppo, premRate, hsaYours, hsaRate],
  )
  const ppoBetter = planCurve.filter((p) => p.ppo < p.hdhp)
  const crossover = ppoBetter.length ? ppoBetter[0].x : null

  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Taxes · 2026 federal + California</p>
        <h1>What does $1 really cost you?</h1>
        <p className="lede">
          A dollar spent through a tax-advantaged channel costs less than a dollar, because the tax you skip pays part of it. How much less depends on your income, whether you itemize, and the fact that California
          doesn't follow every federal break.
        </p>
      </header>

      <section className="answer">
        <p className="headline">
          Your cheapest dollar goes through <b>{best.ch.label}</b>: it costs you <b>{cents(1 - tot(best.saved))}</b>.{' '}
          {worst && tot(worst.saved) < 0.01 ? (
            <>
              <b>{worst.ch.label}</b> saves you nothing at your income, so it costs a full <b>$1.00</b>.
            </>
          ) : (
            <>
              Your priciest tax-favored dollar is <b>{worst?.ch.label}</b> at {cents(1 - tot(worst!.saved))}.
            </>
          )}{' '}
          A 529 dollar costs $1.00 today; its break comes later.
        </p>
        <div className="stats">
          {rows.slice(0, 4).map((r) => (
            <Stat key={r.ch.key} label={r.ch.label} value={cents(1 - tot(r.saved))} sub={`per ${'$'}1 · saves ${pct(tot(r.saved), 0)}`} />
          ))}
        </div>
      </section>

      <Panel title="The price of $1 through each channel">
        <div className="legend">
          <span><i className="sw" style={{ background: C.fed }} /> Federal tax saved</span>
          <span><i className="sw" style={{ background: C.ca }} /> California tax saved</span>
          <span><i className="sw" style={{ background: C.pay }} /> Payroll tax saved</span>
          <span><i className="sw" style={{ background: C.keep }} /> What you pay</span>
        </div>
        <ul className="price-list">
          {rows.map(({ ch, saved }) => (
            <li key={ch.key}>
              <div className="price-label">
                <b>{ch.label}</b>
                <span className="hint block">{ch.note(s)}</span>
              </div>
              <div className="price-bar" role="img" aria-label={`${ch.label}: you pay ${cents(1 - tot(saved))} per dollar`}>
                {saved.fed > 0.0005 && <span style={{ flexGrow: saved.fed, background: C.fed }} title={`Federal ${pct(saved.fed)}`} />}
                {saved.ca > 0.0005 && <span style={{ flexGrow: saved.ca, background: C.ca }} title={`California ${pct(saved.ca)}`} />}
                {saved.payroll > 0.0005 && <span style={{ flexGrow: saved.payroll, background: C.pay }} title={`Payroll ${pct(saved.payroll)}`} />}
                <span style={{ flexGrow: 1 - tot(saved), background: C.keep }} />
              </div>
              <span className="price-num">{cents(1 - tot(saved))}</span>
            </li>
          ))}
        </ul>
        <p className="note">Measured on your profile by adding $1,000 to each channel and recomputing your 2026 taxes, so it reflects your brackets, whether you itemize, the SALT cap and California's rules.</p>
      </Panel>

      <Panel title="How the price changes with income">
        <LineChart
          data={curve as never}
          series={curveSeries}
          markX={{ x: pay, label: `You · ${usdK(pay)}` }}
          xFormat={usdK}
          yFormat={(y) => cents(y)}
          xTitle="Household pay (your deductions held fixed)"
          ariaLabel="Price of one dollar through each channel by income"
        />
        <p className="note">
          Higher income makes every break worth more, except where it doesn't. Mortgage interest only helps once your itemized deductions beat the standard deduction. The HSA line gets more expensive above the Social Security wage base, because there's no Social Security tax left to save.
        </p>
      </Panel>

      <Panel title="High-deductible plan + HSA vs. a PPO">
        <Segmented label="Coverage" value={tier} onChange={pickTier} options={[{ value: 'self', label: 'Just you' }, { value: 'family', label: 'Family' }]} />
        <div className="two-col" style={{ marginTop: 12 }}>
          <PlanInputs title="HDHP (HSA-eligible)" plan={hdhp} onChange={setHdhp} hsa />
          <PlanInputs title="PPO" plan={ppo} onChange={setPpo} hsa={false} />
        </div>
        <div className="inputs-grid" style={{ marginTop: 12 }}>
          <MoneyInput label="Your HSA contribution / yr" value={hsaContrib} onChange={setHsaContrib} source={`2026 HSA limit ${usd(hsaLimit)} including the employer deposit (${P.limHsaFamily.source})`} />
          <MoneyInput label="Expected medical spending / yr" value={spend} onChange={setSpend} hint="total billed (allowed) amount" />
        </div>
        <div className="presets" style={{ marginTop: 10 }}>
          {(
            [
              ['Healthy year', 500],
              ['Typical year', 4000],
              ['Big year (surgery, baby)', 20000],
            ] as [string, number][]
          ).map(([l, v]) => (
            <button key={l} type="button" className={spend === v ? 'on' : ''} onClick={() => setSpend(v)}>
              {l} · {usd(v)}
            </button>
          ))}
        </div>
        <p className="headline small">
          At {usd(spend)} of medical spending, the <b>{cH.total <= cP.total ? 'HDHP + HSA' : 'PPO'}</b> costs <b>{usd(Math.abs(cH.total - cP.total))} less</b> a year.{' '}
          {crossover === null ? 'The HDHP comes out ahead at every level of spending up to $40k.' : `The PPO wins once spending passes about ${usd(crossover)}.`}
        </p>
        <div className="stats">
          <Stat label="HDHP net cost" value={usd(cH.total)} sub={`premium ${usd(cH.prem)} + care ${usd(cH.oop)} − HSA ${usd(cH.hsaBenefit)}`} />
          <Stat label="PPO net cost" value={usd(cP.total)} sub={`premium ${usd(cP.prem)} + care ${usd(cP.oop)}`} />
          <Stat label="HSA tax savings" value={usd(hsaYours * hsaRate)} sub={`${pct(hsaRate, 0)} on ${usd(hsaYours)}`} />
          <Stat label="Employer HSA money" value={usd(hdhp.employerHsa)} sub="free cash, counted as a cost offset" />
        </div>
        <LineChart
          data={planCurve}
          series={[
            { key: 'hdhp', label: 'HDHP + HSA', color: 'var(--s1)' },
            { key: 'ppo', label: 'PPO', color: 'var(--s2)' },
          ]}
          markX={{ x: spend, label: usd(spend) }}
          xFormat={usdK}
          yFormat={usdK}
          xTitle="Medical spending in a year"
          ariaLabel="Net annual cost of HDHP vs PPO by medical spending"
        />
        <p className="note">
          Net cost = premiums (after the pre-tax savings) + what you pay for care − the employer's HSA deposit − the tax saved on your own HSA contribution. Unused HSA money stays yours and can be invested, so a healthy
          year's savings carry forward. Plan numbers are examples; enter your employer's. IRS 2026 HDHP limits: minimum deductible {usd(P.hdhpMinDed[tier === 'family' ? 'mfj' : 'single'].value)}, out-of-pocket max up to {usd(P.hdhpMaxOop[tier === 'family' ? 'mfj' : 'single'].value)}.
        </p>
      </Panel>

      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>Every price comes from your profile run through the 2026 federal + California tax engine (sources on the Methodology page). {P.limDcfsa.source}. {P.dcfsaCA.source}.</li>
          <li>{P.limCommuter.source}. {P.hdhpMinDed.single.source}.</li>
          <li>
            Not modeled: the child and dependent care credit trade-off with a DCFSA, medical expenses above 7.5% of AGI, copays and network differences between plans, HSA investment growth, and the later tax on traditional withdrawals (see Roth vs. traditional).
          </li>
        </ul>
      </Disclosure>
    </article>
  )
}
