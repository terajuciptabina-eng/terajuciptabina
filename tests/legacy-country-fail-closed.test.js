import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../api/auth.js';
import quotations from '../api/quotations.js';
import projectControl from '../api/project-control.js';

const originalFetch=globalThis.fetch;
const originalEnv={GITHUB_TOKEN:process.env.GITHUB_TOKEN,GITHUB_REPO:process.env.GITHUB_REPO};
function response(status,data){return{ok:status>=200&&status<300,status,async text(){return JSON.stringify(data)}}}
function makeRes(){return{statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}
function setup(t,record){
 process.env.GITHUB_TOKEN='test-token';process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';
 globalThis.fetch=async url=>String(url).includes('/contents/data/users/')?response(200,{sha:'account-sha',encoding:'base64',content:Buffer.from(JSON.stringify(record)).toString('base64')}):response(404,{message:'Not found'});
 t.after(()=>{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(originalEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}});
}
const legacy={role:'contractor',contractorId:'CTR-TEST',profile:{name:'Legacy contractor'},plannerRecords:{build:[],renovation:[]}};

test('legacy account GET defaults pre-country-feature accounts to Malaysia',async t=>{
 setup(t,legacy);
 const res=makeRes();
 await auth({method:'GET',query:{role:'contractor',id:'CTR-TEST'},headers:{}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.country,'MY');
});

test('Cost Estimate API treats legacy account without country as Malaysia',async t=>{
 setup(t,legacy);
 const res=makeRes();
 await quotations({method:'GET',query:{role:'contractor',id:'CTR-TEST',plannerType:'build'},headers:{}},res);
 assert.notEqual(res.statusCode,409);
});

test('Project Control treats legacy contractor without country as Malaysia',async t=>{
 setup(t,legacy);
 const res=makeRes();
 await projectControl({method:'GET',query:{id:'CTR-TEST',plannerType:'build',quotationId:'QT-LEGACY'},headers:{}},res);
 assert.notEqual(res.statusCode,409);
});
