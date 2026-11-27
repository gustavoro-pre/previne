/* Módulo Propostas: cadastro de clientes, propostas técnica + comercial (HH ou preço global), itens internos de custo,
   "abrir custos", anexos do cliente e cotações recebidas, numeração do sistema e geração dos DOCX no modelo Previne. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const s = str(v).trim(); if (!s) return 0; const x = parseFloat(/,/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s); return isFinite(x) ? x : 0; };
const brl = v => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = v => num(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const z2 = n => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); };
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3400); };
const kpi = (t, n, k, s, at) => `<button class="kpi ${k || ''}" ${at || ''} style="text-align:left;cursor:pointer;font:inherit"><div class="n">${n}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</button>`;

const STATUS = { rascunho: 'Em elaboração', revisao: 'Em revisão', enviada: 'Enviada', ganha: 'Ganha', perdida: 'Perdida', cancelada: 'Cancelada' };
const stBadge = s => `<span class="badge st-${esc(s || 'rascunho')}">${esc(STATUS[s] || STATUS.rascunho)}</span>`;
const LISTAS_T = [['incluidas', 'Atividades incluídas'], ['excluidas', 'Atividades não incluídas (exclusões)'], ['premissas', 'Premissas'], ['fornPrevine', 'Fornecimento da PREVINE'], ['fornCliente', 'Fornecimento da CONTRATANTE'], ['ssma', 'Segurança, saúde e meio ambiente (além das NRs)'], ['entregaveis', 'Entregáveis']];
const PADRAO_T = { fornPrevine: ['Mão de obra qualificada e treinada nas NRs aplicáveis, com uniforme e EPIs adequados.', 'Ferramental e equipamentos em perfeitas condições.'], fornCliente: ['Liberação da área e das permissões de trabalho.'], ssma: ['Análise de risco (APR) e permissão de trabalho emitidas antes do início de cada atividade.', 'Destinação dos resíduos gerados conforme a política ambiental do cliente e da PREVINE; a área é entregue limpa.'], entregaveis: ['Relatório técnico do serviço com registro fotográfico.'] };
/* tabelas editáveis: [chave, título, colunas [campo, rótulo, tipo, largura]] */
const TAB_T = {
  materiais: ['Lista de materiais', [['desc', 'Descrição do material', 't', 60], ['un', 'Unid.', 't', 12], ['qtd', 'Qtd.', 'n', 14]]],
  equipamentos: ['Lista de equipamentos e ferramentas', [['desc', 'Equipamento / ferramenta', 't', 60], ['qtd', 'Qtd.', 'n', 12], ['periodo', 'Período', 't', 18]]],
  equipe: ['Equipe', [['funcao', 'Função', 't', 55], ['qtd', 'Qtd.', 'n', 12], ['turno', 'Turno / jornada', 't', 25]]],
  cronograma: ['Cronograma', [['etapa', 'Etapa', 't', 70], ['dur', 'Duração', 't', 20]]],
  docsRef: ['Documentos de referência', [['doc', 'Documento', 't', 70], ['rev', 'Revisão / data', 't', 20]]]
};
const TAB_C = {
  mo: ['Mão de obra', [['desc', 'Função / serviço', 't', 46], ['un', 'Unid.', 't', 9], ['qtd', 'Qtd.', 'n', 11], ['unit', 'Unitário (R$)', 'n', 15]]],
  mat: ['Materiais', [['desc', 'Material', 't', 46], ['un', 'Unid.', 't', 9], ['qtd', 'Qtd.', 'n', 11], ['unit', 'Unitário (R$)', 'n', 15]]],
  eq: ['Equipamentos', [['desc', 'Equipamento', 't', 46], ['un', 'Unid.', 't', 9], ['qtd', 'Qtd.', 'n', 11], ['unit', 'Unitário (R$)', 'n', 15]]]
};
const TAB_HH = [['funcao', 'Função', 't', 34], ['normal', 'HH normal (R$)', 'n', 15], ['he50', 'HH extra 50%', 'n', 15], ['he100', 'HH extra 100%', 'n', 15], ['qtdEst', 'Horas estimadas', 'n', 13]];

const D = { cli: [], prop: [], cfg: {} };
const V = { tab: 'lista', busca: '', st: '', cli: '', ano: '', id: '', sec: 'id' };
let db = null, PAPEL = 'consulta', MEU = '';
const podeEditar = () => ['admin', 'gestao', 'comercial', 'tecnico'].includes(PAPEL);
const veCustos = () => ['admin', 'gestao', 'comercial'].includes(PAPEL);
const podeCli = () => ['admin', 'gestao', 'comercial'].includes(PAPEL);
const cliBy = id => D.cli.find(c => c.id === id);
let P = null, K = null, SUJO = false; /* proposta aberta, custos, alterações não salvas */

/* ---------- carga ---------- */
async function carregar() {
  const [c, p, g] = await Promise.all([db.collection('clientes').get(), db.collection('propostas').get(), db.doc('config/propostas').get().catch(() => null)]);
  D.cli = c.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  D.prop = p.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => str(b.codPT).localeCompare(str(a.codPT)));
  D.cfg = (g && g.exists) ? g.data() : {};
}
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  if (V.tab === 'lista') return V.id ? editor() : lista();
  if (V.tab === 'clientes') return clientes();
  if (V.tab === 'config') return config();
}
$('#seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (SUJO && !confirm('Há alterações não salvas na proposta. Sair mesmo assim?')) return; SUJO = false; V.tab = b.dataset.tab; V.id = ''; render(); };
window.addEventListener('prev-voltar', e => { if (V.id) { e.preventDefault(); if (SUJO && !confirm('Há alterações não salvas. Voltar mesmo assim?')) return; SUJO = false; V.id = ''; render(); } });
window.addEventListener('beforeunload', e => { if (SUJO) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- lista ---------- */
function totalDe(p) { return num(p.valorTotal); }
function lista() {
  const anos = [...new Set(D.prop.map(p => str(p.data).slice(0, 4)).filter(Boolean))].sort().reverse();
  const q = norm(V.busca);
  const L = D.prop.filter(p => (!V.st || (p.status || 'rascunho') === V.st) && (!V.cli || p.clienteId === V.cli) && (!V.ano || str(p.data).startsWith(V.ano))
    && (!q || [p.codPT, p.codPC, p.controle, p.rc, p.cliente, p.objeto, p.unidade, p.area].some(x => norm(x).includes(q))));
  const base = D.prop.filter(p => !V.ano || str(p.data).startsWith(V.ano));
  const cnt = s => base.filter(p => (p.status || 'rascunho') === s); const soma = A => A.reduce((a, p) => a + totalDe(p), 0);
  const g = cnt('ganha'), pd = cnt('perdida'), env = cnt('enviada'), el = base.filter(p => ['rascunho', 'revisao'].includes(p.status || 'rascunho'));
  $('#body').innerHTML = `<div class="head"><h2>Propostas</h2>${podeEditar() ? '<button class="btn primary" id="nova" type="button">+ Nova proposta</button>' : ''}</div>
    <div class="kpis">${kpi('Em elaboração', el.length, '', brl(soma(el)), 'data-kst="rascunho"')}${kpi('Enviadas (aguardando)', env.length, 'warn', brl(soma(env)), 'data-kst="enviada"')}${kpi('Ganhas', g.length, 'ok', brl(soma(g)), 'data-kst="ganha"')}${kpi('Perdidas', pd.length, 'bad', brl(soma(pd)), 'data-kst="perdida"')}${kpi('Taxa de conversão', g.length + pd.length ? Math.round(g.length / (g.length + pd.length) * 100) + '%' : '—', 'info', 'ganhas ÷ decididas', 'data-kst=""')}${kpi('Ticket médio (ganhas)', g.length ? brl(soma(g) / g.length) : '—', '', V.ano || 'todos os anos', 'data-kst="ganha"')}</div>
    <div class="card" style="margin-top:12px"><div class="grid3" style="grid-template-columns:2fr 1fr 1fr 1fr;gap:0 10px">
      <div><label>Buscar</label><input id="f-q" value="${esc(V.busca)}" placeholder="Código, cliente, objeto, RC…"></div>
      <div><label>Status</label><select id="f-st"><option value="">Todos</option>${Object.entries(STATUS).map(([k, t]) => `<option value="${k}" ${V.st === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Cliente</label><select id="f-cli"><option value="">Todos</option>${D.cli.map(c => `<option value="${c.id}" ${V.cli === c.id ? 'selected' : ''}>${esc(c.sigla || c.nome)}</option>`).join('')}</select></div>
      <div><label>Ano</label><select id="f-ano"><option value="">Todos</option>${anos.map(a => `<option ${V.ano === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div></div>
    ${L.length ? `<div class="card" style="padding:4px 12px">${L.map(p => `<button class="ritem lk" data-p="${p.id}" type="button"><div class="main"><b>${esc(p.codPT || '—')} / ${esc(p.codPC || '—')}</b> <span class="note">· Rev. ${esc(p.rev || '00')} · ${esc(p.controle || '')}</span><div class="note">${esc(p.cliente || 'Sem cliente')}${p.unidade ? ' · ' + esc(p.unidade) : ''}${p.area ? ' · ' + esc(p.area) : ''} — ${esc(p.objeto || 'sem objeto')}</div><div class="note">${fmtD(p.data)} · ${p.modalidade === 'hh' ? 'HH' : 'Preço global'}${p.rc ? ' · RC ' + esc(p.rc) : ''}${p.gestorCom && p.gestorCom.nome ? ' · ' + esc(p.gestorCom.nome) : ''}</div></div><div style="text-align:right">${stBadge(p.status)}<div style="font-weight:700;margin-top:4px">${totalDe(p) ? brl(totalDe(p)) : ''}</div></div></button>`).join('')}</div>` : '<div class="empty">Nenhuma proposta com esses filtros.</div>'}`;
  const nv = $('#nova'); if (nv) nv.onclick = () => novaProposta();
  $('#f-q').oninput = e => { V.busca = e.target.value; clearTimeout(lista.t); lista.t = setTimeout(() => { lista(); const i = $('#f-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $('#f-st').onchange = e => { V.st = e.target.value; lista(); }; $('#f-cli').onchange = e => { V.cli = e.target.value; lista(); }; $('#f-ano').onchange = e => { V.ano = e.target.value; lista(); };
  $$('[data-kst]').forEach(b => b.onclick = () => { V.st = b.dataset.kst; lista(); });
  $$('[data-p]').forEach(b => b.onclick = () => abrir(b.dataset.p));
}

/* ---------- numeração ---------- */
const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const aleat = n => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => ALF[x % ALF.length]).join('');
async function proximoNumero() {
  const ano = hoje().slice(0, 4); const ref = db.doc('config/propostas'); let n = 0;
  await db.runTransaction(async tx => { const s = await tx.get(ref); const d = s.exists ? s.data() : {}; const seq = Object.assign({}, d.seq || {}); n = num(seq[ano]) + 1; seq[ano] = n; tx.set(ref, { seq }, { merge: true }); });
  return { ano, n: String(n).padStart(3, '0') };
}
function controlePara(sigla) { const s = str(sigla).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PREV'; const usados = new Set(D.prop.map(p => p.controle)); let c; do c = s + '-' + aleat(6); while (usados.has(c)); return c; }

async function novaProposta() {
  if (!podeEditar()) return;
  const c = D.cfg; const pad = c.padroes || {};
  const p = { status: 'rascunho', rev: '00', data: hoje(), dataElab: hoje(), modalidade: 'global', abrirCustos: false, clienteId: '', cliente: '', unidade: '', area: '', contato: '', rc: '', objeto: '',
    gestorTec: { nome: '', contato: '' }, gestorCom: { nome: '', contato: '' }, validade: pad.validade || 30, pagamento: pad.pagamento || '45 dias após a aprovação da medição e a emissão da nota fiscal', faturamento: pad.faturamento || 'por medição mensal', lc116: pad.lc116 || '14.01', reajuste: '',
    tecnico: Object.assign({ objetivo: '', visita: '', prazo: '', nrs: 'NR-10', materiais: [], equipamentos: [], equipe: [], cronograma: [], docsRef: [] }, JSON.parse(JSON.stringify(PADRAO_T))), hh: [], anexos: { cliente: [], cotacoes: [] }, revisoes: [], hist: [] };
  try {
    const { ano, n } = await proximoNumero(); p.codPT = `PT-${ano}-${n}`; p.codPC = `PC-${ano}-${n}`; p.controle = controlePara('');
    p.criadoEm = new Date().toISOString(); p.criadoPor = MEU; p.hist = [{ em: p.criadoEm, por: MEU, txt: 'Proposta criada.' }];
    const ref = await db.collection('propostas').add(p); if (veCustos()) await db.doc('prop_custos/' + ref.id).set({ mo: [], mat: [], eq: [], bdi: 0 });
    D.prop.unshift(Object.assign({ id: ref.id }, p)); toast(`Proposta ${p.codPT} / ${p.codPC} criada.`, 'ok'); abrir(ref.id);
  } catch (e) { toast('Não foi possível criar: ' + (e.message || e), 'bad'); }
}

/* ---------- editor ---------- */
async function abrir(id) {
  const p = D.prop.find(x => x.id === id); if (!p) return;
  P = JSON.parse(JSON.stringify(p)); P.tecnico = P.tecnico || {}; P.anexos = P.anexos || { cliente: [], cotacoes: [] }; P.hh = P.hh || [];
  K = { mo: [], mat: [], eq: [], bdi: 0 };
  if (veCustos()) { try { const s = await db.doc('prop_custos/' + id).get(); if (s.exists) K = Object.assign(K, s.data()); } catch (e) { } }
  V.id = id; V.sec = V.sec || 'id'; SUJO = false; editor(); window.scrollTo(0, 0);
}
const ro = () => !podeEditar() || ['ganha', 'perdida', 'cancelada'].includes(P.status);
const inp = (k, v, o) => `<input data-k="${k}" value="${esc(v)}" ${o || ''} ${ro() ? 'disabled' : ''}>`;
const area = (k, v, ph) => `<textarea data-k="${k}" placeholder="${esc(ph || '')}" ${ro() ? 'disabled' : ''}>${esc(v)}</textarea>`;
function setK(path, val) { const ks = path.split('.'); let o = P; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] || {}; o[ks[ks.length - 1]] = val; SUJO = true; }
function getK(path) { return path.split('.').reduce((o, k) => o == null ? o : o[k], P); }

function tabEd(key, cols, rows, alvo) {
  const dis = (alvo === 'K' ? !veCustos() : false) || ro();
  return `<div class="tbwrap" style="margin:4px 0 0"><table class="tb it"><thead><tr><th>#</th>${cols.map(c => `<th style="width:${c[3]}%" class="${c[2] === 'n' ? 'n' : ''}">${c[1]}</th>`).join('')}${alvo === 'K' ? '<th class="n">Total</th>' : ''}<th class="x"></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="note">${i + 1}</td>${cols.map(c => `<td><input data-t="${alvo}|${key}|${i}|${c[0]}" value="${esc(c[2] === 'n' && r[c[0]] !== '' && r[c[0]] != null ? fmtN(r[c[0]]) : r[c[0]])}" ${c[2] === 'n' ? 'inputmode="decimal" style="text-align:right"' : ''} ${dis ? 'disabled' : ''}></td>`).join('')}${alvo === 'K' ? `<td class="n" data-tot="${key}|${i}">${brl(num(r.qtd) * num(r.unit))}</td>` : ''}<td>${dis ? '' : `<button class="link" data-del="${alvo}|${key}|${i}" type="button" title="Remover">✕</button>`}</td></tr>`).join('')}
    </tbody></table></div>${dis ? '' : `<button class="btn sm ghost" data-add="${alvo}|${key}" type="button" style="margin-top:6px">+ linha</button>`}`;
}
function totaisK() { return PropDoc.totais(P, K); }
function secId() {
  const c = cliBy(P.clienteId) || {}; const un = (c.unidades || []); const uSel = un.find(u => u.nome === P.unidade) || {};
  const gest = (D.cfg.gestores || []);
  return `<div class="card"><p class="ct">Identificação</p>
    <div class="grid3"><div><label>Código técnico</label><input value="${esc(P.codPT)}" disabled></div><div><label>Código comercial</label><input value="${esc(P.codPC)}" disabled></div><div><label>Controle Previne</label><input value="${esc(P.controle)}" disabled></div></div>
    <div class="grid2"><div><label>Cliente</label><select data-k="clienteId" ${ro() ? 'disabled' : ''}><option value="">— escolha —</option>${D.cli.map(x => `<option value="${x.id}" ${x.id === P.clienteId ? 'selected' : ''}>${esc(x.nome)}${x.sigla ? ' (' + esc(x.sigla) + ')' : ''}</option>`).join('')}</select><p class="hint">${podeCli() ? 'Não está na lista? Cadastre em <a href="#" id="go-cli">Clientes</a>.' : ''}</p></div>
      <div><label>Ref. do cliente (RC / solicitação)</label>${inp('rc', P.rc)}</div></div>
    <div class="grid3"><div><label>Unidade</label><input data-k="unidade" list="dl-un" value="${esc(P.unidade)}" ${ro() ? 'disabled' : ''}><datalist id="dl-un">${un.map(u => `<option value="${esc(u.nome)}">`).join('')}</datalist></div>
      <div><label>Área</label><input data-k="area" list="dl-ar" value="${esc(P.area)}" ${ro() ? 'disabled' : ''}><datalist id="dl-ar">${(uSel.areas || un.flatMap(u => u.areas || [])).map(a => `<option value="${esc(a)}">`).join('')}</datalist></div>
      <div><label>Contato no cliente (A/C)</label><input data-k="contato" list="dl-ct" value="${esc(P.contato)}" ${ro() ? 'disabled' : ''}><datalist id="dl-ct">${(c.contatos || []).map(x => `<option value="${esc(x.nome)}">${esc([x.cargo, x.area].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div></div>
    <label>Objeto (o que será feito)</label>${inp('objeto', P.objeto, 'placeholder="Ex.: manutenção do sistema de controle de acesso em portão da Aciaria"')}
    <div class="grid3"><div><label>Data da proposta</label>${inp('data', P.data, 'type="date"')}</div><div><label>Revisão</label><input value="${esc(P.rev || '00')}" disabled></div><div><label>Status</label><div style="padding-top:8px">${stBadge(P.status)}</div></div></div>
    <p class="lbl" style="margin-top:14px">Modalidade de preço</p>
    <div class="pill" id="mod"><button type="button" data-mod="global" class="${P.modalidade !== 'hh' ? 'on' : ''}" ${ro() ? 'disabled' : ''}>Preço global (só totais)</button><button type="button" data-mod="hh" class="${P.modalidade === 'hh' ? 'on' : ''}" ${ro() ? 'disabled' : ''}>Homem-hora (HH, item a item)</button></div>
    <p class="hint">Preço global: na proposta comercial aparecem só os totais de mão de obra, materiais e equipamentos. HH: aparece o preço de cada função.</p>
    <div class="grid2" style="margin-top:6px"><div><label>Gestor técnico</label><input data-k="gestorTec.nome" list="dl-g" value="${esc(P.gestorTec && P.gestorTec.nome)}" ${ro() ? 'disabled' : ''}><input data-k="gestorTec.contato" value="${esc(P.gestorTec && P.gestorTec.contato)}" placeholder="telefone / e-mail" style="margin-top:6px" ${ro() ? 'disabled' : ''}></div>
      <div><label>Gestor comercial</label><input data-k="gestorCom.nome" list="dl-g" value="${esc(P.gestorCom && P.gestorCom.nome)}" ${ro() ? 'disabled' : ''}><input data-k="gestorCom.contato" value="${esc(P.gestorCom && P.gestorCom.contato)}" placeholder="telefone / e-mail" style="margin-top:6px" ${ro() ? 'disabled' : ''}></div></div>
    <datalist id="dl-g">${gest.map(g => `<option value="${esc(g.nome)}">${esc(g.contato || '')}</option>`).join('')}</datalist></div>`;
}
function secTec() {
  const T = P.tecnico;
  return `<div class="card"><p class="ct">Escopo</p><label>Objetivo</label>${area('tecnico.objetivo', T.objetivo, 'O que será feito, onde e com qual resultado esperado.')}
    ${LISTAS_T.map(([k, t]) => `<label>${t} <span class="note">(um item por linha)</span></label><textarea data-lst="${k}" ${ro() ? 'disabled' : ''}>${esc((T[k] || []).join('\n'))}</textarea>`).join('')}
    <div class="grid3"><div><label>Normas aplicáveis (NRs)</label>${inp('tecnico.nrs', T.nrs, 'placeholder="NR-10, NR-35…"')}</div><div><label>Prazo de execução</label>${inp('tecnico.prazo', T.prazo, 'placeholder="Ex.: 5 dias úteis"')}</div><div><label>Visita técnica</label>${inp('tecnico.visita', T.visita, 'placeholder="Data ou Não realizada"')}</div></div></div>
    ${Object.entries(TAB_T).map(([k, [t, cols]]) => `<div class="card"><p class="ct">${t}</p>${tabEd(k, cols, T[k] || [], 'T')}${k === 'materiais' && veCustos() && !ro() ? '<button class="btn sm ghost" id="mat2k" type="button" style="margin-top:6px">Copiar para os custos de materiais</button>' : ''}</div>`).join('')}`;
}
function secPreco() {
  const t = totaisK(); const hh = P.modalidade === 'hh';
  let h = '';
  if (hh) h += `<div class="card"><p class="ct">Preços por homem-hora (aparecem na proposta)</p>${tabEd('hh', TAB_HH, P.hh || [], 'H')}<label>Observação sobre o HH (opcional)</label>${area('hhNota', P.hhNota, 'Ex.: valores para jornada de 44 h semanais; adicional noturno de 20% sobre o HH normal.')}</div>`;
  if (!veCustos()) return h + '<div class="card"><p class="note">Os custos internos só aparecem para o perfil Comercial.</p></div>';
  h += `<div class="card"><p class="ct">Custos internos ${hh ? '(estimativa)' : ''}</p><p class="cs">Itens lançados aqui não aparecem na proposta, a menos que "abrir custos" esteja marcado. Só o perfil Comercial vê esta parte.</p>
    ${Object.entries(TAB_C).map(([k, [tt, cols]]) => `<p class="lbl" style="margin-top:12px">${tt}</p>${tabEd(k, cols, K[k] || [], 'K')}`).join('')}
    <div class="grid3" style="margin-top:12px"><div><label>BDI / margem sobre os itens (%)</label><input id="bdi" inputmode="decimal" value="${esc(fmtN(K.bdi))}" ${ro() ? 'disabled' : ''}></div><div></div><div></div></div>
    <label class="chk"><input type="checkbox" id="abrir" ${P.abrirCustos ? 'checked' : ''} ${ro() || hh ? 'disabled' : ''}> Abrir custos na proposta comercial (mostra item a item)</label>
    <div class="tot" id="tots">${totHtml(t)}</div></div>`;
  return h;
}
const totHtml = t => `<div>Mão de obra<b>${brl(t.mo)}</b></div><div>Materiais<b>${brl(t.mat)}</b></div><div>Equipamentos<b>${brl(t.eq)}</b></div><div style="border-color:var(--ink)">Total da proposta<b>${brl(t.total)}</b></div>`;
function secCond() {
  return `<div class="card"><p class="ct">Condições comerciais</p>
    <div class="grid3"><div><label>Validade (dias)</label>${inp('validade', P.validade, 'inputmode="numeric"')}</div><div><label>Item da LC 116/2003</label>${inp('lc116', P.lc116)}</div><div><label>Reajuste (se houver)</label>${inp('reajuste', P.reajuste, 'placeholder="Ex.: IPCA a cada 12 meses"')}</div></div>
    <label>Condição de pagamento</label>${inp('pagamento', P.pagamento)}<label>Faturamento</label>${inp('faturamento', P.faturamento)}
    <label>Outras condições <span class="note">(uma por linha)</span></label><textarea data-lstc="condExtra" ${ro() ? 'disabled' : ''}>${esc((P.condExtra || []).join('\n'))}</textarea></div>`;
}
function secAnx() {
  const A = P.anexos; const lin = (k, x, i) => `<div class="anx"><span>📎</span><div class="main"><b>${esc(x.nome)}</b><div class="note">${esc([x.fornecedor, x.valor ? brl(x.valor) : '', x.obs, Math.round(num(x.bytes) / 1024) + ' KB', fmtD(x.em)].filter(Boolean).join(' · '))}</div></div><button class="btn sm ghost" data-ab="${k}|${i}" type="button">Baixar</button>${ro() ? '' : `<button class="link" data-ad="${k}|${i}" type="button" title="Remover">✕</button>`}</div>`;
  return `<div class="card"><p class="ct">Documentos enviados pelo cliente</p><p class="cs">Especificação, desenhos, solicitação, e-mails. Entram na lista de documentos de referência da proposta técnica.</p>
      ${(A.cliente || []).map((x, i) => lin('cliente', x, i)).join('') || '<p class="note">Nenhum.</p>'}
      ${ro() ? '' : '<label class="btn sm" style="display:inline-block;margin-top:8px;cursor:pointer">+ Anexar documento do cliente<input type="file" id="up-cli" multiple hidden></label>'}</div>
    <div class="card"><p class="ct">Cotações recebidas (fornecedores)</p><p class="cs">Base dos custos de materiais e equipamentos. Ficam só no portal, não vão para o cliente.</p>
      ${(A.cotacoes || []).map((x, i) => lin('cotacoes', x, i)).join('') || '<p class="note">Nenhuma.</p>'}
      ${ro() ? '' : `<div class="grid3" style="margin-top:8px"><div><label>Fornecedor</label><input id="ct-forn"></div><div><label>Valor cotado (R$)</label><input id="ct-val" inputmode="decimal"></div><div><label>&nbsp;</label><label class="btn sm" style="display:block;text-align:center;cursor:pointer;margin:0">+ Anexar cotação<input type="file" id="up-cot" multiple hidden></label></div></div>`}</div>`;
}
function secHist() {
  return `<div class="card"><p class="ct">Revisões</p>${(P.revisoes || []).length ? `<div class="tbwrap"><table class="tb"><thead><tr><th>Rev.</th><th>Data</th><th>Motivo</th></tr></thead><tbody>${P.revisoes.map(r => `<tr><td>${esc(r.rev)}</td><td>${fmtD(r.data)}</td><td>${esc(r.txt)}</td></tr>`).join('')}<tr><td><b>${esc(P.rev)}</b></td><td>${fmtD(P.data)}</td><td>${esc(P.revMotivo || 'Atual')}</td></tr></tbody></table></div>` : '<p class="note">Revisão 00 (emissão inicial).</p>'}</div>
    <div class="card"><p class="ct">Histórico</p>${(P.hist || []).slice().reverse().map(h => `<div class="anx"><div class="main">${esc(h.txt)}<div class="note">${esc(h.por || '')} · ${new Date(h.em).toLocaleString('pt-BR')}</div></div></div>`).join('') || '<p class="note">—</p>'}</div>`;
}
const SECS = [['id', 'Identificação'], ['tec', 'Proposta técnica'], ['preco', 'Preço'], ['cond', 'Condições'], ['anx', 'Anexos'], ['hist', 'Histórico']];
function editor() {
  if (!P) return lista(); const t = totaisK();
  $('#body').innerHTML = `<div class="ed-bar"><button class="btn sm ghost" id="ed-back" type="button">‹ Propostas</button><div class="tit">${esc(P.codPT)} / ${esc(P.codPC)} · Rev. ${esc(P.rev || '00')} ${stBadge(P.status)}<div class="note" style="font-weight:400">${esc(P.cliente || 'sem cliente')} — ${esc(P.objeto || 'sem objeto')}${veCustos() ? ' · <b>' + brl(t.total) + '</b>' : ''}</div></div>
      ${ro() ? '' : '<button class="btn primary sm" id="ed-save" type="button">Salvar</button>'}<button class="btn sm" id="ed-pt" type="button">Gerar técnica (Word)</button><button class="btn sm" id="ed-pc" type="button">Gerar comercial (Word)</button>${podeEditar() ? '<button class="btn sm ghost" id="ed-st" type="button">Status…</button>' : ''}</div>
    <div class="seg" id="ed-seg" style="background:#e9ecf1">${SECS.map(([k, n]) => `<button data-sec="${k}" class="${V.sec === k ? 'on' : ''}" type="button">${n}</button>`).join('')}</div>
    <div id="ed-body">${({ id: secId, tec: secTec, preco: secPreco, cond: secCond, anx: secAnx, hist: secHist })[V.sec]()}</div>`;
  ligaEditor();
}
function ligaEditor() {
  $('#ed-back').onclick = () => { if (SUJO && !confirm('Há alterações não salvas. Voltar mesmo assim?')) return; SUJO = false; V.id = ''; P = null; lista(); };
  $$('#ed-seg [data-sec]').forEach(b => b.onclick = () => { V.sec = b.dataset.sec; editor(); });
  const sv = $('#ed-save'); if (sv) sv.onclick = () => salvar();
  $('#ed-pt').onclick = () => gerar('tec'); $('#ed-pc').onclick = () => gerar('com');
  const st = $('#ed-st'); if (st) st.onclick = () => mStatus();
  const B = $('#ed-body');
  B.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
    const k = el.dataset.k; setK(k, el.value);
    if (k === 'clienteId') { const c = cliBy(el.value) || {}; P.cliente = c.nome || ''; if (c.sigla && (!P.controle || /^PREV-/.test(P.controle))) P.controle = controlePara(c.sigla); editor(); }
  }));
  B.querySelectorAll('[data-lst]').forEach(el => el.oninput = () => { P.tecnico[el.dataset.lst] = el.value.split('\n').map(s => s.trim()).filter(Boolean); SUJO = true; });
  B.querySelectorAll('[data-lstc]').forEach(el => el.oninput = () => { P[el.dataset.lstc] = el.value.split('\n').map(s => s.trim()).filter(Boolean); SUJO = true; });
  const alvo = a => a === 'K' ? K : a === 'H' ? P : P.tecnico;
  const nCols = { ...Object.fromEntries(Object.entries(TAB_T).map(([k, v]) => [k, v[1]])), ...Object.fromEntries(Object.entries(TAB_C).map(([k, v]) => [k, v[1]])), hh: TAB_HH };
  B.querySelectorAll('[data-t]').forEach(el => el.oninput = () => {
    const [a, key, i, f] = el.dataset.t.split('|'); const col = nCols[key].find(c => c[0] === f); const o = alvo(a); o[key] = o[key] || [];
    o[key][+i][f] = col[2] === 'n' ? (el.value.trim() === '' ? '' : num(el.value)) : el.value; SUJO = true;
    if (a === 'K') { const r = o[key][+i]; const td = B.querySelector(`[data-tot="${key}|${i}"]`); if (td) td.textContent = brl(num(r.qtd) * num(r.unit)); const tt = $('#tots'); if (tt) tt.innerHTML = totHtml(totaisK()); }
  });
  B.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const [a, key] = b.dataset.add.split('|'); const o = alvo(a); (o[key] = o[key] || []).push({}); SUJO = true; editor(); });
  B.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const [a, key, i] = b.dataset.del.split('|'); alvo(a)[key].splice(+i, 1); SUJO = true; editor(); });
  B.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { if (ro()) return; P.modalidade = b.dataset.mod; if (P.modalidade === 'hh') P.abrirCustos = false; SUJO = true; editor(); });
  const bdi = $('#bdi'); if (bdi) bdi.oninput = () => { K.bdi = num(bdi.value); SUJO = true; $('#tots').innerHTML = totHtml(totaisK()); };
  const ab = $('#abrir'); if (ab) ab.onchange = () => { P.abrirCustos = ab.checked; SUJO = true; };
  const m2k = $('#mat2k'); if (m2k) m2k.onclick = () => { const have = new Set((K.mat || []).map(x => norm(x.desc))); (P.tecnico.materiais || []).filter(x => str(x.desc).trim() && !have.has(norm(x.desc))).forEach(x => (K.mat = K.mat || []).push({ desc: x.desc, un: x.un || 'un', qtd: x.qtd, unit: '' })); SUJO = true; V.sec = 'preco'; editor(); toast('Materiais copiados: preencha o preço unitário.', 'ok'); };
  const gc = $('#go-cli'); if (gc) gc.onclick = e => { e.preventDefault(); mCliente(null); };
  const uc = $('#up-cli'); if (uc) uc.onchange = () => anexar('cliente', [...uc.files]);
  const ut = $('#up-cot'); if (ut) ut.onchange = () => anexar('cotacoes', [...ut.files], { fornecedor: $('#ct-forn').value.trim(), valor: num($('#ct-val').value) });
  B.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.ab.split('|'); baixarAnexo(P.anexos[k][+i]); });
  B.querySelectorAll('[data-ad]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.ad.split('|'); if (!confirm('Remover este anexo da proposta?')) return; P.anexos[k].splice(+i, 1); SUJO = true; editor(); });
}
async function salvar(msg) {
  if (ro() && !msg) return true; const b = $('#ed-save'); if (b) { b.disabled = true; b.textContent = 'Salvando…'; }
  try {
    const t = totaisK(); P.valorTotal = P.modalidade === 'hh' ? (t.hhEst || t.total) : t.total;
    if (veCustos() || P.modalidade === 'hh') P.valorTotal = Math.round(num(P.valorTotal) * 100) / 100; else delete P.valorTotal;
    /* documentos do cliente entram como referência na técnica */
    const refs = (P.tecnico.docsRef || []); (P.anexos.cliente || []).forEach(a => { if (!refs.some(r => norm(r.doc) === norm(a.nome))) refs.push({ doc: a.nome, rev: fmtD(str(a.em).slice(0, 10)) }); }); P.tecnico.docsRef = refs;
    P.hist = (P.hist || []).concat([{ em: new Date().toISOString(), por: MEU, txt: msg || 'Proposta salva.' }]).slice(-80);
    P.atualizadoEm = new Date().toISOString(); P.atualizadoPor = MEU;
    const d = JSON.parse(JSON.stringify(P)); delete d.id; await db.doc('propostas/' + V.id).set(d);
    if (veCustos()) await db.doc('prop_custos/' + V.id).set(JSON.parse(JSON.stringify(K)));
    const i = D.prop.findIndex(x => x.id === V.id); D.prop[i] = Object.assign({ id: V.id }, d); SUJO = false;
    if (!msg) toast('Proposta salva.', 'ok'); editor(); return true;
  } catch (e) { toast('Não foi possível salvar: ' + (e.message || e), 'bad'); if (b) { b.disabled = false; b.textContent = 'Salvar'; } return false; }
}

/* ---------- geração dos documentos ---------- */
let LOGO = null;
async function logoBytes() { if (LOGO) return LOGO; try { LOGO = new Uint8Array(await (await fetch('../logo.png')).arrayBuffer()); } catch (e) { LOGO = null; } return LOGO; }
async function gerar(tipo) {
  if (!P.clienteId || !str(P.objeto).trim()) { V.sec = 'id'; editor(); return toast('Preencha o cliente e o objeto antes de gerar.', 'bad'); }
  if (SUJO && !ro()) { if (!(await salvar('Proposta salva antes de gerar o documento.'))) return; }
  if (!window.docx || !window.PropDoc) return toast('Gerador ainda carregando. Tente de novo em instantes.', 'bad');
  if (tipo === 'com' && !veCustos() && P.modalidade !== 'hh') return toast('A proposta comercial de preço global só pode ser gerada pelo perfil Comercial (usa os custos internos).', 'bad');
  const btn = $(tipo === 'tec' ? '#ed-pt' : '#ed-pc'); const t0 = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    const cfg = D.cfg.docs || {}; const blob = await PropDoc.gerar(P, tipo, { custos: K, logo: await logoBytes(), cfg: { elab: cfg.elab || 'Gustavo Rogel de Almeida', verif: cfg.verif || 'Thiago Rogel de Almeida', aprov: cfg.aprov || 'Cláudio José de Almeida', assinante: cfg.assinante, assinanteCargo: cfg.assinanteCargo, assinanteTel: cfg.assinanteTel } });
    const nome = `${tipo === 'tec' ? P.codPT : P.codPC} - ${tipo === 'tec' ? 'PROPOSTA TÉCNICA' : 'PROPOSTA COMERCIAL'} - ${(cliBy(P.clienteId) || {}).sigla || P.cliente} - Rev${P.rev || '00'}.docx`.replace(/[\\/:*?"<>|]+/g, ' ');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast('Documento gerado: ' + nome, 'ok');
  } catch (e) { console.error(e); toast('Não foi possível gerar: ' + (e.message || e), 'bad'); }
  btn.disabled = false; btn.textContent = t0;
}

/* ---------- status e revisão ---------- */
function modal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; $('#modal').onclick = e => { if (e.target.id === 'modal') fecha(); }; }
const fecha = () => { $('#modal').hidden = true; };
function mStatus() {
  modal(`<div class="top"><h2>Status da proposta</h2><button class="btn sm ghost" type="button" id="mx">Fechar</button></div>
    <div class="card"><div class="grid2">${Object.entries(STATUS).map(([k, t]) => `<button class="btn ${P.status === k ? 'primary' : 'ghost'}" data-ns="${k}" type="button" style="margin:4px 0">${t}</button>`).join('')}</div>
    <label>Observação (motivo da perda, data de envio, número do pedido…)</label><input id="ns-obs"></div>
    <div class="card"><p class="ct">Nova revisão</p><p class="cs">Use quando o cliente pedir mudança depois do envio. A revisão sobe de ${esc(P.rev || '00')} para ${z2(num(P.rev) + 1)}, os códigos continuam e o motivo entra no histórico de revisões dos dois documentos.</p>
      <label>Motivo da revisão</label><input id="rv-mot" placeholder="Ex.: inclusão de pintura do portão a pedido do cliente"><button class="btn" id="rv-ok" type="button" style="margin-top:8px">Criar revisão ${z2(num(P.rev) + 1)}</button></div>`);
  $('#mx').onclick = fecha;
  $$('[data-ns]').forEach(b => b.onclick = async () => { const ns = b.dataset.ns, obs = $('#ns-obs').value.trim(); const ant = P.status; P.status = ns; if (ns === 'enviada' && !P.enviadaEm) P.enviadaEm = hoje(); if (['ganha', 'perdida'].includes(ns)) P.decididaEm = hoje(); if (ns === 'perdida') P.motivoPerda = obs; fecha(); if (!(await salvar(`Status: ${STATUS[ant] || ant} → ${STATUS[ns]}${obs ? ' (' + obs + ')' : ''}.`))) P.status = ant; else toast('Status alterado para ' + STATUS[ns] + '.', 'ok'); });
  $('#rv-ok').onclick = async () => { const m = $('#rv-mot').value.trim(); if (!m) return toast('Escreva o motivo da revisão.', 'bad'); P.revisoes = (P.revisoes || []).concat([{ rev: P.rev || '00', data: P.data, txt: P.revMotivo || (P.rev === '00' || !P.rev ? 'Emissão inicial.' : 'Revisão.') }]); P.rev = z2(num(P.rev) + 1); P.revMotivo = m; P.data = hoje(); P.status = 'revisao'; fecha(); await salvar(`Revisão ${P.rev}: ${m}`); };
}

/* ---------- anexos (guardados no Firestore em partes) ---------- */
const PARTE = 700000;
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function anexar(tipo, files, extra) {
  if (!files.length) return; const max = 15 * 1024 * 1024;
  for (const f of files) {
    if (f.size > max) { toast(`${f.name}: maior que 15 MB.`, 'bad'); continue; }
    toast(`Enviando ${f.name}…`);
    try {
      const d = b64(new Uint8Array(await f.arrayBuffer())); const partes = Math.ceil(d.length / PARTE); const ref = db.collection('prop_arq').doc();
      for (let i = 0; i < partes; i++) await db.doc(`prop_arq/${ref.id}/p/${i}`).set({ i, d: d.slice(i * PARTE, (i + 1) * PARTE) });
      await ref.set({ nome: f.name, tipo: f.type || 'application/octet-stream', bytes: f.size, partes, propostaId: V.id, em: new Date().toISOString(), por: MEU });
      P.anexos[tipo] = (P.anexos[tipo] || []).concat([Object.assign({ id: ref.id, nome: f.name, tipo: f.type, bytes: f.size, em: new Date().toISOString() }, extra || {})]);
    } catch (e) { toast(`Não foi possível enviar ${f.name}: ${e.message || e}`, 'bad'); }
  }
  await salvar(tipo === 'cliente' ? 'Documento do cliente anexado.' : 'Cotação anexada.'); toast('Anexo salvo.', 'ok');
}
async function baixarAnexo(x) {
  try { const m = await db.doc('prop_arq/' + x.id).get(); if (!m.exists) throw new Error('arquivo não encontrado'); let d = '';
    for (let i = 0; i < num(m.data().partes); i++) d += (await db.doc(`prop_arq/${x.id}/p/${i}`).get()).data().d;
    const bin = atob(d); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: m.data().tipo })); a.download = x.nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  } catch (e) { toast('Não foi possível baixar: ' + (e.message || e), 'bad'); }
}

/* ---------- clientes ---------- */
function clientes() {
  const q = norm(V.buscaCli || ''); const L = D.cli.filter(c => !q || [c.nome, c.sigla, c.cnpj, c.cidade].some(x => norm(x).includes(q)));
  $('#body').innerHTML = `<div class="head"><h2>Clientes</h2>${podeCli() ? '<button class="btn primary" id="cl-novo" type="button">+ Novo cliente</button>' : ''}</div>
    <div class="card"><input id="cl-q" placeholder="Buscar por nome, sigla, CNPJ ou cidade" value="${esc(V.buscaCli || '')}"></div>
    ${L.length ? `<div class="card" style="padding:4px 12px">${L.map(c => { const n = D.prop.filter(p => p.clienteId === c.id); const g = n.filter(p => p.status === 'ganha'); return `<button class="ritem lk" data-c="${c.id}" type="button"><div class="main"><b>${esc(c.nome)}</b> ${c.sigla ? `<span class="badge b-info">${esc(c.sigla)}</span>` : ''}<div class="note">${esc([c.cnpj, [c.cidade, c.uf].filter(Boolean).join('/'), (c.unidades || []).map(u => u.nome).join(', ')].filter(Boolean).join(' · '))}</div></div><div class="note" style="text-align:right">${n.length} propostas<br>${g.length} ganhas</div></button>`; }).join('')}</div>` : '<div class="empty">Nenhum cliente cadastrado ainda.</div>'}`;
  const nv = $('#cl-novo'); if (nv) nv.onclick = () => mCliente(null);
  $('#cl-q').oninput = e => { V.buscaCli = e.target.value; clearTimeout(clientes.t); clientes.t = setTimeout(() => { clientes(); const i = $('#cl-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $$('[data-c]').forEach(b => b.onclick = () => mCliente(cliBy(b.dataset.c)));
}
function mCliente(c) {
  const ed = podeCli(); c = c || { nome: '', sigla: '', cnpj: '', cidade: '', uf: '', segmento: '', unidades: [], contatos: [], obs: '' };
  const unTxt = (c.unidades || []).map(u => u.nome + (u.areas && u.areas.length ? ': ' + u.areas.join(', ') : '')).join('\n');
  const ctTxt = (c.contatos || []).map(x => [x.nome, x.cargo, x.email, x.tel, x.unidade, x.area].map(str).join(' ; ')).join('\n');
  const dis = ed ? '' : 'disabled';
  modal(`<div class="top"><h2>${c.id ? esc(c.nome) : 'Novo cliente'}</h2><button class="btn sm ghost" type="button" id="mx">Fechar</button></div>
    <div class="card"><div class="grid2"><div><label>Razão social / nome</label><input id="c-nome" value="${esc(c.nome)}" ${dis}></div><div><label>Sigla (usada no controle, ex.: AMSF)</label><input id="c-sig" value="${esc(c.sigla)}" maxlength="6" style="text-transform:uppercase" ${dis}></div></div>
      <div class="grid3"><div><label>CNPJ</label><input id="c-cnpj" value="${esc(c.cnpj)}" ${dis}></div><div><label>Cidade</label><input id="c-cid" value="${esc(c.cidade)}" ${dis}></div><div><label>UF</label><input id="c-uf" value="${esc(c.uf)}" maxlength="2" ${dis}></div></div>
      <label>Segmento</label><input id="c-seg" value="${esc(c.segmento)}" placeholder="Siderurgia, automotivo, mineração…" ${dis}>
      <label>Unidades e áreas <span class="note">(uma unidade por linha; áreas depois de dois-pontos, separadas por vírgula)</span></label><textarea id="c-un" placeholder="Resende: Aciaria, Laminação, Utilidades&#10;Barra Mansa: Trefilaria, Laminação" ${dis}>${esc(unTxt)}</textarea>
      <label>Contatos <span class="note">(um por linha: nome ; cargo ; e-mail ; telefone ; unidade ; área)</span></label><textarea id="c-ct" ${dis}>${esc(ctTxt)}</textarea>
      <label>Observações</label><textarea id="c-obs" ${dis}>${esc(c.obs)}</textarea>
      ${ed ? '<div class="actions" style="margin-top:10px"><button class="btn primary" id="c-ok" type="button">Salvar cliente</button></div>' : ''}</div>`);
  $('#mx').onclick = fecha; const ok = $('#c-ok'); if (!ok) return;
  ok.onclick = async () => {
    const d = { nome: $('#c-nome').value.trim(), sigla: $('#c-sig').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), cnpj: $('#c-cnpj').value.trim(), cidade: $('#c-cid').value.trim(), uf: $('#c-uf').value.trim().toUpperCase(), segmento: $('#c-seg').value.trim(), obs: $('#c-obs').value.trim(),
      unidades: $('#c-un').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, a] = l.split(':'); return { nome: n.trim(), areas: str(a).split(',').map(s => s.trim()).filter(Boolean) }; }),
      contatos: $('#c-ct').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(';').map(s => s.trim()); return { nome: p[0] || '', cargo: p[1] || '', email: p[2] || '', tel: p[3] || '', unidade: p[4] || '', area: p[5] || '' }; }) };
    if (!d.nome) return toast('Informe o nome do cliente.', 'bad'); if (!d.sigla) return toast('Informe a sigla (ex.: AMSF).', 'bad');
    if (D.cli.some(x => x.id !== c.id && x.sigla === d.sigla)) return toast('Já existe cliente com essa sigla.', 'bad');
    try { d.atualizadoEm = new Date().toISOString(); d.por = MEU; if (c.id) await db.doc('clientes/' + c.id).set(d); else { const r = await db.collection('clientes').add(d); c.id = r.id; }
      const i = D.cli.findIndex(x => x.id === c.id); if (i >= 0) D.cli[i] = Object.assign({ id: c.id }, d); else D.cli.push(Object.assign({ id: c.id }, d)); D.cli.sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
      fecha(); toast('Cliente salvo.', 'ok'); render();
    } catch (e) { toast('Não foi possível salvar: ' + (e.message || e), 'bad'); }
  };
}

/* ---------- configuração ---------- */
function config() {
  const c = D.cfg; const dc = c.docs || {}; const pd = c.padroes || {}; const ano = hoje().slice(0, 4); const ed = veCustos();
  const dis = ed ? '' : 'disabled';
  $('#body').innerHTML = `<div class="head"><h2>Configuração</h2></div>
    <div class="card"><p class="ct">Numeração</p><p class="cs">Cada proposta recebe um número do sistema: PT-${ano}-NNN (técnica) e PC-${ano}-NNN (comercial), mais um controle interno aleatório com a sigla do cliente.</p>
      <div class="grid3"><div><label>Última proposta de ${ano}</label><input id="cf-seq" inputmode="numeric" value="${esc(num((c.seq || {})[ano]))}" ${dis}></div><div></div><div></div></div><p class="hint">A próxima proposta criada recebe este número + 1.</p></div>
    <div class="card"><p class="ct">Quem assina os documentos comerciais</p><div class="grid3"><div><label>Elaborado por</label><input id="cf-el" value="${esc(dc.elab || 'Gustavo Rogel de Almeida')}" ${dis}></div><div><label>Verificado por</label><input id="cf-ve" value="${esc(dc.verif || 'Thiago Rogel de Almeida')}" ${dis}></div><div><label>Aprovado por</label><input id="cf-ap" value="${esc(dc.aprov || 'Cláudio José de Almeida')}" ${dis}></div></div>
      <div class="grid3"><div><label>Assina a carta</label><input id="cf-as" value="${esc(dc.assinante || 'Cláudio José de Almeida')}" ${dis}></div><div><label>Cargo</label><input id="cf-asc" value="${esc(dc.assinanteCargo || 'Sócio-Gerente')}" ${dis}></div><div><label>Telefone</label><input id="cf-ast" value="${esc(dc.assinanteTel || 'Cel.: (24) 98855-7269')}" ${dis}></div></div></div>
    <div class="card"><p class="ct">Gestores técnicos e comerciais</p><label>Um por linha: nome ; telefone / e-mail</label><textarea id="cf-g" ${dis}>${esc((c.gestores || []).map(g => g.nome + ' ; ' + str(g.contato)).join('\n'))}</textarea></div>
    <div class="card"><p class="ct">Padrões das condições comerciais</p><div class="grid3"><div><label>Validade (dias)</label><input id="cf-val" value="${esc(pd.validade || 30)}" ${dis}></div><div><label>Item LC 116</label><input id="cf-lc" value="${esc(pd.lc116 || '14.01')}" ${dis}></div><div></div></div>
      <label>Pagamento</label><input id="cf-pg" value="${esc(pd.pagamento || '45 dias após a aprovação da medição e a emissão da nota fiscal')}" ${dis}><label>Faturamento</label><input id="cf-ft" value="${esc(pd.faturamento || 'por medição mensal')}" ${dis}></div>
    ${ed ? '<div class="actions"><button class="btn primary" id="cf-ok" type="button">Salvar configuração</button></div>' : '<p class="note">Só o perfil Comercial altera a configuração.</p>'}`;
  const ok = $('#cf-ok'); if (!ok) return;
  ok.onclick = async () => {
    const seq = Object.assign({}, c.seq || {}); seq[ano] = Math.max(0, Math.round(num($('#cf-seq').value)));
    const d = { seq, docs: { elab: $('#cf-el').value.trim(), verif: $('#cf-ve').value.trim(), aprov: $('#cf-ap').value.trim(), assinante: $('#cf-as').value.trim(), assinanteCargo: $('#cf-asc').value.trim(), assinanteTel: $('#cf-ast').value.trim() },
      gestores: $('#cf-g').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, ct] = l.split(';'); return { nome: n.trim(), contato: str(ct).trim() }; }),
      padroes: { validade: num($('#cf-val').value) || 30, lc116: $('#cf-lc').value.trim(), pagamento: $('#cf-pg').value.trim(), faturamento: $('#cf-ft').value.trim() } };
    try { await db.doc('config/propostas').set(d, { merge: true }); Object.assign(D.cfg, d); toast('Configuração salva.', 'ok'); } catch (e) { toast('Não foi possível salvar: ' + (e.message || e), 'bad'); }
  };
}

/* ---------- início ---------- */
(async function init() {
  db = await claude.use('db');
  const F = window.__FB || {}; PAPEL = F.papel || 'consulta'; MEU = F.nome || '';
  try { await carregar(); } catch (e) { $('#body').innerHTML = '<div class="empty">Não foi possível carregar: ' + esc(e.message || e) + '</div>'; return; }
  if (!podeEditar()) $('#body').insertAdjacentHTML('beforebegin', '<div class="note" style="margin-bottom:8px">Seu perfil só consulta as propostas.</div>');
  render();
})();
