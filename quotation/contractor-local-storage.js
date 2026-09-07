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

  const key = `${PREFIX}.${encodeURIComponent(contractorId)}.${projectType}`;
  const safeParse = (v) => { try { return v ? JSON.parse(v) : null; } catch (_) { return null; } };
  const save = () => {
    try {
      const record = collect();
      if (record) localStorage.setItem(key, JSON.stringify(record));
    } catch (e) { console.warn('[Teraju] local save failed', e); }
  };

  function collectItems() {
    if (projectType === 'build' && typeof window.getAllItems === 'function') {
      const items = window.getAllItems();
      const excluded = window.__tcExcludedItems ? Array.from(window.__tcExcludedItems) : [];
      return { items, excluded };
    }
    if (projectType === 'renovation' && typeof window.getData === 'function') {
      const data = window.getData();
      const state = window.__tcRenovationContractorState;
      return {
        items: data?.allItems || [],
        excluded: state ? Array.from(state.excluded || []) : []
      };
    }
    return null;
  }

  function collect() {
    const itemState = collectItems();
    if (!itemState) return null;
    const value = id => document.getElementById(id)?.value ?? '';
    const rooms = Array.from(document.querySelectorAll('#roomsContainer .room-card, #roomsContainer > div')).map(el => el.outerHTML);
    return {
      schemaVersion: 1,
      contractorId,
      projectType,
      savedAt: new Date().toISOString(),
      project: {
        customerName: value('customerName'),
        projectLocation: value('projectLocation'),
        builtUpArea: value('builtUpArea'),
        numStoreys: value('numStoreys'),
        roomsHtml: rooms
      },
      itemState
    };
  }

  function restore() {
    const record = safeParse(localStorage.getItem(key));
    if (!record) return;
    const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined && value !== null) el.value = value; };
    set('customerName', record.project?.customerName);
    set('projectLocation', record.project?.projectLocation);
    set('builtUpArea', record.project?.builtUpArea);
    set('numStoreys', record.project?.numStoreys);

    if (projectType === 'build') {
      window.__tcExcludedItems = new Set(record.itemState?.excluded || []);
      if (typeof window.editItemDescription === 'function') {
        (record.itemState?.items || []).forEach(saved => {
          const current = window.getAllItems?.().find(i => i.id === saved.id);
          if (!current) return;
          window.editItemDescription(saved.id, saved.description);
          window.editItemQuantity(saved.id, saved.qty);
          window.editItemRate(saved.id, saved.rate);
        });
      }
    } else if (projectType === 'renovation') {
      window.__tcRenovationContractorState = window.__tcRenovationContractorState || { excluded:new Set(), rates:new Map(), descriptions:new Map() };
      const s = window.__tcRenovationContractorState;
      s.excluded = new Set(record.itemState?.excluded || []);
      (record.itemState?.items || []).forEach(saved => {
        s.rates.set(saved.id, Number(saved.rate) || 0);
        s.descriptions.set(saved.id, saved.description ?? '');
      });
    }
    if (typeof window.updateEstimate === 'function') window.updateEstimate();
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
