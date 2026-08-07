import{sb}from'./supabase.js';
import{DEALS_KEY,isDealLike,loadDealsLocal,saveDealsLocal}from'./dealStore.js';
// ─── SAVED DEALS (Supabase + localStorage fallback) ───────────────────────

function normalizeDeal(r){return{id:r.id,name:r.name,assetType:r.asset_type||r.assetType,savedAt:r.saved_at||r.savedAt,inp:r.inp_data||r.inp,summary:r.summary,notes:r.notes||''};}
async function loadDeals(user){
  if(user&&sb){
    try{
      const{data,error}=await sb.from('deals').select('*').order('saved_at',{ascending:false});
      if(error)throw error;
      return (data||[]).map(normalizeDeal).filter(isDealLike);
    }catch(e){
      // A signed-in user's source of truth is the cloud. Falling back to an
      // unrelated browser list makes a network failure look like cloud deals
      // vanished, which is much more alarming than an honest load error.
      throw new Error((e&&e.message)||'Could not load your saved deals.');
    }
  }
  return loadDealsLocal();
}
async function renameDeal(id,name,user){
  if(user&&sb){
    const{error}=await sb.from('deals').update({name}).eq('id',id);
    if(error)throw new Error(error.message);
  }else{
    const d=loadDealsLocal();const x=d.find(r=>r.id===id);
    if(x){x.name=name;saveDealsLocal(d);}
  }
}
async function deleteDeal(id,user){
  if(user&&sb){
    const{error}=await sb.from('deals').delete().eq('id',id);
    if(error)throw new Error(error.message);
  }
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
  if(user&&sb){
    if(opts.id&&!opts.create){
      // update in place; leave notes untouched
      const{error}=await sb.from('deals').update({name:entry.name,asset_type:entry.assetType,saved_at:entry.savedAt,inp_data:entry.inp,summary:entry.summary}).eq('id',entry.id);
      if(error)throw new Error(error.message);
    }else{
      const row={id:entry.id,user_id:user.id,name:entry.name,asset_type:entry.assetType,
        saved_at:entry.savedAt,inp_data:entry.inp,summary:entry.summary,notes:entry.notes};
      // Save-after-auth carries a stable id through redirects. Upsert makes a
      // lost response safe to retry without creating a duplicate deal.
      const q=opts.create?sb.from('deals').upsert(row,{onConflict:'id'}):sb.from('deals').insert(row);
      const{error}=await q;
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
// Puts a deleted deal back exactly as it was — same id, same saved date, same
// notes — so Undo restores the row rather than creating a lookalike. persistDeal
// cannot do this: it stamps a new savedAt and drops notes on the update path.
async function restoreDeal(entry,user){
  if(!entry||!entry.id)return;
  if(user&&sb){
    const{error}=await sb.from('deals').insert({id:entry.id,user_id:user.id,name:entry.name,
      asset_type:entry.assetType,saved_at:entry.savedAt,inp_data:entry.inp,
      summary:entry.summary,notes:entry.notes||''});
    if(error)throw new Error(error.message);
    return;
  }
  const deals=loadDealsLocal().filter(d=>d.id!==entry.id);
  deals.unshift(entry);
  saveDealsLocal(deals);
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
  if(user&&sb){
    const{error}=await sb.from('deals').update({notes}).eq('id',id);
    if(error)throw new Error(error.message);
  }
  else{const d=loadDealsLocal();const x=d.find(r=>r.id===id);if(x){x.notes=notes;saveDealsLocal(d);}}
}

export{DEALS_KEY,isDealLike,loadDealsLocal,saveDealsLocal,normalizeDeal,loadDeals,renameDeal,deleteDeal,restoreDeal,dealSummary,persistDeal,migrateLocalDeals,updateDealNotes};
