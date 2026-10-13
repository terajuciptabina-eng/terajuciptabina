export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'terajuciptabina-eng/terajuciptabina';
  if (!token) return res.status(500).json({ message: 'GitHub auth storage is not configured.' });

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const validRole = role => role === 'homeowner' || role === 'contractor';
  const folder = role => role === 'homeowner' ? 'homeowners' : 'contractors';
  const idKey = role => role === 'homeowner' ? 'homeownerId' : 'contractorId';
  const makeId = role => `${role === 'homeowner' ? 'HME' : 'CTR'}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const pathFor = (role, id) => `data/users/${folder(role)}/${encodeURIComponent(id)}.json`;
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
  const normalizePhone = value => String(value || '').replace(/[\\s().-]/g, '');
  const DIAL_CODES = { MY:'60', SG:'65', ID:'62', TH:'66', PH:'63', VN:'84', BN:'673' };
  const validCountry = value => Object.prototype.hasOwnProperty.call(DIAL_CODES, String(value || '').trim().toUpperCase());
  const normalizePhoneForCountry = (value, country) => {
    const code = String(country || '').trim().toUpperCase();
    const dial = DIAL_CODES[code];
    const raw = String(value || '').trim();
    const digits = raw.replace(/\\D/g, '');
    if (!dial || !digits) return '';
    if (raw.startsWith('+')) return '+' + digits;
    if (digits.startsWith(dial)) return '+' + digits;
    return '+' + dial + digits.replace(/^0+/, '');
  };
  const validPhone = (value, country = 'MY') => {
    const code = String(country || '').trim().toUpperCase();
    const dial = DIAL_CODES[code];
    const normalized = normalizePhoneForCountry(value, code);
    if (!dial || !normalized.startsWith('+' + dial)) return false;
    const national = normalized.slice(dial.length + 1);
    if (!/^\\d{7,12}$/.test(national) || /^(\\d)\\1+$/.test(national)) return false;
    if (code === 'MY' && national === '123456789') return false;
    return true;
  };

  async function github(path, options = {}) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...ghHeaders, ...(options.headers || {}) }
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (response.ok && data && typeof data === 'object' && !Array.isArray(data) && data.content === '' && data.encoding === 'none') {
      const rawResponse = await fetch(url, {
        headers: { ...ghHeaders, Accept: 'application/vnd.github.raw+json' }
      });
      const rawText = await rawResponse.text();
      if (rawResponse.ok) data = { ...data, rawContent: rawText };
    }
    return { response, data };
  }

  function decodeGithubContent(data) {
    if (typeof data?.content === 'string' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf8');
    }
    if (typeof data?.rawContent === 'string') return data.rawContent;
    return '';
  }

  async function sendWelcomeEmail({ role, id, name, email }) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.EMAIL_FROM || '').trim();
    if (!apiKey || !from) return { sent: false, reason: 'Email service is not configured.' };

    const roleLabel = role === 'homeowner' ? 'Homeowner' : 'Contractor';
    const safeName = String(name).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    const safeId = String(id).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    const html = `<!doctype html><html><body style="margin:0;background:#f6f3ed;font-family:Arial,sans-serif;color:#1f2937"><div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><div style="padding:24px 28px;border-bottom:1px solid #e5e7eb"><strong style="font-size:20px;letter-spacing:.04em">TERAJU WORKS</strong></div><div style="padding:30px 28px"><p style="margin:0 0 14px">Hi ${safeName},</p><p style="margin:0 0 22px">Your ${roleLabel} account has been created successfully.</p><div style="padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px"><div style="font-size:13px;color:#64748b">Your ${roleLabel} ID</div><div style="margin-top:6px;font-size:25px;font-weight:700;letter-spacing:.06em;color:#111827">${safeId}</div></div><p style="margin:22px 0 0;color:#475569">Keep this ID safely. You will use it to sign in to your TERAJU WORKS workspace.</p></div></div></body></html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Your TERAJU WORKS ${roleLabel} ID: ${id}`,
        html,
        headers: { 'X-Entity-Ref-ID': `signup-${id}` }
      })
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      console.error('Welcome email failed:', data);
      return { sent: false, reason: 'Welcome email could not be sent.' };
    }
    return { sent: true, emailId: data?.id || null };
  }


  async function sendWelcomeWhatsApp({ role, id, name, phone, country }) {
    const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const configuredTemplateName = String(process.env.WHATSAPP_SIGNUP_TEMPLATE_NAME || '').trim();
    const templateName = configuredTemplateName === 'teraju_works_signup'
      ? 'teraju_works_account_confirmation'
      : configuredTemplateName;
    const templateLanguage = String(process.env.WHATSAPP_SIGNUP_TEMPLATE_LANGUAGE || 'en').trim();
    if (!token || !phoneNumberId || !templateName) {
      return { sent: false, reason: 'WhatsApp service is not configured.' };
    }

    const normalizedPhone = normalizePhone(phone);
    const recipient = normalizedPhone.startsWith('01')
      ? `60${normalizedPhone.slice(1)}`
      : normalizedPhone.replace(/^\+/, '');
    if (!/^601\d{8,9}$/.test(recipient)) {
      console.log('WhatsApp skipped: invalid recipient format', {
        last4: recipient.slice(-4)
      });
      return { sent: false, reason: 'Invalid WhatsApp recipient number.' };
    }

    console.log('WhatsApp send started', {
      recipientLast4: recipient.slice(-4),
      templateName,
      templateLanguage
    });

    const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: 'body',
            parameters: [
              {
                type: 'text',
                parameter_name: 'customer_name',
                text: String(name)
              },
              {
                type: 'text',
                parameter_name: 'account_id',
                text: String(id)
              }
            ]
          }]
        }
      })
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    console.log('WhatsApp Meta response', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      console.error('Welcome WhatsApp failed:', data);
      return { sent: false, reason: 'Welcome WhatsApp message could not be sent.' };
    }

    const messageId = data?.messages?.[0]?.id || null;
    console.log('WhatsApp send success', {
      messageId
    });

    return {
      sent: true,
      messageId
    };
  }

  try {
    if (req.method === 'GET') {
      const role = String(req.query?.role || '').toLowerCase();
      const id = String(req.query?.id || '').trim().toUpperCase();
      if (!validRole(role) || !id) return res.status(400).json({ message: 'Missing role or id.' });
      const result = await github(pathFor(role, id));
      if (result.response.status === 404) return res.status(404).json({ message: 'Account not found.' });
      if (!result.response.ok) return res.status(502).json({ message: 'Unable to read account record.' });
      const content = decodeGithubContent(result.data);
      const record = JSON.parse(content);
      // Existing accounts predate country support; treat them as Malaysia until Admin explicitly changes the account country.
      if (!record.country) record.country = 'MY';
      return res.status(200).json(record);
    }

    const body = req.body || {};
    if (req.method === 'PATCH') {
      const role = String(body.role || '').toLowerCase();
      const id = String(body.id || '').trim().toUpperCase();
      if (role !== 'contractor' || !id) return res.status(400).json({ message: 'Contractor role and ID are required.' });
      const current = await github(pathFor(role, id));
      if (current.response.status === 404) return res.status(404).json({ message: 'Account not found.' });
      if (!current.response.ok) return res.status(502).json({ message: 'Unable to read account record.' });
      const content = decodeGithubContent(current.data);
      let record;
      try { record = JSON.parse(content); } catch { return res.status(502).json({ message: 'Account record is invalid.' }); }
      const incoming = body.profile && typeof body.profile === 'object' ? body.profile : {};
      const existingProfile = record.profile && typeof record.profile === 'object' ? record.profile : {};
      const nextProfile = { ...existingProfile };
      ['name','email','phone','registrationNo','address','website','logoDataUrl','previewBrandingMode','previewBrandingConfigured','contractorProfileConfigured'].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) nextProfile[key] = incoming[key];
      });
      if (String(nextProfile.name || '').trim() === '') return res.status(400).json({ message: 'Company / contractor name is required.' });
      if (nextProfile.email && !validEmail(nextProfile.email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
      if (nextProfile.phone && !validPhone(nextProfile.phone, record.country || 'MY')) return res.status(400).json({ message: 'Please enter a valid phone number for this account country.' });
      if (nextProfile.phone) nextProfile.phone = normalizePhoneForCountry(nextProfile.phone, record.country || 'MY');
      if (String(nextProfile.logoDataUrl || '').length > 350000) return res.status(413).json({ message: 'Logo image is too large. Please use a smaller image.' });
      record.profile = nextProfile;
      if (!record.country) record.country = 'MY';
      record.updatedAt = new Date().toISOString();
      const updated = await github(pathFor(role, id), {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Update contractor profile ' + id,
          content: Buffer.from(JSON.stringify(record, null, 2) + '\n').toString('base64'),
          sha: current.data.sha
        })
      });
      if (!updated.response.ok) return res.status(502).json({ message: 'Unable to save contractor profile.' });
      return res.status(200).json({ success: true, record });
    }

    const role = String(body.role || '').toLowerCase();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const country = String(body.country || '').trim().toUpperCase();
    if (!validRole(role)) return res.status(400).json({ message: 'Invalid role.' });
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    if (!validEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!validCountry(country)) return res.status(400).json({ message: 'A supported country of registration is required.' });
    if (!validPhone(phone, country)) return res.status(400).json({ message: 'Please enter a valid phone number for the selected country.' });

    let id = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = makeId(role);
      const check = await github(pathFor(role, candidate));
      if (check.response.status === 404) { id = candidate; break; }
    }
    if (!id) return res.status(500).json({ message: 'Unable to generate a unique account ID.' });

    const record = {
      schemaVersion: 1,
      recordType: 'user-account',
      storage: 'github-temporary',
      role,
      country,
      [idKey(role)]: id,
      profile: { name, email, phone: normalizePhoneForCountry(phone, country) },
      auth: { mode: 'temporary-id', passwordStored: false },
      state: 'active',
      plannerRecords: { build: [], renovation: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await github(pathFor(role, id), {
      method: 'PUT',
      body: JSON.stringify({
        message: `Create temporary ${role} account ${id}`,
        content: Buffer.from(JSON.stringify(record, null, 2) + '\n').toString('base64')
      })
    });
    if (!created.response.ok) {
      console.error('GitHub account write failed:', created.data);
      return res.status(502).json({ message: 'Unable to save account record.' });
    }

    const emailResult = await sendWelcomeEmail({ role, id, name, email }).catch(error => {
      console.error('Welcome email error:', error);
      return { sent: false, reason: 'Welcome email could not be sent.' };
    });

    const whatsappResult = await sendWelcomeWhatsApp({ role, id, name, phone: record.profile.phone, country }).catch(error => {
      console.error('Welcome WhatsApp error:', error);
      return { sent: false, reason: 'Welcome WhatsApp message could not be sent.' };
    });

    return res.status(201).json({
      success: true,
      role,
      id,
      record,
      emailSent: emailResult.sent,
      emailReason: emailResult.sent ? '' : emailResult.reason,
      whatsappSent: whatsappResult.sent,
      whatsappReason: whatsappResult.sent ? '' : whatsappResult.reason,
      whatsappMessageId: whatsappResult.messageId || null
    });
  } catch (error) {
    console.error('auth error:', error);
    return res.status(500).json({ message: 'Unable to process account request.' });
  }
}
