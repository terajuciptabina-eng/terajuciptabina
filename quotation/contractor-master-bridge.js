(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const audience = (qs.get('audience') || document.body.dataset.role || '').toLowerCase();
  const contractor = audience === 'contractor';
  const plannerType = /renovationplanner\.html/i.test(location.pathname) ? 'renovation' : 'build';
  const contractorId = (qs.get('contractorId') || '').trim();
  const MARKET_API = 'https://terajuciptabina.vercel.app/api/contractor-market';

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
