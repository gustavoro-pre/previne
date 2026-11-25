/* Módulo Treinamentos do portal PREVINE.
   Roda sobre o mesmo app de Ferramentas & EPI (funcionários, tipos, turmas, certificados, admissão)
   e acrescenta: painel e matriz de treinamentos, treinamentos externos com anexo, áreas e alocação,
   padrões operacionais (revisões, lista anexada, assinatura no app, portal do aluno), cursos EaD e acesso do funcionário. */
"use strict";

/* ================= estado do módulo ================= */
const T = { areas: [], pad: [], preg: [], ext: [], cursos: [], mat: [], ready: {} };
const ALUNO_URL = new URL('../aluno/', location.href).href;
const TIPOS_EXT = ['Integração ArcelorMittal', 'Bloqueio e etiquetagem (LOTO)', 'Permissão de trabalho', 'Ponte rolante', 'Direção defensiva', 'Brigada de emergência', 'Primeiros socorros'];
const PAPEIS_T = {
  admin: ['Administrador', 'Tudo'],
  gestao: ['Gestão', 'Tudo no módulo Treinamentos'],
  gestor: ['Gestor de treinamentos', 'Tudo no módulo: tipos, turmas, externos, áreas, padrões, cursos e acessos do aluno'],
  tst: ['TST', 'Turmas, externos, padrões, cursos, áreas e funcionários'],
  rh: ['RH', 'Admissão, turmas, externos, padrões, cursos, áreas e funcionários'],
  instrutor: ['Instrutor', 'Turmas, padrões (listas e assinaturas) e cursos'],
  consulta: ['Consulta', 'Vê tudo, não altera nada']
};
const podeT = (...ps) => ['admin', 'gestao', 'gestor'].includes(papelAtual()) || ps.includes(papelAtual());

/* ================= cabeçalho e navegação ================= */
document.title = 'Treinamentos · PREVINE';
$('.htitle').textContent = 'Treinamentos';
$('.hsub').textContent = 'NRs, padrões e cursos';
$('header .logo').innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a2a00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>';
$('header .logo').dataset.svg = $('header .logo').innerHTML;
VIEWS.splice(0, VIEWS.length, 'painel', 'matriz', 'turmas', 'padroes', 'cursos', 'cadastros');
SUBS.splice(0, SUBS.length, 'funcionarios', 'areas', 'tipos', 'empresa');
Object.keys(ACESSO).forEach(k => delete ACESSO[k]);
Object.assign(ACESSO, {
  admin: { views: '*', subs: '*' }, gestao: { views: '*', subs: '*' }, gestor: { views: '*', subs: '*' },
  tst: { views: '*', subs: ['funcionarios', 'areas', 'tipos'] }, rh: { views: '*', subs: ['funcionarios', 'areas', 'tipos'] },
  instrutor: { views: ['painel', 'matriz', 'turmas', 'padroes', 'cursos', 'cadastros'], subs: ['funcionarios', 'tipos'] },
  consulta: { views: '*', subs: ['funcionarios', 'areas', 'tipos'] }, none: { views: ['painel'], subs: [] }
});
const _guardWrite = guardWrite;
guardWrite = function () { if (papelAtual() === 'consulta') { toast('Seu perfil neste módulo é somente consulta.', 'bad'); return false; } return _guardWrite(); };

const IC = {
  painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  matriz: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  turmas: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  padroes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
  cursos: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5z"/><path d="M8 21h8"/>',
  cadastros: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'
};
const NOMES_V = { painel: 'Painel', matriz: 'Matriz', turmas: 'Turmas', padroes: 'Padrões', cursos: 'Cursos EaD', cadastros: 'Cadastros' };
$('.tabs .in').innerHTML = VIEWS.map(v => `<button data-v="${v}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[v]}</svg>${NOMES_V[v]}</button>`).join('');
$$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.v));

/* telas */
$('#v-painel').innerHTML = `<div id="tp-onb"></div><div class="kpis" id="tp-kpis"></div>
  <div id="tp-venc-w"><h3>NRs vencidas ou vencendo (60 dias)</h3><div id="tp-venc" class="list"></div></div>
  <div id="tp-ag-w"><h3>Agendados nos próximos 15 dias</h3><div id="tp-ag" class="list"></div></div>
  <div id="tp-pr-w"><h3>Cursos on-line aguardando a etapa prática</h3><div id="tp-pr" class="list"></div></div>
  <div id="tp-pd-w"><h3>Padrões operacionais com pendência</h3><div id="tp-pd" class="list"></div></div>
  <div id="tp-ex-w"><h3>Treinamentos externos vencidos ou vencendo</h3><div id="tp-ex" class="list"></div></div>`;
const secao = (id, html) => { const s = document.createElement('section'); s.id = 'v-' + id; s.className = 'view'; s.hidden = true; s.innerHTML = html; $('main').appendChild(s); return s; };
secao('matriz', `<div class="head"><h2>Matriz de treinamentos</h2><button class="btn ghost" id="mx-csv" type="button">Exportar (Excel)</button></div>
  <div class="filters"><select id="mx-area"></select><select id="mx-fun"></select><input id="mx-q" placeholder="Buscar funcionário" style="width:auto;flex:1;min-width:160px;padding:7px 10px"></div>
  <div class="chips" id="mx-ch"></div>
  <p class="note" style="margin-top:0">✓ em dia · ! vence em 60 dias · ✗ vencido · <b>falta</b> obrigatório para a função e não feito · 📅 agendado. Toque na célula para abrir.</p>
  <div class="card" style="padding:6px"><div class="tbwrap" style="margin:0" id="mx-body"></div></div>`);
const vt = secao('turmas', `<div id="tu-host"></div>
  <div class="head" style="margin-top:22px"><h2>Treinamentos externos</h2><button class="btn primary" id="ex-new" type="button">+ Externo</button></div>
  <p class="note" style="margin-top:0">Treinamentos dados pela ArcelorMittal ou por terceiros, com o certificado anexado. Entram na matriz e nos alertas de vencimento.</p>
  <input id="ex-q" placeholder="Buscar participante, treinamento, entidade" autocomplete="off"><div class="chips" id="ex-ch"></div><div id="ex-list" class="list"></div>`);
const subT = $('#sub-trein'); subT.classList.remove('sub'); subT.hidden = false; $('#tu-host').appendChild(subT);
secao('padroes', `<div class="head"><h2>Padrões operacionais</h2><button class="btn primary" id="pd-new" type="button">+ Novo padrão</button></div>
  <div class="kpis k5" id="pd-kpis" style="margin-bottom:12px"></div>
  <div class="filters"><select id="pd-area"></select><input id="pd-q" placeholder="Buscar código ou título" style="width:auto;flex:1;min-width:160px;padding:7px 10px"></div>
  <div id="pd-list"></div>`);
secao('cursos', `<div class="head"><h2>Cursos on-line (EaD)</h2><button class="btn ghost" id="cu-link" type="button">Link do portal do aluno</button><button class="btn primary" id="cu-new" type="button">+ Novo curso</button></div>
  <p class="note" style="margin-top:0">O funcionário entra no portal do aluno com a matrícula e a senha, vê os materiais por módulo, faz a prova e, aprovado, recebe o certificado. Parte prática continua presencial.</p>
  <div id="cu-list" class="list"></div>`);
/* cadastros: funcionários, áreas, tipos, empresa */
$('#c-seg').innerHTML = '<button data-sub="funcionarios" class="on">Funcionários</button><button data-sub="areas">Áreas</button><button data-sub="tipos">Tipos de treinamento</button><button data-sub="empresa">Empresa</button>';
(() => {
  const a = document.createElement('div'); a.id = 'sub-areas'; a.className = 'sub'; a.hidden = true;
  a.innerHTML = `<div class="head"><h2>Áreas e subáreas</h2><button class="btn primary" id="ar-new" type="button">+ Nova área</button></div>
    <p class="note" style="margin-top:0">Ex.: Aciaria → Refratário. Os padrões operacionais ficam ligados às subáreas, e só quem está alocado nelas precisa deles.</p><div id="ar-list"></div>`;
  const t = document.createElement('div'); t.id = 'sub-tipos'; t.className = 'sub'; t.hidden = true;
  t.innerHTML = `<div class="head"><h2>Tipos de treinamento</h2><button class="btn ghost" id="ti-mod" type="button">Modelos de NR</button><button class="btn primary" id="ti-new" type="button">+ Novo tipo</button></div>
    <p class="note" style="margin-top:0">Norma, carga horária, validade e conteúdo programático vão no certificado. Em cada tipo você marca para quais funções ele é obrigatório na admissão.</p><div id="ti-list" class="list"></div>`;
  const ref = $('#sub-empresa'); ref.parentNode.insertBefore(a, ref); ref.parentNode.insertBefore(t, ref);
})();
$('#ti-new').onclick = () => openTipo(null);
$('#ti-mod').onclick = () => openTipos();

/* ================= render ================= */
renderCad = function () { renderFunc(); renderEmp(); tAreas(); tTipos(); };
render = function (now) {
  aplicarPapel(); if (!pode(current())) { location.hash = 'painel'; return; }
  renderPainel(); renderCad(); renderTrein(); tExternos();
  const v = current();
  if (v === 'matriz') tMatriz(); if (v === 'padroes') tPadroes(); if (v === 'cursos') tCursos();
  tAutoCert();
};
let tRT = null; const tSched = () => { clearTimeout(tRT); tRT = setTimeout(() => render(), 150); };
const _aplicar = aplicarPapel;
aplicarPapel = function () {
  _aplicar();
  const w = papelAtual() !== 'consulta';
  ['#pd-new', '#cu-new', '#ex-new', '#ar-new', '#ti-new', '#ti-mod', '#t-new', '#u-new', '#u-imp'].forEach(s => { const b = $(s); if (b) b.hidden = !w || (['#ar-new'].includes(s) && !podeT('rh', 'tst')) || (['#ti-new', '#ti-mod', '#u-new', '#u-imp'].includes(s) && !podeT('rh', 'tst')); });
  ['#u-qr', '#u-docs', '#t-tipos'].forEach(s => { const b = $(s); if (b) b.hidden = true; });
};

/* ================= utilidades ================= */
const funcAtivos = () => S.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
const funcDe = id => S.func.find(f => f.id === id);
const subsDe = f => Array.isArray(f && f.subareas) ? f.subareas : [];
function subInfo(sid) { for (const a of T.areas) { const s = (a.subs || []).find(x => x.id === sid); if (s) return { area: a, sub: s }; } return null; }
const subNome = sid => { const i = subInfo(sid); return i ? i.area.nome + ' → ' + i.sub.nome : '(subárea removida)'; };
const novoId = () => Math.random().toString(36).slice(2, 10);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function selFuncs(titulo, marcados, cb, opts) {
  opts = opts || {}; const sel = new Set(marcados || []);
  const L = (opts.lista || funcAtivos());
  openModal(mtop(esc(titulo)) + `<div class="card"><input id="sf-q" placeholder="Buscar nome, matrícula, função" autocomplete="off">
    <div class="filters" style="margin:8px 0 0"><select id="sf-fun"><option value="">Todas as funções</option>${[...new Set(L.map(f => str(f.funcao)).filter(Boolean))].sort().map(x => `<option>${esc(x)}</option>`).join('')}</select>
    <select id="sf-sub"><option value="">Todas as subáreas</option>${T.areas.flatMap(a => (a.subs || []).map(s => `<option value="${esc(s.id)}">${esc(a.nome + ' → ' + s.nome)}</option>`)).join('')}</select>
    <button class="btn sm ghost" id="sf-all" type="button">Marcar os filtrados</button><button class="btn sm ghost" id="sf-none" type="button">Desmarcar todos</button></div>
    <div class="note" id="sf-n" style="margin-top:8px"></div><div id="sf-list" style="margin-top:6px;max-height:48vh;overflow:auto"></div></div>
    ${opts.extra || ''}
    <div class="actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="sf-ok">${esc(opts.ok || 'Confirmar')}</button></div>`);
  const filt = () => { const q = norm($('#sf-q').value), fu = $('#sf-fun').value, su = $('#sf-sub').value; return L.filter(f => (!q || matchFunc(f, q)) && (!fu || str(f.funcao) === fu) && (!su || subsDe(f).includes(su))); };
  const draw = () => { const F = filt(); $('#sf-n').textContent = `${sel.size} selecionado(s) · ${F.length} na lista`;
    $('#sf-list').innerHTML = F.map(f => `<label style="display:flex;gap:10px;align-items:center;color:inherit;font-size:15px;margin:0;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" data-sf="${esc(f.id)}" ${sel.has(f.id) ? 'checked' : ''}><span><b>${esc(f.nome)}</b><div class="note">${esc([f.matricula, f.funcao].filter(Boolean).join(' · '))}${opts.info ? ' ' + opts.info(f) : ''}</div></span></label>`).join('') || '<div class="empty">Ninguém com esses filtros.</div>'; };
  $('#sf-list').addEventListener('change', e => { const c = e.target.closest('[data-sf]'); if (!c) return; if (c.checked) sel.add(c.dataset.sf); else sel.delete(c.dataset.sf); $('#sf-n').textContent = `${sel.size} selecionado(s)`; });
  ['#sf-q', '#sf-fun', '#sf-sub'].forEach(s => $(s).addEventListener('input', draw));
  $('#sf-all').onclick = () => { filt().forEach(f => sel.add(f.id)); draw(); };
  $('#sf-none').onclick = () => { sel.clear(); draw(); };
  $('#sf-ok').onclick = () => cb([...sel]);
  draw();
}

/* ================= arquivos (anexos guardados no banco, em partes) ================= */
const PARTE = 700000, MAX_ARQ = 12 * 1024 * 1024;
function lerComoDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
async function comprimirImagem(file) {
  const url = await lerComoDataURL(file); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82);
}
async function salvarArquivo(file, ref) {
  if (!file) return null;
  if (file.size > MAX_ARQ) throw { userMsg: `Arquivo muito grande (${(file.size / 1048576).toFixed(1)} MB). O limite é 12 MB: reduza o PDF ou envie em partes.` };
  const img = /^image\//.test(file.type);
  const url = img ? await comprimirImagem(file) : await lerComoDataURL(file);
  const b64 = url.slice(url.indexOf(',') + 1); const tipo = img ? 'image/jpeg' : (file.type || 'application/pdf');
  const partes = Math.max(1, Math.ceil(b64.length / PARTE));
  const r = db.collection('arquivos').doc(); const id = r.id;
  for (let i = 0; i < partes; i++) { await db.doc(`arquivos/${id}/p/${i}`).set({ i, d: b64.slice(i * PARTE, (i + 1) * PARTE) }); }
  await r.set({ nome: str(file.name) || 'arquivo', tipo, tam: Math.round(b64.length * 0.75), partes, ref: ref || '', criadoEm: new Date().toISOString(), por: S.uid || '' });
  return id;
}
async function lerArquivo(id) {
  const m = await db.doc('arquivos/' + id).get(); if (!m.exists) throw { userMsg: 'Arquivo não encontrado.' };
  const meta = m.data(); let b64 = '';
  for (let i = 0; i < num(meta.partes); i++) { const p = await db.doc(`arquivos/${id}/p/${i}`).get(); if (!p.exists) throw { userMsg: 'Arquivo incompleto (ainda enviando?). Tente de novo em instantes.' }; b64 += p.data().d; }
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { blob: new Blob([u8], { type: meta.tipo || 'application/octet-stream' }), meta };
}
async function abrirArquivo(id) {
  if (!id) return toast('Sem arquivo anexado.', 'bad');
  const w = window.open('', '_blank'); if (w) w.document.write('<p style="font:16px system-ui;padding:20px">Abrindo o arquivo…</p>');
  try {
    const { blob, meta } = await lerArquivo(id); const url = URL.createObjectURL(blob);
    if (w && !w.closed) w.location.href = url;
    else { const dl = await use('downloads'); if (dl) await dl.save({ filename: meta.nome, data: blob }); }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { if (w) w.close(); handleErr(e); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-arq]'); if (b) { e.preventDefault(); abrirArquivo(b.dataset.arq); } });
const arqBtn = (id, txt) => id ? `<button class="btn sm ghost" data-arq="${esc(id)}" type="button">${txt || 'Abrir anexo'}</button>` : '';
const fileInput = (id, aceita) => `<input type="file" id="${id}" accept="${aceita || 'application/pdf,image/*'}" style="padding:8px">`;

/* ================= dados ================= */
(async () => {
  const d = await use('db'); if (!d) return;
  const asObj = x => Object.assign({}, x.data() || {}, { id: x.id });
  [['areas', 'areas'], ['pad', 'padroes'], ['preg', 'padrao_reg'], ['ext', 'trein_ext'], ['cursos', 'cursos'], ['mat', 'matriculas']].forEach(([k, c]) =>
    d.collection(c).onSnapshot(s => { T[k] = s.docs.map(asObj); T.ready[k] = true; tSched(); }, e => { console.warn(c, e); T.ready[k] = true; }));
  window.addEventListener('fb-users', tSched);
})();

/* ================= situação de NRs por pessoa ================= */
function grupos() {
  const m = new Map();
  S.tt.forEach(t => { const k = t.norma ? 'N:' + norm(t.norma) : 'T:' + t.id; if (!m.has(k)) m.set(k, { k, nome: t.norma || t.nome, tipos: [] }); m.get(k).tipos.push(t); });
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
}
function obrigatorio(g, f) { return g.tipos.some(t => obrigPara(t, f)); }
function ultimoDe(fid, gk) {
  const feito = r => str(r.inicio) <= todayStr();
  return S.tr.filter(r => r.funcionarioId === fid && grupoKey(r) === gk).sort((a, b) => (feito(b) - feito(a)) || str(b.termino).localeCompare(str(a.termino)))[0];
}
const extState = x => { const v = str(x.validade); if (!v) return 'ok'; if (v < todayStr()) return 'vencido'; if (v <= addDays(60)) return 'vence'; return 'ok'; };
const extBadge = x => { const st = extState(x); return !x.validade ? '<span class="badge b-mut">Sem validade</span>' : st === 'vencido' ? `<span class="badge b-bad">Vencido ${fmtD(x.validade)}</span>` : st === 'vence' ? `<span class="badge b-warn">Vence ${fmtD(x.validade)}</span>` : `<span class="badge b-ok">Válido até ${fmtD(x.validade)}</span>`; };
function extAtuais() { const last = {}; T.ext.forEach(x => { const k = x.funcionarioId + '|' + norm(x.tipo); if (!last[k] || str(last[k].termino) < str(x.termino)) last[k] = x; }); const at = new Set(funcAtivos().map(f => f.id)); return Object.values(last).filter(x => at.has(x.funcionarioId)); }

/* ================= padrões: quem precisa e situação ================= */
function precisa(p, f) {
  if (!f || f.ativo === false || p.ativo === false) return false;
  if ((p.exc || []).includes(f.id)) return false;
  if ((p.inc || []).includes(f.id)) return true;
  const ss = subsDe(f); return (p.subIds || []).some(s => ss.includes(s));
}
function regsPessoa(p, fid) { return T.preg.filter(r => r.padraoId === p.id && r.funcionarioId === fid).sort((a, b) => str(b.data).localeCompare(str(a.data))); }
function padState(p, fid) {
  const L = regsPessoa(p, fid); const atual = L.find(r => str(r.rev) === str(p.rev));
  if (atual) { if (num(p.reciclMeses) && addMonths(str(atual.data).slice(0, 10), num(p.reciclMeses)) < todayStr()) return { st: 'recicl', r: atual }; return { st: 'ok', r: atual }; }
  if (L.length) return { st: 'rev', r: L[0] };
  return { st: 'pend', r: null };
}
const PST = { ok: ['Treinado', 'b-ok'], rev: ['Revisão desatualizada', 'b-warn'], recicl: ['Reciclagem vencida', 'b-warn'], pend: ['Pendente', 'b-bad'] };
const padBadge = s => `<span class="badge ${PST[s][1]}">${PST[s][0]}</span>`;
function padResumo(p) { const L = funcAtivos().filter(f => precisa(p, f)); const st = L.map(f => ({ f, s: padState(p, f.id) })); return { L: st, ok: st.filter(x => x.s.st === 'ok').length, n: st.length }; }

/* ================= painel ================= */
renderPainel = function () {
  const st = treinStatus(); const venc = st.filter(x => x.st === 'vencido'), vence = st.filter(x => x.st === 'vence');
  const fs = funcAtivos(); const G = grupos();
  let req = 0, okq = 0; fs.forEach(f => G.forEach(g => { if (!obrigatorio(g, f)) return; req++; const u = ultimoDe(f.id, g.k); if (u && ['ok', 'vence'].includes(trState(u))) okq++; }));
  const ag = S.tr.filter(r => trState(r) === 'agendado' && str(r.inicio) <= addDays(15)).sort((a, b) => str(a.inicio).localeCompare(str(b.inicio)));
  const prat = T.mat.filter(m => m.concluidoEm && !m.praticaOk && (T.cursos.find(c => c.id === m.cursoId) || {}).pratica);
  const andamento = T.mat.filter(m => !m.concluidoEm).length;
  const PD = T.pad.filter(p => p.ativo !== false).map(p => Object.assign({ p }, padResumo(p))).filter(x => x.ok < x.n).sort((a, b) => (b.n - b.ok) - (a.n - a.ok));
  const pendPad = PD.reduce((a, x) => a + x.n - x.ok, 0);
  const ex = extAtuais().filter(x => extState(x) !== 'ok').sort((a, b) => str(a.validade).localeCompare(str(b.validade)));
  $('#tp-kpis').innerHTML = kpi('Funcionários ativos', fs.length) + kpi('NRs obrigatórias em dia', req ? pct(okq, req) + '%' : '—', req && okq < req ? 'warn' : 'ok', req ? `${okq} de ${req}` : 'marque as obrigatórias nos tipos')
    + kpi('Vencidos', venc.length, venc.length ? 'bad' : '') + kpi('Vencem em 60 dias', vence.length, vence.length ? 'warn' : '')
    + kpi('Padrões pendentes', pendPad, pendPad ? 'warn' : '', 'pessoa × padrão') + kpi('Cursos on-line em andamento', andamento, 'info', prat.length ? prat.length + ' aguardando prática' : '');
  $('#tp-onb').innerHTML = (S.ready.func && !S.tt.length) ? `<div class="card onb"><b>Primeiros passos</b><p>1. Cadastre os tipos de treinamento (há modelos de NR prontos). 2. Crie as áreas e subáreas e aloque as pessoas. 3. Cadastre os padrões operacionais e os cursos on-line.</p>
    <button class="btn accent" data-go="cadastros" data-sub="tipos">Tipos de treinamento</button><button class="btn accent" data-go="cadastros" data-sub="areas">Áreas</button></div>` : '';
  const vl = venc.concat(vence);
  $('#tp-venc-w').classList.toggle('hidden', !vl.length);
  $('#tp-venc').innerHTML = vl.slice(0, 25).map(x => `<button class="item ${x.st === 'vencido' ? 'late' : ''}" data-trein="${esc(x.r.id)}"><div class="main"><div class="t1">${esc(x.r.nome)}</div><div class="t2">${esc(x.r.tipoNome)} · concluído ${fmtD(x.r.termino)}</div></div><div class="side">${trBadge(x.r)}</div></button>`).join('') + (vl.length > 25 ? `<div class="note">+${vl.length - 25} na Matriz.</div>` : '');
  $('#tp-ag-w').classList.toggle('hidden', !ag.length);
  $('#tp-ag').innerHTML = ag.map(trRow).join('');
  $('#tp-pr-w').classList.toggle('hidden', !prat.length);
  $('#tp-pr').innerHTML = prat.map(m => { const c = T.cursos.find(x => x.id === m.cursoId) || {}; return `<button class="item" data-curso="${esc(c.id)}"><div class="main"><div class="t1">${esc(m.nome)}</div><div class="t2">${esc(c.nome)} · teoria concluída em ${fmtD(m.concluidoEm)}</div></div><div class="side"><span class="badge b-info">Falta a prática</span></div></button>`; }).join('');
  $('#tp-pd-w').classList.toggle('hidden', !PD.length);
  $('#tp-pd').innerHTML = PD.slice(0, 12).map(x => `<button class="item" data-padrao="${esc(x.p.id)}"><div class="main"><div class="t1"><span class="code">${esc(x.p.codigo)}</span> ${esc(x.p.titulo)}</div><div class="t2">Rev. ${esc(x.p.rev)} · ${esc((x.p.subIds || []).map(subNome).join(', '))}</div></div><div class="side"><span class="badge b-warn">${x.n - x.ok} pendente(s)</span><span class="note">${x.ok}/${x.n} treinados</span></div></button>`).join('');
  $('#tp-ex-w').classList.toggle('hidden', !ex.length);
  $('#tp-ex').innerHTML = ex.slice(0, 15).map(extRow).join('');
};

/* ================= matriz ================= */
const MX = { area: '', fun: '', ch: 'todos' };
function tMatriz() {
  const subs = T.areas.flatMap(a => [{ v: 'a:' + a.id, t: a.nome }].concat((a.subs || []).map(s => ({ v: 's:' + s.id, t: '   ' + a.nome + ' → ' + s.nome }))));
  $('#mx-area').innerHTML = `<option value="">Todas as áreas</option>` + subs.map(o => `<option value="${esc(o.v)}" ${MX.area === o.v ? 'selected' : ''}>${esc(o.t)}</option>`).join('');
  $('#mx-fun').innerHTML = `<option value="">Todas as funções</option>` + funcoesTodas().map(x => `<option ${MX.fun === x ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('#mx-ch').innerHTML = [['todos', 'Todos'], ['pend', 'Com pendência']].map(([k, t]) => `<button class="chip ${MX.ch === k ? 'on' : ''}" data-mxch="${k}">${t}</button>`).join('');
  const { cols, rows } = mxDados();
  if (!rows.length) { $('#mx-body').innerHTML = `<div class="empty">${S.func.length ? 'Ninguém com esses filtros.' : 'Cadastre os funcionários.'}</div>`; return; }
  const cell = c => c.t === 'ok' ? `<span class="badge b-ok">✓</span>` : c.t === 'vence' ? `<span class="badge b-warn">!</span>` : c.t === 'vencido' ? `<span class="badge b-bad">✗</span>` : c.t === 'falta' ? `<span class="badge b-bad">falta</span>` : c.t === 'agendado' ? `<span class="badge b-info">📅</span>` : c.t === 'pad' ? `<span class="badge ${c.ok === c.n ? 'b-ok' : 'b-warn'}">${c.ok}/${c.n}</span>` : '<span class="note">·</span>';
  $('#mx-body').innerHTML = `<table class="mx"><thead><tr><th>Funcionário</th>${cols.map(c => `<th title="${esc(c.titulo)}">${esc(c.nome)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 400).map(r => `<tr><td><button class="link" data-ofunc="${esc(r.f.id)}" style="padding:0;text-align:left">${esc(r.f.nome)}</button><div class="note">${esc(r.f.funcao || '')}</div></td>${r.cells.map((c, i) => `<td><button class="link" style="padding:2px" data-mxc="${esc(r.f.id)}|${i}">${cell(c)}</button></td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length > 400 ? `<p class="note">Mostrando 400 de ${rows.length}. Use os filtros.</p>` : ''}`;
}
function mxDados() {
  const G = grupos(); const EXT = [...new Set(T.ext.map(x => str(x.tipo).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const temPad = T.pad.some(p => p.ativo !== false);
  const cols = G.map(g => ({ k: 'g', g, nome: g.nome, titulo: g.tipos.map(t => t.nome).join(' / ') })).concat(EXT.map(e => ({ k: 'e', e, nome: e.length > 14 ? e.slice(0, 13) + '…' : e, titulo: e + ' (externo)' }))).concat(temPad ? [{ k: 'p', nome: 'Padrões', titulo: 'Padrões operacionais treinados / necessários' }] : []);
  const q = norm($('#mx-q').value);
  let F = funcAtivos().filter(f => (!q || matchFunc(f, q)) && (!MX.fun || str(f.funcao) === MX.fun));
  if (MX.area) { const [k, id] = MX.area.split(':'); const ids = k === 'a' ? ((T.areas.find(a => a.id === id) || {}).subs || []).map(s => s.id) : [id]; F = F.filter(f => subsDe(f).some(s => ids.includes(s))); }
  const ex = extAtuais();
  const rows = F.map(f => ({ f, cells: cols.map(c => {
    if (c.k === 'g') { const u = ultimoDe(f.id, c.g.k); if (u) return { t: trState(u), r: u }; return { t: obrigatorio(c.g, f) ? 'falta' : '' }; }
    if (c.k === 'e') { const x = ex.find(y => y.funcionarioId === f.id && norm(y.tipo) === norm(c.e)); return x ? { t: extState(x), x } : { t: '' }; }
    const L = T.pad.filter(p => p.ativo !== false && precisa(p, f)); return { t: L.length ? 'pad' : '', ok: L.filter(p => padState(p, f.id).st === 'ok').length, n: L.length };
  }) }));
  const pend = r => r.cells.some(c => ['vencido', 'falta'].includes(c.t) || (c.t === 'pad' && c.ok < c.n));
  return { cols, rows: MX.ch === 'pend' ? rows.filter(pend) : rows };
}
$('#mx-area').onchange = e => { MX.area = e.target.value; tMatriz(); };
$('#mx-fun').onchange = e => { MX.fun = e.target.value; tMatriz(); };
$('#mx-q').addEventListener('input', () => tMatriz());
$('#mx-ch').addEventListener('click', e => { const b = e.target.closest('[data-mxch]'); if (b) { MX.ch = b.dataset.mxch; tMatriz(); } });
$('#mx-body').addEventListener('click', e => {
  const b = e.target.closest('[data-mxc]'); if (!b) return; const [fid, i] = b.dataset.mxc.split('|'); const { cols, rows } = mxDados();
  const r = rows.find(x => x.f.id === fid); if (!r) return; const c = r.cells[+i], col = cols[+i];
  if (c.r) return openTreino(c.r.id); if (c.x) return openExt(c.x.id);
  if (col.k === 'p') return openFunc(fid);
  if (col.k === 'g' && podeT('rh', 'tst')) return openPlano(fid);
  if (col.k === 'e' && podeT('rh', 'tst', 'instrutor')) return openExt(null, fid, col.e);
});
$('#mx-csv').onclick = () => { const { cols, rows } = mxDados(); const tx = c => ({ ok: 'Em dia', vence: 'Vence em 60 dias', vencido: 'Vencido', falta: 'Falta (obrigatório)', agendado: 'Agendado' }[c.t] || (c.t === 'pad' ? `${c.ok}/${c.n}` : ''));
  saveCSV('matriz_treinamentos_' + todayStr() + '.csv', [['Funcionário', 'Matrícula', 'Função', 'Subáreas'].concat(cols.map(c => c.titulo))].concat(rows.map(r => [r.f.nome, r.f.matricula, r.f.funcao, subsDe(r.f).map(subNome).join('; ')].concat(r.cells.map(c => tx(c) + (c.r && c.r.validade ? ' até ' + fmtD(c.r.validade) : c.x && c.x.validade ? ' até ' + fmtD(c.x.validade) : '')))))); };

/* ================= externos ================= */
let exF = 'atual';
function extRow(x) { return `<button class="item ${extState(x) === 'vencido' ? 'late' : ''}" data-ext="${esc(x.id)}"><div class="main"><div class="t1">${esc(x.nome)}</div><div class="t2">${esc(x.tipo)} · ${esc(x.entidade || '—')} · ${fmtD(x.termino || x.inicio)}${num(x.cargaHoraria) ? ' · ' + num(x.cargaHoraria) + 'h' : ''}</div></div><div class="side">${extBadge(x)}${x.arquivoId ? '<span class="note">📎 anexo</span>' : ''}</div></button>`; }
function tExternos() {
  $('#ex-ch').innerHTML = [['atual', 'Situação atual'], ['vencido', 'Vencidos'], ['vence', 'Vencem em 60 dias'], ['todos', 'Histórico completo']].map(([k, t]) => `<button class="chip ${exF === k ? 'on' : ''}" data-exch="${k}">${t}</button>`).join('');
  const q = norm($('#ex-q').value);
  let L = exF === 'todos' ? T.ext.slice() : extAtuais().filter(x => exF === 'atual' || extState(x) === exF);
  if (q) L = L.filter(x => norm([x.nome, x.tipo, x.entidade, x.matricula].join(' ')).includes(q));
  L.sort((a, b) => exF === 'todos' ? str(b.termino).localeCompare(str(a.termino)) : str(a.validade || '9').localeCompare(str(b.validade || '9')));
  $('#ex-list').innerHTML = L.length ? L.slice(0, 300).map(extRow).join('') : `<div class="empty">${T.ext.length ? 'Nada encontrado.' : 'Nenhum treinamento externo lançado. Toque em “+ Externo” e anexe o certificado.'}</div>`;
}
$('#ex-q').addEventListener('input', tExternos);
$('#ex-ch').addEventListener('click', e => { const b = e.target.closest('[data-exch]'); if (b) { exF = b.dataset.exch; tExternos(); } });
$('#ex-new').onclick = () => openExt(null);
document.addEventListener('click', e => { const b = e.target.closest('[data-ext]'); if (b) openExt(b.dataset.ext); });
document.addEventListener('click', e => { const b = e.target.closest('[data-ofunc]'); if (b) openFunc(b.dataset.ofunc); });
function openExt(id, fid, tipo) {
  const x = id ? T.ext.find(y => y.id === id) : null; if (id && !x) return;
  let P = x ? [x.funcionarioId] : (fid ? [fid] : []);
  const v = k => esc(x ? x[k] : '');
  const tiposAll = [...new Set(TIPOS_EXT.concat(T.ext.map(y => str(y.tipo).trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const ro = papelAtual() === 'consulta';
  openModal(mtop(x ? 'Treinamento externo' : 'Lançar treinamento externo') + `<div class="card">
    <span class="lbl">Participante${x ? '' : 's'}</span><div id="ex-parts"></div>
    ${x ? '' : '<input id="ex-pq" placeholder="Adicionar: nome ou matrícula" autocomplete="off" style="margin-top:6px"><div id="ex-pres" class="results"></div>'}
    <label for="ex-t">Treinamento *</label><input id="ex-t" list="ex-tl" value="${x ? v('tipo') : esc(tipo || '')}" placeholder="Ex.: Integração ArcelorMittal"><datalist id="ex-tl">${tiposAll.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="grid2"><div><label for="ex-e">Entidade / quem ministrou</label><input id="ex-e" value="${x ? v('entidade') : 'ArcelorMittal'}"></div><div><label for="ex-ch2">Carga horária (h)</label><input id="ex-ch2" type="number" min="0" value="${x ? num(x.cargaHoraria) || '' : ''}"></div></div>
    <div class="grid3"><div><label for="ex-i">Início</label><input type="date" id="ex-i" value="${x ? v('inicio') : todayStr()}"></div><div><label for="ex-f">Término *</label><input type="date" id="ex-f" value="${x ? v('termino') : todayStr()}"></div><div><label for="ex-vm">Validade (meses)</label><input id="ex-vm" type="number" min="0" value="${x ? num(x.validadeMeses) || '' : ''}" placeholder="0 = sem validade"></div></div>
    <label for="ex-v">Válido até</label><input type="date" id="ex-v" value="${x ? v('validade') : ''}">
    <label>Certificado / lista (PDF ou foto)</label>${x && x.arquivoId ? `<div style="margin-bottom:6px">${arqBtn(x.arquivoId, 'Abrir certificado anexado')} <span class="note">Escolha outro arquivo abaixo para substituir.</span></div>` : ''}${ro ? '' : fileInput('ex-a')}
    ${!x ? '<p class="note">Com vários participantes, o mesmo arquivo (ex.: lista assinada) fica anexado em todos.</p>' : ''}
    <label for="ex-o">Observação</label><textarea id="ex-o" rows="2">${v('obs')}</textarea></div>
    <div class="actions">${x && !ro ? '<button class="btn danger" id="ex-del">Excluir</button>' : ''}<button class="btn ghost" data-close>${ro ? 'Fechar' : 'Cancelar'}</button>${ro ? '' : '<button class="btn primary" id="ex-save">Salvar</button>'}</div>`);
  const drawP = () => { $('#ex-parts').innerHTML = P.length ? P.map(i => `<span class="badge b-info" style="margin:2px;font-size:13px">${esc((funcDe(i) || {}).nome || (x && x.nome) || '?')}${x ? '' : ` <button class="link" type="button" data-exrm="${esc(i)}" style="padding:0 2px" aria-label="Remover">×</button>`}</span>`).join('') : '<span class="note">Nenhum participante.</span>'; };
  drawP();
  const pq = $('#ex-pq');
  if (pq) {
    pq.addEventListener('input', () => { const q = norm(pq.value); $('#ex-pres').innerHTML = q.length < 2 ? '' : funcAtivos().filter(f => !P.includes(f.id) && matchFunc(f, q)).slice(0, 6).map(f => `<button class="res" type="button" data-exad="${esc(f.id)}"><span><b>${esc(f.nome)}</b> <span class="note">${esc([f.matricula, f.funcao].filter(Boolean).join(' · '))}</span></span><span class="badge b-info">Adicionar</span></button>`).join(''); });
    $('#ex-pres').addEventListener('click', e => { const b = e.target.closest('[data-exad]'); if (b) { P.push(b.dataset.exad); pq.value = ''; $('#ex-pres').innerHTML = ''; drawP(); pq.focus(); } });
    $('#ex-parts').addEventListener('click', e => { const b = e.target.closest('[data-exrm]'); if (b) { P = P.filter(i => i !== b.dataset.exrm); drawP(); } });
  }
  const calcV = () => { const m = num($('#ex-vm').value), f = $('#ex-f').value; if (m && f) $('#ex-v').value = addMonths(f, m); };
  $('#ex-vm').addEventListener('input', calcV); $('#ex-f').addEventListener('change', calcV);
  const del = $('#ex-del'); if (del) armDelete(del, () => db.doc('trein_ext/' + x.id).delete());
  const sv = $('#ex-save'); if (sv) sv.onclick = async () => {
    if (!guardWrite()) return;
    const d = { tipo: $('#ex-t').value.trim(), entidade: $('#ex-e').value.trim(), cargaHoraria: num($('#ex-ch2').value), inicio: $('#ex-i').value, termino: $('#ex-f').value, validadeMeses: num($('#ex-vm').value), validade: $('#ex-v').value, obs: $('#ex-o').value.trim() };
    if (!P.length) return toast('Adicione o(s) participante(s).', 'bad');
    if (!d.tipo || !d.termino) return toast('Informe o treinamento e a data de término.', 'bad');
    if (d.validade && d.validade < d.termino) return toast('A validade não pode ser antes do término.', 'bad');
    const file = $('#ex-a') && $('#ex-a').files[0];
    sv.disabled = true; sv.textContent = file ? 'Enviando anexo…' : 'Salvando…';
    try {
      const arq = file ? await salvarArquivo(file, 'externo') : null;
      if (x) await db.doc('trein_ext/' + x.id).update(Object.assign(d, arq ? { arquivoId: arq, arquivoNome: file.name } : {}));
      else for (const fid2 of P) { const f = funcDe(fid2) || {}; await db.collection('trein_ext').doc().set(Object.assign({ funcionarioId: fid2, nome: str(f.nome), matricula: str(f.matricula), funcao: str(f.funcao), arquivoId: arq || '', arquivoNome: file ? file.name : '', criadoEm: new Date().toISOString(), por: S.uid || '' }, d)); await sleep(40); }
      closeModal(); toast(x ? 'Atualizado.' : `${P.length} lançamento(s) salvo(s).`, 'ok');
    } catch (e) { handleErr(e); sv.disabled = false; sv.textContent = 'Salvar'; }
  };
}

/* ================= áreas ================= */
function tAreas() {
  if (!$('#ar-list')) return;
  const L = T.areas.slice().sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  const cont = sid => funcAtivos().filter(f => subsDe(f).includes(sid)).length;
  $('#ar-list').innerHTML = L.length ? L.map(a => `<div class="card"><div class="head" style="margin:0 0 6px"><h3 style="margin:0;margin-right:auto;text-transform:none;letter-spacing:0;font-size:17px;color:var(--ink)">${esc(a.nome)}</h3>${podeT('rh', 'tst') ? `<button class="btn sm ghost" data-ared="${esc(a.id)}">Editar</button>` : ''}</div>
    ${(a.subs || []).length ? (a.subs || []).map(s => `<div class="ritem"><div class="main"><b>${esc(s.nome)}</b><div class="note">${cont(s.id)} funcionário(s) · ${T.pad.filter(p => (p.subIds || []).includes(s.id) && p.ativo !== false).length} padrão(ões)</div></div>${podeT('rh', 'tst') ? `<button class="btn sm ghost" data-aloc="${esc(s.id)}">Alocar pessoas</button>` : ''}</div>`).join('') : '<p class="note">Sem subáreas.</p>'}</div>`).join('')
    : '<div class="empty">Nenhuma área cadastrada. Ex.: Aciaria, com as subáreas Refratário e Lingotamento.</div>';
}
$('#ar-new').onclick = () => openArea(null);
document.addEventListener('click', e => { const a = e.target.closest('[data-ared]'); if (a) return openArea(a.dataset.ared); const b = e.target.closest('[data-aloc]'); if (b) alocar(b.dataset.aloc); });
function openArea(id) {
  const a = id ? T.areas.find(x => x.id === id) : null; const subs = a ? (a.subs || []).map(s => Object.assign({}, s)) : [{ id: novoId(), nome: '' }];
  const usado = sid => T.pad.some(p => (p.subIds || []).includes(sid)) || S.func.some(f => subsDe(f).includes(sid));
  openModal(mtop(a ? 'Área' : 'Nova área') + `<div class="card"><label for="ar-n">Nome da área *</label><input id="ar-n" value="${esc(a ? a.nome : '')}" placeholder="Ex.: Aciaria">
    <span class="lbl" style="margin-top:14px">Subáreas</span><div id="ar-subs"></div><button class="btn sm ghost" id="ar-add" type="button" style="margin-top:6px">+ Subárea</button>
    <p class="note">Uma subárea com pessoas ou padrões ligados não pode ser removida; renomear pode.</p></div>
    <div class="actions">${a && !(a.subs || []).some(s => usado(s.id)) ? '<button class="btn danger" id="ar-del">Excluir área</button>' : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ar-save">Salvar</button></div>`);
  const draw = () => { $('#ar-subs').innerHTML = subs.map((s, i) => `<div class="srow" style="margin-top:6px"><input data-arsn="${i}" value="${esc(s.nome)}" placeholder="Ex.: Refratário">${usado(s.id) ? '' : `<button class="qbtn" type="button" data-arsx="${i}" aria-label="Remover">×</button>`}</div>`).join(''); };
  draw();
  $('#ar-subs').addEventListener('input', e => { const i = e.target.dataset.arsn; if (i != null) subs[+i].nome = e.target.value; });
  $('#ar-subs').addEventListener('click', e => { const b = e.target.closest('[data-arsx]'); if (b) { subs.splice(+b.dataset.arsx, 1); draw(); } });
  $('#ar-add').onclick = () => { subs.push({ id: novoId(), nome: '' }); draw(); $$('#ar-subs input').slice(-1)[0].focus(); };
  const del = $('#ar-del'); if (del) armDelete(del, () => db.doc('areas/' + a.id).delete());
  $('#ar-save').onclick = async () => {
    if (!guardWrite()) return;
    const nome = $('#ar-n').value.trim(); const L = subs.map(s => ({ id: s.id, nome: s.nome.trim() })).filter(s => s.nome);
    if (!nome) return toast('Informe o nome da área.', 'bad');
    if (T.areas.some(x => norm(x.nome) === norm(nome) && (!a || x.id !== a.id))) return toast('Já existe área com esse nome.', 'bad');
    try { if (a) await db.doc('areas/' + a.id).update({ nome, subs: L }); else await db.collection('areas').doc().set({ nome, subs: L, criadoEm: new Date().toISOString() }); closeModal(); toast('Área salva.', 'ok'); } catch (e) { handleErr(e); }
  };
}
function alocar(sid) {
  const atuais = funcAtivos().filter(f => subsDe(f).includes(sid)).map(f => f.id);
  selFuncs('Quem trabalha em ' + subNome(sid), atuais, async ids => {
    if (!guardWrite()) return;
    const novo = new Set(ids); const mud = funcAtivos().filter(f => novo.has(f.id) !== atuais.includes(f.id));
    const b = $('#sf-ok'); b.disabled = true; b.textContent = 'Salvando…';
    try { for (const f of mud) { const s = new Set(subsDe(f)); if (novo.has(f.id)) s.add(sid); else s.delete(sid); await db.doc('funcionarios/' + f.id).update({ subareas: [...s] }); await sleep(30); }
      closeModal(); toast(mud.length ? `${mud.length} alteração(ões) de alocação.` : 'Nada mudou.', 'ok'); } catch (e) { handleErr(e); b.disabled = false; b.textContent = 'Salvar alocação'; }
  }, { ok: 'Salvar alocação', info: f => subsDe(f).filter(s => s !== sid).length ? '· também em ' + subsDe(f).filter(s => s !== sid).map(subNome).join(', ') : '' });
}

/* ================= tipos (lista em Cadastros) ================= */
function tTipos() {
  if (!$('#ti-list')) return;
  const L = S.tt.slice().sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  $('#ti-list').innerHTML = L.length ? L.map(t => `<button class="item" data-tti="${esc(t.id)}"><div class="main"><div class="t1">${esc(t.nome)}</div><div class="t2">${esc(t.norma || '—')} · ${num(t.cargaHoraria)}h · ${num(t.validadeMeses) ? 'validade ' + num(t.validadeMeses) + ' meses' : 'sem validade'}${(t.obrig || []).length ? ' · obrigatório para ' + (t.obrig || []).map(esc).join(', ') : ''}</div></div></button>`).join('') : '<div class="empty">Nenhum tipo cadastrado. Use “Modelos de NR” para começar.</div>';
}
document.addEventListener('click', e => { const b = e.target.closest('[data-tti]'); if (b) openTipo(b.dataset.tti); });

/* ================= ficha do funcionário: áreas, padrões, externos, cursos e acesso do aluno ================= */
function alunoDe(fid) { const U = (window.__FB && window.__FB.users()) || {}; const k = Object.keys(U).find(id => U[id].papel === 'funcionario' && U[id].funcionarioId === fid && U[id].ativo !== false); return k ? Object.assign({ uid: k }, U[k]) : null; }
function funcExtraHtml(f) {
  const PADS = T.pad.filter(p => p.ativo !== false && precisa(p, f)).map(p => ({ p, s: padState(p, f.id) }));
  const EX = T.ext.filter(x => x.funcionarioId === f.id).sort((a, b) => str(b.termino).localeCompare(str(a.termino)));
  const MT = T.mat.filter(m => m.funcionarioId === f.id); const al = alunoDe(f.id);
  return `<h3>Áreas de trabalho</h3><div class="card"><div>${subsDe(f).length ? subsDe(f).map(s => `<span class="badge b-info" style="margin:2px">${esc(subNome(s))}</span>`).join('') : '<span class="note">Não alocado em nenhuma subárea.</span>'}</div>${podeT('rh', 'tst') && T.areas.length ? '<button class="btn sm ghost" id="fx-sub" type="button" style="margin-top:8px">Alterar áreas</button>' : ''}</div>
    <h3>Padrões operacionais (${PADS.filter(x => x.s.st === 'ok').length}/${PADS.length})</h3><div class="list">${PADS.length ? PADS.map(x => `<button class="item" data-padrao="${esc(x.p.id)}"><div class="main"><div class="t1"><span class="code">${esc(x.p.codigo)}</span> ${esc(x.p.titulo)}</div><div class="t2">Rev. atual ${esc(x.p.rev)}${x.s.r ? ` · assinou rev. ${esc(x.s.r.rev)} em ${fmtD(str(x.s.r.data).slice(0, 10))}` : ''}</div></div><div class="side">${padBadge(x.s.st)}</div></button>`).join('') : '<div class="empty">Nenhum padrão para as áreas desta pessoa.</div>'}</div>
    <div class="head" style="margin:22px 0 8px"><h3 style="margin:0;margin-right:auto">Treinamentos externos</h3>${podeT('rh', 'tst', 'instrutor') ? '<button class="btn sm ghost" id="fx-ext" type="button">+ Externo</button>' : ''}</div><div class="list">${EX.length ? EX.map(extRow).join('') : '<div class="empty">Nenhum.</div>'}</div>
    <h3>Portal do aluno</h3><div class="card">${al ? `<p style="margin:0">Acesso criado · login: <b>${esc(f.matricula)}</b>${al.trocarSenha ? ' · <span class="badge b-warn">ainda não entrou</span>' : ' · <span class="badge b-ok">já entrou</span>'}</p>` : '<p class="note" style="margin:0">Sem acesso ao portal do aluno.</p>'}
    ${MT.length ? '<div style="margin-top:8px">' + MT.map(m => { const c = T.cursos.find(x => x.id === m.cursoId) || {}; return `<div class="ritem"><div class="main"><b>${esc(c.nome || 'Curso removido')}</b><div class="note">${matStatus(m, c)}</div></div><button class="btn sm ghost" data-curso="${esc(c.id)}">Ver curso</button></div>`; }).join('') + '</div>' : ''}
    ${podeT('rh', 'tst') ? `<div class="actions"><button class="btn ${al ? 'ghost' : 'accent'}" id="fx-al" type="button">${al ? 'Gerar nova senha' : 'Criar acesso ao portal do aluno'}</button>${T.cursos.length ? '<button class="btn ghost" id="fx-lib" type="button">Liberar curso</button>' : ''}</div>` : ''}</div>`;
}
function funcExtraBind(f) {
  const s = $('#fx-sub'); if (s) s.onclick = () => escolherSubs(f);
  const e = $('#fx-ext'); if (e) e.onclick = () => openExt(null, f.id);
  const a = $('#fx-al'); if (a) a.onclick = () => criarAcessoAluno(f);
  const l = $('#fx-lib'); if (l) l.onclick = () => { const opts = T.cursos.filter(c => c.ativo !== false); openModal(mtop('Liberar curso para ' + esc(f.nome)) + `<div class="list">${opts.map(c => `<button class="item" data-libc="${esc(c.id)}"><div class="main"><div class="t1">${esc(c.nome)}</div><div class="t2">${(c.mods || []).length} módulo(s) · ${num(c.cargaHoraria)}h</div></div></button>`).join('')}</div>`);
    $$('#sheet [data-libc]').forEach(b => b.onclick = () => liberarPara(T.cursos.find(c => c.id === b.dataset.libc), [f.id])); };
}
function escolherSubs(f) {
  const atual = new Set(subsDe(f));
  openModal(mtop('Áreas de ' + esc(f.nome)) + `<div class="card">${T.areas.map(a => `<span class="lbl" style="margin-top:8px">${esc(a.nome)}</span>${(a.subs || []).map(s => `<label style="display:flex;gap:10px;align-items:center;color:inherit;font-size:15px;margin:4px 0"><input type="checkbox" data-esb="${esc(s.id)}" ${atual.has(s.id) ? 'checked' : ''}> ${esc(s.nome)}</label>`).join('')}`).join('')}</div>
    <div class="actions"><button class="btn ghost" id="esb-back" type="button">Voltar</button><button class="btn primary" id="esb-ok">Salvar</button></div>`);
  $('#esb-back').onclick = () => openFunc(f.id);
  $('#esb-ok').onclick = async () => { if (!guardWrite()) return; const L = $$('#sheet [data-esb]').filter(c => c.checked).map(c => c.dataset.esb);
    try { const sid = L.includes(f.subareaId) ? f.subareaId : (L[0] || ''); const inf = sid ? subInfo(sid) : null; await db.doc('funcionarios/' + f.id).update({ subareas: L, subareaId: sid, subarea: inf ? str(inf.sub.nome) : '', areaId: inf ? inf.area.id : (f.areaId || ''), area: inf ? str(inf.area.nome) : str(f.area) }); toast('Áreas salvas.', 'ok'); setTimeout(() => openFunc(f.id), 300); } catch (e) { handleErr(e); } };
}
async function criarAcessoAluno(f) {
  if (!guardWrite()) return;
  const chave = norm(f.matricula).replace(/[^a-z0-9]/g, '');
  if (!chave) return toast('Cadastre a matrícula do funcionário: ela é o login do portal do aluno.', 'bad');
  if (S.func.some(x => x.id !== f.id && norm(x.matricula).replace(/[^a-z0-9]/g, '') === chave)) return toast('Outra pessoa tem a mesma matrícula. Corrija antes de criar o acesso.', 'bad');
  if (!window.__FB || !window.__FB.criarAluno) return toast('Disponível só no app publicado.', 'bad');
  const b = $('#fx-al'); b.disabled = true; b.textContent = 'Criando…';
  try {
    const r = await window.__FB.criarAluno({ funcionarioId: f.id, nome: str(f.nome), chave });
    const msg = `Olá, ${str(f.nome).split(' ')[0]}! Seu acesso aos treinamentos da ${str((S.emp || {}).nome) || 'empresa'}:\n${ALUNO_URL}\nMatrícula: ${f.matricula}\nSenha provisória: ${r.senha}\nNo primeiro acesso você cria a sua senha.`;
    openModal(mtop('Acesso do aluno criado') + `<div class="card"><p style="margin-top:0">Envie para <b>${esc(f.nome)}</b>. A senha provisória aparece só agora.</p>
      <dl class="kv"><dt>Link</dt><dd>${esc(ALUNO_URL)}</dd><dt>Matrícula</dt><dd><b>${esc(f.matricula)}</b></dd><dt>Senha provisória</dt><dd><span class="code" style="font-size:18px">${esc(r.senha)}</span></dd></dl></div>
      <div class="actions"><button class="btn ghost" id="al-cp" type="button">Copiar mensagem</button><a class="btn accent" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a><button class="btn primary" id="al-ok" type="button">Concluído</button></div>`);
    $('#al-cp').onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Mensagem copiada.', 'ok'), () => toast('Não foi possível copiar.', 'bad'));
    $('#al-ok').onclick = () => openFunc(f.id);
  } catch (e) { toast((e && e.message) || 'Não foi possível criar o acesso.', 'bad'); b.disabled = false; b.textContent = 'Criar acesso ao portal do aluno'; }
}

/* ================= padrões operacionais ================= */
const PDF = { area: '' };
function tPadroes() {
  const L0 = T.pad.filter(p => p.ativo !== false);
  $('#pd-area').innerHTML = '<option value="">Todas as áreas</option>' + T.areas.map(a => `<option value="${esc(a.id)}" ${PDF.area === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('') + `<option value="_inat" ${PDF.area === '_inat' ? 'selected' : ''}>Padrões desativados</option>`;
  const R = L0.map(p => Object.assign({ p }, padResumo(p))); const tot = R.reduce((a, x) => a + x.n, 0), ok = R.reduce((a, x) => a + x.ok, 0);
  $('#pd-kpis').innerHTML = kpi('Padrões ativos', L0.length) + kpi('Treinamentos em dia', tot ? pct(ok, tot) + '%' : '—', tot && ok < tot ? 'warn' : 'ok', `${ok} de ${tot}`) + kpi('Pendentes', tot - ok, tot - ok ? 'bad' : '') + kpi('Áreas', T.areas.length) + kpi('Com prova', L0.filter(p => p.quiz && (p.quiz.qs || []).length).length);
  const q = norm($('#pd-q').value);
  let L = PDF.area === '_inat' ? T.pad.filter(p => p.ativo === false) : L0;
  if (PDF.area && PDF.area !== '_inat') { const ids = ((T.areas.find(a => a.id === PDF.area) || {}).subs || []).map(s => s.id); L = L.filter(p => p.areaId === PDF.area || (p.subIds || []).some(s => ids.includes(s))); }
  if (q) L = L.filter(p => norm(p.codigo + ' ' + p.titulo).includes(q));
  if (!L.length) { $('#pd-list').innerHTML = `<div class="empty">${T.pad.length ? 'Nada encontrado.' : (T.areas.length ? 'Nenhum padrão cadastrado. Toque em “+ Novo padrão” e anexe o PDF.' : 'Crie primeiro as áreas e subáreas em Cadastros → Áreas.')}</div>`; return; }
  const porArea = {}; L.forEach(p => { const k = p.areaId || '_'; (porArea[k] = porArea[k] || []).push(p); });
  $('#pd-list').innerHTML = Object.keys(porArea).sort((a, b) => str((T.areas.find(x => x.id === a) || {}).nome || 'zzz').localeCompare(str((T.areas.find(x => x.id === b) || {}).nome || 'zzz'), 'pt')).map(k => `<h3>${esc((T.areas.find(a => a.id === k) || {}).nome || 'Sem área')}</h3><div class="list">${porArea[k].sort((a, b) => str(a.codigo).localeCompare(str(b.codigo), 'pt', { numeric: true })).map(p => { const r = padResumo(p);
    return `<button class="item" data-padrao="${esc(p.id)}"><div class="main"><div class="t1"><span class="code">${esc(p.codigo)}</span> ${esc(p.titulo)}</div><div class="t2">Rev. ${esc(p.rev)} de ${fmtD(p.revData)} · ${esc((p.subIds || []).map(s => (subInfo(s) || { sub: { nome: '?' } }).sub.nome).join(', ') || 'sem subárea')}${p.quiz && (p.quiz.qs || []).length ? ' · com prova' : ''}</div></div><div class="side"><span class="badge ${r.ok === r.n ? 'b-ok' : 'b-warn'}">${r.ok}/${r.n} treinados</span></div></button>`; }).join('')}</div>`).join('');
}
$('#pd-area').onchange = e => { PDF.area = e.target.value; tPadroes(); };
$('#pd-q').addEventListener('input', tPadroes);
$('#pd-new').onclick = () => editPadrao(null);
document.addEventListener('click', e => { const b = e.target.closest('[data-padrao]'); if (b) openPadrao(b.dataset.padrao); });

/* prova: texto simples → questões. Formato:
   1) Pergunta?
   a) opção
   *b) opção correta */
function parseQuiz(txt) {
  const qs = []; let q = null; const erros = [];
  str(txt).split('\n').map(l => l.trim()).filter(Boolean).forEach((l, n) => {
    const op = l.match(/^(\*)?\s*([a-hA-H])\s*[).:-]\s*(.+)$/);
    const pq = l.match(/^\d+\s*[).:-]\s*(.+)$/);
    if (pq && !op) { q = { p: pq[1].trim(), o: [], c: -1 }; qs.push(q); return; }
    if (op && q) { if (op[1]) q.c = q.o.length; q.o.push(op[3].trim()); return; }
    if (q && !q.o.length) { q.p += ' ' + l; return; }
    erros.push(`Linha ${n + 1} não entendida: “${l.slice(0, 40)}”`);
  });
  qs.forEach((x, i) => { if (x.o.length < 2) erros.push(`Questão ${i + 1}: precisa de ao menos 2 opções.`); if (x.c < 0) erros.push(`Questão ${i + 1}: marque a correta com * antes da letra.`); });
  return { qs, erros };
}
const quizTexto = qz => (qz && qz.qs || []).map((x, i) => `${i + 1}) ${x.p}\n` + x.o.map((o, j) => `${j === x.c ? '*' : ''}${'abcdefgh'[j]}) ${o}`).join('\n')).join('\n\n');
const QUIZ_AJUDA = `<p class="note">Escreva assim (a correta leva * antes da letra):<br><span class="code">1) Qual EPI é obrigatório?</span><br><span class="code">a) Boné</span><br><span class="code">*b) Capacete</span><br><span class="code">c) Nenhum</span></p>`;

function editPadrao(id) {
  const p = id ? T.pad.find(x => x.id === id) : null; if (id && !p) return;
  if (!T.areas.length) { toast('Crie as áreas e subáreas primeiro (Cadastros → Áreas).', 'bad'); return go('cadastros'); }
  const v = k => esc(p ? p[k] : '');
  openModal(mtop(p ? 'Editar padrão' : 'Novo padrão operacional') + `<div class="card">
    <div class="grid2"><div><label for="pe-c">Código *</label><input id="pe-c" value="${v('codigo')}" placeholder="Ex.: PO-ACI-REF-012"></div><div><label for="pe-a">Área *</label><select id="pe-a"><option value="">Escolha…</option>${T.areas.map(a => `<option value="${esc(a.id)}" ${p && p.areaId === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div></div>
    <label for="pe-t">Título *</label><input id="pe-t" value="${v('titulo')}" placeholder="Ex.: Troca de válvula gaveta">
    <span class="lbl" style="margin-top:12px">Subáreas que precisam deste padrão *</span><div id="pe-subs" class="note">Escolha a área.</div>
    ${p ? '' : `<div class="grid2"><div><label for="pe-r">Revisão *</label><input id="pe-r" value="00"></div><div><label for="pe-rd">Data da revisão</label><input type="date" id="pe-rd" value="${todayStr()}"></div></div><label>PDF do padrão *</label>${fileInput('pe-f', 'application/pdf,image/*')}`}
    <label for="pe-m">Reciclagem (meses)</label><input id="pe-m" type="number" min="0" value="${p ? num(p.reciclMeses) || '' : ''}" placeholder="0 = só quando sair revisão nova"></div>
    <div class="card"><span class="lbl">Prova (opcional)</span>${QUIZ_AJUDA}<textarea id="pe-q" rows="8" placeholder="Deixe em branco para não ter prova">${esc(quizTexto(p && p.quiz))}</textarea>
    <div class="grid2"><div><label for="pe-qm">Nota mínima (%)</label><input id="pe-qm" type="number" min="1" max="100" value="${p && p.quiz ? num(p.quiz.min) : 70}"></div></div></div>
    <div class="actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pe-save">Salvar</button></div>`);
  const drawSubs = () => { const a = T.areas.find(x => x.id === $('#pe-a').value); $('#pe-subs').innerHTML = a ? ((a.subs || []).map(s => `<label style="display:flex;gap:10px;align-items:center;color:inherit;font-size:15px;margin:4px 0"><input type="checkbox" data-pes="${esc(s.id)}" ${p && (p.subIds || []).includes(s.id) ? 'checked' : ''}> ${esc(s.nome)}</label>`).join('') || 'A área não tem subáreas.') : 'Escolha a área.'; };
  $('#pe-a').onchange = drawSubs; drawSubs();
  $('#pe-save').onclick = async () => {
    if (!guardWrite()) return;
    const d = { codigo: $('#pe-c').value.trim(), titulo: $('#pe-t').value.trim(), areaId: $('#pe-a').value, subIds: $$('#sheet [data-pes]').filter(c => c.checked).map(c => c.dataset.pes), reciclMeses: num($('#pe-m').value) };
    const qt = $('#pe-q').value.trim(); if (qt) { const r = parseQuiz(qt); if (r.erros.length) return toast(r.erros[0], 'bad'); d.quiz = { qs: r.qs, min: Math.min(100, Math.max(1, num($('#pe-qm').value) || 70)) }; } else d.quiz = null;
    if (!d.codigo || !d.titulo || !d.areaId) return toast('Preencha código, título e área.', 'bad');
    if (!d.subIds.length) return toast('Marque ao menos uma subárea.', 'bad');
    if (T.pad.some(x => norm(x.codigo) === norm(d.codigo) && (!p || x.id !== p.id))) return toast('Já existe padrão com esse código.', 'bad');
    const file = $('#pe-f') && $('#pe-f').files[0];
    if (!p && !file) return toast('Anexe o PDF do padrão.', 'bad');
    const b = $('#pe-save'); b.disabled = true; b.textContent = file ? 'Enviando PDF…' : 'Salvando…';
    try {
      if (p) await db.doc('padroes/' + p.id).update(d);
      else { const arq = await salvarArquivo(file, 'padrao'); await db.collection('padroes').doc().set(Object.assign(d, { rev: $('#pe-r').value.trim() || '00', revData: $('#pe-rd').value || todayStr(), arquivoId: arq, arquivoNome: file.name, hist: [], inc: [], exc: [], ativo: true, criadoEm: new Date().toISOString(), por: S.uid || '' })); }
      closeModal(); toast('Padrão salvo.', 'ok');
    } catch (e) { handleErr(e); b.disabled = false; b.textContent = 'Salvar'; }
  };
}
function openPadrao(id) {
  const p = T.pad.find(x => x.id === id); if (!p) return;
  const r = padResumo(p); const grp = k => r.L.filter(x => x.s.st === k || (k === 'rev' && x.s.st === 'recicl'));
  const w = papelAtual() !== 'consulta';
  const linha = x => `<div class="ritem"><div class="main"><button class="link" data-ofunc="${esc(x.f.id)}" style="padding:0;text-align:left">${esc(x.f.nome)}</button><div class="note">${esc(x.f.funcao || '')}${x.s.r ? ` · rev. ${esc(x.s.r.rev)} em ${fmtD(str(x.s.r.data).slice(0, 10))} · ${({ lista: 'lista anexada', app: 'assinou no app', ead: 'portal do aluno' })[x.s.r.forma] || ''}${x.s.r.nota != null && x.s.r.nota !== '' ? ' · nota ' + num(x.s.r.nota) + '%' : ''}` : ''}</div></div>${x.s.r && x.s.r.arquivoId ? arqBtn(x.s.r.arquivoId, 'Lista') : ''}${w && x.s.st === 'pend' && !(p.inc || []).includes(x.f.id) ? `<button class="btn sm ghost" data-pexc="${esc(x.f.id)}" title="Esta pessoa não precisa deste padrão">Não se aplica</button>` : ''}${w && (p.inc || []).includes(x.f.id) ? `<button class="btn sm ghost" data-pinr="${esc(x.f.id)}">Remover</button>` : ''}</div>`;
  openModal(mtop(`<span class="code">${esc(p.codigo)}</span> ${esc(p.titulo)}`) + `<div class="card"><dl class="kv"><dt>Revisão</dt><dd><b>${esc(p.rev)}</b> de ${fmtD(p.revData)}</dd><dt>Área</dt><dd>${esc((T.areas.find(a => a.id === p.areaId) || {}).nome || '—')}</dd><dt>Subáreas</dt><dd>${esc((p.subIds || []).map(subNome).join(', '))}</dd>
    <dt>Reciclagem</dt><dd>${num(p.reciclMeses) ? 'a cada ' + num(p.reciclMeses) + ' meses' : 'quando sair revisão nova'}</dd><dt>Prova</dt><dd>${p.quiz && (p.quiz.qs || []).length ? `${p.quiz.qs.length} questões · mínimo ${num(p.quiz.min)}%` : 'sem prova'}</dd><dt>Situação</dt><dd>${r.ok}/${r.n} treinados na revisão atual</dd></dl>
    <div class="actions">${arqBtn(p.arquivoId, 'Abrir PDF (rev. ' + esc(p.rev) + ')')}${(p.hist || []).map(h => arqBtn(h.arquivoId, 'Rev. ' + esc(h.rev))).join('')}</div></div>
    ${w ? `<div class="actions" style="margin-top:0"><button class="btn accent" id="pp-app" type="button">Assinar no app</button><button class="btn ghost" id="pp-lista" type="button">Lançar lista assinada</button></div>
    <div class="actions" style="margin-top:6px"><button class="btn ghost" id="pp-pdf" type="button">Lista de presença (PDF)</button><button class="btn ghost" id="pp-inc" type="button">+ Incluir pessoa</button><button class="btn ghost" id="pp-rev" type="button">Nova revisão</button><button class="btn ghost" id="pp-ed" type="button">Editar</button></div>` : `<div class="actions" style="margin-top:0"><button class="btn ghost" id="pp-pdf" type="button">Lista de presença (PDF)</button></div>`}
    <h3>Pendentes (${grp('pend').length})</h3><div class="card" style="padding:4px 12px">${grp('pend').map(linha).join('') || '<p class="note">Ninguém.</p>'}</div>
    <h3>Revisão desatualizada ou reciclagem vencida (${grp('rev').length})</h3><div class="card" style="padding:4px 12px">${grp('rev').map(linha).join('') || '<p class="note">Ninguém.</p>'}</div>
    <h3>Treinados na revisão ${esc(p.rev)} (${grp('ok').length})</h3><div class="card" style="padding:4px 12px">${grp('ok').map(linha).join('') || '<p class="note">Ninguém ainda.</p>'}</div>
    ${(p.exc || []).length ? `<p class="note">Não se aplica a: ${(p.exc || []).map(i => esc((funcDe(i) || {}).nome || '?')).join(', ')}${w ? ' · <button class="link" id="pp-exc0" type="button">desfazer</button>' : ''}</p>` : ''}
    ${w ? `<div class="actions"><button class="btn danger" id="pp-at" type="button">${p.ativo === false ? 'Reativar padrão' : 'Desativar padrão'}</button></div>` : ''}`);
  $('#pp-pdf').onclick = () => pdfListaPadrao(p);
  if (!w) return;
  $('#pp-ed').onclick = () => editPadrao(p.id);
  $('#pp-rev').onclick = () => novaRevisao(p);
  $('#pp-lista').onclick = () => lancarLista(p);
  $('#pp-app').onclick = () => assinarNoApp(p);
  $('#pp-inc').onclick = () => selFuncs('Incluir no padrão ' + p.codigo, [], async ids => { if (!guardWrite()) return; try { await db.doc('padroes/' + p.id).update({ inc: [...new Set((p.inc || []).concat(ids))], exc: (p.exc || []).filter(i => !ids.includes(i)) }); toast('Incluído(s).', 'ok'); setTimeout(() => openPadrao(p.id), 300); } catch (e) { handleErr(e); } }, { ok: 'Incluir', lista: funcAtivos().filter(f => !precisa(p, f)) });
  const pe = async (campo, val) => { if (!guardWrite()) return; try { await db.doc('padroes/' + p.id).update({ [campo]: val }); setTimeout(() => openPadrao(p.id), 250); } catch (e) { handleErr(e); } };
  $$('#sheet [data-pexc]').forEach(b => b.onclick = () => pe('exc', [...new Set((p.exc || []).concat(b.dataset.pexc))]));
  $$('#sheet [data-pinr]').forEach(b => b.onclick = () => pe('inc', (p.inc || []).filter(i => i !== b.dataset.pinr)));
  const e0 = $('#pp-exc0'); if (e0) e0.onclick = () => pe('exc', []);
  let armed = false; $('#pp-at').onclick = () => { if (p.ativo !== false && !armed) { armed = true; $('#pp-at').textContent = 'Toque de novo para desativar'; return; } pe('ativo', p.ativo === false); };
}
function novaRevisao(p) {
  openModal(mtop('Nova revisão · ' + esc(p.codigo)) + `<div class="card"><p class="note" style="margin-top:0">Quem assinou a revisão ${esc(p.rev)} passa a <b>Revisão desatualizada</b> e o padrão volta para a lista de pendências dessas pessoas.</p>
    <div class="grid2"><div><label for="nr-r">Nova revisão *</label><input id="nr-r" value="${esc(String(num(p.rev) + 1).padStart(2, '0'))}"></div><div><label for="nr-d">Data *</label><input type="date" id="nr-d" value="${todayStr()}"></div></div>
    <label>PDF da nova revisão *</label>${fileInput('nr-f', 'application/pdf,image/*')}</div>
    <div class="actions"><button class="btn ghost" id="nr-back" type="button">Voltar</button><button class="btn primary" id="nr-ok">Publicar revisão</button></div>`);
  $('#nr-back').onclick = () => openPadrao(p.id);
  $('#nr-ok').onclick = async () => {
    if (!guardWrite()) return; const rev = $('#nr-r').value.trim(), file = $('#nr-f').files[0];
    if (!rev || !file) return toast('Informe a revisão e anexe o PDF.', 'bad');
    if (str(rev) === str(p.rev)) return toast('A revisão nova precisa ser diferente da atual.', 'bad');
    const b = $('#nr-ok'); b.disabled = true; b.textContent = 'Enviando PDF…';
    try { const arq = await salvarArquivo(file, 'padrao'); await db.doc('padroes/' + p.id).update({ rev, revData: $('#nr-d').value || todayStr(), arquivoId: arq, arquivoNome: file.name, hist: (p.hist || []).concat([{ rev: p.rev, revData: p.revData, arquivoId: p.arquivoId }]) });
      toast('Revisão publicada.', 'ok'); setTimeout(() => openPadrao(p.id), 300); } catch (e) { handleErr(e); b.disabled = false; b.textContent = 'Publicar revisão'; }
  };
}
function lancarLista(p) {
  const r = padResumo(p); const pend = r.L.filter(x => x.s.st !== 'ok').map(x => x.f.id);
  selFuncs('Quem está na lista assinada', pend, ids => {
    if (!ids.length) return toast('Marque quem está na lista.', 'bad');
    openModal(mtop('Lista assinada · ' + esc(p.codigo)) + `<div class="card"><p style="margin-top:0">${ids.length} pessoa(s) · revisão <b>${esc(p.rev)}</b></p>
      <div class="grid2"><div><label for="ll-d">Data do treinamento *</label><input type="date" id="ll-d" value="${todayStr()}"></div><div><label for="ll-i">Instrutor / quem aplicou</label><input id="ll-i"></div></div>
      <label>Lista assinada escaneada (PDF ou foto) *</label>${fileInput('ll-f')}</div>
      <div class="actions"><button class="btn ghost" id="ll-back" type="button">Voltar</button><button class="btn primary" id="ll-ok">Salvar</button></div>`);
    $('#ll-back').onclick = () => openPadrao(p.id);
    $('#ll-ok').onclick = async () => {
      if (!guardWrite()) return; const file = $('#ll-f').files[0], data = $('#ll-d').value;
      if (!file || !data) return toast('Informe a data e anexe a lista.', 'bad');
      const b = $('#ll-ok'); b.disabled = true; b.textContent = 'Enviando lista…';
      try { const arq = await salvarArquivo(file, 'lista_padrao');
        for (const fid of ids) { const f = funcDe(fid) || {}; await db.collection('padrao_reg').doc().set({ padraoId: p.id, codigo: p.codigo, rev: p.rev, funcionarioId: fid, nome: str(f.nome), data, forma: 'lista', arquivoId: arq, instrutor: $('#ll-i').value.trim(), em: new Date().toISOString(), por: S.uid || '' }); await sleep(30); }
        toast(`${ids.length} registro(s) salvos.`, 'ok'); setTimeout(() => openPadrao(p.id), 300); } catch (e) { handleErr(e); b.disabled = false; b.textContent = 'Salvar'; }
    };
  }, { ok: 'Continuar' });
}
function assinarNoApp(p) {
  const r = padResumo(p); const pend = r.L.filter(x => x.s.st !== 'ok').map(x => x.f.id);
  selFuncs('Quem vai assinar agora', pend, ids => {
    if (!ids.length) return toast('Marque quem vai assinar.', 'bad');
    const fila = ids.map(funcDe).filter(Boolean); let i = 0; let instr = ''; let feitos = 0;
    const tela = () => {
      const f = fila[i];
      openModal(mtop(`Assinatura ${i + 1} de ${fila.length}`) + `<div class="card"><p style="margin:0 0 4px"><b style="font-size:18px">${esc(f.nome)}</b></p><p class="note" style="margin:0">${esc([f.matricula, f.funcao].filter(Boolean).join(' · '))}</p>
        ${i === 0 ? `<label for="sa-i">Instrutor / quem aplicou</label><input id="sa-i" value="${esc(instr)}">` : ''}
        <p class="termo" style="margin-top:12px">Declaro que recebi o treinamento do padrão operacional <b>${esc(p.codigo)} · ${esc(p.titulo)}</b>, revisão ${esc(p.rev)}, entendi o conteúdo e me comprometo a cumpri-lo.</p>
        <div class="padwrap"><canvas id="padP"></canvas><span class="padhint">Assine aqui com o dedo</span><button class="link" id="padP-clear" type="button">Limpar</button></div></div>
        <div class="actions"><button class="btn ghost" id="sa-skip" type="button">Pular</button><button class="btn primary" id="sa-ok">Confirmar assinatura</button></div>`);
      const pad = Pad($('#padP')); requestAnimationFrame(() => pad.resize()); $('#padP-clear').onclick = () => pad.clear();
      const prox = () => { i++; if (i < fila.length) tela(); else { closeModal(); toast(`${feitos} assinatura(s) registrada(s).`, 'ok'); setTimeout(() => openPadrao(p.id), 300); } };
      $('#sa-skip').onclick = prox;
      $('#sa-ok').onclick = async () => {
        if (!guardWrite()) return; if ($('#sa-i')) instr = $('#sa-i').value.trim();
        if (pad.isEmpty()) return toast('Falta a assinatura.', 'bad');
        const b = $('#sa-ok'); b.disabled = true;
        try { await db.collection('padrao_reg').doc().set({ padraoId: p.id, codigo: p.codigo, rev: p.rev, funcionarioId: f.id, nome: str(f.nome), data: new Date().toISOString(), forma: 'app', ass: pad.toData(), instrutor: instr, em: new Date().toISOString(), por: S.uid || '' }); feitos++; prox(); }
        catch (e) { handleErr(e); b.disabled = false; }
      };
    };
    tela();
  }, { ok: 'Começar assinaturas' });
}
async function pdfListaPadrao(p) {
  toast('Gerando lista…'); try { await loadPDF(); } catch (_) { return toast('Sem conexão para gerar o PDF.', 'bad'); }
  const P = PDFW(); const regs = T.preg.filter(r => r.padraoId === p.id && str(r.rev) === str(p.rev)).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  const ult = {}; regs.forEach(r => { if (!ult[r.funcionarioId] || str(ult[r.funcionarioId].data) < str(r.data)) ult[r.funcionarioId] = r; });
  P.header('LISTA DE PRESENÇA', 'Padrão operacional');
  P.box([['Padrão', p.codigo], ['Revisão', p.rev + ' de ' + fmtD(p.revData)], ['Título', p.titulo], ['Subáreas', (p.subIds || []).map(x => subNome(x).replace('→', '-')).join(', ')]]);
  P.y += 2; const doc = P.doc; const L = P.L, W = P.W; const cols = [8, 70, 26, 24, 52];
  const hdr = () => { P.font(8, true); let x = L; ['#', 'Nome', 'Matrícula', 'Data', 'Assinatura / forma'].forEach((h, k) => { doc.text(h, x + 1, P.y + 4); x += cols[k]; }); P.y += 6; doc.setDrawColor(200); doc.line(L, P.y, L + W, P.y); };
  hdr();
  Object.values(ult).forEach((r, k) => {
    if (P.need(16)) hdr(); const f = funcDe(r.funcionarioId) || {}; let x = L; P.font(8.5);
    [String(k + 1), str(r.nome), str(f.matricula), fmtD(str(r.data).slice(0, 10))].forEach((t, j) => { doc.text(doc.splitTextToSize(t, cols[j] - 2)[0] || '', x + 1, P.y + 6); x += cols[j]; });
    if (r.ass && safeImg(r.ass)) { try { doc.addImage(r.ass, 'PNG', x + 1, P.y + 0.8, 36, 12.75); } catch (_) {} }
    else { P.font(8, false, [90, 96, 110]); doc.text(({ lista: 'Lista física anexada', ead: 'Portal do aluno' })[r.forma] || '', x + 1, P.y + 6); }
    P.y += 15; doc.setDrawColor(225); doc.line(L, P.y, L + W, P.y);
  });
  if (!Object.keys(ult).length) P.text('Ninguém treinado nesta revisão ainda.');
  P.footer(`${p.codigo} rev. ${p.rev} · gerado em ${fmtDT(new Date().toISOString())}`);
  salvarPDF(P, 'lista_' + norm(p.codigo).replace(/[^a-z0-9]+/g, '_') + '_rev' + norm(p.rev) + '.pdf', 1);
}

/* ================= cursos EaD ================= */
function matStatus(m, c) {
  const mods = (c && c.mods) || []; const okm = mods.filter(md => ((m.prog || {})[md.id] || {}).ok).length;
  const h = Math.round(num(m.tempo) / 360) / 10;
  if (m.certId) return `<span class="badge b-ok">Certificado emitido</span> · ${h}h de estudo`;
  if (m.concluidoEm) return c && c.pratica && !m.praticaOk ? `<span class="badge b-info">Teoria concluída · falta a prática</span> · ${h}h` : `<span class="badge b-ok">Concluído</span> · ${h}h`;
  const travado = mods.some(md => { const pr = (m.prog || {})[md.id] || {}; return !pr.ok && md.quiz && num(md.quiz.tent) && num(pr.tent) >= num(md.quiz.tent); });
  if (travado) return `<span class="badge b-bad">Reprovado: sem tentativas</span> · ${okm}/${mods.length} módulos`;
  return `${m.inicioEm ? `<span class="badge b-warn">Em andamento</span> · ${okm}/${mods.length} módulos · ${h}h` : '<span class="badge b-mut">Não começou</span>'}${m.prazo ? ' · prazo ' + fmtD(m.prazo) : ''}`;
}
function tCursos() {
  const L = T.cursos.slice().sort((a, b) => (a.ativo === false) - (b.ativo === false) || str(a.nome).localeCompare(str(b.nome), 'pt'));
  $('#cu-list').innerHTML = L.length ? L.map(c => { const M = T.mat.filter(m => m.cursoId === c.id); const con = M.filter(m => m.concluidoEm).length; const pr = M.filter(m => m.concluidoEm && c.pratica && !m.praticaOk).length;
    return `<button class="item" data-curso="${esc(c.id)}"><div class="main"><div class="t1">${esc(c.nome)}</div><div class="t2">${(c.mods || []).length} módulo(s) · ${num(c.cargaHoraria)}h${c.pratica ? ' · com prática presencial' : ''}${c.ativo === false ? ' · desativado' : ''}</div></div><div class="side"><span class="badge b-info">${M.length} liberado(s)</span><span class="note">${con} concluído(s)${pr ? ' · ' + pr + ' aguardando prática' : ''}</span></div></button>`; }).join('')
    : '<div class="empty">Nenhum curso. Toque em “+ Novo curso”: divida em módulos, anexe PDFs ou vídeos do YouTube e escreva a prova de cada módulo.</div>';
}
$('#cu-new').onclick = () => editCurso(null);
$('#cu-link').onclick = () => {
  openModal(mtop('Portal do aluno') + `<div class="card"><p style="margin-top:0">O funcionário entra por este link com a <b>matrícula</b> e a senha. O acesso é criado na ficha do funcionário (Cadastros → Funcionários → Portal do aluno).</p><p><span class="code">${esc(ALUNO_URL)}</span></p></div><div class="actions"><button class="btn primary" id="cl-cp">Copiar link</button></div>`);
  $('#cl-cp').onclick = () => navigator.clipboard.writeText(ALUNO_URL).then(() => toast('Link copiado.', 'ok'), () => toast('Não foi possível copiar.', 'bad'));
};
document.addEventListener('click', e => { const b = e.target.closest('[data-curso]'); if (b && b.dataset.curso) openCurso(b.dataset.curso); });

const ytId = u => { const m = str(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
let CU = null;
/* assinatura escaneada: recorta, deixa o fundo branco transparente e reduz */
async function assinaturaPng(file) {
  const url = await lerComoDataURL(file); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const k = Math.min(1, 700 / img.width); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let i = 0; i < p.length; i += 4) { const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; if (l > 170) p[i + 3] = 0; else { p[i] = p[i + 1] = p[i + 2] = Math.min(l, 60); const q = i / 4, px = q % c.width, py = Math.floor(q / c.width); if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } }
  x.putImageData(d, 0, 0); if (x1 <= x0) throw new Error('vazia');
  const o = document.createElement('canvas'); o.width = x1 - x0 + 8; o.height = y1 - y0 + 8; o.getContext('2d').drawImage(c, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height); return o.toDataURL('image/png');
}
function editCurso(id) {
  const c = id ? T.cursos.find(x => x.id === id) : null; if (id && !c) return;
  if (!S.tt.length) { toast('Cadastre os tipos de treinamento primeiro: o curso usa o tipo para emitir o certificado.', 'bad'); return; }
  CU = { c, mods: c ? JSON.parse(JSON.stringify(c.mods || [])) : [{ id: novoId(), titulo: 'Módulo 1', mats: [], quiz: null, quizTxt: '', min: 70, tent: 3 }], files: {} };
  CU.mods.forEach(m => { m.quizTxt = quizTexto(m.quiz); m.min = m.quiz ? num(m.quiz.min) : 70; m.tent = m.quiz ? num(m.quiz.tent) : 3; });
  const v = k => esc(c ? c[k] : '');
  openModal(mtop(c ? 'Editar curso' : 'Novo curso on-line') + `<div class="card">
    <label for="ce-n">Nome do curso *</label><input id="ce-n" value="${v('nome')}" placeholder="Ex.: NR-10 Básico (teoria EaD)">
    <label for="ce-t">Tipo de treinamento (vai no certificado) *</label><select id="ce-t"><option value="">Escolha…</option>${S.tt.slice().sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')).map(t => `<option value="${esc(t.id)}" ${c && c.tipoId === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
    <div class="grid3"><div><label for="ce-ch">Carga horária (h) *</label><input id="ce-ch" type="number" min="1" value="${c ? num(c.cargaHoraria) : ''}"></div><div><label for="ce-mh">Tempo mínimo de estudo (h)</label><input id="ce-mh" type="number" min="0" step="0.5" value="${c ? num(c.minHoras) : ''}" placeholder="0 = não exige"></div><div><label for="ce-pz">Prazo (dias)</label><input id="ce-pz" type="number" min="0" value="${c ? num(c.prazoDias) || '' : ''}" placeholder="opcional"></div></div>
    <label style="display:flex;gap:8px;align-items:center;color:inherit;font-size:15px;margin-top:12px"><input type="checkbox" id="ce-pr" ${c && c.pratica ? 'checked' : ''}> Tem parte prática presencial (o certificado só sai depois que ela for marcada)</label>
    <label style="display:flex;gap:8px;align-items:center;color:inherit;font-size:15px;margin-top:12px"><input type="checkbox" id="ce-alt" ${c && c.instrPadrao === false ? 'checked' : ''}> Alterar instrutor / responsável técnico deste curso</label><p class="note" id="ce-padr" style="margin:2px 0 0">Se não marcar, o certificado sai com o padrão da empresa: ${esc((S.emp || {}).instrutorNome || '(preencha em Cadastros → Empresa)')}${(S.emp || {}).instrutorQualif ? ' · ' + esc(S.emp.instrutorQualif) : ''}, e TST ${esc((S.emp || {}).tstNome || '—')}.</p>
    <div id="ce-altbox" ${c && c.instrPadrao === false ? '' : 'style="display:none"'}>
    <div class="grid2"><div><label for="ce-in">Instrutor / responsável técnico *</label><input id="ce-in" value="${v('instrutor')}"></div><div><label for="ce-iq">Qualificação *</label><input id="ce-iq" value="${v('instrutorQualif')}" placeholder="Ex.: Eng. Eletricista · CREA 000000"></div></div>
    <label>Assinatura do instrutor (sai sozinha nos certificados)</label><div style="display:flex;gap:10px;align-items:center"><div id="ce-sigv" style="width:180px;height:60px;border:1px dashed #ccd;border-radius:8px;display:grid;place-items:center;background:#fff">${c && ((S.cursoSig || {})[c.id] || c.instrutorAssin) ? `<img src="${(S.cursoSig || {})[c.id] || c.instrutorAssin}" style="max-width:170px;max-height:54px">` : '<span class="note">sem imagem</span>'}</div><input type="file" id="ce-sig" accept="image/*" style="padding:8px;flex:1"></div>
    <p class="note" style="margin-top:2px">Foto da assinatura em papel branco, bem recortada. O fundo branco fica transparente.</p></div>
    <label for="ce-d">Descrição para o aluno</label><textarea id="ce-d" rows="2">${v('descricao')}</textarea></div>
    <div id="ce-mods"></div><button class="btn ghost" id="ce-addm" type="button" style="width:100%">+ Módulo</button>
    <div class="actions">${c ? `<button class="btn danger" id="ce-at" type="button">${c.ativo === false ? 'Reativar' : 'Desativar'}</button>` : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ce-save">Salvar curso</button></div>`);
  $('#ce-t').onchange = () => { const t = S.tt.find(x => x.id === $('#ce-t').value); if (t && !$('#ce-ch').value) $('#ce-ch').value = num(t.cargaHoraria); if (t && !$('#ce-n').value) $('#ce-n').value = t.nome; };
  const draw = () => {
    $('#ce-mods').innerHTML = CU.mods.map((m, i) => `<div class="card" data-cm="${i}"><div class="head" style="margin:0 0 6px"><span class="lbl" style="margin:0;margin-right:auto">Módulo ${i + 1}</span>${i > 0 ? `<button class="btn sm ghost" data-cmup="${i}" type="button">↑</button>` : ''}${CU.mods.length > 1 ? `<button class="btn sm danger" data-cmdel="${i}" type="button">Remover</button>` : ''}</div>
      <label>Título do módulo *</label><input data-cmt="${i}" value="${esc(m.titulo)}">
      <span class="lbl" style="margin-top:12px">Materiais (o aluno precisa ver todos)</span>
      ${(m.mats || []).map((x, j) => `<div class="erow"><div class="ehead"><div class="main"><b>${esc(x.titulo || '(sem título)')}</b><div class="note">${({ pdf: 'PDF', video: 'Vídeo (YouTube)', texto: 'Texto', link: 'Link' })[x.tipo]}${x.tipo === 'pdf' ? (x.arquivoId ? ' · anexado' : CU.files[x.id] ? ' · ' + esc(CU.files[x.id].name) + ' (será enviado)' : ' · <b style="color:var(--bad)">falta o arquivo</b>') : ''} · mínimo ${num(x.minMin) || 0} min</div></div><button class="x" type="button" data-cmxd="${i}|${j}" aria-label="Remover">×</button></div>
        <div class="grid2"><div><label>Título</label><input data-cmxt="${i}|${j}" value="${esc(x.titulo)}"></div><div><label>Tempo mínimo (min)</label><input type="number" min="0" data-cmxm="${i}|${j}" value="${num(x.minMin) || ''}"></div></div>
        ${x.tipo === 'video' || x.tipo === 'link' ? `<label>${x.tipo === 'video' ? 'Link do YouTube' : 'Endereço (https://…)'}</label><input data-cmxu="${i}|${j}" value="${esc(x.url)}" placeholder="https://…">${x.tipo === 'video' && x.url && !ytId(x.url) ? '<p class="note" style="color:var(--bad)">Não reconheci o link do YouTube.</p>' : ''}` : ''}
        ${x.tipo === 'texto' ? `<label>Texto</label><textarea rows="5" data-cmxx="${i}|${j}">${esc(x.texto)}</textarea>` : ''}
        ${x.tipo === 'pdf' ? `<label>${x.arquivoId ? 'Trocar o PDF' : 'Arquivo PDF'}</label><input type="file" accept="application/pdf" data-cmxf="${i}|${j}" style="padding:8px">${x.arquivoId ? ' ' + arqBtn(x.arquivoId, 'Abrir atual') : ''}` : ''}</div>`).join('')}
      <div class="actions" style="margin-top:8px"><button class="btn sm ghost" data-cmadd="${i}|pdf" type="button">+ PDF</button><button class="btn sm ghost" data-cmadd="${i}|video" type="button">+ Vídeo</button><button class="btn sm ghost" data-cmadd="${i}|texto" type="button">+ Texto</button><button class="btn sm ghost" data-cmadd="${i}|link" type="button">+ Link</button></div>
      <span class="lbl" style="margin-top:14px">Prova do módulo</span>${i === 0 ? QUIZ_AJUDA : ''}<textarea rows="6" data-cmq="${i}" placeholder="Em branco = módulo sem prova">${esc(m.quizTxt)}</textarea>
      <div class="grid2"><div><label>Nota mínima (%)</label><input type="number" min="1" max="100" data-cmqm="${i}" value="${num(m.min) || 70}"></div><div><label>Tentativas</label><input type="number" min="1" data-cmqt="${i}" value="${num(m.tent) || 3}"></div></div></div>`).join('');
  };
  draw();
  const ij = s => s.split('|').map(Number);
  const box = $('#ce-mods');
  box.addEventListener('input', e => { const t = e.target, d = t.dataset;
    if (d.cmt != null) CU.mods[+d.cmt].titulo = t.value;
    if (d.cmq != null) CU.mods[+d.cmq].quizTxt = t.value; if (d.cmqm != null) CU.mods[+d.cmqm].min = num(t.value); if (d.cmqt != null) CU.mods[+d.cmqt].tent = num(t.value);
    if (d.cmxt) { const [i, j] = ij(d.cmxt); CU.mods[i].mats[j].titulo = t.value; } if (d.cmxm) { const [i, j] = ij(d.cmxm); CU.mods[i].mats[j].minMin = num(t.value); }
    if (d.cmxu) { const [i, j] = ij(d.cmxu); CU.mods[i].mats[j].url = t.value.trim(); } if (d.cmxx) { const [i, j] = ij(d.cmxx); CU.mods[i].mats[j].texto = t.value; } });
  box.addEventListener('change', e => { const d = e.target.dataset; if (d.cmxf) { const [i, j] = ij(d.cmxf); const f = e.target.files[0]; const x = CU.mods[i].mats[j]; if (f) { CU.files[x.id] = f; if (!x.titulo) x.titulo = f.name.replace(/\.pdf$/i, ''); } draw(); } if (d.cmxu) draw(); });
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.cmadd) { const [i, tp] = d.cmadd.split('|'); CU.mods[+i].mats.push({ id: novoId(), tipo: tp, titulo: '', minMin: tp === 'video' ? 0 : 5 }); draw(); }
    if (d.cmxd) { const [i, j] = ij(d.cmxd); CU.mods[i].mats.splice(j, 1); draw(); }
    if (d.cmdel != null) { CU.mods.splice(+d.cmdel, 1); draw(); }
    if (d.cmup != null) { const i = +d.cmup; [CU.mods[i - 1], CU.mods[i]] = [CU.mods[i], CU.mods[i - 1]]; draw(); } });
  $('#ce-addm').onclick = () => { CU.mods.push({ id: novoId(), titulo: 'Módulo ' + (CU.mods.length + 1), mats: [], quiz: null, quizTxt: '', min: 70, tent: 3 }); draw(); };
  const at = $('#ce-at'); if (at) at.onclick = async () => { if (!guardWrite()) return; try { await db.doc('cursos/' + c.id).update({ ativo: c.ativo === false }); closeModal(); toast('Feito.', 'ok'); } catch (e) { handleErr(e); } };
  $('#ce-alt').onchange = ev => { $('#ce-altbox').style.display = ev.target.checked ? '' : 'none'; $('#ce-padr').style.display = ev.target.checked ? 'none' : ''; }; if ($('#ce-alt').checked) $('#ce-padr').style.display = 'none';
  $('#ce-sig').onchange = async () => { const f = $('#ce-sig').files[0]; if (!f) return; try { CU.sig = await assinaturaPng(f); $('#ce-sigv').innerHTML = `<img src="${CU.sig}" style="max-width:170px;max-height:54px">`; } catch (e) { toast('Não foi possível ler a imagem.', 'bad'); } };
  $('#ce-save').onclick = async () => {
    if (!guardWrite()) return;
    const sigCurso = CU.sig !== undefined ? CU.sig : str((c && (S.cursoSig || {})[c.id]) || (c && c.instrutorAssin)); const d = { instrutorAssin: '', nome: $('#ce-n').value.trim(), tipoId: $('#ce-t').value, cargaHoraria: num($('#ce-ch').value), minHoras: num($('#ce-mh').value), prazoDias: num($('#ce-pz').value), pratica: $('#ce-pr').checked, instrutor: $('#ce-in').value.trim(), instrutorQualif: $('#ce-iq').value.trim(), descricao: $('#ce-d').value.trim() };
    if (!d.nome || !d.tipoId || !d.cargaHoraria) return toast('Preencha nome, tipo de treinamento e carga horária.', 'bad');
    d.instrPadrao = !$('#ce-alt').checked;
    if (!d.instrPadrao && (!d.instrutor || !d.instrutorQualif)) return toast('Informe o instrutor/responsável técnico e a qualificação (vão no certificado).', 'bad');
    if (d.instrPadrao && !str((S.emp || {}).instrutorNome)) return toast('Preencha o instrutor padrão em Cadastros → Empresa, ou marque "Alterar instrutor".', 'bad');
    for (const [i, m] of CU.mods.entries()) {
      if (!str(m.titulo).trim()) return toast(`Módulo ${i + 1}: falta o título.`, 'bad');
      if (!(m.mats || []).length) return toast(`Módulo ${i + 1}: adicione ao menos um material.`, 'bad');
      for (const x of m.mats) { if (!str(x.titulo).trim()) return toast(`Módulo ${i + 1}: dê um título a cada material.`, 'bad'); if (x.tipo === 'pdf' && !x.arquivoId && !CU.files[x.id]) return toast(`Módulo ${i + 1}: escolha o arquivo do PDF “${x.titulo}”.`, 'bad'); if (x.tipo === 'video' && !ytId(x.url)) return toast(`Módulo ${i + 1}: link do YouTube inválido em “${x.titulo}”.`, 'bad'); if (x.tipo === 'link' && !/^https:\/\//.test(str(x.url))) return toast(`Módulo ${i + 1}: o link precisa começar com https://`, 'bad'); }
      if (str(m.quizTxt).trim()) { const r = parseQuiz(m.quizTxt); if (r.erros.length) return toast(`Módulo ${i + 1}: ${r.erros[0]}`, 'bad'); }
    }
    const b = $('#ce-save'); b.disabled = true;
    try {
      const nf = Object.keys(CU.files).length; let k = 0;
      for (const m of CU.mods) for (const x of m.mats) if (x.tipo === 'pdf' && CU.files[x.id]) { k++; b.textContent = `Enviando PDF ${k} de ${nf}…`; x.arquivoId = await salvarArquivo(CU.files[x.id], 'curso'); delete CU.files[x.id]; }
      b.textContent = 'Salvando…';
      d.mods = CU.mods.map(m => { const r = str(m.quizTxt).trim() ? parseQuiz(m.quizTxt) : null; return { id: m.id, titulo: str(m.titulo).trim(), mats: m.mats.map(x => ({ id: x.id, tipo: x.tipo, titulo: str(x.titulo).trim(), minMin: num(x.minMin), url: str(x.url), texto: str(x.texto), arquivoId: str(x.arquivoId) })), quiz: r ? { qs: r.qs, min: Math.min(100, Math.max(1, num(m.min) || 70)), tent: Math.max(1, num(m.tent) || 3) } : null }; });
      let cid = c && c.id; if (c) await db.doc('cursos/' + c.id).update(d); else { const ref = db.collection('cursos').doc(); cid = ref.id; await ref.set(Object.assign(d, { ativo: true, criadoEm: new Date().toISOString(), por: S.uid || '' })); }
      await db.doc('cursos_priv/' + cid).set({ instrutorAssin: sigCurso });
      closeModal(); toast('Curso salvo.', 'ok');
    } catch (e) { handleErr(e); b.disabled = false; b.textContent = 'Salvar curso'; }
  };
}
function openCurso(id) {
  const c = T.cursos.find(x => x.id === id); if (!c) return;
  const M = T.mat.filter(m => m.cursoId === c.id).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  const w = papelAtual() !== 'consulta'; const t = S.tt.find(x => x.id === c.tipoId);
  const notas = m => (c.mods || []).map(md => { const pr = (m.prog || {})[md.id] || {}; return pr.nota != null ? num(pr.nota) + '%' : '—'; }).join(' · ');
  openModal(mtop(esc(c.nome)) + `<div class="card"><dl class="kv"><dt>Certificado</dt><dd>${esc(t ? t.nome : 'tipo removido!')}</dd><dt>Carga horária</dt><dd>${num(c.cargaHoraria)}h${num(c.minHoras) ? ` · exige ${num(c.minHoras)}h de estudo registradas` : ''}</dd><dt>Prática</dt><dd>${c.pratica ? 'presencial, marcada aqui' : 'não tem'}</dd><dt>Instrutor / RT</dt><dd>${esc(c.instrutor)} · ${esc(c.instrutorQualif)}</dd>
    <dt>Módulos</dt><dd>${(c.mods || []).map((m, i) => `${i + 1}. ${esc(m.titulo)} <span class="note">(${(m.mats || []).length} materiais${m.quiz ? `, prova ${m.quiz.qs.length} questões, mín. ${num(m.quiz.min)}%` : ''})</span>`).join('<br>')}</dd></dl>
    ${w ? `<div class="actions"><button class="btn ghost" id="co-ed" type="button">Editar curso</button><button class="btn accent" id="co-lib" type="button">Liberar para funcionários</button></div>` : ''}</div>
    <h3>Alunos (${M.length})</h3><div class="card" style="padding:4px 12px">${M.length ? M.map(m => `<div class="ritem" style="flex-wrap:wrap"><div class="main"><button class="link" data-ofunc="${esc(m.funcionarioId)}" style="padding:0;text-align:left">${esc(m.nome)}</button><div class="note">${matStatus(m, c)}</div><div class="note">Notas: ${notas(m)}${alunoDe(m.funcionarioId) ? '' : ' · <b style="color:var(--bad)">sem acesso ao portal</b>'}</div></div>
      ${w ? `${m.concluidoEm && c.pratica && !m.praticaOk ? `<button class="btn sm primary" data-mpr="${esc(m.id)}">Prática feita</button>` : ''}${(c.mods || []).some(md => { const pr = (m.prog || {})[md.id] || {}; return !pr.ok && num(pr.tent) > 0; }) ? `<button class="btn sm ghost" data-mrt="${esc(m.id)}">Nova tentativa</button>` : ''}${m.certId ? `<button class="btn sm ghost" data-trein="${esc(m.certId)}">Certificado</button>` : ''}${!m.inicioEm ? `<button class="btn sm danger" data-mrm="${esc(m.id)}">Remover</button>` : ''}` : ''}</div>`).join('') : '<p class="note">Ninguém liberado ainda.</p>'}</div>`);
  if (!w) return;
  $('#co-ed').onclick = () => editCurso(c.id);
  $('#co-lib').onclick = () => selFuncs('Liberar “' + c.nome + '”', [], ids => liberarPara(c, ids), { ok: 'Liberar', lista: funcAtivos().filter(f => !M.some(m => m.funcionarioId === f.id)), info: f => alunoDe(f.id) ? '' : '· <b>sem acesso ao portal</b>' });
  $$('#sheet [data-mpr]').forEach(b => b.onclick = async () => { if (!guardWrite()) return; try { await db.doc('matriculas/' + b.dataset.mpr).update({ praticaOk: true, praticaEm: todayStr(), praticaPor: S.uid || '' }); toast('Prática registrada. O certificado é gerado em seguida.', 'ok'); setTimeout(() => openCurso(c.id), 600); } catch (e) { handleErr(e); } });
  $$('#sheet [data-mrt]').forEach(b => b.onclick = async () => { if (!guardWrite()) return; const m = M.find(x => x.id === b.dataset.mrt); const prog = JSON.parse(JSON.stringify(m.prog || {})); Object.values(prog).forEach(p => { if (!p.ok) p.tent = 0; });
    try { await db.doc('matriculas/' + m.id).update({ prog }); toast('Tentativas liberadas.', 'ok'); setTimeout(() => openCurso(c.id), 400); } catch (e) { handleErr(e); } });
  $$('#sheet [data-mrm]').forEach(b => { let armed = false; b.onclick = async () => { if (!armed) { armed = true; b.textContent = 'Confirmar'; return; } if (!guardWrite()) return; try { await db.doc('matriculas/' + b.dataset.mrm).delete(); setTimeout(() => openCurso(c.id), 300); } catch (e) { handleErr(e); } }; });
}
async function liberarPara(c, ids) {
  if (!guardWrite()) return; if (!ids.length) return toast('Escolha ao menos um funcionário.', 'bad');
  const ja = new Set(T.mat.filter(m => m.cursoId === c.id).map(m => m.funcionarioId)); const novos = ids.filter(i => !ja.has(i));
  try { for (const fid of novos) { const f = funcDe(fid) || {}; await db.doc('matriculas/' + c.id + '_' + fid).set({ cursoId: c.id, funcionarioId: fid, nome: str(f.nome), matricula: str(f.matricula), liberadoEm: todayStr(), prazo: num(c.prazoDias) ? addDays(num(c.prazoDias)) : '', prog: {}, tempo: 0, por: S.uid || '' }); await sleep(30); }
    const sem = novos.filter(i => !alunoDe(i)).length;
    toast(`${novos.length} liberado(s).${sem ? ` ${sem} ainda sem acesso ao portal: crie na ficha do funcionário.` : ''}`, sem ? 'bad' : 'ok'); setTimeout(() => openCurso(c.id), 400);
  } catch (e) { handleErr(e); }
}
/* certificado do EaD: quando a teoria (e a prática, se houver) termina, vira um registro de treinamento com certificado */
const tCertFeito = new Set();
async function tAutoCert() {
  if (!db || !podeT('rh', 'tst', 'instrutor') || S.canWrite === false || !T.ready.mat || !T.ready.cursos || !S.ready.func) return;
  /* o aluno assinou o certificado depois que ele foi gerado: leva a assinatura para o registro */
  for (const m of T.mat) { if (!m.certId || !m.assinCert || tCertFeito.has('as' + m.id)) continue; const r = S.tr.find(x => x.id === m.certId); if (!r || (r.assinAluno && r.assinAluno.em === m.assinCert.em)) continue;
    tCertFeito.add('as' + m.id); db.doc('treinamentos/' + m.certId).update({ assinAluno: m.assinCert }).catch(e => console.warn('assin cert', e)); }
  for (const m of T.mat) {
    const c = T.cursos.find(x => x.id === m.cursoId); if (!c || m.certId || !m.concluidoEm || (c.pratica && !m.praticaOk) || tCertFeito.has(m.id)) continue;
    const t = S.tt.find(x => x.id === c.tipoId); const f = funcDe(m.funcionarioId); if (!t || !f) continue;
    tCertFeito.add(m.id);
    const termino = str(m.praticaEm || m.concluidoEm).slice(0, 10), inicio = str(m.inicioEm || m.liberadoEm || termino).slice(0, 10); const id = 'ead_' + m.id; const e = S.emp || {}; const pad = c.instrPadrao !== false && !!str(e.instrutorNome);
    try {
      await db.doc('treinamentos/' + id).set({ turma: 'EAD-' + c.id.slice(0, 6).toUpperCase(), origem: 'ead', cursoId: c.id, funcionarioId: f.id, nome: str(f.nome).trim(), matricula: str(f.matricula), cpf: str(f.cpf), funcao: str(f.funcao), tipoId: t.id, tipoNome: str(t.nome), norma: str(t.norma), cargaHoraria: num(c.cargaHoraria), conteudo: str(t.conteudo),
        inicio, termino, validade: addMonths(termino, num(t.validadeMeses)), local: 'Portal do Aluno' + (c.pratica ? ' + prática presencial' : ''), instrutor: pad ? str(e.instrutorNome) : str(c.instrutor), instrutorQualif: pad ? str(e.instrutorQualif) : str(c.instrutorQualif), rt: pad ? str(e.instrutorNome) : str(c.instrutor), rtQualif: pad ? str(e.instrutorQualif) : str(c.instrutorQualif), tst: str(e.tstNome), tstRegistro: str(e.tstRegistro),
        codigo: 'E' + termino.replace(/-/g, '').slice(2) + '-' + m.id.slice(-6).toUpperCase(), criadoEm: new Date().toISOString(), por: S.uid || '',
        assinAluno: m.assinCert || null });
      await db.doc('matriculas/' + m.id).update({ certId: id });
    } catch (er) { console.warn('cert ead', er); }
  }
}
