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
function listTotal(rows){
  if(!Array.isArray(rows))return null;
  let t=0,any=false;
  for(const r of rows){
    if(!r||typeof r!=='object')continue;
    const v=+r.amount;
    if(isFinite(v)&&v!==0)any=true;
    t+=isFinite(v)?v:0;
  }
  return any?t:(rows.length?0:null);
}
function getOtherIncome(inp){
  const listed=listTotal(inp&&inp.otherIncomeItems);
  if(listed!==null)return listed;
  const v=+(inp&&inp.otherIncome);
  return isFinite(v)?v:0;
}
function opexItemsTotal(inp){
  if(!Array.isArray(inp.opexItems))return null;
  let t=0,any=false;
  for(const r of inp.opexItems){
    if(!r||typeof r!=='object')continue;
    const v=+r.amount;
    if(isFinite(v)&&v!==0)any=true;
    t+=isFinite(v)?v:0;
  }
  return any?t:(inp.opexItems.length?0:null);
}
function getOpEx(inp){
  const gpi=getGPI(inp);
  const vac=inp.vacancyRate||0;
  const egi=gpi*(1-vac/100)+getOtherIncome(inp);
  const mgmt=egi*(inp.managementFeePct||0)/100;
  const itemised=opexItemsTotal(inp);
  if(itemised!==null)return itemised+mgmt;
  return(inp.propertyTax||0)+(inp.insurance||0)+mgmt+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
}
function getDevCost(inp){
  const hard=(inp.grossBuildableSF||0)*(inp.hardCostPerSF||0);
  const soft=hard*(inp.softCostsPct||0)/100;
  const devFee=inp.developerFee||0;
  return(inp.landCost||inp.purchasePrice||0)+hard+soft+devFee;
}

export{umGPI,rtGPI,getGPI,getOpEx,getDevCost,opexItemsTotal,getOtherIncome,listTotal};
