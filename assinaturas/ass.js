/* Assinaturas: junta num lugar só tudo que pede assinatura, de acordo, aprovação ou autorização.
   Não cria coleção nova: lê as que já existem em cada módulo e manda para a tela certa para assinar.
   - Para mim: certificados (de acordo de instrutor/RT/TST), documentos em aprovação, contratações (envio à contabilidade),
     pedidos de EPI/ferramenta fora do previsto, matriz por função revisada (Administrador).
   - Enviados por mim: o que eu pedi e em que pé está.
   - Histórico: o que já foi assinado/aprovado, com data, quem e nº de verificação quando houver. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const nr = v => str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const fmtDH = s => { if (!s) return '—'; if (/^\d{4}-\d{2}-\d{2}$/.test(str(s))) { const p = str(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; } const d = new Date(s); if (isNaN(d)) { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : str(s); } return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const V = { tab: (location.hash.slice(1) || 'mim'), busca: '' };
const S = { mim: [], env: [], hist: [], carregado: false };
let db = null, F = {}, EU = '', UID = '', EMAIL = '', PAPEL = '';

/* perfil efetivo no módulo (mesma regra do fb.js / portal) */
function papelMod(d, id) {
  if (!d) return 'nenhum'; if (d.papel === 'admin') return 'admin'; if (d.papel === 'funcionario') return 'nenhum';
  if (id === 'ferramentas') return d.papel || 'nenhum';
  const m = (d.modulos || {})[id]; if (m) return m;
  if (d.papel === 'gestao') return 'gestao';
  if (id === 'treinamentos') return ({ gerente: 'gestor', tst: 'tst', rh: 'rh' })[d.papel] || 'nenhum';
  if (id === 'admissao') return ['rh', 'gerente'].includes(d.papel) ? 'rh' : 'nenhum';
  if (id === 'documentos') return d.papel === 'gerente' ? 'editor' : ['tst', 'rh'].includes(d.papel) ? 'consulta' : 'nenhum';
  return 'nenhum';
}
const tem = id => papelMod(F.perfil, id) !== 'nenhum';
const get = async c => { try { return (await db.collection(c).get()).docs.map(d => Object.assign({}, d.data(), { id: d.id })); } catch (e) { return null; } };

/* item: { tipo, titulo, det, quem, em, href, st, ver } */
const TIPOS = { cert: ['🎓', 'De acordo em certificado'], doc: ['📁', 'Aprovação de documento'], adm: ['🪪', 'Envio da admissão à contabilidade'], aut: ['🧰', 'Autorização de EPI / ferramenta'], mat: ['🧩', 'Matriz por função'] };
async function carregar() {
  const mim = [], env = [], hist = []; const ADM = PAPEL === 'admin';
  const k = EU.replace(/[^a-z0-9]+/g, '_');
  const jobs = [];
  // certificados: de acordo do instrutor / RT / TST
  if (tem('treinamentos')) jobs.push((async () => {
    const T = await get('treinamentos'); if (T) {
      const P = T.filter(r => [r.instrutor, r.rt, r.tst].some(n => nr(n) === EU) && !((r.aprov || {})[k]));
      if (P.length) mim.push({ tipo: 'cert', titulo: P.length + (P.length === 1 ? ' certificado aguardando' : ' certificados aguardando') + ' o seu de acordo', det: [...new Set(P.map(r => str(r.tipoNome)))].slice(0, 4).join(', ') + (P.length > 1 ? ' · ' + P.slice(0, 3).map(r => str(r.nome).split(' ')[0]).join(', ') + (P.length > 3 ? '…' : '') : ' · ' + str(P[0].nome)), em: P.map(r => str(r.termino || r.inicio)).sort().pop(), href: '../treinamentos/#aprov', n: P.length });
    }
    const L = await get('aprov_lotes'); if (L) L.filter(l => ADM || l.uid === UID || nr(l.nome) === EU).forEach(l => hist.push({ tipo: 'cert', titulo: 'De acordo em ' + (l.qtd || (l.itens || []).length) + ' certificado(s)', det: [...new Set((l.itens || []).map(x => str(x.treinamento)))].slice(0, 3).join(', '), quem: l.nome, em: l.em, ver: str(l.hashLote).slice(0, 12).toUpperCase(), href: '../treinamentos/#aprov' }));
  })());
  // documentos da Documentação
  if (tem('documentos')) jobs.push((async () => {
    const D = await get('docs'); if (!D) return;
    D.filter(d => d.pend && !d.pend.recusa && nr(d.pend.aprovador) === EU).forEach(d => mim.push({ tipo: 'doc', titulo: [d.codigo, d.titulo].filter(Boolean).join(' – '), det: 'Rev. ' + str(d.pend.rev) + ' · enviada por ' + str(d.pend.por || '—'), em: d.pend.data, href: '../documentos/#aprov' }));
    D.filter(d => d.pend && nr(d.pend.por) === EU).forEach(d => env.push({ tipo: 'doc', titulo: [d.codigo, d.titulo].filter(Boolean).join(' – '), det: 'Rev. ' + str(d.pend.rev) + ' · aprovador: ' + str(d.pend.aprovador || '—'), em: d.pend.data, st: d.pend.recusa ? ['Recusado', 'b-bad'] : ['Aguardando', 'b-warn'], href: '../documentos/#aprov' }));
    D.forEach(d => (d.hist || []).concat(d.aprovadoEm ? [{ rev: d.rev, aprovador: d.aprovador, aprovadoEm: d.aprovadoEm, por: d.elaborador }] : []).forEach(h => {
      if (!h.aprovadoEm || !h.aprovador) return; if (!(ADM || nr(h.aprovador) === EU || nr(h.por) === EU)) return;
      const key = d.id + '|' + h.rev; if (hist.some(x => x.key === key)) return;
      hist.push({ key, tipo: 'doc', titulo: [d.codigo, d.titulo].filter(Boolean).join(' – ') + ' · Rev. ' + str(h.rev), det: 'Elaborado por ' + str(h.por || '—'), quem: h.aprovador, em: h.aprovadoEm, href: '../documentos/' });
    }));
  })());
  // contratações: envio à contabilidade (de acordo de quem está em config/admissao.aprovEmails)
  if (tem('admissao')) jobs.push((async () => {
    let ap = []; try { const c = await db.doc('config/admissao').get(); ap = str((c.data() || {}).aprovEmails).toLowerCase().split(/[,;\s]+/).filter(Boolean); } catch (e) {}
    const E = await get('envios_contab'); if (!E) return;
    if (EMAIL && ap.includes(EMAIL)) E.filter(x => x.status === 'aprovacao').forEach(x => mim.push({ tipo: 'adm', titulo: 'Contratação de ' + str(x.nome), det: 'Pedido por ' + str(x.por || '—') + (x.dataAdmissao ? ' · admissão ' + fmtDH(x.dataAdmissao) : ''), em: x.criadoEm, href: '../admissao/?aprov=' + x.id }));
    const ST = { aprovacao: ['Aguardando de acordo', 'b-warn'], agendado: ['Aprovado, agendado', 'b-ok'], enviado: ['Enviado', 'b-ok'], erro: ['Erro no envio', 'b-bad'], cancelado: ['Cancelado', 'b-mut'] };
    E.filter(x => nr(x.por) === EU).forEach(x => env.push({ tipo: 'adm', titulo: 'Contratação de ' + str(x.nome), det: x.aprovadoPor ? 'De acordo de ' + str(x.aprovadoPor) : 'Para: ' + str(x.para || 'contabilidade'), em: x.criadoEm, st: ST[x.status] || [str(x.status), 'b-mut'], href: '../admissao/?aprov=' + x.id }));
    E.filter(x => x.aprovadoEm && (ADM || nr(x.aprovadoPor) === EU || nr(x.por) === EU)).forEach(x => hist.push({ tipo: 'adm', titulo: 'Contratação de ' + str(x.nome), det: 'Envio à contabilidade pedido por ' + str(x.por || '—'), quem: x.aprovadoPor, em: x.aprovadoEm, href: '../admissao/?aprov=' + x.id }));
  })());
  // EPI / ferramenta fora do previsto
  jobs.push((async () => {
    const [A, Dc] = await Promise.all([get('autorizacoes'), get('decisoes')]); if (!A) return;
    const dec = {}; (Dc || []).forEach(d => dec[d.id] = d); const nome = a => (a.epiNome || a.tipoFerr || 'item') + (a.qtd > 1 ? ' (' + a.qtd + ')' : '') + ' para ' + str(a.funcionarioNome);
    if (['admin', 'gerente'].includes(PAPEL)) A.filter(a => !dec[a.id]).forEach(a => mim.push({ tipo: 'aut', titulo: nome(a), det: str(a.motivo || (a.excecao ? 'Fora da lista do kit' : 'Fora do previsto')), em: a.em, href: '../ferramentas/#painel' }));
    A.filter(a => a.solicitadoPor && a.solicitadoPor === UID).forEach(a => { const d = dec[a.id]; env.push({ tipo: 'aut', titulo: nome(a), det: str(a.motivo || ''), em: a.em, st: !d ? ['Aguardando', 'b-warn'] : d.status === 'aprovada' ? ['Autorizado', 'b-ok'] : ['Negado', 'b-bad'], href: '../ferramentas/#painel' }); });
    if (['admin', 'gerente'].includes(PAPEL) || A.some(a => a.solicitadoPor === UID)) A.filter(a => dec[a.id] && (ADM || dec[a.id].por === UID || a.solicitadoPor === UID)).forEach(a => { const d = dec[a.id]; hist.push({ tipo: 'aut', titulo: nome(a), det: d.status === 'aprovada' ? 'Autorizado' : 'Negado', quem: d.por === UID ? F.nome : (d.porNome || 'Gerência'), em: d.em, href: '../ferramentas/#painel' }); });
  })());
  // matriz por função revisada esperando o Administrador
  if (PAPEL === 'admin') jobs.push((async () => {
    const M = await get('matriz_funcao'); if (!M) return;
    M.filter(m => m.status === 'revisada').forEach(m => mim.push({ tipo: 'mat', titulo: 'Matriz de ' + str(m.funcao || m.id), det: 'Revisada por ' + str(m.revisadoPor || '—'), em: m.revisadoEm, href: '../matriz/' }));
    M.filter(m => m.status === 'aprovada').forEach(m => hist.push({ tipo: 'mat', titulo: 'Matriz de ' + str(m.funcao || m.id), det: 'Revisada por ' + str(m.revisadoPor || '—'), quem: m.aprovadoPor, em: m.aprovadoEm, href: '../matriz/' }));
  })());
  await Promise.all(jobs);
  const ord = L => L.sort((a, b) => str(b.em).localeCompare(str(a.em)));
  S.mim = ord(mim); S.env = ord(env); S.hist = ord(hist); S.carregado = true; render();
}
function linha(x, aba) {
  const [ic, tp] = TIPOS[x.tipo] || ['📝', ''];
  return `<a href="${esc(x.href)}" style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit">
    <div style="font-size:20px;width:28px;text-align:center">${ic}</div>
    <div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--muted)">${esc(tp)}</div><b>${esc(x.titulo)}</b>
      <div style="font-size:12px;color:var(--muted)">${esc(x.det || '')}${aba === 'hist' ? ' · ' + (x.quem ? 'por ' + esc(x.quem) + ' · ' : '') + fmtDH(x.em) + (x.ver ? ' · nº ' + esc(x.ver) : '') : x.em ? ' · ' + fmtDH(x.em) : ''}</div></div>
    ${x.st ? `<span class="badge ${x.st[1]}">${esc(x.st[0])}</span>` : aba === 'mim' ? '<span class="btn sm primary">Assinar</span>' : ''}</a>`;
}
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  if (!S.carregado) { $('#body').innerHTML = '<div class="card">Carregando…</div>'; return; }
  const nMim = S.mim.reduce((a, x) => a + (x.n || 1), 0), nEnv = S.env.filter(x => x.st && /Aguard/.test(x.st[0])).length;
  const L = S[V.tab].filter(x => !V.busca || nr(x.titulo + ' ' + x.det + ' ' + (x.quem || '')).includes(nr(V.busca)));
  const vazio = { mim: 'Nenhuma assinatura pendente para você. 👍', env: 'Você não tem pedidos de assinatura em andamento.', hist: 'Nada assinado ainda.' }[V.tab];
  $('#body').innerHTML = `<div class="kpis">${kpi('Esperando você', nMim, nMim ? 'warn' : '')}${kpi('Enviados por você aguardando', nEnv)}${kpi('No histórico', S.hist.length)}</div>
    <div class="card">${V.tab !== 'mim' ? `<input id="busca" placeholder="Buscar" value="${esc(V.busca)}" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin-bottom:6px">` : ''}
    ${L.slice(0, 300).map(x => linha(x, V.tab)).join('') || `<p class="cs" style="margin:6px 0">${vazio}</p>`}
    ${V.tab === 'hist' && L.length ? '<div class="actions"><button class="btn sm ghost" id="exp" type="button">Exportar histórico</button></div>' : ''}</div>
    <p class="cs">Os documentos dos funcionários (termo e ficha de EPI, OS, listas de presença, LGPD) são assinados no Portal do Aluno e ficam na ficha de cada um.</p>`;
  const b = $('#busca'); if (b) b.oninput = () => { clearTimeout(b._t); b._t = setTimeout(() => { V.busca = b.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  const ex = $('#exp'); if (ex) ex.onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Histórico de assinaturas e aprovações', cols: [{ t: 'Tipo' }, { t: 'Assunto' }, { t: 'Detalhe' }, { t: 'Assinado / aprovado por' }, { t: 'Data e hora' }, { t: 'Nº de verificação' }],
    linhas: L.map(x => [(TIPOS[x.tipo] || ['', ''])[1], x.titulo, x.det, x.quem || '', fmtDH(x.em), x.ver || '']), filtros: V.busca || 'Tudo', arquivo: 'Historico de assinaturas' });
}
document.addEventListener('click', e => { const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; V.busca = ''; history.replaceState(null, '', '#' + V.tab); render(); } });
(async () => {
  db = await claude.use('db'); F = window.__FB || {}; EU = nr(F.nome); UID = F.uid || ''; EMAIL = str(F.email || (F.user || {}).email).toLowerCase(); PAPEL = (F.perfil || {}).papel || F.papelGeral || '';
  if (!['mim', 'env', 'hist'].includes(V.tab)) V.tab = 'mim';
  render(); const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  await carregar();
  setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 60000);
})();
