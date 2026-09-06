(() => {
  function load(id, src, next) {
    if (document.getElementById(id)) { next?.(); return; }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.onload = () => next?.();
    document.head.appendChild(s);
  }
  load('tcBuildPlannerStatePersistence', 'buildplanner-state-persistence.js?v=20260907-final', () => {
    load('tcBuildPlannerQuotationRenderer', 'buildplanner-alignment-fix.js?v=20260907-final', () => {
      load('tcBuildPlannerSimpleStructureFix', 'buildplanner-simple-structure-fix.js?v=20260907-final', () => {
        load('tcBuildPlannerDetailedFix', 'buildplanner-detailed-fix.js?v=20260907-final');
      });
    });
  });
})();
