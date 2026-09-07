(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcContractorItemEditorInstalled) return;
    if (typeof window.getAllItems !== 'function' || typeof window.updateEstimate !== 'function') return;
    window.__tcContractorItemEditorInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const qty = (v,u) => typeof window.formatQty === 'function' ? window.formatQty(v,u) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});

    function contractorRenderEstimate(items, rooms, total, roomsArea, declared) {
      const c=document.getElementById('estimateContent');
      if(!c) return;
      const all=window.getAllItems();
      const active=all.filter(i => !window.__tcExcludedItems?.has(i.id));
      const excluded=window.__tcExcludedItems || new Set();
      const customRates=window.__tcCustomRates || new Map();
      const customQuantities=window.__tcCustomQuantities || new Map();
      const customDescriptions=window.__tcCustomDescriptions || new Map();
      const byCategory={preliminaries:[],structures:[],architecture:[],electrical:[]};
      active.forEach(i => (byCategory[i.category] ||= []).push(i));
      const edit=(i) => `<div class="grid md:grid-cols-[minmax(0,1fr)_110px_120px_auto] gap-2 mt-2 no-print"><input value="${esc(i.description)}" onchange="editItemDescription('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2" aria-label="Description"><input type="number" min="0" step="0.01" value="${Number(i.qty)}" onchange="editItemQuantity('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Quantity"><input type="number" min="0" step="0.01" value="${Number(i.rate)}" onchange="editItemRate('${esc(i.id)}',this.value)" class="border rounded-lg px-3 py-2 text-right" aria-label="Rate"><button type="button" onclick="excludeItem('${esc(i.id)}')" class="border border-red-300 text-red-600 rounded-lg px-3 py-2">Remove</button></div>`;
      const row=i=>`<div class="border-b py-4"><div class="grid grid-cols-[1fr_auto] gap-4 items-start"><div><p class="font-medium">${esc(i.description)}</p><p class="text-xs text-gray-500 mt-1">${qty(i.qty,i.unit)} ${esc(i.unit)} × ${money(i.rate)}</p>${edit(i)}</div><p class="font-semibold whitespace-nowrap">${money(i.amount)}</p></div></div>`;
      const section=(title,arr)=>arr.length?`<div class="mb-6"><div class="bg-gray-100 border rounded-lg px-4 py-3 font-bold uppercase">${esc(title)}</div>${arr.map(row).join('')}</div>`:'';
      c.innerHTML=`<div class="mb-5 rounded-xl border bg-gray-50 p-4 text-sm"><strong>Contractor editing mode:</strong> edit description, quantity or rate for any item, or remove an item from the estimate. Changes update the total immediately.</div>${section('A. Preliminaries',byCategory.preliminaries)}${section('B. Structural Works',byCategory.structures)}${section('C. Architectural Works',byCategory.architecture)}${section('D. Electrical Works',byCategory.electrical)}${excluded.size?`<div class="no-print mt-4 p-4 border rounded-xl bg-gray-50"><p class="font-semibold">${excluded.size} item(s) removed</p><button type="button" onclick="restoreAllItems()" class="mt-3 border px-4 py-2 rounded-lg">Restore All Items</button></div>`:''}`;
    }

    window.__tcExcludedItems = window.__tcExcludedItems || window.excludedItems || new Set();
    window.__tcCustomRates = window.__tcCustomRates || window.customRates || new Map();
    window.__tcCustomQuantities = window.__tcCustomQuantities || window.customQuantities || new Map();
    window.__tcCustomDescriptions = window.__tcCustomDescriptions || window.customDescriptions || new Map();

    const originalUpdate = window.updateEstimate;
    window.updateEstimate = function(){
      originalUpdate.apply(this, arguments);
      if (typeof window.getAllItems !== 'function') return;
      const all=window.getAllItems();
      const excluded=window.excludedItems || window.__tcExcludedItems;
      const active=all.filter(i=>!excluded.has(i.id));
      const rooms=typeof window.getRoomGroups==='function'?window.getRoomGroups():[];
      const roomsArea=rooms.reduce((s,r)=>s+(Number(r.area)||0),0);
      const declared=parseFloat(document.getElementById('builtUpArea')?.value)||0;
      const total=active.reduce((s,i)=>s+(Number(i.amount)||0),0);
      contractorRenderEstimate(active,rooms,total,roomsArea,declared);
    };

    const originalExclude=window.excludeItem;
    window.excludeItem=function(id){
      originalExclude.call(this,id);
      window.__tcExcludedItems=window.excludedItems || window.__tcExcludedItems;
    };
    const originalRestore=window.restoreAllItems;
    window.restoreAllItems=function(){
      originalRestore.call(this);
      window.__tcExcludedItems=window.excludedItems || window.__tcExcludedItems;
    };

    window.updateEstimate();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
