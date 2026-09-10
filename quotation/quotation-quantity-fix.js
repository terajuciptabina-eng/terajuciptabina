(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || 'homeowner').toLowerCase();
  const contractor = audience === 'contractor';
  const plannerType = /renovationplanner\.html/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = (qs.get('contractorId') || '').trim();
  const contractorState = (qs.get('state') || '').trim();
  const DB_KEY = contractor && contractorId && contractorState
    ? `terajuQuotationItemDatabase:v3:${contractorId}:${contractorState}:${plannerType}`
    : `terajuQuotationItemDatabase:v2:${plannerType}`;
  const BUILTIN_RENO_UNITS = {
    ceiling:'sqft', spc:'sqft', floorTile:'sqft', wallTile:'sqft', facadeWall:'sqft', downlight:'unit', wallLight:'unit',
    ceilingFan:'unit', exhaustFan:'unit', curtainBoxLED:'unit', barLamp:'unit', kitchenFrame:'ls', kitchenMakingGood:'ls',
    kitchenGlassDoor:'unit', bathroomSanitary:'set', bathroomDoor:'unit', gateMotor:'ls', wallDivider:'ls', frontFence:'ls',
    preliminaries:'ls', extensionKitchen:'sqft', extensionToilet:'sqft'
  };
  const RENO_LABELS = {
    ceiling:'Plaster ceiling flat c/w paint', spc:'SPC flooring c/w skirting and floor mat', floorTile:'Floor tiles c/w waterproofing',
    wallTile:'Wall tiles c/w waterproofing', facadeWall:'Facade wall', downlight:'Downlight c/w wiring', wallLight:'Wall light c/w wiring',
    ceilingFan:'Ceiling fan c/w wiring', exhaustFan:'Exhaust fan c/w wiring', curtainBoxLED:'LED light for curtain box c/w wiring', barLamp:'Bar / kitchen lamp c/w wiring',
    kitchenFrame:'Laminated arce frame', kitchenMakingGood:'Making good after demolition', kitchenGlassDoor:'Swing glass door', bathroomSanitary:'Toilet accessories / sanitary set',
    bathroomDoor:'Toilet swing door', gateMotor:'Main gate c/w automatic motor', wallDivider:'Side brickwall divider c/w plaster and paint', frontFence:'Front fence brickwall',
    preliminaries:'Renovation permit / professional submission', extensionKitchen:'New kitchen extension works', extensionToilet:'New toilet extension works'
  };

  // Build Planner descriptions use a fuller SMM-style scope wording while keeping
  // the existing item IDs, quantities, units and rates unchanged.
  const BUILD_FULL_DESCRIPTIONS = {
    'prelim-1':'Submission of building plan / permit application and Engineer’s drawings to the Local Authority, including preparation of required documents, submission, coordination and necessary authority liaison, complete.',
    'prelim-2':'Preliminaries, site mobilisation, temporary facilities, site protection, insurance, project coordination, supervision and general project management, complete.',
    'str-footing-conc':'To supply and place concrete Grade 15 for pad footings, including mixing, placing, compacting, levelling and curing, complete.',
    'str-footing-fw':'To supply, erect and dismantle formwork to pad footings, including supports, bracing, release treatment and all necessary accessories, complete.',
    'str-footing-rebar':'To supply, cut, bend and fix reinforcement steel bars for pad footings, including tying wire, spacers, chairs and all necessary supports, complete.',
    'str-slab-conc':'To supply and place concrete Grade 25 for ground slab, including preparation, placing, compacting, levelling, finishing and curing, complete.',
    'str-slab-brc':'To supply and fix BRC A7 reinforcement mesh, double layer, including laps, tying wire, spacers and supports, complete.',
    'str-gb-conc':'To supply and place concrete Grade 25 for ground beams, including placing, compacting, levelling and curing, complete.',
    'str-gb-fw':'To supply, erect and dismantle formwork to ground beams, including supports, bracing, alignment and all necessary accessories, complete.',
    'str-gb-rebar':'To supply, cut, bend and fix reinforcement steel bars for ground beams, including tying wire, spacers, chairs and all necessary supports, complete.',
    'str-rb-conc':'To supply and place concrete Grade 25 for roof beams, including placing, compacting, levelling and curing, complete.',
    'str-rb-fw':'To supply, erect and dismantle formwork to roof beams, including supports, bracing, alignment and all necessary accessories, complete.',
    'str-rb-rebar':'To supply, cut, bend and fix reinforcement steel bars for roof beams, including tying wire, spacers, chairs and all necessary supports, complete.',
    'str-col-conc':'To supply and place concrete Grade 25 for reinforced concrete columns, including placing, compacting, alignment and curing, complete.',
    'str-col-fw':'To supply, erect and dismantle formwork to reinforced concrete columns, including supports, bracing, alignment and all necessary accessories, complete.',
    'str-col-rebar':'To supply, cut, bend and fix reinforcement steel bars for reinforced concrete columns, including tying wire, spacers, chairs and all necessary supports, complete.',
    'str-fr-conc':'To supply and place concrete Grade 25 for flat roof slab, including placing, compacting, levelling, finishing and curing, complete.',
    'str-fr-fw':'To supply, erect and dismantle formwork to flat roof slab, including supports, bracing, alignment and all necessary accessories, complete.',
    'str-fr-brc':'To supply and fix BRC A7 reinforcement mesh, double layer, to flat roof slab, including laps, tying wire, spacers and supports, complete.',
    'str-roof-c':'To supply and install C-channel steel members for roof structure, including cutting, fabrication, fixing, connection accessories, alignment and protective treatment, complete.',
    'str-roof-m':'To supply and install metal roofing sheets, including necessary laps, flashing, fasteners, sealant and all accessories, complete.',
    'str-apron-c':'To supply and place concrete Grade 15 for external apron works, including preparation, placing, compacting, levelling, finishing and curing, complete.',
    'str-apron-f':'To supply, erect and dismantle formwork to external apron works, including supports, alignment and all necessary accessories, complete.',
    'str-apron-b':'To supply and fix BRC A7 reinforcement mesh for external apron works, including laps, tying wire, spacers and supports, complete.',
    'str-drain':'To supply and construct small U-shape scupper drainage, including excavation, base preparation, concrete / masonry works, finishing and making good, complete.',
    'arch-septik':'To supply and install septic tank system, including excavation, bedding, tank, inlet / outlet connections, backfilling and all necessary accessories, complete.',
    'arch-watertank':'To supply and install water storage tank, including tank base / support, inlet and outlet connections, fittings and all necessary accessories, complete.',
    'str-roof-dc':'To supply and place concrete Grade 25 for designed roof structure, including placing, compacting, levelling and curing, complete.',
    'str-roof-df':'To supply, erect and dismantle formwork to designed roof structure, including supports, bracing, alignment and all necessary accessories, complete.',
    'str-roof-dr':'To supply, cut, bend and fix reinforcement steel bars for designed roof structure, including tying wire, spacers, chairs and all necessary supports, complete.',
    'elec-db':'To supply and install distribution board (DB) complete with main protective devices, circuit breakers, labels, connections, testing and commissioning.',
    'elec-wiring':'To supply, install and test electrical wiring and cables for the building, including conduits / containment, connections, termination and necessary accessories, complete.',
    'elec-pp':'To supply and install electrical power points, including wiring, conduits, back boxes, accessories, termination and testing, complete.',
    'elec-switch':'To supply and install electrical switches, including wiring, back boxes, accessories, termination and testing, complete.',
    'elec-light':'To supply and install lighting points / fittings, including wiring, conduits, switches, connections, testing and commissioning, complete.',
    'elec-fan':'To supply and install ceiling fan points / provisions, including wiring, switch control, support and testing, complete.',
    'elec-ac':'To supply and install air-conditioning points / provisions, including electrical wiring, isolator, containment and necessary accessories, complete.',
    'elec-earth':'To supply and install complete electrical earthing system, including earth electrodes, conductors, connections, testing and commissioning, complete.'
  };

  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function buildFullDescription(item) {
    if (!item || plannerType !== 'build') return null;
    const id = String(item.id || '');
    if (BUILD_FULL_DESCRIPTIONS[id]) return BUILD_FULL_DESCRIPTIONS[id];
    if (item.category === 'architecture') {
      const room = String(item.room || 'area').trim();
      if (id.endsWith('-ceiling')) return `To supply and install plaster / skim ceiling c/w paint to ${room}, including surface preparation, joint treatment and finishing, complete.`;
      if (id.endsWith('-floortile')) return `To supply and install floor tiles to ${room}, including surface preparation, adhesive / mortar, cutting, laying, grouting and finishing, complete.`;
      if (id.endsWith('-walltile')) return `To supply and install wall tiles to ${room}, including surface preparation, adhesive, cutting, laying, grouting and finishing, complete.`;
      if (id.endsWith('-piping')) return `To supply and install sanitary and water supply piping works to ${room}, including fittings, connections, testing and making good, complete.`;
      if (id.endsWith('-wc')) return `To supply and install water closet (WC) to ${room}, including flush fittings, connections, testing and all necessary accessories, complete.`;
      if (id.endsWith('-basin')) return `To supply and install wash hand basin to ${room}, including taps, waste fittings, connections, testing and all necessary accessories, complete.`;
      if (id.endsWith('-shower')) return `To supply and install shower rose and fittings to ${room}, including connections, testing and all necessary accessories, complete.`;
      if (id.endsWith('-tap')) return `To supply and install tap fittings to ${room}, including connections, testing and all necessary accessories, complete.`;
      if (id.endsWith('-paint')) return `To supply labour and materials for internal painting works to ${room}, including surface preparation, sealer where required, two coats of paint, cleaning and touch-up upon completion.`;
      if (id.endsWith('-door')) return `To supply and install door to ${room}, including frame, ironmongery, hinges, lockset, alignment and finishing, complete.`;
      if (id.endsWith('-window')) return `To supply and install window to ${room}, including frame, glazing, ironmongery, sealant, fixing and making good, complete.`;
    }
    return null;
  }

  function readDB() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  let db = readDB();
  function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function ensureRecord(key, fallback) {
    if (!db[key]) db[key] = { description:fallback.description || key, unit:fallback.unit || 'unit', rate:num(fallback.rate), qty:num(fallback.qty) || 1, included:true, custom:false };
    return db[key];
  }
  function effectiveRecord(key, fallback) {
    const r = db[key];
    if (!r) return fallback;
    return {
      description: r.description || fallback.description,
      unit: r.unit || fallback.unit,
      rate: Number.isFinite(Number(r.rate)) ? Number(r.rate) : num(fallback.rate),
      qty: Number.isFinite(Number(r.qty)) ? Number(r.qty) : (num(fallback.qty) || 1)
    };
  }

  function renovationKey(item) {
    const id = String(item?.id || '').toLowerCase();
    const text = `${item?.description || ''} ${item?.type || ''}`.toLowerCase();
    if (id === 'project-preliminaries') return 'preliminaries';
    const aliases = [
      ['ceiling','ceiling'],['spc','spc'],['floor','floorTile'],['walltile','wallTile'],['facade','facadeWall'],
      ['downlight','downlight'],['walllight','wallLight'],['fan','ceilingFan'],['exhaust','exhaustFan'],['curtain','curtainBoxLED'],
      ['barlamp','barLamp'],['lamp','barLamp'],['frame','kitchenFrame'],['makinggood','kitchenMakingGood'],['glassdoor','kitchenGlassDoor'],
      ['sanitary','bathroomSanitary'],['door','bathroomDoor'],['gate','gateMotor'],['divider','wallDivider'],['fence','frontFence']
    ];
    for (const [suffix,key] of aliases) if (id.endsWith(`-${suffix}`) || id === suffix) return key;
    if (/extension.*kitchen|kitchen.*extension/.test(text)) return 'extensionKitchen';
    if (/extension.*toilet|toilet.*extension/.test(text)) return 'extensionToilet';
    return null;
  }

  function buildRoomKey(item) {
    const id = String(item?.id || '');
    if (id.endsWith('-ceiling')) return 'ceilingInt';
    if (id.endsWith('-walltile')) return 'bathWallTile';
    if (id.endsWith('-piping')) return 'bathPiping';
    if (id.endsWith('-wc')) return 'bathWc';
    if (id.endsWith('-basin')) return 'bathBasin';
    if (id.endsWith('-shower')) return 'bathShower';
    if (id.endsWith('-tap')) return 'bathTap';
    if (id.endsWith('-floortile')) return item.room && /car porch|entrance/i.test(item.room) ? 'floorTileExt' : (String(item.description).toLowerCase().includes('waterproofing') ? 'bathFloorTile' : 'floorTileInt');
    if (id.endsWith('-paint')) return 'paintInt';
    if (id.endsWith('-door')) return 'door';
    if (id.endsWith('-window')) return 'window';
    return null;
  }

  function buildRateKey(item) {
    if (!item) return null;
    const id = String(item.id || '');
    const map = {
      'prelim-1':'permit','prelim-2':'prelim','elec-db':'dbBox','elec-wiring':'wiring','elec-pp':'powerPoint','elec-switch':'switch',
      'elec-light':'lighting','elec-fan':'fan','elec-ac':'aircond','elec-earth':'earthing'
    };
    if (map[id]) return map[id];
    if (typeof STRUCT_GROUPS !== 'undefined') {
      for (const g of STRUCT_GROUPS) for (const x of g.items || []) if (x.id === id) return x.rateKey;
    }
    return buildRoomKey(item);
  }

  function addDatabaseRecord(key, fallback, custom=false) {
    const current = ensureRecord(key, fallback);
    current.custom = custom || !!current.custom;
    saveDB();
    return current;
  }

  function applyBuildDatabase(items) {
    const result = Array.isArray(items) ? items : [];
    result.forEach(item => {
      const key = buildRateKey(item);
      if (!key) return;
      const originalDescription = item.description;
      const fullDescription = buildFullDescription(item);
      const fallback = {description:fullDescription || originalDescription, unit:item.unit || 'unit', rate:num(item.rate), qty:num(item.qty)};
      const existing = db[key];
      if (existing && !existing.custom && fullDescription) existing.description = fullDescription;
      addDatabaseRecord(key, fallback, false);
      const e = effectiveRecord(key, fallback);
      item.description=e.description;
      if (fullDescription && db[key] && !db[key].custom) { item.description=fullDescription; db[key].description=fullDescription; }
      if (typeof customDescriptions !== 'undefined' && customDescriptions.has(item.id)) item.description=customDescriptions.get(item.id);
      item.unit=e.unit; item.rate=e.rate; item.amount=num(item.qty)*e.rate;
    });
    Object.entries(db).forEach(([key,r]) => {
      if (!r.custom || r.included === false) return;
      const qty = Math.max(0,num(r.qty));
      if (!qty) return;
      result.push({id:`custom-${key}`, key, description:r.description, unit:r.unit || 'unit', rate:num(r.rate), qty, amount:qty*num(r.rate), category:'Additional Contractor Item', room:'Additional / Custom'});
    });
    saveDB();
    return result;
  }

  function applyRenovationDatabase(data) {
    const d = data || {};
    d.allItems = Array.isArray(d.allItems) ? d.allItems : [];
    d.allItems.forEach(item => {
      const key = renovationKey(item);
      if (!key) return;
      const fallback = {description:item.description, unit:item.unit || BUILTIN_RENO_UNITS[key] || 'unit', rate:num(item.rate), qty:num(item.qty)};
      addDatabaseRecord(key, fallback, false);
      const e = effectiveRecord(key, fallback);
      item.description=e.description; item.unit=e.unit; item.rate=e.rate; item.amount=num(item.qty)*e.rate;
    });
    Object.entries(db).forEach(([key,r]) => {
      if (!r.custom || r.included === false) return;
      const qty=Math.max(0,num(r.qty)); if (!qty) return;
      d.allItems.push({id:`custom-${key}`,key,description:r.description,unit:r.unit||'unit',rate:num(r.rate),qty,amount:qty*num(r.rate),category:'Additional Contractor Item',room:'Additional / Custom'});
    });
    const p=effectiveRecord('preliminaries',{description:'Renovation permit / professional submission',unit:'ls',rate:num(d.projectPreliminaries),qty:1});
    d.projectPreliminaries=num(p.rate);
    d.total=d.projectPreliminaries+d.allItems.reduce((s,x)=>s+num(x.amount),0);
    saveDB();
    return d;
  }

  function rateFallbacks() {
    if (plannerType === 'renovation') {
      return Object.fromEntries(Object.keys(RATES || {}).map(key => [key,{description:RENO_LABELS[key]||key,unit:BUILTIN_RENO_UNITS[key]||'unit',rate:num(RATES[key]),qty:1}]));
    }
    const out={};
    if (typeof RATE_SCHEDULE !== 'undefined') RATE_SCHEDULE.forEach(g => (g.rows||[]).forEach(row => { out[row.key]={description:row.label,unit:row.unit||'unit',rate:num(RATES?.[row.key]),qty:1}; }));
    return out;
  }

  function renderDatabase() {
    if (!contractor) return;
    let section=document.getElementById('contractorItemDatabase');
    if (!section) {
      section=document.createElement('section'); section.id='contractorItemDatabase';
      section.className='no-print bg-white rounded-2xl shadow-sm p-6 mb-6';
      const anchor=document.getElementById('rateScheduleSection') || document.getElementById('estimateContent')?.closest('section');
      anchor?.parentNode.insertBefore(section,anchor);
    }
    const builtins=rateFallbacks();
    Object.entries(builtins).forEach(([key,f])=>ensureRecord(key,f));
    saveDB();
    const custom=Object.entries(db).filter(([,r])=>r.custom);
    const builtinRows=Object.entries(builtins).map(([key,f])=>{const r=effectiveRecord(key,f);return `<tr class="border-b"><td class="py-2 px-2"><input data-db-key="${esc(key)}" data-db-field="description" value="${esc(r.description)}" class="w-full min-w-[250px] border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input data-db-key="${esc(key)}" data-db-field="unit" value="${esc(r.unit)}" class="w-24 border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input type="number" min="0" step="0.01" data-db-key="${esc(key)}" data-db-field="rate" value="${num(r.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right"></td><td class="py-2 px-2 text-center text-xs text-gray-500">Built-in</td></tr>`;}).join('');
    const customRows=custom.map(([key,r])=>`<tr class="border-b"><td class="py-2 px-2"><input data-db-key="${esc(key)}" data-db-field="description" value="${esc(r.description)}" class="w-full min-w-[250px] border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input data-db-key="${esc(key)}" data-db-field="unit" value="${esc(r.unit||'unit')}" class="w-24 border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input type="number" min="0" step="0.01" data-db-key="${esc(key)}" data-db-field="rate" value="${num(r.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right"></td><td class="py-2 px-2 text-center"><button type="button" data-db-delete="${esc(key)}" class="border rounded-lg px-3 py-2 text-xs">Delete</button></td></tr>`).join('');
    section.innerHTML=`<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4"><div><h3 class="font-bold text-lg">Contractor Item Database</h3><p class="text-sm text-gray-500">Built-in and custom items are stored in this browser and applied to estimates and quotations.</p></div><div class="flex gap-2"><button type="button" id="addContractorItem" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold">+ Add New Item</button><button type="button" id="resetContractorDatabase" class="border px-4 py-2 rounded-lg text-sm">Reset Built-in Rates</button></div></div><div id="newContractorItemForm" class="hidden mb-5 border rounded-xl bg-gray-50 p-4"><div class="grid md:grid-cols-4 gap-3"><input id="newItemDescription" class="border rounded-lg px-3 py-2" placeholder="Description"><input id="newItemUnit" class="border rounded-lg px-3 py-2" placeholder="Unit (e.g. unit, sqft, ls)"><input id="newItemRate" type="number" min="0" step="0.01" class="border rounded-lg px-3 py-2" placeholder="Rate (RM)"><input id="newItemQty" type="number" min="0" step="0.01" value="1" class="border rounded-lg px-3 py-2" placeholder="Qty"></div><label class="flex items-center gap-2 mt-3 text-sm"><input id="newItemIncluded" type="checkbox" checked> Include this item in the estimate / quotation</label><div class="mt-3 flex gap-2"><button type="button" id="saveNewContractorItem" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold">Save Item</button><button type="button" id="cancelNewContractorItem" class="border px-4 py-2 rounded-lg text-sm">Cancel</button></div></div><div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th><th class="py-2 px-2">Type</th></tr></thead><tbody>${builtinRows}${customRows}</tbody></table></div>`;
    section.querySelectorAll('input[data-db-key]').forEach(input=>input.addEventListener('change',()=>{const key=input.dataset.dbKey,field=input.dataset.dbField; if(field==='rate'){const n=parseFloat(input.value); if(!Number.isFinite(n)||n<0){renderDatabase();return;} db[key].rate=n; if(plannerType==='build'&&typeof RATES!=='undefined')RATES[key]=n;} else db[key][field]=input.value.trim(); saveDB(); window.updateEstimate?.();}));
    section.querySelectorAll('[data-db-delete]').forEach(btn=>btn.addEventListener('click',()=>{delete db[btn.dataset.dbDelete];saveDB();renderDatabase();window.updateEstimate?.();}));
    section.querySelector('#addContractorItem').onclick=()=>section.querySelector('#newContractorItemForm').classList.toggle('hidden');
    section.querySelector('#cancelNewContractorItem').onclick=()=>section.querySelector('#newContractorItemForm').classList.add('hidden');
    section.querySelector('#saveNewContractorItem').onclick=()=>{const description=section.querySelector('#newItemDescription').value.trim(),unit=section.querySelector('#newItemUnit').value.trim()||'unit',rate=parseFloat(section.querySelector('#newItemRate').value),qty=parseFloat(section.querySelector('#newItemQty').value)||1,included=section.querySelector('#newItemIncluded').checked;if(!description||!Number.isFinite(rate)||rate<0){alert('Please enter a description and valid rate.');return;}const key='custom-'+Date.now().toString(36);db[key]={description,unit,rate,qty,included,custom:true};saveDB();renderDatabase();window.updateEstimate?.();};
    section.querySelector('#resetContractorDatabase').onclick=()=>{Object.keys(db).forEach(k=>{if(!db[k].custom)delete db[k];});const builtins2=rateFallbacks();Object.entries(builtins2).forEach(([k,f])=>db[k]={...f,custom:false,included:true});saveDB();if(plannerType==='build'&&typeof RATES!=='undefined')Object.entries(db).forEach(([k,r])=>{if(k in RATES)RATES[k]=num(r.rate);});renderDatabase();window.updateEstimate?.();};
  }

  function installBuild() {
    if (!contractor || typeof window.getAllItems !== 'function' || typeof RATE_SCHEDULE === 'undefined') return false;
    if (!window.getAllItems.__terajuDatabaseWrapped) {
      const original=window.getAllItems;
      const wrapped=function(){return applyBuildDatabase(original());}; wrapped.__terajuDatabaseWrapped=true; window.getAllItems=wrapped;
    }
    document.getElementById('homeownerQuotationOptions')?.classList.add('hidden');
    document.getElementById('contractorQuotationOptions')?.classList.remove('hidden');
    const oldRate=document.getElementById('rateScheduleSection'); if(oldRate) oldRate.classList.add('hidden');
    renderDatabase();
    return true;
  }

  function installRenovation() {
    if (!contractor || typeof window.getData !== 'function' || typeof RATES === 'undefined') return false;
    if (!window.getData.__terajuDatabaseWrapped) {
      const original=window.getData;
      const wrapped=function(){return applyRenovationDatabase(original());}; wrapped.__terajuDatabaseWrapped=true; window.getData=wrapped;
    }
    const quotationSection=Array.from(document.querySelectorAll('section.no-print')).find(s=>s.querySelector('[onclick="generateSimpleQuotation()"]'));
    if(quotationSection&&!quotationSection.dataset.terajuDbQuotation){quotationSection.dataset.terajuDbQuotation='1';quotationSection.innerHTML='<div class="mb-5"><h3 class="font-bold text-lg">Generate Contractor Quotation</h3><p class="text-sm text-gray-500">Choose the quotation detail level. Contractor detailed quotation is available without homeowner payment unlock.</p></div><div class="grid md:grid-cols-2 gap-4"><label class="border rounded-xl p-4"><input type="radio" name="renovationQuotationType" value="simple" checked> Simple Quotation</label><label class="border rounded-xl p-4"><input type="radio" name="renovationQuotationType" value="detail"> Detailed Quotation</label></div><button type="button" id="generateRenovationContractorQuotation" class="mt-5 bg-black text-white px-5 py-3 rounded-lg font-semibold">Generate Quotation</button>';document.getElementById('generateRenovationContractorQuotation').onclick=()=>{const type=document.querySelector('input[name="renovationQuotationType"]:checked')?.value||'simple';if(type==='simple')window.generateSimpleQuotation();else window.generateContractorDetailedQuotation?.();};}
    renderDatabase();
    return true;
  }

  function init(){
    window.TERAJU_AUDIENCE=contractor?'contractor':'homeowner'; document.body.classList.toggle('contractor-mode',contractor); document.body.classList.toggle('homeowner-mode',!contractor);
    if(!contractor){
      if(plannerType==='build'){
        if(typeof window.getAllItems!=='function'){setTimeout(init,100);return;}
        if(!window.getAllItems.__terajuBuildSmmWrapped){
          const original=window.getAllItems;
          const wrapped=function(){const items=original();return (Array.isArray(items)?items:[]).map(item=>{if(typeof customDescriptions!=='undefined'&&customDescriptions.has(item.id))return item;const description=buildFullDescription(item);if(description)item.description=description;return item;});};
          wrapped.__terajuBuildSmmWrapped=true; window.getAllItems=wrapped;
        }
      }
      return;
    }
    const ok=plannerType==='build'?installBuild():installRenovation();
    if(!ok){setTimeout(init,100);return;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();