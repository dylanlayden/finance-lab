// Tax on retirement income (today's dollars, 2026 rules assumed to stay inflation-indexed).
// Covers traditional withdrawals/pensions as ordinary income, taxation of Social Security
// benefits (IRC 86 - including the "tax torpedo" zone), age-65 standard deduction, and CA.

import { bracketTax } from './tax/engine'
import { CA_BRACKETS, FED_BRACKETS, P, type Status } from './tax/params2026'

export interface RetireTaxInput {
  status: Status
  over65: number // filers age 65+ (0-2)
  ordinary: number // traditional withdrawals + pensions + other ordinary income
  socialSecurity: number // annual benefits
  inCA: boolean
}

export function taxableSocialSecurity(status: Status, other: number, ss: number): number {
  const b1 = P.ssTaxBase[status].value
  const b2 = P.ssTaxBase2[status].value
  const prov = other + 0.5 * ss
  if (prov <= b1) return 0
  if (prov <= b2) return Math.min(0.5 * ss, 0.5 * (prov - b1))
  return Math.min(0.85 * ss, 0.85 * (prov - b2) + Math.min(0.5 * ss, 0.5 * (b2 - b1)))
}

export function retirementTax(x: RetireTaxInput) {
  const s = x.status
  const taxableSS = taxableSocialSecurity(s, x.ordinary, x.socialSecurity)
  const fedDeduction = P.fedStd[s].value + x.over65 * P.addStd65[s].value
  const fedTaxable = Math.max(0, x.ordinary + taxableSS - fedDeduction)
  const fed = bracketTax(fedTaxable, FED_BRACKETS[s].value)
  let ca = 0
  if (x.inCA) {
    // CA does not tax Social Security; seniors get an extra personal exemption credit each
    const caTaxable = Math.max(0, x.ordinary - P.caStd[s].value)
    const credits = (P.caPersonalCredits[s].value + x.over65) * P.caPersonalCredit.value
    ca = Math.max(0, bracketTax(caTaxable, CA_BRACKETS[s].value) - credits)
  }
  return { taxableSS, fedTaxable, fed, ca, total: fed + ca }
}

/** Tax on the next $1,000 of traditional withdrawals, as a rate. */
export function retirementMarginal(x: RetireTaxInput, delta = 1000) {
  const a = retirementTax(x)
  const b = retirementTax({ ...x, ordinary: x.ordinary + delta })
  return { total: (b.total - a.total) / delta, fed: (b.fed - a.fed) / delta, ca: (b.ca - a.ca) / delta }
}

export const fva = (annual: number, r: number, n: number) => (n <= 0 ? 0 : r === 0 ? annual * n : annual * ((Math.pow(1 + r, n) - 1) / r))

/** Phase-out fraction allowed (1 = full, 0 = none) for MAGI within [lo, hi]. */
export function phaseAllowed(magi: number, [lo, hi]: [number, number]) {
  if (magi <= lo) return 1
  if (magi >= hi) return 0
  return (hi - magi) / (hi - lo)
}
