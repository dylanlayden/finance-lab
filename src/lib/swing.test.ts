import { describe, expect, it } from 'vitest'
import { catchUpPerYear, deterministic, lnParams, medianReturn, quantile, simulate, type SwingInputs } from './swing'

const base: SwingInputs = {
  age: 25, retAge: 65, start: 10000, contrib: 10000, steadyMean: 0.06, steadyVol: 0.16,
  swingMean: 0.15, swingVol: 0.75, rho: 0.5, swingStartAge: 25, swingYears: 5, alloc: 1, paths: 2000, seed: 7,
}

describe('swing early, then settle', () => {
  it('lognormal parameters reproduce the arithmetic mean', () => {
    const { mu, sig } = lnParams(0.15, 0.75)
    expect(Math.exp(mu + (sig * sig) / 2) - 1).toBeCloseTo(0.15, 10)
  })
  it('volatility drag: median return is below the average return', () => {
    expect(medianReturn(0.15, 0.75)).toBeLessThan(0.15)
    expect(medianReturn(0.06, 0.16)).toBeCloseTo(0.0485, 3)
  })
  it('no swing (0% allocation) means no difference on any path', () => {
    const r = simulate({ ...base, alloc: 0, paths: 200 })
    expect(Math.max(...Array.from(r.diffEnd).map(Math.abs))).toBeLessThan(1e-6)
  })
  it('a swing produces winners and losers', () => {
    const r = simulate(base)
    expect(quantile(r.diffEnd, 0.1)).toBeLessThan(0)
    expect(quantile(r.diffEnd, 0.9)).toBeGreaterThan(0)
  })
  it('same seed, same answer', () => {
    expect(simulate(base).diffEnd[17]).toBe(simulate(base).diffEnd[17])
  })
  it('deterministic: a swing that earns the steady rate changes nothing', () => {
    const g = medianReturn(0.06, 0.16)
    const d = deterministic(base, g)
    expect(d.swing).toBeCloseTo(d.steady, 4)
  })
  it('catch-up savings close the shortfall exactly', () => {
    const g = 0.05
    const per = catchUpPerYear(100000, g, 20)
    let w = 0
    for (let i = 0; i < 20; i++) w = (w + per) * (1 + g)
    expect(w).toBeCloseTo(100000, 4)
  })
})
