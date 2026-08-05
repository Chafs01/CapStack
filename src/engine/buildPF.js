import{monthlyPmt,loanBal,calcIRR,calcNPV,holdPeriod,PF_YEARS}from'./finance.js';
import{getGPI,projectedRevenue,getOpEx,getDevCost,getOtherIncome,resolveCapex,lossRate,getRehab,rehabSchedule,opexParts}from'./income.js';
import{calcLIHTC}from'./lihtc.js';
function buildPF(inp){
  const gpi0=getGPI(inp);
  const opex0=getOpEx(inp);
  const OPX=opexParts(inp);
  const vacPct=+(inp.vacancyRate)||0, credPct=+(inp.creditLossRate)||0;
  const PP=inp.purchasePrice||0;
  const acqC=PP*(inp.acquisitionCostsPct||0)/100;
  const tEarly=(inp.assetType||'').toLowerCase();
  const isAff=tEarly==='affordable';
  const IRe=inp.interestRate||0, AYe=inp.amortYears||30;
  const noi0=(gpi0*(1-lossRate(inp))+getOtherIncome(inp))-opex0;
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
  // A rehab draw is part of the loan, so it is sized in before the fee is
  // taken on it. The lender's constraints above still bind on the going-in
  // value, which is how a bridge loan is actually written: the rehab holdback
  // rides on top of the acquisition loan rather than enlarging the test.
  const rehabTotal=getRehab(inp);
  const rehabFinPct=Math.max(0,Math.min(+(inp.rehabFinancedPct)||0,100));
  const rehabFin=rehabTotal*rehabFinPct/100;
  const rehabCash=rehabTotal-rehabFin;
  LA=LA+rehabFin;
  const LF=LA*(inp.loanFeesPct||0)/100;
  const devCostEarly=(tEarly==='development'||isAff)?getDevCost(inp):0;
  const baseCost=(tEarly==='development'||isAff)?devCostEarly:PP;
  // The going-in cap rate is quoted on the price, not on the price plus what
  // you are about to spend. Renovation shows up in the return through the
  // rents it buys and the basis it builds, not by quietly deflating Year 1.
  const capBasis=baseCost;
  const totalCost=baseCost+acqC+LF+rehabTotal;
  const equity=totalCost-LA;
  // Cash rehab spent after close is not equity at close. Total equity is
  // unchanged — it is the same money — but the IRR sees it in the year it
  // leaves, and the cash flow line shows the year it was spent.
  const rehabByYear=rehabSchedule(inp,rehabCash);
  const rehabDeferred=rehabByYear.slice(1).reduce((s,v)=>s+v,0);
  const equityAtClose=equity-rehabDeferred;
  const IR=inp.interestRate||0;
  const AY=inp.amortYears||30;
  const IO=inp.ioPeriod||0;
  const pmt12=monthlyPmt(LA,IR/100,AY)*12;
  const ioAnnual=LA*(IR/100);
  const hp=holdPeriod(inp);
  const rg=inp.revenueGrowth||3;
  const eg=inp.expenseGrowth||2.5;
  const eCapR=(inp.exitCapRate||5.5)/100;
  const sellC=(inp.sellingCostsPct||3)/100;
  const dr=(inp.discountRate||8)/100;
  const t=inp.assetType.toLowerCase();
  const devCost=(t==='development'||t==='affordable')?getDevCost(inp):0;

  const rows=[];
  for(let yr=1;yr<=PF_YEARS;yr++){
    const rm=Math.pow(1+rg/100,yr-1);
    const em=Math.pow(1+eg/100,yr-1);
    const rev=projectedRevenue(inp,yr);
    const gpi=rev.gpi;
    // shown as two lines because they are two different arguments
    const vacL=rev.vacL;
    const credL=gpi*credPct/100;
    const egi=gpi-vacL-credL+getOtherIncome(inp)*rm;
    const mgmt=egi*(inp.managementFeePct||0)/100;
    // Fixed lines inflate; percentage-of-EGI lines ride that year's income,
    // the same way management always has. With no percentage lines this is
    // arithmetically identical to growing the whole Year 1 total.
    const opex=OPX.fixed*em+egi*OPX.pctRate+mgmt;
    const noi=egi-opex;
    const isIO=yr<=IO;
    const monthsPaid=isIO?0:(yr-IO)*12;
    const bal=loanBal(LA,IR/100,AY,monthsPaid);
    const ds=LA>0?(isIO?ioAnnual:pmt12):0;
    // Capital expenditure is not an operating expense: it sits below NOI so it
    // hits cash flow without distorting the cap rate or the DSCR a lender
    // sizes on. Grown with the other costs.
    const capex=resolveCapex(inp,egi,em,yr);
    // Same rule as capex — below NOI, so it never distorts the cap rate or the
    // DSCR a lender sizes on. Unlike capex it does not grow: a rehab budget is
    // a fixed scope, not a recurring reserve.
    const rehab=rehabByYear[yr]||0;
    const cfbt=noi-ds-capex-rehab;
    const capR=capBasis>0?noi/capBasis:0;
    const coc=equity>0?cfbt/equity:0;
    const dscr=ds>0?noi/ds:null;
    const expR=egi>0?opex/egi:0;
    rows.push({yr,gpi,vacL,credL,egi,opex,noi,ds,capex,rehab,cfbt,capR,coc,dscr,bal,expR,mgmt});
  }

  const ex=rows[hp-1];
  const exitNOI=rows[hp].noi;
  // Two ways to price the exit. Income approach (cap rate) is right for
  // commercial assets; 1-4 unit residential is appraised off sales comparables,
  // so it prices per unit and grows with appreciation instead. Absent an
  // explicit method the cap-rate path runs exactly as before.
  const exitMethod=inp.exitMethod==='ppu'?'ppu':'cap';
  const exUnits=inp.numUnits||0;
  const exPPU=inp.exitPPU||0;
  const apprR=(inp.apprRate!=null?inp.apprRate:3)/100;
  const grossSale=exitMethod==='ppu'
    ? exPPU*exUnits*Math.pow(1+apprR,hp)
    : (eCapR>0?exitNOI/eCapR:0);
  const sellAmt=grossSale*sellC;
  const netSale=grossSale-sellAmt;
  const payoff=ex.bal;
  const proceeds=netSale-payoff;
  const totalCF=rows.slice(0,hp).reduce((s,r)=>s+r.cfbt,0);
  const rehabInHold=rows.slice(0,hp).reduce((s,r)=>s+(r.rehab||0),0);
  // Profit nets out however the rehab was timed, because the money spent in
  // year two is already inside totalCF and out of equityAtClose. The multiple
  // is deliberately not netted the same way: a multiple is distributions over
  // capital invested, and rehab spent mid-hold is capital invested.
  const profit=totalCF+proceeds-equityAtClose;
  const em2=equity>0?(totalCF+rehabInHold+proceeds)/equity:0;
  const irrFlows=[-equityAtClose,...rows.slice(0,hp-1).map(r=>r.cfbt),rows[hp-1].cfbt+proceeds];
  // with no equity at risk there is no return to solve for — an empty form
  // would otherwise report a meaningless IRR off all-zero cash flows
  const irr=equity>0?calcIRR(irrFlows):NaN;
  const npv=calcNPV(irrFlows,dr);
  const y1=rows[0];
  const beOcc=y1.gpi>0?Math.max(0,(y1.opex+y1.ds+(y1.capex||0))/y1.gpi):0;
  const retOnCost=devCost>0?y1.noi/devCost:0;
  // Yield on cost — the question a renovation is actually judged by. Cap rate
  // divides NOI by the price; this divides it by every dollar that went in,
  // including the work, the closing costs and the loan fee. Set against the
  // rate you could have bought a stabilised building at, the gap is what the
  // effort bought you. Under it, you spent money to own a worse deal.
  //
  // The NOI to use is the first year the scope is finished — during the work
  // the building is not yet earning what it was renovated to earn. With no
  // renovation that is Year 1 and this is simply the all-in cap rate.
  let stabYear=1;
  while(stabYear<hp&&(rows[stabYear-1].rehab||0)>0)stabYear++;
  const stabNOI=rows[stabYear-1].noi;
  const yoc=totalCost>0?stabNOI/totalCost:0;
  const yocGoingIn=totalCost>0?y1.noi/totalCost:0;
  // Only meaningful against a cap-rate exit; a per-unit comp exit prices off
  // sales evidence rather than a yield, so there is nothing to compare to.
  const yocSpread=(exitMethod==='cap'&&eCapR>0&&totalCost>0)?(yoc-eCapR):null;

  return{inp,equity,equityAtClose,totalCost,acqC,LF,rows,
    rehab:{total:rehabTotal,financed:rehabFin,cash:rehabCash,deferred:rehabDeferred,
      byYear:rehabByYear,months:Math.max(0,+(inp.rehabMonths)||0),pctFinanced:rehabFinPct},
    exit:{grossSale,sellAmt,netSale,payoff,proceeds,method:exitMethod,ppu:exPPU,units:exUnits,appr:apprR},
    ret:{irr,em:em2,npv,profit,totalCF,retOnCost},
    sum:{capR:y1.capR,coc:y1.coc,dscr:y1.dscr,noi:y1.noi,cf:y1.cfbt,beOcc,devCost,
      yoc,yocGoingIn,yocSpread,stabYear,stabNOI},lihtc,debtSizing};
}

export{buildPF};
