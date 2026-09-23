export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });

  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const token = process.env.GITHUB_TOKEN;
  const adminKey = process.env.ADMIN_KEY;
  const suppliedKey = String(req.headers['x-admin-key'] || '').trim();
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  if (!adminKey || suppliedKey !== adminKey) return res.status(401).json({ message: 'Unauthorized.' });

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const gh = async url => {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { r, data };
  };

  const norm = v => String(v || '').trim().toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/[^a-z0-9]+/g, ' ').trim();
  const slug = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const median = values => {
    const a = values.slice().sort((x,y) => x-y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
  };

  function extractRules(source) {
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
  }

  try {
    const rulesResult = await gh(`https://api.github.com/repos/${repo}/contents/quotation/admin-calculation-rules.html?ref=main`);
    if (!rulesResult.r.ok) return res.status(502).json({ message: 'Unable to load Global Calculation Rules.' });
    const rulesSource = Buffer.from(rulesResult.data?.content || '', 'base64').toString('utf8');
    const rules = extractRules(rulesSource)
      .map((rule,index) => Array.isArray(rule) ? {
        index,
        key: `rule_${slug(rule[1])}_${index}`,
        description: String(rule[2] || ''),
        unit: String(rule[6] || ''),
        group: String(rule[0] || '')
      } : null)
      .filter(Boolean);

    const dir = await gh(`https://api.github.com/repos/${repo}/contents/data/users/contractors?ref=main`);
    if (!dir.r.ok || !Array.isArray(dir.data)) return res.status(502).json({ message: 'Unable to load contractor records.' });

    const observations = new Map();
    const contractorFiles = dir.data.filter(x => x.type === 'file' && /\\.json$/i.test(x.name));
    for (const file of contractorFiles) {
      const recordResult = await gh(file.download_url || file.url);
      if (!recordResult.r.ok) continue;
      let account = null;
      try { account = JSON.parse(Buffer.from(recordResult.data?.content || '', 'base64').toString('utf8')); } catch { continue; }
      const contractorId = String(account?.contractorId || '').trim().toUpperCase();
      if (!contractorId) continue;

      for (const plannerType of ['build','renovation']) {
        for (const record of Array.isArray(account?.plannerRecords?.[plannerType]) ? account.plannerRecords[plannerType] : []) {
          if (String(record?.state || '').toLowerCase() !== 'final') continue;
          const plannerState = record?.plannerState || {};
          const state = String(
            plannerState.projectState ||
            plannerState.rateSetId ||
            record?.project?.state ||
            ''
          ).trim().toLowerCase();
          if (!state) continue;
          const rates = plannerState?.rates && typeof plannerState.rates === 'object' ? plannerState.rates : {};
          const updatedAt = String(record?.updatedAt || plannerState?.rateSnapshotAt || record?.createdAt || '');
          for (const rule of rules) {
            const raw = rates[rule.key];
            const value = Number(raw);
            if (!Number.isFinite(value) || value <= 0) continue;
            const k = `${state}|${plannerType}|${rule.key}`;
            if (!observations.has(k)) observations.set(k, { state, plannerType, ruleKey: rule.key, values: [], contractors: new Set(), latestAt: '' });
            const item = observations.get(k);
            item.values.push(value);
            item.contractors.add(contractorId);
            if (updatedAt > item.latestAt) item.latestAt = updatedAt;
          }
        }
      }
    }

    const market = {};
    for (const item of observations.values()) {
      const values = item.values;
      const m = median(values);
      const key = `${item.state}|${item.plannerType}|${item.ruleKey}`;
      market[key] = {
        state: item.state,
        plannerType: item.plannerType,
        ruleKey: item.ruleKey,
        median: m == null ? null : Math.round(m * 100) / 100,
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        observationCount: values.length,
        contractorCount: item.contractors.size,
        latestAt: item.latestAt || null
      };
    }

    return res.status(200).json({
      schemaVersion: 1,
      source: 'final contractor quotation rate snapshots',
      methodology: 'Median of positive contractor-submitted rates grouped by state, planner and Global Calculation Rules item. Individual contractor identity is not returned.',
      market
    });
  } catch (error) {
    console.error('contractor rate market error:', error);
    return res.status(500).json({ message: 'Unable to build contractor market rate signal.' });
  }
}
