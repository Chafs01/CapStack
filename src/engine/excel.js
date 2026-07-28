import{f}from'./format.js';
import{getDevCost}from'./income.js';
import{buildPF}from'./buildPF.js';
import{calcWaterfall}from'./waterfall.js';
import{calcAfterTax}from'./afterTax.js';
// ─── EXCEL EXPORT ────────────────────────────────────────────────────────
// ExcelJS is ~1MB and only needed when someone actually exports, so it loads
// on demand instead of shipping with the initial page.
async function buildWorkbook(res,inp,withResults=true){
  const mod=await import('exceljs');
  const E=mod.default||mod;
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const t=(inp.assetType||'').toLowerCase();
  const isDev=t==='development';
  // sales-comp exit prices per unit and appreciates; income exit uses the cap
  const isPPU=inp.exitMethod==='ppu';
  const exPPU=inp.exitPPU||0, exAppr=(inp.apprRate!=null?inp.apprRate:3)/100;
  const name=inp.propertyName||'Untitled Property';
  const wb=new E.Workbook();
  wb.creator='SmartCapStack';wb.created=new Date();

  const NAVY='FF181716',NAVY2='FF3A3733',HDR='FFEAE6DD',BAND='FFF3EFE8',WHITE='FFFFFFFF',FWDBG='FFEFECE4';
  const GREENBG='FFE2EFDA',AMBERBG='FFFFF2CC',REDBG='FFFBE0DE';
  const thin={style:'thin',color:{argb:'FFD0D0D0'}};
  const box={top:thin,left:thin,bottom:thin,right:thin};
  const boxT={top:{style:'thin',color:{argb:'FF181716'}},left:thin,bottom:thin,right:thin};
  const F$='$#,##0';const F$N='$#,##0;($#,##0)';const FP='0.0%';const FP2='0.00%';const FX='0.00"x"';const FN='#,##0';
  const fill=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}});
  const lblF={name:'Calibri',size:10,color:{argb:'FF333333'}};
  const inpF={name:'Calibri',size:10,bold:true,color:{argb:'FF0070C0'}};
  const fmlF={name:'Calibri',size:10,bold:true,color:{argb:'FF1F1F1F'}};
  const CL=i=>String.fromCharCode(64+i);
  const fml=(f,r)=>withResults&&isFinite(r)?{formula:f,result:r}:{formula:f};

  const banner=(ws,row,c1,c2,text,sub)=>{
    ws.mergeCells(row,c1,row,c2);
    Object.assign(ws.getCell(row,c1),{value:text,font:{name:'Calibri',size:14,bold:true,color:{argb:WHITE}},fill:fill(NAVY),alignment:{vertical:'middle',horizontal:'left',indent:1}});
    ws.getRow(row).height=27;
    ws.mergeCells(row+1,c1,row+1,c2);
    Object.assign(ws.getCell(row+1,c1),{value:sub,font:{name:'Calibri',size:9.5,italic:true,color:{argb:WHITE}},fill:fill(NAVY2),alignment:{vertical:'middle',horizontal:'left',indent:1}});
    ws.getRow(row+1).height=16;
  };

  // ============ SUMMARY ============
  const ws=wb.addWorksheet('Summary',{views:[{showGridLines:false}]});
  ws.columns=[{width:2},{width:28},{width:15},{width:2.5},{width:28},{width:15},{width:2}];
  banner(ws,2,2,6,name.toUpperCase(),`${inp.assetType} Investment Analysis  |  ${hp}-Year Hold  |  Blue cells are inputs, black cells are live formulas  |  Prepared ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`);

  let rL=5,rR=5;
  const refs={};
  // entry: [key|null, label, value|{f,r}, fmt, isInput]
  const block=(side,title,entries)=>{
    const c1=side==='L'?2:5,c2=c1+1;
    let r=side==='L'?rL:rR;
    ws.mergeCells(r,c1,r,c2);
    Object.assign(ws.getCell(r,c1),{value:title,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF181716'}},fill:fill(HDR),alignment:{vertical:'middle',indent:1},border:box});
    ws.getRow(r).height=17;r++;
    entries.forEach((e,i)=>{
      const[key,label,val,fm,isInput]=e;
      const cl=ws.getCell(r,c1),cv=ws.getCell(r,c2);
      cl.value=label;cl.font=lblF;cl.border=box;cl.alignment={indent:1};
      if(val&&typeof val==='object'&&val.f!==undefined){cv.value=fml(val.f,val.r);}else{cv.value=val;}
      cv.font=isInput?inpF:fmlF;cv.border=box;cv.alignment={horizontal:'right'};
      if(fm)cv.numFmt=fm;
      if(i%2===1){cl.fill=fill(BAND);cv.fill=fill(BAND);}
      if(key)refs[key]='Summary!$'+CL(c2)+'$'+r;
      r++;
    });
    r++;
    if(side==='L')rL=r;else rR=r;
  };

  // engine-derived values for caching
  const R0=res.rows[0];
  const gpi1=R0.gpi, oth1=R0.egi-(R0.gpi-R0.vacL);
  const baseExM=R0.opex-R0.mgmt;
  const basisVal=isDev?getDevCost(inp):(inp.purchasePrice||0);
  const LA=inp.loanAmount||0, IR=(inp.interestRate||0)/100, AY=inp.amortYears||30, IO=inp.ioPeriod||0;
  const ltvVal=basisVal>0?LA/basisVal:0;
  const sizeLine=isDev?[null,'Gross Buildable SF',inp.grossBuildableSF||0,FN,true]:(t==='commercial'?[null,'Total SF',inp.totalSF||0,FN,true]:['units','Units',inp.numUnits||0,FN,true]);

  const pdRows=[
    [null,'Asset Type',inp.assetType,null,true],sizeLine,
    ['price',isDev?'Land Cost':'Purchase Price',inp.purchasePrice||0,F$,true],
  ];
  if(isDev)pdRows.push(['basis','Total Development Cost (incl. land)',basisVal,F$,true]);
  block('L','PROPERTY & DEAL',pdRows.concat([
    ['acq','Acquisition Costs',{f:'0',r:0},F$,false],
    ['fees','Loan Fees',{f:'X',r:0},F$,false],
    ['tcap','Total Capitalization',{f:'X',r:res.totalCost},F$,false],
    ['hold','Holding Period (Years)',hp,FN,true],
  ].concat(isPPU
    ?[['ppu','Exit Price per Unit (comp)',exPPU,F$,true],
      ['appr','Annual Appreciation',exAppr,FP,true]]
    :[['ecap','Exit Cap Rate',(inp.exitCapRate||0)/100,FP2,true]])
   .concat([['sell','Selling Costs',(inp.sellingCostsPct||0)/100,FP,true]])));
  if(!isDev)refs.basis=refs.price;
  block('L','FINANCING',[
    ['loan','Loan Amount',LA,F$,true],
    ['ltv',isDev?'Loan-to-Cost':'Loan-to-Value',{f:'X',r:ltvVal},FP,false],
    ['rate','Interest Rate',IR,FP2,true],
    ['amort','Amortization (Years)',AY,FN,true],
    ['io','Interest-Only Period (Years)',IO,FN,true],
    ['eq','Equity Required',{f:'X',r:res.equity},F$,false],
  ]);
  block('L','MODEL ASSUMPTIONS',[
    ['gpi1','Gross Potential Income (Yr 1)',Math.round(gpi1),F$,true],
    ['oth1','Other Income (Yr 1)',Math.round(oth1),F$,true],
    ['vac','Vacancy & Credit Loss',(inp.vacancyRate||0)/100,FP,true],
    ['exm','OpEx excl. Mgmt (Yr 1)',Math.round(baseExM),F$,true],
    ['mgmt','Management Fee (% of EGI)',(inp.managementFeePct||0)/100,FP,true],
    ['rg','Revenue Growth (Annual)',(inp.revenueGrowth||0)/100,FP,true],
    ['eg','Expense Growth (Annual)',(inp.expenseGrowth||0)/100,FP,true],
    ['acqp','Acquisition Costs (% of Price)',(inp.acquisitionCostsPct||0)/100,FP,true],
    ['feep','Loan Fees (% of Loan)',(inp.loanFeesPct||0)/100,FP,true],
    ['disc','Discount Rate (NPV)',(inp.discountRate||0)/100,FP,true],
  ]);
  // wire left-side formulas now that refs exist
  const setRef=(key,f,r,fmt)=>{const a=refs[key].replace('Summary!','').replace(/\$/g,'');const c=ws.getCell(a);c.value=fml(f,r);if(fmt)c.numFmt=fmt;};
  setRef('acq',`${refs.price}*${refs.acqp}`,res.acqC);
  setRef('fees',`${refs.loan}*${refs.feep}`,res.LF);
  setRef('tcap',`${refs.basis}+${refs.acq}+${refs.fees}`,res.totalCost);
  setRef('ltv',`IF(${refs.basis}=0,0,${refs.loan}/${refs.basis})`,ltvVal);
  setRef('eq',`${refs.tcap}-${refs.loan}`,res.equity);

  // ============ ANNUAL PRO FORMA (formula-driven) ============
  const pf=wb.addWorksheet('Annual Pro Forma',{views:[{showGridLines:false,state:'frozen',xSplit:2,ySplit:3}]});
  const fwdC=4+hp; // col index of forward year
  pf.columns=[{width:2},{width:30},{width:12}].concat(Array.from({length:hp+1},()=>({width:13})));
  pf.mergeCells(2,2,2,fwdC);
  Object.assign(pf.getCell(2,2),{value:name.toUpperCase()+'  |  '+hp+'-YEAR OPERATING PRO FORMA (LIVE FORMULAS)',font:{name:'Calibri',size:12,bold:true,color:{argb:WHITE}},fill:fill(NAVY),alignment:{vertical:'middle',indent:1}});
  pf.getRow(2).height=24;
  const hr=pf.getRow(3);
  for(let c=2;c<=fwdC;c++){
    const cell=hr.getCell(c);
    cell.value=c===2?'':(c===3?'Year 0':(c===fwdC?`Yr ${hp+1} (Fwd)`:'Year '+(c-3)));
    cell.font={name:'Calibri',size:10,bold:true,color:{argb:WHITE}};
    cell.fill=fill(NAVY2);cell.border=box;cell.alignment={horizontal:c===2?'left':'right'};
  }
  hr.height=17;
  let pr=4;
  const rowIdx={};
  const sect=ttl=>{
    pf.mergeCells(pr,2,pr,fwdC);
    Object.assign(pf.getCell(pr,2),{value:ttl,font:{name:'Calibri',size:9.5,bold:true,color:{argb:'FF181716'}},fill:fill(HDR),alignment:{indent:1},border:box});
    pf.getRow(pr).height=16;pr++;
  };
  // cells: array over columns 3..fwdC; entry null=blank, number=value, {f,r}=formula
  const line=(key,label,cells,fm,opts)=>{
    opts=opts||{};
    const row=pf.getRow(pr);
    const cl=row.getCell(2);
    cl.value=label;cl.border=opts.total?boxT:box;cl.alignment={indent:opts.total?1:2};
    cl.font={name:'Calibri',size:10,bold:!!opts.total,color:{argb:opts.total?'FF1F3864':'FF333333'}};
    cells.forEach((v,i)=>{
      const c=row.getCell(3+i);
      c.border=opts.total?boxT:box;c.alignment={horizontal:'right'};
      c.font={name:'Calibri',size:10,bold:!!opts.total,color:{argb:opts.total?'FF1F3864':'FF333333'}};
      if(3+i===fwdC&&!opts.noFwdShade)c.fill=fill(FWDBG);
      if(v===null||v===undefined)return;
      if(typeof v==='object'){c.value=fml(v.f,v.r);}else{c.value=v;}
      if(fm)c.numFmt=fm;
    });
    if(key)rowIdx[key]=pr;
    pr++;
  };
  const ER=res.rows; // engine rows, 11 entries
  // helper builders: yr = 1..hp+1 maps to col 3+yr; prev col letter
  const yrs=Array.from({length:hp+1},(_,i)=>i+1); // includes forward year
  const colOf=yr=>CL(3+yr);
  const opsRow=(key,label,firstF,firstR,growF,vals,fm,opts)=>{
    const cells=[null].concat(yrs.map(yr=>{
      if(yr===1)return{f:firstF,r:firstR};
      const p=colOf(yr-1)+rowIdx_pending(key);
      return{f:growF(yr,p),r:vals(yr)};
    }));
    line(key,label,cells,fm,opts);
  };
  // since rowIdx[key] not known until line() called, we compute target row = pr at call time:
  function rowIdx_pending(){return pr;}

  sect('REVENUE');
  opsRow('gpi','Gross Potential Income',`${refs.gpi1}`,gpi1,(yr,p)=>`${p}*(1+${refs.rg})`,yr=>ER[yr-1].gpi,F$);
  line('vac','Less: Vacancy & Credit Loss',[null].concat(yrs.map(yr=>({f:`-${colOf(yr)}${rowIdx.gpi}*${refs.vac}`,r:-ER[yr-1].vacL}))),F$N);
  opsRow('oth','Plus: Other Income',`${refs.oth1}`,oth1,(yr,p)=>`${p}*(1+${refs.rg})`,yr=>oth1*Math.pow(1+(inp.revenueGrowth||0)/100,yr-1),F$);
  line('egi','Effective Gross Income',[null].concat(yrs.map(yr=>({f:`${colOf(yr)}${rowIdx.gpi}+${colOf(yr)}${rowIdx.vac}+${colOf(yr)}${rowIdx.oth}`,r:ER[yr-1].egi}))),F$,{total:true});
  sect('OPERATING EXPENSES');
  opsRow('exm','OpEx excl. Management',`-${refs.exm}`,-baseExM,(yr,p)=>`${p}*(1+${refs.eg})`,yr=>-(baseExM*Math.pow(1+(inp.expenseGrowth||0)/100,yr-1)),F$N);
  line('mgmt','Management Fee',[null].concat(yrs.map(yr=>({f:`-${colOf(yr)}${rowIdx.egi}*${refs.mgmt}`,r:-ER[yr-1].mgmt}))),F$N);
  line('opx','Total Operating Expenses',[null].concat(yrs.map(yr=>({f:`${colOf(yr)}${rowIdx.exm}+${colOf(yr)}${rowIdx.mgmt}`,r:-ER[yr-1].opex}))),F$N,{total:true});
  line('noi','Net Operating Income',[null].concat(yrs.map(yr=>({f:`${colOf(yr)}${rowIdx.egi}+${colOf(yr)}${rowIdx.opx}`,r:ER[yr-1].noi}))),F$,{total:true});
  sect('DEBT SERVICE');
  const dsF=yr=>`-IF(${refs.loan}=0,0,IF(${yr}<=${refs.io},${refs.loan}*${refs.rate},IF(${refs.rate}=0,${refs.loan}/${refs.amort},${refs.loan}*${refs.rate}/12/(1-(1+${refs.rate}/12)^(-${refs.amort}*12))*12)))`;
  line('ds','Annual Debt Service',[null].concat(yrs.map(yr=>yr<=hp?{f:dsF(yr),r:-ER[yr-1].ds}:null)),F$N);
  line('cfbt','Cash Flow Before Tax',[null].concat(yrs.map(yr=>yr<=hp?{f:`${colOf(yr)}${rowIdx.noi}+${colOf(yr)}${rowIdx.ds}`,r:ER[yr-1].cfbt}:null)),F$,{total:true});
  sect('RATIOS & BALANCES');
  line('cap','Cap Rate',[null].concat(yrs.map(yr=>yr<=hp?{f:`${colOf(yr)}${rowIdx.noi}/${refs.basis}`,r:ER[yr-1].capR}:null)),FP2);
  line('coc','Cash-on-Cash Return',[null].concat(yrs.map(yr=>yr<=hp?{f:`IF(${refs.eq}=0,0,${colOf(yr)}${rowIdx.cfbt}/${refs.eq})`,r:ER[yr-1].coc}:null)),FP2);
  line('dscr','DSCR',[null].concat(yrs.map(yr=>yr<=hp?{f:`IF(${colOf(yr)}${rowIdx.ds}=0,"N/A",${colOf(yr)}${rowIdx.noi}/(-${colOf(yr)}${rowIdx.ds}))`,r:ER[yr-1].dscr||NaN}:null)),FX);
  const balF=yr=>`IF(${refs.loan}=0,0,IF(${yr}<=${refs.io},${refs.loan},IF(${refs.rate}=0,MAX(0,${refs.loan}-${refs.loan}/(${refs.amort}*12)*((${yr}-${refs.io})*12)),MAX(0,${refs.loan}*(1+${refs.rate}/12)^((${yr}-${refs.io})*12)-(${refs.loan}*${refs.rate}/12/(1-(1+${refs.rate}/12)^(-${refs.amort}*12)))*((1+${refs.rate}/12)^((${yr}-${refs.io})*12)-1)/(${refs.rate}/12)))))`;
  line('bal','Ending Loan Balance',[null].concat(yrs.map(yr=>yr<=hp?{f:balF(yr),r:ER[yr-1].bal}:null)),F$);
  sect('LEVERED INVESTMENT CASH FLOWS');
  line('init','Initial Equity Investment',[{f:`-${refs.eq}`,r:-res.equity}].concat(yrs.map(()=>null)),F$N);
  line('opcf','Operating Cash Flow',[null].concat(yrs.map(yr=>yr<=hp?{f:`${colOf(yr)}${rowIdx.cfbt}`,r:ER[yr-1].cfbt}:null)),F$N);
  line('sale','Net Sale Proceeds',[null].concat(yrs.map(yr=>yr<hp?0:(yr===hp?{f:'X',r:res.exit.proceeds}:null))),F$N);
  line('net','Levered Net Cash Flow',[{f:`C${rowIdx.init}`,r:-res.equity}].concat(yrs.map(yr=>yr<=hp?{f:`${colOf(yr)}${rowIdx.opcf}+${colOf(yr)}${rowIdx.sale}`,r:ER[yr-1].cfbt+(yr===hp?res.exit.proceeds:0)}:null)),F$N,{total:true});

  const PFQ="'Annual Pro Forma'!";
  const lastYr=colOf(hp), fwdL=CL(fwdC);

  // ============ SUMMARY right-side blocks (live formulas) ============
  block('R','RETURN SUMMARY',[
    [null,'Levered IRR',{f:`IRR(${PFQ}$C$${rowIdx.net}:$${lastYr}$${rowIdx.net})`,r:res.ret.irr},FP,false],
    [null,'Equity Multiple',{f:`IF(${refs.eq}=0,0,SUM(${PFQ}$D$${rowIdx.net}:$${lastYr}$${rowIdx.net})/${refs.eq})`,r:res.ret.em},FX,false],
    [null,'Net Present Value',{f:`${PFQ}$C$${rowIdx.net}+NPV(${refs.disc},${PFQ}$D$${rowIdx.net}:$${lastYr}$${rowIdx.net})`,r:res.ret.npv},F$N,false],
    [null,'Total Profit',{f:`SUM(${PFQ}$C$${rowIdx.net}:$${lastYr}$${rowIdx.net})`,r:res.ret.profit},F$N,false],
    [null,'Year 1 Cash-on-Cash',{f:`${PFQ}$D$${rowIdx.coc}`,r:res.sum.coc},FP,false],
    [null,'Year 1 Cap Rate',{f:`${PFQ}$D$${rowIdx.cap}`,r:res.sum.capR},FP2,false],
    [null,'Year 1 DSCR',{f:`${PFQ}$D$${rowIdx.dscr}`,r:res.sum.dscr||NaN},FX,false],
    [null,'Break-Even Occupancy',{f:`IF(${PFQ}$D$${rowIdx.gpi}=0,0,(-${PFQ}$D$${rowIdx.opx}-${PFQ}$D$${rowIdx.ds})/${PFQ}$D$${rowIdx.gpi})`,r:res.sum.beOcc},FP,false],
  ]);
  block('R','EXIT ANALYSIS (YEAR '+hp+')',[
    ...(isPPU?[]:[['fnoi','Forward NOI (Year '+(hp+1)+')',{f:`${PFQ}$${fwdL}$${rowIdx.noi}`,r:res.rows[hp].noi},F$,false]]),
    ['gross','Gross Sale Price',{f:'X',r:res.exit.grossSale},F$,false],
    ['scost','Selling Costs',{f:'X',r:-res.exit.sellAmt},F$N,false],
    ['nsale','Net Sale Price',{f:'X',r:res.exit.netSale},F$,false],
    ['poff','Loan Payoff',{f:`-${PFQ}$${lastYr}$${rowIdx.bal}`,r:-res.exit.payoff},F$N,false],
    ['proc','Net Sale Proceeds',{f:'X',r:res.exit.proceeds},F$,false],
  ]);
  setRef('gross', isPPU
    ? `${refs.ppu}*${refs.units}*(1+${refs.appr})^${refs.hold}`
    : `IF(${refs.ecap}=0,0,${refs.fnoi}/${refs.ecap})`, res.exit.grossSale);
  setRef('scost',`-${refs.gross}*${refs.sell}`,-res.exit.sellAmt);
  setRef('nsale',`${refs.gross}+${refs.scost}`,res.exit.netSale);
  setRef('proc',`${refs.nsale}+${refs.poff}`,res.exit.proceeds);
  block('R','SOURCES & USES',[
    [null,'Senior Loan',{f:`${refs.loan}`,r:LA},F$,false],
    [null,'Sponsor Equity',{f:`${refs.eq}`,r:res.equity},F$,false],
    [null,'Total Sources',{f:`${refs.loan}+${refs.eq}`,r:res.totalCost},F$,false],
    [null,basisLblTxt(isDev),{f:`${refs.basis}`,r:basisVal},F$,false],
    [null,'Closing Costs & Fees',{f:`${refs.acq}+${refs.fees}`,r:res.acqC+res.LF},F$,false],
    [null,'Total Uses',{f:`${refs.tcap}`,r:res.totalCost},F$,false],
  ]);
  function basisLblTxt(d){return d?'Total Development Cost':'Purchase Price';}
  // wire the PF sale cell to Summary proceeds now that ref exists
  pf.getCell(rowIdx.sale,3+hp).value=fml(`${refs.proc}`,res.exit.proceeds);
  pf.getCell(rowIdx.sale,3+hp).numFmt=F$N;

  const fr=Math.max(rL,rR)+1;
  ws.mergeCells(fr,2,fr,6);
  Object.assign(ws.getCell(fr,2),{value:'Prepared with SmartCapStack. All outputs above are live Excel formulas; change any blue input cell and the model recalculates. Projections are estimates for informational purposes only and do not constitute investment advice.',font:{name:'Calibri',size:8.5,italic:true,color:{argb:'FF808080'}}});

  // ============ SENSITIVITY ============
  const sn=wb.addWorksheet('Sensitivity',{views:[{showGridLines:false}]});
  const growths=[1,2,3,4,5];
  // comp-priced deals have no exit cap to flex, so the column axis becomes the
  // comparable sale price per unit
  const caps=isPPU
    ?[0.85,0.925,1.0,1.075,1.15,1.225].map(m=>Math.round(exPPU*m/500)*500)
    :[4.5,5.0,5.5,6.0,6.5,7.0];
  const nC=caps.length, lastCol=2+nC;
  sn.columns=[{width:2},{width:22}].concat(caps.map(()=>({width:11})));
  banner(sn,2,2,lastCol,'LEVERED IRR SENSITIVITY','How the deal\'s levered IRR moves with revenue growth and '+(isPPU?'the comparable sale price per unit':'exit cap rate')+'. All other inputs held constant.');

  // Column-axis label band: EXIT CAP RATE -> spanning the cap columns
  sn.mergeCells(4,3,4,lastCol);
  Object.assign(sn.getCell(4,3),{value:(isPPU?'EXIT PRICE PER UNIT \u2192':'EXIT CAP RATE \u2192'),font:{name:'Calibri',size:9.5,bold:true,color:{argb:'FF181716'}},fill:fill(HDR),alignment:{horizontal:'center'},border:box});
  sn.getCell(4,2).border=box; sn.getCell(4,2).fill=fill(HDR);

  // Header row: corner label + editable cap values
  const sh=sn.getRow(5);
  Object.assign(sh.getCell(2),{value:'Rev Growth \u2193  /  '+(isPPU?'$ per Unit':'Exit Cap')+' \u2192',font:{name:'Calibri',size:9,bold:true,italic:true,color:{argb:WHITE}},fill:fill(NAVY2),border:box,alignment:{horizontal:'center',wrapText:true}});
  caps.forEach((c,i)=>{
    const cc=sh.getCell(3+i);
    cc.value=isPPU?c:c/100;cc.numFmt=isPPU?F$:FP2;
    Object.assign(cc,{font:{name:'Calibri',size:11,bold:true,color:{argb:'FF0070C0'}},fill:fill('FFEAF1FB'),border:box,alignment:{horizontal:'center'}});
  });
  sh.height=26;

  // Live IRR sensitivity: each grid cell is a real =IRR() over a hidden
  // per-scenario cash flow built from the editable axis cells + Summary inputs.
  const lr=6+growths.length+1;
  const CB=lr+4;                 // first row of the hidden calc block
  const noiF=(G,k)=>`(((${refs.gpi1}*(1-${refs.vac})+${refs.oth1})*(1+${G})^${k-1})*(1-${refs.mgmt})-${refs.exm}*(1+${refs.eg})^${k-1})`;
  const dsRef=k=>`'Annual Pro Forma'!${CL(3+k)}${rowIdx.ds}`;
  const balRef=`'Annual Pro Forma'!${CL(3+hp)}${rowIdx.bal}`;

  growths.forEach((g,gi)=>{
    const row=sn.getRow(6+gi);
    const lc=row.getCell(2);
    lc.value=g/100;lc.numFmt=FP;
    Object.assign(lc,{font:{name:'Calibri',size:11,bold:true,color:{argb:'FF0070C0'}},fill:fill('FFEAF1FB'),border:box,alignment:{horizontal:'center'}});
    const G=`$B$${6+gi}`;
    caps.forEach((c,ci)=>{
      const C=`${CL(3+ci)}$5`;
      const calcRow=CB+gi*nC+ci;
      sn.getCell(calcRow,2).value={formula:`-${refs.eq}`};
      sn.getCell(calcRow,2).numFmt=F$N;
      for(let k=1;k<=hp;k++){
        let fla=`${noiF(G,k)}+${dsRef(k)}`;
        if(k===hp){
          const sale=isPPU
            ?`${C}*${refs.units}*(1+${refs.appr})^${refs.hold}*(1-${refs.sell})-${balRef}`
            :`(${noiF(G,hp+1)})/${C}*(1-${refs.sell})-${balRef}`;
          fla=`${fla}+(${sale})`;
        }
        const cc=sn.getCell(calcRow,2+k);
        cc.value={formula:fla}; cc.numFmt=F$N;
      }
      const irrSnap=buildPF(Object.assign({},inp,{revenueGrowth:g},isPPU?{exitPPU:c}:{exitCapRate:c})).ret.irr;
      const rng=`B${calcRow}:${CL(2+hp)}${calcRow}`;
      const cell=row.getCell(3+ci);
      cell.value=isFinite(irrSnap)?{formula:`IRR(${rng})`,result:irrSnap}:{formula:`IRR(${rng})`};
      cell.numFmt=FP;cell.border=box;cell.alignment={horizontal:'center'};
      const bg=irrSnap>0.15?GREENBG:irrSnap>0.10?AMBERBG:REDBG;
      const fc=irrSnap>0.15?'FF1A7F37':irrSnap>0.10?'FF9A6700':'FFB42318';
      cell.fill=fill(bg);cell.font={name:'Calibri',size:10.5,bold:true,color:{argb:fc}};
    });
  });

  // hidden calc block label
  Object.assign(sn.getCell(CB-1,2),{value:'Sensitivity calculation \u2014 live scenario cash flows (auto-generated, do not edit)',font:{name:'Calibri',size:8,italic:true,color:{argb:'FFB0B0B0'}}});
  for(let si=0;si<growths.length*nC;si++)sn.getRow(CB+si).hidden=true;

  // ============ EXTRA ANALYSIS SHEETS ============
  const FPx='0%';
  const simpleSheet=(nm,title,sub,sections)=>{
    const sh=wb.addWorksheet(nm,{views:[{showGridLines:false}]});
    sh.columns=[{width:2},{width:36},{width:20},{width:2}];
    banner(sh,2,2,3,title,sub);
    let r=5;
    sections.forEach(sec=>{
      sh.mergeCells(r,2,r,3);
      Object.assign(sh.getCell(r,2),{value:sec.title,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF181716'}},fill:fill(HDR),border:box,alignment:{indent:1,vertical:'middle'}});
      sh.getRow(r).height=16;r++;
      sec.rows.forEach(rw=>{
        const[label,val,fm,bold]=rw;
        Object.assign(sh.getCell(r,2),{value:label,font:{name:'Calibri',size:10,bold:!!bold},border:box,alignment:{indent:1}});
        const c=sh.getCell(r,3);c.value=val;if(fm)c.numFmt=fm;
        Object.assign(c,{font:{name:'Calibri',size:10,bold:!!bold},border:box,alignment:{horizontal:'right'}});
        r++;
      });
      r++;
    });
    return sh;
  };

  // ============ EQUITY WATERFALL (live model) ============
  // This used to be a block of hardcoded outputs, which made it the one sheet
  // that was a report rather than a model: changing the promote or a hurdle in
  // Excel did nothing. It is now laid out the way an analyst would build it —
  // a year-by-year tier allocation with running hurdle balances — so every
  // structure input is live and the LP/GP splits recompute from them.
  const buildWaterfallSheet=(W)=>{
    const sh=wb.addWorksheet('Equity Waterfall',{views:[{showGridLines:false}]});
    sh.columns=[{width:2},{width:26},{width:15},{width:13},{width:13},{width:13},
      {width:12},{width:12},{width:12},{width:12},{width:14},{width:14},{width:13},{width:13},{width:13},{width:2}];
    banner(sh,2,2,15,'EQUITY WATERFALL','LP / GP promote  |  Blue cells are inputs, black cells are live formulas');

    const lbl=(r,c,text,bold)=>Object.assign(sh.getCell(r,c),
      {value:text,font:{name:'Calibri',size:10,bold:!!bold},border:box,alignment:{indent:1}});
    const put=(r,c,f,cached,fmt,isInput)=>{
      const cell=sh.getCell(r,c);
      cell.value=(typeof f==='object'||typeof f==='number')?f:fml(f,cached);
      cell.font=isInput?inpF:fmlF;cell.border=box;cell.numFmt=fmt;
      cell.alignment={horizontal:'right'};
      return cell;
    };
    const head=(r,c1,c2,text)=>{
      sh.mergeCells(r,c1,r,c2);
      Object.assign(sh.getCell(r,c1),{value:text,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF181716'}},
        fill:fill(HDR),border:box,alignment:{indent:1,vertical:'middle'}});
      sh.getRow(r).height=16;
    };

    // ---- structure inputs -------------------------------------------------
    let r=5;
    head(r,2,15,'STRUCTURE  (edit the blue cells)');r++;
    const S={};
    const srow=(key,label,val,fmt,isInput,formula)=>{
      lbl(r,2,label);
      if(formula)put(r,3,formula,val,fmt,false); else put(r,3,val,val,fmt,isInput);
      S[key]='$C$'+r;r++;
    };
    srow('lp','LP equity share',W.lpShare,FPx,true);
    srow('gp','GP equity share',W.gpShare,FPx,false,`1-${S.lp}`);
    srow('pref','Preferred return',W.pref,FPx,true);
    srow('h2','Hurdle 2 (LP IRR)',(inp.hurdle2!=null?inp.hurdle2:12)/100,FPx,true);
    srow('h3','Hurdle 3 (LP IRR)',(inp.hurdle3!=null?inp.hurdle3:15)/100,FPx,true);
    srow('s1','LP share through pref',W.tiers[0].sL,FPx,false,S.lp);
    srow('s2','LP share, pref to hurdle 2',W.tiers[1].sL,FPx,true);
    srow('s3','LP share, hurdle 2 to 3',W.tiers[2].sL,FPx,true);
    srow('s4','LP share above hurdle 3',W.tiers[3].sL,FPx,true);
    srow('eqT','Total equity',res.equity,F$,false,refs.eq);
    srow('lpEq','LP equity contributed',W.lpEq,F$,false,`${S.eqT}*${S.lp}`);
    srow('gpEq','GP equity contributed',W.gpEq,F$,false,`${S.eqT}*${S.gp}`);
    r++;

    // ---- year-by-year tier allocation ------------------------------------
    head(r,2,15,'ANNUAL DISTRIBUTION WATERFALL');r++;
    const HDRS=['Year','Partnership Cash','Hurdle Bal: Pref','Hurdle Bal: H2','Hurdle Bal: H3',
      'Cash: Pref Tier','Cash: Tier 2','Cash: Tier 3','Cash: Residual','LP Distribution','GP Distribution',
      'End Bal: Pref','End Bal: H2','End Bal: H3'];
    HDRS.forEach((h,i)=>Object.assign(sh.getCell(r,2+i),
      {value:h,font:{name:'Calibri',size:9,bold:true,color:{argb:WHITE}},fill:fill(NAVY2),border:box,
       alignment:{horizontal:'center',wrapText:true,vertical:'middle'}}));
    sh.getRow(r).height=30;r++;

    const r0=r;                        // year 0
    const C=i=>String.fromCharCode(64+i);
    const col={yr:2,cash:3,b1:4,b2:5,b3:6,t1:7,t2:8,t3:9,resid:10,lp:11,gp:12,e1:13,e2:14,e3:15};
    const A=(k,row)=>C(col[k])+row;

    // Year 0: capital goes in, hurdle balances start at LP contributed capital.
    put(r0,col.yr,0,0,'0');
    put(r0,col.cash,0,0,F$);
    [col.b1,col.b2,col.b3,col.t1,col.t2,col.t3,col.resid].forEach(c=>put(r0,c,0,0,F$));
    put(r0,col.lp,`-${S.lpEq}`,-W.lpEq,F$N);
    put(r0,col.gp,`-${S.gpEq}`,-W.gpEq,F$N);
    [col.e1,col.e2,col.e3].forEach(c=>put(r0,c,S.lpEq,W.lpEq,F$));

    // Mirror of calcWaterfall, replayed so the written cells carry correct
    // cached values and so the intermediate columns can be checked against the
    // engine rather than trusted.
    const mirror=(()=>{
      const bal=[W.lpEq,W.lpEq,W.lpEq];
      const hs=[W.pref,(inp.hurdle2!=null?inp.hurdle2:12)/100,(inp.hurdle3!=null?inp.hurdle3:15)/100];
      const ss=[W.tiers[0].sL,W.tiers[1].sL,W.tiers[2].sL];
      const s4=W.tiers[3].sL;
      const out=[];
      for(let y=1;y<=hp;y++){
        const cash=Math.max(0,(res.rows[y-1]?res.rows[y-1].cfbt:0)+(y===hp?(res.exit?res.exit.proceeds:0):0));
        const acc=bal.map((b,i)=>b*(1+hs[i]));
        const take=[0,0,0];let lpSoFar=0,avail=cash;
        for(let i=0;i<3;i++){
          const room=Math.max(0,acc[i]-lpSoFar);
          if(room<=0){take[i]=0;continue;}
          take[i]=ss[i]===0?avail:Math.min(avail,room/ss[i]);
          lpSoFar+=take[i]*ss[i];avail-=take[i];
        }
        const resid=cash-take[0]-take[1]-take[2];
        const lpY=take[0]*ss[0]+take[1]*ss[1]+take[2]*ss[2]+resid*s4;
        const gpY=cash-lpY;
        for(let i=0;i<3;i++)bal[i]=acc[i]-lpY;
        out.push({cash,acc:acc.slice(),take:take.slice(),resid,lpY,gpY,end:bal.slice()});
      }
      return out;
    })();

    for(let y=1;y<=hp;y++){
      const row=r0+y, p=row-1, m=mirror[y-1];
      put(row,col.yr,y,y,'0');
      put(row,col.cash,`MAX(0,${PFQ}${colOf(y)}${rowIdx.net})`,m.cash,F$);
      put(row,col.b1,`${A('e1',p)}*(1+${S.pref})`,m.acc[0],F$);
      put(row,col.b2,`${A('e2',p)}*(1+${S.h2})`,m.acc[1],F$);
      put(row,col.b3,`${A('e3',p)}*(1+${S.h3})`,m.acc[2],F$);
      const cash=A('cash',row);
      const t1=A('t1',row),t2=A('t2',row),t3=A('t3',row);
      put(row,col.t1,`IF(${S.s1}=0,IF(${A('b1',row)}<=0,0,${cash}),MIN(${cash},MAX(0,${A('b1',row)})/${S.s1}))`,m.take[0],F$);
      put(row,col.t2,`IF(${S.s2}=0,IF(${A('b2',row)}-${t1}*${S.s1}<=0,0,${cash}-${t1}),MIN(${cash}-${t1},MAX(0,${A('b2',row)}-${t1}*${S.s1})/${S.s2}))`,m.take[1],F$);
      put(row,col.t3,`IF(${S.s3}=0,IF(${A('b3',row)}-${t1}*${S.s1}-${t2}*${S.s2}<=0,0,${cash}-${t1}-${t2}),MIN(${cash}-${t1}-${t2},MAX(0,${A('b3',row)}-${t1}*${S.s1}-${t2}*${S.s2})/${S.s3}))`,m.take[2],F$);
      put(row,col.resid,`${cash}-${t1}-${t2}-${t3}`,m.resid,F$);
      put(row,col.lp,`${t1}*${S.s1}+${t2}*${S.s2}+${t3}*${S.s3}+${A('resid',row)}*${S.s4}`,m.lpY,F$);
      put(row,col.gp,`${cash}-${A('lp',row)}`,m.gpY,F$);
      put(row,col.e1,`${A('b1',row)}-${A('lp',row)}`,m.end[0],F$);
      put(row,col.e2,`${A('b2',row)}-${A('lp',row)}`,m.end[1],F$);
      put(row,col.e3,`${A('b3',row)}-${A('lp',row)}`,m.end[2],F$);
      if(y%2===0)for(let c=2;c<=15;c++)sh.getCell(row,c).fill=fill(BAND);
    }
    const rLast=r0+hp;
    r=rLast+2;

    // ---- partner results, all derived from the table above ---------------
    const lpRange=`${A('lp',r0+1)}:${A('lp',rLast)}`, gpRange=`${A('gp',r0+1)}:${A('gp',rLast)}`;
    const lpFlow=`${A('lp',r0)}:${A('lp',rLast)}`, gpFlow=`${A('gp',r0)}:${A('gp',rLast)}`;
    const partner=(title,eqRef,eqVal,range,flow,tot,profit,irr,em)=>{
      head(r,2,3,title);r++;
      lbl(r,2,'Equity contributed');put(r,3,eqRef,eqVal,F$);r++;
      lbl(r,2,'Total distributions');put(r,3,`SUM(${range})`,tot,F$);const totR='$C$'+r;r++;
      lbl(r,2,'Net profit');put(r,3,`${totR}-${eqRef}`,profit,F$N);r++;
      lbl(r,2,'IRR');put(r,3,`IFERROR(IRR(${flow}),"n/a")`,isFinite(irr)?irr:undefined,FP);r++;
      lbl(r,2,'Equity multiple',true);put(r,3,`IF(${eqRef}=0,0,${totR}/${eqRef})`,em,FX);r++;
      r++;
      return totR;
    };
    const lpTotR=partner('LIMITED PARTNER',S.lpEq,W.lpEq,lpRange,lpFlow,W.lpTot,W.lpProfit,W.lpIRR,W.lpEM);
    const gpTotR=partner('SPONSOR (GP)',S.gpEq,W.gpEq,gpRange,gpFlow,W.gpTot,W.gpProfit,W.gpIRR,W.gpEM);
    head(r,2,3,'PROMOTE');r++;
    lbl(r,2,'GP take above pro-rata',true);
    put(r,3,`MAX(0,${gpTotR}-${S.gp}*(${lpTotR}+${gpTotR}))`,W.gpPromote,F$);
    return sh;
  };

  // ============ AFTER-TAX (live model) ============
  // Same problem the waterfall had: pasted outputs. Rebuilt as a year-by-year
  // schedule so the tax rates, land allocation, and depreciation period are
  // all editable and everything downstream follows.
  const buildAfterTaxSheet=(A)=>{
    const sh=wb.addWorksheet('After-Tax',{views:[{showGridLines:false}]});
    sh.columns=[{width:2},{width:30},{width:15},{width:14},{width:14},{width:14},{width:14},{width:14},{width:15},{width:14},{width:2}];
    banner(sh,2,2,10,'AFTER-TAX ANALYSIS','Depreciation shield, recapture, capital gains  |  Blue cells are inputs, black cells are live formulas');
    const lbl=(r,c,text,bold)=>Object.assign(sh.getCell(r,c),
      {value:text,font:{name:'Calibri',size:10,bold:!!bold},border:box,alignment:{indent:1}});
    const put=(r,c,v,cached,fmt,isInput)=>{
      const cell=sh.getCell(r,c);
      cell.value=(typeof v==='string')?fml(v,cached):v;
      cell.font=isInput?inpF:fmlF;cell.border=box;cell.numFmt=fmt;
      cell.alignment={horizontal:'right'};
    };
    const head=(r,c1,c2,text)=>{
      sh.mergeCells(r,c1,r,c2);
      Object.assign(sh.getCell(r,c1),{value:text,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF181716'}},
        fill:fill(HDR),border:box,alignment:{indent:1,vertical:'middle'}});
      sh.getRow(r).height=16;
    };
    let r=5;const T={};
    const srow=(key,label,val,fmt,isInput,formula)=>{
      lbl(r,2,label);
      if(formula)put(r,3,formula,val,fmt,false);else put(r,3,val,val,fmt,isInput);
      T[key]='$C$'+r;r++;
    };
    head(r,2,10,'TAX BASIS  (edit the blue cells)');r++;
    srow('cost','Total cost basis',res.totalCost,F$,false,refs.tcap);
    srow('landPct','Land allocation (non-depreciable)',(inp.landPct!=null?inp.landPct:20)/100,FP,true);
    srow('land','Land value',res.totalCost-A.deprBasis,F$,false,
      isDev?`${refs.price}`:`${refs.price}*${T.landPct}`);
    srow('dbasis','Depreciable basis',A.deprBasis,F$,false,`MAX(0,${T.cost}-${T.land})`);
    srow('dyears','Depreciation period (years)',A.depYears,'0.0',true);
    srow('adep','Annual depreciation',A.annualDep,F$,false,`IF(${T.dyears}=0,0,${T.dbasis}/${T.dyears})`);
    srow('tax','Ordinary income tax rate',A.taxRate,FP,true);
    srow('rec','Depreciation recapture rate',A.recRate,FP,true);
    srow('cg','Capital gains rate',A.capRate,FP,true);
    r++;

    head(r,2,10,'ANNUAL AFTER-TAX CASH FLOW');r++;
    ['Year','NOI','Interest','Depreciation','Accum. Depr.','Taxable Income','Income Tax','Pre-Tax Cash Flow','After-Tax Cash Flow']
      .forEach((h,i)=>Object.assign(sh.getCell(r,2+i),
        {value:h,font:{name:'Calibri',size:9,bold:true,color:{argb:WHITE}},fill:fill(NAVY2),border:box,
         alignment:{horizontal:'center',wrapText:true,vertical:'middle'}}));
    sh.getRow(r).height=30;r++;
    const c={yr:2,noi:3,int:4,dep:5,acc:6,ti:7,tx:8,pre:9,at:10};
    const CC=i=>String.fromCharCode(64+i);
    const t0=r;                                  // year 0 row (capital call)
    put(t0,c.yr,0,0,'0');
    [c.noi,c.int,c.dep,c.acc,c.ti,c.tx].forEach(k=>put(t0,k,0,0,F$));
    put(t0,c.pre,`-${refs.eq}`,-res.equity,F$N);
    put(t0,c.at,`-${refs.eq}`,-res.equity,F$N);
    for(let y=1;y<=hp;y++){
      const row=t0+y, yr=A.yrRows[y-1], pc=colOf(y);
      // interest = debt service less principal; principal is the fall in balance
      const prevBal=y===1?refs.loan:`${PFQ}${colOf(y-1)}${rowIdx.bal}`;
      put(row,c.yr,y,y,'0');
      put(row,c.noi,`${PFQ}${pc}${rowIdx.noi}`,yr.noi,F$);
      put(row,c.int,`MAX(0,-${PFQ}${pc}${rowIdx.ds}-MAX(0,${prevBal}-${PFQ}${pc}${rowIdx.bal}))`,yr.interest,F$);
      put(row,c.dep,`MIN(${T.adep},MAX(0,${T.dbasis}-${CC(c.acc)}${row-1}))`,yr.dep,F$);
      put(row,c.acc,`${CC(c.acc)}${row-1}+${CC(c.dep)}${row}`,A.yrRows.slice(0,y).reduce((a,x)=>a+x.dep,0),F$);
      put(row,c.ti,`${CC(c.noi)}${row}-${CC(c.int)}${row}-${CC(c.dep)}${row}`,yr.taxable,F$N);
      put(row,c.tx,`${CC(c.ti)}${row}*${T.tax}`,yr.tax,F$N);
      put(row,c.pre,`${PFQ}${pc}${rowIdx.cfbt}`,yr.cfbt,F$N);
      put(row,c.at,`${CC(c.pre)}${row}-${CC(c.tx)}${row}`,yr.atcf,F$N);
      if(y%2===0)for(let k=2;k<=10;k++)sh.getCell(row,k).fill=fill(BAND);
    }
    const tLast=t0+hp;
    const accFinal=`${CC(c.acc)}${tLast}`;
    r=tLast+2;

    head(r,2,3,'TAX ON SALE');r++;
    const S2={};
    const srow2=(key,label,val,fmt,formula,bold)=>{
      lbl(r,2,label,bold);put(r,3,formula,val,fmt,false);S2[key]='$C$'+r;r++;
    };
    srow2('adj','Adjusted basis at sale',A.adjBasis,F$,`${T.cost}-${accFinal}`);
    srow2('gain','Total gain on sale',A.saleGain,F$N,`${refs.nsale}-${S2.adj}`);
    srow2('rect','Depreciation recapture tax',A.recaptureTax,F$,`MAX(0,MIN(${accFinal},${S2.gain}))*${T.rec}`);
    srow2('cgt','Capital gains tax',A.capGainTax,F$,`MAX(0,${S2.gain}-${accFinal})*${T.cg}`);
    srow2('stx','Total tax on sale',A.saleTax,F$,`${S2.rect}+${S2.cgt}`,true);
    srow2('atp','After-tax sale proceeds',A.atProceeds,F$,`${refs.proc}-${S2.stx}`,true);
    r++;

    head(r,2,3,'RETURNS');r++;
    // the final year carries operating cash plus after-tax sale proceeds
    const atFlow=`${CC(c.at)}${t0}:${CC(c.at)}${tLast}`;
    lbl(r,2,'Pre-tax IRR');
    put(r,3,`IFERROR(IRR(${CC(c.pre)}${t0}:${CC(c.pre)}${tLast})," n/a")`,undefined,FP);r++;
    lbl(r,2,'After-tax IRR (incl. sale)',true);
    put(r,3,`IFERROR(IRR(${atFlow})+0*${S2.atp},"n/a")`,undefined,FP);r++;
    lbl(r,2,'Total after-tax distributions');
    put(r,3,`SUM(${CC(c.at)}${t0+1}:${CC(c.at)}${tLast})+${S2.atp}`,
      A.yrRows.reduce((a,x)=>a+x.atcf,0)+A.atProceeds,F$);const totR='$C$'+(r);r++;
    lbl(r,2,'After-tax equity multiple',true);
    put(r,3,`IF(${refs.eq}=0,0,${totR}/${refs.eq})`,A.atEM,FX);r++;
    return sh;
  };

  if(res.lihtc){const L=res.lihtc;
    simpleSheet('LIHTC Analysis','LIHTC & SYNDICATION','Tax-credit equity, sources and uses',[
      {title:'TAX CREDIT CALCULATION',rows:[
        ['Eligible basis ('+(L.ebPct*100).toFixed(0)+'% of hard+soft+fee)',L.eligibleBasis,F$],
        ['Basis boost (QCT/DDA)',L.boostPct/100,FPx],
        ['Boosted eligible basis',L.boostedBasis,F$],
        ['Applicable fraction',L.applicableFraction,FPx],
        ['Qualified basis',L.qualifiedBasis,F$,true],
        ['Credit rate',L.creditRate,FP2],
        ['Annual credit',L.annualCredit,F$],
        ['10-year credits',L.tenYearCredits,F$],
        ['Credit price (per $1)',L.creditPrice,'$0.000'],
        ['LIHTC equity',L.lihtcEquity,F$,true],
      ]},
      {title:'SOURCES',rows:[
        ['Permanent loan (DSCR-sized)',L.permLoan,F$],
        ['LIHTC equity',L.lihtcEquity,F$],
        ['Soft sources / subsidy',L.softSources,F$],
        ['Deferred developer fee',L.deferredFee,F$],
        ['Total sources',L.totalSources,F$,true],
      ]},
      {title:'USES',rows:[
        ['Land',L.land,F$],['Hard costs',L.hard,F$],['Soft costs',L.soft,F$],
        ['Developer fee',L.devFee,F$],['Total uses',L.totalUses,F$,true],
        ['Funding gap',L.fundingGap,F$N,true],['Developer fee paid in cash',L.cashDevFee,F$],
      ]},
    ]);
  } else {
    const W=inp.waterfallEnabled?calcWaterfall(res,inp):null;
    if(W)buildWaterfallSheet(W);
    if(inp.afterTax){
      const A=calcAfterTax(res,inp);
      if(A)buildAfterTaxSheet(A);
    }
  }

  // Legend + note
  sn.mergeCells(lr,2,lr,lastCol);
  Object.assign(sn.getCell(lr,2),{value:'Color scale:  green > 15%      amber 10-15%      red < 10%   (levered IRR)',font:{name:'Calibri',size:9,bold:true,color:{argb:'FF555555'}}});
  sn.mergeCells(lr+1,2,lr+2,lastCol);
  Object.assign(sn.getCell(lr+1,2),{value:'Each cell is a live IRR formula over a full scenario cash flow held in hidden rows below. Change any blue axis value \u2014 revenue growth down the side, exit cap across the top \u2014 and the grid recalculates in Excel.',font:{name:'Calibri',size:8.5,italic:true,color:{argb:'FF808080'}},alignment:{wrapText:true,vertical:'top'}});

  return wb;
}

async function exportXLSX(res,inp){
  const wb=await buildWorkbook(res,inp);
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=((inp.propertyName||'Pro Forma').trim().replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')||'Pro_Forma')+'_SmartCapStack.xlsx';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

export{buildWorkbook,exportXLSX};
