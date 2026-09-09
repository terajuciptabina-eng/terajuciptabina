export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });

  const expectedKey = process.env.ADMIN_KEY;
  const suppliedKey = String(req.headers['x-admin-key'] || '').trim();
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) return res.status(401).json({ message: 'Unauthorized.' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function github(path) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  async function readJson(path) {
    const result = await github(path);
    if (!result.response.ok) return null;
    const content = result.data?.content ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
    try { return JSON.parse(content); } catch { return null; }
  }
  function summarizeAccount(record) {
    const build = Array.isArray(record?.plannerRecords?.build) ? record.plannerRecords.build : [];
    const renovation = Array.isArray(record?.plannerRecords?.renovation) ? record.plannerRecords.renovation : [];
    return { role: record?.role || '', id: record?.homeownerId || record?.contractorId || '', name: record?.profile?.name || '', email: record?.profile?.email || '', phone: record?.profile?.phone || '', state: record?.state || '', quotationRunningNumber: record?.quotationRunningNumber || 0, buildCount: build.length, renovationCount: renovation.length, updatedAt: record?.updatedAt || '', createdAt: record?.createdAt || '' };
  }
  try {
    const roleFilter = String(req.query?.role || '').toLowerCase();
    const q = String(req.query?.q || '').trim().toLowerCase();
    const includeRecords = String(req.query?.records || '') === '1';
    const roles = roleFilter === 'homeowner' || roleFilter === 'contractor' ? [roleFilter] : ['homeowner', 'contractor'];
    const accounts = [];
    for (const role of roles) {
      const folder = role === 'homeowner' ? 'homeowners' : 'contractors';
      const listing = await github(`data/users/${folder}`);
      if (!listing.response.ok || !Array.isArray(listing.data)) continue;
      for (const item of listing.data.filter(x => x.type === 'file' && x.name.endsWith('.json'))) {
        const record = await readJson(`data/users/${folder}/${item.name}`);
        if (!record) continue;
        const summary = summarizeAccount(record);
        if (q && ![summary.id, summary.name, summary.email, summary.phone].some(v => String(v).toLowerCase().includes(q))) continue;
        accounts.push(includeRecords ? { ...summary, plannerRecords: record.plannerRecords || { build: [], renovation: [] } } : summary);
      }
    }
    accounts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const quotationCount = accounts.reduce((sum, a) => sum + (Number(a.buildCount) || 0) + (Number(a.renovationCount) || 0), 0);
    return res.status(200).json({ repo, generatedAt: new Date().toISOString(), counts: { accounts: accounts.length, quotations: quotationCount }, accounts });
  } catch (error) {
    console.error('admin database error:', error);
    return res.status(500).json({ message: 'Unable to inspect database.' });
  }
}
