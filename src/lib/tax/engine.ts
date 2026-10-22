// 2026 federal + California household tax engine.
// Ported from the Morales household workbook (Tax_Analysis sheet) and extended
// for single filers and the 2026 OBBBA itemizing rules.

import { CA_BRACKETS, FED_BRACKETS, P, type Bracket, type Status } from './params2026'

export interface Earner {
  wages: number // salary + cash bonus (gross, before any deductions)
  rsu: number // RSU / stock income vesting this year (W-2 wages)
  pretaxRetirement: number // 401(k)/403(b)/457(b)/pension pick-up deferrals
  ssCovered: boolean // false for e.g. many CA public-school teachers (CalSTRS)
  sdiCovered: boolean
}

export interface TaxInput {
  status: Status
  kidsUnder17: number
  otherDependents: number
  earners: Earner[] // 1 for single, 1-2 for MFJ
  otherIncome: number // interest + ordinary dividends (treated as net investment income)
  hsa: number // HSA via payroll (attributed to earner 1)
  sec125: number // health premiums via payroll (attributed to earner 1)
  mortgageInterest: number
  mortgageBalance: number
  propertyTax: number
  charity: number
}

export interface Line {
  section: string
  label: string
  value: number
  note?: string
  bold?: boolean
}

export interface TaxResult {
  gross: number
  pretaxSavings: number
  agi: number
  fedTaxable: number
  fedRegular: number
  fedCredits: number
  fedIncomeTax: number
  ss: number
  medicare: number
  addMedicare: number
  sdi: number
  payroll: number
  caTaxable: number
  caIncomeTax: number
  total: number
  takeHome: number
  effectiveRate: number
  itemizedFed: boolean
  itemizedCA: boolean
  fedBracketRate: number
  caBracketRate: number
  lines: Line[]
}

export function bracketTax(income: number, brackets: Bracket[]): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i].over
    const hi = i + 1 < brackets.length ? brackets[i + 1].over : Infinity
    if (income > lo) tax += (Math.min(income, hi) - lo) * brackets[i].rate
  }
  return tax
}

export function bracketRate(income: number, brackets: Bracket[]): number {
  let rate = brackets[0].rate
  for (const b of brackets) if (income > b.over) rate = b.rate
  return rate
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** `continuous` replaces the step-wise phase-outs ($50 per $1,000, $6 per $2,500) with
 *  their smooth equivalents. Used only for drawing curves, never for the answer itself. */
export function computeTax(input: TaxInput, opts: { continuous?: boolean } = {}): TaxResult {
  const steps = (x: number) => (opts.continuous ? x : Math.ceil(x))
  const s = input.status
  const earners = s === 'single' ? input.earners.slice(0, 1) : input.earners
  const lines: Line[] = []
  const add = (section: string, label: string, value: number, note?: string, bold?: boolean) =>
    lines.push({ section, label, value, note, bold })

  // ---------------- income
  const comp = earners.map((e) => e.wages + e.rsu)
  const gross = sum(comp) + input.otherIncome
  const pretaxRet = sum(earners.map((e) => Math.min(e.pretaxRetirement, e.wages + e.rsu)))
  const pretaxSavings = pretaxRet + input.hsa
  const agi = Math.max(0, gross - pretaxRet - input.hsa - input.sec125)
  add('Income', 'W-2 pay (salary, bonus, RSUs)', sum(comp))
  add('Income', 'Interest & dividends', input.otherIncome)
  add('Income', 'Less: pre-tax retirement deferrals', -pretaxRet)
  add('Income', 'Less: HSA + health premiums through payroll', -(input.hsa + input.sec125))
  add('Income', 'Adjusted gross income (AGI)', agi, undefined, true)

  // ---------------- payroll (needed for SDI -> SALT)
  const ficaWages = comp.map((c, i) => Math.max(0, c - (i === 0 ? input.hsa + input.sec125 : 0)))
  const ss = sum(earners.map((e, i) => (e.ssCovered ? P.ssRate.value * Math.min(P.ssWageBase.value, ficaWages[i]) : 0)))
  const medicare = P.medicareRate.value * sum(ficaWages)
  const addMedicare = P.addMedRate.value * Math.max(0, sum(ficaWages) - P.addMedThreshold[s].value)
  const sdi = sum(earners.map((e, i) => (e.sdiCovered ? P.caSdiRate.value * ficaWages[i] : 0)))

  // ---------------- California (computed first: federal SALT needs it)
  const nDeps = input.kidsUnder17 + input.otherDependents
  const caAgi = agi + input.hsa // CA does not recognize HSAs
  const caMortgage =
    input.mortgageInterest * (input.mortgageBalance > P.mortgageLimitCA.value ? P.mortgageLimitCA.value / input.mortgageBalance : 1)
  const caItemized = input.propertyTax + caMortgage + input.charity
  const caDed = Math.max(caItemized, P.caStd[s].value)
  const caTaxable = Math.max(0, caAgi - caDed)
  const caBrackets = CA_BRACKETS[s].value
  const caBase = bracketTax(caTaxable, caBrackets)
  const mhst = 0.01 * Math.max(0, caTaxable - P.caMhstThreshold.value)
  const caExcess = Math.max(0, agi - P.caCreditPhase[s].value)
  const caReduction = 6 * steps(caExcess / 2500)
  const caCredits =
    P.caPersonalCredits[s].value * Math.max(0, P.caPersonalCredit.value - caReduction) +
    nDeps * Math.max(0, P.caDependentCredit.value - caReduction)
  const caIncomeTax = Math.max(0, caBase + mhst - caCredits)

  // ---------------- federal
  const salt = Math.min(
    caIncomeTax + sdi + input.propertyTax,
    Math.max(P.saltFloor[s].value, P.saltCap[s].value - 0.3 * Math.max(0, agi - P.saltPhaseStart[s].value)),
  )
  const fedMortgage =
    input.mortgageInterest * (input.mortgageBalance > P.mortgageLimitFed.value ? P.mortgageLimitFed.value / input.mortgageBalance : 1)
  const charityItem = Math.max(0, input.charity - P.charityFloorPct.value * agi)
  let itemized = salt + fedMortgage + charityItem
  const fedBrackets = FED_BRACKETS[s].value
  const top = fedBrackets[fedBrackets.length - 1]
  // OBBBA 2/37 limitation on itemized deductions for the 37% bracket
  const tiBeforeLimit = Math.max(0, agi - itemized)
  const limit = (2 / 37) * Math.min(itemized, Math.max(0, tiBeforeLimit - top.over))
  itemized -= limit
  const std = P.fedStd[s].value
  const itemizedFed = itemized > std
  const nonItemizerCharity = itemizedFed ? 0 : Math.min(input.charity, P.nonItemizerCharity[s].value)
  const fedTaxable = Math.max(0, agi - Math.max(itemized, std) - nonItemizerCharity)
  const fedRegular = bracketTax(fedTaxable, fedBrackets)

  const reduction = 50 * steps(Math.max(0, agi - P.ctcPhase[s].value) / 1000)
  const ctcRaw = input.kidsUnder17 * P.ctcPerChild.value
  const odcRaw = input.otherDependents * P.odcPerDependent.value
  const childCredits = Math.max(0, ctcRaw + odcRaw - reduction)
  const nonRefundable = Math.min(childCredits, fedRegular)
  const ctcAfterPhase = Math.max(0, ctcRaw - Math.max(0, reduction - odcRaw))
  const refundable = Math.min(
    Math.max(0, Math.min(ctcAfterPhase, childCredits) - nonRefundable),
    input.kidsUnder17 * P.ctcRefundablePerChild.value,
    0.15 * Math.max(0, sum(comp) - 2500),
  )
  const niit = P.niitRate.value * Math.min(input.otherIncome, Math.max(0, agi - P.niitThreshold[s].value))
  const fedCredits = nonRefundable + refundable
  const fedIncomeTax = fedRegular - fedCredits + niit

  add('Federal', 'SALT deduction (state tax + SDI + property tax, capped)', salt, '$40,400 cap, phased down above $505k')
  add('Federal', 'Mortgage interest (on up to $750k of debt)', fedMortgage)
  add('Federal', 'Charity above 0.5% of AGI', charityItem)
  if (limit > 0) add('Federal', 'Less: 37%-bracket limit on itemized deductions', -limit)
  add('Federal', itemizedFed ? 'Deduction used: itemized' : 'Deduction used: standard', Math.max(itemized, std))
  if (nonItemizerCharity > 0) add('Federal', 'Charity deduction for non-itemizers', nonItemizerCharity)
  add('Federal', 'Federal taxable income', fedTaxable, undefined, true)
  add('Federal', 'Tax from 2026 brackets', fedRegular)
  if (childCredits > 0) add('Federal', 'Child & dependent tax credits', -fedCredits)
  if (niit > 0) add('Federal', 'Net investment income tax (3.8%)', niit)
  add('Federal', 'Federal income tax', fedIncomeTax, undefined, true)

  add('California', 'California AGI (adds back HSA)', caAgi, 'CA does not recognize HSAs')
  add('California', caItemized > P.caStd[s].value ? 'Deduction used: itemized (property tax, mortgage, charity)' : 'Deduction used: standard', caDed)
  add('California', 'California taxable income', caTaxable, undefined, true)
  add('California', 'Tax from 2026 Schedule ' + (s === 'single' ? 'X' : 'Y'), caBase)
  if (mhst > 0) add('California', 'Mental Health Services Tax (1% over $1M)', mhst)
  add('California', 'Less: exemption credits', -Math.min(caCredits, caBase + mhst))
  add('California', 'California income tax', caIncomeTax, undefined, true)

  const payroll = ss + medicare + addMedicare + sdi
  add('Payroll', 'Social Security (6.2% up to $184,500 per earner)', ss)
  add('Payroll', 'Medicare (1.45%)', medicare)
  if (addMedicare > 0) add('Payroll', 'Additional Medicare (0.9%)', addMedicare)
  add('Payroll', 'California SDI (1.3%)', sdi)
  add('Payroll', 'Payroll taxes', payroll, undefined, true)

  const total = fedIncomeTax + caIncomeTax + payroll
  const takeHome = gross - total - pretaxSavings - input.sec125
  add('Summary', 'Total tax', total, undefined, true)
  add('Summary', 'Take-home pay (after tax, pre-tax savings and premiums)', takeHome, undefined, true)

  return {
    gross,
    pretaxSavings,
    agi,
    fedTaxable,
    fedRegular,
    fedCredits,
    fedIncomeTax,
    ss,
    medicare,
    addMedicare,
    sdi,
    payroll,
    caTaxable,
    caIncomeTax,
    total,
    takeHome,
    effectiveRate: gross > 0 ? total / gross : 0,
    itemizedFed,
    itemizedCA: caItemized > P.caStd[s].value,
    fedBracketRate: bracketRate(fedTaxable, fedBrackets),
    caBracketRate: bracketRate(caTaxable, caBrackets),
    lines,
  }
}

export interface MarginalSplit {
  federal: number
  california: number
  payroll: number
  keep: number
}

/** Where the next `delta` dollars of salary for earner 1 go. */
export function marginalSplit(input: TaxInput, delta = 1000, continuous = false): MarginalSplit {
  const a = computeTax(input, { continuous })
  const bumped = { ...input, earners: input.earners.map((e, i) => (i === 0 ? { ...e, wages: e.wages + delta } : e)) }
  const b = computeTax(bumped, { continuous })
  const federal = b.fedIncomeTax - a.fedIncomeTax
  const california = b.caIncomeTax - a.caIncomeTax
  const payroll = b.payroll - a.payroll
  return { federal, california, payroll, keep: delta - federal - california - payroll }
}

/** Same household with total W-2 pay rescaled to `total` (split kept proportional). */
export function withTotalPay(input: TaxInput, total: number): TaxInput {
  const s = input.status
  const earners = s === 'single' ? input.earners.slice(0, 1) : input.earners
  const current = sum(earners.map((e) => e.wages + e.rsu))
  const scaled = earners.map((e, i) => {
    if (current <= 0) return { ...e, wages: i === 0 ? total : 0, rsu: 0 }
    const f = total / current
    return { ...e, wages: e.wages * f, rsu: e.rsu * f }
  })
  return { ...input, earners: scaled }
}
