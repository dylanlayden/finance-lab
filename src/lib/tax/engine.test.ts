import { describe, expect, it } from 'vitest'
import { computeTax, marginalSplit, type TaxInput } from './engine'

// Morales household (fictional), current elections, from Morales_Household_Plan_Model.xlsx
// with charity and childcare set to 0 (the workbook predates the 2026 charity floor
// and the engine does not model the dependent-care credit).
const morales: TaxInput = {
  status: 'mfj',
  kidsUnder17: 2,
  otherDependents: 0,
  earners: [
    { wages: 231000, rsu: 60000, pretaxRetirement: 18480, ssCovered: true, sdiCovered: true },
    { wages: 92000, rsu: 0, pretaxRetirement: 9388.6 + 2400, ssCovered: false, sdiCovered: false },
  ],
  otherIncome: 3000,
  hsa: 4000,
  sec125: 4800,
  mortgageInterest: 23320.0754,
  mortgageBalance: 751388.1676,
  propertyTax: 15301.01,
  charity: 0,
}

describe('2026 tax engine vs. the Morales workbook (LibreOffice-recalculated)', () => {
  const r = computeTax(morales)
  it('AGI', () => expect(r.agi).toBeCloseTo(346931.4, 1))
  it('federal taxable income', () => expect(r.fedTaxable).toBeCloseTo(284302.82, 0))
  it('federal regular tax', () => expect(r.fedRegular).toBeCloseTo(53428.68, 0))
  it('federal income tax after CTC + NIIT', () => expect(r.fedIncomeTax).toBeCloseTo(49142.68, 0))
  it('CA taxable income', () => expect(r.caTaxable).toBeCloseTo(312310.31, 0))
  it('CA income tax', () => expect(r.caIncomeTax).toBeCloseTo(20381.98, 0))
  it('Social Security', () => expect(r.ss).toBeCloseTo(11439, 2))
  it('Medicare', () => expect(r.medicare).toBeCloseTo(5425.9, 2))
  it('Additional Medicare', () => expect(r.addMedicare).toBeCloseTo(1117.8, 2))
  it('CA SDI', () => expect(r.sdi).toBeCloseTo(3668.6, 2))
  it('total tax', () => expect(r.total).toBeCloseTo(91175.95, 0))
})

describe('single filer sanity checks (hand-computed)', () => {
  const single: TaxInput = {
    status: 'single', kidsUnder17: 0, otherDependents: 0,
    earners: [{ wages: 100000, rsu: 0, pretaxRetirement: 0, ssCovered: true, sdiCovered: true }],
    otherIncome: 0, hsa: 0, sec125: 0, mortgageInterest: 0, mortgageBalance: 0, propertyTax: 0, charity: 0,
  }
  const r = computeTax(single)
  // Federal: TI = 100,000 - 16,100 = 83,900 -> 1,240 + 4,560 + 0.22*(83,900-50,400) = 13,170
  it('federal tax on $100k single', () => expect(r.fedIncomeTax).toBeCloseTo(13170, 2))
  // CA: TI = 94,100 -> 3,310.88 + 0.093*(94,100-75,197) = 5,068.86 - 158 credit = 4,910.86
  it('CA tax on $100k single', () => expect(r.caIncomeTax).toBeCloseTo(4910.86, 1))
  it('payroll on $100k single', () => expect(r.payroll).toBeCloseTo(6200 + 1450 + 1300, 2))
  it('next $1,000 split adds up', () => {
    const m = marginalSplit(single)
    expect(m.federal + m.california + m.payroll + m.keep).toBeCloseTo(1000, 6)
    expect(m.federal).toBeCloseTo(220, 6)
    expect(m.california).toBeCloseTo(93, 6)
  })
})
