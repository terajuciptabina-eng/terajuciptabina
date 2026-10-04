(() => {
  const role = document.body.dataset.role;
  if (!role) return;
  const API_BASE = 'https://terajuciptabina.vercel.app';
  const isHomeowner = role === 'homeowner';
  const idKey = isHomeowner ? 'homeownerId' : 'contractorId';
  const storageKey = `teraju.${role}.github.v1`;
  const form = document.getElementById(isHomeowner ? 'homeownerAuth' : 'contractorLogin');
  const signInTab = document.getElementById('signInTab'), signUpTab = document.getElementById('signUpTab');
  const idInput = document.getElementById(isHomeowner ? 'homeownerIdInput' : 'contractorIdInput');
  const nameInput = document.getElementById(isHomeowner ? 'homeownerNameInput' : 'contractorNameInput');
  const emailInput = document.getElementById('accountEmailInput'), phoneInput = document.getElementById('accountPhoneInput');
  const idField = document.getElementById(isHomeowner ? 'homeownerIdField' : 'contractorIdField'), nameField = document.getElementById(isHomeowner ? 'homeownerNameField' : 'contractorNameField');
  const button = document.getElementById('authButton'), title = document.getElementById('authTitle'), description = document.getElementById('authDescription'), error = document.getElementById('authError'), generated = document.getElementById('authGeneratedId');
  const panel = document.getElementById('authPanel') || document.getElementById('loginPanel'), portal = document.getElementById('portal'), welcome = document.getElementById('welcome'), buildLink = document.getElementById('buildLink'), renoLink = document.getElementById('renoLink');
  const workspaceAccountIdValue = document.getElementById('workspaceAccountIdValue');
  const profileButton = document.getElementById('profileButton'), profileModal = document.getElementById('profileModal'), profileClose = document.getElementById('profileClose'), profileCancel = document.getElementById('profileCancel'), profileSave = document.getElementById('profileSave'), profileUseBranding = document.getElementById('profileUseBranding'), profileResetBranding = document.getElementById('profileResetBranding'), profileStatus = document.getElementById('profileStatus'), profileLogoInput = document.getElementById('profileLogoInput'), profileLogoWrap = document.getElementById('profileLogoWrap');
  const profileAccountId = document.getElementById('profileAccountId'), homeProfileAccountId = document.getElementById('homeProfileAccountId');
  const profileFields = { name: document.getElementById('profileName'), registrationNo: document.getElementById('profileRegistration'), phone: document.getElementById('profilePhone'), address: document.getElementById('profileAddress'), email: document.getElementById('profileEmail'), website: document.getElementById('profileWebsite') };
  const homeProfileButton = document.getElementById('homeProfileButton'), homeProfileModal = document.getElementById('homeProfileModal'), homeProfileClose = document.getElementById('homeProfileClose'), homeProfileCancel = document.getElementById('homeProfileCancel'), homeProfileSave = document.getElementById('homeProfileSave'), homeProfileStatus = document.getElementById('homeProfileStatus');
  const homeProfileFields = { name: document.getElementById('homeProfileName'), phone: document.getElementById('homeProfilePhone'), email: document.getElementById('homeProfileEmail'), propertyAddress: document.getElementById('homeProfileAddress'), propertyType: document.getElementById('homeProfilePropertyType'), projectNotes: document.getElementById('homeProfileNotes') };
  let currentRecord = null, profileLogoDataUrl = '';
  let mode = 'signup';
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } };
  const setLocal = record => localStorage.setItem(storageKey, JSON.stringify(record));
  const trackEvent = (name, extra = {}) => { try { if (typeof window.TERAJU_GA_EVENT === 'function') window.TERAJU_GA_EVENT(name, Object.fromEntries(Object.entries({ role, ...extra }).filter(([,v]) => v !== undefined && v !== ''))); } catch {} };
  const setError = message => { error.textContent = message; error.classList.remove('hidden'); };
  const clearError = () => { error.textContent = ''; error.classList.add('hidden'); };
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
  const normalizePhone = value => String(value || '').replace(/[\s().-]/g, '');
  const validPhone = value => /^(?:01\d{8,9}|\+601\d{8,9}|601\d{8,9})$/.test(normalizePhone(value));

  if (emailInput) { emailInput.type = 'email'; emailInput.autocomplete = 'email'; }
  if (phoneInput) { phoneInput.type = 'tel'; phoneInput.autocomplete = 'tel'; phoneInput.inputMode = 'tel'; phoneInput.placeholder = '0123456789'; }

  function setMode(next) {
    mode = next; clearError(); generated.classList.add('hidden'); const signup = next === 'signup';
    title.textContent = signup ? `Create ${isHomeowner ? 'homeowner' : 'contractor'} account` : `${isHomeowner ? 'Homeowner' : 'Contractor'} sign in`;
    description.textContent = signup ? `Create your ${isHomeowner ? 'home project' : 'contractor'} workspace. Your record will be saved to the temporary GitHub account store.` : `Enter the ${isHomeowner ? 'Homeowner' : 'Contractor'} ID generated during Sign Up.`;
    idField.classList.toggle('hidden', signup); nameField.classList.toggle('hidden', !signup); emailInput?.parentElement.classList.toggle('hidden', !signup); phoneInput?.parentElement.classList.toggle('hidden', !signup);
    idInput.required = !signup; nameInput.required = signup; if (emailInput) emailInput.required = signup; if (phoneInput) phoneInput.required = signup; button.textContent = signup ? 'Create workspace' : 'Enter workspace';
    signInTab.className = signup ? 'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500' : 'tab-active rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950';
    signUpTab.className = signup ? 'tab-active rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950' : 'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500';
  }
  function showSignupPopup(record, emailSent, email) {
    const existing = document.getElementById('terajuSignupPopup');
    existing?.remove();
    const label = isHomeowner ? 'Homeowner' : 'Contractor';
    const popup = document.createElement('div');
    popup.id = 'terajuSignupPopup';
    popup.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:99999;width:min(92vw,460px);padding:20px 22px;border:1px solid #d9c49a;border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 18px 55px rgba(15,23,42,.18);font-family:inherit;color:#0f172a;opacity:0;transition:opacity .25s ease,transform .25s ease';
    const note = emailSent
      ? `Your ID has also been sent to ${escapeHtml(email)}.`
      : 'Account created, but the ID email could not be sent yet. Please keep this ID.';
    const noteClass = emailSent ? 'color:#64748b' : 'color:#b45309';
    popup.innerHTML = `<div style=\"font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#64748b\">Account created</div><div style=\"margin-top:8px;font-size:15px;font-weight:700\">Your ${label} ID</div><div style=\"margin-top:5px;font-size:24px;font-weight:800;letter-spacing:.06em\">${escapeHtml(record[idKey])}</div><div style=\"margin-top:10px;font-size:12px;line-height:1.5;${noteClass}\">${note}</div>`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => { popup.style.opacity = '1'; popup.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transform = 'translateX(-50%) translateY(-8px)';
      setTimeout(() => popup.remove(), 300);
    }, 5000);
  }
  function openSignupWhatsApp(record, name) {
    const phone = record?.profile?.phone || phoneInput?.value || '';
    const recipient = normalizePhone(phone).replace(/^0/, '60').replace(/^\+/, '');
    const id = record?.[idKey] || '';
    const label = isHomeowner ? 'HOMEOWNER' : 'CONTRACTOR';
    const workspaceUrl = isHomeowner
      ? 'https://terajuciptabina-eng.github.io/terajuciptabina/TerajuWorks/homeowner.html'
      : 'https://terajuciptabina-eng.github.io/terajuciptabina/quotation/contractor.html';
    const message = `Hello ${name},

Thank you for registering with TERAJU WORKS ${label} WORKSPACE.
Your registration has been received successfully. Your account has been assigned the following reference number for your log in:

${id}.

Please keep this reference number for your records. Happy log in 😇

${workspaceUrl}`;
    window.location.assign(`https://wa.me/${recipient}?text=${encodeURIComponent(message)}`);
  }
  function showPortal(record) {
    currentRecord = record; setLocal(record); panel.classList.add('hidden'); portal.classList.remove('hidden'); const id = record[idKey];
    welcome.innerHTML = `<span class=\"block\">Welcome, ${escapeHtml(record.profile?.name || '')}.</span>`;
    if (workspaceAccountIdValue) workspaceAccountIdValue.textContent = id;
    if (buildLink) buildLink.href = `quotations.html?audience=${role}&role=${role}&${idKey}=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}&plannerType=build`;
    if (renoLink) renoLink.href = `quotations.html?audience=${role}&role=${role}&${idKey}=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}&plannerType=renovation`;
  }
  function setProfileStatus(message, type='error') {
    if (!profileStatus) return;
    profileStatus.textContent = message;
    profileStatus.style.display = message ? 'block' : 'none';
    profileStatus.style.background = type === 'success' ? '#f0fdf4' : '#fff1f2';
    profileStatus.style.color = type === 'success' ? '#166534' : '#be123c';
  }
  function renderProfileLogo(dataUrl) {
    if (!profileLogoWrap) return;
    if (dataUrl) {
      profileLogoWrap.className = '';
      profileLogoWrap.innerHTML = '<img src="' + escapeHtml(dataUrl) + '" alt="Company logo">';
    } else {
      profileLogoWrap.className = 'profile-logo-empty';
      profileLogoWrap.textContent = 'No logo uploaded';
    }
  }
  function setHomeProfileStatus(message, type='error') {
    if (!homeProfileStatus) return;
    homeProfileStatus.textContent = message;
    homeProfileStatus.style.display = message ? 'block' : 'none';
    homeProfileStatus.style.background = type === 'success' ? '#f0fdf4' : '#fff1f2';
    homeProfileStatus.style.color = type === 'success' ? '#166534' : '#be123c';
  }
  function openHomeProfile(record) {
    if (!homeProfileModal || role !== 'homeowner') return;
    if (homeProfileAccountId) homeProfileAccountId.value = record?.[idKey] || '';
    const p = record?.profile || {};
    Object.entries(homeProfileFields).forEach(([key, input]) => { if (input) input.value = p[key] || ''; });
    setHomeProfileStatus('');
    homeProfileModal.classList.add('open');
    homeProfileModal.setAttribute('aria-hidden','false');
  }
  function closeHomeProfile() {
    homeProfileModal?.classList.remove('open');
    homeProfileModal?.setAttribute('aria-hidden','true');
    setHomeProfileStatus('');
  }
  async function saveHomeProfile() {
    if (!currentRecord || role !== 'homeowner') return;
    const profile = {};
    Object.entries(homeProfileFields).forEach(([key, input]) => { profile[key] = input?.value.trim() || ''; });
    if (!profile.name) return setHomeProfileStatus('Name is required.');
    if (!validEmail(profile.email)) return setHomeProfileStatus('Please enter a valid email address.');
    if (!validPhone(profile.phone)) return setHomeProfileStatus('Please enter a valid Malaysian phone number.');
    homeProfileSave.disabled = true;
    homeProfileSave.textContent = 'Saving…';
    setHomeProfileStatus('');
    try {
      const response = await fetch(API_BASE + '/api/auth', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role:'homeowner', id:currentRecord[idKey], profile }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to save homeowner profile.');
      currentRecord = data.record || { ...currentRecord, profile:{ ...(currentRecord.profile||{}), ...profile } };
      setLocal(currentRecord);
      welcome.innerHTML = '<span class="block">Welcome, ' + escapeHtml(currentRecord.profile?.name || '') + '.</span>';
      setHomeProfileStatus('Profile saved successfully.', 'success');
      setTimeout(closeHomeProfile, 650);
      trackEvent('homeowner_profile_saved');
    } catch (err) {
      setHomeProfileStatus(err.message || 'Unable to save homeowner profile.');
    } finally {
      homeProfileSave.disabled = false;
      homeProfileSave.textContent = 'Save Profile';
    }
  }
  homeProfileButton?.addEventListener('click', () => openHomeProfile(currentRecord), true);
  homeProfileClose?.addEventListener('click', closeHomeProfile, true);
  homeProfileCancel?.addEventListener('click', closeHomeProfile, true);
  homeProfileModal?.addEventListener('click', event => { if (event.target === homeProfileModal) closeHomeProfile(); }, true);

  function openProfile(record, options = {}) {
    if (!profileModal || role !== 'contractor') return;
    const onboarding = options.onboarding === true;
    const onboardingNote = document.getElementById('profileOnboardingNote');
    if (onboardingNote) onboardingNote.style.display = onboarding ? 'block' : 'none';
    if (profileCancel) profileCancel.textContent = onboarding ? 'Skip for now' : 'Cancel';
    if (profileAccountId) profileAccountId.value = record?.[idKey] || '';
    const p = record?.profile || {};
    Object.entries(profileFields).forEach(([key, input]) => { if (input) input.value = p[key] || ''; });
    profileLogoDataUrl = p.logoDataUrl || '';
    renderProfileLogo(profileLogoDataUrl);
    if (profileLogoInput) profileLogoInput.value = '';
    setProfileStatus('');
    profileModal.classList.add('open');
    profileModal.setAttribute('aria-hidden','false');
  }
  function closeProfile() {
    const onboardingNote = document.getElementById('profileOnboardingNote');
    if (onboardingNote) onboardingNote.style.display = 'none';
    if (profileCancel) profileCancel.textContent = 'Cancel';
    profileModal?.classList.remove('open');
    profileModal?.setAttribute('aria-hidden','true');
    setProfileStatus('');
  }
  function compressLogoDataUrl(dataUrl) {
    return new Promise(resolve => {
      if (!dataUrl || dataUrl.length <= 300000) return resolve(dataUrl || '');
      const img = new Image();
      img.onload = () => {
        const maxSide = 800;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let out = canvas.toDataURL('image/webp', 0.78);
        if (out.length > 350000) out = canvas.toDataURL('image/jpeg', 0.72);
        resolve(out);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function saveProfile() {
    if (!currentRecord || role !== 'contractor') return;
    const profile = {};
    Object.entries(profileFields).forEach(([key, input]) => { profile[key] = input?.value.trim() || ''; });
    profile.logoDataUrl = await compressLogoDataUrl(profileLogoDataUrl || '');
    profile.contractorProfileConfigured = true;
    profileLogoDataUrl = profile.logoDataUrl;
    renderProfileLogo(profileLogoDataUrl);
    if (!profile.name) return setProfileStatus('Company / Contractor Name is required.');
    if (!validEmail(profile.email)) return setProfileStatus('Please enter a valid email address.');
    if (!validPhone(profile.phone)) return setProfileStatus('Please enter a valid Malaysian phone number.');
    if (profile.logoDataUrl.length > 900000) return setProfileStatus('Logo image is too large. Please use a smaller image.');
    profileSave.disabled = true; profileSave.textContent = 'Saving…'; setProfileStatus('');
    try {
      const response = await fetch(API_BASE + '/api/auth', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role:'contractor', id:currentRecord[idKey], profile }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to save contractor profile.');
      currentRecord = data.record || { ...currentRecord, profile:{ ...(currentRecord.profile||{}), ...profile } };
      setLocal(currentRecord);
      welcome.innerHTML = '<span class="block">Welcome, ' + escapeHtml(currentRecord.profile?.name || '') + '.</span>';
      setProfileStatus('Profile saved successfully.', 'success');
      setTimeout(closeProfile, 650);
      trackEvent('contractor_profile_saved');
    } catch (err) {
      setProfileStatus(err.message || 'Unable to save contractor profile.');
    } finally {
      profileSave.disabled = false; profileSave.textContent = 'Save Profile'; 
    }
  }
  profileButton?.addEventListener('click', () => openProfile(currentRecord), true);
  profileClose?.addEventListener('click', closeProfile, true);
  profileCancel?.addEventListener('click', closeProfile, true);
  profileModal?.addEventListener('click', event => { if (event.target === profileModal) closeProfile(); }, true);
  profileLogoInput?.addEventListener('change', () => {
    const file = profileLogoInput.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setProfileStatus('Please choose a PNG, JPG or WEBP image.');
    if (file.size > 5000000) return setProfileStatus('Logo image is too large. Please choose a smaller file.');
    const reader = new FileReader();
    reader.onload = async () => { profileLogoDataUrl = await compressLogoDataUrl(String(reader.result || '')); renderProfileLogo(profileLogoDataUrl); setProfileStatus(''); };
    reader.readAsDataURL(file);
  });
  async function useContractorProfileBranding() {
    if (!currentRecord || role !== 'contractor') return;
    const profile = currentRecord.profile || {};
    if (profile.contractorProfileConfigured !== true) {
      setProfileStatus('Save your Contractor Profile first before using it in Preview.');
      return;
    }
    if (!profile.name || !profile.logoDataUrl) {
      setProfileStatus('Complete your Contractor Profile first, including your company logo.');
      return;
    }
    profileUseBranding.disabled = true;
    profileUseBranding.textContent = 'Applying…';
    setProfileStatus('');
    try {
      const response = await fetch(API_BASE + '/api/auth', {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          role:'contractor',
          id:currentRecord[idKey],
          profile:{
            previewBrandingMode:'custom',
            previewBrandingConfigured:true
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to activate Company Profile for Preview.');
      currentRecord = data.record || currentRecord;
      setLocal(currentRecord);
      setProfileStatus('Company Profile is now active for Cost Estimate Preview.', 'success');
      trackEvent('contractor_preview_branding_custom');
    } catch (err) {
      setProfileStatus(err.message || 'Unable to activate Company Profile for Preview.');
    } finally {
      profileUseBranding.disabled = false;
      profileUseBranding.textContent = 'Use My Company Profile for Preview';
    }
  }
  profileUseBranding?.addEventListener('click', useContractorProfileBranding, true);

  async function resetPreviewBranding() {
    if (!currentRecord || role !== 'contractor') return;
    if (!confirm('Reset Cost Estimate Preview to TERAJU Default? Your Contractor Profile will be kept.')) return;
    profileResetBranding.disabled = true;
    profileResetBranding.textContent = 'Resetting…';
    setProfileStatus('');
    try {
      const response = await fetch(API_BASE + '/api/auth', {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          role:'contractor',
          id:currentRecord[idKey],
          profile:{
            previewBrandingMode:'teraju',
            previewBrandingConfigured:true
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to reset Preview branding.');
      currentRecord = data.record || currentRecord;
      setLocal(currentRecord);
      setProfileStatus('Preview reset to TERAJU Default. Contractor Profile is kept.', 'success');
      trackEvent('contractor_preview_branding_reset');
    } catch (err) {
      setProfileStatus(err.message || 'Unable to reset Preview branding.');
    } finally {
      profileResetBranding.disabled = false;
      profileResetBranding.textContent = 'Reset Preview to TERAJU Default';
    }
  }
  profileResetBranding?.addEventListener('click', resetPreviewBranding, true);
  profileSave?.addEventListener('click', saveProfile, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (profileModal?.classList.contains('open')) closeProfile(); if (homeProfileModal?.classList.contains('open')) closeHomeProfile(); } });
  homeProfileSave?.addEventListener('click', saveHomeProfile, true);

  async function getAccount(id) {
    const response = await fetch(`${API_BASE}/api/auth?role=${encodeURIComponent(role)}&id=${encodeURIComponent(id)}`).catch(() => null);
    if (!response) throw new Error('Unable to reach the account service.'); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || 'Account not found.'); return data;
  }
  async function syncLocalAccount(record) {
    const id = String(record?.[idKey] || '').trim().toUpperCase();
    if (!id) return;
    try {
      const latest = await getAccount(id);
      if (latest?.[idKey]) showPortal(latest);
    } catch {
      // Keep the locally cached account if the sync service is temporarily unavailable.
    }
  }
  async function postAccount(body) {
    const response = await fetch(`${API_BASE}/api/auth`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(() => null);
    if (!response) throw new Error('Unable to reach the account service.'); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || 'Account request failed.'); return data;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation(); clearError(); button.disabled = true; button.textContent = mode === 'signup' ? 'Creating…' : 'Signing in…';
    try {
      if (mode === 'signup') {
        const name = nameInput.value.trim(), email = emailInput?.value.trim() || '', phone = phoneInput?.value.trim() || '';
        if (!name) throw new Error('Name is required.');
        if (!validEmail(email)) throw new Error('Please enter a valid email address.');
        if (!validPhone(phone)) throw new Error('Please enter a valid Malaysian phone number, e.g. 0123456789 or +60123456789.');
        const data = await postAccount({role,name,email,phone});
        trackEvent('sign_up', { signup_role: role, generated_id: data.id, method: 'github_account_store' });
        generated.innerHTML = `<strong>Your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID:</strong><br><span class=\"mt-1 inline-block text-lg font-bold tracking-wide text-slate-950\">${escapeHtml(data.id)}</span><br><span class=\"text-xs text-slate-500\">Keep this ID. You will use it to sign in later.</span>`;
        generated.classList.remove('hidden');
        showPortal(data.record);
        showSignupPopup(data.record, data.emailSent === true, email);
        openSignupWhatsApp(data.record, name);
        if (role === 'contractor') setTimeout(() => openProfile(data.record, { onboarding: true }), 550);
      } else {
        const id = idInput.value.trim().toUpperCase();
        if (!id) throw new Error(`Please enter your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID.`);
        const account = await getAccount(id);
        trackEvent('login', { login_role: role, method: 'github_account_store' });
        showPortal(account);
      }
    } catch (err) { setError(err.message || 'Unable to complete the request.'); }
    finally { button.disabled = false; button.textContent = mode === 'signup' ? 'Create workspace' : 'Enter workspace'; }
  }, true);
  signInTab.addEventListener('click', () => setMode('signin'), true); signUpTab.addEventListener('click', () => setMode('signup'), true);
  document.getElementById('logout')?.addEventListener('click', () => { const logoutButton=document.getElementById('logout'); if(logoutButton){ logoutButton.disabled=true; logoutButton.textContent='Logging out…'; } localStorage.removeItem(storageKey); try{ sessionStorage.removeItem('teraju.workspace.context.v1'); }catch{} window.location.replace(location.pathname); }, true);
  const query = new URLSearchParams(location.search);
  const queryId = String(query.get(idKey) || query.get('id') || '').trim().toUpperCase();
  const local = getLocal();
  if (queryId) {
    if (local?.[idKey] === queryId) {
      showPortal(local); syncLocalAccount(local);
    } else {
      getAccount(queryId).then(account => showPortal(account)).catch(() => {
        if (local?.[idKey]) { showPortal(local); syncLocalAccount(local); }
        else setMode('signin');
      });
    }
  } else if (local?.[idKey]) {
    showPortal(local); syncLocalAccount(local);
  } else setMode('signup');
})();
