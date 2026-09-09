/* TERAJU state rate resolver.
   State selection is mandatory before quotation entry.
   The current rollout uses the state record when it exists and Default Rate as fallback.
   It mutates the planner's existing RATES object; it does not replace planner logic.
*/
(function(){
  'use strict';

  const ROOT='../data/rates/';
  const DEFAULT_URL=ROOT+'default.json';
  const INDEX_URL=ROOT+'states/index.json';
  let indexPromise=null;
  let applyToken=0;

  function state(){return String(window.TERAJU_SELECTED_STATE||'').trim().toLowerCase();}
  function cloneRates(data){return data&&data.rates&&typeof data.rates==='object'?{...data.rates}:{};}

  async function loadIndex(){
    if(!indexPromise) indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load state rate index.');return r.json()});
    return indexPromise;
  }

  async function resolve(stateId){
    const index=await loadIndex();
    const entry=index?.states?.[stateId];
    let data=null;
    if(entry?.source && entry.source!=='../default.json'){
      const url=ROOT+'states/'+entry.source;
      const response=await fetch(url,{cache:'no-store'});
      if(response.ok)data=await response.json();
    }
    if(!data){
      const response=await fetch(DEFAULT_URL,{cache:'no-store'});
      if(!response.ok)throw new Error('Unable to load Default Rate.');
      data=await response.json();
    }
    return {state:stateId,rateSetId:data?.rateSetId||entry?.rateSetId||'default',name:data?.state||entry?.name||stateId,rates:cloneRates(data)};
  }

  async function apply(){
    const selected=state();
    if(!selected)return;
    const token=++applyToken;
    try{
      const result=await resolve(selected);
      if(token!==applyToken)return;
      if(typeof RATES!=='undefined'&&RATES&&typeof RATES==='object')Object.assign(RATES,result.rates);
      window.TERAJU_RATE_CONTEXT={state:result.state,rateSetId:result.rateSetId,name:result.name,source:result.rateSetId==='default'?'default.json':('states/'+result.rateSetId+'.json')};
      window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
      if(typeof updateEstimate==='function')updateEstimate();
    }catch(error){console.error('[TERAJU] Rate resolver failed:',error)}
  }

  window.TERAJU_RESOLVE_RATE=apply;
  window.addEventListener('teraju:statechange',apply);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
  else setTimeout(apply,0);
})();
