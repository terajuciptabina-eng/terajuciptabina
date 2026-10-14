/* TERAJUWORKS — Canonical Cost / SQFT Metrics */
(function(){
  'use strict';
  if(window.TERAJU_COST_METRIC)return;
  const N=v=>Number.isFinite(Number(v))?Number(v):0;
  const market=()=>{try{return typeof window.TERAJU_GET_PROJECT_COUNTRY==='function'?window.TERAJU_GET_PROJECT_COUNTRY():{currency:'MYR',symbol:'RM',locale:'en-MY'}}catch{return {currency:'MYR',symbol:'RM',locale:'en-MY'}}};
  const money=v=>N(v).toLocaleString(market().locale||'en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const currency=()=>market().symbol||'RM';
  const moneyWithCurrency=v=>currency()+' '+money(v);
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
  function summarize(plannerType,items,rooms){
    const list=Array.isArray(items)?items:[];
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
      return {plannerType:'renovation',existingArea,newArea,existingCost,newCost,existingRate,newRate,totalArea:existingArea+newArea,totalCost:list.reduce((s,i)=>s+N(i?.amount),0),hasItemSnapshot:list.length>0};
    }
    const builtUpArea=rs.reduce((s,r)=>s+r.area,0);
    const totalCost=list.reduce((s,i)=>s+N(i?.amount),0);
    return {plannerType:'build',builtUpArea,totalCost,costPerSqft:rate(totalCost,builtUpArea)};
  }
  function html(summary,mode='compact'){
    if(summary?.plannerType==='renovation'){
      const cls=mode==='card'?'':'';
      return '<div class="teraju-cost-sqft-grid '+cls+'">'+
        '<div><p class="teraju-cost-sqft-label">Existing Area</p><p class="teraju-cost-sqft-value">'+money(summary.existingArea)+' sqft</p></div>'+
        '<div><p class="teraju-cost-sqft-label">Existing ${currency()}/sqft</p><p class="teraju-cost-sqft-value">'+(summary.existingRate==null?'—':moneyWithCurrency(summary.existingRate)+'/sqft')+'</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New Area</p><p class="teraju-cost-sqft-value">'+money(summary.newArea)+' sqft</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New ${currency()}/sqft</p><p class="teraju-cost-sqft-value">'+(summary.newRate==null?'—':moneyWithCurrency(summary.newRate)+'/sqft')+'</p></div>'+
      '</div>';
    }
    return '<div class="teraju-cost-sqft-grid '+mode+'">'+
      '<div><p class="teraju-cost-sqft-label">Built-up Area</p><p class="teraju-cost-sqft-value">'+money(summary.builtUpArea)+' sqft</p></div>'+
      '<div><p class="teraju-cost-sqft-label">${currency()}/sqft</p><p class="teraju-cost-sqft-value">'+(summary.costPerSqft==null?'—':moneyWithCurrency(summary.costPerSqft)+'/sqft')+'</p></div>'+
    '</div>';
  }
  function history(summary){
    if(summary?.plannerType==='renovation'){
      return '<div class="mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-wide">'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Existing '+money(summary.existingArea)+' sqft · '+moneyWithCurrency(summary.existingRate==null?'—':summary.existingRate)+'/sqft</span>'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">New '+money(summary.newArea)+' sqft · '+moneyWithCurrency(summary.newRate==null?'—':summary.newRate)+'/sqft</span></div>';
    }
    return '<div class="mt-3"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-700">'+money(summary.builtUpArea)+' sqft · '+moneyWithCurrency(summary.costPerSqft==null?'—':summary.costPerSqft)+'/sqft</span></div>';
  }
  if(!document.getElementById('teraju-cost-sqft-style')){const s=document.createElement('style');s.id='teraju-cost-sqft-style';s.textContent='.teraju-cost-sqft-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc}.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}.teraju-cost-sqft-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin:0}.teraju-cost-sqft-value{font-size:14px;font-weight:700;color:#111827;margin:4px 0 0}.teraju-cost-sqft-grid>div{min-width:0}@media(max-width:640px){.teraju-cost-sqft-grid,.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(s);}
  window.TERAJU_COST_METRIC={summarize,html,history,money};
})();