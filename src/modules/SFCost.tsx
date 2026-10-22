import { useMemo, useState } from 'react'
import { LineChart, SplitBar } from '../components/charts'
import { Disclosure, MoneyInput, Panel, PctInput, SourceTip, Stat, pct, usd, usdK } from '../components/ui'
import {
  DEFAULTS as D,
  SF,
  breakEvenYear,
  firstYearInterest,
  lenderIncome,
  maxWhere,
  monthlyCost,
  payForTakeHome,
  rentVsBuy,
  type BuyInputs,
} from '../lib/housing'
import { totalPay, toTaxInput, useProfile } from '../lib/profile'
import { computeTax, type TaxInput } from '../lib/tax/engine'

type Tab = 'buy' | 'rent' | 'rvb'
type HomeKey = keyof typeof SF.homes
type RentKey = keyof typeof SF.rents
const COMPARABLE_RENT: Record<HomeKey, RentKey> = { sfh: 'three', all: 'two', condo: 'two' }

const S1 = 'var(--s1)'
const S2 = 'var(--s2)'

function ownTaxInput(base: TaxInput, b: BuyInputs): TaxInput {
  const { loan } = monthlyCost(b)
  const f = firstYearInterest(loan, b.rate, b.years)
  return { ...base, mortgageInterest: f.interest, mortgageBalance: f.avgBalance, propertyTax: b.price * b.propTaxRate }
}

function Verdict({ ok, yes = 'You qualify', no = 'Out of reach' }: { ok: boolean; yes?: string; no?: string }) {
  return <span className={`verdict ${ok ? 'yes' : 'no'}`}>{ok ? '✓ ' + yes : '✕ ' + no}</span>
}

export default function SFCost() {
  const { profile } = useProfile()
  const pay = totalPay(profile)
  const cashOnHand = profile.cash + profile.taxableInvestments
  // the household as a renter with no housing deductions - the baseline for every scenario here
  const taxBase = useMemo<TaxInput>(() => ({ ...toTaxInput(profile), mortgageInterest: 0, mortgageBalance: 0, propertyTax: 0 }), [profile])
  const takeHomeRenting = useMemo(() => computeTax(taxBase).takeHome, [taxBase])

  const [tab, setTab] = useState<Tab>('buy')
  const [home, setHome] = useState<HomeKey | 'custom'>('sfh')
  const [buy, setBuy] = useState<BuyInputs>({
    price: SF.homes.sfh.value,
    downPct: D.downPct.value,
    rate: SF.rate30.value,
    years: 30,
    propTaxRate: SF.propTaxRate.value,
    insurance: D.insurance.value,
    hoa: 0,
    pmiRate: D.pmiRate.value,
  })
  const [debt, setDebt] = useState(0)
  const [front, setFront] = useState(D.frontEnd.value)
  const [back, setBack] = useState(D.backEnd.value)
  const [comfort, setComfort] = useState(D.comfort.value)
  const setB = (p: Partial<BuyInputs>) => setBuy((b) => ({ ...b, ...p }))

  // ---------------------------------------------------------------- buy
  const mc = monthlyCost(buy)
  const ownBase = useMemo(() => ownTaxInput(taxBase, buy), [taxBase, buy])
  const takeHomeOwning = useMemo(() => computeTax(ownBase).takeHome, [ownBase])
  const lenderReq = lenderIncome(mc.total, debt, front, back)
  const comfortReq = useMemo(() => payForTakeHome(ownBase, (mc.total * 12) / comfort), [ownBase, mc.total, comfort])
  const cashNeeded = mc.down + buy.price * D.closingBuy.value
  const maxLender = useMemo(() => maxWhere((p) => lenderIncome(monthlyCost({ ...buy, price: p }).total, debt, front, back) <= pay, 20_000_000), [buy, debt, front, back, pay])
  const maxComfort = useMemo(
    () =>
      maxWhere((p) => {
        const b = { ...buy, price: p }
        return monthlyCost(b).total * 12 <= comfort * computeTax(ownTaxInput(taxBase, b)).takeHome
      }, 20_000_000),
    [buy, comfort, taxBase],
  )
  const incomeCurve = useMemo(() => {
    const pts = []
    for (let p = 500000; p <= 3500000; p += 75000) {
      const b = { ...buy, price: p }
      const c = monthlyCost(b).total
      pts.push({ x: p, lender: lenderIncome(c, debt, front, back), comfort: payForTakeHome(ownTaxInput(taxBase, b), (c * 12) / comfort) })
    }
    return pts
  }, [buy, debt, front, back, comfort, taxBase])

  // ---------------------------------------------------------------- rent
  const [rentKey, setRentKey] = useState<RentKey | 'custom'>('two')
  const [rent, setRent] = useState(SF.rents.two.value)
  const [multiple, setMultiple] = useState(D.rentMultiple.value)
  const rentRows = useMemo(
    () =>
      (Object.keys(SF.rents) as RentKey[]).map((k) => {
        const r = SF.rents[k].value
        return { k, label: SF.rents[k].label, rent: r, landlord: 12 * multiple * r, comfortPay: payForTakeHome(taxBase, (r * 12) / comfort) }
      }),
    [multiple, comfort, taxBase],
  )
  const landlordReq = 12 * multiple * rent
  const rentComfortReq = useMemo(() => payForTakeHome(taxBase, (rent * 12) / comfort), [taxBase, rent, comfort])
  const maxRentLandlord = pay / 12 / multiple
  const maxRentComfort = (takeHomeRenting * comfort) / 12

  // ---------------------------------------------------------------- rent vs buy
  const [cmpRent, setCmpRent] = useState(SF.rents.three.value)
  const [rv, setRv] = useState({
    appreciation: D.appreciation.value,
    rentGrowth: D.rentGrowth.value,
    investReturn: D.investReturn.value,
    maintenance: D.maintenance.value,
    sellCost: D.sellCost.value,
    closingBuy: D.closingBuy.value,
  })
  const setR = (p: Partial<typeof rv>) => setRv((x) => ({ ...x, ...p }))
  const rows = useMemo(
    () => rentVsBuy({ ...buy, ...rv, rent: cmpRent, costGrowth: D.costGrowth.value, propTaxGrowth: D.propTaxGrowth.value, horizon: 30 }, taxBase),
    [buy, rv, cmpRent, taxBase],
  )
  const be = breakEvenYear(rows)
  const y1 = rows[0]
  const unrecoverable = y1.interest + buy.price * buy.propTaxRate + buy.insurance + buy.hoa * 12 + rv.maintenance * buy.price + mc.pmi * 12 - y1.taxSavings + (mc.down + buy.price * rv.closingBuy) * rv.investReturn
  const at = (y: number) => rows[Math.min(rows.length, y) - 1]

  const pickHome = (k: HomeKey) => {
    setHome(k)
    setB({ price: SF.homes[k].value, hoa: k === 'condo' ? 900 : 0 })
    setCmpRent(SF.rents[COMPARABLE_RENT[k]].value)
  }

  const priceInputs = (
    <>
      <div className="presets" role="group" aria-label="Home price presets">
        {(Object.keys(SF.homes) as HomeKey[]).map((k) => (
          <button key={k} type="button" className={home === k ? 'on' : ''} onClick={() => pickHome(k)}>
            {SF.homes[k].label} · {usdK(SF.homes[k].value)}
          </button>
        ))}
      </div>
      <div className="inputs-grid">
        <MoneyInput label="Home price" value={buy.price} onChange={(v) => { setHome('custom'); setB({ price: v }) }} source={home !== 'custom' ? SF.homes[home].source : 'Your input'} />
        <PctInput label="Down payment" value={buy.downPct} onChange={(v) => setB({ downPct: Math.min(1, v) })} source={D.downPct.source} digits={1} />
        <PctInput label="30-yr fixed rate" value={buy.rate} onChange={(v) => setB({ rate: v })} source={SF.rate30.source} />
        <PctInput label="Property tax rate" value={buy.propTaxRate} onChange={(v) => setB({ propTaxRate: v })} source={SF.propTaxRate.source} digits={4} />
        <MoneyInput label="Home insurance / yr" value={buy.insurance} onChange={(v) => setB({ insurance: v })} source={D.insurance.source} />
        <MoneyInput label="HOA dues / mo" value={buy.hoa} onChange={(v) => setB({ hoa: v })} source="Your input. Condo preset assumes $900/mo" />
      </div>
    </>
  )

  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Housing · San Francisco · market data as of {SF.asOf}</p>
        <h1>What does San Francisco cost you?</h1>
        <p className="lede">
          The income you need to buy or rent in SF depends on whose rule you use. A lender looks at your <b>gross</b> pay. Your budget runs on your <b>take-home</b> pay after federal, California and payroll taxes. This shows both, for your household.
        </p>
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ['buy', 'Buy'],
            ['rent', 'Rent'],
            ['rvb', 'Rent vs. buy'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'buy' && (
        <>
          <Panel title="The home">{priceInputs}</Panel>
          <section className="answer">
            <p className="headline">
              A {usd(buy.price)} home costs <b>{usd(mc.total)}/month</b>. A lender would want about <b>{usd(lenderReq)}</b> of household income. To keep it at {pct(comfort, 0)} of
              take-home pay, you'd need about <b>{usd(comfortReq)}</b>. Your household earns {usd(pay)}.
            </p>
            <div className="stats">
              <Stat label="Lender's income test" value={usd(lenderReq)} sub={`${pct(front, 0)} housing / ${pct(back, 0)} total debt`} />
              <Stat label="Comfortable income" value={usd(comfortReq)} sub={`housing = ${pct(comfort, 0)} of take-home`} />
              <Stat label="Cash to close" value={usd(cashNeeded)} sub={`you have ${usd(cashOnHand)} in cash + investments`} />
              <Stat label="Of your take-home" value={pct((mc.total * 12) / Math.max(1, takeHomeOwning), 0)} sub="after the home's tax deductions" />
            </div>
            <p className="verdicts">
              Lender test: <Verdict ok={pay >= lenderReq} /> &nbsp; Comfort test: <Verdict ok={pay >= comfortReq} yes="Comfortable" no="Stretch" /> &nbsp; Cash: <Verdict ok={cashOnHand >= cashNeeded} yes="Enough" no="Short" />
            </p>
          </section>

          <div className="two-col">
            <Panel title="Where the monthly payment goes">
              <SplitBar
                total={mc.total}
                segments={[
                  { label: 'Principal & interest', value: mc.pi, color: 'var(--s1)' },
                  { label: 'Property tax', value: mc.propertyTax, color: 'var(--s2)' },
                  { label: 'Insurance', value: mc.insurance, color: 'var(--s3)' },
                  { label: 'HOA', value: mc.hoa, color: 'var(--s4)' },
                  { label: 'PMI (under 20% down)', value: mc.pmi, color: 'var(--s5)' },
                ]}
              />
              <p className="note">
                Loan of {usd(mc.loan)}. Loans above the local conforming limit are jumbo loans, which usually need more down and get their own rate quotes.
              </p>
            </Panel>
            <Panel title="What you can afford at your income">
              <div className="stats">
                <Stat label="Max price - lender's rule" value={usd(maxLender)} sub={`with ${pct(buy.downPct, 0)} down`} />
                <Stat label="Max price - comfortable" value={usd(maxComfort)} sub={`${pct(comfort, 0)} of take-home`} />
              </div>
              <p className="note">Same down-payment percentage, rate, tax and insurance assumptions. The tax savings from mortgage interest and property tax are included.</p>
            </Panel>
          </div>

          <Panel title="Income needed at each home price">
            <LineChart
              data={incomeCurve}
              series={[
                { key: 'lender', label: "Lender's rule (gross pay)", color: S1 },
                { key: 'comfort', label: `Comfortable (${pct(comfort, 0)} of take-home)`, color: S2 },
              ]}
              refY={{ y: pay, label: 'Your household pay' }}
              markX={{ x: buy.price, label: usdK(buy.price) }}
              xFormat={usdK}
              yFormat={usdK}
              xTitle="Home price"
              ariaLabel="Household income needed to buy at each home price"
            />
            <p className="note">
              The gap between the two lines is taxes. At SF incomes, federal, California and payroll taxes take a large share of each extra dollar, so a "comfortable" home needs far more gross income than a lender's ratio suggests.
            </p>
          </Panel>

          <Panel title="Underwriting assumptions">
            <div className="inputs-grid">
              <MoneyInput label="Other debt payments / mo" value={debt} onChange={setDebt} hint="car, student loans, cards" source="Counts toward the lender's back-end ratio" />
              <PctInput label="Lender front-end ratio" value={front} onChange={setFront} source={D.frontEnd.source} digits={0} />
              <PctInput label="Lender back-end ratio" value={back} onChange={setBack} source={D.backEnd.source} digits={0} />
              <PctInput label="Comfort: share of take-home" value={comfort} onChange={setComfort} source={D.comfort.source} digits={0} />
              <PctInput label="PMI rate" value={buy.pmiRate} onChange={(v) => setB({ pmiRate: v })} source={D.pmiRate.source} />
            </div>
          </Panel>
        </>
      )}

      {tab === 'rent' && (
        <>
          <Panel title="The apartment">
            <div className="presets" role="group" aria-label="Apartment size">
              {(Object.keys(SF.rents) as RentKey[]).map((k) => (
                <button key={k} type="button" className={rentKey === k ? 'on' : ''} onClick={() => { setRentKey(k); setRent(SF.rents[k].value) }}>
                  {SF.rents[k].label} · {usd(SF.rents[k].value)}
                </button>
              ))}
            </div>
            <div className="inputs-grid">
              <MoneyInput label="Monthly rent" value={rent} onChange={(v) => { setRentKey('custom'); setRent(v) }} source={rentKey !== 'custom' ? SF.rents[rentKey].source : 'Your input'} />
              <MoneyInput label="Landlord income multiple" prefix="" suffix="× rent" value={multiple} onChange={setMultiple} source={D.rentMultiple.source} />
              <PctInput label="Comfort: share of take-home" value={comfort} onChange={setComfort} source={D.comfort.source} digits={0} />
            </div>
          </Panel>
          <section className="answer">
            <p className="headline">
              To rent at {usd(rent)}/month, a landlord screening at {multiple}× rent wants <b>{usd(landlordReq)}</b> a year of gross income. Keeping rent at {pct(comfort, 0)} of take-home takes about <b>{usd(rentComfortReq)}</b>.
              Your household earns {usd(pay)}.
            </p>
            <div className="stats">
              <Stat label="Landlord's income test" value={usd(landlordReq)} sub={`${multiple}× monthly rent`} />
              <Stat label="Comfortable income" value={usd(rentComfortReq)} sub={`rent = ${pct(comfort, 0)} of take-home`} />
              <Stat label="Max rent - landlord" value={usd(maxRentLandlord)} sub="at your income" />
              <Stat label="Max rent - comfortable" value={usd(maxRentComfort)} sub="at your take-home" />
            </div>
          </section>
          <Panel title="Every apartment size, for your household">
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th className="r">Median rent</th>
                    <th className="r">Landlord test</th>
                    <th>You</th>
                    <th className="r">Comfortable income</th>
                    <th>You</th>
                  </tr>
                </thead>
                <tbody>
                  {rentRows.map((r) => (
                    <tr key={r.k} className={rentKey === r.k ? 'hl' : ''}>
                      <td>
                        {r.label} <SourceTip source={SF.rents[r.k].source} />
                      </td>
                      <td className="r">{usd(r.rent)}</td>
                      <td className="r">{usd(r.landlord)}</td>
                      <td>
                        <Verdict ok={pay >= r.landlord} yes="Pass" no="Fail" />
                      </td>
                      <td className="r">{usd(r.comfortPay)}</td>
                      <td>
                        <Verdict ok={pay >= r.comfortPay} yes="Comfortable" no="Stretch" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Rents are median asking rents from listings, which typically run above what existing tenants pay under SF rent control.</p>
          </Panel>
        </>
      )}

      {tab === 'rvb' && (
        <>
          <Panel title="The home and the rental">
            {priceInputs}
            <div className="inputs-grid" style={{ marginTop: 12 }}>
              <MoneyInput label="Rent for a comparable home / mo" value={cmpRent} onChange={setCmpRent} source="Defaults to the median rent for a comparable unit (3BR for a house, 2BR otherwise)" />
            </div>
          </Panel>
          <Panel title="Scenario">
            <div className="presets" role="group" aria-label="Scenario">
              {(
                [
                  ['Base', D.appreciation.value, D.rentGrowth.value],
                  ['Flat home prices', 0, 0.02],
                  ['Hot market', 0.06, 0.04],
                ] as [string, number, number][]
              ).map(([l, a, g]) => (
                <button key={l} type="button" className={rv.appreciation === a && rv.rentGrowth === g ? 'on' : ''} onClick={() => setR({ appreciation: a, rentGrowth: g })}>
                  {l}
                </button>
              ))}
            </div>
            <div className="inputs-grid">
              <PctInput label="Home price growth / yr" value={rv.appreciation} onChange={(v) => setR({ appreciation: v })} source={D.appreciation.source} />
              <PctInput label="Rent growth / yr" value={rv.rentGrowth} onChange={(v) => setR({ rentGrowth: v })} source={D.rentGrowth.source} />
              <PctInput label="Investment return (after tax)" value={rv.investReturn} onChange={(v) => setR({ investReturn: v })} source={D.investReturn.source} />
              <PctInput label="Maintenance (% of value)" value={rv.maintenance} onChange={(v) => setR({ maintenance: v })} source={D.maintenance.source} />
              <PctInput label="Buying costs" value={rv.closingBuy} onChange={(v) => setR({ closingBuy: v })} source={D.closingBuy.source} />
              <PctInput label="Selling costs" value={rv.sellCost} onChange={(v) => setR({ sellCost: v })} source={D.sellCost.source} />
            </div>
          </Panel>
          <section className="answer">
            <p className="headline">
              {be ? (
                <>
                  Buying comes out ahead after <b>{be} years</b>. Sell sooner and renting (and investing the difference) leaves you with more.
                </>
              ) : (
                <>
                  Under these assumptions, <b>renting and investing the difference wins for all 30 years</b>.
                </>
              )}{' '}
              In year one, owning costs {usd(y1.ownerCost / 12)}/month in cash after tax savings, vs. {usd(cmpRent)} rent.
            </p>
            <div className="stats">
              <Stat label="Break-even" value={be ? `${be} yrs` : 'None in 30 yrs'} sub="buyer net worth ≥ renter" />
              <Stat label="Unrecoverable cost of owning" value={`${usd(unrecoverable / 12)}/mo`} sub="interest, tax, upkeep, lost returns" />
              <Stat label="Buy minus rent, year 10" value={usd(at(10).buyerNetWorth - at(10).renterNetWorth)} sub="net worth difference" />
              <Stat label="Price-to-rent ratio" value={(buy.price / (cmpRent * 12)).toFixed(1) + '×'} sub="price ÷ a year's rent" />
            </div>
          </section>
          <Panel title="Net worth: buy vs. rent and invest">
            <LineChart
              data={rows.map((r) => ({ x: r.year, buy: r.buyerNetWorth, rent: r.renterNetWorth }))}
              series={[
                { key: 'buy', label: 'Buy (home equity after selling costs + investments)', color: S1 },
                { key: 'rent', label: 'Rent and invest the difference', color: S2 },
              ]}
              markX={be ? { x: be, label: `Break-even · yr ${be}` } : undefined}
              xFormat={(x) => `Yr ${Math.round(x)}`}
              yFormat={usdK}
              ariaLabel="Net worth of buying vs renting over 30 years"
            />
            <p className="note">
              "Unrecoverable" costs are what you never get back. For owners that's interest, property tax, insurance, HOA, maintenance and the return the down payment could have earned. For renters it's rent. Principal payments aren't a cost; they build equity.
              Whichever option costs less each year invests the difference.
            </p>
          </Panel>
          <Disclosure title="Show the math (year by year)">
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="r">Home value</th>
                    <th className="r">Loan balance</th>
                    <th className="r">Owner cash cost</th>
                    <th className="r">Tax savings</th>
                    <th className="r">Rent</th>
                    <th className="r">Buyer net worth</th>
                    <th className="r">Renter net worth</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year} className={r.year === be ? 'hl' : ''}>
                      <td>{r.year}</td>
                      <td className="r">{usd(r.homeValue)}</td>
                      <td className="r">{usd(r.balance)}</td>
                      <td className="r">{usd(r.ownerCost)}</td>
                      <td className="r">{usd(r.taxSavings)}</td>
                      <td className="r">{usd(r.rentCost)}</td>
                      <td className="r">{usd(r.buyerNetWorth)}</td>
                      <td className="r">{usd(r.renterNetWorth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </>
      )}

      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>Home prices: {SF.homes.sfh.source}; {SF.homes.all.source}; {SF.homes.condo.source}.</li>
          <li>Rents: {SF.rents.studio.source}; {SF.rents.one.source}; {SF.rents.two.source}; {SF.rents.three.source}.</li>
          <li>Mortgage rate: {SF.rate30.source}. Property tax: {SF.propTaxRate.source}.</li>
          <li>Taxes: your profile run through the 2026 federal + California engine. Owning adds first-year mortgage interest and property tax as itemized deductions (federal SALT cap and $750k mortgage-debt limit apply).</li>
          <li>
            Not modeled: closing-cost detail, mortgage points, jumbo pricing, Prop 13 reassessment details, rent control, renter's insurance, capital-gains tax on a home sale (the $250k/$500k exclusion usually covers it), and the fact that real incomes and rates change. Market figures are dated snapshots; edit any of them.
          </li>
        </ul>
      </Disclosure>
    </article>
  )
}
