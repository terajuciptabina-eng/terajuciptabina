(()=>{
'use strict';
if(!/buildplanner-v2\.html/i.test(location.pathname)) return;

const RULES='calculation-rules.html';
const DEFAULT='../data/rates/default.json';
const N=v=>Number(v)||0;
const CEIL=v=>Math.max(0,Math.ceil(N(v)));
const R2=v=>Math.round(N(v)*100)/100;
const M2=v=>N(v)*0.09290304;
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const slug=v=>String(v||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const ROOM_TYPES={living:'Living / Family',dining:'Dining',bedroom:'Bedroom',kitchen:'Kitchen',store:'Store / Utility',bathroom:'Bathroom',porch:'Car Porch / Entrance',other:'Other'};
let rules=[];
let rates={};
let roomCounter=0;
let calculating=false;
const rateOverride=new Map();
const qtyOverride=new Map();
const descOverride=new Map();
const excluded=new Set();

function roomType(v){
  const s=String(v||'').toLowerCase();
  if(/porch|car\s*porch|entrance/.test(s)) return 'porch';
  if(/bath/.test(s)) return 'bathroom';
  if(/bed/.test(s)) return 'bedroom';
  if(/kitchen/.test(s)) return 'kitchen';
  if(/living|family/.test(s)) return 'living';
  if(/dining/.test(s)) return 'dining';
  if(/store|utility/.test(s)) return 'store';
  return 'other';
}
function roomOptions(){
  return Object.entries(ROOM_TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
}
function emptyState(){
  const c=document.getElementById('roomsContainer');
  const e=document.getElementById('roomsEmptyState');
  if(c&&e) e.classList.toggle('hidden',!!c.querySelector('.room-card'));
}
function addRoom(type='other',area='',id='',name=''){
  const c=document.getElementById('roomsContainer');
  if(!c) return null;
  roomCounter++;
  const rid=id||`room-${roomCounter}`;
  const d=document.createElement('div');
  d.id=rid;
  d.className='room-card border rounded-xl p-4 bg-gray-50';
  d.innerHTML=`<div class="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
    <div><label class="block text-sm font-medium mb-2">Room Type</label><select class="room-type w-full border rounded-lg px-4 py-3 bg-white">${roomOptions()}</select></div>
    <div><label class="block text-sm font-medium mb-2">Room / Area Name</label><input class="room-name w-full border rounded-lg px-4 py-3 bg-white" type="text"></div>
    <div><label class="block text-sm font-medium mb-2">Area (sqft)</label><input class="room-area w-full border rounded-lg px-4 py-3 bg-white" type="number" min="1" step="1"></div>
    <div class="no-print flex gap-2"><button type="button" class="border rounded-lg px-3 room-up">▲</button><button type="button" class="border rounded-lg px-3 room-down">▼</button><button type="button" class="border border-red-300 text-red-600 rounded-lg px-4 room-remove">Remove</button></div>
  </div>`;
  c.appendChild(d);
  const s=d.querySelector('.room-type');
  const n=d.querySelector('.room-name');
  const a=d.querySelector('.room-area');
  const rt=ROOM_TYPES[type]?type:'other';
  s.value=rt;
  n.value=name||ROOM_TYPES[rt]||'Area';
  a.value=area===''?'':String(area);
  s.addEventListener('change',()=>{if(!n.dataset.edited)n.value=ROOM_TYPES[s.value]||'Area';recalc();});
  n.addEventListener('input',()=>{n.dataset.edited='1';recalc();});
  a.addEventListener('input',recalc);
  d.querySelector('.room-remove').addEventListener('click',()=>removeRoom(rid));
  d.querySelector('.room-up').addEventListener('click',()=>moveRoom(rid,-1));
  d.querySelector('.room-down').addEventListener('click',()=>moveRoom(rid,1));
  emptyState();
  recalc();
  return rid;
}
function removeRoom(id){document.getElementById(id)?.remove();emptyState();recalc();}
function moveRoom(id,dir){
  const r=document.getElementById(id),c=document.getElementById('roomsContainer');
  if(!r||!c)return;
  if(dir<0&&r.previousElementSibling)c.insertBefore(r,r.previousElementSibling);
  if(dir>0&&r.nextElementSibling)c.insertBefore(r.nextElementSibling,r);
  recalc();
}
function rooms(){
  const c=document.getElementById('roomsContainer');
  if(!c)return[];
  return [...c.querySelectorAll('.room-card')].map((d,i)=>{
    const s=d.querySelector('.room-type'),n=d.querySelector('.room-name'),a=d.querySelector('.room-area');
    const area=N(a?.value);
    if(area<=0)return null;
    return {roomId:d.id||`room-${i+1}`,label:String(n?.value||s?.selectedOptions?.[0]?.textContent||`Area ${i+1}`).trim(),area,type:roomType(s?.value||n?.value)};
  }).filter(Boolean);
}
function context(){
  const rs=rooms();
  const porch=rs.filter(r=>r.type==='porch');
  const main=rs.filter(r=>r.type!=='porch');
  const bath=main.filter(r=>r.type==='bathroom');
  const bed=main.filter(r=>r.type==='bedroom');
  const kit=main.filter(r=>r.type==='kitchen');
  const A=main.reduce((s,r)=>s+r.area,0);
  const P=porch.reduce((s,r)=>s+r.area,0);
  const B=bath.reduce((s,r)=>s+r.area,0);
  return {rs,main,porch,bath,bed,kit,A,P,B,AM:M2(A),PM:M2(P),BM:M2(B)};
}
function ruleKey(rule,index){return `rule_${slug(rule.path)}_${index}`;}
function ruleRate(rule,index){return R2(rateOverride.get(ruleKey(rule,index))??rates[ruleKey(rule,index)]??0);}
function perimeter(area){return 4*Math.sqrt(Math.max(0,N(area)))*0.3048;}
function dependency(rule,c,out){
  const p=String(rule.path||'').toLowerCase();
  const k=N(rule.coeff)||1;
  if(/internal floor tiles|floor tiles.*internal/.test(p))return Math.max(0,c.AM-c.BM)*k;
  if(/external floor tiles|floor tiles.*external/.test(p))return c.PM*k;
  if(/internal ceiling|ceiling.*internal/.test(p))return Math.max(0,c.AM-c.BM)*k;
  if(/external ceiling|ceiling.*external/.test(p))return c.PM*k;
  if(/internal painting|painting.*internal/.test(p)){const q=out.find(x=>/internal wall/i.test(x.path));return q?N(q._rawQty)*k:0;}
  if(/external painting|painting.*external/.test(p)){const q=out.find(x=>/external wall/i.test(x.path));return q?N(q._rawQty)*k:0;}
  if(/drainage|external drain/.test(p))return perimeter(c.A)*k;
  return 0;
}
function calculate(rule,c,out){
  const m=String(rule.method||'').toUpperCase().trim();
  const p=String(rule.path||'');
  const l=p.toLowerCase();
  const k=N(rule.coeff);
  const porch=/^porch\s*\//i.test(p);
  const A=porch?c.P:c.A;
  const AM=porch?c.PM:c.AM;
  if(m==='FIXED PER PROJECT'||m==='FIXED PROJECT')return c.rs.length?1:0;
  if(m==='FIXED PER BATHROOM')return c.bath.length;
  if(m==='FIXED PER BEDROOM')return c.bed.length;
  if(m==='FIXED PER KITCHEN')return c.kit.length;
  if(m==='FIXED PER PORCH')return c.porch.length;
  if(m==='FIXED PER ROOM')return c.main.length*(k||1);
  if(m==='FIXED PER ELIGIBLE AREA'||m==='FIXED PER DESIGNATED AREA')return c.main.filter(r=>!['bathroom','kitchen'].includes(r.type)).length*(k||1);
  if(m==='FIXED PER APPLICABLE LOCATION'){
    if(/door.*type 1|type 1.*door/.test(l))return c.main.filter(r=>['living','bedroom','kitchen','dining'].includes(r.type)).length;
    if(/door.*type 2|type 2.*door/.test(l))return c.main.filter(r=>['living','dining'].includes(r.type)).length;
    if(/door.*type 3|type 3.*door/.test(l))return c.bath.length;
    if(/door.*type 4|type 4.*door/.test(l))return c.main.length?1:0;
    if(/window.*type 1|type 1.*window/.test(l))return c.bed.length;
    if(/window.*type 2|type 2.*window/.test(l))return c.kit.length;
    if(/window.*type 3|type 3.*window/.test(l))return c.bath.length;
    return 0;
  }
  if(m==='AREA ALLOWANCE')return (porch?c.porch:c.main).reduce((s,r)=>s+Math.ceil(r.area/100),0)*(k||1);
  if(m==='AREA / COEFFICIENT'||m==='BASELINE COEFFICIENT'||m==='COEFFICIENT'||m==='SAME AS MAIN BUILDING')return A*k;
  if(m==='THICKNESS'||m==='LAYER'||m==='AREA'||m==='ROOF GEOMETRY'||m==='OVERHANG AREA × THICKNESS')return AM*k;
  if(m==='PERIMETER × THICKNESS')return perimeter(A)*k;
  if(m==='PERIMETER × HEIGHT')return /bathroom/.test(l)?c.bath.reduce((s,r)=>s+perimeter(r.area)*10*0.3048,0):0;
  if(m==='POUNDAGE'){
    const parent=p.split('/').slice(0,-1).join('/').toLowerCase();
    const q=out.find(x=>x.path.toLowerCase().startsWith(parent)&&/concrete/.test(x.path.toLowerCase()));
    return q?N(q._rawQty)*k:0;
  }
  if(m==='DEPENDENCY')return dependency(rule,c,out);
  return 0;
}
function make(rule,index,q,extra={}){
  const id=`rule-item-${index}-${extra.roomId||'project'}`;
  const item={id,ruleIndex:index,ruleKey:ruleKey(rule,index),category:rule.group,description:descOverride.get(ruleKey(rule,index))??rule.description,unit:rule.output,qty:qtyOverride.has(id)?CEIL(qtyOverride.get(id)):CEIL(q),rate:ruleRate(rule,index),amount:0,path:rule.path,hierarchy:String(rule.path).split('/').map(s=>s.trim()).slice(1,-1),roomId:extra.roomId||'project',room:extra.room||'Project',_rawQty:q};
  item.amount=R2(item.qty*item.rate);
  return item;
}
function buildItems(){
  const c=context();
  const out=[];
  rules.forEach((rule,index)=>{
    if(!rule?.group||!rule?.path||!rule?.description||!rule?.output||!rule?.method)return;
    const m=String(rule.method).toUpperCase().trim();
    const p=String(rule.path||'').toLowerCase();
    if(/^FIXED PER BATHROOM$|^FIXED PER BEDROOM$|^FIXED PER KITCHEN$/.test(m)){
      const list=m.includes('BATHROOM')?c.bath:m.includes('BEDROOM')?c.bed:c.kit;
      list.forEach(r=>out.push(make(rule,index,1,{roomId:r.roomId,room:r.label})));
      return;
    }
    if(rule.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(p)){
      c.bath.forEach(r=>{
        let q=/wall tiles/i.test(p)?perimeter(r.area)*10*0.3048:M2(r.area);
        q*=N(rule.coeff)||1;
        if(q>0)out.push(make(rule,index,q,{roomId:r.roomId,room:r.label}));
      });
      return;
    }
    const q=calculate(rule,c,out);
    if(q>0)out.push(make(rule,index,q));
  });
  return out.filter(x=>!excluded.has(x.id));
}
function heading(g){
  g=String(g||'').toUpperCase();
  if(g==='PRELIMINARIES')return 'PROJECT / PRELIMINARIES';
  if(g==='STRUCTURES')return 'STRUCTURAL WORKS';
  if(g==='ARCHITECTURES')return 'ARCHITECTURAL WORKS';
  if(g==='ELECTRICAL')return 'ELECTRICAL WORKS';
  return g;
}
function render(items){
  const el=document.getElementById('estimateContent');
  if(!el)return;
  const c=context();
  const total=R2(items.reduce((s,x)=>s+x.amount,0));
  const groups=[];
  items.forEach(item=>{
    let g=groups.find(x=>x.name===heading(item.category));
    if(!g){g={name:heading(item.category),nodes:[],items:[]};groups.push(g);}
    let node=g;
    item.hierarchy.forEach(h=>{
      let n=node.nodes.find(x=>x.name===h);
      if(!n){n={name:h,nodes:[],items:[]};node.nodes.push(n);}
      node=n;
    });
    node.items.push(item);
  });
  const row=x=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(x.description)}${x.roomId!=='project'?`<div class="text-xs text-gray-500 mt-1">${esc(x.room)}</div>`:''}</td><td class="py-3 px-2">${esc(x.unit)}</td><td class="py-3 px-2 text-right">${CEIL(x.qty)}</td><td class="py-3 px-2 text-right">${x.rate.toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${x.amount.toFixed(2)}</td></tr>`;
  const walk=nodes=>nodes.map(n=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2">${esc(n.name)}</td></tr>${n.items.map(row).join('')}${walk(n.nodes)}`).join('');
  el.innerHTML=groups.length?`<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th></tr></thead><tbody>${groups.map(g=>`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(g.name)}</td></tr>${g.items.map(row).join('')}${walk(g.nodes)}`).join('')}</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${total.toFixed(2)}</td></tr></tfoot></table></div>`:'<div class="p-4 text-sm text-gray-500 border rounded-xl bg-gray-50">No calculation items were generated from Calculation Rules.</div>';
  const rt=document.getElementById('roomsTotalArea');
  const tb=document.getElementById('totalBuiltArea');
  const gt=document.getElementById('grandTotal');
  if(rt)rt.textContent=`${CEIL(c.rs.reduce((s,r)=>s+r.area,0))} sqft`;
  if(tb)tb.textContent=`${CEIL(c.A)} sqft`;
  if(gt)gt.textContent=total.toFixed(2);
}
function syncBuiltUp(){
  const total=rooms().reduce((s,r)=>s+r.area,0);
  const el=document.getElementById('builtUpArea');
  if(el)el.value=String(CEIL(total));
}
function recalc(){
  if(calculating)return;
  calculating=true;
  try{syncBuiltUp();if(rules.length)render(buildItems());}
  finally{calculating=false;}
}
function parseRules(text){
  const m=/const\s+rules\s*=\s*\[/.exec(text);
  if(!m)throw new Error('Calculation Rules data not found');
  const start=m.index+m[0].lastIndexOf('[');
  let depth=0,quote='',escape=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='[')depth++;
    else if(ch===']'){depth--;if(depth===0)return Function(`return ${text.slice(start,i+1)}`)();}
  }
  throw new Error('Calculation Rules array is incomplete');
}
async function loadRules(){
  const res=await fetch(`${RULES}?v=${Date.now()}`,{cache:'no-store'});
  if(!res.ok)throw new Error(`Calculation Rules unavailable (${res.status})`);
  const parsed=parseRules(await res.text());
  rules=Array.isArray(parsed)?parsed.filter(x=>x?.group&&x?.path&&x?.description&&x?.output&&x?.method):[];
  if(!rules.length)throw new Error('Calculation Rules contains no eligible rules');
}
async function loadRates(){
  try{
    const res=await fetch(`${DEFAULT}?v=${Date.now()}`,{cache:'no-store'});
    if(res.ok){const data=await res.json();rates=data?.rates||{};}
  }catch(e){console.warn('[Build Planner] default rates unavailable',e);}
}
function saveContractorState(){
  try{
    const fields=['customerName','customerPhone','customerEmail','projectAddress','projectNotes','builtUpArea'];
    const data={};
    fields.forEach(id=>{const el=document.getElementById(id);if(el)data[id]=el.value;});
    localStorage.setItem('teraju-buildplanner-v2',JSON.stringify(data));
  }catch(e){}
}
function restoreContractorState(){
  try{
    const data=JSON.parse(localStorage.getItem('teraju-buildplanner-v2')||'{}');
    Object.entries(data).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v;});
  }catch(e){}
}
function resetRatesToDefault(){rateOverride.clear();recalc();}
function showRemovedItems(){alert(excluded.size?`${excluded.size} item(s) are currently excluded.`:'No excluded items.');}
function restoreAllItems(){excluded.clear();recalc();}
function toggleProjectInfo(){
  const p=document.getElementById('projectInfo'),a=document.getElementById('projectArrow');
  if(!p)return;
  p.classList.toggle('hidden');
  if(a)a.textContent=p.classList.contains('hidden')?'▼':'▲';
}
function toggleRateSchedule(){
  const p=document.getElementById('rateScheduleContent'),a=document.getElementById('rateScheduleArrow');
  if(!p)return;
  p.classList.toggle('hidden');
  if(a)a.textContent=p.classList.contains('hidden')?'▼':'▲';
}
function editScheduleRate(key,value){rateOverride.set(key,N(value));recalc();}
function applyAudienceUI(){return;}
function generateQuotation(){
  const src=document.getElementById('estimateContent'),dst=document.getElementById('quotationContent');
  if(dst&&src)dst.innerHTML=src.innerHTML;
  const doc=document.getElementById('quotationDocument');
  if(doc)doc.scrollIntoView({behavior:'smooth',block:'start'});
}
function wire(){
  window.addRoom=addRoom;
  window.removeRoom=removeRoom;
  window.moveRoom=moveRoom;
  window.updateRoomsEmptyState=emptyState;
  window.updateEstimate=recalc;
  window.getAllItems=buildItems;
  window.getCurrentQuotationData=()=>{const items=buildItems();return{allItems:items,rooms:rooms(),total:R2(items.reduce((s,x)=>s+x.amount,0))};};
  window.saveContractorState=saveContractorState;
  window.restoreContractorState=restoreContractorState;
  window.resetRatesToDefault=resetRatesToDefault;
  window.showRemovedItems=showRemovedItems;
  window.restoreAllItems=restoreAllItems;
  window.toggleProjectInfo=toggleProjectInfo;
  window.toggleRateSchedule=toggleRateSchedule;
  window.editScheduleRate=editScheduleRate;
  window.applyAudienceUI=applyAudienceUI;
  window.generateQuotation=generateQuotation;
  const btn=document.getElementById('addRoomAreaBtn');
  if(btn)btn.onclick=()=>addRoom();
  document.querySelectorAll('input,select,textarea').forEach(el=>{
    if(el.closest('#roomsContainer'))return;
    el.addEventListener('input',()=>{saveContractorState();recalc();});
    el.addEventListener('change',()=>{saveContractorState();recalc();});
  });
  emptyState();
}
async function init(){
  wire();
  restoreContractorState();
  try{
    await loadRules();
    await loadRates();
    recalc();
    console.info('[Build Planner V2] ready',{rules:rules.length,rooms:rooms().length});
  }catch(err){
    console.error('[Build Planner V2] init failed',err);
    const el=document.getElementById('estimateContent');
    if(el)el.innerHTML=`<div class="p-4 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">Build Planner failed to load Calculation Rules: ${esc(err.message)}</div>`;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();