/* Módulo Indicadores: KPIs de treinamentos, padrões operacionais, ferramentas e EPI, com navegação por área → padrão → pessoa. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const num = v => { const n = typeof v === 'number' ? v : parseFloat(str(v)); return isFinite(n) ? n : 0; };
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const hoje = () => ymd(new Date());
const addDays = (n, b) => { const d = b ? new Date(b + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (d, m) => { const x = new Date(str(d).slice(0, 10) + 'T12:00:00'); x.setMonth(x.getMonth() + m); return ymd(x); };
const fmtD = s => { s = str(s).slice(0, 10); const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const brl = v => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const kpi = (t, n, k, s) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
/* barras horizontais: [{ t, v, s, cor, data }] */
function barras(L, opts) {
  opts = opts || {}; const max = Math.max(1, ...L.map(x => x.max != null ? x.max : x.v));
  if (!L.length) return '<div class="empty">Sem dados.</div>';
  return L.map(x => `<${x.data ? 'button' : 'div'} class="br" ${x.data || ''}><div class="bt"><span>${esc(x.t)}</span><b>${x.s != null ? x.s : x.v}</b></div><div class="bb"><i style="width:${x.v > 0 ? Math.max(2, Math.round(x.v / (x.max != null ? x.max : max) * 100)) : 0}%;background:${x.cor || 'var(--s1)'}"></i></div></${x.data ? 'button' : 'div'}>`).join('');
}
const corPct = p => p >= 90 ? 'var(--ok)' : p >= 70 ? '#c98a00' : 'var(--bad)';

const D = { func: [], tt: [], tr: [], ext: [], areas: [], pad: [], preg: [], cursos: [], mat: [], ferr: [], caut: [], ent: [], est: [], epis: [] };
const V = { tab: 'pes', area: '', nav: [], per: '180', grp: 'area' };
let db = null, AREA_FIXA = '';

/* ---------- dados ---------- */
async function carregar() {
  $('#ind-body').innerHTML = '<div class="empty">Carregando indicadores…</div>';
  const C = [['func', 'funcionarios'], ['tt', 'trein_tipos'], ['tr', 'treinamentos'], ['ext', 'trein_ext'], ['areas', 'areas'], ['pad', 'padroes'], ['preg', 'padrao_reg'], ['cursos', 'cursos'], ['mat', 'matriculas'], ['ferr', 'ferramentas'], ['caut', 'cautelas'], ['ent', 'entregas'], ['est', 'estoques'], ['epis', 'epis']];
  try {
    const R = await Promise.all(C.map(([, c]) => db.collection(c).get().then(s => s.docs.map(d => Object.assign({}, d.data(), { id: d.id })), () => [])));
    C.forEach(([k], i) => D[k] = R[i]);
    $('#ind-at').textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    render();
  } catch (e) { $('#ind-body').innerHTML = `<div class="card">Não foi possível carregar. <button class="btn sm primary" onclick="carregar()">Tentar de novo</button></div>`; }
}

/* ---------- regras de negócio (as mesmas do módulo Treinamentos) ---------- */
const ativos = () => D.func.filter(f => f.ativo !== false);
const subsDe = f => Array.isArray(f && f.subareas) ? f.subareas : [];
const subsDaArea = id => ((D.areas.find(a => a.id === id) || {}).subs || []).map(s => s.id);
const subNome = sid => { for (const a of D.areas) { const s = (a.subs || []).find(x => x.id === sid); if (s) return a.nome + ' → ' + s.nome; } return '?'; };
function pessoas() { const area = AREA_FIXA || V.area; if (!area) return ativos(); const ids = subsDaArea(area); return ativos().filter(f => subsDe(f).some(s => ids.includes(s))); }
const grupoKey = r => r.norma ? 'N:' + norm(r.norma) : 'T:' + r.tipoId;
function grupos() { const m = new Map(); D.tt.forEach(t => { const k = t.norma ? 'N:' + norm(t.norma) : 'T:' + t.id; if (!m.has(k)) m.set(k, { k, nome: t.norma || t.nome, tipos: [] }); m.get(k).tipos.push(t); }); return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true })); }
const obrig = (g, f) => g.tipos.some(t => (t.obrig || []).includes(str(f.funcao)) || (!!f.altura && /nr-?\s?35/i.test(str(t.norma) + ' ' + str(t.nome))));
function trState(r) { if (str(r.inicio) > hoje()) return 'agendado'; const v = str(r.validade); if (!v) return 'ok'; if (v < hoje()) return 'vencido'; if (v <= addDays(60)) return 'vence'; return 'ok'; }
function ultimo(fid, gk) { const feito = r => str(r.inicio) <= hoje(); return D.tr.filter(r => r.funcionarioId === fid && grupoKey(r) === gk).sort((a, b) => (feito(b) - feito(a)) || str(b.termino).localeCompare(str(a.termino)))[0]; }
function precisa(p, f) { if (!f || f.ativo === false || p.ativo === false || (p.exc || []).includes(f.id)) return false; if ((p.inc || []).includes(f.id)) return true; return (p.subIds || []).some(s => subsDe(f).includes(s)); }
function padSt(p, fid) { const L = D.preg.filter(r => r.padraoId === p.id && r.funcionarioId === fid).sort((a, b) => str(b.data).localeCompare(str(a.data))); const at = L.find(r => str(r.rev) === str(p.rev));
  if (at) return num(p.reciclMeses) && addMonths(at.data, num(p.reciclMeses)) < hoje() ? { st: 'recicl', r: at } : { st: 'ok', r: at }; return L.length ? { st: 'rev', r: L[0] } : { st: 'pend', r: null }; }
const PST = { ok: ['Treinado', 'b-ok'], rev: ['Revisão desatualizada', 'b-warn'], recicl: ['Reciclagem vencida', 'b-warn'], pend: ['Pendente', 'b-bad'] };
const padBadge = s => `<span class="badge ${PST[s][1]}">${PST[s][0]}</span>`;
const trBadge = r => { const s = trState(r); return s === 'agendado' ? `<span class="badge b-info">Agendado ${fmtD(r.inicio)}</span>` : !r.validade ? '<span class="badge b-mut">Sem validade</span>' : s === 'vencido' ? `<span class="badge b-bad">Vencido ${fmtD(r.validade)}</span>` : s === 'vence' ? `<span class="badge b-warn">Vence ${fmtD(r.validade)}</span>` : `<span class="badge b-ok">Até ${fmtD(r.validade)}</span>`; };
const extSt = x => !x.validade ? 'ok' : x.validade < hoje() ? 'vencido' : x.validade <= addDays(60) ? 'vence' : 'ok';
const meses = n => { const out = []; const d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + z2(x.getMonth() + 1)); } return out; };
const mesNome = k => MES[+k.slice(5) - 1] + '/' + k.slice(2, 4);

/* ---------- telas ---------- */
function render() {
  $$('#ind-seg button').forEach(b => b.classList.toggle('on', b.dataset.t === V.tab));
  const ar = $('#ind-area');
  ar.innerHTML = AREA_FIXA ? `<option>${esc((D.areas.find(a => a.id === AREA_FIXA) || {}).nome || 'Minha área')}</option>` : '<option value="">Todas as áreas</option>' + D.areas.slice().sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')).map(a => `<option value="${esc(a.id)}" ${V.area === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('');
  ar.disabled = !!AREA_FIXA;
  $('#ind-per').hidden = !['ferr', 'epi'].includes(V.tab);
  ({ pes: tPes, trein: tTrein, pad: tPad, ferr: tFerr, epi: tEpi })[V.tab]();
}
/* ---------- pessoas: idade, tempo de casa, distribuição e tamanhos ---------- */
const anosEntre = (a, b) => { if (!a) return null; const d1 = new Date(str(a).slice(0, 10) + 'T12:00:00'), d2 = b ? new Date(b + 'T12:00:00') : new Date(); if (isNaN(d1)) return null; return (d2 - d1) / (365.25 * 864e5); };
const media = L => L.length ? L.reduce((a, b) => a + b, 0) / L.length : null;
const fmtAnos = v => v == null ? '—' : v < 1 ? Math.round(v * 12) + ' meses' : (Math.round(v * 10) / 10).toLocaleString('pt-BR') + ' anos';
const GRP = { area: ['Área', f => f.area || 'Sem área'], subarea: ['Sub-área', f => [f.area, f.subarea].filter(Boolean).join(' → ') || 'Sem área'], cargo: ['Cargo', f => str(f.cargo).trim() || 'Sem cargo'], funcao: ['Função', f => str(f.funcao).trim() || 'Sem função'], unidade: ['Unidade', f => f.unidade || 'Sem unidade'] };
function tPes() {
  const F = pessoas(); const n = F.length;
  const idades = F.map(f => anosEntre(f.nascimento)).filter(v => v != null && v > 14 && v < 90);
  const casas = F.map(f => anosEntre(f.admissao)).filter(v => v != null && v >= 0);
  const af = F.filter(f => f.situacao === 'Afastado').length, fe = F.filter(f => f.situacao === 'Férias').length;
  const M12 = meses(12); const adm = M12.map(m => F.filter(f => str(f.admissao).slice(0, 7) === m).length);
  const [gNome, gFn] = GRP[V.grp]; const grupos = {}; F.forEach(f => { const k = gFn(f); (grupos[k] = grupos[k] || []).push(f); });
  const G = Object.entries(grupos).map(([k, L]) => ({ k, n: L.length, id: media(L.map(f => anosEntre(f.nascimento)).filter(v => v != null && v > 14 && v < 90)), tc: media(L.map(f => anosEntre(f.admissao)).filter(v => v != null && v >= 0)), alt: L.filter(f => f.altura).length })).sort((a, b) => b.n - a.n);
  const faixa = (L, cortes, nomes) => nomes.map((t, i) => ({ t, v: L.filter(v => v >= cortes[i] && v < cortes[i + 1]).length }));
  const fxId = faixa(idades, [0, 25, 35, 45, 55, 200], ['Até 24 anos', '25 a 34', '35 a 44', '45 a 54', '55 ou mais']);
  const fxTc = faixa(casas, [0, 0.25, 1, 2, 5, 10, 200], ['Menos de 3 meses', '3 meses a 1 ano', '1 a 2 anos', '2 a 5 anos', '5 a 10 anos', 'Mais de 10 anos']);
  const cont = k => { const o = {}; F.forEach(f => { const v = str(f[k] || (k === 'tamCamisa' ? f.tamRoupa : '')).trim(); if (v) o[v] = (o[v] || 0) + 1; }); return o; };
  const ordTam = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'EXG', 'XGG', 'G1', 'G2', 'G3', 'G4'];
  const tamL = (o, ord) => Object.entries(o).sort((a, b) => ord ? (ord.indexOf(a[0]) + 99 * (ord.indexOf(a[0]) < 0)) - (ord.indexOf(b[0]) + 99 * (ord.indexOf(b[0]) < 0)) : num(a[0]) - num(b[0])).map(([t, v]) => ({ t, v, cor: 'var(--s3)' }));
  const semNasc = F.filter(f => !f.nascimento).length, semAdm = F.filter(f => !f.admissao).length, semTam = F.filter(f => !(f.tamCamisa || f.tamRoupa) || !f.tamCalca || !f.tamCalcado).length, semMat = F.filter(f => !f.matricula).length, semArea = F.filter(f => !f.areaId && !f.area).length;
  const novatos = F.filter(f => { const a = anosEntre(f.admissao); return a != null && a < 0.25; }).length;
  $('#ind-body').innerHTML = `<div class="kpis">${kpi('Funcionários ativos', n) + kpi('Idade média', idades.length ? fmtAnos(media(idades)) : '—', '', idades.length < n ? `${idades.length} de ${n} com nascimento` : '') + kpi('Tempo de casa médio', fmtAnos(media(casas)), 'info', casas.length < n ? `${casas.length} de ${n} com admissão` : '') + kpi('Admitidos nos últimos 3 meses', novatos, novatos ? 'info' : '') + kpi('Afastados', af, af ? 'warn' : '', fe ? fe + ' de férias' : '') + kpi('Trabalham em altura', F.filter(f => f.altura).length, '', n ? pct(F.filter(f => f.altura).length, n) + '% do total' : '')}</div>
    <div class="card" style="margin-top:12px"><div class="head" style="margin:0 0 8px"><p class="ct" style="margin:0;margin-right:auto">Por ${gNome.toLowerCase()}</p><select id="pes-grp" style="width:auto;padding:6px 10px">${Object.entries(GRP).map(([k, [t]]) => `<option value="${k}" ${V.grp === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="tbwrap" style="margin:0"><table class="tb"><thead><tr><th>${gNome}</th><th class="n">Pessoas</th><th class="n">Idade média</th><th class="n">Tempo de casa médio</th><th class="n">Em altura</th></tr></thead><tbody>${G.map(g => `<tr><td>${esc(g.k)}</td><td class="n">${g.n}</td><td class="n">${fmtAnos(g.id)}</td><td class="n">${fmtAnos(g.tc)}</td><td class="n">${g.alt || ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="rgrid"><div class="card"><p class="ct">Faixa etária</p>${idades.length ? barras(fxId.map(x => ({ t: x.t, v: x.v, cor: 'var(--s1)' }))) : '<div class="empty">Preencha a data de nascimento no cadastro (ou importe a planilha com a coluna NASCIMENTO).</div>'}</div>
    <div class="card"><p class="ct">Tempo de casa</p>${barras(fxTc.map(x => ({ t: x.t, v: x.v, cor: 'var(--s2)' })))}</div>
    <div class="card"><p class="ct">Admissões por mês (12 meses)</p>${barras(M12.map((m, i) => ({ t: mesNome(m), v: adm[i] })))}</div>
    <div class="card"><p class="ct">Por unidade</p>${barras(Object.entries(F.reduce((o, f) => (o[f.unidade || 'Sem unidade'] = (o[f.unidade || 'Sem unidade'] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ t, v, s: v + ' · ' + pct(v, n) + '%' })))}</div>
    <div class="card"><p class="ct">Tamanho de camisa (para compra de uniforme)</p>${barras(tamL(cont('tamCamisa'), ordTam))}</div>
    <div class="card"><p class="ct">Tamanho de calça</p>${barras(tamL(cont('tamCalca')))}</div>
    <div class="card"><p class="ct">Número do calçado</p>${barras(tamL(cont('tamCalcado')))}</div>
    <div class="card"><p class="ct">Cadastro incompleto</p>${barras([{ t: 'Sem data de nascimento', v: semNasc, max: n }, { t: 'Sem tamanhos completos', v: semTam, max: n }, { t: 'Sem admissão', v: semAdm, max: n }, { t: 'Sem área', v: semArea, max: n }, { t: 'Sem matrícula', v: semMat, max: n }].map(x => Object.assign(x, { s: x.v + ' de ' + n, cor: x.v ? 'var(--bad)' : 'var(--ok)' })))}</div></div>
    <h3>Mais antigos e mais novos de casa</h3><div class="rgrid"><div class="card" style="padding:4px 12px">${F.filter(f => f.admissao).sort((a, b) => str(a.admissao).localeCompare(str(b.admissao))).slice(0, 8).map(f => `<button class="ritem lk" data-pessoa="${esc(f.id)}"><div class="main"><b>${esc(f.nome)}</b><div class="note">${esc(f.funcao || '')} · ${esc(f.area || '')}</div></div><span class="badge b-info">${fmtAnos(anosEntre(f.admissao))}</span></button>`).join('') || '<p class="note">Sem datas de admissão.</p>'}</div>
    <div class="card" style="padding:4px 12px">${F.filter(f => f.admissao).sort((a, b) => str(b.admissao).localeCompare(str(a.admissao))).slice(0, 8).map(f => `<button class="ritem lk" data-pessoa="${esc(f.id)}"><div class="main"><b>${esc(f.nome)}</b><div class="note">${esc(f.funcao || '')} · admitido em ${fmtD(f.admissao)}</div></div><span class="badge b-mut">${fmtAnos(anosEntre(f.admissao))}</span></button>`).join('')}</div></div>`;
  $('#pes-grp').onchange = e => { V.grp = e.target.value; tPes(); };
}
function tTrein() {
  const F = pessoas(), G = grupos(); let req = 0, ok = 0; const porG = G.map(g => { let r = 0, o = 0; F.forEach(f => { if (!obrig(g, f)) return; r++; const u = ultimo(f.id, g.k); if (u && ['ok', 'vence'].includes(trState(u))) o++; }); req += r; ok += o; return { g, r, o }; }).filter(x => x.r);
  const ids = new Set(F.map(f => f.id)); const last = {}; D.tr.filter(r => ids.has(r.funcionarioId)).forEach(r => { const k = r.funcionarioId + '|' + grupoKey(r); if (!last[k] || str(last[k].termino) < str(r.termino)) last[k] = r; });
  const L = Object.values(last); const venc = L.filter(r => trState(r) === 'vencido'), vence = L.filter(r => trState(r) === 'vence');
  const M6 = meses(6); const horas = M6.map(m => D.tr.filter(r => ids.has(r.funcionarioId) && str(r.termino).slice(0, 7) === m && str(r.termino) <= hoje()).reduce((a, r) => a + num(r.cargaHoraria), 0) + D.ext.filter(x => ids.has(x.funcionarioId) && str(x.termino).slice(0, 7) === m).reduce((a, x) => a + num(x.cargaHoraria), 0));
  const prox = []; for (let i = 0; i < 4; i++) { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() + i, 1); prox.push(x.getFullYear() + '-' + z2(x.getMonth() + 1)); }
  const vcm = prox.map(m => L.filter(r => str(r.validade).slice(0, 7) === m).length + D.ext.filter(x => ids.has(x.funcionarioId) && str(x.validade).slice(0, 7) === m).length);
  const M = D.mat.filter(m => ids.has(m.funcionarioId)); const notas = []; M.forEach(m => Object.values(m.prog || {}).forEach(p => { if (p.nota != null && p.ok) notas.push(num(p.nota)); }));
  const subs = D.areas.flatMap(a => (a.subs || []).filter(s => !(AREA_FIXA || V.area) || a.id === (AREA_FIXA || V.area)).map(s => ({ s, a })));
  const porSub = subs.map(({ s, a }) => { const P = F.filter(f => subsDe(f).includes(s.id)); let r = 0, o = 0; P.forEach(f => G.forEach(g => { if (!obrig(g, f)) return; r++; const u = ultimo(f.id, g.k); if (u && ['ok', 'vence'].includes(trState(u))) o++; })); return { t: a.nome + ' → ' + s.nome, r, o, n: P.length }; }).filter(x => x.r);
  $('#ind-body').innerHTML = `<div class="kpis">${kpi('NRs obrigatórias em dia', req ? pct(ok, req) + '%' : '—', req ? (pct(ok, req) >= 90 ? 'ok' : 'warn') : '', `${ok} de ${req}`) + kpi('Vencidos', venc.length, venc.length ? 'bad' : '') + kpi('Vencem em 60 dias', vence.length, vence.length ? 'warn' : '') + kpi('Horas no mês', horas[5], 'info', 'treinamentos concluídos') + kpi('Cursos EaD concluídos', M.filter(m => m.concluidoEm).length, '', `${M.filter(m => !m.concluidoEm).length} em andamento`) + kpi('Nota média EaD', notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) + '%' : '—')}</div>
    <div class="rgrid"><div class="card"><p class="ct">Em dia por NR (obrigatórias da função)</p>${barras(porG.map(x => ({ t: x.g.nome, v: pct(x.o, x.r), max: 100, s: `${pct(x.o, x.r)}% · ${x.o}/${x.r}`, cor: corPct(pct(x.o, x.r)) })))}</div>
    <div class="card"><p class="ct">Em dia por subárea</p>${porSub.length ? barras(porSub.map(x => ({ t: x.t, v: pct(x.o, x.r), max: 100, s: `${pct(x.o, x.r)}% · ${x.n} pessoas`, cor: corPct(pct(x.o, x.r)) }))) : '<div class="empty">Aloque as pessoas nas áreas (módulo Treinamentos → Cadastros → Áreas).</div>'}</div>
    <div class="card"><p class="ct">Horas de treinamento por mês</p>${barras(M6.map((m, i) => ({ t: mesNome(m), v: horas[i], s: horas[i] + 'h', cor: 'var(--s1)' })))}</div>
    <div class="card"><p class="ct">Vencimentos nos próximos meses</p>${barras(prox.map((m, i) => ({ t: mesNome(m), v: vcm[i], cor: i === 0 ? 'var(--bad)' : '#c98a00' })))}</div></div>
    <h3>Vencidos e vencendo</h3><div class="card" style="padding:4px 12px">${venc.concat(vence).sort((a, b) => str(a.validade).localeCompare(str(b.validade))).slice(0, 40).map(r => `<button class="ritem lk" data-pessoa="${esc(r.funcionarioId)}"><div class="main"><b>${esc(r.nome)}</b><div class="note">${esc(r.tipoNome)}</div></div>${trBadge(r)}</button>`).join('') || '<p class="note">Nenhum. 👍</p>'}</div>`;
}
function tPad() {
  const nv = V.nav[V.nav.length - 1] || { k: 'raiz' };
  const crumbs = [{ k: 'raiz', t: 'Áreas' }].concat(V.nav.map(n => ({ k: n.k, t: n.t })));
  const bc = `<div class="crumbs">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<button class="link" data-bc="${i}">${esc(c.t)}</button> ›` : `<b>${esc(c.t)}</b>`).join(' ')}</div>`;
  const F = pessoas(); const P = D.pad.filter(p => p.ativo !== false);
  const resumo = (pads, gente) => { let n = 0, o = 0; pads.forEach(p => gente.forEach(f => { if (!precisa(p, f)) return; n++; if (padSt(p, f.id).st === 'ok') o++; })); return { n, o }; };
  let h = '';
  if (nv.k === 'raiz') {
    const tot = resumo(P, F);
    const areas = D.areas.filter(a => !(AREA_FIXA || V.area) || a.id === (AREA_FIXA || V.area)).map(a => { const ss = (a.subs || []).map(s => s.id); const pads = P.filter(p => p.areaId === a.id || (p.subIds || []).some(s => ss.includes(s))); const gente = F.filter(f => subsDe(f).some(s => ss.includes(s))); return Object.assign({ a, pads, gente }, resumo(pads, gente)); });
    h = `<div class="kpis k5">${kpi('Padrões ativos', P.length) + kpi('Treinamentos em dia', tot.n ? pct(tot.o, tot.n) + '%' : '—', tot.n && tot.o < tot.n ? 'warn' : 'ok', `${tot.o} de ${tot.n}`) + kpi('Pendências', tot.n - tot.o, tot.n - tot.o ? 'bad' : '') + kpi('Áreas', areas.length) + kpi('Pessoas alocadas', F.filter(f => subsDe(f).length).length)}</div>
      <h3>Toque na área para ver os padrões e as pessoas</h3>${areas.length ? `<div class="mods">${areas.map(x => `<button class="mod" data-area="${esc(x.a.id)}"><h3>${esc(x.a.nome)}</h3><p>${x.pads.length} padrão(ões) · ${x.gente.length} pessoa(s)</p><div class="bb" style="margin-top:6px"><i style="width:${pct(x.o, x.n)}%;background:${corPct(pct(x.o, x.n))}"></i></div><div class="pf">${x.n ? pct(x.o, x.n) + '% treinado · ' + (x.n - x.o) + ' pendente(s)' : 'sem padrões ou sem pessoas'}</div></button>`).join('')}</div>` : '<div class="empty">Nenhuma área cadastrada.</div>'}`;
  } else if (nv.k === 'area') {
    const a = D.areas.find(x => x.id === nv.id); const ss = (a.subs || []).map(s => s.id);
    const pads = P.filter(p => p.areaId === a.id || (p.subIds || []).some(s => ss.includes(s))); const gente = F.filter(f => subsDe(f).some(s => ss.includes(s))).sort((x, y) => str(x.nome).localeCompare(str(y.nome), 'pt'));
    h = `<div class="rgrid"><div><h3>Padrões (${pads.length})</h3><div class="card" style="padding:4px 12px">${pads.map(p => { const r = resumo([p], F); return `<button class="ritem lk" data-padrao="${esc(p.id)}"><div class="main"><b>${esc(p.codigo)}</b> ${esc(p.titulo)}<div class="note">Rev. ${esc(p.rev)} · ${esc((p.subIds || []).map(subNome).join(', '))}</div></div><span class="badge ${r.o === r.n ? 'b-ok' : 'b-warn'}">${r.o}/${r.n}</span></button>`; }).join('') || '<p class="note">Nenhum padrão.</p>'}</div></div>
      <div><h3>Pessoas alocadas (${gente.length})</h3><div class="card" style="padding:4px 12px">${gente.map(f => { const L = P.filter(p => precisa(p, f)); const o = L.filter(p => padSt(p, f.id).st === 'ok').length; return `<button class="ritem lk" data-pessoa="${esc(f.id)}"><div class="main"><b>${esc(f.nome)}</b><div class="note">${esc(f.funcao || '')}</div></div><span class="badge ${o === L.length ? 'b-ok' : 'b-warn'}">${o}/${L.length} padrões</span></button>`; }).join('') || '<p class="note">Ninguém alocado.</p>'}</div></div></div>`;
  } else if (nv.k === 'padrao') {
    const p = D.pad.find(x => x.id === nv.id); const L = F.filter(f => precisa(p, f)).map(f => ({ f, s: padSt(p, f.id) }));
    const g = k => L.filter(x => x.s.st === k || (k === 'rev' && x.s.st === 'recicl'));
    const lin = x => `<button class="ritem lk" data-pessoa="${esc(x.f.id)}"><div class="main"><b>${esc(x.f.nome)}</b><div class="note">${esc(x.f.funcao || '')}${x.s.r ? ` · rev. ${esc(x.s.r.rev)} em ${fmtD(x.s.r.data)}` : ''}</div></div>${padBadge(x.s.st)}</button>`;
    h = `<div class="card"><b>${esc(p.codigo)} · ${esc(p.titulo)}</b><div class="note">Revisão ${esc(p.rev)} de ${fmtD(p.revData)} · ${esc((p.subIds || []).map(subNome).join(', '))}</div><div class="actions"><button class="btn primary" data-arq="${esc(p.arquivoId)}">Abrir o padrão (PDF)</button></div></div>
      <div class="kpis k5" style="margin-bottom:10px">${kpi('Treinados', g('ok').length, 'ok') + kpi('Pendentes', g('pend').length, g('pend').length ? 'bad' : '') + kpi('Revisão desatualizada', g('rev').length, g('rev').length ? 'warn' : '')}</div>
      <h3>Pendentes</h3><div class="card" style="padding:4px 12px">${g('pend').map(lin).join('') || '<p class="note">Ninguém.</p>'}</div><h3>Revisão desatualizada / reciclagem</h3><div class="card" style="padding:4px 12px">${g('rev').map(lin).join('') || '<p class="note">Ninguém.</p>'}</div><h3>Treinados</h3><div class="card" style="padding:4px 12px">${g('ok').map(lin).join('') || '<p class="note">Ninguém.</p>'}</div>`;
  } else if (nv.k === 'pessoa') h = fichaPessoa(nv.id);
  $('#ind-body').innerHTML = bc + h;
}
function fichaPessoa(fid) {
  const f = D.func.find(x => x.id === fid) || {}; const P = D.pad.filter(p => p.ativo !== false && precisa(p, f)).map(p => ({ p, s: padSt(p, f.id) }));
  const G = grupos().map(g => ({ g, u: ultimo(f.id, g.k), ob: obrig(g, f) })).filter(x => x.u || x.ob);
  const last = {}; D.ext.filter(x => x.funcionarioId === f.id).forEach(x => { const k = norm(x.tipo); if (!last[k] || str(last[k].termino) < str(x.termino)) last[k] = x; });
  const M = D.mat.filter(m => m.funcionarioId === f.id);
  return `<div class="card"><b style="font-size:18px">${esc(f.nome)}</b><div class="note">${esc([f.matricula, f.funcao, f.unidade].filter(Boolean).join(' · '))}${f.nascimento ? ' · ' + Math.floor(anosEntre(f.nascimento)) + ' anos' : ''}${f.admissao ? ' · ' + fmtAnos(anosEntre(f.admissao)) + ' de casa' : ''}${f.situacao && f.situacao !== 'Trabalhando' ? ' · ' + esc(f.situacao) : ''}</div><div style="margin-top:6px">${subsDe(f).map(s => `<span class="badge b-info" style="margin:2px">${esc(subNome(s))}</span>`).join('') || '<span class="note">Sem área</span>'}</div></div>
    <div class="rgrid"><div><h3>Padrões operacionais (${P.filter(x => x.s.st === 'ok').length}/${P.length})</h3><div class="card" style="padding:4px 12px">${P.map(x => `<button class="ritem lk" data-padrao="${esc(x.p.id)}"><div class="main"><b>${esc(x.p.codigo)}</b> ${esc(x.p.titulo)}<div class="note">Rev. ${esc(x.p.rev)}${x.s.r ? ` · assinou rev. ${esc(x.s.r.rev)} em ${fmtD(x.s.r.data)}` : ''}</div></div>${padBadge(x.s.st)}</button>`).join('') || '<p class="note">Nenhum padrão para as áreas desta pessoa.</p>'}</div></div>
    <div><h3>NRs</h3><div class="card" style="padding:4px 12px">${G.map(x => `<div class="ritem"><div class="main"><b>${esc(x.g.nome)}</b>${x.ob ? ' <span class="note">obrigatória</span>' : ''}<div class="note">${x.u ? esc(x.u.tipoNome) + ' · ' + fmtD(x.u.termino) : ''}</div></div>${x.u ? trBadge(x.u) : '<span class="badge b-bad">Falta</span>'}</div>`).join('') || '<p class="note">Nenhuma.</p>'}</div>
    <h3>Externos</h3><div class="card" style="padding:4px 12px">${Object.values(last).map(x => `<div class="ritem"><div class="main"><b>${esc(x.tipo)}</b><div class="note">${esc(x.entidade || '')} · ${fmtD(x.termino)}</div></div>${extSt(x) === 'vencido' ? `<span class="badge b-bad">Vencido ${fmtD(x.validade)}</span>` : extSt(x) === 'vence' ? `<span class="badge b-warn">Vence ${fmtD(x.validade)}</span>` : x.validade ? `<span class="badge b-ok">Até ${fmtD(x.validade)}</span>` : '<span class="badge b-mut">Sem validade</span>'}${x.arquivoId ? ` <button class="btn sm ghost" data-arq="${esc(x.arquivoId)}">Anexo</button>` : ''}</div>`).join('') || '<p class="note">Nenhum.</p>'}</div>
    ${M.length ? `<h3>Cursos on-line</h3><div class="card" style="padding:4px 12px">${M.map(m => `<div class="ritem"><div class="main"><b>${esc((D.cursos.find(c => c.id === m.cursoId) || {}).nome || 'Curso')}</b><div class="note">${Math.round(num(m.tempo) / 360) / 10}h de estudo</div></div>${m.certId ? '<span class="badge b-ok">Certificado</span>' : m.concluidoEm ? '<span class="badge b-info">Teoria concluída</span>' : '<span class="badge b-warn">Em andamento</span>'}</div>`).join('')}</div>` : ''}</div></div>`;
}
const desde = () => V.per === 'all' ? '' : addDays(-num(V.per));
function idsArea() { return (AREA_FIXA || V.area) ? new Set(pessoas().map(f => f.id)) : null; }
function tFerr() {
  const ids = idsArea(); const F = D.ferr.filter(f => f.status !== 'baixada'); const cut = desde();
  const ab = D.caut.filter(c => c.status === 'aberta' && (!ids || ids.has(c.funcionarioId)));
  const pend = c => (c.itens || []).filter(i => i && !i.devolvido);
  const atraso = ab.filter(c => str(c.previsaoDevolucao) && str(c.previsaoDevolucao) < hoje()).reduce((a, c) => a + pend(c).length, 0);
  const oc = []; D.caut.forEach(c => { if (ids && !ids.has(c.funcionarioId)) return; (c.itens || []).forEach(i => { if (i.devolvido && ['mau_uso', 'extraviado', 'danificado'].includes(i.estadoDevolucao) && (!cut || str(i.devolvidaEm).slice(0, 10) >= cut)) oc.push({ c, i }); }); });
  const porF = {}; oc.forEach(x => { porF[x.c.funcionarioNome] = (porF[x.c.funcionarioNome] || 0) + 1; });
  const porE = {}; F.forEach(f => { const k = f.estoqueId ? ((D.est.find(e => e.id === f.estoqueId) || {}).nome || 'Estoque') : 'Estoque geral'; porE[k] = (porE[k] || 0) + num(f.valor); });
  const cal = F.filter(f => f.validadeCalibracao && str(f.validadeCalibracao) < hoje()).length;
  const valor = F.filter(f => f.status !== 'extraviada').reduce((a, f) => a + num(f.valor), 0);
  $('#ind-body').innerHTML = `<div class="kpis">${kpi('Ferramentas', F.length, '', brl(valor)) + kpi('Emprestadas', ab.reduce((a, c) => a + pend(c).length, 0), 'info') + kpi('Itens em atraso', atraso, atraso ? 'bad' : '') + kpi('Mau uso / extravio', oc.length, oc.length ? 'warn' : '', 'no período') + kpi('Calibração vencida', cal, cal ? 'bad' : '') + kpi('Extraviadas', F.filter(f => f.status === 'extraviada').length)}</div>
    <div class="rgrid"><div class="card"><p class="ct">Patrimônio por estoque</p>${barras(Object.entries(porE).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ t, v, s: brl(v) })))}</div>
    <div class="card"><p class="ct">Mau uso, dano e extravio por funcionário</p>${barras(Object.entries(porF).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, v]) => ({ t, v, cor: 'var(--s2)' })))}</div></div>`;
}
function tEpi() {
  const ids = idsArea(); const cut = desde(); const E = D.ent.filter(e => (!ids || ids.has(e.funcionarioId)) && (!cut || str(e.data).slice(0, 10) >= cut));
  const custo = e => num(e.custo) * (num(e.qtd) || 1); const tot = E.reduce((a, e) => a + custo(e), 0);
  const M6 = meses(6); const porM = M6.map(m => D.ent.filter(e => (!ids || ids.has(e.funcionarioId)) && str(e.data).slice(0, 7) === m).reduce((a, e) => a + custo(e), 0));
  const grp = (k, f) => { const o = {}; E.forEach(e => { const x = f(e); o[x] = (o[x] || 0) + custo(e); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const MOT = { inicial: 'Entrega inicial', desgaste: 'Desgaste normal', validade: 'Fim da vida útil', higiene: 'Higienização', dano: 'Dano em serviço', tamanho: 'Tamanho inadequado', mau_uso: 'Mau uso', perda: 'Perda / extravio' };
  const qm = {}; E.forEach(e => { const k = MOT[e.motivo] || e.motivo || '—'; qm[k] = (qm[k] || 0) + num(e.qtd); });
  const ca = D.epis.filter(p => p.validadeCA && str(p.validadeCA) <= addDays(60)).length;
  $('#ind-body').innerHTML = `<div class="kpis">${kpi('Gasto no período', brl(tot), 'info') + kpi('Entregas', E.length) + kpi('Pessoas atendidas', new Set(E.map(e => e.funcionarioId)).size) + kpi('Gasto médio por pessoa', brl(tot / Math.max(1, new Set(E.map(e => e.funcionarioId)).size))) + kpi('Trocas por mau uso / perda', E.filter(e => ['mau_uso', 'perda'].includes(e.motivo)).length, 'warn') + kpi('CA vencido ou vencendo', ca, ca ? 'warn' : '')}</div>
    <div class="rgrid"><div class="card"><p class="ct">Gasto por mês</p>${barras(M6.map((m, i) => ({ t: mesNome(m), v: porM[i], s: brl(porM[i]) })))}</div>
    <div class="card"><p class="ct">Gasto por estoque</p>${barras(grp('e', e => e.estoqueNome || 'Estoque geral').map(([t, v]) => ({ t, v, s: brl(v) })))}</div>
    <div class="card"><p class="ct">Quem mais recebeu (R$)</p>${barras(grp('f', e => e.funcionarioNome).slice(0, 10).map(([t, v]) => ({ t, v, s: brl(v), cor: 'var(--s3)' })))}</div>
    <div class="card"><p class="ct">Motivos de troca (peças)</p>${barras(Object.entries(qm).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ t, v, cor: ['Mau uso', 'Perda / extravio'].includes(t) ? 'var(--s2)' : 'var(--s1)' })))}</div></div>`;
}

/* ---------- anexos (PDF do padrão, certificados) ---------- */
async function abrirArquivo(id) {
  if (!id) return toast('Sem arquivo.', 'bad');
  const w = window.open('', '_blank'); if (w) w.document.write('<p style="font:16px system-ui;padding:20px">Abrindo…</p>');
  try { const m = await db.doc('arquivos/' + id).get(); if (!m.exists) throw new Error('Arquivo não encontrado'); const meta = m.data(); let b64 = '';
    for (let i = 0; i < num(meta.partes); i++) { const p = await db.doc(`arquivos/${id}/p/${i}`).get(); b64 += p.data().d; }
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: meta.tipo })); if (w) w.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { if (w) w.close(); toast('Não foi possível abrir: ' + (e.message || e), 'bad'); }
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-t]'); if (t) { V.tab = t.dataset.t; V.nav = []; render(); return; }
  const a = e.target.closest('[data-area]'); if (a) { const x = D.areas.find(y => y.id === a.dataset.area); V.tab = 'pad'; V.nav = [{ k: 'area', id: x.id, t: x.nome }]; render(); window.scrollTo(0, 0); return; }
  const p = e.target.closest('[data-padrao]'); if (p) { const x = D.pad.find(y => y.id === p.dataset.padrao); V.tab = 'pad'; V.nav = V.nav.filter(n => n.k === 'area').concat([{ k: 'padrao', id: x.id, t: x.codigo }]); render(); window.scrollTo(0, 0); return; }
  const f = e.target.closest('[data-pessoa]'); if (f) { const x = D.func.find(y => y.id === f.dataset.pessoa) || {}; if (V.tab !== 'pad') { V.tab = 'pad'; V.nav = []; } V.nav = V.nav.filter(n => n.k !== 'pessoa').concat([{ k: 'pessoa', id: f.dataset.pessoa, t: str(x.nome).split(' ')[0] }]); render(); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-bc]'); if (b) { V.nav = V.nav.slice(0, +b.dataset.bc); render(); return; }
  const q = e.target.closest('[data-arq]'); if (q) abrirArquivo(q.dataset.arq);
});
$('#ind-area').onchange = e => { V.area = e.target.value; V.nav = []; render(); };
$('#ind-per').onchange = e => { V.per = e.target.value; render(); };
$('#ind-re').onclick = () => carregar();

(async () => {
  db = await claude.use('db');
  const pm = (window.__FB && window.__FB.papel) || '';
  if (/^area:/.test(pm)) AREA_FIXA = pm.slice(5);
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; } }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  carregar();
})();
