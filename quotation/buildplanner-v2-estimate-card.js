(function(){
  'use strict';
  if(!/buildplanner-v2\.html$/i.test(location.pathname)) return;
  if(window.__terajuV2RuleHierarchyEstimateCard) return;
  window.__terajuV2RuleHierarchyEstimateCard = true;
  const TOP_ORDER=['PRELIMINARIES','STRUCTURES','ARCHITECTURES','ELECTRICAL','DOORS & WINDOWS','EXTERNAL WORK'];
  function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function num(v){return Number(v)||0}
  function qty(v){return Math.max(0,Math.ceil(num(v)))}
  function rate(v){return Math.max(0,Math.round(num(v)*100)/100)}
  function money(v){return new Intl.NumberFormat('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}).format(rate(v))}
  function isContractor(){return typeof IS_CONTRACTOR!=='undefined'&&!!IS_CONTRACTOR}
  function ruleItemName(path){const p=String(path||'').split(' / ');return p.length>1?p.slice(-2).join(' / '):p[0]||'Item'}
  function classify(item,rooms){
    const id=String(item?.id||''),desc=String(item?.description||''),lower=desc.toLowerCase(),room=(rooms||[]).find(r=>r.roomId===item.roomId);
    if(/^prelim-/.test(id)||item.category==='preliminaries')return {top:'PRELIMINARIES',path:id==='prelim-1'?'PRELIMINARIES / Building Plan / Submission':'PRELIMINARIES / Site Mobilisation / Project Management',target:'prelim'};
    if(/^elec-/.test(id)||item.category==='electrical'){
      const map={'elec-pp':'MAIN BUILDING / POWER POINT','elec-switch':'MAIN BUILDING / SWITCH','elec-light':'MAIN BUILDING / LIGHTING','elec-fan':'MAIN BUILDING / FAN','elec-ac':'MAIN BUILDING / AIRCOND POINT','elec-db':'DB BOX','elec-wiring':'WIRING','elec-earth':'EARTHING'};
      return {top:'ELECTRICAL',path:map[id]||'ELECTRICAL / Additional Item',target:'electrical'};
    }
    if(/-door$/.test(id)||/\bdoor\b/.test(lower)&&item.category!=='structures'){
      let path='DOORS / Type 1 Single Leaf'; if(room?.roomType==='bathroom')path='DOORS / Type 3 Bathroom'; else if(room?.roomType==='living'||room?.roomType==='dining')path='DOORS / Type 2 Sliding';
      return {top:'DOORS & WINDOWS',path:'DOORS & WINDOWS / '+path,target:null};
    }
    if(/-window$/.test(id)||/\bwindow\b/.test(lower)&&item.category!=='structures'){
      let path='WINDOWS / Type 1 1200×1200'; if(room?.roomType==='kitchen')path='WINDOWS / Type 2 1800×1200'; else if(room?.roomType==='bathroom')path='WINDOWS / Type 3 900×600';
      return {top:'DOORS & WINDOWS',path:'DOORS & WINDOWS / '+path,target:null};
    }
    if(item.category==='structures'){
      const map={'str-footing-conc':'MAIN BUILDING / Footing / Concrete','str-footing-fw':'MAIN BUILDING / Footing / Formwork','str-footing-rebar':'MAIN BUILDING / Footing / Rebar','str-slab-conc':'MAIN BUILDING / Ground Slab / Concrete','str-slab-brc':'MAIN BUILDING / Ground Slab / BRC','str-gb-conc':'MAIN BUILDING / Ground Beam / Concrete','str-gb-fw':'MAIN BUILDING / Ground Beam / Formwork','str-gb-rebar':'MAIN BUILDING / Ground Beam / Rebar','str-rb-conc':'MAIN BUILDING / Roof Beam / Concrete','str-rb-fw':'MAIN BUILDING / Roof Beam / Formwork','str-rb-rebar':'MAIN BUILDING / Roof Beam / Rebar','str-col-conc':'MAIN BUILDING / Column / Concrete','str-col-fw':'MAIN BUILDING / Column / Formwork','str-col-rebar':'MAIN BUILDING / Column / Rebar','str-fr-conc':'MAIN BUILDING / Flat Roof / Concrete','str-fr-fw':'MAIN BUILDING / Flat Roof / Formwork','str-fr-brc':'MAIN BUILDING / Flat Roof / BRC','str-roof-m':'MAIN BUILDING / Roof / Metal Roofing Sheet','str-apron-c':'MAIN BUILDING / Apron / Concrete','str-apron-f':'MAIN BUILDING / Apron / Formwork','str-apron-b':'MAIN BUILDING / Apron / BRC','str-drain':'MAIN BUILDING / Drainage','str-roof-dc':'ROOF DESIGN / Concrete','str-roof-df':'ROOF DESIGN / Formwork','str-roof-dr':'ROOF DESIGN / Rebar'};
      return {top:'STRUCTURES',path:map[id]||('STRUCTURES / '+(item.groupTitle||'Additional Structural Works')),target:item.groupKey?`structures:${item.groupKey}`:'structures'};
    }
    if(item.category==='architecture'){
      if(id==='arch-watertank')return {top:'ARCHITECTURES',path:'MAIN BUILDING / Water Tank',target:null};
      if(id==='arch-septik')return {top:'ARCHITECTURES',path:'MAIN BUILDING / Septic Tank',target:null};
      if(/-piping$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / Piping',target:room?`room:${room.roomId}`:null};
      if(/-wc$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / WC',target:room?`room:${room.roomId}`:null};
      if(/-basin$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / Basin',target:room?`room:${room.roomId}`:null};
      if(/-shower$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / Shower',target:room?`room:${room.roomId}`:null};
      if(/-tap$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / Tap',target:room?`room:${room.roomId}`:null};
      if(/-walltile$/.test(id))return {top:'ARCHITECTURES',path:'BATHROOM / Wall Tiles',target:room?`room:${room.roomId}`:null};
      if(/-floortile$/.test(id)&&room?.roomType==='bathroom')return {top:'ARCHITECTURES',path:'BATHROOM / Floor Tiles',target:room?`room:${room.roomId}`:null};
      if(/-ceiling$/.test(id)&&room?.roomType==='bathroom')return {top:'ARCHITECTURES',path:'BATHROOM / Ceiling',target:room?`room:${room.roomId}`:null};
      if(/-floortile$/.test(id)&&room?.roomType==='porch')return {top:'ARCHITECTURES',path:'MAIN BUILDING / Floor Tiles / External',target:room?`room:${room.roomId}`:null};
      if(/-floortile$/.test(id))return {top:'ARCHITECTURES',path:'MAIN BUILDING / Floor Tiles / Internal',target:room?`room:${room.roomId}`:null};
      if(/-paint$/.test(id))return {top:'ARCHITECTURES',path:'MAIN BUILDING / Painting / Internal',target:room?`room:${room.roomId}`:null};
      if(/-ceiling$/.test(id))return {top:'ARCHITECTURES',path:'MAIN BUILDING / Ceiling / Internal',target:room?`room:${room.roomId}`:null};
      return {top:'ARCHITECTURES',path:'ARCHITECTURES / '+(item.groupTitle||'Additional Architectural Works'),target:room?`room:${room.roomId}`:null};
    }
    if(item.category==='preliminaries')return {top:'PRELIMINARIES',path:'PRELIMINARIES / Additional Item',target:'prelim'};
    if(item.category==='structures')return {top:'STRUCTURES',path:'STRUCTURES / Additional Item',target:'structures'};
    if(item.category==='electrical')return {top:'ELECTRICAL',path:'ELECTRICAL / Additional Item',target:'electrical'};
    return {top:'EXTERNAL WORK',path:'EXTERNAL WORK / Additional Item',target:null};
  }
  function render(items,rooms,total){
    const c=document.getElementById('estimateContent'); if(!c)return;
    const active=(items||[]).filter(i=>!(typeof excludedItems!=='undefined'&&excludedItems instanceof Set&&excludedItems.has(i.id)));
    const groups=new Map(TOP_ORDER.map(k=>[k,[]])); active.forEach(item=>{const meta=classify(item,rooms||[]);groups.get(meta.top)?.push({...item,_meta:meta})});
    const row=i=>`<tr class="border-b align-top" data-rule-item-id="${esc(i.id)}"><td class="py-3 px-2">${isContractor()?`<textarea class="w-full border rounded-lg px-3 py-2 bg-white" onchange="editItemDescription('${esc(i.id)}',this.value)">${esc(ruleItemName(i._meta.path))}</textarea>`:`<div class="homeowner-locked py-2 rounded-lg">${esc(ruleItemName(i._meta.path))}</div>`}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2">${isContractor()?`<input type="number" min="0" step="1" value="${qty(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right" onchange="editItemQuantity('${esc(i.id)}',this.value)">`:`<div class="homeowner-locked text-right py-2">${qty(i.qty)}</div>`}</td><td class="py-3 px-2">${isContractor()?`<input type="number" min="0" step="0.01" value="${rate(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right" onchange="editItemRate('${esc(i.id)}',this.value)">`:`<div class="homeowner-locked text-right py-2">${money(i.rate)}</div>`}</td><td class="py-3 px-2 text-right font-medium">${money(i.amount)}</td><td class="py-3 px-2"><button type="button" onclick="excludeItem('${esc(i.id)}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button></td></tr>`;
    const heading=t=>`<tr class="quotation-section-row"><td colspan="6" class="py-3 px-2">${esc(t)}</td></tr>`,sub=t=>`<tr class="quotation-subsection-row"><td colspan="6" class="py-2 px-2">${esc(t)}</td></tr>`;
    const add=target=>isContractor()&&target?`<tr class="no-print"><td colspan="6" class="py-2 px-2"><div class="contractor-only" data-manual-anchor="${esc(target)}"><button type="button" class="border px-3 py-1.5 rounded-lg text-xs bg-white" onclick="addManualItemPrompt('${esc(target)}')">+ Add Item</button></div></td></tr>`:'';
    const subtotal=arr=>arr.reduce((s,i)=>s+num(i.amount),0);
    let h='<table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col style="width:32%"><col style="width:8%"><col style="width:13%"><col style="width:15%"><col style="width:20%"><col style="width:12%"></colgroup><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th><th>Action</th></tr></thead><tbody>';
    for(const top of TOP_ORDER){
      const arr=groups.get(top)||[]; if(!arr.length)continue; h+=heading(top);
      if(top==='ARCHITECTURES'){
        const roomGroups=new Map(),project=[]; arr.forEach(i=>{if(i.roomId&&i.roomId!=='project'){if(!roomGroups.has(i.roomId))roomGroups.set(i.roomId,[]);roomGroups.get(i.roomId).push(i)}else project.push(i)});
        if(project.length){const byPath=new Map();project.forEach(i=>{if(!byPath.has(i._meta.path))byPath.set(i._meta.path,[]);byPath.get(i._meta.path).push(i)});for(const [path,items2] of byPath){h+=sub(path)+items2.map(row).join('')}}
        for(const [roomId,items2] of roomGroups){const room=(rooms||[]).find(r=>r.roomId===roomId),byPath=new Map();items2.forEach(i=>{if(!byPath.has(i._meta.path))byPath.set(i._meta.path,[]);byPath.get(i._meta.path).push(i)});for(const [path,pathItems] of byPath){h+=sub(`${path} — ${room?.label||roomId}${room?.area?` (${qty(room.area)} sqft)`:''}`)+pathItems.map(row).join('')}h+=add(`room:${roomId}`)}
        h+=`<tr class="border-b"><td colspan="5" class="py-2 px-2 text-right font-semibold">Subtotal - ${esc(top)}</td><td class="py-2 px-2 text-right font-semibold">${money(subtotal(arr))}</td></tr>`;
      }else{
        const byPath=new Map();arr.forEach(i=>{if(!byPath.has(i._meta.path))byPath.set(i._meta.path,[]);byPath.get(i._meta.path).push(i)});for(const [path,pathItems] of byPath){h+=sub(path)+pathItems.map(row).join('')}
        const target=top==='PRELIMINARIES'?'prelim':top==='STRUCTURES'?'structures':top==='ELECTRICAL'?'electrical':null; h+=add(target); h+=`<tr class="border-b"><td colspan="5" class="py-2 px-2 text-right font-semibold">Subtotal - ${esc(top)}</td><td class="py-2 px-2 text-right font-semibold">${money(subtotal(arr))}</td></tr>`;
      }
    }
    h+='</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">'+money(total)+'</td><td></td></tr></tfoot></table>'; c.innerHTML=h;
  }
  function install(){if(typeof window.renderEstimate!=='function')return false;if(window.renderEstimate.__terajuRuleHierarchyWrapped)return true;const original=window.renderEstimate;const wrapped=function(items,rooms,total,roomsArea,declared){const result=original.apply(this,arguments);try{render(items,rooms,total)}catch(err){console.error('[TERAJU V2 estimate card]',err)}return result};wrapped.__terajuRuleHierarchyWrapped=true;window.renderEstimate=wrapped;if(typeof window.updateEstimate==='function')window.updateEstimate();return true}
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>40)clearInterval(timer)},250);if(document.readyState!=='loading')install();else document.addEventListener('DOMContentLoaded',install,{once:true});
})();