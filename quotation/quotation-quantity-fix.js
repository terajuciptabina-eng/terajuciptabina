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
const parts=v=>String(v||'').split('/').map(x=>x.trim()).filter(Boolean);
const slug=v=>String(v||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

let rules=[];
let rates={};
const customQuantities=new Map();
const customRates=new Map();
const customDescriptions=new Map();
const excludedItems=new Set();
let lastItems=[];

function normalType(v){
  const s=String(v||'').toLowerCase().trim();
  if(/porch/.test(s))return'porch';
  if(/bath/.test(s))return'bathroom';
  if(/bed/.test(s))return'bedroom';
  if(/kitchen/.test(s))return'kitchen';
  if(/living/.test(s))return'living';
  if(/dining/.test(s))return'dining';
  if(/family/.test(s))return'family';
  if(/utility|yard|store/.test(s))return'other';
  return s.replace(/[^a-z0-9]+/g,'_');
}

function roomFromCard(card,index){
  const selects=[...card.querySelectorAll('select')];
  const sel=selects.find(x=>/room|type|area/i.test(x.name||x.id||x.getAttribute('aria-label')||''))||selects[0];
  const opt=sel?.selectedOptions?.[0];
  const rawType=sel?.value||opt?.textContent||'';
  const roomType=normalType(rawType+' '+(opt?.textContent||''));
  const inputs=[...card.querySelectorAll('input')];
  const areaInput=inputs.find(x=>x.type==='number'&&n(x.value)>0)||inputs.find(x=>x.type==='number');
  if(!areaInput)return null;
  const textInputs=inputs.filter(x=>x.type!=='number'&&x.type!=='hidden');
  const labelInput=textInputs.find(x=>/name|area|room/i.test(x.name||x.id||x.placeholder||''))||textInputs[0];
  const label=String(labelInput?.value||opt?.textContent||rawType||('Area '+(index+1))).trim();
  const area=n(areaInput.value);
  if(area<=0)return null;
  return{roomId:card.dataset.roomId||card.getAttribute('data-room-id')||areaInput.dataset.roomId||String(index+1),label,area,roomType};
}

function rooms(){
  if(typeof window.getRoomGroupsBase==='function'){
    try{
      const x=window.getRoomGroupsBase();
      if(Array.isArray(x)&&x.length)return x.map((r,i)=>({...r,roomId:r.roomId||String(i+1),label:r.label||r.roomName||r.name||('Area '+(i+1)),area:n(r.area),roomType:normalType(r.roomType||r.type||r.label)})).filter(r=>r.area>0);
    }catch(e){}
  }
  const cards=[...document.querySelectorAll('.room-card')];
  const parsed=cards.map(roomFromCard).filter(Boolean);
  if(parsed.length)return parsed;
  const areaInput=document.querySelector('input[type="number"][name*="area" i],input[type="number"][id*="area" i]');
  if(areaInput&&n(areaInput.value)>0)return[{roomId:'1',label:'Living / Family',area:n(areaInput.value),roomType:'living'}];
  return[];
}

function ctx(){
  const rs=rooms();
  const main=rs.filter(r=>r.roomType!=='porch');
  const porch=rs.filter(r=>r.roomType==='porch');
  const bath=main.filter(r=>r.roomType==='bathroom');
  const bed=main.filter(r=>r.roomType==='bedroom');
  const kit=main.filter(r=>r.roomType==='kitchen');
  const ld=main.filter(r=>['living','dining'].includes(r.roomType));
  const A=main.reduce((s,r)=>s+r.area,0),P=porch.reduce((s,r)=>s+r.area,0),B=bath.reduce((s,r)=>s+r.area,0);
  return{rs,main,porch,bath,bed,kit,ld,A,P,B,AM:m2(A),PM:m2(P),BM:m2(B)};
}

function keyFor(rule,index){return'rule_'+slug(rule.path)+'_'+index;}
function rate(rule,index){
  const key=keyFor(rule,index);
  if(Number.isFinite(n(rates[key])))return round(rates[key]);
  const descKey='rule_'+slug(rule.description)+'_'+index;
  if(Number.isFinite(n(rates[descKey])))return round(rates[descKey]);
  return 0;
}

function quantity(rule,c,out){
  const M=String(rule.method||'').toUpperCase().trim();
  const p=String(rule.path||'');
  const l=p.toLowerCase();
  const k=n(rule.coeff);
  const isPorch=/^porch\s*\//i.test(p);
  const A=isPorch?c.P:c.A;
  const AM=isPorch?c.PM:c.AM;
  switch(M){
    case'FIXED PROJECT':
    case'FIXED PER PROJECT': return c.A>0?1:0;
    case'FIXED PER MAIN DOOR': return c.main.length?1:0;
    case'FIXED PER KITCHEN': return c.kit.length;
    case'FIXED PER BEDROOM': return c.bed.length;
    case'FIXED PER BATHROOM': return c.bath.length;
    case'FIXED PER ROOM': return c.main.length*k;
    case'FIXED PER PORCH': return c.porch.length;
    case'FIXED PER ELIGIBLE AREA': return c.main.filter(x=>!['kitchen','bathroom'].includes(x.roomType)).length;
    case'FIXED PER DESIGNATED AREA': return c.main.filter(x=>!['bathroom','kitchen'].includes(x.roomType)).length;
    case'FIXED PER APPLICABLE LOCATION':
      if(/doors\s*\/.*type 1/i.test(l))return c.main.filter(x=>['living','bedroom','kitchen','family','dining'].includes(x.roomType)).length;
      if(/doors\s*\/.*type 2/i.test(l))return c.ld.length;
      return 0;
    case'AREA ALLOWANCE': return (isPorch?c.porch:c.main).reduce((s,x)=>s+Math.ceil(x.area/100),0);
    case'AREA / COEFFICIENT':
    case'BASELINE COEFFICIENT':
    case'COEFFICIENT':
    case'SAME AS MAIN BUILDING': return A*k;
    case'THICKNESS':
    case'LAYER':
    case'AREA': return AM*k;
    case'POUNDAGE':{
      const parent=parts(p).slice(0,-1).join(' / ').toLowerCase();
      const x=out.find(i=>parts(i.path).slice(0,-1).join(' / ').toLowerCase()===parent&&/concrete/i.test(i.path));
      return x?n(x._rawQty||x.qty)*k:0;
    }
    case'DEPENDENCY':
      if(/floor tiles\s*\/\s*internal/i.test(l))return Math.max(0,c.AM-c.BM);
      if(/floor tiles\s*\/\s*external/i.test(l))return c.PM;
      if(/ceiling\s*\/\s*internal/i.test(l))return Math.max(0,c.AM-c.BM);
      if(/ceiling\s*\/\s*external/i.test(l))return c.PM;
      if(/painting\s*\/\s*internal/i.test(l)){const x=out.find(i=>/internal wall/i.test(i.path));return x?n(x._rawQty||x.qty):0}
      if(/painting\s*\/\s*external/i.test(l)){const x=out.find(i=>/external wall/i.test(i.path));return x?n(x._rawQty||x.qty):0}
      if(/drainage|external drain/i.test(l))return c.P*k;
      return 0;
    case'PERIMETER × HEIGHT':
      return /bathroom/i.test(l)?c.bath.reduce((s,x)=>s+4*Math.sqrt(x.area),0)*k:0;
    case'ROOF GEOMETRY':
    case'OVERHANG AREA × THICKNESS': return AM*k;
    default:return 0;
  }
}

function make(rule,index,q,extra={}){
  const hierarchy=parts(rule.path).slice(1,-1);
  const id='rule-item-'+index+(extra.roomId&&extra.roomId!=='project'?'-'+String(extra.roomId).replace(/[^a-zA-Z0-9_-]/g,'_'):'');
  const x={id,ruleIndex:index,ruleKey:keyFor(rule,index),rule,category:String(rule.group).toLowerCase(),description:rule.description,unit:rule.output,qty:ceil(q),rate:rate(rule,index),amount:0,path:rule.path,hierarchy,groupKey:hierarchy.join(' / ')||rule.group,groupTitle:hierarchy.join(' / ')||rule.group,roomId:extra.roomId||'project',room:extra.room||'Project'};
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
    const M=String(r.method||'').toUpperCase(),raw=JSON.stringify(r).toLowerCase(),p=String(r.path||'').toLowerCase();
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
    const q=quantity(r,c,out);
    if(q>0){const x=make(r,i,q);x._rawQty=q;out.push(x)}
  });
  return out.filter(x=>!excludedItems.has(x.id));
}

function render(items){
  const c0=ctx(),declared=n(document.getElementById('builtUpArea')?.value),ra=c0.rs.reduce((s,r)=>s+r.area,0),total=items.reduce((s,i)=>s+i.amount,0),target=document.getElementById('estimateContent');
  lastItems=items;
  if(typeof syncBuiltUpAreaFromRooms==='function'){try{syncBuiltUpAreaFromRooms()}catch(e){}}
  if(!target)return;
  const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<textarea class="w-full border rounded-lg px-3 py-2 bg-white" onchange="editItemDescription('${i.id}',this.value)">${esc(i.description)}</textarea>`:`<div class="homeowner-locked py-2 rounded-lg">${esc(i.description)}</div>`}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<input type="number" min="0" step="1" value="${ceil(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemQuantity('${i.id}',this.value)">`:`<div class="homeowner-locked text-right py-2">${ceil(i.qty)}</div>`}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<input type="number" min="0" step="0.01" value="${round(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemRate('${i.id}',this.value)">`:`<div class="homeowner-locked text-right py-2">${round(i.rate).toFixed(2)}</div>`}</td><td class="py-3 px-2 text-right font-medium">${round(i.amount).toFixed(2)}</td><td class="py-3 px-2">${typeof IS_CONTRACTOR!=='undefined'&&IS_CONTRACTOR?`<button type="button" onclick="excludeItem('${i.id}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button>`:''}</td></tr>`;
  const groups=[];
  for(const i of items){let g=groups.find(x=>x.name===i.category.toUpperCase());if(!g){g={name:i.category.toUpperCase(),nodes:[]};groups.push(g)}let node=g;for(const name of(i.hierarchy||[])){let q=node.nodes.find(x=>x.name===name);if(!q){q={name,nodes:[],items:[]};node.nodes.push(q)}node=q}node.items.push(i)}
  const head=t=>`<tr class="quotation-section-row"><td colspan="6" class="py-3 px-2">${esc(t)}</td></tr>`;
  const sub=(t,l)=>`<tr class="quotation-subsection-row"><td colspan="6" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(t)}</td></tr>`;
  const walk=(ns,l=0)=>ns.map(x=>sub(x.name,l)+x.items.map(row).join('')+walk(x.nodes,l+1)).join('');
  let html='<table class="w-full border-collapse text-sm detailed-quotation-table"><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th><th>Action</th></tr></thead><tbody>';
  groups.forEach(g=>{html+=head(g.name)+walk(g.nodes)});
  html+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${round(total).toFixed(2)}</td><td></td></tr></tfoot></table>`;
  target.innerHTML=html;
  const gt=document.getElementById('grandTotal');if(gt)gt.textContent=round(total).toFixed(2);
  const tb=document.getElementById('totalBuiltArea');if(tb)tb.textContent=ceil(declared||ra)+' sqft';
  const rt=document.getElementById('roomsTotalArea');if(rt)rt.textContent=ceil(ra)+' sqft';
}

function rerender(){render(build())}
window.editItemQuantity=id=>{const v=n(prompt('Quantity',String(lastItems.find(x=>x.id===id)?.qty||0)));customQuantities.set(id,v);rerender()};
window.editItemRate=id=>{const v=n(prompt('Rate (RM)',String(lastItems.find(x=>x.id===id)?.rate||0)));customRates.set(id,v);rerender()};
window.editItemDescription=(id,v)=>{customDescriptions.set(id,String(v));rerender()};
window.excludeItem=id=>{excludedItems.add(id);rerender()};
window.terajuBuildPlannerRecalculate=rerender;

async function loadRules(){
  const r=await fetch(RULES_URL,{cache:'no-store'});if(!r.ok)throw Error('Calculation Rules unavailable');
  const t=await r.text();
  const m=t.match(/const\s+rules\s*=\s*(\[[\s\S]*?\]);/);
  if(!m)throw Error('Calculation Rules data not found');
  rules=Function('return '+m[1])().filter(x=>x&&x.group&&x.path&&x.description&&x.output);
}

async function loadRates(){
  try{const r=await fetch(RATES_URL,{cache:'no-store'});if(r.ok){const j=await r.json();rates=j?.rates||j||{};if(Object.keys(rates).length)return}}catch(e){}
  try{const r=await fetch(DEFAULT_RATES_URL,{cache:'no-store'});if(r.ok){const j=await r.json();rates=j?.rates||{}}}catch(e){rates={}}
}

async function init(){
  try{
    await loadRules();
    await loadRates();
    rerender();
    document.addEventListener('input',e=>{if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(rerender)},{passive:true});
    document.addEventListener('change',e=>{if(e.target.closest('.room-card')||e.target.id==='builtUpArea')requestAnimationFrame(rerender)},{passive:true});
    new MutationObserver(()=>requestAnimationFrame(rerender)).observe(document.body,{childList:true,subtree:true});
  }catch(e){console.error('TERAJU Build Planner V2:',e);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();