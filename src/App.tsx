import { useEffect, useState } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { usd } from './components/ui'
import { totalPay, useProfile } from './lib/profile'
import MortgageLab from './modules/MortgageLab'
import SFCost from './modules/SFCost'
import TaxExplorer from './modules/TaxExplorer'
import Home from './pages/Home'
import Methodology from './pages/Methodology'

function useRoute() {
  const get = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const on = () => {
      setRoute(get())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function useTheme() {
  const [theme, setTheme] = useState<string | null>(() => {
    try {
      return localStorage.getItem('finance-lab.theme')
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    try {
      if (theme) localStorage.setItem('finance-lab.theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return { dark, toggle: () => setTheme(dark ? 'light' : 'dark') }
}

function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Your profile">
        <header>
          <h2>Your profile</h2>
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </header>
        {open && <ProfileForm compact />}
      </aside>
    </>
  )
}

export default function App() {
  const route = useRoute()
  const { profile, isExample } = useProfile()
  const [drawer, setDrawer] = useState(false)
  const { dark, toggle } = useTheme()

  let page
  if (route === '/tax-brackets') page = <TaxExplorer />
  else if (route === '/sf-cost') page = <SFCost />
  else if (route === '/mortgage') page = <MortgageLab />
  else if (route === '/methodology') page = <Methodology />
  else if (route === '/profile')
    page = (
      <article className="module narrow">
        <header className="module-head">
          <p className="eyebrow">Step 1</p>
          <h1>Your profile</h1>
          <p className="lede">Enter it once. Every question on the site runs on these numbers, and you can tweak any assumption inside each question.</p>
        </header>
        <ProfileForm />
        <p className="center">
          <a className="btn primary" href="#/">
            Go to the questions →
          </a>
        </p>
      </article>
    )
  else page = <Home />

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="logo" aria-hidden>
            ∑
          </span>
          Personal Finance Lab
        </a>
        <nav>
          <a href="#/" className={route === '/' ? 'active' : ''}>
            Questions
          </a>
          <a href="#/methodology" className={route === '/methodology' ? 'active' : ''}>
            Methodology
          </a>
        </nav>
        <div className="top-actions">
          <button type="button" className="chip" onClick={() => setDrawer(true)} title="Edit your profile">
            <span className="dot" data-example={isExample} />
            {isExample ? 'Example' : 'You'} · {profile.status === 'mfj' ? 'Joint' : 'Single'} · {usd(totalPay(profile))}
            <span className="chip-edit">Edit</span>
          </button>
          <button type="button" className="icon-btn" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main>{page}</main>
      <footer className="footer">
        <p>
          Built by Dylan Layden. Educational calculators using 2026 federal and California tax law. Not investment, tax or legal advice.
          Your inputs stay in your browser.
        </p>
      </footer>
      <ProfileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  )
}
