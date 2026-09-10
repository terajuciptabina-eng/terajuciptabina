// Shared planner bootstrap.
// Project Location is intentionally a normal manual text field.
// No address/postcode autocomplete or external location API is applied here.
(function(){
  'use strict';
  document.querySelectorAll('#projectLocation').forEach(function(input){
    input.removeAttribute('list');
    input.setAttribute('autocomplete','off');
  });
  document.getElementById('projectLocationSuggestions')?.remove();
})();

// State-first quotation flow. This is shared by Build and Renovation Planner.
(function(){
  const script=document.createElement('script');
  script.src='state-rate-gate.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
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

// State/rate metadata bridge. Runs after the quotation history bootstrap and does not alter planner HTML.
(function(){
  const script=document.createElement('script');
  script.src='state-rate-record-bridge.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// Global Rate Schedule protection + contractor custom/override market capture.
(function(){
  const script=document.createElement('script');
  script.src='contractor-master-bridge.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// Build Planner uses one master Rate Schedule for both audiences.
// Homeowner remains read-only; Contractor may edit the same schedule.
// This adapter removes the legacy duplicate contractor database UI/path only.
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const contractor=(params.get('audience')||document.body.dataset.role||'').toLowerCase()==='contractor';
  const isBuild=/buildplanner\.html$/i.test(location.pathname);
  if(!contractor||!isBuild)return;

  function rateKey(item){
    if(!item)return null;
    const id=String(item.id||'');
    const map={
      'prelim-1':'permit','prelim-2':'prelim','elec-db':'dbBox','elec-wiring':'wiring',
      'elec-pp':'powerPoint','elec-switch':'switch','elec-light':'lighting','elec-fan':'fan',
      'elec-ac':'aircond','elec-earth':'earthing'
    };
    if(map[id])return map[id];
    if(typeof STRUCT_GROUPS!=='undefined'){
      for(const group of STRUCT_GROUPS||[]){
        for(const row of group.items||[]){
          if(row.id===id)return row.rateKey;
        }
      }
    }
    if(id.endsWith('-ceiling'))return 'ceilingInt';
    if(id.endsWith('-walltile'))return 'bathWallTile';
    if(id.endsWith('-piping'))return 'bathPiping';
    if(id.endsWith('-wc'))return 'bathWc';
    if(id.endsWith('-basin'))return 'bathBasin';
    if(id.endsWith('-shower'))return 'bathShower';
    if(id.endsWith('-tap'))return 'bathTap';
    if(id.endsWith('-floortile'))return 'floorTileInt';
    if(id.endsWith('-paint'))return 'paintInt';
    if(id.endsWith('-door'))return 'door';
    if(id.endsWith('-window'))return 'window';
    return null;
  }

  function hideAddItemUntilArea(){
    const hasArea=[...document.querySelectorAll('#roomsContainer .room-area')].some(input=>Number(input.value)>0);
    document.querySelectorAll('#estimateContent tr.no-print').forEach(row=>{
      const button=row.querySelector('button');
      if(!button||!/^\+\s*Add Item$/i.test(button.textContent.trim()))return;
      row.hidden=!hasArea;
    });
  }

  function wrapEstimate(){
    if(typeof window.updateEstimate!=='function'||window.updateEstimate.__terajuBuildAddItemGate)return false;
    const original=window.updateEstimate;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      try{hideAddItemUntilArea();}catch(_){}
      return result;
    };
    wrapped.__terajuBuildAddItemGate=true;
    window.updateEstimate=wrapped;
    return true;
  }

  function enforce(){
    const section=document.getElementById('rateScheduleSection');
    section?.classList.remove('hidden');
    document.getElementById('contractorItemDatabase')?.remove();
    if(typeof window.getAllItems==='function'&&!window.getAllItems.__terajuUnifiedBuildRate){
      const original=window.getAllItems;
      const wrapped=function(){
        const items=original.apply(this,arguments);
        const result=(Array.isArray(items)?items:[]).filter(item=>item?.category!=='Additional Contractor Item');
        result.forEach(item=>{
          const key=rateKey(item);
          if(key&&typeof RATES!=='undefined'&&Object.prototype.hasOwnProperty.call(RATES,key))item.rate=Number(RATES[key])||0;
          item.amount=(Number(item.qty)||0)*(Number(item.rate)||0);
        });
        return result;
      };
      wrapped.__terajuUnifiedBuildRate=true;
      window.getAllItems=wrapped;
    }
    wrapEstimate();
    try{hideAddItemUntilArea();}catch(_){}
  }

  let tries=0;
  const timer=setInterval(()=>{
    enforce();
    tries+=1;
    if(tries>40)clearInterval(timer);
  },250);
  if(document.readyState!=='loading')enforce();
  else document.addEventListener('DOMContentLoaded',enforce,{once:true});
})();
