/* Indicadores › Pessoas › Salários — só para quem tem a permissão "Vê salários".
   Base: extrato mensal da folha (coleção folha). Encargos patronais são estimativa (Lucro Real). */
const ENC = 0.288; /* INSS patronal 20% + RAT/FAP ~3% + terceiros 5,8% sobre a base do INSS */
const FAIXAS = [[0, 1800], [1800, 2500], [2500, 3500], [3500, 5000], [5000, 8000], [8000, 1e9]];
const faixaT = ([a, b]) => b > 1e8 ? 'acima de ' + brl(a) : a === 0 ? 'até ' + brl(b) : brl(a) + ' a ' + brl(b);
const mediana = L => { if (!L.length) return null; const s = L.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* horista: salário-base menor que R$ 300 é valor da hora; vira mensal pelas horas do mês */
const salM = x => { const v = num(x.salario); return v > 0 && v < 300 && num(x.horasMes) > 0 ? Math.round(v * num(x.horasMes) * 100) / 100 : v; };
/* valores fora da curva (regra do intervalo interquartil: abaixo de Q1 − 1,5×IQR ou acima de Q3 + 1,5×IQR) */
const quartil = (s, q) => { const p = (s.length - 1) * q, b = Math.floor(p); return s[b] + ((s[b + 1] !== undefined ? s[b + 1] : s[b]) - s[b]) * (p - b); };
function semForaDaCurva(X) { if (X.length < 8) return { X, fora: [] }; const s = X.map(salM).sort((a, b) => a - b); const q1 = quartil(s, .25), q3 = quartil(s, .75), i = q3 - q1, lo = q1 - 1.5 * i, hi = q3 + 1.5 * i;
  return { X: X.filter(x => salM(x) >= lo && salM(x) <= hi), fora: X.filter(x => salM(x) < lo || salM(x) > hi), lo, hi }; }
const custoEnc = x => num(x.proventos) + num(x.fgts) + num(x.baseInss || x.proventos) * ENC;

function tSal() {
  (window.__FB && window.__FB.logAcesso ? window.__FB.logAcesso : () => {})('Salários (painel)', V.comp || '');
  const C = comps(); if (!C.length) { PB().innerHTML = '<div class="empty">Nenhuma folha importada. Importe os extratos em <b>Folha e horas</b>.</div>'; return; }
  if (!V.comp || !C.includes(V.comp)) V.comp = C[0];
  const L = doMes(V.comp), at0 = L.filter(ativoNaFolha).filter(x => salM(x) > 0); const SF = V.semOut ? semForaDaCurva(at0) : { X: at0, fora: [] }; const at = SF.X; const sal = at.map(x => salM(x));
  const massa = sal.reduce((a, b) => a + b, 0), prov = L.reduce((a, x) => a + num(x.proventos), 0), enc = L.reduce((a, x) => a + custoEnc(x), 0);
  const ben = benTotal(at.length); const custoTot = enc + ben.total;
  const ant = C[C.indexOf(V.comp) + 1]; const LA = ant ? doMes(ant) : []; const porCod = {}; LA.forEach(x => porCod[x.cod] = x);
  const reaj = at.filter(x => porCod[x.cod] && salM(porCod[x.cod]) > 0 && Math.abs(salM(x) - salM(porCod[x.cod])) >= 1).map(x => ({ x, de: salM(porCod[x.cod]), para: salM(x) }));
  const nomeL = x => { const f = funcDe(x.funcionarioId); return f ? `<a href="#" data-pessoa="${esc(f.id)}">${esc(x.nome)}</a>` : esc(x.nome) + ' <span class="note">(sem cadastro)</span>'; };
  const lin = (x, ex) => ({ pessoa: x.funcionarioId || '', c: [nomeL(x), esc(x.cargo)].concat(ex) });
  const areaDe = x => { const f = funcDe(x.funcionarioId); return f ? (f.area || 'Sem área') : 'Sem cadastro'; };
  const grp = fk => { const o = {}; at.forEach(x => { const k = fk(x); (o[k] = o[k] || []).push(x); }); return Object.entries(o).map(([k, X]) => ({ k, X, n: X.length, med: media(X.map(x => salM(x))), massa: X.reduce((a, x) => a + salM(x), 0), custo: X.reduce((a, x) => a + custoEnc(x), 0) })).sort((a, b) => b.massa - a.massa); };
  const GA = grp(areaDe);
  const M12 = C.slice(0, 12).reverse();
  const evo = M12.map(c => { let X = doMes(c).filter(ativoNaFolha).filter(x => salM(x) > 0); if (V.semOut) X = semForaDaCurva(X).X; return { c, n: X.length, med: media(X.map(x => salM(x))) || 0, massa: X.reduce((a, x) => a + salM(x), 0), custo: doMes(c).reduce((a, x) => a + custoEnc(x), 0) }; });
  const top = at.slice().sort((a, b) => salM(b) - salM(a));
  PB().innerHTML = `<div class="top2" style="margin-top:4px"><label style="margin:0">Mês</label><select id="sa-comp">${C.map(c => `<option value="${c}" ${c === V.comp ? 'selected' : ''}>${mesNome(c)}</option>`).join('')}</select><span class="note">${at.length} pessoas ativas com salário na folha de ${mesNome(V.comp)}</span><label class="note" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="sa-out" ${V.semOut ? 'checked' : ''}> Ignorar valores fora da curva${V.semOut && SF.fora.length ? ` (${SF.fora.length} fora: abaixo de ${brl(SF.lo)} ou acima de ${brl(SF.hi)})` : ''}</label></div>
    <div class="kpis">${kpiG('Massa salarial (salário-base)', brl(massa), 'info', at.length + ' pessoas', () => ['Massa salarial', 'Soma do salário-base de quem está ativo na folha (sem horas extras e adicionais).', tabela(['Nome', 'Cargo', 'Salário-base'], top.map(x => lin(x, [brl2(salM(x))])), [2])])
      + kpiG('Salário médio', brl(media(sal)), '', 'mediana ' + brl(mediana(sal)), () => ['Salário médio e mediana', `Média ${brl2(media(sal))} · mediana ${brl2(mediana(sal))} (metade ganha menos que isso).`, tabela(['Nome', 'Cargo', 'Salário-base'], top.map(x => lin(x, [brl2(salM(x))])), [2])])
      + kpiG('Menor e maior salário', brl(Math.min(...sal)), '', 'maior ' + brl(Math.max(...sal)), () => ['Menor e maior salário', '', tabela(['Nome', 'Cargo', 'Salário-base'], [...top.slice(-5).reverse(), ...top.slice(0, 5)].map(x => lin(x, [brl2(salM(x))])), [2])])
      + kpiG('Remuneração bruta média', brl(prov / (L.length || 1)), '', 'proventos ÷ pessoas', () => ['Remuneração bruta', 'Todos os proventos do mês (salário, HE, adicionais, férias, rescisões) divididos pelas pessoas na folha.', tabela(['Nome', 'Cargo', 'Salário', 'Proventos'], L.slice().sort((a, b) => num(b.proventos) - num(a.proventos)).map(x => lin(x, [brl2(salM(x)), brl2(x.proventos)])), [2, 3])])
      + kpiG('Custo total estimado', brl(custoTot), 'warn', 'com encargos e benefícios', () => ['Custo total estimado', `Proventos ${brl2(prov)} + FGTS + encargos patronais estimados (${Math.round(ENC * 1000) / 10}% da base do INSS) + benefícios ${brl2(ben.total)}. É estimativa: confira com a contabilidade.`, tabela(['Nome', 'Cargo', 'Proventos', 'Custo c/ encargos'], L.slice().sort((a, b) => custoEnc(b) - custoEnc(a)).map(x => lin(x, [brl2(x.proventos), brl2(custoEnc(x))])), [2, 3])])
      + kpiG('Custo médio por pessoa', brl(custoTot / (L.length || 1)), '', 'por mês', () => ['Custo médio por pessoa', 'Custo total estimado dividido pelas pessoas na folha do mês.', tabela(['Área', 'Pessoas', 'Custo c/ encargos', 'Por pessoa'], GA.map(g => [esc(g.k), g.n, brl2(g.custo), brl2(g.custo / g.n)]), [1, 2, 3])])
      + kpiG('Mudaram de salário', reaj.length, reaj.length ? 'info' : '', ant ? 'desde ' + mesNome(ant) : 'sem mês anterior', () => ['Mudança de salário-base', ant ? `Comparado com ${mesNome(ant)}.` : '', tabela(['Nome', 'Cargo', 'Antes', 'Agora', 'Variação'], reaj.map(r => lin(r.x, [brl2(r.de), brl2(r.para), pc1(r.para - r.de, r.de)])), [2, 3, 4])])
      + kpiG('Encargos estimados', brl(enc - prov), '', 'FGTS + INSS patronal', () => ['Encargos', `FGTS ${brl2(L.reduce((a, x) => a + num(x.fgts), 0))} + INSS patronal/RAT/terceiros estimados ${brl2(L.reduce((a, x) => a + num(x.baseInss || x.proventos) * ENC, 0))}.`, ''])}</div>
    <div class="rgrid">
      <div class="card"><p class="ct">Salário médio por mês</p>${barras(evo.map(e => ({ t: mesNome(e.c), v: e.med, s: brl(e.med) + ' · ' + e.n + ' pessoas', cor: e.c === V.comp ? 'var(--s2)' : 'var(--s1)', data: `data-scomp="${e.c}"` })))}</div>
      <div class="card"><p class="ct">Custo estimado por mês</p>${barras(evo.map(e => ({ t: mesNome(e.c), v: e.custo, s: brl(e.custo), cor: e.c === V.comp ? 'var(--s2)' : 'var(--s3)', data: `data-scomp="${e.c}"` })))}</div>
      <div class="card"><p class="ct">Faixas salariais (${mesNome(V.comp)})</p>${barras(FAIXAS.map(f => { const n = sal.filter(v => v >= f[0] && v < f[1]).length; return { t: faixaT(f), v: n, s: n + ' pessoas · ' + pc1(n, sal.length) }; }))}</div>
      <div class="card"><p class="ct">Salário médio por área</p>${barras(GA.map(g => ({ t: g.k, v: g.med, s: brl(g.med) + ' · ' + g.n + ' pessoas' })))}</div>
      <div class="card"><p class="ct">Massa salarial por área</p>${barras(GA.map(g => ({ t: g.k, v: g.massa, s: brl(g.massa) + ' · ' + pc1(g.massa, massa), cor: 'var(--s3)' })))}</div>
      <div class="card"><p class="ct">Maiores salários</p>${barras(top.slice(0, 12).map(x => ({ t: x.nome, v: salM(x), s: brl(salM(x)) + ' · ' + str(x.cargo), cor: 'var(--s2)', data: x.funcionarioId ? `data-pessoa="${esc(x.funcionarioId)}"` : '' })))}</div></div>
    <p class="note">Encargos patronais estimados em ${Math.round(ENC * 1000) / 10}% da base do INSS (Lucro Real: INSS 20% + RAT/FAP + terceiros). Salário por cargo e horas extras ficam em <b>Folha e horas</b>.</p>`;
  $('#sa-comp').onchange = e => { V.comp = e.target.value; tSal(); };
  $('#sa-out').onchange = e => { V.semOut = e.target.checked; tSal(); };
  PB().querySelectorAll('[data-scomp]').forEach(b => b.onclick = () => { V.comp = b.dataset.scomp; tSal(); });
}
