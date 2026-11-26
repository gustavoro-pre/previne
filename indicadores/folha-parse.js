/* Extrato Mensal da folha (contabilidade): texto do PDF → funcionários, cargos, salários e rubricas. Usado pelo importador da aba Pessoas → Folha. */
/* Parser do "Extrato Mensal" da folha (sistema da contabilidade). Entrada: páginas como listas de itens {x,y,s}. */
function folhaParse(pages) {
  const brn = s => { const t = String(s || '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(t); return isFinite(n) ? n : 0; };
  const isNum = s => /^-?[\d.]+,\d{2}$/.test(s);
  let comp = '', cnpj = '', totalProv = 0, fim = false; const out = []; let cur = null;
  const lines = [];
  pages.forEach((items, pi) => {
    const L = []; items.filter(i => String(i.s).trim()).sort((a, b) => b.y - a.y || a.x - b.x).forEach(i => { let l = L.find(l => Math.abs(l.y - i.y) <= 2); if (!l) { l = { y: i.y, it: [] }; L.push(l); } l.it.push(i); });
    L.sort((a, b) => b.y - a.y).forEach(l => { l.it.sort((a, b) => a.x - b.x); lines.push(l.it.map(i => ({ x: i.x, s: String(i.s).trim() }))); });
  });
  const val = (it, lab) => { const k = it.findIndex(i => i.s === lab || i.s.startsWith(lab + ' ')); if (k < 0) return null; const own = it[k].s.slice(lab.length).trim(); return own || (it[k + 1] ? it[k + 1].s : ''); };
  for (const it of lines) {
    const txt = it.map(i => i.s).join(' | ');
    if (!comp) { const c = val(it, 'Competência:'); if (c && /^\d{2}\/\d{4}$/.test(c)) comp = c.slice(3) + '-' + c.slice(0, 2); }
    if (!cnpj) { const c = val(it, 'CNPJ:'); if (c && /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(c)) cnpj = c; }
    if (it.some(i => /^Total Geral Proventos:|^Resumo por Rubrica/.test(i.s))) { const tp = val(it, 'Total Geral Proventos:'); if (tp) totalProv = brn(tp); cur = null; fim = true; continue; }
    if (fim) continue;
    if (it[0] && it[0].s === 'Contr:') { cur = null; continue; } /* sócios (pró-labore) ficam de fora */
    if (it[0] && it[0].s === 'Empr.:') {
      const m = /^(\d+)\s+(.+)$/.exec(it[1] ? it[1].s : ''); if (!m) continue;
      cur = { cod: m[1], nome: m[2].trim(), situacao: val(it, 'Situação:') || '', cpf: (val(it, 'CPF:') || '').replace(/[^\d]/g, ''), adm: '', rub: [] };
      const a = val(it, 'Adm:'); if (a && /^\d{2}\/\d{2}\/\d{4}$/.test(a)) cur.adm = a.slice(6) + '-' + a.slice(3, 5) + '-' + a.slice(0, 2);
      out.push(cur); continue;
    }
    if (!cur) continue;
    if (it[0] && it[0].s === 'Vínculo:') { cur.vinculo = it[1] ? it[1].s : ''; cur.horasMes = brn(val(it, 'Horas Mês:')); continue; }
    if (it[0] && it[0].s === 'Cargo:') { const m = /^(\d+)\s+(.+)$/.exec(it[1] ? it[1].s : ''); cur.cargo = m ? m[2].trim() : (it[1] ? it[1].s : ''); cur.cbo = val(it, 'C.B.O:') || ''; cur.salario = brn(val(it, 'Salário:')); continue; }
    if (it[0] && it[0].s === 'ND:') { cur.proventos = brn(val(it, 'Proventos:')); cur.descontos = brn(val(it, 'Descontos:')); cur.liquido = brn(val(it, 'Líquido:')); continue; }
    if (it[0] && it[0].s === 'NF:') { cur.baseInss = brn(val(it, 'Base INSS:')); cur.fgts = brn(val(it, 'Valor FGTS:')); continue; }
    if (/^(Página:|Empresa:|CNPJ:|Cálculo:|Competência:|EXTRATO MENSAL|Emissão:|Horas:)/.test(it[0].s)) continue;
    /* linhas de rubricas: duas colunas (x < 290 e x >= 290) */
    [it.filter(i => i.x < 288), it.filter(i => i.x >= 288)].forEach(col => {
      if (!col.length) return; const toks = []; col.forEach(i => { const m = /^([\d.]+,\d{2})\s+([PD])$/.exec(i.s); if (m) { toks.push(m[1], m[2]); } else toks.push(i.s); });
      let k = 0; let cod = '', nome = '';
      const m0 = /^(\d{1,5})\s+(.+)$/.exec(toks[0] || '');
      if (m0) { cod = m0[1]; nome = m0[2]; k = 1; } else if (/^\d{1,5}$/.test(toks[0] || '') && toks[1] && !isNum(toks[1])) { cod = toks[0]; nome = toks[1]; k = 2; } else return;
      const nums = []; let tp = '', inf = false;
      for (; k < toks.length; k++) { const t = toks[k]; if (isNum(t)) nums.push(brn(t)); else if (t === 'P' || t === 'D') tp = t; else if (t === '*') inf = true; else if (t === 'P *' || t === 'D *') { tp = t[0]; inf = true; } }
      if (!tp) { cur.obs = ((cur.obs || '') + ' ' + col.map(i => i.s).join(' ')).trim(); return; }
      const ref = nums.length > 1 ? nums[0] : (nums.length === 1 && inf ? nums[0] : 0), v = nums.length > 1 ? nums[1] : (inf ? 0 : (nums[0] || 0));
      cur.rub.push({ c: cod, n: nome.trim(), ref, v, t: tp, inf: inf || undefined });
    });
  }
  return { comp, cnpj, totalProv, func: out };
}
if (typeof module !== 'undefined') module.exports = { folhaParse };
