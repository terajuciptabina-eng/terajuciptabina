(() => {
  const install = () => {
    if (document.getElementById('tcBuildPlannerQuotationFix')) return;

    const style = document.createElement('style');
    style.id = 'tcBuildPlannerQuotationFix';
    style.textContent = `
      #quotationContent .simple-quotation-table,
      #quotationContent .detailed-quotation-table {
        width:100%!important;
        table-layout:fixed!important;
        border-collapse:collapse!important;
        direction:ltr!important;
      }
      #quotationContent .simple-quotation-table col:nth-child(1){width:6%!important}
      #quotationContent .simple-quotation-table col:nth-child(2){width:18%!important}
      #quotationContent .simple-quotation-table col:nth-child(3){width:56%!important}
      #quotationContent .simple-quotation-table col:nth-child(4){width:20%!important}
      #quotationContent .simple-quotation-table th,
      #quotationContent .simple-quotation-table td{direction:ltr!important;text-align:left!important;vertical-align:top!important;overflow-wrap:break-word!important;word-break:normal!important}
      #quotationContent .simple-quotation-table th:nth-child(4),
      #quotationContent .simple-quotation-table td:nth-child(4){text-align:right!important;white-space:nowrap!important}

      #quotationContent .detailed-quotation-table col:nth-child(1){width:5%!important}
      #quotationContent .detailed-quotation-table col:nth-child(2){width:55%!important}
      #quotationContent .detailed-quotation-table col:nth-child(3){width:10%!important}
      #quotationContent .detailed-quotation-table col:nth-child(4){width:15%!important}
      #quotationContent .detailed-quotation-table col:nth-child(5){width:15%!important}
      #quotationContent .detailed-quotation-table th,
      #quotationContent .detailed-quotation-table td{direction:ltr!important;vertical-align:top!important;overflow-wrap:break-word!important;word-break:normal!important}
      #quotationContent .detailed-quotation-table th:nth-child(1),
      #quotationContent .detailed-quotation-table td:nth-child(1),
      #quotationContent .detailed-quotation-table th:nth-child(2),
      #quotationContent .detailed-quotation-table td:nth-child(2){text-align:left!important}
      #quotationContent .detailed-quotation-table th:nth-child(3),
      #quotationContent .detailed-quotation-table td:nth-child(3),
      #quotationContent .detailed-quotation-table th:nth-child(4),
      #quotationContent .detailed-quotation-table td:nth-child(4),
      #quotationContent .detailed-quotation-table th:nth-child(5),
      #quotationContent .detailed-quotation-table td:nth-child(5){text-align:right!important}

      #quotationContent .tc-q-section td{
        background:#f3f4f6!important;
        font-weight:700!important;
        text-transform:uppercase!important;
        letter-spacing:.03em!important;
        border-top:2px solid #9ca3af!important;
        border-bottom:1px solid #d1d5db!important;
        text-align:left!important;
        direction:ltr!important;
        padding-top:10px!important;
        padding-bottom:10px!important;
      }
      #quotationContent .tc-q-room td{
        background:#fafafa!important;
        font-weight:700!important;
        color:#374151!important;
        text-align:left!important;
        direction:ltr!important;
        border-top:1px solid #d1d5db!important;
        border-bottom:1px solid #e5e7eb!important;
        padding-top:9px!important;
        padding-bottom:9px!important;
      }
      #quotationContent .tc-q-subtotal td{
        background:#fff!important;
        font-weight:700!important;
        direction:ltr!important;
        border-bottom:1px solid #d1d5db!important;
      }
    `;
    document.head.appendChild(style);

    const esc = v => typeof window.escapeHtml === 'function'
      ? window.escapeHtml(v)
      : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');

    const money = v => typeof window.money === 'function'
      ? window.money(v,2)
      : new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);

    const qty = (v,u) => typeof window.formatQty === 'function'
      ? window.formatQty(v,u)
      : Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:2});

    const sectionRow = (text, span) =>
      `<tr class="tc-q-section"><td colspan="${span}" class="py-3 px-2">${esc(text)}</td></tr>`;

    const roomRow = (room, span) =>
      `<tr class="tc-q-room"><td colspan="${span}" class="py-3 px-2">${esc(room?.label || 'Area / Room')} <span class="font-normal text-gray-500">(${qty(Number(room?.area)||0)} sqft)</span></td></tr>`;

    function generateBuildQuotation(){
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
      const roomsArea = rooms.reduce((s,r) => s + (Number(r.area)||0), 0);
      const storeys = document.getElementById('numStoreys')?.value || '1';
      const today = new Intl.DateTimeFormat('en-MY',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
      const content = document.getElementById('quotationContent');
      if (!content) return;

      let body = `<div class="flex justify-between items-start gap-6 border-b pb-5 mb-6">
        <div class="min-w-0">
          <div class="flex items-center gap-4 mb-4">
            <img src="../images/logo.png" alt="Teraju Ciptabina Logo" class="h-14 w-auto flex-shrink-0">
            <div class="min-w-0">
              <h1 class="text-xl font-bold">TERAJU CIPTABINA RESOURCES</h1>
              <p class="text-xs text-gray-500">No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor</p>
            </div>
          </div>
          <h2 class="text-2xl font-bold uppercase">Quotation</h2>
        </div>
        <div class="text-right text-sm flex-shrink-0">
          <p><span class="text-gray-500">Quotation No.</span><br><strong>${esc(quotationNumber)}</strong></p>
          <p class="mt-2"><span class="text-gray-500">Date</span><br><strong>${today}</strong></p>
        </div>
      </div>
      <div class="grid md:grid-cols-3 gap-6 mb-7 text-sm">
        <div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Customer</p><p class="font-semibold">${esc(customer)}</p></div>
        <div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Project Location</p><p class="font-semibold">${esc(location)}</p></div>
        <div><p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Built-up Area</p><p class="font-semibold">${qty(declared)} sqft · ${storeys} storey<br>${qty(roomsArea)} sqft rooms</p></div>
      </div>
      <div class="mb-5"><p class="text-sm text-gray-600">Construction works as described below. Final quotation is subject to site inspection, approved drawings, actual site conditions, specifications, material selection and confirmation of final scope of works.</p></div>`;

      if (type === 'simple') {
        body += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm simple-quotation-table"><colgroup><col><col><col><col></colgroup><thead><tr class="border-b-2"><th class="py-3 px-2">No.</th><th class="py-3 px-2">Area / Room</th><th class="py-3 px-2">Description of Works</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>`;
        let no = 1;

        if (data.prelim.length) {
          const total = data.prelim.reduce((a,i) => a + i.amount, 0);
          body += sectionRow('A. PRELIMINARIES',4);
          body += `<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">Project</td><td class="py-3 px-2">${data.prelim.map(i => esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(total)}</td></tr>`;
        }

        if (data.structures.length) {
          const total = data.structures.reduce((a,i) => a + i.amount, 0);
          body += sectionRow('B. STRUCTURAL WORKS',4);
          body += `<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">Structural Works</td><td class="py-3 px-2">${data.structures.map(i => esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(total)}</td></tr>`;
        }

        const archRooms = data.rooms.filter(r => r.area > 0 && (data.archByRoom[r.roomId]||[]).length);
        if (archRooms.length) {
          body += sectionRow('C. ARCHITECTURAL WORKS',4);
          archRooms.forEach(r => {
            const a = data.archByRoom[r.roomId] || [];
            body += `<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">${esc(r.label)}<br><span class="font-normal text-gray-500">${qty(r.area)} sqft</span></td><td class="py-3 px-2 leading-6">${a.map(i => esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(data.roomSubtotals[r.roomId]||0)}</td></tr>`;
          });
        }

        if (data.electrical.length) {
          const total = data.electrical.reduce((a,i) => a + i.amount, 0);
          body += sectionRow('D. ELECTRICAL WORKS',4);
          body += `<tr class="border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">Electrical Works</td><td class="py-3 px-2">${data.electrical.map(i => esc(i.description)).join('<br>')}</td><td class="py-3 px-2 text-right font-semibold">${money(total)}</td></tr>`;
        }

        body += `</tbody><tfoot><tr class="border-t-2"><td colspan="3" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${money(data.total)}</td></tr></tfoot></table></div>`;
      } else {
        body += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col><col><col><col><col></colgroup><thead><tr class="border-b-2"><th class="py-3 px-2">No.</th><th class="py-3 px-2">Description</th><th class="py-3 px-2 text-right">Quantity</th><th class="py-3 px-2 text-right">Rate (RM)</th><th class="py-3 px-2 text-right">Amount (RM)</th></tr></thead><tbody>`;

        let detailNo = 1;
        const rows = arr => (arr || []).map(i => `<tr class="border-b align-top"><td class="py-3 px-2">${detailNo++}</td><td class="py-3 px-2 text-left">${esc(i.description)}</td><td class="py-3 px-2 text-right">${qty(i.qty,i.unit)}</td><td class="py-3 px-2 text-right">${money(i.rate)}</td><td class="py-3 px-2 text-right font-medium">${money(i.amount)}</td></tr>`).join('');

        if (data.prelim.length) { body += sectionRow('A. PRELIMINARIES',5) + rows(data.prelim); }
        if (data.structures.length) { body += sectionRow('B. STRUCTURAL WORKS',5) + rows(data.structures); }

        const archRooms = data.rooms.filter(r => r.area > 0 && (data.archByRoom[r.roomId]||[]).length);
        if (archRooms.length) {
          body += sectionRow('C. ARCHITECTURAL WORKS',5);
          archRooms.forEach(r => {
            body += roomRow(r,5) + rows(data.archByRoom[r.roomId]);
            body += `<tr class="tc-q-subtotal"><td colspan="4" class="py-3 px-2 text-right">${esc(r.label)} Subtotal</td><td class="py-3 px-2 text-right">${money(data.roomSubtotals[r.roomId]||0)}</td></tr>`;
          });
        }

        if (data.electrical.length) { body += sectionRow('D. ELECTRICAL WORKS',5) + rows(data.electrical); }
        body += `</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${money(data.total)}</td></tr></tfoot></table></div>`;
      }

      body += `<div class="mt-8 pt-5 border-t text-sm"><p class="font-semibold mb-2">Terms / Notes</p><ul class="list-disc pl-5 space-y-1 text-gray-600"><li>This quotation is based on the stated built-up area, room schedule and rates applied herein.</li><li>Final scope, specifications, site conditions and pricing remain subject to site inspection and written confirmation.</li><li>Any additional works or authority requirements not listed above shall be quoted separately.</li></ul></div><div class="mt-12 text-sm"><p>Yours sincerely,</p><p class="font-bold mt-8">TERAJU CIPTABINA RESOURCES</p></div>`;

      content.innerHTML = body;
      document.getElementById('quotationDocument')?.classList.remove('hidden');
      document.getElementById('quotationPrintActions')?.classList.remove('hidden');
      document.getElementById('quotationDocument')?.scrollIntoView({behavior:'smooth',block:'start'});
    }

    window.generateQuotation = generateBuildQuotation;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();