/* TERAJU WORKS — project country/currency context.
 * Country is stored per project/session; it never overwrites Malaysia state-rate files.
 * Rates are resolved separately from this context. Existing quotation snapshots win on restore.
 */
(function(){
 'use strict';
 const DATA_URL='../data/rates/country-comparison-2026.json';
 const STORAGE_KEY='teraju.project.country-context.v1';
 const CURRENCIES={
  MY:{name:'Malaysia',currency:'MYR',symbol:'RM',locale:'en-MY'},
  SG:{name:'Singapore',currency:'SGD',symbol:'S$',locale:'en-SG'},
  ID:{name:'Indonesia',currency:'IDR',symbol:'Rp',locale:'id-ID'},
  TH:{name:'Thailand',currency:'THB',symbol:'฿',locale:'th-TH'},
  PH:{name:'Philippines',currency:'PHP',symbol:'₱',locale:'en-PH'},
  VN:{name:'Vietnam',currency:'VND',symbol:'₫',locale:'vi-VN'},
  BN:{name:'Brunei',currency:'BND',symbol:'B$',locale:'en-BN'}
 };
 const params=new URLSearchParams(location.search);
 const plannerType=/renovationplanner-v2\.html$/i.test(location.pathname)?'renovation':'build';
 let dataPromise=null;
 function safeRead(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
 function safeWrite(value){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(value))}catch{}}
 function countryCode(value){const c=String(value||'').trim().toUpperCase();return CURRENCIES[c]?c:'MY'}
 function normalize(raw){const code=countryCode(raw?.countryCode||raw?.country||raw?.code);return {...CURRENCIES[code],countryCode:code,projectId:String(raw?.projectId||params.get('projectId')||params.get('quotationId')||''),source:raw?.source||'session'} }
 function current(){return normalize(window.TERAJU_PROJECT_COUNTRY||safeRead()||{countryCode:'MY'})}
 function set(raw){const next=normalize({...raw,projectId:raw?.projectId||current().projectId});window.TERAJU_PROJECT_COUNTRY=next;safeWrite(next);window.dispatchEvent(new CustomEvent('teraju:countrychange',{detail:next}));return next}
 function format(value,options={}){const c=current();return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:options.minimumFractionDigits??2,maximumFractionDigits:options.maximumFractionDigits??2}).format(Number(value)||0)}
 async function loadRates(){if(!dataPromise)dataPromise=fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load country rate comparison data');return r.json()});return dataPromise}
 async function rateById(id, snapshot){const ctx=normalize(snapshot||current());const data=await loadRates();const item=data.rates.find(x=>x.id===id);if(!item)return null;return {id:item.id,rate:item[ctx.currency],currency:ctx.currency,countryCode:ctx.countryCode,planner:item.planner,provisional:ctx.countryCode==='VN'||ctx.countryCode==='BN'} }
 const RENOVATION_RATE_KEYS={plaster_ceiling:'ceiling',spc_flooring:'spc',downlight:'downlight',ceiling_fan:'ceilingFan',curtain_box_led:'curtainBoxLED',bar_lamp:'barLamp',kitchen_frame:'kitchenFrame',making_good:'kitchenMakingGood',swing_glass_door:'kitchenGlassDoor',floor_tiles:'floorTile',wall_tiles:'wallTile',kitchen_lighting:'barLamp',sanitary_accessories:'bathroomSanitary',toilet_door:'bathroomDoor',exhaust_fan:'exhaustFan',gate_motor:'gateMotor',brickwall_divider:'brickwallDivider',front_fence:'frontFence',facade_wall:'facadeWall',wall_light:'wallLight'};
 let baseRates=null,applying=false;
 async function applyCountryRates(){
  if(applying)return;applying=true;
  try{
   const ctx=current(),data=await loadRates();
   if(typeof RATES==='undefined'||!RATES||typeof RATES!=='object')return;
   if(!baseRates)baseRates={...RATES};
   if(ctx.countryCode==='MY'){
    Object.assign(RATES,baseRates);
    if(typeof window.TERAJU_RESOLVE_RATE==='function')await window.TERAJU_RESOLVE_RATE();
    else if(typeof updateEstimate==='function')updateEstimate();
    return;
   }
   const selected=data.rates.filter(x=>x.planner===plannerType);
   if(selected.length!==(plannerType==='build'?82:40))throw new Error('Country rate set failed planner-count validation.');
   for(const item of selected){
    const value=Number(item[ctx.currency]);if(!Number.isFinite(value))throw new Error('Missing '+ctx.currency+' rate for '+item.id);
    if(plannerType==='build')RATES[item.id]=value;
    else {const token=item.id.replace(/^renovation_rule_/,'').replace(/_\\d+$/,'');const alias=RENOVATION_RATE_KEYS[token.slice(token.indexOf('_')+1)]||RENOVATION_RATE_KEYS[token];if(alias)RATES[alias]=value;}
   }
   window.TERAJU_RATE_CONTEXT={countryCode:ctx.countryCode,currency:ctx.currency,name:ctx.name,source:'country-comparison-2026.json',provisional:ctx.countryCode==='VN'||ctx.countryCode==='BN'};
   window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
   if(typeof updateEstimate==='function')updateEstimate();
  }catch(error){console.error('[TERAJU] Country rate integration failed:',error);window.TERAJU_COUNTRY_RATE_ERROR=String(error?.message||error)}
  finally{applying=false}
 }
 function installSelector(){
  if(document.getElementById('tcProjectCountrySelect'))return;
  const state=document.getElementById('projectState');
  const anchor=state?.closest('label')||state?.parentElement||document.querySelector('#customerName')?.closest('label')||document.querySelector('#customerName')?.parentElement;
  if(!anchor)return;
  const wrap=document.createElement('label');wrap.id='tcProjectCountryWrap';wrap.style.cssText='display:block;margin:12px 0;padding:12px;border:1px solid #dbe2ea;border-radius:12px;background:#fff;color:#0f172a;font-size:13px;font-weight:600';
  wrap.innerHTML='<span style="display:block;margin-bottom:6px">Project Country / Negara Projek</span><select id="tcProjectCountrySelect" style="width:100%;min-height:44px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a"><option value="MY">Malaysia · MYR</option><option value="SG">Singapore · SGD</option><option value="ID">Indonesia · IDR</option><option value="TH">Thailand · THB</option><option value="PH">Philippines · PHP</option><option value="VN">Vietnam · VND · provisional rates</option><option value="BN">Brunei · BND · provisional rates</option></select><span id="tcProjectCurrencyHint" style="display:block;margin-top:6px;font-weight:400;color:#64748b">Country is saved with this project. Malaysian projects continue to use the selected state rate set.</span>';
  anchor.insertAdjacentElement('afterend',wrap);
  const select=wrap.querySelector('select');
  const initial=current();
  select.value=initial.countryCode;
  function reflect(){const ctx=set({countryCode:select.value,projectId:current().projectId,source:'project-selector'});wrap.querySelector('#tcProjectCurrencyHint').textContent=ctx.countryCode==='VN'||ctx.countryCode==='BN'?'Currency: '+ctx.currency+'. Rates are provisional estimates and need local validation.':'Currency: '+ctx.currency+'. Malaysian state-specific rates remain authoritative for Malaysia.'}
  select.addEventListener('change',()=>{reflect();applyCountryRates()});
  reflect();
  applyCountryRates();
 }
 window.TERAJU_COUNTRIES=CURRENCIES;
 window.TERAJU_GET_PROJECT_COUNTRY=current;
 window.TERAJU_SET_PROJECT_COUNTRY=set;
 window.TERAJU_FORMAT_CURRENCY=format;
 window.TERAJU_GET_COUNTRY_RATE=rateById;
 window.TERAJU_GET_COUNTRY_RATE_DATA=loadRates;
 window.TERAJU_PROJECT_COUNTRY=current();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSelector,{once:true});else installSelector();
})();