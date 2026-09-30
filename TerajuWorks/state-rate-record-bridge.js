/* TERAJU state/rate quotation record bridge.
   Keeps the stable quotation-records.js source intact while adding state/rate metadata
   to newly saved quotation payloads.
*/
(function(){
  'use strict';
  if(window.__terajuStateRateRecordBridge)return;
  window.__terajuStateRateRecordBridge=true;
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      const method=String(init?.method||(input&&input.method)||'GET').toUpperCase();
      if(method==='PUT' && /\/api\/quotations(?:\?|$)/i.test(url) && init?.body){
        const payload=JSON.parse(init.body);
        const context=window.TERAJU_RATE_CONTEXT;
        const state=String(window.TERAJU_SELECTED_STATE||context?.state||'').trim();
        if(state && payload && payload.quotation){
          const q=payload.quotation;
          q.project=q.project||{};
          q.project.state=state;
          q.plannerState=q.plannerState||{};
          q.plannerState.projectState=state;
          q.plannerState.rateSetId=context?.rateSetId||q.plannerState.rateSetId||'default';
          q.plannerState.rateSetName=context?.name||q.plannerState.rateSetName||'Default Rate';
          q.plannerState.rateSnapshotAt=new Date().toISOString();
          init={...init,body:JSON.stringify(payload)};
        }
      }
    }catch(error){console.warn('[TERAJU] State/rate record bridge skipped:',error)}
    return originalFetch(input,init);
  };
})();
