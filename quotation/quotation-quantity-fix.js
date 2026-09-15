(function(){
'use strict';
if(!/buildplanner-v2\.html$/i.test(location.pathname))return;
if(window.__TERAJU_MASTER_ENGINE_ACTIVE)return;
window.__TERAJU_MASTER_ENGINE_ACTIVE=true;
const Q=new URLSearchParams(location.search);
const CONTRACTOR_ID=Q.get('contractorId')||localStorage.getItem('teraju.contractor.local.v1.activeContractorId')||'local';
const OVERRIDE_KEY=`teraju.buildplanner.v2.rate-overrides.v1.${CONTRACTOR_ID}`;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const r2=v=>Math.round(n(v)*100)/100;
const sqftToM2=v=>n(v)*0.09290304;
const normalizeQty=v=>Math.max(0,Math.ceil(n(v)));
const integerUnit=u=>/^(ls|no|set|unit)$/i.test(String(u||''));
const norm=s=>String(s||'').toLowerCase().replace(/×/g,'*').replace(/÷/g,'/').replace(/[^a-z0-9+*/().]+/g,' ').trim();
function loadRules(src){const m=src.match(/(?:const|let)\s+rules\s*=\s*\[/);if(!m)throw Error('Global Calculation Rules array not found');const st=src.indexOf('[',m.index);let d=0,q='',e=false;for(let i=st;i<src.length;i++){const c=src[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c===q)q='';continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='[')d++;else if(c===']'&&--d===0)return Function('"use strict";return '+src.slice(st,i+1))()}throw Error('Global Calculation Rules array incomplete')}
function plannerRoomGroups(){
  if(typeof getRoomGroups==='function'){
    const rs=getRoomGroups()||[];
    if(Array.isArray(rs)&&rs.length)return rs;
  }
  const root=document.getElementById('roomsContainer');
  if(!root)return[];
  return Array.from(root.querySelectorAll('.room-card')).map((card,index)=>{
    const typeEl=card.querySelector('select[data-room-type],select[name*="type" i],select[id*="type" i],select');
    const areaEl=card.querySelector('input[data-field="area"],input[name*="area" i],input[id*="area" i],input[type="number"]');
    const roomType=String(typeEl?.value||card.dataset.roomType||'').trim();
    const area=n(areaEl?.value);
    return{roomId:card.dataset.roomId||card.id||`room-${index+1}`,roomType,area};
  }).filter(x=>x.roomType||x.area>0);
}
function scope(){
  const rs=plannerRoomGroups(),main=rs.filter(x=>x.roomType!=='porch'),porch=rs.filter(x=>x.roomType==='porch');
  const builtUp=n(document.getElementById('builtUpArea')?.value);
  const A=main.reduce((s,x)=>s+n(x.area),0)||builtUp;
  const B=porch.reduce((s,x)=>s+n(x.area),0);
  return{rs,main,porch,A,B}
}
let rulesByPath=new Map(),ratesMaster={};
async function load(){const[a,b]=await Promise.all([fetch('admin-calculation-rules.html?source=master&v=20260915',{cache:'no-store'}),fetch('../data/rates/default.json?source=master&v=20260915',{cache:'no-store'})]);if(!a.ok||!b.ok)throw Error('Global Master source unavailable');rulesByPath=new Map(loadRules(await a.text()).filter(x=>Array.isArray(x)&&x[1]).map(x=>[String(x[1]).trim(),x]));ratesMaster=(await b.json()).rates||{}}
function rule(p){return rulesByPath.get(String(p||'').trim())||null}
function rateFor(p,fallback=0){let v=fallback,np=norm(p).replace(/\s+/g,'_');const key=Object.keys(ratesMaster).find(k=>k===`rule_${np}_0`)||Object.keys(ratesMaster).find(k=>norm(k).startsWith(`rule_${np}`))||Object.keys(ratesMaster).find(k=>norm(k).includes(`rule_${np}`));if(key)v=n(ratesMaster[key]);try{const o=JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'{}'),hit=Object.keys(o).find(k=>norm(k)===norm(p)||norm(p).includes(norm(k))||norm(k).includes(norm(p)));if(hit)v=n(o[hit])}catch{}return r2(v)}
function path(i){return i?.masterPath||i?._masterPath||''}
function apronScope(s){if(s.A<=0)return{apronArea:0,outerPerimeterM:0};const side=Math.sqrt(s.A),outer=side+6;return{apronArea:Math.max(0,(outer*outer-s.A)*0.09290304),outerPerimeterM:outer*4*0.3048}}
function areaM2(v){return sqftToM2(v)}
function directBase(name,s,ap){const k=norm(name);if(k==='a')return s.A;if(k==='b')return s.B;if(k.includes('porch area'))return s.B;if(k.includes('ground slab area')||k.includes('flat roof area')||k.includes('porch ground slab area'))return areaM2(k.includes('porch')?s.B:s.A);if(k.includes('apron area'))return ap.apronArea;if(k.includes('outer apron perimeter'))return ap.outerPerimeterM;if(k.includes('outer perimeter'))return ap.outerPerimeterM;return null}
function dependencyValue(label,items){const want=norm(label).replace(/\s+/g,' ');const hit=items.find(x=>{const p=norm(path(x));return p&&(p.endsWith(want)||p.replace(/\//g,' ').replace(/\s+/g,' ').endsWith(want))});return hit?n(hit.qty):null}
function roomCount(s,pred){return s.rs.filter(pred).length}
function bathroomWallTileQty(s){let total=0;for(const r of s.rs){if(r.roomType!=='bathroom'||n(r.area)<=0)continue;const sideFt=Math.sqrt(n(r.area));const perimeterFt=sideFt*4;total+=perimeterFt*0.3048*10*0.3048}return total}
function electricalCount(s,p){const f=String(rule(p)?.[5]||'');if(/sum of ceiling/i.test(f))return s.main.filter(r=>n(r.area)>0).reduce((sum,r)=>sum+Math.ceil(n(r.area)/100),0);if(/number of main building rooms/i.test(f)&&/power point/i.test(p))return roomCount(s,r=>n(r.area)>0)*2;if(/number of main building rooms/i.test(f)&&/switch/i.test(p))return roomCount(s,r=>n(r.area)>0)*2;if(/eligible main building areas|eligible main building rooms/i.test(f))return s.main.filter(r=>n(r.area)>0&&!['kitchen','masterBedroom','bathroom'].includes(r.roomType)).length;if(/designated air-conditioned areas/i.test(f))return s.main.filter(r=>n(r.area)>0&&['masterBedroom','bedroom','living','dining'].includes(r.roomType)).length;if(/number of porches/i.test(f))return roomCount(s,r=>r.roomType==='porch'&&n(r.area)>0);if(/number of bathrooms/i.test(f))return roomCount(s,r=>r.roomType==='bathroom'&&n(r.area)>0);if(/number of kitchens/i.test(f))return roomCount(s,r=>r.roomType==='kitchen'&&n(r.area)>0);if(/number of bedrooms/i.test(f))return roomCount(s,r=>['bedroom','masterBedroom'].includes(r.roomType)&&n(r.area)>0);if(/main door/i.test(f))return 1;return null}
function formulaQty(p,s,items,ap){const r=rule(p);if(!r)return null;const f=String(r[5]||'');if(/bathroom perimeter \(ft\)/i.test(f))return bathroomWallTileQty(s);const ec=electricalCount(s,p);if(ec!==null)return ec;const eq=f.indexOf('=');if(eq<0)return null;let expr=f.slice(eq+1).trim();expr=expr.replace(/\bAA\s*\*\s*AB\b/gi,'A').replace(/\((?:m²|m³|m|kg|sqft)\)/gi,'');const aliases=['Porch Ground Slab Area','Ground Slab Area','Flat Roof Area','Outer Apron Perimeter','Porch Area','Apron Area','A','B'];for(const a of aliases){const v=directBase(a,s,ap);if(v!==null)expr=expr.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),`(${v})`)}const depLabels=[...rulesByPath.keys()].map(x=>x.split('/').slice(-2).join(' ')).sort((a,b)=>b.length-a.length);for(const label of depLabels){if(!new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(expr))continue;const v=dependencyValue(label,items);if(v!==null)expr=expr.replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),`(${v})`)}if(/fixed per project|1\s*ls\s*\/\s*project/i.test(String(r[3]||'')+' '+f))return 1;expr=expr.replace(/m²|m³|kg|sqft|per\s+project/gi,'').replace(/×/g,'*').replace(/÷/g,'/');if(!/^[0-9+\-*/().\s]+$/.test(expr))return null;try{return n(Function('"use strict";return ('+expr+')')())}catch{return null}}
function set(i,q){if(q===null||!Number.isFinite(Number(q)))return i;i.qty=integerUnit(i.unit)?normalizeQty(q):Math.max(0,r2(q));i.rate=r2(i.rate);i.amount=r2(i.qty*i.rate);return i}
function projectItem(id,p,groupTitle,groupKey){const x=rule(p);return{id,roomId:'project',room:'Project',category:p.startsWith('EXTERNAL WORK')?'external-work':'structures',description:x?.[2]||p,unit:x?.[6]||'',qty:0,rate:rateFor(p,0),amount:0,groupKey,groupTitle,masterPath:p}}
function present(items){for(const i of items){const x=rule(path(i));if(x){i.description=String(x[2]||i.description);i.unit=String(x[6]||i.unit);if(!i.rate)i.rate=rateFor(path(i),0)}}return items}
function update(items,s){const ap=apronScope(s);for(const i of items){const p=path(i);if(!p)continue;const q=formulaQty(p,s,items,ap);if(q!==null)set(i,q);else{const rm=s.rs.find(x=>x.roomId===i.roomId);if(/^ARCHITECTURES\s*\//i.test(p)&&i.id.endsWith('-paint'))set(i,areaM2(s.A));else if(/^ARCHITECTURES\s*\//i.test(p)&&(i.id.endsWith('-floortile')||i.id.endsWith('-ceiling')))set(i,areaM2(rm?.area));else if(/^BATHROOM\s*\//i.test(p)&&(i.id.endsWith('-floortile')||i.id.endsWith('-ceiling')))set(i,areaM2(rm?.area));else if(/^BATHROOM\s*\//i.test(p)&&/(piping|wc|basin|shower|tap)$/.test(i.id))set(i,1);else if(/^DOORS\s*\//i.test(p)){if(i.id.endsWith('-door'))set(i,['living','dining','kitchen','masterBedroom','bedroom','bathroom'].includes(rm?.roomType)?1:0);else if(i.id.endsWith('-window'))set(i,['bedroom','masterBedroom','kitchen','bathroom'].includes(rm?.roomType)?1:0)}}}return items}
function addMissing(items,s){const ids=new Set(items.map(i=>i.id));const add=(id,p,g,k)=>{if(ids.has(id)||!rule(p))return;const i=projectItem(id,p,g,k);items.push(i);ids.add(id)};
if(s.A>0){const main=[['str-footing-conc','MAIN BUILDING / Footing / Concrete','Footing','footing'],['str-footing-fw','MAIN BUILDING / Footing / Formwork','Footing','footing'],['str-footing-rebar','MAIN BUILDING / Footing / Rebar','Footing','footing'],['str-slab-conc','MAIN BUILDING / Ground Slab / Concrete','Ground Slab','ground-slab'],['str-slab-brc','MAIN BUILDING / Ground Slab / BRC','Ground Slab','ground-slab'],['str-gb-conc','MAIN BUILDING / Ground Beam / Concrete','Ground Beam','ground-beam'],['str-gb-fw','MAIN BUILDING / Ground Beam / Formwork','Ground Beam','ground-beam'],['str-gb-rebar','MAIN BUILDING / Ground Beam / Rebar','Ground Beam','ground-beam'],['str-rb-conc','MAIN BUILDING / Roof Beam / Concrete','Roof Beam','roof-beam'],['str-rb-fw','MAIN BUILDING / Roof Beam / Formwork','Roof Beam','roof-beam'],['str-rb-rebar','MAIN BUILDING / Roof Beam / Rebar','Roof Beam','roof-beam'],['str-col-conc','MAIN BUILDING / Column / Concrete','Column','column'],['str-col-fw','MAIN BUILDING / Column / Formwork','Column','column'],['str-col-rebar','MAIN BUILDING / Column / Rebar','Column','column'],['str-fr-conc','MAIN BUILDING / Flat Roof / Concrete','Flat Roof & Roofing','roof'],['str-fr-fw','MAIN BUILDING / Flat Roof / Formwork','Flat Roof & Roofing','roof'],['str-fr-brc','MAIN BUILDING / Flat Roof / BRC','Flat Roof & Roofing','roof'],['str-roof-m','MAIN BUILDING / Roof / Metal Roofing Sheet','Roof','roof']];main.forEach(([id,p,t,k])=>add(id,p,t,k));add('str-apron-c','MAIN BUILDING / Apron / Concrete','Apron','apron');add('str-apron-f','MAIN BUILDING / Apron / Formwork','Apron','apron');add('str-apron-b','MAIN BUILDING / Apron / BRC','Apron','apron');add('str-drain','MAIN BUILDING / Drainage','Drainage','drain')}
['BOUNDARY FENCING','GATE','EXTERNAL DRAIN','DRIVEWAY','LANDSCAPING'].forEach(x=>add('external-'+x.toLowerCase().replace(/\s+/g,'-'),'EXTERNAL WORK / '+x,'External Work','external-work'));
if(s.B>0){const ps=[['footing-conc','PORCH / Footing / Concrete','footing','Footing'],['footing-fw','PORCH / Footing / Formwork','footing','Footing'],['footing-rebar','PORCH / Footing / Rebar','footing','Footing'],['slab-conc','PORCH / Ground Slab / Concrete','ground-slab','Ground Slab'],['slab-brc','PORCH / Ground Slab / BRC','ground-slab','Ground Slab'],['gb-conc','PORCH / Ground Beam / Concrete','ground-beam','Ground Beam'],['gb-fw','PORCH / Ground Beam / Formwork','ground-beam','Ground Beam'],['gb-rebar','PORCH / Ground Beam / Rebar','ground-beam','Ground Beam'],['rb-conc','PORCH / Roof Beam / Concrete','roof-beam','Roof Beam'],['rb-fw','PORCH / Roof Beam / Formwork','roof-beam','Roof Beam'],['rb-rebar','PORCH / Roof Beam / Rebar','roof-beam','Roof Beam'],['col-conc','PORCH / Column / Concrete','column','Column'],['col-fw','PORCH / Column / Formwork','column','Column'],['col-rebar','PORCH / Column / Rebar','column','Column'],['fr-conc','PORCH / Flat Roof / Concrete','roof','Flat Roof & Roofing'],['fr-fw','PORCH / Flat Roof / Formwork','roof','Flat Roof & Roofing'],['fr-brc','PORCH / Flat Roof / BRC','roof','Flat Roof & Roofing'],['roof-m','PORCH / Roof / Metal Roofing Sheet','roof','Roof']];ps.forEach(([suf,p,g,t])=>add('porch-'+suf,p,t,g))}return items}
function clean(items){return items.filter(i=>!/^str-roof-d(c|f|r)$/.test(i.id)&&!/^rate-/.test(i.id))}
async function main(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  await load();
  const original=window.getAllItems;
  if(typeof original!=='function')return;
  if(original.__terajuMasterV7)return;
  const wrapped=function(){const s=scope();let items=clean(original.apply(this,arguments)||[]);items=present(items);items=addMissing(items,s);items=present(items);items=update(items,s);items=present(items);for(const i of items){i.qty=normalizeQty(i.qty);i.rate=r2(i.rate);i.amount=r2(i.qty*i.rate)}return items};
  wrapped.__terajuMasterV7=true;
  window.getAllItems=wrapped;
  if(typeof window.updateEstimate==='function')window.updateEstimate()
}
main().catch(e=>console.error('[TERAJU V2 MASTER ENGINE V7]',e));
})();