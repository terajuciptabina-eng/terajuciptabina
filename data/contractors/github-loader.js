(() => {
  'use strict';

  // Read-only GitHub loader for contractor canonical records.
  // Browser-safe: no GitHub token, credential, or write operation is used.

  const DEFAULT_REPOSITORY = 'terajuciptabina-eng/terajuciptabina';
  const DEFAULT_REF = 'main';
  const PROJECT_TYPES = Object.freeze(['build', 'renovation']);

  function normalise(value) {
    return String(value ?? '').trim();
  }

  function assertProjectType(projectType) {
    const type = normalise(projectType).toLowerCase();
    if (!PROJECT_TYPES.includes(type)) {
      throw new Error(`Unsupported contractor project type: ${projectType}`);
    }
    return type;
  }

  function assertContractorId(contractorId) {
    const id = normalise(contractorId);
    if (!id) throw new Error('contractorId is required');
    return id;
  }

  function buildRecordUrl(contractorId, projectType, options = {}) {
    const id = assertContractorId(contractorId);
    const type = assertProjectType(projectType);
    const repository = normalise(options.repository) || DEFAULT_REPOSITORY;
    const ref = encodeURIComponent(normalise(options.ref) || DEFAULT_REF);
    const path = `data/contractors/records/${encodeURIComponent(id)}/${type}.json`;

    return `https://raw.githubusercontent.com/${repository}/${ref}/${path}`;
  }

  function validateRecord(record, expectedContractorId, expectedProjectType) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Invalid contractor record: expected an object');
    }

    const contractorId = assertContractorId(expectedContractorId);
    const projectType = assertProjectType(expectedProjectType);

    if (record.schemaVersion !== 1) {
      throw new Error(`Unsupported contractor record schemaVersion: ${record.schemaVersion}`);
    }
    if (normalise(record.contractorId) !== contractorId) {
      throw new Error('Contractor record ID does not match requested contractorId');
    }
    if (normalise(record.projectType).toLowerCase() !== projectType) {
      throw new Error('Contractor record projectType does not match requested project type');
    }
    if (!normalise(record.contractorName)) {
      throw new Error('Contractor record contractorName is required');
    }
    if (!normalise(record.state)) {
      throw new Error('Contractor record state is required');
    }
    if (!Array.isArray(record.items)) {
      throw new Error('Contractor record items must be an array');
    }

    return record;
  }

  async function loadRecord(contractorId, projectType, options = {}) {
    const id = assertContractorId(contractorId);
    const type = assertProjectType(projectType);
    const url = buildRecordUrl(id, type, options);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        const error = new Error(`Contractor record not found: ${id}/${type}`);
        error.code = 'RECORD_NOT_FOUND';
        error.status = 404;
        throw error;
      }

      const error = new Error(`Failed to load contractor record (${response.status})`);
      error.code = 'RECORD_LOAD_FAILED';
      error.status = response.status;
      throw error;
    }

    let record;
    try {
      record = await response.json();
    } catch (cause) {
      const error = new Error('Contractor record is not valid JSON');
      error.code = 'INVALID_JSON';
      error.cause = cause;
      throw error;
    }

    return validateRecord(record, id, type);
  }

  async function loadContractorDatabase(contractorId, options = {}) {
    const id = assertContractorId(contractorId);
    const result = {
      contractorId: id,
      build: null,
      renovation: null,
      errors: {}
    };

    for (const projectType of PROJECT_TYPES) {
      try {
        result[projectType] = await loadRecord(id, projectType, options);
      } catch (error) {
        result.errors[projectType] = error;
      }
    }

    return result;
  }

  window.TerajuContractorGitHubLoader = Object.freeze({
    DEFAULT_REPOSITORY,
    DEFAULT_REF,
    PROJECT_TYPES,
    buildRecordUrl,
    validateRecord,
    loadRecord,
    loadContractorDatabase
  });
})();
