(() => {
  'use strict';

  // Canonical export adapter for the GitHub-first contractor database.
  // This module prepares a database record only. It never writes to GitHub
  // and never handles repository credentials.

  const VERSION = 1;

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
    const profile = window.TerajuContractorProfile?.getPlannerContext(projectType) || {};
    return {
      contractorId: text(profile.contractorId),
      contractorName: text(profile.contractorName),
      state: text(profile.state),
      projectType: profile.projectType === 'renovation' ? 'renovation' : 'build'
    };
  }

  function normaliseItem(item, context) {
    const itemId = text(item?.itemId || item?.id);
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
      updatedAt: text(item?.updatedAt) || now()
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
        .map(item => normaliseItem(item, context))
        .filter(item => item.id || item.description)
    };
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

  function exportCurrent(projectType, items) {
    const record = buildRecord(projectType, items);
    if (!record.contractorId || !record.state) {
      throw new Error('Contractor profile is incomplete. Save contractor name and state first.');
    }
    return record;
  }

  window.TerajuContractorDatabaseExport = Object.freeze({
    VERSION,
    buildRecord,
    exportCurrent,
    download
  });
})();
