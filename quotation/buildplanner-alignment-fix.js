(() => {
  if (document.getElementById('tcBuildPlannerQuotationFix')) return;
  const style = document.createElement('style');
  style.id = 'tcBuildPlannerQuotationFix';
  style.textContent = `
    #quotationContent .simple-quotation-table,#quotationContent .detailed-quotation-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
    #quotationContent .detailed-quotation-table col:nth-child(1){width:6%!important}
    #quotationContent .detailed-quotation-table col:nth-child(2){width:49%!important}
    #quotationContent .detailed-quotation-table col:nth-child(3){width:9%!important}
    #quotationContent .detailed-quotation-table col:nth-child(4){width:11%!important}
    #quotationContent .detailed-quotation-table col:nth-child(5){width:13%!important}
    #quotationContent .detailed-quotation-table col:nth-child(6){width:12%!important}
    #quotationContent .detailed-quotation-table th,#quotationContent .detailed-quotation-table td{vertical-align:top;overflow-wrap:break-word}
    #quotationContent .tc-q-section td{background:#f3f4f6!important;font-weight:700!important;border-top:2px solid #9ca3af!important;border-bottom:1px solid #d1d5db!important;padding-top:10px!important;padding-bottom:10px!important}
    #quotationContent .tc-q-room td{background:#fafafa!important;font-weight:700!important;color:#374151!important;border-top:1px solid #d1d5db!important;border-bottom:1px solid #e5e7eb!important;padding-top:9px!important;padding-bottom:9px!important}
    #quotationContent .tc-q-subtotal td{font-weight:700!important;border-bottom:1px solid #d1d5db!important}
    #quotationContent .tc-q-gap td{height:8px!important;padding:0!important;border:0!important;background:#fff!important}
  `;
  document.head.appendChild(style);

  const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  const money = v => typeof window.money === 'function' ? window.money(v,2) : new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
  const qty = (v,u) => typeof window.formatQty === 'function' ? window.formatQty(v,u) : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});

  const sectionRow = text => `<tr class="tc-q-section"><td colspan="6" class="py-3 px-2">${text}</td></tr>`;
  const gapRow = () => `<tr class="tc-q-gap"><td colspan="6"></td></tr>`;
  const roomRow = room => `<tr class="tc-q-room"><td colspan="6" class="py-3 px-2">${esc(room?.label || 'Area / Room')} <span class="font-normal text-gray-500">(${qty(Number(room?.area)||0)} sqft)</span></td></tr>`;

  function generateBuildQuotation() {
    const rooms = typeof getRoomGroups === 'function' ? getRoomGroups() : [];
    if (!rooms.some(r => Number(r.area) > 0)) {
      alert('Please add at least one room with a valid area before generating the quotation.');
      return;
    }
    const data = typeof getCurrentQuotationData === 'function' ? getCurrentQuotationData() : null;
    if (!data) return;

    quotationNumber = typeof generateQuotationNumber === 'function' ? generateQuotationNumber() : '';
    const type = typeof getSelectedQuotationType === 'function' ? getSelectedQuotationType() : 'simple';
    const customer = document.getElementById('customerName')?.value || 'Not specified';
    const location = document.getElementById('projectLocation')?.value || 'Not specified';
    const declared = parseFloat(document.getElementById('builtUpArea')?.value) || 0;
    const roomsArea = rooms.reduce((s,r)=>s+(Number(r.area)||0),0);
    const storeys = document.getElementById('numStoreys')?.value || '1';
    const today = new Intl.DateTimeFormat('en-MY',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
    const content = document.getElementById('quotationContent');
    if (!content) return;

    let body = `<div class="flex justify-between items-start gap-6 border-b pb-5 mb-6"><div><div class="flex items-center gap-4 mb-4"><img src="../images/logo.png" class="h-14 w-auto"><div><h1 class="text-xl font-bold">TERAJU CIPTABINA RESOURCES</h1><p class="text-xs text-gray-500">No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor</p></div></div><h2 class="text-2xl font-bold uppercase">Quotation</h2></div><div class="text-right text-sm"><p>Quotation No.<br><strong>${esc(quotationNumber)}</strong></p><p class="mt-2">Date<br><strong>${today}</strong></p></div></div><div class="grid md:grid-cols-3 gap-6 mb-7 text-sm"><div><p class="text-xs text-gray-500">Customer</p><p class="font-semibold">${esc(customer)}</p></div><div><p class="text-xs text-gray-500">Project Location</p><p class="font-semibold">${esc(location)}</p></div><div><p class="text-xs text-gray-500">Built-up Area</p><p class="font-semibold">${qty(declared)} sqft · ${storeys} storey<br>${qty(roomsArea)} sqft rooms</p></div></div>`;

    if (type === 'simple') {
      body += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm simple-quotation-table"><colgroup><col><col><col></colgroup><thead><tr class="border-b-2 text-left"><th class="py-3 px-2">No.</th><th class="py-3 px-2">Description of Works</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>`;
      let no=1;
      if(data.prelim.length){body+=sectionRow('A. Preliminaries');body+=`<tr class="border-b"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2">${data.prelim.map(i=>esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(data.prelim.reduce((a,i)=>a+i.amount,0))}</td></tr>`}
      if(data.structures.length){body+=sectionRow('B. Structural Works');body+=`<tr class="border-b"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2">${data.structures.map(i=>esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(data.structures.reduce((a,i)=>a+i.amount,0))}</td></tr>`}
      const ar=data.rooms.filter(r=>r.area>0&&(data.archByRoom[r.roomId]||[]).length);
      if(ar.length){body+=sectionRow('C. Architectural Works');ar.forEach(r=>{const a=data.archByRoom[r.roomId]||[];body+=roomRow(r);body+=`<tr class="border-b"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 leading-6">${a.map(i=>esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(data.roomSubtotals[r.roomId]||0)}</td></tr>`})}
      if(data.electrical.length){body+=sectionRow('D. Electrical Works');body+=`<tr class="border-b"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2">${data.electrical.map(i=>esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(data.electrical.reduce((a,i)=>a+i.amount,0))}</td></tr>`}
      body+=`</tbody><tfoot><tr class="border-t-2"><td colspan="2" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${money(data.total)}</td></tr></tfoot></table></div>`;
    } else {
      body += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col><col><col><col><col><col></colgroup><thead><tr class="border-b-2 text-left"><th class="py-3 px-2">No.</th><th class="py-3 px-2">Description</th><th class="py-3 px-2">Unit</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>`;
      let no=1;
      const rows=arr=>(arr||[]).map(i=>`<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 text-left">${esc(i.description)}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2 text-right">${qty(i.qty,i.unit)}</td><td class="py-3 px-2 text-right">${money(i.rate)}</td><td class="py-3 px-2 text-right font-medium">${money(i.amount)}</td></tr>`).join('');
      let first=true;
      if(data.prelim.length){body+=(first?'':gapRow())+sectionRow('A. PRELIMINARIES')+rows(data.prelim);first=false}
      if(data.structures.length){body+=(first?'':gapRow())+sectionRow('B. STRUCTURAL WORKS')+rows(data.structures);first=false}
      const ar=data.rooms.filter(r=>r.area>0&&(data.archByRoom[r.roomId]||[]).length);
      if(ar.length){body+=(first?'':gapRow())+sectionRow('C. ARCHITECTURAL WORKS');ar.forEach(r=>{body+=roomRow(r)+rows(data.archByRoom[r.roomId])+`<tr class="tc-q-subtotal"><td colspan="5" class="py-3 px-2 text-right">${esc(r.label)} Subtotal</td><td class="py-3 px-2 text-right">${money(data.roomSubtotals[r.roomId]||0)}</td></tr>`});first=false}
      if(data.electrical.length){body+=(first?'':gapRow())+sectionRow('D. ELECTRICAL WORKS')+rows(data.electrical);first=false}
      body+=`</tbody><tfoot><tr class="border-t-2"><td colspan="5" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${money(data.total)}</td></tr></tfoot></table></div>`;
    }

    body += `<div class="mt-8 pt-5 border-t text-sm"><p class="font-semibold mb-2">Terms / Notes</p><ul class="list-disc pl-5 space-y-1 text-gray-600"><li>This quotation is based on the stated built-up area, room schedule and rates applied herein.</li><li>Final scope, specifications, soil conditions and pricing remain subject to site inspection and written confirmation.</li><li>Any additional works or authority requirements not listed above shall be quoted separately.</li></ul></div><div class="mt-12 text-sm"><p>Yours sincerely,</p><p class="font-bold mt-8">TERAJU CIPTABINA RESOURCES</p></div>`;
    content.innerHTML=body;
    document.getElementById('quotationDocument')?.classList.remove('hidden');
    document.getElementById('quotationPrintActions')?.classList.remove('hidden');
    document.getElementById('quotationDocument')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.generateQuotation=generateBuildQuotation;
})();