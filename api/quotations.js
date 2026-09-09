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

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const validRole = role => role === 'homeowner' || role === 'contractor';
  const validPlanner = type => type === 'build' || type === 'renovation';
  const folder = role => role === 'homeowner' ? 'homeowners' : 'contractors';
  const idKey = role => role === 'homeowner' ? 'homeownerId' : 'contractorId';
  const pathFor = (role, id) => `data/users/${folder(role)}/${encodeURIComponent(id)}.json`;

  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });
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

  function quotationType(value) {
    return String(value || '').toLowerCase() === 'detail' ? 'detail' : 'simple';
  }

  function highestQuotationSequence(records) {
    let max = 0;
    for (const q of Array.isArray(records) ? records : []) {
      const match = String(q?.quotationNumber || '').trim().match(/^Q(\d+)(?:S|D)?$/i);
      if (match) max = Math.max(max, Number(match[1]) || 0);
    }
    return max;
  }

  function getNextBaseNumber(record) {
    const build = Array.isArray(record?.plannerRecords?.build) ? record.plannerRecords.build : [];
    const renovation = Array.isArray(record?.plannerRecords?.renovation) ? record.plannerRecords.renovation : [];
    const all = [...build, ...renovation];
    const stored = Number(record?.quotationRunningNumber);
    const highest = highestQuotationSequence(all);
    const baseline = Number.isFinite(stored) && stored > 0 ? Math.max(stored, highest) : Math.max(highest, all.length);
    return baseline + 1;
  }

  function displayQuotationNumber(baseNumber, type) {
    return `Q${String(baseNumber).padStart(3, '0')}${quotationType(type) === 'detail' ? 'D' : 'S'}`;
  }

  try {
    const source = req.method === 'GET' ? req.query : (req.body || {});
    const role = String(source?.role || '').toLowerCase();
    const id = String(source?.id || '').trim().toUpperCase();
    const plannerType = String(source?.plannerType || 'build').toLowerCase();
    if (!validRole(role) || !id || !validPlanner(plannerType)) return res.status(400).json({ message: 'Invalid role, id or planner type.' });

    const current = await readRecord(role, id);
    if (!current.record) return res.status(current.status === 404 ? 404 : 502).json({ message: current.status === 404 ? 'Account not found.' : 'Unable to read account record.' });

    if (req.method === 'GET') {
      return res.status(200).json({ role, id, plannerType, quotations: current.record.plannerRecords?.[plannerType] || [] });
    }

    if (req.method === 'DELETE') {
      const quotationId = String(source?.quotationId || '').trim();
      if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' });
      const list = Array.isArray(current.record.plannerRecords?.[plannerType]) ? current.record.plannerRecords[plannerType] : [];
      current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] };
      current.record.plannerRecords[plannerType] = list.filter(q => q?.quotationId !== quotationId);
      current.record.updatedAt = new Date().toISOString();
      const updated = await github(pathFor(role, id), {
        method: 'PUT',
        body: JSON.stringify({ message: `Delete ${plannerType} quotation ${quotationId}`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha })
      });
      if (!updated.response.ok) return res.status(502).json({ message: 'Unable to delete quotation.' });
      return res.status(200).json({ success: true, quotationId });
    }

    const quotation = source?.quotation;
    if (!quotation || typeof quotation !== 'object') return res.status(400).json({ message: 'Missing quotation record.' });
    const quotationId = String(quotation.quotationId || '').trim();
    if (!quotationId) return res.status(400).json({ message: 'Missing quotationId.' });

    const now = new Date().toISOString();
    const normalized = {
      ...quotation,
      quotationId,
      role,
      [idKey(role)]: id,
      plannerType,
      updatedAt: now,
      createdAt: quotation.createdAt || now
    };
    current.record.plannerRecords = current.record.plannerRecords || { build: [], renovation: [] };
    current.record.plannerRecords.build = Array.isArray(current.record.plannerRecords.build) ? current.record.plannerRecords.build : [];
    current.record.plannerRecords.renovation = Array.isArray(current.record.plannerRecords.renovation) ? current.record.plannerRecords.renovation : [];
    const list = current.record.plannerRecords[plannerType];
    const index = list.findIndex(q => q?.quotationId === quotationId);

    if (index >= 0) {
      normalized.quotationNumber = list[index]?.quotationNumber || normalized.quotationNumber || displayQuotationNumber(getNextBaseNumber(current.record) - 1, normalized.quotationType);
      normalized.createdAt = list[index]?.createdAt || normalized.createdAt;
      list[index] = normalized;
    } else {
      const baseNumber = getNextBaseNumber(current.record);
      normalized.quotationNumber = displayQuotationNumber(baseNumber, normalized.quotationType);
      current.record.quotationRunningNumber = baseNumber;
      list.unshift(normalized);
    }
    current.record.updatedAt = now;

    const updated = await github(pathFor(role, id), {
      method: 'PUT',
      body: JSON.stringify({ message: `${index >= 0 ? 'Update' : 'Save'} ${plannerType} quotation ${normalized.quotationNumber}`, content: Buffer.from(JSON.stringify(current.record, null, 2) + '\n').toString('base64'), sha: current.sha })
    });
    if (!updated.response.ok) {
      console.error('Quotation write failed:', updated.data);
      return res.status(502).json({ message: 'Unable to save quotation record.' });
    }
    return res.status(200).json({ success: true, quotation: normalized });
  } catch (error) {
    console.error('quotation storage error:', error);
    return res.status(500).json({ message: 'Unable to process quotation record.' });
  }
}
