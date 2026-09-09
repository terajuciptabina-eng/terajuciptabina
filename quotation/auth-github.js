(() => {
  const role = document.body.dataset.role;
  if (!role) return;
  const isHomeowner = role === 'homeowner';
  const idKey = isHomeowner ? 'homeownerId' : 'contractorId';
  const storageKey = `teraju.${role}.github.v1`;
  const form = document.getElementById(isHomeowner ? 'homeownerAuth' : 'contractorLogin');
  const signInTab = document.getElementById('signInTab');
  const signUpTab = document.getElementById('signUpTab');
  const idInput = document.getElementById(isHomeowner ? 'homeownerIdInput' : 'contractorIdInput');
  const nameInput = document.getElementById(isHomeowner ? 'homeownerNameInput' : 'contractorNameInput');
  const emailInput = document.getElementById('accountEmailInput');
  const phoneInput = document.getElementById('accountPhoneInput');
  const idField = document.getElementById(isHomeowner ? 'homeownerIdField' : 'contractorIdField');
  const nameField = document.getElementById(isHomeowner ? 'homeownerNameField' : 'contractorNameField');
  const button = document.getElementById('authButton');
  const title = document.getElementById('authTitle');
  const description = document.getElementById('authDescription');
  const error = document.getElementById('authError');
  const generated = document.getElementById('authGeneratedId');
  const panel = document.getElementById('authPanel') || document.getElementById('loginPanel');
  const portal = document.getElementById('portal');
  const welcome = document.getElementById('welcome');
  const buildLink = document.getElementById('buildLink');
  const renoLink = document.getElementById('renoLink');
  let mode = 'signup';

  const getLocal = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } };
  const setLocal = record => localStorage.setItem(storageKey, JSON.stringify(record));
  const setError = message => { error.textContent = message; error.classList.remove('hidden'); };
  const clearError = () => { error.textContent = ''; error.classList.add('hidden'); };

  function setMode(next) {
    mode = next;
    clearError();
    generated.classList.add('hidden');
    const signup = next === 'signup';
    title.textContent = signup ? `Create ${isHomeowner ? 'homeowner' : 'contractor'} account` : `${isHomeowner ? 'Homeowner' : 'Contractor'} sign in`;
    description.textContent = signup
      ? `Create your ${isHomeowner ? 'home project' : 'contractor'} workspace. Your record will be saved to the temporary GitHub account store.`
      : `Enter the ${isHomeowner ? 'Homeowner' : 'Contractor'} ID generated during Sign Up.`;
    idField.classList.toggle('hidden', signup);
    nameField.classList.toggle('hidden', !signup);
    emailInput?.parentElement.classList.toggle('hidden', !signup);
    phoneInput?.parentElement.classList.toggle('hidden', !signup);
    idInput.required = !signup;
    nameInput.required = signup;
    if (emailInput) emailInput.required = signup;
    button.textContent = signup ? 'Create workspace' : 'Enter workspace';
    signInTab.className = signup ? 'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition' : 'tab-active rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 transition';
    signUpTab.className = signup ? 'tab-active rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 transition' : 'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition';
  }

  function showPortal(record) {
    setLocal(record);
    panel.classList.add('hidden');
    portal.classList.remove('hidden');
    const id = record[idKey];
    welcome.textContent = `Welcome, ${record.profile?.name || ''}. ${isHomeowner ? 'Homeowner ID' : 'Contractor ID'}: ${id}`;
    if (buildLink) buildLink.href = `buildplanner.html?audience=${role}&${encodeURIComponent(idKey)}=${encodeURIComponent(id)}`;
    if (renoLink) renoLink.href = `renovationplanner.html?audience=${role}&${encodeURIComponent(idKey)}=${encodeURIComponent(id)}`;
  }

  async function request(path, options) {
    const response = await fetch(`/terajucipabina/api/auth`, options).catch(() => null);
    if (!response) throw new Error('Unable to reach the account service.');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Account request failed.');
    return data;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearError();
    button.disabled = true;
    button.textContent = mode === 'signup' ? 'Creating…' : 'Signing in…';
    try {
      if (mode === 'signup') {
        const name = nameInput.value.trim();
        const email = emailInput?.value.trim() || '';
        const phone = phoneInput?.value.trim() || '';
        if (!name || !email) throw new Error('Name and email are required.');
        const data = await request('/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, name, email, phone })
        });
        generated.innerHTML = `<strong>Your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID:</strong><br><span class="mt-1 inline-block text-lg font-bold tracking-wide text-slate-950">${data.id}</span><br><span class="text-xs text-slate-500">Keep this ID. You will use it to sign in later.</span>`;
        generated.classList.remove('hidden');
        showPortal(data.record);
      } else {
        const id = idInput.value.trim().toUpperCase();
        if (!id) throw new Error(`Please enter your ${isHomeowner ? 'Homeowner' : 'Contractor'} ID.`);
        const data = await request(`/auth?role=${encodeURIComponent(role)}&id=${encodeURIComponent(id)}`, { method: 'GET' });
        showPortal(data);
      }
    } catch (err) {
      setError(err.message || 'Unable to complete the request.');
    } finally {
      button.disabled = false;
      button.textContent = mode === 'signup' ? 'Create workspace' : 'Enter workspace';
    }
  }, true);

  signInTab.addEventListener('click', () => setMode('signin'), true);
  signUpTab.addEventListener('click', () => setMode('signup'), true);
  document.getElementById('logout')?.addEventListener('click', () => { localStorage.removeItem(storageKey); location.reload(); }, true);

  const local = getLocal();
  if (local?.[idKey]) showPortal(local); else setMode('signup');
})();
