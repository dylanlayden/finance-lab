// Mortgage Lab math: amortization with extra payments, SOFR ARMs vs. fixed, refinancing.

import { pmt } from './housing'
import { computeTax, type TaxInput } from './tax/engine'

export const MKT = {
  asOf: 'October 2026',
  fixed30: { value: 0.074, source: 'Freddie Mac PMMS 30-year fixed average, week of 15-Oct-2026' },
  fixed15: { value: 0.0671, source: 'Freddie Mac PMMS 15-year fixed average, week of 15-Oct-2026' },
  arm5: { value: 0.0646, source: 'MBA Weekly Applications Survey: average 5/1 ARM contract rate 6.46%, week ending 16-Oct-2026' },
  sofr: { value: 0.03886, source: '30-day average SOFR 3.886% on 20-Oct-2026 (NY Fed data, via sofrrate.com)' },
  margin: { value: 0.0275, source: 'Typical conventional SOFR ARM margin 2.75% (lender range ~2.25-3.00%)' },
}

export interface ArmProduct {
  key: string
  label: string
  fixedYears: number
  caps: { first: number; periodic: number; lifetime: number }
}

export const ARM_PRODUCTS: ArmProduct[] = [
  { key: '5/6', label: '5/6 ARM', fixedYears: 5, caps: { first: 0.02, periodic: 0.01, lifetime: 0.05 } },
  { key: '7/6', label: '7/6 ARM', fixedYears: 7, caps: { first: 0.05, periodic: 0.01, lifetime: 0.05 } },
  { key: '10/6', label: '10/6 ARM', fixedYears: 10, caps: { first: 0.05, periodic: 0.01, lifetime: 0.05 } },
]
export const CAPS_SOURCE = 'Typical conventional caps: 2/1/5 on 5/6 ARMs, 5/1/5 on 7/6 and 10/6 ARMs (MGIC and Pennymac program guides)'

export interface Row {
  month: number
  rate: number
  payment: number // scheduled P&I
  interest: number
  principal: number // incl. extra
  extra: number
  balance: number
}

/** Generic amortization. `rateAt(month)` lets a rate float; payment is re-amortized whenever the rate changes. */
export function amortize(opts: {
  principal: number
  months: number
  rateAt: (month: number) => number
  extraMonthly?: number
  lump?: { month: number; amount: number }
}): Row[] {
  const rows: Row[] = []
  let bal = opts.principal
  let rate = opts.rateAt(1)
  let pay = pmt(rate, opts.months / 12, bal)
  for (let m = 1; m <= opts.months && bal > 0.005; m++) {
    const r = opts.rateAt(m)
    if (r !== rate) {
      rate = r
      pay = pmt(rate, (opts.months - m + 1) / 12, bal)
    }
    const interest = (bal * rate) / 12
    let principal = Math.min(bal, pay - interest)
    let extra = 0
    if (bal - principal > 0) {
      extra = Math.min(bal - principal, (opts.extraMonthly ?? 0) + (opts.lump && opts.lump.month === m ? opts.lump.amount : 0))
    }
    principal += extra
    bal -= principal
    rows.push({ month: m, rate, payment: pay, interest, principal, extra, balance: Math.max(0, bal) })
  }
  return rows
}

export const totalInterest = (rows: Row[], uptoMonth = Infinity) => rows.filter((r) => r.month <= uptoMonth).reduce((a, r) => a + r.interest, 0)
export const balanceAt = (rows: Row[], month: number) => (month <= 0 ? NaN : month > rows.length ? 0 : rows[month - 1].balance)

// ------------------------------------------------------------- ARM

export type SofrPath = (month: number) => number

export function sofrPath(start: number, changePerYear: number, floor = 0, ceiling = 0.12): SofrPath {
  return (m) => Math.min(ceiling, Math.max(floor, start + (changePerYear * (m - 1)) / 12))
}

const round8 = (x: number) => Math.round(x * 800) / 800 // nearest 1/8 of a percent

/** Note-rate path of a SOFR ARM: index + margin, rounded to 1/8%, limited by the caps, floored at the margin.
 *  `worstCase` moves the rate up by the maximum the caps allow at every reset. */
export function armPath(p: ArmProduct, initial: number, margin: number, sofr: SofrPath, months: number, worstCase = false) {
  const fixedMonths = p.fixedYears * 12
  const rates: number[] = [initial]
  let prev = initial
  let idx = 0
  for (let m = 1; m <= months; m++) {
    if (m > fixedMonths && (m - fixedMonths - 1) % 6 === 0) {
      const cap = idx === 0 ? p.caps.first : p.caps.periodic
      const target = worstCase ? Infinity : round8(sofr(m) + margin)
      let r = Math.min(Math.max(target, prev - cap), prev + cap)
      r = Math.min(r, initial + p.caps.lifetime)
      r = Math.max(r, margin)
      prev = r
      idx++
    }
    rates[m] = prev
  }
  return (m: number) => rates[Math.min(Math.max(1, m), months)]
}

// ------------------------------------------------------------- prepay vs invest

/** Value of $1 of mortgage interest as a tax deduction for this household (0 if they don't itemize). */
export function interestDeductionValue(base: TaxInput, interest: number, balance: number): number {
  if (interest <= 0) return 0
  const without = computeTax({ ...base, mortgageInterest: 0, mortgageBalance: 0 }).total
  const withI = computeTax({ ...base, mortgageInterest: interest, mortgageBalance: balance }).total
  return Math.max(0, (without - withI) / interest)
}

/**
 * Same extra dollars, two uses, compared when the original loan would have been paid off:
 *  - prepay: extra goes to principal; once paid off, the whole payment + extra is invested
 *  - invest: extra is invested monthly at `investReturn` (after tax)
 * Interest is reduced by the deduction value (lost deduction is a cost of prepaying).
 */
export function prepayVsInvest(principal: number, rate: number, months: number, extra: number, investReturn: number, deductionValue: number) {
  const base = amortize({ principal, months, rateAt: () => rate })
  const pre = amortize({ principal, months, rateAt: () => rate, extraMonthly: extra })
  const g = Math.pow(1 + investReturn, 1 / 12) - 1
  const horizon = base.length
  let investPort = 0
  let prepayPort = 0
  const pay = base[0]?.payment ?? 0
  const series: { month: number; prepay: number; invest: number }[] = []
  for (let m = 1; m <= horizon; m++) {
    // invest path: pays the normal schedule, invests the extra and the tax value of its (higher) interest
    investPort = investPort * (1 + g) + extra + base[m - 1].interest * deductionValue
    // prepay path: after payoff, invests the freed payment + extra; gets the tax value of its (lower) interest
    const pr = pre[m - 1]
    prepayPort = prepayPort * (1 + g) + (pr ? pr.interest * deductionValue : pay + extra)
    // wealth built by the extra dollars: extra home equity (vs. the normal schedule) + investments
    const prepayWealth = prepayPort + (base[m - 1].balance - (pr ? pr.balance : 0))
    series.push({ month: m, prepay: prepayWealth, invest: investPort })
  }
  return { base, pre, series }
}

// ------------------------------------------------------------- refinance

export function cumulativeCost(rows: Row[], upfront: number, months: number) {
  // interest + fees paid to date: principal isn't a cost, it's equity
  const out: number[] = []
  let c = upfront
  for (let m = 1; m <= months; m++) {
    c += rows[m - 1]?.interest ?? 0
    out.push(c)
  }
  return out
}
