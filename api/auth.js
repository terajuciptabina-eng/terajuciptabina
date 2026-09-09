export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const validRole = role => role === 'homeowner' || role === 'contractor';
  const folder = role => role === 'homeowner' ? 'homeowners' : 'contractors';
  const idKey = role => role === 'homeowner' ? 'homeownerId' : 'contractorId';
  const makeId = role => `${role === 'homeowner' ? 'HME' : 'CTR'}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const pathFor = (role, id) => `data/users/${folder(role)}/${encodeURIComponent(id)}.json`;

  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      ...options,
      headers: { ...ghHeaders, ...(options.headers || {}) }
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }

  try {
    if (req.method === 'GET') {
      const role = String(req.query?.role || '').toLowerCase();
      const id = String(req.query?.id || '').trim().toUpperCase();
      if (!validRole(role) || !id) return res.status(400).json({ message: 'Missing role or id.' });
      const result = await github(pathFor(role, id));
      if (result.response.status === 404) return res.status(404).json({ message: 'Account not found.' });
      if (!result.response.ok) return res.status(502).json({ message: 'Unable to read account record.' });
      const content = result.data?.content ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
      return res.status(200).json(JSON.parse(content));
    }

    const body = req.body || {};
    const role = String(body.role || '').toLowerCase();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    if (!validRole(role)) return res.status(400).json({ message: 'Invalid role.' });
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });

    let id = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = makeId(role);
      const check = await github(pathFor(role, candidate));
      if (check.response.status === 404) { id = candidate; break; }
    }
    if (!id) return res.status(500).json({ message: 'Unable to generate a unique account ID.' });

    const record = {
      schemaVersion: 1,
      recordType: 'user-account',
      storage: 'github-temporary',
      role,
      [idKey(role)]: id,
      profile: { name, email, phone },
      auth: { mode: 'temporary-id', passwordStored: false },
      state: 'active',
      plannerRecords: { build: [], renovation: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await github(pathFor(role, id), {
      method: 'PUT',
      body: JSON.stringify({
        message: `Create temporary ${role} account ${id}`,
        content: Buffer.from(JSON.stringify(record, null, 2) + '\n').toString('base64')
      })
    });
    if (!created.response.ok) {
      console.error('GitHub account write failed:', created.data);
      return res.status(502).json({ message: 'Unable to save account record.' });
    }
    return res.status(201).json({ success: true, role, id, record });
  } catch (error) {
    console.error('auth error:', error);
    return res.status(500).json({ message: 'Unable to process account request.' });
  }
}
