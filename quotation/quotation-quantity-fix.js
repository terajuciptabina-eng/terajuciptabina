(() => {
  const load = (id, src) => {
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    document.head.appendChild(s);
  };
  load('tcBuildPlannerQuotationRenderer', 'buildplanner-alignment-fix.js?v=20260907-final');
  load('tcBuildPlannerSimpleStructureFix', 'buildplanner-simple-structure-fix.js?v=20260907-final');
  load('tcBuildPlannerDetailedFix', 'buildplanner-detailed-fix.js?v=20260907-final');
})();