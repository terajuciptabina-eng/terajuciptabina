(()=>{
'use strict';
if(!/buildplanner-v2\.html/i.test(location.pathname))return;

const RULES_URL='calculation-rules.html';
const RATES_URL='https://terajuciptabina.vercel.app/api/rates';
const DEFAULT_RATES_URL='../data/rates/default.json';
const n=x=>Number(x)||0;
const ceil=x=>Math.max(0,Math.ceil(n(x)));
const round=x=>Math.round(n(x)*100)/100;
const m2=x=>n(x)*.09290304;
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
const parts=x=>String(x||'').split('/').map(s=>s.trim()).filter(Boolean);
const slug=x=>String(x||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const isIntegerUnit=u=>['no','set','ls','unit'].includes(String(u||'').toLowerCase());

let rules=[];
let rates={};
let lastItems=[];
const customQuantities=new Map();
const customRates=new Map();
const customDescriptions=new Map();
const excludedItems=new Set();

function type(v){
 const s=String(v||'').toLowerCase();
 if(/porch/.test(s))return'porch';
 if(/bath/.test(s))return'bathroom';
 if(/bed/.test(s))return'bedroom';
 if(/kitchen/.test(s))return'kitchen';
 if(/living/.test(s))return'living';
 if(/dining/.test(s))return'dining';
 if(/family/.test(s))return'family';
 return s.replace(/[^a-z0-9]+/g,'_');
}

function domRooms(){
 return [...document.querySelectorAll('.room-card')].map((card,i)=>{
  const sel=card.querySelector('select');
  const opt=sel?.selectedOptions?.[0];
  const ins=[...card.querySelectorAll('input')];
  const a=ins.find(x=>x.type==='number'&&n(x.value)>0)||ins.find(x=>x.type==='number');
  if(!a)return null;
  const ti=ins.find(x=>x.type!=='number'&&x.type!=='hidden');
  const raw=(sel?.value||'')+' '+(opt?.textContent||'');
  const area=n(a.value);
  return area>0?{
   roomId:card.dataset.roomId||String(i+1),
   label:String(ti?.value||opt?.textContent||'Area '+(i+1)).trim(),
   area,
   roomType:type(raw)
  }:null;
 }).filter(Boolean);
}

function rooms(){
 if(typeof window.getRoomGroupsBase==='function'){
  try{
   const a=window.getRoomGroupsBase();
   if(Array.isArray(a)&&a.length)return a.map((r,i)=>({
    ...r,
    roomId:r.roomId||String(i+1),
    label:r.label||r.roomName||r.name||'Area '+(i+1),
    area:n(r.area),
    roomType:type(r.roomType||r.type||r.label)
   })).filter(r=>r.area>0);
  }catch(e){}
 }
 return domRooms();
}

function ctx(){
 const rs=rooms();
 const main=rs.filter(r=>r.roomType!=='porch');
 const porch=rs.filter(r=>r.roomType==='porch');
 const bath=main.filter(r=>r.roomType==='bathroom');
 const bed=main.filter(r=>r.roomType==='bedroom');
 const kit=main.filter(r=>r.roomType==='kitchen');
 const ld=main.filter(r=>['living','dining'].includes(r.roomType));
 const A=main.reduce((s,r)=>s+r.area,0);
 const P=porch.reduce((s,r)=>s+r.area,0);
 const B=bath.reduce((s,r)=>s+r.area,0);
 return{rs,main,porch,bath,bed,kit,ld,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};
}

function key(r,i){return'rule_'+slug(r.path)+'_'+i}

function rate(r,i){
 const k=key(r,i);
 const dk='rule_'+slug(r.description)+'_'+i;
 return Number.isFinite(n(rates[k]))?round(rates[k]):Number.isFinite(n(rates[dk]))?round(rates[dk]):0;
}

function qty(r,c,out){
 const M=String(r.method||'').toUpperCase().trim();
 const p=String(r.path||'');
 const l=p.toLowerCase();
 const k=n(r.coeff);
 const porch=/^porch\s*\//i.test(p);
 const A=porch?c.P:c.A;
 const AM=porch?c.PM:c.AM;
 switch(M){
  case'FIXED PROJECT':
  case'FIXED PER PROJECT':return c.A>0?1:0;
  case'FIXED PER MAIN DOOR':return c.main.length?1:0;
  case'FIXED PER KITCHEN':return c.kit.length;
  case'FIXED PER BEDROOM':return c.bed.length;
  case'FIXED PER BATHROOM':return c.bath.length;
  case'FIXED PER ROOM':return c.main.length*k;
  case'FIXED PER PORCH':return c.porch.length;
  case'FIXED PER ELIGIBLE AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER DESIGNATED AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER APPLICABLE LOCATION':
   if(/doors\s*\/.*type 1/i.test(l))return c.main.filter(x=>['living','bedroom','kitchen','family','dining'].includes(x.roomType)).length;
   if(/doors\s*\/.*type 2/i.test(l))return c.ld.length;
   if(/doors\s*\/.*type 3/i.test(l))return c.bath.length;
   if(/doors\s*\/.*type 4/i.test(l))return c.main.length?1:0;
   if(/windows\s*\/.*type 1/i.test(l))return c.bed.length;
   if(/windows\s*\/.*type 2/i.test(l))return c.kit.length;
   if(/windows\s*\/.*type 3/i.test(l))return c.bath.length;
   return 0;
  case'AREA ALLOWANCE':return(isPorch?c.porch:c.main).reduce((s,x)=>s+Math.ceil(x.area/100),0);
  case'AREA / COEFFICIENT':
  case'BASELINE COEFFICIENT':
  case'COEFFICIENT':
  case'SAME AS MAIN BUILDING':return A*k;
  case'THICKNESS':
  case'LAYER':
  case'AREA':return AM*k;
  case'POUNDAGE':{
   const par=parts(p).slice(0,-1).join(' / ').toLowerCase();
   const x=out.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===par&&/concrete/i.test(i.path));
   return x?n(x._rawQty||x.qty)*k:0;
  }
  case'DEPENDENCY':
   if(/floor tiles\s*\/\s*internal|internal floor tiles/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/floor tiles\s*\/\s*external|external floor tiles/i.test(l))return c.PM;
   if(/ceiling\s*\/\s*internal|internal ceiling/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/ceiling\s*\/\s*external|external ceiling/i.test(l))return c.PM;
   if(/painting\s*\/\s*internal|internal painting/i.test(l)){const x=out.find(i=>/internal wall/i.test(i.path));return x?n(x._rawQty||x.qty):0}
   if(/painting\s*\/\s*external|external painting/i.test(l)){const x=out.find(i=>/external wall/i.test(i.path));return x?n(x._rawQty||x.qty):0}
   if(/drainage|external drain/i.test(l))return c.P*k;
   return 0;
  case'PERIMETER × HEIGHT':return/bathroom/i.test(l)?c.bath.reduce((s,x)=>s+4*Math.sqrt(x.area),0)*k:0;
  case'ROOF GEOMETRY':
  case'OVERHANG AREA × THICKNESS':return AM*k;
  default:return 0;
 }
}

function make(r,i,q,e={}){
 const h=parts(r.path).slice(1,-1);
 const id='rule-item-'+i+(e.roomId&&e.roomId!=='project'?'-'+String(e.roomId).replace(/[^a-zA-Z0-9_-]/g,'_'):'');
 const x={
  id,ruleIndex:i,ruleKey:key(r,i),rule:r,
  category:String(r.group).toLowerCase(),
  description:r.description,
  unit:r.output,
  qty:ceil(q),rate:rate(r,i),amount:0,
  path:r.path,hierarchy:h,
  roomId:e.roomId||'project',room:e.room||'Project'
 };
 if(customQuantities.has(id))x.qty=ceil(customQuantities.get(id));
 if(customRates.has(id))x.rate=round(customRates.get(id));
 if(customDescriptions.has(id))x.description=customDescriptions.get(id);
 x.amount=round(x.qty*x.rate);
 return x;
}

function build(){
 const c=ctx(),out=[];
 rules.forEach((r,i)=>{
  if(!r?.group||!r.path||!r.description||!r.output)return;
  const M=String(r.method||'').toUpperCase();
  const raw=JSON.stringify(r).toLowerCase();
  const p=String(r.path||'').toLowerCase();
  if(!M||/retired|review|c-channel/.test(raw))return;

  if(M==='FIXED PER BATHROOM'){
   c.bath.forEach(b=>out.push(make(r,i,1,{roomId:b.roomId,room:b.label})));
   return;
  }
  if(M==='FIXED PER BEDROOM'){
   c.bed.forEach(b=>out.push(make(r,i,1,{roomId:b.roomId,room:b.label})));
   return;
  }
  if(M==='FIXED PER KITCHEN'){
   c.kit.forEach(b=>out.push(make(r,i,1,{roomId:b.roomId,room:b.label})));
   return;
  }
  if(r.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(p)){
   c.bath.forEach(b=>{
    const q=/wall tiles/i.test(p)?4*Math.sqrt(b.area)*n(r.coeff):m2(b.area)*n(r.coeff);
    if(q>0)out.push(make(r,i,q,{roomId:b.roomId,room:b.label}));
   });
   return;
  }
  const q=qty(r,c,out);
  if(q>0){
   const x=make(r,i,q);
   x._rawQty=q;
   out.push(x);
  }
 });
 return out.filter(x=>!excludedItems.has(x.id));
}

function hierarchyMeta(i){
 const h=i.hierarchy||[];
 return{
  groupKey:slug(h[0]||'other'),
  groupTitle:h[0]||'Other Works'
 };
}

function legacyItems(){
 return build().map(i=>{
  const meta=hierarchyMeta(i);
  return{
   ...i,
   qty:isIntegerUnit(i.unit)?ceil(i.qty):round(i.qty),
   rate:round(i.rate),
   amount:round(i.qty*i.rate),
   groupKey:meta.groupKey,
   groupTitle:meta.groupTitle
  };
 });
}

function quotationData(){
 const all=legacyItems();
 const baseRooms=rooms();
 const archByRoom={};
 const roomSubtotals={};
 baseRooms.forEach(r=>{archByRoom[r.roomId]=[];roomSubtotals[r.roomId]=0});
 const projectArch=all.filter(i=>i.category==='architectures');
 projectArch.forEach(i=>{
  const id=i.roomId||'project';
  if(!archByRoom[id])archByRoom[id]=[];
  archByRoom[id].push(i);
  roomSubtotals[id]=(roomSubtotals[id]||0)+i.amount;
 });
 const synthetic=projectArch.some(i=>!baseRooms.some(r=>r.roomId===i.roomId))?{
  roomId:'project-works',label:'Project / General Works',area:0,roomType:'project'
 }:null;
 const qRooms=synthetic?[...baseRooms,synthetic]:baseRooms;
 if(synthetic){archByRoom[synthetic.roomId]=projectArch.filter(i=>i.roomId==='project');roomSubtotals[synthetic.roomId]=archByRoom[synthetic.roomId].reduce((s,i)=>s+i.amount,0)}
 return{
  allItems:all,
  rooms:qRooms,
  prelim:all.filter(i=>i.category==='preliminaries'),
  structures:all.filter(i=>i.category==='structures'),
  electrical:all.filter(i=>i.category==='electrical'),
  archByRoom,
  roomSubtotals,
  total:all.reduce((s,i)=>s+i.amount,0)
 };
}

function render(items){
 const c=ctx();
 const declared=n(document.getElementById('builtUpArea')?.value);
 const ra=c.rs.reduce((s,r)=>s+r.area,0);
 const total=items.reduce((s,i)=>s+i.amount,0);
 const el=document.getElementById('estimateContent');
 lastItems=items;
 if(!el)return;
 const summary=document.getElementById('customerSummary');
 if(summary){
  const customer=document.getElementById('customerName')?.value||'Not specified';
  const location=document.getElementById('projectLocation')?.value||'Not specified';
  summary.innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceil(declared||ra)} sqft declared · ${ceil(ra)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;
 }
 const groups=[];
 for(const i of items){
  const name=String(i.category||'').toUpperCase();
  let g=groups.find(x=>x.name===name);
  if(!g){g={name,nodes:[]};groups.push(g)}
  let node=g;
  for(const name of(i.hierarchy||[])){
   let q=node.nodes.find(x=>x.name===name);
   if(!q){q={name,nodes:[],items:[]};node.nodes.push(q)}
   node=q;
  }
  node.items.push(i);
 }
 const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(i.description)}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2 text-right">${ceil(i.qty)}</td><td class="py-3 px-2 text-right">${round(i.rate).toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td></tr>`;
 const head=t=>`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(t)}</td></tr>`;
 const sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`;
 const walk=(ns,l=0)=>ns.map(x=>sub(x.name,l)+x.items.map(row).join('')+walk(x.nodes,l+1)).join('');
 let h='<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col style="width:48%"><col style="width:10%"><col style="width:10%"><col style="width:16%"><col style="width:16%"></colgroup><thead><tr class="border-b-2 text-left"><th class="py-3 px-2">Description</th><th class="py-3 px-2">Unit</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>';
 groups.forEach(g=>h+=head(g.name)+walk(g.nodes));
 h+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td></tr></tfoot></table></div>`;
 el.innerHTML=h;
 const gt=document.getElementById('grandTotal');if(gt)gt.textContent=round(total).toFixed(2);
 const tb=document.getElementById('totalBuiltArea');if(tb)tb.textContent=ceil(declared||ra)+' sqft';
 const rt=document.getElementById('roomsTotalArea');if(rt)rt.textContent=ceil(ra)+' sqft';
}

function rerender(){render(build())}

function syncBuiltUpArea(){
 const total=ctx().rs.reduce((s,r)=>s+r.area,0);
 const el=document.getElementById('builtUpArea');
 if(el&&document.querySelector('#roomsContainer .room-card')){
  el.value=String(ceil(total));
  el.readOnly=true;
  el.classList.add('bg-gray-100');
  el.title='Automatically calculated from the total area/room schedule.';
 }
}

function fullRecalculate(){syncBuiltUpArea();rerender()}

window.editItemQuantity=(id,v)=>{customQuantities.set(id,n(v));fullRecalculate()};
window.editItemRate=(id,v)=>{customRates.set(id,n(v));fullRecalculate()};
window.editItemDescription=(id,v)=>{customDescriptions.set(id,String(v));fullRecalculate()};
window.excludeItem=id=>{excludedItems.add(id);fullRecalculate()};
window.terajuBuildPlannerRecalculate=fullRecalculate;

/*
 * V2 owns calculation data from this point forward.
 * Legacy Build Planner functions remain callable by the page UI, but their
 * calculation source is redirected to the exact V2 item set. No second
 * formula/rate engine is allowed to generate quotation data.
 */
window.getAllItems=()=>legacyItems();
window.getCurrentQuotationData=()=>quotationData();
window.updateEstimate=()=>fullRecalculate();

function observeRoomLifecycle(){
 const root=document.getElementById('roomsContainer');
 if(!root)return;
 let raf=0;
 const schedule=()=>{
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>fullRecalculate());
 };
 new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
}

async function init(){
 try{
  const a=await fetch(RULES_URL,{cache:'no-store'});
  if(!a.ok)throw Error('Calculation Rules unavailable');
  const t=await a.text();
  const m=t.match(/const\s+rules\s*=\s*(\[[\s\S]*?\]);/);
  if(!m)throw Error('Calculation Rules data not found');
  rules=Function('return '+m[1])().filter(r=>r&&r.group&&r.path&&r.description&&r.output);

  try{
   const b=await fetch(RATES_URL,{cache:'no-store'});
   if(b.ok){const j=await b.json();rates=j?.rates||j||{}}
  }catch(e){}
  if(!Object.keys(rates).length)try{
   const b=await fetch(DEFAULT_RATES_URL,{cache:'no-store'});
   if(b.ok)rates=(await b.json())?.rates||{}
  }catch(e){}

  observeRoomLifecycle();
  fullRecalculate();

  document.addEventListener('input',e=>{
   if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(fullRecalculate)
  },{passive:true});
  document.addEventListener('change',e=>{
   if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(fullRecalculate)
  },{passive:true});
 }catch(e){console.error('TERAJU Build Planner V2:',e)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();