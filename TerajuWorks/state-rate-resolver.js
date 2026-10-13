/* TERAJU state rate resolver.
   State selection is mandatory before quotation entry.
   Every Malaysian state / Federal Territory has its own independent rate set.
   The resolver mutates the planner's existing RATES object; it does not replace planner logic.
*/
(function(){
  'use strict';

  const ROOT='../data/rates/';
  const INDEX_URL=ROOT+'states/index.json';
  const DEFAULT_URL=ROOT+'default.json';
  let indexPromise=null;
  let defaultPromise=null;
  let applyToken=0;

  function state(){return String(window.TERAJU_SELECTED_STATE||'').trim().toLowerCase();}
  function cloneRates(data){return data&&data.rates&&typeof data.rates==='object'?{...data.rates}:{};}
  function cloneRateItems(data){return data&&data.rateItems&&typeof data.rateItems==='object'?{...data.rateItems}:{};}

  async function loadIndex(){
    if(!indexPromise) indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load state rate index.');return r.json()});
    return indexPromise;
  }

  async function loadDefault(){
    if(!defaultPromise) defaultPromise=fetch(DEFAULT_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load master rate metadata.');return r.json()});
    return defaultPromise;
  }

  async function resolve(stateId){
    const index=await loadIndex();
    const entry=index?.states?.[stateId];
    if(!entry?.source)throw new Error('No rate source configured for state: '+stateId);
    const url=ROOT+'states/'+entry.source;
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error('Unable to load rate set for '+(entry.name||stateId)+'.');
    const data=await response.json();
    const rates=cloneRates(data);
    if(!Object.keys(rates).length)throw new Error('Rate set is empty for '+(entry.name||stateId)+'.');
    const defaultData=await loadDefault();
    const masterRates={...cloneRates(defaultData),...rates};
    const rateItems=Object.keys(cloneRateItems(data)).length?cloneRateItems(data):cloneRateItems(defaultData);
    return {state:stateId,rateSetId:data?.rateSetId||entry.rateSetId||stateId,name:data?.state||entry.name||stateId,rates,masterRates,rateItems,source:entry.source};
  }

  async function apply(){
    const selected=state();
    if(!selected)return;
    const token=++applyToken;
    try{
      const result=await resolve(selected);
      if(token!==applyToken)return;
      if(typeof RATES!=='undefined'&&RATES&&typeof RATES==='object'){
        // Remove the previous state's BuildPlanner canonical keys first so state-only
        // extras cannot leak when switching from one state rate set to another.
        Object.keys(RATES).forEach(key=>{if(key.startsWith('rule_')&&!key.startsWith('renovation_rule_'))delete RATES[key]});
        Object.assign(RATES,result.rates);
        // State files currently contain BuildPlanner rates only. Keep RenovationPlanner
        // on the canonical Malaysian defaults until a genuine state-specific renovation set exists.
        if(/renovationplanner-v2\.html$/i.test(location.pathname)){
          const defaultRenovationRates=Object.fromEntries(Object.entries(result.masterRates||{}).filter(([key])=>key.startsWith('renovation_rule_')));
          Object.assign(RATES,defaultRenovationRates);
        }
      }
      window.TERAJU_RATE_ITEMS=result.rateItems;
      window.TERAJU_RATE_CONTEXT={countryCode:'MY',currency:'MYR',state:result.state,rateSetId:result.rateSetId,name:result.name,source:'states/'+result.source,renovationRateSource:/renovationplanner-v2\.html$/i.test(location.pathname)?'default.json fallback; no state-specific renovation rate set is available':undefined};
      if(typeof window.TERAJU_SET_MASTER_RATE_SOURCE==='function')window.TERAJU_SET_MASTER_RATE_SOURCE(result.masterRates||result.rates,window.TERAJU_RATE_CONTEXT);
      window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
      if(typeof updateEstimate==='function')updateEstimate();
    }catch(error){console.error('[TERAJU] Rate resolver failed:',error)}
  }

  window.TERAJU_RESOLVE_RATE=apply;
  window.addEventListener('teraju:statechange',apply);
  window.addEventListener('teraju:countrychange',event=>{const code=String(event.detail?.countryCode||'').toUpperCase();if(code&&code!=='MY')applyToken++;});
  const hasQuotationId=new URLSearchParams(location.search).has('quotationId');
  // Existing estimates may restore their state after this resolver script is injected.
  // Apply immediately when a valid project state is already present; otherwise wait for statechange.
  if(!hasQuotationId||state()){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
    else setTimeout(apply,0);
  }
})();
