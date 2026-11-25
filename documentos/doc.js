/* Módulo Documentação: lista mestra de documentos com código, tipo, área, cliente, responsável,
   revisão, aprovação, validade e histórico de revisões. Arquivos guardados no banco, em partes. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const hoje = () => ymd(new Date());
const addDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const addMeses = (s, n) => { const d = new Date((s || hoje()) + 'T12:00:00'); d.setMonth(d.getMonth() + n); return ymd(d); };
const fmtD = s => { s = str(s).slice(0, 10); const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const fmtTam = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const revTxt = n => 'Rev. ' + z2(+n || 0);
const extDe = n => (str(n).split('.').pop() || '').toLowerCase().slice(0, 4);
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const kpi = (t, n, k, f) => `<button class="kpi ${k || ''}" ${f ? `data-kf="${f}"` : ''} style="border:0;text-align:left;cursor:${f ? 'pointer' : 'default'}"><div class="n">${n}</div><div class="t">${t}</div></button>`;

const TIPOS_PADRAO = [
  ['Manual / política', 'MAN'], ['Procedimento de gestão', 'PG'], ['Procedimento operacional', 'PO'], ['Instrução de trabalho', 'IT'], ['Formulário / modelo', 'FOR'],
  ['Registro', 'REG'], ['Material de treinamento', 'MT'], ['Plano / programa', 'PL'], ['APR padrão', 'APR'], ['Plano de rigging / içamento', 'PR'], ['Laudo / relatório técnico', 'LT'], ['ART', 'ART'],
  ['PGR / inventário de riscos', 'PGR'], ['PCMSO', 'PCM'], ['Certificado / licença', 'CL'], ['Contrato / aditivo', 'CT'], ['Proposta comercial', 'PC'],
  ['Desenho / diagrama', 'DE'], ['Norma de cliente', 'NC'], ['Outro', 'OU']];
/* processos do Sistema de Gestão Integrado (ISO 9001, 14001 e 45001): a sigla entra no código */
const PROCS_PADRAO = [['SGI', 'Sistema de Gestão Integrado'], ['QUA', 'Qualidade (ISO 9001)'], ['AMB', 'Meio Ambiente (ISO 14001)'], ['SST', 'Saúde e Segurança (ISO 45001)'],
  ['MNT', 'Manutenção'], ['OPE', 'Operação / execução'], ['RH', 'Recursos Humanos'], ['ADM', 'Administrativo e financeiro'], ['COM', 'Comercial'], ['SUP', 'Suprimentos e compras']];
const STATUS = { vigente: ['Vigente', 'b-ok'], aprovacao: ['Aguardando aprovação', 'b-warn'], revisao: ['Em revisão', 'b-warn'], rascunho: ['Rascunho', 'b-mut'], obsoleto: ['Obsoleto', 'b-bad'] };
/* modelos que o próprio portal gera: o código e a revisão aprovados aqui saem no cabeçalho do PDF */
const MODELOS_PORTAL = [['', 'Não é modelo do portal'], ['os', 'OS de segurança'], ['ficha', 'Ficha de controle de EPI'], ['termoepi', 'Termo de EPI (admissão)'], ['lista', 'Lista de presença'], ['certificado', 'Certificado de treinamento'], ['carta', 'Carta-convite'], ['lgpd', 'Termo LGPD']];
const MAX = 15 * 1048576, PARTE = 700000;

const D = { docs: [], areas: [], cfg: {} };
const V = { tab: 'docs', busca: '', tipo: '', area: '', cliente: '', status: 'ativos', venc: '', ordem: 'codigo' };
let db = null, EDITA = false, ADMIN = false, MEU = '', ABERTO = '', ESPERA = '', EMDET = '', APROVS = [];

const tipos = () => (D.cfg.tipos && D.cfg.tipos.length ? D.cfg.tipos : TIPOS_PADRAO.map(([nome, pref]) => ({ nome, pref })));
const prefixoEmp = () => str(D.cfg.prefixo || '');
const procs = () => (D.cfg.procs && D.cfg.procs.length ? D.cfg.procs : PROCS_PADRAO.map(([sigla, nome]) => ({ sigla, nome })));
const eu = n => norm(n) && norm(n) === norm(MEU);
const podeAprovar = d => !!(d && d.pend) && (eu(d.pend.aprovador) || ADMIN);
const areaNome = id => (D.areas.find(a => a.id === id) || {}).nome || '';
const docBy = id => D.docs.find(d => d.id === id);
const sitVal = d => !d.validade ? '' : d.validade < hoje() ? 'vencido' : d.validade <= addDias(30) ? 'vence' : 'ok';
const vencBadge = d => { const s = sitVal(d); return d.status === 'obsoleto' || !s ? '' : s === 'vencido' ? '<span class="badge b-bad">Revisão vencida</span>' : s === 'vence' ? '<span class="badge b-warn">Revisar em breve</span>' : ''; };
const stBadge = d => { const s = STATUS[d.status] || STATUS.vigente; return `<span class="badge ${s[1]}">${s[0]}</span>` + (d.pend && d.status !== 'aprovacao' ? `<span class="badge b-warn">${revTxt(d.pend.rev)} aguardando aprovação</span>` : '') + (d.pend && d.pend.recusa ? '<span class="badge b-bad">Recusada: corrigir</span>' : ''); };
const clientes = () => [...new Set(D.docs.map(d => str(d.cliente).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
const sugerirCodigo = (tipo, proc) => { const t = tipos().find(x => x.nome === tipo) || {}; const base = (prefixoEmp() ? prefixoEmp() + '-' : '') + (t.pref || 'DOC') + '-' + (proc || 'SGI') + '-';
  const n = D.docs.map(d => str(d.codigo)).filter(c => c.startsWith(base)).map(c => parseInt(c.slice(base.length), 10) || 0); return base + String(Math.max(0, ...n) + 1).padStart(3, '0'); };

/* ---------- arquivos em partes ---------- */
const b64De = f => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = err; r.readAsDataURL(f); });
async function sha256(f) { try { const h = await crypto.subtle.digest('SHA-256', await f.arrayBuffer()); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
async function gravarArquivo(f, extra, prog) {
  const b64 = await b64De(f), partes = Math.ceil(b64.length / PARTE) || 1, sha = await sha256(f);
  const r = db.collection('docfiles').doc(); const id = r.id;
  await r.set(Object.assign({ nome: f.name, tipo: f.type || '', tam: f.size, partes, sha, em: new Date().toISOString(), por: MEU, completo: false }, extra));
  for (let i = 0; i < partes; i++) { await db.doc(`docfiles/${id}/p/${i}`).set({ i, d: b64.slice(i * PARTE, (i + 1) * PARTE) }); prog && prog((i + 1) / partes); }
  await db.doc('docfiles/' + id).update({ completo: true });
  return { id, nome: f.name, tipo: f.type || '', tam: f.size, sha };
}
async function baixar(arq) {
  if (!arq || !arq.id) return toast('Sem arquivo anexado.', 'bad');
  toast('Baixando ' + arq.nome + '…');
  try {
    const m = await db.doc('docfiles/' + arq.id).get(); if (!m.exists) throw new Error('não encontrado');
    let b64 = ''; for (let i = 0; i < (m.data().partes || 1); i++) { const p = await db.doc(`docfiles/${arq.id}/p/${i}`).get(); if (!p.exists) throw new Error('incompleto'); b64 += p.data().d; }
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: arq.tipo || 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = arq.nome || 'documento'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { toast('Não foi possível baixar o arquivo. Verifique a conexão.', 'bad'); }
}

/* ---------- dados ---------- */
function ouvir() {
  const q = EDITA ? db.collection('docs') : db.collection('docs').where('restrito', '==', false);
  q.onSnapshot(s => { D.docs = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); if (ESPERA && docBy(ESPERA)) { const i = ESPERA; ESPERA = ''; detalhe(i); } else if (EMDET && docBy(EMDET)) detalhe(EMDET); render(); }, () => toast('Sem permissão para ler os documentos.', 'bad'));
  db.collection('areas').onSnapshot(s => { D.areas = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')); }, () => {});
  db.doc('config/documentos').onSnapshot(s => { D.cfg = s.exists ? s.data() : {}; render(); }, () => {});
}

/* ---------- lista ---------- */
function filtrados() {
  const b = norm(V.busca);
  return D.docs.filter(d => (V.status === 'ativos' ? d.status !== 'obsoleto' : !V.status || d.status === V.status)
    && (!V.tipo || d.tipo === V.tipo) && (!V.area || d.areaId === V.area) && (!V.cliente || d.cliente === V.cliente)
    && (!V.venc || (V.venc === 'vencido' ? sitVal(d) === 'vencido' && d.status !== 'obsoleto' : V.venc === 'vence' ? sitVal(d) === 'vence' && d.status !== 'obsoleto' : true))
    && (!b || norm([d.codigo, d.titulo, d.tipo, d.cliente, d.responsavel, areaNome(d.areaId), (d.tags || []).join(' '), d.descricao].join(' ')).includes(b)))
    .sort((x, y) => V.ordem === 'titulo' ? str(x.titulo).localeCompare(str(y.titulo), 'pt') : V.ordem === 'recentes' ? str(y.atualizadoEm).localeCompare(str(x.atualizadoEm)) : V.ordem === 'validade' ? str(x.validade || '9999').localeCompare(str(y.validade || '9999')) : str(x.codigo).localeCompare(str(y.codigo), 'pt', { numeric: true }));
}
const linha = d => `<div class="drow" data-open="${esc(d.id)}"><div class="ext ${esc(extDe((d.arquivo || {}).nome))}">${esc(extDe((d.arquivo || {}).nome).toUpperCase() || '—')}</div>
  <div class="main"><div><span class="dcod">${esc(d.codigo)}</span> · <b>${esc(d.titulo)}</b></div>
  <div class="note">${esc([d.tipo, areaNome(d.areaId), d.cliente].filter(Boolean).join(' · '))}</div>
  <div class="note">${d.rev == null && d.pend ? revTxt(d.pend.rev) + ' (em aprovação)' : revTxt(d.rev) + ' de ' + fmtD(d.dataRev)}${d.procSigla ? ' · ' + esc(d.procSigla) : ''}${d.validade ? ' · revisar até ' + fmtD(d.validade) : ''}${d.responsavel ? ' · resp.: ' + esc(d.responsavel) : ''}</div>
  <div class="tags">${stBadge(d)}${vencBadge(d)}${d.restrito ? '<span class="badge b-mut">🔒 Restrito</span>' : ''}${(d.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
  ${(d.arquivo || {}).id ? `<button class="btn sm ghost" data-dl="${esc(d.id)}" title="Baixar a revisão atual">⬇</button>` : ''}</div>`;

function tDocs() {
  const A = D.docs.filter(d => d.status !== 'obsoleto'), L = filtrados();
  const venc = A.filter(d => sitVal(d) === 'vencido').length, breve = A.filter(d => sitVal(d) === 'vence').length;
  const opt = (arr, sel, todos) => `<option value="">${todos}</option>` + arr.map(([v, t]) => `<option value="${esc(v)}" ${sel === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  $('#body').innerHTML = `<div class="kpis" style="margin-bottom:12px">${kpi('Vigentes', A.filter(d => d.status === 'vigente').length, 'ok')}${kpi('Aguardando aprovação', A.filter(d => d.pend).length, A.some(d => d.pend) ? 'warn' : '', 'aprovacao')}${kpi('Em revisão', A.filter(d => d.status === 'revisao').length, 'warn', 'revisao')}${kpi('Revisão vencida', venc, venc ? 'bad' : '', 'vencido')}${kpi('Revisar em 30 dias', breve, breve ? 'warn' : '', 'vence')}${kpi('Rascunhos', A.filter(d => d.status === 'rascunho').length, '', 'rascunho')}${kpi('Obsoletos', D.docs.length - A.length, '', 'obsoleto')}</div>
    <div class="top2"><input type="search" id="f-b" placeholder="Buscar por código, título, cliente, palavra-chave…" value="${esc(V.busca)}">${EDITA ? '<button class="btn primary" id="novo">+ Novo documento</button>' : ''}</div>
    <div class="top2"><select id="f-t">${opt(tipos().map(t => [t.nome, t.nome]), V.tipo, 'Todos os tipos')}</select><select id="f-a">${opt(D.areas.map(a => [a.id, a.nome]), V.area, 'Todas as áreas')}</select>
      <select id="f-c">${opt(clientes().map(c => [c, c]), V.cliente, 'Todos os clientes')}</select>
      <select id="f-s"><option value="ativos" ${V.status === 'ativos' ? 'selected' : ''}>Sem os obsoletos</option><option value="" ${!V.status ? 'selected' : ''}>Todas as situações</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${V.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
      <select id="f-v"><option value="">Qualquer validade</option><option value="vencido" ${V.venc === 'vencido' ? 'selected' : ''}>Revisão vencida</option><option value="vence" ${V.venc === 'vence' ? 'selected' : ''}>Revisar em 30 dias</option></select>
      <select id="f-o">${[['codigo', 'Ordem: código'], ['titulo', 'Ordem: título'], ['recentes', 'Atualizados recentemente'], ['validade', 'Próximos a revisar']].map(([v, t]) => `<option value="${v}" ${V.ordem === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button class="btn sm ghost" id="limpar">Limpar filtros</button><button class="btn sm ghost" id="exp">Exportar lista mestra</button></div>
    <div class="card" style="padding:2px 14px"><p class="note" style="margin:8px 0 0">${L.length} documento(s)</p>${L.map(linha).join('') || `<div class="empty" style="margin:10px 0">${D.docs.length ? 'Nenhum documento com esses filtros.' : EDITA ? 'Nenhum documento ainda. Toque em "+ Novo documento" para anexar o primeiro.' : 'Nenhum documento liberado para você.'}</div>`}</div>`;
  const re = () => { const p = $('#f-b').selectionStart; tDocs(); const b = $('#f-b'); b.focus(); b.setSelectionRange(p, p); };
  $('#f-b').oninput = e => { V.busca = e.target.value; re(); };
  [['#f-t', 'tipo'], ['#f-a', 'area'], ['#f-c', 'cliente'], ['#f-s', 'status'], ['#f-v', 'venc'], ['#f-o', 'ordem']].forEach(([s, k]) => $(s).onchange = e => { V[k] = e.target.value; tDocs(); });
  $('#limpar').onclick = () => { Object.assign(V, { busca: '', tipo: '', area: '', cliente: '', status: 'ativos', venc: '' }); tDocs(); };
  $('#exp').onclick = () => exportar(L);
  if ($('#novo')) $('#novo').onclick = () => form();
  $$('[data-kf]').forEach(b => b.onclick = () => { const f = b.dataset.kf; if (f === 'aprovacao') { V.tab = 'aprov'; return render(); } if (f === 'vencido' || f === 'vence') Object.assign(V, { venc: f, status: 'ativos' }); else Object.assign(V, { status: f, venc: '' }); tDocs(); });
}
function tRev() {
  const A = D.docs.filter(d => d.status !== 'obsoleto');
  const grupo = (t, L, vazio) => `<h3>${t} (${L.length})</h3><div class="card" style="padding:2px 14px">${L.map(linha).join('') || `<p class="note">${vazio}</p>`}</div>`;
  const porVal = (a, b) => str(a.validade).localeCompare(str(b.validade));
  $('#body').innerHTML = `<p class="note">Documentos que precisam de atenção: revisão vencida, revisão nos próximos 60 dias, em revisão ou ainda em rascunho.</p>
    ${grupo('Revisão vencida', A.filter(d => sitVal(d) === 'vencido').sort(porVal), 'Nenhum documento com revisão vencida.')}
    ${grupo('Revisar nos próximos 60 dias', A.filter(d => d.validade && d.validade >= hoje() && d.validade <= addDias(60)).sort(porVal), 'Nada para os próximos 60 dias.')}
    ${grupo('Em revisão', A.filter(d => d.status === 'revisao'), 'Nenhum documento em revisão.')}
    ${grupo('Rascunhos (ainda não aprovados)', A.filter(d => d.status === 'rascunho'), 'Nenhum rascunho.')}`;
}
function tAprov() {
  const P = D.docs.filter(d => d.pend), meus = P.filter(d => eu(d.pend.aprovador)), outros = P.filter(d => !eu(d.pend.aprovador));
  const lin = d => `<div class="drow" data-open="${esc(d.id)}"><div class="ext ${esc(extDe(((d.pend || {}).arquivo || {}).nome))}">${esc(extDe(((d.pend || {}).arquivo || {}).nome).toUpperCase() || '—')}</div>
    <div class="main"><div><span class="dcod">${esc(d.codigo)}</span> · <b>${esc(d.titulo)}</b></div>
    <div class="note">${revTxt(d.pend.rev)} · enviada por ${esc(d.pend.por || '—')} em ${fmtD(d.pend.data)} · aprovador: <b>${esc(d.pend.aprovador || '—')}</b></div>
    <div class="note">${esc(d.pend.motivo || '')}</div>${d.pend.recusa ? `<div class="note" style="color:var(--bad)">Recusada por ${esc(d.pend.recusa.por)}: ${esc(d.pend.recusa.motivo)}</div>` : ''}</div></div>`;
  $('#body').innerHTML = `<p class="note">Todo documento novo e toda nova revisão só valem depois de aprovados por quem foi indicado como aprovador. Enquanto isso, a revisão anterior continua vigente.</p>
    <h3>Aguardando a sua aprovação (${meus.length})</h3><div class="card" style="padding:2px 14px">${meus.map(lin).join('') || '<p class="note">Nada aguardando você.</p>'}</div>
    <h3>Aguardando outros aprovadores (${outros.length})</h3><div class="card" style="padding:2px 14px">${outros.map(lin).join('') || '<p class="note">Nenhum.</p>'}</div>`;
}
function tCfg() {
  if (!EDITA) { V.tab = 'docs'; return render(); }
  const T = tipos();
  $('#body').innerHTML = `<div class="card"><p class="ct">Código dos documentos</p><p class="cs">O código segue a norma: TIPO-PROCESSO-NÚMERO, por exemplo PG-SGI-001 (procedimento de gestão), IT-MNT-005 (instrução de trabalho) ou FOR-SST-010 (formulário). O número é sequencial dentro de cada tipo e processo.</p>
    <label for="c-pre">Prefixo da empresa (opcional, vai antes de tudo)</label><input id="c-pre" value="${esc(prefixoEmp())}" maxlength="8" style="max-width:160px" placeholder="vazio">
    <label for="c-per">Prazo padrão para revisão (meses)</label><input id="c-per" type="number" min="0" max="120" value="${esc(D.cfg.periodo ?? 24)}" style="max-width:160px"><p class="note">Usado para sugerir a data da próxima revisão. Deixe 0 para não sugerir.</p></div>
    <div class="card"><p class="ct">Tipos de documento e siglas</p><div id="c-tipos">${T.map((t, i) => `<div class="grid2" data-ti="${i}"><div><input class="c-tn" value="${esc(t.nome)}" placeholder="Tipo"></div><div style="display:flex;gap:6px"><input class="c-tp" value="${esc(t.pref)}" placeholder="Sigla" maxlength="5"><button class="btn sm danger" data-rmt="${i}">×</button></div></div>`).join('')}</div>
    <button class="btn sm ghost" id="c-add" style="margin-top:8px">+ Tipo</button></div>
    <div class="card"><p class="ct">Processos do SGI e siglas</p><div id="c-procs">${procs().map((p, i) => `<div class="grid2" data-pi="${i}"><div><input class="c-pn" value="${esc(p.nome)}" placeholder="Processo"></div><div style="display:flex;gap:6px"><input class="c-ps" value="${esc(p.sigla)}" placeholder="Sigla" maxlength="5"><button class="btn sm danger" data-rmp="${i}">×</button></div></div>`).join('')}</div>
    <button class="btn sm ghost" id="c-addp" style="margin-top:8px">+ Processo</button></div>
    <div class="actions"><button class="btn primary" id="c-sv">Salvar configurações</button></div>`;
  const lerP = () => $$('#c-procs [data-pi]').map(r => ({ nome: r.querySelector('.c-pn').value.trim(), sigla: r.querySelector('.c-ps').value.trim().toUpperCase() })).filter(p => p.nome && p.sigla);
  const ler = () => $$('#c-tipos [data-ti]').map(r => ({ nome: r.querySelector('.c-tn').value.trim(), pref: r.querySelector('.c-tp').value.trim().toUpperCase() })).filter(t => t.nome);
  $('#c-add').onclick = () => { D.cfg = Object.assign({}, D.cfg, { tipos: ler().concat([{ nome: '', pref: '' }]), procs: lerP() }); tCfg(); };
  $('#c-addp').onclick = () => { D.cfg = Object.assign({}, D.cfg, { tipos: ler(), procs: lerP().concat([{ nome: 'Novo processo', sigla: 'NOV' }]) }); tCfg(); };
  $$('[data-rmp]').forEach(b => b.onclick = () => { const L = lerP(); L.splice(+b.dataset.rmp, 1); D.cfg = Object.assign({}, D.cfg, { tipos: ler(), procs: L }); tCfg(); });
  $$('[data-rmt]').forEach(b => b.onclick = () => { const L = ler(); L.splice(+b.dataset.rmt, 1); D.cfg = Object.assign({}, D.cfg, { tipos: L }); tCfg(); });
  $('#c-sv').onclick = async () => { const L = ler(); if (!L.length) return toast('Cadastre pelo menos um tipo.', 'bad');
    try { await db.doc('config/documentos').set({ prefixo: $('#c-pre').value.trim().toUpperCase(), periodo: +$('#c-per').value || 0, tipos: L, procs: lerP() }); toast('Configurações salvas.', 'ok'); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
}
function render() {
  if (ABERTO) return;
  $$('#seg [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab)); $('#tab-cfg').hidden = !EDITA;
  const nm = D.docs.filter(d => d.pend && eu(d.pend.aprovador) && !d.pend.recusa).length; const ta = $('#tab-aprov'); if (ta) ta.innerHTML = 'Aprovações' + (nm ? ` <span class="badge b-bad" style="margin-left:4px">${nm}</span>` : '');
  ({ docs: tDocs, aprov: tAprov, rev: tRev, cfg: tCfg })[V.tab]();
}

/* ---------- detalhe ---------- */
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; ABERTO = ''; ESPERA = ''; EMDET = ''; render(); };
function detalhe(id) {
  const d = docBy(id); if (!d) { ESPERA = id; ABERTO = id; return sheet('<p class="note">Carregando…</p>'); } ABERTO = id; EMDET = id;
  const H = (d.hist || []).slice().sort((a, b) => (+b.rev || 0) - (+a.rev || 0));
  const a = d.arquivo || {};
  sheet(`<div class="bt" style="align-items:flex-start"><div><span class="dcod">${esc(d.codigo)}</span><h2 style="margin:2px 0 6px">${esc(d.titulo)}</h2><div class="tags">${stBadge(d)}${vencBadge(d)}${d.restrito ? '<span class="badge b-mut">🔒 Restrito</span>' : ''}</div></div><button class="btn sm ghost" id="x">Fechar</button></div>
    <div class="meta"><div><b>Revisão</b>${d.rev == null ? 'ainda não aprovada' : revTxt(d.rev) + ' · ' + fmtD(d.dataRev)}</div><div><b>Processo</b>${esc(d.procSigla ? d.procSigla + ' · ' + ((procs().find(p => p.sigla === d.procSigla) || {}).nome || '') : '—')}</div><div><b>Próxima revisão</b>${d.validade ? fmtD(d.validade) : '—'}</div><div><b>Tipo</b>${esc(d.tipo || '—')}</div><div><b>Área</b>${esc(areaNome(d.areaId) || '—')}</div>
      <div><b>Cliente / contrato</b>${esc(d.cliente || '—')}</div><div><b>Responsável</b>${esc(d.responsavel || '—')}</div><div><b>Elaborado por</b>${esc(d.elaborador || '—')}</div><div><b>Aprovado por</b>${esc(d.aprovador || '—')}${d.aprovadoEm ? ' em ' + fmtD(d.aprovadoEm) : ''}</div>${d.modeloPortal ? `<div><b>Modelo do portal</b>${esc((MODELOS_PORTAL.find(m => m[0] === d.modeloPortal) || [])[1] || '')}</div>` : ''}</div>
    ${d.descricao ? `<p style="margin:6px 0 10px">${esc(d.descricao)}</p>` : ''}${(d.tags || []).length ? `<div class="tags" style="margin-bottom:10px">${d.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${d.pend ? `<div class="card" style="border-color:var(--warn)"><p class="ct">${d.rev == null ? 'Emissão' : 'Nova revisão'} aguardando aprovação · ${revTxt(d.pend.rev)}</p>
      <div class="note">Enviada por <b>${esc(d.pend.por || '—')}</b> em ${fmtD(d.pend.data)} · aprovador indicado: <b>${esc(d.pend.aprovador || '—')}</b></div><div class="note">${esc(d.pend.motivo || '')}</div>
      ${d.pend.recusa ? `<div class="note" style="color:var(--bad)">Recusada por ${esc(d.pend.recusa.por)} em ${fmtD(d.pend.recusa.em)}: ${esc(d.pend.recusa.motivo)}. Corrija e envie de novo em "Nova revisão".</div>` : ''}
      ${(d.pend.arquivo || {}).id ? `<div class="hrow"><div class="ext ${esc(extDe(d.pend.arquivo.nome))}">${esc(extDe(d.pend.arquivo.nome).toUpperCase())}</div><div class="main"><b>${esc(d.pend.arquivo.nome)}</b></div><button class="btn sm ghost" data-dlp="1">Ver</button></div>` : ''}
      ${podeAprovar(d) && !d.pend.recusa ? '<div class="actions"><button class="btn ghost" id="recusar">Recusar</button><button class="btn primary" id="aprovar">Aprovar</button></div>' : !d.pend.recusa ? `<p class="note">Só ${esc(d.pend.aprovador)} (ou um administrador) pode aprovar.</p>` : ''}</div>` : ''}
    <div class="card"><p class="ct">Arquivo da revisão atual</p>${a.id ? `<div class="hrow"><div class="ext ${esc(extDe(a.nome))}">${esc(extDe(a.nome).toUpperCase())}</div><div class="main"><b>${esc(a.nome)}</b><div class="note">${fmtTam(a.tam || 0)}${a.sha ? ' · código de integridade ' + esc(a.sha.slice(0, 12)) : ''}</div></div><button class="btn sm primary" data-dla="atual">Baixar</button></div>` : '<p class="note">Nenhum arquivo anexado.</p>'}</div>
    <div class="card"><p class="ct">Histórico de revisões</p>${H.map((h, i) => `<div class="hrow"><div class="main"><b>${revTxt(h.rev)}</b> · ${fmtD(h.data)}${h.rev === d.rev && i === 0 && !h.obsoletaEm ? ' <span class="badge b-ok">atual</span>' : ''}<div class="note">${esc(h.motivo || '')}</div><div class="note">${esc([h.por && 'por ' + h.por, h.aprovador && 'aprovado por ' + h.aprovador].filter(Boolean).join(' · '))}</div></div>${h.arquivo && h.arquivo.id ? `<button class="btn sm ghost" data-dlh="${i}">⬇</button>` : ''}</div>`).join('') || '<p class="note">Sem histórico.</p>'}</div>
    ${EDITA ? `<div class="actions"><button class="btn accent" id="nrev">Nova revisão</button><button class="btn ghost" id="ed">Editar dados</button>
      ${d.status === 'vigente' ? '<button class="btn ghost" id="emrev">Marcar em revisão</button>' : ''}
      ${d.status !== 'obsoleto' ? '<button class="btn danger" id="obs">Tornar obsoleto</button>' : '<button class="btn ghost" id="reat">Reativar</button>'}</div>` : ''}`);
  $('#x').onclick = fechar;
  $$('[data-dla]').forEach(b => b.onclick = () => baixar(a));
  $$('[data-dlh]').forEach(b => b.onclick = () => baixar(H[+b.dataset.dlh].arquivo));
  $$('[data-dlp]').forEach(b => b.onclick = () => baixar(d.pend.arquivo));
  if ($('#aprovar')) $('#aprovar').onclick = () => aprovar(d);
  if (!EDITA) return;
  $('#nrev').onclick = () => form(d, true);
  $('#ed').onclick = () => form(d, false);
  const mud = async (st, txt) => { try { await db.doc('docs/' + d.id).update({ status: st, atualizadoEm: new Date().toISOString() }); toast(txt, 'ok'); } catch (e) { toast('Não foi possível alterar.', 'bad'); } };
  if ($('#emrev')) $('#emrev').onclick = () => mud('revisao', 'Documento marcado como em revisão.');
  if ($('#recusar')) $('#recusar').onclick = async () => { const m = prompt('O que precisa ser corrigido?'); if (!m || !m.trim()) return;
    try { await db.doc('docs/' + d.id).update({ pend: Object.assign({}, d.pend, { recusa: { por: MEU, em: new Date().toISOString(), motivo: m.trim() } }), atualizadoEm: new Date().toISOString() }); toast('Revisão recusada. Quem elaborou vai ver o motivo.', 'ok'); } catch (e) { toast('Não foi possível recusar.', 'bad'); } };
  let armado = false;
  if ($('#obs')) $('#obs').onclick = () => { if (!armado) { armado = true; $('#obs').textContent = 'Confirmar: tornar obsoleto'; return; } mud('obsoleto', 'Documento marcado como obsoleto. Ele continua no histórico.'); };
  if ($('#reat')) $('#reat').onclick = () => mud('vigente', 'Documento reativado.');
}

/* ---------- aprovação ---------- */
async function lerArquivo(arq) {
  const m = await db.doc('docfiles/' + arq.id).get(); if (!m.exists) throw new Error('arquivo não encontrado');
  let b64 = ''; for (let i = 0; i < (m.data().partes || 1); i++) { const p = await db.doc(`docfiles/${arq.id}/p/${i}`).get(); if (!p.exists) throw new Error('arquivo incompleto'); b64 += p.data().d; }
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8;
}
async function pdfLib() { if (window.PDFLib) return window.PDFLib; await new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'; s.onload = ok; s.onerror = err; document.head.appendChild(s); }); return window.PDFLib; }
/* PDF aprovado: carimbo de controle no rodapé de cada página + folha de controle no final */
async function carimbar(u8, d, p, quando) {
  const { PDFDocument, StandardFonts, rgb } = await pdfLib();
  const pdf = await PDFDocument.load(u8, { ignoreEncryption: true }); const f = await pdf.embedFont(StandardFonts.Helvetica), fb = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lim = t => String(t == null ? '' : t).normalize('NFC').replace(/[–—]/g, '-').replace(/[^\u0000-ÿ]/g, '');
  const lin = lim(`${d.codigo} · ${revTxt(p.rev)} de ${fmtD(p.data)} · Elaborado: ${p.por} · Aprovado: ${MEU} em ${fmtD(quando)} · Cópia controlada: confira a revisão vigente no portal`);
  pdf.getPages().forEach(pg => { const w = pg.getWidth(); pg.drawRectangle({ x: 20, y: 5, width: w - 40, height: 11, color: rgb(1, 1, 1), opacity: 0.85 }); pg.drawText(lin, { x: 24, y: 8, size: 6.2, font: f, color: rgb(0.08, 0.13, 0.24), maxWidth: w - 48 }); });
  const pg = pdf.addPage([595.28, 841.89]); let y = 780; const T = (t, x, s, b, c) => pg.drawText(lim(t), { x, y, size: s || 10, font: b ? fb : f, color: c || rgb(0.1, 0.1, 0.1), maxWidth: 520 - (x - 40) });
  T('PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA · CNPJ 03.052.261/0001-43', 40, 9, true, rgb(0.08, 0.13, 0.24)); y -= 22;
  T('FOLHA DE CONTROLE DO DOCUMENTO', 40, 15, true, rgb(0.12, 0.31, 0.61)); y -= 30;
  [['Código', d.codigo], ['Título', d.titulo], ['Tipo / processo', [d.tipo, d.procSigla].filter(Boolean).join(' · ')], ['Revisão', revTxt(p.rev) + ' de ' + fmtD(p.data)], ['O que mudou', p.motivo || '-'], ['Elaborado por', p.por + ' em ' + fmtD(p.em)], ['Aprovado por', MEU + ' em ' + fmtD(quando) + ' (aprovação eletrônica no portal)'], ['Próxima revisão até', d.validade ? fmtD(d.validade) : '-']]
    .forEach(([k, v]) => { T(k, 40, 10, true); T(v, 170, 10); y -= 22; });
  y -= 8; T('Histórico de revisões', 40, 11, true); y -= 18;
  (d.hist || []).slice().sort((a, b) => (+a.rev || 0) - (+b.rev || 0)).concat([{ rev: p.rev, data: p.data, motivo: p.motivo, por: p.por, aprovador: MEU }]).forEach(h => { if (y < 60) return; T(`${revTxt(h.rev)} · ${fmtD(h.data)} · ${h.motivo || ''} · elab.: ${h.por || '-'} · aprov.: ${h.aprovador || '-'}`, 40, 8.5); y -= 14; });
  return await pdf.save();
}
async function aprovar(d) {
  const p = d.pend; if (!p) return; if (!podeAprovar(d)) return toast('Só o aprovador indicado pode aprovar.', 'bad');
  if (!confirm(`Aprovar ${d.codigo} ${revTxt(p.rev)}? Ela passa a ser a revisão vigente${d.rev != null ? ' e a ' + revTxt(d.rev) + ' fica obsoleta' : ''}.`)) return;
  const b = $('#aprovar'); if (b) { b.disabled = true; b.textContent = 'Aprovando…'; }
  const agora = new Date().toISOString();
  try {
    let arq = p.arquivo || null;
    /* PDF: grava uma cópia carimbada (código, revisão, elaborado e aprovado) como arquivo da revisão */
    if (arq && arq.id && /pdf$/i.test(arq.tipo || arq.nome || '')) {
      try { const u8 = await carimbar(await lerArquivo(arq), d, p, agora); const nome = String(arq.nome).replace(/\.pdf$/i, '') + ` - ${revTxt(p.rev)} aprovada.pdf`;
        arq = Object.assign(await gravarArquivo(new File([u8], nome, { type: 'application/pdf' }), { docId: d.id, rev: p.rev, restrito: !!d.restrito }), { original: p.arquivo }); }
      catch (e) { console.warn('carimbo', e); }
    }
    const H = (d.hist || []).map(h => !h.obsoletaEm ? Object.assign({}, h, { obsoletaEm: p.data }) : h);
    H.push({ rev: p.rev, data: p.data, motivo: p.motivo, por: p.por, aprovador: MEU, aprovadoEm: agora, arquivo: arq, em: p.em });
    await db.doc('docs/' + d.id).update({ rev: p.rev, dataRev: p.data, arquivo: arq, hist: H, status: 'vigente', elaborador: p.por, aprovador: MEU, aprovadoEm: agora, atualizadoEm: agora, pend: null });
    if (d.modeloPortal) await db.doc('config/modelos').set({ [d.modeloPortal]: { codigo: d.codigo, rev: p.rev, data: p.data, aprovador: MEU, elaborador: p.por } }, { merge: true }).catch(e => console.warn(e));
    toast(`${d.codigo} ${revTxt(p.rev)} aprovada e vigente.`, 'ok');
  } catch (e) { console.error(e); toast('Não foi possível aprovar. Tente de novo.', 'bad'); if (b) { b.disabled = false; b.textContent = 'Aprovar'; } }
}

/* ---------- novo, editar, nova revisão ---------- */
function form(d, novaRev) {
  const novo = !d; d = d || {}; ABERTO = d.id || 'novo'; EMDET = '';
  const per = +(D.cfg.periodo ?? 24);
  const prox = novo || novaRev ? (per ? addMeses(hoje(), per) : '') : d.validade || '';
  const tit = novo ? 'Novo documento' : novaRev ? `Nova revisão: ${esc(d.codigo)} (${revTxt((+d.rev || 0) + 1)})` : 'Editar dados de ' + esc(d.codigo);
  const meta = !novaRev;
  sheet(`<div class="bt"><h2 style="margin:0">${tit}</h2><button class="btn sm ghost" id="x">Cancelar</button></div>
    ${meta ? `<div class="grid2"><div><label class="req" for="d-tp">Tipo</label><select id="d-tp">${tipos().map(t => `<option ${d.tipo === t.nome ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
      <div><label class="req" for="d-pc">Processo (SGI)</label><select id="d-pc">${procs().map(p => `<option value="${esc(p.sigla)}" ${d.procSigla === p.sigla ? 'selected' : ''}>${esc(p.sigla)} · ${esc(p.nome)}</option>`).join('')}</select></div></div>
    <div class="grid2"><div><label class="req" for="d-cod">Código</label><input id="d-cod" value="${esc(d.codigo || '')}"></div>
      <div><label for="d-mp">É modelo gerado pelo portal?</label><select id="d-mp">${MODELOS_PORTAL.map(([v, t]) => `<option value="${v}" ${str(d.modeloPortal) === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
    <label class="req" for="d-tit">Título</label><input id="d-tit" value="${esc(d.titulo || '')}" placeholder="Ex.: Procedimento de bloqueio e etiquetagem (LOTO)">
    <div class="grid2"><div><label for="d-ar">Área</label><select id="d-ar"><option value="">—</option>${D.areas.map(a => `<option value="${esc(a.id)}" ${d.areaId === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div>
      <div><label for="d-cl">Cliente / contrato</label><input id="d-cl" list="d-cls" value="${esc(d.cliente || '')}" placeholder="Ex.: ArcelorMittal Resende"><datalist id="d-cls">${clientes().map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
    <div class="grid2"><div><label for="d-rs">Responsável pelo documento</label><input id="d-rs" value="${esc(d.responsavel || '')}"></div><div><label for="d-el">Elaborado por</label><input id="d-el" value="${esc(novo ? MEU : d.elaborador || '')}" ${novo ? 'readonly' : ''}></div></div>
    <label for="d-ds">Descrição</label><textarea id="d-ds" rows="2">${esc(d.descricao || '')}</textarea>
    <label for="d-tg">Palavras-chave (separe por vírgula)</label><input id="d-tg" value="${esc((d.tags || []).join(', '))}" placeholder="Ex.: NR-10, subestação, bloqueio">
    <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="d-rt" style="width:auto" ${d.restrito ? 'checked' : ''}> Restrito: só quem edita documentos pode ver e baixar</label>` : ''}
    ${novo || novaRev ? `<div class="grid2"><div><label class="req" for="d-rev">Número da revisão</label><input id="d-rev" type="number" min="0" value="${novo ? 0 : (+d.rev || 0) + 1}"></div><div><label class="req" for="d-dr">Data da revisão</label><input id="d-dr" type="date" value="${hoje()}"></div></div>
      <label class="${novo ? '' : 'req'}" for="d-mt">${novo ? 'Observação da emissão' : 'O que mudou nesta revisão'}</label><input id="d-mt" value="${novo ? 'Emissão inicial' : ''}" placeholder="${novo ? '' : 'Ex.: inclusão da etapa de teste de partida'}">` : ''}
    <div class="grid2"><div><label for="d-val">Próxima revisão até</label><input id="d-val" type="date" value="${esc(prox)}"></div>
      ${novo || novaRev ? `<div><label class="req" for="d-ap">Quem aprova</label><select id="d-ap"><option value="">Escolha…</option>${APROVS.map(n => `<option ${norm(n) === norm(d.aprovador || (d.pend || {}).aprovador) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>` : '<div></div>'}</div>
    ${novo || novaRev ? `<p class="note">Elaborado por <b>${esc(MEU)}</b>. O documento ${novo ? '' : '(esta revisão) '}só fica vigente depois que o aprovador der o OK${novo ? '' : '; até lá a revisão atual continua valendo'}.</p>
      <label class="${novo ? '' : 'req'}">Arquivo ${novaRev ? 'da nova revisão' : ''}</label><div class="drop" id="drop"><input type="file" id="d-arq" hidden><b>Toque para escolher o arquivo</b><div class="note">PDF, Word, Excel, imagem, DWG… até 15 MB</div></div><div id="d-prog" class="note"></div>` : ''}
    <div class="actions"><button class="btn primary" id="sv">${novo ? 'Salvar documento' : novaRev ? 'Publicar nova revisão' : 'Salvar alterações'}</button></div>`);
  $('#x').onclick = () => d.id ? detalhe(d.id) : fechar();
  if (meta) { const ajusta = () => { const c = $('#d-cod'); if (novo && (!c.value || c.dataset.auto === '1')) { c.value = sugerirCodigo($('#d-tp').value, $('#d-pc').value); c.dataset.auto = '1'; } }; $('#d-tp').onchange = ajusta; $('#d-pc').onchange = ajusta; $('#d-cod').oninput = e => e.target.dataset.auto = '0'; ajusta(); }
  let ARQ = null;
  if ($('#drop')) { const dz = $('#drop'), inp = $('#d-arq');
    const pega = f => { if (!f) return; if (f.size > MAX) return toast('Arquivo maior que 15 MB. Reduza ou divida o arquivo.', 'bad'); ARQ = f; dz.innerHTML = `<b>${esc(f.name)}</b><div class="note">${fmtTam(f.size)} · toque para trocar</div>`; dz.appendChild(inp); };
    dz.onclick = e => { if (e.target !== inp) inp.click(); }; inp.onchange = () => pega(inp.files[0]);
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = () => dz.classList.remove('on'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('on'); pega(e.dataTransfer.files[0]); }; }
  $('#sv').onclick = async () => {
    const agora = new Date().toISOString(); const up = {};
    if (meta) {
      Object.assign(up, { tipo: $('#d-tp').value, procSigla: $('#d-pc').value, modeloPortal: $('#d-mp').value, codigo: $('#d-cod').value.trim().toUpperCase(), titulo: $('#d-tit').value.trim(), areaId: $('#d-ar').value, cliente: $('#d-cl').value.trim(), responsavel: $('#d-rs').value.trim(), elaborador: $('#d-el').value.trim(), descricao: $('#d-ds').value.trim(), tags: $('#d-tg').value.split(',').map(s => s.trim()).filter(Boolean), restrito: $('#d-rt').checked });
      if (!up.codigo || !up.titulo) return toast('Preencha código e título.', 'bad');
      if (D.docs.some(x => x.id !== d.id && norm(x.codigo) === norm(up.codigo))) return toast('Já existe um documento com esse código.', 'bad');
    }
    up.validade = $('#d-val').value; up.atualizadoEm = agora;
    if (novo || novaRev) {
      const rev = +$('#d-rev').value, dr = $('#d-dr').value, mt = $('#d-mt').value.trim(), ap = $('#d-ap').value.trim();
      if (!ap) return toast('Escolha quem aprova.', 'bad');
      if (novo && !ARQ) return toast('Anexe o arquivo do documento.', 'bad');
      if (!dr || isNaN(rev) || rev < 0) return toast('Informe número e data da revisão.', 'bad');
      if (novaRev && rev <= (+d.rev || 0)) return toast(`A nova revisão precisa ser maior que ${revTxt(d.rev)}.`, 'bad');
      if (novaRev && !mt) return toast('Descreva o que mudou nesta revisão.', 'bad');
      if (novaRev && !ARQ) return toast('Anexe o arquivo da nova revisão.', 'bad');
      if (up.validade && up.validade < dr) return toast('A próxima revisão não pode ser antes da data da revisão.', 'bad');
      const b = $('#sv'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        const ref = novo ? db.collection('docs').doc() : db.doc('docs/' + d.id);
        let arq = null; if (ARQ) arq = await gravarArquivo(ARQ, { docId: ref.id, rev, restrito: novo ? up.restrito : !!d.restrito }, p => $('#d-prog').textContent = `Enviando… ${Math.round(p * 100)}%`);
        /* fica pendente: só vira a revisão atual quando o aprovador der o OK */
        up.pend = { rev, data: dr, motivo: mt || (novo ? 'Emissão inicial' : ''), por: MEU, aprovador: ap, arquivo: arq, em: agora };
        if (novo) Object.assign(up, { criadoEm: agora, criadoPor: MEU, elaborador: MEU, status: 'aprovacao', rev: null, hist: [], arquivo: null });
        const base = Object.assign({}, novo ? {} : d, up); delete base.id; Object.keys(base).forEach(k => base[k] === undefined && delete base[k]);
        await ref.set(base);
        toast(novo ? 'Documento enviado para aprovação de ' + ap + '.' : `${revTxt(rev)} enviada para aprovação de ${ap}.`, 'ok'); const dd = docBy(ref.id); if (dd && dd.pend && dd.pend.em === agora) detalhe(ref.id); else { ESPERA = ''; EMDET = ref.id; ABERTO = ref.id; if (dd) Object.assign(dd, base); detalhe(ref.id); }
      } catch (e) { console.error(e); toast('Não foi possível salvar. Verifique a conexão e tente de novo.', 'bad'); b.disabled = false; b.textContent = 'Tentar de novo'; }
    } else {
      try { await db.doc('docs/' + d.id).update(up);
        if (meta && up.restrito !== !!d.restrito) for (const h of (d.hist || [])) if (h.arquivo && h.arquivo.id) await db.doc('docfiles/' + h.arquivo.id).update({ restrito: up.restrito }).catch(() => {});
        toast('Dados atualizados.', 'ok'); Object.assign(docBy(d.id) || {}, up); detalhe(d.id); } catch (e) { toast('Não foi possível salvar.', 'bad'); }
    }
  };
}

/* ---------- lista mestra (Excel) ---------- */
function exportar(L) {
  const cab = ['Código', 'Título', 'Tipo', 'Processo', 'Área', 'Cliente / contrato', 'Revisão', 'Data da revisão', 'Próxima revisão', 'Situação', 'Responsável', 'Elaborado por', 'Aprovado por', 'Restrito', 'Arquivo', 'Palavras-chave'];
  const cel = v => `"${str(v).replace(/"/g, '""')}"`;
  const linhas = L.map(d => [d.codigo, d.titulo, d.tipo, d.procSigla, areaNome(d.areaId), d.cliente, revTxt(d.rev), fmtD(d.dataRev), d.validade ? fmtD(d.validade) : '', (STATUS[d.status] || [''])[0] + (d.pend ? ' (' + revTxt(d.pend.rev) + ' em aprovação)' : ''), d.responsavel, d.elaborador, str(d.aprovador) + (d.aprovadoEm ? ' em ' + fmtD(d.aprovadoEm) : ''), d.restrito ? 'Sim' : 'Não', (d.arquivo || {}).nome, (d.tags || []).join(', ')].map(cel).join(';'));
  const blob = new Blob(['﻿' + [cab.map(cel).join(';')].concat(linhas).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Lista mestra de documentos ${hoje()}.csv`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const dl = e.target.closest('[data-dl]'); if (dl) { e.stopPropagation(); const d = docBy(dl.dataset.dl); if (d) baixar(d.arquivo); return; }
  const o = e.target.closest('[data-open]'); if (o && !e.target.closest('.sheet')) { detalhe(o.dataset.open); return; }
  if (e.target.id === 'modal') fechar();
});

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; EDITA = ['admin', 'gestao', 'editor'].includes(F.papel); ADMIN = ((F.perfil || {}).papel || F.papel) === 'admin'; MEU = F.nome || '';
  if (/aprov/.test(location.hash)) V.tab = 'aprov';
  db.collection('usuarios').onSnapshot(s => { APROVS = [...new Set(s.docs.map(x => x.data()).filter(u => u.ativo !== false && (['admin', 'gestao', 'gerente'].includes(u.papel) || ((u.modulos || {}).documentos === 'editor'))).map(u => str(u.nome).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')); }, () => {});
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; } }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  ouvir(); render();
})();
