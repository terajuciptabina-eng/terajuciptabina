export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return res.status(405).json({message:'Method not allowed.'});

  const repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
  const rulesPath='quotation/admin-calculation-rules.html';
  const uiPath='quotation/shared/calculation-rules-ui.css';
  const seedRef='d6b5bd072f4ab8d74fc35ac4f6a0cef36c757c22';
  const token=process.env.GITHUB_TOKEN;
  const expectedUser=String(process.env.ADMIN_USERNAME||'admin').trim();
  const expectedPass=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim();
  const suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  const isUI=String(req.query?.ui||'')==='1';
  const protectedRead=req.method==='GET'&&String(req.query?.admin||'')==='1';
  const hasCredentials=!!(suppliedUser||suppliedPass);
  const requiresAuth=isUI?(req.method!=='GET'):(req.method!=='GET'||protectedRead||hasCredentials);
  if(requiresAuth){
    if(!expectedPass||suppliedPass!==expectedPass||suppliedUser!==expectedUser)return res.status(401).json({message:'Invalid Admin username or password.'});
  }

  const headers={Authorization:`Bearer ${token||''}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const rawBase=`https://raw.githubusercontent.com/${repo}`;
  const apiBase=`https://api.github.com/repos/${repo}`;

  async function githubFile(filePath,options={}){
    const r=await fetch(`${apiBase}/contents/${filePath}`,{...options,headers:{...headers,...(options.headers||{})},cache:'no-store'});
    const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
    return{r,d};
  }
  async function githubAt(ref,filePath){
    const r=await fetch(`${apiBase}/contents/${filePath}?ref=${encodeURIComponent(ref)}`,{headers,cache:'no-store'});
    const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
    return{r,d};
  }
  async function rawAt(ref,filePath){
    const cacheBust=String(req.query?._||req.query?.v||Date.now());
    const url=`${rawBase}/${encodeURIComponent(ref)}/${filePath.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(cacheBust)}`;
    const r=await fetch(url,{cache:'no-store'});
    return{r,source:await r.text()};
  }

  const UI_KEYS=['item','description','method','coefficient','formula','unit','basis','note','actions'];
  const UI_DEFAULT={item:'15%',description:'22%',method:'10%',coefficient:'11%',formula:'12%',unit:'6%',basis:'10%',note:'7%',actions:'7%'};
  function parseUI(source){
    const out={};
    for(const key of UI_KEYS){
      const m=source.match(new RegExp(`--cr-col-${key}\\s*:\\s*([^;]+);`));
      out[key]=m?String(m[1]).trim():UI_DEFAULT[key];
      if(!/^\\d+(?:\\.\\d+)?%$/.test(out[key]))out[key]=UI_DEFAULT[key];
    }
    return out;
  }
  function normaliseUI(input){
    const nums=UI_KEYS.map(key=>{const n=Number(String(input?.[key]??'').replace('%',''));return Number.isFinite(n)&&n>0?n:null});
    if(nums.some(n=>n===null))throw new Error('Invalid Calculation Rules UI column width.');
    const total=nums.reduce((a,b)=>a+b,0);
    if(total<=0)throw new Error('Invalid Calculation Rules UI column width total.');
    const out={};let used=0;
    UI_KEYS.forEach((key,i)=>{if(i===UI_KEYS.length-1){out[key]=(100-used).toFixed(2)+'%'}else{const v=nums[i]/total*100;out[key]=v.toFixed(2)+'%';used+=Number(out[key].replace('%',''))}});
    return out;
  }
  function writeUI(source,widths){
    let next=source;
    for(const key of UI_KEYS){
      const re=new RegExp(`(--cr-col-${key}\\s*:\\s*)[^;]+(;?)`);
      if(!re.test(next))throw new Error(`Shared Calculation Rules UI variable is missing: ${key}.`);
      next=next.replace(re,`$1${widths[key]}$2`);
    }
    return next;
  }

  try{
    if(isUI){
      if(req.method==='GET'){
        const current=await githubFile(uiPath);
        if(!current.r.ok)return res.status(current.r.status).json({message:'Unable to read shared Calculation Rules UI standard.'});
        const source=Buffer.from(current.d?.content||'','base64').toString('utf8');
        return res.status(200).json({ok:true,columnWidths:parseUI(source),sourceSha:current.d?.sha||null});
      }
      if(req.method!=='PUT')return res.status(405).json({message:'Calculation Rules UI supports GET and PUT only.'});
      if(!token)throw new Error('GitHub auth storage is not configured.');
      const cur=await githubFile(uiPath);
      if(!cur.r.ok)return res.status(cur.r.status).json({message:cur.d?.message||'Unable to read shared Calculation Rules UI standard.'});
      const source=Buffer.from(cur.d?.content||'','base64').toString('utf8');
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const widths=normaliseUI(body.columnWidths||{});
      const nextSource=writeUI(source,widths);
      const saved=await githubFile(uiPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update Calculation Rules global UI column widths',content:Buffer.from(nextSource,'utf8').toString('base64'),sha:cur.d?.sha})});
      if(!saved.r.ok)return res.status(saved.r.status).json({message:saved.d?.message||'Unable to save shared Calculation Rules UI standard.'});
      return res.status(200).json({ok:true,columnWidths:widths,sourceSha:saved.d?.content?.sha||null,message:'Calculation Rules UI column widths saved as the global default.'});
    }

    function locateRulesArray(s){
      const m=/(?:const|let)\s+rules\s*=\s*\[/.exec(s);
      if(!m)throw new Error('Calculation Rules source array not found.');
      const startArray=s.indexOf('[',m.index);
      let depth=0,quote='',escape=false,template=false;
      for(let i=startArray;i<s.length;i++){
        const ch=s[i];
        if(escape){escape=false;continue}
        if(quote){if(ch==='\\')escape=true;else if(ch===quote)quote='';continue}
        if(template){if(ch==='\\')escape=true;else if(ch==='`')template=false;continue}
        if(ch==='\''||ch==='"'){quote=ch;continue}
        if(ch==='`'){template=true;continue}
        if(ch==='['){depth++;continue}
        if(ch===']'){
          depth--;
          if(depth===0){let end=i+1;while(end<s.length&&/\s/.test(s[end]))end++;if(s[end]===';')end++;return{start:m.index,length:end-m.index,array:s.slice(startArray,i+1)}}
        }
      }
      throw new Error('Calculation Rules source array is incomplete.');
    }
    function parse(s){
      const located=locateRulesArray(s),raw=Function(`"use strict";return (${located.array});`)();
      if(!Array.isArray(raw)||raw.length===0)throw new Error('Calculation Rules source array is empty.');
      const rules=raw.map((x,i)=>Array.isArray(x)?{group:x[0]||'',path:x[1]||'',description:x[2]||'',method:x[3]||'',coefficient:x[4]||'',formula:x[5]||'',output:x[6]||'',basis:x[7]||'',note:x[8]||'',_index:i}:x&&typeof x==='object'?{...x,_index:i}:null).filter(Boolean);
      if(!rules.length)throw new Error('Calculation Rules source array is empty.');
      return{rules,start:located.start,length:located.length};
    }
    const shouldSeed=e=>e.message==='Calculation Rules source array not found.'||e.message==='Calculation Rules source array is empty.';
    async function readPublic(){
      const current=await rawAt('main',rulesPath);
      if(!current.r.ok)return{ok:false,status:current.r.status,message:'Unable to read Calculation Rules master source.'};
      let source=current.source;
      const legacy=/\];,editingPath=/.test(source);
      if(legacy&&token){
        const repaired=source.replace(/\];,editingPath=/,'];editingPath=');
        const currentFile=await githubFile(rulesPath);
        if(currentFile.r.ok){
          const saved=await githubFile(rulesPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'TERAJU Admin: repair calculation-rules source syntax',content:Buffer.from(repaired,'utf8').toString('base64'),sha:currentFile.d?.sha})});
          if(saved.r.ok)source=repaired;
        }
      }
      try{return{ok:true,source,parsed:parse(source)}}catch(e){
        if(!shouldSeed(e))throw e;
        const seed=await rawAt(seedRef,rulesPath);
        if(!seed.r.ok)throw new Error('Calculation Rules master source is missing and legacy seed could not be loaded.');
        const seedParsed=parse(seed.source);
        return{ok:true,source,parsed:{...seedParsed,seeded:true,seedSource:seed.source}};
      }
    }
    async function readForWrite(){
      if(!token)throw new Error('GitHub auth storage is not configured.');
      const cur=await githubFile(rulesPath);
      if(!cur.r.ok)return{ok:false,status:cur.r.status,message:cur.d?.message||'Unable to read Calculation Rules.'};
      const source=Buffer.from(cur.d?.content||'','base64').toString('utf8');
      try{return{ok:true,cur,source,parsed:parse(source)}}catch(e){
        if(!shouldSeed(e))throw e;
        const seed=await githubAt(seedRef,rulesPath);
        if(!seed.r.ok)throw new Error('Calculation Rules master source is missing and legacy seed could not be loaded.');
        const seedSource=Buffer.from(seed.d?.content||'','base64').toString('utf8');
        const seedParsed=parse(seedSource);
        return{ok:true,cur,source,parsed:{...seedParsed,seeded:true,seedSource}};
      }
    }
    const groups=['PRELIMINARIES','STRUCTURES','ARCHITECTURES','ELECTRICAL','DOORS & WINDOWS','EXTERNAL WORK'];
    const fields=['group','path','description','method','coefficient','formula','output','basis','note'];
    const clean=body=>{const out={};for(const f of fields)out[f]=String(body?.[f]??'').trim();return out};
    function validate(rule){
      if(!rule.group||!groups.includes(rule.group))return'Valid group is required.';
      if(!rule.path)return'Item / hierarchy path is required.';
      if(!rule.description)return'Full contractor description is required.';
      if(!rule.method)return'Method is required.';
      if(!rule.coefficient)return'Coefficient / factor is required.';
      if(!rule.formula)return'Formula is required.';
      if(!rule.output)return'Output unit is required.';
      if(!rule.basis)return'Basis / reference is required.';
      return'';
    }
    const asSource=items=>items.map(r=>[r.group,r.path,r.description,r.method,r.coefficient,r.formula,r.output,r.basis,r.note||'']);

    if(req.method==='GET'){
      const loaded=await readPublic();
      if(!loaded.ok)return res.status(loaded.status).json({message:loaded.message});
      return res.status(200).json({ok:true,count:loaded.parsed.rules.length,rules:loaded.parsed.rules.map(({_index,...r})=>r)});
    }

    const loaded=await readForWrite();
    if(!loaded.ok)return res.status(loaded.status).json({message:loaded.message});
    let next=loaded.parsed.rules.map(({_index,...r})=>r),source=loaded.source,start=loaded.parsed.start,length=loaded.parsed.length;
    if(loaded.parsed.seeded){
      const marker=source.match(/let\s+rules\s*=\s*\[\s*\]/);
      if(!marker)throw new Error('Current Admin Calculation Rules page does not expose an editable rules array.');
      const seededArray=`let rules=${JSON.stringify(asSource(next),null,2)};`;
      source=source.slice(0,marker.index)+seededArray+source.slice(marker.index+marker[0].length);
      const reparsed=parse(source);start=reparsed.start;length=reparsed.length;
    }

    if(req.method==='DELETE'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),target=String(body.path||'').trim(),i=next.findIndex(x=>x.path===target);
      if(i<0)return res.status(404).json({message:'Calculation Rule not found.'});
      if(next.length===1)return res.status(400).json({message:'At least one global Calculation Rule must remain.'});
      const deleted=next[i];next.splice(i,1);
      const nextSource=source.slice(0,start)+`let rules=${JSON.stringify(asSource(next),null,2)}`+source.slice(start+length);
      const saved=await githubFile(rulesPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Permanently delete calculation rule: ${target}`,content:Buffer.from(nextSource,'utf8').toString('base64'),sha:loaded.cur.d?.sha})});
      if(!saved.r.ok)return res.status(saved.r.status).json({message:saved.d?.message||'Unable to permanently delete Calculation Rule.'});
      return res.status(200).json({ok:true,deleted,message:'Calculation Rule permanently deleted from the global master source.',remaining:next.length});
    }

    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),rule=clean(body.rule||body),error=validate(rule);
    if(error)return res.status(400).json({message:error});
    if(req.method==='POST'){
      if(next.some(x=>x.path===rule.path))return res.status(409).json({message:'A Calculation Rule with this path already exists.'});
      next.push(rule);
    }else{
      const originalPath=String(body.originalPath||'').trim(),i=next.findIndex(x=>x.path===originalPath);
      if(i<0)return res.status(404).json({message:'Original Calculation Rule not found.'});
      if(next.some((x,j)=>j!==i&&x.path===rule.path))return res.status(409).json({message:'A Calculation Rule with this path already exists.'});
      next[i]=rule;
    }
    const action=req.method==='POST'?'add':'edit';
    const replacement=`let rules=${JSON.stringify(asSource(next),null,2)}`;
    const nextSource=source.slice(0,start)+replacement+source.slice(start+length);
    const saved=await githubFile(rulesPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`${action==='add'?'Add':'Edit'} calculation rule: ${rule.path}`,content:Buffer.from(nextSource,'utf8').toString('base64'),sha:loaded.cur.d?.sha})});
    if(!saved.r.ok)return res.status(saved.r.status).json({message:saved.d?.message||`Unable to ${action} Calculation Rule.`});
    return res.status(200).json({ok:true,rule,remaining:next.length,message:`Calculation Rule ${action==='add'?'added':'updated'} in the global master source.`});
  }catch(e){
    console.error(e);
    return res.status(500).json({message:e.message||'Unable to update Calculation Rules.'});
  }
}
