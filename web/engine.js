/* USG Reporter — report engine (pure, no DOM). Builds report blocks + impression from state. */
'use strict';

function fieldDefault(f) {
  if ('d' in f) return f.d;
  if (f.t === 'sel') return f.o[0];
  if (f.t === 'multi') return [];
  if (f.t === 'chk') return false;
  if (f.t === 'dims') return ['', '', ''];
  return '';
}
function newItem(fd) {
  const v = {};
  fd.fs.forEach(f => { v[f.k] = fieldDefault(f); });
  Object.assign(v, fd.d || {});
  return { fid: fd.id, v, uid: Math.random().toString(36).slice(2, 9) };
}

function activeSections(state) {
  const tpl = TEMPLATES.find(t => t.id === state.tpl);
  return tpl.secs.map(id => SECTIONS[id]).filter(s => !s.sex || s.sex === state.patient.sex);
}
function secState(state, id) {
  if (!state.secs[id]) state.secs[id] = { m: {}, items: [], note: '' };
  return state.secs[id];
}
const sideHit = (val, sd) => val === 'Bilateral' || val === S[sd];

function makeCtx(state, sec, st, extra) {
  const items = st.items;
  const ids = items.map(it => it.fid);
  return Object.assign({
    sex: state.patient.sex, meno: state.patient.meno,
    has: id => ids.includes(id),
    hasAny: a => a.some(id => ids.includes(id)),
    count: id => ids.filter(x => x === id).length,
    first: () => true,
    sides: () => {
      const r = { R: false, L: false };
      items.forEach(it => { const fd = sec.fd.find(f => f.id === it.fid); if (fd && fd.side && it.v.side) { if (sideHit(it.v.side, 'R')) r.R = true; if (sideHit(it.v.side, 'L')) r.L = true; } });
      return r;
    },
    all: {
      hasSide: (fid, sd) => activeSections(state).some(s => (state.secs[s.id] || { items: [] }).items.some(it => it.fid === fid && sideHit(it.v.side, sd))),
    },
  }, extra || {});
}

/** Returns {text, imps:[...], table?} for a section */
function buildSection(state, sec) {
  const st = secState(state, sec.id);
  const m = st.m;
  const ctx = makeCtx(state, sec, st);
  const autos = sec.auto ? sec.auto(m, ctx) : [];
  ctx.autoSig = autos.some(a => a.sig);

  // emitters: selected findings + automatic (measurement-driven) findings
  const em = st.items.map((it, idx) => {
    const fd = sec.fd.find(f => f.id === it.fid);
    if (!fd) return null;
    const firstIdx = st.items.findIndex(o => o.fid === it.fid);
    const lastIdx = st.items.map(o => o.fid).lastIndexOf(it.fid);
    const nth = st.items.slice(0, idx + 1).filter(o => o.fid === it.fid).length;
    const c = Object.assign({}, ctx, { first: () => idx === lastIdx, isFirst: idx === firstIdx, n: nth });
    let t = '', i = null;
    try { t = fd.t(it.v, m, c); } catch (e) { t = '[' + fd.l + ']'; console.error(e); }
    try { i = fd.i ? fd.i(it.v, m, c) : null; } catch (e) { console.error(e); }
    return { x: fd.x || [], at: fd.at, t, i, done: false };
  }).filter(Boolean).concat(autos.map(a => ({ x: a.x || [], t: a.t || '', i: a.i || null, done: false })));

  const parts = [];
  sec.cl.forEach(cl => {
    em.filter(e => e.at === cl.k && !e.done).forEach(e => { parts.push(e.t); e.done = true; });
    const over = em.filter(e => e.x.includes(cl.k));
    if (over.length) over.forEach(e => { if (!e.done) { parts.push(e.t); e.done = true; } });
    else parts.push(cl.t(m, ctx));
  });
  em.forEach(e => { if (!e.done) { parts.push(e.t); e.done = true; } });
  if (st.note && st.note.trim()) parts.push(st.note.trim());
  const text = parts.filter(p => p && p.trim()).map(p => p.replace(/^ +| +$/g, '')).join(' ').replace(/ ?\n ?/g, '\n');

  let imps = [];
  em.forEach(e => { if (e.i) imps = imps.concat(e.i); });
  if (!imps.length && sec.impN) { const n = sec.impN(ctx); if (n) imps.push(n); }

  let table = null;
  if (sec.meas.some(f => f.t === 'vtab')) {
    const hasAny = Object.keys(m).some(k => k.startsWith('vt_') && has(m[k]));
    table = { hasAny, rows: VESSELS.map(vs => [vs, ...['R', 'L'].map(sd => {
      const p = m['vt_' + sd + '_' + vs + '_ps'], e = m['vt_' + sd + '_' + vs + '_ed'];
      return has(p) || has(e) ? (has(p) ? p : '–') + ' / ' + (has(e) ? e : '–') : '';
    })]) };
  }
  return { text, imps, table };
}

function mergeImps(list) {
  const out = [], groups = {};
  list.forEach(x => {
    if (x && typeof x === 'object') {
      if (!groups[x.key]) { groups[x.key] = { obj: x, sides: new Set() }; out.push(groups[x.key]); }
      groups[x.key].sides.add(x.side);
    } else if (x && !out.includes(x)) out.push(x);
  });
  return out.map(o => {
    if (typeof o === 'string') return o;
    const s = o.sides;
    return o.obj.f(s.has('R') && s.has('L') ? 'both kidneys' : s.has('R') ? 'right kidney' : 'left kidney');
  });
}

function buildReport(state) {
  const tpl = TEMPLATES.find(t => t.id === state.tpl);
  const blocks = [];
  let imps = [];
  activeSections(state).forEach(sec => {
    const r = buildSection(state, sec);
    if (r.text || sec.lab) blocks.push({ lab: sec.lab, text: r.text, table: r.table });
    imps = imps.concat(r.imps);
  });
  imps = mergeImps(imps);
  if (!imps.length && tpl.normalImp) imps.push(tpl.normalImp);
  (state.extraImp || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(s => imps.push(s));
  return { tpl, blocks, imps };
}

/* ---------- renderers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const nl = s => esc(s).replace(/\n/g, '<br>');

function fmtDate(d) {
  if (!d) return '';
  const [y, mo, da] = d.split('-');
  return da + '/' + mo + '/' + y;
}

function reportHTML(state, settings) {
  const R = buildReport(state), p = state.patient;
  const age = [p.age ? p.age + (/[a-z]/i.test(p.age) ? '' : ' Y') : '', p.sex === 'F' ? 'F' : 'M'].filter(Boolean).join(' / ');
  let h = '<div class="rep">';
  if (settings.letterhead) h += '<div class="lh-space" style="height:' + (+settings.lhSpace || 35) + 'mm"></div>';
  else if (settings.inst) h += '<div class="inst"><div class="inst-name">' + esc(settings.inst) + '</div>' + (settings.addr ? '<div class="inst-addr">' + esc(settings.addr) + '</div>' : '') + '</div>';
  h += '<table class="pt"><tr><td><b>Name:</b> ' + esc(p.name) + '</td><td><b>Age / Sex:</b> ' + esc(age) + '</td></tr>' +
    '<tr><td><b>Patient ID:</b> ' + esc(p.pid) + '</td><td><b>Date:</b> ' + esc(fmtDate(p.date)) + '</td></tr>' +
    '<tr><td colspan="2"><b>Ref. by:</b> ' + esc(p.ref) + '</td></tr></table>';
  h += '<div class="ttl">' + esc(R.tpl.heading) + '</div>';
  if (state.machine) h += '<div class="mach">(Realtime imaging using probes of ' + esc(state.machine) + ')</div>';
  if (p.ind) h += '<div class="ind"><b>Clinical details:</b> ' + esc(p.ind) + '</div>';
  h += '<table class="fx">';
  R.blocks.forEach(b => {
    if (b.lab) h += '<tr><td class="lab">' + esc(b.lab) + '</td><td class="col">:</td><td>' + nl(b.text) + '</td></tr>';
    else if (b.text) h += '<tr><td colspan="3" class="nar">' + nl(b.text) + '</td></tr>';
    if (b.table && b.table.hasAny) {
      h += '<tr><td colspan="3"><table class="vt"><tr><th></th><th>RIGHT<br><small>PS / EDV (cm/s)</small></th><th>LEFT<br><small>PS / EDV (cm/s)</small></th></tr>' +
        b.table.rows.map(r => '<tr><td><b>' + r[0] + '</b></td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</table></td></tr>';
    }
  });
  h += '</table>';
  h += '<div class="imp-h">IMPRESSION</div><ul class="imp">' + R.imps.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
  if (settings.doc) h += '<div class="sig"><div class="sig-name">' + esc(settings.doc) + '</div>' + (settings.qual ? '<div>' + esc(settings.qual) + '</div>' : '') + (settings.reg ? '<div>' + esc(settings.reg) + '</div>' : '') + '</div>';
  if (settings.foot) h += '<div class="foot">' + esc(settings.foot) + '</div>';
  h += '</div>';
  return h;
}

function reportText(state) {
  const R = buildReport(state), p = state.patient, out = [];
  out.push('Name: ' + (p.name || '') + '   Age/Sex: ' + (p.age || '') + '/' + p.sex);
  if (p.pid) out.push('ID: ' + p.pid);
  out.push('Date: ' + fmtDate(p.date) + (p.ref ? '   Ref. by: ' + p.ref : ''));
  out.push('', R.tpl.heading);
  if (state.machine) out.push('(Realtime imaging using probes of ' + state.machine + ')');
  if (p.ind) out.push('Clinical details: ' + p.ind);
  out.push('');
  R.blocks.forEach(b => {
    if (b.lab) out.push(b.lab.padEnd(15) + ': ' + b.text); else if (b.text) out.push(b.text);
    if (b.table && b.table.hasAny) {
      out.push('', ''.padEnd(12) + 'RIGHT PS/EDV'.padEnd(18) + 'LEFT PS/EDV');
      b.table.rows.forEach(r => out.push(r[0].padEnd(12) + (r[1] || '').padEnd(18) + (r[2] || '')));
      out.push('');
    }
  });
  out.push('', 'IMPRESSION');
  R.imps.forEach(i => out.push('• ' + i));
  return out.join('\n');
}

if (typeof module !== 'undefined') module.exports = { buildReport, reportText, reportHTML, newItem, secState, activeSections };
