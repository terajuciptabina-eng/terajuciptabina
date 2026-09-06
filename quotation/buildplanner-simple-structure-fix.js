(() => {
  function install() {
    if (window.__tcSimpleStructureFixInstalled) return;
    if (typeof window.getCurrentQuotationData !== 'function' || typeof window.generateQuotation !== 'function') return;
    window.__tcSimpleStructureFixInstalled = true;

    const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const money = v => typeof window.money === 'function' ? window.money(v,2) : `RM ${(Number(v)||0).toFixed(2)}`;
    const sum = items => (items || []).reduce((total,item) => total + (Number(item?.amount)||0), 0);
    const original = window.generateQuotation;

    window.generateQuotation = function() {
      original.apply(this, arguments);
      const data = window.getCurrentQuotationData();
      const table = document.querySelector('#quotationContent .simple-quotation-table');
      const tbody = table?.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const section = rows.find(r => r.classList.contains('tc-q-section') && /B\. STRUCTURAL WORKS/i.test(r.textContent || ''));

      const groups = [];
      const map = new Map();
      (data?.structures || []).forEach(item => {
        const key = item?.groupKey || item?.groupTitle || '__ungrouped__';
        if (!map.has(key)) {
          const g = { title: item?.groupTitle || '', items: [] };
          map.set(key, g);
          groups.push(g);
        }
        map.get(key).items.push(item);
      });

      if (section) {
        const old = section.nextElementSibling;
        if (old) {
          let no = Number(old.cells?.[0]?.textContent || 1);
          let html = '';
          groups.filter(g => g.items.length).forEach(g => {
            const total = sum(g.items);
            const descriptions = g.items.map(i => esc(i.description)).join('<br>');
            html += `<tr class="tc-q-room border-b align-top"><td class="py-3 px-2">${no++}</td><td class="py-3 px-2 font-semibold">${esc(g.title || 'Structural Works')}</td><td class="py-3 px-2 leading-6">${descriptions}</td><td class="py-3 px-2 text-right font-semibold whitespace-nowrap">${money(total)}</td></tr>`;
          });
          old.outerHTML = html;
        }
      }

      tbody.querySelectorAll('tr.tc-q-structural-summary').forEach(r => r.remove());
      const footer = table.querySelector('tfoot');
      if (!footer) return;

      const architecturalItems = Object.values(data?.archByRoom || {}).flat();
      const summary = [
        ['PRELIMINARIES', sum(data?.prelim)],
        ['STRUCTURAL WORKS', sum(data?.structures)],
        ['ARCHITECTURAL WORKS', sum(architecturalItems)],
        ['ELECTRICAL WORKS', sum(data?.electrical)]
      ];

      let html = `<tr class="tc-q-section tc-q-structural-summary"><td colspan="4" class="py-3 px-2">SUMMARY — TOTAL AMOUNT BY HIERARCHY</td></tr>`;
      summary.forEach(([title,total]) => {
        html += `<tr class="tc-q-structural-summary border-b"><td colspan="3" class="py-2 px-2 text-right font-semibold">${title}</td><td class="py-2 px-2 text-right font-semibold whitespace-nowrap">${money(total)}</td></tr>`;
      });
      footer.insertAdjacentHTML('beforebegin', html);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();