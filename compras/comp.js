/* Previsão de compra de EPI: para cada EPI, quanto vai sair nos próximos N dias e quanto comprar.
   Saída prevista = consumo médio dos últimos 6 meses (entregas) × meses do horizonte (ou as trocas que vencem no período, pela próxima troca de cada entrega, o que for maior)
   + kits das admissões em andamento ainda não separados (epi_separacao). Comprar = saída prevista + estoque mínimo − estoque total. */
"use strict";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v); const num = v => +v || 0;
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const addDias = (d, n) => { const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const D = { epis: [], ent: [], kits: [], func: [], sep: [] }; const V = { dias: 60, so: 'comprar', busca: '' }; let db = null;
const kitFuncs = k => [k.funcao].concat(Array.isArray(k.funcoesAlt) ? k.funcoesAlt : []).map(norm).filter(Boolean);
const totalEpi = p => num(p.estoque) + Object.values(p.saldos || {}).reduce((a, v) => a + num(v), 0);

function calc() {
  const hj = hoje(), ini6 = addDias(hj, -182), fim = addDias(hj, V.dias), meses = V.dias / 30.4;
  const cons = {}; D.ent.filter(e => str(e.data).slice(0, 10) >= ini6).forEach(e => { cons[e.epiId] = (cons[e.epiId] || 0) + (num(e.qtd) || 1); });
  // admissões em andamento: itens do kit ainda não marcados como separados
  const adm = {}; D.sep.filter(s => s.status !== 'cancelado' && !s.mobilizado).forEach(s => { const ks = D.kits.filter(k => kitFuncs(k).includes(norm(s.funcao)));
    const vistos = new Set(); ks.forEach(k => (k.epis || []).forEach(x => { if (!x || !x.epiId || vistos.has(x.epiId)) return; vistos.add(x.epiId); const m = (s.marc || {})[x.epiId]; if (m && m.st === 'ok') return; adm[x.epiId] = (adm[x.epiId] || 0) + (num(x.qtd) || 1); })); });
  // trocas periódicas: última entrega de cada EPI por pessoa ativa com próxima troca (proximaTroca) dentro do horizonte
  const troca = {}; const ult = {}; const ativos = new Set(D.func.filter(f => f.ativo !== false).map(f => f.id));
  D.ent.forEach(e => { if (!ativos.has(e.funcionarioId)) return; const k = e.funcionarioId + '|' + e.epiId; if (!ult[k] || str(e.data) > str(ult[k].data)) ult[k] = e; });
  Object.values(ult).forEach(e => { const pt = str(e.proximaTroca).slice(0, 10); if (pt && pt <= fim) troca[e.epiId] = (troca[e.epiId] || 0) + 1; });
  return D.epis.filter(p => p.ativo !== false).map(p => {
    const mes = (cons[p.id] || 0) / 6; const prevCons = Math.ceil(mes * meses); const a = adm[p.id] || 0, t = troca[p.id] || 0;
    const saida = Math.max(prevCons, t) + a; const est = totalEpi(p); const min = num(p.estoqueMin); const comprar = Math.max(0, Math.ceil(saida + min - est));
    const dur = mes > 0 ? Math.floor(est / mes * 30.4) : null;
    return { p, mes, prevCons, a, t, saida, est, min, comprar, dur, custo: comprar * num(p.custo) };
  }).sort((x, y) => y.comprar - x.comprar || str(x.p.nome).localeCompare(str(y.p.nome), 'pt'));
}
function render() {
  let L = calc(); const tot = L.filter(x => x.comprar > 0); const custo = tot.reduce((a, x) => a + x.custo, 0);
  if (V.so === 'comprar') L = tot; if (V.busca) L = L.filter(x => norm(x.p.nome + ' ' + (x.p.ca || '')).includes(norm(V.busca)));
  $('#body').innerHTML = `<div class="card"><div class="ct">Previsão de compra de EPI</div>
    <p class="cs">Saída prevista = o maior entre o consumo médio dos últimos 6 meses e as trocas periódicas que vencem no período, mais os kits das admissões em andamento ainda não separados. Comprar = saída prevista + estoque mínimo − estoque atual (geral + obras).</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><select id="dias" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px">${[30, 60, 90, 120].map(d => `<option value="${d}" ${V.dias === d ? 'selected' : ''}>Próximos ${d} dias</option>`).join('')}</select>
      <select id="so" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="comprar" ${V.so === 'comprar' ? 'selected' : ''}>Só o que precisa comprar</option><option value="" ${V.so === '' ? 'selected' : ''}>Todos os EPIs</option></select>
      <input id="busca" placeholder="Buscar EPI ou CA" value="${esc(V.busca)}" style="flex:1;min-width:140px;padding:8px;border:1px solid #cfd4dc;border-radius:8px"><button class="btn sm ghost" id="exp" type="button">Exportar lista de compra</button></div></div>
    <div class="kpis">${kpi('EPIs a comprar', tot.length, tot.length ? 'warn' : '')}${kpi('Unidades', tot.reduce((a, x) => a + x.comprar, 0))}${custo ? kpi('Custo estimado', brl(custo)) : ''}${kpi('Admissões em andamento', D.sep.filter(s => !s.mobilizado && s.status !== 'cancelado').length)}</div>
    <div class="card" style="overflow:auto"><table class="tb" style="font-size:13px"><thead><tr><th style="text-align:left">EPI</th><th>Estoque</th><th>Mínimo</th><th>Consumo/mês</th><th>Trocas</th><th>Admissões</th><th>Saída prevista</th><th>Dura (dias)</th><th>Comprar</th></tr></thead>
    <tbody>${L.map(x => `<tr><td>${esc(x.p.nome)}${x.p.ca ? `<br><span style="font-size:11px;color:var(--muted)">CA ${esc(x.p.ca)}</span>` : ''}</td><td style="text-align:right">${x.est}</td><td style="text-align:right">${x.min || '—'}</td><td style="text-align:right">${x.mes ? x.mes.toFixed(1).replace('.', ',') : '—'}</td><td style="text-align:right">${x.t || '—'}</td><td style="text-align:right">${x.a || '—'}</td><td style="text-align:right">${x.saida}</td><td style="text-align:right;${x.dur != null && x.dur < V.dias ? 'color:var(--bad);font-weight:600' : ''}">${x.dur == null ? '—' : x.dur}</td><td style="text-align:right"><b>${x.comprar || '—'}</b></td></tr>`).join('') || '<tr><td colspan="9" style="color:var(--muted)">Nada a comprar no período.</td></tr>'}</tbody></table></div>`;
  $('#dias').onchange = e => { V.dias = +e.target.value; render(); }; $('#so').onchange = e => { V.so = e.target.value; render(); };
  const b = $('#busca'); b.oninput = () => { clearTimeout(b._t); b._t = setTimeout(() => { V.busca = b.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Previsão de compra de EPI (próximos ' + V.dias + ' dias)', cols: [{ t: 'EPI' }, { t: 'CA' }, { t: 'Estoque', tipo: 'int' }, { t: 'Mínimo', tipo: 'int' }, { t: 'Consumo/mês', tipo: 'num' }, { t: 'Trocas', tipo: 'int' }, { t: 'Admissões', tipo: 'int' }, { t: 'Saída prevista', tipo: 'int' }, { t: 'Comprar', tipo: 'int' }],
    linhas: L.map(x => [x.p.nome, x.p.ca || '', x.est, x.min, +x.mes.toFixed(1), x.t, x.a, x.saida, x.comprar]), filtros: 'Próximos ' + V.dias + ' dias', arquivo: 'Compra de EPI' });
}
(async () => {
  db = await claude.use('db');
  const pega = async (c, k) => { try { const q = await db.collection(c).get(); D[k] = q.docs.map(d => Object.assign({}, d.data(), { id: d.id })); } catch (e) { D[k] = []; } };
  await Promise.all([pega('epis', 'epis'), pega('entregas', 'ent'), pega('kits', 'kits'), pega('funcionarios', 'func'), pega('epi_separacao', 'sep')]);
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
