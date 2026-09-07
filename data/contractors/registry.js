(() => {
  'use strict';

  // GitHub-first contractor database registry.
  // This module defines the canonical record shape used by the planners.
  // It does not perform writes from the browser and contains no credentials.

  const SCHEMA_VERSION = 1;
  const PROJECT_TYPES = Object.freeze(['build', 'renovation']);

  function normalise(value) {
    return String(value ?? '').trim();
  }

  function makeItem(profile, projectType, item) {
    return {
      id: normalise(item.id || item.itemId),
      contractorId: normalise(profile.contractorId),
      contractorName: normalise(profile.contractorName),
      state: normalise(profile.state),
      projectType: PROJECT_TYPES.includes(projectType) ? projectType : 'build',
      itemId: normalise(item.itemId || item.id),
      description: normalise(item.description),
      unit: normalise(item.unit) || 'unit',
      rate: Number(item.rate) || 0,
      quantity: Number(item.quantity ?? item.qty) || 0,
      included: item.included !== false,
      active: item.active !== false,
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }

  function makeRecord(profile, projectType, items) {
    const type = PROJECT_TYPES.includes(projectType) ? projectType : 'build';
    return {
      schemaVersion: SCHEMA_VERSION,
      contractorId: normalise(profile.contractorId),
      contractorName: normalise(profile.contractorName),
      state: normalise(profile.state),
      projectType: type,
      updatedAt: new Date().toISOString(),
      items: (Array.isArray(items) ? items : []).map(item => makeItem(profile, type, item))
    };
  }

  function makeDatabaseRecord(profile, projectType, items) {
    return makeRecord(profile, projectType, items);
  }

  window.TerajuContractorDatabaseRegistry = Object.freeze({
    SCHEMA_VERSION,
    PROJECT_TYPES,
    makeItem,
    makeRecord,
    makeDatabaseRecord
  });
})();
