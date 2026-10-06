export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return res.status(405).json({message:'Method not allowed.'});
  if(String(req.query?.public||'')==='investor-insights'){
    const token=process.env.GITHUB_TOKEN;
    const repoName=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
    if(!token)return res.status(500).json({message:'GitHub data source is not configured.'});
    const publicHeaders={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    async function publicGithub(path){
      const response=await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`,{headers:publicHeaders});
      const text=await response.text();
      let data=null;try{data=text?JSON.parse(text):null}catch{data=null}
      return{response,data};
    }
    try{
      const [homeowners,contractors]=await Promise.all([
        publicGithub('data/users/homeowners'),
        publicGithub('data/users/contractors')
      ]);
      const countJsonFiles=result=>!result.response.ok||!Array.isArray(result.data)?0:result.data.filter(item=>item&&item.type==='file'&&String(item.name||'').endsWith('.json')).length;
      const homeownerCount=countJsonFiles(homeowners);
      const contractorCount=countJsonFiles(contractors);
      return res.status(200).json({
        ok:true,
        source:'Admin Database',
        registeredAccounts:homeownerCount+contractorCount,
        homeowners:homeownerCount,
        contractors:contractorCount,
        generatedAt:new Date().toISOString()
      });
    }catch(error){
      console.error('public investor insights error:',error);
      return res.status(500).json({message:'Unable to load investor insights.'});
    }
  }

  const username=String(process.env.ADMIN_USERNAME||'admin').trim();
  const password=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUser=String(req.headers['x-admin-username']||'').trim();
  const suppliedPass=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  if(!password||suppliedPass!==password||(suppliedUser&&suppliedUser!==username))return res.status(401).json({message:'Unauthorized.'});
  const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO||'terajuciptabina-eng/terajuciptabina';
  if(!token)return res.status(500).json({message:'GitHub auth storage is not configured.'});
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function github(path,options={}){const response=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{...options,headers:{...headers,...(options.headers||{})}});const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}return{response,data}}
  async function readJson(path){
  const result=await github(path);
  if(!result.response.ok)return null;
  let content=result.data?.content?Buffer.from(result.data.content,'base64').toString('utf8'):'';
  if(!content){
    const raw=await github(path,{headers:{Accept:'application/vnd.github.raw+json'}});
    if(raw.response.ok)content=typeof raw.data==='string'?raw.data:'';
  }
  try{return JSON.parse(content)}catch{return null}
}
  async function findUser(role,id){const folder=role==='homeowner'?'homeowners':'contractors';const listing=await github(`data/users/${folder}`);if(!listing.response.ok||!Array.isArray(listing.data))return{error:'Database folder not found.'};for(const item of listing.data.filter(x=>x.type==='file'&&x.name.endsWith('.json'))){const record=await readJson(`data/users/${folder}/${item.name}`);const recordId=String(record?.homeownerId||record?.contractorId||'').trim();if(recordId===id)return{folder,item,record}}return{error:'User not found.'}}
  try{
    if(String(req.query?.['development-log']||'')==='1'){
      const logPath='data/development-log.json';
      async function readDevelopmentLog(){
        const result=await github(logPath);
        if(!result.response.ok)return{items:[],sha:null};
        let content=result.data?.content?Buffer.from(result.data.content,'base64').toString('utf8'):'';
        if(!content){
          const raw=await github(logPath,{headers:{Accept:'application/vnd.github.raw+json'}});
          if(raw.response.ok)content=typeof raw.data==='string'?raw.data:'';
        }
        try{
          const parsed=JSON.parse(content);
          return{items:Array.isArray(parsed)?parsed:[],sha:result.data?.sha||null};
        }catch{return{items:[],sha:result.data?.sha||null}}
      }
      async function writeDevelopmentLog(items,sha,message){
        const body={message,content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')};
        if(sha)body.sha=sha;
        const result=await github(logPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(!result.response.ok)throw new Error(result.data?.message||'Unable to save development log.');
        return result.data;
      }
      const store=await readDevelopmentLog();
      if(req.method==='GET'){
        const status=String(req.query?.status||'').trim().toLowerCase();
        const module=String(req.query?.module||'').trim().toLowerCase();
        const search=String(req.query?.q||'').trim().toLowerCase();
        const items=store.items
          .filter(item=>(!status||String(item.status||'').toLowerCase()===status)
            &&(!module||String(item.module||'').toLowerCase()===module)
            &&(!search||JSON.stringify(item).toLowerCase().includes(search)))
          .sort((a,b)=>String(b.updatedAt||b.date||'').localeCompare(String(a.updatedAt||a.date||'')));
        return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
      }
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      if(req.method==='POST'){
        const title=String(body.title||'').trim();
        const summary=String(body.summary||'').trim();
        if(!title||!summary)return res.status(400).json({message:'Title and summary are required.'});
        const now=new Date().toISOString();
        const item={
          id:String(body.id||`DEV-${Date.now().toString(36).toUpperCase()}`).trim(),
          date:String(body.date||now.slice(0,10)).trim(),
          title,
          module:String(body.module||'General').trim(),
          status:String(body.status||'In Progress').trim(),
          summary,
          details:String(body.details||'').trim(),
          commit:String(body.commit||'').trim(),
          updatedAt:now
        };
        const index=store.items.findIndex(x=>String(x.id)===item.id);
        if(index>=0)store.items[index]=item;else store.items.unshift(item);
        const saved=await writeDevelopmentLog(store.items,store.sha,`${index>=0?'Update':'Add'} development log: ${title}`);
        return res.status(200).json({ok:true,item,commitSha:saved?.commit?.sha||null});
      }
      if(req.method==='DELETE'){
        const id=String(body.id||'').trim();
        if(!id)return res.status(400).json({message:'Development log ID is required.'});
        const next=store.items.filter(x=>String(x.id)!==id);
        if(next.length===store.items.length)return res.status(404).json({message:'Development log not found.'});
        const saved=await writeDevelopmentLog(next,store.sha,`Delete development log ${id}`);
        return res.status(200).json({ok:true,id,commitSha:saved?.commit?.sha||null});
      }
    }
    const roleFilter=String(req.query?.role||'').toLowerCase(),q=String(req.query?.q||'').trim().toLowerCase(),includeRecords=String(req.query?.records||'')==='1',detailId=String(req.query?.id||'').trim();
    const roles=roleFilter==='homeowner'||roleFilter==='contractor'?[roleFilter]:['homeowner','contractor'];
    if(detailId){
      const detailRoles=roleFilter==='homeowner'||roleFilter==='contractor'?[roleFilter]:['homeowner','contractor'];
      for(const detailRole of detailRoles){
        const found=await findUser(detailRole,detailId);
        if(!found.error){
          const profile=found.record.profile&&typeof found.record.profile==='object'?{...found.record.profile}: {};
          return res.status(200).json({ok:true,account:{id:detailId,role:detailRole,profile,createdAt:found.record.createdAt||'',updatedAt:found.record.updatedAt||'',state:found.record.state||'active'}});
        }
      }
      return res.status(404).json({message:'User not found.'});
    }
    if(req.method==='PUT'){const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const role=String(body.role||'').toLowerCase(),id=String(body.id||'').trim();if(!['homeowner','contractor'].includes(role)||!id)return res.status(400).json({message:'Valid role and account ID are required.'});const found=await findUser(role,id);if(found.error)return res.status(404).json({message:found.error});const profile=found.record.profile&&typeof found.record.profile==='object'?found.record.profile:{};const incoming=body.profile&&typeof body.profile==='object'?body.profile:{};
      const nextProfile={...profile,...incoming,name:String(incoming.name??profile.name??'').trim(),email:String(incoming.email??profile.email??'').trim(),phone:String(incoming.phone??profile.phone??'').trim()};if(!nextProfile.name)return res.status(400).json({message:'Profile name is required.'});found.record.profile=nextProfile;found.record.updatedAt=new Date().toISOString();const result=await github(`data/users/${found.folder}/${found.item.name}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Update ${role} profile ${id} from admin`,content:Buffer.from(JSON.stringify(found.record,null,2)+'\n','utf8').toString('base64'),sha:found.item.sha})});if(!result.response.ok)return res.status(result.response.status).json({message:result.data?.message||'Unable to update profile.'});return res.status(200).json({ok:true,id,role,profile:nextProfile,updatedAt:found.record.updatedAt,message:'Profile updated.'})}
    if(req.method==='DELETE'){const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const role=String(body.role||'').toLowerCase(),id=String(body.id||'').trim();if(!['homeowner','contractor'].includes(role)||!id)return res.status(400).json({message:'Valid role and account ID are required.'});const found=await findUser(role,id);if(found.error)return res.status(404).json({message:found.error});const result=await github(`data/users/${found.folder}/${found.item.name}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Delete ${role} ${id} from admin database`,sha:found.item.sha})});if(!result.response.ok)return res.status(result.response.status).json({message:result.data?.message||'Unable to delete user.'});return res.status(200).json({ok:true,id,role,message:'User deleted.'})}
    const accounts=[];for(const role of roles){const folder=role==='homeowner'?'homeowners':'contractors',listing=await github(`data/users/${folder}`);if(!listing.response.ok||!Array.isArray(listing.data))continue;for(const item of listing.data.filter(x=>x.type==='file'&&x.name.endsWith('.json'))){const record=await readJson(`data/users/${folder}/${item.name}`);if(!record)continue;const build=Array.isArray(record?.plannerRecords?.build)?record.plannerRecords.build:[],renovation=Array.isArray(record?.plannerRecords?.renovation)?record.plannerRecords.renovation:[];const estimateNumbers=[...build,...renovation].map(q=>{const raw=String(q?.estimateNumber||'').trim();const match=raw.match(/^(EST-(?:BLD|REN)-\d{3})(?:-([SD]))?$/i);if(!match)return raw;const suffix=String(match[2]||'').toUpperCase()||(String(q?.quotationType||'').toLowerCase()==='detail'?'D':'S');return match[1]+'-'+suffix;}).filter(Boolean);const summary={role:record?.role||'',id:record?.homeownerId||record?.contractorId||'',name:record?.profile?.name||'',email:record?.profile?.email||'',phone:record?.profile?.phone||'',state:record?.state||'',quotationRunningNumber:record?.quotationRunningNumber||0,buildCount:build.length,renovationCount:renovation.length,estimateNumbers,updatedAt:record?.updatedAt||'',createdAt:record?.createdAt||''};if(q&&![summary.id,summary.name,summary.email,summary.phone].some(v=>String(v).toLowerCase().includes(q)))continue;accounts.push(includeRecords?{...summary,plannerRecords:record.plannerRecords||{build:[],renovation:[]}}:summary)}}accounts.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));const quotationCount=accounts.reduce((sum,a)=>sum+(Number(a.buildCount)||0)+(Number(a.renovationCount)||0),0);return res.status(200).json({repo,generatedAt:new Date().toISOString(),counts:{accounts:accounts.length,quotations:quotationCount},accounts})
  }catch(error){console.error('admin database error:',error);return res.status(500).json({message:'Unable to inspect database.'})}
}