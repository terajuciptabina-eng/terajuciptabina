(() => {
  if (window.__tcQuotationQuantityFixInitialized) return;
  window.__tcQuotationQuantityFixInitialized = true;

  const WIDTHS = ['5%', '55%', '10%', '15%', '15%'];

  function apply() {
    const root = document.getElementById('quotationContent');
    if (!root) return;

    root.querySelectorAll('table.detailed-quotation-table').forEach(table => {
      table.setAttribute('style', 'width:100% !important;table-layout:fixed !important;border-collapse:collapse !important;');

      const colgroup = table.querySelector('colgroup');
      if (colgroup) {
        Array.from(colgroup.children).forEach((col, i) => {
          if (WIDTHS[i]) col.setAttribute('style', `width:${WIDTHS[i]} !important;`);
        });
      }

      table.querySelectorAll('tr').forEach(row => {
        const cells = Array.from(row.children);
        if (cells.length !== 5) return;
        cells.forEach((cell, i) => {
          cell.style.setProperty('width', WIDTHS[i], 'important');
          cell.style.setProperty('max-width', WIDTHS[i], 'important');
          cell.style.setProperty('min-width', '0', 'important');
          cell.style.setProperty('box-sizing', 'border-box', 'important');
        });
        cells[0].style.setProperty('text-align', 'left', 'important');
        cells[1].style.setProperty('text-align', 'left', 'important');
        cells[2].style.setProperty('text-align', 'right', 'important');
        cells[3].style.setProperty('text-align', 'right', 'important');
        cells[4].style.setProperty('text-align', 'right', 'important');
      });
    });
  }

  function roundQuantities() {
    const root = document.getElementById('quotationContent');
    if (!root) return;
    root.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
      const qi = headers.findIndex(h => h === 'quantity' || h.includes('quantity'));
      if (qi < 0) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        const cell = row.children[qi];
        if (!cell) return;
        const m = cell.textContent.trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
        if (!m) return;
        const n = Number(m[1]);
        if (!Number.isFinite(n)) return;
        const unit = m[2] || '';
        const next = `${Math.max(1, Math.ceil(n))}${unit}`;
        if (cell.textContent.trim() !== next) cell.textContent = next;
      });
    });
  }

  function init() {
    const root = document.getElementById('quotationContent');
    if (!root) return;
    apply();
    roundQuantities();
    let busy = false;
    const observer = new MutationObserver(() => {
      if (busy) return;
      busy = true;
      observer.disconnect();
      try { apply(); roundQuantities(); }
      finally { busy = false; observer.observe(root, {childList:true, subtree:true}); }
    });
    observer.observe(root, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
