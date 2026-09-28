/* USG Reporter — UI */
'use strict';

const $ = s => document.querySelector(s);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
const Bridge = window.AndroidBridge || null;

let settings = Object.assign({ inst: '', addr: '', doc: '', qual: '', reg: '', foot: '', letterhead: false, lhSpace: 35, machines: DEFAULT_MACHINES.slice() }, LS.get('usg_settings', {}));
let state = null;
let open = {};           // expanded section ids
let editedHTML = null;   // manual edits in preview

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function blankState(tpl) {
  const last = LS.get('usg_last', {});
  return { tpl, machine: last.machine || settings.machines[0] || '', patient: { name: '', age: '', sex: last.sex || 'F', pid: '', ref: '', date: today(), meno: 'Pre-menopausal', ind: '' }, secs: {}, extraImp: '' };
}
const save = () => { state._saved = false; LS.set('usg_draft', state); };

/* In-app dialogs (Android WebView silently blocks window.confirm / prompt) */
let modalDone = null;
function closeModal(result) { $('#modal').hidden = true; $('#modal').innerHTML = ''; const d = modalDone; modalDone = null; if (d) d(result); }
function ask(msg, okLabel, danger) {
  return new Promise(res => {
    modalDone = res;
    $('#modal').innerHTML = '<div class="mbox"><div class="mmsg">' + esc(msg) + '</div><div class="mact"><button class="ghostb" id="dNo">Cancel</button><button class="pri' + (danger ? ' danger' : '') + '" id="dOk">' + esc(okLabel || 'OK') + '</button></div></div>';
    $('#modal').hidden = false;
    $('#dNo').onclick = () => closeModal(false); $('#dOk').onclick = () => closeModal(true);
  });
}
function askText(title, placeholder) {
  return new Promise(res => {
    modalDone = res;
    $('#modal').innerHTML = '<div class="mbox"><div class="mh">' + esc(title) + '</div><label class="fld wide"><input type="text" id="dTxt" placeholder="' + esc(placeholder || '') + '"></label><div class="mact"><button class="ghostb" id="dNo">Cancel</button><button class="pri" id="dOk">Add</button></div></div>';
    $('#modal').hidden = false;
    const inp = $('#dTxt'); setTimeout(() => inp.focus(), 50);
    const ok = () => closeModal(inp.value.trim() || null);
    $('#dNo').onclick = () => closeModal(null); $('#dOk').onclick = ok;
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  });
}
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(modalDone ? null : undefined); };

function toast(msg) {
  if (Bridge && Bridge.toast) { Bridge.toast(msg); return; }
  const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800);
}
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== view);
  window.scrollTo(0, 0);
}

/* ================= HOME ================= */
function renderHome() {
  const draft = LS.get('usg_draft', null);
  const h = [];
  h.push('<div class="home-hd"><div><div class="app-t">USG Reporter</div><div class="app-s">Structured ultrasound reports</div></div><button class="icon" id="btnSet" title="Settings">⚙︎</button></div>');
  if (draft && draft.tpl && !draft._saved) {
    const t = TEMPLATES.find(x => x.id === draft.tpl);
    h.push('<button class="resume" id="btnResume"><span>Resume draft</span><b>' + esc(t ? t.title : '') + (draft.patient.name ? ' · ' + esc(draft.patient.name) : '') + '</b></button>');
  }
  // iPhone/iPad Safari, not yet installed: show how to add to the home screen
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!Bridge && iOS && !navigator.standalone && location.protocol.startsWith('http') && !LS.get('usg_hint_off', false)) {
    h.push('<div class="hint"><b>Install on your iPhone:</b> in Safari tap <b>Share</b> → scroll down → <b>Add to Home Screen</b>. Not listed? Scroll to the bottom → <b>Edit Actions</b> → add it. ' +
      '<span class="muted">Must be opened in Safari itself (not inside WhatsApp / Gmail / Chrome).</span><button class="x" id="hintX">✕</button></div>');
  }
  h.push('<div class="h-lab">New report</div><div class="tgrid">');
  TEMPLATES.forEach(t => h.push('<button class="tcard" data-t="' + t.id + '"><span class="ti">' + t.icon + '</span><span>' + esc(t.title) + '</span></button>'));
  h.push('</div>');
  const hist = LS.get('usg_hist', []);
  h.push('<div class="h-lab">Saved reports (' + hist.length + ')</div>');
  if (!hist.length) h.push('<div class="muted pad">Saved reports appear here.</div>');
  h.push('<div class="hist">' + hist.slice().reverse().map(r => '<div class="hrow" data-id="' + r.id + '"><div class="hmain"><b>' + esc(r.state.patient.name || 'Unnamed') + '</b><span>' + esc(TEMPLATES.find(t => t.id === r.state.tpl).title) + ' · ' + fmtDate(r.state.patient.date) + '</span></div><button class="sm" data-act="open">Open</button><button class="sm ghost" data-act="del">✕</button></div>').join('') + '</div>');
  $('#home').innerHTML = h.join('');
  $('#btnSet').onclick = openSettings;
  if ($('#hintX')) $('#hintX').onclick = () => { LS.set('usg_hint_off', true); renderHome(); };
  if ($('#btnResume')) $('#btnResume').onclick = () => { state = draft; editedHTML = null; open = {}; renderBuilder(); show('builder'); };
  document.querySelectorAll('.tcard').forEach(b => b.onclick = async () => {
    if (draft && draft.tpl && !draft._saved && !(await ask('Start a new report? The unsaved draft will be discarded.', 'Start new', true))) return;
    state = blankState(b.dataset.t); editedHTML = null; open = {}; save(); renderBuilder(); show('builder');
  });
  document.querySelectorAll('.hrow').forEach(row => row.querySelectorAll('button').forEach(b => b.onclick = async () => {
    const all = LS.get('usg_hist', []), rec = all.find(r => r.id === row.dataset.id);
    if (b.dataset.act === 'del') { if (await ask('Delete this saved report?', 'Delete', true)) { LS.set('usg_hist', all.filter(r => r.id !== rec.id)); renderHome(); } return; }
    if (draft && draft.tpl && !draft._saved && draft._hid !== rec.id && !(await ask('You have an unsaved draft. Open this saved report and discard the draft?', 'Open', true))) return;
    state = JSON.parse(JSON.stringify(rec.state)); state._hid = rec.id; state._saved = true; editedHTML = rec.html || null;
    LS.set('usg_draft', state); renderPreview(); show('preview');
  }));
}

/* ================= BUILDER ================= */
function fieldHTML(f, val, path) {
  const d = 'data-p="' + path + '"';
  const u = f.u ? '<span class="u">' + esc(f.u) + '</span>' : '';
  switch (f.t) {
    case 'num': return '<label class="fld"><span>' + esc(f.l) + '</span><span class="inw"><input type="number" inputmode="decimal" step="any" ' + d + ' value="' + esc(val) + '">' + u + '</span></label>';
    case 'txt': return '<label class="fld wide"><span>' + esc(f.l) + '</span><input type="text" ' + d + ' value="' + esc(val) + '"></label>';
    case 'dims': { const a = Array.isArray(val) ? val : ['', '', ''];
      return '<label class="fld wide"><span>' + esc(f.l) + '</span><span class="inw dims">' + [0, 1, 2].map(i => '<input type="number" inputmode="decimal" step="any" data-p="' + path + '" data-i="' + i + '" value="' + esc(a[i] || '') + '">').join('<i>×</i>') + u + '</span></label>'; }
    case 'sel':
      if (f.o.length <= 5 && f.o.every(o => o && o.length <= 16))
        return '<div class="fld' + (f.o.join('').length > 18 ? ' wide' : '') + '"><span>' + esc(f.l) + '</span><div class="seg">' + f.o.map(o => '<button data-seg="' + path + '" data-o="' + esc(o) + '" class="' + (o === val ? 'on' : '') + '">' + esc(o) + '</button>').join('') + '</div></div>';
      return '<label class="fld' + (f.o.some(o => o.length > 22) ? ' wide' : '') + '"><span>' + esc(f.l) + '</span><select ' + d + '>' + f.o.map(o => '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o || '—') + '</option>').join('') + '</select></label>';
    case 'chk': return '<button class="chip tog' + (val ? ' on' : '') + '" data-chk="' + path + '">' + esc(f.l) + '</button>';
    case 'multi': return '<div class="fld wide"><span>' + esc(f.l) + '</span><div class="chips">' + f.o.map(o => '<button class="chip tog' + ((val || []).includes(o) ? ' on' : '') + '" data-multi="' + path + '" data-o="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div></div>';
    case 'vtab': return vtabHTML(path);
  }
  return '';
}
function vtabHTML(path) {
  const m = path.split('|'); const st = secState(state, m[0]).m;
  const cell = (sd, vs, k) => '<input type="number" inputmode="decimal" step="any" data-p="' + m[0] + '|m|vt_' + sd + '_' + vs + '_' + k + '" value="' + esc(st['vt_' + sd + '_' + vs + '_' + k] || '') + '">';
  return '<div class="vtab"><table><tr><th></th><th colspan="2">RIGHT</th><th colspan="2">LEFT</th></tr><tr><th></th><th>PSV</th><th>EDV</th><th>PSV</th><th>EDV</th></tr>' +
    VESSELS.map(vs => '<tr><td>' + vs + '</td><td>' + cell('R', vs, 'ps') + '</td><td>' + cell('R', vs, 'ed') + '</td><td>' + cell('L', vs, 'ps') + '</td><td>' + cell('L', vs, 'ed') + '</td></tr>').join('') +
    '</table><div class="muted small">ICA grading auto-applied per SRU consensus: PSV &lt;125 (with plaque) → &lt;50%; 125–230 → 50–69%; &gt;230 → ≥70%.</div></div>';
}

function secHTML(sec) {
  const st = secState(state, sec.id);
  const isOpen = !!open[sec.id];
  const nf = st.items.length;
  const r = buildSection(state, sec);
  const abnormal = nf || r.imps.length && !(sec.impN && r.imps.length === 1 && r.imps[0] === sec.impN(makeCtx(state, sec, st)));
  let h = '<section class="sec' + (isOpen ? ' open' : '') + '" data-sec="' + sec.id + '">';
  h += '<header data-tog="' + sec.id + '"><span class="sn">' + esc(sec.name) + '</span><span class="badge ' + (abnormal ? 'ab' : 'nm') + '">' + (nf ? nf + ' finding' + (nf > 1 ? 's' : '') : abnormal ? 'auto' : 'Normal') + '</span><span class="car">' + (isOpen ? '▾' : '▸') + '</span></header>';
  if (isOpen) {
    h += '<div class="sb">';
    if (sec.meas.length) h += '<div class="meas">' + sec.meas.map(f => fieldHTML(f, st.m[f.k], sec.id + '|m|' + f.k)).join('') + '</div>';
    if (st.items.length) {
      h += '<div class="items">' + st.items.map((it, idx) => {
        const fd = sec.fd.find(f => f.id === it.fid);
        const total = st.items.filter(o => o.fid === it.fid).length;
        const nth = st.items.slice(0, idx + 1).filter(o => o.fid === it.fid).length;
        const isLast = !st.items.slice(idx + 1).some(o => o.fid === it.fid);
        let extra = '';
        if (it.fid === 'nodule') { const t = tirads(it.v); extra = '<span class="tr tr' + t.tr + '">' + t.p + ' pts · ' + t.name + (it.collapsed ? '' : ' · ' + t.rec) + '</span>'; }
        const title = fd.rep && total > 1 ? fd.l.replace(/ \(.*\)$/, '') + ' ' + nth : fd.l;
        const sum = it.collapsed ? itemSummary(fd, it.v) : '';
        let out = '<div class="item' + (it.collapsed ? ' col' : '') + '"><div class="ih">' +
          (fd.fs.length ? '<button class="ct" data-col="' + sec.id + '|' + idx + '">' + (it.collapsed ? '▸' : '▾') + '</button>' : '') +
          '<b data-col="' + sec.id + '|' + idx + '">' + esc(title) + '</b>' + extra +
          (fd.rep ? '<button class="dup" data-dup="' + sec.id + '|' + idx + '" title="Duplicate">⧉</button>' : '') +
          '<button class="x" data-rm="' + sec.id + '|' + idx + '">✕</button></div>' +
          (it.collapsed ? (sum ? '<div class="isum">' + esc(sum) + '</div>' : '') :
            (fd.fs.length ? '<div class="ifs">' + fd.fs.map(f => fieldHTML(f, it.v[f.k], sec.id + '|i|' + idx + '|' + f.k)).join('') + '</div>' : '')) + '</div>';
        if (fd.rep && isLast) out += '<button class="another" data-another="' + sec.id + '|' + fd.id + '">+ Add another ' + esc(lc(fd.l.replace(/ \(.*\)$/, ''))) + '</button>';
        return out;
      }).join('') + '</div>';
    }
    if (sec.fd.length) {
      h += '<div class="add-l">Add finding</div><div class="chips add">' + sec.fd.map(fd => {
        const on = st.items.some(i => i.fid === fd.id);
        return '<button class="chip' + (on ? ' sel' : '') + '" data-add="' + sec.id + '|' + fd.id + '">' + (on && fd.rep ? '+ ' : '') + esc(fd.l) + '</button>';
      }).join('') + '</div>';
    }
    h += '<label class="fld wide note"><span>Additional remarks (appended)</span><textarea rows="2" data-p="' + sec.id + '|note">' + esc(st.note || '') + '</textarea></label>';
    h += '<div class="prev"><div class="pl">Report text</div>' + (sec.lab ? '<b>' + esc(sec.lab) + ' :</b> ' : '') + esc(r.text) + (r.imps.length ? '<div class="pi">→ ' + r.imps.map(i => esc(typeof i === 'string' ? i : i.f(i.side === 'R' ? 'right kidney' : 'left kidney'))).join('<br>→ ') + '</div>' : '') + '</div>';
    h += '</div>';
  }
  return h + '</section>';
}

async function addMachine() {
  const v = await askText('Add machine', 'e.g. Philips EPIQ 7');
  if (!v) return;
  if (!settings.machines.includes(v)) { settings.machines.push(v); LS.set('usg_settings', settings); }
  state.machine = v; LS.set('usg_last', Object.assign(LS.get('usg_last', {}), { machine: v })); save(); renderBuilder(); toast('Machine added');
}

// new instance of a repeatable finding: collapse the earlier ones and insert after the last of its kind
function addInstance(st, fd) {
  let last = -1;
  st.items.forEach((o, i) => { if (o.fid === fd.id) { o.collapsed = true; last = i; } });
  const it = newItem(fd);
  if (last >= 0) st.items.splice(last + 1, 0, it); else st.items.push(it);
}

function itemSummary(fd, v) {
  const bits = [];
  fd.fs.forEach(f => { const x = v[f.k];
    if (f.t === 'dims') { const d = dims(x); if (d) bits.push(d + ' ' + (f.u || '')); }
    else if (f.t === 'multi') { if (x && x.length) bits.push(x.join(', ')); }
    else if (f.t === 'chk') { if (x) bits.push(f.l); }
    else if (has(x)) bits.push(x + (f.u ? ' ' + f.u : '')); });
  return bits.slice(0, 6).join(' · ');
}

function renderBuilder() {
  const tpl = TEMPLATES.find(t => t.id === state.tpl);
  const p = state.patient;
  const mach = settings.machines.slice(); if (state.machine && !mach.includes(state.machine)) mach.push(state.machine);
  let h = '<div class="bar"><button class="icon" id="bBack">‹</button><div class="bt">' + esc(tpl.title) + '</div><button class="pri" id="bPrev">Preview</button></div>';
  h += '<div class="card pt-card"><div class="grid2">' +
    '<label class="fld wide"><span>Patient name</span><input type="text" data-pt="name" value="' + esc(p.name) + '"></label>' +
    '<label class="fld"><span>Age</span><input type="text" inputmode="numeric" data-pt="age" value="' + esc(p.age) + '"></label>' +
    '<div class="fld"><span>Sex</span><div class="seg"><button data-sex="F" class="' + (p.sex === 'F' ? 'on' : '') + '">Female</button><button data-sex="M" class="' + (p.sex === 'M' ? 'on' : '') + '">Male</button></div></div>' +
    (p.sex === 'F' && tpl.secs.includes('uterus') ? '<label class="fld"><span>Menopausal status</span><select data-pt="meno">' + ['Pre-menopausal', 'Post-menopausal'].map(o => '<option' + (p.meno === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>' : '') +
    '<label class="fld"><span>Patient ID</span><input type="text" data-pt="pid" value="' + esc(p.pid) + '"></label>' +
    '<label class="fld"><span>Date</span><input type="date" data-pt="date" value="' + esc(p.date) + '"></label>' +
    '<label class="fld wide"><span>Ref. by</span><input type="text" data-pt="ref" value="' + esc(p.ref) + '"></label>' +
    '<div class="fld wide"><span>Machine</span><div class="inw"><select id="mach">' + mach.map(m => '<option' + (m === state.machine ? ' selected' : '') + '>' + esc(m) + '</option>').join('') + '<option value="">— none (omit line) —</option><option value="__add">+ Add machine…</option></select><button class="ghostb addm" id="machAdd">+ Add</button></div></div>' +
    '<label class="fld wide"><span>Clinical details (optional)</span><input type="text" data-pt="ind" value="' + esc(p.ind) + '"></label>' +
    '</div></div>';
  h += '<div class="secs">' + activeSections(state).map(secHTML).join('') + '</div>';
  h += '<div class="card"><label class="fld wide"><span>Additional impression lines (one per line)</span><textarea rows="2" id="extraImp">' + esc(state.extraImp || '') + '</textarea></label></div>';
  h += '<div class="bottom-pad"></div><button class="fab" id="fabPrev">Preview report ›</button>';
  $('#builder').innerHTML = h;
  bindBuilder();
}

function rerenderSec(id) {
  const el = document.querySelector('.sec[data-sec="' + id + '"]');
  if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = secHTML(SECTIONS[id]);
  el.replaceWith(tmp.firstChild);
  bindBuilder();
}
function refreshPreviews(id) {
  // update preview/badge only without re-rendering inputs (keeps focus while typing)
  const el = document.querySelector('.sec[data-sec="' + id + '"]');
  if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = secHTML(SECTIONS[id]);
  const n = tmp.firstChild;
  const a = el.querySelector('.prev'), b = n.querySelector('.prev'); if (a && b) a.replaceWith(b);
  el.querySelector('.badge').replaceWith(n.querySelector('.badge'));
  const trs = n.querySelectorAll('.tr'), old = el.querySelectorAll('.tr'); old.forEach((o, i) => trs[i] && o.replaceWith(trs[i]));
}
function setPath(path, value, idx) {
  const [sid, kind, a, b] = path.split('|');
  const st = secState(state, sid);
  if (kind === 'note') { st.note = value; return sid; }
  const obj = kind === 'm' ? st.m : st.items[+a].v;
  const key = kind === 'm' ? a : b;
  if (idx !== undefined) { if (!Array.isArray(obj[key])) obj[key] = ['', '', '']; obj[key][idx] = value; }
  else obj[key] = value;
  return sid;
}
function bindBuilder() {
  const B = $('#builder');
  $('#bBack').onclick = () => { save(); renderHome(); show('home'); };
  $('#bPrev').onclick = $('#fabPrev').onclick = () => { save(); editedHTML = null; renderPreview(); show('preview'); };
  B.querySelectorAll('[data-pt]').forEach(el => el.oninput = el.onchange = () => { state.patient[el.dataset.pt] = el.value; save(); if (el.dataset.pt === 'meno') activeSections(state).forEach(s => open[s.id] && refreshPreviews(s.id)); });
  B.querySelectorAll('[data-sex]').forEach(el => el.onclick = () => { state.patient.sex = el.dataset.sex; LS.set('usg_last', Object.assign(LS.get('usg_last', {}), { sex: el.dataset.sex })); save(); renderBuilder(); });
  $('#machAdd').onclick = addMachine;
  $('#mach').onchange = e => {
    let v = e.target.value;
    if (v === '__add') { e.target.value = state.machine; addMachine(); return; }
    state.machine = v; LS.set('usg_last', Object.assign(LS.get('usg_last', {}), { machine: v })); save(); renderBuilder();
  };
  $('#extraImp').oninput = e => { state.extraImp = e.target.value; save(); };
  B.querySelectorAll('[data-tog]').forEach(el => el.onclick = () => { const id = el.dataset.tog; open[id] = !open[id]; rerenderSec(id); });
  B.querySelectorAll('input[data-p], textarea[data-p]').forEach(el => el.oninput = () => {
    const sid = setPath(el.dataset.p, el.value, el.dataset.i !== undefined ? +el.dataset.i : undefined); save(); refreshPreviews(sid);
  });
  B.querySelectorAll('select[data-p]').forEach(el => el.onchange = () => { const sid = setPath(el.dataset.p, el.value); save(); refreshPreviews(sid); });
  B.querySelectorAll('[data-seg]').forEach(el => el.onclick = () => { const sid = setPath(el.dataset.seg, el.dataset.o); save(); rerenderSec(sid); });
  B.querySelectorAll('[data-chk]').forEach(el => el.onclick = () => {
    const [sid, , a, b] = el.dataset.chk.split('|'); const v = secState(state, sid).items[+a].v; v[b] = !v[b]; save(); rerenderSec(sid);
  });
  B.querySelectorAll('[data-multi]').forEach(el => el.onclick = () => {
    const [sid, , a, b] = el.dataset.multi.split('|'); const v = secState(state, sid).items[+a].v;
    const arr = v[b] = v[b] || []; const o = el.dataset.o; const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); else arr.push(o); save(); rerenderSec(sid);
  });
  B.querySelectorAll('[data-add]').forEach(el => el.onclick = () => {
    const [sid, fid] = el.dataset.add.split('|'); const sec = SECTIONS[sid], fd = sec.fd.find(f => f.id === fid), st = secState(state, sid);
    const exists = st.items.findIndex(i => i.fid === fid);
    if (exists >= 0 && !fd.rep) { st.items.splice(exists, 1); } else addInstance(st, fd);
    save(); rerenderSec(sid);
  });
  B.querySelectorAll('[data-another]').forEach(el => el.onclick = () => {
    const [sid, fid] = el.dataset.another.split('|'); addInstance(secState(state, sid), SECTIONS[sid].fd.find(f => f.id === fid)); save(); rerenderSec(sid);
  });
  B.querySelectorAll('[data-dup]').forEach(el => el.onclick = () => {
    const [sid, idx] = el.dataset.dup.split('|'); const st = secState(state, sid);
    st.items.forEach(o => { if (o.fid === st.items[+idx].fid) o.collapsed = true; });
    const copy = JSON.parse(JSON.stringify(st.items[+idx])); copy.uid = Math.random().toString(36).slice(2, 9); copy.collapsed = false;
    st.items.splice(+idx + 1, 0, copy); save(); rerenderSec(sid); toast('Duplicated – edit size / location');
  });
  B.querySelectorAll('[data-col]').forEach(el => el.onclick = () => {
    const [sid, idx] = el.dataset.col.split('|'); const it = secState(state, sid).items[+idx]; it.collapsed = !it.collapsed; save(); rerenderSec(sid);
  });
  B.querySelectorAll('[data-rm]').forEach(el => el.onclick = () => { const [sid, idx] = el.dataset.rm.split('|'); secState(state, sid).items.splice(+idx, 1); save(); rerenderSec(sid); });
}

/* ================= PREVIEW ================= */
function renderPreview() {
  let h = '<div class="bar"><button class="icon" id="pBack">‹</button><div class="bt">Report</div><button class="ghostb" id="pEdit">Edit text</button><button class="icon" id="pHome" title="Home">⌂</button></div>';
  h += '<div class="paper"><div id="rep" spellcheck="false">' + (editedHTML || reportHTML(state, settings)) + '</div></div>';
  h += '<div class="actions"><button id="aCopy">Copy</button><button id="aShare">Share</button><button id="aPrint" class="pri">Print / PDF</button><button id="aSave">Save</button></div>';
  $('#preview').innerHTML = h;
  const rep = $('#rep');
  $('#pBack').onclick = async () => {
    if (editedHTML && !(await ask('Going back to the builder discards the manual text edits. Continue?', 'Discard edits', true))) return;
    editedHTML = null; renderBuilder(); show('builder');
  };
  $('#pHome').onclick = () => { renderHome(); show('home'); };
  $('#pEdit').onclick = () => {
    const on = rep.contentEditable !== 'true'; rep.contentEditable = on; rep.classList.toggle('editing', on);
    $('#pEdit').textContent = on ? 'Done' : 'Edit text'; if (on) rep.focus(); else editedHTML = rep.innerHTML;
  };
  rep.oninput = () => { editedHTML = rep.innerHTML; state._saved = false; LS.set('usg_draft', state); };
  const text = () => rep.innerText.replace(/\n{3,}/g, '\n\n').trim();
  $('#aCopy').onclick = () => {
    if (Bridge) { Bridge.copy(text()); return; }
    const t = text();
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); toast(ok ? 'Report copied' : 'Copy failed'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => toast('Report copied'), fallback); else fallback();
  };
  $('#aShare').onclick = () => {
    if (Bridge) { Bridge.share(text(), fileTitle()); return; }
    if (navigator.share) navigator.share({ title: fileTitle(), text: text() }).catch(() => {}); else $('#aCopy').onclick();
  };
  $('#aPrint').onclick = () => {
    const doc = printDoc(rep.innerHTML);
    if (Bridge) { Bridge.print(doc, fileTitle()); return; }
    // iOS / browsers: print the on-page report via print CSS (popups are blocked in home-screen apps).
    // In the iOS print sheet, pinch-out on the preview (or Share → Save to Files) to get a PDF.
    const t0 = document.title; document.title = fileTitle(); window.print(); setTimeout(() => { document.title = t0; }, 1000);
  };
  $('#aSave').onclick = () => {
    const all = LS.get('usg_hist', []);
    const id = state._hid || Date.now().toString(36);
    state._hid = id;
    const rec = { id, state: JSON.parse(JSON.stringify(Object.assign({}, state, { _saved: true }))), html: editedHTML };
    const i = all.findIndex(r => r.id === id); if (i >= 0) all[i] = rec; else all.push(rec);
    LS.set('usg_hist', all.slice(-300)); state._saved = true; LS.set('usg_draft', state); toast('Report saved');
  };
}
function fileTitle() { const p = state.patient; return ('USG ' + TEMPLATES.find(t => t.id === state.tpl).title + ' ' + (p.name || '') + ' ' + fmtDate(p.date)).trim(); }
function printDoc(inner) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(fileTitle()) + '</title><style>' + REPORT_CSS + '@page{size:A4;margin:14mm 16mm}body{margin:0}</style></head><body>' + inner + '</body></html>';
}

/* ================= SETTINGS ================= */
function openSettings() {
  const s = settings;
  $('#modal').innerHTML = '<div class="mbox"><div class="mh">Settings</div>' +
    '<label class="fld wide"><span>Hospital / centre name</span><input id="sInst" value="' + esc(s.inst) + '"></label>' +
    '<label class="fld wide"><span>Address line</span><input id="sAddr" value="' + esc(s.addr) + '"></label>' +
    '<button class="chip tog' + (s.letterhead ? ' on' : '') + '" id="sLh">Printing on pre-printed letterhead (leave top space)</button>' +
    '<label class="fld"><span>Top space (mm)</span><input type="number" id="sLhs" value="' + esc(s.lhSpace) + '"></label>' +
    '<label class="fld wide"><span>Reporting doctor</span><input id="sDoc" value="' + esc(s.doc) + '"></label>' +
    '<label class="fld wide"><span>Qualification / designation</span><input id="sQual" value="' + esc(s.qual) + '"></label>' +
    '<label class="fld wide"><span>Registration no.</span><input id="sReg" value="' + esc(s.reg) + '"></label>' +
    '<label class="fld wide"><span>Footer note</span><input id="sFoot" value="' + esc(s.foot) + '" placeholder="e.g. Kindly correlate clinically."></label>' +
    '<label class="fld wide"><span>Machines (one per line)</span><textarea id="sMach" rows="4">' + esc(s.machines.join('\n')) + '</textarea></label>' +
    (Bridge ? '' : '<div class="fld wide"><span>Backup (saved reports + settings)</span><div class="inw"><button class="ghostb" id="sExp">Export backup</button><label class="ghostb filel">Restore backup<input type="file" id="sImp" accept=".json,application/json" hidden></label></div></div>') +
    '<div class="mact"><button class="ghostb" id="sCancel">Cancel</button><button class="pri" id="sOk">Save</button></div></div>';
  $('#modal').hidden = false;
  let lh = s.letterhead;
  $('#sLh').onclick = e => { lh = !lh; e.target.classList.toggle('on', lh); };
  $('#sCancel').onclick = () => closeModal();
  if ($('#sExp')) $('#sExp').onclick = exportBackup;
  if ($('#sImp')) $('#sImp').onchange = e => importBackup(e.target.files[0]);
  $('#sOk').onclick = () => {
    Object.assign(settings, { inst: $('#sInst').value, addr: $('#sAddr').value, letterhead: lh, lhSpace: $('#sLhs').value, doc: $('#sDoc').value, qual: $('#sQual').value, reg: $('#sReg').value, foot: $('#sFoot').value,
      machines: $('#sMach').value.split('\n').map(x => x.trim()).filter(Boolean) });
    LS.set('usg_settings', settings); closeModal(); toast('Settings saved'); if (!$('#builder').hidden) renderBuilder();
  };
}

/* ================= BACKUP ================= */
async function exportBackup() {
  const data = JSON.stringify({ app: 'usg-reporter', v: 1, at: new Date().toISOString(), settings, hist: LS.get('usg_hist', []) });
  const name = 'USG-Reporter-backup-' + today() + '.json';
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function importBackup(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    let d; try { d = JSON.parse(r.result); } catch (e) { toast('Not a valid backup file'); return; }
    if (!d || d.app !== 'usg-reporter') { toast('Not a USG Reporter backup'); return; }
    if (!(await ask('Restore ' + (d.hist || []).length + ' saved reports and settings? Reports with the same ID are replaced; others are kept.', 'Restore'))) return;
    const cur = LS.get('usg_hist', []); const ids = new Set((d.hist || []).map(x => x.id));
    LS.set('usg_hist', cur.filter(x => !ids.has(x.id)).concat(d.hist || []));
    if (d.settings) { settings = Object.assign(settings, d.settings); LS.set('usg_settings', settings); }
    renderHome(); show('home'); toast('Backup restored');
  };
  r.readAsText(f);
}

/* Android back button */
window.__onBack = function () {
  if (!$('#modal').hidden) { closeModal(modalDone ? null : undefined); return true; }
  if (!$('#preview').hidden) { $('#pBack').onclick(); return true; }
  if (!$('#builder').hidden) { $('#bBack').onclick(); return true; }
  return false;
};

renderHome(); show('home');

/* Offline support when served over http(s) (iOS / browser install); not used inside the Android shell */
if (!Bridge && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
