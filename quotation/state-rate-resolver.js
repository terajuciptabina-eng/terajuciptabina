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
  let extensionLoaded=false;

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
    const rateItems=Object.keys(cloneRateItems(data)).length?cloneRateItems(data):cloneRateItems(defaultData);
    return {state:stateId,rateSetId:data?.rateSetId||entry.rateSetId||stateId,name:data?.state||entry.name||stateId,rates,rateItems,source:entry.source};
  }

  function loadBuildExtension(){
    if(extensionLoaded||!/buildplanner\.html$/i.test(location.pathname))return;
    extensionLoaded=true;
    const script=document.createElement('script');
    script.src='rate-items.js?v=2';
    script.async=false;
    document.head.appendChild(script);
  }

  async function apply(){
    const selected=state();
    if(!selected)return;
    const token=++applyToken;
    try{
      const result=await resolve(selected);
      if(token!==applyToken)return;
      if(typeof RATES!=='undefined'&&RATES&&typeof RATES==='object')Object.assign(RATES,result.rates);
      window.TERAJU_RATE_ITEMS=result.rateItems;
      window.TERAJU_RATE_CONTEXT={state:result.state,rateSetId:result.rateSetId,name:result.name,source:'states/'+result.source};
      loadBuildExtension();
      window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
      if(typeof updateEstimate==='function')updateEstimate();
    }catch(error){console.error('[TERAJU] Rate resolver failed:',error)}
  }

  window.TERAJU_RESOLVE_RATE=apply;
  window.addEventListener('teraju:statechange',apply);
  const hasQuotationId=new URLSearchParams(location.search).has('quotationId');
  if(!hasQuotationId){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
    else setTimeout(apply,0);
  } else {
    loadBuildExtension();
  }
})();
