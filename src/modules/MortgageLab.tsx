import { useMemo, useState } from 'react'
import { LineChart } from '../components/charts'
import { Check, Disclosure, MoneyInput, Panel, PctInput, Stat, pct, usd, usdK } from '../components/ui'
import {
  ARM_PRODUCTS,
  CAPS_SOURCE,
  MKT,
  amortize,
  armPath,
  cumulativeCost,
  interestDeductionValue,
  prepayVsInvest,
  sofrPath,
  totalInterest,
  type Row,
} from '../lib/mortgage'
import { toTaxInput, useProfile } from '../lib/profile'

type Tab = 'extra' | 'arm' | 'refi'
const S1 = 'var(--s1)'
const S2 = 'var(--s2)'
const S3 = 'var(--s3)'
const NOW_YEAR = 2026

const yrs = (months: number) => {
  const y = Math.floor(months / 12)
  const m = Math.round(months % 12)
  return `${y} yr${y === 1 ? '' : 's'}${m ? ` ${m} mo` : ''}`
}
const balAtYear = (rows: Row[], start: number, y: number) => (y === 0 ? start : y * 12 > rows.length ? 0 : rows[y * 12 - 1].balance)

export default function MortgageLab() {
  const { profile } = useProfile()
  const owns = profile.housing === 'own' && profile.mortgageBalance > 0 && profile.mortgageRate > 0 && profile.mortgageYearsLeft > 0
  const yourLoan = { balance: profile.mortgageBalance, rate: profile.mortgageRate, years: profile.mortgageYearsLeft }
  const newLoan = { balance: 800000, rate: MKT.fixed30.value, years: 30 }
  const [loan, setLoan] = useState(owns ? yourLoan : newLoan)
  const [source, setSource] = useState<'yours' | 'new' | 'custom'>(owns ? 'yours' : 'new')
  const setL = (p: Partial<typeof loan>) => {
    setSource('custom')
    setLoan((l) => ({ ...l, ...p }))
  }
  const months = Math.max(12, Math.round(loan.years * 12))
  const [tab, setTab] = useState<Tab>('extra')

  // tax value of a dollar of mortgage interest for this household
  const taxBase = useMemo(() => ({ ...toTaxInput(profile), propertyTax: profile.housing === 'own' ? profile.propertyTax : 0 }), [profile])
  const firstYearInterest = useMemo(() => totalInterest(amortize({ principal: loan.balance, months, rateAt: () => loan.rate }), 12), [loan, months])
  const dValue = useMemo(() => interestDeductionValue(taxBase, firstYearInterest, loan.balance), [taxBase, firstYearInterest, loan.balance])

  // ------------------------------------------------------------ extra payments
  const [extra, setExtra] = useState(500)
  const [lump, setLump] = useState(0)
  const [lumpYear, setLumpYear] = useState(1)
  const [biweekly, setBiweekly] = useState(false)
  const [investReturn, setInvestReturn] = useState(0.06)
  const base = useMemo(() => amortize({ principal: loan.balance, months, rateAt: () => loan.rate }), [loan, months])
  const basePay = base[0]?.payment ?? 0
  const extraMonthly = extra + (biweekly ? basePay / 12 : 0)
  const withExtra = useMemo(
    () => amortize({ principal: loan.balance, months, rateAt: () => loan.rate, extraMonthly, lump: lump > 0 ? { month: Math.max(1, Math.round(lumpYear * 12)), amount: lump } : undefined }),
    [loan, months, extraMonthly, lump, lumpYear],
  )
  const saved = totalInterest(base) - totalInterest(withExtra)
  const monthsSaved = base.length - withExtra.length
  const pvi = useMemo(() => prepayVsInvest(loan.balance, loan.rate, months, extraMonthly, investReturn, dValue), [loan, months, extraMonthly, investReturn, dValue])
  const pviEnd = pvi.series[pvi.series.length - 1]
  const afterTaxRate = loan.rate * (1 - dValue)

  // ------------------------------------------------------------ fixed vs ARM
  const [fixedRate, setFixedRate] = useState(MKT.fixed30.value)
  const [prodKey, setProdKey] = useState('5/6')
  const prod = ARM_PRODUCTS.find((p) => p.key === prodKey)!
  const [armRate, setArmRate] = useState(MKT.arm5.value)
  const [margin, setMargin] = useState(MKT.margin.value)
  const [sofr0, setSofr0] = useState(MKT.sofr.value)
  const [sofrChange, setSofrChange] = useState(0)
  const [worst, setWorst] = useState(false)
  const [hold, setHold] = useState(10)
  const armMonths = 360
  const armPrincipal = loan.balance
  const fixedRows = useMemo(() => amortize({ principal: armPrincipal, months: armMonths, rateAt: () => fixedRate }), [armPrincipal, fixedRate])
  const armRateFn = useMemo(() => armPath(prod, armRate, margin, sofrPath(sofr0, sofrChange), armMonths, worst), [prod, armRate, margin, sofr0, sofrChange, worst])
  const armRows = useMemo(() => amortize({ principal: armPrincipal, months: armMonths, rateAt: armRateFn }), [armPrincipal, armRateFn])
  const worstRows = useMemo(() => amortize({ principal: armPrincipal, months: armMonths, rateAt: armPath(prod, armRate, margin, sofrPath(sofr0, 0), armMonths, true) }), [armPrincipal, prod, armRate, margin, sofr0])
  const holdM = Math.round(hold * 12)
  const fixedInt = totalInterest(fixedRows, holdM)
  const armInt = totalInterest(armRows, holdM)
  const resetRow = armRows[prod.fixedYears * 12]
  const maxWorstPay = Math.max(...worstRows.map((r) => r.payment))
  // flat SOFR level at which the ARM costs the same as the fixed loan over the holding period
  const breakEvenSofr = useMemo(() => {
    const cost = (s: number) => totalInterest(amortize({ principal: armPrincipal, months: armMonths, rateAt: armPath(prod, armRate, margin, sofrPath(s, 0), armMonths) }), holdM)
    if (cost(0.2) <= fixedInt) return Infinity
    if (cost(0) >= fixedInt) return -Infinity
    let lo = 0
    let hi = 0.2
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      if (cost(mid) <= fixedInt) lo = mid
      else hi = mid
    }
    return lo
  }, [armPrincipal, prod, armRate, margin, holdM, fixedInt])

  // ------------------------------------------------------------ refinance
  const [newRate, setNewRate] = useState(loan.rate > MKT.fixed30.value + 0.005 ? MKT.fixed30.value : Math.max(0.02, Math.round((loan.rate - 0.01) * 10000) / 10000))
  const [newTerm, setNewTerm] = useState(30)
  const [costs, setCosts] = useState(9000)
  const [refiHold, setRefiHold] = useState(10)
  const keepRows = base
  const refiRows = useMemo(() => amortize({ principal: loan.balance, months: newTerm * 12, rateAt: () => newRate }), [loan.balance, newTerm, newRate])
  const refiPay = refiRows[0]?.payment ?? 0
  const refiExtraRows = useMemo(
    () => amortize({ principal: loan.balance, months: newTerm * 12, rateAt: () => newRate, extraMonthly: Math.max(0, basePay - refiPay) }),
    [loan.balance, newTerm, newRate, basePay, refiPay],
  )
  const horizonM = Math.max(keepRows.length, refiRows.length)
  const cKeep = cumulativeCost(keepRows, 0, horizonM)
  const cRefi = cumulativeCost(refiRows, costs, horizonM)
  const cRefiX = cumulativeCost(refiExtraRows, costs, horizonM)
  const savings = basePay - refiPay
  const simpleBE = savings > 0 ? costs / savings : Infinity
  const trueBE = cRefi.findIndex((c, i) => c < cKeep[i])
  const rh = Math.round(refiHold * 12)

  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Mortgage Lab · rates as of {MKT.asOf}</p>
        <h1>How does your mortgage really work?</h1>
        <p className="lede">
          Every payment is part interest, part principal, and early on it's mostly interest. See what extra payments are worth, when an adjustable rate tied to SOFR (the
          benchmark that replaced LIBOR) beats a fixed rate, and when refinancing pays for itself.
        </p>
      </header>

      <Panel title="The loan">
        <div className="presets" role="group" aria-label="Loan">
          {owns && (
            <button type="button" className={source === 'yours' ? 'on' : ''} onClick={() => { setSource('yours'); setLoan(yourLoan) }}>
              Your mortgage · {usdK(yourLoan.balance)} at {pct(yourLoan.rate, 2)}
            </button>
          )}
          <button type="button" className={source === 'new' ? 'on' : ''} onClick={() => { setSource('new'); setLoan(newLoan) }}>
            New $800k loan at today's {pct(MKT.fixed30.value, 2)}
          </button>
        </div>
        <div className="inputs-grid">
          <MoneyInput label="Loan balance" value={loan.balance} onChange={(v) => setL({ balance: v })} />
          <PctInput label="Interest rate" value={loan.rate} onChange={(v) => setL({ rate: v })} source={MKT.fixed30.source} />
          <MoneyInput label="Years remaining" prefix="" value={loan.years} onChange={(v) => setL({ years: Math.min(40, Math.max(1, v)) })} />
        </div>
      </Panel>

      <div className="tabs" role="tablist">
        {(
          [
            ['extra', 'Extra payments'],
            ['arm', 'Fixed vs. adjustable (SOFR)'],
            ['refi', 'Refinance'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'extra' && (
        <>
          <Panel title="Extra payments">
            <div className="inputs-grid">
              <MoneyInput label="Extra every month" value={extra} onChange={setExtra} />
              <MoneyInput label="One-time lump sum" value={lump} onChange={setLump} hint="e.g. a bonus" />
              <MoneyInput label="Lump sum in year" prefix="" value={lumpYear} onChange={(v) => setLumpYear(Math.max(1, Math.round(v)))} />
            </div>
            <Check label="Pay biweekly (26 half-payments a year, the same as one extra payment a year)" checked={biweekly} onChange={setBiweekly} />
          </Panel>
          <section className="answer">
            <p className="headline">
              {saved > 1 ? (
                <>
                  Paying {usd(extraMonthly)} extra a month{lump > 0 ? ` plus ${usd(lump)} once` : ''} saves <b>{usd(saved)} of interest</b> and pays the loan off <b>{yrs(monthsSaved)} sooner</b>, in{' '}
                  {NOW_YEAR + Math.ceil(withExtra.length / 12)} instead of {NOW_YEAR + Math.ceil(base.length / 12)}.
                </>
              ) : (
                <>Add an extra payment to see how much interest it saves.</>
              )}
            </p>
            <div className="stats">
              <Stat label="Monthly payment (P&I)" value={usd(basePay)} sub={`${pct(base[0] ? base[0].interest / basePay : 0, 0)} of the first payment is interest`} />
              <Stat label="Interest - as scheduled" value={usd(totalInterest(base))} sub={`over ${yrs(base.length)}`} />
              <Stat label="Interest - with extra" value={usd(totalInterest(withExtra))} sub={`over ${yrs(withExtra.length)}`} />
              <Stat label="Interest saved" value={usd(saved)} sub={`${yrs(monthsSaved)} sooner`} />
            </div>
          </section>
          <Panel title="Loan balance over time">
            <LineChart
              data={Array.from({ length: Math.ceil(base.length / 12) + 1 }, (_, y) => ({
                x: NOW_YEAR + y,
                base: balAtYear(base, loan.balance, y),
                extra: balAtYear(withExtra, loan.balance, y),
              }))}
              series={[
                { key: 'base', label: 'As scheduled', color: S1 },
                { key: 'extra', label: 'With extra payments', color: S2 },
              ]}
              xFormat={(x) => String(Math.round(x))}
                xStep={5}
              yFormat={usdK}
              ariaLabel="Loan balance over time with and without extra payments"
            />
          </Panel>
          <Panel title="Prepay or invest the same money?">
            <div className="inputs-grid">
              <PctInput label="Investment return (after tax)" value={investReturn} onChange={setInvestReturn} source="Assumption: diversified portfolio, nominal, after taxes. Not guaranteed." />
            </div>
            {extraMonthly > 0 ? (
              <>
                <p className="headline small">
                  Prepaying earns a <b>guaranteed {pct(afterTaxRate, 2)}</b> after tax
                  {dValue > 0 ? ` (your ${pct(loan.rate, 2)} rate minus the ${pct(dValue, 0)} of each interest dollar you deduct)` : ' (you take the standard deduction, so the interest saves you no tax)'}. Investing
                  expects {pct(investReturn, 1)} with risk. By the original payoff date, <b>{pviEnd.prepay >= pviEnd.invest ? 'prepaying' : 'investing'}</b> leaves you about{' '}
                  <b>{usd(Math.abs(pviEnd.prepay - pviEnd.invest))}</b> ahead.
                </p>
                <LineChart
                  data={pvi.series.filter((s) => s.month % 12 === 0).map((s) => ({ x: NOW_YEAR + s.month / 12, prepay: s.prepay, invest: s.invest }))}
                  series={[
                    { key: 'prepay', label: 'Prepay (extra equity, then investments)', color: S2 },
                    { key: 'invest', label: 'Invest the extra instead', color: S3 },
                  ]}
                  xFormat={(x) => String(Math.round(x))}
                xStep={5}
                  yFormat={usdK}
                  ariaLabel="Net worth from the extra money: prepaying vs investing"
                />
                <p className="note">
                  Wealth built by the extra dollars: the extra home equity (compared with the normal schedule) plus investments. Both paths spend the same cash each month, and after an early payoff the freed-up payment gets invested. Prepaying wins whenever your after-tax investment return turns out lower than {pct(afterTaxRate, 2)}, and it never has a bad year.
                </p>
              </>
            ) : (
              <p className="note">Enter an extra monthly payment above to compare.</p>
            )}
          </Panel>
        </>
      )}

      {tab === 'arm' && (
        <>
          <Panel title="Fixed vs. SOFR adjustable-rate mortgage">
            <div className="presets" role="group" aria-label="ARM product">
              {ARM_PRODUCTS.map((p) => (
                <button key={p.key} type="button" className={prodKey === p.key ? 'on' : ''} onClick={() => setProdKey(p.key)}>
                  {p.label} · fixed {p.fixedYears} yrs · caps {p.caps.first * 100}/{p.caps.periodic * 100}/{p.caps.lifetime * 100}
                </button>
              ))}
            </div>
            <div className="inputs-grid">
              <PctInput label="Fixed 30-yr rate" value={fixedRate} onChange={setFixedRate} source={MKT.fixed30.source} />
              <PctInput label="ARM starting rate" value={armRate} onChange={setArmRate} source={MKT.arm5.source + '. 7/6 and 10/6 ARMs usually start a bit higher.'} />
              <PctInput label="ARM margin" value={margin} onChange={setMargin} source={MKT.margin.source} />
              <PctInput label="SOFR today (30-day avg.)" value={sofr0} onChange={setSofr0} source={MKT.sofr.source} digits={3} />
              <MoneyInput label="Years you'll keep the loan" prefix="" value={hold} onChange={(v) => setHold(Math.min(30, Math.max(1, v)))} />
            </div>
            <p className="field-label" style={{ marginTop: 14 }}>
              What SOFR does next
            </p>
            <div className="presets" role="group" aria-label="SOFR path">
              {(
                [
                  ['Stays flat', 0, false],
                  ['Falls 0.5%/yr', -0.005, false],
                  ['Rises 0.5%/yr', 0.005, false],
                  ['Worst case (hits every cap)', 0, true],
                ] as [string, number, boolean][]
              ).map(([l, c, w]) => (
                <button key={l} type="button" className={sofrChange === c && worst === w ? 'on' : ''} onClick={() => { setSofrChange(c); setWorst(w) }}>
                  {l}
                </button>
              ))}
            </div>
          </Panel>
          <section className="answer">
            <p className="headline">
              Over {hold} years, the {prod.label} costs <b>{usd(armInt)}</b> in interest vs. <b>{usd(fixedInt)}</b> fixed, so the{' '}
              <b>{armInt <= fixedInt ? `ARM saves ${usd(fixedInt - armInt)}` : `fixed rate saves ${usd(armInt - fixedInt)}`}</b>.{' '}
              {hold <= prod.fixedYears
                ? `You'd sell or refinance before the first rate reset, so you never take the floating-rate risk.`
                : breakEvenSofr === Infinity
                  ? 'The ARM wins at any SOFR level, because the caps limit how high it can go.'
                  : breakEvenSofr === -Infinity
                    ? 'The fixed rate wins even if SOFR falls to zero.'
                    : `The ARM comes out ahead as long as SOFR averages below about ${pct(breakEvenSofr, 2)} after the reset (it's ${pct(sofr0, 2)} today).`}
            </p>
            <div className="stats">
              <Stat label="Payment today" value={`${usd(armRows[0].payment)}`} sub={`ARM vs. ${usd(fixedRows[0].payment)} fixed`} />
              <Stat label={`Payment at reset (year ${prod.fixedYears + 1})`} value={resetRow ? usd(resetRow.payment) : '–'} sub={resetRow ? `rate ${pct(resetRow.rate, 3)}` : ''} />
              <Stat label="Worst-case max payment" value={usd(maxWorstPay)} sub={`if the rate hits the ${pct(armRate + prod.caps.lifetime, 2)} lifetime cap`} />
              <Stat label={`Interest over ${hold} yrs`} value={usd(armInt - fixedInt)} sub="ARM minus fixed" />
            </div>
          </section>
          <div className="two-col">
            <Panel title="Interest rate">
              <LineChart
                data={Array.from({ length: 31 }, (_, y) => ({ x: NOW_YEAR + y, fixed: fixedRate, arm: armRateFn(Math.max(1, y * 12)) }))}
                series={[
                  { key: 'fixed', label: 'Fixed', color: S1 },
                  { key: 'arm', label: prod.label, color: S2 },
                ]}
                markX={{ x: NOW_YEAR + hold, label: `You sell · ${hold} yrs` }}
                xFormat={(x) => String(Math.round(x))}
                xStep={5}
                yFormat={(y) => pct(y, 1)}
                height={240}
                ariaLabel="Interest rate over time: fixed vs ARM"
              />
            </Panel>
            <Panel title="Monthly payment">
              <LineChart
                data={Array.from({ length: 30 }, (_, y) => ({ x: NOW_YEAR + y, fixed: fixedRows[y * 12]?.payment ?? 0, arm: armRows[y * 12]?.payment ?? 0 }))}
                series={[
                  { key: 'fixed', label: 'Fixed', color: S1 },
                  { key: 'arm', label: prod.label, color: S2 },
                ]}
                markX={{ x: NOW_YEAR + hold, label: `${hold} yrs` }}
                xFormat={(x) => String(Math.round(x))}
                xStep={5}
                yFormat={usdK}
                height={240}
                ariaLabel="Monthly payment over time: fixed vs ARM"
              />
            </Panel>
          </div>
          <p className="note">
            How a SOFR ARM resets: after the fixed period, the rate becomes 30-day average SOFR plus the margin, rounded to the nearest 1/8%. It adjusts every 6 months, and each change is
            limited by the caps (first / later / lifetime). The rate never drops below the margin. {CAPS_SOURCE}.
          </p>
        </>
      )}

      {tab === 'refi' && (
        <>
          <Panel title="The new loan">
            <div className="presets" role="group" aria-label="New rate">
              {(
                [
                  [`Today's rate · ${pct(MKT.fixed30.value, 2)}`, MKT.fixed30.value],
                  ['Rates fall 1 point', loan.rate - 0.01],
                  ['Rates fall 2 points', loan.rate - 0.02],
                ] as [string, number][]
              ).map(([l, r]) => (
                <button key={l} type="button" className={Math.abs(newRate - r) < 1e-9 ? 'on' : ''} onClick={() => setNewRate(Math.max(0.01, r))}>
                  {l}
                </button>
              ))}
            </div>
            <div className="inputs-grid">
              <PctInput label="New rate" value={newRate} onChange={setNewRate} hint={`Today's 30-yr average: ${pct(MKT.fixed30.value, 2)}, 15-yr: ${pct(MKT.fixed15.value, 2)}`} source={MKT.fixed30.source} />
              <MoneyInput label="New term (years)" prefix="" value={newTerm} onChange={(v) => setNewTerm(Math.min(40, Math.max(5, Math.round(v))))} />
              <MoneyInput label="Closing costs + points" value={costs} onChange={setCosts} source="Assumption: lender, title, appraisal and escrow fees; typically 1-2% of the loan" />
              <MoneyInput label="Years you'll keep it" prefix="" value={refiHold} onChange={(v) => setRefiHold(Math.min(40, Math.max(1, v)))} />
            </div>
          </Panel>
          <section className="answer">
            <p className="headline">
              {savings > 0 ? (
                <>
                  Refinancing to {pct(newRate, 2)} cuts the payment by <b>{usd(savings)}/month</b>. The {usd(costs)} of costs is earned back in{' '}
                  <b>{trueBE >= 0 ? yrs(trueBE + 1) : 'never'}</b> of interest savings{simpleBE < Infinity ? ` (${yrs(simpleBE)} by the simple payment math)` : ''}.{' '}
                  {trueBE >= 0 && trueBE + 1 <= rh ? `You plan to keep it ${refiHold} years, so it pays off.` : `You plan to keep it ${refiHold} years, so it doesn't pay off.`}
                </>
              ) : (
                <>
                  At {pct(newRate, 2)} the new payment isn't lower than your current {usd(basePay)}. Refinancing only makes sense here to change the term or to take cash out.
                </>
              )}
            </p>
            <div className="stats">
              <Stat label="New payment" value={usd(refiPay)} sub={`vs. ${usd(basePay)} today`} />
              <Stat label={`Interest + fees, next ${refiHold} yrs`} value={usd(cRefi[rh - 1] ?? cRefi[cRefi.length - 1])} sub={`keep: ${usd(cKeep[rh - 1] ?? cKeep[cKeep.length - 1])}`} />
              <Stat label="Lifetime interest + fees" value={usd(cRefi[cRefi.length - 1])} sub={`keep: ${usd(cKeep[cKeep.length - 1])}`} />
              <Stat label="Refi but keep paying the old amount" value={`paid off in ${yrs(refiExtraRows.length)}`} sub={`interest + fees ${usd(cRefiX[cRefiX.length - 1])}`} />
            </div>
          </section>
          <Panel title="Interest + fees paid to date">
            <LineChart
              data={Array.from({ length: Math.ceil(horizonM / 12) + 1 }, (_, y) => ({
                x: NOW_YEAR + y,
                keep: y === 0 ? 0 : cKeep[Math.min(horizonM, y * 12) - 1],
                refi: y === 0 ? costs : cRefi[Math.min(horizonM, y * 12) - 1],
                refix: y === 0 ? costs : cRefiX[Math.min(horizonM, y * 12) - 1],
              }))}
              series={[
                { key: 'keep', label: 'Keep current loan', color: S1 },
                { key: 'refi', label: 'Refinance', color: S2 },
                { key: 'refix', label: 'Refinance, keep paying the old amount', color: S3 },
              ]}
              markX={{ x: NOW_YEAR + refiHold, label: `${refiHold} yrs` }}
              xFormat={(x) => String(Math.round(x))}
                xStep={5}
              yFormat={usdK}
              ariaLabel="Cumulative interest and fees: keep vs refinance"
            />
            <p className="note">
              Principal isn't a cost (it becomes home equity), so this tracks only interest and closing costs. Where the refinance line drops below "keep" is the true break-even. Starting
              a new 30-year term can lower the payment and still raise lifetime interest. Keeping your old payment avoids that.
            </p>
          </Panel>
        </>
      )}

      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>Rates: {MKT.fixed30.source}; {MKT.fixed15.source}; {MKT.arm5.source}.</li>
          <li>ARMs: {MKT.sofr.source}. {MKT.margin.source}. {CAPS_SOURCE}.</li>
          <li>
            Tax: the deduction value of mortgage interest comes from your profile run through the 2026 federal + California engine ({pct(dValue, 1)} per interest dollar for this loan). It is zero if you'd take the
            standard deduction anyway.
          </li>
          <li>Not modeled: PMI, escrow, points vs. rate trade-offs, ARM interest-only options, prepayment penalties (rare on conventional loans), and the risk that you can't refinance an ARM before it resets.</li>
        </ul>
      </Disclosure>
    </article>
  )
}
