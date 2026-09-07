(() => {
  const install = () => {
    if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
    if (window.__tcContractorDetailedQuotationInstalled) return;
    if (typeof window.requestDetailedQuotation !== 'function') return;
    window.__tcContractorDetailedQuotationInstalled = true;

    const originalRequestDetailedQuotation = window.requestDetailedQuotation;
    window.generateQuotation = function () {
      const selected = document.querySelector('input[name="quotationType"]:checked')?.value || 'simple';
      if (selected !== 'detail') {
        if (typeof window.__tcOriginalGenerateQuotation === 'function') {
          return window.__tcOriginalGenerateQuotation();
        }
        return;
      }

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

    // Preserve the existing Contractor simple quotation renderer from the shared/frozen template.
    window.__tcOriginalGenerateQuotation = window.generateQuotation;
    window.generateQuotation = function () {
      const selected = document.querySelector('input[name="quotationType"]:checked')?.value || 'simple';
      if (selected === 'detail') {
        return originalRequestDetailedQuotation.apply(this, arguments);
      }
      return window.__tcOriginalGenerateQuotation.apply(this, arguments);
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
