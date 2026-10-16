import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/quotations.js';

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;
const originalRepo = process.env.GITHUB_REPO;

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(data); } };
}
function makeRes() {
  return { statusCode:200, body:null, headers:{}, setHeader(k,v){this.headers[k]=v;return this;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;}, end(){return this;} };
}
function setup(t, account) {
  process.env.GITHUB_TOKEN='test-token';
  process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';
  globalThis.fetch=async (url, options={}) => {
    if(String(url).includes('/contents/data/users/contractors/CTR-TEST.json')) {
      return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
    }
    if(options.method==='PUT') return response(200,{content:{sha:'saved-sha'}});
    return response(404,{message:'Not found'});
  };
  t.after(()=>{globalThis.fetch=originalFetch;if(originalToken===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=originalToken;if(originalRepo===undefined)delete process.env.GITHUB_REPO;else process.env.GITHUB_REPO=originalRepo;});
}

test('Cost Estimate GET quarantines country-mismatched records instead of relabelling them', async t => {
  const account={role:'contractor',contractorId:'CTR-TEST',country:'SG',plannerRecords:{build:[
    {quotationId:'SG-OK',countryCode:'SG',currency:'SGD',plannerState:{countryCode:'SG',projectCountry:{countryCode:'SG',currency:'SGD'}}},
    {quotationId:'MY-CONFLICT',countryCode:'MY',currency:'MYR',plannerState:{countryCode:'SG',projectCountry:{countryCode:'SG',currency:'SGD'}}},
    {quotationId:'NO-MARKET',items:[]}
  ]}};
  setup(t,account);
  const res=makeRes();
  await handler({method:'GET',query:{role:'contractor',id:'CTR-TEST',plannerType:'build'}},res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.quotations.map(q=>q.quotationId),['SG-OK']);
  assert.equal(res.body.country,'SG');
  assert.equal(res.body.excludedMarketRecordCount,2);
});

test('Cost Estimate save rejects nested country or currency conflicts before writing', async t => {
  const account={role:'contractor',contractorId:'CTR-TEST',country:'SG',plannerRecords:{build:[],renovation:[]}};
  let writes=0;
  setup(t,account);
  globalThis.fetch=async (url, options={}) => {
    if(String(url).includes('/contents/data/users/contractors/CTR-TEST.json')) return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
    if(options.method==='PUT') { writes++; return response(200,{content:{sha:'saved-sha'}}); }
    return response(404,{message:'Not found'});
  };
  const res=makeRes();
  await handler({method:'PUT',body:{role:'contractor',id:'CTR-TEST',plannerType:'build',quotation:{
    quotationId:'BAD-MARKET',countryCode:'SG',currency:'SGD',
    plannerState:{countryCode:'MY',projectCountry:{countryCode:'SG',currency:'SGD'},projectState:''}
  }}},res);
  assert.equal(res.statusCode,409);
  assert.match(res.body.message,/country/i);
  assert.equal(writes,0,'conflicting market metadata must not be persisted');
});

test('Cost Estimate save rejects missing country and currency metadata even for Malaysia accounts', async t => {
  const account={role:'contractor',contractorId:'CTR-TEST',country:'MY',plannerRecords:{build:[],renovation:[]}};
  let writes=0;
  setup(t,account);
  globalThis.fetch=async (url, options={}) => {
    if(String(url).includes('/contents/data/users/contractors/CTR-TEST.json')) return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
    if(options.method==='PUT') { writes++; return response(200,{content:{sha:'saved-sha'}}); }
    return response(404,{message:'Not found'});
  };
  const res=makeRes();
  await handler({method:'PUT',body:{role:'contractor',id:'CTR-TEST',plannerType:'build',quotation:{
    quotationId:'NO-MARKET-METADATA',items:[],plannerState:{projectState:'selangor'}
  }}},res);
  assert.equal(res.statusCode,400);
  assert.match(res.body.message,/country market metadata/i);
  assert.equal(writes,0,'an estimate without explicit market metadata must never be relabelled MYR');
});

test('Cost Estimate save rejects country metadata without currency metadata', async t => {
  const account={role:'contractor',contractorId:'CTR-TEST',country:'SG',plannerRecords:{build:[],renovation:[]}};
  let writes=0;
  setup(t,account);
  globalThis.fetch=async (url, options={}) => {
    if(String(url).includes('/contents/data/users/contractors/CTR-TEST.json')) return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
    if(options.method==='PUT') { writes++; return response(200,{content:{sha:'saved-sha'}}); }
    return response(404,{message:'Not found'});
  };
  const res=makeRes();
  await handler({method:'PUT',body:{role:'contractor',id:'CTR-TEST',plannerType:'build',quotation:{
    quotationId:'NO-CURRENCY-METADATA',countryCode:'SG',plannerState:{countryCode:'SG',projectCountry:{countryCode:'SG'}},items:[]
  }}},res);
  assert.equal(res.statusCode,400);
  assert.match(res.body.message,/currency metadata/i);
  assert.equal(writes,0,'an estimate without explicit currency metadata must not be persisted');
});
