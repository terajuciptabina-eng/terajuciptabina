(() => {
  function load(id, src, next) {
    if (document.getElementById(id)) { next?.(); return; }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.onload = () => next?.();
    document.head.appendChild(s);
  }
  const contractor = new URLSearchParams(location.search).get('audience') === 'contractor';
  const renovationContractor = contractor && /renoplannercon\.html$/i.test(location.pathname);
  load('tcBuildPlannerStatePersistence', 'buildplanner-state-persistence.js?v=20260907-final', () => {
    load('tcBuildPlannerQuotationRenderer', 'buildplanner-alignment-fix.js?v=20260907-final', () => {
      load('tcBuildPlannerSimpleStructureFix', 'buildplanner-simple-structure-fix.js?v=20260907-final', () => {
        load('tcBuildPlannerDetailedFix', 'buildplanner-detailed-fix.js?v=20260907-final', () => {
          if (contractor && !renovationContractor) {
            load('tcContractorItemEditor', 'contractor-item-editor.js?v=20260907-1', () => {
              load('tcContractorDetailedQuotation', 'contractor-detailed-quotation.js?v=20260907-2');
            });
          }
          if (renovationContractor) load('tcRenovationContractorItemEditor', 'renovation-contractor-item-editor.js?v=20260907-1');
        });
      });
    });
  });
})();
