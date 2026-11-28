/* Aba Medição (Alocação em OM): cruza o que foi MEDIDO (acompanhamento dos apontamentos do portalRDO)
   com o que foi TRABALHADO (roleta da ArcelorMittal e ponto do RHiD) e com o PREVISTO (alocação/OM fixa).
   Dados por funcionário e mês em med_mes/{AAAA-MM}_{PN}: dias.{DD}.rol | .pto | .med (cada importação só mexe na sua parte).
   Cor do dia: verde = medido >= trabalhado (com tolerância); laranja = medido a menor; vermelho = trabalhou e não foi medido;
   roxo = medido sem presença na roleta/ponto. Usa as variáveis globais do aloc.js (D, V, db, PODE, esc, $, toast, sheet, fechar…). */
"use strict";

/* ---------- núcleo (sem tela; também roda no Node para teste) ---------- */
const MEDC = (() => {
  const s = v => v == null ? '' : String(v);
  const nk = v => s(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const z2 = n => String(n).padStart(2, '0');
  function decodificar(buf) {
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
    return t.replace(/^﻿/, '');
  }
  function csv(texto) {
    const l1 = texto.split(/\r?\n/, 1)[0] || '';
    const sep = [';', '\t', ','].map(c => [c, l1.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const out = []; let row = [], cel = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) { if (c === '"') { if (texto[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c; continue; }
      if (c === '"') q = true; else if (c === sep) { row.push(cel); cel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; row.push(cel); out.push(row); row = []; cel = ''; }
      else cel += c;
    }
    if (cel !== '' || row.length) { row.push(cel); out.push(row); }
    return out.filter(r => r.some(x => s(x).trim() !== ''));
  }
  function num(v) {
    if (typeof v === 'number') return v; let t = s(v).trim().replace(/[R$\s]/g, ''); if (!t) return 0;
    if (/,\d{1,3}$/.test(t) || (t.includes(',') && t.includes('.') && t.lastIndexOf(',') > t.lastIndexOf('.'))) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
    const n = parseFloat(t); return isFinite(n) ? n : 0;
  }
  function data(v) {
    if (v instanceof Date && !isNaN(v)) return v.getUTCFullYear() + '-' + z2(v.getUTCMonth() + 1) + '-' + z2(v.getUTCDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return data(d); }
    const t = s(v).trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(t); if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + z2(m[2]) + '-' + z2(m[1]); }
    return '';
  }
  function hora(v) { // minutos desde 00:00
    if (v instanceof Date && !isNaN(v)) return v.getUTCHours() * 60 + v.getUTCMinutes() + Math.round(v.getUTCSeconds() / 60);
    if (typeof v === 'number') return v < 1.0001 ? Math.round(v * 1440) : null;
    const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s(v)); return m ? +m[1] * 60 + +m[2] + Math.round((+m[3] || 0) / 60) : null;
  }
  function duracaoH(v, emMinutos) { // "9:00", "540", 9.5 → horas
    if (v instanceof Date) return hora(v) / 60;
    const t = s(v).trim(); if (!t) return 0;
    const m = /^(-?\d+):(\d{2})/.exec(t); if (m) return (+m[1] * 60 + (m[1].startsWith('-') ? -1 : 1) * +m[2]) / 60;
    const n = num(t); return emMinutos ? n / 60 : n;
  }
  // acha a coluna pelo nome (lista de apelidos; o primeiro que bater)
  function col(cab, ...apelidos) {
    const H = cab.map(nk);
    for (const a of apelidos) { const A = nk(a); const i = H.findIndex(h => h === A); if (i >= 0) return i; }
    for (const a of apelidos) { const A = nk(a); const i = H.findIndex(h => h.startsWith(A) || (A.length > 3 && h.includes(A))); if (i >= 0) return i; }
    return -1;
  }
  function linhaCab(linhas, ...chaves) { // primeira linha que tem as colunas-chave
    for (let i = 0; i < Math.min(linhas.length, 30); i++) if (chaves.every(k => col(linhas[i].map(s), k) >= 0)) return i;
    return -1;
  }

  /* ---- roleta: jornadas (acessos permitidos; quebra quando passa de 6 h sem acesso) ---- */
  function roleta(linhas, almocoMin) {
    const hi = linhaCab(linhas, 'Cadastro', 'Data Acesso'); if (hi < 0) throw new Error('Não achei as colunas "Cadastro" e "Data Acesso" da roleta.');
    const cab = linhas[hi].map(s); const c = { pn: col(cab, 'Cadastro'), nome: col(cab, 'Nome'), data: col(cab, 'Data Acesso'), hora: col(cab, 'Hora Acesso'),
      dir: col(cab, 'Direcao', 'Direção'), loc: col(cab, 'Descricao'), tipo: col(cab, 'Descricao Tipo Acesso', 'Tipo Acesso') };
    // "Descrição" e "Descrição (Tipo Acesso)": separa as duas
    const H = cab.map(nk); c.tipo = H.findIndex(h => h.includes('TIPO ACESSO')); c.loc = H.findIndex(h => h === 'DESCRICAO');
    const P = {}; let neg = 0;
    for (const r of linhas.slice(hi + 1)) {
      const pn = s(r[c.pn]).replace(/\D/g, ''); const d = data(r[c.data]); const h = hora(r[c.hora]); if (!pn || !d || h == null) continue;
      const tipo = nk(r[c.tipo]); const p = P[pn] = P[pn] || { nome: s(r[c.nome]).trim(), ac: [], neg: {} };
      if (c.tipo >= 0 && tipo && tipo !== 'ACESSO PERMITIDO') { p.neg[d] = (p.neg[d] || 0) + 1; neg++; continue; }
      const loc = /\bBM\b/.test(nk(r[c.loc])) ? 'BM' : /\bRES\b|\bRS\b/.test(nk(r[c.loc])) ? 'RES' : '';
      p.ac.push({ t: Date.parse(d + 'T00:00:00Z') / 6e4 + h, d, h, dir: s(r[c.dir]).trim().toUpperCase().slice(0, 1), loc });
    }
    const out = {}; // pn -> { nome, dias: { 'AAAA-MM-DD': {e, s, h, loc, n, neg} } }
    for (const [pn, p] of Object.entries(P)) {
      p.ac.sort((a, b) => a.t - b.t); const J = []; let cur = null;
      for (const a of p.ac) { // nova jornada: mais de 16 h sem acesso, ou mais de 6 h depois de uma saída (ou de uma entrada seguida de outra entrada)
        const u = cur && cur[cur.length - 1]; const gap = u ? a.t - u.t : 1e9;
        if (!cur || gap > 960 || (gap > 360 && (u.dir === 'S' || (u.dir === 'E' && a.dir === 'E')))) { cur = []; J.push(cur); } cur.push(a); }
      const dias = {};
      for (const j of J) {
        const d = j[0].d; const span = j[j.length - 1].t - j[0].t; const so1 = j.length === 1;
        const liq = Math.max(0, span - (span >= 360 ? almocoMin : 0));
        const conta = {}; j.forEach(a => { if (a.loc) conta[a.loc] = (conta[a.loc] || 0) + 1; });
        const loc = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] || '';
        const x = dias[d]; const fim = j[j.length - 1].h + (j[j.length - 1].d !== d ? 1440 : 0);
        if (x) { x.h = +(x.h + liq / 60).toFixed(2); x.s = fmt(fim); x.n += j.length; x.so1 = x.so1 && so1 ? true : undefined; }
        else dias[d] = { e: fmt(j[0].h), s: so1 ? '' : fmt(fim), h: +(liq / 60).toFixed(2), loc, n: j.length, so1: so1 || undefined };
      }
      Object.entries(p.neg).forEach(([d, n]) => { (dias[d] = dias[d] || { e: '', s: '', h: 0, loc: '', n: 0 }).neg = n; });
      out[pn] = { nome: p.nome, dias };
    }
    return { pessoas: out, neg, colunas: c };
  }
  const fmt = m => { m = ((m % 1440) + 1440) % 1440; return z2(Math.floor(m / 60)) + ':' + z2(m % 60); };

  /* ---- medição: acompanhamento dos apontamentos (portalRDO) ---- */
  function medicao(linhas) {
    const hi = linhaCab(linhas, 'Status'); if (hi < 0) throw new Error('Não achei a coluna "Status" do acompanhamento.');
    const cab = linhas[hi].map(s); const H = cab.map(nk);
    const c = { pn: col(cab, 'PN', 'N Pessoal', 'Nº Pessoal', 'Matricula', 'Cadastro'), nome: col(cab, 'Nome', 'Nome do Funcionario', 'Empregado', 'Colaborador'),
      data: col(cab, 'Data', 'Data Apontamento', 'Data do Apontamento'), om: col(cab, 'N Documento', 'Nº Documento', 'N° Documento', 'OM', 'Ordem'),
      trab: col(cab, 'Trab Total', 'Trab.Total', 'Horas', 'Quantidade'), ini: col(cab, 'Hora Inicio', 'Hora Início', 'Inicio'), fim: col(cab, 'Hora Fim', 'Fim', 'Hora Termino'),
      st: col(cab, 'Status'), val: col(cab, 'Total $', 'Total R$', 'Valor Total', 'Valor', 'Total'), contrato: col(cab, 'Contrato'), esp: col(cab, 'Especialidade') };
    if (c.pn < 0 || c.data < 0) throw new Error('Não achei as colunas de PN/matrícula e data no acompanhamento.');
    const trabMin = c.trab >= 0 && /TRAB/.test(H[c.trab]);
    const out = {}; let n = 0, ignor = 0; const vistos = new Set();
    for (const r of linhas.slice(hi + 1)) {
      const pn = s(r[c.pn]).replace(/\D/g, ''); const d = data(r[c.data]); if (!pn || !d) { ignor++; continue; }
      const chave = r.map(s).join('|'); if (vistos.has(chave)) { ignor++; continue; } vistos.add(chave); // linha repetida (os dois arquivos)
      let h = c.trab >= 0 ? duracaoH(r[c.trab], trabMin) : 0;
      if (!h && c.ini >= 0 && c.fim >= 0) { const a = hora(r[c.ini]), b = hora(r[c.fim]); if (a != null && b != null) h = ((b - a + 1440) % 1440) / 60; }
      const st = s(r[c.st]).trim() || '—'; const rep = /REPROV/.test(nk(st)); const om = s(r[c.om]).trim(); const v = c.val >= 0 ? num(r[c.val]) : 0;
      const p = out[pn] = out[pn] || { nome: s(r[c.nome]).trim(), esp: c.esp >= 0 ? s(r[c.esp]).trim() : '', dias: {} };
      const x = p.dias[d] = p.dias[d] || { h: 0, hRep: 0, n: 0, nRep: 0, val: 0, valRep: 0, oms: {}, st: {} };
      x.st[st] = (x.st[st] || 0) + 1;
      if (rep) { x.hRep += h; x.nRep++; x.valRep += v; } else { x.h += h; x.n++; x.val += v; if (om) x.oms[om] = +((x.oms[om] || 0) + h).toFixed(2); }
      n++;
    }
    Object.values(out).forEach(p => Object.values(p.dias).forEach(x => ['h', 'hRep', 'val', 'valRep'].forEach(k => x[k] = +x[k].toFixed(2))));
    return { pessoas: out, linhas: n, ignoradas: ignor, colunas: c, trabMin };
  }

  /* ---- ponto (RHiD): relatório com uma linha por dia (batidas ou horas trabalhadas) ---- */
  function ponto(linhas, almocoMin) {
    const hi = linhaCab(linhas, 'Data'); if (hi < 0) throw new Error('Não achei a coluna "Data" no relatório do ponto.');
    const cab = linhas[hi].map(s); const H = cab.map(nk);
    const c = { nome: col(cab, 'Nome', 'Funcionario', 'Colaborador'), cpf: col(cab, 'CPF'), mat: col(cab, 'Matricula', 'Matrícula', 'Codigo', 'PIS'), data: col(cab, 'Data', 'Dia'),
      trab: col(cab, 'Horas Trabalhadas', 'Trabalhadas', 'Hrs Trab', 'Total Trabalhado', 'Trabalhado', 'Total'), marc: col(cab, 'Marcacoes', 'Marcações', 'Batidas') };
    const batCols = H.map((h, i) => /^(ENT|SAI|ENTRADA|SAIDA|E\d|S\d)\b/.test(h) ? i : -1).filter(i => i >= 0);
    const out = []; let nome = '', cpf = '', mat = '';
    for (const r of linhas.slice(hi + 1)) {
      if (c.nome >= 0 && s(r[c.nome]).trim()) nome = s(r[c.nome]).trim();
      if (c.cpf >= 0 && s(r[c.cpf]).trim()) cpf = s(r[c.cpf]).replace(/\D/g, '');
      if (c.mat >= 0 && s(r[c.mat]).trim()) mat = s(r[c.mat]).trim();
      const d = data(r[c.data]); if (!d) continue;
      let bat = [];
      if (c.marc >= 0) bat = (s(r[c.marc]).match(/\d{1,2}:\d{2}/g) || []).map(hora);
      else if (batCols.length) bat = batCols.map(i => hora(r[i])).filter(x => x != null);
      let h = c.trab >= 0 ? duracaoH(r[c.trab], false) : 0;
      if (!h && bat.length >= 2) {
        if (bat.length % 2 === 0 && bat.length >= 4) { for (let i = 0; i < bat.length; i += 2) h += ((bat[i + 1] - bat[i] + 1440) % 1440) / 60; }
        else { const span = (bat[bat.length - 1] - bat[0] + 1440) % 1440; h = Math.max(0, span - (span >= 360 ? almocoMin : 0)) / 60; }
      }
      if (!h && !bat.length) continue;
      out.push({ nome, cpf, mat, d, h: +h.toFixed(2), e: bat.length ? fmt(bat[0]) : '', s: bat.length > 1 ? fmt(bat[bat.length - 1]) : '' });
    }
    return { linhas: out, colunas: c };
  }

  /* ---- situação do dia ---- */
  function situacao(x, tolMin) {
    x = x || {}; const trab = x.rol && x.rol.h ? x.rol.h : (x.pto && x.pto.h ? x.pto.h : 0);
    const pres = !!((x.rol && (x.rol.h || x.rol.e)) || (x.pto && x.pto.h));
    const med = x.med ? x.med.h || 0 : 0;
    let st = '';
    if (pres) st = med <= 0 ? 'nao' : (med + tolMin / 60 >= trab ? 'ok' : 'menor');
    else if (med > 0) st = 'sempres';
    return { st, trab, med, falta: pres ? Math.max(0, +(trab - med).toFixed(2)) : 0, pres };
  }
  return { decodificar, csv, num, data, hora, duracaoH, col, roleta, medicao, ponto, situacao, nk };
})();
if (typeof module !== 'undefined') module.exports = MEDC;

/* ---------- tela ---------- */
if (typeof window !== 'undefined') (() => {
  const M = { mes: (new Date().toISOString().slice(0, 7)), docs: null, carregando: false, sub: 'mapa', loc: '', grupo: '', busca: '', cfg: { tolMin: 30, almocoMin: 60 }, mapa: {}, lista: {}, listaInfo: null, area: '' };
  window.MED = M;
  const SUBS = { mapa: 'Mapa do mês', func: 'Por funcionário', om: 'Por OM', local: 'Por local', faltam: 'Faltam lançar', rep: 'Reprovados', prev: 'Previsto × realizado', div: 'Medido × ponto × roleta' };
  const COR = { ok: '#2e9e5b', menor: '#f08c00', nao: '#d93025', sempres: '#7b3fbf' };
  const ROT = { ok: 'Medido', menor: 'Medido a menor', nao: 'Não medido', sempres: 'Medido sem presença' };
  const h2 = h => (Math.round((+h || 0) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const diasMes = mes => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const funcDoc = d => d.fid ? (D.func.find(f => f.id === d.fid) || null) : null;

  async function carregar() {
    if (M.carregando) return; M.carregando = true; render();
    try {
      const [q, c, mp, ls] = await Promise.all([db.collection('med_mes').where('mes', '==', M.mes).get(), db.doc('med_cfg/geral').get(), db.doc('med_cfg/pn').get(), db.doc('med_lista/' + M.mes).get().catch(() => null)]);
      M.lista = ls && ls.exists ? (ls.data().pessoas || {}) : {}; M.listaInfo = ls && ls.exists ? ls.data() : null;
      M.docs = q.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
      if (c.exists) Object.assign(M.cfg, c.data()); M.mapa = mp.exists ? (mp.data().map || {}) : {};
      M.docs.forEach(d => { if (M.mapa[d.pn]) d.fid = M.mapa[d.pn]; });
      const ini = M.mes + '-01', fim = M.mes + '-' + String(diasMes(M.mes)).padStart(2, '0');
      try { await garantir(ini, fim); } catch (e) {}
    } catch (e) { toast('Não foi possível carregar a medição (permissão?).', 'bad'); M.docs = []; }
    M.carregando = false; render();
  }

  /* vínculo PN → funcionário do portal: mapa manual > matrícula > nome */
  function acharFunc(pn, nome) {
    if (M.mapa[pn]) return M.mapa[pn];
    let f = D.func.find(x => String(x.pn || x.matriculaAM || '').replace(/\D/g, '') === pn || String(x.matricula || '').replace(/\D/g, '') === pn);
    if (!f && nome) { const n = MEDC.nk(nome); const c = D.func.filter(x => MEDC.nk(x.nome) === n); if (c.length === 1) f = c[0]; }
    return f ? f.id : '';
  }

  /* ---------- linhas calculadas ---------- */
  function linhas() {
    const L = []; const nd = diasMes(M.mes); const tol = +M.cfg.tolMin || 0;
    const docs = (M.docs || []).slice(); const tem = new Set(docs.map(d => d.pn));
    // quem está na lista do mês (contrato fixo de HH) e não teve roleta/ponto/medição também aparece (tudo "sem presença")
    Object.entries(M.lista || {}).forEach(([pn, l]) => { if (!tem.has(pn) && !/DEMITID|DESLIG/i.test(l.status || '')) docs.push({ pn, nome: l.nome, dias: {}, fid: M.mapa[pn] || acharFunc(pn, l.nome), soLista: true }); });
    for (const d of docs) {
      const li = (M.lista || {})[d.pn] || null;
      if (M.grupo === 'lista' && !li) continue;
      if (M.area && (!li || MEDC.nk(li.area) !== MEDC.nk(M.area))) continue;
      const f = funcDoc(d); const nome = f ? f.nome : d.nome;
      if (M.grupo === 'med' && !Object.values(d.dias || {}).some(x => x && x.med)) continue;
      if (M.grupo === 'fixa' && !(d.fid && fixaAtual(d.fid))) continue;
      if (M.busca && !MEDC.nk(nome).includes(MEDC.nk(M.busca)) && !String(d.pn).includes(M.busca)) continue;
      const dias = [];
      for (let i = 1; i <= nd; i++) {
        const dd = String(i).padStart(2, '0'); const x = (d.dias || {})[dd]; const data = M.mes + '-' + dd;
        const s = MEDC.situacao(x, tol); const loc = x && x.rol ? x.rol.loc || '' : '';
        const prev = d.fid ? diaDe(d.fid, data).filter(a => a.omNumero) : [];
        dias.push(Object.assign({ dd, data, x: x || {}, loc, prev }, s));
      }
      const locR = (() => { const c = {}; dias.forEach(z => { if (z.loc) c[z.loc] = (c[z.loc] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; })();
      const locL = li ? (/RESEND/i.test(li.unidade || '') ? 'RES' : /BARRA/i.test(li.unidade || '') ? 'BM' : '') : '';
      const locP = locL || locR;
      if (M.loc && locP !== M.loc) continue;
      if (li && li.om) dias.forEach(z => { if (!z.prev.length) z.prevLista = li.om; });
      L.push({ d, f, nome, pn: d.pn, dias, loc: locP, locRol: locR, li });
    }
    return L.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  }
  function resumo(L) {
    const r = { func: L.length, dt: 0, ok: 0, menor: 0, nao: 0, sempres: 0, ht: 0, hm: 0, falta: 0, nRep: 0, hRep: 0, vRep: 0, val: 0 };
    L.forEach(p => p.dias.forEach(z => {
      if (z.pres) { r.dt++; r.ht += z.trab; r.falta += z.falta; }
      if (z.st) r[z.st]++; r.hm += z.med;
      const m = z.x.med; if (m) { r.nRep += m.nRep || 0; r.hRep += m.hRep || 0; r.vRep += m.valRep || 0; r.val += m.val || 0; }
    }));
    return r;
  }
  const omPrincipal = p => { const c = {}; p.dias.forEach(z => Object.entries((z.x.med || {}).oms || {}).forEach(([o, h]) => c[o] = (c[o] || 0) + h)); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; };

  /* ---------- tela principal ---------- */
  function render() {
    const B = $('#body'); if (!B) return;
    if (M.docs === null && !M.carregando) { carregar(); }
    const L = M.docs ? linhas() : []; const r = resumo(L);
    const imp = PODE ? `<div class="row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      <button class="btn sm primary" data-medimp="med">Importar medição (portalRDO)</button>
      <button class="btn sm ghost" data-medimp="rol">Importar roleta</button>
      <button class="btn sm ghost" data-medimp="pto">Importar ponto (RHiD)</button>
      <button class="btn sm ghost" data-medimp="lista">Importar lista de funcionários (local e OM)</button>
      <button class="btn sm ghost" data-medcfg>Tolerância: ${M.cfg.tolMin} min · almoço ${M.cfg.almocoMin} min</button></div>` : '';
    B.innerHTML = `<div class="card"><div class="ct">Medição × presença</div>
      <p class="cs">Compara o que foi medido no portalRDO com a roleta, o ponto e a alocação prevista. Importe os arquivos do mês e veja dia a dia.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="month" id="med-mes" value="${esc(M.mes)}" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px">
        <select id="med-loc" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todos os locais</option><option value="RES" ${M.loc === 'RES' ? 'selected' : ''}>Resende</option><option value="BM" ${M.loc === 'BM' ? 'selected' : ''}>Barra Mansa</option></select>
        <select id="med-grupo" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todos da roleta/ponto</option><option value="med" ${M.grupo === 'med' ? 'selected' : ''}>Só quem teve medição no mês</option><option value="lista" ${M.grupo === 'lista' ? 'selected' : ''}>Só quem está na lista do mês</option><option value="fixa" ${M.grupo === 'fixa' ? 'selected' : ''}>Só quem tem OM fixa (contrato HH)</option></select>
        ${(() => { const A = [...new Set(Object.values(M.lista || {}).map(l => l.area).filter(Boolean))].sort(); return A.length ? `<select id="med-area" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todas as áreas</option>${A.map(a => `<option ${M.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>` : ''; })()}
        <input id="med-busca" placeholder="Buscar funcionário ou PN" value="${esc(M.busca)}" style="flex:1;min-width:160px;padding:8px;border:1px solid #cfd4dc;border-radius:8px">
      </div>${M.listaInfo ? `<p class="cs" style="margin:6px 0 0">Lista de funcionários de ${esc(M.mes)}: ${Object.keys(M.lista).length} pessoas (${esc(M.listaInfo.arquivo || '')}, ${fmtD(String(M.listaInfo.em || '').slice(0, 10))}). Local, área e OM prevista vêm dela.</p>` : PODE ? '<p class="cs" style="margin:6px 0 0">Sem lista de funcionários neste mês: o local vem da roleta. Importe a "LISTA DE FUNCIONÁRIOS – PREVINE" do mês (pasta MEDIÇÕES) para ter área, subárea, unidade e OM de cada um.</p>' : ''}${imp}
      <input type="file" id="med-file" multiple accept=".csv,.txt,.xlsx,.xls" hidden></div>
    ${M.carregando ? '<div class="card">Carregando…</div>' : !L.length ? `<div class="card"><p class="cs" style="margin:0">Nenhum dado de medição em ${esc(M.mes)}${M.busca || M.loc ? ' com esse filtro' : ''}. ${PODE ? 'Importe o acompanhamento do portalRDO e a roleta do mês.' : ''}</p></div>` : `
    <div class="kpis">
      ${kpi('Funcionários', r.func)}${kpi('Dias trabalhados', r.dt)}
      ${kpi('<span style="color:' + COR.ok + '">■</span> Medidos', r.ok)}${kpi('<span style="color:' + COR.menor + '">■</span> A menor', r.menor)}
      ${kpi('<span style="color:' + COR.nao + '">■</span> Não medidos', r.nao)}${kpi('<span style="color:' + COR.sempres + '">■</span> Sem presença', r.sempres)}
      ${kpi('Horas trabalhadas', h2(r.ht))}${kpi('Horas medidas', h2(r.hm))}${kpi('% medido', pct(r.hm, r.ht))}
      ${kpi('Horas a medir', h2(r.falta))}${kpi('Reprovados', r.nRep + ' · ' + h2(r.hRep) + ' h')}${PODE ? kpi('Valor medido', brl(r.val)) : ''}
    </div>
    <div class="seg" id="med-sub" style="margin-top:12px">${Object.entries(SUBS).map(([k, t]) => `<button data-medsub="${k}" class="${M.sub === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="card" style="overflow:auto">${({ mapa: vMapa, func: vFunc, om: vOm, local: vLocal, faltam: vFaltam, rep: vRep, prev: vPrev, div: vDiv })[M.sub](L)}</div>`}`;
  }
  M.render = render;

  /* tabela genérica + exportação */
  let ULT = null;
  function tab(titulo, cols, rows, opt) {
    ULT = { titulo, cols, rows };
    const head = cols.map(c => `<th style="text-align:${c.tipo && c.tipo !== 'txt' ? 'right' : 'left'};padding:6px 8px;border-bottom:2px solid var(--line);white-space:nowrap">${esc(c.t)}</th>`).join('');
    const body = rows.length ? rows.map(r => `<tr>${r.map((v, i) => { const c = cols[i]; const t = c.tipo || 'txt';
      const sh = t === 'h' ? h2(v) : t === 'brl' ? brl(v) : t === 'pct' ? (v == null ? '—' : Math.round(v * 100) + '%') : t === 'data' ? fmtD(v) : esc(v);
      return `<td style="text-align:${t === 'txt' || t === 'data' ? 'left' : 'right'};padding:5px 8px;border-bottom:1px solid var(--line)">${(opt && opt.html && opt.html[i]) ? opt.html[i](v, r) : sh}</td>`; }).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" style="padding:10px;color:var(--muted)">Nada a mostrar.</td></tr>`;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="flex:1">${esc(titulo)}</b><button class="btn sm ghost" data-medexp>Exportar</button></div>
      <table class="tb" style="font-size:13px">${'<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody>'}</table>`;
  }
  const filtroTxt = () => `Mês ${M.mes}${M.loc ? ' · ' + (M.loc === 'RES' ? 'Resende' : 'Barra Mansa') : ''}${M.busca ? ' · busca: ' + M.busca : ''}`;

  function vMapa(L) {
    const nd = diasMes(M.mes); ULT = null;
    const cab = Array.from({ length: nd }, (_, i) => { const d = M.mes + '-' + String(i + 1).padStart(2, '0'); const w = dow(d); return `<th style="padding:2px;font-size:10px;font-weight:600;color:${w === 0 || w === 6 ? 'var(--bad)' : 'var(--muted)'}">${i + 1}</th>`; }).join('');
    const rows = L.map(p => `<tr><td style="padding:4px 6px;white-space:nowrap;position:sticky;left:0;background:#fff;max-width:210px;overflow:hidden;text-overflow:ellipsis" title="${esc(p.nome)} · PN ${esc(p.pn)}">${esc(p.nome)}${p.f ? '' : ' <span class="badge b-warn" title="Sem vínculo com o cadastro do portal">?</span>'}</td>
      ${p.dias.map(z => { const cor = COR[z.st]; const t = z.st ? `${fmtD(z.data)} · ${ROT[z.st]} · trabalhado ${h2(z.trab)} h · medido ${h2(z.med)} h` : fmtD(z.data);
        return `<td style="padding:1px"><button data-medd="${esc(p.pn)}|${z.dd}" title="${esc(t)}" style="width:22px;height:22px;border-radius:5px;border:${cor ? '0' : '1px solid var(--line)'};background:${cor || '#fff'};cursor:${z.st || z.x.med ? 'pointer' : 'default'};padding:0"></button></td>`; }).join('')}
      <td style="padding:4px 6px;text-align:right;white-space:nowrap">${pct(p.dias.reduce((a, z) => a + Math.min(z.med, z.trab || z.med), 0), p.dias.reduce((a, z) => a + z.trab, 0))}</td></tr>`).join('');
    return `<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:8px">${Object.entries(ROT).map(([k, t]) => `<span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${COR[k]};vertical-align:-2px"></span> ${t}</span>`).join('')}<span>· toque no dia para ver o detalhe</span></div>
      <div style="overflow:auto"><table style="border-collapse:collapse"><thead><tr><th style="text-align:left;padding:4px 6px;position:sticky;left:0;background:#fff">Funcionário</th>${cab}<th style="padding:4px 6px">% med.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function porPessoa(p) {
    const a = { dt: 0, ok: 0, menor: 0, nao: 0, sempres: 0, ht: 0, hm: 0, falta: 0, nRep: 0, hRep: 0, vRep: 0, val: 0 };
    p.dias.forEach(z => { if (z.pres) { a.dt++; a.ht += z.trab; a.falta += z.falta; } if (z.st) a[z.st]++; a.hm += z.med; const m = z.x.med; if (m) { a.nRep += m.nRep || 0; a.hRep += m.hRep || 0; a.vRep += m.valRep || 0; a.val += m.val || 0; } });
    return a;
  }
  function vFunc(L) {
    const cols = [{ t: 'Funcionário' }, { t: 'PN' }, { t: 'Local' }, { t: 'OM principal' }, { t: 'Dias trab.', tipo: 'int' }, { t: 'Medidos', tipo: 'int' }, { t: 'A menor', tipo: 'int' }, { t: 'Não medidos', tipo: 'int' }, { t: 'Sem presença', tipo: 'int' },
      { t: 'H trabalhadas', tipo: 'h' }, { t: 'H medidas', tipo: 'h' }, { t: 'H a medir', tipo: 'h' }, { t: '% medido', tipo: 'pct' }, { t: 'Reprovados', tipo: 'int' }, { t: 'H reprovadas', tipo: 'h' }].concat(PODE ? [{ t: 'Valor medido', tipo: 'brl' }, { t: 'Valor reprovado', tipo: 'brl' }] : []);
    const rows = L.map(p => { const a = porPessoa(p); return [p.nome, p.pn, p.loc, omPrincipal(p), a.dt, a.ok, a.menor, a.nao, a.sempres, a.ht, a.hm, a.falta, a.ht ? a.hm / a.ht : null, a.nRep, a.hRep].concat(PODE ? [a.val, a.vRep] : []); });
    return tab('Medição por funcionário', cols, rows);
  }
  /* horas por OM: medidas pela OM do apontamento; a medir pela OM prevista do dia (ou a OM principal da pessoa) */
  function agrOm(L) {
    const O = {};
    const g = k => O[k] = O[k] || { om: k, func: new Set(), hm: 0, falta: 0, nRep: 0, hRep: 0, val: 0, vRep: 0, dNao: 0 };
    L.forEach(p => { const pri = omPrincipal(p); p.dias.forEach(z => {
      const m = z.x.med || {}; Object.entries(m.oms || {}).forEach(([o, h]) => { const x = g(o); x.hm += h; x.func.add(p.pn); });
      if (m.nRep) { const o = Object.keys(m.oms || {})[0] || (z.prev[0] || {}).omNumero || z.prevLista || pri || 'Sem OM'; const x = g(o); x.nRep += m.nRep; x.hRep += m.hRep || 0; x.vRep += m.valRep || 0; }
      if (m.val) { const tot = Object.values(m.oms || {}).reduce((a, b) => a + b, 0) || 1; Object.entries(m.oms || {}).forEach(([o, h]) => g(o).val += m.val * h / tot); }
      if (z.falta > 0) { const o = (z.prev[0] || {}).omNumero || z.prevLista || pri || 'Sem OM'; const x = g(o); x.falta += z.falta; x.func.add(p.pn); if (z.st === 'nao') x.dNao++; }
    }); });
    return Object.values(O).sort((a, b) => (b.hm + b.falta) - (a.hm + a.falta));
  }
  function vOm(L) {
    const cols = [{ t: 'OM' }, { t: 'Descrição' }, { t: 'Funcionários', tipo: 'int' }, { t: 'H medidas', tipo: 'h' }, { t: 'H a medir', tipo: 'h' }, { t: 'Dias não medidos', tipo: 'int' }, { t: '% medido', tipo: 'pct' }, { t: 'Reprovados', tipo: 'int' }, { t: 'H reprovadas', tipo: 'h' }].concat(PODE ? [{ t: 'Valor medido', tipo: 'brl' }, { t: 'Valor reprovado', tipo: 'brl' }] : []);
    const rows = agrOm(L).map(x => { const o = omByNum(x.om) || {}; return [x.om, o.descricao || o.local || '', x.func.size, x.hm, x.falta, x.dNao, (x.hm + x.falta) ? x.hm / (x.hm + x.falta) : null, x.nRep, x.hRep].concat(PODE ? [x.val, x.vRep] : []); });
    return tab('Medição por OM (a medir atribuído à OM prevista do dia)', cols, rows);
  }
  function vLocal(L) {
    const G = {}; L.forEach(p => p.dias.forEach(z => { const k = p.li && p.li.area ? [p.li.unidade, p.li.area, p.li.subarea].filter(Boolean).join(' › ') : z.loc || (z.pres ? 'Só ponto' : z.med ? 'Sem presença' : ''); if (!k) return;
      const x = G[k] = G[k] || { func: new Set(), dt: 0, ht: 0, hm: 0, falta: 0, nao: 0, menor: 0, nRep: 0, val: 0 };
      x.func.add(p.pn); if (z.pres) { x.dt++; x.ht += z.trab; x.falta += z.falta; } x.hm += z.med; if (z.st === 'nao') x.nao++; if (z.st === 'menor') x.menor++; const m = z.x.med; if (m) { x.nRep += m.nRep || 0; x.val += m.val || 0; } }));
    const nomeL = { RES: 'Resende', BM: 'Barra Mansa' };
    const cols = [{ t: 'Local' }, { t: 'Funcionários', tipo: 'int' }, { t: 'Dias trab.', tipo: 'int' }, { t: 'H trabalhadas', tipo: 'h' }, { t: 'H medidas', tipo: 'h' }, { t: 'H a medir', tipo: 'h' }, { t: '% medido', tipo: 'pct' }, { t: 'Dias não medidos', tipo: 'int' }, { t: 'Dias a menor', tipo: 'int' }, { t: 'Reprovados', tipo: 'int' }].concat(PODE ? [{ t: 'Valor medido', tipo: 'brl' }] : []);
    const rows = Object.entries(G).map(([k, x]) => [nomeL[k] || k, x.func.size, x.dt, x.ht, x.hm, x.falta, x.ht ? x.hm / x.ht : null, x.nao, x.menor, x.nRep].concat(PODE ? [x.val] : []));
    return tab(Object.keys(M.lista || {}).length ? 'Medição por local (unidade › área › subárea da lista do mês)' : 'Medição por local (pela roleta)', cols, rows);
  }
  function vFaltam(L) {
    const cols = [{ t: 'Funcionário' }, { t: 'PN' }, { t: 'Data', tipo: 'data' }, { t: 'Dia' }, { t: 'Situação' }, { t: 'Local' }, { t: 'Roleta' }, { t: 'Ponto' }, { t: 'H trabalhadas', tipo: 'h' }, { t: 'H medidas', tipo: 'h' }, { t: 'Falta medir', tipo: 'h' }, { t: 'OM prevista' }];
    const rows = []; L.forEach(p => p.dias.forEach(z => { if (z.st !== 'nao' && z.st !== 'menor') return; const r = z.x.rol || {}, t = z.x.pto || {};
      rows.push([p.nome, p.pn, z.data, DSEM[dow(z.data)], ROT[z.st], z.loc, r.e ? r.e + '–' + (r.s || '?') : '', t.e ? t.e + '–' + (t.s || '?') : (t.h ? h2(t.h) + ' h' : ''), z.trab, z.med, z.falta, z.prev.map(a => a.omNumero).join(', ')]); }));
    return tab('Quem falta lançar (dias não medidos ou medidos a menor)', cols, rows, { html: { 4: (v) => `<span style="color:${v === ROT.nao ? COR.nao : COR.menor};font-weight:600">${esc(v)}</span>` } });
  }
  function vRep(L) {
    const cols = [{ t: 'Funcionário' }, { t: 'PN' }, { t: 'Lançamentos reprovados', tipo: 'int' }, { t: 'H reprovadas', tipo: 'h' }, { t: 'Dias com reprovação', tipo: 'int' }, { t: 'Datas' }].concat(PODE ? [{ t: 'Valor reprovado', tipo: 'brl' }] : []);
    const rows = L.map(p => { const ds = p.dias.filter(z => (z.x.med || {}).nRep); if (!ds.length) return null;
      return [p.nome, p.pn, ds.reduce((a, z) => a + z.x.med.nRep, 0), ds.reduce((a, z) => a + (z.x.med.hRep || 0), 0), ds.length, ds.map(z => z.dd).join(', ')].concat(PODE ? [ds.reduce((a, z) => a + (z.x.med.valRep || 0), 0)] : []); }).filter(Boolean)
      .sort((a, b) => b[2] - a[2]);
    return tab('Lançamentos reprovados por funcionário', cols, rows);
  }
  function vPrev(L) {
    const cols = [{ t: 'Funcionário' }, { t: 'Data', tipo: 'data' }, { t: 'Dia' }, { t: 'Previsto (alocação)' }, { t: 'Medido (OM)' }, { t: 'Presença' }, { t: 'Diferença' }];
    const rows = []; L.forEach(p => p.dias.forEach(z => {
      const prev = z.prev.length ? z.prev.map(a => a.omNumero) : (z.prevLista ? [z.prevLista] : []); const med = Object.keys((z.x.med || {}).oms || {});
      let dif = '';
      if (prev.length && !z.pres) dif = 'Previsto e sem presença';
      else if (!prev.length && z.pres) dif = 'Trabalhou sem estar previsto';
      else if (prev.length && med.length && !med.some(o => prev.some(x => MEDC.nk(x) === MEDC.nk(o)))) dif = 'OM medida diferente da prevista';
      else if (prev.length && z.pres && !med.length) dif = 'Previsto, trabalhou e não foi medido';
      if (!dif) return;
      rows.push([p.nome, z.data, DSEM[dow(z.data)], prev.join(', ') || '—', med.join(', ') || '—', z.pres ? (z.loc || 'ponto') + ' ' + h2(z.trab) + ' h' : 'não', dif]);
    }));
    return tab('Previsto × realizado (só os dias com diferença)', cols, rows) + (L.some(p => !p.f) ? '<p class="cs" style="margin-top:8px">Funcionários com "?" no mapa não estão ligados ao cadastro do portal, então a alocação prevista deles não aparece. Toque num dia deles para ligar.</p>' : '');
  }
  function vDiv(L) {
    const tol = (+M.cfg.tolMin || 0) / 60;
    const cols = [{ t: 'Funcionário' }, { t: 'Data', tipo: 'data' }, { t: 'Roleta (h)', tipo: 'h' }, { t: 'Ponto (h)', tipo: 'h' }, { t: 'Medido (h)', tipo: 'h' }, { t: 'O que não bate' }];
    const rows = []; L.forEach(p => p.dias.forEach(z => {
      const r = (z.x.rol || {}).h || 0, t = (z.x.pto || {}).h || 0, m = z.med; const q = [];
      if (r && t && Math.abs(r - t) > 1) q.push('roleta e ponto diferem mais de 1 h');
      if (r && !t && Object.keys(z.x.pto || {}).length === 0 && (M.docs || []).some(d => Object.values(d.dias || {}).some(x => x.pto))) q.push('roleta sem ponto');
      if (t && !r && (z.x.rol || {}).n !== undefined) q.push('ponto sem roleta');
      if ((z.x.rol || {}).so1) q.push('roleta com um acesso só');
      if (m > Math.max(r, t) + tol && (r || t)) q.push('medido acima da presença');
      if (m > 0 && !r && !t) q.push('medido sem presença');
      if ((z.x.rol || {}).neg) q.push(z.x.rol.neg + ' acesso(s) negado(s)');
      if (q.length) rows.push([p.nome, z.data, r, t, m, q.join('; ')]);
    }));
    return tab('Medido × ponto × roleta (dias que não batem)', cols, rows);
  }

  /* ---------- detalhe do dia ---------- */
  function detalhe(pn, dd) {
    const d = (M.docs || []).find(x => x.pn === pn); if (!d) return; const x = (d.dias || {})[dd] || {}; const data = M.mes + '-' + dd;
    const s = MEDC.situacao(x, +M.cfg.tolMin || 0); const f = funcDoc(d); const r = x.rol || {}, t = x.pto || {}, m = x.med || {};
    const prev = d.fid ? diaDe(d.fid, data) : [];
    const opts = PODE && !f ? `<label style="display:block;margin-top:10px;font-size:13px">Ligar ao funcionário do portal</label><select id="med-lig" style="width:100%;padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">— escolha —</option>${ativos().map(x => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</select><button class="btn sm primary" id="med-ligok" style="margin-top:6px">Ligar</button>` : '';
    sheet(`<div class="top"><h2>${esc(f ? f.nome : d.nome)}</h2><button class="btn sm ghost" id="m-x">Fechar</button></div>
      <p class="cs" style="margin:0 0 8px">PN ${esc(pn)} · ${fmtD(data)} (${DSEM[dow(data)]}) · ${s.st ? `<b style="color:${COR[s.st]}">${ROT[s.st]}</b>` : 'sem presença'}</p>
      <div class="card"><div class="ct">Roleta</div>${r.e || r.h ? `${esc(r.e || '?')} → ${esc(r.s || '?')} · ${h2(r.h)} h líquidas · ${r.loc === 'BM' ? 'Barra Mansa' : r.loc === 'RES' ? 'Resende' : '—'} · ${r.n || 0} acesso(s)${r.neg ? ` · ${r.neg} negado(s)` : ''}` : 'Sem acesso registrado.'}</div>
      <div class="card"><div class="ct">Ponto (RHiD)</div>${t.h || t.e ? `${esc(t.e || '')}${t.s ? ' → ' + esc(t.s) : ''} · ${h2(t.h)} h` : 'Sem ponto importado para o dia.'}</div>
      <div class="card"><div class="ct">Medido (portalRDO)</div>${m.n || m.nRep ? `${h2(m.h)} h válidas em ${m.n || 0} lançamento(s)${m.nRep ? ` · <b style="color:var(--bad)">${m.nRep} reprovado(s), ${h2(m.hRep)} h</b>` : ''}<br>
        ${Object.entries(m.oms || {}).map(([o, h]) => `OM ${esc(o)}: ${h2(h)} h`).join('<br>')}<br><span class="cs">${Object.entries(m.st || {}).map(([k, n]) => esc(k) + ' (' + n + ')').join(' · ')}</span>${PODE ? `<br>Valor: ${brl(m.val)}${m.valRep ? ' · reprovado ' + brl(m.valRep) : ''}` : ''}` : 'Nada medido no dia.'}</div>
      <div class="card"><div class="ct">Previsto (alocação)</div>${prev.length ? prev.map(a => `${a.omNumero ? 'OM ' + esc(a.omNumero) : 'Sem OM'} · ${esc(a.local || '')} ${esc(a.inicio || '')}–${esc(a.fim || '')}${a.virtual ? ' (OM fixa)' : ''}`).join('<br>') : (f ? 'Nada previsto.' : 'Ligue ao cadastro para ver o previsto.')}</div>
      <p class="cs">Trabalhado ${h2(s.trab)} h · medido ${h2(s.med)} h · falta ${h2(s.falta)} h (tolerância ${M.cfg.tolMin} min)</p>${opts}`);
    $('#m-x').onclick = fechar;
    const ok = $('#med-ligok'); if (ok) ok.onclick = async () => { const fid = $('#med-lig').value; if (!fid) return;
      try { await db.doc('med_cfg/pn').set({ map: { [pn]: fid } }, { merge: true }); M.mapa[pn] = fid; d.fid = fid; await db.doc('med_mes/' + d.id).set({ fid }, { merge: true }); toast('Funcionário ligado.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  }

  /* ---------- importação ---------- */
  let TIPO = '';
  async function lerArquivo(file) {
    const buf = await file.arrayBuffer();
    if (/\.xlsx?$/i.test(file.name)) {
      if (!window.ExcelJS) await new Promise((ok, err) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'; sc.onload = ok; sc.onerror = err; document.head.appendChild(sc); });
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); let ws = wb.worksheets[0]; const out = [];
      if (TIPO === 'lista') { const cab = w => { const r = []; w.eachRow({ includeEmpty: false }, (row, i) => { if (i <= 5) r.push(row.values.slice(1).map(c => MEDC.nk(c && c.text ? c.text : c))); }); return r; }; ws = wb.worksheets.find(w => cab(w).some(r => r.includes('MATRICULA') && r.includes('OM'))) || wb.worksheets.find(w => cab(w).some(r => r.includes('NOME') && r.includes('UNIDADE'))) || ws; }
      ws.eachRow({ includeEmpty: false }, row => { const v = row.values.slice(1).map(c => c && typeof c === 'object' && !(c instanceof Date) ? (c.result !== undefined ? c.result : c.text !== undefined ? c.text : (c.richText ? c.richText.map(x => x.text).join('') : '')) : c); out.push(v); });
      return out;
    }
    return MEDC.csv(MEDC.decodificar(buf));
  }
  const mesesDe = datas => [...new Set(datas.map(d => d.slice(0, 7)))].sort();
  async function importar(files) {
    const tipo = TIPO; if (!files.length) return;
    if (tipo === 'lista') return importarLista(files[0]);
    toast('Lendo ' + files.length + ' arquivo(s)…');
    try {
      let todas = [];
      for (const f of files) { const L = await lerArquivo(f); if (todas.length && tipo === 'med') { const hi = L.findIndex(r => r.some(c => MEDC.nk(c) === 'STATUS')); todas = todas.concat(L.slice(hi + 1)); } else todas = todas.concat(L); }
      const alm = +M.cfg.almocoMin || 0; let P, info = '';
      if (tipo === 'rol') { const r = MEDC.roleta(todas, alm); P = r.pessoas; info = `${Object.keys(P).length} pessoas · ${r.neg} acessos negados/desistências (não contam como presença)`; }
      else if (tipo === 'med') { const r = MEDC.medicao(todas); P = r.pessoas; info = `${r.linhas} lançamentos · ${Object.keys(P).length} pessoas${r.ignoradas ? ` · ${r.ignoradas} linhas ignoradas (repetidas ou sem PN/data)` : ''}${r.colunas.trab < 0 ? ' · ATENÇÃO: não achei a coluna de horas' : r.trabMin ? ' · horas lidas em minutos (Trab.Total)' : ''}`; }
      else { const r = MEDC.ponto(todas, alm); P = pontoPorPn(r.linhas); info = `${r.linhas.length} dias de ponto · ${Object.keys(P).length} pessoas ligadas${P._sem ? ` · ${P._sem} pessoas sem vínculo (não importadas)` : ''}`; delete P._sem; }
      const datas = Object.values(P).flatMap(p => Object.keys(p.dias)); if (!datas.length) return toast('Nenhuma linha válida no arquivo.', 'bad');
      const ini = datas.reduce((a, b) => a < b ? a : b), fim = datas.reduce((a, b) => a > b ? a : b); const meses = mesesDe(datas);
      const rot = { med: 'medição (portalRDO)', rol: 'roleta', pto: 'ponto (RHiD)' }[tipo];
      sheet(`<div class="top"><h2>Importar ${rot}</h2><button class="btn sm ghost" id="m-x">Cancelar</button></div>
        <p>${esc(files.map(f => f.name).join(', '))}</p><p><b>Período:</b> ${fmtD(ini)} a ${fmtD(fim)} (${meses.join(', ')})<br>${esc(info)}</p>
        <p class="cs">A ${rot} desse período é substituída pelo que está no arquivo; a roleta, o ponto e a medição continuam separados.${tipo === 'med' ? ' Selecione os arquivos da siderurgia e da trefilaria JUNTOS.' : ''}</p>
        <button class="btn big primary" id="med-ok">Importar</button>`);
      $('#m-x').onclick = fechar;
      $('#med-ok').onclick = async () => { $('#med-ok').disabled = true; $('#med-ok').textContent = 'Gravando…';
        try { const n = await gravar(tipo, P, ini, fim, meses); toast(`Importado: ${n} funcionário(s)/mês atualizados.`, 'ok'); fechar(); M.docs = null; if (meses.length) M.mes = meses[meses.length - 1]; carregar(); }
        catch (e) { console.error(e); toast('Não foi possível gravar: ' + (e.message || e), 'bad'); $('#med-ok').disabled = false; $('#med-ok').textContent = 'Importar'; } };
    } catch (e) { console.error(e); toast(e.message || 'Não foi possível ler o arquivo.', 'bad'); }
  }
  /* lista de funcionários do mês (pasta MEDIÇÕES do Drive, aba "FUNCIONÁRIOS COM OM"): matrícula ArcelorMittal, status, área, subárea, unidade e OM.
     Só esses campos são lidos: salário e valores da planilha NÃO entram no portal. */
  async function importarLista(file) {
    try {
      const R = await lerArquivo(file); const hi = R.findIndex(r => r.some(c => MEDC.nk(c) === 'NOME') && r.some(c => ['UNIDADE', 'AREA', 'OM'].includes(MEDC.nk(c))));
      if (hi < 0) return toast('Não achei o cabeçalho (NOME, ÁREA, UNIDADE, OM).', 'bad');
      const H = R[hi].map(c => MEDC.nk(c)); const col = (...n) => H.findIndex(h => n.includes(h));
      const c = { mat: col('MATRICULA', 'CADASTRO', 'PN'), st: col('STATUS'), nome: col('NOME'), fn: col('FUNCAO'), ar: col('AREA'), sub: col('SUB-AREA', 'SUBAREA', 'SUB AREA'), un: col('UNIDADE'), om: col('OM'), lan: col('LANCADO?', 'LANCADO') };
      const P = {}; let semMat = 0;
      const v = (r, i) => i < 0 ? '' : String(r[i] == null ? '' : r[i]).replace(/\s+/g, ' ').trim();
      for (const r of R.slice(hi + 1)) {
        const nome = v(r, c.nome); if (!nome) continue;
        let pn = v(r, c.mat).replace(/\D/g, '');
        if (!pn) { const fid = acharFunc('', nome); const ex = Object.entries(M.mapa).find(([, f]) => f === fid); pn = ex ? ex[0] : ''; }
        if (!pn) { semMat++; continue; }
        const om = v(r, c.om).replace(/\D/g, '').length >= 8 ? v(r, c.om).replace(/\D/g, '') : v(r, c.om);
        P[pn] = { nome, funcao: v(r, c.fn), area: v(r, c.ar).replace(/^\?+$/, ''), subarea: v(r, c.sub), unidade: v(r, c.un), om, status: v(r, c.st), lancado: v(r, c.lan) };
      }
      const n = Object.keys(P).length; if (!n) return toast('Nenhuma linha com matrícula.', 'bad');
      const sit = {}; Object.values(P).forEach(p => { const k = p.status || 'Ativo'; sit[k] = (sit[k] || 0) + 1; });
      const comOm = Object.values(P).filter(p => /\d{8,}/.test(p.om)).length;
      sheet(`<div class="top"><h2>Lista de funcionários do mês</h2><button class="btn sm ghost" id="m-x">Cancelar</button></div>
        <p>${esc(file.name)}</p><p><b>${n}</b> pessoas · ${comOm} com OM · ${Object.entries(sit).map(([k, x]) => esc(k) + ': ' + x).join(' · ')}${semMat ? ` · ${semMat} sem matrícula (não importadas)` : ''}</p>
        <label>Mês da lista</label><input type="month" id="ls-mes" value="${esc(M.mes)}" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:4px 0 10px">
        <p class="cs">Grava só matrícula, nome, função, área, subárea, unidade, OM, status e "lançado?". Salários e valores da planilha não são lidos. A lista anterior do mês é substituída.</p>
        <button class="btn big primary" id="ls-ok">Importar</button>`);
      $('#m-x').onclick = fechar;
      $('#ls-ok').onclick = async () => { const mes = $('#ls-mes').value; if (!mes) return; $('#ls-ok').disabled = true;
        try { await db.doc('med_lista/' + mes).set({ mes, pessoas: P, arquivo: file.name, em: new Date().toISOString(), por: MEU }); toast('Lista importada: ' + n + ' pessoas.', 'ok'); fechar(); M.mes = mes; M.docs = null; carregar(); }
        catch (e) { $('#ls-ok').disabled = false; toast('Não foi possível gravar (publique a regra med_lista).', 'bad'); } };
    } catch (e) { console.error(e); toast(e.message || 'Não foi possível ler o arquivo.', 'bad'); }
  }
  // ponto: CPF/matrícula/nome → funcionário do portal → PN (pelo mapa e pelos dados já importados)
  function pontoPorPn(L) {
    const fid2pn = {}; Object.entries(M.mapa).forEach(([pn, fid]) => fid2pn[fid] = pn); (M.docsTodos || M.docs || []).forEach(d => { if (d.fid) fid2pn[d.fid] = d.pn; });
    const P = {}; const sem = new Set();
    for (const r of L) {
      let f = r.cpf ? D.func.find(x => String(x.cpf || '').replace(/\D/g, '') === r.cpf) : null;
      if (!f && r.mat) f = D.func.find(x => String(x.matricula || '').trim() === r.mat);
      if (!f && r.nome) { const c = D.func.filter(x => MEDC.nk(x.nome) === MEDC.nk(r.nome)); if (c.length === 1) f = c[0]; }
      const pn = f ? (fid2pn[f.id] || String(f.pn || '').replace(/\D/g, '') || 'f_' + f.id) : '';
      if (!pn) { sem.add(r.nome || r.cpf); continue; }
      const p = P[pn] = P[pn] || { nome: f.nome, fid: f.id, dias: {} };
      const x = p.dias[r.d]; if (x) { x.h = +(x.h + r.h).toFixed(2); if (r.s) x.s = r.s; } else p.dias[r.d] = { h: r.h, e: r.e, s: r.s };
    }
    P._sem = sem.size; return P;
  }
  async function gravar(tipo, P, ini, fim, meses) {
    const campo = tipo; let n = 0;
    // docs existentes dos meses (para limpar dias do período que não vieram no arquivo)
    const exist = {};
    for (const mes of meses) (await db.collection('med_mes').where('mes', '==', mes).get()).docs.forEach(d => exist[d.id] = d.data());
    const ops = [];
    const porDoc = {};
    for (const [pn, p] of Object.entries(P)) for (const [d, v] of Object.entries(p.dias)) {
      const mes = d.slice(0, 7), dd = d.slice(8, 10), id = mes + '_' + pn;
      const o = porDoc[id] = porDoc[id] || { mes, pn, nome: p.nome || '', dias: {} };
      if (p.fid || (!(exist[id] || {}).fid && acharFunc(pn, p.nome))) o.fid = p.fid || acharFunc(pn, p.nome);
      o.dias[dd] = { [campo]: v };
    }
    for (const [id, e] of Object.entries(exist)) for (const dd of Object.keys(e.dias || {})) {
      const d = e.mes + '-' + dd; if (d < ini || d > fim || !(e.dias[dd] || {})[campo]) continue;
      const o = porDoc[id] = porDoc[id] || { mes: e.mes, pn: e.pn, dias: {} }; if (!o.dias[dd]) o.dias[dd] = { [campo]: null };
    }
    for (const [id, o] of Object.entries(porDoc)) { o.atualizadoEm = new Date().toISOString(); o['imp_' + campo] = { em: o.atualizadoEm, por: MEU, ini, fim }; ops.push([id, o]); }
    for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(([id, o]) => b.set(db.doc('med_mes/' + id), o, { merge: true })); await b.commit(); n += Math.min(400, ops.length - i); }
    return n;
  }

  function config() {
    sheet(`<div class="top"><h2>Regras da medição</h2><button class="btn sm ghost" id="m-x">Fechar</button></div>
      <label>Tolerância (minutos): medido até isso abaixo do trabalhado ainda fica verde</label><input id="cf-tol" type="number" min="0" value="${esc(M.cfg.tolMin)}" style="width:100%;padding:8px;border:1px solid #cfd4dc;border-radius:8px">
      <label style="margin-top:8px;display:block">Almoço descontado da roleta (minutos, em jornadas de 6 h ou mais)</label><input id="cf-alm" type="number" min="0" value="${esc(M.cfg.almocoMin)}" style="width:100%;padding:8px;border:1px solid #cfd4dc;border-radius:8px">
      <p class="cs">O almoço vale para as próximas importações da roleta e do ponto.</p><button class="btn big primary" id="cf-ok">Salvar</button>`);
    $('#m-x').onclick = fechar;
    $('#cf-ok').onclick = async () => { const c = { tolMin: Math.max(0, +$('#cf-tol').value || 0), almocoMin: Math.max(0, +$('#cf-alm').value || 0) };
      try { await db.doc('med_cfg/geral').set(c, { merge: true }); Object.assign(M.cfg, c); toast('Regras salvas.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    if (V.tab !== 'med') return;
    const sb = e.target.closest('[data-medsub]'); if (sb) { M.sub = sb.dataset.medsub; render(); return; }
    const dd = e.target.closest('[data-medd]'); if (dd) { const [pn, d] = dd.dataset.medd.split('|'); detalhe(pn, d); return; }
    const im = e.target.closest('[data-medimp]'); if (im && PODE) { TIPO = im.dataset.medimp; const f = $('#med-file'); f.value = ''; f.click(); return; }
    if (e.target.closest('[data-medcfg]') && PODE) { config(); return; }
    if (e.target.closest('[data-medexp]') && ULT && window.PrevRel) {
      const cols = ULT.cols.map(c => ({ t: c.t, tipo: c.tipo === 'h' ? 'num' : c.tipo === 'int' ? 'int' : c.tipo || 'txt' }));
      PrevRel.escolher({ modelo: 'rel_medicao', titulo: ULT.titulo, cols, linhas: ULT.rows, filtros: filtroTxt(), arquivo: 'Medicao ' + M.mes, totais: true });
    }
  });
  document.addEventListener('change', e => {
    if (V.tab !== 'med') return;
    if (e.target.id === 'med-mes' && e.target.value) { M.mes = e.target.value; M.docs = null; render(); }
    if (e.target.id === 'med-loc') { M.loc = e.target.value; render(); }
    if (e.target.id === 'med-grupo') { M.grupo = e.target.value; render(); }
    if (e.target.id === 'med-area') { M.area = e.target.value; render(); }
    if (e.target.id === 'med-file') importar([...e.target.files]);
  });
  let tb; document.addEventListener('input', e => { if (e.target.id === 'med-busca') { clearTimeout(tb); tb = setTimeout(() => { M.busca = e.target.value; render(); const i = $('#med-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } });
})();
