export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();

  const resource=String(req.query?.resource||'').trim().toLowerCase();
  if(!['slots','registration','payment'].includes(resource))return res.status(404).json({message:'Class management resource not found.'});

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
  const SLOT_MODES=['Online','Fizikal','Online dan Fizikal'];
  const ATTENDANCE_MODES=['Online','Fizikal'];
  const normalizeSlotMode=value=>String(value||'').trim()==='Pejabat Teraju Ciptabina Resources'?'Fizikal':String(value||'').trim();
  const slotSupportsMode=(slotMode,attendance)=>{const m=normalizeSlotMode(slotMode);return m===attendance||m==='Online dan Fizikal';};
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
            return{...x,mode:normalizeSlotMode(x.mode),booked,remaining:Math.max(0,Number(x.capacity)-booked)};
          })
          .filter(x=>isAdmin||x.remaining>0);
        return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
      }

      if(!isAdmin)return res.status(401).json({message:'Unauthorized.'});
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});

      if(req.method==='POST'){
        if(!String(body.date||'').trim()||!String(body.startTime||'').trim()||!String(body.endTime||'').trim()||!String(body.mode||'').trim()||!String(body.capacity||'').trim())
          return res.status(400).json({message:'Date, time, mode and capacity are required.'});
        const slotMode=normalizeSlotMode(body.mode);
        if(!SLOT_MODES.includes(slotMode))return res.status(400).json({message:'Invalid class mode.'});
        const now=new Date().toISOString();
        const id='SLOT-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const slot={id,date:String(body.date).trim(),startTime:String(body.startTime).trim(),endTime:String(body.endTime).trim(),mode:slotMode,capacity:Math.max(1,Number(body.capacity)||1),active:body.active!==false,notes:String(body.notes||'').trim(),createdAt:now,updatedAt:now};
        s.items.push(slot);
        const saved=await save(slotsPath,s.items,s.sha,`Add Archicad class slot ${id}`);
        return res.status(201).json({ok:true,item:slot,commitSha:saved?.commit?.sha||null});
      }

      const id=String(body.id||'').trim();
      const index=s.items.findIndex(x=>String(x.id)===id);
      if(index<0)return res.status(404).json({message:'Class slot not found.'});

      if(req.method==='PUT'){
        if(body.mode!==undefined){const slotMode=normalizeSlotMode(body.mode);if(!SLOT_MODES.includes(slotMode))return res.status(400).json({message:'Invalid class mode.'});body.mode=slotMode;}
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
      const required=['name','phone','email','type','pax','slotId','deviceConfirmed'];
      if(required.some(k=>!String(body[k]||'').trim()))return res.status(400).json({message:'Please complete all required fields, including the laptop/MacBook confirmation.'});

      const slotStore=await read(slotsPath);
      const slot=slotStore.items.find(x=>String(x.id)===String(body.slotId)&&x.active!==false);
      if(!slot)return res.status(400).json({message:'Selected class slot is no longer available.'});

      const used=s.items.filter(x=>x.slotId===slot.id&&x.status!=='Cancelled').reduce((n,x)=>n+(parseInt(x.pax,10)||1),0);
      const pax=parseInt(body.pax,10)||1;
      if(used+pax>Number(slot.capacity))return res.status(409).json({message:'This class slot is full. Please choose another slot.'});
      const attendanceMode=String(body.mode||'').trim();
      if(!ATTENDANCE_MODES.includes(attendanceMode))return res.status(400).json({message:'Invalid attendance mode.'});
      if(!slotSupportsMode(slot.mode,attendanceMode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});
      if(String(body.deviceConfirmed).toLowerCase()!=='true')return res.status(400).json({message:'Each participant must confirm that they will bring a laptop or MacBook.'});

      const now=new Date().toISOString();
      const id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      const item={id,status:'Pending',createdAt:now,updatedAt:now,name:String(body.name).trim(),phone:String(body.phone).trim(),email:String(body.email).trim(),type:String(body.type).trim(),pax:String(body.pax).trim(),company:String(body.company||'').trim(),occupation:String(body.occupation||'').trim(),mode:attendanceMode,slotMode:normalizeSlotMode(slot.mode),slotId:String(slot.id),slotLabel:`${slot.date} · ${slot.startTime}-${slot.endTime} · ${normalizeSlotMode(slot.mode)} · ${attendanceMode}`,date:String(slot.date).trim(),experience:String(body.experience||'').trim(),laptop:'Mandatory — participant will bring laptop/MacBook',deviceConfirmed:true,payment:String(body.payment||'').trim(),source:String(body.source||'').trim(),notes:String(body.notes||'').trim()};
      s.items.unshift(item);
      const saved=await save(registrationsPath,s.items,s.sha,`New Archicad class registration ${id}`);
      return res.status(201).json({ok:true,item,commitSha:saved?.commit?.sha||null});
    }

    const id=String(body.id||'').trim();
    if(!id)return res.status(400).json({message:'Registration ID is required.'});
    const index=s.items.findIndex(x=>String(x.id)===id);
    if(index<0)return res.status(404).json({message:'Registration not found.'});

    if(req.method==='PUT'){
      const requestedMode=body.mode!==undefined?String(body.mode).trim():String(s.items[index].mode||'');
      if(!ATTENDANCE_MODES.includes(requestedMode))return res.status(400).json({message:'Invalid attendance mode.'});
      const selectedSlotId=body.slotId!==undefined?String(body.slotId).trim():String(s.items[index].slotId||'');
      const selectedStore=await read(slotsPath),selectedSlot=selectedStore.items.find(x=>String(x.id)===selectedSlotId&&x.active!==false);
      if(!selectedSlot)return res.status(400).json({message:'Selected class slot is not available.'});
      if(!slotSupportsMode(selectedSlot.mode,requestedMode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});
      body.mode=requestedMode;body.slotId=selectedSlotId;body.slotMode=normalizeSlotMode(selectedSlot.mode);body.slotLabel=String(selectedSlot.date)+' · '+String(selectedSlot.startTime)+'-'+String(selectedSlot.endTime)+' · '+normalizeSlotMode(selectedSlot.mode)+' · '+requestedMode;body.date=String(selectedSlot.date);
      const allowed=['name','phone','email','type','pax','company','occupation','mode','slotId','slotMode','slotLabel','date','experience','laptop','deviceConfirmed','payment','source','notes','status'];
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

    return res.status(405).json({message:'Method not allowed.'});    if(resource==='payment'){
      const crypto=await import('crypto');
      const money=n=>Math.round(Number(n||0)*100)/100;
      const fields=x=>{const total=money(x.totalFee),booking=money(x.bookingFee||50*(parseInt(x.pax,10)||1)),bookingPaid=money(x.bookingPaid),balancePaid=money(x.balancePaid),balanceDue=money(Math.max(0,total-bookingPaid-balancePaid));return{totalFee:total,bookingFee:booking,bookingPaid,balancePaid,balanceDue,paymentStatus:String(x.paymentStatus||((bookingPaid>=booking)?(balanceDue<=0?'Fully Paid':'Booking Fee Paid'):'Booking Fee Pending'))}};
      const okStatus=s=>['1','success','successful','paid'].includes(String(s??'').trim().toLowerCase());
      const amountOk=(a,e)=>{const n=Number(a);return Number.isFinite(n)&&(Math.round(n)===Math.round(Number(e)*100)||Math.abs(n-Number(e))<.0001)};
      const apply=(x,type,amount,ref,bill)=>{if(type==='booking'){x.bookingPaid=money(Math.max(Number(x.bookingPaid||0),money(amount)));x.bookingPaidAt=new Date().toISOString();x.bookingPaymentRef=String(ref||'');x.bookingBillCode=String(bill||x.bookingBillCode||'')}else{x.balancePaid=money(Math.min(Number(x.balanceDue||0),Number(x.balancePaid||0)+money(amount)));x.balancePaidAt=new Date().toISOString();x.balancePaymentRef=String(ref||'');x.balanceBillCode=String(bill||x.balanceBillCode||'')}const p=fields(x);x.balanceDue=p.balanceDue;x.paymentStatus=p.balanceDue<=0?'Fully Paid':(p.bookingPaid>=p.bookingFee?'Booking Fee Paid':'Booking Fee Pending');x.payment=p.paymentStatus;if(x.status!=='Cancelled')x.status=x.paymentStatus==='Fully Paid'?'Paid':(x.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');x.updatedAt=new Date().toISOString()};
      const update=async(id,mutator,msg)=>{for(let n=0;n<2;n++){const s=await read(registrationsPath),i=s.items.findIndex(x=>String(x.id)===String(id));if(i<0)return null;if(mutator(s.items[i])===false)return s.items[i];try{await save(registrationsPath,s.items,s.sha,msg);return s.items[i]}catch(e){if(e.status===409&&n===0)continue;throw e}}throw new Error('Unable to update class payment.')};
      const find=async id=>{const s=await read(registrationsPath),i=s.items.findIndex(x=>String(x.id)===String(id));return{s,item:i<0?null:s.items[i]}};
      const createBill=async(x,type,amount)=>{const sk=process.env.TOYYIBPAY_SECRET_KEY,cc=process.env.TOYYIBPAY_CATEGORY_CODE;if(!sk||!cc)throw new Error('ToyyibPay payment configuration is incomplete.');const ret='https://terajuciptabina-eng.github.io/terajuciptabina/kelas-archicad/register.html?payment=return&paymentType='+encodeURIComponent(type)+'&registration='+encodeURIComponent(x.id)+'&token='+encodeURIComponent(x.paymentToken);const fd=new URLSearchParams();fd.append('userSecretKey',sk);fd.append('categoryCode',cc);fd.append('billName',type==='booking'?'Archicad Booking Fee':'Archicad Balance Payment');fd.append('billDescription',type==='booking'?'Archicad booking fee':'Archicad class balance');fd.append('billPriceSetting','1');fd.append('billPayorInfo','1');fd.append('billAmount',String(Math.round(Number(amount)*100)));fd.append('billReturnUrl',ret);fd.append('billCallbackUrl',String(process.env.PUBLIC_BASE_URL||'https://terajuciptabina.vercel.app').replace(/\/$/,'')+'/api/class-payment-callback');fd.append('billExternalReferenceNo',x.id+'-'+type);fd.append('billTo',String(x.name||'Participant'));fd.append('billEmail',String(x.email||''));fd.append('billPhone',String(x.phone||''));fd.append('billContentEmail','0');fd.append('billChargeToCustomer','0');fd.append('billExpiryDays','1');const r=await fetch('https://toyyibpay.com/index.php/api/createBill',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()}),out=await r.json();if(!Array.isArray(out)||!out[0]?.BillCode)throw new Error(out?.msg||'Unable to create ToyyibPay payment.');const billCode=String(out[0].BillCode);return{billCode,paymentUrl:'https://toyyibpay.com/'+billCode}};
      const verifyBill=async(code,expected,order)=>{const sk=process.env.TOYYIBPAY_SECRET_KEY;if(!sk)throw new Error('ToyyibPay payment configuration is incomplete.');const fd=new URLSearchParams();fd.append('billCode',code);fd.append('userSecretKey',sk);const r=await fetch('https://toyyibpay.com/index.php/api/getBillTransactions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()}),out=await r.json();if(!Array.isArray(out))return null;return out.find(t=>okStatus(t.billpaymentStatus??t.status??t.status_id??'')&&amountOk(t.billpaymentAmount??t.amount??0,expected)&&(!String(t.order_id??t.orderId??t.externalReferenceNo??'')||String(t.order_id??t.orderId??t.externalReferenceNo)===String(order)))||null};
      const operation=String(req.query?.operation||'').trim().toLowerCase();if(!['create','verify','callback'].includes(operation))return res.status(404).json({message:'Class payment operation not found.'});
      if(operation==='callback'){if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});const b=bodyData(),sk=process.env.TOYYIBPAY_SECRET_KEY;if(!sk)return res.status(500).json({message:'ToyyibPay payment configuration is incomplete.'});const hash=crypto.createHash('md5').update(sk+String(b.status||'')+String(b.order_id||'')+String(b.refno||'')+'ok').digest('hex');if(String(b.hash||'').toLowerCase()!==hash.toLowerCase())return res.status(400).json({message:'Invalid callback signature.'});if(!okStatus(b.status))return res.status(200).json({success:true,ignored:true});const m=String(b.order_id||'').match(/^(ARC-\d{14}-[A-Z0-9]{4})-(booking|balance)$/i);if(!m)return res.status(400).json({message:'Invalid payment reference.'});const id=m[1],type=String(m[2]).toLowerCase(),found=await find(id);if(!found.item)return res.status(404).json({message:'Registration not found.'});const p=fields(found.item),expected=type==='booking'?p.bookingFee:p.balanceDue;if(expected<=0)return res.status(200).json({success:true,alreadyPaid:true});const stored=type==='booking'?String(found.item.bookingBillCode||''):String(found.item.balanceBillCode||'');if(stored&&stored!==String(b.billcode||''))return res.status(400).json({message:'Payment bill does not match the registration.'});if(!amountOk(b.amount,expected))return res.status(400).json({message:'Payment amount does not match the expected amount.'});await update(id,x=>{const e=type==='booking'?money(Math.max(0,x.bookingFee-money(x.bookingPaid))):money(x.balanceDue);if(e<=0||!amountOk(b.amount,e))return false;apply(x,type,e,b.refno,b.billcode)},'Update Archicad class payment callback '+id);return res.status(200).json({success:true});}
      if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});
      const b=bodyData(),id=String(b.registrationId||'').trim(),tokenValue=String(b.token||'').trim(),type=String(b.paymentType||'').trim().toLowerCase();if(!id||!['booking','balance'].includes(type))return res.status(400).json({message:'Registration and payment type are required.'});
      const found=await find(id);if(!found.item)return res.status(404).json({message:'Registration not found.'});const x=found.item;if(x.status==='Cancelled')return res.status(409).json({message:'This registration has been cancelled.'});if(!isAdmin&&String(x.paymentToken||'')!==tokenValue)return res.status(401).json({message:'Invalid payment access token.'});
      if(operation==='create'){const p=fields(x);if(type==='balance'&&p.bookingPaid<p.bookingFee)return res.status(409).json({message:'Booking fee must be paid before the balance can be paid.'});const amount=type==='booking'?money(p.bookingFee-p.bookingPaid):money(p.balanceDue);if(amount<=0)return res.status(200).json({success:true,alreadyPaid:true,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,bookingPaid:p.bookingPaid,balancePaid:p.balancePaid});const existing=type==='booking'?String(x.bookingBillCode||''):String(x.balanceBillCode||'');if(existing)return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:existing,paymentUrl:'https://toyyibpay.com/'+existing,amount,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue});const bill=await createBill(x,type,amount);await update(id,z=>{if(type==='booking')z.bookingBillCode=bill.billCode;else z.balanceBillCode=bill.billCode},'Create Archicad '+type+' payment bill '+id);return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:bill.billCode,paymentUrl:bill.paymentUrl,amount,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue});}
      const billCode=String(b.billCode||'').trim();if(!billCode)return res.status(400).json({paid:false,message:'Bill code is required.'});const stored=type==='booking'?String(x.bookingBillCode||''):String(x.balanceBillCode||'');if(stored&&stored!==billCode)return res.status(400).json({paid:false,message:'Bill code does not match the registration.'});const p=fields(x),expected=type==='booking'?money(p.bookingFee-p.bookingPaid):money(p.balanceDue);if(expected<=0)return res.status(200).json({paid:true,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,bookingPaid:p.bookingPaid,balancePaid:p.balancePaid});const tx=await verifyBill(billCode,expected,id+'-'+type);if(!tx)return res.status(200).json({paid:false,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,message:'Payment has not been verified.'});const actual=Number(tx.billpaymentAmount??tx.amount??expected),ref=String(tx.billpaymentInvoiceNo??tx.refno??tx.transaction_id??'');const updated=await update(id,z=>{const e=type==='booking'?money(Math.max(0,z.bookingFee-money(z.bookingPaid))):money(z.balanceDue);if(e<=0||!amountOk(actual,e))return false;apply(z,type,e,ref,billCode)},'Verify Archicad '+type+' payment '+id);if(!updated)return res.status(409).json({paid:false,message:'Payment was verified but the registration could not be updated yet.'});const final=fields(updated);return res.status(200).json({paid:true,registrationId:id,paymentType:type,billCode,paymentStatus:final.paymentStatus,balanceDue:final.balanceDue,bookingPaid:final.bookingPaid,balancePaid:final.balancePaid});
    }

  }catch(error){
    console.error('class management error:',error);
    return res.status(500).json({message:error.message||'Unable to process class management request.'});
  }
}