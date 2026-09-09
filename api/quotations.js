export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
  const validRole = role => role === 'homeowner' || role === 'contractor';
  const validPlanner = type => type === 'build' || type === 'renovation';
  const folder = role => role === 'homeowner' ? 'homeowners' : 'contractors';
  const idKey = role => role === 'homeowner' ? 'homeownerId' : 'contractorId';
  const pathFor = (role, id) => `data/users/${folder(role)}/${encodeURIComponent(id)}.json`;

  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  async function readRecord(role, id) {
    const result = await github(pathFor(role, id));
    if (result.response.status === 404) return { record: null, sha: null, status: 404 };
    if (!result.response.ok) return { record: null, sha: null, status: 502 };
    const content = result.data?.content ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
    return { record: JSON.parse(content), sha: result.data?.sha || null, status: 200 };
  }
  function quotationType(value) { return String(value || '').toLowerCase() === 'detail' ? 'detail' : 'simple'; }
  function plannerList(record, type) { return Array.isArray(record?.plannerRecords?.[type]) ? record.plannerRecords[type] : []; }
  function allQuotationsForPlanner(record, plannerType) { return plannerList(record, plannerType); }
  function baseSequence(value) {
    const match = String(value || '').trim().match(/^Q(\d+)(?:S|D)?$/i);
    return match ? Number(match[1]) || 0 : 0;
  }
  function estimateSequence(value) {
    const match = String(value || '').trim().match(/^EST-(?:BLD|REN)-(\d+)$/i);
    return match ? Number(match[1]) || 0 : 0;
  }
  function nextBaseNumber(record, plannerType) {
    const all = allQuotationsForPlanner(record, plannerType);
    const stored = Number(record?.quotationRunningNumber?.[plannerType] ?? record?.quotationRunningNumber);
    const highest = all.reduce((max, q) => Math.max(max, baseSequence(q?.quotationNumber)), 0);
    const baseline = Number.isFinite(stored) && stored > 0 ? Math.max(stored, highest) : Math.max(highest, all.length);
    return baseline + 1;
  }
  function nextEstimateNumber(record, plannerType) {
    const all = allQuotationsForPlanner(record, plannerType);
    const stored = Number(record?.estimateRunningNumber?.[plannerType]);
    const highest = all.reduce((max, q) => Math.max(max, estimateSequence(q?.estimateNumber)), 0);
    const baseline = Number.isFinite(stored) && stored > 0 ? Math.max(stored, highest) : highest;
    return baseline + 1;
  }
  function findProjectQuotations(record, plannerType, projectId) {
    if (!projectId) return [];
    return allQuotationsForPlanner(record, plannerType).filter(q => String(q?.projectId || q?.plannerState?.projectId || '') === String(projectId));
  }
  function projectIdentity(record) {
    const state = record?.plannerState || {};
    return {
      customer: String(record?.client?.name || state.customerName || '').trim().toLowerCase(),
      location: String(record?.project?.location || state.projectLocation || '').trim().toLowerCase(),
      area: Number(record?.project?.builtUpArea ?? state.builtUpArea ?? 0) || 0
    };
  }
  function sameProjectIdentity(a, b) {
    const x = projectIdentity(a), y = projectIdentity(b);
    const customerSame = !x.customer || !y.customer || x.customer === y.customer;
    const locationSame = !x.location || !y.location || x.location === y.location;
    const areaSame = !x.area || !y.area || x.area === y.area;
    return customerSame && locationSame && areaSame;
  }
  function displayQuotationNumber(baseNumber, type) { return `Q${String(baseNumber).padStart(3, '0')}${quotationType(type) === 'detail' ? 'D' : 'S'}`; }
  function displayEstimateNumber(number, plannerType) { return `EST-${plannerType === 'renovation' ? 'REN' : 'BLD'}-${String(number).padStart(3, '0')}`; }

  try {
    const source = req.method === 'GET' ? req.query : (req.body || {});
    const role = String(source?.role || '').toLowerCase();
    const id = String(source?.id || '').trim().toUpperCase();
    const plannerType = String(source?.plannerType || 'build').toLowerCase();
    if (!validRole(role) || !id || !validPlanner(plannerType)) return res.status(400).json({ message: 'Invalid role, id or planner type.' });

    const current = await readRecord(role, id);
    if (!current.record) return res.status(current.status === 404 ? 404 : 502).json({ message: current.status === 404 ? 'Account not found.' : 'Unable to read account record.' });

    if (req.method === 'GET') {
      return res.status(200).json({ role, id, plannerType, quotations: plannerList(current.record, plannerType) });
    }

    if (req.method === 'DELETE') {
      const quotationId = String(source?.quotationId || '').trim();
      if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' });
      const list = plannerList(current.record, plannerType);
      current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] };
      current.record.plannerRecords[plannerType] = list.filter(q => q?.quotationId !== quotationId);
      current.record.updatedAt = new Date().toISOString();
      const updated = await github(pathFor(role, id), { method: 'PUT', body: JSON.stringify({ message: `Delete ${plannerType} quotation ${quotationId}`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha }) });
      if (!updated.response.ok) return res.status(502).json({ message: 'Unable to delete quotation.' });
      return res.status(200).json({ success: true, quotationId });
    }

    const quotation = source?.quotation;
    if (!quotation || typeof quotation !== 'object') return res.status(400).json({ message: 'Missing quotation record.' });
    const quotationId = String(quotation.quotationId || '').trim();
    if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' });

    const now = new Date().toISOString();
    const normalized = { ...quotation, quotationId, role, [idKey(role)]: id, plannerType, updatedAt: now, createdAt: quotation.createdAt || now };
    current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] };
    current.record.plannerRecords.build = plannerList(current.record, 'build');
    current.record.plannerRecords.renovation = plannerList(current.record, 'renovation');

    const list = current.record.plannerRecords[plannerType];
    const index = list.findIndex(q => q?.quotationId === quotationId);

    if (index >= 0) {
      const old = list[index];
      normalized.quotationNumber = old?.quotationNumber || normalized.quotationNumber || displayQuotationNumber(Math.max(1, nextBaseNumber(current.record, plannerType) - 1), normalized.quotationType);
      normalized.estimateNumber = old?.estimateNumber || normalized.estimateNumber || displayEstimateNumber(nextEstimateNumber(current.record, plannerType) - 1, plannerType);
      normalized.projectId = old?.projectId || old?.plannerState?.projectId || normalized.projectId;
      normalized.createdAt = old?.createdAt || normalized.createdAt;
      list[index] = normalized;
    } else {
      const incomingProjectId = String(normalized.projectId || normalized.plannerState?.projectId || '').trim();
      const projectMatches = findProjectQuotations(current.record, plannerType, incomingProjectId);
      const compatibleMatch = projectMatches.find(q => sameProjectIdentity(q, normalized));

      if (compatibleMatch) {
        const base = baseSequence(compatibleMatch.quotationNumber);
        normalized.projectId = compatibleMatch.projectId || incomingProjectId;
        normalized.estimateNumber = compatibleMatch.estimateNumber || displayEstimateNumber(nextEstimateNumber(current.record, plannerType) - 1, plannerType);
        normalized.quotationNumber = displayQuotationNumber(base || Math.max(1, nextBaseNumber(current.record, plannerType) - 1), normalized.quotationType);
      } else {
        const baseNumber = nextBaseNumber(current.record, plannerType);
        const estimateNumber = nextEstimateNumber(current.record, plannerType);
        normalized.quotationNumber = displayQuotationNumber(baseNumber, normalized.quotationType);
        normalized.estimateNumber = displayEstimateNumber(estimateNumber, plannerType);
        normalized.projectId = `${plannerType === 'renovation' ? 'PRJ-REN' : 'PRJ-BLD'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        if (!current.record.quotationRunningNumber || typeof current.record.quotationRunningNumber !== 'object') current.record.quotationRunningNumber = {};
        current.record.quotationRunningNumber[plannerType] = baseNumber;
        if (!current.record.estimateRunningNumber || typeof current.record.estimateRunningNumber !== 'object') current.record.estimateRunningNumber = {};
        current.record.estimateRunningNumber[plannerType] = estimateNumber;
      }
      normalized.plannerState = { ...(normalized.plannerState || {}), projectId: normalized.projectId };
      list.unshift(normalized);
    }

    current.record.updatedAt = now;
    const updated = await github(pathFor(role, id), { method: 'PUT', body: JSON.stringify({ message: `${index >= 0 ? 'Update' : 'Save'} ${plannerType} quotation ${normalized.quotationNumber} (${normalized.estimateNumber})`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha }) });
    if (!updated.response.ok) { console.error('Quotation write failed:', updated.data); return res.status(502).json({ message: 'Unable to save quotation record.' }); }
    return res.status(200).json({ success: true, quotation: normalized });
  } catch (error) {
    console.error('quotation storage error:', error);
    return res.status(500).json({ message: 'Unable to process quotation record.' });
  }
}
