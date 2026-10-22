import { describe, expect, it } from 'vitest'
import { breakEvenYear, firstYearInterest, lenderIncome, monthlyCost, pmt, rentVsBuy } from './housing'
import type { TaxInput } from './tax/engine'

const renter: TaxInput = {
  status: 'single', kidsUnder17: 0, otherDependents: 0,
  earners: [{ wages: 300000, rsu: 0, pretaxRetirement: 0, ssCovered: true, sdiCovered: true }],
  otherIncome: 0, hsa: 0, sec125: 0, mortgageInterest: 0, mortgageBalance: 0, propertyTax: 0, charity: 0,
}

describe('housing math', () => {
  it('pmt matches the textbook value ($1M, 6%, 30y = $5,995.51)', () => expect(pmt(0.06, 30, 1_000_000)).toBeCloseTo(5995.51, 2))
  it('first-year interest on $1M at 6% is a bit under $60k', () => {
    const f = firstYearInterest(1_000_000, 0.06, 30)
    expect(f.interest).toBeGreaterThan(59000)
    expect(f.interest).toBeLessThan(60000)
  })
  it('monthly cost adds PMI only below 20% down', () => {
    const base = { price: 1_000_000, rate: 0.06, years: 30, propTaxRate: 0.012, insurance: 2400, hoa: 0, pmiRate: 0.006 }
    expect(monthlyCost({ ...base, downPct: 0.2 }).pmi).toBe(0)
    expect(monthlyCost({ ...base, downPct: 0.1 }).pmi).toBeCloseTo((900000 * 0.006) / 12, 6)
  })
  it('lender income uses the binding ratio', () => {
    expect(lenderIncome(2800, 0, 0.28, 0.36)).toBeCloseTo(120000, 6)
    expect(lenderIncome(2800, 2000, 0.28, 0.36)).toBeCloseTo((4800 / 0.36) * 12, 6)
  })
  it('rent vs buy: with zero appreciation and cheap rent, buying never wins', () => {
    const rows = rentVsBuy(
      { price: 1_500_000, downPct: 0.2, rate: 0.074, years: 30, propTaxRate: 0.0118, insurance: 2600, hoa: 0, pmiRate: 0.006, rent: 4000, closingBuy: 0.015, sellCost: 0.06, maintenance: 0.01, appreciation: 0, rentGrowth: 0.03, investReturn: 0.06, costGrowth: 0.03, propTaxGrowth: 0.02, horizon: 30 },
      renter,
    )
    expect(rows).toHaveLength(30)
    expect(breakEvenYear(rows)).toBeNull()
  })
  it('rent vs buy: with strong appreciation and expensive rent, buying wins eventually', () => {
    const rows = rentVsBuy(
      { price: 1_000_000, downPct: 0.2, rate: 0.05, years: 30, propTaxRate: 0.0118, insurance: 2400, hoa: 0, pmiRate: 0.006, rent: 6000, closingBuy: 0.015, sellCost: 0.06, maintenance: 0.01, appreciation: 0.05, rentGrowth: 0.04, investReturn: 0.05, costGrowth: 0.03, propTaxGrowth: 0.02, horizon: 30 },
      renter,
    )
    expect(breakEvenYear(rows)).not.toBeNull()
  })
})
