(() => {
  'use strict';
  if (window.__tcQuotationRecordsLoaded) return;
  window.__tcQuotationRecordsLoaded = true;

  const API_BASE = 'https://terajuciptabina.vercel.app';
  const params = new URLSearchParams(location.search);
  const plannerType = /renovationplanner\.html?$/i.test(location.pathname) ? 'renovation' : ((params.get('plannerType') || 'build').toLowerCase() === 'renovation' ? 'renovation' : 'build');
  const role = (params.get('audience') || document.body.dataset.role || 'homeowner').toLowerCase() === 'contractor' ? 'contractor' : 'homeowner';
  const idKey = role === 'contractor' ? 'contractorId' : 'homeownerId';
  const storageKey = `teraju.${role}.github.v1`;
  let activeId = (params.get(idKey) || '').trim().toUpperCase();
  let currentQuotationId = params.get('quotationId') || '';
  let currentQuotationNumber = '';
  let restoring = false;

  function localAccount() { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } }
  if (!activeId) activeId = String(localAccount()?.[idKey] || '').trim().toUpperCase();
  if (!activeId) return;

  function apiUrl() { return `${API_BASE}/api/quotations`; }
  async function request(method, body) {
    let url = apiUrl();
    if (method === 'GET') url += `?role=${encodeURIComponent(role)}&id=${encodeURIComponent(activeId)}&plannerType=${encodeURIComponent(plannerType)}`;
    const response = await fetch(url, { method, headers: body ? {'Content-Type':'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    if (!response) throw new Error('Unable to reach the quotation service.');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Quotation request failed.');
    return data;
  }
  function mapEntries(map) { return map instanceof Map ? [...map.entries()] : []; }
  function snapshotPlanner() {
    const rooms = [...document.querySelectorAll('#roomsContainer .room-card')].map(room => ({id:room.id,type:room.querySelector('.room-type')?.value||'other',name:room.querySelector('.room-name')?.value||'',area:room.querySelector('.room-area')?.value||''}));
    return {customerName:document.getElementById('customerName')?.value||'',projectLocation:document.getElementById('projectLocation')?.value||'',builtUpArea:document.getElementById('builtUpArea')?.value||'',rooms,rates:typeof RATES!=='undefined'?{...RATES}:{},customRates:typeof customRates!=='undefined'?mapEntries(customRates):[],customQuantities:typeof customQuantities!=='undefined'?mapEntries(customQuantities):[],customDescriptions:typeof customDescriptions!=='undefined'?mapEntries(customDescriptions):[],customRoomLabels:typeof customRoomLabels!=='undefined'?mapEntries(customRoomLabels):[],excludedItems:typeof excludedItems!=='undefined'?[...excludedItems]:[],manualItems:typeof manualItems!=='undefined'?[...manualItems.entries()]:[],standardRateItems:typeof standardRateItems!=='undefined'?[...standardRateItems]:[],quotationType:document.querySelector('input[name="quotationType"]:checked')?.value||'simple'};
  }
  function currentTotal(){try{return Number(getCurrentQuotationData()?.total||0)}catch{return Number(document.getElementById('grandTotal')?.textContent?.replace(/[^0-9.-]/g,'')||0)}}
  function buildQuotationRecord(){
    const type=document.querySelector('input[name="quotationType"]:checked')?.value||'simple';
    const customer=document.getElementById('customerName')?.value?.trim()||'Not specified';
    const location=document.getElementById('projectLocation')?.value?.trim()||'Not specified';
    const now=new Date().toISOString();
    const prefix=plannerType==='renovation'?'QT-REN':'QT-BLD';
    const fallbackNumber=plannerType==='renovation'?`NR-QO${Date.now().toString().slice(-4)}`:`NB-QO${Date.now().toString().slice(-4)}`;
    const qId=currentQuotationId||`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const qNumber=currentQuotationNumber||(typeof quotationNumber!=='undefined'&&quotationNumber?quotationNumber:fallbackNumber);
    const plannerState=snapshotPlanner();
    return {schemaVersion:1,recordType:'quotation',quotationId:qId,quotationNumber:qNumber,plannerType,role,[idKey]:activeId,state:'final',quotationType:type,client:{name:customer},project:{location,builtUpArea:Number(plannerState.builtUpArea)||0},total:Number(currentTotal().toFixed(2)),plannerState,createdAt:now,updatedAt:now};
  }
  function injectStyles(){
    if(document.getElementById('tc-quotation-records-style'))return;
    const style=document.createElement('style');style.id='tc-quotation-records-style';style.textContent=`
      .tc-quotation-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}.tc-quotation-btn{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:11px;padding:9px 13px;font-size:12px;font-weight:700;cursor:pointer;transition:.18s ease;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:42px}.tc-quotation-btn:hover{background:#f8fafc;border-color:#9ca3af;transform:translateY(-1px)}.tc-quotation-btn.primary{background:#111827;color:#fff;border-color:#111827}.tc-quotation-btn.primary:hover{background:#000}.tc-quotation-status{font-size:12px;color:#6b7280;min-height:18px}.tc-quotation-toast{position:fixed;right:18px;bottom:18px;z-index:10000;background:#111827;color:#fff;padding:12px 15px;border-radius:12px;box-shadow:0 14px 35px rgba(0,0,0,.2);font-size:13px;font-weight:700;opacity:0;transform:translateY(10px);pointer-events:none;transition:.2s ease}.tc-quotation-toast.show{opacity:1;transform:none}@media(max-width:767px){.tc-quotation-tools{display:grid;grid-template-columns:1fr 1fr}.tc-quotation-btn{width:100%}.tc-quotation-tools .tc-quotation-status{grid-column:1/-1}}`;
    document.head.appendChild(style);
  }
  function toast(message,error=false){let el=document.getElementById('tcQuotationToast');if(!el){el=document.createElement('div');el.id='tcQuotationToast';el.className='tc-quotation-toast';document.body.appendChild(el)}el.textContent=message;el.style.background=error?'#991b1b':'#111827';el.classList.add('show');clearTimeout(el.__timer);el.__timer=setTimeout(()=>el.classList.remove('show'),2400)}
  function quotationsUrl(){return `quotations.html?role=${encodeURIComponent(role)}&id=${encodeURIComponent(activeId)}&plannerType=${encodeURIComponent(plannerType)}`;}
  function addPlannerControls(){
    injectStyles();
    const header=document.querySelector('header > div');
    if(header&&!document.getElementById('tcMyQuotations')){const link=document.createElement('a');link.id='tcMyQuotations';link.className='tc-quotation-btn';link.href=quotationsUrl();link.textContent='My Quotations';header.appendChild(link)}
    const actions=document.getElementById('quotationPrintActions');
    if(actions&&!document.getElementById('tcSaveQuotation')){const wrap=document.createElement('div');wrap.className='tc-quotation-tools';wrap.innerHTML=`<button id="tcSaveQuotation" type="button" class="tc-quotation-btn primary">Save Quotation</button><a class="tc-quotation-btn" href="${quotationsUrl()}">My Quotations</a><span id="tcQuotationStatus" class="tc-quotation-status"></span>`;actions.insertBefore(wrap,actions.firstChild);document.getElementById('tcSaveQuotation').addEventListener('click',()=>saveQuotation(true))}
  }
  async function saveQuotation(showMessage=false){
    if(restoring||!document.getElementById('quotationDocument')||document.getElementById('quotationDocument').classList.contains('hidden'))return;
    const record=buildQuotationRecord();currentQuotationId=record.quotationId;currentQuotationNumber=record.quotationNumber;const button=document.getElementById('tcSaveQuotation'),status=document.getElementById('tcQuotationStatus');if(button){button.disabled=true;button.textContent='Saving…'}if(status)status.textContent='Saving quotation…';
    try{await request('PUT',{role,id:activeId,plannerType,quotation:record});const url=new URL(location.href);url.searchParams.set('quotationId',currentQuotationId);history.replaceState({},'',url.toString());if(showMessage)toast('Quotation saved successfully.');if(status)status.textContent=`Saved ${new Date().toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit'})}`}catch(error){if(showMessage)toast(error.message||'Unable to save quotation.',true);if(status)status.textContent='Save failed';console.error(error)}finally{if(button){button.disabled=false;button.textContent='Save Quotation'}}
  }
  function wrapGenerate(){
    if(typeof window.generateQuotation!=='function'||window.generateQuotation.__tcWrapped)return false;
    const original=window.generateQuotation;const wrapped=function(){const result=original.apply(this,arguments);if(result!==false){currentQuotationNumber=typeof quotationNumber!=='undefined'?quotationNumber:currentQuotationNumber;setTimeout(()=>saveQuotation(false),250)}return result};wrapped.__tcWrapped=true;wrapped.__tcOriginal=original;window.generateQuotation=wrapped;return true;
  }
  function setRoomField(room,selector,value){const el=room?.querySelector(selector);if(el&&value!==undefined)el.value=value;}
  function restoreSnapshot(state){
    if(!state)return;restoring=true;
    try{
      if(document.getElementById('customerName'))document.getElementById('customerName').value=state.customerName||'';
      if(document.getElementById('projectLocation'))document.getElementById('projectLocation').value=state.projectLocation||'';
      if(document.getElementById('builtUpArea'))document.getElementById('builtUpArea').value=state.builtUpArea||'';
      if(typeof RATES!=='undefined')RATES={...RATES,...(state.rates||{})};
      if(typeof restoreMap==='function'){restoreMap(customRates,state.customRates);restoreMap(customQuantities,state.customQuantities);restoreMap(customDescriptions,state.customDescriptions);restoreMap(customRoomLabels,state.customRoomLabels)}
      if(typeof excludedItems!=='undefined'){excludedItems.clear();(state.excludedItems||[]).forEach(x=>excludedItems.add(x))}
      if(typeof manualItems!=='undefined'){manualItems.clear();(state.manualItems||[]).forEach(([k,v])=>manualItems.set(k,v))}
      if(typeof standardRateItems!=='undefined')standardRateItems=Array.isArray(state.standardRateItems)?state.standardRateItems:[];
      const container=document.getElementById('roomsContainer');if(container)container.innerHTML='';
      let previousCount=typeof roomCounter!=='undefined'?Number(roomCounter)||0:0;
      (state.rooms||[]).forEach(roomData=>{
        if(typeof addRoom!=='function')return;
        const before=container?[...container.querySelectorAll('.room-card')]:[];
        addRoom(roomData.type||'other');
        const after=container?[...container.querySelectorAll('.room-card')]:[];
        const room=after.length>before.length?after[after.length-1]:null;
        if(!room)return;
        const savedId=roomData.id||room.id;room.id=savedId;
        setRoomField(room,'.room-type',roomData.type||'other');setRoomField(room,'.room-name',roomData.name||'');setRoomField(room,'.room-area',roomData.area||'');
      });
      if(typeof roomCounter!=='undefined'){const ids=[...(container?.querySelectorAll('.room-card')||[])].map(x=>x.id);const maxSuffix=ids.reduce((m,id)=>Math.max(m,Number((String(id).match(/(\d+)$/)||[])[1])||0),0);roomCounter=Math.max(previousCount,maxSuffix,ids.length)}
      const q=document.querySelector(`input[name="quotationType"][value="${state.quotationType==='detail'?'detail':'simple'}"]`);if(q){q.checked=true;q.dispatchEvent(new Event('change',{bubbles:true}))}
      if(typeof updateRoomsEmptyState==='function')updateRoomsEmptyState();if(typeof updateEstimate==='function')updateEstimate();
    }finally{restoring=false}
  }
  async function loadQuotationForEdit(){
    if(!currentQuotationId)return;
    try{const data=await request('GET');const quotation=(data.quotations||[]).find(item=>item?.quotationId===currentQuotationId);if(!quotation){toast('Quotation record not found.',true);return}currentQuotationNumber=quotation.quotationNumber||'';restoreSnapshot(quotation.plannerState);const type=quotation.quotationType||quotation.plannerState?.quotationType||'simple';const input=document.querySelector(`input[name="quotationType"][value="${type}"]`);if(input){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))}toast(`Quotation ${currentQuotationNumber||currentQuotationId} loaded.`)}catch(error){console.error(error);toast(error.message||'Unable to load quotation.',true)}
  }
  function init(){
    if(!document.getElementById('quotationGenerator'))return;injectStyles();addPlannerControls();if(!wrapGenerate())setTimeout(wrapGenerate,500);if(currentQuotationId)setTimeout(loadQuotationForEdit,900);const observer=new MutationObserver(()=>{addPlannerControls();wrapGenerate()});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),20000);
  }
  window.tcQuotationRecords={saveQuotation,loadQuotationForEdit};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
