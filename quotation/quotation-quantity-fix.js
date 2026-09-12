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
const integerUnit=u=>['no','set','ls','unit'].includes(String(u||'').toLowerCase());

let rules=[];
let rates={};
let lastItems=[];
const customQuantities=new Map();
const customRates=new Map();
const customDescriptions=new Map();
const excludedItems=new Set();

function roomType(v){
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
 return [...document.querySelectorAll('#roomsContainer .room-card,.room-card')].map((card,i)=>{
  const sel=card.querySelector('select');
  const opt=sel?.selectedOptions?.[0];
  const inputs=[...card.querySelectorAll('input')];
  const areaInput=inputs.find(x=>x.type==='number'&&n(x.value)>0)||inputs.find(x=>x.type==='number');
  if(!areaInput)return null;
  const textInput=inputs.find(x=>x.type!=='number'&&x.type!=='hidden');
  const raw=`${sel?.value||''} ${opt?.textContent||''}`;
  const area=n(areaInput.value);
  if(area<=0)return null;
  return{
   roomId:card.dataset.roomId||String(i+1),
   label:String(textInput?.value||opt?.textContent||`Area ${i+1}`).trim(),
   area,
   roomType:roomType(raw)
  };
 }).filter(Boolean);
}

function baseRooms(){
 let candidate=[];
 if(typeof window.getRoomGroupsBase==='function'){
  try{
   const a=window.getRoomGroupsBase();
   if(Array.isArray(a))candidate=a.map((r,i)=>({
    ...r,
    roomId:r.roomId||String(i+1),
    label:String(r.label||r.roomName||r.name||`Area ${i+1}`).trim(),
    area:n(r.area),
    roomType:roomType(r.roomType||r.type||r.label)
   })).filter(r=>r.area>0);
  }catch(e){candidate=[];}
 }
 const dom=domRooms();
 const candidateTotal=candidate.reduce((s,r)=>s+r.area,0);
 const domTotal=dom.reduce((s,r)=>s+r.area,0);
 return domTotal>0&&(candidateTotal<=0||Math.abs(candidateTotal-domTotal)>0.01)?dom:(candidateTotal>0?candidate:dom);
}

function context(){
 const rs=baseRooms();
 const main=rs.filter(r=>r.roomType!=='porch');
 const porch=rs.filter(r=>r.roomType==='porch');
 const bath=main.filter(r=>r.roomType==='bathroom');
 const bed=main.filter(r=>r.roomType==='bedroom');
 const kitchen=main.filter(r=>r.roomType==='kitchen');
 const livingDining=main.filter(r=>['living','dining'].includes(r.roomType));
 const A=main.reduce((s,r)=>s+r.area,0);
 const P=porch.reduce((s,r)=>s+r.area,0);
 const B=bath.reduce((s,r)=>s+r.area,0);
 return{rs,main,porch,bath,bed,kitchen,livingDining,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};
}

function ruleKey(r,i){return`rule_${slug(r.path)}_${i}`;}
function ruleRate(r,i){
 const k=ruleKey(r,i);
 const dk=`rule_${slug(r.description)}_${i}`;
 if(Object.prototype.hasOwnProperty.call(rates,k))return round(rates[k]);
 if(Object.prototype.hasOwnProperty.call(rates,dk))return round(rates[dk]);
 return 0;
}

function quantity(r,c,out){
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
  case'FIXED PER KITCHEN':return c.kitchen.length;
  case'FIXED PER BEDROOM':return c.bed.length;
  case'FIXED PER BATHROOM':return c.bath.length;
  case'FIXED PER ROOM':return c.main.length*k;
  case'FIXED PER PORCH':return c.porch.length;
  case'FIXED PER ELIGIBLE AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER DESIGNATED AREA':return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
  case'FIXED PER APPLICABLE LOCATION':
   if(/doors\s*\/.*type 1/i.test(l))return c.main.filter(x=>['living','bedroom','kitchen','family','dining'].includes(x.roomType)).length;
   if(/doors\s*\/.*type 2/i.test(l))return c.livingDining.length;
   if(/doors\s*\/.*type 3/i.test(l))return c.bath.length;
   if(/doors\s*\/.*type 4/i.test(l))return c.main.length?1:0;
   if(/windows\s*\/.*type 1/i.test(l))return c.bed.length;
   if(/windows\s*\/.*type 2/i.test(l))return c.kitchen.length;
   if(/windows\s*\/.*type 3/i.test(l))return c.bath.length;
   return 0;
  case'AREA ALLOWANCE':return(porch?c.porch:c.main).reduce((s,x)=>s+Math.ceil(x.area/100),0);
  case'AREA / COEFFICIENT':
  case'BASELINE COEFFICIENT':
  case'COEFFICIENT':return A*k;
  case'SAME AS MAIN BUILDING':return A*k;
  case'THICKNESS':
  case'LAYER':
  case'AREA':return AM*k;
  case'POUNDAGE':{
   const parent=parts(p).slice(0,-1).join(' / ').toLowerCase();
   const concrete=out.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===parent&&/concrete/i.test(i.path));
   return concrete?n(concrete._rawQty||concrete.qty)*k:0;
  }
  case'DEPENDENCY':
   if(/floor tiles\s*\/\s*internal|internal floor tiles/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/floor tiles\s*\/\s*external|external floor tiles/i.test(l))return c.PM;
   if(/ceiling\s*\/\s*internal|internal ceiling/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/ceiling\s*\/\s*external|external ceiling/i.test(l))return c.PM;
   if(/painting\s*\/\s*internal|internal painting/i.test(l)){const x=out.find(i=>/internal wall/i.test(i.path));return x?n(x._rawQty||x.qty):0;}
   if(/painting\s*\/\s*external|external painting/i.test(l)){const x=out.find(i=>/external wall/i.test(i.path));return x?n(x._rawQty||x.qty):0;}
   if(/drainage|external drain/i.test(l))return c.P*k;
   return 0;
  case'PERIMETER × HEIGHT':
   if(/bathroom/i.test(l))return c.bath.reduce((s,x)=>s+4*Math.sqrt(x.area),0)*k;
   return 0;
  case'ROOF GEOMETRY':
  case'OVERHANG AREA × THICKNESS':return AM*k;
  default:return 0;
 }
}

function makeItem(r,i,q,extra={}){
 const hierarchy=parts(r.path).slice(1,-1);
 const id=`rule-item-${i}${extra.roomId&&extra.roomId!=='project'?`-${String(extra.roomId).replace(/[^a-zA-Z0-9_-]/g,'_')}`:''}`;
 const item={
  id,ruleIndex:i,ruleKey:ruleKey(r,i),rule:r,
  category:String(r.group).toLowerCase(),
  description:r.description,unit:r.output,
  qty:ceil(q),rate:ruleRate(r,i),amount:0,
  path:r.path,hierarchy,roomId:extra.roomId||'project',room:extra.room||'Project'
 };
 if(customQuantities.has(id))item.qty=ceil(customQuantities.get(id));
 if(customRates.has(id))item.rate=round(customRates.get(id));
 if(customDescriptions.has(id))item.description=customDescriptions.get(id);
 item.amount=round(item.qty*item.rate);
 return item;
}

function build(){
 const c=context(),out=[];
 for(let i=0;i<rules.length;i++){
  const r=rules[i];
  if(!r||!r.group||!r.path||!r.description||!r.output)continue;
  const M=String(r.method||'').toUpperCase().trim();
  const raw=JSON.stringify(r).toLowerCase();
  const p=String(r.path||'').toLowerCase();
  if(!M||/retired|review|c-channel/.test(raw))continue;

  if(M==='FIXED PER BATHROOM'){
   c.bath.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));
   continue;
  }
  if(M==='FIXED PER BEDROOM'){
   c.bed.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));
   continue;
  }
  if(M==='FIXED PER KITCHEN'){
   c.kitchen.forEach(b=>out.push(makeItem(r,i,1,{roomId:b.roomId,room:b.label})));
   continue;
  }
  if(r.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(p)){
   c.bath.forEach(b=>{
    const q=/wall tiles/i.test(p)?4*Math.sqrt(b.area)*n(r.coeff):m2(b.area)*n(r.coeff);
    if(q>0)out.push(makeItem(r,i,q,{roomId:b.roomId,room:b.label}));
   });
   continue;
  }
  const q=quantity(r,c,out);
  if(q>0){
   const item=makeItem(r,i,q);
   item._rawQty=q;
   out.push(item);
  }
 }
 return out.filter(x=>!excludedItems.has(x.id));
}

function legacyItems(){
 return build().map(i=>({
  ...i,
  qty:integerUnit(i.unit)?ceil(i.qty):round(i.qty),
  rate:round(i.rate),
  amount:round(i.qty*i.rate),
  groupKey:slug((i.hierarchy||[])[0]||'other'),
  groupTitle:(i.hierarchy||[])[0]||'Other Works'
 }));
}

function quotationData(){
 const all=legacyItems();
 const base=baseRooms();
 const archByRoom={};
 const roomSubtotals={};
 base.forEach(r=>{archByRoom[r.roomId]=[];roomSubtotals[r.roomId]=0;});
 const arch=all.filter(i=>i.category==='architectures');
 arch.forEach(i=>{
  const id=i.roomId||'project';
  if(!archByRoom[id])archByRoom[id]=[];
  archByRoom[id].push(i);
  roomSubtotals[id]=(roomSubtotals[id]||0)+i.amount;
 });
 const projectItems=arch.filter(i=>i.roomId==='project');
 if(projectItems.length){
  archByRoom['project-works']=projectItems;
  roomSubtotals['project-works']=projectItems.reduce((s,i)=>s+i.amount,0);
 }
 const synthetic=projectItems.length?[...base,{roomId:'project-works',label:'Project / General Works',area:0,roomType:'project'}]:base;
 return{allItems:all,rooms:synthetic,prelim:all.filter(i=>i.category==='preliminaries'),structures:all.filter(i=>i.category==='structures'),electrical:all.filter(i=>i.category==='electrical'),archByRoom,roomSubtotals,total:all.reduce((s,i)=>s+i.amount,0)};
}

function render(items){
 const c=context();
 const declared=n(document.getElementById('builtUpArea')?.value);
 const roomArea=c.rs.reduce((s,r)=>s+r.area,0);
 const total=items.reduce((s,i)=>s+i.amount,0);
 lastItems=items;
 const el=document.getElementById('estimateContent');
 if(!el)return;
 const summary=document.getElementById('customerSummary');
 if(summary){
  const customer=document.getElementById('customerName')?.value||'Not specified';
  const location=document.getElementById('projectLocation')?.value||'Not specified';
  summary.innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceil(declared||roomArea)} sqft declared · ${ceil(roomArea)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;
 }
 const groups=[];
 for(const item of items){
  const name=String(item.category||'').toUpperCase();
  let group=groups.find(x=>x.name===name);
  if(!group){group={name,nodes:[]};groups.push(group);}
  let node=group;
  for(const name of(item.hierarchy||[])){
   let child=node.nodes.find(x=>x.name===name);
   if(!child){child={name,nodes:[],items:[]};node.nodes.push(child);}
   node=child;
  }
  node.items.push(item);
 }
 const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(i.description)}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2 text-right">${ceil(i.qty)}</td><td class="py-3 px-2 text-right">${round(i.rate).toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td></tr>`;
 const head=t=>`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(t)}</td></tr>`;
 const sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`;
 const walk=(nodes,l=0)=>nodes.map(x=>sub(x.name,l)+x.items.map(row).join('')+walk(x.nodes,l+1)).join('');
 let html='<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col style="width:48%"><col style="width:10%"><col style="width:10%"><col style="width:16%"><col style="width:16%"></colgroup><thead><tr class="border-b-2 text-left"><th class="py-3 px-2">Description</th><th class="py-3 px-2">Unit</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>';
 groups.forEach(g=>html+=head(g.name)+walk(g.nodes));
 html+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td></tr></tfoot></table></div>`;
 el.innerHTML=html;
 const gt=document.getElementById('grandTotal');if(gt)gt.textContent=round(total).toFixed(2);
 const tb=document.getElementById('totalBuiltArea');if(tb)tb.textContent=`${ceil(declared||roomArea)} sqft`;
 const rt=document.getElementById('roomsTotalArea');if(rt)rt.textContent=`${ceil(roomArea)} sqft`;
}

function syncBuiltUpArea(){
 const total=context().rs.reduce((s,r)=>s+r.area,0);
 const el=document.getElementById('builtUpArea');
 if(el&&document.querySelector('#roomsContainer .room-card')){
  el.value=String(ceil(total));
  el.readOnly=true;
  el.classList.add('bg-gray-100');
  el.title='Automatically calculated from the total area/room schedule.';
 }
}
function recalculate(){syncBuiltUpArea();render(build());}

window.editItemQuantity=(id,v)=>{customQuantities.set(id,n(v));recalculate();};
window.editItemRate=(id,v)=>{customRates.set(id,n(v));recalculate();};
window.editItemDescription=(id,v)=>{customDescriptions.set(id,String(v));recalculate();};
window.excludeItem=id=>{excludedItems.add(id);recalculate();};
window.terajuBuildPlannerRecalculate=recalculate;
window.getAllItems=()=>legacyItems();
window.getCurrentQuotationData=()=>quotationData();
window.updateEstimate=()=>recalculate();

function observeRoomLifecycle(){
 const root=document.getElementById('roomsContainer');
 if(!root)return;
 let raf=0;
 const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(recalculate);};
 new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
}

function extractRules(text){
 const marker=/const\s+rules\s*=\s*\[/g;
 const startMatch=marker.exec(text);
 if(!startMatch)throw Error('Calculation Rules data not found');
 const start=startMatch.index+startMatch[0].lastIndexOf('[');
 let depth=0,inString=false,quote='',escape=false;
 for(let i=start;i<text.length;i++){
  const ch=text[i];
  if(inString){
   if(escape){escape=false;continue;}
   if(ch==='\\'){escape=true;continue;}
   if(ch===quote)inString=false;
   continue;
  }
  if(ch==='\''||ch==='\"'||ch==='`'){inString=true;quote=ch;continue;}
  if(ch==='[')depth++;
  else if(ch===']'){
   depth--;
   if(depth===0)return Function(`\"use strict\";return ${text.slice(start,i+1)}`)();
  }
 }
 throw Error('Calculation Rules array is incomplete');
}

async function init(){
 try{
  const response=await fetch(`${RULES_URL}?v=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw Error(`Calculation Rules unavailable (${response.status})`);
  rules=extractRules(await response.text()).filter(r=>r&&r.group&&r.path&&r.description&&r.output);
  if(!rules.length)throw Error('Calculation Rules loaded but contains no eligible rules');

  try{
   const rr=await fetch(`${RATES_URL}?v=${Date.now()}`,{cache:'no-store'});
   if(rr.ok){const data=await rr.json();rates=data?.rates||data||{};}
  }catch(e){}
  if(!Object.keys(rates).length)try{
   const rr=await fetch(`${DEFAULT_RATES_URL}?v=${Date.now()}`,{cache:'no-store'});
   if(rr.ok){const data=await rr.json();rates=data?.rates||{};}
  }catch(e){}

  observeRoomLifecycle();
  recalculate();
  document.addEventListener('input',e=>{if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(recalculate);},{passive:true});
  document.addEventListener('change',e=>{if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(recalculate);},{passive:true});
 }catch(error){
  console.error('TERAJU Build Planner V2:',error);
  const el=document.getElementById('estimateContent');
  if(el)el.innerHTML=`<div style="padding:16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-weight:600">Calculation engine error: ${esc(error.message||error)}</div>`;
 }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
