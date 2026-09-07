(() => {
  function roundQuotationQuantities() {
    const root = document.getElementById('quotationContent');
    if (!root) return;

    root.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
      const quantityIndex = headers.findIndex(h => h === 'quantity' || h.includes('quantity'));
      if (quantityIndex < 0) return;

      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.children;
        if (!cells[quantityIndex]) return;
        const cell = cells[quantityIndex];
        const raw = cell.textContent.trim();
        const match = raw.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
        if (!match) return;

        const value = Number(match[1]);
        if (!Number.isFinite(value)) return;

        const unit = match[2] || '';
        const rounded = Math.max(1, Math.ceil(value));
        cell.textContent = `${rounded}${unit ? ` ${unit}` : ''}`;
      });
    });
  }

  function init() {
    roundQuotationQuantities();
    const root = document.getElementById('quotationContent');
    if (!root) return;

    const observer = new MutationObserver(() => {
      observer.disconnect();
      roundQuotationQuantities();
      observer.observe(root, { childList: true, subtree: true });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Shared planner mode layer.
   Both planners remain the base calculation/quotation code. The URL decides
   the presentation: ?audience=homeowner (default) or ?audience=contractor. */
(() => {
  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || 'homeowner').toLowerCase();
  const isContractor = audience === 'contractor';
  document.body.classList.toggle('contractor-mode', isContractor);
  document.body.classList.toggle('homeowner-mode', !isContractor);
  window.TERAJU_AUDIENCE = isContractor ? 'contractor' : 'homeowner';

  const catalog = {
    ceiling:['Plaster ceiling flat c/w paint','sqft'], spc:['SPC flooring c/w skirting and floor mat','sqft'], floorTile:['Floor tiles c/w waterproofing','sqft'], wallTile:['Wall tiles c/w waterproofing','sqft'], facadeWall:['Facade wall','sqft'],
    downlight:['Downlight c/w wiring','unit'], wallLight:['Wall light c/w wiring','unit'], ceilingFan:['Ceiling fan c/w wiring','unit'], exhaustFan:['Exhaust fan c/w wiring','unit'], curtainBoxLED:['LED light for curtain box c/w wiring','ls'], barLamp:['Bar / kitchen lamp c/w wiring','unit'],
    kitchenFrame:['Laminated arce frame','ls'], kitchenMakingGood:['Making good after demolition','ls'], kitchenGlassDoor:['Swing glass door','ls'], bathroomSanitary:['Toilet accessories / sanitary set','ls'], bathroomDoor:['Toilet swing door','unit'], gateMotor:['Main gate c/w automatic motor','ls'], wallDivider:['Side brickwall divider c/w plaster and paint','ls'], frontFence:['Front fence brickwall','ls'], preliminaries:['Renovation permit / professional submission','ls'], extensionKitchen:['New kitchen extension works','sqft'], extensionToilet:['New toilet extension works','sqft'],
    footingConc:['Footing – Concrete G15','m3'], footingFw:['Footing – Formwork','sqft'], footingRebar:['Footing – Rebar','kg'], slabConc:['Ground slab – Concrete G25','m3'], slabBrc:['Ground slab – BRC A7 double layer','sqft'], beamConc:['Beam – Concrete G25','m3'], beamFw:['Beam – Formwork','sqft'], beamRebar:['Beam – Rebar','kg'], colConc:['Column – Concrete G25','m3'], colFw:['Column – Formwork','sqft'], colRebar:['Column – Rebar','kg'], flatRoofConc:['Flat roof – Concrete G25','m3'], flatRoofFw:['Flat roof – Formwork','sqft'], flatRoofBrc:['Flat roof – BRC A7 double layer','sqft'], cChannel:['C-channel for roof structures','m'], metalSheet:['Metal roofing sheet','sqft'], roofDesignConc:['Design roof structure – Concrete G25','m3'], roofDesignFw:['Design roof structure – Formwork','sqft'], roofDesignRebar:['Design roof structure – Rebar','kg'], apronConc:['Apron – Concrete G15','m3'], apronFw:['Apron – Formwork','ft'], apronBrc:['Apron – Rebar BRC A7','kg'], drainage:['Drainage – small U-shape scupper drain','ft'], septicTank:['Septic tank','no'], waterTank:['Water tank','no'], dbBox:['DB box','no'], wiring:['Wirings','m'], powerPoint:['Power point','no'], switch:['Switch','no'], lighting:['Lighting','no'], fan:['Ceiling fan','no'], aircond:['Aircond point / provision','no'], earthing:['Earthing','set'], permit:['Building plan / permit & engineer’s drawings','ls'], prelim:['Preliminaries, mobilisation & project management','ls']
  };
  const editable = new Map();

  function esc(v){return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function keyForItem(item) {
    const id = String(item?.id || '');
    const keys = Object.keys(catalog).sort((a,b)=>b.length-a.length);
    return keys.find(k => id === k || id.endsWith('-' + k) || id.includes('-' + k + '-')) || null;
  }
  function effective(key, fallbackDesc, fallbackUnit, fallbackRate) {
    const e = editable.get(key);
    return {description:e?.description || fallbackDesc, unit:e?.unit || fallbackUnit, rate:Number.isFinite(e?.rate) ? e.rate : fallbackRate};
  }

  function buildScheduleRows() {
    if (typeof RATES === 'undefined') return [];
    return Object.keys(RATES).map(key => {
      const e=editable.get(key), base=catalog[key] || [key,'ls'];
      return {key, description:e?.description || base[0], unit:e?.unit || base[1], rate:Number.isFinite(e?.rate)?e.rate:Number(RATES[key])||0};
    });
  }

  function updateSafe(){ if(typeof updateEstimate === 'function') updateEstimate(); }

  function renderRenovationContractorSchedule() {
    if(!isContractor || typeof RATES === 'undefined' || document.getElementById('contractorRateSchedule')) return;
    if(!document.getElementById('estimateContent')) return;
    const section=document.createElement('section');
    section.id='contractorRateSchedule';
    section.className='no-print bg-white rounded-2xl shadow-sm p-6 mb-6';
    section.innerHTML='<div class="flex justify-between items-center mb-4"><div><h3 class="font-bold text-lg">Contractor Rate Schedule</h3><p class="text-sm text-gray-500">Edit unit, description and rate. Changes apply to the estimate and quotations.</p></div><button type="button" id="resetContractorRates" class="border px-4 py-2 rounded-lg text-sm">Reset</button></div><div id="contractorRateScheduleContent" class="overflow-x-auto"></div>';
    const estimateSection=document.getElementById('estimateContent').closest('section');
    estimateSection?.parentNode.insertBefore(section,estimateSection);
    const c=section.querySelector('#contractorRateScheduleContent');
    c.innerHTML='<table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Key</th><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th></tr></thead><tbody>'+buildScheduleRows().map(r=>`<tr class="border-b"><td class="py-2 px-2 text-xs text-gray-500">${esc(r.key)}</td><td class="py-2 px-2"><input data-field="description" data-key="${esc(r.key)}" value="${esc(r.description)}" class="w-full min-w-[260px] border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input data-field="unit" data-key="${esc(r.key)}" value="${esc(r.unit)}" class="w-24 border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input type="number" min="0" step="0.01" data-field="rate" data-key="${esc(r.key)}" value="${r.rate.toFixed(2)}" class="w-32 border rounded-lg px-2 py-2 text-right"></td></tr>`).join('')+'</tbody></table>';
    c.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
      const key=input.dataset.key, field=input.dataset.field, e=editable.get(key)||{};
      if(field==='rate'){const n=parseFloat(input.value);if(!Number.isFinite(n)||n<0)return;e.rate=n;RATES[key]=n}
      else if(field==='unit') e.unit=input.value.trim() || catalog[key]?.[1] || 'ls';
      else e.description=input.value.trim() || catalog[key]?.[0] || key;
      editable.set(key,e); updateSafe();
    }));
    section.querySelector('#resetContractorRates').addEventListener('click',()=>{editable.clear();if(typeof DEFAULT_RATES!=='undefined')Object.assign(RATES,DEFAULT_RATES);renderRenovationContractorSchedule();updateSafe();});
  }

  function contractorizeBuildSchedule() {
    if(!isContractor || typeof RATE_SCHEDULE==='undefined') return;
    const section=document.getElementById('rateScheduleSection');
    if(!section) return;
    section.classList.remove('homeowner-hidden');
    const panel=document.getElementById('rateSchedulePanel');
    panel?.classList.remove('hidden');
    const c=document.getElementById('rateScheduleContent'); if(!c)return;
    c.innerHTML='<table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th></tr></thead><tbody>'+RATE_SCHEDULE.map(g=>'<tr class="bg-gray-100 border-b"><td colspan="3" class="py-2 px-2 font-bold">'+esc(g.title)+'</td></tr>'+g.rows.map(r=>{const e=editable.get(r.key)||{};return '<tr class="border-b"><td class="py-2 px-2"><input data-rs="description" data-key="'+esc(r.key)+'" value="'+esc(e.description||r.label)+'" class="w-full min-w-[260px] border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input data-rs="unit" data-key="'+esc(r.key)+'" value="'+esc(e.unit||r.unit)+'" class="w-24 border rounded-lg px-2 py-2"></td><td class="py-2 px-2 text-right"><input type="number" min="0" step="0.01" data-rs="rate" data-key="'+esc(r.key)+'" value="'+Number(e.rate??RATES[r.key]??0).toFixed(2)+'" class="w-28 border rounded-lg px-2 py-2 text-right"></td></tr>'}).join('')).join('')+'</tbody></table>';
    c.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{const k=input.dataset.key,f=input.dataset.rs,e=editable.get(k)||{};if(f==='rate'){const n=parseFloat(input.value);if(!Number.isFinite(n)||n<0)return;e.rate=n;RATES[k]=n}else if(f==='unit')e.unit=input.value.trim()||'unit';else e.description=input.value.trim()||k;editable.set(k,e);updateSafe()}));
  }

  function patchHomeownerUI(){
    if(isContractor){
      document.getElementById('homeownerQuotationOptions')?.classList.add('hidden');
      document.getElementById('contractorQuotationOptions')?.classList.remove('hidden');
      contractorizeBuildSchedule();
      renderRenovationContractorSchedule();
      return;
    }
    document.getElementById('contractorQuotationOptions')?.classList.add('hidden');
    document.getElementById('homeownerQuotationOptions')?.classList.remove('hidden');
    document.getElementById('rateScheduleSection')?.classList.add('homeowner-hidden');
    document.getElementById('contractorRateSchedule')?.remove();
  }

  // Build Planner exposes getAllItems(); Renovation Planner exposes getData().
  // For contractor mode, apply the edited schedule to the generated quotation data.
  if (typeof window.getAllItems === 'function') {
    const original = window.getAllItems;
    window.getAllItems = function(){
      const items=original();
      if(!isContractor)return items;
      items.forEach(i=>{const k=keyForItem(i);if(!k)return;const e=effective(k,i.description,i.unit,i.rate);i.description=e.description;i.unit=e.unit;i.rate=e.rate;i.amount=(Number(i.qty)||0)*e.rate});
      return items;
    };
  }
  if (typeof window.getData === 'function') {
    const original = window.getData;
    window.getData = function(){
      const d=original();
      if(!isContractor)return d;
      (d.allItems||[]).forEach(i=>{const k=keyForItem(i);if(!k)return;const e=effective(k,i.description,i.unit,i.rate);i.description=e.description;i.unit=e.unit;i.rate=e.rate;i.amount=(Number(i.qty)||0)*e.rate});
      Object.values(d.itemsByRoom||{}).flat().forEach(i=>{const k=keyForItem(i);if(!k)return;const e=effective(k,i.description,i.unit,i.rate);i.description=e.description;i.unit=e.unit;i.rate=e.rate;i.amount=(Number(i.qty)||0)*e.rate});
      d.total=(d.allItems||[]).reduce((s,i)=>s+(Number(i.amount)||0),0)+(Number(d.projectPreliminaries)||0);
      return d;
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(patchHomeownerUI,50));
  else setTimeout(patchHomeownerUI,50);
})();
