export default async function handler(req,res){
  const origin='https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Admin-Key,X-Admin-Username,X-Admin-Password');
  if(req.method==='OPTIONS')return res.status(200).end();

  const resource=String(req.query?.resource||'').trim().toLowerCase();
  if(!['slots','registration','payment'].includes(resource))return res.status(404).json({message:'Class management resource not found.'});

  const repo='terajuciptabina-eng/terajuciptabina';
  const token=String(process.env.GITHUB_TOKEN||'').trim();
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
  const classRate=type=>String(type||'')==='Student'?100:400;
  const normalizeSlotMode=value=>String(value||'').trim()==='Pejabat Teraju Ciptabina Resources'?'Fizikal':String(value||'').trim();
  const slotSupportsMode=(slotMode,attendance)=>{
    const mode=normalizeSlotMode(slotMode);
    return mode===attendance||mode==='Online dan Fizikal';
  };
  const money=value=>Math.round(Number(value||0)*100)/100;

  function paymentFields(item){
    const pax=Math.max(1,parseInt(item.pax,10)||1);
    const totalFee=money(item.totalFee||classRate(item.type)*pax);
    const bookingFee=money(item.bookingFee||50*pax);
    const bookingPaid=money(item.bookingPaid);
    const balancePaid=money(item.balancePaid);
    const balanceDue=money(Math.max(0,totalFee-bookingPaid-balancePaid));
    const paymentStatus=String(item.paymentStatus||(
      bookingPaid>=bookingFee
        ? (balanceDue<=0?'Fully Paid':'Booking Fee Paid')
        : 'Booking Fee Pending'
    ));
    const paymentMethods=[String(item.bookingPaymentMethod||'').trim(),String(item.balancePaymentMethod||'').trim()].filter(Boolean);
    const paymentMethod=item.paymentMethod||(
      paymentMethods.length===0?''
      : [...new Set(paymentMethods)].length===1?paymentMethods[0]:'Mixed'
    );
    return{totalFee,bookingFee,bookingPaid,balancePaid,balanceDue,paymentStatus,paymentMethod};
  }

  const ghHeaders={
    Authorization:'Bearer '+token,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  };

  async function github(path,options={}){
    const response=await fetch('https://api.github.com/repos/'+repo+'/contents/'+path,{
      ...options,
      headers:{...ghHeaders,...(options.headers||{})}
    });
    const text=await response.text();
    let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    return{response,data};
  }

  async function read(path){
    const result=await github(path);
    if(!result.response.ok){
      throw new Error('GitHub data read failed ('+result.response.status+') for '+path+': '+(result.data?.message||'Unknown GitHub error.'));
    }
    const content=result.data?.content?Buffer.from(result.data.content,'base64').toString('utf8'):'[]';
    let parsed;
    try{parsed=JSON.parse(content)}catch(error){throw new Error('Invalid JSON in '+path+': '+error.message)}
    if(!Array.isArray(parsed))throw new Error('Invalid data structure in '+path+'.');
    return{items:parsed,sha:result.data.sha};
  }

  async function save(path,items,sha,message){
    const body={
      message,
      content:Buffer.from(JSON.stringify(items,null,2)+'\n','utf8').toString('base64')
    };
    if(sha)body.sha=sha;
    const result=await github(path,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    if(!result.response.ok){
      const error=new Error(result.data?.message||'Unable to save class data.');
      error.status=result.response.status;
      throw error;
    }
    return result.data;
  }

  async function updateRegistration(id,mutator,message){
    for(let attempt=0;attempt<2;attempt++){
      const store=await read(registrationsPath);
      const index=store.items.findIndex(item=>String(item.id)===String(id));
      if(index<0)return null;
      if(mutator(store.items[index])===false)return store.items[index];
      try{
        await save(registrationsPath,store.items,store.sha,message);
        return store.items[index];
      }catch(error){
        if(error.status===409&&attempt===0)continue;
        throw error;
      }
    }
    throw new Error('Unable to update class registration.');
  }

  async function getRegistration(id){
    const store=await read(registrationsPath);
    const index=store.items.findIndex(item=>String(item.id)===String(id));
    return index<0?null:store.items[index];
  }

  function bodyData(){
    return typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  }

  try{
    if(resource==='slots'){
      const store=await read(slotsPath);

      if(req.method==='GET'){
        const registrations=(await read(registrationsPath)).items;
        const items=store.items
          .filter(item=>isAdmin||item.active!==false)
          .sort((a,b)=>String(a.date+' '+a.startTime).localeCompare(String(b.date+' '+b.startTime)))
          .map(item=>{
            const booked=registrations.filter(reg=>reg.slotId===item.id&&reg.status!=='Cancelled').length;
            return{
              ...item,
              mode:normalizeSlotMode(item.mode),
              booked,
              remaining:Math.max(0,Number(item.capacity)-booked)
            };
          })
          .filter(item=>isAdmin||item.remaining>0);
        return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
      }

      if(!isAdmin)return res.status(401).json({message:'Unauthorized.'});
      const body=bodyData();

      if(req.method==='POST'){
        const mode=normalizeSlotMode(body.mode);
        if(!String(body.date||'').trim()||!String(body.startTime||'').trim()||!String(body.endTime||'').trim()||!String(body.capacity||'').trim()||!SLOT_MODES.includes(mode)){
          return res.status(400).json({message:'Date, time, mode and capacity are required.'});
        }
        const now=new Date().toISOString();
        const id='SLOT-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const item={
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
        store.items.push(item);
        await save(slotsPath,store.items,store.sha,'Add Archicad class slot '+id);
        return res.status(201).json({ok:true,item});
      }

      const id=String(body.id||'').trim();
      const index=store.items.findIndex(item=>String(item.id)===id);
      if(index<0)return res.status(404).json({message:'Class slot not found.'});

      if(req.method==='PUT'){
        if(body.mode!==undefined){
          const mode=normalizeSlotMode(body.mode);
          if(!SLOT_MODES.includes(mode))return res.status(400).json({message:'Invalid class mode.'});
          store.items[index].mode=mode;
        }
        for(const key of ['date','startTime','endTime','notes']){
          if(body[key]!==undefined)store.items[index][key]=String(body[key]??'').trim();
        }
        if(body.capacity!==undefined)store.items[index].capacity=Math.max(1,Number(body.capacity)||1);
        if(body.active!==undefined)store.items[index].active=Boolean(body.active);
        store.items[index].updatedAt=new Date().toISOString();
        await save(slotsPath,store.items,store.sha,'Update Archicad class slot '+id);
        return res.status(200).json({ok:true,item:store.items[index]});
      }

      if(req.method==='DELETE'){
        store.items.splice(index,1);
        await save(slotsPath,store.items,store.sha,'Delete Archicad class slot '+id);
        return res.status(200).json({ok:true,id});
      }

      return res.status(405).json({message:'Method not allowed.'});
    }

    if(resource==='registration'){
      const store=await read(registrationsPath);

      if(req.method==='GET'){
        if(!isAdmin)return res.status(401).json({message:'Unauthorized.'});
        const q=String(req.query?.q||'').trim().toLowerCase();
        const status=String(req.query?.status||'').trim().toLowerCase();
        const type=String(req.query?.type||'').trim().toLowerCase();
        const mode=String(req.query?.mode||'').trim().toLowerCase();
        const paymentStatus=String(req.query?.paymentStatus||'').trim().toLowerCase();

        const items=store.items
          .filter(item=>
            (!q||JSON.stringify(item).toLowerCase().includes(q))&&
            (!status||String(item.status||'').toLowerCase()===status)&&
            (!type||String(item.type||'').toLowerCase()===type)&&
            (!mode||String(item.mode||'').toLowerCase()===mode)&&
            (!paymentStatus||paymentFields(item).paymentStatus.toLowerCase()===paymentStatus)
          )
          .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
          .map(item=>({...item,...paymentFields(item),pax:'1'}));

        return res.status(200).json({ok:true,items,generatedAt:new Date().toISOString()});
      }

      if(req.method==='POST'){
        const body=bodyData();
        const required=['name','phone','email','type','slotId','deviceConfirmed'];
        if(required.some(key=>!String(body[key]??'').trim())){
          return res.status(400).json({message:'Please complete all required fields, including the laptop/MacBook confirmation.'});
        }

        const type=String(body.type).trim();
        if(!['Individual','Kontraktor','Arkitek','Student'].includes(type)){
          return res.status(400).json({message:'Invalid participant category.'});
        }
        if(String(body.deviceConfirmed).toLowerCase()!=='true'){
          return res.status(400).json({message:'Each participant must confirm that they will bring a laptop or MacBook.'});
        }

        const slotStore=await read(slotsPath);
        const slot=slotStore.items.find(item=>String(item.id)===String(body.slotId)&&item.active!==false);
        if(!slot)return res.status(400).json({message:'Selected class slot is no longer available.'});

        const mode=String(body.mode||'').trim();
        if(!ATTENDANCE_MODES.includes(mode))return res.status(400).json({message:'Invalid attendance mode.'});
        if(!slotSupportsMode(slot.mode,mode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});

        const booked=store.items.filter(item=>item.slotId===slot.id&&item.status!=='Cancelled').length;
        if(booked+1>Number(slot.capacity))return res.status(409).json({message:'This class slot is full. Please choose another slot.'});

        const now=new Date().toISOString();
        const id='ARC-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const paymentToken=now.replace(/\D/g,'')+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
        const classFee=money(classRate(type));
        const bookingFee=money(50);

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
          mode,
          slotMode:normalizeSlotMode(slot.mode),
          slotId:String(slot.id),
          slotLabel:String(slot.date)+' · '+String(slot.startTime)+'-'+String(slot.endTime)+' · '+normalizeSlotMode(slot.mode)+' · '+mode,
          date:String(slot.date).trim(),
          experience:String(body.experience||'').trim(),
          laptop:'Mandatory — participant will bring laptop/MacBook',
          deviceConfirmed:true,
          payment:'Booking Fee Pending',
          paymentStatus:'Booking Fee Pending',
          paymentMethod:'',
          source:String(body.source||'').trim(),
          notes:String(body.notes||'').trim(),
          classFeePerPax:classFee,
          totalFee:classFee,
          bookingFee,
          bookingPaid:0,
          bookingPaidAt:null,
          bookingPaymentMethod:'',
          bookingPaymentRef:'',
          bookingBillCode:'',
          balanceDue:money(classFee-bookingFee),
          balancePaid:0,
          balancePaidAt:null,
          balancePaymentMethod:'',
          balancePaymentRef:'',
          balanceBillCode:'',
          paymentToken
        };

        store.items.unshift(item);
        await save(registrationsPath,store.items,store.sha,'New Archicad class registration '+id);
        return res.status(201).json({ok:true,item});
      }

      if(!isAdmin)return res.status(401).json({message:'Unauthorized.'});
      const body=bodyData();
      const id=String(body.id||'').trim();
      const index=store.items.findIndex(item=>String(item.id)===id);
      if(index<0)return res.status(404).json({message:'Registration not found.'});

      if(req.method==='PUT'){
        const item=store.items[index];
        const requestedMode=body.mode!==undefined?String(body.mode).trim():String(item.mode||'');
        const requestedSlotId=body.slotId!==undefined?String(body.slotId).trim():String(item.slotId||'');
        const requestedType=body.type!==undefined?String(body.type).trim():String(item.type||'');
        if(!ATTENDANCE_MODES.includes(requestedMode))return res.status(400).json({message:'Invalid attendance mode.'});
        if(!['Individual','Kontraktor','Arkitek','Student'].includes(requestedType))return res.status(400).json({message:'Invalid participant category.'});

        const slotStore=await read(slotsPath);
        const slot=slotStore.items.find(slotItem=>String(slotItem.id)===requestedSlotId&&slotItem.active!==false);
        if(!slot)return res.status(400).json({message:'Selected class slot is not available.'});
        if(!slotSupportsMode(slot.mode,requestedMode))return res.status(400).json({message:'Selected class slot does not support this attendance mode.'});

        const payment=paymentFields(item);
        const hasPaid=payment.bookingPaid>0||payment.balancePaid>0;
        if(hasPaid&&(requestedType!==String(item.type||'')||requestedSlotId!==String(item.slotId||'')||requestedMode!==String(item.mode||''))){
          return res.status(409).json({message:'Category, slot or attendance mode cannot be changed after payment has been recorded.'});
        }
        if(body.status==='Paid')return res.status(409).json({message:'Paid status is controlled by payment verification.'});

        for(const key of ['name','phone','email','company','occupation','experience','source','notes']){
          if(body[key]!==undefined)item[key]=String(body[key]??'').trim();
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
        item.balanceDue=money(Math.max(0,item.totalFee-payment.bookingPaid-payment.balancePaid));
        item.paymentStatus=paymentFields(item).paymentStatus;
        item.payment=item.paymentStatus;
        item.updatedAt=new Date().toISOString();

        await save(registrationsPath,store.items,store.sha,'Update Archicad class registration '+id);
        return res.status(200).json({ok:true,item});
      }

      if(req.method==='DELETE'){
        store.items.splice(index,1);
        await save(registrationsPath,store.items,store.sha,'Delete Archicad class registration '+id);
        return res.status(200).json({ok:true,id});
      }

      return res.status(405).json({message:'Method not allowed.'});
    }

    if(resource==='payment'){
      const operation=String(req.query?.operation||'').trim().toLowerCase();
      if(!['create','verify','callback','cash'].includes(operation)){
        return res.status(404).json({message:'Class payment operation not found.'});
      }

      const paymentSuccess=value=>['1','success','successful','paid'].includes(String(value??'').trim().toLowerCase());
      const amountMatches=(actual,expected)=>{
        const n=Number(actual);
        return Number.isFinite(n)&&(Math.round(n)===Math.round(Number(expected)*100)||Math.abs(n-Number(expected))<0.0001);
      };

      async function createToyyibBill(item,type,amount){
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
        if(!Array.isArray(data)||!data[0]?.BillCode)throw new Error(data?.msg||'Unable to create ToyyibPay payment.');
        const billCode=String(data[0].BillCode);
        return{billCode,paymentUrl:'https://toyyibpay.com/'+billCode};
      }

      if(operation==='cash'){
        if(req.method!=='POST'||!isAdmin)return res.status(401).json({message:'Admin authorization required for cash payment.'});
        const body=bodyData();
        const id=String(body.registrationId||'').trim();
        const type=String(body.paymentType||'').trim().toLowerCase();
        if(!id||!['booking','balance','full'].includes(type))return res.status(400).json({message:'Registration and cash payment type are required.'});

        const item=await getRegistration(id);
        if(!item)return res.status(404).json({message:'Registration not found.'});
        const payment=paymentFields(item);
        const bookingOutstanding=money(Math.max(0,payment.bookingFee-payment.bookingPaid));
        const balanceOutstanding=money(payment.balanceDue);
        if(bookingOutstanding<=0&&balanceOutstanding<=0)return res.status(409).json({message:'This registration is already fully paid.'});

        let bookingCash=0,balanceCash=0;
        if(type==='booking'){
          if(bookingOutstanding<=0)return res.status(409).json({message:'Booking fee is already paid.'});
          bookingCash=bookingOutstanding;
        }else if(type==='balance'){
          if(bookingOutstanding>0)return res.status(409).json({message:'Booking fee must be paid before balance payment.'});
          balanceCash=balanceOutstanding;
        }else{
          bookingCash=bookingOutstanding;
          balanceCash=balanceOutstanding;
        }

        const now=new Date().toISOString();
        const recordedBy=String(suppliedUser||adminUser||'admin').trim();
        const reference=String(body.reference||'').trim();
        const note=String(body.note||'').trim();

        const updated=await updateRegistration(id,itemRecord=>{
          itemRecord.cashPayments=Array.isArray(itemRecord.cashPayments)?itemRecord.cashPayments:[];
          if(bookingCash>0){
            itemRecord.bookingPaid=money(Number(itemRecord.bookingPaid||0)+bookingCash);
            itemRecord.bookingPaidAt=now;
            itemRecord.bookingPaymentMethod='Cash';
            itemRecord.bookingPaymentRef=reference;
            itemRecord.cashPayments.push({component:'Booking Fee',amount:bookingCash,recordedAt:now,recordedBy,reference,note});
          }
          if(balanceCash>0){
            itemRecord.balancePaid=money(Number(itemRecord.balancePaid||0)+balanceCash);
            itemRecord.balancePaidAt=now;
            itemRecord.balancePaymentMethod='Cash';
            itemRecord.balancePaymentRef=reference;
            itemRecord.cashPayments.push({component:'Balance',amount:balanceCash,recordedAt:now,recordedBy,reference,note});
          }
          const q=paymentFields(itemRecord);
          itemRecord.balanceDue=q.balanceDue;
          itemRecord.paymentStatus=q.paymentStatus;
          itemRecord.payment=q.paymentStatus;
          itemRecord.paymentMethod=q.paymentMethod;
          itemRecord.paymentLastRecordedAt=now;
          itemRecord.paymentLastRecordedBy=recordedBy;
          itemRecord.status=q.paymentStatus==='Fully Paid'?'Paid':(q.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          itemRecord.updatedAt=now;
        },'Record Archicad cash payment '+id);

        if(!updated)return res.status(409).json({message:'Cash payment could not be recorded.'});
        const final=paymentFields(updated);
        return res.status(200).json({ok:true,registrationId:id,paymentMethod:final.paymentMethod||'Cash',paymentStatus:final.paymentStatus,bookingPaid:final.bookingPaid,balancePaid:final.balancePaid,balanceDue:final.balanceDue,cashAmount:money(bookingCash+balanceCash),reference});
      }

      if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'});
      const body=bodyData();
      const id=String(body.registrationId||'').trim();
      const tokenValue=String(body.token||'').trim();
      const type=String(body.paymentType||'').trim().toLowerCase();
      if(!id||!['booking','balance'].includes(type))return res.status(400).json({message:'Registration and payment type are required.'});

      const item=await getRegistration(id);
      if(!item)return res.status(404).json({message:'Registration not found.'});
      if(!isAdmin&&String(item.paymentToken||'')!==tokenValue)return res.status(401).json({message:'Invalid payment access token.'});

      if(operation==='callback'){
        const secret=String(process.env.TOYYIBPAY_SECRET_KEY||'').trim();
        if(!secret)return res.status(500).json({message:'ToyyibPay payment configuration is incomplete.'});
        const crypto=await import('crypto');
        const hash=crypto.createHash('md5').update(secret+String(body.status||'')+String(body.order_id||'')+String(body.refno||'')+'ok').digest('hex');
        if(String(body.hash||'').toLowerCase()!==hash.toLowerCase())return res.status(400).json({message:'Invalid callback signature.'});
        if(!paymentSuccess(body.status))return res.status(200).json({success:true,ignored:true});

        const match=String(body.order_id||'').match(/^(ARC-\d{14}-[A-Z0-9]{4})-(booking|balance)$/i);
        if(!match)return res.status(400).json({message:'Invalid payment reference.'});

        const callbackType=String(match[2]).toLowerCase();
        const registration=await getRegistration(match[1]);
        if(!registration)return res.status(404).json({message:'Registration not found.'});
        const payment=paymentFields(registration);
        const expected=callbackType==='booking'?money(Math.max(0,payment.bookingFee-payment.bookingPaid)):money(payment.balanceDue);
        if(expected<=0)return res.status(200).json({success:true,alreadyPaid:true});
        if(!amountMatches(body.amount,expected))return res.status(400).json({message:'Payment amount does not match the expected amount.'});

        const billKey=callbackType==='booking'?'bookingBillCode':'balanceBillCode';
        if(registration[billKey]&&registration[billKey]!==String(body.billcode||''))return res.status(400).json({message:'Payment bill does not match the registration.'});

        await updateRegistration(match[1],itemRecord=>{
          if(callbackType==='booking'){
            itemRecord.bookingPaid=expected;
            itemRecord.bookingPaidAt=new Date().toISOString();
            itemRecord.bookingPaymentMethod='ToyyibPay';
            itemRecord.bookingPaymentRef=String(body.refno||'');
            itemRecord.bookingBillCode=String(body.billcode||itemRecord.bookingBillCode||'');
          }else{
            itemRecord.balancePaid=money(Number(itemRecord.balancePaid||0)+expected);
            itemRecord.balancePaidAt=new Date().toISOString();
            itemRecord.balancePaymentMethod='ToyyibPay';
            itemRecord.balancePaymentRef=String(body.refno||'');
            itemRecord.balanceBillCode=String(body.billcode||itemRecord.balanceBillCode||'');
          }
          const q=paymentFields(itemRecord);
          itemRecord.balanceDue=q.balanceDue;
          itemRecord.paymentStatus=q.paymentStatus;
          itemRecord.payment=q.paymentStatus;
          itemRecord.paymentMethod=q.paymentMethod;
          itemRecord.status=q.paymentStatus==='Fully Paid'?'Paid':(q.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          itemRecord.updatedAt=new Date().toISOString();
        },'ToyyibPay callback for Archicad '+match[1]);

        return res.status(200).json({success:true});
      }

      if(isAdmin===false&&String(item.paymentToken||'')!==tokenValue)return res.status(401).json({message:'Invalid payment access token.'});

      const payment=paymentFields(item);

      if(operation==='create'){
        if(type==='balance'&&payment.bookingPaid<payment.bookingFee){
          return res.status(409).json({message:'Booking fee must be paid before balance payment.'});
        }

        const amount=type==='booking'?money(Math.max(0,payment.bookingFee-payment.bookingPaid)):money(payment.balanceDue);
        if(amount<=0)return res.status(200).json({success:true,alreadyPaid:true,registrationId:id,paymentType:type,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue,bookingPaid:payment.bookingPaid,balancePaid:payment.balancePaid});

        const billKey=type==='booking'?'bookingBillCode':'balanceBillCode';
        if(item[billKey])return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:item[billKey],paymentUrl:'https://toyyibpay.com/'+item[billKey],amount,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue});

        const bill=await createToyyibBill(item,type,amount);
        await updateRegistration(id,itemRecord=>{
          itemRecord[billKey]=bill.billCode;
          itemRecord.updatedAt=new Date().toISOString();
        },'Create Archicad '+type+' payment bill '+id);

        return res.status(200).json({success:true,registrationId:id,paymentType:type,billCode:bill.billCode,paymentUrl:bill.paymentUrl,amount,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue});
      }

      if(operation==='verify'){
        const billCode=String(body.billCode||'').trim();
        if(!billCode)return res.status(400).json({paid:false,message:'Bill code is required.'});
        const billKey=type==='booking'?'bookingBillCode':'balanceBillCode';
        if(item[billKey]&&item[billKey]!==billCode)return res.status(400).json({paid:false,message:'Payment bill does not match the registration.'});

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
        if(!Array.isArray(transactions))return res.status(200).json({paid:false,registrationId:id,paymentType:type,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue,message:'Payment has not been verified.'});

        const expected=type==='booking'?money(Math.max(0,payment.bookingFee-payment.bookingPaid)):money(payment.balanceDue);
        const transaction=transactions.find(t=>paymentSuccess(t.billpaymentStatus??t.status??t.status_id??'')&&amountMatches(t.billpaymentAmount??t.amount??0,expected));
        if(!transaction)return res.status(200).json({paid:false,registrationId:id,paymentType:type,paymentStatus:payment.paymentStatus,balanceDue:payment.balanceDue,message:'Payment has not been verified.'});

        const reference=String(transaction.billpaymentInvoiceNo??transaction.refno??transaction.transaction_id??'');
        const updated=await updateRegistration(id,itemRecord=>{
          if(type==='booking'){
            itemRecord.bookingPaid=expected;
            itemRecord.bookingPaidAt=new Date().toISOString();
            itemRecord.bookingPaymentMethod='ToyyibPay';
            itemRecord.bookingPaymentRef=reference;
            itemRecord.bookingBillCode=billCode;
          }else{
            itemRecord.balancePaid=money(Number(itemRecord.balancePaid||0)+expected);
            itemRecord.balancePaidAt=new Date().toISOString();
            itemRecord.balancePaymentMethod='ToyyibPay';
            itemRecord.balancePaymentRef=reference;
            itemRecord.balanceBillCode=billCode;
          }
          const q=paymentFields(itemRecord);
          itemRecord.balanceDue=q.balanceDue;
          itemRecord.paymentStatus=q.paymentStatus;
          itemRecord.payment=q.paymentStatus;
          itemRecord.paymentMethod=q.paymentMethod;
          itemRecord.status=q.paymentStatus==='Fully Paid'?'Paid':(q.paymentStatus==='Booking Fee Paid'?'Confirmed':'Pending');
          itemRecord.updatedAt=new Date().toISOString();
        },'Verify Archicad '+type+' payment '+id);

        const final=paymentFields(updated);
        return res.status(200).json({paid:true,registrationId:id,paymentType:type,billCode,paymentStatus:final.paymentStatus,balanceDue:final.balanceDue,bookingPaid:final.bookingPaid,balancePaid:final.balancePaid});
      }

      return res.status(404).json({message:'Unknown class payment operation.'});
    }

    return res.status(404).json({message:'Class management resource not found.'});
  }catch(error){
    console.error('class-management error',error);
    return res.status(500).json({message:error.message||'Unable to process class management request.'});
  }
}