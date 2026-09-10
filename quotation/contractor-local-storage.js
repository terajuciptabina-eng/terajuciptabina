(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
  if (window.__tcContractorLocalStorageInstalled) return;
  window.__tcContractorLocalStorageInstalled = true;

  const PREFIX = 'teraju.contractor.local.v1';
  const params = new URLSearchParams(location.search);
  const projectType = /renovationplanner\.html$/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = params.get('contractorId') || localStorage.getItem(`${PREFIX}.activeContractorId`);
  if (!contractorId) return;

  localStorage.setItem(`${PREFIX}.activeContractorId`, contractorId);
  const stateFromUrl = (params.get('state') || '').trim().toLowerCase();
  let currentState = stateFromUrl || String(window.TERAJU_SELECTED_STATE || window.TERAJU_RATE_CONTEXT?.state || '').trim().toLowerCase();
  const legacyKey = `${PREFIX}.${encodeURIComponent(contractorId)}.${projectType}`;
  const keyFor = state => `${PREFIX}.v2.${encodeURIComponent(contractorId)}.${encodeURIComponent(state || 'unselected')}.${projectType}`;
  let key = keyFor(currentState);
  const safeParse = v => { try { return v ? JSON.parse(v) : null; } catch (_) { return null; } };

  function selectedState() {
    return String(window.TERAJU_SELECTED_STATE || window.TERAJU_RATE_CONTEXT?.state || currentState || '').trim().toLowerCase();
  }

  function switchKey(state, migrateLegacy = false) {
    const next = String(state || '').trim().toLowerCase();
    if (!next || next === currentState) return false;
    currentState = next;
    key = keyFor(currentState);
    if (migrateLegacy && !localStorage.getItem(key)) {
      const legacy = safeParse(localStorage.getItem(legacyKey));
      if (legacy) {
        legacy.schemaVersion = 3;
        legacy.state = currentState;
        legacy.rateSetId = window.TERAJU_RATE_CONTEXT?.rateSetId || currentState;
        localStorage.setItem(key, JSON.stringify(legacy));
      }
    }
    return true;
  }

  function collectItems() {
    if (projectType === 'build' && typeof window.getAllItems === 'function') {
      return {
        items: window.getAllItems().map(i => ({ ...i })),
        excluded: window.__tcExcludedItems ? Array.from(window.__tcExcludedItems) : []
      };
    }
    if (projectType === 'renovation' && typeof window.getData === 'function') {
      const data = window.getData() || {};
      const state = window.__tcRenovationContractorState;
      const rates = state?.rates || new Map();
      const descriptions = state?.descriptions || new Map();
      const items = (data.allItems || []).map(i => ({
        ...i,
        rate: rates.has(i.id) ? rates.get(i.id) : i.rate,
        description: descriptions.has(i.id) ? descriptions.get(i.id) : i.description,
        amount: i.qty * (rates.has(i.id) ? rates.get(i.id) : i.rate)
      }));
      if (state?.rates?.has('project-preliminaries')) {
        items.push({ id:'project-preliminaries', qty:1, rate:state.rates.get('project-preliminaries'), description:descriptions.get('project-preliminaries') || 'Renovation permit application and related professional drawings / submission requirements' });
      }
      return { items, excluded: state ? Array.from(state.excluded || []) : [] };
    }
    return null;
  }

  function collect() {
    const itemState = collectItems();
    if (!itemState) return null;
    const value = id => document.getElementById(id)?.value ?? '';
    const rooms = document.getElementById('roomsContainer');
    const activeState = selectedState();
    return {
      schemaVersion: 3,
      contractorId,
      projectType,
      state: activeState || null,
      rateSetId: window.TERAJU_RATE_CONTEXT?.rateSetId || activeState || null,
      savedAt: new Date().toISOString(),
      project: {
        customerName: value('customerName'),
        projectLocation: value('projectLocation'),
        builtUpArea: value('builtUpArea'),
        numStoreys: value('numStoreys'),
        roomsHtml: rooms?.innerHTML ?? '',
        roomControls: rooms ? Array.from(rooms.querySelectorAll('input,select,textarea')).map(el => ({ value: el.value ?? '', checked: typeof el.checked === 'boolean' ? el.checked : undefined })) : []
      },
      itemState
    };
  }

  function restoreRooms(project) {
    if (projectType !== 'build' || !project?.roomsHtml) return;
    const rooms = document.getElementById('roomsContainer');
    if (!rooms) return;
    rooms.innerHTML = project.roomsHtml;
    if (Array.isArray(project.roomControls)) {
      Array.from(rooms.querySelectorAll('input,select,textarea')).forEach((el, i) => {
        const saved = project.roomControls[i];
        if (!saved) return;
        if ('value' in el) el.value = saved.value ?? '';
        if (typeof el.checked === 'boolean' && saved.checked !== undefined) el.checked = saved.checked;
      });
    }
  }

  function restore() {
    const activeState = selectedState();
    if (activeState) switchKey(activeState, true);
    const record = safeParse(localStorage.getItem(key));
    if (!record) return;
    if (record.state && activeState && String(record.state).toLowerCase() !== activeState) return;
    const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined && value !== null) el.value = value; };
    set('customerName', record.project?.customerName);
    set('projectLocation', record.project?.projectLocation);
    set('builtUpArea', record.project?.builtUpArea);
    set('numStoreys', record.project?.numStoreys);
    restoreRooms(record.project);

    if (projectType === 'build') {
      const excluded = window.__tcExcludedItems || new Set();
      excluded.clear();
      (record.itemState?.excluded || []).forEach(id => excluded.add(id));
      window.__tcExcludedItems = excluded;
      (record.itemState?.items || []).forEach(saved => {
        if (typeof window.editItemDescription === 'function' && saved.description !== undefined) window.editItemDescription(saved.id, saved.description);
        if (typeof window.editItemQuantity === 'function' && saved.qty !== undefined) window.editItemQuantity(saved.id, saved.qty);
        if (typeof window.editItemRate === 'function' && saved.rate !== undefined) window.editItemRate(saved.id, saved.rate);
      });
    } else if (projectType === 'renovation') {
      window.__tcRenovationContractorState = window.__tcRenovationContractorState || { excluded:new Set(), rates:new Map(), descriptions:new Map() };
      const s = window.__tcRenovationContractorState;
      s.excluded.clear();
      s.rates.clear();
      s.descriptions.clear();
      (record.itemState?.excluded || []).forEach(id => s.excluded.add(id));
      (record.itemState?.items || []).forEach(saved => {
        if (saved.id === 'project-preliminaries') {
          s.rates.set(saved.id, Number(saved.rate) || 0);
          s.descriptions.set(saved.id, saved.description ?? '');
          return;
        }
        if (typeof window.editItemQuantity === 'function' && saved.qty !== undefined) window.editItemQuantity(saved.id, saved.qty);
        s.rates.set(saved.id, Number(saved.rate) || 0);
        s.descriptions.set(saved.id, saved.description ?? '');
      });
    }
    if (typeof window.updateEstimate === 'function') window.updateEstimate();
  }

  function save() {
    try {
      const activeState = selectedState();
      if (activeState) switchKey(activeState, true);
      const record = collect();
      if (record) localStorage.setItem(key, JSON.stringify(record));
    } catch (e) { console.warn('[Teraju] local contractor save failed', e); }
  }

  window.__tcSaveLocalContractorData = save;
  window.__tcLoadLocalContractorData = restore;

  window.addEventListener('teraju:ratechange', () => {
    const activeState = selectedState();
    if (!activeState || activeState === currentState) return;
    switchKey(activeState, false);
    restore();
  });
  window.addEventListener('teraju:statechange', event => {
    const activeState = String(event?.detail?.state || '').trim().toLowerCase();
    if (!activeState) return;
    save();
    switchKey(activeState, false);
    restore();
  });

  function install() {
    restore();
    document.addEventListener('input', save, true);
    document.addEventListener('change', save, true);
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
