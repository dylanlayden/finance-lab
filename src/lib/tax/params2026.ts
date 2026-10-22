// Tax year 2026 parameters - federal + California.
// Every figure carries its source so the UI can show it next to the number.

export type Status = 'single' | 'mfj'

export interface Bracket {
  over: number
  rate: number
}

export interface Param<T = number> {
  value: T
  source: string
}

const IRS_REVPROC = 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments, incl. OBBBA amendments)'
const FTB_2026 = 'FTB Tax News, Oct-2026, "2026 Indexing" (2026 California tax rate schedules)'

export const FED_BRACKETS: Record<Status, Param<Bracket[]>> = {
  single: {
    value: [
      { over: 0, rate: 0.1 },
      { over: 12400, rate: 0.12 },
      { over: 50400, rate: 0.22 },
      { over: 105700, rate: 0.24 },
      { over: 201775, rate: 0.32 },
      { over: 256225, rate: 0.35 },
      { over: 640600, rate: 0.37 },
    ],
    source: IRS_REVPROC,
  },
  mfj: {
    value: [
      { over: 0, rate: 0.1 },
      { over: 24800, rate: 0.12 },
      { over: 100800, rate: 0.22 },
      { over: 211400, rate: 0.24 },
      { over: 403550, rate: 0.32 },
      { over: 512450, rate: 0.35 },
      { over: 768700, rate: 0.37 },
    ],
    source: IRS_REVPROC,
  },
}

export const CA_BRACKETS: Record<Status, Param<Bracket[]>> = {
  single: {
    value: [
      { over: 0, rate: 0.01 },
      { over: 11456, rate: 0.02 },
      { over: 27157, rate: 0.04 },
      { over: 42861, rate: 0.06 },
      { over: 59498, rate: 0.08 },
      { over: 75197, rate: 0.093 },
      { over: 384109, rate: 0.103 },
      { over: 460927, rate: 0.113 },
      { over: 768213, rate: 0.123 },
    ],
    source: FTB_2026 + ' - Schedule X',
  },
  mfj: {
    value: [
      { over: 0, rate: 0.01 },
      { over: 22912, rate: 0.02 },
      { over: 54314, rate: 0.04 },
      { over: 85722, rate: 0.06 },
      { over: 118996, rate: 0.08 },
      { over: 150394, rate: 0.093 },
      { over: 768218, rate: 0.103 },
      { over: 921854, rate: 0.113 },
      { over: 1536426, rate: 0.123 },
    ],
    source: FTB_2026 + ' - Schedule Y',
  },
}

const byStatus = (single: number, mfj: number, source: string): Record<Status, Param> => ({
  single: { value: single, source },
  mfj: { value: mfj, source },
})

export const P = {
  fedStd: byStatus(16100, 32200, IRS_REVPROC),
  saltCap: byStatus(40400, 40400, 'IRC 164(b)(7) as amended by OBBBA (P.L. 119-21): $40,000 for 2025, +1%/yr'),
  saltPhaseStart: byStatus(505000, 505000, 'OBBBA: cap reduced by 30% of MAGI above threshold'),
  saltFloor: byStatus(10000, 10000, 'OBBBA: reduced cap never below $10,000'),
  ctcPhase: byStatus(200000, 400000, 'IRC 24(b): credit reduced $50 per $1,000 of MAGI over threshold'),
  niitThreshold: byStatus(200000, 250000, 'IRC 1411 (not indexed)'),
  addMedThreshold: byStatus(200000, 250000, 'IRC 3101(b)(2) (not indexed)'),
  nonItemizerCharity: byStatus(1000, 2000, 'OBBBA: cash gifts deductible by non-itemizers from 2026'),
  caStd: byStatus(5900, 11800, FTB_2026),
  caPersonalCredits: byStatus(1, 2, 'FTB: $158 personal exemption credit per filer ($316 joint)'),
  // CA exemption-credit phase-out. FTB publishes 2026 thresholds in late December;
  // these are the 2025 thresholds ($252,203 / $504,411) indexed by the 3.4% CCPI FTB announced.
  caCreditPhase: byStatus(260778, 521561, 'FTB 2025 Form 540 booklet thresholds x 1.034 (2026 CCPI) - estimate until FTB publishes'),
  ctcPerChild: { value: 2200, source: 'IRC 24 as amended by OBBBA; $2,200 per qualifying child for 2026' },
  ctcRefundablePerChild: { value: 1700, source: 'IRS 2026: refundable ACTC up to $1,700 per child' },
  odcPerDependent: { value: 500, source: 'IRC 24(h)(4): $500 credit for other dependents' },
  charityFloorPct: { value: 0.005, source: 'OBBBA: itemized charitable gifts deductible only above 0.5% of AGI from 2026' },
  mortgageLimitFed: { value: 750000, source: 'IRC 163(h)(3)(F): $750k acquisition-debt limit, made permanent by OBBBA' },
  mortgageLimitCA: { value: 1000000, source: 'CA did not conform to the TCJA limit; $1M acquisition debt (R&TC 17220)' },
  niitRate: { value: 0.038, source: 'IRC 1411' },
  ssRate: { value: 0.062, source: 'IRC 3101(a)' },
  ssWageBase: { value: 184500, source: 'SSA: 2026 taxable maximum $184,500' },
  medicareRate: { value: 0.0145, source: 'IRC 3101(b)(1)' },
  addMedRate: { value: 0.009, source: 'IRC 3101(b)(2)' },
  caSdiRate: { value: 0.013, source: 'CA EDD: 2026 SDI withholding rate 1.3%, no wage ceiling' },
  caPersonalCredit: { value: 158, source: FTB_2026 },
  caDependentCredit: { value: 491, source: FTB_2026 },
  caMhstThreshold: { value: 1000000, source: 'R&TC 17043: 1% Mental Health Services Tax over $1M' },
  lim401k: { value: 24500, source: 'IRS Notice 2025-67: 2026 elective deferral limit' },
  limIRA: { value: 7500, source: 'IRS Notice 2025-67: 2026 IRA limit' },
  limHsaSelf: { value: 4400, source: 'IRS Rev. Proc. 2025-19' },
  limHsaFamily: { value: 8750, source: 'IRS Rev. Proc. 2025-19' },
  limDcfsa: { value: 7500, source: 'IRC 129 as amended by OBBBA: $7,500 per household from 2026 (was $5,000)' },
  dcfsaCA: { value: 5000, source: 'Conservative assumption: California excludes only $5,000 (conformity to the $7,500 limit not assumed)' },
  limCommuter: { value: 340, source: 'Rev. Proc. 2025-32: $340/month each for transit and qualified parking (2026)' },
  hdhpMinDed: byStatus(1700, 3400, 'IRS Rev. Proc. 2025-19: 2026 HDHP minimum deductible (self / family)'),
  hdhpMaxOop: byStatus(8500, 17000, 'IRS Rev. Proc. 2025-19: 2026 HDHP out-of-pocket maximum (self / family)'),
  rothPhase: { value: { single: [153000, 168000], mfj: [242000, 252000] } as Record<Status, [number, number]>, source: 'IRS Notice 2025-67: 2026 Roth IRA contribution phase-out (MAGI)' },
  iraDeductCovered: { value: { single: [81000, 91000], mfj: [129000, 149000] } as Record<Status, [number, number]>, source: 'IRS Notice 2025-67: traditional IRA deduction phase-out when covered by a workplace plan' },
  iraDeductSpouseCovered: { value: [242000, 252000] as [number, number], source: 'IRS Notice 2025-67: phase-out for a non-covered spouse of a covered worker' },
  addStd65: byStatus(2050, 1650, 'Rev. Proc. 2025-32 sec. 4.14(3): additional standard deduction per person age 65+'),
  ssTaxBase: byStatus(25000, 32000, 'IRC 86: Social Security taxation first threshold (provisional income, not indexed)'),
  ssTaxBase2: byStatus(34000, 44000, 'IRC 86: Social Security taxation second threshold (not indexed)'),
} as const
