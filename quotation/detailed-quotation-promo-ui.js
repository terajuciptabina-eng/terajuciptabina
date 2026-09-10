(() => {
  const modal = document.getElementById('paymentModal');
  const preview = document.querySelector('#quotationContent');
  let applying = false;

  function neutralize(root) {
    if (applying) return;
    applying = true;
    try {
      const scope = root || document;
      const m = scope.id === 'paymentModal' ? scope : scope.querySelector?.('#paymentModal') || document.getElementById('paymentModal');
      if (m) {
        const price = m.querySelector('.rounded-2xl.bg-gray-50.border.p-5.mb-5 .text-2xl');
        if (price) price.textContent = 'Included';

        const note = m.querySelector('.p-6 > p.mt-5');
        if (note) note.textContent = 'Detailed quotation is currently available without an additional charge.';

        const button = m.querySelector('#paymentProceedButton');
        if (button) button.textContent = 'Unlock Detailed Quotation';

        const paymentTitle = m.querySelector('p.text-xs.uppercase');
        if (paymentTitle) paymentTitle.textContent = 'Detailed Quotation';

        const heading = m.querySelector('h3');
        if (heading) heading.textContent = 'Unlock Detailed Quotation';

        const sub = m.querySelector('h3 + p');
        if (sub) sub.textContent = 'View the full detailed quotation.';
      }

      const q = document.querySelector('#quotationContent');
      if (q) {
        q.querySelectorAll('.detail-lock-card').forEach(card => {
          const promo = card.querySelector('p.mt-3');
          if (promo) promo.textContent = 'Your detailed quotation is ready. Unlock it to view the full pricing details.';

          card.querySelectorAll('button').forEach(btn => {
            if (/unlock detailed quotation/i.test(btn.textContent || '') || /unlock free/i.test(btn.textContent || '')) {
              btn.textContent = 'Unlock Detailed Quotation';
            }
          });
        });

        q.querySelectorAll('.detail-unlocked-badge').forEach(el => {
          el.textContent = '✓ Detailed Quotation Unlocked';
        });
      }
    } finally {
      applying = false;
    }
  }

  neutralize();

  const observer = new MutationObserver(() => neutralize());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
