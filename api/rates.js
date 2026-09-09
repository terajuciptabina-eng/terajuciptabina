export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajucipbina';
  const token = process.env.GITHUB_TOKEN;
  const expectedKey = process.env.ADMIN_KEY;
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });

  const STATES = {
    johor: 'Johor', kedah: 'Kedah', kelantan: 'Kelantan', melaka: 'Melaka',
    'negeri-sembilan': 'Negeri Sembilan', pahang: 'Pahang', perak: 'Perak', perlis: 'Perlis',
    'pulau-pinang': 'Pulau Pinang', sabah: 'Sabah', sarawak: 'Sarawak', selangor: 'Selangor',
    terengganu: 'Terengganu', 'kuala-lumpur': 'Kuala Lumpur', putrajaya: 'Putrajaya', labuan: 'Labuan'
  };

  const requestedState = String(req.query?.state || '').trim().toLowerCase();
  if (requestedState && !STATES[requestedState]) return res.status(400).json({ message: 'Unknown state.' });

  const path = requestedState ? `data/rates/states/${requestedState}.json` : 'data/rates/default.json';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) return res.status(response.status).json({ message: data?.message || `Unable to read ${requestedState ? STATES[requestedState] : 'Default'} Rate.` });

    const currentContent = Buffer.from(data.content || '', 'base64').toString('utf8');
    const current = JSON.parse(currentContent);

    if (req.method === 'GET') return res.status(200).json({ rateSet: current, sha: data.sha, state: requestedState || 'default', repo });
    if (req.method !== 'PUT') return res.status(405).json({ message: 'Method not allowed.' });

    const suppliedKey = String(req.headers['x-admin-key'] || '').trim();
    if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) return res.status(401).json({ message: 'Unauthorized.' });

    const body = req.body || {};
    const incomingRates = body.rates;
    if (!incomingRates || typeof incomingRates !== 'object' || Array.isArray(incomingRates)) return res.status(400).json({ message: 'Invalid rates payload.' });

    const rates = {};
    for (const [key, value] of Object.entries(incomingRates)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: `Invalid rate for ${key}.` });
      rates[key] = Math.round(n * 100) / 100;
    }

    const updated = {
      ...current,
      schemaVersion: current.schemaVersion || '1.0',
      rateSetId: requestedState || 'default',
      ...(requestedState ? { state: STATES[requestedState] } : { name: 'Default Rate', scope: current.scope || 'template' }),
      currency: current.currency || 'MYR',
      effectiveDate: body.effectiveDate || current.effectiveDate || null,
      updatedAt: new Date().toISOString(),
      rates
    };

    const content = JSON.stringify(updated, null, 2) + '\n';
    const commitResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: requestedState ? `Update ${STATES[requestedState]} Rate` : 'Update Default Rate master',
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha: data.sha
      })
    });
    const commitText = await commitResponse.text();
    let commitData = null;
    try { commitData = commitText ? JSON.parse(commitText) : null; } catch { commitData = null; }
    if (!commitResponse.ok) return res.status(commitResponse.status).json({ message: commitData?.message || 'Unable to save Rate.' });

    return res.status(200).json({ ok: true, rateSet: updated, state: requestedState || 'default', commit: commitData?.commit?.sha || null, sha: commitData?.content?.sha || null });
  } catch (error) {
    console.error('rate master error:', error);
    return res.status(500).json({ message: 'Unable to process Rate.' });
  }
}
