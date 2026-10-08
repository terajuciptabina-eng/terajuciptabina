export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();

  const resource=String(req.query?.resource||'').trim().toLowerCase();
  if(!['slots','registration'].includes(resource))return res.status(404).json({message:'Class management resource not found.'});

  const repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
  const token=process.env.GITHUB_TOKEN;
  if(!token)return res.status(500).json({message:'GitHub data source is not configured.'});

  const adminUser=String(process.env.ADMIN_USERNAME||'admin').trim();
  const adminPass=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim();
  const suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  const isAdmin=!!adminPass&&suppliedPass===adminPass&&(!suppliedUser||suppliedUser===adminUser);

  const slotsPath='data/class-slots.json';
  const registrationsPath='data/class-registrations.json';
  const ghHeaders={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};

  async function github(path,options={}){
    const response=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{...options,headers:{...ghHeaders,...(options.headers||{})}});
    const text=await response.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    return{response,data};
  }

  async function read(path){
    const r=await github(path);
    if(!r.response.ok)return{items:[],sha:null};
    const content=r.data?.content?Buffer.from(r.data.content,'base64').toString('utf8'):'[]';
    try{return{items:Array.isArray(JSON.parse(content))?JSON.parse(content):[],sha:r.data.sha}}catch{return{items:[],sha:r.data.sha}}
  }

  async function save(path,items,sha,message){
    const body={message,content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')};
    if(sha)body.sha=sha;
    const r=await github(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.response.ok)throw new Error(r.data?.message||'Unable to save class data.');
    return r.data;
  }

  try{
    if(resource==='slots'){
      const s=await read(slotsPath);

      if(req.method==='GET'){
        const registrations=(await read(registrationsPath)).items;
        const items=(isAdmin?s.items:s.items.filter(x=>x.active!==false))
          .sort((a,b)=>String(a.date+' '+a.startTime).localeCompare(String(b.date+' '+b.startTime)))
          .map(x=>{
            const booked=registrations.filter(r=>r.slotId===x.id&&r.status!=='Cancelled').reduce((n,r)=>n+(parseInt(r.pax,10)||1),0);
            return{...x,booked,remaining:Math.max(0,Number(x.capacity)-booked)};
          })
          .filter(x=>isAdmin||x.remaining>0);
        return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
      }

      if(!isAdmin)return res.status(401).json({message:'Unauthorized.'});
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});

      if(req.method==='POST'){
        if(!String(body.date||'').trim()||!String(body.startTime||'').trim()||!String(body.endTime||'').trim()||!String(body.mode||'').trim()||!String(body.capacity||'').trim())
          return res.status(400).json({message:'Date, time, mode and capacity are required.'});
        const now=new Date().toISOString();
        const id='SLOT-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const slot={id,date:String(body.date).trim(),startTime:String(body.startTime).trim(),endTime:String(body.endTime).trim(),mode:String(body.mode).trim(),capacity:Math.max(1,Number(body.capacity)||1),active:body.active!==false,notes:String(body.notes||'').trim(),createdAt:now,updatedAt:now};
        s.items.push(slot);
        const saved=await save(slotsPath,s.items,s.sha,`Add Archicad class slot ${id}`);
        return res.status(201).json({ok:true,item:slot,commitSha:saved?.commit?.sha||null});
      }

      const id=String(body.id||'').trim();
      const index=s.items.findIndex(x=>String(x.id)===id);
      if(index<0)return res.status(404).json({message:'Class slot not found.'});

      if(req.method==='PUT'){
        for(const k of ['date','startTime','endTime','mode','notes'])if(body[k]!==undefined)s.items[index][k]=String(body[k]??'').trim();
        if(body.capacity!==undefined)s.items[index].capacity=Math.max(1,Number(body.capacity)||1);
        if(body.active!==undefined)s.items[index].active=Boolean(body.active);
        s.items[index].updatedAt=new Date().toISOString();
        const saved=await save(slotsPath,s.items,s.sha,`Update Archicad class slot ${id}`);
        return res.status(200).json({ok:true,item:s.items[index],commitSha:saved?.commit?.sha||null});
      }

      if(req.method==='DELETE'){
        s.items.splice(index,1);
        const saved=await save(slotsPath,s.items,s.sha,`Delete Archicad class slot ${id}`);
        return res.status(200).json({ok:true,id,commitSha:saved?.commit?.sha||null});
      }

      return res.status(405).json({message:'Method not allowed.'});
    }

    const s=await read(registrationsPath);

    if(req.method!=='POST'&&!isAdmin)return res.status(401).json({message:'Unauthorized.'});

    if(req.method==='GET'){
      const q=String(req.query?.q||'').trim().toLowerCase();
      const status=String(req.query?.status||'').trim().toLowerCase();
      const type=String(req.query?.type||'').trim().toLowerCase();
      const mode=String(req.query?.mode||'').trim().toLowerCase();
      const items=s.items.filter(x=>
        (!q||JSON.stringify(x).toLowerCase().includes(q))&&
        (!status||String(x.status||'').toLowerCase()===status)&&
        (!type||String(x.type||'').toLowerCase()===type)&&
        (!mode||String(x.mode||'').toLowerCase()===mode)
      ).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
    }

    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});

    if(req.method==='POST'){
      const required=['name','phone','email','type','pax','slotId'];
      if(required.some(k=>!String(body[k]||'').trim()))return res.status(400).json({message:'Please complete all required fields.'});

      const slotStore=await read(slotsPath);
      const slot=slotStore.items.find(x=>String(x.id)===String(body.slotId)&&x.active!==false);
      if(!slot)return res.status(400).json({message:'Selected class slot is no longer available.'});

      const used=s.items.filter(x=>x.slotId===slot.id&&x.status!=='Cancelled').reduce((n,x)=>n+(parseInt(x.pax,10)||1),0);
      const pax=parseInt(body.pax,10)||1;
      if(used+pax>Number(slot.capacity))return res.status(409).json({message:'This class slot is full. Please choose another slot.'});
      if(String(body.mode||'')!==String(slot.mode))return res.status(400).json({message:'Selected class mode does not match the class slot.'});

      const now=new Date().toISOString();
      const id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      const item={id,status:'Pending',createdAt:now,updatedAt:now,name:String(body.name).trim(),phone:String(body.phone).trim(),email:String(body.email).trim(),type:String(body.type).trim(),pax:String(body.pax).trim(),company:String(body.company||'').trim(),occupation:String(body.occupation||'').trim(),mode:String(slot.mode).trim(),slotId:String(slot.id),slotLabel:`${slot.date} · ${slot.startTime}-${slot.endTime} · ${slot.mode}`,date:String(slot.date).trim(),experience:String(body.experience||'').trim(),laptop:String(body.laptop||'').trim(),payment:String(body.payment||'').trim(),source:String(body.source||'').trim(),notes:String(body.notes||'').trim()};
      s.items.unshift(item);
      const saved=await save(registrationsPath,s.items,s.sha,`New Archicad class registration ${id}`);
      return res.status(201).json({ok:true,item,commitSha:saved?.commit?.sha||null});
    }

    const id=String(body.id||'').trim();
    if(!id)return res.status(400).json({message:'Registration ID is required.'});
    const index=s.items.findIndex(x=>String(x.id)===id);
    if(index<0)return res.status(404).json({message:'Registration not found.'});

    if(req.method==='PUT'){
      const allowed=['name','phone','email','type','pax','company','occupation','mode','slotId','slotLabel','date','experience','laptop','payment','source','notes','status'];
      for(const k of allowed)if(body[k]!==undefined)s.items[index][k]=String(body[k]??'').trim();
      s.items[index].updatedAt=new Date().toISOString();
      const saved=await save(registrationsPath,s.items,s.sha,`Update Archicad class registration ${id}`);
      return res.status(200).json({ok:true,item:s.items[index],commitSha:saved?.commit?.sha||null});
    }

    if(req.method==='DELETE'){
      s.items.splice(index,1);
      const saved=await save(registrationsPath,s.items,s.sha,`Delete Archicad class registration ${id}`);
      return res.status(200).json({ok:true,id,commitSha:saved?.commit?.sha||null});
    }

    return res.status(405).json({message:'Method not allowed.'});
  }catch(error){
    console.error('class management error:',error);
    return res.status(500).json({message:error.message||'Unable to process class management request.'});
  }
}