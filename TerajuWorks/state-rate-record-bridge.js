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
        const context=window.TERAJU_RATE_CONTEXT||{};
        const country=window.TERAJU_GET_PROJECT_COUNTRY?.()||{countryCode:payload?.quotation?.countryCode||'MY',currency:payload?.quotation?.currency||'MYR',symbol:payload?.quotation?.currencySymbol||'RM',name:'Malaysia'};
        const countryCode=String(country.countryCode||'MY').toUpperCase();
        const isMalaysia=countryCode==='MY';
        const state=String(window.TERAJU_SELECTED_STATE||context.state||'').trim().toLowerCase();
        if(payload && payload.quotation){
          const q=payload.quotation;
          q.countryCode=countryCode;
          q.currency=country.currency||q.currency||'MYR';
          q.currencySymbol=country.symbol||q.currencySymbol||'RM';
          q.project=q.project||{};
          q.plannerState=q.plannerState||{};
          q.plannerState.countryCode=countryCode;
          q.plannerState.currency=q.currency;
          q.plannerState.projectCountry={...country,projectId:q.projectId||q.plannerState.projectId||''};
          q.plannerState.projectState=isMalaysia?state:'';
          q.plannerState.rateSetId=isMalaysia?(context.rateSetId||state||q.plannerState.rateSetId||'default'):('country-comparison-2026:'+countryCode);
          q.plannerState.rateSetName=isMalaysia?(context.name||q.plannerState.rateSetName||state||'Malaysian state rate'):(country.name+' estimated rates');
          q.plannerState.rateSnapshotAt=new Date().toISOString();
          if(isMalaysia&&state){q.project.state=state;}else{delete q.project.state;}
          init={...init,body:JSON.stringify(payload)};
        }
      }
    }catch(error){console.warn('[TERAJU] State/rate record bridge skipped:',error)}
    return originalFetch(input,init);
  };
})();
