export default async function handler(req,res){
  const ORIGIN='https://terajuciptabina-eng.github.io';
  const REPO='terajuciptabina-eng/terajuciptabina';
  const SLOTS_PATH='data/class-slots.json';
  const REG_PATH='data/class-registrations.json';
  const SLOT_MODES=['Online','Fizikal','Online dan Fizikal'];
  const ATTENDANCE_MODES=['Online','Fizikal'];

  res.setHeader('Access-Control-Allow-Origin',ORIGIN);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(204).end();

  const resource=String(req.query?.resource||'').trim().toLowerCase();
  if(!['slots','registration','payment'].includes(resource)){
    return res.status(404).json({message:'Class management resource not found.'});
  }

  const githubToken=String(process.env.GITHUB_TOKEN||'').trim();
  if(!githubToken)return res.status(500).json({message:'GitHub data source is not configured.'});

  const adminUsername=String(process.env.ADMIN_USERNAME||'admin').trim();
  const adminPassword=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'').trim();
  const suppliedUsername=String(req.headers['x-admin-username']||'').trim();
  const suppliedPassword=String(req.headers['x-admin-password']||req.headers['x-admin-key']||'').trim();
  const isAdmin=Boolean(adminPassword&&suppliedPassword===adminPassword&&(!suppliedUsername||suppliedUsername===adminUsername));

  const parseBody=()=>{
    if(req.body&&typeof req.body==='object')return req.body;
    if(typeof req.body==='string'&&req.body.trim())return JSON.parse(req.body);
    return{};
  };
  const body=parseBody();

  const money=value=>Math.round(Number(value||0)*100)/100;
  const classRate=type=>String(type||'')==='Student'?100:400;
  const normalizeSlotMode=value=>String(value||'').trim()==='Pejabat Teraju Ciptabina Resources'?'Fizikal':String(value||'').trim();
  const supportsAttendance=(slotMode,attendance)=>{
    const normalized=normalizeSlotMode(slotMode);
    return normalized===attendance||normalized==='Online dan Fizikal';
  };

  const paymentState=item=>{
    const pax=1;
    const totalFee=money(item.totalFee||classRate(item.type)*pax);
    const bookingFee=money(item.bookingFee||50);
    const bookingPaid=money(item.bookingPaid);
    const balancePaid=money(item.balancePaid);
    const balanceDue=money(Math.max(0,totalFee-bookingPaid-balancePaid));
    const paymentStatus=bookingPaid>=bookingFee
      ?(balanceDue<=0?'Fully Paid':'Booking Fee Paid')
      :'Booking Fee Pending';
    const methods=[item.bookingPaymentMethod,item.balancePaymentMethod].map(v=>String(v||'').trim()).filter(Boolean);
    const paymentMethod=methods.length===0?'':([...new Set(methods)].length===1?methods[0]:'Mixed');
    return{totalFee,bookingFee,bookingPaid,balancePaid,balanceDue,paymentStatus,paymentMethod};
  };

  const ghHeaders={
    Authorization:'Bearer '+githubToken,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  };

  async function github(path,options={}){
    const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+path,{
      ...options,
      headers:{...ghHeaders,...(options.headers||{})}
    });
    const text=await response.text();
    let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    return{response,data};
  }

  async function readArray(path){
    const result=await github(path);
    if(!result.response.ok){
      throw new Error('GitHub read failed ('+result.response.status+') for '+path+': '+(result.data?.message||'Unknown GitHub error.'));
    }
    const content=result.data?.content?Buffer.from(result.data.content,'base64').toString('utf8'):'[]';
    let parsed;
    try{parsed=JSON.parse(content)}catch(error){throw new Error('Invalid JSON in '+path+': '+error.message)}
    if(!Array.isArray(parsed))throw new Error('Invalid data structure in '+path+'.');
    return{items:parsed,sha:result.data.sha};
  }

  async function writeArray(path,items,sha,message){
    const payload={
      message,
      content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')
    };
    if(sha)payload.sha=sha;
    const result=await github(path,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    if(!result.response.ok){
      const error=new Error(result.data?.message||'GitHub write failed.');
      error.status=result.response.status;
      throw error;
    }
    return result.data;
  }

  async function updateRegistration(id,mutator,message){
    for(let attempt=0;attempt<2;attempt++){
      const store=await readArray(REG_PATH);
      const index=store.items.findIndex(item=>String(item.id)===String(id));
      if(index<0)return null;
      const changed=mutator(store.items[index]);
      if(changed===false)return store.items[index];
      try{
        await writeArray(REG_PATH,store.items,store.sha,message);
        return store.items[index];
      }catch(error){
        if(error.status===409&&attempt===0)continue;
        throw error;
      }
    }
    throw new Error('Unable to update class registration.');
  }

  async function getRegistration(id){
    const store=await readArray(REG_PATH);
    const index=store.items.findIndex(item=>String(item.id)===String(id));
    return index<0?null:store.items[index];
  }

  function adminRequired(){
    return isAdmin;
  }

  const paymentOperation=String(req.query?.operation||body.operation||'').trim().toLowerCase();

  try{
    // ---------- CLASS SLOTS ----------
    if(resource==='slots'){
      const slotStore=await readArray(SLOTS_PATH);

      if(req.method==='GET'){
        const registrations=(await readArray(REG_PATH)).items;
        const items=slotStore.items
          .filter(slot=>isAdmin||slot.active!==false)
          .sort((a,b)=>String(a.date+' '+a.startTime).localeCompare(String(b.date+' '+b.startTime)))
          .map(slot=>{
            const booked=registrations.filter(reg=>reg.slotId===slot.id&&reg.status!=='Cancelled').length;
            return{
              ...slot,
              mode:normalizeSlotMode(slot.mode),
              booked,
              remaining:Math.max(0,Number(slot.capacity||0)-booked)
            };
          })
          .filter(slot=>isAdmin||slot.remaining>0);

        return res.status(200).json({ok:true,items});
      }

      if(!adminRequired())return res.status(401).json({message:'Unauthorized.'});

      if(req.method==='POST'){
        const mode=normalizeSlotMode(body.mode);
        if(!String(body.date||'').trim()||!String(body.startTime||'').trim()||!String(body.endTime||'').trim()){
          return res.status(400).json({message:'Date, start time and end time are required.'});
        }
        if(!SLOT_MODES.includes(mode))return res.status(400).json({message:'Invalid class mode.'});

        const now=new Date().toISOString();
        const id='SLOT-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const slot={
          id,
          date:String(body.date).trim(),
          startTime:String(body.startTime).trim(),
          endTime:String(body.endTime).trim(),
          mode,
          capacity:Math.max(1,Number(body.capacity)||1),
          active:body.active!==false,
          notes:String(body.notes||'').trim(),
          createdAt:now,
          updatedAt:now
        };
        slotStore.items.push(slot);
        await writeArray(SLOTS_PATH,slotStore.items,slotStore.sha,'Add Archicad class slot '+id);
        return res.status(201).json({ok:true,item:slot});
      }

      const id=String(body.id||'').trim();
      const index=slotStore.items.findIndex(slot=>String(slot.id)===id);
      if(index<0)return res.status(404).json({message:'Class slot not found.'});

      if(req.method==='PUT'){
        if(body.mode!==undefined){
          const mode=normalizeSlotMode(body.mode);
          if(!SLOT_MODES.includes(mode))return res.status(400).json({message:'Invalid class mode.'});
          slotStore.items[index].mode=mode;
        }
        for(const field of ['date','startTime','endTime','notes']){
          if(body[field]!==undefined)slotStore.items[index][field]=String(body[field]??'').trim();
        }
        if(body.capacity!==undefined)slotStore.items[index].capacity=Math.max(1,Number(body.capacity)||1);
        if(body.active!==undefined)slotStore.items[index].active=Boolean(body.active);
        slotStore.items[index].updatedAt=new Date().toISOString();
        await writeArray(SLOTS_PATH,slotStore.items,slotStore.sha,'Update Archicad class slot '+id);
        return res.status(200).json({ok:true,item:slotStore.items[index]});
      }

      if(req.method==='DELETE'){
        slotStore.items.splice(index,1);
        await writeArray(SLOTS_PATH,slotStore.items,slotStore.sha,'Delete Archicad class slot '+id);
        return res.status(200).json({ok:true,id});
      }

      return res.status(405).json({message:'Method not allowed.'});
    }

    // ---------- REGISTRATIONS ----------
    if(resource==='registration'){
      const registrationStore=await readArray(REG_PATH);

      if(req.method==='GET'){
        if(!adminRequired())return res.status(401).json({message:'Unauthorized.'});
        const q=String(req.query?.q||'').trim().toLowerCase();
        const status=String(req.query?.status||'').trim().toLowerCase();
        const type=String(req.query?.type||'').trim().toLowerCase();
        const mode=String(req.query?.mode||'').trim().toLowerCase();
        const paymentStatus=String(req.query?.paymentStatus||'').trim().toLowerCase();

        const items=registrationStore.items
          .filter(item=>
            (!q||JSON.stringify(item).toLowerCase().includes(q))&&
            (!status||String(item.status||'').toLowerCase()===status)&&
            (!type||String(item.type||'').toLowerCase()===type)&&
            (!mode||String(item.mode||'').toLowerCase()===mode)&&
            (!paymentStatus||paymentState(item).paymentStatus.toLowerCase()===paymentStatus)
          )
          .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
          .map(item=>({...item,...paymentState(item),pax:'1'}));

        return res.status(200).json({ok:true,items});
      }

      if(req.method==='POST'){
        const required=['name','phone','email','type','slotId','deviceConfirmed'];
        if(required.some(field=>!String(body[field]??'').trim())){
          return res.status(400).json({message:'Please complete all required fields, including the laptop/MacBook confirmation.'});
        }

        const type=String(body.type).trim();
        if(!['Individual','Kontraktor','Arkitek','Student'].includes(type)){
          return res.status(400).json({message:'Invalid participant category.'});
        }
        if(String(body.deviceConfirmed).toLowerCase()!=='true'){
          return res.status(400).json({message:'Each participant must confirm that they will bring a laptop or MacBook.'});
        }

        const slotStore=await readArray(SLOTS_PATH);
        const slot=slotStore.items.find(item=>String(item.id)===String(body.slotId)&&item.active!==false);
        if(!slot)return res.status(400).json({message:'Selected class slot is no longer available.'});

        const attendance=String(body.mode||'').trim();
        if(!ATTENDANCE_MODES.includes(attendance))return res.status(400).json({message:'Invalid attendance mode.'});
        if(!supportsAttendance(slot.mode,attendance))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});

        const booked=registrationStore.items.filter(item=>item.slotId===slot.id&&item.status!=='Cancelled').length;
        if(booked>=Number(slot.capacity||0))return res.status(409).json({message:'This class slot is full. Please choose another slot.'});

        const now=new Date().toISOString();
        const id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const totalFee=money(classRate(type));
        const bookingFee=50;

        const item={
          id,
          status:'Pending',
          createdAt:now,
          updatedAt:now,
          name:String(body.name).trim(),
          phone:String(body.phone).trim(),
          email:String(body.email).trim(),
          type,
          pax:'1',
          company:String(body.company||'').trim(),
          occupation:String(body.occupation||'').trim(),
          mode:attendance,
          slotMode:normalizeSlotMode(slot.mode),
          slotId:String(slot.id),
          slotLabel:String(slot.date)+' · '+String(slot.startTime)+'-'+String(slot.endTime)+' · '+normalizeSlotMode(slot.mode)+' · '+attendance,
          date:String(slot.date),
          experience:String(body.experience||'').trim(),
          laptop:'Mandatory — participant will bring laptop/MacBook',
          deviceConfirmed:true,
          source:String(body.source||'').trim(),
          notes:String(body.notes||'').trim(),
          classFeePerPax:totalFee,
          totalFee,
          bookingFee,
          bookingPaid:0,
          bookingPaidAt:null,
          bookingPaymentMethod:'',
          bookingPaymentRef:'',
          bookingBillCode:'',
          balanceDue:money(totalFee-bookingFee),
          balancePaid:0,
          balancePaidAt:null,
          balancePaymentMethod:'',
          balancePaymentRef:'',
          balanceBillCode:'',
          payment:'',
          paymentStatus:'Booking Fee Pending',
          paymentMethod:'',
          paymentToken:now.replace(/\D/g,'')+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)
        };

        registrationStore.items.unshift(item);
        await writeArray(REG_PATH,registrationStore.items,registrationStore.sha,'New Archicad class registration '+id);
        return res.status(201).json({ok:true,item});
      }

      if(!adminRequired())return res.status(401).json({message:'Unauthorized.'});

      const id=String(body.id||'').trim();
      const index=registrationStore.items.findIndex(item=>String(item.id)===id);
      if(index<0)return res.status(404).json({message:'Registration not found.'});

      if(req.method==='PUT'){
        const item=registrationStore.items[index];
        const currentPayment=paymentState(item);
        const requestedType=body.type!==undefined?String(body.type).trim():String(item.type||'');
        const requestedMode=body.mode!==undefined?String(body.mode).trim():String(item.mode||'');
        const requestedSlotId=body.slotId!==undefined?String(body.slotId).trim():String(item.slotId||'');

        if(!['Individual','Kontraktor','Arkitek','Student'].includes(requestedType)){
          return res.status(400).json({message:'Invalid participant category.'});
        }
        if(!ATTENDANCE_MODES.includes(requestedMode)){
          return res.status(400).json({message:'Invalid attendance mode.'});
        }

        const slotStore=await readArray(SLOTS_PATH);
        const slot=slotStore.items.find(item=>String(item.id)===requestedSlotId&&item.active!==false);
        if(!slot)return res.status(400).json({message:'Selected class slot is not available.'});
        if(!supportsAttendance(slot.mode,requestedMode)){
          return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});
        }

        const hasPaid=currentPayment.bookingPaid>0||currentPayment.balancePaid>0;
        if(hasPaid&&(requestedType!==String(item.type||'')||requestedMode!==String(item.mode||'')||requestedSlotId!==String(item.slotId||''))){
          return res.status(409).json({message:'Category, slot or attendance mode cannot be changed after payment has been recorded.'});
        }
        if(String(body.status||'')==='Paid'){
          return res.status(409).json({message:'Paid status is controlled by payment verification.'});
        }

        for(const field of ['name','phone','email','company','occupation','experience','source','notes']){
          if(body[field]!==undefined)item[field]=String(body[field]??'').trim();
        }

        item.status=body.status!==undefined?String(body.status||item.status):item.status;
        item.type=requestedType;
        item.pax='1';
        item.mode=requestedMode;
        item.slotMode=normalizeSlotMode(slot.mode);
        item.slotId=requestedSlotId;
        item.slotLabel=String(slot.date)+' · '+String(slot.startTime)+'-'+String(slot.endTime)+' · '+normalizeSlotMode(slot.mode)+' · '+requestedMode;
        item.date=String(slot.date);
        item.classFeePerPax=money(classRate(requestedType));
        item.totalFee=item.classFeePerPax;
        item.bookingFee=50;
        item.balanceDue=money(Math.max(0,item.totalFee-currentPayment.bookingPaid-currentPayment.balancePaid));
        const nextPayment=paymentState(item);
        item.paymentStatus=nextPayment.paymentStatus;
        item.payment=nextPayment.paymentStatus;
        item.paymentMethod=nextPayment.paymentMethod;
        item.updatedAt=new Date().toISOString();

        await writeArray(REG_PATH,registrationStore.items,registrationStore.sha,'Update Archicad class registration '+id);
        return res.status(200).json({ok:true,item});
      }

      if(req.method==='DELETE'){
        registrationStore.items.splice(index,1);
        await writeArray(REG_PATH,registrationStore.items,registrationStore.sha,'Delete Archicad class registration '+id);
        return res.status(200).json({ok:true,id});
      }

      return res.status(405).json({message:'Method not allowed.'});
    }

    // ---------- PAYMENTS ----------
    if(resource==='payment'){
      const operation=paymentOperation;
      if(!['create','verify','callback','cash'].includes(operation)){
        return res.status(404).json({message:'Class payment operation not found.'});
      }

      const paymentSuccess=value=>['1','success','successful','paid'].includes(String(value??'').trim().toLowerCase());
      const amountMatches=(actual,expected)=>{
        const n=Number(actual);
        return Number.isFinite(n)&&(Math.round(n)===Math.round(Number(expected)*100)||Math.abs(n-Number(expected))<0.0001);
      };

      const getPaymentRegistration=async()=>{
        const id=String(body.registrationId||'').trim();
        if(!id)throw new Error('Registration ID is required.');
        const item=await getRegistration(id);
        if(!item)throw new Error('Registration not found.');
        return item;
      };

      const createBill=async(item,type,amount)=>{
        const secret=String(process.env.TOYYIBPAY_SECRET_KEY||'').trim();
        const category=String(process.env.TOYYIBPAY_CATEGORY_CODE||'').trim();
        if(!secret||!category)throw new Error('ToyyibPay payment configuration is incomplete.');

        const returnUrl='https://terajuciptabina-eng.github.io/terajuciptabina/kelas-archicad/register.html?payment=return&paymentType='+encodeURIComponent(type)+'&registration='+encodeURIComponent(item.id)+'&token='+encodeURIComponent(item.paymentToken);
        const callbackBase=String(process.env.PUBLIC_BASE_URL||'https://terajuciptabina.vercel.app').replace(/\/$/,'');
        const form=new URLSearchParams();
        form.append('userSecretKey',secret);
        form.append('categoryCode',category);
        form.append('billName',type==='booking'?'Archicad Booking Fee':'Archicad Balance Payment');
        form.append('billDescription',type==='booking'?'Archicad booking fee':'Archicad class balance');
        form.append('billPriceSetting','1');
        form.append('billPayorInfo','1');
        form.append('billAmount',String(Math.round(Number(amount)*100)));
        form.append('billReturnUrl',returnUrl);
        form.append('billCallbackUrl',callbackBase+'/api/class-payment-callback');
        form.append('billExternalReferenceNo',item.id+'-'+type);
        form.append('billTo',String(item.name||'Participant'));
        form.append('billEmail',String(item.email||''));
        form.append('billPhone',String(item.phone||''));
        form.append('billContentEmail','0');
        form.append('billChargeToCustomer','0');
        form.append('billExpiryDays','1');

        const response=await fetch('https://toyyibpay.com/index.php/api/createBill',{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:form.toString()
        });
        const data=await response.json();
        if(!Array.isArray(data)||!data[0]?.BillCode){
          throw new Error(data?.msg||'Unable to create ToyyibPay payment.');
        }
        const billCode=String(data[0].BillCode);
        return{billCode,paymentUrl:'https://toyyibpay.com/'+billCode};
      };

      if(operation==='cash'){
        if(req.method!=='POST'||!adminRequired()){
          return res.status(401).json({message:'Admin authorization required for cash payment.'});
        }

        const item=await getPaymentRegistration();
        const payment=paymentState(item);
        const type=String(body.paymentType||'').trim().toLowerCase();
        if(!['booking','balance','full'].includes(type)){
          return res.status(400).json({message:'Registration and cash payment type are required.'});
        }

        const bookingOutstanding=money(Math.max(0,payment.bookingFee-payment.bookingPaid));
        const balanceOutstanding=money(payment.balanceDue);
        if(bookingOutstanding<=0&&balanceOutstanding<=0){
          return res.status(409).json({message:'This registration is already fully paid.'});
        }

        let bookingCash=0,balanceCash=0;
        if(type==='booking'){
          if(bookingOutstanding<=0)return res.status(409).json({message:'Booking fee is already paid.'});
          bookingCash=bookingOutstanding;
        }else if(type==='balance'){
          if(bookingOutstanding>0)return res.status(409).json({message:'Booking fee must be paid before balance payment.'});
          if(balanceOutstanding<=0)return res.status(409).json({message:'Balance is already paid.'});
          balanceCash=balanceOutstanding;
        }else{
          bookingCash=bookingOutstanding;
          balanceCash=balanceOutstanding;
        }

        const now=new Date().toISOString();
        const recordedBy=String(suppliedUsername||adminUsername||'admin').trim();
        const reference=String(body.reference||'').trim();
        const note=String(body.note||'').trim();

        const updated=await updateRegistration(item.id,record=>{
          record.cashPayments=Array.isArray(record.cashPayments)?record.cashPayments:[];

          if(bookingCash>0){
            record.bookingPaid=money(Number(record.bookingPaid||0)+bookingCash);
            record.bookingPaidAt=now;
            record.bookingPaymentMethod='Cash';
            record.bookingPaymentRef=reference;
            record.cashPayments.push({component:'Booking Fee',amount:bookingCash,recordedAt:now,recordedBy,reference,note});
          }

          if(balanceCash>0){
            record.balancePaid=money(Number(record.balancePaid||0)+balanceCash);
            record.balancePaidAt=now;
            record.balancePaymentMethod='Cash';
            record.balancePaymentRef=reference;
            record.cashPayments.push({component:'Balance',amount:balanceCash,recordedAt:now,recordedBy,reference,note});
          }

          const state=paymentState(record);
          record.balanceDue=state.balanceDue;
          record.paymentStatus=state.paymentStatus;
          record.payment=state.paymentStatus;
          record.paymentMethod=state.paymentMethod;
          record.paymentLastRecordedAt=now;
          record.paymentLastRecordedBy=recordedBy;
          record.status=state.paymentStatus==='Fully Paid'?'Paid':(state.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          record.updatedAt=now;
        },'Record Archicad cash payment '+item.id);

        if(!updated)return res.status(409).json({message:'Cash payment could not be recorded.'});
        const final=paymentState(updated);
        return res.status(200).json({
          ok:true,
          registrationId:updated.id,
          paymentMethod:final.paymentMethod||'Cash',
          paymentStatus:final.paymentStatus,
          bookingPaid:final.bookingPaid,
          balancePaid:final.balancePaid,
          balanceDue:final.balanceDue,
          cashAmount:money(bookingCash+balanceCash),
          reference
        });
      }

      if(operation==='callback'){
        if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});

        const secret=String(process.env.TOYYIBPAY_SECRET_KEY||'').trim();
        if(!secret)return res.status(500).json({message:'ToyyibPay payment configuration is incomplete.'});

        const crypto=await import('crypto');
        const signature=crypto.createHash('md5')
          .update(secret+String(body.status||'')+String(body.order_id||'')+String(body.refno||'')+'ok')
          .digest('hex');

        if(String(body.hash||'').toLowerCase()!==signature.toLowerCase()){
          return res.status(400).json({message:'Invalid callback signature.'});
        }
        if(!paymentSuccess(body.status))return res.status(200).json({success:true,ignored:true});

        const match=String(body.order_id||'').match(/^(ARC-\d{14}-[A-Z0-9]{4})-(booking|balance)$/i);
        if(!match)return res.status(400).json({message:'Invalid payment reference.'});

        const id=match[1];
        const type=String(match[2]).toLowerCase();
        const item=await getRegistration(id);
        if(!item)return res.status(404).json({message:'Registration not found.'});

        const payment=paymentState(item);
        const expected=type==='booking'?money(Math.max(0,payment.bookingFee-payment.bookingPaid)):money(payment.balanceDue);
        if(expected<=0)return res.status(200).json({success:true,alreadyPaid:true});
        if(!amountMatches(body.amount,expected))return res.status(400).json({message:'Payment amount does not match the expected amount.'});

        const billField=type==='booking'?'bookingBillCode':'balanceBillCode';
        if(item[billField]&&item[billField]!==String(body.billcode||'')){
          return res.status(400).json({message:'Payment bill does not match the registration.'});
        }

        const reference=String(body.refno||'');
        await updateRegistration(id,record=>{
          if(type==='booking'){
            record.bookingPaid=expected;
            record.bookingPaidAt=new Date().toISOString();
            record.bookingPaymentMethod='ToyyibPay';
            record.bookingPaymentRef=reference;
            record.bookingBillCode=String(body.billcode||record.bookingBillCode||'');
          }else{
            record.balancePaid=money(Number(record.balancePaid||0)+expected);
            record.balancePaidAt=new Date().toISOString();
            record.balancePaymentMethod='ToyyibPay';
            record.balancePaymentRef=reference;
            record.balanceBillCode=String(body.billcode||record.balanceBillCode||'');
          }
          const state=paymentState(record);
          record.balanceDue=state.balanceDue;
          record.paymentStatus=state.paymentStatus;
          record.payment=state.paymentStatus;
          record.paymentMethod=state.paymentMethod;
          record.status=state.paymentStatus==='Fully Paid'?'Paid':(state.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          record.updatedAt=new Date().toISOString();
        },'ToyyibPay callback for Archicad '+id);

        return res.status(200).json({success:true});
      }

      if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});

      const item=await getPaymentRegistration();
      if(!item.paymentToken||(!isAdmin&&String(item.paymentToken)!==String(body.token||''))){
        return res.status(401).json({message:'Invalid payment access token.'});
      }

      const payment=paymentState(item);
      const type=String(body.paymentType||'').trim().toLowerCase();
      if(!['booking','balance'].includes(type)){
        return res.status(400).json({message:'Registration and payment type are required.'});
      }

      if(operation==='create'){
        if(type==='balance'&&payment.bookingPaid<payment.bookingFee){
          return res.status(409).json({message:'Booking fee must be paid before balance payment.'});
        }

        const amount=type==='booking'
          ?money(Math.max(0,payment.bookingFee-payment.bookingPaid))
          :money(payment.balanceDue);

        if(amount<=0){
          return res.status(200).json({
            success:true,
            alreadyPaid:true,
            registrationId:item.id,
            paymentType:type,
            paymentStatus:payment.paymentStatus,
            balanceDue:payment.balanceDue,
            bookingPaid:payment.bookingPaid,
            balancePaid:payment.balancePaid
          });
        }

        const billField=type==='booking'?'bookingBillCode':'balanceBillCode';
        if(item[billField]){
          return res.status(200).json({
            success:true,
            registrationId:item.id,
            paymentType:type,
            billCode:item[billField],
            paymentUrl:'https://toyyibpay.com/'+item[billField],
            amount,
            paymentStatus:payment.paymentStatus,
            balanceDue:payment.balanceDue
          });
        }

        const bill=await createBill(item,type,amount);
        await updateRegistration(item.id,record=>{
          record[billField]=bill.billCode;
          record.updatedAt=new Date().toISOString();
        },'Create Archicad '+type+' payment bill '+item.id);

        return res.status(200).json({
          success:true,
          registrationId:item.id,
          paymentType:type,
          billCode:bill.billCode,
          paymentUrl:bill.paymentUrl,
          amount,
          paymentStatus:payment.paymentStatus,
          balanceDue:payment.balanceDue
        });
      }

      if(operation==='verify'){
        const billCode=String(body.billCode||'').trim();
        if(!billCode)return res.status(400).json({paid:false,message:'Bill code is required.'});

        const billField=type==='booking'?'bookingBillCode':'balanceBillCode';
        if(item[billField]&&item[billField]!==billCode){
          return res.status(400).json({paid:false,message:'Payment bill does not match the registration.'});
        }

        const secret=String(process.env.TOYYIBPAY_SECRET_KEY||'').trim();
        if(!secret)return res.status(500).json({message:'ToyyibPay payment configuration is incomplete.'});

        const form=new URLSearchParams();
        form.append('billCode',billCode);
        form.append('userSecretKey',secret);

        const response=await fetch('https://toyyibpay.com/index.php/api/getBillTransactions',{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:form.toString()
        });
        const transactions=await response.json();
        if(!Array.isArray(transactions)){
          return res.status(200).json({paid:false,registrationId:item.id,paymentType:type,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue,message:'Payment has not been verified.'});
        }

        const expected=type==='booking'?money(Math.max(0,payment.bookingFee-payment.bookingPaid)):money(payment.balanceDue);
        const transaction=transactions.find(tx=>
          paymentSuccess(tx.billpaymentStatus??tx.status??tx.status_id??'')&&
          amountMatches(tx.billpaymentAmount??tx.amount??0,expected)
        );
        if(!transaction){
          return res.status(200).json({paid:false,registrationId:item.id,paymentType:type,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue,message:'Payment has not been verified.'});
        }

        const reference=String(transaction.billpaymentInvoiceNo??transaction.refno??transaction.transaction_id??'');
        const updated=await updateRegistration(item.id,record=>{
          if(type==='booking'){
            record.bookingPaid=expected;
            record.bookingPaidAt=new Date().toISOString();
            record.bookingPaymentMethod='ToyyibPay';
            record.bookingPaymentRef=reference;
            record.bookingBillCode=billCode;
          }else{
            record.balancePaid=money(Number(record.balancePaid||0)+expected);
            record.balancePaidAt=new Date().toISOString();
            record.balancePaymentMethod='ToyyibPay';
            record.balancePaymentRef=reference;
            record.balanceBillCode=billCode;
          }
          const state=paymentState(record);
          record.balanceDue=state.balanceDue;
          record.paymentStatus=state.paymentStatus;
          record.payment=state.paymentStatus;
          record.paymentMethod=state.paymentMethod;
          record.status=state.paymentStatus==='Fully Paid'?'Paid':(state.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          record.updatedAt=new Date().toISOString();
        },'Verify Archicad '+type+' payment '+item.id);

        const final=paymentState(updated);
        return res.status(200).json({
          paid:true,
          registrationId:item.id,
          paymentType:type,
          billCode,
          paymentStatus:final.paymentStatus,
          balanceDue:final.balanceDue,
          bookingPaid:final.bookingPaid,
          balancePaid:final.balancePaid
        });
      }

      return res.status(404).json({message:'Unknown class payment operation.'});
    }

    return res.status(404).json({message:'Class management resource not found.'});
  }catch(error){
    console.error('class-management error',error);
    return res.status(error.status&&Number.isInteger(error.status)?error.status:500).json({
      message:error.message||'Unable to process class management request.'
    });
  }
}