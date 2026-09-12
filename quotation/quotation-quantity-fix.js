(()=>{
'use strict';
if(!/buildplanner-v2\.html/i.test(location.pathname))return;

const RULES_URL='calculation-rules.html';
const RATES_URL='https://terajuciptabina.vercel.app/api/rates';
const DEFAULT_RATES_URL='../data/rates/default.json';
const n=v=>Number(v)||0;
const ceil=v=>Math.max(0,Math.ceil(n(v)));
const round=v=>Math.round(n(v)*100)/100;
const m2=v=>n(v)*0.09290304;
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
const parts=v=>String(v||'').split('/').map(s=>s.trim()).filter(Boolean);
const slug=v=>String(v||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

let rules=[];
let rates={};
let lastItems=[];
let busy=false;
const customQuantities=new Map();
const customRates=new Map();
const customDescriptions=new Map();
const excludedItems=new Set();

function roomType(value){
 const s=String(value||'').toLowerCase();
 if(/porch|car porch|entrance/.test(s))return'porch';
 if(/bath/.test(s))return'bathroom';
 if(/bed/.test(s))return'bedroom';
 if(/kitchen/.test(s))return'kitchen';
 if(/living|family/.test(s))return'living';
 if(/dining/.test(s))return'dining';
 return s.replace(/[^a-z0-9]+/g,'_')||'other';
}

function readRoomCard(card,index){
 const typeSelect=card.querySelector('.room-type')||card.querySelector('select');
 const typeValue=typeSelect?.value||typeSelect?.selectedOptions?.[0]?.textContent||'';
 const areaInput=card.querySelector('.room-area')||card.querySelector('input[type="number"]')||[...card.querySelectorAll('input')].find(x=>{const v=String(x.value||'').trim();return v!==''&&Number.isFinite(Number(v));});
 const area=n(areaInput?.value);
 if(area<=0)return null;
 const nameInput=card.querySelector('.room-name')||[...card.querySelectorAll('input')].find(x=>x!==areaInput&&x.type!=='hidden');
 const label=String(nameInput?.value||typeSelect?.selectedOptions?.[0]?.textContent||`Area ${index+1}`).trim()||`Area ${index+1}`;
 return{roomId:card.id||card.dataset.roomId||String(index+1),label,area,roomType:roomType(typeValue)};
}

function readRooms(){
 const cards=[...document.querySelectorAll('#roomsContainer .room-card')];
 const direct=cards.map(readRoomCard).filter(Boolean);
 if(direct.length)return direct;
 if(typeof window.getRoomGroupsBase==='function'){
  try{
   const base=window.getRoomGroupsBase();
   if(Array.isArray(base))return base.map((r,i)=>({roomId:r.roomId||r.id||String(i+1),label:String(r.label||r.roomName||r.name||`Area ${i+1}`).trim(),area:n(r.area),roomType:roomType(r.roomType||r.type||r.label)})).filter(r=>r.area>0);
  }catch(e){}
 }
 return[];
}

function context(){
 const rs=readRooms();
 const porch=rs.filter(r=>r.roomType==='porch');
 const main=rs.filter(r=>r.roomType!=='porch');
 const bath=main.filter(r=>r.roomType==='bathroom');
 const bed=main.filter(r=>r.roomType==='bedroom');
 const kitchen=main.filter(r=>r.roomType==='kitchen');
 const livingDining=main.filter(r=>['living','dining'].includes(r.roomType));
 const A=main.reduce((s,r)=>s+r.area,0),P=porch.reduce((s,r)=>s+r.area,0),B=bath.reduce((s,r)=>s+r.area,0);
 return{rs,main,porch,bath,bed,kitchen,livingDining,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};
}

function ruleKey(r,i){return`rule_${slug(r.path)}_${i}`;}
function ruleRate(r,i){
 const keys=[ruleKey(r,i),`rule_${slug(r.description)}_${i}`];
 for(const k of keys)if(Object.prototype.hasOwnProperty.call(rates,k))return round(rates[k]);
 return 0;
}

function areaPerimeterM(areaSqft){return 4*Math.sqrt(Math.max(0,n(areaSqft)))*0.3048;}

function quantity(r,c,out){
 const method=String(r.method||'').toUpperCase().trim();
 const path=String(r.path||'');
 const lower=path.toLowerCase();
 const k=n(r.coeff);
 const isPorch=/^porch\s*\//i.test(path);
 const A=isPorch?c.P:c.A;
 const AM=isPorch?c.PM:c.AM;
 switch(method){
  case'FIXED PROJECT':
  case'FIXED PER PROJECT':return c.A>0?1:0;
  case'FIXED PER KITCHEN':return c.kitchen.length;
  case'FIXED PER BEDROOM':return c.bed.length;
  case'FIXED PER BATHROOM':return c.bath.length;
  case'FIXED PER PORCH':return c.porch.length;
  case'FIXED PER ROOM':return c.main.length*k;
  case'FIXED PER ELIGIBLE AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER DESIGNATED AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER APPLICABLE LOCATION':
   if(/doors\s*\/.*type 1/i.test(lower))return c.main.filter(x=>['living','bedroom','kitchen','family','dining'].includes(x.roomType)).length;
   if(/doors\s*\/.*type 2/i.test(lower))return c.livingDining.length;
   if(/doors\s*\/.*type 3/i.test(lower))return c.bath.length;
   if(/doors\s*\/.*type 4/i.test(lower))return c.main.length?1:0;
   if(/windows\s*\/.*type 1/i.test(lower))return c.bed.length;
   if(/windows\s*\/.*type 2/i.test(lower))return c.kitchen.length;
   if(/windows\s*\/.*type 3/i.test(lower))return c.bath.length;
   return 0;
  case'AREA ALLOWANCE':return(isPorch?c.porch:c.main).reduce((s,x)=>s+Math.ceil(x.area/100),0);
  case'AREA / COEFFICIENT':
  case'BASELINE COEFFICIENT':
  case'COEFFICIENT':return A*k;
  case'SAME AS MAIN BUILDING':return A*k;
  case'THICKNESS':
  case'LAYER':
  case'AREA':return AM*k;
  case'PERIMETER × THICKNESS':{
   if(/apron/i.test(lower))return areaPerimeterM(c.A)*k;
   return 0;
  }
  case'POUNDAGE':{
   const parent=parts(path).slice(0,-1).join(' / ').toLowerCase();
   const concrete=out.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===parent&&/concrete/i.test(i.path));
   return concrete?n(concrete._rawQty||concrete.qty)*k:0;
  }
  case'DEPENDENCY':
   if(/floor tiles\s*\/\s*internal|internal floor tiles/i.test(lower))return Math.max(0,c.AM-c.BM);
   if(/floor tiles\s*\/\s*external|external floor tiles/i.test(lower))return c.PM;
   if(/ceiling\s*\/\s*internal|internal ceiling/i.test(lower))return Math.max(0,c.AM-c.BM);
   if(/ceiling\s*\/\s*external|external ceiling/i.test(lower))return c.PM;
   if(/painting\s*\/\s*internal|internal painting/i.test(lower)){const x=out.find(i=>/internal wall/i.test(i.path));return x?n(x._rawQty||x.qty):0;}
   if(/painting\s*\/\s*external|external painting/i.test(lower)){const x=out.find(i=>/external wall/i.test(i.path));return x?n(x._rawQty||x.qty):0;}
   if(/drainage|external drain/i.test(lower))return areaPerimeterM(c.A)*k;
   return 0;
  case'PERIMETER × HEIGHT':
   if(/bathroom/i.test(lower))return c.bath.reduce((s,x)=>s+areaPerimeterM(x.area)*10*0.3048,k*0).length?0:0;
   return 0;
  case'ROOF GEOMETRY':
  case'OVERHANG AREA × THICKNESS':return AM*k;
  default:return 0;
 }
}

function makeItem(r,i,q,extra={}){
 const id=`rule-item-${i}${extra.roomId?`-${String(extra.roomId).replace(/[^a-zA-Z0-9_-]/g,'_')}`:''}`;
 const item={id,ruleIndex:i,ruleKey:ruleKey(r,i),rule:r,category:String(r.group).toLowerCase(),description:r.description,unit:r.output,qty:ceil(q),rate:ruleRate(r,i),amount:0,path:r.path,hierarchy:parts(r.path).slice(1,-1),roomId:extra.roomId||'project',room:extra.room||'Project'};
 if(customQuantities.has(id))item.qty=ceil(customQuantities.get(id));
 if(customRates.has(id))item.rate=round(customRates.get(id));
 if(customDescriptions.has(id))item.description=customDescriptions.get(id);
 item.amount=round(item.qty*item.rate);item._rawQty=q;return item;
}

function build(){
 const c=context(),out=[];
 for(let i=0;i<rules.length;i++){
  const r=rules[i];if(!r||!r.group||!r.path||!r.description||!r.output)continue;
  const method=String(r.method||'').toUpperCase().trim(),path=String(r.path||'').toLowerCase();
  if(!method)continue;
  if(method==='FIXED PER BATHROOM'){c.bath.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));continue;}
  if(method==='FIXED PER BEDROOM'){c.bed.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));continue;}
  if(method==='FIXED PER KITCHEN'){c.kitchen.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));continue;}
  if(r.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(path)){
   c.bath.forEach(b=>{
    let q=0;
    if(/wall tiles/i.test(path))q=areaPerimeterM(b.area)*10*0.3048;
    else q=m2(b.area);
    q*=kSafe(r);
    if(q>0)out.push(makeItem(r,i,q,{roomId:b.roomId,room:b.label}));
   });
   continue;
  }
  const q=quantity(r,c,out);if(q>0)out.push(makeItem(r,i,q));
 }
 return out.filter(x=>!excludedItems.has(x.id));
}
function kSafe(r){return n(r.coeff)||1;}

function quotationData(){
 const all=build(),rooms=readRooms(),archByRoom={},roomSubtotals={};
 rooms.forEach(r=>{archByRoom[r.roomId]=[];roomSubtotals[r.roomId]=0;});
 all.filter(i=>i.category==='architectures').forEach(i=>{const id=i.roomId||'project';(archByRoom[id]??=[]).push(i);roomSubtotals[id]=(roomSubtotals[id]||0)+i.amount;});
 return{allItems:all,rooms,prelim:all.filter(i=>i.category==='preliminaries'),structures:all.filter(i=>i.category==='structures'),electrical:all.filter(i=>i.category==='electrical'),archByRoom,roomSubtotals,total:all.reduce((s,i)=>s+i.amount,0)};
}

function render(items){
 const c=context(),declared=n(document.getElementById('builtUpArea')?.value),roomArea=c.rs.reduce((s,r)=>s+r.area,0),total=items.reduce((s,i)=>s+i.amount,0),el=document.getElementById('estimateContent');
 if(!el)return;
 lastItems=items;
 const summary=document.getElementById('customerSummary');
 if(summary){const customer=document.getElementById('customerName')?.value||'Not specified',location=document.getElementById('projectLocation')?.value||'Not specified';summary.innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceil(declared||roomArea)} sqft declared · ${ceil(roomArea)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;}
 if(!items.length){el.innerHTML=`<div class="p-4 text-sm text-gray-500 border rounded-xl bg-gray-50">No calculation items were generated from Calculation Rules.</div>`;}
 else{
  const groups=[];
  items.forEach(item=>{const name=String(item.category||'').toUpperCase();let g=groups.find(x=>x.name===name);if(!g){g={name,nodes:[]};groups.push(g);}let node=g;(item.hierarchy||[]).forEach(name=>{let child=node.nodes.find(x=>x.name===name);if(!child){child={name,nodes:[],items:[]};node.nodes.push(child);}node=child;});node.items.push(item);});
  const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(i.description)}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2 text-right">${ceil(i.qty)}</td><td class="py-3 px-2 text-right">${round(i.rate).toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td></tr>`;
  const head=t=>`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(t)}</td></tr>`;
  const sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`;
  const walk=(nodes,l=0)=>nodes.map(x=>sub(x.name,l)+x.items.map(row).join('')+walk(x.nodes,l+1)).join('');
  let html='<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col style="width:48%"><col style="width:10%"><col style="width:10%"><col style="width:16%"><col style="width:16%"></colgroup><thead><tr class="border-b-2 text-left"><th class="py-3 px-2">Description</th><th class="py-3 px-2">Unit</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>';
  groups.forEach(g=>html+=head(g.name)+walk(g.nodes));
  html+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td></tr></tfoot></table></div>`;el.innerHTML=html;
 }
 document.getElementById('grandTotal')?.replaceChildren(document.createTextNode(round(total).toFixed(2)));
 const tb=document.getElementById('totalBuiltArea'),rt=document.getElementById('roomsTotalArea');if(tb)tb.textContent=`${ceil(declared||roomArea)} sqft`;if(rt)rt.textContent=`${ceil(roomArea)} sqft`;
}

function syncBuiltUpArea(){const total=context().rs.reduce((s,r)=>s+r.area,0),el=document.getElementById('builtUpArea');if(el&&total>0){el.value=String(ceil(total));el.readOnly=true;el.classList.add('bg-gray-100');}}
function recalculate(){if(busy||!rules.length)return;busy=true;try{syncBuiltUpArea();render(build());}finally{busy=false;}}

function installAuthority(){
 window.getAllItems=()=>build();
 window.getCurrentQuotationData=()=>quotationData();
 window.updateEstimate=()=>recalculate();
 window.editItemQuantity=(id,v)=>{customQuantities.set(id,n(v));recalculate();};
 window.editItemRate=(id,v)=>{customRates.set(id,n(v));recalculate();};
 window.editItemDescription=(id,v)=>{customDescriptions.set(id,String(v));recalculate();};
 window.excludeItem=id=>{excludedItems.add(id);recalculate();};
 window.restoreAllItems=()=>{excludedItems.clear();recalculate();};
 window.terajuBuildPlannerRecalculate=recalculate;
}

function parseRules(text){
 const marker=/const\s+rules\s*=\s*\[/,m=marker.exec(text);if(!m)throw Error('Calculation Rules data not found');
 const start=m.index+m[0].lastIndexOf('[');let depth=0,str=false,q='',escp=false;
 for(let i=start;i<text.length;i++){const ch=text[i];if(str){if(escp){escp=false;continue;}if(ch==='\\'){escp=true;continue;}if(ch===q)str=false;continue;}if(ch==='\''||ch==='\"'||ch==='`'){str=true;q=ch;continue;}if(ch==='[')depth++;else if(ch===']'){depth--;if(depth===0)return Function(`"use strict";return ${text.slice(start,i+1)}`)();}}
 throw Error('Calculation Rules array is incomplete');
}
async function loadRules(){
 const res=await fetch(`${RULES_URL}?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw Error(`Calculation Rules unavailable (${res.status})`);const parsed=parseRules(await res.text());if(!Array.isArray(parsed)||!parsed.length)throw Error('Calculation Rules loaded but contains no rules');rules=parsed.filter(r=>r&&r.group&&r.path&&r.description&&r.output&&r.method);if(!rules.length)throw Error('Calculation Rules contains no eligible rules');
}
async function loadRates(){
 try{const res=await fetch(`${RATES_URL}?v=${Date.now()}`,{cache:'no-store'});if(res.ok){const d=await res.json();rates=d?.rates||d||{};}}catch(e){}
 if(Object.keys(rates).length)return;
 try{const res=await fetch(`${DEFAULT_RATES_URL}?v=${Date.now()}`,{cache:'no-store'});if(res.ok){const d=await res.json();rates=d?.rates||{};}}catch(e){}
}

function bindAuthorityEvents(){
 const rec=()=>requestAnimationFrame(recalculate);
 document.addEventListener('input',rec,false);
 document.addEventListener('change',rec,false);
 document.addEventListener('click',e=>{if(e.target.closest?.('#roomsContainer,#addRoomAreaBtn'))setTimeout(recalculate,0);},false);
 const root=document.getElementById('roomsContainer');if(root)new MutationObserver(()=>setTimeout(recalculate,0)).observe(root,{childList:true,subtree:true});
}

async function init(){
 try{installAuthority();await loadRules();await loadRates();bindAuthorityEvents();recalculate();setTimeout(recalculate,100);setTimeout(recalculate,500);setTimeout(recalculate,1500);}
 catch(error){console.error('TERAJU Build Planner V2:',error);const el=document.getElementById('estimateContent');if(el)el.innerHTML=`<div style="padding:16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-weight:600">Calculation engine error: ${esc(error.message||error)}</div>`;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();