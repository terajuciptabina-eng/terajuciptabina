(() => {
  function roundQuotationQuantities() {
    const root = document.getElementById('quotationContent');
    if (!root) return;

    root.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
      const quantityIndex = headers.findIndex(h => h === 'quantity' || h.includes('quantity'));
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
        cell.textContent = `${rounded}${unit ? ` ${unit}` : ''}`;
      });
    });
  }

  function init() {
    roundQuotationQuantities();
    const root = document.getElementById('quotationContent');
    if (!root) return;

    const observer = new MutationObserver(() => {
      observer.disconnect();
      roundQuotationQuantities();
      observer.observe(root, { childList: true, subtree: true });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
