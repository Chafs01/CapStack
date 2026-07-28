// ─── DEAL HEALTH CHECK ────────────────────────────────────────────────────
// Someone new to underwriting can read a 1.05x DSCR and not know it means the
// deal is unfinanceable. This turns the figures the model already produces
// into explicit findings: what a lender or partner would object to, and what
// to do about it.
//
// Deliberately not a score out of 100. A single number invites the user to
// optimise it rather than read the findings, and it would imply a precision
// this does not have. Each check stands on its own and says why.
//
// Pure — no React, no formatting — so the thresholds and branches are
// directly testable.

// Conventional underwriting thresholds. Exported so the narrative notes on the
// dashboard read from the same numbers as the panel and cannot drift.
const T = {
  // Coverage minimums are not universal. 1.20x–1.25x is the commercial and
  // 5+ unit multifamily bar. A 1–4 unit rental is financed as residential —
  // on the borrower's own income, or through a DSCR loan product whose floor
  // is nearer 1.00x — so holding a duplex to a commercial minimum would call
  // an ordinary, financeable deal unfinanceable.
  dscrFail: 1.20,      // below typical commercial lender minimums
  dscrThin: 1.35,      // clears minimums, little cushion
  dscrFailResi: 1.00,  // below this the property cannot cover its own debt
  dscrThinResi: 1.20,
  expenseHigh: 0.55,   // high for a stabilised residential profile
  expenseLow: 0.25,    // implausibly low — usually a forgotten line item
  exitDependence: 0.70,// share of total return coming from the sale
  occCushion: 0.05,    // gap between break-even and underwritten occupancy
  ltvHigh: 0.80,
  capLow: 0.03,
  capHigh: 0.12,
};

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// 1–4 unit residential is flagged by propClass, not assetType — it runs
// through the multifamily engine path deliberately.
const isResidential1to4 = (inp) => String(inp?.propClass || '') === 'residential';

// Development and LIHTC deals are costed, not purchased: their basis is total
// development cost and their debt is the sized permanent loan, so reading
// purchasePrice/loanAmount would find nothing.
function costBasis(res, inp) {
  const t = String(inp?.assetType || '').toLowerCase();
  if (t === 'development' || t === 'affordable') return num(res?.sum?.devCost) || num(res?.lihtc?.totalUses);
  return num(inp?.purchasePrice);
}
function permanentLoan(res, inp) {
  const t = String(inp?.assetType || '').toLowerCase();
  if (t === 'affordable') return num(res?.lihtc?.permLoan);
  return num(inp?.loanAmount);
}

// A deal can only be assessed once it has both a cost basis and some income.
// Before that the checks would all fire on zeros and read as a broken deal
// rather than an unfinished one.
function assessable(res, inp) {
  if (!res || !inp) return false;
  const basis = costBasis(res, inp);
  const egi = num(res.rows?.[0]?.egi);
  return (basis || 0) > 0 && (egi || 0) > 0;
}

function dealHealth(res, inp) {
  if (!assessable(res, inp)) {
    return { ready: false, checks: [], counts: { pass: 0, warn: 0, fail: 0, na: 0 }, verdict: 'incomplete' };
  }

  const { rows, ret, sum, exit, equity } = res;
  const t = String(inp.assetType || '').toLowerCase();
  const y1 = rows[0] || {};
  const checks = [];
  const add = (id, status, label, detail, fix) => checks.push({ id, status, label, detail, fix });

  // ── the exit is priced at all ───────────────────────────────────────────
  if (inp.exitMethod === 'ppu') {
    const ppu = num(inp.exitPPU) || 0;
    if (ppu <= 0) {
      add('exit-priced', 'fail', 'Exit is unpriced',
        'This deal is valued on sales comparables, but no price per unit has been entered — so the model sells it for nothing and every return below is understated.',
        'Set a comparable $/unit on the Financing step.');
    } else {
      add('exit-priced', 'pass', 'Exit is priced',
        `Exit valued at ${ppu.toLocaleString('en-US')} per unit on comparable sales.`);
    }
  }

  // ── debt service coverage ───────────────────────────────────────────────
  const dscr = num(sum.dscr);
  const resi = isResidential1to4(inp);
  const failAt = resi ? T.dscrFailResi : T.dscrFail;
  const thinAt = resi ? T.dscrThinResi : T.dscrThin;
  if (dscr === null) {
    add('dscr', 'na', 'No debt', 'Underwritten without permanent financing, so coverage does not apply.');
  } else if (dscr < failAt) {
    add('dscr', 'fail', `DSCR ${dscr.toFixed(2)}x is below lender minimums`,
      resi
        ? 'Below 1.00x the rent does not cover the mortgage, so the property runs at a loss before vacancy.'
        : `Most commercial lenders require ${T.dscrFail.toFixed(2)}x–1.25x. As structured this loan is unlikely to be financeable.`,
      'Reduce the loan amount, or raise NOI.');
  } else if (dscr < thinAt) {
    add('dscr', 'warn', `DSCR ${dscr.toFixed(2)}x clears minimums but is thin`,
      'A modest income shortfall or expense overrun would pressure coverage.',
      'Stress-test the downside scenario before committing.');
  } else {
    add('dscr', 'pass', `DSCR ${dscr.toFixed(2)}x is healthy`,
      'Debt service is well covered with room to absorb underperformance.');
  }

  // ── year 1 cash flow ────────────────────────────────────────────────────
  const cf = num(y1.cfbt);
  if (cf !== null) {
    if (cf < 0) {
      add('cash-flow', 'fail', 'Year 1 cash flow is negative',
        `The deal loses ${Math.round(Math.abs(cf)).toLocaleString('en-US')} in the first year after debt service, so it needs funding to carry.`,
        'Check the debt terms and the expense assumptions.');
    } else {
      add('cash-flow', 'pass', 'Year 1 cash flow is positive',
        `${Math.round(cf).toLocaleString('en-US')} after debt service.`);
    }
  }

  // ── break-even occupancy cushion ────────────────────────────────────────
  const beOcc = num(sum.beOcc);
  if (beOcc !== null && beOcc > 0) {
    const cushion = 1 - beOcc - (num(inp.vacancyRate) || 0) / 100;
    if (cushion < T.occCushion) {
      add('break-even', 'warn', `Break-even occupancy of ${(beOcc * 100).toFixed(1)}% leaves little margin`,
        'Small leasing setbacks would turn cash flow negative.',
        'Confirm the rent roll and vacancy assumption against the market.');
    } else {
      add('break-even', 'pass', `Break-even occupancy of ${(beOcc * 100).toFixed(1)}% leaves a cushion`,
        'There is room between break-even and the underwritten vacancy.');
    }
  }

  // ── expense ratio plausibility ──────────────────────────────────────────
  const expR = num(y1.expR);
  if (expR !== null && expR > 0) {
    if (expR > T.expenseHigh) {
      add('expense-ratio', 'warn', `Expense ratio of ${(expR * 100).toFixed(0)}% is high`,
        'Above the typical range for a stabilised residential profile.',
        'Verify taxes, insurance, and maintenance reflect actuals rather than placeholders.');
    } else if (expR < T.expenseLow) {
      add('expense-ratio', 'warn', `Expense ratio of ${(expR * 100).toFixed(0)}% is implausibly low`,
        'A ratio this low usually means an operating cost has been left out entirely.',
        'Check that taxes, insurance, management, and reserves are all entered.');
    } else {
      add('expense-ratio', 'pass', `Expense ratio of ${(expR * 100).toFixed(0)}% is in a normal range`,
        'Operating costs look plausible relative to income.');
    }
  }

  // ── leverage ────────────────────────────────────────────────────────────
  const basis = costBasis(res, inp);
  const loan = permanentLoan(res, inp);
  if (basis && loan !== null && basis > 0 && loan > 0) {
    const lev = loan / basis;
    const lbl = (t === 'development' || t === 'affordable') ? 'LTC' : 'LTV';
    if (lev > T.ltvHigh) {
      add('leverage', 'warn', `${lbl} of ${(lev * 100).toFixed(0)}% is aggressive`,
        'Leverage above 80% narrows the margin for error and limits lender appetite.',
        'Confirm a lender will actually fund at this level.');
    } else {
      add('leverage', 'pass', `${lbl} of ${(lev * 100).toFixed(0)}% is conventional`,
        'Leverage is within a range lenders commonly fund.');
    }
  }

  // ── going-in cap rate plausibility ──────────────────────────────────────
  const capR = num(sum.capR);
  if (t === 'affordable') {
    // Yield on cost is meaningfully low for LIHTC by construction: credit
    // equity and soft sources carry the stack, so NOI over total development
    // cost is not the number that decides the deal. Flagging it as an
    // out-of-range cap rate would be a false alarm on every tax-credit deal.
    add('cap-rate', 'na', 'Cap rate is not the measure here',
      'For a tax-credit deal the return comes from the credit allocation and the capital stack, not from yield on cost.');
  } else if (capR !== null && capR !== 0) {
    if (capR < T.capLow || capR > T.capHigh) {
      add('cap-rate', 'warn', `Going-in cap rate of ${(capR * 100).toFixed(2)}% is outside the usual range`,
        'Cap rates this far from the 3%–12% band usually indicate a mistyped price or income figure.',
        'Re-check the purchase price and Year 1 NOI.');
    } else {
      add('cap-rate', 'pass', `Going-in cap rate of ${(capR * 100).toFixed(2)}% is plausible`,
        'The relationship between price and Year 1 NOI looks reasonable.');
    }
  }

  // ── how much of the return depends on the sale ──────────────────────────
  const proceeds = num(exit?.proceeds) || 0;
  const totalRet = (num(ret.totalCF) || 0) + proceeds;
  if (totalRet > 0 && proceeds > 0) {
    const share = proceeds / totalRet;
    if (share > T.exitDependence) {
      add('exit-dependence', 'warn', `${(share * 100).toFixed(0)}% of the return comes from the sale`,
        'The headline IRR is highly sensitive to the exit assumption rather than to operations.',
        'Review the sensitivity grid before relying on the return.');
    } else {
      add('exit-dependence', 'pass', 'Return is balanced between operations and exit',
        `${((1 - share) * 100).toFixed(0)}% of capital returned comes from operating cash flow.`);
    }
  }

  const counts = { pass: 0, warn: 0, fail: 0, na: 0 };
  for (const c of checks) counts[c.status]++;
  const verdict = counts.fail > 0 ? 'needs-work' : counts.warn > 0 ? 'review' : 'clean';
  return { ready: true, checks, counts, verdict };
}

export { dealHealth, assessable, costBasis, permanentLoan, isResidential1to4, T as HEALTH_THRESHOLDS };
