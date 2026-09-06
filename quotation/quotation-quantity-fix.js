(() => {
  // Prevent duplicate initialization when this helper is loaded more than once.
  if (window.__tcQuotationQuantityFixInitialized) return;
  window.__tcQuotationQuantityFixInitialized = true;

  function roundQuotationQuantities() {
    const root = document.getElementById('quotationContent');
    if (!root) return;

    root.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
        th.textContent.trim().toLowerCase()
      );
      const quantityIndex = headers.findIndex(
        h => h === 'quantity' || h.includes('quantity')
      );
      if (quantityIndex < 0) return;

      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.children;
        if (!cells[quantityIndex]) return;

        const cell = cells[quantityIndex];
        const raw = cell.textContent.trim();
        const match = raw.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
        if (!match) return;

        const value = Number(match[1]);
        if (!Number.isFinite(value)) return;

        const unit = match[2] || '';
        const rounded = Math.max(1, Math.ceil(value));
        const nextText = `${rounded}${unit ? ` ${unit}` : ''}`;

        // Only write when the value actually changes. This is critical because
        // textContent changes fire MutationObserver again and can otherwise
        // create an infinite mutation loop that freezes the quotation page.
        if (cell.textContent.trim() !== nextText) {
          cell.textContent = nextText;
        }
      });
    });
  }

  function init() {
    const root = document.getElementById('quotationContent');
    if (!root) return;

    roundQuotationQuantities();

    let updating = false;
    const observer = new MutationObserver(() => {
      if (updating) return;
      updating = true;
      observer.disconnect();
      try {
        roundQuotationQuantities();
      } finally {
        updating = false;
        observer.observe(root, { childList: true, subtree: true });
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
