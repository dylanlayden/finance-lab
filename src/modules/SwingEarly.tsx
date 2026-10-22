import { useMemo, useState } from 'react'
import { LineChart } from '../components/charts'
import { Disclosure, MoneyInput, Panel, PctInput, Stat, pct, usd, usdK } from '../components/ui'
import { useProfile } from '../lib/profile'
import {
  STEADY_DEFAULT,
  SWING_PRESETS,
  catchUpPerYear,
  deterministic,
  extraYears,
  medianReturn,
  quantile,
  simulate,
  type SwingInputs,
} from '../lib/swing'

const BLUE = 'var(--s1)'
const ORANGE = 'var(--s2)'
const PATHS = 2000
const SEED = 2026
const signed = (x: number) => (x >= 0 ? '+' : '−') + usd(Math.abs(x))

export default function SwingEarly() {
  const { profile } = useProfile()
  const startAge = Math.min(60, Math.max(18, profile.age))
  const [age, setAge] = useState(startAge)
  const [retAge, setRetAge] = useState(65)
  const [start, setStart] = useState(Math.round(profile.taxableInvestments + profile.pretaxAccounts + profile.rothAccounts))
  const [contrib, setContrib] = useState(Math.max(6000, profile.you.pretaxRetirement + (profile.status === 'mfj' ? profile.spouse.pretaxRetirement : 0)))
  const [preset, setPreset] = useState('crypto')
  const p0 = SWING_PRESETS.find((p) => p.key === 'crypto')!
  const [swingMean, setSwingMean] = useState(p0.mean)
  const [swingVol, setSwingVol] = useState(p0.vol)
  const [swingYears, setSwingYears] = useState(5)
  const [alloc, setAlloc] = useState(1)
  const [steadyMean, setSteadyMean] = useState(STEADY_DEFAULT.mean)
  const [steadyVol, setSteadyVol] = useState(STEADY_DEFAULT.vol)

  const inputs: SwingInputs = {
    age, retAge: Math.max(age + 1, retAge), start, contrib, steadyMean, steadyVol, swingMean, swingVol, rho: 0.5,
    swingStartAge: age, swingYears: Math.min(swingYears, Math.max(1, retAge - age)), alloc, paths: PATHS, seed: SEED,
  }
  const key = JSON.stringify(inputs)
  const sim = useMemo(() => simulate(inputs), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const T = sim.ages.length - 1
  const q = (k: number) => quantile(sim.diffEnd, k)
  const p10 = q(0.1)
  const p50 = q(0.5)
  const p90 = q(0.9)
  const steadyMedEnd = quantile(sim.steady[T], 0.5)
  const ahead = Array.from(sim.diffEnd).filter((d) => d > 0).length / PATHS
  const g = medianReturn(steadyMean, steadyVol)
  const switchAge = age + inputs.swingYears
  const yearsAfter = inputs.retAge - switchAge
  const catchUp = catchUpPerYear(-p10, g, yearsAfter)
  const swingMedianReturn = medianReturn(swingMean, swingVol)

  // swing minus steady, by age: 10th / 50th / 90th percentile across futures
  const fan = useMemo(
    () =>
      sim.ages.map((a, i) => {
        const d = new Float64Array(PATHS)
        for (let p = 0; p < PATHS; p++) d[p] = sim.swing[i][p] - sim.steady[i][p]
        return { x: a, p90: quantile(d, 0.9), p50: quantile(d, 0.5), p10: quantile(d, 0.1) }
      }),
    [sim],
  )

  // pick-an-outcome
  const [outcome, setOutcome] = useState(-0.3)
  const det = deterministic(inputs, outcome)
  const detDiff = det.swing - det.steady
  const extraYrs = detDiff < 0 ? extraYears(det.swing, det.steady, contrib, det.g) : 0

  // does age matter? same swing started at different ages
  const ageTable = useMemo(() => {
    const starts = [age, age + 10, age + 20, age + 30].filter((s) => s + inputs.swingYears <= inputs.retAge)
    return starts.map((s) => {
      const r = simulate({ ...inputs, swingStartAge: s, paths: 1000 })
      const T2 = r.ages.length - 1
      return { s, atStake: quantile(r.steady[s - age], 0.5), p10: quantile(r.diffEnd, 0.1), p50: quantile(r.diffEnd, 0.5), p90: quantile(r.diffEnd, 0.9), end: quantile(r.steady[T2], 0.5) }
    })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const multiplier = Array.from({ length: inputs.retAge - age }, (_, i) => ({ x: age + i, m: Math.pow(1 + g, inputs.retAge - (age + i)) }))
  const pctRows = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95].map((k) => ({ k, d: q(k) }))
  const maxAbs = Math.max(...pctRows.map((r) => Math.abs(r.d)), 1)

  return (
    <article className="module">
      <header className="module-head">
        <p className="eyebrow">Investing · risk early in life · real (inflation-adjusted) dollars</p>
        <h1>Swing early, then settle</h1>
        <p className="lede">
          Take big risks for your first few years of investing, then switch to a normal diversified portfolio. Or invest steadily from day one. Compounding stretches whatever happens early: gains
          grow for decades, and so do losses. Here's how far ahead or behind you could end up.
        </p>
      </header>

      <Panel title="The two paths">
        <div className="presets" role="group" aria-label="High-risk asset">
          {SWING_PRESETS.map((p) => (
            <button key={p.key} type="button" className={preset === p.key ? 'on' : ''} onClick={() => { setPreset(p.key); setSwingMean(p.mean); setSwingVol(p.vol) }}>
              {p.label} · {pct(p.mean, 0)} avg · {pct(p.vol, 0)} swings
            </button>
          ))}
        </div>
        <div className="inputs-grid">
          <MoneyInput label="Your age now" prefix="" value={age} onChange={(v) => setAge(Math.min(60, Math.max(18, Math.round(v))))} />
          <MoneyInput label="Retire at" prefix="" value={retAge} onChange={(v) => setRetAge(Math.min(80, Math.max(age + 2, Math.round(v))))} />
          <MoneyInput label="Invested today" value={start} onChange={setStart} hint="from your profile" />
          <MoneyInput label="You add each year" value={contrib} onChange={setContrib} />
          <MoneyInput label="Years in the high-risk path" prefix="" value={swingYears} onChange={(v) => setSwingYears(Math.min(20, Math.max(1, Math.round(v))))} />
          <PctInput label="Share in the high-risk asset" value={alloc} onChange={(v) => setAlloc(Math.min(1, Math.max(0, v)))} digits={0} />
          <PctInput label="High-risk: average return" value={swingMean} onChange={(v) => { setPreset('custom'); setSwingMean(v) }} source={(SWING_PRESETS.find((p) => p.key === preset) ?? SWING_PRESETS[0]).source} />
          <PctInput label="High-risk: volatility" value={swingVol} onChange={(v) => { setPreset('custom'); setSwingVol(v) }} source="Standard deviation of yearly returns" />
          <PctInput label="Steady: average return" value={steadyMean} onChange={setSteadyMean} source={STEADY_DEFAULT.source} />
          <PctInput label="Steady: volatility" value={steadyVol} onChange={setSteadyVol} source={STEADY_DEFAULT.source} />
        </div>
      </Panel>

      <section className="answer">
        <p className="headline">
          Swinging for {inputs.swingYears} years puts you ahead at {inputs.retAge} in <b>{pct(ahead, 0)}</b> of {PATHS.toLocaleString()} simulated futures. When it goes well (90th
          percentile), you retire <b>{usdK(p90)} ahead</b>. When it goes badly (10th percentile), you retire <b>{usdK(Math.abs(p10))} behind</b>
          {catchUp > 0 ? (
            <>
              , and catching up would take an extra <b>{usd(catchUp / 12)}/month</b> from age {switchAge} until you retire
            </>
          ) : null}
          .
        </p>
        <div className="stats">
          <Stat label="Chance you end up ahead" value={pct(ahead, 0)} sub={`median outcome: ${signed(p50)}`} />
          <Stat label="Lucky (90th pct)" value={signed(p90)} sub={`${pct(p90 / steadyMedEnd, 0)} of a typical steady result`} />
          <Stat label="Unlucky (10th pct)" value={signed(p10)} sub={`${pct(Math.abs(p10) / steadyMedEnd, 0)} of a typical steady result`} />
          <Stat label="High-risk asset loses >50%" value={pct(sim.windowLossOver50, 0)} sub={`chance over the ${inputs.swingYears}-yr window`} />
        </div>
      </section>

      <Panel title="How far ahead or behind, by age">
        <LineChart
          data={fan}
          series={[
            { key: 'p90', label: 'Lucky (90th pct)', color: BLUE, dash: true },
            { key: 'p50', label: 'Median', color: 'var(--ink-2)' },
            { key: 'p10', label: 'Unlucky (10th pct)', color: ORANGE, dash: true },
          ]}
          refY={{ y: 0, label: 'Same as steady' }}
          markX={{ x: switchAge, label: `Switch to steady · ${switchAge}` }}
          xFormat={(x) => String(Math.round(x))}
          yFormat={(y) => (y < 0 ? '−' : '') + usdK(Math.abs(y))}
          xStep={5}
          ariaLabel="Swing path minus steady path by age, percentiles"
        />
        <p className="note">
          After the switch both paths see the same market, yet the gap keeps widening. That's compounding at work on whatever the high-risk years gained or lost. Notice the swing median sits below its own average: with
          {' '}{pct(swingVol, 0)} volatility, an asset averaging {pct(swingMean, 0)} a year compounds at only about <b>{pct(swingMedianReturn, 1)}</b> in a typical outcome. Big losses
          are hard to undo: a 50% drop needs a 100% gain to break even.
        </p>
      </Panel>

      <div className="two-col">
        <Panel title={`Ahead or behind at ${inputs.retAge}`}>
          <table className="data-table">
            <tbody>
              {pctRows.map((r) => (
                <tr key={r.k} className={r.k === 0.5 ? 'hl' : ''}>
                  <td>{r.k === 0.5 ? 'Median' : `${Math.round(r.k * 100)}th percentile`}</td>
                  <td style={{ width: '45%' }}>
                    <div className="diverge">
                      <span className="half neg">{r.d < 0 && <i style={{ width: `${(Math.abs(r.d) / maxAbs) * 100}%` }} />}</span>
                      <span className="half pos">{r.d > 0 && <i style={{ width: `${(r.d / maxAbs) * 100}%` }} />}</span>
                    </div>
                  </td>
                  <td className="r">{signed(r.d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Swing minus steady at retirement, across simulated futures. Orange = behind, blue = ahead.</p>
        </Panel>
        <Panel title="Why early years echo">
          <LineChart
            data={multiplier}
            series={[{ key: 'm', label: `What $1 gained or lost at each age is worth at ${inputs.retAge}`, color: BLUE }]}
            xFormat={(x) => String(Math.round(x))}
            yFormat={(y) => `${y.toFixed(1)}×`}
            xStep={5}
            height={230}
            ariaLabel="Compounding multiplier by age"
          />
          <p className="note">
            At a {pct(g, 1)} typical real return, $10,000 gained or lost at {age} becomes {usd(10000 * Math.pow(1 + g, inputs.retAge - age))} at {inputs.retAge}. The same $10,000 at {Math.min(inputs.retAge - 1, age + 20)} becomes only{' '}
            {usd(10000 * Math.pow(1 + g, inputs.retAge - Math.min(inputs.retAge - 1, age + 20)))}.
          </p>
        </Panel>
      </div>

      <Panel title="Pick an outcome">
        <label className="field-label" htmlFor="outcome">
          The high-risk asset returns <b className="input-text">{outcome >= 0 ? '+' : ''}{pct(outcome, 0)}</b> every year for {inputs.swingYears} years
        </label>
        <input id="outcome" type="range" min={-0.6} max={1} step={0.05} value={outcome} onChange={(e) => setOutcome(+e.target.value)} />
        <div className="stats">
          <Stat label={`At age ${switchAge}, vs. steady`} value={signed(det.atSwitchSwing - det.atSwitchSteady)} sub={`${usdK(det.atSwitchSwing)} vs ${usdK(det.atSwitchSteady)}`} />
          <Stat label={`At ${inputs.retAge}, vs. steady`} value={signed(detDiff)} sub={`${pct(detDiff / det.steady, 0)} of the steady result`} />
          <Stat label="Growth multiplier" value={Math.abs(det.atSwitchSwing - det.atSwitchSteady) > 1 ? `${(detDiff / (det.atSwitchSwing - det.atSwitchSteady)).toFixed(1)}×` : '–'} sub={`the age-${switchAge} gap grows this much by ${inputs.retAge}`} />
          <Stat label={detDiff < 0 ? 'To catch up' : 'Head start'} value={detDiff < 0 ? (extraYrs === Infinity ? '40+ yrs' : `${extraYrs} more yrs`) : `${usd(detDiff)}`} sub={detDiff < 0 ? 'of saving and investing past retirement age' : 'extra at retirement'} />
        </div>
        <p className="note">No randomness here: the steady portfolio earns its typical {pct(det.g, 1)} every year, and only the high-risk years change.</p>
      </Panel>

      <Panel title="Does it matter how old you are when you swing?">
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Swing from age</th>
                <th className="r">Balance going in (median)</th>
                <th className="r">Unlucky (10th)</th>
                <th className="r">Median</th>
                <th className="r">Lucky (90th)</th>
              </tr>
            </thead>
            <tbody>
              {ageTable.map((r) => (
                <tr key={r.s} className={r.s === age ? 'hl' : ''}>
                  <td>
                    {r.s}–{r.s + inputs.swingYears}
                  </td>
                  <td className="r">{usd(r.atStake)}</td>
                  <td className="r">{signed(r.p10)}</td>
                  <td className="r">{signed(r.p50)}</td>
                  <td className="r">{signed(r.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Same high-risk bet, same number of years, started at different ages. Early on, little money is at stake but it has decades to compound. Later, more money is at stake with less time to grow,
          and less time to recover.
        </p>
      </Panel>

      <Disclosure title="Assumptions, sources & what's not modeled">
        <ul className="sources">
          <li>
            {PATHS.toLocaleString()} simulated futures (seeded, so results repeat). Yearly returns are lognormal with the average and volatility you set. The high-risk asset is 0.5 correlated with the steady
            portfolio. Both paths use the same market draws, and contributions are added at the start of each year.
          </li>
          <li>{STEADY_DEFAULT.source}. High-risk presets are illustrative assumptions, not forecasts.</li>
          <li>
            Not modeled: taxes and fees (or the tax bill from selling the high-risk position), fat tails and crashes beyond the lognormal model, behavior (selling at the bottom, or never switching back), and
            your career income, which for most young people is a much bigger asset than the portfolio and can make early risk more survivable.
          </li>
        </ul>
      </Disclosure>
    </article>
  )
}
