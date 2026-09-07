(() => {
  'use strict';

  const qs = new URLSearchParams(window.location.search);
  const audience = (qs.get('audience') || 'homeowner').toLowerCase();
  if (audience !== 'contractor') return;

  const contractorId = (qs.get('contractorId') || '').trim();
  const state = (qs.get('state') || '').trim();
  const projectType = /renovationplanner\.html/i.test(window.location.pathname) ? 'renovation' : 'build';
  const API_URL = '/api/contractor-database';
  const DB_KEY = contractorId && state
    ? `terajuQuotationItemDatabase:v3:${contractorId}:${state}:${projectType}`
    : `terajuQuotationItemDatabase:v2:${projectType}`;
  const LOADED_KEY = `terajuContractorCloudLoaded:v1:${contractorId}:${state}:${projectType}`;
  const LAST_UPLOAD_KEY = `terajuContractorCloudLastUpload:v1:${contractorId}:${state}:${projectType}`;

  if (!contractorId || !state) return;

  let lastSnapshot = '';
  let uploadTimer = null;
  let initialised = false;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeLocal(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db || {}));
  }

  function toItems(db) {
    return Object.entries(db || {}).map(([itemId, item]) => ({
      itemId,
      description: item?.description || itemId,
      unit: item?.unit || 'unit',
      rate: Number(item?.rate) || 0,
      quantity: Number(item?.qty) || 1,
      included: item?.included !== false,
      active: item?.active !== false,
      custom: item?.custom === true
    }));
  }

  function fromItems(items) {
    const db = {};
    (Array.isArray(items) ? items : []).forEach(item => {
      if (!item?.itemId) return;
      db[item.itemId] = {
        description: item.description || item.itemId,
        unit: item.unit || 'unit',
        rate: Number(item.rate) || 0,
        qty: Number(item.quantity ?? item.qty) || 1,
        included: item.included !== false,
        active: item.active !== false,
        custom: item.custom === true
      };
    });
    return db;
  }

  async function loadCloud() {
    try {
      const url = `${API_URL}?contractorId=${encodeURIComponent(contractorId)}&state=${encodeURIComponent(state)}&projectType=${encodeURIComponent(projectType)}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`Cloud read failed (${response.status})`);
      const result = await response.json();
      if (result?.exists && Array.isArray(result.items)) {
        writeLocal(fromItems(result.items));
        sessionStorage.setItem(LOADED_KEY, '1');
        lastSnapshot = localStorage.getItem(DB_KEY) || '{}';
        window.location.reload();
        return;
      }
      sessionStorage.setItem(LOADED_KEY, '1');
      lastSnapshot = localStorage.getItem(DB_KEY) || '{}';
    } catch (error) {
      console.warn('Teraju contractor cloud database unavailable; using local database.', error);
      sessionStorage.setItem(LOADED_KEY, '1');
      lastSnapshot = localStorage.getItem(DB_KEY) || '{}';
    }
  }

  async function uploadCloud(snapshot) {
    try {
      const db = JSON.parse(snapshot || '{}') || {};
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId, state, projectType, items: toItems(db) })
      });
      if (!response.ok) throw new Error(`Cloud write failed (${response.status})`);
      localStorage.setItem(LAST_UPLOAD_KEY, new Date().toISOString());
    } catch (error) {
      console.warn('Teraju contractor cloud database save failed; local copy retained.', error);
    }
  }

  function watchLocalChanges() {
    const current = localStorage.getItem(DB_KEY) || '{}';
    if (current === lastSnapshot) return;
    lastSnapshot = current;
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadCloud(current), 800);
  }

  async function init() {
    if (initialised) return;
    initialised = true;

    if (sessionStorage.getItem(LOADED_KEY) !== '1') {
      await loadCloud();
      return;
    }

    lastSnapshot = localStorage.getItem(DB_KEY) || '{}';
    setInterval(watchLocalChanges, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
