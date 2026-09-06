(() => {
  function loadFinalRenderer() {
    if (!document.getElementById('tcBuildPlannerQuotationRenderer')) {
      const s = document.createElement('script');
      s.id = 'tcBuildPlannerQuotationRenderer';
      s.src = 'buildplanner-alignment-fix.js?v=20260907-final';
      document.head.appendChild(s);
    }
  }
  function money2(v) { return typeof window.money === 'function' ? window.money(v, 2) : `RM ${(Number(v)||0).toFixed(2)}`; }
  function esc(v) { return typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
  function qty(v,u) { return typeof window.formatQty === 'function' ? window.formatQty(v,u) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2}); }
  function save(key,value){try{sessionStorage.setItem(key,JSON.stringify(value))}catch(e){}try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}

  const STRUCTURE_HEADINGS = ['GROUND BEAM','GROUND FLOOR','COLUMN','ROOF BEAM','ROOF SLAB','STAIRCASE'];

  function subheading(item) {
    const raw = [item?.subheading,item?.subcategory,item?.subCategory,item?.category,item?.group,item?.structure,item?.element,item?.structureType,item?.workCategory,item?.areaType,item?.location,item?.name,item?.title].filter(Boolean).join(' ');
    const text = `${raw} ${item?.description || ''}`.toLowerCase();
    if (/ground\s*beam|ground\s*girder|tie\s*beam/.test(text)) return 'GROUND BEAM';
    if (/ground\s*floor|ground\s*slab|floor\s*slab/.test(text)) return 'GROUND FLOOR';
    if (/column|columns/.test(text)) return 'COLUMN';
    if (/roof\s*beam|ring\s*beam/.test(text)) return 'ROOF BEAM';
    if (/roof\s*slab/.test(text)) return 'ROOF SLAB';
    if (/staircase|stair\s*case|stairs|stair/.test(text)) return 'STAIRCASE';
    return '';
  }

  function groupStructures(items) {
    const groups = STRUCTURE_HEADINGS.map(name => ({name,items:[]}));
    const unknown = [];
    (items || []).forEach(item => {
      const label = subheading(item);
      if (label) groups[STRUCTURE_HEADINGS.indexOf(label)].items.push(item);
      else unknown.push(item);
    });

    // The current Build Planner structural rate list is flat, so when no
    // element label is carried by an item, keep the original schedule order
    // and split it into the six construction-element groups.
    if (unknown.length && groups.every(g => !g.items.length)) {
      const chunk = Math.ceil(unknown.length / STRUCTURE_HEADINGS.length);
      STRUCTURE_HEADINGS.forEach((name,i) => {
        groups[i].items = unknown.slice(i * chunk, Math.min((i + 1) * chunk, unknown.length));
      });
    } else if (unknown.length) {
      // Do not lose unlabelled rows when some labelled groups exist.
      // Attach them to the nearest preceding structural group in schedule order.
      const target = groups.find(g => g.items.length) || groups[0];
      target.items.push(...unknown);
    }
    return groups.filter(g => g.items.length);
  }

  function installDetailedOverride() {
    if (typeof window.getCurrentQuotationData !== 'function') return;
    if (window.__tcDetailedOverrideInstalled) return;
    window.__tcDetailedOverrideInstalled = true;

    window.requestDetailedQuotation = function() {
      const data = window.getCurrentQuotationData();
      const rooms = data?.rooms || [];
      if (!rooms.some(r => Number(r.area) > 0)) { alert('Please add at least one room with a valid area first.'); return; }
      window.quotationNumber = typeof window.generateQuotationNumber === 'function' ? window.generateQuotationNumber() : '';
      const customer = document.getElementById('customerName')?.value || 'Not specified';
      const location = document.getElementById('projectLocation')?.value || 'Not specified';
      const declared = parseFloat(document.getElementById('builtUpArea')?.value) || 0;
      const roomsArea = rooms.reduce((s,r)=>s+(Number(r.area)||0),0);
      const storeys = document.getElementById('numStoreys')?.value || '1';
      const today = new Intl.DateTimeFormat('en-MY',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());

      let html = `<div class="flex justify-between items-start gap-6 border-b pb-5 mb-6"><div class="min-w-0"><div class="flex items-center gap-4 mb-4"><img src="../images/logo.png" alt="Teraju Ciptabina Logo" class="h-14 w-auto flex-shrink-0"><div><h1 class="text-xl font-bold">TERAJU CIPTABINA RESOURCES</h1><p class="text-xs text-gray-500">No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor</p></div></div><h2 class="text-2xl font-bold uppercase">Quotation</h2></div><div class="text-right text-sm flex-shrink-0"><p><span class="text-gray-500">Quotation No.</span><br><strong>${esc(window.quotationNumber)}</strong></p><p class="mt-2"><span class="text-gray-500">Date</span><br><strong>${today}</strong></p></div></div>`;
      html += `<div class="grid md:grid-cols-3 gap-6 mb-7 text-sm"><div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Customer</p><p class="font-semibold">${esc(customer)}</p></div><div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Project Location</p><p class="font-semibold">${esc(location)}</p></div><div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Built-up Area</p><p class="font-semibold">${qty(declared)} sqft · ${storeys} storey<br>${qty(roomsArea)} sqft rooms</p></div></div>`;
      html += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col><col><col><col><col></colgroup><thead><tr class="border-b-2"><th class="py-3 px-2">No.</th><th class="py-3 px-2">Description</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>`;
      let no = 1;
      const section = t => `<tr class="tc-q-section"><td colspan="5" class="py-3 px-2">${esc(t)}</td></tr>`;
      const room = r => `<tr class="tc-q-room"><td colspan="5" class="py-3 px-2">${esc(r.label)} <span class="font-normal text-gray-500">(${qty(r.area)} sqft)</span></td></tr>`;
      const sub = t => `<tr class="tc-q-room quotation-subsection-row"><td colspan="5" class="py-2 px-2">${esc(t)}</td></tr>`;
      const rows = arr => (arr||[]).map(i=>`<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 text-left">${esc(i.description)}</td><td class="py-3 px-2 text-right">${qty(i.qty,i.unit)}</td><td class="py-3 px-2 text-right">${money2(i.rate)}</td><td class="py-3 px-2 text-right font-medium">${money2(i.amount)}</td></tr>`).join('');

      if (data.prelim.length) html += section('A. PRELIMINARIES') + rows(data.prelim);
      if (data.structures.length) {
        html += section('B. STRUCTURAL WORKS');
        groupStructures(data.structures).forEach(g => { html += sub(g.name) + rows(g.items); });
      }
      const archRooms = rooms.filter(r=>Number(r.area)>0 && (data.archByRoom[r.roomId]||[]).length);
      if (archRooms.length) {
        html += section('C. ARCHITECTURAL WORKS');
        archRooms.forEach(r=>{ html += room(r) + rows(data.archByRoom[r.roomId]||[]) + `<tr class="tc-q-subtotal"><td colspan="4" class="py-3 px-2 text-right">${esc(r.label)} Subtotal</td><td class="py-3 px-2 text-right">${money2(data.roomSubtotals[r.roomId]||0)}</td></tr>`; });
      }
      if (data.electrical.length) html += section('D. ELECTRICAL WORKS') + rows(data.electrical);
      html += `</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${money2(data.total)}</td></tr></tfoot></table></div>`;
      html += `<div class="mt-8 pt-5 border-t text-sm"><p class="font-semibold mb-2">Terms / Notes</p><ul class="list-disc pl-5 space-y-1 text-gray-600"><li>This quotation is based on the stated built-up area, room schedule and rates applied herein.</li><li>Final scope, specifications, site conditions and pricing remain subject to site inspection and written confirmation.</li><li>Any additional works or authority requirements not listed above shall be quoted separately.</li></ul></div><div class="mt-12 text-sm"><p>Yours sincerely,</p><p class="font-bold mt-8">TERAJU CIPTABINA RESOURCES</p></div>`;
      save('terajuPendingDetailedQuotation',{quotationNumber:window.quotationNumber,html,createdAt:Date.now(),projectType:'new house',customer,location});
      const content = document.getElementById('quotationContent');
      if (!content) return;
      content.innerHTML = `<div class="detail-preview"><div class="detail-preview-locked">${html}</div><div class="detail-preview-fade"></div><div class="detail-lock-card"><div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white mb-3">🔒</div><p class="font-bold text-lg">Detailed Quotation Preview</p><p class="text-sm text-gray-500 mt-1">Your full quotation is prepared. Pricing details are locked until you unlock it.</p><button type="button" onclick="unlockDetailedQuotation()" class="mt-5 bg-black text-white px-6 py-3 rounded-lg font-semibold">Unlock Detailed Quotation</button></div></div>`;
      document.getElementById('quotationPrintActions')?.classList.add('hidden');
      document.getElementById('quotationDocument')?.classList.remove('hidden');
      document.getElementById('quotationDocument')?.scrollIntoView({behavior:'smooth',block:'start'});
    };
  }
  loadFinalRenderer();
  setTimeout(installDetailedOverride, 0);
})();