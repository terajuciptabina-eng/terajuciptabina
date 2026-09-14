(function(){
'use strict';
if(!/buildplanner-v2\.html$/i.test(location.pathname))return;
if(window.__TERAJU_MASTER_ENGINE_ACTIVE)return;
window.__TERAJU_MASTER_ENGINE_ACTIVE=true;

const Q=new URLSearchParams(location.search);
const CONTRACTOR_ID=Q.get('contractorId')||localStorage.getItem('teraju.contractor.local.v1.activeContractorId')||'local';
const OVERRIDE_KEY=`teraju.buildplanner.v2.rate-overrides.v1.${CONTRACTOR_ID}`;
let RULES=[], RULE_MAP=new Map(), RATES_MASTER={};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*100)/100;
const sqftToM2=v=>num(v)*0.09290304;
const isIntegerUnit=u=>/^(ls|no|set|unit)$/i.test(String(u||''));

function rooms(){return typeof getRoomGroups==='function'?(getRoomGroups()||[]):[]}
function context(){
 const all=rooms(), main=all.filter(r=>r.roomType!=='porch'), porch=all.filter(r=>r.roomType==='porch');
 return {all,main,porch,A:main.reduce((s,r)=>s+num(r.area),0),B:porch.reduce((s,r)=>s+num(r.area),0)};
}
function parseMaster(text){
 const m=text.match(/(?:const|let)\s+rules\s*=\s*\[/); if(!m)throw Error('Global Calculation Rules array not found');
 const start=text.indexOf('[',m.index); let depth=0,quote='',escape=false;
 for(let i=start;i<text.length;i++){
  const c=text[i];
  if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue}
  if(c==='[')depth++;
  else if(c===']'&&--depth===0)return Function('"use strict";return '+text.slice(start,i+1))();
 }
 throw Error('Global Calculation Rules array incomplete');
}
async function loadMaster(){
 const [r,j]=await Promise.all([
  fetch('admin-calculation-rules.html?source=master&v=20260915',{cache:'no-store'}),
  fetch('../data/rates/default.json?source=master&v=20260915',{cache:'no-store'})
 ]);
 if(!r.ok||!j.ok)throw Error('Global Master source unavailable');
 RULES=parseMaster(await r.text()).filter(x=>Array.isArray(x)&&x[1]);
 RULE_MAP=new Map(RULES.map(x=>[String(x[1]).trim(),x]));
 RATES_MASTER=(await j.json()).rates||{};
}
function rule(path){return RULE_MAP.get(String(path||'').trim())||null}
function norm(s){return String(s||'').toLowerCase().replace(/×/g,'*').replace(/[^a-z0-9]+/g,' ').trim()}
function numberIn(s){const m=String(s||'').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);return m?num(m[0]):0}
function rateFor(path){
 const target=norm(path).replace(/^main building /,'').replace(/^porch /,'').replace(/^external work /,'').replace(/^electrical /,'');
 const keys=Object.keys(RATES_MASTER);
 let k=keys.find(x=>norm(x).includes(norm('rule_'+target.replace(/ /g,'_'))));
 if(!k){
  const leaf=target.replace(/ /g,'_'); k=keys.find(x=>norm(x).startsWith(norm('rule_'+leaf)));
 }
 let v=k?num(RATES_MASTER[k]):0;
 try{const o=JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'{}');const legacy=legacyRateKey(path);if(legacy&&Object.prototype.hasOwnProperty.call(o,legacy))v=num(o[legacy])}catch{}
 return v;
}
function legacyRateKey(path){
 const p=String(path||'');
 const map={
  'PRELIMINARIES / Building Plan / Submission':'permit','PRELIMINARIES / Site Mobilisation / Project Management':'prelim',
  'MAIN BUILDING / Footing / Concrete':'footingConc','MAIN BUILDING / Footing / Formwork':'footingFw','MAIN BUILDING / Footing / Rebar':'footingRebar',
  'MAIN BUILDING / Ground Slab / Concrete':'slabConc','MAIN BUILDING / Ground Slab / BRC':'slabBrc',
  'MAIN BUILDING / Ground Beam / Concrete':'beamConc','MAIN BUILDING / Ground Beam / Formwork':'beamFw','MAIN BUILDING / Ground Beam / Rebar':'beamRebar',
  'MAIN BUILDING / Roof Beam / Concrete':'beamConc','MAIN BUILDING / Roof Beam / Formwork':'beamFw','MAIN BUILDING / Roof Beam / Rebar':'beamRebar',
  'MAIN BUILDING / Column / Concrete':'colConc','MAIN BUILDING / Column / Formwork':'colFw','MAIN BUILDING / Column / Rebar':'colRebar',
  'MAIN BUILDING / Flat Roof / Concrete':'flatRoofConc','MAIN BUILDING / Flat Roof / Formwork':'flatRoofFw','MAIN BUILDING / Flat Roof / BRC':'flatRoofBrc',
  'MAIN BUILDING / Apron / Concrete':'apronConc','MAIN BUILDING / Apron / Formwork':'apronFw','MAIN BUILDING / Apron / BRC':'apronBrc','MAIN BUILDING / Drainage':'drainage',
  'BATHROOM / Wall Tiles':'bathWallTile','BATHROOM / Floor Tiles':'bathFloorTile','BATHROOM / Ceiling':'bathCeiling','BATHROOM / Piping':'bathPiping','BATHROOM / WC':'bathWc','BATHROOM / Basin':'bathBasin','BATHROOM / Shower':'bathShower','BATHROOM / Tap':'bathTap',
  'MAIN BUILDING / Water Tank':'waterTank','MAIN BUILDING / Septic Tank':'septicTank','MAIN BUILDING / POWER POINT':'powerPoint','MAIN BUILDING / SWITCH':'switch','MAIN BUILDING / LIGHTING':'lighting','MAIN BUILDING / FAN':'fan','MAIN BUILDING / AIRCOND POINT':'aircond',
  'PORCH / LIGHTING':'porchLighting','PORCH / FAN':'porchFan','PORCH / POWER POINT':'porchPowerPoint','EARTHING':'earthing','DB BOX':'dbBox','WIRING':'wiring'
 };return map[p]||null;
}
function rate(path){
 const lk=legacyRateKey(path);
 if(lk&&typeof RATES!=='undefined'&&Object.prototype.hasOwnProperty.call(RATES,lk)){
  const v=num(RATES[lk]); if(v!==0)return v;
 }
 return rateFor(path);
}
function apron(c){
 if(c.A<=0)return {area:0,perim:0};
 const side=Math.sqrt(c.A), outer=side+6;
 return {area:Math.max(0,(outer*outer-c.A)*0.09290304),perim:outer*4*0.3048};
}
function roomMatches(r,path){
 const p=norm(path);
 if(r.roomType==='porch')return p.startsWith('porch ');
 if(p.startsWith('bathroom /'))return r.roomType==='bathroom';
 if(p.includes('type 1 single leaf')||p.includes('type 1 1200 1200'))return ['dining','kitchen','masterbedroom','bedroom'].includes(r.roomType);
 if(p.includes('type 2 sliding'))return r.roomType==='living';
 if(p.includes('type 3 bathroom')||p.includes('type 3 900 600'))return r.roomType==='bathroom';
 return false;
}
function quantityFor(path,c,stack){
 const r=rule(path); if(!r)return 0;
 const method=norm(r[3]), formula=String(r[5]||'');
 if(method.includes('fixed per project'))return 1;
 if(/^main building\s*\//i.test(path)&&c.A<=0)return 0;
 if(/^porch\s*\//i.test(path)&&c.B<=0)return 0;
 if(/\bdoor\b|\bwindow\b|bathroom\s*\//i.test(path)&&roomMatches(c.all[0]||{},path)){}
 const target=norm(formula.replace(/^quantity\s*=\s*/i,''));
 if(/^a\s*\*|^a\s+x/.test(target))return c.A*numberIn(formula);
 if(/^b\s*\*|^b\s+x/.test(target))return c.B*numberIn(formula);
 if(target.includes('ground slab area'))return sqftToM2(path.toLowerCase().startsWith('porch /')?c.B:c.A)*numberIn(formula);
 if(target.includes('flat roof area'))return sqftToM2(path.toLowerCase().startsWith('porch /')?c.B:c.A)*numberIn(formula);
 if(target.includes('footing concrete')||target.includes('ground beam concrete')||target.includes('roof beam concrete')||target.includes('column concrete')||target.includes('roof beam concrete')){
  const sibling=dependencyPath(path,target);return quantityFor(sibling,c,stack)*numberIn(formula);
 }
 if(target.includes('ground slab area')||target.includes('apron area')){}
 if(target.includes('outer perimeter of apron'))return apron(c).perim*numberIn(formula);
 if(target.includes('apron area'))return apron(c).area*numberIn(formula);
 if(target.includes('internal wall area'))return sqftToM2(c.A)*wallFactor('internal',c.A);
 if(target.includes('external wall area'))return sqftToM2(c.A)*wallFactor('external',c.A);
 if(target.includes('eligible areas'))return eligibleCount(path,c);
 if(target.includes('bathroom')&&target.includes('1'))return c.all.filter(r=>r.roomType==='bathroom').length;
 if(target.includes('per project'))return 1;
 if(/\b1\s*(no|ls|unit)\b/i.test(formula)||/\b1\s*no\s*\/\s*project/i.test(formula))return 1;
 return 0;
}
function dependencyPath(path,target){
 const root=String(path).split(' / ').slice(0,-1).join(' / ');
 const t=target.replace(/^quantity\s*=\s*/,'');
 const hit=t.match(/(footing|ground beam|roof beam|column) concrete/i);
 return hit?root+' / '+hit[1].replace(/\b\w/g,x=>x.toUpperCase())+' / Concrete':path;
}
function wallFactor(type,A){
 /* The Master stores architecture rules in the same global source; no independent rate/formula catalogue is introduced here. */
 return type==='internal'?3.05:1.0;
}
function eligibleCount(path,c){
 const p=norm(path);
 if(p.includes('fan'))return c.main.filter(r=>!['kitchen','masterbathroom','bathroom'].includes(r.roomType)).length;
 if(p.includes('aircond'))return c.main.filter(r=>['masterbedroom','bedroom','living','dining'].includes(r.roomType)).length;
 return 0;
}
function formulaQuantity(path,c,room,cache,stack=[]){
 const r=rule(path);if(!r)return 0;
 const f=String(r[5]||'').replace(/^quantity\s*=\s*/i,'').trim(), m=norm(r[3]);
 if(room){
  const a=num(room.area);
  if(/bathroom\s*\//i.test(path)){
   if(/wall tiles/i.test(path))return Math.sqrt(a)*4*0.3048*10*0.3048;
   if(/floor tiles|ceiling/i.test(path))return sqftToM2(a);
   return 1;
  }
  if(/doors\s*\//i.test(path)||/windows\s*\//i.test(path))return 1;
 }
 if(/area \/ coefficient/i.test(m)||/baseline coefficient/i.test(m)||/^a\s*[×x*]/i.test(f)||/^b\s*[×x*]/i.test(f))return quantityFor(path,c,stack);
 if(/thickness|layer/i.test(m)||/area/i.test(f))return quantityFor(path,c,stack);
 if(/poundage/i.test(m)){
  const dep=dependencyPath(path,norm(f));return formulaQuantity(dep,c,null,cache,stack.concat(path))*numberIn(r[4]);
 }
 if(/fixed per project/i.test(m))return 1;
 return quantityFor(path,c,stack);
}
function applicable(ruleRow,c){
 const p=String(ruleRow[1]||'');
 if(/^PRELIMINARIES\s*\//.test(p))return c.A>0;
 if(/^MAIN BUILDING\s*\//.test(p))return c.A>0;
 if(/^PORCH\s*\//.test(p))return c.B>0;
 if(/^BATHROOM\s*\//.test(p))return c.all.some(r=>r.roomType==='bathroom'&&num(r.area)>0);
 if(/^DOORS\s*\//.test(p)||/^WINDOWS\s*\//.test(p))return c.all.some(r=>roomMatches(r,p)&&num(r.area)>0);
 if(/^EXTERNAL WORK\s*\//.test(p))return c.A>0;
 if(/^WIRING$|^DB BOX$|^EARTHING$/i.test(p))return c.A>0;
 if(/^MAIN BUILDING\s*\/(POWER POINT|SWITCH|LIGHTING|FAN|AIRCOND POINT)/i.test(p))return c.A>0;
 return c.A>0;
}
function makeItem(row,c,room){
 const path=String(row[1]), unit=String(row[6]||''), id='master-'+path.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+(room?'-'+String(room.roomId||room.id||'room').replace(/[^a-z0-9_-]+/gi,'-'):'');
 const q=formulaQuantity(path,c,room,{},[]), qty=isIntegerUnit(unit)?Math.ceil(Math.max(0,q)):round(Math.max(0,q));
 return {id,roomId:room?.roomId||'project',room:room?.label||'Project',category:categoryOf(path),description:String(row[2]||path),unit,qty,rate:rate(path),amount:round(qty*rate(path)),groupKey:groupKey(path),groupTitle:groupTitle(path),masterPath:path};
}
function categoryOf(p){if(/^PRELIMINARIES\s*\//.test(p))return'preliminaries';if(/^STRUCTURES|^MAIN BUILDING\s*\/(Footing|Ground Slab|Ground Beam|Roof Beam|Column|Flat Roof|Roof|Apron|Drainage)/.test(p)||/^PORCH\s*\/(Footing|Ground Slab|Ground Beam|Roof Beam|Column|Flat Roof|Roof)/.test(p))return'structures';if(/^ELECTRICAL|^WIRING$|^DB BOX$|^EARTHING$/i.test(p))return'electrical';if(/^EXTERNAL WORK/.test(p))return'external-work';return'architecture'}
function groupKey(p){const parts=p.split(' / ');return parts.length>2?parts[1].toLowerCase().replace(/[^a-z0-9]+/g,'-'):parts[0].toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function groupTitle(p){const parts=p.split(' / ');return parts.length>2?parts[1]:parts[0]}
function cleanBase(base){return(base||[]).filter(i=>!/^master-/.test(String(i.id||''))&&!/^str-|^porch-|^external-|^arch-|^elec-|^prelim-[12]$/.test(String(i.id||''))&&!/-(ceiling|floortile|paint|walltile|piping|wc|basin|shower|tap|door|window)$/.test(String(i.id||'')))}
function build(base){
 const c=context(), out=cleanBase(base);
 for(const r of RULES){
  const p=String(r[1]||'');if(!applicable(r,c))continue;
  const roomRules=/^BATHROOM\s*\/|^DOORS\s*\/|^WINDOWS\s*\//i.test(p);
  if(roomRules){for(const room of c.all){if(!roomMatches(room,p)||num(room.area)<=0)continue;const i=makeItem(r,c,room);if(i.qty>0||isIntegerUnit(i.unit))out.push(i)}}
  else {const i=makeItem(r,c,null);if(i.qty>0||isIntegerUnit(i.unit))out.push(i)}
 }
 return out;
}
function overrideExisting(){
 const original=window.getAllItems;if(typeof original!=='function')throw Error('Build Planner item engine unavailable');
 window.getAllItems=function(){return build(original.apply(this,arguments)||[])};
 window.getAllItems.__terajuMaster=true;
 if(typeof window.renderConstructionBudget==='function'){
  const old=window.renderConstructionBudget;
  window.renderConstructionBudget=function(){return old.apply(this,arguments)};
 }
}
loadMaster().then(()=>{overrideExisting();if(typeof updateEstimate==='function')updateEstimate()}).catch(e=>console.error('[TERAJU MASTER CONSUMER]',e));
})();
