// ─── FORMATTERS ───────────────────────────────────────────────────────────
const f={
  $:(n,compact=true)=>{if(n==null||isNaN(n))return'$—';const s=n<0;const a=Math.abs(n);if(compact){if(a>=1e9)return`${s?'-':''}$${(a/1e9).toFixed(2)}B`;if(a>=1e6)return`${s?'-':''}$${(a/1e6).toFixed(2)}M`;if(a>=1e3)return`${s?'-':''}$${(a/1e3).toFixed(0)}K`;}return`${s?'-$':'$'}${a.toLocaleString('en-US',{maximumFractionDigits:0})}`},
  $f:(n)=>{if(n==null||isNaN(n))return'$—';return`${n<0?'-$':'$'}${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`},
  pct:(n,d=1)=>{if(n==null||isNaN(n))return'—%';return`${(n*100).toFixed(d)}%`},
  x:(n)=>{if(n==null||isNaN(n))return'—x';return`${n.toFixed(2)}x`},
  n:(n,d=2)=>{if(n==null||isNaN(n))return'—';return n.toFixed(d)},
};
const pn=(v,fb=0)=>{const n=parseFloat(String(v||'').replace(/[$,%]/g,''));return isNaN(n)?fb:n};

// ─── FINANCIAL ENGINE ─────────────────────────────────────────────────────
function monthlyPmt(P,r_annual,yrs){
  if(!P||P<=0)return 0;
  if(!r_annual||r_annual<=0)return P/(yrs*12);
  const r=r_annual/12,n=yrs*12;
  return P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
}
function loanBal(P,r_annual,yrs,months){
  if(!P||P<=0)return 0;
  if(!r_annual||r_annual<=0)return Math.max(0,P-(P/(yrs*12))*months);
  const r=r_annual/12,n=yrs*12;
  const pmt=monthlyPmt(P,r_annual,yrs);
  return Math.max(0,P*Math.pow(1+r,months)-pmt*(Math.pow(1+r,months)-1)/r);
}
function calcIRR(cfs){
  if(!cfs||cfs.length<2)return NaN;
  const npvAt=r=>cfs.reduce((s,c,t)=>s+c/Math.pow(1+r,t),0);
  let r=0.12,ok=false;
  for(let i=0;i<600;i++){
    let npv=0,d=0;
    for(let t=0;t<cfs.length;t++){
      const disc=Math.pow(1+r,t);
      npv+=cfs[t]/disc;
      d-=t*cfs[t]/(disc*(1+r));
    }
    if(Math.abs(d)<1e-12)break;
    const nr=r-npv/d;
    if(Math.abs(nr-r)<1e-8){r=nr;ok=true;break;}
    r=Math.max(-0.99,Math.min(50,nr));
  }
  if(ok&&isFinite(r)&&Math.abs(npvAt(r))<1)return r;
  let lo=-0.95,hi=10;
  let fLo=npvAt(lo),fHi=npvAt(hi);
  if(fLo*fHi>0)return isFinite(r)?r:NaN;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2,fM=npvAt(mid);
    if(Math.abs(fM)<1e-7)return mid;
    if(fLo*fM<0){hi=mid;fHi=fM}else{lo=mid;fLo=fM}
  }
  return (lo+hi)/2;
}
function calcNPV(cfs,rate){
  return cfs.reduce((s,c,t)=>s+c/Math.pow(1+rate,t),0);
}

function umGPI(m){return(m||[]).reduce((s,r)=>s+(+r.count||0)*(+r.rent||0)*12,0);}
function rtGPI(r){return(r||[]).reduce((s,x)=>s+(+x.sf||0)*(+x.rentPerSF||0),0);}
function getGPI(inp){
  const t=(inp.assetType||'').toLowerCase();
  const hasUM=inp.unitMix&&inp.unitMix.length;
  const hasRT=inp.retailIncome&&inp.retailIncome.length;
  const resGPI=hasUM?umGPI(inp.unitMix):(inp.numUnits||0)*(inp.avgRent||0)*12;
  if(t==='multifamily'||t==='affordable')return resGPI;
  if(t==='commercial')return(hasRT?rtGPI(inp.retailIncome):(inp.totalSF||0)*(inp.avgRentPerSF||0))+(inp.camIncome||0);
  if(t==='mixed-use')return resGPI+(hasRT?rtGPI(inp.retailIncome):(inp.commercialSF||0)*(inp.commercialRentPerSF||0));
  if(t==='development'){
    if(hasUM)return resGPI;
    if(inp.numUnits&&inp.avgRent)return(inp.numUnits||0)*(inp.avgRent||0)*12;
    return(inp.stabilizedNOI||0)/0.52;
  }
  return 0;
}
function getOpEx(inp){
  const gpi=getGPI(inp);
  const vac=inp.vacancyRate||0;
  const egi=gpi*(1-vac/100)+(inp.otherIncome||0);
  return(inp.propertyTax||0)+(inp.insurance||0)+egi*(inp.managementFeePct||0)/100+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
}
function getDevCost(inp){
  const hard=(inp.grossBuildableSF||0)*(inp.hardCostPerSF||0);
  const soft=hard*(inp.softCostsPct||0)/100;
  const devFee=inp.developerFee||0;
  return(inp.landCost||inp.purchasePrice||0)+hard+soft+devFee;
}

function calcLIHTC(inp,permLoan){
  const land=inp.landCost||inp.purchasePrice||0;
  const hard=(inp.grossBuildableSF||0)*(inp.hardCostPerSF||0);
  const soft=hard*(inp.softCostsPct||0)/100;
  const devFee=inp.developerFee||0;
  const totalUses=land+hard+soft+devFee;
  const ebPct=(inp.eligibleBasisPct!=null?inp.eligibleBasisPct:95)/100;
  const eligibleBasis=(hard+soft+devFee)*ebPct;
  const boostPct=inp.qctDda?130:100;
  const boostedBasis=eligibleBasis*boostPct/100;
  const af=(inp.affordablePct!=null?inp.affordablePct:100)/100;
  const qualifiedBasis=boostedBasis*af;
  const creditRate=(inp.creditRate!=null?inp.creditRate:(String(inp.creditType)==='4'?4:9))/100;
  const annualCredit=qualifiedBasis*creditRate;
  const tenYearCredits=annualCredit*10;
  const creditPrice=inp.creditPrice!=null?inp.creditPrice:0.90;
  const lihtcEquity=tenYearCredits*creditPrice;
  const softSources=inp.softSources||0;
  const beforeDefer=permLoan+lihtcEquity+softSources;
  const gapBeforeDefer=totalUses-beforeDefer;
  const maxDeferrable=devFee*((inp.maxDeferPct!=null?inp.maxDeferPct:100)/100);
  const deferredFee=Math.max(0,Math.min(gapBeforeDefer,maxDeferrable));
  const totalSources=beforeDefer+deferredFee;
  const fundingGap=totalUses-totalSources;
  const cashDevFee=devFee-deferredFee;
  return{land,hard,soft,devFee,cashDevFee,totalUses,ebPct,eligibleBasis,boostPct,boostedBasis,
    applicableFraction:af,qualifiedBasis,creditRate,annualCredit,tenYearCredits,creditPrice,
    lihtcEquity,softSources,permLoan,gapBeforeDefer,deferredFee,maxDeferrable,totalSources,fundingGap};
}

// ─── EQUITY WATERFALL (LP / GP promote) ───────────────────────────────────
// Standard real estate PE waterfall: return of capital + preferred return,
// then tiered promote splits at LP IRR hurdles. Tiers are LP IRR bands; the
// partnership cash in each band is split by the stated LP/GP share.
function calcWaterfall(res,inp){
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const E=res.equity||0;
  if(E<=0)return null;
  const lpShare=(inp.lpSharePct!=null?inp.lpSharePct:90)/100;
  const gpShare=1-lpShare;
  const pref=(inp.prefRate!=null?inp.prefRate:8)/100;
  // tiers: ascending LP IRR hurdles with LP share of cash in each band.
  // Tier 1 = pref (pro-rata). Then promote tiers. Final tier = residual split.
  const h2=(inp.hurdle2!=null?inp.hurdle2:12)/100;
  const h3=(inp.hurdle3!=null?inp.hurdle3:15)/100;
  const s1=lpShare;                                   // through pref: pro-rata
  const s2=(inp.lpTier2!=null?inp.lpTier2:80)/100;    // pref -> h2
  const s3=(inp.lpTier3!=null?inp.lpTier3:70)/100;    // h2 -> h3
  const s4=(inp.lpTier4!=null?inp.lpTier4:60)/100;    // above h3
  const tiers=[{h:pref,sL:s1},{h:h2,sL:s2},{h:h3,sL:s3}];
  // partnership distributable cash each year (levered equity CF, positives only)
  const cash=[];
  for(let y=1;y<=hp;y++){
    const r=res.rows[y-1];
    let c=r?r.cfbt:0;
    if(y===hp)c+=res.exit?res.exit.proceeds:0;
    cash.push(Math.max(0,c));
  }
  // LP hurdle balances: amount LP must still receive to hit each hurdle.
  const lpBal=tiers.map(()=>lpShare*E);   // LP contributed lpShare*E at t0
  const lpDist=[], gpDist=[];
  for(let y=0;y<hp;y++){
    // accrue hurdle balances one year
    for(let i=0;i<tiers.length;i++)lpBal[i]*=(1+tiers[i].h);
    let avail=cash[y], lpY=0, gpY=0;
    for(let i=0;i<tiers.length&&avail>1e-9;i++){
      const room=Math.max(0,lpBal[i]);           // LP $ still needed to hit hurdle i
      if(room<=1e-9)continue;
      const tierCash=Math.min(avail, room/tiers[i].sL); // partnership cash; LP gets sL of it
      const lpCut=tierCash*tiers[i].sL, gpCut=tierCash-lpCut;
      lpY+=lpCut; gpY+=gpCut; avail-=tierCash;
      for(let j=0;j<tiers.length;j++)lpBal[j]-=lpCut; // LP cash counts toward all hurdles
    }
    if(avail>1e-9){ // residual above top hurdle
      lpY+=avail*s4; gpY+=avail*(1-s4);
      for(let j=0;j<tiers.length;j++)lpBal[j]-=avail*s4;
      avail=0;
    }
    lpDist.push(lpY); gpDist.push(gpY);
  }
  const lpEq=lpShare*E, gpEq=gpShare*E;
  const lpFlows=[-lpEq,...lpDist], gpFlows=[-gpEq,...gpDist];
  const lpTot=lpDist.reduce((a,b)=>a+b,0), gpTot=gpDist.reduce((a,b)=>a+b,0);
  const lpIRR=calcIRR(lpFlows), gpIRR=calcIRR(gpFlows);
  const gpPromote=gpTot-gpEq-(gpShare*(lpTot+gpTot)-gpEq); // GP take above its pro-rata share
  return{
    lpShare,gpShare,pref,tiers:[{label:'Preferred ('+(pref*100).toFixed(0)+'%)',sL:s1},
      {label:(pref*100).toFixed(0)+'% to '+(h2*100).toFixed(0)+'%',sL:s2},
      {label:(h2*100).toFixed(0)+'% to '+(h3*100).toFixed(0)+'%',sL:s3},
      {label:'Above '+(h3*100).toFixed(0)+'%',sL:s4}],
    lpEq,gpEq,lpTot,gpTot,lpDist,gpDist,
    lpIRR,gpIRR,
    lpEM:lpEq>0?lpTot/lpEq:0, gpEM:gpEq>0?gpTot/gpEq:0,
    lpProfit:lpTot-lpEq, gpProfit:gpTot-gpEq,
    gpPromote:Math.max(0,gpTot-gpShare*(lpTot+gpTot))
  };
}

// ─── AFTER-TAX CASH FLOW ───────────────────────────────────────────────────
// Depreciation shield on operating income, plus recapture and capital-gains
// tax at sale, producing an after-tax levered IRR.
function calcAfterTax(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  if(t==='affordable')return null;
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const isDev=t==='development';
  const costBasis=res.totalCost||0;
  const land=isDev?(inp.landCost||inp.purchasePrice||0):((inp.purchasePrice||0)*((inp.landPct!=null?inp.landPct:20)/100));
  const deprBasis=Math.max(0,costBasis-land);
  const depYears=inp.depYears!=null?inp.depYears:(t==='commercial'?39:27.5);
  const annualDep=depYears>0?deprBasis/depYears:0;
  const taxRate=(inp.taxRate!=null?inp.taxRate:37)/100;
  const capRate=(inp.capGainsRate!=null?inp.capGainsRate:20)/100;
  const recRate=(inp.recaptureRate!=null?inp.recaptureRate:25)/100;
  const loan0=Math.max(0,res.totalCost-res.equity);
  let prevBal=loan0, accumDep=0;
  const yrRows=[], atCF=[];
  for(let y=1;y<=hp;y++){
    const r=res.rows[y-1];
    const principal=Math.max(0,prevBal-r.bal);
    const interest=Math.max(0,r.ds-principal);
    const dep=Math.min(annualDep, y*annualDep>deprBasis?Math.max(0,deprBasis-accumDep):annualDep);
    accumDep+=dep;
    const taxable=r.noi-interest-dep;
    const tax=taxable*taxRate;
    const atcf=r.cfbt-tax;
    yrRows.push({yr:y,noi:r.noi,interest,dep,taxable,tax,cfbt:r.cfbt,atcf});
    atCF.push(atcf);
    prevBal=r.bal;
  }
  // sale
  const adjBasis=costBasis-accumDep;
  const saleGain=res.exit.netSale-adjBasis;
  const recaptureBase=Math.max(0,Math.min(accumDep,saleGain));
  const capGainBase=Math.max(0,saleGain-accumDep);
  const recaptureTax=recaptureBase*recRate;
  const capGainTax=capGainBase*capRate;
  const saleTax=recaptureTax+capGainTax;
  const atProceeds=res.exit.proceeds-saleTax;
  const flows=[-res.equity,...atCF.slice(0,hp-1),atCF[hp-1]+atProceeds];
  const atIRR=calcIRR(flows);
  const totAT=atCF.reduce((a,b)=>a+b,0)+atProceeds;
  return{
    deprBasis,depYears,annualDep,accumDep,taxRate,capRate,recRate,
    yrRows,
    adjBasis,saleGain,recaptureTax,capGainTax,saleTax,atProceeds,
    atIRR, atEM:res.equity>0?totAT/res.equity:0,
    preTaxIRR:res.ret.irr, preTaxEM:res.ret.em
  };
}

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

// ─── REFINANCE / CASH-OUT EVENT ───────────────────────────────────────────
// Mid-hold refinance: a new loan is sized on the property's value at refi,
// the old loan is retired, net proceeds are returned to equity, and the
// remaining hold runs on the new debt. A pure overlay on the base result.
function calcRefinance(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  if(!inp.refiEnabled||t==='affordable')return null;
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const ry=Math.min(Math.max(Math.round(inp.refiYear||3),1),hp-1);
  const refiCap=(inp.refiCapRate!=null?inp.refiCapRate:(inp.exitCapRate||5.5))/100;
  const value=refiCap>0?res.rows[ry].noi/refiCap:0;
  const refiLTV=(inp.refiLTV!=null?inp.refiLTV:70)/100;
  const newLoan=Math.max(0,value*refiLTV);
  const oldBal=res.rows[ry-1].bal;
  const refiCosts=newLoan*((inp.refiCostPct!=null?inp.refiCostPct:1)/100);
  const cashOut=newLoan-oldBal-refiCosts;
  const newRate=(inp.refiRate!=null?inp.refiRate:(inp.interestRate||6))/100;
  const amort=inp.amortYears||30;
  const newDS=newLoan>0?monthlyPmt(newLoan,newRate,amort)*12:0;
  const newBalExit=loanBal(newLoan,newRate,amort,(hp-ry)*12);
  const equity=res.equity;
  const cf=[-equity];
  for(let y=1;y<=hp;y++){
    const ds=y<=ry?res.rows[y-1].ds:newDS;
    let c=res.rows[y-1].noi-ds;
    if(y===ry)c+=cashOut;
    if(y===hp)c+=(res.exit.netSale-newBalExit);
    cf.push(c);
  }
  const irr=calcIRR(cf);
  const dist=cf.slice(1).reduce((a,b)=>a+b,0);
  return{
    refiYear:ry,value,newLoan,oldBal,refiCosts,cashOut,newDS,newRate,amort,newBalExit,
    refiDSCR:newDS>0?res.rows[ry].noi/newDS:null,
    refiIRR:irr,baseIRR:res.ret.irr,refiEM:equity>0?dist/equity:0,baseEM:res.ret.em
  };
}

// ─── SCENARIO ANALYSIS (downside / base / upside) ─────────────────────────
// Flexes the two biggest value drivers (rent growth, exit cap) plus vacancy
// to bracket the base case. Pure overlay: each case is a fresh buildPF.
function calcScenarios(res,inp){
  if((inp.assetType||'').toLowerCase()==='affordable')return null;
  const gD=inp.scenGrowthDelta!=null?inp.scenGrowthDelta:1;
  const cD=inp.scenCapDelta!=null?inp.scenCapDelta:0.5;
  const vD=inp.scenVacDelta!=null?inp.scenVacDelta:2;
  const baseG=inp.revenueGrowth||0, baseC=inp.exitCapRate||0, baseV=inp.vacancyRate||0;
  const run=(g,c,v)=>{
    try{const r=buildPF({...inp,revenueGrowth:g,exitCapRate:c,vacancyRate:Math.max(0,v)});
      return{irr:r.ret.irr,em:r.ret.em,dscr:r.sum.dscr,coc:r.sum.coc,proceeds:r.exit.proceeds,g,c,v:Math.max(0,v)};}
    catch(e){return null;}
  };
  return{
    downside:run(baseG-gD,baseC+cD,baseV+vD),
    base:run(baseG,baseC,baseV),
    upside:run(baseG+gD,baseC-cD,baseV-vD),
    deltas:{g:gD,c:cD,v:vD}
  };
}

// ─── DEVELOPMENT TAX CREDITS (historic / brownfield / stacked) ────────────
// Each credit computed on its own basis x rate x syndication price. Credit
// equity stacks into development sources & uses as an additive overlay; the
// LIHTC module and base engine are untouched.
function calcDevCredits(res,inp){
  const src=inp.devCredits||[];
  if(!src.length)return null;
  const rows=src.map(r=>{
    const basis=+r.basis||0, ratePct=+r.rate||0, price=r.price!=null?+r.price:0.9;
    const credit=basis*(ratePct/100);
    return{type:r.type||'Other',basis,ratePct,price,credit,equity:credit*price};
  });
  const totalCredit=rows.reduce((a,b)=>a+b.credit,0);
  const totalEquity=rows.reduce((a,b)=>a+b.equity,0);
  const isAff=(inp.assetType||'').toLowerCase()==='affordable';
  const uses=res.totalCost||0;
  const loan=Math.max(0,(res.totalCost||0)-(res.equity||0));
  const lihtcEq=isAff&&res.lihtc?res.lihtc.lihtcEquity:0;
  const deferredFee=isAff&&res.lihtc?res.lihtc.deferredFee:0;
  const softSources=isAff&&res.lihtc?res.lihtc.softSources:0;
  const sponsorEquityBefore=isAff?Math.max(0,uses-loan-lihtcEq-deferredFee-softSources):(res.equity||0);
  const sponsorEquityAfter=Math.max(0,sponsorEquityBefore-totalEquity);
  let sponsorIRR=null, baseIRR=null;
  if(!isAff){
    baseIRR=res.ret.irr;
    const newEq=Math.max(1,(res.equity||0)-totalEquity);
    const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
    const cf=[-newEq];
    for(let y=1;y<=hp;y++){let c=res.rows[y-1].cfbt;if(y===hp)c+=res.exit.proceeds;cf.push(c);}
    sponsorIRR=calcIRR(cf);
  }
  return{rows,totalCredit,totalEquity,uses,loan,lihtcEq,deferredFee,softSources,sponsorEquityBefore,sponsorEquityAfter,sponsorIRR,baseIRR,isAff};
}

function buildPF(inp){
  const gpi0=getGPI(inp);
  const opex0=getOpEx(inp);
  const vac=inp.vacancyRate||0;
  const PP=inp.purchasePrice||0;
  const acqC=PP*(inp.acquisitionCostsPct||0)/100;
  const tEarly=(inp.assetType||'').toLowerCase();
  const isAff=tEarly==='affordable';
  const IRe=inp.interestRate||0, AYe=inp.amortYears||30;
  const noi0=(gpi0*(1-vac/100)+(inp.otherIncome||0))-opex0;
  let LA=inp.loanAmount||0;
  let lihtc=null, debtSizing=null;
  if(isAff){
    const constant=monthlyPmt(1,IRe/100,AYe)*12;
    const minDSCR=inp.minDSCR||1.15;
    LA=constant>0?Math.max(0,(noi0/minDSCR)/constant):0;
    lihtc=calcLIHTC(inp,LA);
  } else if(inp.sizeDebt){
    const constant=monthlyPmt(1,IRe/100,AYe)*12;
    const isDev=tEarly==='development';
    const valueBasis=isDev?getDevCost(inp):PP;
    const cons=[];
    if((inp.minDSCR||0)>0&&constant>0)cons.push({name:'DSCR',basis:'min '+(inp.minDSCR).toFixed(2)+'x',loan:(noi0/inp.minDSCR)/constant});
    if((inp.minDebtYield||0)>0)cons.push({name:'Debt Yield',basis:'min '+(inp.minDebtYield).toFixed(1)+'%',loan:noi0/((inp.minDebtYield)/100)});
    if(isDev){if((inp.maxLTC||0)>0)cons.push({name:'LTC',basis:'max '+(inp.maxLTC).toFixed(0)+'%',loan:valueBasis*(inp.maxLTC/100)});}
    else{if((inp.maxLTV||0)>0)cons.push({name:'LTV',basis:'max '+(inp.maxLTV).toFixed(0)+'%',loan:valueBasis*(inp.maxLTV/100)});}
    if(cons.length){
      const binding=cons.reduce((a,b)=>b.loan<a.loan?b:a);
      LA=Math.max(0,binding.loan);
      debtSizing={constraints:cons.map(c=>({...c,loan:Math.max(0,c.loan),binds:c.name===binding.name})),binding:binding.name,sizedLoan:LA,valueBasis,noi0};
    }
  }
  const LF=LA*(inp.loanFeesPct||0)/100;
  const devCostEarly=(tEarly==='development'||isAff)?getDevCost(inp):0;
  const baseCost=(tEarly==='development'||isAff)?devCostEarly:PP;
  const capBasis=baseCost;
  const totalCost=baseCost+acqC+LF;
  const equity=totalCost-LA;
  const IR=inp.interestRate||0;
  const AY=inp.amortYears||30;
  const IO=inp.ioPeriod||0;
  const pmt12=monthlyPmt(LA,IR/100,AY)*12;
  const ioAnnual=LA*(IR/100);
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const rg=inp.revenueGrowth||3;
  const eg=inp.expenseGrowth||2.5;
  const eCapR=(inp.exitCapRate||5.5)/100;
  const sellC=(inp.sellingCostsPct||3)/100;
  const dr=(inp.discountRate||8)/100;
  const t=inp.assetType.toLowerCase();
  const devCost=(t==='development'||t==='affordable')?getDevCost(inp):0;

  const rows=[];
  for(let yr=1;yr<=11;yr++){
    const rm=Math.pow(1+rg/100,yr-1);
    const em=Math.pow(1+eg/100,yr-1);
    const gpi=gpi0*rm;
    const vacL=gpi*vac/100;
    const egi=gpi-vacL+(inp.otherIncome||0)*rm;
    const mgmt=egi*(inp.managementFeePct||0)/100;
    const opex=(opex0-((getGPI(inp)*(1-vac/100)+(inp.otherIncome||0))*(inp.managementFeePct||0)/100))*em+mgmt;
    const noi=egi-opex;
    const isIO=yr<=IO;
    const monthsPaid=isIO?0:(yr-IO)*12;
    const bal=loanBal(LA,IR/100,AY,monthsPaid);
    const ds=LA>0?(isIO?ioAnnual:pmt12):0;
    const cfbt=noi-ds;
    const capR=capBasis>0?noi/capBasis:0;
    const coc=equity>0?cfbt/equity:0;
    const dscr=ds>0?noi/ds:null;
    const expR=egi>0?opex/egi:0;
    rows.push({yr,gpi,vacL,egi,opex,noi,ds,cfbt,capR,coc,dscr,bal,expR,mgmt});
  }

  const ex=rows[hp-1];
  const exitNOI=rows[hp].noi;
  const grossSale=eCapR>0?exitNOI/eCapR:0;
  const sellAmt=grossSale*sellC;
  const netSale=grossSale-sellAmt;
  const payoff=ex.bal;
  const proceeds=netSale-payoff;
  const totalCF=rows.slice(0,hp).reduce((s,r)=>s+r.cfbt,0);
  const profit=totalCF+proceeds-equity;
  const em2=equity>0?(totalCF+proceeds)/equity:0;
  const irrFlows=[-equity,...rows.slice(0,hp-1).map(r=>r.cfbt),rows[hp-1].cfbt+proceeds];
  const irr=calcIRR(irrFlows);
  const npv=calcNPV(irrFlows,dr);
  const y1=rows[0];
  const beOcc=y1.gpi>0?Math.max(0,(y1.opex+y1.ds)/y1.gpi):0;
  const retOnCost=devCost>0?y1.noi/devCost:0;

  return{inp,equity,totalCost,acqC,LF,rows,
    exit:{grossSale,sellAmt,netSale,payoff,proceeds},
    ret:{irr,em:em2,npv,profit,totalCF,retOnCost},
    sum:{capR:y1.capR,coc:y1.coc,dscr:y1.dscr,noi:y1.noi,cf:y1.cfbt,beOcc,devCost},lihtc,debtSizing};
}

// ─── FILE PARSE ───────────────────────────────────────────────────────────
function parseFile(file,cb){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='csv'){
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>cb({data:r.data,headers:r.meta.fields||[]})});
  }else{
    const rd=new FileReader();
    rd.onload=e=>{
      const wb=XLSX.read(e.target.result,{type:'binary'});
      const sh=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(sh,{defval:''});
      cb({data,headers:data.length?Object.keys(data[0]):[]});
    };
    rd.readAsBinaryString(file);
  }
}
function extractFields(data){
  if(!data||!data.length)return{};
  const out={};
  const r=data[0];
  const keys=Object.keys(r);
  const find=(pats)=>{for(const p of pats){const k=keys.find(k=>k.toLowerCase().replace(/[\s_-]/g,'').includes(p));if(k){const v=pn(r[k]);if(v>0)return v;}}return null;};
  const pp=find(['purchaseprice','saleprice','acquisitionprice','price']);if(pp)out.purchasePrice=pp;
  const la=find(['loanamount','debtamount','mortgage']);if(la)out.loanAmount=la;
  const units=find(['units','unitcount','numberofunits','totalunits']);if(units)out.numUnits=units;
  const rent=find(['avgrent','averagerent','monthlyrent','rentperunit']);if(rent)out.avgRent=rent;
  const noi=find(['noi','netoperatingincome']);if(noi)out.stabilizedNOI=noi;
  const sf=find(['totalsf','totalsqft','rentablesf','grossleasablesf','gla','rsf']);if(sf)out.totalSF=sf;
  const rsf=find(['rentsf','ratepersfrent','rentpersf']);if(rsf)out.avgRentPerSF=rsf;
  const taxes=find(['propertytax','taxes','realestatetax']);if(taxes)out.propertyTax=taxes;
  const ins=find(['insurance','insur']);if(ins)out.insurance=ins;
  return out;
}

function normalizeUnitType(raw){
  const v=String(raw||'').toLowerCase().replace(/[\s_]/g,'');
  if(/studio|^eff|^0(br|bd|bed)?$/.test(v))return{type:'Studio'};
  const m=v.match(/([0-4])\s*(br|bd|bed|x|\/)/);
  const n=m?m[1]:(v.match(/^([0-4])$/)||[])[1];
  if(n==='0')return{type:'Studio'};
  if(n==='1')return{type:'1BR'};
  if(n==='2')return{type:'2BR'};
  if(n==='3')return{type:'3BR'};
  if(n==='4')return{type:'4BR'};
  return{type:'Other',label:String(raw||'Unit').trim()};
}

// Parse a rent roll into a unit mix: detects unit-type + rent (+ optional count) columns.
function extractRentRoll(data){
  if(!data||data.length<2)return null;
  const keys=Object.keys(data[0]);
  const matchCol=pats=>keys.find(k=>{const kl=k.toLowerCase().replace(/[\s_-]/g,'');return pats.some(p=>kl.includes(p));});
  const typeCol=matchCol(['unittype','floorplan','plantype','bedroom','beds','bedbath','unitclass','plan','type']);
  const rentCol=matchCol(['marketrent','askingrent','currentrent','monthlyrent','scheduledrent','rent','rate']);
  if(!typeCol||!rentCol)return null;
  const countCol=matchCol(['unitcount','numunits','ofunits','quantity','count','units']);
  const groups={};
  let total=0;
  data.forEach(row=>{
    const rawType=row[typeCol]; if(rawType===''||rawType==null)return;
    const rent=pn(row[rentCol]); if(rent<=0)return;
    const cnt=countCol?Math.max(1,pn(row[countCol])||1):1;
    const norm=normalizeUnitType(rawType);
    const key=norm.label||norm.type;
    if(!groups[key])groups[key]={type:norm.type,label:norm.label,count:0,rentSum:0};
    groups[key].count+=cnt;
    groups[key].rentSum+=rent*cnt;
    total+=cnt;
  });
  const order={Studio:0,'1BR':1,'2BR':2,'3BR':3,'4BR':4,Other:5};
  const mix=Object.values(groups).map(g=>{
    const row={type:g.type,count:g.count,rent:Math.round(g.rentSum/g.count)};
    if(g.label&&g.type==='Other')row.label=g.label;
    return row;
  }).sort((a,b)=>(order[a.type]??9)-(order[b.type]??9));
  if(!mix.length||total<1)return null;
  const annual=mix.reduce((s,r)=>s+r.count*r.rent*12,0);
  return{unitMix:mix,numUnits:total,avgRent:total?Math.round(annual/total/12):0};
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────
const DEFS={
  multifamily:{assetType:'Multifamily',propertyName:'',address:'',purchasePrice:7750000,acquisitionCostsPct:1.5,numUnits:40,avgRent:1650,unitMix:[{type:'1BR',count:24,rent:1500},{type:'2BR',count:16,rent:1875}],vacancyRate:5,otherIncome:12000,propertyTax:95000,insurance:28000,managementFeePct:8,maintenance:60000,utilities:25000,reserves:20000,administrative:10000,loanAmount:4850000,interestRate:6.5,amortYears:30,ioPeriod:0,loanFeesPct:1,revenueGrowth:3,expenseGrowth:2.5,holdingPeriod:7,exitCapRate:5.75,sellingCostsPct:3,discountRate:8,lpSharePct:90,prefRate:8,hurdle2:12,lpTier2:80,hurdle3:15,lpTier3:70,lpTier4:60,sizeDebt:false,minDSCR:1.25,maxLTV:75,maxLTC:65,minDebtYield:8},
  commercial:{assetType:'Commercial',propertyName:'',address:'',purchasePrice:5850000,acquisitionCostsPct:1.5,totalSF:25000,occupiedSF:22500,avgRentPerSF:28,retailIncome:[{name:'Anchor Tenant',sf:15000,rentPerSF:28},{name:'In-Line Retail',sf:10000,rentPerSF:28}],camIncome:50000,vacancyRate:10,otherIncome:15000,propertyTax:95000,insurance:28000,managementFeePct:5,maintenance:55000,utilities:45000,reserves:25000,administrative:12000,loanAmount:3500000,interestRate:6.75,amortYears:25,ioPeriod:2,loanFeesPct:1,revenueGrowth:2.5,expenseGrowth:2.5,holdingPeriod:7,exitCapRate:7,sellingCostsPct:3,discountRate:9,lpSharePct:90,prefRate:8,hurdle2:12,lpTier2:80,hurdle3:15,lpTier3:70,lpTier4:60,sizeDebt:false,minDSCR:1.25,maxLTV:75,maxLTC:65,minDebtYield:8},
  'mixed-use':{assetType:'Mixed-Use',propertyName:'',address:'',purchasePrice:3650000,acquisitionCostsPct:1.5,numUnits:20,avgRent:1400,unitMix:[{type:'1BR',count:12,rent:1300},{type:'2BR',count:8,rent:1550}],commercialSF:5000,commercialRentPerSF:24,retailIncome:[{name:'Ground Floor Retail',sf:5000,rentPerSF:24}],vacancyRate:7,otherIncome:10000,propertyTax:68000,insurance:24000,managementFeePct:7,maintenance:42000,utilities:22000,reserves:18000,administrative:10000,loanAmount:2350000,interestRate:6.5,amortYears:30,ioPeriod:0,loanFeesPct:1,revenueGrowth:3,expenseGrowth:2.5,holdingPeriod:7,exitCapRate:6.25,sellingCostsPct:3,discountRate:8.5,lpSharePct:90,prefRate:8,hurdle2:12,lpTier2:80,hurdle3:15,lpTier3:70,lpTier4:60,sizeDebt:false,minDSCR:1.25,maxLTV:75,maxLTC:65,minDebtYield:8},
  development:{assetType:'Development',propertyName:'',address:'',purchasePrice:1200000,landCost:1200000,grossBuildableSF:30000,hardCostPerSF:185,softCostsPct:18,acquisitionCostsPct:1,numUnits:24,avgRent:2600,unitMix:[{type:'1BR',count:14,rent:2400},{type:'2BR',count:10,rent:2880}],stabilizedNOI:0,vacancyRate:5,otherIncome:0,propertyTax:65000,insurance:22000,managementFeePct:8,maintenance:35000,utilities:12000,reserves:20000,administrative:8000,constructionPeriodMonths:18,leaseUpMonths:12,loanAmount:0,interestRate:6.5,amortYears:30,ioPeriod:2,loanFeesPct:1.5,revenueGrowth:3,expenseGrowth:2.5,holdingPeriod:5,exitCapRate:5.25,sellingCostsPct:3,discountRate:10,lpSharePct:90,prefRate:8,hurdle2:12,lpTier2:80,hurdle3:15,lpTier3:70,lpTier4:60,sizeDebt:false,minDSCR:1.25,maxLTV:75,maxLTC:65,minDebtYield:8},
  affordable:{assetType:'Affordable',propertyName:'',address:'',landCost:1500000,grossBuildableSF:60000,hardCostPerSF:250,softCostsPct:25,developerFee:2500000,numUnits:60,avgRent:1250,unitMix:[{type:'1BR',count:36,rent:1150},{type:'2BR',count:24,rent:1400}],vacancyRate:5,otherIncome:0,propertyTax:60000,insurance:90000,managementFeePct:8,maintenance:90000,utilities:60000,reserves:30000,administrative:60000,constructionPeriodMonths:20,leaseUpMonths:12,creditType:'9',creditRate:9,creditPrice:0.90,eligibleBasisPct:95,qctDda:false,affordablePct:100,minDSCR:1.15,softSources:0,maxDeferPct:100,interestRate:6,amortYears:35,ioPeriod:2,loanFeesPct:1.5,revenueGrowth:2,expenseGrowth:3,holdingPeriod:10,exitCapRate:6,sellingCostsPct:3,discountRate:7,loanAmount:0},
};


module.exports={f,pn,monthlyPmt,loanBal,calcIRR,calcNPV,umGPI,rtGPI,getGPI,getOpEx,getDevCost,calcLIHTC,calcWaterfall,calcAfterTax,drawSchedule,calcProjectTimeline,calcRefinance,calcScenarios,calcDevCredits,buildPF,extractFields,normalizeUnitType,extractRentRoll,DEFS};
