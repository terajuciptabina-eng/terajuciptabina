(() => {
  'use strict';

  const STORAGE_KEY = 'terajuContractorProfile:v1';
  const PROFILE_VERSION = 1;

  const MALAYSIA_STATES = [
    'Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
    'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan'
  ];

  function makeId() {
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `CTR-${random}`;
  }

  function now() { return new Date().toISOString(); }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (_) { return null; }
  }

  function save(profile) {
    const current = read() || {};
    const next = {
      version: PROFILE_VERSION,
      contractorId: profile.contractorId || current.contractorId || makeId(),
      contractorName: String(profile.contractorName ?? current.contractorName ?? '').trim(),
      state: String(profile.state ?? current.state ?? '').trim(),
      createdAt: current.createdAt || now(),
      updatedAt: now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function getOrCreate() {
    const existing = read();
    if (existing && existing.contractorId) return existing;
    return save({});
  }

  function getPlannerContext(projectType) {
    const profile = read() || {};
    const type = String(projectType || '').toLowerCase() === 'renovation' ? 'renovation' : 'build';
    return {
      contractorId: profile.contractorId || '',
      contractorName: profile.contractorName || '',
      state: profile.state || '',
      projectType: type,
      databaseKey: profile.contractorId && profile.state
        ? `terajuQuotationItemDatabase:v3:${profile.contractorId}:${profile.state}:${type}`
        : `terajuQuotationItemDatabase:v2:${type}`
    };
  }

  window.TerajuContractorProfile = Object.freeze({
    STORAGE_KEY,
    MALAYSIA_STATES: Object.freeze(MALAYSIA_STATES.slice()),
    get: read,
    getOrCreate,
    save,
    generateId: makeId,
    getPlannerContext
  });
})();
