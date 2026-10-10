export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET','PUT','DELETE'].includes(req.method)) return res.status(405).json({message:'Method not allowed'});

  const token = process.env.GITHUB_TOKEN;
  const actualRepo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const dataBranch = 'main';
  if (!token) return res.status(500).json({message:'GitHub auth storage is not configured.'});

  const headers = {Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  const validPlanner = x => x === 'build' || x === 'renovation';
  const clean = x => String(x || '').trim();
  const pathFor = (id,type,qid) => `data/project-control/contractors/${encodeURIComponent(id)}/${encodeURIComponent(type)}/${encodeURIComponent(qid)}.json`;
  const progressPathFor = (id,type,qid) => `data/project-control/contractors/${encodeURIComponent(id)}/${encodeURIComponent(type)}/${encodeURIComponent(qid)}.progress.json`;

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

  async function readProgress(id,type,qid,includeSha=false){
    const path=progressPathFor(id,type,qid);
    const raw=await fetch(`https://raw.githubusercontent.com/${actualRepo}/${dataBranch}/${path}`,{cache:'no-store'});
    if(raw.status===404)return{progress:null,sha:null,status:404};
    if(!raw.ok)return{progress:null,sha:null,status:502};
    const progress=await raw.json();
    let sha=null;
    if(includeSha){
      const meta=await github(path,{ref:dataBranch});
      if(!meta.response.ok)return{progress:null,sha:null,status:502};
      sha=meta.data?.sha||null;
    }
    return{progress,sha,status:200};
  }

  async function saveProgress(id,type,qid,incoming){
    const path=progressPathFor(id,type,qid);
    let latest=await readProgress(id,type,qid,true);
    const progress={schemaVersion:4,recordType:'progress',quotationId:qid,
      history:incoming.history&&typeof incoming.history==='object'?incoming.history:{},
      validDates:incoming.validDates&&typeof incoming.validDates==='object'?incoming.validDates:{},
      updatedAt:new Date().toISOString()};
    for(let attempt=0;attempt<5;attempt++){
      const body={message:`Save progress ${type} ${qid}`,content:Buffer.from(JSON.stringify(progress,null,2)+'\n').toString('base64'),branch:dataBranch};
      if(latest.sha)body.sha=latest.sha;
      const updated=await github(path,{method:'PUT',ref:dataBranch,body:JSON.stringify(body)});
      if(updated.response.ok)return{progress,sha:updated.data?.content?.sha||latest.sha};
      if(updated.response.status!==409){
        const status=updated.response.status||502;
        const message=typeof updated.data?.message==='string'?updated.data.message:'Unknown GitHub storage error.';
        throw Object.assign(new Error(message),{githubStatus:status,githubData:updated.data});
      }
      latest=await readProgress(id,type,qid,true);
      if(latest.status!==200&&latest.status!==404)throw Object.assign(new Error('Unable to refresh progress storage after a GitHub conflict.'),{githubStatus:502});
    }
    throw Object.assign(new Error('Progress save conflicted repeatedly with another progress write.'),{githubStatus:409});
  }

  try{
    const source=req.method==='GET'||req.method==='DELETE'?req.query:(req.body||{});
    const id=clean(source?.id).toUpperCase();
    const type=clean(source?.plannerType).toLowerCase();
    const quotationId=clean(source?.quotationId);
    if(!id||!validPlanner(type)||!quotationId)return res.status(400).json({message:'Missing contractor id, planner type or quotationId.'});

    const current=await read(id,type,quotationId);
    if(req.method==='GET'){
      const savedProgress=await readProgress(id,type,quotationId);
      const merged=current.record?{...current.record}:null;
      if(merged&&savedProgress.status===200&&savedProgress.progress)merged.progress=savedProgress.progress;
      return res.status(200).json({success:true,record:merged});
    }

    if(req.method==='DELETE'){
      if(!current.record)return res.status(404).json({message:'Project control record not found.'});
      const updated=await github(pathFor(id,type,quotationId),{
        method:'DELETE',ref:dataBranch,
        body:JSON.stringify({message:`Delete project control ${quotationId}`,sha:current.sha,branch:dataBranch})
      });
      if(!updated.response.ok)return res.status(502).json({message:'Unable to delete project control record.'});
      const savedProgress=await readProgress(id,type,quotationId,true);
      if(savedProgress.status===200&&savedProgress.sha){
        const pd=await github(progressPathFor(id,type,quotationId),{method:'DELETE',ref:dataBranch,body:JSON.stringify({message:`Delete progress ${quotationId}`,sha:savedProgress.sha,branch:dataBranch})});
        if(!pd.response.ok)console.warn('Project progress delete failed:',pd.data);
      }
      return res.status(200).json({success:true,quotationId});
    }

    const payload=source?.record;
    if(!payload||typeof payload!=='object')return res.status(400).json({message:'Missing project control record.'});
    if(payload.progress&&!payload.contract&&!payload.workProgram){
      try{
        const saved=await saveProgress(id,type,quotationId,payload.progress);
        return res.status(200).json({success:true,record:{...(current.record||{schemaVersion:1,recordType:'project-control',contractorId:id,plannerType:type,quotationId}),progress:saved.progress}});
      }catch(error){
        const githubStatus=Number(error?.githubStatus)||502;
        const githubMessage=error?.message||'Unknown GitHub storage error.';
        console.error('Project progress write failed:',{status:githubStatus,message:githubMessage,github:error?.githubData});
        return res.status(githubStatus===409?409:502).json({message:'Unable to save project progress.',storage:{provider:'github',status:githubStatus,detail:githubMessage}});
      }
    }
    const now=new Date().toISOString();
    const existing=current.record&&typeof current.record==='object'?current.record:{schemaVersion:1,recordType:'project-control',contractorId:id,plannerType:type,quotationId,createdAt:now};
    const record={...existing,schemaVersion:1,recordType:'project-control',contractorId:id,plannerType:type,quotationId,updatedAt:now};

    if(payload.contract){
      const incoming={...payload.contract};
      const previous=record.contract&&typeof record.contract==='object'?record.contract:null;
      const sameContract=previous&&JSON.stringify({
        contractNumber:previous.contractNumber||'',
        contractDate:previous.contractDate||'',
        projectStart:previous.projectStart||'',
        projectFinish:previous.projectFinish||'',
        contractSum:Number(previous.contractSum)||0,
        items:Array.isArray(previous.items)?previous.items:[]
      })===JSON.stringify({
        contractNumber:incoming.contractNumber||'',
        contractDate:incoming.contractDate||'',
        projectStart:incoming.projectStart||'',
        projectFinish:incoming.projectFinish||'',
        contractSum:Number(incoming.contractSum)||0,
        items:Array.isArray(incoming.items)?incoming.items:[]
      });
      const existingHistory=Array.isArray(previous?.amendmentHistory)?previous.amendmentHistory:[];
      if(previous&&!sameContract){
        const nextVersion=Math.max(Number(previous.version)||1,1)+1;
        const reason=clean(incoming.amendmentReason)||'Contract amended';
        const historyEntry={
          version:Number(previous.version)||1,
          contractNumber:previous.contractNumber||'',
          contractDate:previous.contractDate||'',
          projectStart:previous.projectStart||'',
          projectFinish:previous.projectFinish||'',
          contractSum:Number(previous.contractSum)||0,
          client:previous.client||{},
          project:previous.project||{},
          items:Array.isArray(previous.items)?previous.items:[],
          confirmedAt:previous.confirmedAt||previous.updatedAt||now,
          amendedAt:now,
          amendmentReason:reason
        };
        incoming.version=nextVersion;
        incoming.amendmentReason=reason;
        incoming.amendmentHistory=[...existingHistory,historyEntry];
        incoming.amendedAt=now;
      }else{
        incoming.version=Number(incoming.version)||1;
        incoming.amendmentHistory=existingHistory;
      }
      delete incoming.amendmentReason;
      record.contract={...incoming,updatedAt:now};
    }
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

    // GitHub Contents updates are SHA-guarded. Other project-control writes (including
    // the development auto-log) may advance main between our read and PUT, so retry
    // the write against the newest file instead of returning a generic save failure.
    let updated=null;
    let latestRecord=record;
    let latestSha=current.sha;
    for(let attempt=0;attempt<3;attempt++){
      const writeBody={...body};
      if(latestSha)writeBody.sha=latestSha;
      updated=await github(pathFor(id,type,quotationId),{
        method:'PUT',ref:dataBranch,body:JSON.stringify(writeBody)
      });
      if(updated.response.ok)break;
      if(updated.response.status!==409)break;
      const refreshed=await read(id,type,quotationId);
      if(refreshed.status!==200||!refreshed.record)break;
      latestRecord={...refreshed.record};
      latestSha=refreshed.sha;
      if(payload.contract)latestRecord.contract=record.contract;
      if(payload.workProgram)latestRecord.workProgram=record.workProgram;
      if(payload.progress)latestRecord.progress=record.progress;
      latestRecord.schemaVersion=1;
      latestRecord.recordType='project-control';
      latestRecord.contractorId=id;
      latestRecord.plannerType=type;
      latestRecord.quotationId=quotationId;
      latestRecord.updatedAt=now;
      const refreshedContent=Buffer.from(JSON.stringify(latestRecord,null,2)+'\\n').toString('base64');
      body.content=refreshedContent;
    }
    if(!updated?.response?.ok){
      const githubStatus=updated?.response?.status||502;
      const githubMessage=typeof updated?.data?.message==='string'?updated.data.message:'Unknown GitHub storage error.';
      console.error('Project control write failed:',{status:githubStatus,message:githubMessage,github:updated?.data});
      return res.status(githubStatus===409?409:502).json({
        message:'Unable to save project control record.',
        storage:{provider:'github',status:githubStatus,detail:githubMessage}
      });
    }
    return res.status(200).json({success:true,record:latestRecord});
  }catch(error){
    console.error('project control storage error:',error);
    return res.status(500).json({message:'Unable to process project control record.'});
  }
}
