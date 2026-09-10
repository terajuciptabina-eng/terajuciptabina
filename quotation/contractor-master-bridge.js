(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || document.body.dataset.role || '').toLowerCase();
  const contractor = audience === 'contractor';
  const plannerType = /renovationplanner\.html/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = (qs.get('contractorId') || '').trim();
  const MARKET_API = 'https://terajuciptabina.vercel.app/api/contractor-market';
  const state = (window.TERAJU_SELECTED_STATE || window.TERAJU_RATE_CONTEXT?.state || qs.get('state') || '').trim().toLowerCase();
  const buildStorageKey = contractorId && state ? `teraju.contractor.local.v2.${contractorId}.${state}.build` : '';

  const captureSignatures = new Map();
  async function captureItem(item) {
    if (!contractor || !contractorId || !item || !item.custom) return;
    const payload = {
      contractorId,
      plannerType,
      state: state || null,
      rateSetId: window.TERAJU_RATE_CONTEXT?.rateSetId || state || null,
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
    if (captureSignatures.get(payload.customItemId) === sig) return;
    try {
      const r = await fetch(MARKET_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.ok) captureSignatures.set(payload.customItemId, sig);
    } catch (_) {}
  }

  function readBuildCustomItems() {
    if (!contractor || plannerType !== 'build' || !buildStorageKey) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(buildStorageKey) || 'null');
      return Array.isArray(saved?.standardRateItems) ? saved.standardRateItems : [];
    } catch (_) { return []; }
  }

  function captureCurrentCustomItems() {
    readBuildCustomItems().filter(x => x && x.custom).forEach(captureItem);
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
          const saved = JSON.parse(localStorage.getItem(buildStorageKey) || 'null');
          const items = Array.isArray(saved?.standardRateItems) ? saved.standardRateItems : [];
          const item = items[items.length - 1];
          if (item && item.custom) {
            if (selected && selected !== '__new__') item.sourceGlobalId = selected;
            item.customItemId = item.customItemId || item.id;
            saved.standardRateItems = items;
            localStorage.setItem(buildStorageKey, JSON.stringify(saved));
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
    const wrapped = async function() {
      captureCurrentCustomItems();
      return original.apply(this, arguments);
    };
    wrapped.__terajuMarketWrapped = true;
    window.saveQuotation = wrapped;
    return true;
  }

  function init() {
    const a = wrapSaveManualItem();
    const b = wrapQuotationSave();
    if (contractor && (!a || !b)) setTimeout(init, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
