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
  const key = `${PREFIX}.${encodeURIComponent(contractorId)}.${projectType}`;
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
    const value = id => document.getElementById(id)?.value ?? '';
    const rooms = document.getElementById('roomsContainer');
    return {
      schemaVersion: 2,
      contractorId,
      projectType,
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
    const record = safeParse(localStorage.getItem(key));
    if (!record) return;
    const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined && value !== null) el.value = value; };
    set('customerName', record.project?.customerName);
    set('projectLocation', record.project?.projectLocation);
    set('builtUpArea', record.project?.builtUpArea);
    set('numStoreys', record.project?.numStoreys);
    restoreRooms(record.project);

    if (projectType === 'build') {
      window.__tcExcludedItems = new Set(record.itemState?.excluded || []);
      (record.itemState?.items || []).forEach(saved => {
        if (typeof window.editItemDescription === 'function' && saved.description !== undefined) window.editItemDescription(saved.id, saved.description);
        if (typeof window.editItemQuantity === 'function' && saved.qty !== undefined) window.editItemQuantity(saved.id, saved.qty);
        if (typeof window.editItemRate === 'function' && saved.rate !== undefined) window.editItemRate(saved.id, saved.rate);
      });
    } else if (projectType === 'renovation') {
      window.__tcRenovationContractorState = window.__tcRenovationContractorState || { excluded:new Set(), rates:new Map(), descriptions:new Map() };
      const s = window.__tcRenovationContractorState;
      s.excluded = new Set(record.itemState?.excluded || []);
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
    try { const record = collect(); if (record) localStorage.setItem(key, JSON.stringify(record)); }
    catch (e) { console.warn('[Teraju] local contractor save failed', e); }
  }

  window.__tcSaveLocalContractorData = save;
  window.__tcLoadLocalContractorData = restore;

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
