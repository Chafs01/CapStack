// Income & cost assembly from deal inputs.
import{PF_YEARS}from'./finance.js';
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
// Asset-aware annual revenue. Old deals have none of the optional fields, so
// this collapses exactly to the original single growth/vacancy calculation.
function projectedRevenue(inp,yr){
  const t=(inp.assetType||'').toLowerCase();
  const n=Math.max(1,+yr||1)-1;
  const rg=(+inp.revenueGrowth||0)/100;
  if(t==='mixed-use'){
    const split=inp.residentialGrowthRate!=null||inp.commercialGrowthRate!=null||inp.residentialVacancyRate!=null||inp.commercialVacancyRate!=null;
    if(!split){const gpi=getGPI(inp)*Math.pow(1+rg,n);return{gpi,vacL:gpi*(+inp.vacancyRate||0)/100};}
    const res0=inp.unitMix&&inp.unitMix.length?umGPI(inp.unitMix):(inp.numUnits||0)*(inp.avgRent||0)*12;
    const com0=inp.retailIncome&&inp.retailIncome.length?rtGPI(inp.retailIncome):(inp.commercialSF||0)*(inp.commercialRentPerSF||0);
    const resG=res0*Math.pow(1+(inp.residentialGrowthRate!=null?+inp.residentialGrowthRate:+inp.revenueGrowth||0)/100,n);
    const comG=com0*Math.pow(1+(inp.commercialGrowthRate!=null?+inp.commercialGrowthRate:+inp.revenueGrowth||0)/100,n);
    const rv=(inp.residentialVacancyRate!=null?+inp.residentialVacancyRate:+inp.vacancyRate||0)/100;
    const cv=(inp.commercialVacancyRate!=null?+inp.commercialVacancyRate:+inp.vacancyRate||0)/100;
    return{gpi:resG+comG,vacL:resG*rv+comG*cv,resGPI:resG,commercialGPI:comG};
  }
  let gpi=getGPI(inp)*Math.pow(1+rg,n);
  if(t==='multifamily'&&(+inp.marketRentPremiumPct||0)>0){
    const sy=Math.max(1,+inp.rentStabilizationYear||1);
    const ramp=sy<=1?1:Math.min(1,n/(sy-1));
    gpi*=1+(+inp.marketRentPremiumPct/100)*ramp;
  }
  return{gpi,vacL:gpi*(+inp.vacancyRate||0)/100};
}
// Operating expenses are either an itemised list or the six legacy fields.
// Six fixed lines is fine for a duplex and useless for a real deal, where the
// work is in the line items themselves — so a list is allowed, with the old
// shape still honoured so saved deals and share links keep computing the same
// numbers. Only one of the two is ever counted: the list wins when present.
// Other income has the same problem operating expenses had: one box cannot
// hold laundry, parking, storage, pet rent, RUBS and a rooftop antenna lease,
// and those are exactly the lines an underwriter argues about. Same rule as
// opex — the list wins when present, the single field still works otherwise.
// A line item is quoted the way its category is normally quoted: an annual
// figure, per unit, or a share of income. Storing the basis alongside the
// number means the model holds what the user actually said rather than an
// arithmetic result they had to work out first.
//   income  : amount | perUnitMo | perUnitYr
//   expense : amount | perUnitYr | pctEGI
// A share of income is offered only on expenses; on an income line it would be
// a share of itself.
function resolveLine(r,units,egi){
  if(!r||typeof r!=='object')return 0;
  const v=+r.amount;
  if(!isFinite(v))return 0;
  const u=isFinite(+units)?+units:0;
  switch(r.basis){
    case'perUnitMo':return v*u*12;
    case'perUnitYr':return v*u;
    case'pctEGI':return (isFinite(egi)?egi:0)*v/100;
    default:return v;
  }
}
function listTotal(rows,units,egi){
  if(!Array.isArray(rows))return null;
  let t=0,any=false;
  for(const r of rows){
    if(!r||typeof r!=='object')continue;
    const v=resolveLine(r,units,egi);
    if(v!==0)any=true;
    t+=v;
  }
  // Present but empty means the user cleared every line — that is zero, not
  // "no list here, go and read the old fields".
  return any?t:0;
}
function getOtherIncome(inp){
  const listed=listTotal(inp&&inp.otherIncomeItems,inp&&inp.numUnits,0);
  if(listed!==null)return listed;
  const v=+(inp&&inp.otherIncome);
  return isFinite(v)?v:0;
}
// Capital expenditure is quoted four ways in practice: a budget for the year,
// a reserve per unit per year (the common multifamily convention, e.g. $300/unit),
// a share of effective gross income, or a single lump sum spent once. The
// stored number means whichever the basis says, so switching basis reinterprets
// it rather than silently keeping a figure that no longer means anything.
function resolveCapex(inp,egi,expenseFactor,yr){
  const v=+(inp&&inp.capexAnnual);
  if(!isFinite(v)||v===0)return 0;
  const basis=(inp&&inp.capexBasis)||'amount';
  // A lump sum is spent once and then it is gone — no growth, no repeat. The
  // year defaults to 1 so a caller that only wants the figure (the memo) sees
  // it rather than a zero.
  if(basis==='once')return (yr==null||yr===1)?v:0;
  if(basis==='perUnit'){
    const u=+(inp.numUnits)||0;
    return v*u*(isFinite(expenseFactor)?expenseFactor:1);
  }
  if(basis==='pctEGI'){
    // a share of income needs no separate growth — it rides the income line
    return (isFinite(egi)?egi:0)*v/100;
  }
  return v*(isFinite(expenseFactor)?expenseFactor:1);
}
function opexItemsTotal(inp,egi){
  return listTotal(inp&&inp.opexItems,inp&&inp.numUnits,egi);
}
// Operating expenses split into the part that inflates and the part that rides
// income, because those are two different things and growing them the same way
// is wrong for one of them.
//
// A line quoted as a share of EGI means that share of the income the deal
// actually produces, in every year — not a Year 1 dollar figure that then
// inflates on its own. Management is the case that makes it obvious: it is
// contractually a percentage of collections, so in a year when rents rise the
// fee rises with them. Capex quoted the same way already worked this way, and
// so did the dedicated management field; only the itemised expense list did
// not, which meant the same fee computed differently depending on which box
// you typed it in.
//
// Returns the fixed dollars (grown with the expense rate by the caller) and
// the combined rate to apply to each year's EGI. Management's own percentage
// is deliberately not included — buildPF adds that separately.
function opexParts(inp){
  const rows=inp&&inp.opexItems;
  if(!Array.isArray(rows))return{
    fixed:(inp&&inp.propertyTax||0)+(inp&&inp.insurance||0)+(inp&&inp.maintenance||0)
      +(inp&&inp.utilities||0)+(inp&&inp.reserves||0)+(inp&&inp.administrative||0),
    pctRate:0};
  const gpi=getGPI(inp);
  const egi=gpi*(1-lossRate(inp))+getOtherIncome(inp);
  let fixed=0,pctRate=0;
  for(const r of rows){
    if(!r||typeof r!=='object')continue;
    if(r.basis==='pctEGI'){const v=+r.amount;if(isFinite(v))pctRate+=v/100;}
    else fixed+=resolveLine(r,inp&&inp.numUnits,egi);
  }
  return{fixed,pctRate};
}
// Physical vacancy and credit loss are different things and get argued over
// separately, so they are entered separately. Both come off gross potential
// income. A deal saved before the split carries only vacancyRate, and credit
// loss reads as zero, so it computes exactly as it did.
function lossRate(inp){
  const v=+(inp&&inp.vacancyRate);
  const c=+(inp&&inp.creditLossRate);
  return ((isFinite(v)?v:0)+(isFinite(c)?c:0))/100;
}
function getOpEx(inp){
  const gpi=getGPI(inp);
  const egi=gpi*(1-lossRate(inp))+getOtherIncome(inp);
  const mgmt=egi*(inp.managementFeePct||0)/100;
  const itemised=opexItemsTotal(inp,egi);
  if(itemised!==null)return itemised+mgmt;
  return(inp.propertyTax||0)+(inp.insurance||0)+mgmt+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
}
// A development budget is a list of lines, not a blended dollar-per-foot. One
// hard cost figure is fine for a napkin and useless the moment anyone asks what
// is in it — sitework, shell, MEP and finishes are quoted separately, by
// different trades, in different units. Same rule as operating expenses: a list
// wins when present, and the two legacy fields still compute exactly as they
// did for every deal saved before this existed.
//   hard : amount | perSF | perUnit
//   soft : amount | perSF | perUnit | pctHard
// A share of hard cost is offered only on soft lines — contingency and fees are
// quoted that way, and on a hard line it would be a share of itself.
function resolveCostLine(r,sf,units,hard){
  if(!r||typeof r!=='object')return 0;
  const v=+r.amount;
  if(!isFinite(v))return 0;
  const s=isFinite(+sf)?+sf:0;
  const u=isFinite(+units)?+units:0;
  const h=isFinite(+hard)?+hard:0;
  switch(r.basis){
    case'perSF':return v*s;
    case'perUnit':return v*u;
    case'pctHard':return h*v/100;
    default:return v;
  }
}
function costListTotal(rows,sf,units,hard){
  if(!Array.isArray(rows))return null;
  let t=0;
  for(const r of rows)t+=resolveCostLine(r,sf,units,hard);
  // Present but empty is a budget the user cleared, which is zero — not an
  // instruction to go and read the old fields.
  return isFinite(t)?t:0;
}
function getHardCost(inp){
  const listed=costListTotal(inp&&inp.hardCostItems,inp&&inp.grossBuildableSF,inp&&inp.numUnits,0);
  if(listed!==null)return listed;
  return((inp&&inp.grossBuildableSF)||0)*((inp&&inp.hardCostPerSF)||0);
}
// Soft costs need the hard total before they can resolve, because the way most
// of them are quoted is as a percentage of it.
function getSoftCost(inp,hard){
  const h=isFinite(+hard)?+hard:0;
  const listed=costListTotal(inp&&inp.softCostItems,inp&&inp.grossBuildableSF,inp&&inp.numUnits,h);
  if(listed!==null)return listed;
  return h*((inp&&inp.softCostsPct)||0)/100;
}
function getDevCost(inp){
  const hard=getHardCost(inp);
  const soft=getSoftCost(inp,hard);
  const devFee=(inp&&inp.developerFee)||0;
  const land=(inp&&inp.landCost)||(inp&&inp.purchasePrice)||0;
  return land+hard+soft+devFee;
}
// A renovation budget is a one-time scope you finish, and it is emphatically
// not the annual CapEx reserve: the reserve recurs and grows for the whole
// hold, so putting a $600K unit-turn programme there charges it every year.
// Quoted the way a scope is quoted -- lump sum, per unit, per SF -- and offered
// only on acquisitions. Development and affordable deals already carry a full
// hard/soft budget, and a second one would double-count the same work.
function getRehab(inp){
  const t=((inp&&inp.assetType)||'').toLowerCase();
  if(t==='development'||t==='affordable')return 0;
  const sf=(inp&&inp.totalSF)||(inp&&inp.grossBuildableSF)||0;
  const listed=costListTotal(inp&&inp.rehabItems,sf,inp&&inp.numUnits,0);
  return listed===null?0:listed;
}
// Cash rehab spread over the months it is actually spent. Money that leaves
// your pocket in month 18 is not money you put in at close, and across a
// seven-year hold that timing is worth real IRR. Index 0 is spend at close;
// index y is spend during year y, so months 1-12 land in year 1.
const REHAB_MAX_MONTHS=60;
function rehabSchedule(inp,cashTotal){
  const out=new Array(PF_YEARS+1).fill(0);
  if(!(cashTotal>0))return out;
  const raw=+((inp&&inp.rehabMonths))||0;
  const months=Math.max(0,Math.min(raw,REHAB_MAX_MONTHS));
  if(months<=0){out[0]=cashTotal;return out;}
  const perMonth=cashTotal/months;
  for(let m=1;m<=months;m++){
    const yr=Math.min(Math.ceil(m/12),PF_YEARS);
    out[yr]+=perMonth;
  }
  return out;
}

export{umGPI,rtGPI,getGPI,projectedRevenue,getOpEx,getDevCost,getHardCost,getSoftCost,opexItemsTotal,opexParts,getOtherIncome,listTotal,resolveLine,resolveCostLine,costListTotal,resolveCapex,lossRate,getRehab,rehabSchedule,REHAB_MAX_MONTHS};
