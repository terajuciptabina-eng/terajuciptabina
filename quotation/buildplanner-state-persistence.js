(() => {
  const STATE_KEY = 'terajuBuildPlannerStateBeforeDetailedUnlock';
  const params = new URLSearchParams(location.search);
  const hasQuotationId = Boolean((params.get('quotationId') || '').trim());
  const role = (params.get('audience') || document.body.dataset.role || 'homeowner').toLowerCase() === 'contractor' ? 'contractor' : 'homeowner';
  const PROJECT_KEY = `teraju.${role}.build.projectId.v1`;

  function clearNewPlannerState() {
    if (hasQuotationId) return;
    try {
      sessionStorage.removeItem(STATE_KEY);
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(PROJECT_KEY);
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

  function savePlannerState() {
    try {
      const rooms = document.getElementById('roomsContainer');
      const state = {
        builtUpArea: document.getElementById('builtUpArea')?.value ?? '',
        numStoreys: document.getElementById('numStoreys')?.value ?? '1',
        customerName: document.getElementById('customerName')?.value ?? '',
        projectLocation: document.getElementById('projectLocation')?.value ?? '',
        roomsHtml: rooms?.innerHTML ?? '',
        roomControls: captureControls(rooms),
        savedAt: Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
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

  function init() {
    clearNewPlannerState();
    restorePlannerState();
    hookLivePersistence();
    hookPaymentButton();
    const observer = new MutationObserver(() => hookPaymentButton());
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
