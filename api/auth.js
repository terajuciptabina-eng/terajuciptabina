export default async function handler(req, res) {
  const origin = 'https://terajuciptabina-eng.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ message: 'Method not allowed' });

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
  const normalizePhone = value => String(value || '').replace(/[\s().-]/g, '');
  const validPhone = value => /^(?:01\d{8,9}|\+601\d{8,9}|601\d{8,9})$/.test(normalizePhone(value));

  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      ...options,
      headers: { ...ghHeaders, ...(options.headers || {}) }
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data };
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

  try {
    if (req.method === 'GET') {
      const role = String(req.query?.role || '').toLowerCase();
      const id = String(req.query?.id || '').trim().toUpperCase();
      if (!validRole(role) || !id) return res.status(400).json({ message: 'Missing role or id.' });
      const result = await github(pathFor(role, id));
      if (result.response.status === 404) return res.status(404).json({ message: 'Account not found.' });
      if (!result.response.ok) return res.status(502).json({ message: 'Unable to read account record.' });
      const content = result.data?.content ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
      return res.status(200).json(JSON.parse(content));
    }

    const body = req.body || {};
    const role = String(body.role || '').toLowerCase();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    if (!validRole(role)) return res.status(400).json({ message: 'Invalid role.' });
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    if (!validEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!validPhone(phone)) return res.status(400).json({ message: 'Please enter a valid Malaysian phone number, e.g. 0123456789 or +60123456789.' });

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
      [idKey(role)]: id,
      profile: { name, email, phone },
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

    return res.status(201).json({ success: true, role, id, record, emailSent: emailResult.sent, emailReason: emailResult.sent ? '' : emailResult.reason });
  } catch (error) {
    console.error('auth error:', error);
    return res.status(500).json({ message: 'Unable to process account request.' });
  }
}
