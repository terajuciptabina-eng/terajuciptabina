(() => {
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function neutralize() {
    const m = document.getElementById('paymentModal');
    if (m) {
      const price = m.querySelector('.rounded-2xl.bg-gray-50.border.p-5.mb-5 .text-2xl');
      setText(price, 'Included');

      const note = m.querySelector('.p-6 > p.mt-5');
      setText(note, 'Detailed quotation is currently available without an additional charge.');

      const button = m.querySelector('#paymentProceedButton');
      setText(button, 'Unlock Detailed Quotation');

      const paymentTitle = m.querySelector('p.text-xs.uppercase');
      setText(paymentTitle, 'Detailed Quotation');

      const heading = m.querySelector('h3');
      setText(heading, 'Unlock Detailed Quotation');

      const sub = m.querySelector('h3 + p');
      setText(sub, 'View the full detailed quotation.');
    }

    const q = document.getElementById('quotationContent');
    if (!q) return;

    q.querySelectorAll('.detail-lock-card').forEach(card => {
      const promo = card.querySelector('p.mt-3');
      setText(promo, 'Your detailed quotation is ready. Unlock it to view the full pricing details.');

      card.querySelectorAll('button').forEach(btn => {
        const label = btn.textContent || '';
        if (/unlock detailed quotation/i.test(label) || /unlock free/i.test(label)) {
          setText(btn, 'Unlock Detailed Quotation');
        }
      });
    });

    q.querySelectorAll('.detail-unlocked-badge').forEach(el => {
      setText(el, '✓ Detailed Quotation Unlocked');
    });
  }

  neutralize();

  const observer = new MutationObserver(() => neutralize());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
