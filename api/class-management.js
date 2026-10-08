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
  const normalizeSlotMode=v=>String(v||'').trim()==='Pejabat Teraju Ciptabina Resources'?'Fizikal':String(v||'').trim();
  const slotSupportsMode=(slotMode,attendance)=>{const m=normalizeSlotMode(slotMode);return m===attendance||m==='Online dan Fizikal';};
  const money=n=>Math.round(Number(n||0)*100)/100;
  const paymentFields=x=>{const total=money(x.totalFee),booking=money(x.bookingFee||50*(parseInt(x.pax,10)||1)),bookingPaid=money(x.bookingPaid),balancePaid=money(x.balancePaid),balanceDue=money(Math.max(0,total-bookingPaid-balancePaid)),paymentStatus=String(x.paymentStatus||((bookingPaid>=booking)?(balanceDue<=0?'Fully Paid':'Booking Fee Paid'):'Booking Fee Pending'));return{totalFee:total,bookingFee:booking,bookingPaid,balancePaid,balanceDue,paymentStatus};};
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

    if(resource==='payment'){
      const crypto=await import('crypto');
      const paymentSuccess=s=>['1','success','successful','paid'].includes(String(s??'').trim().toLowerCase());
      const amountMatches=(a,e)=>{const n=Number(a);return Number.isFinite(n)&&(Math.round(n)===Math.round(Number(e)*100)||Math.abs(n-Number(e))<.0001)};
      const updatePayment=async(id,mutator,message)=>{for(let attempt=0;attempt<2;attempt++){const fresh=await read(registrationsPath),i=fresh.items.findIndex(x=>String(x.id)===String(id));if(i<0)return null;if(mutator(fresh.items[i])===false)return fresh.items[i];try{await save(registrationsPath,fresh.items,fresh.sha,message);return fresh.items[i]}catch(e){if(e.status===409&&attempt===0)continue;throw e}}throw new Error('Unable to update class payment.')};
      const findRegistration=async id=>{const fresh=await read(registrationsPath),i=fresh.items.findIndex(x=>String(x.id)===String(id));return i<0?null:fresh.items[i]};
      const createBill=async(x,type,amount)=>{const secret=process.env.TOYYIBPAY_SECRET_KEY,category=process.env.TOYYIBPAY_CATEGORY_CODE;if(!secret||!category)throw new Error('ToyyibPay payment configuration is incomplete.');const returnUrl='https://terajuciptabina-eng.github.io/terajuciptabina/kelas-archicad/register.html?payment=return&paymentType='+encodeURIComponent(type)+'&registration='+encodeURIComponent(x.id)+'&token='+encodeURIComponent(x.paymentToken),fd=new URLSearchParams();fd.append('userSecretKey',secret);fd.append('categoryCode',category);fd.append('billName',type==='booking'?'Archicad Booking Fee':'Archicad Balance Payment');fd.append('billDescription',type==='booking'?'Archicad booking fee':'Archicad class balance');fd.append('billPriceSetting','1');fd.append('billPayorInfo','1');fd.append('billAmount',String(Math.round(Number(amount)*100)));fd.append('billReturnUrl',returnUrl);fd.append('billCallbackUrl',(process.env.PUBLIC_BASE_URL||'https://terajuciptabina.vercel.app').replace(/\/$/,'')+'/api/class-payment-callback');fd.append('billExternalReferenceNo',x.id+'-'+type);fd.append('billTo',String(x.name||'Participant'));fd.append('billEmail',String(x.email||''));fd.append('billPhone',String(x.phone||''));fd.append('billContentEmail','0');fd.append('billChargeToCustomer','0');fd.append('billExpiryDays','1');const r=await fetch('https://toyyibpay.com/index.php/api/createBill',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()}),out=await r.json();if(!Array.isArray(out)||!out[0]?.BillCode)throw new Error(out?.msg||'Unable to create ToyyibPay payment.');const billCode=String(out[0].BillCode);return{billCode,paymentUrl:'https://toyyibpay.com/'+billCode}};
      const verifyBill=async(code,expected,order)=>{const secret=process.env.TOYYIBPAY_SECRET_KEY;if(!secret)throw new Error('ToyyibPay payment configuration is incomplete.');const fd=new URLSearchParams();fd.append('billCode',code);fd.append('userSecretKey',secret);const r=await fetch('https://toyyibpay.com/index.php/api/getBillTransactions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()}),out=await r.json();if(!Array.isArray(out))return null;return out.find(t=>paymentSuccess(t.billpaymentStatus??t.status??t.status_id??'')&&amountMatches(t.billpaymentAmount??t.amount??0,expected)&&(!String(t.order_id??t.orderId??t.externalReferenceNo??'')||String(t.order_id??t.orderId??t.externalReferenceNo)===String(order)))||null};
      
      

const operation=String(req.query?.operation||'').trim().toLowerCase();if(!['create','verify','callback','cash'].includes(operation))return res.status(404).json({message:'Class payment operation not found.'});
if(operation==='cash'){
        if(req.method!=='POST'||!isAdmin)return res.status(401).json({message:'Admin authorization required for cash payment.'});
        const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
        const id=String(b.registrationId||'').trim();
        const type=String(b.paymentType||'').trim().toLowerCase();
        if(!id||!['booking','balance','full'].includes(type))return res.status(400).json({message:'Registration and cash payment type are required.'});
        const item=await findRegistration(id);
        if(!item)return res.status(404).json({message:'Registration not found.'});
        if(item.status==='Cancelled')return res.status(409).json({message:'This registration has been cancelled.'});
        const p=paymentFields(item);
        const bookingOutstanding=money(Math.max(0,p.bookingFee-p.bookingPaid));
        const balanceOutstanding=money(Math.max(0,p.balanceDue));
        if(bookingOutstanding<=0&&balanceOutstanding<=0)return res.status(409).json({message:'This registration is already fully paid.'});
        let bookingCash=0,balanceCash=0;
        if(type==='booking'){
          if(bookingOutstanding<=0)return res.status(409).json({message:'Booking fee is already paid.'});
          bookingCash=bookingOutstanding;
        }else if(type==='balance'){
          if(bookingOutstanding>0)return res.status(409).json({message:'Booking fee must be paid before recording a cash balance payment.'});
          if(balanceOutstanding<=0)return res.status(409).json({message:'Balance is already paid.'});
          balanceCash=balanceOutstanding;
        }else{
          bookingCash=bookingOutstanding;
          balanceCash=balanceOutstanding;
        }
        const now=new Date().toISOString();
        const recordedBy=String(suppliedUser||adminUser||'admin').trim();
        const reference=String(b.reference||'').trim();
        const note=String(b.note||'').trim();
        const updated=await updatePayment(id,x=>{
          x.cashPayments=Array.isArray(x.cashPayments)?x.cashPayments:[];
          if(bookingCash>0){
            x.bookingPaid=money(Number(x.bookingPaid||0)+bookingCash);
            x.bookingPaidAt=now;
            x.bookingPaymentMethod='Cash';
            x.bookingPaymentRef=reference;
            x.cashPayments.push({component:'Booking Fee',amount:bookingCash,recordedAt:now,recordedBy,reference,note});
          }
          if(balanceCash>0){
            x.balancePaid=money(Number(x.balancePaid||0)+balanceCash);
            x.balancePaidAt=now;
            x.balancePaymentMethod='Cash';
            x.balancePaymentRef=reference;
            x.cashPayments.push({component:'Balance',amount:balanceCash,recordedAt:now,recordedBy,reference,note});
          }
          const methods=[String(x.bookingPaymentMethod||'').trim(),String(x.balancePaymentMethod||'').trim()].filter(Boolean);
          x.paymentMethod=methods.length===0?'':([...new Set(methods)].length===1?methods[0]:'Mixed');
          const q=paymentFields(x);
          x.balanceDue=q.balanceDue;
          x.paymentStatus=q.paymentStatus;
          x.payment=q.paymentStatus;
          x.paymentLastRecordedAt=now;
          x.paymentLastRecordedBy=recordedBy;
          if(x.status!=='Cancelled')x.status=q.paymentStatus==='Fully Paid'?'Paid':(q.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          x.updatedAt=now;
        },'Record Archicad cash payment '+id);
        if(!updated)return res.status(409).json({message:'Cash payment could not be recorded.'});
        const final=paymentFields(updated);
        return res.status(200).json({ok:true,registrationId:id,paymentMethod:updated.paymentMethod||'Cash',paymentStatus:final.paymentStatus,bookingPaid:final.bookingPaid,balancePaid:final.balancePaid,balanceDue:final.balanceDue,cashAmount:money(bookingCash+balanceCash),reference});
      }
      if(operation==='callback'){if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),secret=process.env.TOYYIBPAY_SECRET_KEY;if(!secret)return res.status(500).json({message:'ToyyibPay payment configuration is incomplete.'});const hash=crypto.createHash('md5').update(secret+String(b.status||'')+String(b.order_id||'')+String(b.refno||'')+'ok').digest('hex');if(String(b.hash||'').toLowerCase()!==hash.toLowerCase())return res.status(400).json({message:'Invalid callback signature.'});if(!paymentSuccess(b.status))return res.status(200).json({success:true,ignored:true});const m=String(b.order_id||'').match(/^(ARC-\d{14}-[A-Z0-9]{4})-(booking|balance)$/i);if(!m)return res.status(400).json({message:'Invalid payment reference.'});const id=m[1],type=String(m[2]).toLowerCase(),item=await findRegistration(id);if(!item)return res.status(404).json({message:'Registration not found.'});const p=paymentFields(item),expected=type==='booking'?p.bookingFee:p.balanceDue;if(expected<=0)return res.status(200).json({success:true,alreadyPaid:true});const stored=type==='booking'?String(item.bookingBillCode||''):String(item.balanceBillCode||'');if(stored&&stored!==String(b.billcode||''))return res.status(400).json({message:'Payment bill does not match the registration.'});if(!amountMatches(b.amount,expected))return res.status(400).json({message:'Payment amount does not match the expected amount.'});await updatePayment(id,x=>{const e=type==='booking'?money(Math.max(0,x.bookingFee-money(x.bookingPaid))):money(x.balanceDue);if(e<=0||!amountMatches(b.amount,e))return false;if(type==='booking'){x.bookingPaid=e;x.bookingPaidAt=new Date().toISOString();x.bookingPaymentRef=String(b.refno||'');x.bookingBillCode=String(b.billcode||x.bookingBillCode||'')}else{x.balancePaid=money(Math.min(Number(x.balanceDue||0),Number(x.balancePaid||0)+e));x.balancePaidAt=new Date().toISOString();x.balancePaymentRef=String(b.refno||'');x.balanceBillCode=String(b.billcode||x.balanceBillCode||'')}const z=paymentFields(x);x.balanceDue=z.balanceDue;x.paymentStatus=z.paymentStatus;x.payment=z.paymentStatus;if(x.status!=='Cancelled')x.status=z.paymentStatus==='Fully Paid'?'Paid':(z.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');x.updatedAt=new Date().toISOString();},'Update Archicad class payment callback '+id);return res.status(200).json({success:true})}
      if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),id=String(b.registrationId||'').trim(),tokenValue=String(b.token||'').trim(),type=String(b.paymentType||'').trim().toLowerCase();if(!id||!['booking','balance'].includes(type))return res.status(400).json({message:'Registration and payment type are required.'});const item=await findRegistration(id);if(!item)return res.status(404).json({message:'Registration not found.'});if(item.status==='Cancelled')return res.status(409).json({message:'This registration has been cancelled.'});if(!isAdmin&&String(item.paymentToken||'')!==tokenValue)return res.status(401).json({message:'Invalid payment access token.'});
      if(operation==='create'){const p=paymentFields(item);if(type==='balance'&&p.bookingPaid<p.bookingFee)return res.status(409).json({message:'Booking fee must be paid before the balance can be paid.'});const amount=type==='booking'?money(Math.max(0,p.bookingFee-p.bookingPaid)):money(p.balanceDue);if(amount<=0)return res.status(200).json({success:true,alreadyPaid:true,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,bookingPaid:p.bookingPaid,balancePaid:p.balancePaid});const existing=type==='booking'?String(item.bookingBillCode||''):String(item.balanceBillCode||'');if(existing)return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:existing,paymentUrl:'https://toyyibpay.com/'+existing,amount,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue});const bill=await createBill(item,type,amount);await updatePayment(id,x=>{if(type==='booking')x.bookingBillCode=bill.billCode;else x.balanceBillCode=bill.billCode;x.updatedAt=new Date().toISOString()},'Create Archicad '+type+' payment bill '+id);return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:bill.billCode,paymentUrl:bill.paymentUrl,amount,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue})}
      const billCode=String(b.billCode||'').trim();if(!billCode)return res.status(400).json({paid:false,message:'Bill code is required.'});const stored=type==='booking'?String(item.bookingBillCode||''):String(item.balanceBillCode||'');if(stored&&stored!==billCode)return res.status(400).json({paid:false,message:'Bill code does not match the registration.'});const p=paymentFields(item),expected=type==='booking'?money(Math.max(0,p.bookingFee-p.bookingPaid)):money(p.balanceDue);if(expected<=0)return res.status(200).json({paid:true,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,bookingPaid:p.bookingPaid,balancePaid:p.balancePaid});const tx=await verifyBill(billCode,expected,id+'-'+type);if(!tx)return res.status(200).json({paid:false,registrationId:id,paymentType:type,paymentStatus:p.paymentStatus,balanceDue:p.balanceDue,message:'Payment has not been verified.'});const actual=Number(tx.billpaymentAmount??tx.amount??expected),ref=String(tx.billpaymentInvoiceNo??tx.refno??tx.transaction_id??'');const updated=await updatePayment(id,x=>{const e=type==='booking'?money(Math.max(0,x.bookingFee-money(x.bookingPaid))):money(x.balanceDue);if(e<=0||!amountMatches(actual,e))return false;if(type==='booking'){x.bookingPaid=e;x.bookingPaidAt=new Date().toISOString();x.bookingPaymentRef=ref;x.bookingBillCode=billCode}else{x.balancePaid=money(Math.min(Number(x.balanceDue||0),Number(x.balancePaid||0)+e));x.balancePaidAt=new Date().toISOString();x.balancePaymentRef=ref;x.balanceBillCode=billCode}const z=paymentFields(x);x.balanceDue=z.balanceDue;x.paymentStatus=z.paymentStatus;x.payment=z.paymentStatus;if(x.status!=='Cancelled')x.status=z.paymentStatus==='Fully Paid'?'Paid':(z.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');x.updatedAt=new Date().toISOString()},'Verify Archicad '+type+' payment '+id);if(!updated)return res.status(409).json({paid:false,message:'Payment was verified but the registration could not be updated yet.'});const final=paymentFields(updated);return res.status(200).json({paid:true,registrationId:id,paymentType:type,billCode,paymentStatus:final.paymentStatus,balanceDue:final.balanceDue,bookingPaid:final.bookingPaid,balancePaid:final.balancePaid});
    }

    const s=await read(registrationsPath);

    if(req.method!=='POST'&&!isAdmin)return res.status(401).json({message:'Unauthorized.'});

    if(req.method==='GET'){
      const q=String(req.query?.q||'').trim().toLowerCase();
      const status=String(req.query?.status||'').trim().toLowerCase();
      const type=String(req.query?.type||'').trim().toLowerCase();
      const mode=String(req.query?.mode||'').trim().toLowerCase();
      const paymentStatus=String(req.query?.paymentStatus||'').trim().toLowerCase();
      const items=s.items.filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q))&&(!status||String(x.status||'').toLowerCase()===status)&&(!type||String(x.type||'').toLowerCase()===type)&&(!mode||String(x.mode||'').toLowerCase()===mode)&&(!paymentStatus||paymentFields(x).paymentStatus.toLowerCase()===paymentStatus)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(x=>({...x,...paymentFields(x)}));
      return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
    }
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});

    if(req.method==='POST'){
      const required=['name','phone','email','type','slotId','deviceConfirmed'];
      if(required.some(k=>!String(body[k]??'').trim()))return res.status(400).json({message:'Please complete all required fields, including the laptop/MacBook confirmation.'});
      const type=String(body.type).trim();if(!['Individual','Kontraktor','Arkitek','Student'].includes(type))return res.status(400).json({message:'Invalid participant category.'});
      const pax=1;
      if(String(body.deviceConfirmed).toLowerCase()!=='true')return res.status(400).json({message:'Each participant must confirm that they will bring a laptop or MacBook.'});
      const slotStore=await read(slotsPath),slot=slotStore.items.find(x=>String(x.id)===String(body.slotId)&&x.active!==false);if(!slot)return res.status(400).json({message:'Selected class slot is no longer available.'});
      const used=s.items.filter(x=>x.slotId===slot.id&&x.status!=='Cancelled').length;if(used+pax>Number(slot.capacity))return res.status(409).json({message:'This class slot is full. Please choose another slot.'});
      const attendanceMode=String(body.mode||'').trim();if(!ATTENDANCE_MODES.includes(attendanceMode))return res.status(400).json({message:'Invalid attendance mode.'});if(!slotSupportsMode(slot.mode,attendanceMode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});
      const now=new Date().toISOString(),id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      const classFeePerPax=type==='Student'?100:400,totalFee=money(classFeePerPax*pax),bookingFee=money(50*pax),balanceDue=money(totalFee-bookingFee),paymentToken=now.replace(/\D/g,'')+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
      const item={id,status:'Pending',createdAt:now,updatedAt:now,name:String(body.name).trim(),phone:String(body.phone).trim(),email:String(body.email).trim(),type,pax:String(pax),company:String(body.company||'').trim(),occupation:String(body.occupation||'').trim(),mode:attendanceMode,slotMode:normalizeSlotMode(slot.mode),slotId:String(slot.id),slotLabel:String(slot.date)+' · '+String(slot.startTime)+'-'+String(slot.endTime)+' · '+normalizeSlotMode(slot.mode)+' · '+attendanceMode,date:String(slot.date).trim(),experience:String(body.experience||'').trim(),laptop:'Mandatory — participant will bring laptop/MacBook',deviceConfirmed:true,payment:'Booking Fee Pending',paymentStatus:'Booking Fee Pending',source:String(body.source||'').trim(),notes:String(body.notes||'').trim(),classFeePerPax,totalFee,bookingFee,bookingPaid:0,bookingPaidAt:null,bookingPaymentRef:'',bookingBillCode:'',balanceDue,balancePaid:0,balancePaidAt:null,balancePaymentRef:'',balanceBillCode:'',paymentToken};
      s.items.unshift(item);const saved=await save(registrationsPath,s.items,s.sha,'New Archicad class registration '+id);
      return res.status(201).json({ok:true,item,commitSha:saved?.commit?.sha||null});
    }
    const id=String(body.id||'').trim();
    if(!id)return res.status(400).json({message:'Registration ID is required.'});
    const index=s.items.findIndex(x=>String(x.id)===id);
    if(index<0)return res.status(404).json({message:'Registration not found.'});

    if(req.method==='PUT'){
      const item=s.items[index];
      const requestedMode=body.mode!==undefined?String(body.mode).trim():String(item.mode||'Online');if(!ATTENDANCE_MODES.includes(requestedMode))return res.status(400).json({message:'Invalid attendance mode.'});
      const selectedSlotId=body.slotId!==undefined?String(body.slotId).trim():String(item.slotId||''),slotStore=await read(slotsPath),selectedSlot=slotStore.items.find(x=>String(x.id)===selectedSlotId&&x.active!==false);if(!selectedSlot)return res.status(400).json({message:'Selected class slot is not available.'});
      if(!slotSupportsMode(selectedSlot.mode,requestedMode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});
      const nextType=body.type!==undefined?String(body.type).trim():String(item.type||'Individual'),nextPax=1;if(!['Individual','Kontraktor','Arkitek','Student'].includes(nextType))return res.status(400).json({message:'Invalid participant category.'});
      for(const k of ['name','phone','email','company','occupation','experience','source','notes'])if(body[k]!==undefined)item[k]=String(body[k]??'').trim();if(body.status!==undefined)item.status=String(body.status||item.status);
      item.type=nextType;item.pax=String(nextPax);item.mode=requestedMode;item.slotMode=normalizeSlotMode(selectedSlot.mode);item.slotId=String(selectedSlot.id);item.slotLabel=String(selectedSlot.date)+' · '+String(selectedSlot.startTime)+'-'+String(selectedSlot.endTime)+' · '+normalizeSlotMode(selectedSlot.mode)+' · '+requestedMode;item.date=String(selectedSlot.date);item.classFeePerPax=nextType==='Student'?100:400;item.totalFee=money(item.classFeePerPax*nextPax);item.bookingFee=money(50*nextPax);item.balanceDue=money(Math.max(0,item.totalFee-money(item.bookingPaid)-money(item.balancePaid)));item.paymentStatus=paymentFields(item).paymentStatus;item.payment=item.paymentStatus;item.laptop='Mandatory — participant will bring laptop/MacBook';item.deviceConfirmed=true;item.updatedAt=new Date().toISOString();
      const saved=await save(registrationsPath,s.items,s.sha,`Update Archicad class registration ${id}`);return res.status(200).json({ok:true,item,commitSha:saved?.commit?.sha||null});
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