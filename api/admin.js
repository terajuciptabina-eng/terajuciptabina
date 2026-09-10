export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed.' });
  const expectedKey = process.env.ADMIN_KEY;
  const suppliedKey = String(req.headers['x-admin-key'] || '').trim();
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) return res.status(401).json({ message: 'Unauthorized.' });
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  async function readJson(path) {
    const result = await github(path); if (!result.response.ok) return null;
    const content = result.data?.content ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
    try { return JSON.parse(content); } catch { return null; }
  }
  async function findUser(role, id) {
    const folder = role === 'homeowner' ? 'homeowners' : 'contractors';
    const listing = await github(`data/users/${folder}`);
    if (!listing.response.ok || !Array.isArray(listing.data)) return { error: 'Database folder not found.' };
    for (const item of listing.data.filter(x => x.type === 'file' && x.name.endsWith('.json'))) {
      const record = await readJson(`data/users/${folder}/${item.name}`);
      const recordId = String(record?.homeownerId || record?.contractorId || '').trim();
      if (recordId === id) return { folder, item, record };
    }
    return { error: 'User not found.' };
  }
  try {
    const roleFilter = String(req.query?.role || '').toLowerCase(); const q = String(req.query?.q || '').trim().toLowerCase(); const includeRecords = String(req.query?.records || '') === '1';
    const roles = roleFilter === 'homeowner' || roleFilter === 'contractor' ? [roleFilter] : ['homeowner', 'contractor'];
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const role = String(body.role || '').toLowerCase(); const id = String(body.id || '').trim();
      if (!['homeowner', 'contractor'].includes(role) || !id) return res.status(400).json({ message: 'Valid role and account ID are required.' });
      const found = await findUser(role, id);
      if (found.error) return res.status(404).json({ message: found.error });
      const profile = found.record.profile && typeof found.record.profile === 'object' ? found.record.profile : {};
      const nextProfile = { ...profile, name: String(body.profile?.name ?? profile.name ?? '').trim(), email: String(body.profile?.email ?? profile.email ?? '').trim(), phone: String(body.profile?.phone ?? profile.phone ?? '').trim() };
      if (!nextProfile.name) return res.status(400).json({ message: 'Profile name is required.' });
      found.record.profile = nextProfile;
      found.record.updatedAt = new Date().toISOString();
      const result = await github(`data/users/${found.folder}/${found.item.name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Update ${role} profile ${id} from admin`, content: Buffer.from(JSON.stringify(found.record, null, 2) + '\n', 'utf8').toString('base64'), sha: found.item.sha }) });
      if (!result.response.ok) return res.status(result.response.status).json({ message: result.data?.message || 'Unable to update profile.' });
      return res.status(200).json({ ok: true, id, role, profile: nextProfile, updatedAt: found.record.updatedAt, message: 'Profile updated.' });
    }
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const role = String(body.role || '').toLowerCase(); const id = String(body.id || '').trim();
      if (!['homeowner', 'contractor'].includes(role) || !id) return res.status(400).json({ message: 'Valid role and account ID are required.' });
      const found = await findUser(role, id);
      if (found.error) return res.status(404).json({ message: found.error });
      const result = await github(`data/users/${found.folder}/${found.item.name}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Delete ${role} ${id} from admin database`, sha: found.item.sha }) });
      if (!result.response.ok) return res.status(result.response.status).json({ message: result.data?.message || 'Unable to delete user.' });
      return res.status(200).json({ ok: true, id, role, message: 'User deleted.' });
    }
    const accounts = [];
    for (const role of roles) {
      const folder = role === 'homeowner' ? 'homeowners' : 'contractors'; const listing = await github(`data/users/${folder}`);
      if (!listing.response.ok || !Array.isArray(listing.data)) continue;
      for (const item of listing.data.filter(x => x.type === 'file' && x.name.endsWith('.json'))) {
        const record = await readJson(`data/users/${folder}/${item.name}`); if (!record) continue;
        const build = Array.isArray(record?.plannerRecords?.build) ? record.plannerRecords.build : [];
        const renovation = Array.isArray(record?.plannerRecords?.renovation) ? record.plannerRecords.renovation : [];
        const summary = { role: record?.role || '', id: record?.homeownerId || record?.contractorId || '', name: record?.profile?.name || '', email: record?.profile?.email || '', phone: record?.profile?.phone || '', state: record?.state || '', quotationRunningNumber: record?.quotationRunningNumber || 0, buildCount: build.length, renovationCount: renovation.length, updatedAt: record?.updatedAt || '', createdAt: record?.createdAt || '' };
        if (q && ![summary.id, summary.name, summary.email, summary.phone].some(v => String(v).toLowerCase().includes(q))) continue;
        accounts.push(includeRecords ? { ...summary, plannerRecords: record.plannerRecords || { build: [], renovation: [] } } : summary);
      }
    }
    accounts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const quotationCount = accounts.reduce((sum, a) => sum + (Number(a.buildCount) || 0) + (Number(a.renovationCount) || 0), 0);
    return res.status(200).json({ repo, generatedAt: new Date().toISOString(), counts: { accounts: accounts.length, quotations: quotationCount }, accounts });
  } catch (error) { console.error('admin database error:', error); return res.status(500).json({ message: 'Unable to inspect database.' }); }
}
