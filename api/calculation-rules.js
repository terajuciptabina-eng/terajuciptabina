export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'DELETE'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed.' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const path = 'quotation/calculation-rules.html';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });

  if (req.method === 'DELETE') {
    const expectedKey = process.env.ADMIN_KEY;
    const suppliedKey = String(req.headers['x-admin-key'] || '').trim();
    if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) return res.status(401).json({ message: 'Unauthorized.' });
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function github(options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  function readRules(source) {
    const match = source.match(/const\s+rules\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) throw new Error('Calculation Rules source array not found.');
    let rules;
    try { rules = Function(`"use strict"; return (${match[1]});`)(); } catch { throw new Error('Calculation Rules source is invalid.'); }
    if (!Array.isArray(rules)) throw new Error('Calculation Rules source is invalid.');
    return { rules, start: match.index, length: match[0].length };
  }
  try {
    const current = await github();
    if (!current.response.ok) return res.status(current.response.status).json({ message: current.data?.message || 'Unable to read Calculation Rules.' });
    const source = Buffer.from(current.data?.content || '', 'base64').toString('utf8');
    const parsed = readRules(source);

    if (req.method === 'GET') return res.status(200).json({ ok: true, count: parsed.rules.length, rules: parsed.rules });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const targetPath = String(body.path || '').trim();
    if (!targetPath) return res.status(400).json({ message: 'Rule path is required.' });
    const index = parsed.rules.findIndex(rule => String(rule?.path || '').trim() === targetPath);
    if (index < 0) return res.status(404).json({ message: 'Calculation Rule not found.' });

    const deleted = parsed.rules[index];
    const nextRules = parsed.rules.slice(0, index).concat(parsed.rules.slice(index + 1));
    if (!nextRules.length) return res.status(400).json({ message: 'At least one global Calculation Rule must remain.' });
    const nextSource = source.slice(0, parsed.start) + `const rules=${JSON.stringify(nextRules, null, 2)};` + source.slice(parsed.start + parsed.length);
    const result = await github({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Permanently delete calculation rule: ${targetPath}`, content: Buffer.from(nextSource, 'utf8').toString('base64'), sha: current.data?.sha }) });
    if (!result.response.ok) return res.status(result.response.status).json({ message: result.data?.message || 'Unable to permanently delete Calculation Rule.' });
    return res.status(200).json({ ok: true, deleted: { group: deleted.group, path: deleted.path }, remaining: nextRules.length, message: 'Calculation Rule permanently deleted from the global master source.' });
  } catch (error) {
    console.error('calculation rules admin error:', error);
    return res.status(500).json({ message: error.message || 'Unable to update Calculation Rules.' });
  }
}
