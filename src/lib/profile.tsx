import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TaxInput } from './tax/engine'
import type { Status } from './tax/params2026'

export interface Person {
  salary: number
  bonus: number
  rsu: number
  pretaxRetirement: number
  ssCovered: boolean
  sdiCovered: boolean
}

export interface Profile {
  label: string
  status: Status
  age: number
  kidsUnder17: number
  otherDependents: number
  you: Person
  spouse: Person
  otherIncome: number
  hsa: number
  healthPremiums: number
  housing: 'rent' | 'own'
  rent: number // monthly
  mortgageInterest: number // annual
  mortgageBalance: number
  propertyTax: number // annual
  charity: number // annual
  monthlyExpenses: number // non-housing
  cash: number
  taxableInvestments: number
  pretaxAccounts: number
  rothAccounts: number
}

const person = (p: Partial<Person> = {}): Person => ({
  salary: 0, bonus: 0, rsu: 0, pretaxRetirement: 0, ssCovered: true, sdiCovered: true, ...p,
})

export const EXAMPLES: Record<string, Profile> = {
  single: {
    label: 'Example: single renter, $150k',
    status: 'single', age: 29, kidsUnder17: 0, otherDependents: 0,
    you: person({ salary: 140000, bonus: 10000, pretaxRetirement: 9000 }),
    spouse: person(),
    otherIncome: 800, hsa: 0, healthPremiums: 1800,
    housing: 'rent', rent: 3300, mortgageInterest: 0, mortgageBalance: 0, propertyTax: 0, charity: 600,
    monthlyExpenses: 3200, cash: 25000, taxableInvestments: 30000, pretaxAccounts: 60000, rothAccounts: 15000,
  },
  family: {
    label: 'Example: Bay Area family (Morales case study)',
    status: 'mfj', age: 38, kidsUnder17: 2, otherDependents: 0,
    you: person({ salary: 210000, bonus: 21000, rsu: 60000, pretaxRetirement: 18480 }),
    spouse: person({ salary: 92000, pretaxRetirement: 11789, ssCovered: false, sdiCovered: false }),
    otherIncome: 3000, hsa: 4000, healthPremiums: 4800,
    housing: 'own', rent: 0, mortgageInterest: 23320, mortgageBalance: 751388, propertyTax: 15301, charity: 3000,
    monthlyExpenses: 8900, cash: 40000, taxableInvestments: 230000, pretaxAccounts: 307000, rothAccounts: 69000,
  },
}

export function toTaxInput(p: Profile): TaxInput {
  const earner = (x: Person) => ({
    wages: x.salary + x.bonus, rsu: x.rsu, pretaxRetirement: x.pretaxRetirement, ssCovered: x.ssCovered, sdiCovered: x.sdiCovered,
  })
  return {
    status: p.status,
    kidsUnder17: p.kidsUnder17,
    otherDependents: p.otherDependents,
    earners: p.status === 'mfj' ? [earner(p.you), earner(p.spouse)] : [earner(p.you)],
    otherIncome: p.otherIncome,
    hsa: p.hsa,
    sec125: p.healthPremiums,
    mortgageInterest: p.housing === 'own' ? p.mortgageInterest : 0,
    mortgageBalance: p.housing === 'own' ? p.mortgageBalance : 0,
    propertyTax: p.housing === 'own' ? p.propertyTax : 0,
    charity: p.charity,
  }
}

export const totalPay = (p: Profile) =>
  p.you.salary + p.you.bonus + p.you.rsu + (p.status === 'mfj' ? p.spouse.salary + p.spouse.bonus + p.spouse.rsu : 0)

// ------------------------------------------------------------------ storage
// The profile lives only in this browser (localStorage). Nothing is sent anywhere.
const KEY = 'finance-lab.profile.v1'

function load(): { profile: Profile; isExample: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      return { profile: { ...EXAMPLES.single, ...saved.profile, you: person(saved.profile?.you), spouse: person(saved.profile?.spouse) }, isExample: !!saved.isExample }
    }
  } catch {
    /* storage unavailable (private mode) - fall back to the example */
  }
  return { profile: EXAMPLES.single, isExample: true }
}

interface Ctx {
  profile: Profile
  isExample: boolean
  update: (patch: Partial<Profile>) => void
  updatePerson: (who: 'you' | 'spouse', patch: Partial<Person>) => void
  loadExample: (key: keyof typeof EXAMPLES) => void
  clear: () => void
}

const ProfileContext = createContext<Ctx | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  const value = useMemo<Ctx>(
    () => ({
      profile: state.profile,
      isExample: state.isExample,
      update: (patch) => setState((s) => ({ profile: { ...s.profile, ...patch, label: 'Your profile' }, isExample: false })),
      updatePerson: (who, patch) =>
        setState((s) => ({ profile: { ...s.profile, [who]: { ...s.profile[who], ...patch }, label: 'Your profile' }, isExample: false })),
      loadExample: (key) => setState({ profile: EXAMPLES[key], isExample: true }),
      clear: () =>
        setState({
          profile: { ...EXAMPLES.single, label: 'Your profile', you: person(), spouse: person(), otherIncome: 0, healthPremiums: 0, rent: 0, charity: 0, monthlyExpenses: 0, cash: 0, taxableInvestments: 0, pretaxAccounts: 0, rothAccounts: 0 },
          isExample: false,
        }),
    }),
    [state],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile outside ProfileProvider')
  return ctx
}
