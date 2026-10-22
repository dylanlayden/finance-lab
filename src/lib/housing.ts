// Housing math for the "What does San Francisco cost you?" module.
// Default market figures are hand-updated snapshots with their source and date.

import { computeTax, withTotalPay, type TaxInput } from './tax/engine'

export interface Sourced {
  value: number
  source: string
}

export const SF = {
  asOf: 'October 2026',
  homes: {
    sfh: { label: 'Median single-family', value: 2054000, source: 'California Association of Realtors, San Francisco County median single-family sale price, September 2026' },
    all: { label: 'Median home (all types)', value: 1689500, source: 'Homes.com market report (21-Oct-2026), San Francisco median sale price, September 2026' },
    condo: { label: 'Typical condo', value: 1230000, source: 'SF brokerage market report, median condo sale price, September 2026 (single local source - verify)' },
  },
  rents: {
    studio: { label: 'Studio', value: 2795, source: 'PadMapper median asking rent, San Francisco, August 2026' },
    one: { label: '1 bedroom', value: 4490, source: 'RentHop median asking rent, San Francisco, October 2026' },
    two: { label: '2 bedrooms', value: 6168, source: 'RentHop median asking rent, San Francisco, October 2026' },
    three: { label: '3 bedrooms', value: 7200, source: 'PadMapper median asking rent, San Francisco, August 2026' },
  },
  rate30: { value: 0.074, source: 'Freddie Mac PMMS, 30-year fixed average, week of 15-Oct-2026 (conforming loans; jumbo quotes differ)' },
  propTaxRate: { value: 0.0118162182, source: 'SF Treasurer: FY2026-27 secured property tax rate 1.18162182% (plus any parcel-specific assessments)' },
}

export const DEFAULTS = {
  downPct: { value: 0.2, source: 'Conventional 20% down avoids PMI; most jumbo lenders require 10-20%' },
  insurance: { value: 2600, source: 'Assumption: homeowners policy per year (condo HO-6 policies cost less)' },
  pmiRate: { value: 0.006, source: 'Assumption: PMI ~0.6% of the loan per year while loan-to-value > 78%' },
  frontEnd: { value: 0.28, source: 'Conventional underwriting guideline: housing costs <= 28% of gross monthly income' },
  backEnd: { value: 0.36, source: 'Conventional underwriting guideline: housing + other debt <= 36% (some programs allow up to 43-45%)' },
  comfort: { value: 0.3, source: 'Planning rule of thumb: housing <= 30% of take-home pay' },
  rentMultiple: { value: 3, source: 'Common SF landlord screen: gross monthly income >= 3x monthly rent (some accept 2.5x)' },
  closingBuy: { value: 0.015, source: 'Assumption: lender, title, escrow fees ~1.5% of price (SF transfer tax is usually paid by the seller)' },
  sellCost: { value: 0.06, source: 'Assumption: agent commissions + SF transfer tax + other selling costs ~6% of sale price' },
  maintenance: { value: 0.01, source: 'Rule of thumb: ~1% of home value per year' },
  appreciation: { value: 0.035, source: 'Assumption (nominal). Long-run SF home price growth has been volatile; try the downside case' },
  rentGrowth: { value: 0.03, source: 'Assumption (nominal)' },
  investReturn: { value: 0.06, source: 'Assumption: diversified portfolio, nominal, after taxes' },
  costGrowth: { value: 0.03, source: 'Assumption: insurance, HOA and maintenance grow with inflation' },
  propTaxGrowth: { value: 0.02, source: 'Prop 13: assessed value can rise at most 2% per year while you own it' },
}

export function pmt(rateAnnual: number, years: number, principal: number): number {
  const r = rateAnnual / 12
  const n = years * 12
  if (principal <= 0) return 0
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n))
}

export interface BuyInputs {
  price: number
  downPct: number
  rate: number
  years: number
  propTaxRate: number
  insurance: number // per year
  hoa: number // per month
  pmiRate: number
}

export interface MonthlyCost {
  pi: number
  propertyTax: number
  insurance: number
  hoa: number
  pmi: number
  total: number
  loan: number
  down: number
}

export function monthlyCost(b: BuyInputs): MonthlyCost {
  const down = b.price * b.downPct
  const loan = b.price - down
  const pi = pmt(b.rate, b.years, loan)
  const propertyTax = (b.price * b.propTaxRate) / 12
  const insurance = b.insurance / 12
  const pmi = b.downPct < 0.2 ? (loan * b.pmiRate) / 12 : 0
  return { pi, propertyTax, insurance, hoa: b.hoa, pmi, total: pi + propertyTax + insurance + b.hoa + pmi, loan, down }
}

/** First-year mortgage interest and average balance on a new loan. */
export function firstYearInterest(loan: number, rate: number, years: number) {
  const r = rate / 12
  const p = pmt(rate, years, loan)
  let bal = loan
  let interest = 0
  let balSum = 0
  for (let m = 0; m < 12; m++) {
    balSum += bal
    const i = bal * r
    interest += i
    bal -= p - i
  }
  return { interest, avgBalance: balSum / 12 }
}

export function lenderIncome(housingMonthly: number, otherDebtMonthly: number, front: number, back: number): number {
  return 12 * Math.max(housingMonthly / front, (housingMonthly + otherDebtMonthly) / back)
}

/** Total household W-2 pay needed so that annual take-home pay hits `targetTakeHome`. */
export function payForTakeHome(base: TaxInput, targetTakeHome: number): number {
  let lo = 0
  let hi = 10_000_000
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (computeTax(withTotalPay(base, mid)).takeHome < targetTakeHome) lo = mid
    else hi = mid
  }
  return hi
}

/** Largest value of x in [0, hi] for which ok(x) holds, assuming ok is monotone (true then false). */
export function maxWhere(ok: (x: number) => boolean, hi: number): number {
  if (!ok(0)) return 0
  let lo = 0
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return lo
}

// ------------------------------------------------------------ rent vs. buy

export interface RentBuyInputs extends BuyInputs {
  rent: number // monthly, comparable home
  closingBuy: number
  sellCost: number
  maintenance: number
  appreciation: number
  rentGrowth: number
  investReturn: number
  costGrowth: number
  propTaxGrowth: number
  horizon: number
}

export interface RentBuyYear {
  year: number
  homeValue: number
  balance: number
  ownerCost: number // cash cost of owning this year, after tax savings
  rentCost: number
  taxSavings: number
  interest: number
  buyerNetWorth: number
  renterNetWorth: number
}

/**
 * Year-by-year net worth of buying vs. renting the same home.
 * Whoever has the lower cash cost in a year invests the difference at `investReturn`.
 * The renter starts by investing the down payment + closing costs instead.
 * `taxBase` is the household with no housing deductions; tax savings = tax(renting) - tax(owning).
 */
export function rentVsBuy(x: RentBuyInputs, taxBase: TaxInput): RentBuyYear[] {
  const down = x.price * x.downPct
  const loan = x.price - down
  const r = x.rate / 12
  const pay = pmt(x.rate, x.years, loan)
  const baseTax = computeTax(taxBase).total
  let bal = loan
  let buyerPort = 0
  let renterPort = down + x.price * x.closingBuy
  const out: RentBuyYear[] = []
  for (let y = 1; y <= x.horizon; y++) {
    let interest = 0
    let balSum = 0
    let pmi = 0
    let mortgagePaid = 0
    for (let m = 0; m < 12; m++) {
      if (bal <= 0.005) break
      balSum += bal
      const i = bal * r
      const principal = Math.min(bal, pay - i)
      interest += i
      mortgagePaid += i + principal
      if (x.downPct < 0.2 && bal > 0.78 * x.price) pmi += (loan * x.pmiRate) / 12
      bal -= principal
    }
    const g = Math.pow(1 + x.costGrowth, y - 1)
    const homeValueStart = x.price * Math.pow(1 + x.appreciation, y - 1)
    const propTax = x.price * x.propTaxRate * Math.pow(1 + x.propTaxGrowth, y - 1)
    const ownTax = computeTax({ ...taxBase, mortgageInterest: interest, mortgageBalance: balSum / 12, propertyTax: propTax }).total
    const taxSavings = Math.max(0, baseTax - ownTax)
    const ownerCost = mortgagePaid + propTax + x.insurance * g + x.hoa * 12 * g + x.maintenance * homeValueStart + pmi - taxSavings
    const rentCost = x.rent * 12 * Math.pow(1 + x.rentGrowth, y - 1)
    const diff = ownerCost - rentCost
    renterPort = renterPort * (1 + x.investReturn) + Math.max(0, diff)
    buyerPort = buyerPort * (1 + x.investReturn) + Math.max(0, -diff)
    const homeValue = x.price * Math.pow(1 + x.appreciation, y)
    out.push({
      year: y,
      homeValue,
      balance: Math.max(0, bal),
      ownerCost,
      rentCost,
      taxSavings,
      interest,
      buyerNetWorth: homeValue * (1 - x.sellCost) - Math.max(0, bal) + buyerPort,
      renterNetWorth: renterPort,
    })
  }
  return out
}

export function breakEvenYear(rows: RentBuyYear[]): number | null {
  // first year from which buying stays ahead
  for (let i = 0; i < rows.length; i++) {
    if (rows.slice(i).every((r) => r.buyerNetWorth >= r.renterNetWorth)) return rows[i].year
  }
  return null
}
