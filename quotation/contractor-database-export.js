(() => {
  'use strict';

  // Canonical export adapter for the GitHub-first contractor database.
  // This module prepares a database record only. It never writes to GitHub
  // and never handles repository credentials.

  const VERSION = 1;
  const PROJECT_TYPES = Object.freeze(['build', 'renovation']);

  function text(value) {
    return String(value ?? '').trim();
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function now() {
    return new Date().toISOString();
  }

  function getContext(projectType) {
    const profileApi = window.TerajuContractorProfile;
    const profile = profileApi?.getPlannerContext(projectType) || {};
    const type = PROJECT_TYPES.includes(text(projectType).toLowerCase())
      ? text(projectType).toLowerCase()
      : 'build';
    return {
      contractorId: text(profile.contractorId),
      contractorName: text(profile.contractorName),
      state: text(profile.state),
      projectType: type,
      databaseKey: text(profile.databaseKey)
    };
  }

  function readPlannerItems(projectType) {
    const context = getContext(projectType);
    if (!context.contractorId || !context.state) return [];

    const key = context.databaseKey ||
      `terajuQuotationItemDatabase:v3:${context.contractorId}:${context.state}:${context.projectType}`;

    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
    } catch (_) {}
    return [];
  }

  function normaliseItem(item, context, index) {
    const itemId = text(item?.itemId || item?.id) || `item-${index + 1}`;
    const updatedAt = text(item?.updatedAt) || now();
    return {
      id: itemId,
      contractorId: context.contractorId,
      contractorName: context.contractorName,
      state: context.state,
      projectType: context.projectType,
      itemId,
      description: text(item?.description),
      unit: text(item?.unit) || 'unit',
      rate: number(item?.rate),
      quantity: number(item?.quantity ?? item?.qty),
      included: item?.included !== false,
      active: item?.active !== false,
      updatedAt
    };
  }

  function buildRecord(projectType, items) {
    const context = getContext(projectType);
    const source = Array.isArray(items) ? items : [];
    return {
      schemaVersion: VERSION,
      contractorId: context.contractorId,
      contractorName: context.contractorName,
      state: context.state,
      projectType: context.projectType,
      updatedAt: now(),
      items: source
        .map((item, index) => normaliseItem(item, context, index))
        .filter(item => item.description)
    };
  }

  function exportCurrent(projectType, items) {
    const record = buildRecord(projectType, items);
    if (!record.contractorId || !record.contractorName || !record.state) {
      throw new Error('Contractor profile is incomplete. Save Contractor Name and State first.');
    }
    return record;
  }

  function exportPlanner(projectType) {
    return exportCurrent(projectType, readPlannerItems(projectType));
  }

  function download(record, filename) {
    const json = JSON.stringify(record, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `contractor-${record.contractorId || 'record'}-${record.projectType}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPlanner(projectType) {
    const record = exportPlanner(projectType);
    download(record, `contractor-${record.contractorId}-${record.projectType}.json`);
    return record;
  }

  window.TerajuContractorDatabaseExport = Object.freeze({
    VERSION,
    PROJECT_TYPES,
    getContext,
    readPlannerItems,
    normaliseItem,
    buildRecord,
    exportCurrent,
    exportPlanner,
    download,
    downloadPlanner
  });
})();
