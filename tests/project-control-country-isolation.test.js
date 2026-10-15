import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/project-control.js';

const originalFetch=globalThis.fetch;
const originalToken=process.env.GITHUB_TOKEN;
const originalRepo=process.env.GITHUB_REPO;
function response(status,data){return{ok:status>=200&&status<300,status,async text(){return JSON.stringify(data)}}}
function makeRes(){return{statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}
function setup(t,{account,existing=null,sourceEstimate=null}){
 process.env.GITHUB_TOKEN='test-token';process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';
 let writes=0;
 globalThis.fetch=async(urlValue,options={})=>{
  const url=String(urlValue);
  if(url.includes('/contents/data/users/contractors/CTR-TEST.json')){
   if(!account)return response(404,{message:'Not found'});
   return response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(account)).toString('base64')});
  }
  if(url.includes('/contents/data/project-control/contractors/CTR-TEST/')){
   if(options.method==='PUT'){writes++;return response(201,{content:{sha:'saved-sha'}})}
   if(existing&&url.includes('QT-SG-1.json'))return response(200,{sha:'record-sha',encoding:'base64',content:Buffer.from(JSON.stringify(existing)).toString('base64')});
   return response(404,{message:'Not found'});
  }
  if(url.includes('/contents/data/project-control/contractors/CTR-TEST/build/QT-SG-1.json')&&options.method==='PUT'){writes++;return response(201,{content:{sha:'saved-sha'}})}
  if(url.includes('/contents/data/project-control/contractors/CTR-TEST/build/QT-SG-1.progress.json'))return response(404,{message:'Not found'});
  return response(404,{message:'Not found'});
 };
 t.after(()=>{globalThis.fetch=originalFetch;if(originalToken===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=originalToken;if(originalRepo===undefined)delete process.env.GITHUB_REPO;else process.env.GITHUB_REPO=originalRepo});
 return {get writes(){return writes}};
}
function accountWith(country,estimate){return{role:'contractor',contractorId:'CTR-TEST',country,plannerRecords:{build:estimate?[estimate]:[],renovation:[]}}}
function sgEstimate(extra={}){return{quotationId:'QT-SG-1',countryCode:'SG',currency:'SGD',plannerState:{countryCode:'SG',projectCountry:{countryCode:'SG',currency:'SGD'}},...extra}}

test('Project Control GET rejects a source estimate with conflicting country metadata',async t=>{
 const estimate=sgEstimate({plannerState:{countryCode:'MY',projectCountry:{countryCode:'SG',currency:'SGD'}}});
 setup(t,{account:accountWith('SG',estimate)});
 const res=makeRes();
 await handler({method:'GET',query:{id:'CTR-TEST',plannerType:'build',quotationId:'QT-SG-1'}},res);
 assert.equal(res.statusCode,409);
 assert.match(res.body.message,/country/i);
});

test('Project Control PUT rejects contract currency mismatch before persistence',async t=>{
 const state=sgEstimate();
 const mocked=setup(t,{account:accountWith('SG',state)});
 const res=makeRes();
 await handler({method:'PUT',body:{id:'CTR-TEST',plannerType:'build',quotationId:'QT-SG-1',record:{contract:{contractNumber:'C-1',countryCode:'SG',currency:'MYR',projectCountry:{countryCode:'SG',currency:'MYR'}}}}},res);
 assert.equal(res.statusCode,409);
 assert.match(res.body.message,/currency/i);
 assert.equal(mocked.writes,0);
});

test('Project Control PUT accepts matching Singapore market and stamps SGD metadata',async t=>{
 const estimate=sgEstimate();
 const mocked=setup(t,{account:accountWith('SG',estimate)});
 const res=makeRes();
 await handler({method:'PUT',body:{id:'CTR-TEST',plannerType:'build',quotationId:'QT-SG-1',record:{contract:{contractNumber:'C-1',contractSum:1000,countryCode:'SG',currency:'SGD',projectCountry:{countryCode:'SG',currency:'SGD'}}}}},res);
 assert.equal(res.statusCode,200);
 assert.equal(mocked.writes,1);
 assert.equal(res.body.record.countryCode,'SG');
 assert.equal(res.body.record.currency,'SGD');
 assert.equal(res.body.record.currencySymbol,'S$');
});

test('Project Control quarantines a legacy source estimate without country/currency metadata',async t=>{
 const legacyEstimate={quotationId:'QT-SG-1',total:1000,items:[]};
 setup(t,{account:accountWith('SG',legacyEstimate)});
 const res=makeRes();
 await handler({method:'GET',query:{id:'CTR-TEST',plannerType:'build',quotationId:'QT-SG-1'}},res);
 assert.equal(res.statusCode,409);
 assert.match(res.body.message,/country/i);
});
