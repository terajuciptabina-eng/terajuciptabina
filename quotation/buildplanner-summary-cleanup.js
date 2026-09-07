(() => {
  function install() {
    if (window.__tcBuildPlannerSummaryCleanupInstalled) return;
    if (typeof window.generateQuotation !== 'function') return;
    window.__tcBuildPlannerSummaryCleanupInstalled = true;

    const original = window.generateQuotation;
    window.generateQuotation = function () {
      const result = original.apply(this, arguments);
      const content = document.getElementById('quotationContent');
      if (!content) return result;

      // Remove the duplicate summary introduced by the temporary alignment renderer.
      // The existing structural-summary renderer remains the single source for Simple quotation.
      content.querySelectorAll('.tc-q-summary-header, .tc-q-summary-row').forEach(row => row.remove());

      return result;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
