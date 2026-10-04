// Vercel deployment trigger: keep source behavior unchanged.
import { quotationType, estimateSequence, estimateBase, displayEstimateNumber, canonicalEstimateNumber } from './estimate-number.js';

export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed' });
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
  const validRole = role => role === 'homeowner' || role === 'contractor';
  const validPlanner = type => type === 'build' || type === 'renovation';
  const folder = role => role === 'homeowner' ? 'homeowners' : 'contractors';
  const idKey = role => role === 'homeowner' ? 'homeownerId' : 'contractorId';
  const pathFor = (role, id) => `data/users/${folder(role)}/${encodeURIComponent(id)}.json`;
  async function github(path, options = {}) { const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; } return { response, data }; }
  async function githubRaw(path) { const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } }); const text = await response.text(); return { response, text }; }
  async function readRecord(role, id) {
    const path = pathFor(role, id);
    const result = await github(path);
    if (result.response.status === 404) return { record: null, sha: null, status: 404 };
    if (!result.response.ok) return { record: null, sha: null, status: 502 };
    const sha = result.data?.sha || null;
    if (result.data?.content && result.data?.encoding === 'base64') {
      return { record: JSON.parse(Buffer.from(result.data.content, 'base64').toString('utf8')), sha, status: 200 };
    }
    // GitHub returns an empty content field with encoding `none` for files
    // between 1 MB and 100 MB. Read the same blob through the raw media type
    // instead of attempting JSON.parse(''), which previously produced the
    // generic quotation-processing error.
    const raw = await githubRaw(path);
    if (!raw.response.ok || !raw.text.trim()) return { record: null, sha, status: 502 };
    return { record: JSON.parse(raw.text), sha, status: 200 };
  }
  function plannerList(record, type) { return Array.isArray(record?.plannerRecords?.[type]) ? record.plannerRecords[type] : []; }
  function baseSequence(value) { const match = String(value || '').trim().match(/^Q(\d+)(?:S|D)?$/i); return match ? Number(match[1]) || 0 : 0; }
  function revisionCode(value) { const n = Number(value); return `R${String(Number.isFinite(n) && n >= 0 ? n : 0).padStart(2, '0')}`; }
  function revisionComparable(value, plannerType) {
    const copy = JSON.parse(JSON.stringify(value || {}));

    // Revision tracks substantive Cost Estimate content, not workflow/presentation metadata.
    // Simple vs Detail is only a presentation mode of the same estimate/project.
    delete copy.updatedAt;
    delete copy.createdAt;
    delete copy.quotationId;
    delete copy.revision;
    delete copy.revisionHistory;
    delete copy.quotationType;

    const type = quotationType(copy.plannerState?.quotationType);
    if (copy.estimateNumber) copy.estimateNumber = canonicalEstimateNumber(copy.estimateNumber, plannerType, type);

    if (copy.plannerState && typeof copy.plannerState === 'object') {
      delete copy.plannerState.quotationId;
      delete copy.plannerState.quotationType;
      delete copy.plannerState.rateSnapshotAt;
      delete copy.plannerState.constructionBudgetGenerated;
      if (copy.plannerState.estimateNumber) copy.plannerState.estimateNumber = canonicalEstimateNumber(copy.plannerState.estimateNumber, plannerType, type);
    }

    return JSON.stringify(copy);
  }
  function buildRevisionSnapshot(value, revision) {
    const snapshot = JSON.parse(JSON.stringify(value || {}));
    delete snapshot.revisionHistory;
    snapshot.revision = { current: revision, history: [] };
    return snapshot;
  }
  function nextBaseNumber(record, plannerType) { const all = plannerList(record, plannerType); const stored = Number(record?.quotationRunningNumber?.[plannerType]); const highest = all.reduce((max, q) => Math.max(max, baseSequence(q?.quotationNumber)), 0); const plannerStored = Number.isFinite(stored) && stored > 0 ? stored : 0; const baseline = Math.max(highest, plannerStored, highest === 0 ? all.length : 0); return Math.max(1, baseline + 1); }
  function nextEstimateNumber(record, plannerType) { const all = plannerList(record, plannerType); const stored = Number(record?.estimateRunningNumber?.[plannerType]); const highest = all.reduce((max, q) => Math.max(max, estimateSequence(q?.estimateNumber)), 0); return Math.max(1, Math.max(highest, Number.isFinite(stored) && stored > 0 ? stored : 0) + 1); }
  function findProjectQuotations(record, plannerType, projectId) { if (!projectId) return []; return plannerList(record, plannerType).filter(q => String(q?.projectId || q?.plannerState?.projectId || '') === String(projectId)); }
  function projectIdentity(record) { const state = record?.plannerState || {}; return { customer: String(record?.client?.name || state.customerName || '').trim().toLowerCase(), location: String(record?.project?.location || state.projectLocation || '').trim().toLowerCase(), area: Number(record?.project?.builtUpArea ?? state.builtUpArea ?? 0) || 0 }; }
  function sameProjectIdentity(a, b) { const x = projectIdentity(a), y = projectIdentity(b); return (!x.customer || !y.customer || x.customer === y.customer) && (!x.location || !y.location || x.location === y.location) && (!x.area || !y.area || x.area === y.area); }
  function displayQuotationNumber(baseNumber) { return `Q${String(baseNumber).padStart(3, '0')}`; }
  try {
    const source = req.method === 'GET' ? req.query : (req.body || {}); const role = String(source?.role || '').toLowerCase(); const id = String(source?.id || '').trim().toUpperCase(); const plannerType = String(source?.plannerType || 'build').toLowerCase();
    if (!validRole(role) || !id || !validPlanner(plannerType)) return res.status(400).json({ message: 'Invalid role, id or planner type.' });
    const current = await readRecord(role, id); if (!current.record) return res.status(current.status === 404 ? 404 : 502).json({ message: current.status === 404 ? 'Account not found.' : 'Unable to read account record.' });
    if (req.method === 'GET') { const seenEstimateTypes = new Set(); const quotations = plannerList(current.record, plannerType).map(q => { const copy = JSON.parse(JSON.stringify(q || {})); const type = quotationType(copy.quotationType || copy.plannerState?.quotationType); if (copy.estimateNumber) copy.estimateNumber = canonicalEstimateNumber(copy.estimateNumber, plannerType, type); if (copy.plannerState && typeof copy.plannerState === 'object' && copy.plannerState.estimateNumber) copy.plannerState.estimateNumber = canonicalEstimateNumber(copy.plannerState.estimateNumber, plannerType, type); copy.quotationType = type; if (copy.plannerState && typeof copy.plannerState === 'object') copy.plannerState.quotationType = type; return copy; }).filter(q => { const projectId = String(q?.projectId || q?.plannerState?.projectId || '').trim(); const type = quotationType(q?.quotationType || q?.plannerState?.quotationType); const key = projectId ? projectId + '::' + type : String(q?.quotationId || ''); if (!key || seenEstimateTypes.has(key)) return false; seenEstimateTypes.add(key); return true; }); return res.status(200).json({ role, id, plannerType, quotations }); }
    if (req.method === 'POST') {
      const action = String(source?.action || '').toLowerCase();
      if (action !== 'duplicate') return res.status(400).json({ message: 'Invalid quotation action.' });
      const sourceQuotationId = String(source?.quotationId || '').trim();
      if (!sourceQuotationId) return res.status(400).json({ message: 'Missing quotationId.' });
      const list = plannerList(current.record, plannerType);
      const sourceQuotation = list.find(q => q?.quotationId === sourceQuotationId);
      if (!sourceQuotation) return res.status(404).json({ message: 'Cost estimate not found.' });
      const now = new Date().toISOString();
      const type = quotationType(sourceQuotation.quotationType);
      const baseNumber = nextBaseNumber(current.record, plannerType);
      const newProjectId = `${plannerType === 'renovation' ? 'PRJ-REN' : 'PRJ-BLD'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const estimateBaseNumber = nextEstimateNumber(current.record, plannerType);
      const estimateNumber = displayEstimateNumber(estimateBaseNumber, plannerType, type);
      const newQuotationId = `QT-${plannerType === 'renovation' ? 'REN' : 'BLD'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      const duplicate = JSON.parse(JSON.stringify(sourceQuotation));
      duplicate.quotationId = newQuotationId;
      duplicate.quotationNumber = displayQuotationNumber(baseNumber);
      duplicate.estimateNumber = estimateNumber;
      duplicate.createdAt = now;
      duplicate.updatedAt = now;
      duplicate.state = 'final';
      // A duplicate is a new estimate, not a copy of the source calculation snapshot.
      // Preserve planning inputs/customizations, but force a fresh TERAJU calculation
      // from the duplicated Room / Area state when the new estimate is opened/generated.
      duplicate.items = [];
      duplicate.sourceItems = [];
      duplicate.total = 0;
      duplicate.plannerState = {
        ...(duplicate.plannerState || {}),
        projectId: newProjectId,
        quotationId: newQuotationId,
        quotationType: type,
        constructionBudgetGenerated: false
      };
      duplicate.revision = { current: 'R00', history: [] };
      delete duplicate.revisionHistory;
      list.unshift(duplicate);
      current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] };
      current.record.plannerRecords[plannerType] = list;
      current.record.quotationRunningNumber = current.record.quotationRunningNumber || {};
      current.record.quotationRunningNumber[plannerType] = baseNumber;
      current.record.estimateRunningNumber = current.record.estimateRunningNumber || {};
      current.record.estimateRunningNumber[plannerType] = estimateBaseNumber;
      current.record.updatedAt = now;
      const updated = await github(pathFor(role, id), { method: 'PUT', body: JSON.stringify({ message: `Duplicate ${plannerType} quotation ${sourceQuotation.quotationNumber} as ${duplicate.quotationNumber}`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha }) });
      if (!updated.response.ok) return res.status(502).json({ message: 'Unable to duplicate cost estimate.' });
      return res.status(200).json({ success: true, quotation: duplicate });
    }
    if (req.method === 'DELETE') { const quotationId = String(source?.quotationId || '').trim(); if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' }); const list = plannerList(current.record, plannerType); const existingIndex = list.findIndex(q => q?.quotationId === quotationId); if (existingIndex < 0) return res.status(404).json({ message: 'Cost estimate not found.' }); current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] }; current.record.plannerRecords[plannerType] = list.filter(q => q?.quotationId !== quotationId); current.record.updatedAt = new Date().toISOString(); const updated = await github(pathFor(role, id), { method: 'PUT', body: JSON.stringify({ message: `Delete ${plannerType} quotation ${quotationId}`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha }) }); if (!updated.response.ok) return res.status(502).json({ message: 'Unable to delete quotation.' }); return res.status(200).json({ success: true, quotationId }); }
    const quotation = source?.quotation; if (!quotation || typeof quotation !== 'object') return res.status(400).json({ message: 'Missing quotation record.' }); const quotationId = String(quotation.quotationId || '').trim(); if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' });
    const now = new Date().toISOString(); const normalized = { ...quotation, quotationId, role, [idKey(role)]: id, plannerType, updatedAt: now, createdAt: quotation.createdAt || now };
    current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] }; current.record.plannerRecords.build = plannerList(current.record, 'build'); current.record.plannerRecords.renovation = plannerList(current.record, 'renovation');
    const list = current.record.plannerRecords[plannerType];
    const incomingType = quotationType(normalized.quotationType || normalized.plannerState?.quotationType);
    let index = list.findIndex(q => q?.quotationId === quotationId);

    // A quotationId is immutable to its Cost Estimate type. Switching Simple/Detail
    // must create or update the matching type record, never mutate the other type.
    if (index >= 0) {
      const existingType = quotationType(list[index]?.quotationType || list[index]?.plannerState?.quotationType);
      if (existingType !== incomingType) index = -1;
    }

    if (index >= 0) {
      const old = list[index];
      const type = incomingType;
      normalized.quotationNumber = old?.quotationNumber || normalized.quotationNumber || displayQuotationNumber(Math.max(1, nextBaseNumber(current.record, plannerType) - 1), type);
      const oldEstimateBase = estimateBase(old?.estimateNumber);
      normalized.estimateNumber = old?.estimateNumber
        ? displayEstimateNumber(oldEstimateBase || nextEstimateNumber(current.record, plannerType), plannerType, type)
        : (normalized.estimateNumber ? displayEstimateNumber(estimateBase(normalized.estimateNumber), plannerType, incomingType) : displayEstimateNumber(nextEstimateNumber(current.record, plannerType), plannerType, type));
      normalized.projectId = old?.projectId || old?.plannerState?.projectId || normalized.projectId;
      normalized.plannerState = { ...(normalized.plannerState || {}), projectId: normalized.projectId, quotationType: type };
      normalized.createdAt = old?.createdAt || normalized.createdAt;

      const oldRevision = old?.revision || {};
      const currentRevisionNumber = Number(String(oldRevision.current || '').replace(/^R/i, ''));
      const safeCurrentRevision = Number.isFinite(currentRevisionNumber) && currentRevisionNumber >= 0 ? currentRevisionNumber : 0;
      const oldComparable = revisionComparable(old, plannerType);
      const nextComparable = revisionComparable(normalized, plannerType);
      const changed = oldComparable !== nextComparable;

      if (old?.revision?.current) {
        normalized.revision = {
          current: changed ? revisionCode(safeCurrentRevision + 1) : old.revision.current,
          history: Array.isArray(old.revision.history) ? old.revision.history.map(entry => JSON.parse(JSON.stringify(entry))) : []
        };
      } else {
        normalized.revision = { current: changed ? 'R01' : 'R00', history: [] };
        if (changed) {
          normalized.revision.history.push({
            revision: 'R00',
            createdAt: old?.updatedAt || old?.createdAt || normalized.createdAt,
            snapshot: buildRevisionSnapshot(old, 'R00')
          });
        }
      }

      if (changed && old?.revision?.current) {
        normalized.revision.history.push({
          revision: old.revision.current,
          createdAt: old?.updatedAt || old?.createdAt || normalized.createdAt,
          snapshot: buildRevisionSnapshot(old, old.revision.current)
        });
      }

      list[index] = normalized;
    } else {
      const incomingProjectId = String(normalized.projectId || normalized.plannerState?.projectId || '').trim();
      const projectMatches = findProjectQuotations(current.record, plannerType, incomingProjectId);
      // A project can intentionally have TWO Cost Estimate records: Simple and Detail.
      // Only reuse an existing record when the estimate presentation type is also the same.
      // Project identity alone must never collapse Simple into Detail (or vice versa).
      const compatibleMatches = projectMatches.filter(q => quotationType(q?.quotationType || q?.plannerState?.quotationType) === incomingType && sameProjectIdentity(q, normalized));
      const projectMatch = compatibleMatches[0];
      if (projectMatch) {
        normalized.quotationId = projectMatch.quotationId;
        normalized.quotationNumber = projectMatch.quotationNumber || displayQuotationNumber(baseSequence(projectMatch.quotationNumber) || nextBaseNumber(current.record, plannerType));
        normalized.estimateNumber = projectMatch.estimateNumber
          ? displayEstimateNumber(estimateBase(projectMatch.estimateNumber) || nextEstimateNumber(current.record, plannerType), plannerType, incomingType)
          : displayEstimateNumber(nextEstimateNumber(current.record, plannerType), plannerType, incomingType);
        normalized.projectId = projectMatch.projectId || incomingProjectId;
        normalized.createdAt = projectMatch.createdAt || normalized.createdAt;
        normalized.plannerState = { ...(normalized.plannerState || {}), projectId: normalized.projectId, quotationType: quotationType(normalized.quotationType) };
        const old = projectMatch;
        const oldRevision = old?.revision || {};
        const currentRevisionNumber = Number(String(oldRevision.current || '').replace(/^R/i, ''));
        const safeCurrentRevision = Number.isFinite(currentRevisionNumber) && currentRevisionNumber >= 0 ? currentRevisionNumber : 0;
        const changed = revisionComparable(old, plannerType) !== revisionComparable(normalized, plannerType);
        normalized.revision = {
          current: changed ? revisionCode(safeCurrentRevision + 1) : (oldRevision.current || 'R00'),
          history: Array.isArray(oldRevision.history) ? oldRevision.history.map(entry => JSON.parse(JSON.stringify(entry))) : []
        };
        if (changed) normalized.revision.history.push({
          revision: oldRevision.current || 'R00',
          createdAt: old?.updatedAt || old?.createdAt || normalized.createdAt,
          snapshot: buildRevisionSnapshot(old, oldRevision.current || 'R00')
        });
        index = list.findIndex(q => q?.quotationId === projectMatch.quotationId);
        list[index] = normalized;
      } else {
        // If the other Cost Estimate type already exists, this is the second type
        // for the same project. Preserve project identity instead of creating a new project.
        const sameProject = projectMatches.find(q => sameProjectIdentity(q, normalized));
        const baseNumber = sameProject
          ? (baseSequence(sameProject.quotationNumber) || nextBaseNumber(current.record, plannerType))
          : nextBaseNumber(current.record, plannerType);
        const estimateNumber = sameProject
          ? (estimateBase(sameProject.estimateNumber) || nextEstimateNumber(current.record, plannerType))
          : nextEstimateNumber(current.record, plannerType);
        normalized.quotationId = `QT-${plannerType === 'renovation' ? 'REN' : 'BLD'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        normalized.quotationNumber = displayQuotationNumber(baseNumber);
        normalized.estimateNumber = displayEstimateNumber(estimateNumber, plannerType, incomingType);
        normalized.projectId = incomingProjectId || (sameProject?.projectId || ((plannerType === 'renovation' ? 'PRJ-REN' : 'PRJ-BLD') + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase()));
        normalized.plannerState = { ...(normalized.plannerState || {}), projectId: normalized.projectId, quotationType: incomingType };
        normalized.revision = { current: 'R00', history: [] };
        if (!current.record.quotationRunningNumber || typeof current.record.quotationRunningNumber !== 'object') current.record.quotationRunningNumber = {}; current.record.quotationRunningNumber[plannerType] = baseNumber;
        if (!current.record.estimateRunningNumber || typeof current.record.estimateRunningNumber !== 'object') current.record.estimateRunningNumber = {}; current.record.estimateRunningNumber[plannerType] = estimateNumber;
        list.unshift(normalized);
      }
    }
    current.record.updatedAt = now;
    const updated = await github(pathFor(role, id), { method: 'PUT', body: JSON.stringify({ message: `${index >= 0 ? 'Update' : 'Save'} ${plannerType} quotation ${normalized.quotationNumber} (${normalized.estimateNumber})`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha }) }); if (!updated.response.ok) { console.error('Quotation write failed:', updated.data); return res.status(502).json({ message: 'Unable to save quotation record.' }); }
    return res.status(200).json({ success: true, quotation: normalized });
  } catch (error) { console.error('quotation storage error:', error); return res.status(500).json({ message: 'Unable to process quotation record.' }); }
}
