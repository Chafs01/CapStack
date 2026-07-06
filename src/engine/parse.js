import Papa from'papaparse';
import*as XLSX from'xlsx';
import{pn}from'./format.js';
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

export{parseFile,extractFields,normalizeUnitType,extractRentRoll};
