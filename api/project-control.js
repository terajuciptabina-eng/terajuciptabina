export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET','PUT','DELETE'].includes(req.method)) return res.status(405).json({message:'Method not allowed'});

  const token = process.env.GITHUB_TOKEN;
  const actualRepo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const dataBranch = process.env.GITHUB_DATA_BRANCH || 'project-data';
  if (!token) return res.status(500).json({message:'GitHub auth storage is not configured.'});

  const headers = {Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  const validPlanner = x => x === 'build' || x === 'renovation';
  const clean = x => String(x || '').trim();
  const pathFor = (id,type,qid) => `data/project-control/contractors/${encodeURIComponent(id)}/${encodeURIComponent(type)}/${encodeURIComponent(qid)}.json`;

  async function github(path, options={}) {
    const method=options.method||'GET';
    const opts={...options};
    delete opts.ref;
    const ref=options.ref||dataBranch;
    const query=method==='GET'?`?ref=${encodeURIComponent(ref)}`:'';
    const r=await fetch(`https://api.github.com/repos/${actualRepo}/contents/${path}${query}`,{...opts,headers:{...headers,...(opts.headers||{})}});
    const t=await r.text(); let d=null; try{d=t?JSON.parse(t):null}catch{d=t}
    return {response:r,data:d};
  }

  async function read(id,type,qid){
    const x=await github(pathFor(id,type,qid),{ref:dataBranch});
    if(x.response.status===404)return{record:null,sha:null,status:404};
    if(!x.response.ok)return{record:null,sha:null,status:502};
    const content=x.data?.content?Buffer.from(x.data.content,'base64').toString('utf8'):'';
    return{record:content?JSON.parse(content):null,sha:x.data?.sha||null,status:200};
  }

  try{
    const source=req.method==='GET'||req.method==='DELETE'?req.query:(req.body||{});
    const id=clean(source?.id).toUpperCase();
    const type=clean(source?.plannerType).toLowerCase();
    const quotationId=clean(source?.quotationId);
    if(!id||!validPlanner(type)||!quotationId)return res.status(400).json({message:'Missing contractor id, planner type or quotationId.'});

    const current=await read(id,type,quotationId);
    if(req.method==='GET')return res.status(200).json({success:true,record:current.record});

    if(req.method==='DELETE'){
      if(!current.record)return res.status(404).json({message:'Project control record not found.'});
      const updated=await github(pathFor(id,type,quotationId),{
        method:'DELETE',ref:dataBranch,
        body:JSON.stringify({message:`Delete project control ${quotationId}`,sha:current.sha,branch:dataBranch})
      });
      if(!updated.response.ok)return res.status(502).json({message:'Unable to delete project control record.'});
      return res.status(200).json({success:true,quotationId});
    }

    const payload=source?.record;
    if(!payload||typeof payload!=='object')return res.status(400).json({message:'Missing project control record.'});
    const now=new Date().toISOString();
    const existing=current.record&&typeof current.record==='object'?current.record:{schemaVersion:1,recordType:'project-control',contractorId:id,plannerType:type,quotationId,createdAt:now};
    const record={...existing,schemaVersion:1,recordType:'project-control',contractorId:id,plannerType:type,quotationId,updatedAt:now};

    if(payload.workProgram){
      record.workProgram={...payload.workProgram,updatedAt:now};
      delete record.workProgram.versions;
    }
    if(payload.progress){
      const incoming=payload.progress;
      const newHistory=incoming.history&&typeof incoming.history==='object'?incoming.history:{};
      const newValid=incoming.validDates&&typeof incoming.validDates==='object'?incoming.validDates:{};
      record.progress={schemaVersion:4,recordType:'progress',quotationId,history:newHistory,validDates:newValid,updatedAt:now};
    }

    const content=Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64');
    const body={message:`Save project control ${type} ${quotationId}`,content,branch:dataBranch};
    if(current.sha)body.sha=current.sha;

    const updated=await github(pathFor(id,type,quotationId),{method:'PUT',ref:dataBranch,body:JSON.stringify(body)});
    if(!updated.response.ok){
      console.error('Project control write failed:',updated.data);
      return res.status(502).json({message:'Unable to save project control record.'});
    }
    return res.status(200).json({success:true,record});
  }catch(error){
    console.error('project control storage error:',error);
    return res.status(500).json({message:'Unable to process project control record.'});
  }
}
