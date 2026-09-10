(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || document.body.dataset.role || '').toLowerCase();
  const contractor = audience === 'contractor';
  const plannerType = /renovationplanner\.html/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = (qs.get('contractorId') || '').trim();
  const MARKET_API = 'https://terajuciptabina.vercel.app/api/contractor-market';

  // Build master descriptions. These are applied to the existing Rate Schedule
  // objects so Homeowner and Contractor use the same descriptions; only rate
  // editability remains different between the two audiences.
  const BUILD_MASTER_BY_RATE_KEY = {
    permit:'Submission of building plan / permit application and Engineer’s drawings to the Local Authority, including preparation of required documents, submission, coordination and necessary authority liaison, complete.',
    prelim:'Preliminaries, site mobilisation, temporary facilities, site protection, insurance, project coordination, supervision and general project management, complete.',
    footingConc:'To supply and place concrete Grade 15 for pad footings, including mixing, placing, compacting, levelling and curing, complete.',
    footingFw:'To supply, erect and dismantle formwork to pad footings, including supports, bracing, release treatment and all necessary accessories, complete.',
    footingRebar:'To supply, cut, bend and fix reinforcement steel bars for pad footings, including tying wire, spacers, chairs and all necessary supports, complete.',
    slabConc:'To supply and place concrete Grade 25 for ground slab, including preparation, placing, compacting, levelling, finishing and curing, complete.',
    slabBrc:'To supply and fix BRC A7 reinforcement mesh, double layer, including laps, tying wire, spacers and supports, complete.',
    beamConc:'To supply and place concrete Grade 25 for ground beams, including placing, compacting, levelling and curing, complete.',
    beamFw:'To supply, erect and dismantle formwork to ground beams, including supports, bracing, alignment and all necessary accessories, complete.',
    beamRebar:'To supply, cut, bend and fix reinforcement steel bars for ground beams, including tying wire, spacers, chairs and all necessary supports, complete.',
    colConc:'To supply and place concrete Grade 25 for reinforced concrete columns, including placing, compacting, alignment and curing, complete.',
    colFw:'To supply, erect and dismantle formwork to reinforced concrete columns, including supports, bracing, alignment and all necessary accessories, complete.',
    colRebar:'To supply, cut, bend and fix reinforcement steel bars for reinforced concrete columns, including tying wire, spacers, chairs and all necessary supports, complete.',
    flatRoofConc:'To supply and place concrete Grade 25 for flat roof slab, including placing, compacting, levelling, finishing and curing, complete.',
    flatRoofFw:'To supply, erect and dismantle formwork to flat roof slab, including supports, bracing, alignment and all necessary accessories, complete.',
    flatRoofBrc:'To supply and fix BRC A7 reinforcement mesh, double layer, to flat roof slab, including laps, tying wire, spacers and supports, complete.',
    cChannel:'To supply and install C-channel steel members for roof structure, including cutting, fabrication, fixing, connection accessories, alignment and protective treatment, complete.',
    metalSheet:'To supply and install metal roofing sheets, including necessary laps, flashing, fasteners, sealant and all accessories, complete.',
    apronConc:'To supply and place concrete Grade 15 for external apron works, including preparation, placing, compacting, levelling, finishing and curing, complete.',
    apronFw:'To supply, erect and dismantle formwork to external apron works, including supports, alignment and all necessary accessories, complete.',
    apronBrc:'To supply and fix BRC A7 reinforcement mesh for external apron works, including laps, tying wire, spacers and supports, complete.',
    drainage:'To supply and construct small U-shape scupper drainage, including excavation, base preparation, concrete / masonry works, finishing and making good, complete.',
    septicTank:'To supply and install septic tank system, including excavation, bedding, tank, inlet / outlet connections, backfilling and all necessary accessories, complete.',
    waterTank:'To supply and install water storage tank, including tank base / support, inlet and outlet connections, fittings and all necessary accessories, complete.',
    roofDesignConc:'To supply and place concrete Grade 25 for designed roof structure, including placing, compacting, levelling and curing, complete.',
    roofDesignFw:'To supply, erect and dismantle formwork to designed roof structure, including supports, bracing, alignment and all necessary accessories, complete.',
    roofDesignRebar:'To supply, cut, bend and fix reinforcement steel bars for designed roof structure, including tying wire, spacers, chairs and all necessary supports, complete.',
    ceilingInt:'To supply and install plaster / skim ceiling c/w paint, including surface preparation, joint treatment and finishing, complete.',
    floorTileInt:'To supply and install internal floor tiles, including surface preparation, adhesive / mortar, cutting, laying, grouting and finishing, complete.',
    paintInt:'To supply labour and materials for internal painting works, including surface preparation, sealer where required, two coats of paint, cleaning and touch-up upon completion.',
    door:'To supply and install door complete with frame, ironmongery, hinges, lockset, alignment and finishing, complete.',
    window:'To supply and install window complete with frame, glazing, ironmongery, sealant, fixing and making good, complete.',
    bathFloorTile:'To supply and install bathroom floor tiles c/w waterproofing, including surface preparation, waterproofing system, adhesive / mortar, cutting, laying, grouting and finishing, complete.',
    bathWallTile:'To supply and install bathroom wall tiles c/w waterproofing, including surface preparation, waterproofing system, adhesive, cutting, laying, grouting and finishing, complete.',
    bathPiping:'To supply and install sanitary and water supply piping works, including fittings, connections, testing and making good, complete.',
    bathWc:'To supply and install water closet (WC), including flush fittings, connections, testing and all necessary accessories, complete.',
    bathBasin:'To supply and install wash hand basin, including taps, waste fittings, connections, testing and all necessary accessories, complete.',
    dbBox:'To supply and install distribution board (DB) complete with main protective devices, circuit breakers, labels, connections, testing and commissioning.',
    wiring:'To supply, install and test electrical wiring and cables for the building, including conduits / containment, connections, termination and necessary accessories, complete.',
    powerPoint:'To supply and install electrical power points, including wiring, conduits, back boxes, accessories, termination and testing, complete.',
    switch:'To supply and install electrical switches, including wiring, back boxes, accessories, termination and testing, complete.',
    lighting:'To supply and install lighting points / fittings, including wiring, conduits, switches, connections, testing and commissioning, complete.',
    fan:'To supply and install ceiling fan points / provisions, including wiring, switch control, support and testing, complete.',
    aircond:'To supply and install air-conditioning points / provisions, including electrical wiring, isolator, containment and necessary accessories, complete.',
    earthing:'To supply and install complete electrical earthing system, including earth electrodes, conductors, connections, testing and commissioning, complete.'
  };

  function applyBuildMasterDescriptions(){
    if(plannerType!=='build')return false;
    let changed=false;
    try{
      if(typeof STRUCT_GROUPS!=='undefined'){
        (STRUCT_GROUPS||[]).forEach(group=>(group.items||[]).forEach(item=>{
          const text=BUILD_MASTER_BY_RATE_KEY[item.rateKey];
          if(text&&item.desc!==text){item.desc=text;changed=true;}
        }));
      }
      if(typeof RATE_SCHEDULE!=='undefined'){
        (RATE_SCHEDULE||[]).forEach(group=>(group.rows||[]).forEach(row=>{
          const text=BUILD_MASTER_BY_RATE_KEY[row.key];
          if(text&&row.label!==text){row.label=text;changed=true;}
        }));
      }
    }catch(_){ }
    if(changed){
      try{ if(typeof renderRateSchedule==='function') renderRateSchedule(); }catch(_){ }
      try{ if(typeof updateEstimate==='function') updateEstimate(); }catch(_){ }
    }
    return changed;
  }

  // Apply the master on both Homeowner and Contractor Build Planner.
  // Contractor editability is still controlled by the planner's native IS_CONTRACTOR logic.
  if(plannerType==='build'){
    let tries=0;
    const timer=setInterval(()=>{
      applyBuildMasterDescriptions();
      tries+=1;
      if(tries>40)clearInterval(timer);
    },250);
    if(document.readyState!=='loading')applyBuildMasterDescriptions();
    else document.addEventListener('DOMContentLoaded',applyBuildMasterDescriptions,{once:true});
    window.addEventListener('teraju:ratechange',applyBuildMasterDescriptions);
  }

  const captureSignatures = new Map();

  function currentState() {
    return String(window.TERAJU_SELECTED_STATE || window.TERAJU_RATE_CONTEXT?.state || qs.get('state') || '').trim().toLowerCase();
  }

  async function captureItem(item) {
    if (!contractor || !contractorId || !item || !item.custom) return;
    const state = currentState();
    if (!state) return;
    const payload = {
      contractorId,
      plannerType,
      state,
      rateSetId: window.TERAJU_RATE_CONTEXT?.rateSetId || state,
      customItemId: item.customItemId || item.id,
      sourceGlobalId: item.sourceGlobalId || null,
      description: String(item.description || '').trim(),
      unit: String(item.unit || 'unit').trim(),
      rate: Number(item.rate) || 0,
      category: String(item.category || 'custom'),
      groupKey: item.groupKey || null,
      groupTitle: String(item.groupTitle || 'Custom Items')
    };
    if (!payload.description) return;
    const sig = JSON.stringify(payload);
    if (captureSignatures.get(`${state}:${payload.customItemId}`) === sig) return;
    try {
      const r = await fetch(MARKET_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (r.ok) captureSignatures.set(`${state}:${payload.customItemId}`, sig);
    } catch (_) {}
  }

  async function captureCurrentCustomItems() {
    if (!contractor) return;
    try {
      if (typeof window.__tcLoadLocalContractorData === 'function') {
        window.__tcLoadLocalContractorData();
      }
      if (plannerType === 'build' && typeof window.getAllItems === 'function') {
        const items = window.getAllItems();
        (Array.isArray(items) ? items : []).filter(x => x && x.custom).forEach(captureItem);
      } else if (plannerType === 'renovation' && typeof window.getData === 'function') {
        const data = window.getData() || {};
        (Array.isArray(data.allItems) ? data.allItems : []).filter(x => x && x.custom).forEach(captureItem);
      }
    } catch (_) {}
  }

  function wrapSaveManualItem() {
    if (!contractor || plannerType !== 'build' || typeof window.saveManualItem !== 'function' || window.saveManualItem.__terajuWrapped) return false;
    const original = window.saveManualItem;
    const wrapped = function(targetKey) {
      const select = document.getElementById(`manual-select-${targetKey}`);
      const selected = select?.value || '';
      const result = original.apply(this, arguments);
      setTimeout(() => {
        try {
          const items = Array.isArray(window.standardRateItems) ? window.standardRateItems : [];
          const item = items[items.length - 1];
          if (item && item.custom) {
            if (selected && selected !== '__new__') item.sourceGlobalId = selected;
            item.customItemId = item.customItemId || item.id;
            if (typeof window.__tcSaveLocalContractorData === 'function') window.__tcSaveLocalContractorData();
            captureItem(item);
          }
        } catch (_) {}
      }, 50);
      return result;
    };
    wrapped.__terajuWrapped = true;
    window.saveManualItem = wrapped;
    return true;
  }

  function wrapQuotationSave() {
    if (!contractor || typeof window.saveQuotation !== 'function' || window.saveQuotation.__terajuMarketWrapped) return false;
    const original = window.saveQuotation;
    const wrapped = async function() { captureCurrentCustomItems(); return original.apply(this, arguments); };
    wrapped.__terajuMarketWrapped = true;
    window.saveQuotation = wrapped;
    return true;
  }

  function init() {
    const a = wrapSaveManualItem(), b = wrapQuotationSave();
    if (contractor && (!a || !b)) setTimeout(init, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
