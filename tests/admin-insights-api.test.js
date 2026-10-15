import test from 'node:test';
import assert from 'node:assert/strict';
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
