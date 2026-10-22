// "What does $1 really cost you?" - the after-tax price of a dollar through each tax channel,
// measured with the shared 2026 engine by adding $1,000 to the channel and diffing the taxes.

import { computeTax, type TaxInput } from './tax/engine'
import { P, type Status } from './tax/params2026'

export interface Saved {
  fed: number
  ca: number
  payroll: number
}

export interface Channel {
  key: string
  label: string
  what: string
  apply: (t: TaxInput, amt: number) => TaxInput
  note: (s: Status) => string
}

const you = (t: TaxInput, f: (e: TaxInput['earners'][0]) => Partial<TaxInput['earners'][0]>) => ({
  ...t,
  earners: t.earners.map((e, i) => (i === 0 ? { ...e, ...f(e) } : e)),
})

export const CHANNELS: Channel[] = [
  {
    key: 'k401',
    label: 'Traditional 401(k) / 403(b)',
    what: 'a dollar saved pre-tax for retirement',
    apply: (t, a) => you(t, (e) => ({ pretaxRetirement: e.pretaxRetirement + a })),
    note: () => `Skips federal and CA income tax now; taxed when withdrawn. Social Security and Medicare still apply. 2026 limit ${'$'}${P.lim401k.value.toLocaleString()}.`,
  },
  {
    key: 'hsa',
    label: 'HSA (through payroll)',
    what: 'a dollar of health spending or saving',
    apply: (t, a) => ({ ...t, hsa: t.hsa + a }),
    note: (s) => `Skips federal income tax and payroll taxes, but California taxes HSA contributions. Requires HDHP coverage. 2026 limit ${'$'}${(s === 'mfj' ? P.limHsaFamily : P.limHsaSelf).value.toLocaleString()}.`,
  },
  {
    key: 'premium',
    label: 'Health premiums (pre-tax payroll)',
    what: 'a dollar of insurance premium',
    apply: (t, a) => ({ ...t, sec125: t.sec125 + a }),
    note: () => 'Section 125 premiums skip every tax: federal, California, Social Security, Medicare and SDI.',
  },
  {
    key: 'commuter',
    label: 'Commuter benefit (transit / parking)',
    what: 'a dollar of transit or parking',
    apply: (t, a) => ({ ...t, sec125: t.sec125 + a }),
    note: () => `Same tax treatment as pre-tax premiums. ${P.limCommuter.source}.`,
  },
  {
    key: 'dcfsa',
    label: 'Dependent Care FSA',
    what: 'a dollar of childcare',
    apply: (t, a) => ({ ...t, dcfsa: (t.dcfsa ?? 0) + a }),
    note: () => `Skips federal, payroll and (up to $5,000) California tax. 2026 limit $7,500 per household. Using it reduces the child and dependent care credit you could otherwise claim (not modeled here).`,
  },
  {
    key: 'mortgage',
    label: 'Mortgage interest',
    what: 'a dollar of mortgage interest',
    apply: (t, a) => ({ ...t, mortgageInterest: t.mortgageInterest + a }),
    note: () => 'Only helps if your itemized deductions beat the standard deduction. Federal deduction limited to interest on $750k of debt; California allows $1M.',
  },
  {
    key: 'proptax',
    label: 'Property tax',
    what: 'a dollar of property tax',
    apply: (t, a) => ({ ...t, propertyTax: t.propertyTax + a }),
    note: () => 'Federally it shares the $40,400 SALT cap with your state income tax. California lets you deduct it if you itemize.',
  },
  {
    key: 'charity',
    label: 'Charitable gift (cash)',
    what: 'a dollar given to charity',
    apply: (t, a) => ({ ...t, charity: t.charity + a }),
    note: (s) => `From 2026, itemizers deduct only gifts above 0.5% of AGI. Non-itemizers can deduct up to ${'$'}${P.nonItemizerCharity[s].value.toLocaleString()} of cash gifts federally.`,
  },
  {
    key: 'ira',
    label: 'Traditional IRA (if deductible)',
    what: 'a dollar into a deductible IRA',
    apply: (t, a) => you(t, (e) => ({ pretaxRetirement: e.pretaxRetirement + a })),
    note: () => 'Same income-tax savings as a 401(k) when fully deductible. With a workplace plan, the deduction phases out at higher incomes (see Roth vs. traditional).',
  },
  {
    key: '529',
    label: '529 college savings',
    what: 'a dollar into a 529',
    apply: (t) => t,
    note: () => "No deduction federally or in California, so the dollar costs a full dollar. The benefit comes later: growth is tax-free for qualified education costs.",
  },
]

export function savedPerDollar(base: TaxInput, ch: Channel, amt = 1000): Saved {
  const a = computeTax(base)
  const b = computeTax(ch.apply(base, amt))
  return {
    fed: Math.max(0, (a.fedIncomeTax - b.fedIncomeTax) / amt),
    ca: Math.max(0, (a.caIncomeTax - b.caIncomeTax) / amt),
    payroll: Math.max(0, (a.payroll - b.payroll) / amt),
  }
}

// ------------------------------------------------------------ HDHP + HSA vs PPO

export interface Plan {
  premium: number // employee share per year
  deductible: number
  coinsurance: number // share you pay after the deductible
  oopMax: number
  employerHsa: number
}

export function outOfPocket(p: Plan, spend: number): number {
  return Math.min(p.oopMax, Math.min(spend, p.deductible) + p.coinsurance * Math.max(0, spend - p.deductible))
}

/** Net annual cost: after-tax premiums + out-of-pocket - employer HSA money - tax saved on your own HSA contribution. */
export function planCost(p: Plan, spend: number, premiumTaxRate: number, hsaContribution: number, hsaTaxRate: number) {
  const prem = p.premium * (1 - premiumTaxRate)
  const oop = outOfPocket(p, spend)
  const hsaBenefit = p.employerHsa + hsaContribution * hsaTaxRate
  return { prem, oop, hsaBenefit, total: prem + oop - hsaBenefit }
}

export const PLAN_DEFAULTS: Record<'self' | 'family', { hdhp: Plan; ppo: Plan }> = {
  self: {
    hdhp: { premium: 600, deductible: 1700, coinsurance: 0.2, oopMax: 4000, employerHsa: 500 },
    ppo: { premium: 1800, deductible: 500, coinsurance: 0.2, oopMax: 3500, employerHsa: 0 },
  },
  family: {
    hdhp: { premium: 2400, deductible: 3400, coinsurance: 0.2, oopMax: 8000, employerHsa: 1000 },
    ppo: { premium: 6000, deductible: 1000, coinsurance: 0.2, oopMax: 6000, employerHsa: 0 },
  },
}
