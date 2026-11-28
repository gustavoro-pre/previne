/* Absenteísmo, horas extras e horas noturnas: janelinhas na Visão geral de Pessoas; ao tocar, abre o detalhe logo abaixo.
   Base: extrato mensal da folha (coleção folha). Cada indicador tem filtro de pontos fora da curva (automático, limite de horas
   ou marcação manual por pessoa/mês, salva na própria folha: absExcl / heExcl / notExcl). Só para quem vê salários. */
const HZ = {
  abs: { t: 'Absenteísmo', campo: 'faltash', valor: x => num((x.ag || {}).faltasv) + num((x.ag || {}).faltasDsrv), excl: 'absExcl', taxa: true, lim: 40 },
  he: { t: 'Horas extras', campo: 'heh', valor: x => num((x.ag || {}).hev), excl: 'heExcl', lim: 60 },
  not: { t: 'Horas noturnas', campo: 'adNoth', valor: x => num((x.ag || {}).adNotv), excl: 'notExcl', lim: 120 }
};
const hzV = x => num((x.ag || {})[HZ[V.hz || 'abs'].campo]);
function hzOF(k) { V.hzOF = V.hzOF || (() => { try { return JSON.parse(localStorage.getItem('hzOF') || '{}'); } catch (e) { return {}; } })(); return V.hzOF[k] || (V.hzOF[k] = { modo: 'nao', lim: HZ[k].lim }); }
function hzSalva() { try { localStorage.setItem('hzOF', JSON.stringify(V.hzOF || {})); } catch (e) { } }
/* filtro de um mês para o indicador k */
function hzFiltro(k, X) {
  const c = HZ[k], OF = hzOF(k), val = x => num((x.ag || {})[c.campo]);
  let lim = Infinity;
  if (OF.modo === 'lim') lim = num(OF.lim) || c.lim;
  if (OF.modo === 'auto') { const v = X.filter(ativoNaFolha).map(val).filter(v => v > 0).sort((a, b) => a - b); if (v.length >= 4) { const q = p => { const i = (v.length - 1) * p, f = Math.floor(i); return v[f] + (v[Math.min(f + 1, v.length - 1)] - v[f]) * (i - f); }; lim = q(.75) + 1.5 * (q(.75) - q(.25)); } }
  const fora = x => x[c.excl] === true || val(x) > lim;
  return { lim, fora, limpa: X.filter(x => !fora(x)), out: X.filter(fora) };
}
/* filtros da Visão geral (sexo, função, faixa etária) também valem aqui */
function hzFiltroPes(X) {
  if (!V.fsx && !V.ffn && !V.fid) return X;
  return X.filter(x => { const f = funcDe(x.funcionarioId); if (!f) return false; return filtroPes([f]).length > 0; });
}
const hzSexo = x => { const f = funcDe(x.funcionarioId); return f ? SEXN[sexoDe(f).s] : 'Sem cadastro'; };
function hzResumo(k, comp) {
  const c = HZ[k], X = hzFiltroPes(doMes(comp).filter(ativoNaFolha)), F = hzFiltro(k, X), L = F.limpa;
  const h = L.reduce((a, x) => a + num((x.ag || {})[c.campo]), 0), hm = L.reduce((a, x) => a + (num(x.horasMes) || 220), 0);
  const af = L.reduce((a, x) => a + num((x.ag || {}).afasth), 0);
  return { h, hm, af, t: hm ? h / hm * 100 : 0, ta: hm ? (h + af) / hm * 100 : 0, v: L.reduce((a, x) => a + c.valor(x), 0), pessoas: L.filter(x => num((x.ag || {})[c.campo]) > 0), L, F, X };
}
const hzPct = v => (Math.round(v * 100) / 100).toLocaleString('pt-BR') + '%';

/* janelinhas na Visão geral */
function hzCards() {
  const el = $('#pes-hz'); if (!el || !podeFolha()) return; const C = comps();
  if (!C.length) { el.innerHTML = '<p class="note">Importe a folha em Pessoas › Folha e horas para ver absenteísmo, horas extras e noturnas.</p>'; return; }
  const comp = V.hzComp && C.includes(V.hzComp) ? V.hzComp : C[0]; const ant = C[C.indexOf(comp) + 1];
  const card = (k, n, s, cls) => `<button class="kpi ${cls || ''} ${V.hzOpen === k ? 'on' : ''}" data-hzk="${k}" type="button" style="text-align:left;cursor:pointer;font:inherit"><div class="n">${n}</div><div class="t">${HZ[k].t} · ${mesNome(comp)}${hzOF(k).modo !== 'nao' ? ' <span class="badge b-info">filtrado</span>' : ''}</div><div class="s">${s}</div></button>`;
  const a = hzResumo('abs', comp), aa = ant ? hzResumo('abs', ant) : null, e = hzResumo('he', comp), n = hzResumo('not', comp);
  const seta = (x, y) => y == null ? '' : x > y ? ' ▲' : x < y ? ' ▼' : '';
  el.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${card('abs', hzPct(a.t) + (aa ? seta(a.t, aa.t) : ''), hh(a.h) + ' de falta · ' + a.pessoas.length + ' pessoas', a.t > 3 ? 'bad' : a.t > 1.5 ? 'warn' : 'ok')}${card('he', hh(e.h), brl(e.v) + ' · ' + e.pessoas.length + ' pessoas', 'warn')}${card('not', hh(n.h), brl(n.v) + ' de adicional · ' + n.pessoas.length + ' pessoas', 'info')}</div><div id="pes-hzd"></div>`;
  el.querySelectorAll('[data-hzk]').forEach(b => b.onclick = () => { V.hzOpen = V.hzOpen === b.dataset.hzk ? '' : b.dataset.hzk; V.hzComp = comp; hzCards(); if (V.hzOpen) $('#pes-hzd').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  if (V.hzOpen) hzDetalhe(V.hzOpen);
}

/* detalhe do indicador aberto */
function hzDetalhe(k) {
  const el = $('#pes-hzd'); if (!el) return; const c = HZ[k], C = comps(); V.hz = k;
  const comp = V.hzComp && C.includes(V.hzComp) ? V.hzComp : C[0]; const OF = hzOF(k); const R = hzResumo(k, comp); const L = R.L, X = R.X;
  const val = x => num((x.ag || {})[c.campo]);
  const nomeL = x => { const f = funcDe(x.funcionarioId); return f ? `<a href="#" data-pessoa="${esc(f.id)}">${esc(x.nome)}</a>` : esc(x.nome) + ' <span class="note">(sem cadastro)</span>'; };
  const area = x => { const f = funcDe(x.funcionarioId); return f ? (f.area || 'Sem área') : 'Sem cadastro'; };
  const grp = fn => { const o = {}; L.forEach(x => { const g = fn(x); (o[g] = o[g] || []).push(x); }); return Object.entries(o).map(([g, Y]) => { const h = Y.reduce((a, x) => a + val(x), 0), hm = Y.reduce((a, x) => a + (num(x.horasMes) || 220), 0); return { g, h, t: hm ? h / hm * 100 : 0, n: Y.length }; }).filter(r => r.h > 0).sort((a, b) => c.taxa ? b.t - a.t : b.h - a.h); };
  const lab = r => c.taxa ? hzPct(r.t) + ' · ' + hh(r.h) : hh(r.h) + ' · ' + r.n + ' pessoas';
  const M12 = C.slice(0, 12).reverse();
  const quem = R.pessoas.slice().sort((a, b) => val(b) - val(a));
  const reinc = {}; if (c.taxa) C.slice(C.indexOf(comp), C.indexOf(comp) + 3).forEach(m => hzFiltro(k, doMes(m).filter(ativoNaFolha)).limpa.forEach(x => { if (val(x) > 0) reinc[x.cod] = (reinc[x.cod] || 0) + 1; }));
  const limTxt = OF.modo === 'auto' ? (isFinite(R.F.lim) ? 'acima de ' + hh(R.F.lim) : 'poucos dados para o automático') : OF.modo === 'lim' ? 'acima de ' + hh(OF.lim) : '';
  const kp = c.taxa
    ? kpiG('Absenteísmo (faltas)', hzPct(R.t), R.t > 3 ? 'bad' : R.t > 1.5 ? 'warn' : 'ok', hh(R.h) + ' de ' + hh(R.hm), () => ['Absenteísmo por faltas', `Horas de falta e atraso descontadas ÷ horas contratadas dos ativos × 100 = ${hh(R.h)} ÷ ${hh(R.hm)} × 100.`, tabela(['Nome', 'Cargo', 'Faltas (h)', '% do mês'], quem.map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), hh(val(x)), pc1(val(x), num(x.horasMes) || 220)] })), [2, 3])])
      + kpiG('Com afastamentos', hzPct(R.ta), '', hh(R.af) + ' afastadas', () => ['Faltas + afastamentos', 'Inclui horas de afastamento (INSS / doença).', tabela(['Nome', 'Cargo', 'Situação', 'Horas afastadas'], L.filter(x => num((x.ag || {}).afasth) > 0).map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), esc(x.situacao), hh(x.ag.afasth)] })), [3])])
      + kpiG('Reincidentes (3 meses)', Object.values(reinc).filter(v => v >= 2).length, '', 'faltaram em 2+ meses', () => ['Reincidentes', 'Falta descontada em pelo menos 2 dos últimos 3 meses (com o mesmo filtro).', tabela(['Nome', 'Meses com falta'], Object.entries(reinc).filter(e => e[1] >= 2).map(([cod, n]) => { const x = (D.folha || []).find(y => y.cod === cod); return { pessoa: x && x.funcionarioId, c: [x ? nomeL(x) : cod, n] }; }), [1])])
    : kpiG(c.t + ' no mês', hh(R.h), 'warn', brl(R.v), () => [c.t, '', tabela(['Nome', 'Cargo', 'Horas', 'Valor'], quem.map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), hh(val(x)), brl2(c.valor(x))] })), [2, 3])])
      + kpiG('Média por pessoa', quem.length ? hh(R.h / quem.length) : '—', '', 'entre quem fez', () => [c.t + ' por pessoa', '', tabela(['Nome', 'Cargo', 'Horas'], quem.map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), hh(val(x))] })), [2])]);
  const kc = kpiG('Pessoas', quem.length, '', pc1(quem.length, L.length) + ' dos ativos', () => ['Pessoas no mês', '', tabela(['Nome', 'Cargo', 'Horas'], quem.map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), hh(val(x))] })), [2])])
    + kpiG(c.taxa ? 'Descontado' : 'Valor pago', brl(R.v), '', 'no mês', () => [c.taxa ? 'Valor descontado' : 'Valor pago', '', tabela(['Nome', 'Cargo', 'Valor'], quem.map(x => ({ pessoa: x.funcionarioId, c: [nomeL(x), esc(x.cargo), brl2(c.valor(x))] })), [2])]);
  el.innerHTML = `<div class="card" style="margin-top:10px;border-color:#1f4e9c">
    <div class="head" style="margin:0 0 6px"><p class="ct" style="margin:0;margin-right:auto">${c.t}</p><select id="hz-comp" style="width:auto;padding:7px">${C.map(m => `<option value="${m}" ${m === comp ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select><button class="btn sm ghost" id="hz-x" type="button">Fechar</button></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><b style="font-size:14px">Pontos fora da curva</b>
      <select id="hz-out" style="width:auto;padding:7px"><option value="nao" ${OF.modo === 'nao' ? 'selected' : ''}>Considerar todos</option><option value="auto" ${OF.modo === 'auto' ? 'selected' : ''}>Retirar automático (estatístico)</option><option value="lim" ${OF.modo === 'lim' ? 'selected' : ''}>Retirar acima de…</option></select>
      ${OF.modo === 'lim' ? `<input id="hz-lim" inputmode="decimal" value="${esc(OF.lim)}" style="width:80px;padding:7px"> <span class="note">horas no mês</span>` : ''}
      <span class="note">${R.F.out.length ? `<b>${R.F.out.length}</b> fora da conta (${hh(R.F.out.reduce((a, x) => a + val(x), 0))})${limTxt ? ' · ' + limTxt : ''}` : 'ninguém fora da conta neste mês'}</span></div>
    <p class="note" style="margin:0 0 8px">Quem sai da conta sai inteiro (as horas e as horas contratadas dele). Automático: retira quem passou do 3º quartil + 1,5 × a distância entre quartis do mês. Dá para marcar pessoas uma a uma no fim deste quadro.</p>
    <div class="kpis">${kp}${kc}</div>
    <div class="rgrid"><div class="card"><p class="ct">Por mês</p>${barras(M12.map(m => { const r = hzResumo(k, m); return { t: mesNome(m), v: c.taxa ? r.t : r.h, s: c.taxa ? hzPct(r.t) + ' · ' + hh(r.h) : hh(r.h) + ' · ' + brl(r.v), cor: m === comp ? 'var(--s2)' : 'var(--s1)', data: `data-hzm="${m}"` }; }))}</div>
      <div class="card"><p class="ct">Por sexo</p>${(() => { const G = grp(hzSexo); const tot = (g) => { const Y = L.filter(x => hzSexo(x) === g); return Y.reduce((a, x) => a + (num(x.horasMes) || 220), 0); };
        const T = ['Masculino', 'Feminino'].map(g => { const r = G.find(x => x.g === g) || { g, h: 0, t: 0, n: 0 }; const hm = tot(g); return { g, h: r.h, t: hm ? r.h / hm * 100 : 0, n: r.n, pes: L.filter(x => hzSexo(x) === g).length }; });
        return barras(T.map(r => ({ t: r.g + ' (' + r.pes + ' pessoas)', v: c.taxa ? r.t : r.h, s: lab(r), cor: r.g === 'Feminino' ? '#d6336c' : 'var(--s1)' }))) + `<p class="note" style="margin:4px 0 0">${c.taxa ? 'Taxa = horas de falta das mulheres (ou dos homens) ÷ horas contratadas delas (deles).' : 'Horas no mês por sexo.'} Sexo do cadastro ou estimado pelo primeiro nome.</p>`; })()}</div>
      ${c.taxa ? `<div class="card"><p class="ct">Absenteísmo por sexo, mês a mês</p><div class="tbwrap" style="margin:0"><table class="tb"><thead><tr><th>Mês</th><th class="n">Homens</th><th class="n">Mulheres</th></tr></thead><tbody>${M12.slice(-6).reverse().map(m => { const r = hzResumo(k, m); const t = g => { const Y = r.L.filter(x => hzSexo(x) === g); const hm = Y.reduce((a, x) => a + (num(x.horasMes) || 220), 0); return hm ? hzPct(Y.reduce((a, x) => a + val(x), 0) / hm * 100) : '—'; }; return `<tr><td>${mesNome(m)}</td><td class="n">${t('Masculino')}</td><td class="n">${t('Feminino')}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
      <div class="card"><p class="ct">Por área</p>${barras(grp(area).map(r => ({ t: r.g, v: c.taxa ? r.t : r.h, s: lab(r) })))}</div>
      <div class="card"><p class="ct">Por cargo</p>${barras(grp(x => str(x.cargo).trim() || 'Sem cargo').slice(0, 12).map(r => ({ t: r.g, v: c.taxa ? r.t : r.h, s: lab(r), cor: 'var(--s3)' })))}</div>
      <div class="card"><p class="ct">Quem mais ${c.taxa ? 'faltou' : 'fez'}</p>${barras(quem.slice(0, 12).map(x => ({ t: x.nome, v: val(x), s: hh(val(x)), cor: 'var(--s2)', data: x.funcionarioId ? `data-pessoa="${esc(x.funcionarioId)}"` : '' })))}</div></div>
    <details style="margin-top:6px"><summary class="ct" style="cursor:pointer">Marcar fora da conta (${mesNome(comp)})</summary><p class="note">A marca vale só para este indicador e este mês, fica salva para todos e é mantida se a folha for reimportada.</p>
      <div class="tbwrap" style="margin:0;max-height:420px;overflow:auto"><table class="tb"><thead><tr><th>Fora</th><th>Nome</th><th>Cargo</th><th class="n">Horas</th></tr></thead><tbody>${X.filter(x => val(x) > 0).sort((a, b) => val(b) - val(a)).map(x => `<tr><td><input type="checkbox" data-hzx="${esc(x.id)}" ${x[c.excl] === true ? 'checked' : ''}>${R.F.fora(x) && x[c.excl] !== true ? ' <span class="badge b-warn">pelo filtro</span>' : ''}</td><td>${nomeL(x)}</td><td>${esc(x.cargo)}</td><td class="n">${hh(val(x))}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  $('#hz-x').onclick = () => { V.hzOpen = ''; hzCards(); };
  $('#hz-comp').onchange = e => { V.hzComp = e.target.value; hzCards(); };
  el.querySelectorAll('[data-hzm]').forEach(b => b.onclick = () => { V.hzComp = b.dataset.hzm; hzCards(); });
  $('#hz-out').onchange = e => { OF.modo = e.target.value; hzSalva(); hzCards(); };
  const li = $('#hz-lim'); if (li) li.onchange = () => { OF.lim = num(li.value) || c.lim; hzSalva(); hzCards(); };
  el.querySelectorAll('[data-hzx]').forEach(cb => cb.onchange = async () => { const x = (D.folha || []).find(y => y.id === cb.dataset.hzx); if (!x) return; try { await db.doc('folha/' + x.id).update({ [c.excl]: cb.checked }); x[c.excl] = cb.checked; hzCards(); toast(cb.checked ? 'Fora da conta.' : 'Voltou para a conta.', 'ok'); } catch (e) { cb.checked = !cb.checked; toast('Não foi possível salvar.', 'bad'); } });
}
