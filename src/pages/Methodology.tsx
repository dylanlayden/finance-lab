export default function Methodology() {
  return (
    <article className="module narrow prose">
      <header className="module-head">
        <p className="eyebrow">Methodology</p>
        <h1>How the numbers are built</h1>
      </header>
      <h2>Principles</h2>
      <ul>
        <li><b>Your inputs never leave your browser.</b> There is no server and no account. The profile is saved in your browser's local storage, and you can clear it anytime.</li>
        <li><b>Every assumption is visible and editable.</b> Look for the ⓘ next to a number to see its source.</li>
        <li><b>Real rules, stated simplifications.</b> Each question lists what it does not model.</li>
      </ul>
      <h2>Tax engine (2026, federal + California)</h2>
      <p>One shared engine computes:</p>
      <ul>
        <li>AGI, federal itemized vs. standard deductions (with the 2026 SALT cap and its phase-down, the $750k mortgage-debt limit, the 0.5%-of-AGI charitable floor and the 37%-bracket limit), the brackets, child and dependent credits, and the net investment income tax;</li>
        <li>Social Security up to the wage base for each earner, Medicare, Additional Medicare and California SDI;</li>
        <li>California taxable income (adding back HSA contributions, which California does not recognize), Schedule X or Y, the Mental Health Services Tax and exemption credits.</li>
      </ul>
      <p>The engine is unit-tested against an independently built Excel household plan, line by line.</p>
      <h2>Sources</h2>
      <ul>
        <li>IRS Rev. Proc. 2025-32: 2026 brackets and standard deductions, including One Big Beautiful Bill Act (P.L. 119-21) amendments.</li>
        <li>IRS Notice 2025-67: 2026 retirement plan and IRA limits. IRS Rev. Proc. 2025-19: HSA limits.</li>
        <li>FTB Tax News, October 2026, "2026 Indexing": California 2026 tax rate schedules, standard deductions and exemption credits.</li>
        <li>SSA: 2026 Social Security wage base of $184,500. CA EDD: 2026 SDI rate of 1.3% with no wage ceiling.</li>
      </ul>
      <h2>Disclaimer</h2>
      <p>These are educational calculators, not investment, tax or legal advice. Results are estimates based on the stated assumptions.</p>
    </article>
  )
}
