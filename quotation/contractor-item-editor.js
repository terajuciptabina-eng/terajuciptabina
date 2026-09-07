(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcContractorItemEditorInstalled) return;
    if (typeof window.getAllItems !== 'function' || typeof window.updateEstimate !== 'function') return;
    window.__tcContractorItemEditorInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const qty = (v,u) => typeof window.formatQty === 'function' ? window.formatQty(v,u) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});
    const excluded = window.__tcExcludedItems || new Set();
    window.__tcExcludedItems = excluded;

    function contractorRenderEstimate() {
      const c=document.getElementById('estimateContent');
      if(!c) return;
      const all=window.getAllItems();
      const active=all.filter(i => !excluded.has(i.id));
      const byCategory={preliminaries:[],structures:[],architecture:[],electrical:[]};
      active.forEach(i => (byCategory[i.category] ||= []).push(i));
      const edit=(i) => `<div class="grid md:grid-cols-[minmax(0,1fr)_110px_120px_auto] gap-2 mt-2 no-print"><input value="${esc(i.description)}" onchange="editItemDescription('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2" aria-label="Description"><input type="number" min="0" step="0.01" value="${Number(i.qty)}" onchange="editItemQuantity('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Quantity"><input type="number" min="0" step="0.01" value="${Number(i.rate)}" onchange="editItemRate('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Rate"><button type="button" onclick="excludeItem('${esc(i.id)}')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div>`;
      const row=i=>`<div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4 items-start"><div><p class="font-medium">${esc(i.description)}</p><p class="text-xs text-gray-500 mt-1">${qty(i.qty,i.unit)} ${esc(i.unit)} × ${money(i.rate)}</p>${edit(i)}</div><p class="font-semibold whitespace-nowrap">${money(i.amount)}</p></div></div>`;
      const section=(title,arr)=>arr.length?`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold uppercase">${esc(title)}</div>${arr.map(row).join('')}</div>`:'';
      c.innerHTML=`<div class="mb-5 rounded-xl border bg-gray-50 p-4 text-sm"><strong>Contractor editing mode:</strong> Edit description, quantity or rate for any item, or remove an item. Changes update the estimate and quotation immediately.</div>${section('A. Preliminaries',byCategory.preliminaries)}${section('B. Structural Works',byCategory.structures)}${section('C. Architectural Works',byCategory.architecture)}${section('D. Electrical Works',byCategory.electrical)}${excluded.size?`<div class="no-print mt-4 p-4 border rounded-xl bg-gray-50"><p class="font-semibold">${excluded.size} item(s) removed</p><button type="button" onclick="restoreAllItems()" class="mt-3 border px-4 py-2 rounded-lg">Restore All Items</button></div>`:''}`;
    }

    const originalUpdate = window.updateEstimate;
    window.updateEstimate = function(){
      originalUpdate.apply(this, arguments);
      contractorRenderEstimate();
    };

    const originalExclude=window.excludeItem;
    if(typeof originalExclude==='function') window.excludeItem=function(id){
      excluded.add(id);
      originalExclude.call(this,id);
      contractorRenderEstimate();
    };
    const originalRestore=window.restoreAllItems;
    if(typeof originalRestore==='function') window.restoreAllItems=function(){
      excluded.clear();
      originalRestore.call(this);
      contractorRenderEstimate();
    };

    contractorRenderEstimate();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
