(function(){
  'use strict';

  const API='https://photon.komoot.io/api/';
  const MIN_CHARS=2;
  const DEBOUNCE_MS=450;
  const CACHE_TTL=10*60*1000;
  const cache=new Map();
  let timer=null;
  let controller=null;

  function escapeHtml(value){
    return String(value??'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function labelForFeature(feature){
    const p=feature?.properties||{};
    const parts=[];
    if(p.name) parts.push(p.name);
    if(p.street && p.street!==p.name) parts.push(p.street);
    if(p.housenumber) parts.push(p.housenumber);
    const locality=p.locality||p.district||p.city||p.county;
    if(locality && !parts.includes(locality)) parts.push(locality);
    if(p.state && !parts.includes(p.state)) parts.push(p.state);
    if(p.country && !parts.includes(p.country)) parts.push(p.country);
    if(p.postcode && !parts.includes(p.postcode)) parts.push(p.postcode);
    return parts.join(', ') || feature?.properties?.name || 'Location';
  }

  function shortLabel(feature){
    const p=feature?.properties||{};
    const title=p.name || p.street || p.city || p.state || 'Location';
    const sub=[p.city,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
    return {title,sub};
  }

  function injectStyles(){
    if(document.getElementById('tc-location-autocomplete-style')) return;
    const style=document.createElement('style');
    style.id='tc-location-autocomplete-style';
    style.textContent=`
      .tc-location-wrap{position:relative}
      .tc-location-results{position:absolute;z-index:5000;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 14px 35px rgba(0,0,0,.12);overflow:hidden;display:none}
      .tc-location-results.show{display:block}
      .tc-location-item{display:block;width:100%;min-height:0!important;text-align:left;background:#fff;border:0;border-bottom:1px solid #f1f5f9;padding:11px 13px;cursor:pointer}
      .tc-location-item:hover,.tc-location-item:focus{background:#f8fafc;outline:none}
      .tc-location-title{font-size:14px;font-weight:600;color:#111827;line-height:1.35}
      .tc-location-sub{font-size:12px;color:#6b7280;margin-top:3px;line-height:1.3}
      .tc-location-footer{font-size:10px;color:#6b7280;padding:7px 11px;background:#f9fafb;text-align:right}
      .tc-location-empty{font-size:13px;color:#6b7280;padding:12px 13px}
    `;
    document.head.appendChild(style);
  }

  function closeAll(except){
    document.querySelectorAll('.tc-location-results.show').forEach(el=>{
      if(el!==except){el.classList.remove('show');el.innerHTML='';}
    });
  }

  function renderResults(input,box,features){
    if(!features.length){
      box.innerHTML='<div class="tc-location-empty">No matching location found.</div><div class="tc-location-footer">Powered by OpenStreetMap</div>';
      box.classList.add('show');
      return;
    }
    box.innerHTML=features.map((feature,index)=>{
      const s=shortLabel(feature);
      return `<button type="button" class="tc-location-item" data-index="${index}"><div class="tc-location-title">${escapeHtml(s.title)}</div><div class="tc-location-sub">${escapeHtml(s.sub||labelForFeature(feature))}</div></button>`;
    }).join('')+'<div class="tc-location-footer">Powered by OpenStreetMap</div>';
    box.classList.add('show');
    box.querySelectorAll('.tc-location-item').forEach(btn=>btn.addEventListener('click',function(){
      const feature=features[Number(this.dataset.index)];
      input.value=labelForFeature(feature);
      input.dataset.locationSelected='true';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      closeAll();
    }));
  }

  async function search(input,box,query){
    const key=query.toLowerCase();
    const cached=cache.get(key);
    if(cached && Date.now()-cached.time<CACHE_TTL){renderResults(input,box,cached.features);return;}
    if(controller) controller.abort();
    controller=new AbortController();
    box.innerHTML='<div class="tc-location-empty">Searching locations…</div>';
    box.classList.add('show');
    try{
      const url=new URL(API);
      url.searchParams.set('q',query+', Malaysia');
      url.searchParams.set('countrycode','MY');
      url.searchParams.set('limit','6');
      url.searchParams.set('lang','en');
      const response=await fetch(url.toString(),{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok) throw new Error('Location search unavailable');
      const data=await response.json();
      const features=Array.isArray(data.features)?data.features:[];
      cache.set(key,{time:Date.now(),features});
      renderResults(input,box,features);
    }catch(error){
      if(error.name==='AbortError') return;
      box.innerHTML='<div class="tc-location-empty">Location search is temporarily unavailable. You can still type the location manually.</div>';
      box.classList.add('show');
    }
  }

  function attach(input){
    if(!input || input.dataset.tcLocationReady==='true') return;
    input.dataset.tcLocationReady='true';
    input.setAttribute('autocomplete','off');
    const wrap=document.createElement('div');
    wrap.className='tc-location-wrap';
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    const box=document.createElement('div');
    box.className='tc-location-results';
    box.setAttribute('role','listbox');
    wrap.appendChild(box);

    input.addEventListener('input',function(){
      input.dataset.locationSelected='false';
      const query=input.value.trim();
      clearTimeout(timer);
      if(query.length<MIN_CHARS){closeAll();return;}
      timer=setTimeout(()=>search(input,box,query),DEBOUNCE_MS);
    });
    input.addEventListener('focus',function(){
      if(input.value.trim().length>=MIN_CHARS) input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    document.addEventListener('click',function(e){if(!wrap.contains(e.target))box.classList.remove('show');});
  }

  function init(){
    injectStyles();
    document.querySelectorAll('#projectLocation').forEach(attach);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

// Shared quotation document engine bootstrap. This is deliberately external to the planner bases.
(function(){
  const script=document.createElement('script');
  script.src='quotation-document-engine.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// Shared planner Add Item placement.
// Each existing Add Item control is moved to the bottom of its own rendered group.
// No extra CSS or duplicate control is introduced.
(function(){
  'use strict';

  function targetFromButton(button){
    const match=String(button?.getAttribute('onclick')||'').match(/addManualItemPrompt\(['\"]([^'\"]+)['\"]\)/);
    return match?match[1]:'';
  }

  function isBottomAnchor(anchor){
    return anchor?.getAttribute('data-tc-add-bottom')==='true';
  }

  function makeBottomRow(target){
    const row=document.createElement('tr');
    row.className='no-print';
    row.innerHTML=`<td colspan="6" class="py-2 px-2"><div data-manual-anchor="${target}" data-tc-add-bottom="true"><button type="button" class="border rounded-lg px-3 py-2 text-xs font-semibold hover:bg-gray-50">＋ Add Item</button></div></td>`;
    return row;
  }

  function findBottomBoundary(sourceRow){
    let row=sourceRow?.nextElementSibling||null;
    while(row){
      if(row.classList?.contains('quotation-section-row') || row.classList?.contains('quotation-subsection-row')) return row;
      if(/^Subtotal\s*(?:-|:)?/i.test((row.textContent||'').trim())) return row;
      row=row.nextElementSibling;
    }
    return null;
  }

  function bindButton(button,target){
    if(!button || button.dataset.tcAddBound==='true') return;
    button.dataset.tcAddBound='true';
    button.removeAttribute('onclick');
    button.addEventListener('click',function(){
      const anchor=button.closest('[data-tc-add-bottom="true"]');
      if(!anchor || typeof window.addManualItemPrompt!=='function') return;
      const existing=document.getElementById(`manual-add-${target}`);
      if(existing){
        if(existing.parentElement===anchor) existing.remove();
        else anchor.appendChild(existing);
        return;
      }
      const anchors=[...document.querySelectorAll(`[data-tc-add-bottom="true"][data-manual-anchor="${target}"]`)];
      anchors.forEach(a=>{if(a!==anchor)a.removeAttribute('data-manual-anchor')});
      window.addManualItemPrompt(target);
      anchors.forEach(a=>a.setAttribute('data-manual-anchor',target));
    });
  }

  function placeButton(button,target){
    const sourceRow=button.closest('tr');
    if(!sourceRow) return;
    const bottomRow=makeBottomRow(target);
    const boundary=findBottomBoundary(sourceRow);
    button.remove();
    if(boundary) boundary.parentNode.insertBefore(bottomRow,boundary);
    else sourceRow.parentNode.insertBefore(bottomRow,sourceRow.nextSibling);
    bindButton(bottomRow.querySelector('button'),target);
    sourceRow.querySelector('[data-manual-anchor]')?.removeAttribute('data-manual-anchor');
  }

  function standardizeAddItems(){
    const estimate=document.getElementById('estimateContent');
    if(!estimate || !document.body.classList.contains('contractor-mode')) return;
    estimate.querySelectorAll('table').forEach(table=>{
      const buttons=[...table.querySelectorAll('button[onclick*="addManualItemPrompt"]')]
        .filter(button=>!isBottomAnchor(button.closest('[data-tc-add-bottom]')));
      buttons.forEach(button=>{
        const target=targetFromButton(button);
        if(target) placeButton(button,target);
      });
    });
  }

  function hook(){
    const original=window.updateEstimate;
    if(typeof original==='function' && !original.__tcAddItemHooked){
      const wrapped=function(){
        const result=original.apply(this,arguments);
        standardizeAddItems();
        return result;
      };
      wrapped.__tcAddItemHooked=true;
      window.updateEstimate=wrapped;
    }
    standardizeAddItems();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,0),{once:true});
  else setTimeout(hook,0);
})();
