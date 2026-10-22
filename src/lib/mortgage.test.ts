import { describe, expect, it } from 'vitest'
import { ARM_PRODUCTS, amortize, armPath, prepayVsInvest, sofrPath, totalInterest } from './mortgage'

describe('mortgage math', () => {
  it('standard 30-yr interest ($1M at 6%) = 360 x 5,995.51 - 1M', () => {
    const rows = amortize({ principal: 1_000_000, months: 360, rateAt: () => 0.06 })
    expect(rows).toHaveLength(360)
    expect(totalInterest(rows)).toBeCloseTo(5995.505252 * 360 - 1_000_000, 0)
    expect(rows[359].balance).toBeCloseTo(0, 2)
  })
  it('extra payments shorten the loan and cut interest', () => {
    const base = amortize({ principal: 800_000, months: 360, rateAt: () => 0.074 })
    const extra = amortize({ principal: 800_000, months: 360, rateAt: () => 0.074, extraMonthly: 500 })
    expect(extra.length).toBeLessThan(base.length)
    expect(totalInterest(extra)).toBeLessThan(totalInterest(base))
  })
  it('5/6 ARM worst case follows the 2/1/5 caps', () => {
    const p = ARM_PRODUCTS[0]
    const rate = armPath(p, 0.0646, 0.0275, sofrPath(0.04, 0), 360, true)
    expect(rate(60)).toBeCloseTo(0.0646, 10)
    expect(rate(61)).toBeCloseTo(0.0846, 10)
    expect(rate(66)).toBeCloseTo(0.0846, 10)
    expect(rate(67)).toBeCloseTo(0.0946, 10)
    expect(rate(79)).toBeCloseTo(0.1146, 10) // lifetime cap
    expect(rate(200)).toBeCloseTo(0.1146, 10)
  })
  it('flat SOFR resets to index + margin rounded to 1/8%', () => {
    const rate = armPath(ARM_PRODUCTS[0], 0.0646, 0.0275, sofrPath(0.03886, 0), 360)
    expect(rate(61)).toBeCloseTo(0.06625, 10)
  })
  it('falling SOFR is floored at the margin', () => {
    const rate = armPath(ARM_PRODUCTS[0], 0.0646, 0.0275, sofrPath(0.01, -0.01), 360)
    expect(rate(300)).toBeCloseTo(0.0275, 10)
  })
  it('prepay vs invest: if the investment return equals the mortgage rate and no deduction, they roughly tie', () => {
    const r = prepayVsInvest(500_000, 0.06, 360, 500, 0.0617, 0)
    const last = r.series[r.series.length - 1]
    expect(Math.abs(last.prepay - last.invest) / last.invest).toBeLessThan(0.02)
  })
})
