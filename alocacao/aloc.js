/* Módulo Alocação em OM: OM fixa de cada funcionário, programação de preventivas e demandas extras com horário e local,
   pendências de OM, deslocamentos, controle de apontamento por dia e relatório mensal por funcionário. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const hoje = () => ymd(new Date());
const addDays = (n, b) => { const d = b ? new Date(b + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const fmtD = s => { s = str(s).slice(0, 10); const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const dow = s => new Date(s + 'T12:00:00').getDay();
const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const minutos = h => { const m = /^(\d{1,2}):(\d{2})$/.exec(str(h)); return m ? +m[1] * 60 + +m[2] : null; };
const horas = (a, b) => { const x = minutos(a), y = minutos(b); if (x == null || y == null) return 0; let d = y - x; if (d < 0) d += 1440; return d / 60; };
const fmtH = h => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + (m % 60 ? z2(m % 60) : ''); };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;

const TIPOS = { preventiva: 'Preventiva', extra: 'Demanda extra', corretiva: 'Corretiva', spot: 'Obra spot', fixa: 'OM fixa', outro: 'Outro' };
const TIPO_COR = { preventiva: 'b-info', extra: 'b-warn', corretiva: 'b-bad', spot: 'b-mut', fixa: 'b-ok', outro: 'b-mut' };
const tipoBadge = t => `<span class="badge ${TIPO_COR[t] || 'b-mut'}">${esc(TIPOS[t] || t || '—')}</span>`;

const D = { func: [], areas: [], oms: [], fixa: {}, aloc: new Map(), apont: new Map(), pend: [], tt: [], trU: new Map() };
const V = { tab: 'dia', dia: hoje(), area: '', busca: '', so: '', dDe: hoje().slice(0, 8) + '01', dAte: hoje(), dTipo: 'preventiva', fMes: hoje().slice(0, 7), fId: '', omBusca: '' };
let db = null, PODE = false, MEU = '';
const JANELA = addDays(-75);
const carregados = new Set();

/* ---------- regras ---------- */
const ativos = () => D.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
const funcBy = id => D.func.find(f => f.id === id) || {};
const omBy = id => D.oms.find(o => o.id === id);
const omByNum = n => D.oms.find(o => norm(o.numero) === norm(n));
const areaNome = id => (D.areas.find(a => a.id === id) || {}).nome || '';
/* OM fixa da pessoa numa data (histórico: cada troca tem "desde") */
function fixaEm(fid, data) {
  const h = ((D.fixa[fid] || {}).hist || []).filter(x => str(x.desde) <= data).sort((a, b) => str(a.desde).localeCompare(str(b.desde)));
  const u = h[h.length - 1]; if (!u || !u.omId) return null; const om = omBy(u.omId); return om && om.ativo !== false ? om : null;
}
const fixaAtual = fid => fixaEm(fid, hoje());
const diasOm = om => Array.isArray(om.dias) && om.dias.length ? om.dias : [1, 2, 3, 4, 5];
/* o que a pessoa fez no dia: lançamentos do dia; se não houver, a OM fixa nos dias de trabalho dela */
function diaDe(fid, data) {
  const L = [...D.aloc.values()].filter(a => a.fid === fid && a.data === data).sort((a, b) => str(a.inicio).localeCompare(str(b.inicio)));
  if (L.length) return L;
  const om = fixaEm(fid, data);
  if (om && diasOm(om).includes(dow(data))) return [{ virtual: true, fid, data, tipo: 'fixa', omId: om.id, omNumero: om.numero, local: om.local, inicio: om.inicio || '07:00', fim: om.fim || '17:00' }];
  return [];
}
const apontado = (fid, data) => !!(D.apont.get(fid + '_' + data) || {}).apontado;
const semOm = a => !str(a.omNumero).trim();
const areaDe = f => f.areaId || '';
const filtraArea = (L, area) => !area ? L : L.filter(f => areaDe(f) === area || (fixaAtual(f.id) || {}).areaId === area);

/* ---------- aptidão: NRs obrigatórias da função (tipos de treinamento) e NR-35 para quem trabalha em altura ---------- */
const ehNR35 = t => /nr-?\s?35/i.test(str(t.norma) + ' ' + str(t.nome));
function inapto(f, data) {
  if (!f || !D.tt.length) return [];
  const req = D.tt.filter(t => t.ativo !== false && ((t.obrig || []).includes(str(f.funcao)) || (f.altura && ehNR35(t))));
  const out = []; req.forEach(t => { const v = D.trU.get(f.id + '|' + t.id); const nm = str(t.norma || t.nome);
    if (v === undefined) out.push(nm + ' não feita'); else if (v && v < data) out.push(nm + ' vencida em ' + fmtD(v)); });
  return out;
}
const aptoBadge = (f, data) => { const m = inapto(f, data); return m.length ? ` <span class="badge b-bad" title="${esc(m.join(' · '))}">Não apto: ${esc(m[0])}${m.length > 1 ? ' +' + (m.length - 1) : ''}</span>` : ''; };
async function carregarTrein() {
  try {
    const [t, r, x] = await Promise.all([db.collection('trein_tipos').get(), db.collection('treinamentos').get(), db.collection('trein_ext').get().catch(() => ({ docs: [] }))]);
    D.tt = t.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
    const m = new Map(); r.docs.concat(x.docs).forEach(d => { const a = d.data(); if (!a.funcionarioId || !a.tipoId) return; const k = a.funcionarioId + '|' + a.tipoId; const v = str(a.validade); const cur = m.get(k);
      if (cur === undefined || (cur && (!v || v > cur))) m.set(k, v); });
    D.trU = m; render();
  } catch (e) { /* sem permissão: não mostra aptidão */ }
}

/* ---------- dados ---------- */
function ouvir() {
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('areas').onSnapshot(s => { D.areas = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')); render(); }, () => {});
  db.collection('oms').onSnapshot(s => { D.oms = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).sort((a, b) => str(a.numero).localeCompare(str(b.numero), 'pt', { numeric: true })); render(); }, () => {});
  db.collection('om_fixa').onSnapshot(s => { D.fixa = {}; s.docs.forEach(d => D.fixa[d.id] = d.data()); render(); }, () => {});
  db.collection('alocacoes').where('data', '>=', JANELA).onSnapshot(s => {
    for (const [k, a] of D.aloc) if (a.data >= JANELA) D.aloc.delete(k);
    s.docs.forEach(d => { const x = Object.assign({}, d.data(), { id: d.id }); if (x.data >= JANELA) D.aloc.set(d.id, x); }); render();
  }, () => toast('Sem permissão para ver as alocações.', 'bad'));
  db.collection('alocacoes').where('semOm', '==', true).onSnapshot(s => { D.pend = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).filter(a => a.semOm === true); render(); }, () => {});
  db.collection('apontamentos').where('data', '>=', JANELA).onSnapshot(s => {
    for (const [k, a] of D.apont) if (a.data >= JANELA) D.apont.delete(k);
    s.docs.forEach(d => { const x = d.data(); if (x.data >= JANELA) D.apont.set(d.id, x); }); render();
  }, () => {});
}
/* períodos antigos (antes da janela ao vivo) são buscados quando alguém pede o relatório */
async function garantir(de, ate) {
  if (de >= JANELA) return; const k = de + '|' + ate; if (carregados.has(k)) return;
  const [a, p] = await Promise.all([db.collection('alocacoes').where('data', '>=', de).get(), db.collection('apontamentos').where('data', '>=', de).get()]);
  a.docs.forEach(d => { const x = Object.assign({}, d.data(), { id: d.id }); if (x.data >= de && x.data <= ate && x.data < JANELA) D.aloc.set(d.id, x); });
  p.docs.forEach(d => { const x = d.data(); if (x.data >= de && x.data <= ate && x.data < JANELA) D.apont.set(d.id, x); });
  carregados.add(k);
}

/* ---------- render ---------- */
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const pb = $('#seg [data-tab="pend"]'); const np = new Set(D.pend.map(a => a.lote || a.id)).size; pb.textContent = np ? `Pendências (${np})` : 'Pendências';
  const ae = document.activeElement; if (ae && ae.closest && ae.closest('#body') && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'checkbox') return;
  ({ dia: rDia, prog: rProg, pend: rPend, desl: rDesl, func: rFunc, oms: rOms, med: () => window.MED && window.MED.render() })[V.tab]();
}
const optAreas = sel => `<option value="">Todas as áreas</option>` + D.areas.map(a => `<option value="${esc(a.id)}" ${sel === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('');
function entHtml(a, clic) {
  const om = semOm(a) ? '<span class="badge b-bad">Sem OM</span>' : `<span class="om">OM ${esc(a.omNumero)}</span>`;
  const inner = `${om} · ${esc(a.local || '—')} · ${esc(a.inicio || '')}–${esc(a.fim || '')} ${a.virtual ? '<span class="badge b-ok">OM fixa</span>' : tipoBadge(a.tipo)}`;
  return clic && !a.virtual ? `<button data-edit="${esc(a.id)}" title="Editar">${inner}</button>` : `<span>${inner}</span>`;
}

/* Dia: o que cada um fez e o check de apontamento */
function rDia() {
  const d = V.dia; let P = filtraArea(ativos(), V.area);
  if (V.busca) { const q = norm(V.busca); P = P.filter(f => norm(f.nome).includes(q) || str(f.matricula).includes(q)); }
  const R = P.map(f => ({ f, E: diaDe(f.id, d), ap: apontado(f.id, d) }));
  const tot = { n: R.length, ap: R.filter(r => r.ap).length, sem: R.filter(r => !r.E.length).length, so: R.filter(r => r.E.some(semOm)).length, desl: R.filter(r => r.E.some(e => !e.virtual)).length, falta: R.filter(r => !r.ap && r.E.length).length };
  let L = R; if (V.so === 'nao') L = R.filter(r => !r.ap && r.E.length); else if (V.so === 'sem') L = R.filter(r => !r.E.length); else if (V.so === 'inapto') L = R.filter(r => r.E.length && inapto(r.f, d).length); else if (V.so === 'semom') L = R.filter(r => r.E.some(semOm)); else if (V.so === 'desl') L = R.filter(r => r.E.some(e => !e.virtual));
  $('#body').innerHTML = `<div class="top2"><div class="dnav"><button class="btn sm ghost" data-dd="-1" aria-label="Dia anterior">‹</button><input type="date" id="d-dia" value="${d}"><button class="btn sm ghost" data-dd="1" aria-label="Próximo dia">›</button></div>
      <span class="note">${DSEM[dow(d)]}</span><select id="d-area">${optAreas(V.area)}</select><input id="d-busca" placeholder="Buscar nome ou matrícula" value="${esc(V.busca)}" style="flex:1;min-width:160px"></div>
    <div class="kpis k5" style="margin-bottom:12px">${kpi('Pessoas', tot.n)}${kpi('Apontados', tot.ap, 'ok')}${kpi('Falta apontar', tot.falta, tot.falta ? 'warn' : '')}${kpi('Fora da OM fixa', tot.desl, 'info')}${kpi('Sem programação', tot.sem, tot.sem ? 'bad' : '')}</div>
    <div class="chips">${[['', 'Todos'], ['nao', 'Não apontados'], ['desl', 'Fora da OM fixa'], ['semom', 'Sem OM'], ['sem', 'Sem programação'], ['inapto', 'Não aptos']].map(([k, t]) => `<button class="chip ${V.so === k ? 'on' : ''}" data-so="${k}">${t}</button>`).join('')}
      ${PODE ? `<button class="btn sm ghost" id="d-all" style="margin-left:auto">Marcar visíveis como apontados</button>` : ''}</div>
    <div class="card">${L.length ? L.map(({ f, E, ap }) => `<div class="prow"><div class="main"><b>${esc(f.nome)}</b> <span class="t2">${esc(f.matricula || '')}${f.funcao ? ' · ' + esc(f.funcao) : ''}</span>${E.length ? aptoBadge(f, d) : ''}
        ${f.situacao && f.situacao !== 'Trabalhando' ? ` <span class="badge b-warn">${esc(f.situacao)}</span>` : ''}
        ${E.length ? E.map(e => `<div class="ent">${entHtml(e, PODE)}</div>`).join('') : `<div class="ent"><span class="badge b-mut">Sem programação</span>${PODE ? ` <button class="link" data-progp="${esc(f.id)}">Programar</button>` : ''}</div>`}</div>
        <label class="apt"><input type="checkbox" data-ap="${esc(f.id)}" ${ap ? 'checked' : ''} ${PODE ? '' : 'disabled'}>${ap ? 'Apontado' : 'Apontar'}</label></div>`).join('') : '<div class="empty">Ninguém nesta lista.</div>'}</div>
    <p class="note">Quem tem OM fixa aparece nela automaticamente nos dias de trabalho da OM. Um lançamento no dia (preventiva, demanda extra…) substitui a OM fixa naquele dia.</p>`;
  $('#d-dia').onchange = e => { if (e.target.value) { V.dia = e.target.value; garantir(V.dia, V.dia).then(render); } };
  $('#d-area').onchange = e => { V.area = e.target.value; render(); };
  const b = $('#d-busca'); b.oninput = () => { V.busca = b.value; clearTimeout(b._t); b._t = setTimeout(() => { const p = b.selectionStart; b.blur(); render(); const nb = $('#d-busca'); nb.focus(); nb.setSelectionRange(p, p); }, 350); };
  const all = $('#d-all'); if (all) { let armed = false; all.onclick = async () => { const alvo = L.filter(r => !r.ap && r.E.length); if (!alvo.length) return toast('Nada a marcar.'); if (!armed) { armed = true; all.textContent = `Confirmar ${alvo.length} apontamento(s)`; return; } await Promise.all(alvo.map(r => marcar(r.f.id, d, true))); toast(`${alvo.length} marcado(s) como apontado(s).`, 'ok'); }; }
}
async function marcar(fid, data, v) {
  const id = fid + '_' + data; const doc = { fid, data, apontado: v, por: MEU, em: new Date().toISOString() };
  D.apont.set(id, doc);
  try { await db.doc('apontamentos/' + id).set(doc); } catch (e) { toast('Não foi possível salvar o apontamento.', 'bad'); }
}

/* Programar: um lançamento para várias pessoas e vários dias */
const PG = { sel: new Set(), area: '', q: '' };
function rProg() {
  if (!PODE) { $('#body').innerHTML = '<div class="ro-banner">Seu perfil só consulta. Fale com o administrativo para programar.</div>'; return; }
  const locais = [...new Set(D.oms.map(o => o.local).concat([...D.aloc.values()].map(a => a.local)).filter(Boolean))].sort();
  $('#body').innerHTML = `<div class="card"><p class="ct">Programar alocação</p><p class="cs">Preventiva, demanda extra, corretiva ou obra spot. Local e horário são obrigatórios. Sem o número da OM, o lançamento vai para Pendências.</p>
    <div class="grid2"><div><label class="req" for="g-de">Data</label><input type="date" id="g-de" value="${addDays(1)}"></div><div><label for="g-ate">Até (vários dias)</label><input type="date" id="g-ate"></div></div>
    <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="g-fds"> Incluir sábados e domingos</label>
    <div class="grid3"><div><label class="req" for="g-ini">Entrada</label><input type="time" id="g-ini" value="07:00"></div><div><label class="req" for="g-fim">Saída</label><input type="time" id="g-fim" value="17:00"></div>
      <div><label for="g-tipo">Tipo</label><select id="g-tipo">${Object.entries(TIPOS).filter(([k]) => k !== 'fixa').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
    <label class="req" for="g-local">Local</label><input id="g-local" list="g-locais" placeholder="Ex.: Laminador de Resende"><datalist id="g-locais">${locais.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
    <div class="grid2"><div><label for="g-om">Número da OM</label><input id="g-om" list="g-oml" inputmode="numeric" placeholder="Deixe em branco se ainda não tem"><datalist id="g-oml">${D.oms.filter(o => o.ativo !== false).map(o => `<option value="${esc(o.numero)}">${esc(o.descricao || '')} · ${esc(o.local || '')}</option>`).join('')}</datalist></div>
      <div><label for="g-obs">Observação</label><input id="g-obs"></div></div>
    <p class="ct" style="margin-top:16px">Participantes <span class="badge b-info" id="g-n">${PG.sel.size}</span></p>
    <div class="top2" style="margin:6px 0 0"><select id="g-area">${optAreas(PG.area)}</select><input id="g-q" placeholder="Buscar nome ou matrícula" value="${esc(PG.q)}" style="flex:1;min-width:150px"><button class="link" id="g-limpa">Limpar</button></div>
    <div class="pick" id="g-pick"></div>
    <div id="g-conf"></div>
    <div class="actions"><button class="btn primary big" id="g-save">Salvar programação</button></div></div>`;
  pickRender();
  $('#g-area').onchange = e => { PG.area = e.target.value; pickRender(); };
  $('#g-q').oninput = e => { PG.q = e.target.value; pickRender(); };
  $('#g-limpa').onclick = () => { PG.sel.clear(); pickRender(); };
  $('#g-om').onchange = () => { const o = omByNum($('#g-om').value); if (o && !$('#g-local').value) $('#g-local').value = o.local || ''; };
  $('#g-save').onclick = salvarProg;
}
function pickRender() {
  let L = filtraArea(ativos(), PG.area); if (PG.q) { const q = norm(PG.q); L = L.filter(f => norm(f.nome).includes(q) || str(f.matricula).includes(q)); }
  L.sort((a, b) => PG.sel.has(b.id) - PG.sel.has(a.id) || str(a.nome).localeCompare(str(b.nome), 'pt'));
  $('#g-pick').innerHTML = L.length ? L.map(f => { const fx = fixaAtual(f.id); return `<label><input type="checkbox" data-pk="${esc(f.id)}" ${PG.sel.has(f.id) ? 'checked' : ''}><span class="main"><b>${esc(f.nome)}</b><div class="t2">${esc(f.matricula || '')} · ${esc(f.funcao || '')} · ${fx ? 'OM fixa ' + esc(fx.numero) : 'Volante / spot'}${f.situacao && f.situacao !== 'Trabalhando' ? ' · ' + esc(f.situacao) : ''}</div></span></label>`; }).join('') : '<div class="empty">Ninguém encontrado.</div>';
  $$('#g-pick [data-pk]').forEach(c => c.onchange = () => { c.checked ? PG.sel.add(c.dataset.pk) : PG.sel.delete(c.dataset.pk); $('#g-n').textContent = PG.sel.size; $('#g-conf').innerHTML = ''; });
  $('#g-n').textContent = PG.sel.size;
}
function diasEntre(de, ate, fds) { const L = []; let d = de; ate = ate && ate >= de ? ate : de; while (d <= ate && L.length < 62) { const w = dow(d); if (fds || de === ate || (w !== 0 && w !== 6)) L.push(d); d = addDays(1, d); } return L; }
async function salvarProg() {
  const de = $('#g-de').value, ate = $('#g-ate').value, ini = $('#g-ini').value, fim = $('#g-fim').value, local = $('#g-local').value.trim(), omN = $('#g-om').value.trim(), tipo = $('#g-tipo').value, obs = $('#g-obs').value.trim();
  if (!de) return toast('Informe a data.', 'bad'); if (!ini || !fim) return toast('Informe entrada e saída.', 'bad'); if (!local) return toast('O local é obrigatório.', 'bad');
  if (!PG.sel.size) return toast('Escolha os participantes.', 'bad');
  const dias = diasEntre(de, ate, $('#g-fds').checked); if (!dias.length) return toast('Nenhum dia útil no período. Marque “Incluir sábados e domingos”.', 'bad');
  /* conflito: a pessoa já tem lançamento num desses dias */
  const conf = []; PG.sel.forEach(fid => dias.forEach(d => { const L = [...D.aloc.values()].filter(a => a.fid === fid && a.data === d); if (L.length) conf.push({ fid, d, L }); }));
  const btn = $('#g-save');
  if (conf.length && !btn.dataset.ok) {
    $('#g-conf').innerHTML = `<div class="demo" style="margin-top:12px"><b>${conf.length} dia(s) já têm lançamento:</b><br>${conf.slice(0, 8).map(c => `${esc(funcBy(c.fid).nome)} em ${fmtD(c.d)}: ${c.L.map(a => esc(a.omNumero ? 'OM ' + a.omNumero : 'sem OM') + ' · ' + esc(a.local)).join(', ')}`).join('<br>')}${conf.length > 8 ? '<br>…' : ''}<br>Salvar de novo acrescenta este lançamento ao dia (não apaga o anterior).</div>`;
    btn.dataset.ok = '1'; btn.textContent = 'Salvar mesmo assim'; return;
  }
  /* aptidão: NR obrigatória vencida ou não feita pede justificativa */
  const inap = []; PG.sel.forEach(fid => { const m = inapto(funcBy(fid), de); if (m.length) inap.push(funcBy(fid).nome + ': ' + m.join(', ')); });
  let just = '';
  if (inap.length) { just = prompt(`${inap.length} pessoa(s) sem NR obrigatória em dia:\n\n${inap.slice(0, 10).join('\n')}${inap.length > 10 ? '\n…' : ''}\n\nPara programar mesmo assim, escreva a justificativa:`, ''); if (!just || !just.trim()) return toast('Programação não salva: falta a justificativa.', 'bad'); just = just.trim(); }
  const om = omByNum(omN); const lote = 'L' + Date.now().toString(36); const agora = new Date().toISOString();
  const docs = []; PG.sel.forEach(fid => { const f = funcBy(fid); dias.forEach(d => { const fx = fixaEm(fid, d);
    docs.push({ data: d, fid, nome: f.nome || '', matricula: str(f.matricula), areaId: f.areaId || '', omId: om ? om.id : '', omNumero: omN, semOm: !omN, local, inicio: ini, fim, tipo, obs, lote,
      fixaNumero: fx ? fx.numero : '', desloc: !fx || norm(fx.numero) !== norm(omN), criadoPor: MEU, criadoEm: agora, ...(just && inapto(f, d).length ? { aptoJust: just, aptoMotivo: inapto(f, d).join(', ') } : {}) }); }); });
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const col = db.collection('alocacoes');
    await Promise.all(docs.map(x => { const r = col.doc(); D.aloc.set(r.id, Object.assign({ id: r.id }, x)); return r.set(x); }));
    toast(`${docs.length} lançamento(s) salvos${omN ? '' : ' (sem OM: ficou em Pendências)'}.`, 'ok');
    PG.sel.clear(); V.dia = de; V.tab = 'dia'; render();
  } catch (e) { toast('Não foi possível salvar: ' + ((e && e.message) || e), 'bad'); btn.disabled = false; btn.textContent = 'Salvar programação'; }
}

/* Pendências: lançamentos sem número de OM, agrupados pelo lote */
function rPend() {
  const G = new Map(); D.pend.forEach(a => { const k = a.lote || a.id; if (!G.has(k)) G.set(k, []); G.get(k).push(a); });
  const L = [...G.entries()].map(([k, A]) => ({ k, A: A.sort((a, b) => str(a.data).localeCompare(str(b.data))) })).sort((a, b) => str(a.A[0].data).localeCompare(str(b.A[0].data)));
  $('#body').innerHTML = `<h2>Pendências de OM</h2><p class="note" style="margin-top:-8px">Lançamentos feitos sem o número da OM. Informe a OM e ela vale para todas as pessoas e dias do lançamento.</p>
    ${L.length ? L.map(({ k, A }) => { const a = A[0], ds = [...new Set(A.map(x => x.data))], ps = [...new Set(A.map(x => x.fid))];
      return `<div class="grp"><div class="gt"><div class="main"><b>${esc(a.local)}</b> ${tipoBadge(a.tipo)}<div class="t2">${ds.length > 1 ? fmtD(ds[0]) + ' a ' + fmtD(ds[ds.length - 1]) + ` (${ds.length} dias)` : fmtD(ds[0])} · ${esc(a.inicio)}–${esc(a.fim)}${a.obs ? ' · ' + esc(a.obs) : ''}</div>
        <div class="t2">${ps.length} pessoa(s): ${ps.map(id => esc(str(funcBy(id).nome || (A.find(x => x.fid === id) || {}).nome).split(' ').slice(0, 2).join(' '))).join(', ')}</div></div></div>
        ${PODE ? `<div class="omrow"><input data-pom="${esc(k)}" list="p-oml" inputmode="numeric" placeholder="Número da OM"><button class="btn primary" data-psave="${esc(k)}">Salvar OM</button></div>` : ''}</div>`; }).join('')
      : '<div class="empty">Nenhuma pendência. Todos os lançamentos têm OM.</div>'}
    <datalist id="p-oml">${D.oms.filter(o => o.ativo !== false).map(o => `<option value="${esc(o.numero)}">${esc(o.descricao || '')} · ${esc(o.local || '')}</option>`).join('')}</datalist>`;
  $$('[data-psave]').forEach(b => b.onclick = async () => { const k = b.dataset.psave; const n = $(`[data-pom="${CSS.escape(k)}"]`).value.trim(); if (!n) return toast('Informe o número da OM.', 'bad');
    const A = G.get(k); b.disabled = true; await setOm(A, n); toast(`OM ${n} gravada em ${A.length} lançamento(s).`, 'ok'); });
}
async function setOm(A, n) {
  const om = omByNum(n);
  await Promise.all(A.map(a => { const fx = fixaEm(a.fid, a.data); const u = { omNumero: n, omId: om ? om.id : '', semOm: !n, desloc: !fx || norm(fx.numero) !== norm(n) };
    const cur = D.aloc.get(a.id); if (cur) Object.assign(cur, u); return db.doc('alocacoes/' + a.id).update(u); }));
  D.pend = D.pend.filter(p => !A.some(a => a.id === p.id)); render();
}

/* Deslocamentos: quem saiu da OM fixa, para onde e quando */
async function rDesl() {
  const de = V.dDe, ate = V.dAte;
  $('#body').innerHTML = `<div class="top2"><label class="note" style="margin:0">De</label><input type="date" id="x-de" value="${de}"><label class="note" style="margin:0">até</label><input type="date" id="x-ate" value="${ate}">
    <select id="x-tipo"><option value="">Todos os tipos</option>${Object.entries(TIPOS).filter(([k]) => k !== 'fixa').map(([k, v]) => `<option value="${k}" ${V.dTipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select><select id="x-area">${optAreas(V.area)}</select></div><div id="x-res"><div class="empty">Carregando…</div></div>`;
  $('#x-de').onchange = e => { V.dDe = e.target.value; rDesl(); }; $('#x-ate').onchange = e => { V.dAte = e.target.value; rDesl(); };
  $('#x-tipo').onchange = e => { V.dTipo = e.target.value; rDesl(); }; $('#x-area').onchange = e => { V.area = e.target.value; rDesl(); };
  try { await garantir(de, ate); } catch (e) { $('#x-res').innerHTML = '<div class="empty">Não foi possível carregar o período.</div>'; return; }
  const L = deslLista(); const pes = new Set(L.map(a => a.fid)), dias = new Set(L.map(a => a.data));
  const porDia = {}; L.forEach(a => (porDia[a.data] = porDia[a.data] || new Set()).add(a.fid));
  $('#x-res').innerHTML = `<div class="kpis" style="margin-bottom:12px">${kpi('Deslocamentos', L.length, 'info')}${kpi('Pessoas', pes.size)}${kpi('Dias', dias.size)}${kpi('Sem OM', L.filter(semOm).length, L.some(semOm) ? 'bad' : '')}${kpi('Apontados', L.filter(a => apontado(a.fid, a.data)).length, 'ok')}${kpi('Horas', fmtH(L.reduce((s, a) => s + horas(a.inicio, a.fim), 0)))}</div>
    <div class="actions" style="margin:0 0 12px"><button class="btn ghost" id="x-xls">Exportar Excel</button><button class="btn ghost" id="x-pdf">Exportar PDF</button></div>
    <div class="card"><div class="tbwrap"><table class="tb"><thead><tr><th>Data</th><th>Funcionário</th><th>Saiu de</th><th>Foi para</th><th>Local</th><th>Horário</th><th>Tipo</th><th>Apontado</th></tr></thead><tbody>
    ${L.length ? L.map(a => `<tr><td>${fmtD(a.data)} <span class="t2">${DSEM[dow(a.data)]}</span></td><td>${esc(a.nome)}<div class="t2">${esc(a.matricula)}</div></td><td>${a.fixaNumero ? 'OM ' + esc(a.fixaNumero) : '<span class="t2">Volante</span>'}</td>
      <td>${semOm(a) ? '<span class="badge b-bad">Sem OM</span>' : 'OM ' + esc(a.omNumero)}</td><td>${esc(a.local)}</td><td>${esc(a.inicio)}–${esc(a.fim)}</td><td>${tipoBadge(a.tipo)}</td><td>${apontado(a.fid, a.data) ? '<span class="badge b-ok">Sim</span>' : '<span class="badge b-warn">Não</span>'}</td></tr>`).join('')
      : '<tr><td colspan="8"><div class="empty">Nenhum deslocamento no período.</div></td></tr>'}</tbody></table></div></div>
    ${Object.keys(porDia).length ? `<div class="card"><p class="ct">Pessoas deslocadas por dia</p>${Object.keys(porDia).sort().map(d => `<div class="bt" style="padding:4px 0"><span>${fmtD(d)} ${DSEM[dow(d)]}</span><b>${porDia[d].size}</b></div>`).join('')}</div>` : ''}`;
  $('#x-xls').onclick = () => exportXls(L); $('#x-pdf').onclick = () => pdfDesl(L);
}
function deslLista() {
  const P = new Set(filtraArea(ativos(), V.area).map(f => f.id));
  return [...D.aloc.values()].filter(a => a.data >= V.dDe && a.data <= V.dAte && (!V.dTipo || a.tipo === V.dTipo) && P.has(a.fid) && a.tipo !== 'fixa' && (a.desloc !== false))
    .sort((a, b) => str(a.data).localeCompare(str(b.data)) || str(a.nome).localeCompare(str(b.nome), 'pt'));
}

/* Funcionário: onde esteve em cada dia do mês, com PDF */
async function rFunc() {
  const P = ativos(); if (!V.fId && P.length) V.fId = P[0].id;
  $('#body').innerHTML = `<div class="top2"><input id="f-q" list="f-ql" placeholder="Nome ou matrícula" value="${esc(funcBy(V.fId).nome || '')}" style="flex:1;min-width:180px"><datalist id="f-ql">${D.func.map(f => `<option value="${esc(f.nome)}">${esc(f.matricula || '')}</option>`).join('')}</datalist>
    <input type="month" id="f-mes" value="${V.fMes}"></div><div id="f-res"><div class="empty">Carregando…</div></div>`;
  $('#f-q').onchange = e => { const v = norm(e.target.value); const f = D.func.find(x => norm(x.nome) === v || str(x.matricula) === e.target.value.trim()); if (f) { V.fId = f.id; rFunc(); } };
  $('#f-mes').onchange = e => { if (e.target.value) { V.fMes = e.target.value; rFunc(); } };
  const f = funcBy(V.fId); if (!f.id) { $('#f-res').innerHTML = '<div class="empty">Escolha um funcionário.</div>'; return; }
  const [de, ate] = mesIntervalo(V.fMes); try { await garantir(de, ate); } catch (e) {}
  const R = mesLinhas(f.id, de, ate); const tot = mesTotais(R);
  const fx = fixaAtual(f.id);
  $('#f-res').innerHTML = `<div class="card"><p class="ct">${esc(f.nome)}</p><p class="cs">${esc(f.matricula || '')} · ${esc(f.funcao || '')}${f.area ? ' · ' + esc(f.area) : ''} · ${fx ? 'OM fixa ' + esc(fx.numero) + ' (' + esc(fx.local || '') + ')' : 'Volante / spot'}</p>
      <div class="kpis">${kpi('Dias com alocação', tot.dias)}${kpi('Horas', fmtH(tot.h))}${kpi('Fora da OM fixa', tot.desl, 'info')}${kpi('Sem OM', tot.semom, tot.semom ? 'bad' : '')}${kpi('Apontados', tot.ap + '/' + tot.dias, tot.ap === tot.dias ? 'ok' : 'warn')}${kpi('OMs diferentes', tot.oms.size)}</div>
      <div class="actions"><button class="btn primary" id="f-pdf">PDF do mês</button></div></div>
    <div class="card"><div class="tbwrap"><table class="tb"><thead><tr><th>Dia</th><th>OM</th><th>Local</th><th>Horário</th><th class="n">Horas</th><th>Tipo</th><th>Apontado</th></tr></thead><tbody>
    ${R.map(r => r.E.length ? r.E.map((e, i) => `<tr><td>${i ? '' : fmtD(r.d) + ' <span class="t2">' + DSEM[dow(r.d)] + '</span>'}</td><td>${semOm(e) ? '<span class="badge b-bad">Sem OM</span>' : esc(e.omNumero)}</td><td>${esc(e.local)}</td><td>${esc(e.inicio)}–${esc(e.fim)}</td><td class="n">${fmtH(horas(e.inicio, e.fim))}</td><td>${e.virtual ? '<span class="badge b-ok">OM fixa</span>' : tipoBadge(e.tipo)}</td>
        <td>${i ? '' : `<input type="checkbox" data-ap="${esc(f.id)}" data-apd="${r.d}" ${r.ap ? 'checked' : ''} ${PODE ? '' : 'disabled'} aria-label="Apontado">`}</td></tr>`).join('')
      : `<tr><td>${fmtD(r.d)} <span class="t2">${DSEM[dow(r.d)]}</span></td><td colspan="6" class="t2">—</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#f-pdf').onclick = () => pdfFunc(f, R, tot);
}
const mesIntervalo = m => { const [y, mo] = m.split('-').map(Number); return [m + '-01', ymd(new Date(y, mo, 0))]; };
function mesLinhas(fid, de, ate) { const R = []; for (let d = de; d <= ate; d = addDays(1, d)) R.push({ d, E: diaDe(fid, d), ap: apontado(fid, d) }); return R; }
function mesTotais(R) { const t = { dias: 0, h: 0, desl: 0, semom: 0, ap: 0, oms: new Set() };
  R.forEach(r => { if (!r.E.length) return; t.dias++; if (r.ap) t.ap++; if (r.E.some(e => !e.virtual)) t.desl++; r.E.forEach(e => { t.h += horas(e.inicio, e.fim); if (semOm(e)) t.semom++; else t.oms.add(e.omNumero); }); }); return t; }

/* OMs: cadastro e equipe fixa */
function rOms() {
  let L = D.oms; if (V.omBusca) { const q = norm(V.omBusca); L = L.filter(o => norm(o.numero + ' ' + o.descricao + ' ' + o.local).includes(q)); }
  const nFixa = id => Object.keys(D.fixa).filter(fid => { const o = fixaAtual(fid); return o && o.id === id && (funcBy(fid).ativo !== false); }).length;
  const semFixa = ativos().filter(f => !fixaAtual(f.id)).length;
  $('#body').innerHTML = `<div class="head"><h2>Ordens de manutenção</h2>${PODE ? '<button class="btn primary" id="o-new">Nova OM</button>' : ''}</div>
    <input id="o-q" placeholder="Buscar número, descrição ou local" value="${esc(V.omBusca)}" style="margin-bottom:12px">
    <p class="note">${ativos().length - semFixa} funcionário(s) em OM fixa · ${semFixa} volante(s) / obra spot.</p>
    <div class="list">${L.length ? L.map(o => `<button class="item" data-om="${esc(o.id)}"><div class="main"><div class="t1"><span class="code">${esc(o.numero)}</span> ${esc(o.descricao || '')}</div>
      <div class="t2">${esc(o.local || '—')}${o.areaId ? ' · ' + esc(areaNome(o.areaId)) : ''} · ${tipoBadge(o.tipo || 'fixa')}${o.tipo === 'fixa' || !o.tipo ? ` · ${esc(o.inicio || '07:00')}–${esc(o.fim || '17:00')} ${diasOm(o).map(d => DSEM[d]).join(' ')}` : ''}</div></div>
      <div class="side">${(o.tipo || 'fixa') === 'fixa' ? `<span class="badge b-info">${nFixa(o.id)} fixo(s)</span>` : ''}${o.ativo === false ? '<span class="badge b-mut">Encerrada</span>' : ''}</div></button>`).join('') : '<div class="empty">Nenhuma OM cadastrada. Cadastre as OMs fixas das áreas e coloque a equipe fixa em cada uma.</div>'}</div>`;
  const n = $('#o-new'); if (n) n.onclick = () => editOm();
  $('#o-q').oninput = e => { V.omBusca = e.target.value; clearTimeout(e.target._t); e.target._t = setTimeout(() => { const p = e.target.selectionStart; e.target.blur(); render(); const nb = $('#o-q'); nb.focus(); nb.setSelectionRange(p, p); }, 300); };
}
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
function editOm(id) {
  const o = id ? omBy(id) : { tipo: 'fixa', inicio: '07:00', fim: '17:00', dias: [1, 2, 3, 4, 5], ativo: true };
  const eq = new Set(Object.keys(D.fixa).filter(fid => { const x = fixaAtual(fid); return x && x.id === id; }));
  const E = { sel: new Set(eq), q: '' };
  const ro = PODE ? '' : 'disabled';
  sheet(`<div class="top"><h2>${id ? 'OM ' + esc(o.numero) : 'Nova OM'}</h2><button class="x" id="m-x" aria-label="Fechar">×</button></div>
    <div class="grid2"><div><label class="req" for="o-num">Número da OM</label><input id="o-num" value="${esc(o.numero || '')}" inputmode="numeric" ${ro}></div>
      <div><label for="o-tipo">Tipo</label><select id="o-tipo" ${ro}>${Object.entries(TIPOS).filter(([k]) => k !== 'outro').map(([k, v]) => `<option value="${k}" ${(o.tipo || 'fixa') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <label for="o-desc">Descrição</label><input id="o-desc" value="${esc(o.descricao || '')}" ${ro}>
    <div class="grid2"><div><label class="req" for="o-local">Local</label><input id="o-local" value="${esc(o.local || '')}" ${ro}></div><div><label for="o-area">Área</label><select id="o-area" ${ro}><option value="">—</option>${D.areas.map(a => `<option value="${esc(a.id)}" ${o.areaId === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div></div>
    <div id="o-fx"><div class="grid2"><div><label for="o-ini">Entrada padrão</label><input type="time" id="o-ini" value="${esc(o.inicio || '07:00')}" ${ro}></div><div><label for="o-fim">Saída padrão</label><input type="time" id="o-fim" value="${esc(o.fim || '17:00')}" ${ro}></div></div>
      <label>Dias de trabalho</label><div class="chips" style="margin-top:0">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="chip" style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" data-odia="${d}" ${diasOm(o).includes(d) ? 'checked' : ''} ${ro} style="width:16px;height:16px">${DSEM[d]}</label>`).join('')}</div>
      <p class="ct" style="margin-top:14px">Equipe fixa <span class="badge b-info" id="o-n">${E.sel.size}</span></p><p class="note" style="margin:0">Quem está aqui aparece nesta OM todo dia de trabalho, sem precisar lançar. Trocar de OM fixa vale a partir de hoje; os dias passados não mudam.</p>
      <input id="o-q2" placeholder="Buscar nome ou matrícula" style="margin-top:8px"><div class="pick" id="o-pick"></div></div>
    <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="o-at" ${o.ativo === false ? 'checked' : ''} ${ro}> OM encerrada</label>
    ${PODE ? `<div class="actions"><button class="btn primary" id="o-save">Salvar</button></div>` : ''}`);
  const tipoFx = () => $('#o-fx').classList.toggle('hidden', $('#o-tipo').value !== 'fixa');
  const pk = () => { const q = norm(E.q); const L = ativos().filter(f => !q || norm(f.nome).includes(q) || str(f.matricula).includes(q)).sort((a, b) => E.sel.has(b.id) - E.sel.has(a.id) || str(a.nome).localeCompare(str(b.nome), 'pt'));
    $('#o-pick').innerHTML = L.map(f => { const x = fixaAtual(f.id); return `<label><input type="checkbox" data-ofk="${esc(f.id)}" ${E.sel.has(f.id) ? 'checked' : ''} ${ro}><span class="main"><b>${esc(f.nome)}</b><div class="t2">${esc(f.matricula || '')} · ${esc(f.funcao || '')}${x && x.id !== id ? ' · hoje na OM ' + esc(x.numero) : ''}</div></span></label>`; }).join('');
    $$('#o-pick [data-ofk]').forEach(c => c.onchange = () => { c.checked ? E.sel.add(c.dataset.ofk) : E.sel.delete(c.dataset.ofk); $('#o-n').textContent = E.sel.size; }); };
  tipoFx(); pk(); $('#o-tipo').onchange = tipoFx; $('#o-q2').oninput = e => { E.q = e.target.value; pk(); };
  $('#m-x').onclick = fechar;
  const s = $('#o-save'); if (s) s.onclick = async () => {
    const numero = $('#o-num').value.trim(), local = $('#o-local').value.trim(); if (!numero) return toast('Informe o número da OM.', 'bad'); if (!local) return toast('Informe o local.', 'bad');
    const dup = D.oms.find(x => norm(x.numero) === norm(numero) && x.id !== id); if (dup) return toast('Já existe uma OM com esse número.', 'bad');
    const tipo = $('#o-tipo').value; const dias = $$('[data-odia]').filter(c => c.checked).map(c => +c.dataset.odia);
    const d = { numero, tipo, descricao: $('#o-desc').value.trim(), local, areaId: $('#o-area').value, inicio: $('#o-ini').value || '07:00', fim: $('#o-fim').value || '17:00', dias: dias.length ? dias : [1, 2, 3, 4, 5], ativo: !$('#o-at').checked };
    s.disabled = true;
    try {
      const ref = id ? db.doc('oms/' + id) : db.collection('oms').doc(); const doc = Object.assign({}, o, d, { atualizadoEm: new Date().toISOString() }, id ? {} : { criadoEm: new Date().toISOString() }); delete doc.id; await ref.set(doc);
      const oid = ref.id; if (!id) D.oms.push(Object.assign({ id: oid }, d));
      if (tipo === 'fixa') { const h = hoje(); const mud = [];
        E.sel.forEach(fid => { if (!eq.has(fid)) mud.push([fid, oid]); }); eq.forEach(fid => { if (!E.sel.has(fid)) mud.push([fid, '']); });
        await Promise.all(mud.map(([fid, om]) => { const hist = ((D.fixa[fid] || {}).hist || []).filter(x => x.desde !== h).concat([{ omId: om, desde: h }]); D.fixa[fid] = { hist }; return db.doc('om_fixa/' + fid).set({ hist }); }));
        if (mud.length) toast(`OM salva. Equipe fixa: ${mud.length} alteração(ões).`, 'ok'); else toast('OM salva.', 'ok');
      } else toast('OM salva.', 'ok');
      fechar();
    } catch (e) { s.disabled = false; toast('Não foi possível salvar: ' + ((e && e.message) || e), 'bad'); }
  };
}
/* editar um lançamento (uma pessoa, um dia), ou o lançamento inteiro */
function editAloc(aid) {
  const a = D.aloc.get(aid); if (!a) return; const nL = [...D.aloc.values()].filter(x => x.lote && x.lote === a.lote).length;
  sheet(`<div class="top"><h2>${esc(a.nome)} · ${fmtD(a.data)}</h2><button class="x" id="m-x" aria-label="Fechar">×</button></div>
    <div class="grid3"><div><label for="e-data">Data</label><input type="date" id="e-data" value="${a.data}"></div><div><label for="e-ini">Entrada</label><input type="time" id="e-ini" value="${esc(a.inicio)}"></div><div><label for="e-fim">Saída</label><input type="time" id="e-fim" value="${esc(a.fim)}"></div></div>
    <label class="req" for="e-local">Local</label><input id="e-local" value="${esc(a.local)}">
    <div class="grid2"><div><label for="e-om">Número da OM</label><input id="e-om" value="${esc(a.omNumero || '')}" inputmode="numeric"></div><div><label for="e-tipo">Tipo</label><select id="e-tipo">${Object.entries(TIPOS).filter(([k]) => k !== 'fixa').map(([k, v]) => `<option value="${k}" ${a.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <label for="e-obs">Observação</label><input id="e-obs" value="${esc(a.obs || '')}">
    ${nL > 1 ? `<label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="e-lote"> Aplicar OM, local, horário e tipo a todo o lançamento (${nL} pessoa-dia)</label>` : ''}
    <div class="actions"><button class="btn primary" id="e-save">Salvar</button><button class="btn danger" id="e-del">Excluir este dia</button></div>`);
  $('#m-x').onclick = fechar;
  $('#e-save').onclick = async () => {
    const local = $('#e-local').value.trim(); if (!local) return toast('O local é obrigatório.', 'bad');
    const omN = $('#e-om').value.trim(), om = omByNum(omN);
    const comum = { local, inicio: $('#e-ini').value, fim: $('#e-fim').value, tipo: $('#e-tipo').value, omNumero: omN, omId: om ? om.id : '', semOm: !omN };
    const lote = $('#e-lote') && $('#e-lote').checked; const alvo = lote ? [...D.aloc.values()].filter(x => x.lote === a.lote) : [a];
    try {
      await Promise.all(alvo.map(x => { const data = x.id === a.id ? $('#e-data').value || x.data : x.data; const fx = fixaEm(x.fid, data);
        const u = Object.assign({}, comum, x.id === a.id ? { obs: $('#e-obs').value.trim(), data } : {}, { fixaNumero: fx ? fx.numero : '', desloc: !fx || norm(fx.numero) !== norm(omN) });
        Object.assign(x, u); return db.doc('alocacoes/' + x.id).update(u); }));
      if (omN) D.pend = D.pend.filter(p => !alvo.some(x => x.id === p.id));
      toast(alvo.length > 1 ? `${alvo.length} lançamento(s) atualizados.` : 'Lançamento atualizado.', 'ok'); fechar();
    } catch (e) { toast('Não foi possível salvar.', 'bad'); }
  };
  let armed = false; $('#e-del').onclick = async () => { if (!armed) { armed = true; $('#e-del').textContent = 'Toque de novo para excluir'; return; }
    try { await db.doc('alocacoes/' + a.id).delete(); D.aloc.delete(a.id); D.pend = D.pend.filter(p => p.id !== a.id); toast('Lançamento excluído.', 'ok'); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}

/* ---------- exportações ---------- */
const loadScript = (src, ok) => new Promise((res, rej) => { if (ok()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => ok() ? res() : rej(new Error('lib')); s.onerror = () => rej(new Error('Sem internet para carregar o gerador.')); document.head.appendChild(s); });
const loadPDF = () => loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf && window.jspdf.jsPDF);
const loadXLSX = () => loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX);
async function baixar(nome, blob) { const dl = await claude.use('downloads'); if (!dl) return toast('Download indisponível neste aparelho.', 'bad');
  try { await dl.save({ filename: nome, data: blob }); toast('Arquivo pronto.', 'ok'); } catch (e) { if (!(e && e.code === 'declined')) toast('Não foi possível salvar o arquivo.', 'bad'); } }
async function exportXls(L) {
  if (!window.PrevRel) try { await loadXLSX(); } catch (e) { return toast(e.message, 'bad'); }
  const rows = L.map(a => ({ Data: fmtD(a.data), Dia: DSEM[dow(a.data)], Matrícula: a.matricula, Funcionário: a.nome, 'OM fixa': a.fixaNumero || 'Volante', 'OM destino': a.omNumero || 'SEM OM', Local: a.local, Entrada: a.inicio, Saída: a.fim, Horas: +horas(a.inicio, a.fim).toFixed(2), Tipo: TIPOS[a.tipo] || a.tipo, Apontado: apontado(a.fid, a.data) ? 'Sim' : 'Não', Obs: a.obs || '' }));
  if (window.PrevRel) { const cab = rows.length ? Object.keys(rows[0]) : ['Data']; return PrevRel.escolher(Object.assign(PrevRel.deMatriz([cab].concat(rows.map(r => cab.map(k => r[k])))), { modelo: 'rel_deslocamentos', titulo: 'Deslocamentos (alocação em OM)', arquivo: 'Deslocamentos', filtros: 'Período: ' + fmtD(V.dDe) + ' a ' + fmtD(V.dAte) })); }
  const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = [10, 5, 11, 32, 10, 11, 26, 7, 7, 6, 13, 9, 24].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Deslocamentos');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  baixar(`Deslocamentos ${V.dDe} a ${V.dAte}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
async function empresa() { try { const s = await db.doc('config/empresa').get(); return s.exists ? s.data() : {}; } catch (e) { return {}; } }
function cab(doc, titulo, sub, emp, land) {
  emp = window.logoEmp ? window.logoEmp(emp) : emp;
  const W = land ? 297 : 210; doc.setFillColor(20, 33, 61); doc.rect(0, 0, W, 22, 'F'); doc.setFillColor(242, 169, 0); doc.rect(0, 22, W, 1.5, 'F');
  let x = 12; if (/^data:image\/(png|jpeg)/.test(str(emp.logo))) { try { const ra = (+emp.logoW || 2) / (+emp.logoH || 1); const h = 15, w = Math.min(34, h * ra); doc.setFillColor(255, 255, 255); doc.roundedRect(9, 3.5, w + 2, w / ra + 1, 1.5, 1.5, 'F'); doc.addImage(emp.logo, emp.logo.includes('png') ? 'PNG' : 'JPEG', 10, 4, w, w / ra, undefined, 'FAST'); x = w + 16; } catch (e) {} }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(titulo, x, 11); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(sub, x, 17);
  doc.text(emp.nome || 'PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA', W - 10, 11, { align: 'right' }); { doc.setFontSize(8); doc.text('CNPJ ' + (emp.cnpj || '03.052.261/0001-43'), W - 10, 16, { align: 'right' }); } doc.setTextColor(20, 33, 61);
}
function tabela(doc, cols, rows, y, land, emp, titulo, sub) {
  const W = land ? 297 : 210, H = land ? 210 : 297, L = 10; const tw = cols.reduce((s, c) => s + c.w, 0); const k = (W - 20) / tw;
  const head = () => { doc.setFillColor(236, 238, 241); doc.rect(L, y - 4.5, W - 20, 7, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); let x = L + 1.5; cols.forEach(c => { doc.text(c.t, x, y); x += c.w * k; }); y += 6; doc.setFont('helvetica', 'normal'); };
  head();
  rows.forEach((r, i) => { const lines = r.map((v, j) => doc.splitTextToSize(str(v), cols[j].w * k - 2.5)); const h = Math.max(...lines.map(l => l.length)) * 3.8 + 1.6;
    if (y + h > H - 14) { doc.addPage(); cab(doc, titulo, sub, emp, land); y = 32; head(); }
    if (r._shade || (i % 2)) { doc.setFillColor(248, 249, 250); doc.rect(L, y - 3.6, W - 20, h, 'F'); }
    let x = L + 1.5; lines.forEach((l, j) => { doc.text(l, x, y); x += cols[j].w * k; }); y += h; });
  return y;
}
function rodape(doc, land) { const n = doc.getNumberOfPages(), W = land ? 297 : 210, H = land ? 210 : 297; for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(110, 116, 128); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${MEU}`, 10, H - 6); doc.text(`${i}/${n}`, W - 10, H - 6, { align: 'right' }); } }
async function pdfFunc(f, R, tot) {
  try { await loadPDF(); } catch (e) { return toast(e.message, 'bad'); }
  const emp = await empresa(); const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const [y0, m0] = V.fMes.split('-'); const titulo = 'Alocação mensal em OM', sub = `${MESES[+m0 - 1]} de ${y0}`;
  cab(doc, titulo, sub, emp, false); let y = 32; const fx = fixaAtual(f.id);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(str(f.nome), 10, y); y += 5.5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Matrícula ${str(f.matricula)} · ${str(f.funcao)}${f.area ? ' · ' + f.area : ''} · ${fx ? 'OM fixa ' + fx.numero + ' (' + str(fx.local) + ')' : 'Volante / obra spot'}`, 10, y); y += 5;
  doc.text(`Dias com alocação: ${tot.dias} · Horas: ${fmtH(tot.h)} · Fora da OM fixa: ${tot.desl} · Sem OM: ${tot.semom} · Apontados: ${tot.ap}/${tot.dias}`, 10, y); y += 8;
  const rows = []; R.forEach(r => { if (!r.E.length) { rows.push([fmtD(r.d) + ' ' + DSEM[dow(r.d)], '—', '', '', '', '', '']); return; }
    r.E.forEach((e, i) => rows.push([i ? '' : fmtD(r.d) + ' ' + DSEM[dow(r.d)], semOm(e) ? 'SEM OM' : e.omNumero, e.local, `${e.inicio}–${e.fim}`, fmtH(horas(e.inicio, e.fim)), e.virtual ? 'OM fixa' : (TIPOS[e.tipo] || e.tipo), i ? '' : (r.ap ? 'Sim' : 'Não')])); });
  y = tabela(doc, [{ t: 'Dia', w: 24 }, { t: 'OM', w: 20 }, { t: 'Local', w: 52 }, { t: 'Horário', w: 22 }, { t: 'Horas', w: 13 }, { t: 'Tipo', w: 24 }, { t: 'Apontado', w: 17 }], rows, y, false, emp, titulo, sub);
  if (tot.oms.size) { y += 6; if (y > 270) { doc.addPage(); cab(doc, titulo, sub, emp, false); y = 32; } doc.setFont('helvetica', 'bold'); doc.text('Dias por OM', 10, y); y += 5; doc.setFont('helvetica', 'normal');
    const cnt = {}; R.forEach(r => new Set(r.E.map(e => semOm(e) ? 'SEM OM' : e.omNumero)).forEach(o => cnt[o] = (cnt[o] || 0) + 1));
    Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([o, n]) => { doc.text(`${o === 'SEM OM' ? o : 'OM ' + o}: ${n} dia(s)`, 12, y); y += 4.5; }); }
  rodape(doc, false);
  baixar(`Alocação ${str(f.nome).split(' ')[0]} ${str(f.matricula)} ${V.fMes}.pdf`, doc.output('blob'));
}
async function pdfDesl(L) {
  try { await loadPDF(); } catch (e) { return toast(e.message, 'bad'); }
  const emp = await empresa(); const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const titulo = 'Deslocamentos de OM', sub = `${fmtD(V.dDe)} a ${fmtD(V.dAte)}${V.dTipo ? ' · ' + TIPOS[V.dTipo] : ''}${V.area ? ' · ' + areaNome(V.area) : ''}`;
  cab(doc, titulo, sub, emp, true);
  const rows = L.map(a => [fmtD(a.data) + ' ' + DSEM[dow(a.data)], a.nome, a.matricula, a.fixaNumero ? 'OM ' + a.fixaNumero : 'Volante', semOm(a) ? 'SEM OM' : 'OM ' + a.omNumero, a.local, `${a.inicio}–${a.fim}`, TIPOS[a.tipo] || a.tipo, apontado(a.fid, a.data) ? 'Sim' : 'Não']);
  tabela(doc, [{ t: 'Data', w: 22 }, { t: 'Funcionário', w: 55 }, { t: 'Matrícula', w: 20 }, { t: 'Saiu de', w: 22 }, { t: 'Foi para', w: 22 }, { t: 'Local', w: 50 }, { t: 'Horário', w: 22 }, { t: 'Tipo', w: 24 }, { t: 'Apontado', w: 17 }], rows.length ? rows : [['Nenhum deslocamento no período.', '', '', '', '', '', '', '', '']], 32, true, emp, titulo, sub);
  rodape(doc, true);
  baixar(`Deslocamentos ${V.dDe} a ${V.dAte}.pdf`, doc.output('blob'));
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const dd = e.target.closest('[data-dd]'); if (dd) { V.dia = addDays(+dd.dataset.dd, V.dia); garantir(V.dia, V.dia).then(render); return; }
  const so = e.target.closest('[data-so]'); if (so) { V.so = so.dataset.so; render(); return; }
  const ed = e.target.closest('[data-edit]'); if (ed && PODE) { editAloc(ed.dataset.edit); return; }
  const om = e.target.closest('[data-om]'); if (om) { editOm(om.dataset.om); return; }
  const pp = e.target.closest('[data-progp]'); if (pp) { PG.sel = new Set([pp.dataset.progp]); V.tab = 'prog'; render(); const de = $('#g-de'); if (de) de.value = V.dia; return; }
  if (e.target.id === 'modal') fechar();
});
document.addEventListener('change', e => {
  const c = e.target.closest('[data-ap]'); if (!c || !PODE) return;
  marcar(c.dataset.ap, c.dataset.apd || V.dia, c.checked).then(() => render());
});

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; PODE = ['admin', 'gestao', 'adm'].includes(F.papel); MEU = F.nome || '';
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; } }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  ouvir(); render(); carregarTrein();
})();
