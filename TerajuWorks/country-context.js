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
 function current(){if(window.TERAJU_PROJECT_COUNTRY)return normalize(window.TERAJU_PROJECT_COUNTRY);const activeProject=String(params.get('projectId')||params.get('quotationId')||'');return normalize({countryCode:accountCountry(),projectId:activeProject,source:'account-default'})}
 function set(raw){const next=normalize({...raw,projectId:raw?.projectId||current().projectId});window.TERAJU_PROJECT_COUNTRY=next;safeWrite(next);window.dispatchEvent(new CustomEvent('teraju:countrychange',{detail:next}));return next}
 function formatNumber(value,options={}){const c=current();return new Intl.NumberFormat(c.locale,{minimumFractionDigits:options.minimumFractionDigits??2,maximumFractionDigits:options.maximumFractionDigits??2}).format(Number(value)||0)}
 function format(value,options={}){const c=current();return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:options.minimumFractionDigits??2,maximumFractionDigits:options.maximumFractionDigits??2}).format(Number(value)||0)}
 async function loadRates(){if(!dataPromise)dataPromise=fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load country rate comparison data');return r.json()});return dataPromise}
 async function rateById(id, snapshot){const ctx=normalize(snapshot||current());const data=await loadRates();const item=data.rates.find(x=>x.id===id);if(!item)return null;const rateField=ctx.countryCode==='MY'?'Malaysia_MYR':ctx.currency;const rate=Number(item[rateField]);if(!Number.isFinite(rate))throw new Error('No validated rate for '+ctx.countryCode+' item '+id);return {id:item.id,rate,currency:ctx.currency,countryCode:ctx.countryCode,planner:item.planner,provisional:ctx.countryCode==='VN'||ctx.countryCode==='BN'} }
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
    const rateField=ctx.countryCode==='MY'?'Malaysia_MYR':ctx.currency;const value=Number(item[rateField]);if(!Number.isFinite(value))throw new Error('Missing '+rateField+' rate for '+item.id);
    if(plannerType==='build')RATES[item.id]=value;
    else {const token=item.id.replace(/^renovation_rule_/,'').replace(/_\d+$/,'');const aliasKey=Object.keys(RENOVATION_RATE_KEYS).sort((a,b)=>b.length-a.length).find(key=>token===key||token.endsWith('_'+key));const alias=aliasKey?RENOVATION_RATE_KEYS[aliasKey]:'';if(alias)RATES[alias]=value;}
   }
   window.TERAJU_RATE_CONTEXT={countryCode:ctx.countryCode,currency:ctx.currency,name:ctx.name,source:'country-comparison-2026.json',provisional:ctx.countryCode==='VN'||ctx.countryCode==='BN'};
   window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
   if(typeof updateEstimate==='function')updateEstimate();
  }catch(error){console.error('[TERAJU] Country rate integration failed:',error);window.TERAJU_COUNTRY_RATE_ERROR=String(error?.message||error)}
  finally{applying=false}
 }
 // Country is inherited from the signed-in account/project context. Do not inject a second country selector into planners.
 function accountCountry(){
  const candidates=[
   window.TERAJU_ACCOUNT,window.TERAJU_USER,window.currentUser,window.userProfile,
   (()=>{try{return JSON.parse(sessionStorage.getItem('teraju.user')||'null')}catch{return null}})(),
   (()=>{try{return JSON.parse(localStorage.getItem('teraju.user')||'null')}catch{return null}})(),
   (()=>{try{return JSON.parse(localStorage.getItem('teraju.contractor.github.v1')||'null')}catch{return null}})(),
   (()=>{try{return JSON.parse(localStorage.getItem('teraju.homeowner.github.v1')||'null')}catch{return null}})()
  ];
  for(const value of candidates){const code=value?.countryCode||value?.country||value?.profile?.countryCode||value?.profile?.country;if(code&&CURRENCIES[String(code).trim().toUpperCase()])return String(code).trim().toUpperCase()}
  return 'MY';
 }

 async function hydrateAccountCountry(){
  const roleRaw=String(params.get('role')||params.get('audience')||'').toLowerCase();
  const role=roleRaw==='homeowner'||roleRaw==='contractor'?roleRaw:'';
  const id=String(params.get('id')||params.get('contractorId')||params.get('homeownerId')||(()=>{try{if(role==='contractor'){const active=localStorage.getItem('teraju.contractor.local.v1.activeContractorId');if(active)return active;const saved=JSON.parse(localStorage.getItem('teraju.contractor.github.v1')||'null');return saved?.contractorId||saved?.id||saved?.profile?.contractorId||''}const saved=JSON.parse(localStorage.getItem('teraju.homeowner.github.v1')||'null');return saved?.homeownerId||saved?.id||saved?.profile?.homeownerId||''}catch{return ''}})()).trim().toUpperCase();
  if(!role||!id)return;
  try{
   const response=await fetch('https://terajuciptabina.vercel.app/api/auth?role='+encodeURIComponent(role)+'&id='+encodeURIComponent(id),{cache:'no-store',credentials:'omit'});
   if(!response.ok)return;
   const account=await response.json();
   const code=String(account?.country||account?.countryCode||'MY').trim().toUpperCase();
   if(!CURRENCIES[code])return;
   const ctx=normalize({countryCode:code,projectId:params.get('projectId')||params.get('quotationId')||'',source:'account-api'});
   window.TERAJU_PROJECT_COUNTRY=ctx;
   safeWrite(ctx);
   window.dispatchEvent(new CustomEvent('teraju:countrychange',{detail:ctx}));
   await applyCountryRates();
  }catch(error){console.error('[TERAJU] Unable to resolve account country:',error)}
 }

 window.TERAJU_COUNTRIES=CURRENCIES;
 window.TERAJU_GET_PROJECT_COUNTRY=current;
 window.TERAJU_SET_PROJECT_COUNTRY=set;
 window.TERAJU_FORMAT_CURRENCY=format;
 window.TERAJU_FORMAT_NUMBER=formatNumber;
 function applyCurrencyLabels(){const ctx=current(),symbol=ctx.symbol;document.querySelectorAll('th,td,span,p,label,div,strong,b').forEach(el=>{if(el.children.length)return;const t=el.textContent;if(!t)return;const next=t.replace(/Rate \(RM\)/g,'Rate ('+symbol+')').replace(/Amount \(RM\)/g,'Amount ('+symbol+')').replace(/RM\/sqft: RM /g,symbol+'/sqft: '+symbol+' ').replace(/Existing: RM /g,'Existing: '+symbol+' ').replace(/New: RM /g,'New: '+symbol+' ').replace(/\bRM\b/g,symbol);if(next!==t)el.textContent=next});let style=document.getElementById('tc-country-currency-labels');if(!style){style=document.createElement('style');style.id='tc-country-currency-labels';document.head.appendChild(style)}style.textContent='#constructionBudgetSection .cr-budget-table tbody tr:not(.cr-group-row):not(.cr-hierarchy-row) td:nth-child(5)::before{content:"Rate ('+symbol+')"}#constructionBudgetSection .cr-budget-table tbody tr:not(.cr-group-row):not(.cr-hierarchy-row) td:nth-child(6)::before{content:"Amount ('+symbol+')"}'}
 let currencyObserver=null;function watchCurrencyLabels(){applyCurrencyLabels();if(currencyObserver)return;currencyObserver=new MutationObserver(()=>{if(!window.__TERAJU_CURRENCY_LABELS_PENDING){window.__TERAJU_CURRENCY_LABELS_PENDING=true;queueMicrotask(()=>{window.__TERAJU_CURRENCY_LABELS_PENDING=false;applyCurrencyLabels()})}});currencyObserver.observe(document.body,{subtree:true,childList:true,characterData:true})}
 window.addEventListener('teraju:countrychange',applyMarketExperience);window.addEventListener('teraju:countrychange',applyCurrencyLabels);window.addEventListener('teraju:ratechange',applyCurrencyLabels);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchCurrencyLabels,{once:true});else watchCurrencyLabels();
 window.TERAJU_GET_COUNTRY_RATE=rateById;
 window.TERAJU_GET_COUNTRY_RATE_DATA=loadRates;
 window.TERAJU_PROJECT_COUNTRY=current();
 hydrateAccountCountry();
})();