/* TERAJUWORKS — Canonical Cost / SQFT Metrics */
(function(){
  'use strict';
  if(window.TERAJU_COST_METRIC)return;
  const N=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>N(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
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
      const existingCost=list.filter(i=>existingIds.has(String(i?.roomId??''))).reduce((s,i)=>s+N(i?.amount),0);
      const newCost=list.filter(i=>(String(i?.roomId??'')==='project'||newIds.has(String(i?.roomId??'')))&&!isPrelim(i)&&!isExternal(i)).reduce((s,i)=>s+N(i?.amount),0);
      return {plannerType:'renovation',existingArea,newArea,existingCost,newCost,existingRate:rate(existingCost,existingArea),newRate:rate(newCost,newArea),totalArea:existingArea+newArea,totalCost:list.reduce((s,i)=>s+N(i?.amount),0)};
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
        '<div><p class="teraju-cost-sqft-label">Existing RM/sqft</p><p class="teraju-cost-sqft-value">'+(summary.existingRate==null?'—':'RM '+money(summary.existingRate)+'/sqft')+'</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New Area</p><p class="teraju-cost-sqft-value">'+money(summary.newArea)+' sqft</p></div>'+
        '<div><p class="teraju-cost-sqft-label">New RM/sqft</p><p class="teraju-cost-sqft-value">'+(summary.newRate==null?'—':'RM '+money(summary.newRate)+'/sqft')+'</p></div>'+
      '</div>';
    }
    return '<div class="teraju-cost-sqft-grid '+mode+'">'+
      '<div><p class="teraju-cost-sqft-label">Built-up Area</p><p class="teraju-cost-sqft-value">'+money(summary.builtUpArea)+' sqft</p></div>'+
      '<div><p class="teraju-cost-sqft-label">RM/sqft</p><p class="teraju-cost-sqft-value">'+(summary.costPerSqft==null?'—':'RM '+money(summary.costPerSqft)+'/sqft')+'</p></div>'+
    '</div>';
  }
  function history(summary){
    if(summary?.plannerType==='renovation'){
      return '<div class="mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-wide">'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Existing '+money(summary.existingArea)+' sqft · RM '+(summary.existingRate==null?'—':money(summary.existingRate))+'/sqft</span>'+
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">New '+money(summary.newArea)+' sqft · RM '+(summary.newRate==null?'—':money(summary.newRate))+'/sqft</span></div>';
    }
    return '<div class="mt-3"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-700">'+money(summary.builtUpArea)+' sqft · RM '+(summary.costPerSqft==null?'—':money(summary.costPerSqft))+'/sqft</span></div>';
  }
  if(!document.getElementById('teraju-cost-sqft-style')){const s=document.createElement('style');s.id='teraju-cost-sqft-style';s.textContent='.teraju-cost-sqft-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc}.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}.teraju-cost-sqft-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin:0}.teraju-cost-sqft-value{font-size:14px;font-weight:700;color:#111827;margin:4px 0 0}.teraju-cost-sqft-grid>div{min-width:0}@media(max-width:640px){.teraju-cost-sqft-grid,.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(s);}
  window.TERAJU_COST_METRIC={summarize,html,history,money};
})();