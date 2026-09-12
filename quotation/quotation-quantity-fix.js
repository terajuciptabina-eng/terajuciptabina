(()=>{'use strict';
if(!/buildplanner-v2\.html/i.test(location.pathname))return;
const RULES='calculation-rules.html',DEFAULT='../data/rates/default.json',API='https://terajucibina.vercel.app/api/rates';
const N=v=>Number(v)||0,UP=v=>Math.max(0,Math.ceil(N(v))),R2=v=>Math.round(N(v)*100)/100,M2=v=>N(v)*0.09290304;
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const slug=v=>String(v||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
let rules=[],rates={},busy=false,writeV2=false;
const qtyOverride=new Map(),rateOverride=new Map(),descOverride=new Map(),excluded=new Set();
const nativeHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
const nativeText=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
function hardGate(){
 const el=document.getElementById('estimateContent');
 if(el&&nativeHTML?.set&&!el.__terajuGate){
  nativeHTML.set.call(el,'');
  Object.defineProperty(el,'__terajuGate',{value:true});
  Object.defineProperty(el,'innerHTML',{configurable:true,get(){return nativeHTML.get.call(el)},set(v){if(writeV2)nativeHTML.set.call(el,v)}});
 }
 ['grandTotal','totalBuiltArea','roomsTotalArea'].forEach(id=>{
  const x=document.getElementById(id); if(!x||!nativeText?.set||x.__terajuGate)return;
  Object.defineProperty(x,'__terajuGate',{value:true});
  Object.defineProperty(x,'textContent',{configurable:true,get(){return nativeText.get.call(x)},set(v){if(writeV2)nativeText.set.call(x,v)}});
 });
}
function type(v){v=String(v||'').toLowerCase();if(/porch|car\s*porch|entrance/.test(v))return'porch';if(/bath/.test(v))return'bathroom';if(/bed/.test(v))return'bedroom';if(/kitchen/.test(v))return'kitchen';if(/living|family/.test(v))return'living';if(/dining/.test(v))return'dining';return v.replace(/[^a-z0-9]+/g,'_')||'other';}
function roomCards(){const root=document.getElementById('roomsContainer');if(!root)return[];let cards=[...root.querySelectorAll('.room-card')];if(!cards.length)cards=[...root.children].filter(x=>x.querySelector?.('input,select')) ;return cards;}
function rooms(){return roomCards().map((x,i)=>{const select=x.querySelector('.room-type,select,[name*=roomType i],[name*=room_type i]');const nums=[...x.querySelectorAll('input')].filter(a=>N(a.value)>0);const areaInput=x.querySelector('.room-area,[name*=area i],[id*=area i],input[type=number]')||nums[0];const area=N(areaInput?.value);if(area<=0)return null;const labelInput=x.querySelector('.room-name,[name*=roomName i],[name*=room_name i]');const label=String(labelInput?.value||select?.selectedOptions?.[0]?.textContent||x.querySelector('h1,h2,h3,h4,strong')?.textContent||`Area ${i+1}`).trim();return{roomId:x.id||`room-${i+1}`,label,area,type:type(select?.value||select?.selectedOptions?.[0]?.textContent||label)};}).filter(Boolean);}
function ctx(){const rs=rooms(),porch=rs.filter(x=>x.type==='porch'),main=rs.filter(x=>x.type!=='porch'),bath=main.filter(x=>x.type==='bathroom'),bed=main.filter(x=>x.type==='bedroom'),kit=main.filter(x=>x.type==='kitchen'),A=main.reduce((s,x)=>s+x.area,0),P=porch.reduce((s,x)=>s+x.area,0),B=bath.reduce((s,x)=>s+x.area,0);return{rs,main,porch,bath,bed,kit,A,P,B,AM:M2(A),PM:M2(P),BM:M2(B)};}
function key(x,i){return`rule_${slug(x.path)}_${i}`;}
function rate(x,i){const k=key(x,i);return R2(rateOverride.has(k)?rateOverride.get(k):rates[k]??0);}
function perimeter(area){return 4*Math.sqrt(Math.max(0,N(area)))*0.3048;}
function dependency(x,c,out){const l=String(x.path||'').toLowerCase(),k=N(x.coeff)||1;if(/floor tiles.*internal|internal floor tiles/.test(l))return Math.max(0,c.AM-c.BM);if(/floor tiles.*external|external floor tiles/.test(l))return c.PM;if(/ceiling.*internal|internal ceiling/.test(l))return Math.max(0,c.AM-c.BM);if(/ceiling.*external|external ceiling/.test(l))return c.PM;if(/painting.*internal|internal painting/.test(l)){const q=out.find(i=>/internal wall/i.test(i.path));return q?N(q._rawQty):0;}if(/painting.*external|external painting/.test(l)){const q=out.find(i=>/external wall/i.test(i.path));return q?N(q._rawQty):0;}if(/drainage|external drain/.test(l))return perimeter(c.A)*k;return 0;}
function calc(x,c,out){const m=String(x.method||'').toUpperCase().trim(),p=String(x.path||''),l=p.toLowerCase(),k=N(x.coeff),isPorch=/^porch\s*\//i.test(p),A=isPorch?c.P:c.A,AM=isPorch?c.PM:c.AM;
 if(m==='FIXED PER PROJECT'||m==='FIXED PROJECT')return c.rs.length?1:0;
 if(m==='FIXED PER BATHROOM')return c.bath.length;
 if(m==='FIXED PER BEDROOM')return c.bed.length;
 if(m==='FIXED PER KITCHEN')return c.kit.length;
 if(m==='FIXED PER PORCH')return c.porch.length;
 if(m==='FIXED PER ROOM')return c.main.length*(k||1);
 if(m==='FIXED PER ELIGIBLE AREA'||m==='FIXED PER DESIGNATED AREA')return c.main.filter(z=>!['bathroom','kitchen'].includes(z.type)).length*(k||1);
 if(m==='FIXED PER APPLICABLE LOCATION'){
  if(/door.*type 1|type 1.*door/.test(l))return c.main.filter(z=>['living','bedroom','kitchen','dining'].includes(z.type)).length;
  if(/door.*type 2|type 2.*door/.test(l))return c.main.filter(z=>['living','dining'].includes(z.type)).length;
  if(/door.*type 3|type 3.*door/.test(l))return c.bath.length;
  if(/door.*type 4|type 4.*door/.test(l))return c.main.length?1:0;
  if(/window.*type 1|type 1.*window/.test(l))return c.bed.length;
  if(/window.*type 2|type 2.*window/.test(l))return c.kit.length;
  if(/window.*type 3|type 3.*window/.test(l))return c.bath.length;
  return 0;
 }
 if(m==='AREA ALLOWANCE')return(isPorch?c.porch:c.main).reduce((s,z)=>s+Math.ceil(z.area/100),0)*(k||1);
 if(m==='AREA / COEFFICIENT'||m==='BASELINE COEFFICIENT'||m==='COEFFICIENT'||m==='SAME AS MAIN BUILDING')return A*k;
 if(m==='THICKNESS'||m==='LAYER'||m==='AREA'||m==='ROOF GEOMETRY'||m==='OVERHANG AREA × THICKNESS')return AM*k;
 if(m==='PERIMETER × THICKNESS')return perimeter(A)*k;
 if(m==='PERIMETER × HEIGHT')return /bathroom/.test(l)?c.bath.reduce((s,z)=>s+perimeter(z.area)*10*0.3048,0):0;
 if(m==='POUNDAGE'){const parent=p.split('/').slice(0,-1).join('/').toLowerCase(),q=out.find(i=>i.path.toLowerCase().startsWith(parent)&&/concrete/.test(i.path.toLowerCase()));return q?N(q._rawQty)*k:0;}
 if(m==='DEPENDENCY')return dependency(x,c,out);
 return 0;
}
function make(x,i,q,e={}){const id=`rule-item-${i}-${e.roomId||'project'}`,k=key(x,i),o={id,ruleIndex:i,ruleKey:k,category:x.group,description:x.description,unit:x.output,qty:UP(q),rate:rate(x,i),amount:0,path:x.path,hierarchy:String(x.path).split('/').map(s=>s.trim()).slice(1,-1),roomId:e.roomId||'project',room:e.room||'Project',_rawQty:q};if(qtyOverride.has(id))o.qty=UP(qtyOverride.get(id));if(descOverride.has(id))o.description=descOverride.get(id);o.amount=R2(o.qty*o.rate);return o;}
function build(){const c=ctx(),out=[];rules.forEach((x,i)=>{if(!x||!x.group||!x.path||!x.description||!x.output||!x.method)return;const m=String(x.method).toUpperCase().trim(),p=String(x.path||'').toLowerCase();if(/^FIXED PER BATHROOM$|^FIXED PER BEDROOM$|^FIXED PER KITCHEN$/.test(m)){const list=m.includes('BATHROOM')?c.bath:m.includes('BEDROOM')?c.bed:c.kit;list.forEach(z=>out.push(make(x,i,1,{roomId:z.roomId,room:z.label})));return;}if(x.group==='ARCHITECTURES'&&/bathroom\s*\/\s*(wall tiles|floor tiles|ceiling)/i.test(p)){c.bath.forEach(z=>{let q=/wall tiles/i.test(p)?perimeter(z.area)*10*0.3048:M2(z.area);q*=N(x.coeff)||1;if(q>0)out.push(make(x,i,q,{roomId:z.roomId,room:z.label}));});return;}const q=calc(x,c,out);if(q>0)out.push(make(x,i,q));});return out.filter(x=>!excluded.has(x.id));}
function heading(g){g=String(g||'').toUpperCase();return g==='PRELIMINARIES'?'PROJECT / PRELIMINARIES':g==='STRUCTURES'?'STRUCTURAL WORKS':g==='ARCHITECTURES'?'ARCHITECTURAL WORKS':g==='ELECTRICAL'?'ELECTRICAL WORKS':g;}
function render(items){const el=document.getElementById('estimateContent');if(!el)return;const c=ctx(),decl=N(document.getElementById('builtUpArea')?.value),total=R2(items.reduce((s,x)=>s+x.amount,0)),groups=[];items.forEach(x=>{let g=groups.find(z=>z.name===heading(x.category));if(!g){g={name:heading(x.category),nodes:[]};groups.push(g);}let node=g;x.hierarchy.forEach(h=>{let z=node.nodes.find(y=>y.name===h);if(!z){z={name:h,nodes:[],items:[]};node.nodes.push(z);}node=z;});node.items.push(x);});const row=x=>`<tr class="border-b align-top"><td class="py-3 px-2">${esc(x.description)}</td><td class="py-3 px-2">${esc(x.unit)}</td><td class="py-3 px-2 text-right">${UP(x.qty)}</td><td class="py-3 px-2 text-right">${x.rate.toFixed(2)}</td><td class="py-3 px-2 text-right font-medium">${x.amount.toFixed(2)}</td></tr>`;const walk=(ns,l=0)=>ns.map(x=>`<tr class="quotation-subsection-row"><td colspan="5" class="py-2 px-2" style="padding-left:${8+l*18}px">${esc(x.name)}</td></tr>${x.items.map(row).join('')}${walk(x.nodes,l+1)}`).join('');const html=groups.length?`<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th></tr></thead><tbody>${groups.map(g=>`<tr class="quotation-section-row"><td colspan="5" class="py-3 px-2">${esc(g.name)}</td></tr>${walk(g.nodes)}`).join('')}</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${total.toFixed(2)}</td></tr></tfoot></table></div>`:'<div class="p-4 text-sm text-gray-500 border rounded-xl bg-gray-50">No calculation items were generated from Calculation Rules.</div>';
nativeHTML.set.call(el,html);if(nativeText?.set){const tb=document.getElementById('totalBuiltArea'),rt=document.getElementById('roomsTotalArea'),gt=document.getElementById('grandTotal');if(tb)nativeText.set.call(tb,`${UP(decl||c.A)} sqft`);if(rt)nativeText.set.call(rt,`${UP(c.rs.reduce((s,z)=>s+z.area,0))} sqft`);if(gt)nativeText.set.call(gt,total.toFixed(2));}}
function parse(text){const m=/const\s+rules\s*=\s*\[/.exec(text);if(!m)throw Error('Calculation Rules data not found');const s=m.index+m[0].lastIndexOf('[');let d=0,q='',inside=false,escaped=false;for(let i=s;i<text.length;i++){const c=text[i];if(inside){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===q)inside=false;continue;}if(c==='"'||c==="'"||c==='`'){inside=true;q=c;continue;}if(c==='[')d++;else if(c===']'&&!--d)return Function(`return ${text.slice(s,i+1)}`)();}throw Error('Calculation Rules array is incomplete');}
async function loadRules(){const a=await fetch(`${RULES}?v=${Date.now()}`,{cache:'no-store'});if(!a.ok)throw Error(`Calculation Rules unavailable (${a.status})`);const text=await a.text();const parsed=parse(text);rules=Array.isArray(parsed)?parsed.filter(x=>x&&x.group&&x.path&&x.description&&x.output&&x.method):[];if(!rules.length)throw Error('Calculation Rules contains no eligible rules');}
async function loadRates(){try{const a=await fetch(`${API}?v=${Date.now()}`,{cache:'no-store'});if(a.ok){const d=await a.json();rates=d?.rates||d||{};}}catch{}if(Object.keys(rates).length)return;try{const a=await fetch(`${DEFAULT}?v=${Date.now()}`,{cache:'no-store'});if(a.ok){const d=await a.json();rates=d?.rates||{};}}catch{}}
function stopLegacy(){['updateEstimate','renderEstimate','generateStructureItems','generateRoomArchitectureItems','generateElectricalItems'].forEach(k=>{try{window[k]=()=>{};}catch{}});window.getAllItems=build;window.getCurrentQuotationData=()=>{const all=build();return{allItems:all,rooms:rooms(),total:R2(all.reduce((s,x)=>s+x.amount,0))};};}
function bind(){const rec=()=>{if(!busy)requestAnimationFrame(recalc);};document.addEventListener('input',rec,true);document.addEventListener('change',rec,true);document.addEventListener('click',e=>{if(e.target.closest?.('#roomsContainer,#addRoomAreaBtn'))setTimeout(recalc,0);},true);const root=document.getElementById('roomsContainer');if(root)new MutationObserver(()=>setTimeout(recalc,0)).observe(root,{childList:true,subtree:true});}
function recalc(){if(busy||!rules.length)return;busy=true;writeV2=true;try{render(build());}finally{writeV2=false;busy=false;}}
hardGate();
function start(){stopLegacy();hardGate();bind();loadRules().then(loadRates).then(()=>{recalc();setTimeout(recalc,150);setTimeout(recalc,600);}).catch(e=>{console.error('TERAJU Build Planner V2',e);const el=document.getElementById('estimateContent');if(el&&nativeHTML?.set){writeV2=true;nativeHTML.set.call(el,`<div style="padding:16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-weight:600">Calculation engine error: ${esc(e.message||e)}</div>`);writeV2=false;}});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();