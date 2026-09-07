(() => {
  'use strict';

  const STORAGE_KEY = 'terajuContractorProfile:v1';
  const PROFILE_VERSION = 1;
  const PROJECT_TYPES = Object.freeze(['build', 'renovation']);
  const MALAYSIA_STATES = [
    'Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
    'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan'
  ];

  function makeId() {
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `CTR-${random}`;
  }

  function now() { return new Date().toISOString(); }
  function normalise(value) { return String(value ?? '').trim(); }

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
      contractorId: normalise(profile.contractorId || current.contractorId) || makeId(),
      contractorName: normalise(profile.contractorName ?? current.contractorName),
      state: normalise(profile.state ?? current.state),
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
    const type = PROJECT_TYPES.includes(normalise(projectType).toLowerCase())
      ? normalise(projectType).toLowerCase()
      : 'build';
    return {
      contractorId: normalise(profile.contractorId),
      contractorName: normalise(profile.contractorName),
      state: normalise(profile.state),
      projectType: type,
      databaseKey: profile.contractorId && profile.state
        ? `terajuQuotationItemDatabase:v3:${profile.contractorId}:${profile.state}:${type}`
        : `terajuQuotationItemDatabase:v2:${type}`
    };
  }

  function toDatabaseRecord(projectType, items) {
    const context = getPlannerContext(projectType);
    const type = context.projectType;
    const list = Array.isArray(items) ? items : [];
    return {
      schemaVersion: 1,
      contractorId: context.contractorId,
      contractorName: context.contractorName,
      state: context.state,
      projectType: type,
      updatedAt: now(),
      items: list.map(item => ({
        id: normalise(item.id || item.itemId),
        contractorId: context.contractorId,
        contractorName: context.contractorName,
        state: context.state,
        projectType: type,
        itemId: normalise(item.itemId || item.id),
        description: normalise(item.description),
        unit: normalise(item.unit) || 'unit',
        rate: Number(item.rate) || 0,
        quantity: Number(item.quantity ?? item.qty) || 0,
        included: item.included !== false,
        active: item.active !== false,
        updatedAt: item.updatedAt || now()
      }))
    };
  }

  window.TerajuContractorProfile = Object.freeze({
    STORAGE_KEY,
    MALAYSIA_STATES: Object.freeze(MALAYSIA_STATES.slice()),
    PROJECT_TYPES,
    get: read,
    getOrCreate,
    save,
    generateId: makeId,
    getPlannerContext,
    toDatabaseRecord
  });
})();
