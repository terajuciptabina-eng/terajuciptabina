(() => {
  const STATE_KEY = 'terajuBuildPlannerStateBeforeDetailedUnlock';
  const params = new URLSearchParams(location.search);
  const hasQuotationId = Boolean((params.get('quotationId') || '').trim());
  const quotationId = (params.get('quotationId') || '').trim() || 'draft';
  const contractorId = (params.get('contractorId') || localStorage.getItem('teraju.contractor.local.v1.activeContractorId') || 'local').trim() || 'local';
  const ITEM_STATE_KEY = `terajuBuildPlannerItemState.v2.${contractorId}.${quotationId}`;
  const role = (params.get('audience') || document.body.dataset.role || 'homeowner').toLowerCase() === 'contractor' ? 'contractor' : 'homeowner';
  const PROJECT_KEY = `teraju.${role}.build.projectId.v1`;

  function clearNewPlannerState() {
    if (hasQuotationId) return;
    try {
      sessionStorage.removeItem(STATE_KEY);
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(PROJECT_KEY);
      localStorage.removeItem(ITEM_STATE_KEY);
    } catch (e) {
      console.warn('Unable to clear Build Planner state for new quotation', e);
    }
  }

  function captureControls(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input, select, textarea')).map((el) => ({
      value: el.value ?? '',
      checked: typeof el.checked === 'boolean' ? el.checked : undefined
    }));
  }

  function restoreControls(container, controls) {
    if (!container || !Array.isArray(controls)) return;
    const elements = Array.from(container.querySelectorAll('input, select, textarea'));
    elements.forEach((el, index) => {
      const saved = controls[index];
      if (!saved) return;
      if ('value' in el) el.value = saved.value ?? '';
      if (typeof el.checked === 'boolean' && saved.checked !== undefined) el.checked = saved.checked;
    });
  }

  function mapEntries(map) {
    return map instanceof Map ? Array.from(map.entries()) : [];
  }

  function captureItemState() {
    try {
      return {
        manualItems: typeof manualItems !== 'undefined' && manualItems instanceof Map ? mapEntries(manualItems) : null,
        customDescriptions: typeof customDescriptions !== 'undefined' && customDescriptions instanceof Map ? mapEntries(customDescriptions) : null,
        customQuantities: typeof customQuantities !== 'undefined' && customQuantities instanceof Map ? mapEntries(customQuantities) : null,
        customRates: typeof customRates !== 'undefined' && customRates instanceof Map ? mapEntries(customRates) : null,
        excludedItems: typeof excludedItems !== 'undefined' && excludedItems instanceof Set ? Array.from(excludedItems) : null,
        savedAt: Date.now()
      };
    } catch (e) {
      return null;
    }
  }

  function applyItemState(state) {
    if (!state) return;
    try {
      if (Array.isArray(state.manualItems) && typeof manualItems !== 'undefined' && manualItems instanceof Map) {
        manualItems.clear();
        state.manualItems.forEach(([key, value]) => manualItems.set(key, Array.isArray(value) ? value : []));
      }
      if (Array.isArray(state.customDescriptions) && typeof customDescriptions !== 'undefined' && customDescriptions instanceof Map) {
        customDescriptions.clear();
        state.customDescriptions.forEach(([key, value]) => customDescriptions.set(key, value));
      }
      if (Array.isArray(state.customQuantities) && typeof customQuantities !== 'undefined' && customQuantities instanceof Map) {
        customQuantities.clear();
        state.customQuantities.forEach(([key, value]) => customQuantities.set(key, value));
      }
      if (Array.isArray(state.customRates) && typeof customRates !== 'undefined' && customRates instanceof Map) {
        customRates.clear();
        state.customRates.forEach(([key, value]) => customRates.set(key, value));
      }
      if (Array.isArray(state.excludedItems) && typeof excludedItems !== 'undefined' && excludedItems instanceof Set) {
        excludedItems.clear();
        state.excludedItems.forEach((value) => excludedItems.add(value));
      }
      window.__tcBuildPlannerItemStateRestored = true;
    } catch (e) {
      console.warn('Unable to restore Build Planner item state', e);
    }
  }

  function saveItemState(state) {
    try {
      const payload = state || captureItemState();
      if (!payload) return;
      sessionStorage.setItem(ITEM_STATE_KEY, JSON.stringify(payload));
      localStorage.setItem(ITEM_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Unable to save Build Planner item state', e);
    }
  }

  function loadItemState() {
    try {
      const raw = sessionStorage.getItem(ITEM_STATE_KEY) || localStorage.getItem(ITEM_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function savePlannerState() {
    try {
      const rooms = document.getElementById('roomsContainer');
      const itemState = captureItemState();
      const state = {
        builtUpArea: document.getElementById('builtUpArea')?.value ?? '',
        numStoreys: document.getElementById('numStoreys')?.value ?? '1',
        customerName: document.getElementById('customerName')?.value ?? '',
        projectLocation: document.getElementById('projectLocation')?.value ?? '',
        roomsHtml: rooms?.innerHTML ?? '',
        roomControls: captureControls(rooms),
        itemState,
        savedAt: Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      saveItemState(itemState);
    } catch (e) {
      console.warn('Unable to save Build Planner state', e);
    }
  }

  function loadPlannerState() {
    if (!hasQuotationId) return null;
    try {
      const raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function restorePlannerState() {
    const state = loadPlannerState();
    const itemState = state?.itemState || loadItemState();
    applyItemState(itemState);
    if (!state) return;

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== '') el.value = value;
    };

    setValue('customerName', state.customerName);
    setValue('projectLocation', state.projectLocation);
    setValue('builtUpArea', state.builtUpArea);
    setValue('numStoreys', state.numStoreys || '1');

    const rooms = document.getElementById('roomsContainer');
    if (rooms && state.roomsHtml) {
      rooms.innerHTML = state.roomsHtml;
      restoreControls(rooms, state.roomControls);
    }

    if (typeof window.updateEstimate === 'function') {
      window.updateEstimate();
    }

    applyItemState(itemState);
    if (typeof window.renderConstructionBudget === 'function') {
      window.renderConstructionBudget();
    }
    window.__tcBuildPlannerStateRestored = true;
  }

  function hookLivePersistence() {
    if (document.documentElement.dataset.tcPlannerStateHooked === '1') return;
    document.documentElement.dataset.tcPlannerStateHooked = '1';

    document.addEventListener('input', (event) => {
      const target = event.target;
      const rooms = document.getElementById('roomsContainer');
      if (
        target?.id === 'builtUpArea' ||
        target?.id === 'customerName' ||
        target?.id === 'projectLocation' ||
        (rooms && rooms.contains(target))
      ) {
        savePlannerState();
      }
    }, true);

    document.addEventListener('change', (event) => {
      const target = event.target;
      const rooms = document.getElementById('roomsContainer');
      if (
        target?.id === 'numStoreys' ||
        (rooms && rooms.contains(target))
      ) {
        savePlannerState();
      }
    }, true);

    window.addEventListener('pagehide', savePlannerState);
    window.addEventListener('beforeunload', savePlannerState);
  }

  function hookPaymentButton() {
    const button = document.getElementById('paymentProceedButton');
    if (!button || button.dataset.tcStateHooked === '1') return;
    button.dataset.tcStateHooked = '1';
    button.addEventListener('click', savePlannerState, true);
  }

  function hookUpdateEstimatePersistence() {
    if (window.__tcBuildPlannerUpdateEstimateHooked || typeof window.updateEstimate !== 'function') return;
    const original = window.updateEstimate;
    window.updateEstimate = function (...args) {
      const itemState = captureItemState() || loadItemState();
      saveItemState(itemState);
      const result = original.apply(this, args);
      applyItemState(itemState);
      if (typeof window.renderConstructionBudget === 'function') {
        window.renderConstructionBudget();
      }
      saveItemState(captureItemState());
      return result;
    };
    window.__tcBuildPlannerUpdateEstimateHooked = true;
  }

  function init() {
    clearNewPlannerState();
    restorePlannerState();
    hookLivePersistence();
    hookPaymentButton();
    hookUpdateEstimatePersistence();
    const observer = new MutationObserver(() => {
      hookPaymentButton();
      hookUpdateEstimatePersistence();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  window.saveBuildPlannerState = savePlannerState;
  window.restoreBuildPlannerState = restorePlannerState;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
