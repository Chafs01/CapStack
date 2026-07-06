import{calcIRR}from'./finance.js';
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

export{calcAfterTax};
