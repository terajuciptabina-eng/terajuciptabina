export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!['GET','POST','DELETE'].includes(req.method))return res.status(405).json({message:'Method not allowed.'});
  const username=String(process.env.ADMIN_USERNAME||'admin').trim();
  const password=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim();
  const suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  if(!password||suppliedPass!==password||(suppliedUser&&suppliedUser!==username))return res.status(401).json({message:'Unauthorized.'});
  const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
  if(!token)return res.status(500).json({message:'GitHub auth storage is not configured.'});
  const path='data/development-log.json';
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  async function github(options={}){const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{...options,headers:{...headers,...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}return{r,d};}
  async function read(){const x=await github();if(!x.r.ok)return{items:[],sha:null};let raw=x.d?.content?Buffer.from(x.d.content,'base64').toString('utf8'):'';if(!raw){const y=await github({headers:{...headers,Accept:'application/vnd.github.raw+json'}});raw=y.r.ok&&typeof y.d==='string'?y.d:'';}try{const parsed=JSON.parse(raw);return{items:Array.isArray(parsed)?parsed:[],sha:x.d?.sha||null};}catch{return{items:[],sha:x.d?.sha||null}}}
  async function write(items,sha,message){const body={message,content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')};if(sha)body.sha=sha;const x=await github({method:'PUT',body:JSON.stringify(body)});if(!x.r.ok)throw new Error(x.d?.message||'Unable to save development log.');return x.d;}
  try{
    const store=await read();
    if(req.method==='GET'){const status=String(req.query?.status||'').trim().toLowerCase(),module=String(req.query?.module||'').trim().toLowerCase(),q=String(req.query?.q||'').trim().toLowerCase();const items=store.items.filter(item=>(!status||String(item.status||'').toLowerCase()===status)&&(!module||String(item.module||'').toLowerCase()===module)&&(!q||JSON.stringify(item).toLowerCase().includes(q))).sort((a,b)=>String(b.updatedAt||b.date||'').localeCompare(String(a.updatedAt||a.date||'')));return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});}
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    if(req.method==='POST'){const title=String(body.title||'').trim(),summary=String(body.summary||'').trim();if(!title||!summary)return res.status(400).json({message:'Title and summary are required.'});const now=new Date().toISOString();const item={id:String(body.id||`DEV-${Date.now().toString(36).toUpperCase()}`).trim(),date:String(body.date||now.slice(0,10)).trim(),title,module:String(body.module||'General').trim(),status:String(body.status||'In Progress').trim(),summary,details:String(body.details||'').trim(),commit:String(body.commit||'').trim(),updatedAt:now};const index=store.items.findIndex(x=>String(x.id)===item.id);if(index>=0)store.items[index]=item;else store.items.unshift(item);const saved=await write(store.items,store.sha,`${index>=0?'Update':'Add'} development log: ${title}`);return res.status(200).json({ok:true,item,commitSha:saved?.commit?.sha||null});}
    const id=String(body.id||'').trim();if(!id)return res.status(400).json({message:'Development log ID is required.'});const next=store.items.filter(x=>String(x.id)!==id);if(next.length===store.items.length)return res.status(404).json({message:'Development log not found.'});const saved=await write(next,store.sha,`Delete development log ${id}`);return res.status(200).json({ok:true,id,commitSha:saved?.commit?.sha||null});
  }catch(error){console.error('development log error:',error);return res.status(500).json({message:error.message||'Unable to process development log.'});}
}