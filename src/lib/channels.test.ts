import { describe, expect, it } from 'vitest'
import { CHANNELS, outOfPocket, planCost, savedPerDollar } from './channels'
import type { TaxInput } from './tax/engine'

const single: TaxInput = {
  status: 'single', kidsUnder17: 0, otherDependents: 0,
  earners: [{ wages: 100000, rsu: 0, pretaxRetirement: 0, ssCovered: true, sdiCovered: true }],
  otherIncome: 0, hsa: 0, sec125: 0, mortgageInterest: 0, mortgageBalance: 0, propertyTax: 0, charity: 0,
}
const ch = (k: string) => CHANNELS.find((c) => c.key === k)!

describe('$1 channels ($100k single, standard deduction)', () => {
  it('401(k): federal 22% + CA 9.3%, no payroll', () => {
    const s = savedPerDollar(single, ch('k401'))
    expect(s.fed).toBeCloseTo(0.22, 6)
    expect(s.ca).toBeCloseTo(0.093, 6)
    expect(s.payroll).toBeCloseTo(0, 6)
  })
  it('HSA: federal + payroll, but no California', () => {
    const s = savedPerDollar(single, ch('hsa'))
    expect(s.fed).toBeCloseTo(0.22, 6)
    expect(s.ca).toBeCloseTo(0, 6)
    expect(s.payroll).toBeCloseTo(0.062 + 0.0145 + 0.013, 6)
  })
  it('pre-tax premiums skip every tax', () => {
    const s = savedPerDollar(single, ch('premium'))
    expect(s.fed + s.ca + s.payroll).toBeCloseTo(0.22 + 0.093 + 0.0895, 6)
  })
  it('mortgage interest is worth nothing to a standard-deduction filer', () => {
    const s = savedPerDollar(single, ch('mortgage'))
    expect(s.fed).toBeCloseTo(0, 6)
  })
  it('529 saves nothing up front', () => {
    const s = savedPerDollar(single, ch('529'))
    expect(s.fed + s.ca + s.payroll).toBe(0)
  })
})

describe('health plan cost', () => {
  const hdhp = { premium: 2400, deductible: 3400, coinsurance: 0.2, oopMax: 8000, employerHsa: 1000 }
  it('out-of-pocket follows deductible, coinsurance and the max', () => {
    expect(outOfPocket(hdhp, 1000)).toBe(1000)
    expect(outOfPocket(hdhp, 5400)).toBeCloseTo(3400 + 400, 6)
    expect(outOfPocket(hdhp, 100000)).toBe(8000)
  })
  it('net cost subtracts employer HSA money and HSA tax savings', () => {
    const c = planCost(hdhp, 0, 0.4, 7750, 0.3)
    expect(c.total).toBeCloseTo(2400 * 0.6 - 1000 - 7750 * 0.3, 6)
  })
})
