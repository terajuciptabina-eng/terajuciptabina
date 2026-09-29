(() => {
'use strict';
const params=new URLSearchParams(location.search),role=(params.get('audience')||params.get('role')||document.body?.dataset?.role||'').toLowerCase();
if(role!=='contractor')return;
const contractorId=String(params.get('contractorId')||params.get('id')||localStorage.getItem('teraju.contractor.local.v1.activeContractorId')||'').trim().toUpperCase();
if(!contractorId)return;
const API='https://terajuciptabina.vercel.app',cacheKey='teraju.preview.branding.v1.'+contractorId;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let branding=null;
const cache=()=>{try{return JSON.parse(localStorage.getItem(cacheKey)||'null')}catch{return null}};
const saveCache=v=>{try{localStorage.setItem(cacheKey,JSON.stringify(v))}catch{}};
const normalize=p=>{p=p&&typeof p==='object'?p:{};return{mode:p.previewBrandingMode==='custom'?'custom':'teraju',configured:p.previewBrandingConfigured===true,name:String(p.name||'').trim(),registrationNo:String(p.registrationNo||'').trim(),address:String(p.address||'').trim(),phone:String(p.phone||'').trim(),email:String(p.email||'').trim(),website:String(p.website||'').trim(),logoDataUrl:String(p.logoDataUrl||'').trim()}};
async function load(){const r=await fetch(API+'/api/auth?role=contractor&id='+encodeURIComponent(contractorId));const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Unable to load Contractor Profile.');branding=normalize(d.profile);saveCache(branding);return d}
async function persist(profile){const r=await fetch(API+'/api/auth',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'contractor',id:contractorId,profile})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Unable to save Contractor Profile.');branding=normalize(d.record?.profile);saveCache(branding);try{localStorage.setItem('teraju.contractor.github.v1',JSON.stringify(d.record))}catch{}return branding}
function modal(){
return new Promise(resolve=>{
document.getElementById('tcPreviewBrandingModal')?.remove();const c=branding||cache()||{},m=document.createElement('div');m.id='tcPreviewBrandingModal';m.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.58);backdrop-filter:blur(5px);font-family:inherit;';
m.innerHTML=\`<div style="width:min(94vw,560px);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 25px 80px rgba(15,23,42,.24);padding:24px">
<div style="font-size:11px;font-weight:800;letter-spacing:.16em;color:#64748b;text-transform:uppercase">Preview Branding</div>
<h2 style="margin:7px 0 6px;font-size:22px;font-weight:800;color:#111827">How should your Cost Estimate look?</h2>
<p style="margin:0 0 18px;color:#6b7280;font-size:13px;line-height:1.55">Choose your company information for the Preview header and footer, or keep the standard TERAJU branding.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
<button type="button" data-mode="teraju" style="border:1px solid #d1d5db;border-radius:14px;padding:14px;text-align:left;background:#fff;cursor:pointer"><strong style="display:block;color:#111827">Maintain TERAJU Default</strong><span style="display:block;margin-top:4px;font-size:12px;color:#6b7280">Keep the standard TERAJU logo and company details.</span></button>
<button type="button" data-mode="custom" style="border:1px solid #111827;border-radius:14px;padding:14px;text-align:left;background:#f8fafc;cursor:pointer"><strong style="display:block;color:#111827">Use My Company Profile</strong><span style="display:block;margin-top:4px;font-size:12px;color:#6b7280">Use your Contractor Profile in the Preview.</span></button>
</div>
<div data-custom-form style="border-top:1px solid #e5e7eb;padding-top:18px"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:10px">Contractor Profile</div>
<div style="display:grid;gap:10px">
<input data-field="name" value="\${esc(c.name)}" placeholder="Company / Contractor Name" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px">
<input data-field="registrationNo" value="\${esc(c.registrationNo)}" placeholder="Registration No. (optional)" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px">
<input data-field="address" value="\${esc(c.address)}" placeholder="Company Address" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input data-field="phone" value="\${esc(c.phone)}" placeholder="Phone" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px"><input data-field="email" value="\${esc(c.email)}" placeholder="Email" type="email" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px"></div>
<input data-field="website" value="\${esc(c.website)}" placeholder="Website (optional)" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:11px">
<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px dashed #d1d5db;border-radius:11px;cursor:pointer"><input data-logo type="file" accept="image/png,image/jpeg,image/webp" style="width:20px;height:20px"><span style="font-size:12px;color:#6b7280">Upload company logo</span></label>
<div data-logo-status style="font-size:11px;color:#6b7280"></div></div></div>
<div data-error style="display:none;margin-top:12px;padding:10px 12px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:12px"></div>
<button type="button" data-save style="width:100%;margin-top:16px;padding:13px 16px;border:0;border-radius:12px;background:#111827;color:#fff;font-weight:700;cursor:pointer">Save Preview Branding</button>
<p style="margin:10px 0 0;text-align:center;font-size:11px;color:#9ca3af">“Powered by TerajuWorks” remains as platform attribution.</p></div>\`;
document.body.appendChild(m);
const form=m.querySelector('[data-custom-form]'),buttons=m.querySelectorAll('[data-mode]');let mode='custom',logo=c.logoDataUrl||'';
const setMode=x=>{mode=x;form.style.display=x==='custom'?'block':'none';buttons.forEach(b=>{const on=b.dataset.mode===x;b.style.borderColor=on?'#111827':'#d1d5db';b.style.background=on?'#f8fafc':'#fff'});m.querySelector('[data-save]').textContent=x==='custom'?'Save Company Profile':'Keep TERAJU Default'};
buttons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
m.querySelector('[data-logo]')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const max=700,s=Math.min(1,max/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.width*s));cv.height=Math.max(1,Math.round(im.height*s));cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);logo=cv.toDataURL('image/webp',.82);m.querySelector('[data-logo-status]').textContent='Logo ready.'};im.src=rd.result};rd.readAsDataURL(f)});
m.querySelector('[data-save]')?.addEventListener('click',async()=>{const er=m.querySelector('[data-error]'),b=m.querySelector('[data-save]');er.style.display='none';b.disabled=true;b.textContent='Saving…';try{if(mode==='teraju'){const x=await persist({previewBrandingMode:'teraju',previewBrandingConfigured:true});m.remove();resolve(x);return}const get=k=>m.querySelector('[data-field="'+k+'"]')?.value.trim()||'',name=get('name');if(!name)throw new Error('Company / Contractor Name is required.');const x=await persist({name,registrationNo:get('registrationNo'),address:get('address'),phone:get('phone'),email:get('email'),website:get('website'),logoDataUrl:logo,previewBrandingMode:'custom',previewBrandingConfigured:true});m.remove();resolve(x)}catch(e){er.textContent=e.message||'Unable to save Preview Branding.';er.style.display='block';b.disabled=false;b.textContent=mode==='custom'?'Save Company Profile':'Keep TERAJU Default'}});
setMode('custom');
})}
async function ensure(){try{await load()}catch{branding=cache()||null}if(!branding?.configured)branding=await modal();return branding}
function headerFooter(){const b=branding||{mode:'teraju'};if(b.mode!=='custom')return{logo:'../images/logo.png',alt:'Teraju Ciptabina Logo',name:'TERAJU CIPTABINA RESOURCES',registration:'',address:'No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor',phone:'014-5002652',email:'terajuciptabina@gmail.com',website:'terajuciptabina-eng.github.io/terajuciptabina/'};return{logo:b.logoDataUrl||'../images/logo.png',alt:b.name+' Logo',name:b.name||'Contractor',registration:b.registrationNo,address:b.address,phone:b.phone,email:b.email,website:b.website}}
window.__TERAJU_PREVIEW_BRANDING_ENSURE=ensure;window.__TERAJU_PREVIEW_BRANDING=headerFooter;
})();