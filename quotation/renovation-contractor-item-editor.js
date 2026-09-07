(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcRenovationContractorEditorInstalled) return;
    if (typeof window.getData !== 'function' || typeof window.updateEstimate !== 'function') return;
    window.__tcRenovationContractorEditorInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const qty = v => typeof window.formatQty === 'function' ? window.formatQty(v) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});

    function contractorState() {
      window.__tcRenovationContractorState ||= {
        excluded: new Set(),
        rates: new Map(),
        descriptions: new Map()
      };
      return window.__tcRenovationContractorState;
    }

    function applyOverrides(data) {
      const s=contractorState();
      (data.allItems||[]).forEach(i=>{
        if(s.rates.has(i.id)) i.rate=s.rates.get(i.id);
        if(s.descriptions.has(i.id)) i.description=s.descriptions.get(i.id);
        i.amount=i.qty*i.rate;
      });
      data.allItems=(data.allItems||[]).filter(i=>!s.excluded.has(i.id));
      return data;
    }

    function recalculateProjectPreliminaries(data) {
      const s=contractorState();
      if(s.excluded.has('project-preliminaries')) data.projectPreliminaries=0;
      if(s.rates.has('project-preliminaries')) data.projectPreliminaries=s.rates.get('project-preliminaries');
      return data;
    }

    function render() {
      const c=document.getElementById('estimateContent');
      if(!c) return;
      const d=recalculateProjectPreliminaries(applyOverrides(window.getData()));
      const s=contractorState();
      const by={};
      (d.allItems||[]).forEach(i => (by[i.roomId] ||= []).push(i));
      const edit=i => `<div class="grid md:grid-cols-[minmax(0,1fr)_110px_120px_auto] gap-2 mt-2 no-print"><input value="${esc(i.description)}" onchange="window.__tcRenovationEditDescription('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2" aria-label="Description"><input type="number" min="0" step="0.01" value="${Number(i.qty)}" onchange="editItemQuantity('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Quantity"><input type="number" min="0" step="0.01" value="${Number(i.rate)}" onchange="window.__tcRenovationEditRate('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Rate"><button type="button" onclick="window.__tcRenovationRemove('${esc(i.id)}')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div>`;
      let h=`<div class="mb-5 rounded-xl border bg-gray-50 p-4 text-sm"><strong>Contractor editing mode:</strong> edit description, quantity or rate for any item, or remove an item. Changes update the estimate immediately.</div>`;
      if(Number(d.projectPreliminaries)>0 && !s.excluded.has('project-preliminaries')) h+=`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold">PROJECT / PRELIMINARIES</div><div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4"><div><p class="font-medium">${esc(s.descriptions.get('project-preliminaries') || 'Renovation permit application and related professional drawings / submission requirements')}</p><p class="text-xs text-gray-500 mt-1">1 ls × ${money(d.projectPreliminaries)}</p><div class="grid md:grid-cols-[1fr_120px_120px_auto] gap-2 mt-2 no-print"><input value="${esc(s.descriptions.get('project-preliminaries') || 'Renovation permit application and related professional drawings / submission requirements')}" onchange="window.__tcRenovationEditDescription('project-preliminaries',this.value)" class="border rounded-lg px-3 py-2" aria-label="Description"><input type="number" value="1" disabled class="border rounded-lg px-3 py-2 text-right"><input type="number" min="0" step="0.01" value="${Number(d.projectPreliminaries)}" onchange="window.__tcRenovationEditRate('project-preliminaries',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Rate"><button type="button" onclick="window.__tcRenovationRemove('project-preliminaries')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div></div><p class="font-semibold">${money(d.projectPreliminaries)}</p></div></div>`;
      d.roomGroups.forEach(r=>{
        if(!(Number(r.area)>0)) return;
        const arr=by[r.roomId]||[];
        h+=`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold">${esc(r.label)} <span class="font-normal text-gray-500">(${qty(r.area)} sqft)</span></div>`;
        if(!arr.length) h+=`<p class="text-sm text-gray-500 py-4">All items removed from this area.</p>`;
        arr.forEach(i=>{h+=`<div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4 items-start"><div><p class="font-medium">${esc(i.description)}</p><p class="text-xs text-gray-500 mt-1">${qty(i.qty)} ${esc(i.unit)} × ${money(i.rate)}</p>${edit(i)}</div><p class="font-semibold whitespace-nowrap">${money(i.amount)}</p></div></div>`});
        h+=`<div class="text-right font-bold py-3">${esc(r.label)} Subtotal: ${money(d.roomSubtotals[r.roomId]||0)}</div></div>`;
      });
      if(s.excluded.size) h+=`<div class="no-print mt-4 p-4 border rounded-xl bg-gray-50"><p class="font-semibold">${s.excluded.size} item(s) removed</p><button type="button" onclick="window.__tcRenovationRestore()" class="mt-3 border px-4 py-2 rounded-lg">Restore All Items</button></div>`;
      c.innerHTML=h;
    }

    window.__tcRenovationEditDescription=(id,v)=>{ contractorState().descriptions.set(id,v); window.updateEstimate(); };
    window.__tcRenovationEditRate=(id,v)=>{ const n=parseFloat(v); if(Number.isFinite(n)&&n>=0) contractorState().rates.set(id,n); window.updateEstimate(); };
    window.__tcRenovationRemove=id=>{ contractorState().excluded.add(id); window.updateEstimate(); };
    window.__tcRenovationRestore=()=>{ contractorState().excluded.clear(); window.updateEstimate(); };

    const originalUpdate=window.updateEstimate;
    window.updateEstimate=function(){ originalUpdate.apply(this,arguments); render(); };
    window.updateEstimate();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
