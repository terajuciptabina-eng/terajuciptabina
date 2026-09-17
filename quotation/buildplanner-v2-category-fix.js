/* TERAJU WORKS — Build Planner V2 category normalization
   Display/category fix only. Global Calculation Rules remain the source of truth. */
(function(){
  'use strict';
  if(!/buildplanner-v2\.html$/i.test(location.pathname))return;

  function normalize(items){
    return (items||[]).map(function(item){
      const path=String(item&&item.masterPath||'').trim().toUpperCase();
      let category=String(item&&item.category||'').toLowerCase();
      if(/^DOORS\s*\//.test(path)||/^WINDOWS\s*\//.test(path)){
        category='doors-windows';
      }else if(/^ARCHITECTURES\s*\//.test(path)){
        category='architecture';
      }else if(/^ELECTRICAL\s*\//.test(path)){
        category='electrical';
      }else if(/^EXTERNAL\s+WORK\s*\//.test(path)){
        category='external-work';
      }else if(/^PRELIMINARIES\s*\//.test(path)){
        category='preliminaries';
      }else if(/^STRUCTURES\s*\//.test(path)||/^MAIN\s+BUILDING\s*\//.test(path)||/^PORCH\s*\//.test(path)){
        category='structures';
      }
      return Object.assign({},item,{category:category});
    });
  }

  let tries=0;
  const timer=setInterval(function(){
    if(typeof window.getAllItems==='function'&&!window.getAllItems.__terajuV2CategoryFix){
      const original=window.getAllItems;
      const wrapped=function(){return normalize(original.apply(this,arguments));};
      wrapped.__terajuV2CategoryFix=true;
      window.getAllItems=wrapped;
      try{if(typeof window.renderConstructionBudget==='function')window.renderConstructionBudget();}catch(e){console.warn('[TERAJU V2 category]',e)}
      clearInterval(timer);
    }
    if(++tries>120)clearInterval(timer);
  },100);
})();
