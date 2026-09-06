(() => {
  function install() {
    if (window.__tcSimpleStructureFixInstalled) return;
    if (typeof window.getCurrentQuotationData !== 'function' || typeof window.generateQuotation !== 'function') return;
    window.__tcSimpleStructureFixInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const original = window.generateQuotation;

    window.generateQuotation = function() {
      original.apply(this, arguments);
      const data = window.getCurrentQuotationData();
      if (!data?.structures?.length) return;
      const table = document.querySelector('#quotationContent .simple-quotation-table');
      const tbody = table?.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const section = rows.find(r => r.classList.contains('tc-q-section') && /B\. STRUCTURAL WORKS/i.test(r.textContent || ''));
      if (!section) return;
      const old = section.nextElementSibling;
      if (!old) return;

      const groups = [];
      const map = new Map();
      data.structures.forEach(item => {
        const key = item?.groupKey || item?.groupTitle || '__ungrouped__';
        if (!map.has(key)) {
          const g = { title: item?.groupTitle || '', items: [] };
          map.set(key, g);
          groups.push(g);
        }
        map.get(key).items.push(item);
      });

      let no = Number(old.cells?.[0]?.textContent || 1);
      let html = '';
      groups.filter(g => g.items.length).forEach(g => {
        const total = g.items.reduce((sum,i) => sum + (Number(i.amount)||0), 0);
        const descriptions = g.items.map(i => esc(i.description)).join('<br>');
        html += `<tr class="tc-q-room border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">${esc(g.title || 'Structural Works')}</td><td class="py-3 px-2 leading-6">${descriptions}</td><td class="py-3 px-2 text-right font-semibold">${money(total)}</td></tr>`;
      });
      old.outerHTML = html;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();