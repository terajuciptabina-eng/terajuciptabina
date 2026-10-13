/* TERAJUWORKS — Canonical Cost / SQFT Metrics */
(function(){
  'use strict';
  if(window.TERAJU_COST_METRIC)return;
  const N=v=>Number.isFinite(Number(v))?Number(v):0;
  const currentCountry=()=>window.TERAJU_GET_PROJECT_COUNTRY?.()||{currency:'MYR',symbol:'RM',locale:'en-MY'};
  const money=(v,locale)=>N(v).toLocaleString(locale||currentCountry().locale||'en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const currencySymbol=country=>String(country?.currencySymbol||country?.projectCountry?.symbol||country?.symbol||currentCountry().symbol||'RM');
  const area=v=>Math.max(0,N(v));
  const rate=(cost,sqft)=>sqft>0?cost/sqft:null;
  function roomsFor(value){
    return Array.isArray(value)?value.map(r=>({
      roomId:String(r?.roomId??r?.id??''),
      condition:String(r?.condition??'existing').toLowerCase()==='new'?'new':'existing',
      area:area(r?.area),
      label:String(r?.label??r?.name??'')
    })).filter(r=>r.area>0):[];
  }
  function summarize(plannerType,items,rooms,country){
    const list=Array.isArray(items)?items:[];
    const symbol=currencySymbol(country),locale=country?.plannerState?.projectCountry?.locale||country?.projectCountry?.locale||country?.locale||currentCountry().locale||'en-MY';
    const rs=roomsFor(rooms);
    if(String(plannerType).toLowerCase()==='renovation'){
      const existingIds=new Set(rs.filter(r=>r.condition==='existing').map(r=>r.roomId));
      const newIds=new Set(rs.filter(r=>r.condition==='new').map(r=>r.roomId));
      const existingArea=rs.filter(r=>r.condition==='existing').reduce((s,r)=>s+r.area,0);
      const newArea=rs.filter(r=>r.condition==='new').reduce((s,r)=>s+r.area,0);
      const isPrelim=i=>String(i?.category||'').toLowerCase()==='preliminaries'||String(i?.id||'')==='project-preliminaries';
      const isExternal=i=>String(i?.category||'').toLowerCase()==='external-work';
      // RM/sqft is meaningful only when the saved estimate contains attributable
      // cost items for that side of the renovation. Legacy/partial records may have
      // an area snapshot but no item snapshot; never present that as RM 0.00/sqft.
      const existingItems=list.filter(i=>existingIds.has(String(i?.roomId??'')));
      const newItems=list.filter(i=>(String(i?.roomId??'')==='project'||newIds.has(String(i?.roomId??'')))&&!isPrelim(i)&&!isExternal(i));
      const existingCost=existingItems.reduce((s,i)=>s+N(i?.amount),0);
      const newCost=newItems.reduce((s,i)=>s+N(i?.amount),0);
      const existingRate=existingItems.length?rate(existingCost,existingArea):null;
      const newRate=newItems.length?rate(newCost,newArea):null;
      return {plannerType:'renovation',existingArea,newArea,existingCost,newCost,existingRate,newRate,totalArea:existingArea+newArea,totalCost:list.reduce((s,i)=>s+N(i?.amount),0),hasItemSnapshot:list.length>0,currencySymbol:symbol,locale};
    }
    const builtUpArea=rs.reduce((s,r)=>s+r.area,0);
    const totalCost=list.reduce((s,i)=>s+N(i?.amount),0);
    return {plannerType:'build',builtUpArea,totalCost,costPerSqft:rate(totalCost,builtUpArea),currencySymbol:symbol,locale};
  }
  function html(summary,mode='compact'){
    const symbol=summary?.currencySymbol||currentCountry().symbol||'RM',locale=summary?.locale||currentCountry().locale||'en-MY';
    if(summary?.plannerType==='renovation'){
      const cls=mode==='card'?'':'';
      return '<div class="teraju-cost-sqft-grid '+cls+'">'+
        '<div><p class="teraju-cost-sqft-label">Existing Area</p><p class="teraju-cost-sqft-value">'+money(summary.existingArea,locale)+' sqft</p></div>'+
        '<div><p class="teraju-cost-sqft-label">Existing '+symbol+'/sqft</p><p class="teraju-cost-sqft-value">'+(summary.existingRate==null?'—':symbol+' '+money(summary.existingRate,locale)+'/sqft')+'</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New Area</p><p class="teraju-cost-sqft-value">'+money(summary.newArea,locale)+' sqft</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New '+symbol+'/sqft</p><p class="teraju-cost-sqft-value">'+(summary.newRate==null?'—':symbol+' '+money(summary.newRate,locale)+'/sqft')+'</p></div>'+
      '</div>';
    }
    return '<div class="teraju-cost-sqft-grid '+mode+'">'+
      '<div><p class="teraju-cost-sqft-label">Built-up Area</p><p class="teraju-cost-sqft-value">'+money(summary.builtUpArea,locale)+' sqft</p></div>'+
      '<div><p class="teraju-cost-sqft-label">'+symbol+'/sqft</p><p class="teraju-cost-sqft-value">'+(summary.costPerSqft==null?'—':symbol+' '+money(summary.costPerSqft,locale)+'/sqft')+'</p></div>'+
    '</div>';
  }
  function history(summary){
    const symbol=summary?.currencySymbol||currentCountry().symbol||'RM',locale=summary?.locale||currentCountry().locale||'en-MY';
    if(summary?.plannerType==='renovation'){
      return '<div class="mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-wide">'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Existing '+money(summary.existingArea,locale)+' sqft · '+symbol+' '+(summary.existingRate==null?'—':money(summary.existingRate,locale))+'/sqft</span>'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">New '+money(summary.newArea,locale)+' sqft · '+symbol+' '+(summary.newRate==null?'—':money(summary.newRate,locale))+'/sqft</span></div>';
    }
    return '<div class="mt-3"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-700">'+money(summary.builtUpArea,locale)+' sqft · '+symbol+' '+(summary.costPerSqft==null?'—':money(summary.costPerSqft,locale))+'/sqft</span></div>';
  }
  if(!document.getElementById('teraju-cost-sqft-style')){const s=document.createElement('style');s.id='teraju-cost-sqft-style';s.textContent='.teraju-cost-sqft-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc}.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}.teraju-cost-sqft-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin:0}.teraju-cost-sqft-value{font-size:14px;font-weight:700;color:#111827;margin:4px 0 0}.teraju-cost-sqft-grid>div{min-width:0}@media(max-width:640px){.teraju-cost-sqft-grid,.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(s);}
  window.TERAJU_COST_METRIC={summarize,html,history,money};
})();