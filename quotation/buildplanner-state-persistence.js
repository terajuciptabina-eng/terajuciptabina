(() => {
  const STATE_KEY = 'terajuBuildPlannerStateBeforeDetailedUnlock';

  function savePlannerState() {
    try {
      const state = {
        builtUpArea: document.getElementById('builtUpArea')?.value ?? '',
        numStoreys: document.getElementById('numStoreys')?.value ?? '1',
        customerName: document.getElementById('customerName')?.value ?? '',
        projectLocation: document.getElementById('projectLocation')?.value ?? '',
        roomsHtml: document.getElementById('roomsContainer')?.innerHTML ?? '',
        savedAt: Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Unable to save Build Planner state', e);
    }
  }

  function loadPlannerState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function restorePlannerState() {
    const params = new URLSearchParams(window.location.search);
    const returningFromPayment = params.has('status_id') || params.has('billcode') || params.has('order_id');
    if (!returningFromPayment) return;

    const state = loadPlannerState();
    if (!state || !state.roomsHtml) return;

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined) el.value = value;
    };

    setValue('customerName', state.customerName);
    setValue('projectLocation', state.projectLocation);
    setValue('builtUpArea', state.builtUpArea);
    setValue('numStoreys', state.numStoreys || '1');

    const rooms = document.getElementById('roomsContainer');
    if (rooms) rooms.innerHTML = state.roomsHtml;

    if (typeof window.updateEstimate === 'function') {
      window.updateEstimate();
    }

    window.__tcBuildPlannerStateRestored = true;
  }

  function hookPaymentButton() {
    const button = document.getElementById('paymentProceedButton');
    if (!button || button.dataset.tcStateHooked === '1') return;
    button.dataset.tcStateHooked = '1';
    button.addEventListener('click', savePlannerState, true);
  }

  function init() {
    restorePlannerState();
    hookPaymentButton();
    const observer = new MutationObserver(() => hookPaymentButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
