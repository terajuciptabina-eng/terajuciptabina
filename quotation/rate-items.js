/* TERAJU Build Planner rate-item extension.
   Keeps the stable planner source intact while adding a project-level custom rate list.
   State/global rate metadata is read from window.TERAJU_RATE_ITEMS.
   New project items live in standardRateItems and are already included by quotation-records.js snapshots.
*/
(function(){
  'use strict';
  if(!/buildplanner\.html$/i.test(location.pathname))return;

  const originalStandardLibrary=window.standardLibrary;
  const originalRenderRateSchedule=window.renderRateSchedule;

  function esc(v){return typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function rate(v){return typeof window.normalizeRate==='function'?window.normalizeRate(v):Math.max(0,Math.round((Number(v)||0)*100)/100)}
  function itemsFromState(){
    const src=window.TERAJU_RATE_ITEMS||{};
    return Object.entries(src).map(([key,item])=>({
      id:'state-rate-'+key,key,description:String(item?.description||key),unit:String(item?.unit||'ls'),rate:rate(window.RATES?.[key]),
      category:String(item?.category||'custom'),groupKey:item?.groupKey||null,groupTitle:String(item?.groupTitle||'Custom Rate Items'),custom:true,stateRate:true
    }));
  }

  window.standardLibrary=function(){
    const base=typeof originalStandardLibrary==='function'?originalStandardLibrary():[];
    const globalItems=itemsFromState();
    const localItems=Array.isArray(window.standardRateItems)?window.standardRateItems:[];
    const seen=new Set(base.map(x=>x.key||x.id).concat(globalItems.map(x=>x.key||x.id)));
    const merged=[...base];
    globalItems.forEach(x=>{if(!seen.has(x.key||x.id)){merged.push(x);seen.add(x.key||x.id)}else{const idx=merged.findIndex(y=>(y.key||y.id)===(x.key||x.id));if(idx>=0)merged[idx]={...merged[idx],...x}}});
    localItems.forEach(x=>{if(x?.description&&x?.id&&!merged.some(y=>y.id===x.id))merged.push({...x,rate:rate(x.rate),custom:true})});
    return merged;
  };

  function renderCustomRateRows(){
    const c=document.getElementById('rateScheduleContent');
    if(!c)return;
    let box=c.querySelector('[data-custom-rate-list]');
    if(box)box.remove();
    const global=itemsFromState();
    const local=(Array.isArray(window.standardRateItems)?window.standardRateItems:[]).filter(x=>x&&x.description);
    if(!global.length&&!local.length&&!document.body.classList.contains('contractor-mode'))return;
    box=document.createElement('div');box.setAttribute('data-custom-rate-list','');box.className='mt-5 border-t pt-5';
    let html='<div class="flex items-center justify-between gap-3 mb-3"><div><h4 class="font-bold text-sm">Custom / Additional Rate Items</h4><p class="text-xs text-gray-500">State rate items are loaded from the selected state. Project items are stored with the quotation snapshot.</p></div></div>';
    html+='<div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th><th class="py-2 px-2">Source</th><th class="py-2 px-2">Action</th></tr></thead><tbody>';
    global.forEach(x=>{
      const control=document.body.classList.contains('contractor-mode')?`<input type="number" min="0" step="0.01" value="${rate(x.rate).toFixed(2)}" data-state-rate-key="${esc(x.key)}" class="w-28 border rounded-lg px-2 py-1.5 text-right bg-white">`:`<span class="inline-block min-w-[7rem] px-2 py-1.5 text-right text-gray-700">${rate(x.rate).toFixed(2)}</span>`;
      html+=`<tr class="border-b"><td class="py-2 px-2">${esc(x.description)}</td><td class="py-2 px-2">${esc(x.unit)}</td><td class="py-2 px-2 text-right">${control}</td><td class="py-2 px-2 text-xs text-gray-500">${esc(window.TERAJU_RATE_CONTEXT?.name||'State Rate')}</td><td class="py-2 px-2 text-xs text-gray-500">State item</td></tr>`;
    });
    local.forEach(x=>{
      html+=`<tr class="border-b"><td class="py-2 px-2">${esc(x.description)}</td><td class="py-2 px-2">${esc(x.unit||'ls')}</td><td class="py-2 px-2 text-right"><input type="number" min="0" step="0.01" value="${rate(x.rate).toFixed(2)}" data-local-rate-id="${esc(x.id)}" class="w-28 border rounded-lg px-2 py-1.5 text-right bg-white"></td><td class="py-2 px-2 text-xs text-gray-500">Project</td><td class="py-2 px-2"><button type="button" data-remove-local-rate="${esc(x.id)}" class="text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs">Remove</button></td></tr>`;
    });
    html+='</tbody></table></div>';
    if(document.body.classList.contains('contractor-mode')){
      html+='<div class="mt-4 border rounded-xl bg-gray-50 p-4"><div class="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end"><label class="block"><span class="block text-xs font-medium text-gray-500 mb-1">New Description</span><input id="newRateItemDescription" type="text" placeholder="e.g. Extra structural work" class="w-full border rounded-lg px-3 py-2 bg-white"></label><label class="block"><span class="block text-xs font-medium text-gray-500 mb-1">Unit</span><select id="newRateItemUnit" class="w-full border rounded-lg px-3 py-2 bg-white"><option value="ls">ls</option><option value="no">no</option><option value="set">set</option><option value="m">m</option><option value="ft">ft</option><option value="sqft">sqft</option><option value="m3">m3</option><option value="kg">kg</option></select></label><label class="block"><span class="block text-xs font-medium text-gray-500 mb-1">Rate (RM)</span><input id="newRateItemRate" type="number" min="0" step="0.01" value="0.00" class="w-full border rounded-lg px-3 py-2 bg-white"></label><button type="button" id="addProjectRateItemBtn" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold">+ Add Item</button></div><p class="text-xs text-gray-500 mt-2">This creates a project-specific standard item. It will be included in the quotation record when the quotation is saved.</p></div>';
    }
    box.innerHTML=html;c.appendChild(box);
    box.querySelectorAll('[data-local-rate-id]').forEach(input=>input.addEventListener('change',()=>{const item=(window.standardRateItems||[]).find(x=>x.id===input.dataset.localRateId);if(item){item.rate=rate(input.value);if(typeof window.saveContractorState==='function')window.saveContractorState();if(typeof window.updateEstimate==='function')window.updateEstimate();}}));
    box.querySelectorAll('[data-remove-local-rate]').forEach(btn=>btn.addEventListener('click',()=>{if(!Array.isArray(window.standardRateItems))return;window.standardRateItems=window.standardRateItems.filter(x=>x.id!==btn.dataset.removeLocalRate);if(typeof window.saveContractorState==='function')window.saveContractorState();if(typeof window.updateEstimate==='function')window.updateEstimate();if(typeof window.toggleRateSchedule==='function')window.renderRateSchedule();}));
    box.querySelector('#addProjectRateItemBtn')?.addEventListener('click',()=>{
      const description=String(box.querySelector('#newRateItemDescription')?.value||'').trim();
      const unit=String(box.querySelector('#newRateItemUnit')?.value||'ls');
      const itemRate=rate(box.querySelector('#newRateItemRate')?.value);
      if(!description){alert('Please enter the new item description.');return;}
      const id='custom-rate-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
      if(!Array.isArray(window.standardRateItems))window.standardRateItems=[];
      window.standardRateItems.push({id,description,unit,rate:itemRate,category:'custom',groupKey:null,groupTitle:'Custom Rate Items',custom:true});
      if(typeof window.saveContractorState==='function')window.saveContractorState();
      if(typeof window.renderRateSchedule==='function')window.renderRateSchedule();
    });
  }

  window.renderRateSchedule=function(){
    if(typeof originalRenderRateSchedule==='function')originalRenderRateSchedule();
    renderCustomRateRows();
  };

  window.addEventListener('teraju:ratechange',()=>{
    if(!document.getElementById('rateSchedulePanel')?.classList.contains('hidden'))window.renderRateSchedule();
  });
  setTimeout(()=>{
    if(!document.getElementById('rateSchedulePanel')?.classList.contains('hidden'))window.renderRateSchedule();
  },250);
})();
