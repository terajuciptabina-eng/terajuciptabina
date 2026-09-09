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

      /* Planner estimate summary: put the summary values under Amount (column 5), not Delete (column 6). */
      .estimate-summary-grid{display:grid!important;grid-template-columns:32% 8% 13% 15% 20% 12%;align-items:center;row-gap:6px;font-size:14px}
      .estimate-summary-grid .estimate-summary-row{display:contents}
      .estimate-summary-grid .estimate-summary-label{grid-column:1 / 5;font-weight:600}
      .estimate-summary-grid .estimate-summary-value{grid-column:5;text-align:right;font-weight:700;white-space:nowrap}
      @media(max-width:767px){
        .estimate-summary-grid{grid-template-columns:31% 7% 12% 15% 20% 15%;font-size:8px;row-gap:5px}
        .estimate-summary-grid .estimate-summary-label{grid-column:1 / 5}
        .estimate-summary-grid .estimate-summary-value{grid-column:5;text-align:right}
      }
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

// Shared quotation history bootstrap. Loaded here so the stable planner HTML bases remain untouched.
(function(){
  const script=document.createElement('script');
  script.src='quotation-records.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();
