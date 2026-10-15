import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/auth.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_TEMPLATE_NAME: process.env.WHATSAPP_TEMPLATE_NAME
};

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(data); } };
}
function makeRes() {
  return { statusCode: 200, body: null, headers: {},
    setHeader(k,v) { this.headers[k]=v; return this; },
    status(n) { this.statusCode=n; return this; },
    json(v) { this.body=v; return this; },
    end() { return this; }
  };
}
function request(body) { return { method:'POST', body, headers:{} }; }
function restore(t) {
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}
function setup(t) {
  restore(t);
  process.env.GITHUB_TOKEN='test-token';
  process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';
  for (const key of ['RESEND_API_KEY','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_TEMPLATE_NAME']) delete process.env[key];
}

test('signup rejects missing or unsupported country before any account write', async t => {
  setup(t);
  let writes=0;
  globalThis.fetch=async (_url,options={}) => {
    if(options.method==='PUT') writes++;
    return response(404,{message:'Not found'});
  };
  for (const country of ['', 'US', null]) {
    const res=makeRes();
    await handler(request({role:'homeowner',name:'Test User',email:'test@example.com',phone:'123456789',country}),res);
    assert.equal(res.statusCode,400);
    assert.match(res.body.message,/country/i);
  }
  assert.equal(writes,0);
});

test('signup validates the phone against selected country and stores normalized market metadata', async t => {
  setup(t);
  let savedRecord=null;
  globalThis.fetch=async (urlValue,options={}) => {
    const url=String(urlValue);
    if(options.method==='PUT') {
      const payload=JSON.parse(options.body);
      savedRecord=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));
      return response(201,{content:{name:'created.json'}});
    }
    if(url.includes('/contents/data/users/')) return response(404,{message:'Not found'});
    return response(404,{message:'Not found'});
  };
  const mismatch=makeRes();
  await handler(request({role:'contractor',name:'Test Contractor',email:'test@example.com',phone:'+60123456789',country:'SG'}),mismatch);
  assert.equal(mismatch.statusCode,400,'a Malaysian international number must not pass Singapore validation');
  assert.equal(savedRecord,null,'invalid phone must not create an account');

  const valid=makeRes();
  await handler(request({role:'contractor',name:'Test Contractor',email:'test@example.com',phone:'81234567',country:'SG'}),valid);
  assert.equal(valid.statusCode,201);
  assert.equal(savedRecord.country,'SG');
  assert.equal(savedRecord.profile.phone,'+6581234567');
  assert.equal(savedRecord.role,'contractor');
});
