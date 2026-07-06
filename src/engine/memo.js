import{f}from'./format.js';
// ─── DEAL MEMO GENERATOR ──────────────────────────────────────────────────
function generateMemo(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  const isAff=t==='affordable';
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
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
    S.push(['Executive Summary',
      `This memorandum presents an investment underwriting summary for ${name}${inp.address?', located at '+inp.address:''}, a ${inp.assetType.toLowerCase()} opportunity. The analysis assumes a ${hp}-year hold and projects a levered internal rate of return of ${pct(res.ret.irr,1)} and an equity multiple of ${f.x(res.ret.em)} on required equity of ${$(res.equity)}. The deal generates a year-one cash-on-cash return of ${pct(res.sum.coc,1)} at a going-in capitalization rate of ${pct(res.sum.capR,2)}.`]);
  }
  // Investment Highlights / Capital Stack
  if(isAff){
    const L=res.lihtc;
    S.push(['Sources of Capital',
      `The capital stack is led by ${$(L.lihtcEquity)} in LIHTC equity, representing ${L.totalUses>0?pct(L.lihtcEquity/L.totalUses,0):'0%'} of total development cost, priced at $${L.creditPrice.toFixed(3)} per credit dollar. A permanent loan of ${$(L.permLoan)} is supported by stabilized net operating income of ${$(res.sum.noi)}. ${L.softSources>0?'Soft sources contribute '+$(L.softSources)+'. ':''}A deferred developer fee of ${$(L.deferredFee)} closes the remaining gap, leaving ${$(L.cashDevFee)} of the fee payable in cash. ${Math.abs(L.fundingGap)<1?'As underwritten, sources and uses are balanced.':(L.fundingGap>0?'As underwritten, the deal carries a funding shortfall of '+$(L.fundingGap)+' that requires additional sources.':'As underwritten, sources exceed uses by '+$(Math.abs(L.fundingGap))+'.')}`]);
  }else{
    const exitShare=res.exit.proceeds/(res.ret.totalCF+res.exit.proceeds||1);
    S.push(['Returns Analysis',
      `Over the ${hp}-year hold, the investment returns ${$(res.ret.totalCF+res.exit.proceeds)} in total, comprising ${$(res.ret.totalCF)} of cumulative operating cash flow and ${$(res.exit.proceeds)} of net proceeds at exit. The exit assumes a sale at a ${pct((inp.exitCapRate||0)/100,2)} capitalization rate on forward net operating income, net of ${pct((inp.sellingCostsPct||0)/100,0)} selling costs. ${exitShare>0.7?'Because roughly '+pct(exitShare,0)+' of total return depends on the sale, the projected IRR is sensitive to the exit cap rate assumption and should be stress-tested.':'Returns are reasonably balanced between operating cash flow and exit proceeds.'}`]);
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
    const verdict=res.ret.irr>0.15?'an attractive return profile':(res.ret.irr>0.10?'a reasonable return profile':'a modest return profile');
    S.push(['Recommendation',`At a projected ${pct(res.ret.irr,1)} levered IRR and ${f.x(res.ret.em)} equity multiple, ${name} presents ${verdict} for a ${hp}-year hold. The recommendation is to advance to confirmatory diligence, with particular attention to the assumptions driving exit value and operating expenses.`]);
  }
  return S;
}

function openMemo(res,inp){
  const sections=generateMemo(res,inp);
  const t=(inp.assetType||'').toLowerCase();
  const isAff=t==='affordable';
  const name=inp.propertyName||'Pro Forma Analysis';
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const metric=(l,v)=>`<tr><td>${l}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`;
  let metricsRows='';
  if(isAff){const L=res.lihtc;
    metricsRows=[metric('Total Development Cost',f.$(L.totalUses)),metric('LIHTC Equity',f.$(L.lihtcEquity)),metric('Annual Credit',f.$(L.annualCredit)),metric('Permanent Loan',f.$(L.permLoan)),metric('Deferred Developer Fee',f.$(L.deferredFee)),metric('Funding Gap',f.$(L.fundingGap)),metric('Year 1 NOI',f.$(res.sum.noi)),metric('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a')].join('');
  }else{
    metricsRows=[metric('Levered IRR',f.pct(res.ret.irr,1)),metric('Equity Multiple',f.x(res.ret.em)),metric('Equity Required',f.$(res.equity)),metric('Year 1 Cap Rate',f.pct(res.sum.capR,2)),metric('Year 1 Cash-on-Cash',f.pct(res.sum.coc,1)),metric('Year 1 DSCR',res.sum.dscr?res.sum.dscr.toFixed(2)+'x':'n/a'),metric('Net Sale Proceeds',f.$(res.exit.proceeds)),metric('Hold Period',hp+' Years')].join('');
  }
  const body=sections.map(([h,p])=>`<h2>${h}</h2><p>${p}</p>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} — Investment Memo</title>
  <style>
    @page{margin:1in;}
    body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.55;max-width:760px;margin:40px auto;padding:0 24px;}
    .hdr{border-bottom:2px solid #1f3864;padding-bottom:14px;margin-bottom:24px;}
    .hdr h1{font-size:24px;color:#1f3864;margin:0 0 4px;}
    .hdr .sub{font-size:13px;color:#666;}
    h2{font-size:15px;color:#1f3864;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px;}
    p{font-size:13.5px;margin:0 0 10px;text-align:justify;}
    table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-family:Arial,sans-serif;}
    td{padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;}
    .mtitle{font-size:12px;font-weight:700;color:#1f3864;letter-spacing:.5px;margin:18px 0 4px;font-family:Arial,sans-serif;}
    .foot{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;}
    .noprint{margin-bottom:20px;}
    @media print{.noprint{display:none;}body{margin:0;}}
    button{background:#3a5bf0;color:#fff;border:none;border-radius:4px;padding:9px 18px;font-size:14px;cursor:pointer;font-family:Arial,sans-serif;}
  </style></head><body>
  <div class="noprint"><button onclick="window.print()">Print or Save as PDF</button></div>
  <div class="hdr"><h1>${name}</h1><div class="sub">${inp.assetType} Investment Memorandum${inp.address?' &nbsp;|&nbsp; '+inp.address:''} &nbsp;|&nbsp; ${today}</div></div>
  <div class="mtitle">KEY METRICS</div>
  <table>${metricsRows}</table>
  ${body}
  <div class="foot">Prepared with SmartCapStack. This memorandum is generated from user-supplied assumptions and is for informational purposes only. It does not constitute investment advice, an offer, or a solicitation.</div>
  </body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else alert('Please allow pop-ups to generate the memo.');
}

function downloadMemo(res,inp){
  const sections=generateMemo(res,inp);
  const isAff=(inp.assetType||'').toLowerCase()==='affordable';
  const name=inp.propertyName||'Pro Forma Analysis';
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
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

export{generateMemo,openMemo,downloadMemo};
