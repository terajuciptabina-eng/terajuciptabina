(() => {
  function roundQuotationQuantities() {
    const root = document.getElementById('quotationContent');
    if (!root) return;
    root.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
      const quantityIndex = headers.findIndex(h => h === 'quantity' || h.includes('quantity'));
      if (quantityIndex < 0) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        const cell = row.children[quantityIndex];
        if (!cell) return;
        const match = cell.textContent.trim().match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
        if (!match) return;
        const value = Number(match[1]);
        if (!Number.isFinite(value)) return;
        const rounded = Math.max(1, Math.ceil(value));
        const unit = match[2] || '';
        cell.textContent = `${rounded}${unit ? ` ${unit}` : ''}`;
      });
    });
  }

  function quantityObserver() {
    const root = document.getElementById('quotationContent');
    if (!root) return;
    roundQuotationQuantities();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      roundQuotationQuantities();
      observer.observe(root, { childList: true, subtree: true });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || 'homeowner').toLowerCase();
  const contractor = audience === 'contractor';
  window.TERAJU_AUDIENCE = contractor ? 'contractor' : 'homeowner';
  document.body.classList.toggle('contractor-mode', contractor);
  document.body.classList.toggle('homeowner-mode', !contractor);

  const edits = new Map();
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const getEdit = key => edits.get(key) || {};
  const setEdit = (key, field, value) => {
    const e = {...getEdit(key)};
    e[field] = value;
    edits.set(key, e);
  };
  const effective = (key, item) => {
    const e = getEdit(key);
    return {
      description: e.description || item.description,
      unit: e.unit || item.unit,
      rate: Number.isFinite(e.rate) ? e.rate : Number(item.rate) || 0
    };
  };

  const buildRateKeys = new Map([
    ['prelim-1','permit'], ['prelim-2','prelim'],
    ['elec-db','dbBox'], ['elec-wiring','wiring'], ['elec-pp','powerPoint'], ['elec-switch','switch'],
    ['elec-light','lighting'], ['elec-fan','fan'], ['elec-ac','aircond'], ['elec-earth','earthing']
  ]);
  if (typeof STRUCT_GROUPS !== 'undefined') {
    STRUCT_GROUPS.forEach(g => g.items.forEach(item => buildRateKeys.set(item.id, item.rateKey)));
  }

  function buildRoomKey(item) {
    const id = String(item.id || '');
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

  function applyBuildEdits(items) {
    items.forEach(item => {
      const key = buildRateKeys.get(item.id) || buildRoomKey(item);
      if (!key) return;
      const result = effective(key, item);
      item.description = result.description;
      item.unit = result.unit;
      item.rate = result.rate;
      item.amount = (Number(item.qty) || 0) * result.rate;
    });
    return items;
  }

  function renderBuildSchedule() {
    if (!contractor || typeof RATE_SCHEDULE === 'undefined' || typeof RATES === 'undefined') return;
    const section = document.getElementById('rateScheduleSection');
    const content = document.getElementById('rateScheduleContent');
    if (!section || !content) return;
    section.classList.remove('homeowner-hidden');
    document.getElementById('rateSchedulePanel')?.classList.remove('hidden');
    content.innerHTML = '<table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th></tr></thead><tbody>' +
      RATE_SCHEDULE.map(group => '<tr class="bg-gray-100 border-b"><td colspan="3" class="py-2 px-2 font-bold">' + esc(group.title) + '</td></tr>' +
        group.rows.map(row => {
          const e = getEdit(row.key);
          const desc = e.description || row.label;
          const unit = e.unit || row.unit;
          const rate = Number.isFinite(e.rate) ? e.rate : Number(RATES[row.key] ?? 0);
          return '<tr class="border-b"><td class="py-2 px-2"><input data-contractor-key="' + esc(row.key) + '" data-field="description" value="' + esc(desc) + '" class="w-full min-w-[260px] border rounded-lg px-2 py-2 bg-white"></td><td class="py-2 px-2"><input data-contractor-key="' + esc(row.key) + '" data-field="unit" value="' + esc(unit) + '" class="w-24 border rounded-lg px-2 py-2 bg-white"></td><td class="py-2 px-2 text-right"><input type="number" min="0" step="0.01" data-contractor-key="' + esc(row.key) + '" data-field="rate" value="' + rate.toFixed(2) + '" class="w-28 border rounded-lg px-2 py-2 text-right bg-white"></td></tr>';
        }).join('')).join('') + '</tbody></table>';
    content.querySelectorAll('input[data-contractor-key]').forEach(input => input.addEventListener('change', () => {
      const key = input.dataset.contractorKey;
      const field = input.dataset.field;
      if (field === 'rate') {
        const n = parseFloat(input.value);
        if (!Number.isFinite(n) || n < 0) { renderBuildSchedule(); return; }
        RATES[key] = n;
        setEdit(key, 'rate', n);
      } else setEdit(key, field, input.value.trim());
      if (typeof updateEstimate === 'function') updateEstimate();
    }));
  }

  function setupBuildContractor() {
    if (!contractor || typeof RATE_SCHEDULE === 'undefined') return false;
    document.getElementById('homeownerQuotationOptions')?.classList.add('hidden');
    document.getElementById('contractorQuotationOptions')?.classList.remove('hidden');
    const originalToggle = window.toggleRateSchedule;
    if (originalToggle && !originalToggle.__terajuWrapped) {
      const wrapped = function() { originalToggle(); if (contractor) renderBuildSchedule(); };
      wrapped.__terajuWrapped = true;
      window.toggleRateSchedule = wrapped;
    }
    const originalReset = window.resetRatesToDefault;
    if (originalReset && !originalReset.__terajuWrapped) {
      const wrapped = function() { edits.clear(); originalReset(); renderBuildSchedule(); };
      wrapped.__terajuWrapped = true;
      window.resetRatesToDefault = wrapped;
    }
    if (window.getAllItems && !window.getAllItems.__terajuWrapped) {
      const originalGetAllItems = window.getAllItems;
      const wrapped = function() { return applyBuildEdits(originalGetAllItems()); };
      wrapped.__terajuWrapped = true;
      window.getAllItems = wrapped;
    }
    renderBuildSchedule();
    return true;
  }

  function renovationLabels() {
    return {
      ceiling:'Plaster ceiling flat c/w paint', spc:'SPC flooring c/w skirting and floor mat', floorTile:'Floor tiles c/w waterproofing',
      wallTile:'Wall tiles c/w waterproofing', facadeWall:'Facade wall', downlight:'Downlight c/w wiring', wallLight:'Wall light c/w wiring',
      ceilingFan:'Ceiling fan c/w wiring', exhaustFan:'Exhaust fan c/w wiring', curtainBoxLED:'LED light for curtain box c/w wiring', barLamp:'Bar / kitchen lamp c/w wiring',
      kitchenFrame:'Laminated arce frame', kitchenMakingGood:'Making good after demolition', kitchenGlassDoor:'Swing glass door', bathroomSanitary:'Toilet accessories / sanitary set',
      bathroomDoor:'Toilet swing door', gateMotor:'Main gate c/w automatic motor', wallDivider:'Side brickwall divider c/w plaster and paint', frontFence:'Front fence brickwall',
      preliminaries:'Renovation permit / professional submission', extensionKitchen:'New kitchen extension works', extensionToilet:'New toilet extension works'
    };
  }

  function renderRenovationSchedule() {
    if (!contractor || typeof RATES === 'undefined' || typeof getData !== 'function') return;
    if (document.getElementById('contractorRateSchedule')) return;
    const labels = renovationLabels();
    const section = document.createElement('section');
    section.id = 'contractorRateSchedule';
    section.className = 'no-print bg-white rounded-2xl shadow-sm p-6 mb-6';
    section.innerHTML = '<div class="flex justify-between items-center mb-4"><div><h3 class="font-bold text-lg">Contractor Rate Schedule</h3><p class="text-sm text-gray-500">Edit description, unit and rate. Changes apply to the estimate and quotations.</p></div><button type="button" id="resetContractorRates" class="border px-4 py-2 rounded-lg text-sm">Reset</button></div><div id="contractorRateScheduleContent" class="overflow-x-auto"></div>';
    const estimate = document.getElementById('estimateContent')?.closest('section');
    estimate?.parentNode.insertBefore(section, estimate);
    const content = section.querySelector('#contractorRateScheduleContent');
    const rows = Object.keys(RATES).map(key => {
      const e = getEdit(key), fallback = labels[key] || key;
      const unit = e.unit || (key === 'preliminaries' ? 'ls' : 'unit');
      const rate = Number.isFinite(e.rate) ? e.rate : Number(RATES[key] || 0);
      return '<tr class="border-b"><td class="py-2 px-2"><input data-key="' + esc(key) + '" data-field="description" value="' + esc(e.description || fallback) + '" class="w-full min-w-[260px] border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input data-key="' + esc(key) + '" data-field="unit" value="' + esc(unit) + '" class="w-24 border rounded-lg px-2 py-2"></td><td class="py-2 px-2"><input type="number" min="0" step="0.01" data-key="' + esc(key) + '" data-field="rate" value="' + rate.toFixed(2) + '" class="w-32 border rounded-lg px-2 py-2 text-right"></td></tr>';
    }).join('');
    content.innerHTML = '<table class="w-full border-collapse text-sm"><thead><tr class="border-b-2 text-left"><th class="py-2 px-2">Description</th><th class="py-2 px-2">Unit</th><th class="py-2 px-2 text-right">Rate (RM)</th></tr></thead><tbody>' + rows + '</tbody></table>';
    content.querySelectorAll('input[data-key]').forEach(input => input.addEventListener('change', () => {
      const key = input.dataset.key, field = input.dataset.field;
      if (field === 'rate') {
        const n = parseFloat(input.value);
        if (!Number.isFinite(n) || n < 0) { renderRenovationSchedule(); return; }
        RATES[key] = n; setEdit(key, 'rate', n);
      } else setEdit(key, field, input.value.trim());
      updateEstimate?.();
    }));
    section.querySelector('#resetContractorRates').addEventListener('click', () => {
      edits.clear();
      if (typeof DEFAULT_RATES !== 'undefined') RATES = {...DEFAULT_RATES};
      section.remove();
      renderRenovationSchedule();
      updateEstimate?.();
    });
  }

  function setupRenovationContractor() {
    if (!contractor || typeof getData !== 'function' || typeof RATES === 'undefined') return false;
    const quotationSection = Array.from(document.querySelectorAll('section.no-print')).find(section => section.querySelector('[onclick="generateSimpleQuotation()"]'));
    if (quotationSection) {
      quotationSection.innerHTML = '<div class="mb-5"><h3 class="font-bold text-lg">Generate Contractor Quotation</h3><p class="text-sm text-gray-500">Choose the quotation detail level. Contractor quotations are available without homeowner payment unlock.</p></div><div id="renovationContractorQuotationOptions" class="grid md:grid-cols-2 gap-4"><label class="border rounded-xl p-4"><input type="radio" name="renovationQuotationType" value="simple" checked> Simple Quotation</label><label class="border rounded-xl p-4"><input type="radio" name="renovationQuotationType" value="detail"> Detailed Quotation</label></div><button type="button" id="generateRenovationContractorQuotation" class="mt-5 bg-black text-white px-5 py-3 rounded-lg font-semibold">Generate Quotation</button>';
      document.getElementById('generateRenovationContractorQuotation').onclick = () => {
        const type = document.querySelector('input[name="renovationQuotationType"]:checked')?.value || 'simple';
        if (type === 'simple') window.generateSimpleQuotation();
        else window.generateContractorDetailedQuotation();
      };
    }
    if (window.getData && !window.getData.__terajuWrapped) {
      const originalGetData = window.getData;
      const wrapped = function() {
        const d = originalGetData();
        d.allItems?.forEach(item => {
          const key = item.id === 'project-preliminaries' ? 'preliminaries' : item.id.split('-').pop();
          const e = getEdit(key);
          if (!e.description && !e.unit && !Number.isFinite(e.rate)) return;
          const result = effective(key, item);
          item.description = result.description;
          item.unit = result.unit;
          item.rate = result.rate;
          item.amount = (Number(item.qty) || 0) * result.rate;
        });
        const p = getEdit('preliminaries');
        if (Number.isFinite(p.rate)) d.projectPreliminaries = p.rate;
        d.total = d.projectPreliminaries + (d.allItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        return d;
      };
      wrapped.__terajuWrapped = true;
      window.getData = wrapped;
    }
    window.generateContractorDetailedQuotation = function() {
      const d = window.getData();
      if (!d.roomGroups.some(r => r.area > 0)) { alert('Please add at least one area with a valid sqft before generating the quotation.'); return; }
      quotationNumber = typeof generateQuotationNumber === 'function' ? generateQuotationNumber() : ('QO' + Date.now());
      let html = detailHtml(d);
      const p = getEdit('preliminaries');
      if (p.description) html = html.replace("Submission of Renovation Permit Application and Engineer's Drawings to the Local Authority", esc(p.description));
      if (p.unit) {
        const marker = p.description ? esc(p.description) : "Submission of Renovation Permit Application and Engineer's Drawings to the Local Authority";
        const pos = html.indexOf(marker);
        if (pos >= 0) {
          const tdPos = html.indexOf('<td>ls</td>', pos);
          if (tdPos >= 0) html = html.slice(0, tdPos) + '<td>' + esc(p.unit) + '</td>' + html.slice(tdPos + '<td>ls</td>'.length);
        }
      }
      document.getElementById('quotationContent').innerHTML = html;
      document.getElementById('quotationPrintActions').classList.remove('hidden');
      document.getElementById('quotationDocument').classList.remove('hidden');
      document.getElementById('quotationDocument').scrollIntoView({behavior:'smooth',block:'start'});
    };
    renderRenovationSchedule();
    return true;
  }

  function applyUI() {
    if (!contractor) {
      document.getElementById('contractorQuotationOptions')?.classList.add('hidden');
      document.getElementById('homeownerQuotationOptions')?.classList.remove('hidden');
      document.getElementById('rateScheduleSection')?.classList.add('homeowner-hidden');
      return;
    }
    if (!setupBuildContractor()) setupRenovationContractor();
  }

  function init() {
    applyUI();
    quantityObserver();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 30));
  else setTimeout(init, 30);
})();