(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || document.body.dataset.role || '').toLowerCase();
  const contractor = audience === 'contractor';
  const plannerType = /renovationplanner\.html/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = (qs.get('contractorId') || '').trim();
  const MARKET_API = 'https://terajuciptabina.vercel.app/api/contractor-market';
  const buildStorageKey = contractorId ? `teraju.contractor.local.v1.${contractorId}.build` : '';

  const BUILD_MASTER = {
    permit:'Submission of building plan / permit application and Engineer’s drawings to the Local Authority, including preparation of required documents, submission, coordination and necessary authority liaison, complete.',
    prelim:'Preliminaries, site mobilisation, temporary facilities, site protection, insurance, project coordination, supervision and general project management, complete.',
    footingConc:'Concrete Grade 15 to pad footings including placing, compacting, levelling and curing complete.',
    slabConc:'Concrete Grade 25 to ground slab including preparation, placing, compacting, levelling, finishing and curing complete.',
    beamConc:'Concrete Grade 25 to ground and roof beams including placing, compacting, levelling and curing complete.',
    colConc:'Concrete Grade 25 to reinforced concrete columns including placing, compacting, alignment and curing complete.',
    ceilingInt:'Plaster / skim ceiling c/w paint including surface preparation, joint treatment, application and finishing complete.',
    floorTileInt:'Internal floor tiles including surface preparation, adhesive / mortar bedding, cutting, laying, grouting and finishing complete.',
    paintInt:'Internal wall and ceiling painting including surface preparation, sealer / undercoat, finishing coats, cleaning and touch-up complete.',
    door:'Door set including door leaf, frame, ironmongery, installation, alignment and finishing complete.',
    window:'Window set including frame, glazing, ironmongery, sealant, installation and finishing complete.',
    bathFloorTile:'Bathroom floor tiles c/w waterproofing including surface preparation, waterproofing membrane, laying, grouting and finishing complete.',
    bathWallTile:'Bathroom wall tiles including surface preparation, laying, grouting, trimming and finishing complete.',
    bathPiping:'Bathroom sanitary and water supply piping including fittings, connections, testing and commissioning complete.',
    bathWc:'Water closet (WC) including pan, cistern, fittings, connection, testing and commissioning complete.',
    bathBasin:'Wash hand basin including basin, tap / fittings, waste connection, installation, testing and commissioning complete.',
    dbBox:'Distribution board (DB) box including enclosure, circuit protection devices, busbar, labelling and installation complete.',
    wiring:'Electrical wiring including cables, conduits / trunking, terminations, supports, testing and commissioning complete.',
    powerPoint:'13A switched power point including wiring, accessories, mounting, termination, testing and commissioning complete.',
    switch:'Lighting switch including wiring, accessories, mounting, termination, testing and commissioning complete.',
    lighting:'Light fitting including fitting, wiring connection, mounting, testing and commissioning complete.',
    fan:'Ceiling fan including fan unit, regulator / control, wiring connection, mounting, testing and commissioning complete.',
    aircond:'Air-conditioning point / provision including power wiring, isolator, containment, termination, testing and commissioning complete.',
    earthing:'Electrical earthing system including earth electrode, conductor, connections, testing and commissioning complete.'
  };

  const STRUCT_MASTER = {
    'str-footing-conc':'Concrete Grade 15 to pad footings including placing, compacting, levelling and curing complete.',
    'str-footing-fw':'Formwork to pad footings including erection, support, alignment, striking and making good complete.',
    'str-footing-rebar':'Reinforcement steel bars to pad footings including cutting, bending, fixing and tying complete.',
    'str-slab-conc':'Concrete Grade 25 to ground slab including preparation, placing, compacting, levelling, finishing and curing complete.',
    'str-slab-brc':'Welded steel fabric reinforcement BRC A7, double layer, including laps, spacers and fixing complete.',
    'str-gb-conc':'Concrete Grade 25 to ground beams including placing, compacting, levelling and curing complete.',
    'str-gb-fw':'Formwork to ground beams including erection, support, alignment, striking and making good complete.',
    'str-gb-rebar':'Reinforcement steel bars to ground beams including cutting, bending, fixing and tying complete.',
    'str-rb-conc':'Concrete Grade 25 to roof beams including placing, compacting, levelling and curing complete.',
    'str-rb-fw':'Formwork to roof beams including erection, support, alignment, striking and making good complete.',
    'str-rb-rebar':'Reinforcement steel bars to roof beams including cutting, bending, fixing and tying complete.',
    'str-col-conc':'Concrete Grade 25 to reinforced concrete columns including placing, compacting, alignment and curing complete.',
    'str-col-fw':'Formwork to reinforced concrete columns including erection, support, alignment, striking and making good complete.',
    'str-col-rebar':'Reinforcement steel bars to reinforced concrete columns including cutting, bending, fixing and tying complete.',
    'str-fr-conc':'Concrete Grade 25 to flat roof slab including placing, compacting, levelling, finishing and curing complete.',
    'str-fr-fw':'Formwork to flat roof slab including erection, support, alignment, striking and making good complete.',
    'str-fr-brc':'Welded steel fabric reinforcement BRC A7, double layer, to flat roof slab including laps, spacers and fixing complete.',
    'str-roof-c':'Galvanised steel C-channel roof framing including cutting, fabrication, fixing, connections, alignment and protective treatment complete.',
    'str-roof-m':'Metal roofing sheets including supply, cutting, fixing, laps, flashing, sealant, fasteners and complete installation.',
    'str-apron-c':'Concrete Grade 15 to external apron including preparation, placing, compacting, levelling, finishing and curing complete.',
    'str-apron-f':'Formwork to external apron including erection, support, alignment, striking and making good complete.',
    'str-apron-b':'Welded steel fabric reinforcement BRC A7 to external apron including laps, spacers and fixing complete.',
    'str-drain':'Small U-shape scupper drain including excavation, base preparation, construction, finishing and making good complete.',
    'arch-septik':'Septic tank including excavation, bedding, tank, inlet / outlet connections, backfilling and all necessary accessories complete.',
    'arch-watertank':'Water storage tank including tank base / support, inlet and outlet connections, fittings and all necessary accessories complete.',
    'str-roof-dc':'Concrete Grade 25 to designed roof structural member including placing, compacting, levelling and curing complete.',
    'str-roof-df':'Formwork to designed roof structural member including erection, support, alignment, striking and making good complete.',
    'str-roof-dr':'Reinforcement steel bars to designed roof structural member including cutting, bending, fixing and tying complete.'
  };

  function applyBuildMaster(){
    if(plannerType!=='build')return;
    if(Array.isArray(window.RATE_SCHEDULE))for(const group of window.RATE_SCHEDULE)for(const row of group.rows||[])if(BUILD_MASTER[row.key])row.label=BUILD_MASTER[row.key];
    if(Array.isArray(window.STRUCT_GROUPS))for(const group of window.STRUCT_GROUPS)for(const item of group.items||[])if(STRUCT_MASTER[item.id])item.desc=STRUCT_MASTER[item.id];
  }

  function protectGlobalRateSchedule(){
    if(plannerType!=='build')return;
    window.editScheduleRate=()=>false;
    window.resetRatesToDefault=()=>false;
    const originalRender=window.renderRateSchedule;
    if(typeof originalRender==='function'&&!originalRender.__terajuProtected){
      const render=function(){
        applyBuildMaster();originalRender();
        document.querySelectorAll('#rateScheduleContent input').forEach(input=>{const span=document.createElement('span');span.className='inline-block min-w-[7rem] px-2 py-1.5 text-right text-gray-700';span.textContent=Number(input.value||0).toFixed(2);span.setAttribute('aria-label','Global master rate — read only');input.replaceWith(span)});
        document.querySelectorAll('#rateScheduleContent [onclick*="resetRatesToDefault"]').forEach(el=>el.remove());
      };render.__terajuProtected=true;window.renderRateSchedule=render;
    }
    applyBuildMaster();try{window.renderRateSchedule?.()}catch(_){ }
  }

  const captureSignatures=new Map();
  async function captureItem(item){
    if(!contractor||!contractorId||!item||!item.custom)return;
    const payload={contractorId,plannerType,customItemId:item.customItemId||item.id,sourceGlobalId:item.sourceGlobalId||null,description:String(item.description||'').trim(),unit:String(item.unit||'unit').trim(),rate:Number(item.rate)||0,category:String(item.category||'custom'),groupKey:item.groupKey||null,groupTitle:String(item.groupTitle||'Custom Items')};
    if(!payload.description)return;const sig=JSON.stringify(payload);if(captureSignatures.get(payload.customItemId)===sig)return;
    try{const r=await fetch(MARKET_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(r.ok)captureSignatures.set(payload.customItemId,sig)}catch(_){ }
  }

  function readBuildCustomItems(){
    if(!contractor||plannerType!=='build'||!buildStorageKey)return [];
    try{const state=JSON.parse(localStorage.getItem(buildStorageKey)||'null');return Array.isArray(state?.standardRateItems)?state.standardRateItems:[]}catch(_){return []}
  }
  function captureCurrentCustomItems(){readBuildCustomItems().filter(x=>x&&x.custom).forEach(captureItem)}

  function wrapSaveManualItem(){
    if(!contractor||plannerType!=='build'||typeof window.saveManualItem!=='function'||window.saveManualItem.__terajuWrapped)return false;
    const original=window.saveManualItem;
    const wrapped=function(targetKey){
      const select=document.getElementById(`manual-select-${targetKey}`);const selected=select?.value||'';
      const result=original.apply(this,arguments);
      setTimeout(()=>{
        try{
          const state=JSON.parse(localStorage.getItem(buildStorageKey)||'null');
          const items=Array.isArray(state?.standardRateItems)?state.standardRateItems:[];const item=items[items.length-1];
          if(item&&item.custom){if(selected&&selected!=='__new__')item.sourceGlobalId=selected;item.customItemId=item.customItemId||item.id;state.standardRateItems=items;localStorage.setItem(buildStorageKey,JSON.stringify(state));captureItem(item)}
        }catch(_){ }
      },50);
      return result;
    };
    wrapped.__terajuWrapped=true;window.saveManualItem=wrapped;return true;
  }

  function wrapQuotationSave(){
    if(!contractor||typeof window.saveQuotation!=='function'||window.saveQuotation.__terajuMarketWrapped)return false;
    const original=window.saveQuotation;const wrapped=async function(){captureCurrentCustomItems();return original.apply(this,arguments)};wrapped.__terajuMarketWrapped=true;window.saveQuotation=wrapped;return true;
  }

  function init(){applyBuildMaster();protectGlobalRateSchedule();const a=wrapSaveManualItem(),b=wrapQuotationSave();if(contractor&&(!a||!b))setTimeout(init,200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
