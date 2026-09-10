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
  let mode = 'signup';
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } };
  const setLocal = record => localStorage.setItem(storageKey, JSON.stringify(record));
  const setError = message => { error.textContent = message; error.classList.remove('hidden'); };
  const clearError = () => { error.textContent = ''; error.classList.add('hidden'); };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function setMode(next) {
    mode = next; clearError(); generated.classList.add('hidden'); const signup = next === 'signup';
    title.textContent = signup ? `Create ${isHomeowner ? 'homeowner' : 'contractor'} account` : `${isHomeowner ? 'Homeowner' : 'Contractor'} sign in`;
    description.textContent = signup ? `Create your ${isHomeowner ? 'home project' : 'contractor'} workspace. Your record will be saved to the temporary GitHub account store.` : `Enter the ${isHomeowner ? 'Homeowner' : 'Contractor'} ID generated during Sign Up.`;
    idField.classList.toggle('hidden', signup); nameField.classList.toggle('hidden', !signup); emailInput?.parentElement.classList.toggle('hidden', !signup); phoneInput?.parentElement.classList.toggle('hidden', !signup);
    idInput.required = !signup; nameInput.required = signup; if (emailInput) emailInput.required = signup; button.textContent = signup ? 'Create workspace' : 'Enter workspace';
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
    popup.innerHTML = `<div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#64748b">Account created</div><div style="margin-top:8px;font-size:15px;font-weight:700">Your ${label} ID</div><div style="margin-top:5px;font-size:24px;font-weight:800;letter-spacing:.06em">${escapeHtml(record[idKey])}</div><div style="margin-top:10px;font-size:12px;line-height:1.5;${noteClass}">${note}</div>`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => { popup.style.opacity = '1'; popup.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transform = 'translateX(-50%) translateY(-8px)';
      setTimeout(() => popup.remove(), 300);
    }, 5000);
  }
  function showPortal(record) {
    setLocal(record); panel.classList.add('hidden'); portal.classList.remove('hidden'); const id = record[idKey];
    welcome.innerHTML = `<span class="block">Welcome, ${escapeHtml(record.profile?.name || '')}.</span>`;
    if (buildLink) buildLink.href = `quotations.html?audience=${role}&role=${role}&${idKey}=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}&plannerType=build`;
    if (renoLink) renoLink.href = `quotations.html?audience=${role}&role=${role}&${idKey}=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}&plannerType=renovation`;
  }
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
        const name = nameInput.value.trim(), email = emailInput?.value.trim() || '', phone = phoneInput?.value.trim() || ''; if (!name || !email) throw new Error('Name and email are required.');
        const data = await postAccount({role,name,email,phone});
        generated.innerHTML = `<strong>Your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID:</strong><br><span class="mt-1 inline-block text-lg font-bold tracking-wide text-slate-950">${escapeHtml(data.id)}</span><br><span class="text-xs text-slate-500">Keep this ID. You will use it to sign in later.</span>`;
        generated.classList.remove('hidden');
        showPortal(data.record);
        showSignupPopup(data.record, data.emailSent === true, email);
      } else { const id = idInput.value.trim().toUpperCase(); if (!id) throw new Error(`Please enter your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID.`); showPortal(await getAccount(id)); }
    } catch (err) { setError(err.message || 'Unable to complete the request.'); }
    finally { button.disabled = false; button.textContent = mode === 'signup' ? 'Create workspace' : 'Enter workspace'; }
  }, true);
  signInTab.addEventListener('click', () => setMode('signin'), true); signUpTab.addEventListener('click', () => setMode('signup'), true);
  document.getElementById('logout')?.addEventListener('click', () => { localStorage.removeItem(storageKey); location.reload(); }, true);
  const local = getLocal(); if (local?.[idKey]) { showPortal(local); syncLocalAccount(local); } else setMode('signup');
})();
