(() => {
  // Prevent duplicate initialization when this helper is loaded more than once.
  if (window.__tcQuotationQuantityFixInitialized) return;
  window.__tcQuotationQuantityFixInitialized = true;

  function installQuotationLayout() {
    if (document.getElementById('tcBuildPlannerQuotationLayout')) return;

    const style = document.createElement('style');
    style.id = 'tcBuildPlannerQuotationLayout';
    style.textContent = `
      #quotationContent table.detailed-quotation-table {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }

      #quotationContent table.detailed-quotation-table col:nth-child(1),
      #quotationContent table.detailed-quotation-table th:nth-child(1),
      #quotationContent table.detailed-quotation-table td:nth-child(1) {
        width: 5% !important;
        max-width: 5% !important;
      }

      #quotationContent table.detailed-quotation-table col:nth-child(2),
      #quotationContent table.detailed-quotation-table th:nth-child(2),
      #quotationContent table.detailed-quotation-table td:nth-child(2) {
        width: 55% !important;
        max-width: 55% !important;
        min-width: 0 !important;
        text-align: left !important;
      }

      #quotationContent table.detailed-quotation-table col:nth-child(3),
      #quotationContent table.detailed-quotation-table th:nth-child(3),
      #quotationContent table.detailed-quotation-table td:nth-child(3) {
        width: 10% !important;
        max-width: 10% !important;
        text-align: right !important;
      }

      #quotationContent table.detailed-quotation-table col:nth-child(4),
      #quotationContent table.detailed-quotation-table th:nth-child(4),
      #quotationContent table.detailed-quotation-table td:nth-child(4) {
        width: 15% !important;
        max-width: 15% !important;
        text-align: right !important;
      }

      #quotationContent table.detailed-quotation-table col:nth-child(5),
      #quotationContent table.detailed-quotation-table th:nth-child(5),
      #quotationContent table.detailed-quotation-table td:nth-child(5) {
        width: 15% !important;
        max-width: 15% !important;
        text-align: right !important;
      }

      #quotationContent table.detailed-quotation-table th,
      #quotationContent table.detailed-quotation-table td {
        overflow-wrap: anywhere !important;
        word-break: normal !important;
        vertical-align: top !important;
      }
    `;
    document.head.appendChild(style);
  }

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

    installQuotationLayout();
    roundQuotationQuantities();

    let updating = false;
    const observer = new MutationObserver(() => {
      if (updating) return;
      updating = true;
      observer.disconnect();
      try {
        installQuotationLayout();
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
