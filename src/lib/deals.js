import{sb}from'./supabase.js';
// ─── SAVED DEALS (Supabase + localStorage fallback) ───────────────────────
const DEALS_KEY='proforma_saved_deals';
function loadDealsLocal(){try{return JSON.parse(localStorage.getItem(DEALS_KEY)||'[]');}catch(e){return[];}}
function saveDealsLocal(d){try{localStorage.setItem(DEALS_KEY,JSON.stringify(d));}catch(e){}}
function normalizeDeal(r){return{id:r.id,name:r.name,assetType:r.asset_type||r.assetType,savedAt:r.saved_at||r.savedAt,inp:r.inp_data||r.inp,summary:r.summary,notes:r.notes||''};}
async function loadDeals(user){
  if(user){const{data,error}=await sb.from('deals').select('*').order('saved_at',{ascending:false});if(!error&&data)return data.map(normalizeDeal);}
  return loadDealsLocal();
}
async function deleteDeal(id,user){
  if(user){await sb.from('deals').delete().eq('id',id);}
  else{saveDealsLocal(loadDealsLocal().filter(x=>x.id!==id));}
}
function dealSummary(res,inp){
  const isAff=(inp.assetType||'').toLowerCase()==='affordable';
  return isAff?{
    type:'affordable',
    irr:null,em:null,
    equity:res.lihtc?res.lihtc.lihtcEquity:0,
    dscr:res.sum.dscr,
    uses:res.lihtc?res.lihtc.totalUses:0,
    gap:res.lihtc?res.lihtc.fundingGap:0
  }:{
    type:'standard',
    irr:res.ret.irr,em:res.ret.em,dscr:res.sum.dscr,
    equity:res.equity,coc:res.sum.coc,capR:res.sum.capR,
    proceeds:res.exit.proceeds
  };
}
async function persistDeal(inp,res,user,opts){
  opts=opts||{};
  const entry={
    id:opts.id||('d'+Date.now()),
    name:opts.name||inp.propertyName||'Untitled Deal',
    assetType:inp.assetType,
    savedAt:new Date().toISOString(),
    inp:JSON.parse(JSON.stringify(inp)),
    summary:dealSummary(res,inp),
    notes:inp.dealNotes||''
  };
  if(user){
    if(opts.id){
      // update in place; leave notes untouched
      const{error}=await sb.from('deals').update({name:entry.name,asset_type:entry.assetType,saved_at:entry.savedAt,inp_data:entry.inp,summary:entry.summary}).eq('id',entry.id);
      if(error)throw new Error(error.message);
    }else{
      const{error}=await sb.from('deals').insert({id:entry.id,user_id:user.id,name:entry.name,asset_type:entry.assetType,saved_at:entry.savedAt,inp_data:entry.inp,summary:entry.summary,notes:entry.notes});
      if(error)throw new Error(error.message);
    }
  } else {
    const deals=loadDealsLocal();
    const old=deals.find(d=>d.id===entry.id);
    if(old)entry.notes=old.notes||'';
    const rest=deals.filter(d=>d.id!==entry.id);
    rest.unshift(entry);
    saveDealsLocal(rest);
  }
  return entry.id;
}
async function migrateLocalDeals(user){
  const local=loadDealsLocal();
  if(!local.length)return 0;
  const rows=local.map(d=>({id:d.id,user_id:user.id,name:d.name||'Untitled Deal',asset_type:d.assetType,saved_at:d.savedAt||new Date().toISOString(),inp_data:d.inp,summary:d.summary,notes:d.notes||''}));
  const{error}=await sb.from('deals').upsert(rows);
  if(error)throw new Error(error.message);
  localStorage.removeItem(DEALS_KEY);
  return rows.length;
}
async function updateDealNotes(id,notes,user){
  if(user){await sb.from('deals').update({notes}).eq('id',id);}
  else{const d=loadDealsLocal();const x=d.find(r=>r.id===id);if(x){x.notes=notes;saveDealsLocal(d);}}
}

export{DEALS_KEY,loadDealsLocal,saveDealsLocal,normalizeDeal,loadDeals,deleteDeal,dealSummary,persistDeal,migrateLocalDeals,updateDealNotes};
