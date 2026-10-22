# Personal Finance Lab

Interactive personal-finance calculators that run on **your own numbers**, using 2026 federal and California tax rules. Enter your profile once, then explore questions. Every assumption is editable and shows its source.

**Live site:** https://dylanlayden.github.io/finance-lab/

## Modules

| Question | Status |
|---|---|
| Where does your next dollar go? (tax bracket explorer) | Live |
| What does San Francisco cost you? (buy / rent / rent vs. buy) | Live |
| Mortgage Lab (amortization, extra payments, fixed vs. SOFR ARM, refinance) | Live |
| Roth or traditional? | Live |
| What does $1 really cost you? (tax-advantage map, HDHP + HSA vs. PPO) | Live |
| Swing early, then settle (early high risk vs. steady from day one) | Live |

## How it works

- **Static site, no server.** React + TypeScript + Vite, hosted on GitHub Pages. The profile is saved only in the visitor's browser (`localStorage`).
- **One shared tax engine** (`src/lib/tax/engine.ts`) covers:
  - federal: AGI, itemized vs. standard deduction (2026 SALT cap with its phase-down, $750k mortgage limit, 0.5% charitable floor, 37%-bracket limit), brackets, child credits, NIIT;
  - payroll: Social Security, Medicare, Additional Medicare, CA SDI;
  - California: HSA add-back, Schedule X/Y, Mental Health Services Tax, exemption credits.
- **Tested against an Excel model.** `engine.test.ts` checks the engine against an independently built Excel household financial plan, line by line.
- **Sources** for every parameter live next to the number in `src/lib/tax/params2026.ts`:
  - IRS Rev. Proc. 2025-32 (2026 brackets and deductions)
  - IRS Notice 2025-67 (2026 retirement and IRA limits)
  - FTB Tax News, Oct-2026 "2026 Indexing" (California brackets and credits)
  - SSA (Social Security wage base)
  - CA EDD (SDI rate)

## Develop

```bash
npm install
npm run dev      # local dev server
npx vitest run   # engine tests
npm run build    # production build -> dist/
```

Pushing to `main` deploys automatically through `.github/workflows/deploy.yml`.

*Educational calculators, not investment, tax, or legal advice.*
