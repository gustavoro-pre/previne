/* Portal do aluno: cursos on-line por módulo (materiais + prova), padrões operacionais para ler e assinar, e os treinamentos da pessoa. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const num = v => { const n = typeof v === 'number' ? v : parseFloat(str(v)); return isFinite(n) ? n : 0; };
const z2 = n => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); };
const fmtD = s => { s = str(s).slice(0, 10); const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const addMonths = (d, m) => { const x = new Date(str(d).slice(0, 10) + 'T12:00:00'); x.setMonth(x.getMonth() + m); return x.getFullYear() + '-' + z2(x.getMonth() + 1) + '-' + z2(x.getDate()); };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3400); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ytId = u => { const m = str(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
const LS = {}; const lib = (src, ok) => { if (ok()) return Promise.resolve(); if (!LS[src]) LS[src] = new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = () => { delete LS[src]; j(new Error('lib')); }; document.head.appendChild(s); }); return LS[src]; };

const A = { uid: null, perfil: null, f: null, emp: {}, mats: [], cursos: {}, pads: [], regs: [], trs: [], ext: [] };
const gate = $('#gate'), app = $('#app');
const showGate = html => { gate.innerHTML = `<div class="gbox"><div class="logo">${$('#logo').innerHTML}</div>${html}</div>`; gate.hidden = false; };
const gmsg = (t, bad) => { const m = gate.querySelector('.msg'); if (m) { m.textContent = t; m.className = 'msg' + (bad ? ' bad' : ''); } };

/* ---------- entrada ---------- */
/* entrada direta pelo link da admissão: o candidato não digita CPF nem senha */
function autoLogin() { let a = null; try { a = JSON.parse(localStorage.getItem('alunoAuto') || 'null'); localStorage.removeItem('alunoAuto'); } catch (_) {} if (!a || !a.l || !a.s || Date.now() - a.t > 10 * 60 * 1000) return false; try { sessionStorage.setItem('alunoAutoOk', '1'); } catch (_) {} showGate('<h1>Abrindo os seus treinamentos…</h1><p class="msg"></p>'); API.entrar(a.l, a.s).catch(er => { telaLogin(true); gmsg(er.message || 'Não foi possível entrar.', true); }); return true; }
function telaLogin(semAuto) {
  if (!semAuto && autoLogin()) return;
  showGate(`<h1>Meus treinamentos</h1><p class="gsub">Entre com a sua matrícula e a senha.</p>
    <form id="lf"><label for="lm">Matrícula</label><input id="lm" inputmode="text" autocomplete="username" required>
    <label for="ls">Senha</label><input id="ls" type="password" autocomplete="current-password" required>
    <button class="btn primary" type="submit">Entrar</button></form>
    <p class="note" style="margin-top:12px">Esqueceu a senha ou ainda não recebeu? Peça ao RH ou ao técnico de segurança uma senha nova.</p><p class="msg"></p>`);
  $('#lf').onsubmit = async e => { e.preventDefault(); gmsg('Entrando…'); try { await API.entrar($('#lm').value.trim(), $('#ls').value); } catch (er) { gmsg(er.message || 'Não foi possível entrar.', true); } };
}
function telaTrocar() {
  showGate(`<h1>Crie a sua senha</h1><p class="gsub">Primeiro acesso: troque a senha provisória por uma só sua (mínimo 6 caracteres).</p>
    <form id="tf"><label for="t1">Nova senha</label><input id="t1" type="password" autocomplete="new-password" minlength="6" required>
    <label for="t2">Repita a nova senha</label><input id="t2" type="password" autocomplete="new-password" minlength="6" required>
    <button class="btn primary" type="submit">Salvar senha</button></form><p class="msg"></p>`);
  $('#tf').onsubmit = async e => { e.preventDefault(); const a = $('#t1').value, b = $('#t2').value;
    if (a.length < 6) return gmsg('Use pelo menos 6 caracteres.', true); if (a !== b) return gmsg('As senhas não são iguais.', true); if (/^\d{6}$/.test(a) && new Set(a).size < 3) return gmsg('Senha fácil demais. Escolha outra.', true);
    gmsg('Salvando…'); try { await API.trocarSenha(a, A.uid); A.perfil.trocarSenha = false; gate.hidden = true; carregar(); } catch (er) { gmsg(er.message, true); } };
}
function telaBloq(t) { showGate(`<h1>Acesso não liberado</h1><p class="gsub">${t}</p><button class="btn ghost" id="bo" type="button">Sair</button>`); $('#bo').onclick = () => API.sair(); }
$('#out').onclick = () => { if ($('#out').dataset.a) { API.sair(); return; } $('#out').dataset.a = 1; $('#out').textContent = 'Tocar de novo'; setTimeout(() => { delete $('#out').dataset.a; $('#out').textContent = 'Sair'; }, 3000); };

function iniciar() {
  API.onUser(async u => {
    pararTimer(); app.innerHTML = '';
    if (!u) { $('#out').hidden = true; return telaLogin(); }
    if (!u.perfil) return telaBloq(u.erro || 'Seu acesso não foi encontrado. Fale com o RH.');
    if (u.perfil.papel !== 'funcionario') return telaBloq('Esta página é para os funcionários fazerem os cursos. A equipe usa o portal PREVINE. <a href="../">Ir para o portal</a>');
    if (u.perfil.ativo === false) return telaBloq('Seu acesso foi desativado. Fale com o RH.');
    A.uid = u.uid; A.perfil = u.perfil; $('#out').hidden = false;
    if (u.perfil.trocarSenha && !sessionStorage.getItem('alunoAutoOk')) return telaTrocar();
    gate.hidden = true; carregar();
  });
}
if (window.API) iniciar(); else window.addEventListener('api-pronta', iniciar, { once: true });

/* ---------- dados ---------- */
async function carregar(depois) {
  app.innerHTML = '<div class="empty">Carregando…</div>';
  try {
    const fid = A.perfil.funcionarioId;
    const [f, emp, mats, pads, regs, trs, ext] = await Promise.all([API.funcionario(fid), API.empresa(), API.matriculas(fid), API.padroes(), API.regsPadrao(fid), API.treinamentos(fid), API.externos(fid).catch(() => [])]);
    Object.assign(A, { f: f || {}, emp: emp || {}, mats, pads, regs, trs, ext });
    for (const m of mats) if (!A.cursos[m.cursoId]) A.cursos[m.cursoId] = await API.curso(m.cursoId);
    if (A.emp.nome) $('#emp').textContent = A.emp.nome;
    if (/^data:image\/(png|jpeg);base64,/.test(str(A.emp.logo))) { const l = $('#logo'); l.classList.add('img'); l.innerHTML = `<img src="${A.emp.logo}" alt="Logo">`; }
    (depois || home)();
  } catch (e) { app.innerHTML = `<div class="card"><p>Não foi possível carregar: ${esc(API.errPt ? API.errPt(e) : e.message)}</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button></div>`; }
}
const subs = () => Array.isArray(A.f.subareas) ? A.f.subareas : [];
function padsPendentes() {
  return A.pads.filter(p => p.ativo !== false && !(p.exc || []).includes(A.f.id) && ((p.inc || []).includes(A.f.id) || (p.subIds || []).some(s => subs().includes(s)))).map(p => {
    const L = A.regs.filter(r => r.padraoId === p.id).sort((a, b) => str(b.data).localeCompare(str(a.data))); const at = L.find(r => str(r.rev) === str(p.rev));
    const st = at ? (num(p.reciclMeses) && addMonths(at.data, num(p.reciclMeses)) < hoje() ? 'recicl' : 'ok') : L.length ? 'rev' : 'pend';
    return { p, st, r: at || L[0] };
  });
}
const modOk = (m, md) => !!(((m.prog || {})[md.id] || {}).ok);
function cursoInfo(m) { const c = A.cursos[m.cursoId] || { mods: [] }; const n = (c.mods || []).length, ok = (c.mods || []).filter(md => modOk(m, md)).length; return { c, n, ok }; }

/* ---------- início ---------- */
function home() {
  pararTimer(); window.scrollTo(0, 0);
  const P = padsPendentes(); const pend = P.filter(x => x.st !== 'ok');
  const cursos = A.mats.filter(m => A.cursos[m.cursoId] && A.cursos[m.cursoId].ativo !== false);
  const ult = {}; A.trs.filter(r => str(r.inicio) <= hoje()).forEach(r => { const k = r.norma || r.tipoNome; if (!ult[k] || str(ult[k].termino) < str(r.termino)) ult[k] = r; });
  const val = r => !r.validade ? '<span class="badge b-mut">Sem validade</span>' : r.validade < hoje() ? `<span class="badge b-bad">Vencido ${fmtD(r.validade)}</span>` : `<span class="badge b-ok">Válido até ${fmtD(r.validade)}</span>`;
  app.innerHTML = `<h1>Olá, ${esc(str(A.f.nome || A.perfil.nome).split(' ')[0])}</h1><p class="note" style="margin:0">${esc([A.f.matricula, A.f.funcao].filter(Boolean).join(' · '))}</p>
    ${(() => { const pa = cursos.filter(precisaAssinar); return pa.length ? `<div class="card" style="border-color:var(--warn,#f2a900)"><b>✍️ Certificado para assinar</b><p class="note" style="margin:4px 0 8px">Você concluiu ${pa.length > 1 ? pa.length + ' cursos' : 'um curso'} e falta assinar o certificado.</p>${pa.map(m => `<button class="btn primary" style="margin:4px 0" data-ac="${esc(m.id)}">Assinar · ${esc(cursoInfo(m).c.nome)}</button>`).join('')}</div>` : ''; })()}<h3>Cursos</h3>${cursos.length ? cursos.map(m => { const { c, n, ok } = cursoInfo(m); const st = m.concluidoEm ? (c.pratica && !m.praticaOk ? '<span class="badge b-info">Falta a prática presencial</span>' : !m.assinCert ? '<span class="badge b-warn">Falta assinar o certificado</span>' : '<span class="badge b-ok">Concluído</span>') : m.prazo && m.prazo < hoje() ? `<span class="badge b-bad">Prazo vencido ${fmtD(m.prazo)}</span>` : m.prazo ? `<span class="badge b-warn">Até ${fmtD(m.prazo)}</span>` : '';
      return `<button class="item" data-c="${esc(m.id)}"><div class="ico">🎓</div><div class="main"><div class="t1">${esc(c.nome)}</div><div class="t2">${ok} de ${n} módulo(s) ${st}</div><div class="bar"><i style="width:${n ? Math.round(ok / n * 100) : 0}%"></i></div></div></button>`; }).join('') : '<div class="empty">Nenhum curso liberado para você.</div>'}
    <h3>Padrões operacionais para assinar (${pend.length})</h3>${pend.length ? pend.map(x => `<button class="item" data-p="${esc(x.p.id)}"><div class="ico">📄</div><div class="main"><div class="t1">${esc(x.p.codigo)} · ${esc(x.p.titulo)}</div><div class="t2">Revisão ${esc(x.p.rev)} ${x.st === 'rev' ? '<span class="badge b-warn">Revisão nova</span>' : x.st === 'recicl' ? '<span class="badge b-warn">Reciclagem</span>' : '<span class="badge b-bad">Pendente</span>'}</div></div></button>`).join('') : '<div class="empty">Nenhum padrão pendente. 👍</div>'}
    ${P.filter(x => x.st === 'ok').length ? `<h3>Padrões assinados</h3>${P.filter(x => x.st === 'ok').map(x => `<div class="item" style="cursor:default"><div class="main"><div class="t1">${esc(x.p.codigo)} · ${esc(x.p.titulo)}</div><div class="t2">Revisão ${esc(x.p.rev)} · assinado em ${fmtD(x.r.data)}</div></div><span class="badge b-ok">OK</span></div>`).join('')}` : ''}
    <h3>Meus treinamentos</h3>${Object.values(ult).length || A.ext.length ? Object.values(ult).map(r => `<div class="item" style="cursor:default"><div class="main"><div class="t1">${esc(r.norma || r.tipoNome)}</div><div class="t2">${esc(r.tipoNome)} · ${fmtD(r.termino)}</div></div>${val(r)}</div>`).join('') + A.ext.map(r => `<div class="item" style="cursor:default"><div class="main"><div class="t1">${esc(r.tipo)}</div><div class="t2">${esc(r.entidade || '')} · ${fmtD(r.termino)}</div></div>${val(r)}</div>`).join('') : '<div class="empty">Nenhum treinamento registrado.</div>'}`;
  $$('#app [data-c]').forEach(b => b.onclick = () => abrirCurso(b.dataset.c));
  $$('#app [data-ac]').forEach(b => b.onclick = () => assinarCert(b.dataset.ac));
  $$('#app [data-p]').forEach(b => b.onclick = () => abrirPadrao(b.dataset.p));
}

/* ---------- tempo de estudo (conta só com a tela aberta e visível) ---------- */
const TM = { mat: null, seg: 0, h: null, ult: 0 };
function iniciarTimer(matId) {
  if (TM.mat === matId && TM.h) return; pararTimer(); TM.mat = matId; TM.seg = 0; TM.ult = Date.now();
  TM.h = setInterval(() => { const agora = Date.now(); const d = Math.min(5, (agora - TM.ult) / 1000); TM.ult = agora; if (document.visibilityState === 'visible') TM.seg += d; if (TM.seg >= 30) gravarTempo(); }, 1000);
}
function gravarTempo() { const s = Math.round(TM.seg); if (!TM.mat || s < 1) return; TM.seg = 0; const m = A.mats.find(x => x.id === TM.mat); if (m) m.tempo = num(m.tempo) + s; API.somarTempo(TM.mat, s).catch(() => {}); }
function pararTimer() { if (TM.h) { gravarTempo(); clearInterval(TM.h); } TM.h = null; TM.mat = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gravarTempo(); });
window.addEventListener('pagehide', gravarTempo);

/* quadro de assinatura com o dedo */
function padAss(box) {
  box.innerHTML = `<div style="border:2px dashed #b9c0cb;border-radius:12px;background:#fff;touch-action:none"><canvas style="width:100%;height:160px;display:block"></canvas></div><div style="text-align:right;margin-top:4px"><button class="btn ghost" type="button" style="padding:6px 12px">Limpar</button></div>`;
  const cv = box.querySelector('canvas'), r = window.devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = 160 * r;
  const x = cv.getContext('2d'); x.scale(r, r); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#14213d';
  let des = false, pts = 0; const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = e => { des = true; cv.setPointerCapture(e.pointerId); x.beginPath(); x.moveTo(...pos(e)); };
  cv.onpointermove = e => { if (!des) return; x.lineTo(...pos(e)); x.stroke(); pts++; };
  cv.onpointerup = cv.onpointercancel = () => { des = false; };
  box.querySelector('button').onclick = () => { x.clearRect(0, 0, cv.width, cv.height); pts = 0; };
  return { vazio: () => pts < 12, img: () => { const o = document.createElement('canvas'); const k = Math.min(1, 600 / cv.width); o.width = Math.round(cv.width * k); o.height = Math.round(cv.height * k); o.getContext('2d').drawImage(cv, 0, 0, o.width, o.height); return o.toDataURL('image/png'); } };
}
/* ---------- curso ---------- */
/* prévia do certificado (sem as assinaturas da empresa), para o funcionário conferir antes de assinar */
function previaCert(c, m) {
  const cpf = str(A.f.cpf), ini = str(m.inicioEm || m.liberadoEm || m.concluidoEm).slice(0, 10), fim = str(m.concluidoEm).slice(0, 10);
  const per = ini && ini !== fim ? `no período de ${fmtD(ini)} a ${fmtD(fim)}` : `em ${fmtD(fim)}`;
  return `<div style="border:3px double #14213d;outline:1px solid #f2a900;outline-offset:-7px;border-radius:6px;background:#fcfaf4;padding:16px 14px;margin:10px 0;text-align:center">
    <div style="font-size:11px;font-weight:700;color:#14213d">${esc(str(A.emp.nome))}</div>${A.emp.cnpj ? `<div style="font-size:10px;color:#6b7280">CNPJ ${esc(A.emp.cnpj)}</div>` : ''}
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#14213d;margin-top:8px;letter-spacing:1px">CERTIFICADO</div>
    <div style="font-size:9px;letter-spacing:3px;color:#b47d00;font-weight:700">DE CONCLUSÃO DE TREINAMENTO</div>
    <div style="font-family:Georgia,serif;font-style:italic;font-size:18px;font-weight:700;color:#14213d;margin:10px 0 4px;border-bottom:1px solid #f2a900;padding-bottom:4px">${esc(str(A.f.nome))}</div>
    <p style="font-size:13px;text-align:justify;text-align-last:center;margin:8px 0">${cpf ? 'CPF ' + esc(cpf) + ', ' : ''}concluiu com aproveitamento o treinamento ${esc(c.nome)}, com carga horária de ${num(c.cargaHoraria)} horas, realizado ${per}.</p>
    <div style="font-size:10px;color:#6b7280">Prévia para conferência · as assinaturas do instrutor e do técnico de segurança são incluídas pela empresa</div></div>`;
}
function abrirCurso(mid) {
  const m = A.mats.find(x => x.id === mid); if (!m) return home(); const { c, n, ok } = cursoInfo(m);
  if (A.certAgora === mid && precisaAssinar(m)) return assinarCert(mid);
  iniciarTimer(m.id); window.scrollTo(0, 0);
  if (!m.inicioEm) { m.inicioEm = new Date().toISOString(); API.salvarMatricula(m.id, { inicioEm: m.inicioEm }).catch(() => {}); }
  const horas = Math.round(num(m.tempo) / 360) / 10, minH = num(c.minHoras);
  const mods = c.mods || [];
  app.innerHTML = `<button class="back" id="bk">‹ Início</button><h2>${esc(c.nome)}</h2>${c.descricao ? `<p class="note" style="margin-top:-6px">${esc(c.descricao)}</p>` : ''}
    <div class="card"><dl class="kv"><dt>Progresso</dt><dd>${ok} de ${n} módulo(s)</dd><dt>Carga horária</dt><dd>${num(c.cargaHoraria)}h</dd><dt>Seu tempo de estudo</dt><dd>${horas}h${minH ? ` de ${minH}h exigidas` : ''}</dd>${m.prazo ? `<dt>Prazo</dt><dd>${fmtD(m.prazo)}</dd>` : ''}</dl>
    ${c.pratica ? '<p class="note" style="margin-bottom:0">Este curso tem uma parte prática presencial. Depois da teoria, o instrutor marca a prática e o certificado sai.</p>' : ''}</div>
    ${m.concluidoEm ? `<div class="card" style="border-color:var(--ok)"><b>✓ Teoria concluída em ${fmtD(m.concluidoEm)}.</b> ${c.pratica && !m.praticaOk ? 'Aguarde a convocação para a prática presencial.' : m.assinCert ? `Certificado assinado em ${fmtD(m.assinCert.em)}. A empresa inclui as assinaturas do instrutor e do técnico de segurança e arquiva o certificado.` : 'Assine o seu certificado abaixo.'}</div>
      ${!(c.pratica && !m.praticaOk) && !m.assinCert ? `<div class="card"><b>Assinar certificado</b><p class="note">Confira os dados do seu certificado. Depois da sua assinatura, a empresa inclui as assinaturas do instrutor e do técnico de segurança e arquiva o documento.</p>${previaCert(c, m)}<div id="cert-pad"></div><button class="btn primary big" id="cert-go" style="margin-top:10px">Assinar certificado</button></div>` : ''}` : ''}
    <h3>Módulos</h3>${mods.map((md, i) => { const pr = (m.prog || {})[md.id] || {}; const lib = i === 0 || modOk(m, mods[i - 1]); const vistos = (md.mats || []).filter(x => (pr.vistos || {})[x.id]).length;
      const trav = md.quiz && !pr.ok && num(pr.tent) >= num(md.quiz.tent);
      const st = pr.ok ? `<span class="badge b-ok">Aprovado${pr.nota != null ? ' · ' + num(pr.nota) + '%' : ''}</span>` : trav ? '<span class="badge b-bad">Sem tentativas: fale com o RH</span>' : !lib ? '<span class="badge b-mut">Termine o módulo anterior</span>' : `<span class="badge b-warn">${vistos}/${(md.mats || []).length} materiais</span>`;
      return `<button class="item" data-m="${i}" ${lib ? '' : 'disabled'}><div class="ico">${pr.ok ? '✅' : lib ? '📘' : '🔒'}</div><div class="main"><div class="t1">${i + 1}. ${esc(md.titulo)}</div><div class="t2">${st}</div></div></button>`; }).join('')}`;
  if ($('#cert-pad')) { const pd = padAss($('#cert-pad')); $('#cert-go').onclick = async () => { if (pd.vazio()) return toast('Faça a sua assinatura no quadro.', 'bad'); const b = $('#cert-go'); b.disabled = true;
    const reg = { img: pd.img(), em: new Date().toISOString(), ua: navigator.userAgent, curso: c.nome };
    try { await API.salvarMatricula(m.id, { assinCert: reg }); m.assinCert = reg; toast('Certificado assinado!', 'ok'); abrirCurso(m.id); } catch (e) { b.disabled = false; toast('Não foi possível salvar. Tente de novo.', 'bad'); } }; }
  $('#bk').onclick = () => { pararTimer(); home(); };
  $$('#app [data-m]').forEach(b => b.onclick = () => { if (!b.disabled) abrirModulo(m.id, +b.dataset.m); });
  verificarConclusao(m).then(() => { if (A.certAgora === m.id) assinarCert(m.id); });
}
function abrirModulo(mid, i) {
  const m = A.mats.find(x => x.id === mid); const { c } = cursoInfo(m); const md = c.mods[i]; const pr = (m.prog || {})[md.id] || {};
  iniciarTimer(m.id); window.scrollTo(0, 0);
  const todos = (md.mats || []).every(x => (pr.vistos || {})[x.id]);
  const trav = md.quiz && !pr.ok && num(pr.tent) >= num(md.quiz.tent);
  const ICO = { pdf: '📄', video: '▶️', texto: '📝', link: '🔗' };
  app.innerHTML = `<button class="back" id="bk">‹ ${esc(c.nome)}</button><h2>${i + 1}. ${esc(md.titulo)}</h2>
    <p class="note" style="margin-top:-6px">Veja todos os materiais. ${md.quiz ? `Depois faça a prova: precisa de ${num(md.quiz.min)}% para passar (${num(md.quiz.tent)} tentativa(s)).` : ''}</p>
    ${(md.mats || []).map((x, j) => `<button class="item" data-x="${j}"><div class="ico">${ICO[x.tipo] || '📄'}</div><div class="main"><div class="t1">${esc(x.titulo)}</div><div class="t2"></div></div>${(pr.vistos || {})[x.id] ? '<span class="badge b-ok">Visto</span>' : '<span class="badge b-warn">Ver</span>'}</button>`).join('')}
    ${pr.ok ? `<div class="card" style="border-color:var(--ok)"><b>✓ Módulo aprovado${pr.nota != null ? ' com ' + num(pr.nota) + '%' : ''}.</b></div>` : md.quiz ? (trav ? '<div class="card" style="border-color:var(--bad)">Você usou todas as tentativas. Fale com o RH para liberar de novo.</div>' : `<button class="btn accent" id="qz" ${todos ? '' : 'disabled'}>${todos ? 'Fazer a prova' : 'Veja todos os materiais para liberar a prova'}</button>${num(pr.tent) ? `<p class="note">Tentativas usadas: ${num(pr.tent)} de ${num(md.quiz.tent)}${pr.nota != null ? ' · última nota ' + num(pr.nota) + '%' : ''}</p>` : ''}`) : ''}`;
  $('#bk').onclick = () => abrirCurso(m.id);
  $$('#app [data-x]').forEach(b => b.onclick = () => abrirMaterial(m.id, i, +b.dataset.x));
  const q = $('#qz'); if (q) q.onclick = () => prova({ titulo: md.titulo, quiz: md.quiz, voltar: () => abrirModulo(m.id, i), fim: async (nota, ok) => {
    const p2 = Object.assign({}, (m.prog || {})[md.id] || {}); p2.tent = num(p2.tent) + 1; p2.nota = nota; if (ok) { p2.ok = true; p2.okEm = new Date().toISOString(); }
    m.prog = Object.assign({}, m.prog, { [md.id]: p2 }); await API.salvarModulo(m.id, md.id, p2); await verificarConclusao(m);
  } });
}
async function marcarVisto(m, md, x) {
  const p2 = Object.assign({ vistos: {} }, (m.prog || {})[md.id] || {}); p2.vistos = Object.assign({}, p2.vistos, { [x.id]: true });
  if (!md.quiz && (md.mats || []).every(y => p2.vistos[y.id])) { p2.ok = true; p2.okEm = new Date().toISOString(); }
  m.prog = Object.assign({}, m.prog, { [md.id]: p2 });
  try { await API.salvarModulo(m.id, md.id, p2); } catch (e) { toast('Não foi possível salvar. Verifique a internet.', 'bad'); throw e; }
  await verificarConclusao(m);
}
const precisaAssinar = m => { const c = cursoInfo(m).c; return !!(m.concluidoEm && !m.assinCert && !(c.pratica && !m.praticaOk)); };
/* tela de assinatura do certificado: abre sozinha assim que o curso é concluído */
function assinarCert(mid) {
  A.certAgora = null; pararTimer(); window.scrollTo(0, 0);
  const m = A.mats.find(x => x.id === mid); if (!m) return home(); if (!precisaAssinar(m)) return abrirCurso(mid); const { c } = cursoInfo(m);
  app.innerHTML = `<button class="back" id="bk">‹ Depois</button><div class="card" style="text-align:center;border-color:var(--ok)"><div style="font-size:40px">🎓</div><h2 style="margin:4px 0">Curso concluído!</h2><p class="note" style="margin:0">Falta só assinar o seu certificado.</p></div>
    <div class="card"><b>Assinar certificado</b><p class="note">Confira os dados do seu certificado e assine no quadro. Depois, a empresa inclui as assinaturas do instrutor e do técnico de segurança e arquiva o documento.</p>${previaCert(c, m)}<div id="cert-pad"></div><button class="btn primary big" id="cert-go" style="margin-top:10px">Assinar certificado</button></div>`;
  const pd = padAss($('#cert-pad'));
  $('#bk').onclick = () => { toast('O certificado fica pendente até você assinar.', 'bad'); abrirCurso(mid); };
  $('#cert-go').onclick = async () => { if (pd.vazio()) return toast('Faça a sua assinatura no quadro.', 'bad'); const b = $('#cert-go'); b.disabled = true;
    const reg = { img: pd.img(), em: new Date().toISOString(), ua: navigator.userAgent, curso: c.nome };
    try { await API.salvarMatricula(m.id, { assinCert: reg }); m.assinCert = reg; toast('Certificado assinado!', 'ok'); abrirCurso(m.id); } catch (e) { b.disabled = false; toast('Não foi possível salvar. Tente de novo.', 'bad'); } };
}
async function verificarConclusao(m) {
  const { c, n, ok } = cursoInfo(m); if (m.concluidoEm || !n || ok < n) return;
  if (num(c.minHoras) && num(m.tempo) < num(c.minHoras) * 3600) { toast(`Módulos concluídos. Faltam ${Math.ceil((num(c.minHoras) * 3600 - num(m.tempo)) / 360) / 10}h de estudo para concluir o curso.`, 'bad'); return; }
  m.concluidoEm = new Date().toISOString();
  try { await API.salvarMatricula(m.id, { concluidoEm: m.concluidoEm }); toast(c.pratica ? 'Teoria concluída! Aguarde a prática presencial.' : 'Curso concluído! Parabéns.', 'ok'); if (precisaAssinar(m)) A.certAgora = m.id; } catch (e) { m.concluidoEm = null; }
}

/* ---------- materiais ---------- */
function abrirMaterial(mid, i, j) {
  const m = A.mats.find(x => x.id === mid); const { c } = cursoInfo(m); const md = c.mods[i]; const x = md.mats[j];
  const visto = !!((((m.prog || {})[md.id] || {}).vistos || {})[x.id]);
  iniciarTimer(m.id); window.scrollTo(0, 0);
  const minS = 0; /* sem tempo mínimo por material: basta ir até o fim */ const t0 = Date.now(); let fim = false, vidOk = x.tipo !== 'video';
  app.innerHTML = `<button class="back" id="bk">‹ ${esc(md.titulo)}</button><h2>${esc(x.titulo)}</h2><div id="mv"></div>
    <div class="sticky"><button class="btn primary" id="ok" disabled>${visto ? 'Já visto · voltar' : 'Concluí'}</button><p class="note" id="okn" style="text-align:center;margin:6px 0 0"></p></div>`;
  $('#bk').onclick = () => { limpar(); abrirModulo(m.id, i); };
  const mv = $('#mv'); let tick = null;
  const limpar = () => { clearInterval(tick); if (window.__yt) { try { window.__yt.destroy(); } catch (_) {} window.__yt = null; } };
  const upd = () => { const falta = Math.max(0, Math.ceil((minS - (Date.now() - t0) / 1000))); const ok = visto || (falta === 0 && fim && vidOk);
    $('#ok').disabled = !ok; $('#okn').textContent = visto ? '' : !fim ? (x.tipo === 'video' ? 'Assista ao vídeo até o fim.' : 'Vá até o final do material.') : !vidOk ? 'Assista ao vídeo até o fim.' : falta ? `Disponível em ${Math.floor(falta / 60)}:${z2(falta % 60)}` : ''; };
  tick = setInterval(upd, 1000);
  const fimObs = el => { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { fim = true; upd(); io.disconnect(); } }); io.observe(el); };
  $('#ok').onclick = async () => { if (visto) { limpar(); return abrirModulo(m.id, i); } $('#ok').disabled = true; try { await marcarVisto(m, md, x); limpar(); abrirModulo(m.id, i); } catch (_) { $('#ok').disabled = false; } };
  if (x.tipo === 'texto') { mv.innerHTML = `<div class="card txt">${esc(x.texto)}</div><div id="end" style="height:1px"></div>`; fimObs($('#end')); }
  else if (x.tipo === 'link') { mv.innerHTML = `<div class="card"><p style="margin-top:0">Abra o conteúdo, estude e volte aqui para marcar como concluído.</p><a class="btn accent" href="${esc(/^https:\/\//.test(str(x.url)) ? x.url : '#')}" target="_blank" rel="noopener" id="lk">Abrir conteúdo</a></div>`; $('#lk').addEventListener('click', () => { fim = true; upd(); }); }
  else if (x.tipo === 'video') { fim = true; vidOk = false; video(mv, ytId(x.url), () => { vidOk = true; upd(); }); }
  else verPdf(mv, x.arquivoId, () => { fim = true; upd(); });
  upd();
}
async function verPdf(box, arqId, aoFim) {
  box.innerHTML = '<div class="empty">Abrindo o material…</div>';
  try {
    const a = await API.arquivo(arqId);
    if (/^image\//.test(a.tipo)) { const u = URL.createObjectURL(new Blob([a.bytes], { type: a.tipo })); box.innerHTML = `<div class="pdfv"><img src="${u}" alt=""></div><div id="end" style="height:1px"></div>`; const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { aoFim(); io.disconnect(); } }); io.observe($('#end')); return; }
    await lib('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', () => window.pdfjsLib);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: a.bytes }).promise;
    box.innerHTML = `<div class="pdfv" id="pv"></div><p class="note" style="text-align:center">${pdf.numPages} página(s)</p><div id="end" style="height:1px"></div>`;
    const W = Math.min(900, box.clientWidth || 360) * (window.devicePixelRatio > 1 ? 2 : 1.4);
    for (let p = 1; p <= pdf.numPages; p++) { const pg = await pdf.getPage(p); const vp0 = pg.getViewport({ scale: 1 }); const vp = pg.getViewport({ scale: W / vp0.width }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; $('#pv').appendChild(cv); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { aoFim(); io.disconnect(); } }); io.observe($('#end'));
  } catch (e) { box.innerHTML = `<div class="card">Não foi possível abrir o material (${esc(e.message || 'erro')}). Verifique a internet e tente de novo.</div>`; }
}
function video(box, id, aoFim) {
  if (!id) { box.innerHTML = '<div class="card">Vídeo indisponível.</div>'; return; }
  box.innerHTML = '<div class="vid"><div id="yt"></div></div><p class="note">O vídeo precisa ser assistido até o fim. Adiantar não conta.</p>';
  let visto = 0, ult = null, dur = 0, done = false;
  const montar = () => { window.__yt = new YT.Player('yt', { videoId: id, playerVars: { rel: 0, modestbranding: 1, playsinline: 1 }, events: {
    onStateChange: e => { if (e.data === 0 && dur && visto >= dur * 0.9 && !done) { done = true; aoFim(); } } } });
    const h = setInterval(() => { const p = window.__yt; if (!p || !p.getCurrentTime) return; if (!document.body.contains(box)) return clearInterval(h);
      try { dur = p.getDuration() || dur; const t = p.getCurrentTime(); if (p.getPlayerState() === 1) { if (ult != null && t > ult && t - ult < 2.5) visto += t - ult; ult = t; } else ult = t;
        if (!done && dur && visto >= dur * 0.9) { done = true; aoFim(); } } catch (_) {} }, 1000); };
  if (window.YT && window.YT.Player) montar(); else { window.onYouTubeIframeAPIReady = montar; lib('https://www.youtube.com/iframe_api', () => window.YT && window.YT.Player).catch(() => { box.innerHTML = '<div class="card">Não foi possível carregar o vídeo. Verifique a internet.</div>'; }); }
}

/* ---------- prova ---------- */
function prova({ titulo, quiz, voltar, fim }) {
  window.scrollTo(0, 0);
  const Q = shuffle(quiz.qs.map((q, i) => ({ q, i, ops: shuffle(q.o.map((t, k) => ({ t, k }))) })));
  const resp = {};
  app.innerHTML = `<button class="back" id="bk">‹ Voltar</button><h2>Prova · ${esc(titulo)}</h2><p class="note" style="margin-top:-6px">${Q.length} questões · nota mínima ${num(quiz.min)}%</p>
    ${Q.map((x, n) => `<div class="card q"><p>${n + 1}. ${esc(x.q.p)}</p>${x.ops.map(o => `<label class="opt" data-q="${x.i}" data-o="${o.k}"><input type="radio" name="q${x.i}"> <span>${esc(o.t)}</span></label>`).join('')}</div>`).join('')}
    <button class="btn primary" id="env">Enviar respostas</button>`;
  $('#bk').onclick = voltar;
  app.onchange = e => { const l = e.target.closest('.opt'); if (!l) return; resp[l.dataset.q] = +l.dataset.o; $$(`#app .opt[data-q="${l.dataset.q}"]`).forEach(o => o.classList.toggle('sel', o === l)); };
  $('#env').onclick = async () => {
    if (Object.keys(resp).length < Q.length) return toast('Responda todas as questões.', 'bad');
    const certas = Q.filter(x => resp[x.i] === x.q.c).length; const nota = Math.round(certas / Q.length * 100); const ok = nota >= num(quiz.min);
    $('#env').disabled = true;
    try { await fim(nota, ok); } catch (e) { $('#env').disabled = false; return toast('Não foi possível enviar. Verifique a internet.', 'bad'); }
    window.scrollTo(0, 0);
    app.innerHTML = `<div class="card" style="text-align:center;border-color:${ok ? 'var(--ok)' : 'var(--bad)'}"><div style="font-size:44px">${ok ? '🎉' : '📚'}</div><h2 style="margin:6px 0">${ok ? 'Aprovado!' : 'Não foi desta vez'}</h2>
      <p style="font-size:18px;margin:0">Nota: <b>${nota}%</b> (${certas} de ${Q.length})</p><p class="note">Mínimo: ${num(quiz.min)}%</p></div><button class="btn primary" id="vt">${A.certAgora ? 'Assinar certificado' : 'Continuar'}</button>`;
    $('#vt').onclick = () => A.certAgora ? assinarCert(A.certAgora) : voltar();
  };
}

/* ---------- padrão operacional: ler, prova (se houver) e assinar ---------- */
function abrirPadrao(pid) {
  const x = padsPendentes().find(y => y.p.id === pid); if (!x) return home(); const p = x.p;
  pararTimer(); window.scrollTo(0, 0); let fim = false; const t0 = Date.now();
  app.innerHTML = `<button class="back" id="bk">‹ Início</button><h2>${esc(p.codigo)} · ${esc(p.titulo)}</h2><p class="note" style="margin-top:-6px">Revisão ${esc(p.rev)}. Leia o padrão inteiro${p.quiz && (p.quiz.qs || []).length ? ', faça a prova' : ''} e assine.</p>
    <div id="mv"></div><div class="sticky"><button class="btn primary" id="ok" disabled>Li o padrão</button><p class="note" id="okn" style="text-align:center;margin:6px 0 0"></p></div>`;
  $('#bk').onclick = () => { clearInterval(tk); home(); };
  const upd = () => { const falta = Math.max(0, 60 - Math.floor((Date.now() - t0) / 1000)); $('#ok').disabled = !(fim && !falta); $('#okn').textContent = !fim ? 'Vá até o final do padrão.' : falta ? `Disponível em 0:${z2(falta)}` : ''; };
  const tk = setInterval(upd, 1000);
  verPdf($('#mv'), p.arquivoId, () => { fim = true; upd(); }); upd();
  $('#ok').onclick = () => { clearInterval(tk);
    if (p.quiz && (p.quiz.qs || []).length) prova({ titulo: p.codigo, quiz: Object.assign({ tent: 99 }, p.quiz), voltar: () => abrirPadrao(p.id), fim: async (nota, ok) => { if (ok) setTimeout(() => assinarPadrao(p, nota), 1200); } });
    else assinarPadrao(p, null); };
}
function assinarPadrao(p, nota) {
  window.scrollTo(0, 0);
  app.innerHTML = `<h2>Assinatura · ${esc(p.codigo)}</h2><p class="termo">Eu, <b>${esc(A.f.nome)}</b>, declaro que li e entendi o padrão operacional <b>${esc(p.codigo)} · ${esc(p.titulo)}</b>, revisão ${esc(p.rev)}${nota != null ? `, fui aprovado na prova com ${nota}%` : ''}, e me comprometo a cumpri-lo.</p>
    <div class="padwrap"><canvas id="pad"></canvas><span class="padhint">Assine aqui com o dedo</span><button class="link" id="pc" type="button">Limpar</button></div>
    <button class="btn primary" id="sv">Assinar</button><button class="btn ghost" id="cn">Cancelar</button>`;
  const cv = $('#pad'), wrap = cv.parentElement; let ctx, des = false, vazio = true, ult;
  const rs = () => { const r = cv.getBoundingClientRect(); const d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#14213d'; vazio = true; wrap.classList.remove('signed'); };
  requestAnimationFrame(rs);
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => { des = true; ult = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} if (vazio) { vazio = false; wrap.classList.add('signed'); } e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!des) return; const q = pos(e); ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ult = q; e.preventDefault(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, () => des = false));
  $('#pc').onclick = rs; $('#cn').onclick = home;
  $('#sv').onclick = async () => {
    if (vazio) return toast('Falta a assinatura.', 'bad');
    const o = document.createElement('canvas'); o.width = 480; o.height = 170; const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 480, 170); c.drawImage(cv, 0, 0, 480, 170);
    const reg = { padraoId: p.id, codigo: p.codigo, rev: p.rev, funcionarioId: A.f.id, nome: str(A.f.nome), data: new Date().toISOString(), forma: 'ead', ass: o.toDataURL('image/png'), nota: nota == null ? null : nota, em: new Date().toISOString(), por: A.uid };
    $('#sv').disabled = true;
    try { await API.registrarPadrao(reg); A.regs.push(reg); toast('Padrão assinado. Obrigado!', 'ok'); home(); } catch (e) { $('#sv').disabled = false; toast('Não foi possível salvar. Verifique a internet.', 'bad'); }
  };
}
