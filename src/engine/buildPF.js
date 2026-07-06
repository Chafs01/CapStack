import{monthlyPmt,loanBal,calcIRR,calcNPV}from'./finance.js';
import{getGPI,getOpEx,getDevCost}from'./income.js';
import{calcLIHTC}from'./lihtc.js';
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

export{buildPF};
