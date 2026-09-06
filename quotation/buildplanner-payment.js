(() => {
  const PROMO_END = '31 October 2026';
  const PAYMENT_API_BASE = 'https://terajuciptabina.vercel.app';
  const CREATE_PAYMENT_URL = `${PAYMENT_API_BASE}/api/create-payment`;
  const VERIFY_PAYMENT_URL = `${PAYMENT_API_BASE}/api/verify-payment`;
  const DETAILED_PRICE = 49;

  function saveState(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function loadState(key) {
    try { const v = sessionStorage.getItem(key); if (v) return JSON.parse(v); } catch (_) {}
    try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch (_) {}
    return null;
  }
  function removeState(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function setPromoModal() {
    const modal = document.getElementById('paymentModal');
    if (!modal) return;
    const price = modal.querySelector('.rounded-2xl.bg-gray-50.border.p-5.mb-5 .text-2xl');
    if (price) price.innerHTML = `<span class="line-through text-gray-400 text-base mr-2">RM ${DETAILED_PRICE}</span><span class="text-green-700">FREE</span>`;
    const note = modal.querySelector('.p-6 > p.mt-5');
    if (note) note.textContent = `Limited-time promotion: Detailed Quotation normally RM${DETAILED_PRICE}, now FREE until ${PROMO_END}.`;
    const button = document.getElementById('paymentProceedButton');
    if (button) button.textContent = 'Unlock Free — Promo';
    const heading = modal.querySelector('h3');
    if (heading) heading.textContent = 'Unlock Detailed Quotation';
  }

  window.closePaymentModal = function() {
    const m = document.getElementById('paymentModal');
    if (m) { m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }
  };
  function openPaymentModal() {
    setPromoModal();
    const m = document.getElementById('paymentModal');
    if (!m) return;
    const customer = document.getElementById('customerName')?.value || '';
    const pn = document.getElementById('paymentName');
    if (pn && !pn.value && customer) pn.value = customer;
    const err = document.getElementById('paymentError');
    if (err) { err.textContent=''; err.classList.remove('show'); }
    m.classList.add('show'); m.setAttribute('aria-hidden','false');
  }

  function showPaymentError(message) {
    const e = document.getElementById('paymentError');
    if (e) { e.textContent = message; e.classList.add('show'); }
  }

  function currentData() {
    return typeof getCurrentQuotationData === 'function' ? getCurrentQuotationData() : null;
  }

  function buildDetailedHtml(data) {
    const customer = document.getElementById('customerName')?.value || 'Not specified';
    const location = document.getElementById('projectLocation')?.value || 'Not specified';
    const declared = parseFloat(document.getElementById('builtUpArea')?.value) || 0;
    const roomsArea = data.rooms.reduce((s,r)=>s+(r.area||0),0);
    const storeys = document.getElementById('numStoreys')?.value || '1';
    const today = new Intl.DateTimeFormat('en-MY',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
    const rows = arr => arr.map(i => `<tr class="border-b"><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.unit)}</td><td>${formatQty(i.qty,i.unit)}</td><td>${money(i.rate,2)}</td><td>${money(i.amount,2)}</td></tr>`).join('');
    let body = `<div class="flex justify-between items-start gap-6 border-b pb-5 mb-6"><div><div class="flex items-center gap-4 mb-4"><img src="../images/logo.png" class="h-14 w-auto"><div><h1 class="text-xl font-bold">TERAJU CIPTABINA RESOURCES</h1><p class="text-xs text-gray-500">No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor</p></div></div><h2 class="text-2xl font-bold uppercase">Detailed Quotation</h2></div><div class="text-right text-sm"><p>Quotation No.<br><strong>${escapeHtml(quotationNumber)}</strong></p><p class="mt-2">Date<br><strong>${today}</strong></p></div></div>`;
    body += `<div class="grid md:grid-cols-3 gap-6 mb-7 text-sm"><div><p class="text-xs text-gray-500">Customer</p><p class="font-semibold">${escapeHtml(customer)}</p></div><div><p class="text-xs text-gray-500">Project Location</p><p class="font-semibold">${escapeHtml(location)}</p></div><div><p class="text-xs text-gray-500">Built-up Area</p><p class="font-semibold">${formatQty(declared)} sqft · ${storeys} storey<br>${formatQty(roomsArea)} sqft rooms</p></div></div>`;
    body += `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col><col><col><col><col></colgroup><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th></tr></thead><tbody>`;
    body += rows(data.prelim);
    body += rows(data.structures);
    data.rooms.forEach(r => { body += rows(data.archByRoom[r.roomId] || []); });
    body += rows(data.electrical);
    body += `</tbody><tfoot><tr><td colspan="4" class="text-right font-bold">TOTAL</td><td class="font-bold">${money(data.total,2)}</td></tr></tfoot></table></div>`;
    body += `<div class="mt-8 pt-5 border-t text-sm"><p class="font-semibold mb-2">Terms / Notes</p><ul class="list-disc pl-5 text-gray-600"><li>This quotation is based on the stated built-up area, room schedule and rates applied herein.</li><li>Final scope, specifications, soil conditions and pricing remain subject to site inspection and written confirmation.</li><li>Any additional works or authority requirements not listed above shall be quoted separately.</li></ul></div><div class="mt-12 text-sm"><p>Yours sincerely,</p><p class="font-bold mt-8">TERAJU CIPTABINA RESOURCES</p></div>`;
    return body;
  }

  window.requestDetailedQuotation = function() {
    const data = currentData();
    if (!data || !data.rooms.some(r=>r.area>0)) {
      alert('Please add at least one room with a valid area first.');
      return;
    }
    quotationNumber = generateQuotationNumber();
    const html = buildDetailedHtml(data);
    saveState('terajuPendingDetailedQuotation', {
      quotationNumber,
      html,
      createdAt: Date.now(),
      projectType: 'new house',
      customer: document.getElementById('customerName')?.value || 'Not specified',
      location: document.getElementById('projectLocation')?.value || 'Not specified'
    });
    const content = document.getElementById('quotationContent');
    content.innerHTML = `<div class="detail-preview"><div class="detail-preview-locked">${html}</div><div class="detail-preview-fade"></div><div class="detail-lock-card p-6 mt-4 text-center"><div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white mb-3">🔒</div><p class="font-bold text-lg">Detailed Quotation Preview</p><p class="text-sm text-gray-500 mt-1">Full quantities, rates and costing are prepared but locked.</p><p class="mt-3 text-sm"><span class="line-through text-gray-400">RM ${DETAILED_PRICE}</span> <strong class="text-green-700">FREE PROMO</strong> until ${PROMO_END}</p><button type="button" onclick="unlockDetailedQuotation()" class="mt-5 bg-black text-white px-6 py-3 rounded-lg font-semibold">Unlock Detailed Quotation — FREE</button></div></div>`;
    document.getElementById('quotationPrintActions').classList.add('hidden');
    document.getElementById('quotationDocument').classList.remove('hidden');
    document.getElementById('quotationDocument').scrollIntoView({behavior:'smooth',block:'start'});
  };

  window.unlockDetailedQuotation = function() {
    const pending = loadState('terajuPendingDetailedQuotation');
    if (!pending?.html) { alert('Please preview the detailed quotation first.'); return; }
    openPaymentModal();
  };

  window.startDetailedQuotationPayment = async function() {
    const name = document.getElementById('paymentName')?.value.trim();
    const email = document.getElementById('paymentEmail')?.value.trim();
    const phone = document.getElementById('paymentPhone')?.value.trim();
    if (!name || !email || !phone) { showPaymentError('Please enter your name, email and phone number to claim the free detailed quotation.'); return; }
    const pending = loadState('terajuPendingDetailedQuotation');
    if (!pending?.html) { showPaymentError('Your quotation preview is no longer available. Please preview the detailed quotation again.'); return; }
    const btn = document.getElementById('paymentProceedButton');
    if (btn) { btn.disabled=true; btn.textContent='Unlocking…'; }
    try {
      const clientOrderId = `NB-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      saveState('terajuPendingPayment', {clientOrderId, quotationNumber:pending.quotationNumber});
      const response = await fetch(CREATE_PAYMENT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:DETAILED_PRICE,product:'Detailed Quotation',customer:{name,email,phone},project:{projectType:'new house',quotationNumber:pending.quotationNumber,location:pending.location}})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok || !result.success || !result.paymentUrl) throw new Error(result.message || 'Unable to start the promotion.');
      window.location.href = result.paymentUrl;
    } catch (error) {
      showPaymentError(error.message || 'Unable to unlock the quotation. Please try again.');
      if (btn) { btn.disabled=false; btn.textContent='Unlock Free — Promo'; }
    }
  };

  async function verifyPromoReturn() {
    const p = new URLSearchParams(location.search);
    const status = p.get('status_id'), billcode = p.get('billcode'), orderId = p.get('order_id');
    if (!status || !billcode || !orderId) return false;
    if (status !== '1') { alert('The promotion could not be completed. Please preview the detailed quotation again.'); return false; }
    try {
      const response = await fetch(VERIFY_PAYMENT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({billCode:billcode,orderId})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok || !result.paid) throw new Error(result.message || 'Verification failed.');
      saveState('terajuDetailedQuotationPaid',{paid:true,billCode:billcode,orderId,verifiedAt:Date.now(),promo:true});
      return true;
    } catch (error) {
      console.error(error); alert('We could not verify the promotion. Please try again.'); return false;
    }
  }

  function unlockSavedQuotation() {
    const paid = loadState('terajuDetailedQuotationPaid');
    const pending = loadState('terajuPendingDetailedQuotation');
    if (!paid?.paid || !pending?.html) return false;
    quotationNumber = pending.quotationNumber;
    document.getElementById('quotationContent').innerHTML = `<div class="detail-unlocked-badge mb-4">✓ Detailed Quotation Unlocked — Promo</div>${pending.html}`;
    document.getElementById('quotationDocument').classList.remove('hidden');
    document.getElementById('quotationPrintActions').classList.remove('hidden');
    removeState('terajuPendingDetailedQuotation');
    return true;
  }

  async function init() {
    setPromoModal();
    const hadReturn = await verifyPromoReturn();
    if (hadReturn) {
      history.replaceState({}, document.title, location.pathname);
      unlockSavedQuotation();
    }
  }

  init();
})();