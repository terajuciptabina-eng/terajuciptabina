(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcContractorDetailedQuotationInstalled) return;
    if (typeof window.requestDetailedQuotation !== 'function' || typeof window.generateQuotation !== 'function') return;
    window.__tcContractorDetailedQuotationInstalled = true;

    const ensureInitialEstimate = () => {
      const rooms = document.getElementById('roomsContainer');
      if (rooms && !rooms.children.length && typeof window.addRoom === 'function') window.addRoom();
      if (typeof window.updateEstimate === 'function') window.updateEstimate();
    };
    ensureInitialEstimate();

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
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
