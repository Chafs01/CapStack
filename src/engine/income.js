// Income & cost assembly from deal inputs.
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
// Capital expenditure is quoted three ways in practice: a budget for the year,
// a reserve per unit per year (the common multifamily convention, e.g. $300/unit),
// or a share of effective gross income. The stored number means whichever the
// basis says, so switching basis reinterprets it rather than silently keeping
// a figure that no longer means anything.
function resolveCapex(inp,egi,expenseFactor){
  const v=+(inp&&inp.capexAnnual);
  if(!isFinite(v)||v===0)return 0;
  const basis=(inp&&inp.capexBasis)||'amount';
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

export{umGPI,rtGPI,getGPI,getOpEx,getDevCost,getHardCost,getSoftCost,opexItemsTotal,getOtherIncome,listTotal,resolveLine,resolveCostLine,costListTotal,resolveCapex,lossRate};
