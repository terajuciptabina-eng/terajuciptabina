(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcRenovationContractorEditorInstalled) return;
    if (typeof window.getData !== 'function' || typeof window.updateEstimate !== 'function') return;
    window.__tcRenovationContractorEditorInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const qty = v => typeof window.formatQty === 'function' ? window.formatQty(v) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});

    function render() {
      const c=document.getElementById('estimateContent');
      if(!c) return;
      const d=window.getData();
      const removed=window.excludedItems || new Set();
      const by={};
      (d.allItems||[]).forEach(i => (by[i.roomId] ||= []).push(i));
      const edit=i => `<div class="grid md:grid-cols-[minmax(0,1fr)_110px_120px_auto] gap-2 mt-2 no-print"><input value="${esc(i.description)}" onchange="editItemDescription('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2" aria-label="Description"><input type="number" min="0" step="0.01" value="${Number(i.qty)}" onchange="editItemQuantity('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Quantity"><input type="number" min="0" step="0.01" value="${Number(i.rate)}" onchange="editItemRate('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Rate"><button type="button" onclick="excludeItem('${esc(i.id)}')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div>`;
      let h=`<div class="mb-5 rounded-xl border bg-gray-50 p-4 text-sm"><strong>Contractor editing mode:</strong> edit description, quantity or rate for any item, or remove an item. Changes update the estimate immediately.</div>`;
      if(d.projectPreliminaries) h+=`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold">PROJECT / PRELIMINARIES</div><div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4"><div><p class="font-medium">Renovation permit application and related professional drawings / submission requirements</p><p class="text-xs text-gray-500 mt-1">1 ls × ${money(d.projectPreliminaries)}</p><div class="grid md:grid-cols-[1fr_120px_120px_auto] gap-2 mt-2 no-print"><input value="Renovation permit application and related professional drawings / submission requirements" onchange="editItemDescription('project-preliminaries',this.value)" class="border rounded-lg px-3 py-2"><input type="number" min="0" step="0.01" value="1" disabled class="border rounded-lg px-3 py-2 text-right"><input type="number" min="0" step="0.01" value="${Number(d.projectPreliminaries)}" onchange="editItemRate('project-preliminaries',this.value)" class="border rounded-lg px-3 py-2 text-right"><button type="button" onclick="excludeItem('project-preliminaries')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div></div><p class="font-semibold">${money(d.projectPreliminaries)}</p></div></div>`;
      d.roomGroups.forEach(r=>{
        if(!(Number(r.area)>0)) return;
        const arr=by[r.roomId]||[];
        h+=`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold">${esc(r.label)} <span class="font-normal text-gray-500">(${qty(r.area)} sqft)</span></div>`;
        if(!arr.length) h+=`<p class="text-sm text-gray-500 py-4">All items removed from this area.</p>`;
        arr.forEach(i=>{h+=`<div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4 items-start"><div><p class="font-medium">${esc(i.description)}</p><p class="text-xs text-gray-500 mt-1">${qty(i.qty)} ${esc(i.unit)} × ${money(i.rate)}</p>${edit(i)}</div><p class="font-semibold whitespace-nowrap">${money(i.amount)}</p></div></div>`});
        h+=`<div class="text-right font-bold py-3">${esc(r.label)} Subtotal: ${money(d.roomSubtotals[r.roomId]||0)}</div></div>`;
      });
      if(removed.size) h+=`<div class="no-print mt-4 p-4 border rounded-xl bg-gray-50"><p class="font-semibold">${removed.size} item(s) removed</p><button type="button" onclick="restoreAllItems()" class="mt-3 border px-4 py-2 rounded-lg">Restore All Items</button></div>`;
      c.innerHTML=h;
    }

    const originalUpdate=window.updateEstimate;
    window.updateEstimate=function(){ originalUpdate.apply(this,arguments); render(); };
    window.updateEstimate();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
