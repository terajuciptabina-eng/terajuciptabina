import test from 'node:test';
import assert from 'node:assert/strict';
import contractorMarket from '../api/contractor-market.js';
import { readFileSync } from 'node:fs';

const originalFetch=globalThis.fetch;
const originalEnv={GITHUB_TOKEN:process.env.GITHUB_TOKEN,GITHUB_REPO:process.env.GITHUB_REPO,ADMIN_KEY:process.env.ADMIN_KEY};
function response(status,data){return{ok:status>=200&&status<300,status,async text(){return JSON.stringify(data)}}}
function makeRes(){return{statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}
function setup(t,{account,database}){
 process.env.GITHUB_TOKEN='test-token';process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';process.env.ADMIN_KEY='admin-test';
 let writes=0;
 globalThis.fetch=async(urlValue,options={})=>{
  const url=String(urlValue);
  if(url.includes('/contents/data/contractors/database.json'))return response(200,{sha:'database-sha',encoding:'base64',content:Buffer.from(JSON.stringify(database)).toString('base64')});
  if(url.includes('/contents/data/users/contractors/CTR-TEST.json'))return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
  if(options.method==='PUT'){writes++;return response(200,{content:{sha:'saved-sha'}})}
  return response(404,{message:'Not found'});
 };
 t.after(()=>{globalThis.fetch=originalFetch;for(const[k,v]of Object.entries(originalEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}});
 return{get writes(){return writes}};
}

test('non-Malaysia contractor cannot submit rates into the Malaysia state-rate workflow',async t=>{
 const account={role:'contractor',contractorId:'CTR-TEST',country:'SG'};
 const database={schemaVersion:2,contractors:[{contractorId:'CTR-TEST',customItems:[],marketHistory:[]}]};
 const mocked=setup(t,{account,database});
 const res=makeRes();
 await contractorMarket({method:'POST',headers:{},body:{contractorId:'CTR-TEST',plannerType:'build',description:'Test rate',unit:'m2',rate:100,state:'selangor',sourceGlobalId:'master-wall'}},res);
 assert.equal(res.statusCode,409);
 assert.match(res.body.message,/verified Malaysia account/i);
 assert.equal(mocked.writes,0);
});

test('non-Malaysia contractor rates cannot be approved into Malaysia state rates',async t=>{
 const account={role:'contractor',contractorId:'CTR-TEST',country:'SG'};
 const item={customItemId:'SG-RATE',plannerType:'build',description:'Singapore rate',unit:'m2',rate:100,state:'selangor',countryCode:'SG',currency:'SGD'};
 const database={schemaVersion:2,contractors:[{contractorId:'CTR-TEST',customItems:[item],marketHistory:[]}]};
 const mocked=setup(t,{account,database});
 const res=makeRes();
 await contractorMarket({method:'POST',headers:{'x-admin-key':'admin-test'},body:{action:'approve',contractorId:'CTR-TEST',customItemId:'SG-RATE',state:'selangor',plannerType:'build'}},res);
 assert.equal(res.statusCode,409);
 assert.match(res.body.message,/verified Malaysia account/i);
 assert.equal(mocked.writes,0);
});

test('contractor market aggregates only explicit or account-verified MYR observations',()=>{
 const source=readFileSync(new URL('../api/contractor-market.js',import.meta.url),'utf8');
 const rateMarket=readFileSync(new URL('../api/contractor-rate-market.js',import.meta.url),'utf8');
 const adminComparison=readFileSync(new URL('../TerajuWorks/admin-rate-comparison.html',import.meta.url),'utf8');
 assert.match(source,/contractor\.countryCode!=='MY'\|\|contractor\.currency!=='MYR'\|\|itemCountry!=='MY'\|\|itemCurrency!=='MYR'/);
 assert.match(source,/if \(action === 'approve'\) \{\s*const registered = await registeredContractorCountry\(contractorId\);\s*if \(!registered\.ok \|\| registered\.country !== 'MY'\)/);
 assert.match(rateMarket,/String\(account\?\.country \|\| ''\)\.trim\(\)\.toUpperCase\(\) !== 'MY'/);
 assert.match(rateMarket,/countryCodes\.some\(code=>code!=='MY'\) \|\| !currencies\.length \|\| currencies\.some\(code=>code!=='MYR'\)/);
 assert.match(adminComparison,/filter\(c=>c\.countryCode==='MY'&&c\.currency==='MYR'\)/);
 assert.match(adminComparison,/item\?\.currency&&String\(item\.currency\)\.toUpperCase\(\)!=='MYR'/);
});
