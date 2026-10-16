/* TERAJU WORKS — account-market country/currency context.
 * Market is fixed by the registered account. Project/session state cannot override it.
 * Malaysia retains its state-based rate resolver; other markets use their own validated rate field.
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
 window.TERAJU_ACCOUNT_MARKET_VERIFIED=false;
 function safeRead(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
 function safeWrite(value){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(value))}catch{}}
 function countryCode(value){const c=String(value||'').trim().toUpperCase();return CURRENCIES[c]?c:''}
 function normalize(raw){const code=countryCode(raw?.countryCode||raw?.country||raw?.code);return {...(CURRENCIES[code]||{}),countryCode:code,projectId:String(raw?.projectId||params.get('projectId')||params.get('quotationId')||''),source:raw?.source||'session'} }
 function current(){const accountCode=accountCountry();const activeProject=String(params.get('projectId')||params.get('quotationId')||'');const existing=window.TERAJU_PROJECT_COUNTRY;if(existing&&countryCode(existing.countryCode||existing.country)===accountCode)return normalize(existing);return normalize({countryCode:accountCode,projectId:activeProject,source:'account-default'})}
 function set(raw){const next=normalize({...raw,countryCode:accountCountry(),projectId:raw?.projectId||current().projectId});window.TERAJU_PROJECT_COUNTRY=next;safeWrite(next);window.dispatchEvent(new CustomEvent('teraju:countrychange',{detail:next}));return next}
 function formatNumber(value,options={}){const c=current();return new Intl.NumberFormat(c.locale,{minimumFractionDigits:options.minimumFractionDigits??2,maximumFractionDigits:options.maximumFractionDigits??2}).format(Number(value)||0)}
 function format(value,options={}){if(window.TERAJU_ACCOUNT_MARKET_VERIFIED!==true)return '—';const c=current();if(!c.currency)return '—';return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:options.minimumFractionDigits??2,maximumFractionDigits:options.maximumFractionDigits??2}).format(Number(value)||0)}
 async function loadRates(){if(!dataPromise)dataPromise=fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unable to load country rate comparison data');return r.json()});return dataPromise}
 async function rateById(id, snapshot){if(window.TERAJU_ACCOUNT_MARKET_VERIFIED!==true)throw new Error('Registered account country must be verified before resolving rates.');const accountCode=accountCountry();const ctx=current();if(!accountCode||ctx.countryCode!==accountCode)throw new Error('Registered account market context is invalid.');const data=await loadRates();const item=data.rates.find(x=>x.id===id);if(!item)return null;const rateField=ctx.countryCode==='MY'?'Malaysia_MYR':ctx.currency;const rawRate=item[rateField];if(rawRate===null||rawRate===undefined||String(rawRate).trim()==='')throw new Error('No rate value available for '+ctx.countryCode+' item '+id);const rate=Number(rawRate);if(!Number.isFinite(rate)||rate<0)throw new Error('No rate value available for '+ctx.countryCode+' item '+id);return {id:item.id,rate,currency:ctx.currency,countryCode:ctx.countryCode,planner:item.planner,rateStatus:ctx.countryCode==='MY'?'baseline':'estimated',provisional:ctx.countryCode!=='MY'} }
 const RENOVATION_RATE_KEYS={plaster_ceiling:'ceiling',spc_flooring:'spc',downlight:'downlight',ceiling_fan:'ceilingFan',curtain_box_led:'curtainBoxLED',bar_lamp:'barLamp',kitchen_frame:'kitchenFrame',making_good:'kitchenMakingGood',swing_glass_door:'kitchenGlassDoor',floor_tiles:'floorTile',wall_tiles:'wallTile',kitchen_lighting:'barLamp',sanitary_accessories:'bathroomSanitary',toilet_door:'bathroomDoor',exhaust_fan:'exhaustFan',gate_motor:'gateMotor',brickwall_divider:'brickwallDivider',front_fence:'frontFence',facade_wall:'facadeWall',wall_light:'wallLight'};
 const BUILD_RATE_KEYS={building_plan_submission:'permit',site_mobilisation_project_management:'prelim',footing_concrete:'footingConc',footing_formwork:'footingFw',footing_rebar:'footingRebar',ground_slab_concrete:'slabConc',ground_slab_brc:'slabBrc',ground_beam_concrete:'beamConc',ground_beam_formwork:'beamFw',ground_beam_rebar:'beamRebar',roof_beam_concrete:'beamConc',roof_beam_formwork:'beamFw',roof_beam_rebar:'beamRebar',column_concrete:'colConc',column_formwork:'colFw',column_rebar:'colRebar',flat_roof_concrete:'flatRoofConc',flat_roof_formwork:'flatRoofFw',flat_roof_brc:'flatRoofBrc',roof_metal_roofing_sheet:'metalSheet',apron_concrete:'apronConc',apron_formwork:'apronFw',apron_brc:'apronBrc',drainage:'drainage',brickwall_internal_wall:'brickwallInt',brickwall_external_wall:'brickwallExt',floor_tiles_internal:'floorTileInt',floor_tiles_external:'floorTileExt',painting_internal:'paintInt',painting_external:'paintExt',ceiling_internal:'ceilingInt',ceiling_external:'ceilingExt',bathroom_wall_tiles:'bathWallTile',bathroom_floor_tiles:'bathFloorTile',bathroom_ceiling:'bathCeiling',bathroom_piping:'bathPiping',bathroom_wc:'bathWc',bathroom_basin:'bathBasin',bathroom_shower:'bathShower',bathroom_tap:'bathTap',water_tank:'waterTank',septic_tank:'septicTank',power_point:'powerPoint',switch:'switch',lighting:'lighting',fan:'fan',aircond_point:'aircond',porch_lighting:'lighting',porch_fan:'fan',porch_power_point:'powerPoint',earthing:'earthing',db_box:'dbBox',wiring:'wiring',doors_type_1_single_leaf:'door',doors_type_2_sliding:'door',doors_type_3_bathroom:'door',doors_type_4_double_leaf_main_door:'door',windows_type_1_1200_1200:'window',windows_type_2_1800_1200:'window',windows_type_3_900_600:'window',boundary_fencing:'boundaryFence',gate:'gate',driveway:'driveway',landscaping:'landscaping'};
 function canonicalBuildAlias(id){const token=String(id||'').replace(/^rule_/,'').replace(/_\d+$/,'');const keys=Object.keys(BUILD_RATE_KEYS).sort((a,b)=>b.length-a.length);const match=keys.find(key=>token===key||token.endsWith('_'+key));return match?BUILD_RATE_KEYS[match]:null;}

 let baseRates=null,applying=false,rateRefreshQueued=false,accountMarketReady=false;
 async function applyCountryRates(){
  // Account API hydration can finish while the initial (cached/default) market is still applying.
  // Queue a second pass instead of silently dropping the authoritative account market.
  const roleCheck=String(params.get('role')||params.get('audience')||window.TERAJU_WORKSPACE_CONTEXT?.role||'').toLowerCase();
  const idCheck=String(params.get('id')||params.get('contractorId')||params.get('homeownerId')||'').trim();
  if(!accountMarketReady)return; // Never apply rates before API verification of the registered account market.
  if(applying){rateRefreshQueued=true;return;}applying=true;
  try{
   const ctx=current(),data=await loadRates();
   if(typeof RATES==='undefined'||!RATES||typeof RATES!=='object')return;
   const selected=data.rates.filter(x=>x.planner===plannerType);
   if(selected.length!==(plannerType==='build'?82:40))throw new Error('Country rate set failed planner-count validation.');
   if(!baseRates){
    baseRates={...RATES};
    // Keep a deterministic baseline for comparison records not yet consumed by a planner control.
    selected.forEach(item=>{
     if(plannerType!=='build')return;
     const alias=canonicalBuildAlias(item.id);
     if(!alias)throw new Error('No BuildPlanner rate-key mapping for '+item.id);
     if(!Object.prototype.hasOwnProperty.call(baseRates,alias)){
      const baseline=Number(item.Malaysia_MYR);
      if(!Number.isFinite(baseline)||baseline<0)throw new Error('Missing Malaysia baseline rate for '+item.id);
      baseRates[alias]=baseline;
     }
    });
   }
   if(ctx.countryCode==='MY'){
    document.getElementById('tc-country-rate-status')?.remove();
    Object.assign(RATES,baseRates);
    window.TERAJU_RATE_CONTEXT={countryCode:'MY',currency:'MYR',name:'Malaysia',source:'data/rates/default.json',rateStatus:'baseline'};
    window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
    if(typeof window.TERAJU_RESOLVE_RATE==='function')await window.TERAJU_RESOLVE_RATE();
    else if(typeof updateEstimate==='function')updateEstimate();
    return;
   }
   const mappedBuildRates={};
   for(const item of selected){
    const rateField=ctx.countryCode==='MY'?'Malaysia_MYR':ctx.currency;const rawValue=item[rateField];if(rawValue===null||rawValue===undefined||String(rawValue).trim()==='')throw new Error('Missing '+rateField+' rate for '+item.id);const value=Number(rawValue);if(!Number.isFinite(value)||value<0)throw new Error('Invalid '+rateField+' rate for '+item.id);
    if(plannerType==='build'){
     const alias=canonicalBuildAlias(item.id);if(!alias)throw new Error('No BuildPlanner rate-key mapping for '+item.id);if(!Object.prototype.hasOwnProperty.call(baseRates,alias))throw new Error('Missing BuildPlanner baseline rate key '+alias+' for '+item.id);
     (mappedBuildRates[alias]||(mappedBuildRates[alias]=[])).push(value);
    }else{
     const token=item.id.replace(/^renovation_rule_/,'').replace(/_\d+$/,'');const aliasKey=Object.keys(RENOVATION_RATE_KEYS).sort((a,b)=>b.length-a.length).find(key=>token===key||token.endsWith('_'+key));const alias=aliasKey?RENOVATION_RATE_KEYS[aliasKey]:'';if(!alias)throw new Error('No RenovationPlanner rate-key mapping for '+item.id);if(!Object.prototype.hasOwnProperty.call(baseRates,alias))throw new Error('Missing RenovationPlanner baseline rate key '+alias+' for '+item.id);RATES[alias]=value;
    }
   }
   // BuildPlanner currently exposes generic door/window/roof-sheet rate keys while the
   // comparison table has type-specific rows. Aggregate those rows rather than letting
   // the last item silently overwrite the others; values remain explicitly estimated.
   Object.entries(mappedBuildRates).forEach(([alias,values])=>{RATES[alias]=values.reduce((sum,value)=>sum+value,0)/values.length;});
   window.TERAJU_RATE_CONTEXT={countryCode:ctx.countryCode,currency:ctx.currency,name:ctx.name,source:'country-comparison-2026.json',rateStatus:'estimated',provisional:true};
   let rateNotice=document.getElementById('tc-country-rate-status');
   if(!rateNotice){rateNotice=document.createElement('div');rateNotice.id='tc-country-rate-status';rateNotice.setAttribute('role','status');rateNotice.style.cssText='position:relative;z-index:1000;margin:12px auto;max-width:1180px;padding:12px 16px;border:1px solid #f3d28a;border-radius:12px;background:#fffbeb;color:#854d0e;font:600 13px/1.5 system-ui,sans-serif';const host=document.querySelector('main')||document.body;host.prepend(rateNotice)}
   rateNotice.textContent=ctx.name+' rates are indicative estimates, not verified contractor quotations. Confirm rates with local contractors before making a budget commitment.';
   window.dispatchEvent(new CustomEvent('teraju:ratechange',{detail:window.TERAJU_RATE_CONTEXT}));
   if(typeof updateEstimate==='function')updateEstimate();
  }catch(error){console.error('[TERAJU] Country rate integration failed:',error);window.TERAJU_COUNTRY_RATE_ERROR=String(error?.message||error);const ctx=current();if(ctx.countryCode!=='MY'&&typeof RATES!=='undefined'&&RATES&&typeof RATES==='object'){Object.keys(RATES).forEach(key=>{RATES[key]=NaN});let banner=document.getElementById('tc-country-rate-error');if(!banner){banner=document.createElement('div');banner.id='tc-country-rate-error';banner.setAttribute('role','alert');banner.style.cssText='position:sticky;top:0;z-index:99999;padding:12px 16px;background:#fff1f2;color:#9f1239;border-bottom:1px solid #fecdd3;font:600 14px/1.45 system-ui,sans-serif';banner.textContent='Country rate data is unavailable. Cost estimates are disabled until valid local rates are available.';document.body.prepend(banner)}document.querySelectorAll('button').forEach(button=>{if(/estimate|quotation|generate|export pdf|download pdf/i.test(button.textContent||'')){button.disabled=true;button.setAttribute('aria-disabled','true')}})}}
  finally{applying=false;if(rateRefreshQueued){rateRefreshQueued=false;queueMicrotask(()=>applyCountryRates())}}
 }
 // Keep market-specific location and state UI aligned with the registered account market.
 const MARKET_LOCATIONS={
  MY:['Kuala Lumpur','Selangor','Johor','Penang','Perak','Negeri Sembilan','Melaka','Pahang','Terengganu','Kelantan','Kedah','Perlis','Sabah','Sarawak','Putrajaya','Labuan'],
  SG:['Singapore','Central Region','East Region','North Region','North-East Region','West Region'],
  ID:['Jakarta','Surabaya','Bandung','Medan','Semarang','Yogyakarta','Denpasar','Makassar'],
  TH:['Bangkok','Chiang Mai','Phuket','Pattaya','Nonthaburi','Khon Kaen'],
  PH:['Metro Manila','Quezon City','Cebu City','Davao City','Makati','Taguig','Iloilo City'],
  VN:['Ho Chi Minh City','Hanoi','Da Nang','Hai Phong','Can Tho','Nha Trang'],
  BN:['Bandar Seri Begawan','Kuala Belait','Seria','Tutong','Bangar']
 };
 function applyMarketExperience(){
  const ctx=current(),state=document.getElementById('projectState');
  if(state){
   const wrap=state.closest('label')||state.parentElement;
   if(wrap)wrap.hidden=ctx.countryCode!=='MY';
   if(ctx.countryCode!=='MY'){state.value='';state.disabled=true}else{state.disabled=false}
  }
  const locationInput=document.getElementById('projectLocation'),list=document.getElementById('projectLocationSuggestions');
  if(list){list.replaceChildren();(MARKET_LOCATIONS[ctx.countryCode]||[]).forEach(name=>{const option=document.createElement('option');option.value=name;list.appendChild(option)})}
  if(locationInput&&ctx.countryCode!=='MY'){
   const oldMalaysiaLocation=/\b(malaysia|selangor|kuala lumpur|johor|penang|puchong|putrajaya|sarawak|sabah|kelantan|terengganu|perak|kedah|perlis|melaka|negeri sembilan|pahang|labuan)\b/i;
   if(oldMalaysiaLocation.test(locationInput.value)){locationInput.value='';locationInput.dispatchEvent(new Event('input',{bubbles:true}))}
   locationInput.placeholder='Enter project location';
  }
  if(ctx.countryCode!=='MY'){
   document.querySelectorAll('[data-detailed-price]').forEach(el=>{el.textContent='FREE';el.querySelectorAll('.line-through').forEach(node=>node.remove())});
   document.querySelectorAll('[data-detailed-promo-note]').forEach(el=>{el.textContent='Promotional access is available now. Local service pricing will be shown when published for your market.'});
  }
 }
 // Country is inherited from the signed-in account/project context. Do not inject a second country selector into planners.
 function accountCountry(){
  const roleRaw=String(params.get('role')||params.get('audience')||window.TERAJU_WORKSPACE_CONTEXT?.role||'').toLowerCase();
  const role=roleRaw==='homeowner'||roleRaw==='contractor'?roleRaw:'';
  const roleAccount=role?(()=>{try{return JSON.parse(localStorage.getItem('teraju.'+role+'.github.v1')||'null')}catch{return null}})():null;
  const readCountry=value=>{const raw=value?.country||value?.countryCode||value?.profile?.country||value?.profile?.countryCode;const code=String(raw||'').trim().toUpperCase();return CURRENCIES[code]?code:''};
  // If the URL identifies the workspace role, never borrow the other role's cached country.
  // Missing account country is not evidence that the account belongs to Malaysia; the API gate must verify it.
  if(role&&roleAccount)return readCountry(roleAccount);
  const candidates=[
   window.TERAJU_ACCOUNT,window.TERAJU_USER,window.currentUser,window.userProfile,
   (()=>{try{return JSON.parse(sessionStorage.getItem('teraju.user')||'null')}catch{return null}})(),
   (()=>{try{return JSON.parse(localStorage.getItem('teraju.user')||'null')}catch{return null}})()
  ];
  for(const value of candidates){const code=readCountry(value);if(code)return code}
  return '';
 }

 async function hydrateAccountCountry(){
  const roleRaw=String(params.get('role')||params.get('audience')||window.TERAJU_WORKSPACE_CONTEXT?.role||'').toLowerCase();
  const role=roleRaw==='homeowner'||roleRaw==='contractor'?roleRaw:'';
  const id=String(params.get('id')||params.get('contractorId')||params.get('homeownerId')||window.TERAJU_WORKSPACE_CONTEXT?.id||window.TERAJU_WORKSPACE_CONTEXT?.contractorId||window.TERAJU_WORKSPACE_CONTEXT?.homeownerId||(()=>{try{if(role==='contractor'){const active=localStorage.getItem('teraju.contractor.local.v1.activeContractorId');if(active)return active;const saved=JSON.parse(localStorage.getItem('teraju.contractor.github.v1')||'null');return saved?.contractorId||saved?.id||saved?.profile?.contractorId||''}const saved=JSON.parse(localStorage.getItem('teraju.homeowner.github.v1')||'null');return saved?.homeownerId||saved?.id||saved?.profile?.homeownerId||''}catch{return ''}})()).trim().toUpperCase();
  if(!role||!id){accountMarketReady=false;return false;}
  try{
   const response=await fetch('https://terajuciptabina.vercel.app/api/auth?role='+encodeURIComponent(role)+'&id='+encodeURIComponent(id),{cache:'no-store',credentials:'omit'});
   if(!response.ok)return false;
   const account=await response.json();
   const code=String(account?.country||account?.countryCode||'').trim().toUpperCase();
   if(!CURRENCIES[code])return false;
   // The API record is authoritative. Refresh the role-specific local cache before
   // calling current(), otherwise a stale cached country can override the API result.
   try{
    const cacheKey='teraju.'+role+'.github.v1';
    const cached=JSON.parse(localStorage.getItem(cacheKey)||'null')||{};
    localStorage.setItem(cacheKey,JSON.stringify({...cached,country:code,countryCode:code}));
   }catch(error){console.warn('[TERAJU] Unable to refresh cached account country:',error)}
   const ctx=normalize({countryCode:code,projectId:params.get('projectId')||params.get('quotationId')||'',source:'account-api'});
   window.TERAJU_PROJECT_COUNTRY=ctx;
   accountMarketReady=true;
   window.TERAJU_ACCOUNT_MARKET_VERIFIED=true;
   safeWrite(ctx);
   window.dispatchEvent(new CustomEvent('teraju:countrychange',{detail:ctx}));
   await applyCountryRates();
   return true;
  }catch(error){console.error('[TERAJU] Unable to resolve account country:',error);return false}
 }

 window.TERAJU_COUNTRIES=CURRENCIES;
 window.TERAJU_GET_PROJECT_COUNTRY=current;
 window.TERAJU_SET_PROJECT_COUNTRY=set;
 window.TERAJU_FORMAT_CURRENCY=format;
 window.TERAJU_FORMAT_NUMBER=formatNumber;
 function applyCurrencyLabels(){if(window.TERAJU_ACCOUNT_MARKET_VERIFIED!==true)return;const ctx=current(),symbol=ctx.symbol;document.querySelectorAll('th,td,span,p,label,div,strong,b').forEach(el=>{if(el.children.length)return;const t=el.textContent;if(!t)return;const next=t.replace(/Rate \(RM\)/g,'Rate ('+symbol+')').replace(/Amount \(RM\)/g,'Amount ('+symbol+')').replace(/RM\/sqft: RM /g,symbol+'/sqft: '+symbol+' ').replace(/Existing: RM /g,'Existing: '+symbol+' ').replace(/New: RM /g,'New: '+symbol+' ').replace(/\bRM\b/g,symbol);if(next!==t)el.textContent=next});let style=document.getElementById('tc-country-currency-labels');if(!style){style=document.createElement('style');style.id='tc-country-currency-labels';document.head.appendChild(style)}style.textContent='#constructionBudgetSection .cr-budget-table tbody tr:not(.cr-group-row):not(.cr-hierarchy-row) td:nth-child(5)::before{content:"Rate ('+symbol+')"}#constructionBudgetSection .cr-budget-table tbody tr:not(.cr-group-row):not(.cr-hierarchy-row) td:nth-child(6)::before{content:"Amount ('+symbol+')"}'}
 let currencyObserver=null;function watchCurrencyLabels(){applyCurrencyLabels();if(currencyObserver)return;currencyObserver=new MutationObserver(()=>{if(!window.__TERAJU_CURRENCY_LABELS_PENDING){window.__TERAJU_CURRENCY_LABELS_PENDING=true;queueMicrotask(()=>{window.__TERAJU_CURRENCY_LABELS_PENDING=false;applyCurrencyLabels()})}});currencyObserver.observe(document.body,{subtree:true,childList:true,characterData:true})}
 window.addEventListener('teraju:countrychange',applyMarketExperience);window.addEventListener('teraju:countrychange',applyCurrencyLabels);window.addEventListener('teraju:ratechange',applyCurrencyLabels);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchCurrencyLabels,{once:true});else watchCurrencyLabels();
 window.TERAJU_APPLY_COUNTRY_RATES=applyCountryRates;
 window.TERAJU_GET_COUNTRY_RATE=rateById;
 window.TERAJU_GET_COUNTRY_RATE_DATA=loadRates;
 window.TERAJU_PROJECT_COUNTRY=current();
 const marketGate=document.createElement('div');marketGate.id='tc-country-market-gate';marketGate.setAttribute('role','status');marketGate.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:28px;background:#fff;color:#0f172a;text-align:center;font:600 16px/1.5 system-ui,sans-serif';marketGate.textContent='Verifying registered account market…';document.body.appendChild(marketGate);
 const rolePresent=String(params.get('role')||params.get('audience')||window.TERAJU_WORKSPACE_CONTEXT?.role||'').trim();
 const idPresent=String(params.get('id')||params.get('contractorId')||params.get('homeownerId')||window.TERAJU_WORKSPACE_CONTEXT?.id||window.TERAJU_WORKSPACE_CONTEXT?.contractorId||window.TERAJU_WORKSPACE_CONTEXT?.homeownerId||'').trim();
 hydrateAccountCountry().then(resolved=>{
  if(resolved){document.getElementById('tc-country-market-gate')?.remove();return;}
  const message=rolePresent&&idPresent
   ?'Unable to verify registered account country. Cost estimation remains locked; please sign in again or retry when the account service is available.'
   :'Sign in through a registered workspace to load country-specific rates.';
  window.TERAJU_COUNTRY_CONTEXT_ERROR=message;
  if(typeof RATES!=='undefined'&&RATES&&typeof RATES==='object'){if(!baseRates)baseRates={...RATES};Object.keys(RATES).forEach(key=>{RATES[key]=NaN});if(typeof updateEstimate==='function')updateEstimate();}
  marketGate.setAttribute('role','alert');marketGate.textContent=message;
  document.querySelectorAll('button').forEach(button=>{if(/estimate|quotation|generate|export pdf|download pdf|save cost estimate/i.test(button.textContent||'')){button.disabled=true;button.setAttribute('aria-disabled','true')}});
 });
})();