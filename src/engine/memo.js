import{f}from'./format.js';
import{holdPeriod}from'./finance.js';
import{buildPF}from'./buildPF.js';
import{calcProjectTimeline}from'./timeline.js';
import{resolveLine,resolveCostLine,resolveCapex,lossRate,getHardCost,getSoftCost}from'./income.js';
// ─── DEAL MEMO GENERATOR ──────────────────────────────────────────────────
// The memo is assembled as an HTML string and handed to document.write, so
// every value that originated with a user has to be escaped. This matters
// because a deal can now arrive from a shared link: without escaping, a
// crafted property name would run script on our own origin in the reader's
// browser, with access to their session.
const esc=v=>String(v==null?'':v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function generateMemo(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  const isAff=t==='affordable';
  const hp=holdPeriod(inp);
  const name=inp.propertyName||'the Property';
  const $=f.$; const pct=(n,d=1)=>f.pct(n,d);
  const units=inp.numUnits||0;
  const S=[];
  // Executive Summary
  if(isAff){
    const L=res.lihtc;
    S.push(['Executive Summary',
      `This memorandum presents an underwriting summary for ${name}, a ${units?units+'-unit ':''}affordable housing development structured around Low-Income Housing Tax Credits. Total development cost is ${$(L.totalUses)}, funded through a permanent loan of ${$(L.permLoan)} sized to a minimum debt service coverage of ${(inp.minDSCR||1.15).toFixed(2)}x, ${$(L.lihtcEquity)} of tax-credit equity, and the balance from soft sources and a deferred developer fee. The ${(L.creditRate*100).toFixed(0)}% credit generates an annual allocation of ${$(L.annualCredit)} over a ten-year period.`]);
  }else{
    const P=t==='development'?calcProjectTimeline(res,inp):null;
    S.push(['Executive Summary',
      `This memorandum presents an investment underwriting summary for ${name}${inp.address?', located at '+inp.address:''}, a ${inp.assetType.toLowerCase()} opportunity. The analysis assumes a ${hp}-year hold and projects a ${P?'project':'levered'} internal rate of return of ${pct(P?P.projectIRR:res.ret.irr,1)} and an equity multiple of ${f.x(P?P.projectEM:res.ret.em)} on required equity of ${$(res.equity)}.${P?' These returns include construction and lease-up timing.':` The deal generates a year-one cash-on-cash return of ${pct(res.sum.coc,1)} at a going-in capitalization rate of ${pct(res.sum.capR,2)}.`}`]);
  }
  // Investment Highlights / Capital Stack
  if(isAff){
    const L=res.lihtc;
    S.push(['Sources of Capital',
      `The capital stack is led by ${$(L.lihtcEquity)} in LIHTC equity, representing ${L.totalUses>0?pct(L.lihtcEquity/L.totalUses,0):'0%'} of total development cost, priced at $${L.creditPrice.toFixed(3)} per credit dollar. A permanent loan of ${$(L.permLoan)} is supported by stabilized net operating income of ${$(res.sum.noi)}. ${L.softSources>0?'Soft sources contribute '+$(L.softSources)+'. ':''}A deferred developer fee of ${$(L.deferredFee)} closes the remaining gap, leaving ${$(L.cashDevFee)} of the fee payable in cash. ${Math.abs(L.fundingGap)<1?'As underwritten, sources and uses are balanced.':(L.fundingGap>0?'As underwritten, the deal carries a funding shortfall of '+$(L.fundingGap)+' that requires additional sources.':'As underwritten, sources exceed uses by '+$(Math.abs(L.fundingGap))+'.')}`]);
  }else{
    const exitShare=res.exit.proceeds/(res.ret.totalCF+res.exit.proceeds||1);
    S.push(['Returns Analysis',
      `Over the ${hp}-year hold, the investment returns ${$(res.ret.totalCF+res.exit.proceeds)} in total, comprising ${$(res.ret.totalCF)} of cumulative operating cash flow and ${$(res.exit.proceeds)} of net proceeds at exit. ${inp.exitMethod==='ppu'?`The exit assumes a sale at ${$(inp.exitPPU||0)} per unit on comparable sales, appreciating ${pct(((inp.apprRate!=null?inp.apprRate:3))/100,1)} annually, net of ${pct((inp.sellingCostsPct||0)/100,0)} selling costs.`:`The exit assumes a sale at a ${pct((inp.exitCapRate||0)/100,2)} capitalization rate on forward net operating income, net of ${pct((inp.sellingCostsPct||0)/100,0)} selling costs.`} ${exitShare>0.7?'Because roughly '+pct(exitShare,0)+' of total return depends on the sale, the projected IRR is sensitive to the exit cap rate assumption and should be stress-tested.':'Returns are reasonably balanced between operating cash flow and exit proceeds.'}`]);
  }
  // Financing & Coverage
  const dscrTxt = res.sum.dscr ? `Year-one debt service coverage is ${res.sum.dscr.toFixed(2)}x${res.sum.dscr<1.2?', which is thin relative to typical lender minimums and limits proceeds':(res.sum.dscr<1.4?', which clears typical lender minimums with a modest cushion':', which provides healthy coverage')}.` : 'The deal is underwritten without permanent debt.';
  if(!isAff){
    S.push(['Financing',
      `${dscrTxt} The analysis assumes a loan at ${pct((inp.interestRate||0)/100,2)} interest over a ${inp.amortYears||30}-year amortization${(inp.ioPeriod||0)>0?', including '+inp.ioPeriod+' years of interest-only payments':''}. Break-even occupancy is ${pct(res.sum.beOcc,1)}, against an underwritten vacancy assumption of ${pct((inp.vacancyRate||0)/100,0)}.`]);
  }
  // Risks
  const risks=[];
  if(res.sum.dscr&&res.sum.dscr<1.25)risks.push('debt service coverage is tight and leaves limited room for income shortfalls');
  if(!isAff){const es=res.exit.proceeds/(res.ret.totalCF+res.exit.proceeds||1);if(es>0.7)risks.push('a large share of return depends on the exit, exposing the deal to cap-rate movement');}
  if(isAff&&res.lihtc.fundingGap>1)risks.push('the capital stack does not fully cover development cost as underwritten');
  const y1=res.rows[0];if(y1&&y1.expR>0.55)risks.push('the operating expense ratio is high and should be verified against actuals');
  risks.push('all projections depend on the accuracy of the underwriting assumptions and prevailing market conditions');
  S.push(['Key Risks',`The principal risks to this underwriting are that ${risks.join('; ')}.`]);
  // Recommendation
  if(isAff){
    S.push(['Summary',`${name} pencils as ${Math.abs(res.lihtc.fundingGap)<1?'a balanced':'a'} tax-credit transaction with ${$(res.lihtc.lihtcEquity)} of credit equity anchoring the capital stack. Further diligence on basis eligibility, the credit price, and soft-source commitments is recommended before proceeding.`]);
  }else{
    const P=t==='development'?calcProjectTimeline(res,inp):null;
    const irr=P?P.projectIRR:res.ret.irr,em=P?P.projectEM:res.ret.em;
    const verdict=irr>0.15?'an attractive return profile':(irr>0.10?'a reasonable return profile':'a modest return profile');
    S.push(['Recommendation',`At a projected ${pct(irr,1)} ${P?'project':'levered'} IRR and ${f.x(em)} equity multiple, ${name} presents ${verdict} for a ${hp}-year hold. The recommendation is to advance to confirmatory diligence, with particular attention to the assumptions driving exit value and operating expenses.`]);
  }
  return S;
}

// ─── ASSUMPTIONS APPENDIX ─────────────────────────────────────────────────
// The reason a memo travels at all: whoever receives it can check the inputs
// instead of taking the headline on faith. The dashboard showed these and the
// memo did not, which made the memo the less complete of the two documents
// precisely where completeness matters — in someone else's hands.
const BASIS_SUFFIX={perUnitYr:' / unit / yr',perUnitMo:' / unit / mo',perSF:' / buildable SF',perUnit:' / unit'};
function quoted(r){
  const v=+r.amount||0,b=r&&r.basis;
  if(b==='pctEGI')return v+'% of EGI';
  if(b==='pctHard')return v+'% of hard costs';
  if(b&&BASIS_SUFFIX[b])return f.$f(v)+BASIS_SUFFIX[b];
  return f.$f(v)+' / yr';
}
const catLabel=(r,fallback)=>r.cat==='Custom'?(r.label||fallback):(r.cat||fallback);
function assumptionGroups(res,inp,hp){
  const t=(inp.assetType||'').toLowerCase();
  const isDev=t==='development'||t==='affordable';
  const units=+inp.numUnits||0;
  const egi=(res.rows&&res.rows[0]&&res.rows[0].egi)||0;
  const G=[];
  const P=[['Asset type',inp.assetType||'—']];
  if(inp.address)P.push(['Address',inp.address]);
  if(units)P.push(['Units',String(units)]);
  if(inp.totalSF)P.push(['Rentable SF',(+inp.totalSF).toLocaleString('en-US')]);
  if(isDev){
    P.push(['Land / site cost',f.$f(inp.landCost||inp.purchasePrice||0)]);
    if(inp.grossBuildableSF)P.push(['Gross buildable SF',(+inp.grossBuildableSF).toLocaleString('en-US')]);
  }else P.push(['Purchase price',f.$f(inp.purchasePrice||0)]);
  if(inp.acquisitionCostsPct)P.push(['Acquisition costs',inp.acquisitionCostsPct+'% of price']);
  G.push(['Property',P]);

  const I=[];
  if(Array.isArray(inp.unitMix)&&inp.unitMix.length)
    inp.unitMix.forEach(u=>I.push([`${u.count||0} × ${u.type==='Other'?(u.label||'Other'):(u.type||'Unit')}`,f.$f(u.rent||0)+' / mo']));
  else if(units&&inp.avgRent)I.push(['Average rent',f.$f(inp.avgRent)+' / mo']);
  if(inp.totalSF&&inp.avgRentPerSF)I.push(['Base rent',f.$f(inp.avgRentPerSF)+' / SF / yr']);
  if(inp.camIncome)I.push(['CAM / NNN recovery',f.$f(inp.camIncome)+' / yr']);
  const oi=inp.otherIncomeItems;
  if(Array.isArray(oi)&&oi.length)oi.forEach(r=>I.push([catLabel(r,'Other income'),quoted(r)+(r.basis&&r.basis!=='amount'?' = '+f.$f(resolveLine(r,units,egi)):'')]));
  else if(inp.otherIncome)I.push(['Other income',f.$f(inp.otherIncome)+' / yr']);
  I.push(['Physical vacancy',(inp.vacancyRate||0)+'%']);
  if(inp.creditLossRate)I.push(['Credit loss',inp.creditLossRate+'%']);
  G.push(['Income',I]);

  const E=[];
  const ox=inp.opexItems;
  if(Array.isArray(ox)&&ox.length)ox.forEach(r=>E.push([catLabel(r,'Expense'),quoted(r)+(r.basis&&r.basis!=='amount'?' = '+f.$f(resolveLine(r,units,egi)):'')]));
  else[['Property taxes','propertyTax'],['Insurance','insurance'],['Repairs & maintenance','maintenance'],['Utilities','utilities'],['Reserves','reserves'],['Administrative','administrative']]
    .forEach(([l,k])=>{if(inp[k])E.push([l,f.$f(inp[k])+' / yr']);});
  if(inp.managementFeePct)E.push(['Management fee',inp.managementFeePct+'% of EGI']);
  if(inp.capexAnnual){
    const b=inp.capexBasis||'amount';
    const lbl=b==='perUnit'?f.$f(inp.capexAnnual)+' / unit / yr'
      :b==='pctEGI'?inp.capexAnnual+'% of EGI'
      :b==='once'?f.$f(inp.capexAnnual)+' one-time (Yr 1)'
      :f.$f(inp.capexAnnual)+' / yr';
    E.push(['Capital expenditure',lbl+(b==='amount'||b==='once'?'':' = '+f.$f(resolveCapex(inp,egi,1)))]);
  }
  if(E.length)G.push(['Operating expenses',E]);

  // A renovation scope belongs in the assumptions a reader will argue with,
  // line by line, the same way the operating expenses are laid out.
  const rh=inp.rehabItems;
  if(Array.isArray(rh)&&rh.length&&res.rehab&&res.rehab.total>0){
    const rhSF=inp.totalSF||inp.grossBuildableSF||0;
    const R=rh.map(r=>[catLabel(r,'Renovation'),
      quoted(r)+(r.basis&&r.basis!=='amount'?' = '+f.$f(resolveCostLine(r,rhSF,units,0)):'')]);
    R.push(['Total renovation budget',f.$f(res.rehab.total)]);
    if(res.rehab.pctFinanced>0)R.push(['Funded by loan',
      res.rehab.pctFinanced+'% = '+f.$f(res.rehab.financed)]);
    R.push(['Spend period',res.rehab.months>0?res.rehab.months+' months from closing':'at closing']);
    G.push(['Renovation',R]);
  }

  if(isDev){
    const D=[],hard=getHardCost(inp),soft=getSoftCost(inp,hard);
    const hi=inp.hardCostItems,si=inp.softCostItems;
    if(Array.isArray(hi)&&hi.length)hi.forEach(r=>D.push([catLabel(r,'Hard cost'),quoted(r)+(r.basis&&r.basis!=='amount'?' = '+f.$f(resolveCostLine(r,inp.grossBuildableSF,units,0)):'')]));
    else if(inp.hardCostPerSF)D.push(['Hard costs',f.$f(inp.hardCostPerSF)+' / buildable SF = '+f.$f(hard)]);
    if(Array.isArray(si)&&si.length)si.forEach(r=>D.push([catLabel(r,'Soft cost'),quoted(r)+(r.basis&&r.basis!=='amount'?' = '+f.$f(resolveCostLine(r,inp.grossBuildableSF,units,hard)):'')]));
    else if(inp.softCostsPct)D.push(['Soft costs',inp.softCostsPct+'% of hard = '+f.$f(soft)]);
    if(inp.developerFee)D.push(['Developer fee',f.$f(inp.developerFee)]);
    // third element marks a total, rather than smuggling <b> through a string
    // that later gets escaped along with everything else
    D.push(['Total hard costs',f.$f(hard),true]);
    D.push(['Total soft costs',f.$f(soft),true]);
    G.push(['Development budget',D]);
  }

  const FI=[];
  if(inp.sizeDebt){
    FI.push(['Debt sizing','Sized to constraints']);
    if(inp.minDSCR)FI.push(['Minimum DSCR',(+inp.minDSCR).toFixed(2)+'x']);
    if(inp.maxLTV)FI.push(['Maximum LTV',inp.maxLTV+'%']);
    if(inp.minDebtYield)FI.push(['Minimum debt yield',inp.minDebtYield+'%']);
  }
  FI.push(['Loan amount',f.$f(res.loan||inp.loanAmount||0)]);
  if(inp.interestRate)FI.push(['Interest rate',inp.interestRate+'%']);
  if(inp.amortYears)FI.push(['Amortization',inp.amortYears+' years']);
  if(inp.ioPeriod)FI.push(['Interest-only period',inp.ioPeriod+' years']);
  if(inp.loanFeesPct)FI.push(['Loan fees',inp.loanFeesPct+'% of loan']);
  G.push(['Financing',FI]);

  const X=[['Revenue growth',(inp.revenueGrowth||0)+'% / yr'],['Expense growth',(inp.expenseGrowth||0)+'% / yr'],['Hold period',hp+' years']];
  if(inp.exitMethod==='ppu'){
    X.push(['Exit basis',f.$f(inp.exitPPU||0)+' per unit (comparable sales)']);
    X.push(['Appreciation',(inp.apprRate!=null?inp.apprRate:3)+'% / yr']);
  }else X.push(['Exit cap rate',(inp.exitCapRate||0)+'%']);
  X.push(['Selling costs',(inp.sellingCostsPct||0)+'% of sale']);
  if(inp.discountRate)X.push(['Discount rate (NPV)',inp.discountRate+'%']);
  G.push(['Growth & exit',X]);
  return G;
}

// A lender's first question about any projection is "what if you are wrong".
// Answering it inside the document is what separates an underwriting from a
// pitch, so the grid travels with the memo rather than living only on screen.
function sensSection(res,inp){
  const isPPU=inp.exitMethod==='ppu';
  const base=isPPU?(+inp.exitPPU||0):(+inp.exitCapRate||0);
  if(!base)return'';
  const cols=(isPPU?[0.9,0.95,1,1.05,1.1].map(m=>Math.round(base*m/500)*500)
    :[base-1,base-0.5,base,base+0.5,base+1].map(v=>Math.round(v*100)/100)).filter(v=>v>0);
  if(!cols.length)return'';
  const rows=[+inp.revenueGrowth-1,+inp.revenueGrowth,+inp.revenueGrowth+1].filter(v=>isFinite(v));
  const grow=rows.length?rows:[2,3,4];
  const irrOf=(rg,c)=>{
    try{return buildPF({...inp,revenueGrowth:rg,...(isPPU?{exitPPU:c}:{exitCapRate:c})}).ret.irr;}catch(e){return null;}
  };
  const head=cols.map(c=>`<th>${isPPU?f.$(c):c+'%'}</th>`).join('');
  const body=grow.map(g=>`<tr><td class="rl">${g}% / yr</td>${cols.map(c=>{
    const v=irrOf(g,c);
    const isBase=Math.abs(g-(+inp.revenueGrowth||0))<1e-9&&Math.abs(c-base)<1e-9;
    return`<td${isBase?' class="base"':''}>${v==null?'—':f.pct(v,1)}</td>`;
  }).join('')}</tr>`).join('');
  return`
  <div class="mtitle">SENSITIVITY &mdash; LEVERED IRR</div>
  <p class="cap">Revenue growth against ${isPPU?'comparable sale price per unit':'exit capitalization rate'}. The underwritten case is shaded. All other assumptions held constant.</p>
  <table class="cf sens">
    <thead><tr><th class="rl">Revenue growth</th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

// opts.brand: {name, line} when the plan allows a branded memo — the reader
// should see the sender's firm, not ours. Absent, the memo carries our name and
// the "Prepared with" credit. Previously this was a boolean that produced a
// contenteditable "Your Firm Name" placeholder, which meant the name had to be
// retyped into every memo and was lost the moment the document was saved.
// This is the white-label line, and it is deliberately a soft lock -- the memo
// is HTML in the reader's own browser, so anyone determined can delete the mark
// from devtools regardless of plan. What a plan buys is not having to. Off by
// default, so the free document always identifies where it came from.
function memoHTML(res,inp,opts){
  const brand=(opts&&opts.brand)||null;
  const branding=!!brand;
  const sections=generateMemo(res,inp);
  const t=(inp.assetType||'').toLowerCase();
  const isAff=t==='affordable';
  const name=esc(inp.propertyName||'Analysis');
  const address=esc(inp.address||'');
  const assetType=esc(inp.assetType||'');
  const hp=holdPeriod(inp);
  const today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const metric=(l,v)=>`<tr><td>${l}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`;
  let metricsRows='';
  if(isAff){const L=res.lihtc;
    metricsRows=[metric('Total Development Cost',f.$(L.totalUses)),metric('LIHTC Equity',f.$(L.lihtcEquity)),metric('Annual Credit',f.$(L.annualCredit)),metric('Permanent Loan',f.$(L.permLoan)),metric('Deferred Developer Fee',f.$(L.deferredFee)),metric('Funding Gap',f.$(L.fundingGap)),metric('Year 1 NOI',f.$(res.sum.noi)),metric('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a')].join('');
  }else{
    metricsRows=[metric('Levered IRR',f.pct(res.ret.irr,1)),metric('Equity Multiple',f.x(res.ret.em)),metric('Equity Required',f.$(res.equity)),metric('Year 1 Cap Rate',f.pct(res.sum.capR,2)),metric('Year 1 Cash-on-Cash',f.pct(res.sum.coc,1)),metric('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a'),metric('Net Sale Proceeds',f.$(res.exit.proceeds)),metric('Hold Period',hp+' Years')].join('');
  }
  // Every generated sentence is editable. A broker producing listing material
  // is not going to ship "advance to confirmatory diligence" — they have their
  // own pitch, and the generated prose is a starting point rather than a
  // verdict. Headings are editable too, since "Recommendation" is the wrong
  // word on a marketing piece.
  // Sections can be added and removed, not just reworded. A broker wants a
  // "Location & Market" or "Value-Add Plan" that no generator would think to
  // write, and does not want a "Recommendation" at all — so the generated set
  // is a starting point, not a fixed skeleton.
  const sec=(h,p)=>`<section class="sec"><button class="rm noprint" title="Remove this section" onclick="this.closest('.sec').remove()">&times;</button>`
    +`<h2 contenteditable="true" spellcheck="false">${h}</h2><p contenteditable="true">${p}</p></section>`;
  const body=sections.map(([h,p])=>sec(esc(h),esc(p))).join('');
  // Everything here is escaped at the point of insertion. The appendix is the
  // one place that echoes raw user strings back -- an address, a custom expense
  // label, a floor-plan name -- and a deal can arrive from a shared link, so an
  // unescaped label is a script running on our origin in the reader's browser.
  const appendix=assumptionGroups(res,inp,hp).map(([title,rows])=>`
    <div class="agroup">
      <div class="atitle">${esc(title)}</div>
      <table class="ap">${rows.map(([l,v,tot])=>tot
        ?`<tr><td><b>${esc(l)}</b></td><td><b>${esc(v)}</b></td></tr>`
        :`<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    </div>`).join('');
  // A memo that gets forwarded to a partner or lender needs the cash flows,
  // not just the narrative — otherwise the reader has to take the headline
  // returns on faith. Held to the hold period so it stays a one-pager.
  const cfRows=(res.rows||[]).filter(r=>r.yr>=1&&r.yr<=hp);
  const cfTable=cfRows.length?`
  <div class="mtitle">ANNUAL CASH FLOW</div>
  <table class="cf">
    <thead><tr><th>Year</th><th>EGI</th><th>OpEx</th><th>NOI</th><th>Debt Service</th><th>Cash Flow</th><th>DSCR</th></tr></thead>
    <tbody>${cfRows.map(r=>`<tr><td>${r.yr}</td><td>${f.$(r.egi)}</td><td>${f.$(r.opex)}</td><td>${f.$(r.noi)}</td><td>${f.$(r.ds)}</td><td>${f.$(r.cfbt)}</td><td>${r.dscr?r.dscr.toFixed(2)+'x':'n/a'}</td></tr>`).join('')}</tbody>
  </table>
  <div class="mtitle">EXIT</div>
  <table>
    ${metric(res.exit.method==='ppu'?`Gross Sale (${f.$(res.exit.ppu)}/unit &times; ${res.exit.units} units, ${f.pct(res.exit.appr,1)}/yr)`:'Gross Sale Price',f.$(res.exit.grossSale))}
    ${metric('Selling Costs',f.$(-res.exit.sellAmt))}
    ${metric('Loan Payoff',f.$(-res.exit.payoff))}
    ${metric('<b>Net Proceeds to Equity</b>',f.$(res.exit.proceeds))}
  </table>`:'';
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} — Investment Memo</title>
  <style>
    @page{margin:0.9in;}
    /* The memo is a document, not a themed page: it pins itself to light so a
       reader in dark mode doesn't get near-black text on a near-black ground. */
    :root{color-scheme:light;}
    html{background:#f4f2ed;}
    /* Measure, not width. Justified serif with no hyphenation opens rivers of
       white space down the page, which is the single loudest tell that a
       document was generated rather than written. Ragged right, ~68 characters. */
    body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;
      line-height:1.62;max-width:44em;margin:32px auto;padding:52px 56px 44px;
      box-shadow:0 1px 3px rgba(0,0,0,.08);}
    .mast{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
      border-bottom:2.5px solid #181716;padding-bottom:16px;margin-bottom:6px;}
    .mast h1{font-size:27px;line-height:1.15;color:#181716;margin:0 0 6px;letter-spacing:-.01em;}
    .mast .sub{font-size:12px;color:#6b6259;font-family:Arial,Helvetica,sans-serif;letter-spacing:.02em;}
    
.brandline{font-size:9pt;font-weight:400;letter-spacing:0;text-transform:none;opacity:.7;margin-top:3px}
.brand{font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:.22em;
      color:#8a8179;text-transform:uppercase;white-space:nowrap;padding-top:5px;}
    .dateline{font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.14em;
      text-transform:uppercase;color:#8a8179;margin:0 0 26px;}
    h2{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#181716;margin:26px 0 7px;
      letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid #d9d3c8;padding-bottom:5px;}
    p{font-size:14px;margin:0 0 11px;}
    p.cap{font-size:11.5px;color:#6b6259;font-family:Arial,Helvetica,sans-serif;margin:0 0 8px;line-height:1.5;}
    table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-family:Arial,Helvetica,sans-serif;}
    td{padding:6px 10px;border-bottom:1px solid #eceae4;font-size:12.5px;}
    table.km td:last-child{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;}
    table.cf{font-size:11.5px;}
    table.cf th{padding:6px 7px;border-bottom:1.5px solid #181716;font-size:9.5px;text-align:right;
      letter-spacing:.12em;text-transform:uppercase;color:#6b6259;}
    table.cf th:first-child,table.cf td:first-child{text-align:left;}
    table.cf td{padding:5px 7px;text-align:right;font-variant-numeric:tabular-nums;}
    table.cf tbody tr:last-child td{border-bottom:1.5px solid #181716;}
    table.sens td.base{background:#efece5;font-weight:700;}
    table.sens td.rl,table.sens th.rl{text-align:left;color:#6b6259;}
    .mtitle{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:700;color:#181716;
      letter-spacing:.16em;margin:26px 0 6px;border-bottom:1px solid #d9d3c8;padding-bottom:5px;}
    /* Two columns of assumptions, so the appendix reads as a reference table
       rather than three pages of scrolling. Collapses to one column on paper
       narrower than the measure. */
    .appendix{column-count:2;column-gap:34px;margin-top:4px;}
    .agroup{break-inside:avoid;page-break-inside:avoid;margin-bottom:14px;}
    .atitle{font-family:Arial,Helvetica,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.14em;
      text-transform:uppercase;color:#8a8179;border-bottom:1px solid #d9d3c8;padding-bottom:3px;margin-bottom:2px;}
    table.ap td{font-size:11.5px;padding:3.5px 0;border-bottom:none;vertical-align:top;}
    table.ap td:last-child{text-align:right;font-variant-numeric:tabular-nums;color:#3d3833;padding-left:10px;}
    .foot{margin-top:34px;padding-top:12px;border-top:1px solid #d9d3c8;font-size:10.5px;color:#8a8179;
      font-family:Arial,Helvetica,sans-serif;line-height:1.6;}
    .bar{position:sticky;top:0;background:#181716;color:#fff;margin:-52px -56px 30px;padding:11px 56px;
      font-family:Arial,Helvetica,sans-serif;font-size:12px;display:flex;gap:16px;align-items:center;justify-content:space-between;}
    .bar span{color:#c9c3ba;}
    [contenteditable]:hover{background:#faf7f0;}
    [contenteditable]:focus{background:#f6f1e6;outline:1px solid #d9d3c8;}
    .sec{position:relative;}
    .rm{position:absolute;left:-30px;top:24px;width:20px;height:20px;padding:0;line-height:1;
      background:none;color:#b8b0a6;font-size:17px;opacity:0;transition:opacity .12s;}
    .sec:hover .rm{opacity:1;}
    .rm:hover{color:#b3261e;}
    .addbar{margin:20px 0 4px;}
    .addbar button{background:none;color:#6b6259;border:1px solid #d9d3c8;font-weight:500;}
    .addbar button:hover{color:#181716;border-color:#181716;}
    @media print{
      .bar,.noprint{display:none;}
      html{background:#fff;}
      body{margin:0;padding:0;max-width:none;box-shadow:none;}
      [contenteditable]:hover,[contenteditable]:focus{background:none;outline:none;}
      .appendix{column-count:2;}
    }
    button{background:#fff;color:#181716;border:none;border-radius:3px;padding:7px 15px;font-size:12px;
      cursor:pointer;font-family:Arial,Helvetica,sans-serif;font-weight:600;}
  </style></head><body>
  <div class="bar">
    <span>Click any heading or paragraph to edit it. Add or remove sections as you like, then print.</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="mast">
    <div>
      <h1 contenteditable="true" spellcheck="false">${name}</h1>
      <div class="sub" contenteditable="true">${assetType} Investment Memorandum${address?' &nbsp;&middot;&nbsp; '+address:''}</div>
    </div>
    <div class="brand">${branding?esc(brand.name):'SmartCapStack'}${branding&&brand.line?`<div class="brandline">${esc(brand.line)}</div>`:''}</div>
  </div>
  <div class="dateline">${today}</div>
  <div class="mtitle">KEY METRICS</div>
  <table class="km">${metricsRows}</table>
  <div id="sections">${body}</div>
  <!-- A blank section lives in a template element and is cloned by an inline
       handler, so the memo carries no script element at all. That matters more
       than the convenience: this document renders deals that arrive from shared
       links, and "there is no script here" is a far easier guarantee to keep
       than "the script here is safe". Template content never renders or prints.
       (Written without the angle-bracket spelling on purpose -- the test that
       enforces this scans the output, and a comment would trip it.) -->
  <template id="newsec">${sec('New Section','Write here.')}</template>
  <div class="addbar noprint"><button onclick="var w=document.getElementById('sections');w.appendChild(document.getElementById('newsec').content.cloneNode(true));var s=w.querySelectorAll('.sec');var h=s[s.length-1].querySelector('h2');h.focus();document.getSelection().selectAllChildren(h);h.scrollIntoView({block:'center'});">+ Add a section</button></div>
  ${cfTable}
  ${sensSection(res,inp)}
  <div class="mtitle">ASSUMPTIONS</div>
  <p class="cap">Every figure above follows from these inputs. Stated as entered, so they can be checked rather than taken on faith.</p>
  <div class="appendix">${appendix}</div>
  <div class="foot">${branding?'':'Prepared with SmartCapStack. '}This memorandum is generated from user-supplied assumptions and is for informational purposes only. It does not constitute investment advice, an offer, or a solicitation.</div>
  </body></html>`;
  return html;
}

function openMemo(res,inp,brand){
  const w=window.open('','_blank');
  if(w){w.document.write(memoHTML(res,inp,brand?{brand}:undefined));w.document.close();return true;}
  alert('Please allow pop-ups to generate the memo.');
  return false;
}

function downloadMemo(res,inp){
  const sections=generateMemo(res,inp);
  const isAff=(inp.assetType||'').toLowerCase()==='affordable';
  // Markdown output, not HTML — escaping entities here would corrupt the file
  // ("Smith & Co" becoming "Smith &amp; Co"), so values stay raw.
  const name=inp.propertyName||'Analysis';
  const hp=holdPeriod(inp);
  const today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const m=(l,v)=>`| ${l} | ${v} |`;
  let rows;
  if(isAff){const L=res.lihtc;rows=[m('Total Development Cost',f.$(L.totalUses)),m('LIHTC Equity',f.$(L.lihtcEquity)),m('Annual Credit',f.$(L.annualCredit)),m('Permanent Loan',f.$(L.permLoan)),m('Deferred Developer Fee',f.$(L.deferredFee)),m('Funding Gap',f.$(L.fundingGap)),m('Year 1 NOI',f.$(res.sum.noi)),m('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a')];}
  else{rows=[m('Levered IRR',f.pct(res.ret.irr,1)),m('Equity Multiple',f.x(res.ret.em)),m('Equity Required',f.$(res.equity)),m('Year 1 Cap Rate',f.pct(res.sum.capR,2)),m('Year 1 Cash-on-Cash',f.pct(res.sum.coc,1)),m('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a'),m('Net Sale Proceeds',f.$(res.exit.proceeds)),m('Hold Period',hp+' Years')];}
  let md=`# ${name}\n\n${inp.assetType} Investment Memorandum${inp.address?' | '+inp.address:''} | ${today}\n\n## Key Metrics\n\n| Metric | Value |\n|---|---|\n${rows.join('\n')}\n\n`;
  sections.forEach(sec=>{md+=`## ${sec[0]}\n\n${sec[1]}\n\n`;});
  md+=`---\n\n_Prepared with SmartCapStack. Generated from user-supplied assumptions; informational only and not investment advice._\n`;
  try{
    const blob=new Blob([md],{type:'text/markdown'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')+'_Memo.md';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert('Could not download: '+e.message);}
}

export{generateMemo,memoHTML,openMemo,downloadMemo};
