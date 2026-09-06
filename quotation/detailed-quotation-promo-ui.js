(() => {
  const END = '31 October 2026';
  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  const price = modal.querySelector('.rounded-2xl.bg-gray-50.border.p-5.mb-5 .text-2xl');
  if (price) price.innerHTML = `<span class="line-through text-gray-400 text-base mr-2">RM 49</span><span class="text-green-700">FREE</span>`;
  const note = modal.querySelector('.p-6 > p.mt-5');
  if (note) note.textContent = `Limited-time promotion: Detailed Quotation normally RM49, now FREE until ${END}.`;
  const button = document.getElementById('paymentProceedButton');
  if (button) button.textContent = 'Unlock Free — Promo';
  const paymentTitle = modal.querySelector('p.text-xs.uppercase');
  if (paymentTitle) paymentTitle.textContent = 'Limited-Time Promotion';
  const preview = document.querySelector('#quotationContent');
  if (preview && preview.innerHTML && !preview.dataset.promoMarked) {
    preview.dataset.promoMarked = '1';
    preview.querySelectorAll('button').forEach(btn => {
      if (/unlock detailed quotation/i.test(btn.textContent || '')) {
        btn.textContent = 'Unlock Detailed Quotation — FREE';
      }
    });
  }
})();