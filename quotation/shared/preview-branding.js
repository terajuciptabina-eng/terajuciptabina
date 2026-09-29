(() => {
'use strict';
const params=new URLSearchParams(location.search);
const storedContext=(()=>{try{return JSON.parse(sessionStorage.getItem('teraju.workspace.context.v1')||'null')}catch{return null}})();
const role=(params.get('audience')||params.get('role')||storedContext?.role||document.body?.dataset?.role||'').toLowerCase();
if(role!=='contractor')return;
const contractorId=String(params.get('contractorId')||params.get('id')||storedContext?.id||(()=>{try{return JSON.parse(localStorage.getItem('teraju.contractor.github.v1')||'null')?.contractorId||''}catch{return ''}})()||'').trim().toUpperCase();
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
document.getElementById('tcPreviewBrandingModal')?.remove();
const c=branding||cache()||{},m=document.createElement('div');
m.id='tcPreviewBrandingModal';
m.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.64);backdrop-filter:blur(10px);font-family:inherit;';
m.innerHTML=`<style>
#tcPreviewBrandingModal *{box-sizing:border-box}
#tcPreviewBrandingModal .tc-bm-card{width:min(94vw,620px);max-height:92vh;overflow:auto;background:#fff;border:1px solid rgba(148,163,184,.24);border-radius:24px;box-shadow:0 30px 90px rgba(15,23,42,.30);padding:28px}
#tcPreviewBrandingModal .tc-bm-kicker{font-size:10px;font-weight:800;letter-spacing:.16em;color:#64748b;text-transform:uppercase}
#tcPreviewBrandingModal .tc-bm-title{margin:7px 0 7px;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:#0f172a}
#tcPreviewBrandingModal .tc-bm-copy{margin:0;color:#64748b;font-size:13px;line-height:1.55}
#tcPreviewBrandingModal .tc-bm-close{width:36px;height:36px;border:1px solid #e2e8f0;border-radius:50%;background:#f8fafc;color:#475569;font-size:22px;line-height:1;cursor:pointer}
#tcPreviewBrandingModal .tc-bm-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}
#tcPreviewBrandingModal .tc-bm-option{position:relative;min-height:132px;padding:17px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;text-align:left;cursor:pointer;transition:border-color .16s,box-shadow .16s,background .16s}
#tcPreviewBrandingModal .tc-bm-option:hover{border-color:#94a3b8}
#tcPreviewBrandingModal .tc-bm-option.tc-active{border-color:#2563eb;background:#f8fbff;box-shadow:0 0 0 3px rgba(37,99,235,.09)}
#tcPreviewBrandingModal .tc-bm-radio{width:18px;height:18px;border:2px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;top:17px;right:17px}
#tcPreviewBrandingModal .tc-active .tc-bm-radio{border-color:#2563eb}
#tcPreviewBrandingModal .tc-active .tc-bm-radio:after{content:'';width:8px;height:8px;border-radius:50%;background:#2563eb}
#tcPreviewBrandingModal .tc-bm-mark{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#f1f5f9;margin-bottom:13px;overflow:hidden}
#tcPreviewBrandingModal .tc-bm-mark img{max-width:34px;max-height:28px;object-fit:contain}
#tcPreviewBrandingModal .tc-bm-mark span{font-size:20px}
#tcPreviewBrandingModal .tc-bm-option strong{display:block;color:#0f172a;font-size:14px}
#tcPreviewBrandingModal .tc-bm-option span.tc-bm-desc{display:block;margin-top:5px;color:#64748b;font-size:12px;line-height:1.45}
#tcPreviewBrandingModal .tc-bm-divider{height:1px;background:#e2e8f0;margin:22px 0}
#tcPreviewBrandingModal .tc-bm-section-title{font-size:14px;font-weight:800;color:#0f172a}
#tcPreviewBrandingModal .tc-bm-section-copy{margin-top:3px;font-size:11px;color:#94a3b8}
#tcPreviewBrandingModal .tc-bm-form{display:grid;gap:12px;margin-top:15px}
#tcPreviewBrandingModal .tc-bm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#tcPreviewBrandingModal .tc-bm-field{display:grid;gap:6px}
#tcPreviewBrandingModal .tc-bm-field label{font-size:11px;font-weight:700;color:#475569}
#tcPreviewBrandingModal .tc-bm-field input,#tcPreviewBrandingModal .tc-bm-field textarea{width:100%;padding:11px 12px;border:1px solid #dbe3ec;border-radius:11px;background:#fff;color:#0f172a;font:inherit;font-size:13px;outline:none}
#tcPreviewBrandingModal .tc-bm-field input:focus,#tcPreviewBrandingModal .tc-bm-field textarea:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
#tcPreviewBrandingModal .tc-bm-field textarea{min-height:72px;resize:vertical}
#tcPreviewBrandingModal .tc-bm-upload{display:flex;align-items:center;gap:12px;padding:13px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;cursor:pointer}
#tcPreviewBrandingModal .tc-bm-upload-icon{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#fff;border:1px solid #e2e8f0;font-size:18px}
#tcPreviewBrandingModal .tc-bm-upload strong{display:block;font-size:12px;color:#334155}
#tcPreviewBrandingModal .tc-bm-upload span{display:block;margin-top:3px;font-size:10px;color:#94a3b8}
#tcPreviewBrandingModal .tc-bm-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:10px;margin-top:18px}
#tcPreviewBrandingModal .tc-bm-btn{min-height:44px;border-radius:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
#tcPreviewBrandingModal .tc-bm-cancel{border:1px solid #e2e8f0;background:#f8fafc;color:#475569}
#tcPreviewBrandingModal .tc-bm-save{border:0;background:#0f172a;color:#fff;box-shadow:0 8px 20px rgba(15,23,42,.16)}
#tcPreviewBrandingModal .tc-bm-save:disabled{opacity:.55;cursor:wait}
#tcPreviewBrandingModal .tc-bm-error{display:none;margin-top:12px;padding:10px 12px;border-radius:10px;background:#fff1f2;color:#be123c;font-size:12px}
#tcPreviewBrandingModal .tc-bm-foot{margin:12px 0 0;text-align:center;font-size:10px;color:#94a3b8}
@media(max-width:620px){#tcPreviewBrandingModal .tc-bm-card{padding:20px;border-radius:20px}#tcPreviewBrandingModal .tc-bm-title{font-size:21px}#tcPreviewBrandingModal .tc-bm-options,#tcPreviewBrandingModal .tc-bm-grid,#tcPreviewBrandingModal .tc-bm-actions{grid-template-columns:1fr}}
</style>
<div class="tc-bm-card">
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
<div><div class="tc-bm-kicker">Preview Branding</div><h2 class="tc-bm-title">How should your Cost Estimate look?</h2><p class="tc-bm-copy">Choose whether your Preview keeps the standard TERAJU identity or uses your Contractor Profile.</p></div>
<button type="button" class="tc-bm-close" aria-label="Close">×</button>
</div>
<div class="tc-bm-options">
<button type="button" data-mode="teraju" class="tc-bm-option">
<div class="tc-bm-mark"><img src="../images/logo.png" alt="TERAJU"></div><div class="tc-bm-radio"></div>
<strong>Maintain TERAJU Default</strong><span class="tc-bm-desc">Keep the standard TERAJU logo and company details on your Preview.</span>
</button>
<button type="button" data-mode="custom" class="tc-bm-option">
<div class="tc-bm-mark"><span>⌂</span></div><div class="tc-bm-radio"></div>
<strong>Use My Company Profile</strong><span class="tc-bm-desc">Use your saved Contractor Profile information on the Preview.</span>
</button>
</div>
<div data-custom-form>
<div class="tc-bm-divider"></div>
<div class="tc-bm-section-title">Contractor Profile</div>
<div class="tc-bm-section-copy">This information will be used in the Preview header and footer.</div>
<div class="tc-bm-form">
<div class="tc-bm-field"><label>Company / Contractor Name</label><input data-field="name" value="${esc(c.name)}" placeholder="Company / Contractor Name"></div>
<div class="tc-bm-grid">
<div class="tc-bm-field"><label>Registration No. <span style="font-weight:500;color:#94a3b8">(optional)</span></label><input data-field="registrationNo" value="${esc(c.registrationNo)}" placeholder="Registration number"></div>
<div class="tc-bm-field"><label>Phone</label><input data-field="phone" value="${esc(c.phone)}" placeholder="Phone number"></div>
</div>
<div class="tc-bm-grid">
<div class="tc-bm-field"><label>Company Address</label><textarea data-field="address" placeholder="Company address">${esc(c.address)}</textarea></div>
<div class="tc-bm-field"><label>Email</label><input data-field="email" value="${esc(c.email)}" placeholder="Email address" type="email"></div>
</div>
<div class="tc-bm-field"><label>Website <span style="font-weight:500;color:#94a3b8">(optional)</span></label><input data-field="website" value="${esc(c.website)}" placeholder="Website"></div>
<label class="tc-bm-upload"><div class="tc-bm-upload-icon">▧</div><div style="flex:1"><strong>Company Logo <span style="font-weight:500;color:#94a3b8">(optional)</span></strong><span>PNG, JPG or WEBP · recommended 300 × 100 px</span></div><input data-logo type="file" accept="image/png,image/jpeg,image/webp" style="display:none"></label>
<div data-logo-status style="font-size:10px;color:#64748b"></div>
</div>
</div>
<div data-error class="tc-bm-error"></div>
<div class="tc-bm-actions"><button type="button" class="tc-bm-btn tc-bm-cancel" data-cancel>Cancel</button><button type="button" class="tc-bm-btn tc-bm-save" data-save>Save Company Profile</button></div>
<p class="tc-bm-foot">“Powered by TerajuWorks” remains as platform attribution.</p>
</div></div>`;
document.body.appendChild(m);
const form=m.querySelector('[data-custom-form]'),buttons=m.querySelectorAll('[data-mode]');let mode='custom',logo=c.logoDataUrl||'';
const setMode=x=>{mode=x;form.style.display=x==='custom'?'block':'none';buttons.forEach(b=>{const on=b.dataset.mode===x;b.classList.toggle('tc-active',on)});m.querySelector('[data-save]').textContent=x==='custom'?'Save Company Profile':'Keep TERAJU Default'};
buttons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
m.querySelector('[data-cancel]')?.addEventListener('click',()=>{m.remove();resolve(branding||cache()||{mode:'teraju',configured:false})});
m.querySelector('.tc-bm-close')?.addEventListener('click',()=>{m.remove();resolve(branding||cache()||{mode:'teraju',configured:false})});
m.querySelector('[data-logo]')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const max=700,s=Math.min(1,max/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.width*s));cv.height=Math.max(1,Math.round(im.height*s));cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);logo=cv.toDataURL('image/webp',.82);m.querySelector('[data-logo-status]').textContent='Logo ready.'};im.src=rd.result};rd.readAsDataURL(f)});
m.querySelector('[data-save]')?.addEventListener('click',async()=>{const er=m.querySelector('[data-error]'),b=m.querySelector('[data-save]');er.style.display='none';b.disabled=true;b.textContent='Saving…';try{if(mode==='teraju'){const x=await persist({previewBrandingMode:'teraju',previewBrandingConfigured:true});m.remove();resolve(x);return}const get=k=>m.querySelector('[data-field="'+k+'"]')?.value.trim()||'',name=get('name');if(!name)throw new Error('Company / Contractor Name is required.');const x=await persist({name,registrationNo:get('registrationNo'),address:get('address'),phone:get('phone'),email:get('email'),website:get('website'),logoDataUrl:logo,previewBrandingMode:'custom',previewBrandingConfigured:true});m.remove();resolve(x)}catch(e){er.textContent=e.message||'Unable to save Preview Branding.';er.style.display='block';b.disabled=false;b.textContent=mode==='custom'?'Save Company Profile':'Keep TERAJU Default'}});
setMode('custom');
})}async function ensure(){try{await load()}catch{branding=cache()||null}if(!branding?.configured)branding=await modal();return branding}
function headerFooter(){const b=branding||{mode:'teraju'};if(b.mode!=='custom')return{logo:'../images/logo.png',alt:'Teraju Ciptabina Logo',name:'TERAJU CIPTABINA RESOURCES',registration:'',address:'No 10A, Jalan PP 2/1, Taman Putra Prima, 47100 Puchong, Selangor',phone:'014-5002652',email:'terajuciptabina@gmail.com',website:'terajuciptabina-eng.github.io/terajuciptabina/'};return{logo:b.logoDataUrl||'../images/logo.png',alt:b.name+' Logo',name:b.name||'Contractor',registration:b.registrationNo,address:b.address,phone:b.phone,email:b.email,website:b.website}}
window.__TERAJU_PREVIEW_BRANDING_ENSURE=ensure;window.__TERAJU_PREVIEW_BRANDING=headerFooter;
})();