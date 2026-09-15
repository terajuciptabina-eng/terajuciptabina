export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
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
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

  const norm = v => String(v || '').toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/[^a-z0-9]+/g, ' ').trim();
  const slug = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const extractRules = source => {
    const marker = /(?:const|let)\s+rules\s*=\s*\[/;
    const match = source.match(marker);
    if (!match) return [];
    const start = source.indexOf('[', match.index);
    let depth = 0, quote = '', escaped = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '[') depth++;
      else if (c === ']' && --depth === 0) {
        try { return Function('"use strict";return ' + source.slice(start, i + 1))(); } catch { return []; }
      }
    }
    return [];
  };
  const canonicalRules = async () => {
    const url = `https://api.github.com/repos/${repo}/contents/quotation/admin-calculation-rules.html?ref=main`;
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    const data = await response.json();
    const source = Buffer.from(data.content || '', 'base64').toString('utf8');
    return extractRules(source)
      .map((rule, index) => ({ rule, index }))
      .filter(x => Array.isArray(x.rule) && x.rule[1] && x.rule[2] && x.rule[6]);
  };
  const normalizeLegacyRates = async current => {
    const entries = await canonicalRules();
    if (!entries.length || !current?.rates || !current?.rateItems) return current;

    const byKeyBase = new Map();
    const byDescription = new Map();
    for (const [key, value] of Object.entries(current.rates)) {
      const base = String(key).replace(/_\d+$/, '');
      if (!byKeyBase.has(base) && Number.isFinite(Number(value))) byKeyBase.set(base, { key, value });
    }
    for (const [key, item] of Object.entries(current.rateItems)) {
      const description = norm(item?.description);
      const unit = norm(item?.unit);
      if (description && current.rates[key] !== undefined) byDescription.set(`${description}|${unit}`, { key, value: current.rates[key] });
    }

    const rates = { ...current.rates };
    const rateItems = { ...current.rateItems };
    for (const { rule, index } of entries) {
      const canonicalKey = `rule_${slug(rule[1])}_${index}`;
      if (Object.prototype.hasOwnProperty.call(rates, canonicalKey)) continue;

      const keyBase = `rule_${slug(rule[1])}`;
      let match = byKeyBase.get(keyBase);
      if (!match) match = byDescription.get(`${norm(rule[2])}|${norm(rule[6])}`);
      if (!match || !Number.isFinite(Number(match.value))) continue;

      rates[canonicalKey] = Math.round(Number(match.value) * 100) / 100;
      rateItems[canonicalKey] = {
        description: rule[2],
        unit: rule[6],
        category: 'calculation-rule',
        groupKey: rule[0] || null,
        groupTitle: rule[0] || 'Calculation Rules'
      };
    }
    return { ...current, rates, rateItems };
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) return res.status(response.status).json({ message: data?.message || `Unable to read ${requestedState ? STATES[requestedState] : 'Default'} Rate.` });

    let current = JSON.parse(Buffer.from(data.content || '', 'base64').toString('utf8'));
    current = await normalizeLegacyRates(current);
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

    const incomingItems = body.rateItems;
    const rateItems = {};
    if (incomingItems !== undefined) {
      if (!incomingItems || typeof incomingItems !== 'object' || Array.isArray(incomingItems)) return res.status(400).json({ message: 'Invalid rateItems payload.' });
      for (const [key, item] of Object.entries(incomingItems)) {
        if (!key || !item || typeof item !== 'object' || Array.isArray(item)) return res.status(400).json({ message: `Invalid rate item ${key}.` });
        const description = String(item.description || '').trim();
        const unit = String(item.unit || 'ls').trim();
        if (!description) return res.status(400).json({ message: `Missing description for ${key}.` });
        if (!rates[key] && rates[key] !== 0) return res.status(400).json({ message: `Missing rate for ${key}.` });
        rateItems[key] = {
          description,
          unit: unit || 'ls',
          category: String(item.category || 'custom').trim() || 'custom',
          groupKey: item.groupKey ? String(item.groupKey) : null,
          groupTitle: item.groupTitle ? String(item.groupTitle) : 'Custom Rate Items'
        };
      }
    } else if (current.rateItems && typeof current.rateItems === 'object') {
      Object.assign(rateItems, current.rateItems);
    }

    const updated = {
      ...current,
      schemaVersion: current.schemaVersion || '1.0',
      rateSetId: requestedState || 'default',
      ...(requestedState ? { state: STATES[requestedState] } : { name: 'Default Rate', scope: current.scope || 'template' }),
      currency: current.currency || 'MYR',
      effectiveDate: body.effectiveDate || current.effectiveDate || null,
      updatedAt: new Date().toISOString(),
      rates,
      rateItems
    };

    const content = JSON.stringify(updated, null, 2) + '\n';
    const commitResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: requestedState ? `Update ${STATES[requestedState]} Rate` : 'Update Default Rate master', content: Buffer.from(content, 'utf8').toString('base64'), sha: data.sha })
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
