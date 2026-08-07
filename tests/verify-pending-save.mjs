import{
  storePendingSave,loadPendingSave,clearPendingSave,PENDING_SAVE_KEY,
}from'../src/lib/pendingSave.js';

let failures=0;
const check=(label,ok,detail='')=>{
  if(ok)console.log('  PASS',label);
  else{failures++;console.log('  FAIL',label,detail);}
};

const store=new Map();
globalThis.localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k),
};

console.log('an explicit save request survives an authentication redirect:');
{
  const inp={assetType:'Multifamily',propertyName:'',purchasePrice:1250000,unitMix:[{type:'2BR',count:8,rent:1800}]};
  const pending=storePendingSave(inp,'Oak Street');
  inp.purchasePrice=1; // storage must hold a snapshot, not the mutable object
  const back=loadPendingSave();
  check('the chosen deal name round-trips',back&&back.name==='Oak Street');
  check('the save gets a stable id for safe retries',back&&back.id===pending.id&&/^d\d+_[a-z0-9]+$/.test(back.id));
  check('the finished inputs round-trip',back&&back.inp.purchasePrice===1250000);
  check('nested inputs are preserved',back&&back.inp.unitMix[0].count===8);
  check('the returned pending object is also a snapshot',pending.inp.purchasePrice===1250000);
}

console.log('\nfalling back to the property name:');
{
  store.clear();
  storePendingSave({assetType:'Commercial',propertyName:'Market Center'},'');
  check('a blank modal name uses the property name',loadPendingSave()?.name==='Market Center');
}

console.log('\nclearing after the cloud save:');
{
  clearPendingSave();
  check('the request is gone',loadPendingSave()===null);
  check('the storage key is removed',!store.has(PENDING_SAVE_KEY));
}

console.log('\nmalformed and stale requests never auto-save:');
const bad={
  'malformed JSON':'{',
  'wrong version':JSON.stringify({v:9,at:Date.now(),inp:{purchasePrice:1}}),
  'missing inputs':JSON.stringify({v:1,at:Date.now()}),
  'array inputs':JSON.stringify({v:1,at:Date.now(),inp:[]}),
  'expired request':JSON.stringify({v:1,at:Date.now()-1000*60*60*24*8,inp:{purchasePrice:1}}),
};
for(const[label,raw]of Object.entries(bad)){
  store.set(PENDING_SAVE_KEY,raw);
  check(`ignores ${label}`,loadPendingSave()===null);
  check(`purges ${label}`,!store.has(PENDING_SAVE_KEY));
}

console.log('\nstorage failure does not block the in-memory handoff:');
{
  globalThis.localStorage={
    getItem:()=>{throw new Error('denied');},
    setItem:()=>{throw new Error('quota');},
    removeItem:()=>{throw new Error('denied');},
  };
  let pending=null,threw=null;
  try{pending=storePendingSave({purchasePrice:7},'Unsaved');}catch(e){threw=e.message;}
  check('no storage exception escapes',threw===null,threw||'');
  check('the current-page save can still continue',pending&&pending.inp.purchasePrice===7);
  check('loading unavailable storage returns null',loadPendingSave()===null);
}

if(failures){console.log(`\n${failures} FAILURE(S) — save-after-auth regressed.`);process.exit(1);}
console.log('\nSave-after-auth survives redirects without saving stale or malformed data.');
