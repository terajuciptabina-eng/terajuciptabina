(()=>{'use strict';
if(!/buildplanner-v2\.html/i.test(location.pathname))return;
const RULES_URL='calculation-rules.html', RATES_URL='https://terajuciptabina.vercel.app/api/rates', DEFAULT_RATES_URL='../data/rates/default.json';
const num=v=>Number(v)||0, ceil=v=>Math.max(0,Math.ceil(num(v))), round=v=>Math.round(num(v)*100)/100, m2=v=>num(v)*0.09290304;
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const parts=v=>String(v||'').split('/').map(s=>s.trim()).filter(Boolean), slug=v=>String(v||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
let rules=[],rates={},busy=false,rendering=false,expectedMarker='',observer=null;
const customQty=new Map(),customRate=new Map(),customDesc=new Map(),excluded=new Set();
function roomType(v){const s=String(v||'').toLowerCase();if(/porch|car porch|entrance/.test(s))return'porch';if(/bath/.test(s))return'bathroom';if(/bed/.test(s))return'bedroom';if(/kitchen/.test(s))return'kitchen';if(/living|family/.test(s))return'living';if(/dining/.test(s))return'dining';return s.replace(/[^a-z0-9]+/g,'_')||'other';}
function rooms(){return [...document.querySelectorAll('#roomsContainer .room-card')].map((card,i)=>{const sel=card.querySelector('.room-type')||card.querySelector('select');const areaEl=card.querySelector('.room-area')||card.querySelector('input[type=number]');const area=num(areaEl?.value);if(area<=0)return null;const name=card.querySelector('.room-name');return{roomId:card.id||String(i+1),label:String(name?.value||sel?.selectedOptions?.[0]?.textContent||`Area ${i+1}`).trim(),area,type:roomType(sel?.value||sel?.selectedOptions?.[0]?.textContent)};}).filter(Boolean);}
function ctx(){const rs=rooms(),porch=rs.filter(r=>r.type==='porch'),main=rs.filter(r=>r.type!=='porch'),bath=main.filter(r=>r.type==='bathroom'),bed=main.filter(r=>r.type==='bedroom'),kit=main.filter(r=>r.type==='kitchen'),A=main.reduce((s,r)=>s+r.area,0),P=porch.reduce((s,r)=>s+r.area,0),B=bath.reduce((s,r)=>s+r.area,0);return{rs,main,porch,bath,bed,kit,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};}
function key(r,i){return `rule_${slug(r.path)}_${i}`;}
function rate(r,i){const ks=[key(r,i),`rule_${slug(r.description)}_${i}`];for(const k of ks)if(Object.prototype.hasOwnProperty.call(rates,k))return round(rates[k]);return 0;}
function perimeterM(a){return 4*Math.sqrt(Math.max(0,num(a)))*0.3048;}
function qty(r,c,out){const method=String(r.method||'').toUpperCase().trim(),p=String(r.path||''),l=p.toLowerCase(),k=num(r.coeff),porch=/^porch\s*\//i.test(p),A=porch?c.P:c.A,AM=porch?c.PM:c.AM;
 switch(method){
  case'FIXED PER PROJECT':case'FIXED PROJECT':return c.A>0?1:0;
  case'FIXED PER BATHROOM':return c.bath.length;
  case'FIXED PER BEDROOM':return c.bed.length;
  case'FIXED PER KITCHEN':return c.kit.length;
  case'FIXED PER PORCH':return c.porch.length;
  case'FIXED PER ROOM':return c.main.length*(k||1);
  case'FIXED PER ELIGIBLE AREA':case'FIXED PER DESIGNATED AREA':return c.main.filter(x=>!['bathroom','kitchen'].includes(x.type)).length*(k||1);
  case'FIXED PER APPLICABLE LOCATION':
   if(/door.*type 1|type 1.*door/i.test(l))return c.main.filter(x=>['living','bedroom','kitchen','dining'].includes(x.type)).length;
   if(/door.*type 2|type 2.*door/i.test(l))return c.main.filter(x=>['living','dining'].includes(x.type)).length;
   if(/door.*type 3|type 3.*door/i.test(l))return c.bath.length;
   if(/door.*type 4|type 4.*door/i.test(l))return c.main.length?1:0;
   if(/window.*type 1|type 1.*window/i.test(l))return c.bed.length;
   if(/window.*type 2|type 2.*window/i.test(l))return c.kit.length;
   if(/window.*type 3|type 3.*window/i.test(l))return c.bath.length;
   return 0;
  case'AREA ALLOWANCE':return (porch?c.porch:c.main).reduce((s,x)=>s+Math.ceil(x.area/100),0)*(k||1);
  case'AREA / COEFFICIENT':case'BASELINE COEFFICIENT':case'COEFFICIENT':return A*k;
  case'SAME AS MAIN BUILDING':return A*k;
  case'THICKNESS':case'LAYER':case'AREA':return AM*k;
  case'PERIMETER × THICKNESS':return /apron/i.test(l)?perimeterM(c.A)*k:0;
  case'PERIMETER × HEIGHT':return /bathroom/i.test(l)?c.bath.reduce((s,b)=>s+perimeterM(b.area)*10*0.3048,0):0;
  case'POUNDAGE':{const parent=parts(p).slice(0,-1).join(' / ').toLowerCase();const x=out.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===parent&&/concrete/i.test(i.path));return x?num(x._rawQty||x.qty)*k:0;}
  case'DEPENDENCY':
   if(/floor tiles.*internal|internal floor tiles/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/floor tiles.*external|external floor tiles/i.test(l))return c.PM;
   if(/ceiling.*internal|internal ceiling/i.test(l))return Math.max(0,c.AM-c.BM);
   if(/ceiling.*external|external ceiling/i.test(l))return c.PM;
   if(/painting.*internal|internal painting/i.test(l)){const x=out.find(i=>/internal wall/i.test(i.path));return x?num(x._rawQty||x.qty):0;}
   if(/painting.*external|external painting/i.test(l)){const x=out.find(i=>/external wall/i.test(i.path));return x?num(x._rawQty||x.qty):0;}
   if(/drainage|external drain/i.test(l))return perimeterM(c.A)*k;
   return 0;
  case'ROOF GEOMETRY':case'OVERHANG AREA × THICKNESS':return AM*k;
  default:return 0;
 }}
function item(r,i,q,extra={}){const id=`rule-item-${i}${extra.roomId?`-${String(extra.roomId).replace(/[^a-zA-Z0-9_-]/g,'_')}`:''}`,o={id,ruleIndex:i,ruleKey:key(r,i),rule:r,category:String(r.group).toLowerCase(),description:r.description,unit:r.output,qty:ceil(q),rate:rate(r,i),amount:0,path:r.path,hierarchy:parts(r.path).slice(1,-1),roomId:extra.roomId||'project',room:extra.room||'Project'};if(customQty.has(id))o.qty=ceil(customQty.get(id));if(customRate.has(id))o.rate=round(customRate.get(id));if(customDesc.has(id))o.description=customDesc.get(id);o.amount=round(o.qty*o.rate);o._rawQty=q;return o;}
function build(){const c=ctx(),out=[];for(let i=0;i<rules.length;i++){const r=rules[i];if(!r||!r.group||!r.path||!r.description||!r.output||!r.method)continue;const method=String(r.method).toUpperCase().trim(),p=String(r.path).toLowerCase();
  if(method==='FIXED PER BATHROOM'||method==='FIXED PER BEDROOM'||method==='FIXED PER KITCHEN'){const list=method.includes('BATHROOM')?c.bath:method.includes('BEDROOM')?c.bed:c.kit;list.forEach(x=>out.push(item(r,i,1,{roomId:x.roomId,room:x.label})));continue;}
  if(r.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(p)){c.bath.forEach(b=>{let q=/wall tiles/i.test(p)?perimeterM(b.area)*10*0.3048:m2(b.area);q*=num(r.coeff)||1;if(q>0)out.push(item(r,i,q,{roomId:b.roomId,room:b.label}));});continue;}
  const q=qty(r,c,out);if(q>0)out.push(item(r,i,q));
 }return out.filter(x=>!excluded.has(x.id));}
function groupTitle(group){const g=String(group||'').toUpperCase();return g==='STRUCTURES'?'STRUCTURAL WORKS':g==='ARCHITECTURES'?'ARCHITECTURAL WORKS':g==='ELECTRICAL'?'ELECTRICAL WORKS':g;}
function render(items){const c=ctx(),el=document.getElementById('estimateContent');if(!el)return;rendering=true;try{const roomArea=c.rs.reduce((s,r)=>s+r.area,0),declared=num(document.getElementById('builtUpArea')?.value),total=items.reduce((s,i)=>s+i.amount,0);const summary=document.getElementById('customerSummary');if(summary){const customer=document.getElementById('customerName')?.value||'Not specified',location=document.getElementById('projectLocation')?.value||'Not specified';summary.innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceil(declared||roomArea)} sqft declared · ${ceil(roomArea)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;}
  const marker=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;expectedMarker=marker;el.setAttribute('data-teraju-v2-render',marker);
  if(!items.length){el.innerHTML='<div class="p-4 text-sm text-gray-500 border rounded-xl bg-gray-50">No calculation items were generated from Calculation Rules.</div>';}
  else{const groups=[];items.forEach(i=>{const name=groupTitle(i.category);let g=groups.find(x=>x.name===name);if(!g){g={name,nodes:[]};groups.push(g);}let n=g;(i.hierarchy||[]).forEach(s=>{let x=n.nodes.find(y=>y.name===s);if(!x){x={name:s,nodes:[],items:[]};n.nodes.push(x);}n=x;});n.items.push(i);});const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(i.description)}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2 text-right">${ceil(i.qty)}</td><td class="py-3 px-2 text-right">${round(i.rate).toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td></tr>`,sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`,walk=(nodes,l=0)=>nodes.map(x=>sub(x.name,l)+x.items.map(row).join('')+walk(x.nodes,l+1)).join('');let html='<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th></tr></thead><tbody>';groups.forEach(g=>{html+=`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(g.name)}</td></tr>`+walk(g.nodes);});html+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td></tr></tfoot></table></div>`;el.innerHTML=html;}
  document.getElementById('grandTotal')?.replaceChildren(document.createTextNode(round(total).toFixed(2)));const tb=document.getElementById('totalBuiltArea'),rt=document.getElementById('roomsTotalArea');if(tb)tb.textContent=`${ceil(declared||roomArea)} sqft`;if(rt)rt.textContent=`${ceil(roomArea)} sqft`;
 }finally{rendering=false;}}
function syncArea(){const c=ctx(),el=document.getElementById('builtUpArea');if(el&&c.rs.length){el.value=String(ceil(c.rs.reduce((s,r)=>s+r.area,0)));el.readOnly=true;}}
function recalc(){if(busy||!rules.length)return;busy=true;try{syncArea();render(build());}finally{busy=false;}}
function authority(){window.getAllItems=build;window.getCurrentQuotationData=()=>{const all=build(),rs=rooms();return{allItems:all,rooms:rs,total:all.reduce((s,i)=>s+i.amount,0)};};window.updateEstimate=recalc;window.terajuBuildPlannerRecalculate=recalc;window.editItemQuantity=(id,v)=>{customQty.set(id,num(v));recalc();};window.editItemRate=(id,v)=>{customRate.set(id,num(v));recalc();};window.editItemDescription=(id,v)=>{customDesc.set(id,String(v));recalc();};window.excludeItem=id=>{excluded.add(id);recalc();};window.restoreAllItems=()=>{excluded.clear();recalc();};}
function parseRules(text){const m=/const\s+rules\s*=\s*\[/.exec(text);if(!m)throw Error('Calculation Rules data not found');const start=m.index+m[0].lastIndexOf('[');let d=0,s=false,q='',e=false;for(let i=start;i<text.length;i++){const ch=text[i];if(s){if(e){e=false;continue;}if(ch==='\\'){e=true;continue;}if(ch===q)s=false;continue;}if(ch==='\''||ch==='"'||ch==='`'){s=true;q=ch;continue;}if(ch==='[')d++;else if(ch===']'){d--;if(!d)return Function(`"use strict";return ${text.slice(start,i+1)}`)();}}throw Error('Calculation Rules array is incomplete');}
async function loadRules(){const res=await fetch(`${RULES_URL}?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw Error(`Calculation Rules unavailable (${res.status})`);const r=parseRules(await res.text());rules=Array.isArray(r)?r.filter(x=>x&&x.group&&x.path&&x.description&&x.output&&x.method):[];if(!rules.length)throw Error('Calculation Rules contains no eligible rules');}
async function loadRates(){try{const a=await fetch(`${RATES_URL}?v=${Date.now()}`,{cache:'no-store'});if(a.ok){const d=await a.json();rates=d?.rates||d||{};}}catch{}if(Object.keys(rates).length)return;try{const a=await fetch(`${DEFAULT_RATES_URL}?v=${Date.now()}`,{cache:'no-store'});if(a.ok){const d=await a.json();rates=d?.rates||{};}}catch{}}
function protectOutput(){const el=document.getElementById('estimateContent');if(!el)return;if(observer)observer.disconnect();observer=new MutationObserver(()=>{if(rendering||busy)return;if(el.getAttribute('data-teraju-v2-render')!==expectedMarker){requestAnimationFrame(recalc);}});observer.observe(el,{childList:true,subtree:true,characterData:true});}
function bind(){const rec=()=>requestAnimationFrame(recalc);document.addEventListener('input',rec,false);document.addEventListener('change',rec,false);document.addEventListener('click',e=>{if(e.target.closest?.('#roomsContainer,#addRoomAreaBtn'))setTimeout(recalc,0);},false);const root=document.getElementById('roomsContainer');if(root)new MutationObserver(()=>setTimeout(recalc,0)).observe(root,{childList:true,subtree:true});protectOutput();}
async function init(){try{authority();await loadRules();await loadRates();bind();recalc();setTimeout(recalc,100);setTimeout(recalc,500);setTimeout(recalc,1500);}catch(e){console.error('TERAJU Build Planner V2',e);const el=document.getElementById('estimateContent');if(el)el.innerHTML=`<div style="padding:16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-weight:600">Calculation engine error: ${esc(e.message||e)}</div>`;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();