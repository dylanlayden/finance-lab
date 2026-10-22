import { describe, expect, it } from 'vitest'
import { phaseAllowed, retirementMarginal, retirementTax, taxableSocialSecurity } from './retirementTax'

describe('retirement tax', () => {
  it('Social Security taxation (IRS worksheet example: single, $20k SS + $30k other)', () => {
    // provisional 40k: 0.85*(40k-34k)=5,100 + min(10k, 4,500) = 9,600
    expect(taxableSocialSecurity('single', 30000, 20000)).toBeCloseTo(9600, 6)
  })
  it('no SS tax under the first threshold', () => expect(taxableSocialSecurity('mfj', 10000, 30000)).toBe(0))
  it('caps at 85% of benefits', () => expect(taxableSocialSecurity('single', 200000, 40000)).toBeCloseTo(34000, 6))
  it('tax torpedo: marginal fed rate in the phase-in zone exceeds the bracket rate', () => {
    const m = retirementMarginal({ status: 'single', over65: 1, ordinary: 30000, socialSecurity: 30000, inCA: false })
    expect(m.fed).toBeGreaterThan(0.12 * 1.5)
  })
  it('CA does not tax Social Security and is skipped outside CA', () => {
    expect(retirementTax({ status: 'single', over65: 1, ordinary: 0, socialSecurity: 40000, inCA: true }).ca).toBe(0)
    expect(retirementTax({ status: 'single', over65: 1, ordinary: 80000, socialSecurity: 0, inCA: false }).ca).toBe(0)
  })
  it('phase-out fraction', () => {
    expect(phaseAllowed(100, [200, 300])).toBe(1)
    expect(phaseAllowed(250, [200, 300])).toBeCloseTo(0.5, 6)
    expect(phaseAllowed(400, [200, 300])).toBe(0)
  })
})
