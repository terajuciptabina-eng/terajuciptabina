export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed.' });

  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const token = process.env.GITHUB_TOKEN;
  const adminKey = process.env.ADMIN_KEY;
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const path = 'data/contractors/database.json';

  async function github(options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  function readPayload() { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  function clean(value, max=500) { return String(value ?? '').trim().slice(0, max); }

  try {
    const current = await github();
    if (!current.response.ok) return res.status(502).json({ message: current.data?.message || 'Unable to read contractor database.' });
    let database = {};
    try { database = JSON.parse(Buffer.from(current.data?.content || '', 'base64').toString('utf8')); } catch { database = {}; }
    database.schemaVersion = Math.max(2, Number(database.schemaVersion) || 1);
    database.databaseType = database.databaseType || 'contractor-quotation-database';
    database.storage = 'github';
    database.contractors = Array.isArray(database.contractors) ? database.contractors : [];

    if (req.method === 'GET') {
      const supplied = clean(req.headers['x-admin-key'], 200);
      if (!adminKey || supplied !== adminKey) return res.status(401).json({ message: 'Unauthorized.' });
      return res.status(200).json({ database, generatedAt: new Date().toISOString() });
    }

    const body = readPayload();
    const contractorId = clean(body.contractorId, 80).toUpperCase();
    if (!contractorId) return res.status(400).json({ message: 'contractorId is required.' });
    const plannerType = clean(body.plannerType, 30).toLowerCase();
    if (!['build', 'renovation'].includes(plannerType)) return res.status(400).json({ message: 'Invalid plannerType.' });
    const description = clean(body.description, 1000);
    const unit = clean(body.unit, 50) || 'unit';
    const rate = Number(body.rate);
    if (!description || !Number.isFinite(rate) || rate < 0) return res.status(400).json({ message: 'Description and valid rate are required.' });

    let contractor = database.contractors.find(x => String(x?.contractorId || '').toUpperCase() === contractorId);
    if (!contractor) { contractor = { contractorId, customItems: [], marketHistory: [] }; database.contractors.push(contractor); }
    contractor.customItems = Array.isArray(contractor.customItems) ? contractor.customItems : [];
    contractor.marketHistory = Array.isArray(contractor.marketHistory) ? contractor.marketHistory : [];

    const now = new Date().toISOString();
    const item = {
      customItemId: clean(body.customItemId, 120) || `CI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,
      sourceType: body.sourceGlobalId ? 'override' : 'custom',
      sourceGlobalId: body.sourceGlobalId ? clean(body.sourceGlobalId, 160) : null,
      plannerType,
      description,
      unit,
      rate: Math.round(rate * 100) / 100,
      category: clean(body.category, 80) || 'custom',
      groupKey: clean(body.groupKey, 120) || null,
      groupTitle: clean(body.groupTitle, 120) || 'Custom Items',
      updatedAt: now
    };
    const index = contractor.customItems.findIndex(x => x.customItemId === item.customItemId);
    if (index >= 0) contractor.customItems[index] = { ...contractor.customItems[index], ...item };
    else contractor.customItems.push(item);
    contractor.marketHistory.push({ ...item, capturedAt: now });
    database.updatedAt = now;

    const content = JSON.stringify(database, null, 2) + '\n';
    const updated = await github({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Capture contractor custom item ${contractorId}`, content: Buffer.from(content, 'utf8').toString('base64'), sha: current.data?.sha }) });
    if (!updated.response.ok) return res.status(502).json({ message: updated.data?.message || 'Unable to save contractor custom item.' });
    return res.status(200).json({ ok: true, item, contractorId });
  } catch (error) {
    console.error('contractor market database error:', error);
    return res.status(500).json({ message: 'Unable to process contractor custom item.' });
  }
}
