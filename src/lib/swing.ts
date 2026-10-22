// "Swing early, then settle": a high-risk allocation for the first few years, then the steady
// portfolio, vs. the steady portfolio from day one. Real (inflation-adjusted) dollars.
// Both paths share the same market draws (common random numbers), so the only difference
// between them is the swing window.

export interface SwingInputs {
  age: number
  retAge: number
  start: number // starting balance
  contrib: number // per year, start of year
  steadyMean: number // arithmetic real return
  steadyVol: number
  swingMean: number
  swingVol: number
  rho: number // correlation of the swing asset with the steady portfolio
  swingStartAge: number
  swingYears: number
  alloc: number // share of the portfolio in the swing asset during the window
  paths: number
  seed: number
}

export const SWING_PRESETS = [
  { key: 'stock', label: 'One tech stock', mean: 0.07, vol: 0.4, source: 'Assumption: typical single large-cap tech stock volatility ~35-45%; expected return about the market\'s' },
  { key: 'lev', label: '2x leveraged index', mean: 0.09, vol: 0.32, source: 'Assumption: twice the index exposure, less borrowing and fund costs; daily-reset leveraged ETFs also lose extra to volatility' },
  { key: 'crypto', label: 'Crypto-like', mean: 0.15, vol: 0.75, source: 'Assumption: very high expected return paired with extreme volatility (illustrative, not a forecast)' },
  { key: 'moon', label: 'Moonshot / venture', mean: 0.12, vol: 1.0, source: 'Assumption: most bets lose, a few win big (illustrative)' },
]

export const STEADY_DEFAULT = { mean: 0.06, vol: 0.16, source: 'Assumption: diversified global stock portfolio, ~6% average real return with ~16% volatility (long-run historical ballpark)' }

/** lognormal parameters that match an arithmetic mean m and standard deviation s */
export function lnParams(m: number, s: number) {
  const sig2 = Math.log(1 + (s * s) / ((1 + m) * (1 + m)))
  return { mu: Math.log(1 + m) - sig2 / 2, sig: Math.sqrt(sig2) }
}
/** typical (median) compound return */
export const medianReturn = (m: number, s: number) => Math.exp(lnParams(m, s).mu) - 1

function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

export interface SwingResult {
  ages: number[]
  steady: Float64Array[] // per year index: values across paths
  swing: Float64Array[]
  diffEnd: Float64Array // swing - steady at retirement, per path
  windowLossOver50: number // share of paths where the swing asset lost > 50% over the window
}

export function simulate(x: SwingInputs): SwingResult {
  const T = Math.max(1, x.retAge - x.age)
  const ages = Array.from({ length: T + 1 }, (_, i) => x.age + i)
  const st = lnParams(x.steadyMean, x.steadyVol)
  const sw = lnParams(x.swingMean, x.swingVol)
  const steady = ages.map(() => new Float64Array(x.paths))
  const swing = ages.map(() => new Float64Array(x.paths))
  const z = rng(x.seed)
  const k = Math.sqrt(Math.max(0, 1 - x.rho * x.rho))
  let bigLoss = 0
  for (let p = 0; p < x.paths; p++) {
    let ws = x.start
    let wx = x.start
    let assetGrowth = 1
    steady[0][p] = ws
    swing[0][p] = wx
    for (let t = 0; t < T; t++) {
      const z1 = z()
      const z2 = z()
      const rs = Math.exp(st.mu + st.sig * z1) - 1
      const age = x.age + t
      const inWindow = age >= x.swingStartAge && age < x.swingStartAge + x.swingYears
      let rx = rs
      if (inWindow) {
        const ra = Math.exp(sw.mu + sw.sig * (x.rho * z1 + k * z2)) - 1
        assetGrowth *= 1 + ra
        rx = x.alloc * ra + (1 - x.alloc) * rs
      }
      ws = (ws + x.contrib) * (1 + rs)
      wx = (wx + x.contrib) * (1 + rx)
      steady[t + 1][p] = ws
      swing[t + 1][p] = wx
    }
    if (assetGrowth < 0.5) bigLoss++
  }
  const diffEnd = new Float64Array(x.paths)
  for (let p = 0; p < x.paths; p++) diffEnd[p] = swing[T][p] - steady[T][p]
  return { ages, steady, swing, diffEnd, windowLossOver50: bigLoss / x.paths }
}

export function quantile(arr: Float64Array, q: number) {
  const a = Float64Array.from(arr).sort()
  const i = (a.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return a[lo] + (a[hi] - a[lo]) * (i - lo)
}

/** Deterministic path: steady earns g every year; the swing window earns `swingReturn` on the swing share. */
export function deterministic(x: SwingInputs, swingReturn: number) {
  const g = medianReturn(x.steadyMean, x.steadyVol)
  const T = Math.max(1, x.retAge - x.age)
  let ws = x.start
  let wx = x.start
  let atSwitchSteady = x.start
  let atSwitchSwing = x.start
  for (let t = 0; t < T; t++) {
    const age = x.age + t
    const inWindow = age >= x.swingStartAge && age < x.swingStartAge + x.swingYears
    const rx = inWindow ? x.alloc * swingReturn + (1 - x.alloc) * g : g
    ws = (ws + x.contrib) * (1 + g)
    wx = (wx + x.contrib) * (1 + rx)
    if (age + 1 === x.swingStartAge + x.swingYears) {
      atSwitchSteady = ws
      atSwitchSwing = wx
    }
  }
  return { steady: ws, swing: wx, atSwitchSteady, atSwitchSwing, g }
}

/** Extra savings per year, from `fromAge` to retirement, that closes a shortfall at retirement. */
export function catchUpPerYear(shortfall: number, g: number, years: number) {
  if (shortfall <= 0 || years <= 0) return 0
  const f = ((Math.pow(1 + g, years) - 1) / g) * (1 + g)
  return shortfall / f
}

/** Extra years of work (saving `contrib`, growing at g) needed to make up a shortfall. */
export function extraYears(balance: number, target: number, contrib: number, g: number) {
  let w = balance
  for (let y = 0; y <= 40; y++) {
    if (w >= target) return y
    w = (w + contrib) * (1 + g)
  }
  return Infinity
}
