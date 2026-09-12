(()=>{
'use strict';
const v2=/buildplanner-v2\.html/i.test(location.pathname),original='quotation-quantity-fix-v1.js';
const load=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>done&&done(new Error('Unable to load '+src));document.head.appendChild(s)};
if(!v2){load(original);return}

/* Build Planner V2 is source-driven. The inline page supplies only UI/state helpers;
   calculation quantities come exclusively from Calculation Rules. */
(async()=>{
const RULES='https://raw.githubusercontent.com/terajuciptabina-eng/terajuciptabina/main/quotation/calculation-rules.html';
const RATES='https://terajuciptabina.vercel.app/api/rates';
const round=x=>Math.round((Number(x)||0)*100)/100;
const ceil=x=>Math.max(0,Math.ceil(Number(x)||0));
const m2=x=>(Number(x)||0)*0.09290304;
const parts=x=>String(x||'').split('/').map(x=>x.trim()).filter(Boolean);
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
let rules=[];
let rateSet={};

function readRooms(){
  if(typeof getRoomGroupsBase!=='function')return[];
  return getRoomGroupsBase().map(r=>({...r,area:Number(r.area)||0}));
}
function context(){
  const rooms=readRooms().filter(r=>r.area>0);
  const main=rooms.filter(r=>r.roomType!=='porch');
  const porch=rooms.filter(r=>r.roomType==='porch');
  const bath=main.filter(r=>r.roomType==='bathroom');
  const bed=main.filter(r=>r.roomType==='bedroom');
  const kitchen=main.filter(r=>r.roomType==='kitchen');
  const livingDining=main.filter(r=>r.roomType==='living'||r.roomType==='dining');
  const A=main.reduce((s,r)=>s+r.area,0);
  const P=porch.reduce((s,r)=>s+r.area,0);
  const B=bath.reduce((s,r)=>s+r.area,0);
  return {rooms,main,porch,bath,bed,kitchen,livingDining,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};
}
function pathText(r){return String(r?.path||'');}
function rateKey(r){
  const p=pathText(r).toLowerCase();
  if(/footing \/ concrete/.test(p))return 'footingConc';
  if(/footing \/ formwork/.test(p))return 'footingFw';
  if(/footing \/ rebar/.test(p))return 'footingRebar';
  if(/ground slab \/ concrete/.test(p))return 'slabConc';
  if(/ground slab \/ brc/.test(p))return 'slabBrc';
  if(/ground beam \/ concrete/.test(p))return 'beamConc';
  if(/ground beam \/ formwork/.test(p))return 'beamFw';
  if(/ground beam \/ rebar/.test(p))return 'beamRebar';
  if(/roof beam \/ concrete/.test(p))return 'beamConc';
  if(/roof beam \/ formwork/.test(p))return 'beamFw';
  if(/roof beam \/ rebar/.test(p))return 'beamRebar';
  if(/column \/ concrete/.test(p))return 'colConc';
  if(/column \/ formwork/.test(p))return 'colFw';
  if(/column \/ rebar/.test(p))return 'colRebar';
  if(/flat roof \/ concrete/.test(p))return 'flatRoofConc';
  if(/flat roof \/ formwork/.test(p))return 'flatRoofFw';
  if(/flat roof \/ brc/.test(p))return 'flatRoofBrc';
  if(/roof \/ metal roofing sheet/.test(p))return 'metalSheet';
  if(/apron \/ concrete/.test(p))return 'apronConc';
  if(/apron \/ formwork/.test(p))return 'apronFw';
  if(/apron \/ brc/.test(p))return 'apronBrc';
  if(/drainage/.test(p))return 'drainage';
  if(/bathroom \/ wall tiles/.test(p))return 'bathWallTile';
  if(/bathroom \/ floor tiles/.test(p))return 'bathFloorTile';
  if(/bathroom \/ ceiling/.test(p))return 'ceilingInt';
  if(/bathroom \/ piping/.test(p))return 'bathPiping';
  if(/bathroom \/ wc/.test(p))return 'bathWc';
  if(/bathroom \/ basin/.test(p))return 'bathBasin';
  if(/bathroom \/ shower/.test(p))return 'bathShower';
  if(/bathroom \/ tap/.test(p))return 'bathTap';
  if(/ceiling/.test(p))return 'ceilingInt';
  if(/floor tiles \/ internal/.test(p))return 'floorTileInt';
  if(/floor tiles \/ external/.test(p))return 'floorTileExt';
  if(/painting \/ internal/.test(p))return 'paintInt';
  if(/painting \/ external/.test(p))return 'paintExt';
  if(/doors \/ type/.test(p))return 'door';
  if(/windows \/ type/.test(p))return 'window';
  if(/power point/.test(p))return 'powerPoint';
  if(/switch/.test(p))return 'switch';
  if(/lighting/.test(p))return 'lighting';
  if(/fan/.test(p))return 'fan';
  if(/aircond/.test(p))return 'aircond';
  if(/wiring/.test(p))return 'wiring';
  if(/db/.test(p))return 'dbBox';
  if(/earthing/.test(p))return 'earthing';
  return null;
}
function rate(r){
  const k=rateKey(r);
  if(k&&Number.isFinite(Number(rateSet[k])))return round(rateSet[k]);
  if(k&&typeof RATES!=='undefined'&&Number.isFinite(Number(RATES[k])))return round(RATES[k]);
  return 0;
}
function quantity(r,c,items){
  const M=String(r.method||'').toUpperCase();
  const p=pathText(r).toLowerCase();
  const k=Number(r.coeff)||0;
  const porch=/^porch\s*\//i.test(pathText(r));
  const A=porch?c.P:c.A;
  const AM=porch?c.PM:c.AM;
  if(M==='FIXED PER MAIN DOOR')return c.main.length?1:0;
  if(M==='FIXED PER KITCHEN')return c.kitchen.length;
  if(M==='FIXED PER BEDROOM')return c.bed.length;
  if(M==='FIXED PER BATHROOM')return c.bath.length;
  if(M==='FIXED PER ROOM')return c.main.length*k;
  if(M==='FIXED PER PORCH')return c.porch.length;
  if(M==='FIXED PER ELIGIBLE AREA')return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  if(M==='FIXED PER APPLICABLE LOCATION'){
    if(/doors \/ type 1/.test(p))return c.main.filter(x=>['living','bedroom','kitchen'].includes(x.roomType)).length;
    if(/doors \/ type 2/.test(p))return c.livingDining.length;
    return 0;
  }
  if(M==='AREA ALLOWANCE'){
    const source=porch?c.porch:c.main;
    return source.reduce((s,x)=>s+Math.ceil(x.area/100),0);
  }
  if(M==='AREA / COEFFICIENT'||M==='BASELINE COEFFICIENT'||M==='COEFFICIENT')return A*k;
  if(M==='THICKNESS'||M==='LAYER'||M==='AREA')return AM*k;
  if(M==='POUNDAGE'){
    const parent=parts(pathText(r)).slice(0,-1).join(' / ').toLowerCase();
    const parentItem=items.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===parent&&/concrete/.test(i.path.toLowerCase()));
    return parentItem?parentItem.qty*k:0;
  }
  if(M==='DEPENDENCY'){
    if(/internal painting/.test(p)){
      const x=items.find(i=>/brickwall \/ internal wall/i.test(i.path));
      return x?x.qty:0;
    }
    if(/external painting/.test(p)){
      const x=items.find(i=>/brickwall \/ external wall/i.test(i.path));
      return x?x.qty:0;
    }
    if(/drainage/.test(p))return c.P>0?c.P*k:0;
    return 0;
  }
  if(M==='PERIMETER × HEIGHT'){
    if(/bathroom/.test(p))return c.bath.reduce((s,x)=>s+4*Math.sqrt(x.area),0)*k;
    return 0;
  }
  if(M==='ROOF GEOMETRY')return AM*k;
  if(M==='OVERHANG AREA × THICKNESS')return AM*k;
  if(M==='PERIMETER')return 0;
  return 0;
}
function itemId(r,i,roomId){
  const base='rule-item-'+i;
  return roomId&&roomId!=='project'?`${base}-${String(roomId).replace(/[^a-zA-Z0-9_-]/g,'_')}`:base;
}
function makeItem(r,i,q,extra={}){
  const h=parts(r.path).slice(1,-1);
  const qty=ceil(q);
  return {id:itemId(r,i,extra.roomId),ruleIndex:i,rule:r,ruleKey:`rule-${i}`,category:String(r.group).toLowerCase(),description:r.description,unit:r.output,qty,rate:rate(r),amount:round(qty*rate(r)),path:r.path,hierarchy:h,groupKey:h.join(' / ')||r.group,groupTitle:h.join(' / ')||r.group,roomId:extra.roomId||'project',room:extra.room||'Project'};
}
function addCustom(item){
  if(typeof customQuantities!=='undefined'&&customQuantities.has(item.id))item.qty=ceil(customQuantities.get(item.id));
  if(typeof customRates!=='undefined'&&customRates.has(item.id))item.rate=round(customRates.get(item.id));
  if(typeof customDescriptions!=='undefined'&&customDescriptions.has(item.id))item.description=customDescriptions.get(item.id);
  item.amount=round(item.qty*item.rate);
  return item;
}
function buildItems(){
  const c=context(),items=[];
  rules.forEach((r,i)=>{
    if(!r||!r.group||!r.path||!r.description||!r.output)return;
    const M=String(r.method||'').toUpperCase();
    if(!M||M==='FIXED PROJECT')return;
    const p=pathText(r).toLowerCase();
    if(/retired|review|c-channel/.test(JSON.stringify(r).toLowerCase()))return;

    if(M==='FIXED PER BATHROOM'){
      c.bath.forEach(b=>items.push(addCustom(makeItem(r,i,1,{roomId:b.roomId,room:b.label}))));
      return;
    }
    if(/bathroom \/ wall tiles/i.test(p)||/bathroom \/ floor tiles/i.test(p)||/bathroom \/ ceiling/i.test(p)){
      c.bath.forEach(b=>{
        let q=0;
        if(M==='PERIMETER × HEIGHT')q=4*Math.sqrt(b.area)*(Number(r.coeff)||0);
        else if(M==='AREA'||M==='THICKNESS'||M==='LAYER')q=m2(b.area)*(Number(r.coeff)||0);
        else q=m2(b.area)*(Number(r.coeff)||0);
        if(q>0)items.push(addCustom(makeItem(r,i,q,{roomId:b.roomId,room:b.label})));
      });
      return;
    }
    const q=quantity(r,c,items);
    if(q>0)items.push(addCustom(makeItem(r,i,q)));
  });

  if(typeof manualItems!=='undefined')for(const [target,list] of manualItems.entries())(list||[]).forEach(x=>{
    const room=x.roomId&&x.roomId!=='project'?c.rooms.find(r=>r.roomId===x.roomId):null;
    const q=ceil(x.qty);
    if(!q)return;
    items.push({...x,id:x.id,category:x.category||'custom',unit:x.unit||'ls',qty:q,rate:round(x.rate),amount:round(q*round(x.rate)),roomId:x.roomId||'project',room:room?.label||'Project',path:'CUSTOM / '+(x.groupTitle||'Additional Item'),hierarchy:[x.groupTitle||'Additional Item']});
  });
  return items;
}
function activeItems(){
  const items=buildItems();
  return items.filter(i=>!(typeof excludedItems!=='undefined'&&excludedItems.has(i.id)));
}
function render(items){
  const c=document.getElementById('estimateContent');
  if(!c)return;
  if(typeof syncBuiltUpAreaFromRooms==='function')syncBuiltUpAreaFromRooms();
  const rooms=context().rooms;
  const roomsArea=rooms.reduce((s,r)=>s+r.area,0);
  const declared=Number(document.getElementById('builtUpArea')?.value)||0;
  const total=items.reduce((s,i)=>s+Number(i.amount||0),0);
  const customer=document.getElementById('customerName')?.value||'Not specified';
  const location=document.getElementById('projectLocation')?.value||'Not specified';
  const summary=document.getElementById('customerSummary');
  if(summary)summary.innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceil(declared)} sqft declared · ${ceil(roomsArea)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;
  const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<textarea class="w-full border rounded-lg px-3 py-2 bg-white" onchange="editItemDescription('${i.id}',this.value)">${esc(i.description)}</textarea>`:`<div class="homeowner-locked py-2 rounded-lg">${esc(i.description)}</div>`}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<input type="number" min="0" step="1" value="${ceil(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemQuantity('${i.id}',this.value)">`:`<div class="homeowner-locked text-right py-2">${ceil(i.qty)}</div>`}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<input type="number" min="0" step="0.01" value="${round(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemRate('${i.id}',this.value)">`:`<div class="homeowner-locked text-right py-2">${round(i.rate).toFixed(2)}</div>`}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<button type="button" onclick="excludeItem('${i.id}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button>`:''}</td></tr>`;
  const groups=[];
  for(const i of items){let g=groups.find(x=>x.name===String(i.category).toUpperCase());if(!g){g={name:String(i.category).toUpperCase(),nodes:[]};groups.push(g)}let n=g;for(const name of (i.hierarchy||[])){let q=n.nodes.find(x=>x.name===name);if(!q){q={name,nodes:[],items:[]};n.nodes.push(q)}n=q}n.items.push(i)}
  const head=t=>`<tr class="quotation-section-row"><td colspan="6" class="py-3 px-2">${esc(t)}</td></tr>`;
  const sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="6" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`;
  const walk=(nodes,l=0)=>nodes.map(n=>sub(n.name,l)+n.items.map(row).join('')+walk(n.nodes,l+1)).join('');
  let h='<table class="w-full border-collapse text-sm detailed-quotation-table"><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th><th>Action</th></tr></thead><tbody>';
  groups.forEach(g=>h+=head(g.name)+walk(g.nodes));
  h+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td><td></td></tr></tfoot></table>`;
  c.innerHTML=h;
  const gt=document.getElementById('grandTotal');if(gt)gt.textContent=round(total).toFixed(2);
  const tb=document.getElementById('totalBuiltArea');if(tb)tb.textContent=ceil(declared)+' sqft';
  const rt=document.getElementById('roomsTotalArea');if(rt)rt.textContent=ceil(roomsArea)+' sqft';
}
function update(){
  if(typeof syncBuiltUpAreaFromRooms==='function')syncBuiltUpAreaFromRooms();
  render(activeItems());
  if(typeof saveContractorState==='function')saveContractorState();
}
async function source(){
  const a=await fetch(RULES,{cache:'no-store'});
  if(!a.ok)throw new Error('Calculation Rules unavailable');
  const t=await a.text();
  const m=t.match(/const\s+rules\s*=\s*(\[[\s\S]*?\]);/);
  if(!m)throw new Error('Calculation Rules data not found');
  rules=Function('return '+m[1])().filter(r=>r&&r.group&&r.path&&r.description&&r.output);
  try{
    const b=await fetch(RATES,{cache:'no-store'});
    if(b.ok){const j=await b.json();rateSet=j?.rateSet?.rates||j?.rates||{};}
  }catch(_){rateSet={};}
}

const previous=window.getAllItems;
window.getAllItems=()=>activeItems();
window.updateEstimate=update;
try{
  await source();
  update();
}catch(e){
  console.error('[TERAJU V2] Calculation Rules engine failed:',e);
  const c=document.getElementById('estimateContent');
  if(c)c.innerHTML='<div class="p-5 text-sm text-red-600 border border-red-200 rounded-xl bg-red-50">Calculation Rules could not be loaded. Please refresh the page.</div>';
}
})();
})();