import { useMemo, useState } from 'react'
import { LineChart } from '../components/charts'
import { Check, Disclosure, MoneyInput, Panel, PctInput, Segmented, SourceTip, Stat, pct, usd, usdK } from '../components/ui'
import { toTaxInput, useProfile } from '../lib/profile'
import { fva, phaseAllowed, retirementMarginal, retirementTax } from '../lib/retirementTax'
import { computeTax, type TaxInput } from '../lib/tax/engine'
import { P } from '../lib/tax/params2026'

const S1 = 'var(--s1)'
const S2 = 'var(--s2)'

function bumpPretax(input: TaxInput, d: number): TaxInput {
  return { ...input, earners: input.earners.map((e, i) => (i === 0 ? { ...e, pretaxRetirement: e.pretaxRetirement + d } : e)) }
}

export default function RothVsTraditional() {
  const { profile } = useProfile()
  const s = profile.status
  const base = useMemo(() => toTaxInput(profile), [profile])
  const now = useMemo(() => computeTax(base), [base])
  // tax saved per dollar of traditional 401(k) deferral (federal + CA; payroll tax still applies)
  const rateNow = useMemo(() => {
    const room = Math.min(1000, Math.max(0, profile.you.salary + profile.you.bonus + profile.you.rsu - profile.you.pretaxRetirement))
    if (room <= 0) return { total: 0, fed: 0, ca: 0 }
    const b = computeTax(bumpPretax(base, room))
    return { total: (now.total - b.total) / room, fed: (now.fedIncomeTax - b.fedIncomeTax) / room, ca: (now.caIncomeTax - b.caIncomeTax) / room }
  }, [base, now, profile.you])

  // ---------------------------------------------------------------- retirement assumptions
  const [retAge, setRetAge] = useState(65)
  const [ss, setSs] = useState(s === 'mfj' ? 60000 : 36000)
  const [pension, setPension] = useState(0)
  const [realReturn, setRealReturn] = useState(0.05)
  const [wr, setWr] = useState(0.04)
  const [inCA, setInCA] = useState(true)
  const [future, setFuture] = useState<'same' | 'up' | 'down'>('same')
  const bump = future === 'up' ? 0.05 : future === 'down' ? -0.03 : 0
  const n = Math.max(1, retAge - profile.age)
  const annualPretax = profile.you.pretaxRetirement + (s === 'mfj' ? profile.spouse.pretaxRetirement : 0)
  const tradBalance = profile.pretaxAccounts * Math.pow(1 + realReturn, n) + fva(annualPretax, realReturn, n)
  const withdrawal = tradBalance * wr
  const over65 = retAge >= 65 ? (s === 'mfj' ? 2 : 1) : 0
  const rIn = { status: s, over65, ordinary: withdrawal + pension, socialSecurity: ss, inCA }
  const rt = retirementTax(rIn)
  const rm = retirementMarginal(rIn)
  const rateRet = Math.max(0, rm.total + bump)
  const torpedo = rt.taxableSS < 0.85 * ss && rt.taxableSS > 0

  // ---------------------------------------------------------------- comparison
  const [contrib, setContrib] = useState(10000)
  const [maxOut, setMaxOut] = useState(false)
  const value = (tRet: number) => {
    const grown = fva(contrib, realReturn, n)
    if (maxOut) {
      // same dollars go in either way; traditional's tax savings go to a taxable account (1% tax drag)
      return { trad: grown * (1 - tRet) + fva(contrib * rateNow.total, Math.max(0, realReturn - 0.01), n), roth: grown }
    }
    // same take-home cost: Roth contribution is smaller by today's tax
    return { trad: grown * (1 - tRet), roth: fva(contrib * (1 - rateNow.total), realReturn, n) }
  }
  const v = value(rateRet)
  const tradWins = v.trad >= v.roth
  const breakEven = (() => {
    let lo = 0
    let hi = 1
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2
      const x = value(mid)
      if (x.trad > x.roth) lo = mid
      else hi = mid
    }
    return lo
  })()
  const curve = Array.from({ length: 51 }, (_, i) => ({ x: i / 100, ...value(i / 100) }))

  // ---------------------------------------------------------------- IRA eligibility
  const [youCovered, setYouCovered] = useState(profile.you.salary > 0)
  const [preTaxIRA, setPreTaxIRA] = useState(0)
  const magi = now.agi
  const rothFrac = phaseAllowed(magi, P.rothPhase.value[s])
  const spouseCovered = s === 'mfj' && profile.spouse.salary > 0
  const deductFrac = youCovered
    ? phaseAllowed(magi, P.iraDeductCovered.value[s])
    : spouseCovered
      ? phaseAllowed(magi, P.iraDeductSpouseCovered.value)
      : 1
  const proRata = preTaxIRA > 0 ? preTaxIRA / (preTaxIRA + P.limIRA.value) : 0

  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Retirement accounts · 2026 federal + California</p>
        <h1>Roth or traditional?</h1>
        <p className="lede">
          It comes down to one comparison: the tax a traditional contribution saves you <b>today</b> vs. the tax you'll pay when you <b>withdraw</b> it. Roth is the opposite trade: pay now,
          never again. Your rate today comes from your profile. Your rate in retirement comes from the income you expect then.
        </p>
      </header>

      <section className="answer">
        <p className="headline">
          A traditional dollar saves you <b>{pct(rateNow.total)}</b> in tax today. We estimate those dollars will be taxed at <b>{pct(rateRet)}</b> when you withdraw them
          {inCA ? '' : ' (outside California)'}. <b>{tradWins ? 'Traditional' : 'Roth'} wins</b>: about {usd(Math.abs(v.trad - v.roth))} more after tax by age {retAge} on{' '}
          {usd(contrib)} a year{maxOut ? ' (contributing the same dollars either way)' : ' (same take-home cost)'}.
        </p>
        <div className="stats">
          <Stat label="Tax rate today" value={pct(rateNow.total)} sub={`fed ${pct(rateNow.fed)} · CA ${pct(rateNow.ca)}`} />
          <Stat label="Tax rate in retirement" value={pct(rateRet)} sub={`fed ${pct(rm.fed)} · CA ${pct(rm.ca)}${bump ? ` · ${bump > 0 ? '+' : ''}${pct(bump, 0)} scenario` : ''}`} />
          <Stat label="Break-even retirement rate" value={pct(breakEven)} sub="above this, Roth wins" />
          <Stat label={`${tradWins ? 'Traditional' : 'Roth'} advantage at ${retAge}`} value={usdK(Math.abs(v.trad - v.roth))} sub={`traditional ${usdK(v.trad)} · Roth ${usdK(v.roth)}`} />
        </div>
      </section>

      <Panel title="After-tax value at retirement, by your future tax rate">
        <LineChart
          data={curve.map((c) => ({ x: c.x, trad: c.trad, roth: c.roth }))}
          series={[
            { key: 'trad', label: 'Traditional (taxed on the way out)', color: S1 },
            { key: 'roth', label: 'Roth (taxed today)', color: S2 },
          ]}
          markX={{ x: rateRet, label: `Your estimate · ${pct(rateRet, 0)}` }}
          xFormat={(x) => pct(x, 0)}
          yFormat={usdK}
          xTitle="Tax rate on withdrawals in retirement"
          ariaLabel="After-tax value of traditional vs Roth contributions by retirement tax rate"
        />
        <p className="note">
          {maxOut
            ? `If you'd contribute the same dollar amount either way, Roth shelters more money: ${usd(contrib)} of Roth is worth more than ${usd(contrib)} of traditional. Traditional's tax savings go to a taxable account here, so the break-even rate drops below today's ${pct(rateNow.total)}.`
            : `For the same take-home cost, the lines cross exactly at today's rate (${pct(rateNow.total)}). Expect a lower rate later and traditional wins; expect a higher one and Roth wins.`}
        </p>
      </Panel>

      <div className="two-col">
        <Panel title="Your contributions">
          <MoneyInput label="Contribution per year" value={contrib} onChange={setContrib} source={`2026 limits: ${usd(P.lim401k.value)} 401(k)/403(b), ${usd(P.limIRA.value)} IRA`} />
          <Check label="I'd contribute the same dollar amount either way (e.g. maxing out the 401(k))" checked={maxOut} onChange={setMaxOut} />
          <div className="inputs-grid" style={{ marginTop: 10 }}>
            <MoneyInput label="Retire at age" prefix="" value={retAge} onChange={(v) => setRetAge(Math.min(80, Math.max(profile.age + 1, Math.round(v))))} />
            <PctInput label="Real return (after inflation)" value={realReturn} onChange={setRealReturn} source="Assumption. All values are in today's dollars." />
          </div>
        </Panel>
        <Panel title="Your retirement income (today's dollars)">
          <div className="inputs-grid">
            <MoneyInput label="Social Security / yr" value={ss} onChange={setSs} source="Placeholder: replace with your ssa.gov estimate (both spouses if married)" />
            <MoneyInput label="Pension / yr" value={pension} onChange={setPension} hint="e.g. CalSTRS / CalPERS" />
            <PctInput label="Withdrawal rate" value={wr} onChange={setWr} source="Share of the traditional balance withdrawn each year (4% rule of thumb)" />
          </div>
          <Segmented
            label="Where you'll retire"
            value={inCA ? 'ca' : 'out'}
            onChange={(x) => setInCA(x === 'ca')}
            options={[
              { value: 'ca', label: 'California' },
              { value: 'out', label: 'A no-income-tax state' },
            ]}
          />
          <Segmented
            label="Future tax rates"
            value={future}
            onChange={setFuture}
            options={[
              { value: 'same', label: 'Same as today' },
              { value: 'up', label: '+5 pts higher' },
              { value: 'down', label: '3 pts lower' },
            ]}
          />
        </Panel>
      </div>

      <Panel title="How we estimated your retirement tax rate">
        <table className="data-table">
          <tbody>
            <tr><td>Traditional balance at {retAge} (today's {usdK(profile.pretaxAccounts)} + {usd(annualPretax)}/yr, growing {pct(realReturn, 1)} real)</td><td className="r">{usd(tradBalance)}</td></tr>
            <tr><td>Traditional withdrawals ({pct(wr, 1)} a year)</td><td className="r">{usd(withdrawal)}</td></tr>
            <tr><td>Pension</td><td className="r">{usd(pension)}</td></tr>
            <tr><td>Social Security (taxable portion: {usd(rt.taxableSS)})</td><td className="r">{usd(ss)}</td></tr>
            <tr><td>Federal taxable income (after the standard deduction{over65 ? ' + 65+ extra' : ''})</td><td className="r">{usd(rt.fedTaxable)}</td></tr>
            <tr><td>Federal tax + California tax</td><td className="r">{usd(rt.fed)} + {usd(rt.ca)}</td></tr>
            <tr className="hl"><td><b>Tax on the next $1,000 withdrawn</b></td><td className="r"><b>{pct(rm.total)}</b></td></tr>
          </tbody>
        </table>
        {torpedo && (
          <p className="note">
            ⚠ You're in the Social Security "tax torpedo" zone: each extra traditional dollar also makes more of your Social Security taxable, so your federal rate on withdrawals ({pct(rm.fed)}) is higher than your bracket.
          </p>
        )}
      </Panel>

      <Panel title="IRA rules at your income (2026)">
        <div className="inputs-grid">
          <Check label="You have a workplace retirement plan" checked={youCovered} onChange={setYouCovered} />
          <MoneyInput label="Pre-tax IRA balances (traditional, rollover, SEP)" value={preTaxIRA} onChange={setPreTaxIRA} source="Used for the pro-rata rule on backdoor Roth conversions (IRC 408(d)(2))" />
        </div>
        <table className="data-table" style={{ marginTop: 12 }}>
          <tbody>
            <tr>
              <td>
                Direct Roth IRA contribution <SourceTip source={P.rothPhase.source} />
              </td>
              <td className="r">{usd(rothFrac * P.limIRA.value)} of {usd(P.limIRA.value)}</td>
            </tr>
            <tr>
              <td>
                Deductible traditional IRA contribution <SourceTip source={P.iraDeductCovered.source} />
              </td>
              <td className="r">{usd(deductFrac * P.limIRA.value)} of {usd(P.limIRA.value)}</td>
            </tr>
            <tr>
              <td>Taxable share of a backdoor Roth conversion (pro-rata rule)</td>
              <td className="r">{pct(proRata, 0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="note">
          {rothFrac < 1
            ? `Your MAGI (${usd(magi)}) is ${rothFrac === 0 ? 'above' : 'inside'} the Roth IRA phase-out, so you can't make a full contribution directly. The usual workaround is a "backdoor Roth": contribute to a non-deductible traditional IRA, then convert it to Roth.${proRata > 0 ? ` Your pre-tax IRA money makes ${pct(proRata, 0)} of each conversion taxable. Rolling it into a workplace plan first (if the plan accepts it) avoids that.` : ' With no pre-tax IRA balances, the conversion is essentially tax-free.'}`
            : `Your MAGI (${usd(magi)}) is under the Roth IRA limit, so you can contribute directly.`}{' '}
          Roth 401(k) contributions have no income limit.
        </p>
      </Panel>

      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>
            Today's rate is the federal + California tax saved by deferring $1,000 more of your salary pre-tax, from the 2026 engine. Payroll taxes apply either way. The retirement rate uses 2026 brackets in today's dollars (brackets are inflation-indexed),
            Social Security taxation under IRC 86 (thresholds are not indexed, so more benefits become taxable over time), and the extra standard deduction for people 65+ ({P.addStd65[s].source}).
          </li>
          <li>California doesn't tax Social Security. Moving to a no-income-tax state in retirement removes California tax on withdrawals.</li>
          <li>
            Not modeled: required minimum distributions, Roth conversions in low-income years, the temporary $6,000 senior deduction (2025-2028), IRMAA Medicare surcharges, state tax on the taxable side account, and estate/heir taxes (Roth passes tax-free; traditional is taxed to heirs).
            Having both kinds of accounts is a reasonable hedge when the two rates are close.
          </li>
        </ul>
      </Disclosure>
    </article>
  )
}
