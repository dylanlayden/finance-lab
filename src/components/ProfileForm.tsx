import { useProfile, type Person } from '../lib/profile'
import { Check, MoneyInput, PctInput, Segmented, Stepper } from './ui'

function PersonFields({ who, title }: { who: 'you' | 'spouse'; title: string }) {
  const { profile, updatePerson } = useProfile()
  const p = profile[who]
  const set = (patch: Partial<Person>) => updatePerson(who, patch)
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      <div className="grid2">
        <MoneyInput label="Salary" value={p.salary} onChange={(v) => set({ salary: v })} hint="per year, before deductions" />
        <MoneyInput label="Cash bonus" value={p.bonus} onChange={(v) => set({ bonus: v })} />
        <MoneyInput label="RSUs / stock vesting" value={p.rsu} onChange={(v) => set({ rsu: v })} hint="value at vest this year" />
        <MoneyInput label="Pre-tax 401(k)/403(b)/pension" value={p.pretaxRetirement} onChange={(v) => set({ pretaxRetirement: v })} hint="traditional, not Roth" />
      </div>
      <Check label="Pays Social Security" checked={p.ssCovered} onChange={(v) => set({ ssCovered: v })} hint="Uncheck for e.g. many CA public-school teachers" />
      <Check label="Pays CA SDI" checked={p.sdiCovered} onChange={(v) => set({ sdiCovered: v })} />
    </fieldset>
  )
}

export function ProfileForm({ compact = false }: { compact?: boolean }) {
  const { profile: p, update, loadExample, clear, isExample } = useProfile()
  return (
    <div className={`profile-form ${compact ? 'compact' : ''}`}>
      <div className="example-bar">
        <span>{isExample ? `Showing ${p.label.toLowerCase()}. Edit any field to make it yours.` : 'Saved in this browser only. Nothing leaves your device.'}</span>
        <div className="example-btns">
          <button type="button" className="btn ghost" onClick={() => loadExample('single')}>Single example</button>
          <button type="button" className="btn ghost" onClick={() => loadExample('family')}>Family example</button>
          <button type="button" className="btn ghost" onClick={clear}>Start blank</button>
        </div>
      </div>

      <fieldset className="group">
        <legend>Household</legend>
        <div className="grid2">
          <Segmented label="Filing status" value={p.status} onChange={(v) => update({ status: v })} options={[{ value: 'single', label: 'Single' }, { value: 'mfj', label: 'Married, joint' }]} />
          <MoneyInput label="Your age" prefix="" value={p.age} onChange={(v) => update({ age: Math.min(100, Math.round(v)) })} />
          <Stepper label="Children under 17" value={p.kidsUnder17} onChange={(v) => update({ kidsUnder17: v })} />
          <Stepper label="Other dependents" value={p.otherDependents} onChange={(v) => update({ otherDependents: v })} />
        </div>
      </fieldset>

      <PersonFields who="you" title="Your income" />
      {p.status === 'mfj' && <PersonFields who="spouse" title="Spouse's income" />}

      <fieldset className="group">
        <legend>Other income & benefits</legend>
        <div className="grid2">
          <MoneyInput label="Interest & dividends" value={p.otherIncome} onChange={(v) => update({ otherIncome: v })} hint="per year" />
          <MoneyInput label="HSA contributions (payroll)" value={p.hsa} onChange={(v) => update({ hsa: v })} />
          <MoneyInput label="Health premiums (payroll)" value={p.healthPremiums} onChange={(v) => update({ healthPremiums: v })} hint="your share, per year" />
          <MoneyInput label="Charitable giving" value={p.charity} onChange={(v) => update({ charity: v })} hint="per year" />
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Housing</legend>
        <Segmented label="You" value={p.housing} onChange={(v) => update({ housing: v })} options={[{ value: 'rent', label: 'Rent' }, { value: 'own', label: 'Own' }]} />
        {p.housing === 'rent' ? (
          <div className="grid2">
            <MoneyInput label="Monthly rent" value={p.rent} onChange={(v) => update({ rent: v })} />
          </div>
        ) : (
          <div className="grid2">
            <MoneyInput label="Mortgage balance" value={p.mortgageBalance} onChange={(v) => update({ mortgageBalance: v })} />
            <MoneyInput label="Mortgage interest paid" value={p.mortgageInterest} onChange={(v) => update({ mortgageInterest: v })} hint="per year" />
            <MoneyInput label="Property tax" value={p.propertyTax} onChange={(v) => update({ propertyTax: v })} hint="per year" />
            <PctInput label="Mortgage rate" value={p.mortgageRate} onChange={(v) => update({ mortgageRate: v })} />
            <MoneyInput label="Years left on mortgage" prefix="" value={p.mortgageYearsLeft} onChange={(v) => update({ mortgageYearsLeft: Math.min(40, Math.round(v)) })} />
          </div>
        )}
      </fieldset>

      {!compact && (
        <fieldset className="group">
          <legend>Spending & savings (used by upcoming modules)</legend>
          <div className="grid2">
            <MoneyInput label="Monthly spending, excl. housing" value={p.monthlyExpenses} onChange={(v) => update({ monthlyExpenses: v })} />
            <MoneyInput label="Cash & savings" value={p.cash} onChange={(v) => update({ cash: v })} />
            <MoneyInput label="Taxable investments" value={p.taxableInvestments} onChange={(v) => update({ taxableInvestments: v })} />
            <MoneyInput label="Pre-tax retirement accounts" value={p.pretaxAccounts} onChange={(v) => update({ pretaxAccounts: v })} />
            <MoneyInput label="Roth accounts" value={p.rothAccounts} onChange={(v) => update({ rothAccounts: v })} />
          </div>
        </fieldset>
      )}
    </div>
  )
}
