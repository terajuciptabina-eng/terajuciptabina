export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed.' });

  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  const token = process.env.GITHUB_TOKEN;
  const adminKey = process.env.ADMIN_KEY;
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const path = 'data/contractors/database.json';

  async function github(options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  async function githubFile(filePath, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
  }
  async function atomicWriteFiles(files, message) {
    const refResponse = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers });
    const refText = await refResponse.text(); let refData = null;
    try { refData = refText ? JSON.parse(refText) : null; } catch {}
    if (!refResponse.ok || !refData?.object?.sha) return { ok:false, message:refData?.message || 'Unable to read main branch.' };
    const baseCommitSha = refData.object.sha;
    const commitResponse = await fetch(`https://api.github.com/repos/${repo}/git/commits/${baseCommitSha}`, { headers });
    const commitText = await commitResponse.text(); let commitData = null;
    try { commitData = commitText ? JSON.parse(commitText) : null; } catch {}
    if (!commitResponse.ok || !commitData?.tree?.sha) return { ok:false, message:commitData?.message || 'Unable to read main tree.' };
    const treeEntries = [];
    for (const file of files) {
      const blobResponse = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
        method:'POST',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({content:file.content,encoding:'utf-8'})
      });
      const blobText = await blobResponse.text(); let blobData = null;
      try { blobData = blobText ? JSON.parse(blobText) : null; } catch {}
      if (!blobResponse.ok || !blobData?.sha) return { ok:false, message:blobData?.message || `Unable to create blob for ${file.path}.` };
      treeEntries.push({path:file.path,mode:'100644',type:'blob',sha:blobData.sha});
    }
    const treeResponse = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method:'POST', headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({base_tree:commitData.tree.sha,tree:treeEntries})
    });
    const treeText = await treeResponse.text(); let treeData = null;
    try { treeData = treeText ? JSON.parse(treeText) : null; } catch {}
    if (!treeResponse.ok || !treeData?.sha) return { ok:false, message:treeData?.message || 'Unable to create Git tree.' };
    const newCommitResponse = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method:'POST', headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({message,tree:treeData.sha,parents:[baseCommitSha]})
    });
    const newCommitText = await newCommitResponse.text(); let newCommitData = null;
    try { newCommitData = newCommitText ? JSON.parse(newCommitText) : null; } catch {}
    if (!newCommitResponse.ok || !newCommitData?.sha) return { ok:false, message:newCommitData?.message || 'Unable to create review commit.' };
    const refUpdate = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
      method:'PATCH', headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({sha:newCommitData.sha,force:false})
    });
    const refText2 = await refUpdate.text(); let refData2 = null;
    try { refData2 = refText2 ? JSON.parse(refText2) : null; } catch {}
    if (!refUpdate.ok) return { ok:false, message:refData2?.message || 'Unable to publish review update.' };
    return {ok:true,commit:newCommitData.sha};
  }
  function readPayload() { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  function clean(value, max=500) { return String(value ?? '').trim().slice(0, max); }

  try {
    const current = await github();
    if (!current.response.ok) return res.status(502).json({ message: current.data?.message || 'Unable to read contractor database.' });
    let database = {};
    try { database = JSON.parse(Buffer.from(current.data?.content || '', 'base64').toString('utf8')); } catch { database = {}; }
    database.schemaVersion = Math.max(2, Number(database.schemaVersion) || 1);
    database.databaseType = database.databaseType || 'contractor-quotation-database';
    database.storage = 'github';
    database.contractors = Array.isArray(database.contractors) ? database.contractors : [];

    if (req.method === 'GET') {
      const supplied = clean(req.headers['x-admin-key'], 200);
      if (!adminKey || supplied !== adminKey) return res.status(401).json({ message: 'Unauthorized.' });
      return res.status(200).json({ database, generatedAt: new Date().toISOString() });
    }

    const body = readPayload();
    const suppliedAdminKey = clean(req.headers['x-admin-key'], 200);
    const contractorId = clean(body.contractorId, 80).toUpperCase();

    // Hidden admin review action. Contractor capture requests never use this action.
    if (req.method === 'POST' && body.action) {
      if (!adminKey || suppliedAdminKey !== adminKey) return res.status(401).json({ message: 'Unauthorized.' });
      const action = clean(body.action, 30).toLowerCase();
      if (!['approve','reject'].includes(action)) return res.status(400).json({ message: 'Invalid review action.' });
      if (!contractorId) return res.status(400).json({ message: 'contractorId is required.' });
      const state = clean(body.state, 80).toLowerCase();
      const plannerType = clean(body.plannerType, 30).toLowerCase();
      const customItemId = clean(body.customItemId, 160);
      const contractor = database.contractors.find(x => String(x?.contractorId || '').toUpperCase() === contractorId);
      if (!contractor) return res.status(404).json({ message: 'Contractor record not found.' });
      contractor.customItems = Array.isArray(contractor.customItems) ? contractor.customItems : [];
      contractor.marketHistory = Array.isArray(contractor.marketHistory) ? contractor.marketHistory : [];
      const item = contractor.customItems.find(x =>
        String(x?.customItemId || '') === customItemId &&
        String(x?.state || '').toLowerCase() === state &&
        String(x?.plannerType || '').toLowerCase() === plannerType
      );
      if (!item) return res.status(404).json({ message: 'Captured rate observation not found.' });
      const now = new Date().toISOString();
      const previousApprovalStatus = String(item.approvalStatus || 'pending');
      item.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
      item.reviewedAt = now;
      item.reviewedBy = 'admin';
      item.reviewNote = clean(body.note, 1000) || null;

      let stateUpdate = null;
      if (action === 'approve' && state) {
        const statePath = `data/rates/states/${state}.json`;
        const stateFile = await githubFile(statePath);
        if (!stateFile.response.ok) return res.status(502).json({ message: stateFile.data?.message || 'Unable to load State Rate Matrix.' });
        let stateRateSet;
        try { stateRateSet = JSON.parse(Buffer.from(stateFile.data?.content || '', 'base64').toString('utf8')); }
        catch { return res.status(502).json({ message: 'State Rate Matrix is invalid JSON.' }); }

        const sourcePath = String(item.sourceGlobalId || '').replace(/^master-/i,'').trim();
        const pathSlug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
        const candidates = Object.keys(stateRateSet.rates || {}).filter(k => {
          const prefix = plannerType === 'renovation' ? 'renovation_rule_' : 'rule_';
          return k.startsWith(prefix + pathSlug(sourcePath) + '_');
        });
        const masterRateKey = clean(body.masterRateKey, 200) || candidates[0] || null;
        if (!masterRateKey) return res.status(400).json({ message: 'Approved rate has no State Rate Matrix key.' });

        stateRateSet.rates = stateRateSet.rates && typeof stateRateSet.rates === 'object' ? stateRateSet.rates : {};
        stateRateSet.rateItems = stateRateSet.rateItems && typeof stateRateSet.rateItems === 'object' ? stateRateSet.rateItems : {};
        const previousRate = Object.prototype.hasOwnProperty.call(stateRateSet.rates, masterRateKey) ? Number(stateRateSet.rates[masterRateKey]) : null;
        const approvedRate = Number(item.rate);
        if (!Number.isFinite(approvedRate) || approvedRate < 0) return res.status(400).json({ message: 'Invalid approved contractor rate.' });
        stateRateSet.rates[masterRateKey] = Math.round(approvedRate * 100) / 100;
        stateRateSet.rateItems[masterRateKey] = {
          ...(stateRateSet.rateItems[masterRateKey] || {}),
          description: String(item.description || stateRateSet.rateItems[masterRateKey]?.description || '').trim(),
          unit: String(item.unit || stateRateSet.rateItems[masterRateKey]?.unit || 'unit').trim(),
          category: 'calculation-rule',
          groupKey: item.groupKey || stateRateSet.rateItems[masterRateKey]?.groupKey || null,
          groupTitle: item.groupTitle || stateRateSet.rateItems[masterRateKey]?.groupTitle || 'Calculation Rules',
          plannerType
        };
        const audit = Array.isArray(stateRateSet.rateHistory) ? stateRateSet.rateHistory : [];
        audit.push({
          masterRateKey,
          description:item.description || null,
          unit:item.unit || null,
          plannerType,
          state,
          previousRate:Number.isFinite(previousRate) ? previousRate : null,
          newRate:Math.round(approvedRate * 100) / 100,
          source:'contractor_approved',
          contractorId,
          customItemId,
          approvedBy:'admin',
          approvedAt:now
        });
        stateRateSet.rateHistory = audit;
        stateRateSet.updatedAt = now;
        stateRateSet.effectiveDate = stateRateSet.effectiveDate || now.slice(0,10);
        stateUpdate = {path:statePath,content:JSON.stringify(stateRateSet,null,2)+'\\n',previousRate,masterRateKey,newRate:Math.round(approvedRate*100)/100};
      }

      contractor.marketHistory.push({...item,eventType:action === 'approve' ? 'rate-approved' : 'rate-rejected',capturedAt:now,previousApprovalStatus});
      database.updatedAt = now;
      const databaseContent = JSON.stringify(database, null, 2) + '\\n';
      const files = [{path:'data/contractors/database.json',content:databaseContent}];
      if (stateUpdate) files.push({path:stateUpdate.path,content:stateUpdate.content});
      const published = await atomicWriteFiles(files, `${action === 'approve' ? 'Approve' : 'Reject'} contractor rate observation ${customItemId}`);
      if (!published.ok) return res.status(502).json({ message:published.message || 'Unable to save review decision.' });
      return res.status(200).json({ ok:true, action, item, stateRateUpdated:Boolean(stateUpdate), stateRateChange:stateUpdate ? {
        masterRateKey:stateUpdate.masterRateKey,
        previousRate:stateUpdate.previousRate,
        newRate:stateUpdate.newRate
      } : null, commit:published.commit });
    }
    if (!contractorId) return res.status(400).json({ message: 'contractorId is required.' });
    const plannerType = clean(body.plannerType, 30).toLowerCase();
    if (!['build', 'renovation'].includes(plannerType)) return res.status(400).json({ message: 'Invalid plannerType.' });
    const description = clean(body.description, 1000);
    const unit = clean(body.unit, 50) || 'unit';
    const rate = Number(body.rate);
    if (!description || !Number.isFinite(rate) || rate < 0) return res.status(400).json({ message: 'Description and valid rate are required.' });

    let contractor = database.contractors.find(x => String(x?.contractorId || '').toUpperCase() === contractorId);
    if (!contractor) { contractor = { contractorId, customItems: [], marketHistory: [] }; database.contractors.push(contractor); }
    contractor.customItems = Array.isArray(contractor.customItems) ? contractor.customItems : [];
    contractor.marketHistory = Array.isArray(contractor.marketHistory) ? contractor.marketHistory : [];

    const now = new Date().toISOString();
    const customItemId = clean(body.customItemId, 120) || `CI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const isOverride = !!body.sourceGlobalId;
    const overrideActive = body.overrideActive !== false;
    const globalRate = Number(body.globalRate);
    const item = {
      customItemId, sourceType: isOverride ? 'override' : 'custom', sourceGlobalId: isOverride ? clean(body.sourceGlobalId, 160) : null,
      plannerType, description, unit, rate: Math.round(rate * 100) / 100,
      globalRate: Number.isFinite(globalRate) ? Math.round(globalRate * 100) / 100 : null,
      rateDelta: Number.isFinite(globalRate) ? Math.round((rate-globalRate)*100)/100 : null,
      rateDeltaPercent: Number.isFinite(globalRate) && globalRate ? Math.round(((rate-globalRate)/globalRate)*10000)/100 : null,
      overrideActive: isOverride ? overrideActive : true,
      state: clean(body.state, 80).toLowerCase() || null,
      rateSetId: clean(body.rateSetId, 120) || null,
      approvalStatus: 'pending', reviewedAt: null, reviewedBy: null, reviewNote: null,
      capturedAt: now, category: clean(body.category,80)||'custom',
      groupKey: clean(body.groupKey,120)||null, groupTitle: clean(body.groupTitle,120)||'Custom Items', updatedAt: now
    };
    const index = contractor.customItems.findIndex(x => x.customItemId === item.customItemId && String(x?.state || '').toLowerCase() === item.state && String(x?.plannerType || '').toLowerCase() === item.plannerType);
    if(index>=0){if(isOverride&&!overrideActive)contractor.customItems.splice(index,1);else contractor.customItems[index]={...contractor.customItems[index],...item}}
    else if(!(isOverride&&!overrideActive))contractor.customItems.push(item);
    contractor.marketHistory.push({...item,eventType:isOverride&&!overrideActive?'override-reset':(isOverride?'override-update':'custom-update'),capturedAt:now});
    database.updatedAt=now;

    const content = JSON.stringify(database, null, 2) + '\n';
    const updated = await github({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Capture contractor custom item ${contractorId}`, content: Buffer.from(content, 'utf8').toString('base64'), sha: current.data?.sha }) });
    if (!updated.response.ok) return res.status(502).json({ message: updated.data?.message || 'Unable to save contractor custom item.' });
    return res.status(200).json({ ok: true, item, contractorId });
  } catch (error) {
    console.error('contractor market database error:', error);
    return res.status(500).json({ message: 'Unable to process contractor custom item.' });
  }
}
