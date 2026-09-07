(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcContractorDetailedQuotationInstalled) return;
    if (typeof window.requestDetailedQuotation !== 'function' || typeof window.generateQuotation !== 'function') return;
    window.__tcContractorDetailedQuotationInstalled = true;

    const money = v => typeof window.money === 'function' ? window.money(v, 2) : `RM ${(Number(v) || 0).toFixed(2)}`;
    const qty = v => typeof window.formatQty === 'function' ? window.formatQty(v, 'sqft') : Number(v || 0).toLocaleString('en-MY', { maximumFractionDigits: 2 });

    const syncContractorSummary = () => {
      const roomsContainer = document.getElementById('roomsContainer');
      const roomCards = roomsContainer ? Array.from(roomsContainer.querySelectorAll('.room-card')) : [];
      let roomsArea = 0;
      roomCards.forEach(card => {
        const areaInput = card.querySelector('input[type="number"]');
        const area = parseFloat(areaInput?.value);
        if (Number.isFinite(area) && area > 0) roomsArea += area;
      });

      if (!roomCards.length && roomsContainer) {
        roomsContainer.querySelectorAll('input[type="number"]').forEach(input => {
          const area = parseFloat(input.value);
          if (Number.isFinite(area) && area > 0) roomsArea += area;
        });
      }

      const declared = parseFloat(document.getElementById('builtUpArea')?.value) || 0;
      let total = 0;
      try {
        const data = typeof window.getCurrentQuotationData === 'function' ? window.getCurrentQuotationData() : null;
        total = Number(data?.total) || 0;
      } catch (e) {}

      const roomsEl = document.getElementById('roomsTotalArea');
      const declaredEl = document.getElementById('totalBuiltArea');
      const totalEl = document.getElementById('grandTotal');
      if (roomsEl) roomsEl.textContent = `${qty(roomsArea)} sqft`;
      if (declaredEl) declaredEl.textContent = `${qty(declared)} sqft`;
      if (totalEl) totalEl.textContent = money(total);
    };

    const ensureInitialEstimate = () => {
      const rooms = document.getElementById('roomsContainer');
      if (rooms && !rooms.children.length && typeof window.addRoom === 'function') window.addRoom();
      if (typeof window.updateEstimate === 'function') window.updateEstimate();
      syncContractorSummary();
    };

    const originalUpdateEstimate = window.updateEstimate;
    window.updateEstimate = function () {
      const result = originalUpdateEstimate.apply(this, arguments);
      syncContractorSummary();
      return result;
    };

    const originalRequestDetailedQuotation = window.requestDetailedQuotation;
    const originalGenerateQuotation = window.generateQuotation;

    window.generateQuotation = function () {
      const selected = document.querySelector('input[name="quotationType"]:checked')?.value || 'simple';
      if (selected !== 'detail') return originalGenerateQuotation.apply(this, arguments);

      ensureInitialEstimate();
      originalRequestDetailedQuotation.apply(this, arguments);

      let pending = null;
      try { pending = JSON.parse(localStorage.getItem('terajuPendingDetailedQuotation') || 'null'); } catch (e) {}
      if (!pending?.html) {
        try { pending = JSON.parse(sessionStorage.getItem('terajuPendingDetailedQuotation') || 'null'); } catch (e) {}
      }
      if (!pending?.html) return;

      const content = document.getElementById('quotationContent');
      if (!content) return;
      content.innerHTML = pending.html;
      document.getElementById('quotationPrintActions')?.classList.remove('hidden');
      document.getElementById('quotationDocument')?.classList.remove('hidden');
      document.getElementById('quotationDocument')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    ensureInitialEstimate();
    setTimeout(syncContractorSummary, 100);
    setTimeout(syncContractorSummary, 500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
