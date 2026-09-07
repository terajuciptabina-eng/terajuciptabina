(() => {
  'use strict';

  if (!window.TerajuContractorProfile) return;

  const params = new URLSearchParams(window.location.search);
  const audience = (params.get('audience') || 'homeowner').toLowerCase();
  if (audience !== 'contractor') return;

  const profile = window.TerajuContractorProfile.getOrCreate();

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  function injectStyles() {
    if (document.getElementById('terajuContractorProfileStyles')) return;
    const style = document.createElement('style');
    style.id = 'terajuContractorProfileStyles';
    style.textContent = `
      #terajuContractorProfileBox{margin:16px 0;padding:18px;border:1px solid #d1d5db;border-radius:14px;background:#f8fafc}
      #terajuContractorProfileBox .tcp-title{font-size:18px;font-weight:700;margin-bottom:4px}
      #terajuContractorProfileBox .tcp-note{font-size:13px;color:#64748b;margin-bottom:14px}
      #terajuContractorProfileBox .tcp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #terajuContractorProfileBox label{display:block;font-size:13px;font-weight:600;margin-bottom:5px}
      #terajuContractorProfileBox input,#terajuContractorProfileBox select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
      #terajuContractorProfileBox .tcp-actions{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}
      #terajuContractorProfileBox button{padding:9px 14px;border:0;border-radius:9px;background:#111827;color:#fff;cursor:pointer;font-weight:600}
      #terajuContractorProfileBox .tcp-id{font-size:12px;color:#64748b}
      #terajuContractorProfileBox .tcp-saved{font-size:12px;color:#166534}
      @media(max-width:640px){#terajuContractorProfileBox .tcp-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function findAnchor() {
    return document.querySelector('main') || document.querySelector('.container') || document.body;
  }

  function render() {
    if (document.getElementById('terajuContractorProfileBox')) return;
    injectStyles();

    const box = document.createElement('section');
    box.id = 'terajuContractorProfileBox';
    box.innerHTML = `
      <div class="tcp-title">Contractor Profile</div>
      <div class="tcp-note">Maklumat ini digunakan sebagai identiti database rate kontraktor. Nama boleh diubah, tetapi Contractor ID kekal.</div>
      <div class="tcp-grid">
        <div>
          <label for="tcpContractorName">Contractor Name</label>
          <input id="tcpContractorName" type="text" maxlength="120" placeholder="Nama kontraktor / syarikat" value="${esc(profile.contractorName)}">
        </div>
        <div>
          <label for="tcpState">State / Territory</label>
          <select id="tcpState">
            <option value="">Pilih negeri / wilayah</option>
            ${window.TerajuContractorProfile.MALAYSIA_STATES.map(state => `<option value="${esc(state)}" ${state === profile.state ? 'selected' : ''}>${esc(state)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="tcp-actions">
        <button type="button" id="tcpSave">Save Contractor Profile</button>
        <span class="tcp-id">Contractor ID: <strong id="tcpId">${esc(profile.contractorId)}</strong></span>
        <span class="tcp-saved" id="tcpSaved"></span>
      </div>
    `;

    const anchor = findAnchor();
    anchor.insertBefore(box, anchor.firstChild);

    box.querySelector('#tcpSave').addEventListener('click', () => {
      const name = box.querySelector('#tcpContractorName').value.trim();
      const state = box.querySelector('#tcpState').value;
      if (!name) return alert('Sila masukkan Contractor Name.');
      if (!state) return alert('Sila pilih State / Territory.');

      const saved = window.TerajuContractorProfile.save({
        contractorId: profile.contractorId,
        contractorName: name,
        state
      });
      box.querySelector('#tcpId').textContent = saved.contractorId;
      box.querySelector('#tcpSaved').textContent = 'Profile saved.';
      window.dispatchEvent(new CustomEvent('teraju:contractor-profile-saved', { detail: saved }));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once:true });
  else render();
})();
