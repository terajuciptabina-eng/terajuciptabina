export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return res.status(405).json({message:'Method not allowed.'});
  const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina',path='quotation/admin-calculation-rules.html';
  const seedRef='d6b5bd072f4ab8d74fc35ac4f6a0cef36c757c22',seedPath='quotation/admin-calculation-rules.html';
  if(!token)return res.status(500).json({message:'GitHub auth storage is not configured.'});
  const expectedUser=String(process.env.ADMIN_USERNAME||'admin').trim(),expectedPass=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim(),suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  const protectedRead=req.method==='GET'&&String(req.query?.admin||'')==='1',hasCredentials=!!(suppliedUser||suppliedPass);
  if(req.method!=='GET'||protectedRead||hasCredentials){if(!expectedPass||suppliedPass!==expectedPass||suppliedUser!==expectedUser)return res.status(401).json({message:'Invalid Admin username or password.'})}
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function github(options={}){const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{...options,headers:{...headers,...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}return{r,d}}
  async function githubAt(ref,filePath){const r=await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`,{headers});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}return{r,d}}
  function parse(s){const m=s.match(/(?:const|let)\s+rules\s*=\s*(\[[\s\S]*?\]);/);if(!m)throw new Error('Calculation Rules source array not found.');const raw=Function(`"use strict";return (${m[1]});`)();if(!Array.isArray(raw))throw new Error('Calculation Rules source is invalid.');const rules=raw.map((x,i)=>Array.isArray(x)?{group:x[0]||'',path:x[1]||'',description:x[2]||'',method:x[3]||'',coefficient:x[4]||'',formula:x[5]||'',output:x[6]||'',basis:x[7]||'',note:x[8]||'',_index:i}:x&&typeof x==='object'?{...x,_index:i}:null).filter(Boolean);return{rules,start:m.index,length:m[0].length}}
  async function readCurrent(){const cur=await github();if(!cur.r.ok)return{cur,source:'',parsed:null};const source=Buffer.from(cur.d?.content||'','base64').toString('utf8');try{return{cur,source,parsed:parse(source)}}catch(e){if(e.message!=='Calculation Rules source array not found.')throw e;const seed=await githubAt(seedRef,seedPath);if(!seed.r.ok)throw new Error('Calculation Rules master source is missing and legacy seed could not be loaded.');const seedSource=Buffer.from(seed.d?.content||'','base64').toString('utf8');const seedParsed=parse(seedSource);return{cur,source,parsed:{...seedParsed,seeded:true,seedSource}}}}
  const groups=['PRELIMINARIES','STRUCTURES','ARCHITECTURES','ELECTRICAL','DOORS & WINDOWS','EXTERNAL WORK'],fields=['group','path','description','method','coefficient','formula','output','basis','note'];
  function clean(body){const out={};for(const f of fields)out[f]=String(body?.[f]??'').trim();return out}
  function validate(rule){if(!rule.group||!groups.includes(rule.group))return 'Valid group is required.';if(!rule.path)return 'Item / hierarchy path is required.';if(!rule.description)return 'Full contractor description is required.';if(!rule.method)return 'Method is required.';if(!rule.coefficient)return 'Coefficient / factor is required.';if(!rule.formula)return 'Formula is required.';if(!rule.output)return 'Output unit is required.';if(!rule.basis)return 'Basis / reference is required.';return ''}
  function asSource(rules){return rules.map(r=>[r.group,r.path,r.description,r.method,r.coefficient,r.formula,r.output,r.basis,r.note||''])}
  try{
    const loaded=await readCurrent();
    if(!loaded.cur.r.ok)return res.status(loaded.cur.r.status).json({message:loaded.cur.d?.message||'Unable to read Calculation Rules.'});
    const p=loaded.parsed;
    if(req.method==='GET')return res.status(200).json({ok:true,count:p.rules.length,rules:p.rules.map(({_index,...r})=>r)});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    let next=p.rules.map(({_index,...r})=>r);
    let source=loaded.source;
    let start=loaded.parsed.start,length=loaded.parsed.length;
    if(loaded.parsed.seeded){
      const currentSource=loaded.source;
      const marker=currentSource.match(/let\s+rules\s*=\s*\[\s*\]/);
      if(!marker)throw new Error('Current Admin Calculation Rules page does not expose an editable rules array.');
      const seededArray=`let rules=${JSON.stringify(asSource(next),null,2)};`;
      source=currentSource.slice(0,marker.index)+seededArray+currentSource.slice(marker.index+marker[0].length);
      const reparsed=parse(source);start=reparsed.start;length=reparsed.length;
    }
    if(req.method==='DELETE'){
      const target=String(body.path||'').trim(),i=next.findIndex(x=>x.path===target);
      if(i<0)return res.status(404).json({message:'Calculation Rule not found.'});
      if(next.length===1)return res.status(400).json({message:'At least one global Calculation Rule must remain.'});
      const deleted=next[i];next.splice(i,1);
      const nextSource=source.slice(0,start)+`let rules=${JSON.stringify(asSource(next),null,2)};`+source.slice(start+length);
      const saved=await github({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Permanently delete calculation rule: ${target}`,content:Buffer.from(nextSource,'utf8').toString('base64'),sha:loaded.cur.d?.sha})});
      if(!saved.r.ok)return res.status(saved.r.status).json({message:saved.d?.message||'Unable to permanently delete Calculation Rule.'});
      return res.status(200).json({ok:true,deleted,message:'Calculation Rule permanently deleted from the global master source.',remaining:next.length});
    }
    const rule=clean(body.rule||body),error=validate(rule);if(error)return res.status(400).json({message:error});
    if(req.method==='POST'){if(next.some(x=>x.path===rule.path))return res.status(409).json({message:'A Calculation Rule with this path already exists.'});next.push(rule)}
    else{const originalPath=String(body.originalPath||'').trim(),i=next.findIndex(x=>x.path===originalPath);if(i<0)return res.status(404).json({message:'Original Calculation Rule not found.'});if(next.some((x,j)=>j!==i&&x.path===rule.path))return res.status(409).json({message:'A Calculation Rule with this path already exists.'});next[i]=rule}
    const action=req.method==='POST'?'add':'edit',nextSource=source.slice(0,start)+`let rules=${JSON.stringify(asSource(next),null,2)};`+source.slice(start+length);
    const saved=await github({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`${action==='add'?'Add':'Edit'} calculation rule: ${rule.path}`,content:Buffer.from(nextSource,'utf8').toString('base64'),sha:loaded.cur.d?.sha})});
    if(!saved.r.ok)return res.status(saved.r.status).json({message:saved.d?.message||`Unable to ${action} Calculation Rule.`});
    return res.status(200).json({ok:true,rule,remaining:next.length,message:`Calculation Rule ${action==='add'?'added':'updated'} in the global master source.`});
  }catch(e){console.error(e);return res.status(500).json({message:e.message||'Unable to update Calculation Rules.'})}
}