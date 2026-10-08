export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();
  const repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
  const token=process.env.GITHUB_TOKEN;
  if(!token)return res.status(500).json({message:'GitHub data source is not configured.'});
  const adminUser=String(process.env.ADMIN_USERNAME||'admin').trim();
  const adminPass=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim();
  const suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  const isAdmin=!!adminPass&&suppliedPass===adminPass&&(!suppliedUser||suppliedUser===adminUser);
  if((req.method!=='POST'&&!isAdmin))return res.status(401).json({message:'Unauthorized.'});
  const path='data/class-registrations.json';
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function github(options={}){
    const response=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{...options,headers:{...headers,...(options.headers||{})}});
    const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    return{response,data};
  }
  async function store(){
    const r=await github(); if(!r.response.ok)return{items:[],sha:null};
    let content=r.data?.content?Buffer.from(r.data.content,'base64').toString('utf8'):'';
    try{return{items:Array.isArray(JSON.parse(content))?JSON.parse(content):[],sha:r.data.sha}}catch{return{items:[],sha:r.data.sha}}
  }
  async function save(items,sha,message){
    const body={message,content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')};
    if(sha)body.sha=sha;
    const r=await github({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.response.ok)throw new Error(r.data?.message||'Unable to save registration database.');
    return r.data;
  }
  try{
    const s=await store();
    if(req.method==='GET'){
      const q=String(req.query?.q||'').trim().toLowerCase(),status=String(req.query?.status||'').trim().toLowerCase(),type=String(req.query?.type||'').trim().toLowerCase(),mode=String(req.query?.mode||'').trim().toLowerCase();
      const items=s.items.filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q))&&(!status||String(x.status||'').toLowerCase()===status)&&(!type||String(x.type||'').toLowerCase()===type)&&(!mode||String(x.mode||'').toLowerCase()===mode)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
    }
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    if(req.method==='POST'){
      const required=['name','phone','email','type','pax','date','mode'];
      if(required.some(k=>!String(body[k]||'').trim()))return res.status(400).json({message:'Please complete all required fields.'});
      const now=new Date().toISOString(),id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      const item={id,status:'Pending',createdAt:now,updatedAt:now,name:String(body.name).trim(),phone:String(body.phone).trim(),email:String(body.email).trim(),type:String(body.type).trim(),pax:String(body.pax).trim(),company:String(body.company||'').trim(),occupation:String(body.occupation||'').trim(),mode:String(body.mode).trim(),date:String(body.date).trim(),experience:String(body.experience||'').trim(),laptop:String(body.laptop||'').trim(),payment:String(body.payment||'').trim(),source:String(body.source||'').trim(),notes:String(body.notes||'').trim()};
      s.items.unshift(item);const saved=await save(s.items,s.sha,`New Archicad class registration ${id}`);
      return res.status(201).json({ok:true,item,commitSha:saved?.commit?.sha||null});
    }
    const id=String(body.id||'').trim();
    if(!id)return res.status(400).json({message:'Registration ID is required.'});
    const index=s.items.findIndex(x=>String(x.id)===id);
    if(index<0)return res.status(404).json({message:'Registration not found.'});
    if(req.method==='PUT'){
      const allowed=['name','phone','email','type','pax','company','occupation','mode','date','experience','laptop','payment','source','notes','status'];
      for(const k of allowed)if(body[k]!==undefined)s.items[index][k]=String(body[k]??'').trim();
      s.items[index].updatedAt=new Date().toISOString();
      const saved=await save(s.items,s.sha,`Update Archicad class registration ${id}`);
      return res.status(200).json({ok:true,item:s.items[index],commitSha:saved?.commit?.sha||null});
    }
    if(req.method==='DELETE'){
      s.items.splice(index,1);const saved=await save(s.items,s.sha,`Delete Archicad class registration ${id}`);
      return res.status(200).json({ok:true,id,commitSha:saved?.commit?.sha||null});
    }
    return res.status(405).json({message:'Method not allowed.'});
  }catch(error){console.error('class registration error:',error);return res.status(500).json({message:error.message||'Unable to process registration.'})}
}