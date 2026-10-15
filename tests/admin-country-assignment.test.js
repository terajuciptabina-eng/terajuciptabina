import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../api/admin.js';

const originalFetch=globalThis.fetch;
const originalEnv={GITHUB_TOKEN:process.env.GITHUB_TOKEN,GITHUB_REPO:process.env.GITHUB_REPO,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,ADMIN_KEY:process.env.ADMIN_KEY,ADMIN_USERNAME:process.env.ADMIN_USERNAME};
function response(status,data){return{ok:status>=200&&status<300,status,async text(){return JSON.stringify(data)}}}
function makeRes(){return{statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}
function setup(t,record){
 process.env.GITHUB_TOKEN='test-token';process.env.GITHUB_REPO='terajuciptabina-eng/terajuciptabina';process.env.ADMIN_PASSWORD='test-password';process.env.ADMIN_KEY='';process.env.ADMIN_USERNAME='admin';
 let writes=0,savedRecord=null;
 globalThis.fetch=async(url,options={})=>{
  const path=String(url);
  if(path.endsWith('/contents/data/users/contractors')&&!options.method)return response(200,[{type:'file',name:'CTR-TEST.json',path:'data/users/contractors/CTR-TEST.json'}]);
  if(path.endsWith('/contents/data/users/contractors/CTR-TEST.json')&&!options.method)return response(200,{sha:'account-sha',content:Buffer.from(JSON.stringify(record)).toString('base64')});
  if(path.endsWith('/contents/data/users/contractors/CTR-TEST.json')&&options.method==='PUT'){writes++;savedRecord=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString('utf8'));return response(200,{commit:{sha:'commit-test'}})}
  return response(404,{message:'Not found'});
 };
 t.after(()=>{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(originalEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}});
 return{writes:()=>writes,saved:()=>savedRecord};
}
const legacy={role:'contractor',contractorId:'CTR-TEST',profile:{name:'Legacy contractor',phone:'+60123456789'}};

test('Admin cannot assign a market that conflicts with the existing account phone',async t=>{
 const mock=setup(t,legacy),res=makeRes();
 await admin({method:'PUT',query:{},headers:{'x-admin-password':'test-password'},body:{role:'contractor',id:'CTR-TEST',country:'SG',profile:{name:'Legacy contractor',phone:'+60123456789'}}},res);
 assert.equal(res.statusCode,400);
 assert.match(res.body.message,/phone number does not match/i);
 assert.equal(mock.writes(),0);
});

test('Admin can explicitly assign a verified market when the phone matches',async t=>{
 const mock=setup(t,legacy),res=makeRes();
 await admin({method:'PUT',query:{},headers:{'x-admin-password':'test-password'},body:{role:'contractor',id:'CTR-TEST',country:'SG',profile:{name:'Legacy contractor',phone:'+6581234567'}}},res);
 assert.equal(res.statusCode,200);
 assert.equal(mock.writes(),1);
 assert.equal(mock.saved().country,'SG');
 assert.equal(mock.saved().profile.phone,'+6581234567');
});
