import { useProfile } from '../lib/profile'

const MODULES = [
  { href: '#/tax-brackets', live: true, tag: 'Taxes', title: 'Where does your next dollar go?', body: 'Your real marginal rate (federal + California + payroll), how the brackets fill up, and what a raise or a bigger 401(k) contribution is actually worth.' },
  { href: '#/sf-cost', live: true, tag: 'Housing', title: 'What does San Francisco cost you?', body: 'The income you need to buy the median home or rent the median apartment, by lender standards and by comfort standards, and when buying beats renting.' },
  { href: '#/mortgage', live: true, tag: 'Mortgages', title: 'Mortgage Lab', body: 'Amortization, extra payments, a fixed rate vs. a SOFR-indexed ARM, and when a refinance pays for itself.' },
  { href: '#/roth', live: true, tag: 'Retirement', title: 'Roth or traditional?', body: 'The retirement tax rate at which each one wins, for your income and your California taxes.' },
  { href: '#/dollar', live: true, tag: 'Taxes', title: 'What does $1 really cost you?', body: 'The after-tax price of a dollar through an HSA, a 401(k), pre-tax premiums or a mortgage, plus HDHP + HSA vs. a PPO.' },
  { live: false, tag: 'Investing', title: 'Swing early, then settle', body: 'Take big risks for a few years and then go steady, or invest steadily from day one? How far ahead or behind you end up, and why compounding magnifies both.' },
]

export default function Home() {
  const { isExample } = useProfile()
  return (
    <article className="home">
      <section className="hero">
        <p className="eyebrow">Personal Finance Lab · California · 2026</p>
        <h1>Put in your numbers. See how the money questions play out.</h1>
        <p className="lede">
          Each question runs on your own income and household, using the actual 2026 federal and California tax rules. Change any assumption and the answer updates. Every number shows where it came from.
        </p>
        <div className="hero-actions">
          <a className="btn primary" href="#/profile">
            {isExample ? 'Enter your numbers' : 'Edit your profile'}
          </a>
          <a className="btn" href="#/tax-brackets">
            Try it with an example →
          </a>
        </div>
        <p className="hint">No sign-up. Your inputs are saved only in this browser.</p>
      </section>
      <section className="cards">
        {MODULES.map((m) =>
          m.live ? (
            <a key={m.title} className="card live" href={m.href}>
              <span className="tag">{m.tag}</span>
              <h2>{m.title}</h2>
              <p>{m.body}</p>
              <span className="go">Open →</span>
            </a>
          ) : (
            <div key={m.title} className="card soon" aria-disabled>
              <span className="tag">{m.tag}</span>
              <h2>{m.title}</h2>
              <p>{m.body}</p>
              <span className="go muted">In the lab</span>
            </div>
          ),
        )}
      </section>
    </article>
  )
}
