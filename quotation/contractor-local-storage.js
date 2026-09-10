(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('audience') !== 'contractor') return;
  if (window.__tcContractorLocalStorageInstalled) return;
  window.__tcContractorLocalStorageInstalled = true;

  const PREFIX = 'teraju.contractor.local.v2';
  const LEGACY_PREFIX = 'teraju.contractor.local.v1';
  const params = new URLSearchParams(location.search);
  const projectType = /renovationplanner\.html$/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = params.get('contractorId') || localStorage.getItem(`${LEGACY_PREFIX}.activeContractorId`);
  if (!contractorId) return;

  localStorage.setItem(`${LEGACY_PREFIX}.activeContractorId`, contractorId);
  const encodedContractorId = encodeURIComponent(contractorId);
  let currentState = '';
  let restoring = false;

  function selectedState() {
    return String(
      window.TERAJU_SELECTED_STATE ||
      window.TERAJU_RATE_CONTEXT?.state ||
      params.get('state') ||
      ''
    ).trim().toLowerCase();
  }

  function storageKey(state = selectedState()) {
    return state
      ? `${PREFIX}.${encodedContractorId}.${encodeURIComponent(state)}.${projectType}`
      : '';
  }

  function legacyKey() {
    return `${LEGACY_PREFIX}.${encodedContractorId}.${projectType}`;
  }

  const safeParse = v => { try { return v ? JSON.parse(v) : null; } catch (_) { return null; } };

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
    const state = selectedState();
    if (!state) return null;
    const value = id => document.getElementById(id)?.value ?? '';
    const rooms = document.getElementById('roomsContainer');
    return {
      schemaVersion: 3,
      contractorId,
      projectType,
      state,
      rateSetId: window.TERAJU_RATE_CONTEXT?.rateSetId || state,
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

  function restoreRecord(record) {
    if (!record) return;
    restoring = true;
    try {
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
    } finally {
      restoring = false;
    }
  }

  function migrateLegacy(state) {
    if (!state || localStorage.getItem(storageKey(state))) return null;
    const legacy = safeParse(localStorage.getItem(legacyKey()));
    if (!legacy) return null;
    const migrated = { ...legacy, schemaVersion:3, state, rateSetId: window.TERAJU_RATE_CONTEXT?.rateSetId || state, migratedAt:new Date().toISOString() };
    try { localStorage.setItem(storageKey(state), JSON.stringify(migrated)); } catch (_) {}
    return migrated;
  }

  function restore() {
    const state = selectedState();
    if (!state) return;
    currentState = state;
    const record = safeParse(localStorage.getItem(storageKey(state))) || migrateLegacy(state);
    restoreRecord(record);
  }

  function save() {
    if (restoring) return;
    try {
      const state = selectedState();
      if (!state) return;
      const record = collect();
      if (record) localStorage.setItem(storageKey(state), JSON.stringify(record));
      currentState = state;
    } catch (e) { console.warn('[Teraju] local contractor save failed', e); }
  }

  function handleStateChange() {
    const nextState = selectedState();
    if (!nextState || nextState === currentState) return;
    restore();
  }

  window.__tcSaveLocalContractorData = save;
  window.__tcLoadLocalContractorData = restore;

  function install() {
    restore();
    document.addEventListener('input', save, true);
    document.addEventListener('change', save, true);
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    window.addEventListener('teraju:statechange', handleStateChange);
    document.addEventListener('teraju:statechange', handleStateChange);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
