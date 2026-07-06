import{calcIRR}from'./finance.js';
// ─── CONSTRUCTION & LEASE-UP TIMELINE ─────────────────────────────────────
// Honest project-level IRR for ground-up deals: equity sits idle during
// construction, income ramps through lease-up, and construction-period
// interest is capitalized, all of which the stabilized IRR ignores.
// Construction draw schedule with capitalized interest computed on the actual
// outstanding balance each month (straight-line or S-curve draw pattern).
function drawSchedule(loanAmt,months,mRate,pattern){
  if(months<=0||loanAmt<=0)return{capInterest:0,peakBalance:0,rows:[]};
  let weights=[];
  if(pattern==='scurve'){
    // bell-shaped draws, heaviest mid-construction
    let raw=[],sum=0;
    for(let m=1;m<=months;m++){const w=Math.sin(Math.PI*(m-0.5)/months);raw.push(w);sum+=w;}
    weights=raw.map(w=>w/sum);
  } else {
    weights=Array(months).fill(1/months); // straight-line
  }
  let bal=0,capInt=0,peak=0;const rows=[];
  for(let m=1;m<=months;m++){
    const draw=loanAmt*weights[m-1];
    bal+=draw;
    const interest=bal*mRate;   // interest on outstanding balance, capitalized
    bal+=interest; capInt+=interest;
    peak=Math.max(peak,bal);
    rows.push({month:m,draw,interest,balance:bal});
  }
  return{capInterest:capInt,peakBalance:peak,rows};
}

function calcProjectTimeline(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  if(t!=='development')return null;
  const cM=Math.max(0,Math.round(inp.constructionPeriodMonths||0));
  const lM=Math.max(0,Math.round(inp.leaseUpMonths||0));
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const equity=res.equity;
  const loan0=Math.max(0,res.totalCost-res.equity);
  const mRate=(inp.interestRate||0)/100/12;
  const draw=drawSchedule(loan0,cM,mRate,inp.drawPattern||'straight');
  const capInterest=draw.capInterest; // exact, from month-by-month draw schedule
  const cf=[-equity];
  for(let m=1;m<=cM;m++)cf.push(0);                 // construction: no income, interest capitalized
  const noiM=y=>res.rows[Math.min(y-1,res.rows.length-1)].noi/12;
  const dsM=y=>res.rows[Math.min(y-1,res.rows.length-1)].ds/12;
  for(let m=1;m<=lM;m++)cf.push(noiM(1)*(lM>0?m/lM:1)-dsM(1)); // lease-up ramp
  const stabMonths=hp*12;
  for(let m=1;m<=stabMonths;m++){const y=Math.ceil(m/12);cf.push(noiM(y)-dsM(y));}
  cf[cf.length-1]+=(res.exit.proceeds-capInterest);  // exit, payoff incl. capitalized interest
  const mIRR=calcIRR(cf);
  const projIRR=isFinite(mIRR)?Math.pow(1+mIRR,12)-1:NaN;
  const dist=cf.slice(1).reduce((a,b)=>a+b,0);
  return{
    constructionMonths:cM, leaseUpMonths:lM, totalMonths:cM+lM+stabMonths,
    capInterest, drawPattern:inp.drawPattern||'straight', constructionLoan:loan0,
    peakDrawBalance:draw.peakBalance, drawRows:draw.rows,
    stabilizedIRR:res.ret.irr, projectIRR:projIRR,
    projectEM:equity>0?(dist)/equity:0, stabilizedEM:res.ret.em
  };
}

export{drawSchedule,calcProjectTimeline};
