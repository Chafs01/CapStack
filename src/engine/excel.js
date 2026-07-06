import ExcelJS from'exceljs';
import{f}from'./format.js';
import{getDevCost}from'./income.js';
import{buildPF}from'./buildPF.js';
import{calcWaterfall}from'./waterfall.js';
import{calcAfterTax}from'./afterTax.js';
// ─── EXCEL EXPORT ────────────────────────────────────────────────────────
async function buildWorkbook(res,inp,withResults=true){
  const E=ExcelJS;
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const t=(inp.assetType||'').toLowerCase();
  const isDev=t==='development';
  const name=inp.propertyName||'Untitled Property';
  const wb=new E.Workbook();
  wb.creator='SmartCapStack';wb.created=new Date();

  const NAVY='FF1F3864',NAVY2='FF2E4F87',HDR='FFD9E1F2',BAND='FFF7F7F7',WHITE='FFFFFFFF',FWDBG='FFF0F0EE';
  const GREENBG='FFE2EFDA',AMBERBG='FFFFF2CC',REDBG='FFFBE0DE';
  const thin={style:'thin',color:{argb:'FFD0D0D0'}};
  const box={top:thin,left:thin,bottom:thin,right:thin};
  const boxT={top:{style:'thin',color:{argb:'FF1F3864'}},left:thin,bottom:thin,right:thin};
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
    Object.assign(ws.getCell(r,c1),{value:title,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF1F3864'}},fill:fill(HDR),alignment:{vertical:'middle',indent:1},border:box});
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
  const sizeLine=isDev?[null,'Gross Buildable SF',inp.grossBuildableSF||0,FN,true]:(t==='commercial'?[null,'Total SF',inp.totalSF||0,FN,true]:[null,'Units',inp.numUnits||0,FN,true]);

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
    ['ecap','Exit Cap Rate',(inp.exitCapRate||0)/100,FP2,true],
    ['sell','Selling Costs',(inp.sellingCostsPct||0)/100,FP,true],
  ]));
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
    Object.assign(pf.getCell(pr,2),{value:ttl,font:{name:'Calibri',size:9.5,bold:true,color:{argb:'FF1F3864'}},fill:fill(HDR),alignment:{indent:1},border:box});
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
    ['fnoi','Forward NOI (Year '+(hp+1)+')',{f:`${PFQ}$${fwdL}$${rowIdx.noi}`,r:res.rows[hp].noi},F$,false],
    ['gross','Gross Sale Price',{f:'X',r:res.exit.grossSale},F$,false],
    ['scost','Selling Costs',{f:'X',r:-res.exit.sellAmt},F$N,false],
    ['nsale','Net Sale Price',{f:'X',r:res.exit.netSale},F$,false],
    ['poff','Loan Payoff',{f:`-${PFQ}$${lastYr}$${rowIdx.bal}`,r:-res.exit.payoff},F$N,false],
    ['proc','Net Sale Proceeds',{f:'X',r:res.exit.proceeds},F$,false],
  ]);
  setRef('gross',`IF(${refs.ecap}=0,0,${refs.fnoi}/${refs.ecap})`,res.exit.grossSale);
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
  const growths=[1,2,3,4,5],caps=[4.5,5.0,5.5,6.0,6.5,7.0];
  const nC=caps.length, lastCol=2+nC;
  sn.columns=[{width:2},{width:22}].concat(caps.map(()=>({width:11})));
  banner(sn,2,2,lastCol,'LEVERED IRR SENSITIVITY','How the deal\'s levered IRR moves with revenue growth and exit cap rate. All other inputs held constant.');

  // Column-axis label band: EXIT CAP RATE -> spanning the cap columns
  sn.mergeCells(4,3,4,lastCol);
  Object.assign(sn.getCell(4,3),{value:'EXIT CAP RATE \u2192',font:{name:'Calibri',size:9.5,bold:true,color:{argb:'FF1F3864'}},fill:fill(HDR),alignment:{horizontal:'center'},border:box});
  sn.getCell(4,2).border=box; sn.getCell(4,2).fill=fill(HDR);

  // Header row: corner label + editable cap values
  const sh=sn.getRow(5);
  Object.assign(sh.getCell(2),{value:'Rev Growth \u2193  /  Exit Cap \u2192',font:{name:'Calibri',size:9,bold:true,italic:true,color:{argb:WHITE}},fill:fill(NAVY2),border:box,alignment:{horizontal:'center',wrapText:true}});
  caps.forEach((c,i)=>{
    const cc=sh.getCell(3+i);
    cc.value=c/100;cc.numFmt=FP2;
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
          const sale=`(${noiF(G,hp+1)})/${C}*(1-${refs.sell})-${balRef}`;
          fla=`${fla}+(${sale})`;
        }
        const cc=sn.getCell(calcRow,2+k);
        cc.value={formula:fla}; cc.numFmt=F$N;
      }
      const irrSnap=buildPF(Object.assign({},inp,{revenueGrowth:g,exitCapRate:c})).ret.irr;
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
      Object.assign(sh.getCell(r,2),{value:sec.title,font:{name:'Calibri',size:10,bold:true,color:{argb:'FF1F3864'}},fill:fill(HDR),border:box,alignment:{indent:1,vertical:'middle'}});
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
    const W=calcWaterfall(res,inp);
    if(W){
      simpleSheet('Equity Waterfall','EQUITY WATERFALL','LP / GP promote distribution',[
        {title:'STRUCTURE',rows:[
          ['LP equity share',W.lpShare,FPx],['GP equity share',W.gpShare,FPx],
          ['Preferred return',W.pref,FPx],
        ]},
        {title:'LIMITED PARTNER',rows:[
          ['Equity contributed',W.lpEq,F$],['Total distributions',W.lpTot,F$],
          ['Net profit',W.lpProfit,F$],['IRR',W.lpIRR,FP],['Equity multiple',W.lpEM,FX,true],
        ]},
        {title:'SPONSOR (GP)',rows:[
          ['Equity contributed',W.gpEq,F$],['Total distributions',W.gpTot,F$],
          ['Net profit',W.gpProfit,F$],['IRR',W.gpIRR,FP],['Equity multiple',W.gpEM,FX,true],
          ['GP promote (above pro-rata)',W.gpPromote,F$,true],
        ]},
      ]);
    }
    if(inp.afterTax){
      const A=calcAfterTax(res,inp);
      if(A)simpleSheet('After-Tax','AFTER-TAX ANALYSIS','Depreciation shield, recapture, capital gains',[
        {title:'RETURNS',rows:[
          ['Pre-tax IRR',A.preTaxIRR,FP],['After-tax IRR',A.atIRR,FP,true],
          ['Pre-tax equity multiple',A.preTaxEM,FX],['After-tax equity multiple',A.atEM,FX,true],
        ]},
        {title:'DEPRECIATION',rows:[
          ['Depreciable basis',A.deprBasis,F$],['Depreciation period (yrs)',A.depYears,'0.0'],
          ['Annual depreciation',A.annualDep,F$],['Accumulated at exit',A.accumDep,F$],
          ['Ordinary tax rate',A.taxRate,FPx],
        ]},
        {title:'TAX ON SALE',rows:[
          ['Adjusted basis at sale',A.adjBasis,F$],['Total gain',A.saleGain,F$],
          ['Depreciation recapture tax',A.recaptureTax,F$],['Capital gains tax',A.capGainTax,F$],
          ['Total tax on sale',A.saleTax,F$,true],['After-tax sale proceeds',A.atProceeds,F$,true],
        ]},
      ]);
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
  a.download=(inp.propertyName||'SmartCapStack').replace(/\s+/g,'_')+'_SmartCapStack.xlsx';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

export{buildWorkbook,exportXLSX};
