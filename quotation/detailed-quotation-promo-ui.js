(() => {
  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  const price = modal.querySelector('.rounded-2xl.bg-gray-50.border.p-5.mb-5 .text-2xl');
  if (price) price.textContent = 'Included';
  const note = modal.querySelector('.p-6 > p.mt-5');
  if (note) note.textContent = 'Detailed quotation is currently available without an additional charge.';
  const button = document.getElementById('paymentProceedButton');
  if (button) button.textContent = 'Unlock Detailed Quotation';
  const paymentTitle = modal.querySelector('p.text-xs.uppercase');
  if (paymentTitle) paymentTitle.textContent = 'Detailed Quotation';
  const preview = document.querySelector('#quotationContent');
  if (preview && preview.innerHTML && !preview.dataset.promoMarked) {
    preview.dataset.promoMarked = '1';
    preview.querySelectorAll('button').forEach(btn => {
      if (/unlock detailed quotation/i.test(btn.textContent || '')) {
        btn.textContent = 'Unlock Detailed Quotation';
      }
    });
  }
})();