import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import handler from '../api/admin.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_KEY: process.env.ADMIN_KEY
};

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(data); }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; }
  };
}

function makeReq(query = {}) {
  return { method: 'GET', query, headers: {
    'x-admin-username': 'admin',
    'x-admin-password': 'test-secret'
  } };
}

function encoded(record) {
  return Buffer.from(JSON.stringify(record)).toString('base64');
}

test('Admin Insights loads every account with bounded parallel reads', async t => {
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'terajuciptabina-eng/terajuciptabina';
  process.env.ADMIN_PASSWORD = 'test-secret';
  process.env.ADMIN_KEY = '';
  let activeReads = 0, maxReads = 0;
  const accountCount = 12;
  globalThis.fetch = async urlValue => {
    const url = new URL(String(urlValue));
    const path = decodeURIComponent(url.pathname.replace('/repos/terajuciptabina-eng/terajuciptabina/contents/', ''));
    if (path === 'data/users/homeowners') return response(200,
      Array.from({ length: accountCount }, (_, i) => ({ type: 'file', name: `h${i}.json` })));
    if (path === 'data/users/contractors') return response(200,
      Array.from({ length: accountCount }, (_, i) => ({ type: 'file', name: `c${i}.json` })));
    const match = path.match(/^data\/users\/(homeowners|contractors)\/(.+\.json)$/);
    if (!match) return response(404, { message: 'Not found' });
    activeReads++;
    maxReads = Math.max(maxReads, activeReads);
    await new Promise(resolve => setTimeout(resolve, 2));
    activeReads--;
    const contractor = match[1] === 'contractors';
    const id = match[2].replace('.json', '');
    return response(200, { content: encoded({
      role: contractor ? 'contractor' : 'homeowner',
      [contractor ? 'contractorId' : 'homeownerId']: id,
      country: contractor ? 'SG' : 'MY',
      profile: { name: id },
      createdAt: '2026-10-01T00:00:00Z',
      plannerRecords: { build: [{ total: 100 }], renovation: [] }
    }) });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const res = makeRes();
  await handler(makeReq({ records: '1' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.accounts.length, accountCount * 2);
  assert.equal(res.body.counts.accounts, accountCount * 2);
  assert.equal(res.body.counts.quotations, accountCount * 2);
  assert.ok(maxReads > 1, 'account JSON files should be read concurrently');
  assert.ok(maxReads <= 8, 'parallel account reads must remain bounded to eight');
  assert.equal(res.body.accounts.filter(a => a.country === 'SG').length, accountCount);
});

test('Admin Insights fails clearly when a country-independent account index fails', async t => {
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'terajuciptabina-eng/terajuciptabina';
  process.env.ADMIN_PASSWORD = 'test-secret';
  process.env.ADMIN_KEY = '';
  globalThis.fetch = async urlValue => {
    const url = new URL(String(urlValue));
    const path = decodeURIComponent(url.pathname.replace('/repos/terajuciptabina-eng/terajuciptabina/contents/', ''));
    if (path === 'data/users/homeowners') return response(200, []);
    if (path === 'data/users/contractors') return response(503, { message: 'upstream unavailable' });
    return response(404, { message: 'Not found' });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const res = makeRes();
  await handler(makeReq({ records: '1' }), res);
  assert.equal(res.statusCode, 502);
  assert.match(res.body.message, /contractor account index/i);
  assert.equal(res.body.accounts, undefined, 'must not return partial account metrics');
});


test('Admin Insights isolates country metrics and quarantines conflicting estimate metadata', async () => {
  const html = (await import('node:fs/promises')).readFile;
  const source = await html(new URL('../TerajuWorks/admin-insights.html', import.meta.url), 'utf8');
  const script = [...source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(value => value.includes('function recordMatchesAccountMarket'));
  assert.ok(script, 'Admin Insights market functions must exist');
  const start = script.indexOf('const CURRENCIES=');
  const end = script.indexOf('function destroy(');
  assert.ok(start >= 0 && end > start, 'market function block must be extractable');
  const block = script.slice(start, end);
  const context = {
    document: { getElementById(id) { return { value: id === 'countryFilter' ? 'SG' : 'all' }; } },
    Intl, Number, String, Array, Object, Math, Date
  };
  vm.createContext(context);
  vm.runInContext('let accounts=[];\n' + block + '\n globalThis.api={setAccounts(v){accounts=v},accountCountry,recordsFor,recordMatchesAccountMarket,quarantinedRecordCount,filteredCountryAccounts,moneyByCurrency};', context);
  const accounts = [
    {id:'MY-1',country:'MY',role:'homeowner',plannerRecords:{build:[{plannerType:'build',total:100,countryCode:'MY',currency:'MYR'}]}},
    {id:'SG-1',country:'SG',role:'contractor',plannerRecords:{build:[{plannerType:'build',total:200,countryCode:'SG',currency:'SGD'}]}},
    {id:'SG-2',country:'SG',role:'contractor',plannerRecords:{build:[{plannerType:'build',total:9000,countryCode:'SG',currency:'SGD',plannerState:{projectCountry:{countryCode:'MY',currency:'MYR'}}}]}},
    {id:'VN-1',country:'VN',role:'homeowner',plannerRecords:{renovation:[{plannerType:'renovation',total:300,countryCode:'VN',currency:'VND'}]}},
    {id:'SG-3',country:'SG',role:'contractor',plannerRecords:{build:[{plannerType:'build',total:500}]}}
  ];
  context.api.setAccounts(accounts);
  assert.equal(context.api.filteredCountryAccounts().length, 3, 'Singapore account filter must not include other countries');
  assert.equal(context.api.recordsFor(accounts[1]).length, 1, 'consistent Singapore estimate should remain visible');
  assert.equal(context.api.recordsFor(accounts[2]).length, 0, 'conflicting nested country/currency metadata must be excluded');
  assert.equal(context.api.recordsFor(accounts[4]).length, 0, 'non-MY estimates without country metadata must be excluded');
  assert.equal(context.api.quarantinedRecordCount(), 2, 'both invalid Singapore estimates should be counted');
  const display = context.api.moneyByCurrency([{countryCode:'SG',record:{total:200}},{countryCode:'MY',record:{total:100}}]);
  assert.match(display, /Singapore \(SGD S\$ 200\)/);
  assert.match(display, /Malaysia \(MYR RM 100\)/);
  assert.ok(display.indexOf('Malaysia') < display.indexOf('Singapore'), 'currency groups should be alphabetically deterministic');
});


test('all changed country-market scripts parse and the rate dataset is complete', async () => {
  const readFile = (await import('node:fs/promises')).readFile;
  const { Script } = await import('node:vm');
  const paths = [
    '../api/admin.js',
    '../api/quotations.js',
    '../api/project-control.js',
    '../api/auth.js',
    '../TerajuWorks/auth-github.js',
    '../TerajuWorks/country-context.js',
    '../TerajuWorks/state-rate-gate.js',
    '../TerajuWorks/state-rate-resolver.js',
    '../TerajuWorks/quotation-records.js'
  ];
  for (const relative of paths) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    const normalized = source.replace(/^export default async function handler/m, 'async function handler');
    assert.doesNotThrow(() => new Script(normalized), relative + ' must parse');
  }
  const htmlPaths = [
    '../TerajuWorks/admin-insights.html',
    '../TerajuWorks/admin-database.html',
    '../TerajuWorks/contract.html',
    '../TerajuWorks/work-program.html',
    '../TerajuWorks/progress.html',
    '../TerajuWorks/s-curve.html',
    '../TerajuWorks/project-insight.html'
  ];
  for (const relative of htmlPaths) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    const scripts = [...source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(x => x.trim());
    assert.ok(scripts.length, relative + ' should contain inline application code');
    scripts.forEach((script, index) => assert.doesNotThrow(() => new Script(script), relative + ' inline script ' + index + ' must parse'));
  }
  const resolverSource = await readFile(new URL('../TerajuWorks/state-rate-resolver.js', import.meta.url), 'utf8');
  assert.doesNotMatch(resolverSource, /TERAJU_PROJECT_COUNTRY\?\.countryCode\s*\|\|\s*['\"]MY['\"]/, 'state-rate resolver must not assume Malaysia when account market is unverified');
  assert.match(resolverSource, /TERAJU_ACCOUNT_MARKET_VERIFIED\s*!==\s*true/, 'state-rate resolver must wait for authoritative account-country verification');
  const contextSource = await readFile(new URL('../TerajuWorks/country-context.js', import.meta.url), 'utf8');
  assert.match(contextSource, /TERAJU_ACCOUNT_MARKET_VERIFIED\s*=\s*false/, 'country verification must start closed');
  assert.match(contextSource, /TERAJU_ACCOUNT_MARKET_VERIFIED\s*=\s*true/, 'country verification opens only after account API resolution');
  const authUiSource = await readFile(new URL('../TerajuWorks/auth-github.js', import.meta.url), 'utf8');
  assert.doesNotMatch(authUiSource, /country:\s*record\.country\s*\|\|\s*['\"]MY['\"]/, 'account cache must not silently label legacy accounts as Malaysia');
  const rates = JSON.parse(await readFile(new URL('../data/rates/country-comparison-2026.json', import.meta.url), 'utf8'));
  assert.equal(rates.rates.length, 122);
  assert.equal(rates.plannerCounts.build, 82);
  assert.equal(rates.plannerCounts.renovation, 40);
  assert.doesNotMatch(rates.methodology, /\[object Object\]/, 'methodology must be human-readable, not object-coercion output');
  assert.match(rates.methodology, /not contractor-quoted or independently validated/i);
  for (const row of rates.rates) {
    for (const field of ['Malaysia_MYR', 'SGD', 'IDR', 'THB', 'PHP', 'VND', 'BND']) {
      assert.notEqual(row[field], null, row.id + ' must not omit ' + field);
      assert.notEqual(String(row[field]).trim(), '', row.id + ' must not leave ' + field + ' blank');
      assert.ok(Number.isFinite(Number(row[field])) && Number(row[field]) >= 0, row.id + ' must have valid ' + field);
    }
  }
});
