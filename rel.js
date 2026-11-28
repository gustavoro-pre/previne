/* PREVINE · relatórios do portal (Excel e PDF) com o cabeçalho da empresa e o número de controle do documento.
   Todo relatório exportado pelo portal passa por aqui. O código, a revisão, o elaborador e o aprovador vêm do
   modelo registrado na Documentação (config/modelos[<chave>]); enquanto não for registrado, sai o código provisório abaixo.
   Uso: await PrevRel.exportar({ modelo:'rel_funcionarios', titulo, cols:[{t:'Nome', tipo:'txt'|'int'|'num'|'brl'|'h'|'pct'|'data', w}], linhas:[[...]], filtros:'…', arquivo:'Funcionarios', formato:'xlsx'|'pdf', totais:true }) */
(function () {
  'use strict';
  const EMP = { nome: 'PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA', cnpj: '03.052.261/0001-43', end: 'Av. Homero Leite, 198, Saudade, Barra Mansa – RJ' };
  const MODELOS = {
    rel_funcionarios: ['Relação de funcionários', 'REL-RH-001'], rel_folha: ['Folha: horas e remuneração', 'REL-RH-002'], rel_absenteismo: ['Absenteísmo', 'REL-RH-003'],
    rel_cautelas: ['Relatório de cautelas de ferramentas', 'REL-ALM-001'], rel_ocorrencias: ['Ocorrências com ferramentas', 'REL-ALM-002'], rel_entregas_epi: ['Entregas de EPI', 'REL-SST-001'],
    rel_ficha_epi: ['Histórico de EPI do funcionário', 'REL-SST-002'], rel_matriz_trein: ['Matriz de treinamentos', 'REL-SST-003'], rel_deacordo: ['Registro de de acordo', 'REL-SST-004'],
    rel_lista_mestra: ['Lista mestra de documentos', 'REL-SGI-001'], rel_deslocamentos: ['Deslocamentos (alocação em OM)', 'REL-OPE-001'], rel_alocacao: ['Alocação em OM', 'REL-OPE-002'], rel_medicao: ['Medição de HH × presença', 'REL-OPE-003'], rel_ocorrencias_sst: ['Ocorrências e ações corretivas', 'REL-SGI-002'],
    rel_indicador: ['Base de indicador', 'REL-GER-001'], rel_painel: ['Painel de indicadores', 'REL-GER-002'], relatorio: ['Relatório', 'REL-GER-000']
  };
  const AZUL = '1F3A8A', AZUL_RGB = [31, 58, 138], CINZA = 'D9DEE8';
  const s = v => v == null ? '' : String(v);
  const load = (src, ok) => ok() ? Promise.resolve(ok()) : new Promise((res, rej) => { const e = document.createElement('script'); e.src = src; e.onload = () => ok() ? res(ok()) : rej(new Error('Biblioteca não carregou')); e.onerror = () => rej(new Error('Sem internet para gerar o arquivo')); document.head.appendChild(e); });
  const libXLSX = () => load('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', () => window.ExcelJS);
  const libPDF = async () => { await load('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf && window.jspdf.jsPDF); return load('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', () => window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable && window.jspdf); };
  let LOGO = null;
  async function logo() { if (LOGO) return LOGO; try { const b = await (await fetch(new URL('/logo.png', location.origin).href)).blob(); LOGO = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch (e) { LOGO = ''; } return LOGO; }
  const fmtD = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(d)); return m ? m[3] + '/' + m[2] + '/' + m[1] : s(d); };
  async function modelo(k) {
    const base = MODELOS[k] || MODELOS.relatorio; let m = null;
    try { const db = window.__fbUse ? await window.__fbUse('db') : null; if (db) { const d = await db.doc('config/modelos').get(); m = d.exists ? (d.data() || {})[k] : null; } } catch (e) { m = null; }
    if (m && m.codigo) return { codigo: m.codigo, rev: String(+m.rev || 0).padStart(2, '0'), data: fmtD(m.data), elab: s(m.elaborador) || '—', aprov: s(m.aprovador) || '—', prov: false, nome: base[0] };
    return { codigo: base[1], rev: '00', data: '—', elab: '—', aprov: '—', prov: true, nome: base[0] };
  }
  const quem = () => { const F = window.__FB || {}; const p = F.perfil || {}; return s(p.nome) || s(F.email) || s((F.user || {}).email) || 'usuário do portal'; };
  const agora = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  const nomeArq = (a, ext) => s(a || 'Relatorio').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ' + new Date().toISOString().slice(0, 10) + '.' + ext;
  function baixar(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  /* valores: datas ISO viram datas do Excel; % chega como fração (0,25 = 25%) */
  const valor = (v, t) => { if (v == null || v === '') return null; if (t === 'data') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(v)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : s(v); } if (['int', 'num', 'brl', 'h', 'pct'].includes(t)) { const n = typeof v === 'number' ? v : parseFloat(s(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : s(v); } return s(v); };
  const NUMFMT = { int: '#,##0', num: '#,##0.0#', brl: '"R$" #,##0.00', h: '#,##0.0"h"', pct: '0.0%', data: 'dd/mm/yyyy' };
  const txtPDF = (v, t) => { if (v == null || v === '') return ''; if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10).split('-').reverse().join('/'); if (t === 'data') return fmtD(v); const n = typeof v === 'number' ? v : NaN; if (!isFinite(n)) return s(v);
    if (t === 'brl') return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); if (t === 'pct') return (Math.round(n * 1000) / 10).toLocaleString('pt-BR') + '%'; if (t === 'h') return (Math.round(n * 10) / 10).toLocaleString('pt-BR') + 'h'; if (t === 'int') return Math.round(n).toLocaleString('pt-BR'); return (Math.round(n * 100) / 100).toLocaleString('pt-BR'); };
  const SOMA = ['int', 'num', 'brl', 'h'];

  async function xlsx(o, M) {
    const ExcelJS = await libXLSX(); const wb = new ExcelJS.Workbook(); wb.creator = EMP.nome; wb.created = new Date();
    const cols = o.cols, nc = Math.max(cols.length, 6); const ws = wb.addWorksheet(s(o.aba || 'Relatório').slice(0, 31), { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }] });
    ws.columns = Array.from({ length: nc }, (_, i) => ({ width: (cols[i] && cols[i].w) || (cols[i] ? Math.min(40, Math.max(10, s(cols[i].t).length + 4)) : 12) }));
    { const a = ws.getColumn(nc - 1), b = ws.getColumn(nc); const falta = 50 - (a.width + b.width); if (falta > 0) b.width += falta; const t = ws.columns.slice(1, nc - 2).reduce((x, c) => x + c.width, 0); if (t < 46) ws.getColumn(Math.max(2, nc - 2)).width += 46 - t; }
    const L = (r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); return ws.getCell(r, c1); };
    const dirIni = nc - 1; /* bloco de controle nas 2 últimas colunas */
    const img = await logo(); if (img) { const id = wb.addImage({ base64: img, extension: 'png' }); ws.addImage(id, { tl: { col: 0.15, row: 0.2 }, ext: { width: 74, height: 56 } }); }
    for (let r = 1; r <= 4; r++) ws.getRow(r).height = 17;
    const c1 = L(1, 2, dirIni - 1); c1.value = EMP.nome; c1.font = { bold: true, size: 12, color: { argb: 'FF' + AZUL } };
    const c2 = L(2, 2, dirIni - 1); c2.value = 'CNPJ ' + EMP.cnpj + ' · ' + EMP.end; c2.font = { size: 9, color: { argb: 'FF555555' } };
    const c3 = L(3, 2, dirIni - 1); c3.value = s(o.titulo || M.nome).toUpperCase(); c3.font = { bold: true, size: 13 };
    const c4 = L(4, 2, dirIni - 1); c4.value = o.filtros ? 'Filtros: ' + o.filtros : ''; c4.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
    const ctl = [['Documento', M.codigo + (M.prov ? ' (provisório)' : '')], ['Revisão', M.rev + ' · ' + M.data], ['Elaborado / Aprovado', M.elab + ' / ' + M.aprov], ['Emitido', agora() + ' · ' + quem()]];
    ctl.forEach(([k, v], i) => { const c = L(i + 1, dirIni, nc); c.value = { richText: [{ text: k + ': ', font: { bold: true, size: 9 } }, { text: v, font: { size: 9 } }] }; c.alignment = { horizontal: 'left', vertical: 'middle' }; c.border = { left: { style: 'thin', color: { argb: 'FF' + CINZA } } }; });
    [c1, c2, c3, c4].forEach(c => c.alignment = { vertical: 'middle', horizontal: 'left' });
    for (let c = 1; c <= nc; c++) ws.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: 'FF' + AZUL } } };
    ws.getRow(5).height = 6;
    const hr = ws.getRow(7); cols.forEach((c, i) => { const x = hr.getCell(i + 1); x.value = c.t; x.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL } }; x.alignment = { vertical: 'middle', horizontal: SOMA.concat('pct').includes(c.tipo) ? 'right' : 'left', wrapText: true }; x.border = { bottom: { style: 'thin', color: { argb: 'FF' + AZUL } } }; }); hr.height = 30;
    o.linhas.forEach((ln, k) => { const row = ws.getRow(8 + k); cols.forEach((c, i) => { const x = row.getCell(i + 1); x.value = valor(ln[i], c.tipo); if (NUMFMT[c.tipo]) x.numFmt = NUMFMT[c.tipo]; x.alignment = { vertical: 'top', horizontal: SOMA.concat('pct').includes(c.tipo) ? 'right' : (c.tipo === 'data' ? 'center' : 'left'), wrapText: !!c.wrap }; x.font = { size: 10 }; x.border = { bottom: { style: 'hair', color: { argb: 'FF' + CINZA } } }; if (k % 2) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6FA' } }; }); });
    const fim = 8 + o.linhas.length;
    if (o.linhas.length) ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: fim - 1, column: cols.length } };
    if (o.totais && o.linhas.length) { const row = ws.getRow(fim); row.getCell(1).value = 'Total'; row.getCell(1).font = { bold: true };
      cols.forEach((c, i) => { if (i && SOMA.includes(c.tipo)) { const L1 = ws.getColumn(i + 1).letter; const x = row.getCell(i + 1); x.value = { formula: `SUBTOTAL(9,${L1}8:${L1}${fim - 1})` }; x.numFmt = NUMFMT[c.tipo]; x.font = { bold: true }; x.alignment = { horizontal: 'right' }; } row.getCell(i + 1).border = { top: { style: 'thin', color: { argb: 'FF' + AZUL } } }; }); }
    const nota = ws.getCell(fim + (o.totais ? 2 : 1), 1); nota.value = `${o.linhas.length} registro(s). ${o.nota || ''}Documento controlado: ${M.codigo} rev. ${M.rev}. Cópia impressa não é controlada.`; nota.font = { italic: true, size: 8, color: { argb: 'FF777777' } };
    ws.pageSetup = { orientation: cols.length > 7 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 }, printTitlesRow: '1:7' };
    ws.headerFooter = { oddFooter: `&L&8${M.codigo} rev. ${M.rev} · ${s(o.titulo || M.nome)}&R&8Página &P de &N` };
    const buf = await wb.xlsx.writeBuffer(); baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArq(o.arquivo || o.titulo, 'xlsx'));
  }

  async function pdf(o, M) {
    const lib = await libPDF(); const cols = o.cols; const land = o.paisagem != null ? o.paisagem : cols.length > 6;
    const doc = new lib.jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' }); const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), Lm = 10, R = W - 10;
    const img = await logo(); const tit = s(o.titulo || M.nome).toUpperCase(); const em = agora() + ' · ' + quem();
    const cab = () => {
      doc.setDrawColor(...AZUL_RGB); doc.setLineWidth(0.3); doc.rect(Lm, 8, R - Lm, 22);
      if (img) try { doc.addImage(img, 'PNG', Lm + 2, 10, 23, 18); } catch (e) {}
      const bx = R - 62; doc.line(bx, 8, bx, 30); doc.line(Lm + 27, 8, Lm + 27, 30);
      doc.setTextColor(...AZUL_RGB); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(EMP.nome, Lm + 30, 13);
      doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('CNPJ ' + EMP.cnpj + ' · ' + EMP.end, Lm + 30, 17);
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(doc.splitTextToSize(tit, bx - Lm - 33), Lm + 30, 23);
      doc.setFontSize(7); [['Documento', M.codigo + (M.prov ? ' (provisório)' : '')], ['Revisão', M.rev + ' · ' + M.data], ['Elaborado', M.elab], ['Aprovado', M.aprov]].forEach(([k, v], i) => { doc.setFont('helvetica', 'bold'); doc.text(k + ':', bx + 2, 12.5 + i * 4.6); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(s(v), 40)[0], bx + 18, 12.5 + i * 4.6); });
      if (o.filtros) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(90); doc.text(doc.splitTextToSize('Filtros: ' + o.filtros, R - Lm)[0], Lm, 34); }
    };
    const fs = cols.length > 14 ? 6 : cols.length > 10 ? 6.8 : 7.8;
    const body = o.linhas.map(ln => cols.map((c, i) => txtPDF(valor(ln[i], c.tipo), c.tipo)));
    if (o.totais && o.linhas.length) body.push(cols.map((c, i) => i === 0 ? 'Total' : SOMA.includes(c.tipo) ? txtPDF(o.linhas.reduce((a, l) => a + (typeof valor(l[i], c.tipo) === 'number' ? valor(l[i], c.tipo) : 0), 0), c.tipo) : ''));
    if (cols.length > 14) { /* muitas colunas: uma ficha por linha, com os campos em três colunas */
      let y = o.filtros ? 38 : 35; const lw = (R - Lm) / 3; cab();
      o.linhas.forEach((ln, k) => { const pares = cols.slice(1).map((c, i) => [c.t, txtPDF(valor(ln[i + 1], c.tipo), c.tipo) || '—']); const lin = []; for (let i = 0; i < pares.length; i += 3) lin.push([0, 1, 2].flatMap(j => pares[i + j] ? [pares[i + j][0], pares[i + j][1]] : ['', '']));
        doc.autoTable({ head: [[{ content: s(ln[0]), colSpan: 6 }]], body: lin, startY: y, margin: { top: 38, left: Lm, right: 10, bottom: 14 }, theme: 'grid', rowPageBreak: 'avoid',
          styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.1, overflow: 'linebreak', lineColor: [217, 222, 232], lineWidth: 0.1 }, headStyles: { fillColor: AZUL_RGB, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: lw * 0.42, textColor: [70, 70, 70] }, 1: { cellWidth: lw * 0.58 }, 2: { fontStyle: 'bold', cellWidth: lw * 0.42, textColor: [70, 70, 70] }, 3: { cellWidth: lw * 0.58 }, 4: { fontStyle: 'bold', cellWidth: lw * 0.42, textColor: [70, 70, 70] }, 5: { cellWidth: lw * 0.58 } },
          didDrawPage: () => cab() }); y = doc.lastAutoTable.finalY + 4; });
    } else
    doc.autoTable({ head: [cols.map(c => c.t)], body, startY: o.filtros ? 37 : 34, margin: { top: 37, left: Lm, right: 10, bottom: 14 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: fs, cellPadding: 1.3, overflow: 'linebreak', valign: 'top', lineColor: [217, 222, 232], lineWidth: 0.1 },
      headStyles: { fillColor: AZUL_RGB, textColor: 255, fontStyle: 'bold', valign: 'middle' }, alternateRowStyles: { fillColor: [244, 246, 250] },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, { halign: SOMA.concat('pct').includes(c.tipo) ? 'right' : c.tipo === 'data' ? 'center' : 'left' }])),
      didParseCell: d => { if (o.totais && d.section === 'body' && d.row.index === body.length - 1) d.cell.styles.fontStyle = 'bold'; },
      didDrawPage: () => cab() });
    const n = doc.internal.getNumberOfPages();
    for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setDrawColor(...AZUL_RGB); doc.line(Lm, H - 10, R, H - 10); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(90);
      doc.text(`${M.codigo} rev. ${M.rev} · ${o.linhas.length} registro(s) · emitido em ${em} · cópia impressa não é controlada`, Lm, H - 6.5); doc.text(`Página ${p} de ${n}`, R, H - 6.5, { align: 'right' }); }
    baixar(doc.output('blob'), nomeArq(o.arquivo || o.titulo, 'pdf'));
  }

  async function exportar(o) {
    if (!o || !Array.isArray(o.cols) || !Array.isArray(o.linhas)) throw new Error('Relatório sem colunas');
    const M = await modelo(o.modelo || 'relatorio');
    return (o.formato === 'pdf' ? pdf : xlsx)(o, M);
  }
  /* para quem tinha CSV: cabeçalho na primeira linha, o resto são as linhas */
  /* para quem tinha CSV: cabeçalho na primeira linha, o resto são as linhas; o tipo de cada coluna é deduzido dos valores */
  function deMatriz(rows, extra) {
    const [cab, ...L0] = rows; const br = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const L = L0.map(r => r.map(v => { const m = br.exec(s(v).trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : v; }));
    const cols = cab.map((t, i) => { const V = L.map(r => r[i]).filter(v => v != null && s(v).trim() !== '');
      let tipo = 'txt'; if (V.length && V.every(v => /^\d{4}-\d{2}-\d{2}/.test(s(v)) && s(v).length <= 24)) tipo = 'data';
      else if (V.length && V.every(v => typeof v === 'number' || /^-?\d{1,12}([.,]\d+)?$/.test(s(v).trim()))) tipo = /valor|custo|r\$|preço|preco|salário|salario/i.test(s(t)) ? 'brl' : /^(qtd|quantidade|n[ºo°]?|horas?)\b/i.test(s(t)) ? 'num' : (/matr|c[oó]digo|cpf|ca\b|n[uú]mero|cautela|pis/i.test(s(t)) ? 'txt' : 'num');
      const w = Math.min(46, Math.max(9, s(t).length + 2, ...V.slice(0, 200).map(v => Math.min(46, s(v).length + 2)))); return { t: s(t), tipo, w }; });
    if (cols.some(c => c.tipo === 'data')) L.forEach(r => cols.forEach((c, i) => { if (c.tipo === 'data' && r[i]) r[i] = s(r[i]).slice(0, 10); }));
    return Object.assign({ cols, linhas: L }, extra || {});
  }
  /* janelinha: Excel ou PDF */
  function escolher(o) {
    return new Promise(res => {
      const bg = document.createElement('div'); bg.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,40,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
      bg.innerHTML = '<div style="background:#fff;color:#1b2333;border-radius:14px;max-width:380px;width:100%;padding:18px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.25);font:15px system-ui,sans-serif"><b style="font-size:17px">Exportar</b><p style="margin:6px 0 12px;color:#555;font-size:14px">' + s(o.titulo).replace(/[<>&]/g, '') + ' · ' + o.linhas.length + ' registro(s). Sai com o cabeçalho da Previne e o número de controle.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-f="xlsx" style="flex:1;padding:11px;border-radius:10px;border:0;background:#1f3a8a;color:#fff;font-weight:600;font-size:15px;cursor:pointer">Excel</button><button data-f="pdf" style="flex:1;padding:11px;border-radius:10px;border:1px solid #1f3a8a;background:#fff;color:#1f3a8a;font-weight:600;font-size:15px;cursor:pointer">PDF</button></div><button data-f="" style="margin-top:10px;width:100%;padding:8px;border:0;background:none;color:#666;cursor:pointer">Cancelar</button><p data-st style="margin:6px 0 0;font-size:13px;color:#555"></p></div>';
      document.body.appendChild(bg);
      bg.addEventListener('click', async e => { const b = e.target.closest('[data-f]'); if (!b && e.target !== bg) return; const f = b ? b.dataset.f : ''; if (!f) { bg.remove(); return res(false); }
        bg.querySelectorAll('button').forEach(x => x.disabled = true); bg.querySelector('[data-st]').textContent = 'Gerando…';
        try { await exportar(Object.assign({}, o, { formato: f })); bg.remove(); res(true); } catch (er) { bg.querySelector('[data-st]').textContent = 'Não foi possível gerar: ' + (er.message || er); bg.querySelectorAll('button').forEach(x => x.disabled = false); } });
    });
  }
  /* ---------- PDF de painel (KPIs + gráficos + tabelas) ----------
     Qualquer tela com um bloco .kpis ganha o botão "PDF do painel". O PDF sai com o cabeçalho padrão:
     cartões e gráficos como imagem (html2canvas), tabelas como tabela de texto (autoTable), com quebra de página. */
  const libH2C = () => load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => window.html2canvas);
  const visivel = el => !!(el && el.offsetParent !== null && el.getBoundingClientRect().height > 0);
  const raizPainel = k => { let e = k.parentElement; while (e && e.parentElement && e.parentElement !== document.body && !/^(MAIN|BODY)$/.test(e.parentElement.tagName) && !e.id) e = e.parentElement; return e || k.parentElement; };
  function filtrosDe(root) {
    const out = []; root.querySelectorAll('select, input').forEach(i => {
      if (!visivel(i) || /^(hidden|file|button|submit|checkbox|radio)$/.test(i.type)) return;
      const v = i.tagName === 'SELECT' ? s((i.options[i.selectedIndex] || {}).text) : s(i.value); if (!v.trim()) return;
      let lb = i.id ? root.querySelector('label[for="' + i.id + '"]') : null; if (!lb) { const p = i.parentElement; lb = p && p.querySelector('label'); }
      out.push((lb ? s(lb.textContent).trim() + ': ' : '') + v.trim());
    });
    root.querySelectorAll('.chip.on, .seg button.on, .pill button.on').forEach(b => { if (visivel(b)) out.push(s(b.textContent).trim()); });
    return [...new Set(out)].join(' · ');
  }
  const ehFiltro = b => !b.querySelector('table, .kpis, canvas, svg, .kpi') && !b.classList.contains('kpis') && b.querySelector('select, input') && s(b.textContent).replace(/\s+/g, ' ').length < 400;
  const tabelaDe = t => {
    const lin = tr => [...tr.children].map(c => { const k = c.cloneNode(true); k.querySelectorAll('button, input, select, .rel-pdf-bar').forEach(x => x.remove()); return s(k.textContent).replace(/\s+/g, ' ').trim(); });
    const head = t.tHead && t.tHead.rows.length ? lin(t.tHead.rows[t.tHead.rows.length - 1]) : [];
    const rows = [...(t.tBodies.length ? [].concat(...[...t.tBodies].map(b => [...b.rows])) : [...t.rows].slice(head.length ? 1 : 0))].filter(r => visivel(r) || r.offsetParent === null && !r.hidden).map(lin);
    const foot = t.tFoot ? [...t.tFoot.rows].map(lin) : [];
    /* tira colunas vazias (botões/ações) */
    const n = Math.max(head.length, ...rows.map(r => r.length), 0); const usa = [...Array(n).keys()].filter(i => (head[i] || '').trim() || rows.some(r => (r[i] || '').trim()));
    const pick = r => usa.map(i => r[i] || ''); return { head: head.length ? [pick(head)] : [], body: rows.map(pick).concat(foot.map(pick)), nFoot: foot.length };
  };
  async function painelPdf(root, o) {
    o = o || {}; const lib = await libPDF(); const h2c = await libH2C(); const M = await modelo(o.modelo || 'rel_painel');
    const doc = new lib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }); const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), Lm = 10, R = W - 10, CWm = R - Lm;
    const img = await logo(); const tit = s(o.titulo || M.nome).toUpperCase(); const em = agora() + ' · ' + quem(); const filt = o.filtros != null ? o.filtros : filtrosDe(root);
    const cab = () => {
      doc.setDrawColor(...AZUL_RGB); doc.setLineWidth(0.3); doc.rect(Lm, 8, R - Lm, 22);
      if (img) try { doc.addImage(img, 'PNG', Lm + 2, 10, 23, 18); } catch (e) {}
      const bx = R - 62; doc.line(bx, 8, bx, 30); doc.line(Lm + 27, 8, Lm + 27, 30);
      doc.setTextColor(...AZUL_RGB); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(EMP.nome, Lm + 30, 13);
      doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('CNPJ ' + EMP.cnpj + ' · ' + EMP.end, Lm + 30, 17);
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(doc.splitTextToSize(tit, bx - Lm - 33), Lm + 30, 23);
      doc.setFontSize(7); [['Documento', M.codigo + (M.prov ? ' (provisório)' : '')], ['Revisão', M.rev + ' · ' + M.data], ['Elaborado', M.elab], ['Aprovado', M.aprov]].forEach(([k, v], i) => { doc.setFont('helvetica', 'bold'); doc.text(k + ':', bx + 2, 12.5 + i * 4.6); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(s(v), 40)[0], bx + 18, 12.5 + i * 4.6); });
      if (filt) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(90); doc.text(doc.splitTextToSize('Filtros: ' + filt, R - Lm)[0], Lm, 34); }
    };
    const TOP = filt ? 38 : 35, BOT = H - 14; let y = TOP; cab();
    const nova = () => { doc.addPage(); cab(); y = TOP; };
    const blocos = [...root.children].filter(b => visivel(b) && !b.classList.contains('rel-pdf-bar') && !ehFiltro(b) && !/^(SCRIPT|STYLE|TEMPLATE)$/.test(b.tagName));
    const ignorar = el => el.classList && (el.classList.contains('rel-pdf-bar') || el.tagName === 'BUTTON' && !el.closest('.kpis') && !el.classList.contains('kpi') && !el.closest('.ritem')) ;
    async function imagem(el) {
      const cv = await h2c(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, ignoreElements: ignorar, windowWidth: Math.max(document.documentElement.clientWidth, 1100) });
      const mmPx = CWm / cv.width; let h = cv.height * mmPx, sy = 0; const w = Math.min(CWm, cv.width * mmPx);
      while (sy < cv.height) {
        let livre = BOT - y; if (livre < 20 && y > TOP) { nova(); livre = BOT - y; }
        const fatia = Math.min(cv.height - sy, Math.floor(livre / mmPx)); const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = fatia;
        c2.getContext('2d').drawImage(cv, 0, sy, cv.width, fatia, 0, 0, cv.width, fatia);
        doc.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', Lm, y, w, fatia * mmPx); y += fatia * mmPx + 3; sy += fatia; if (sy < cv.height) nova();
      }
    }
    for (const b of blocos) {
      const tabs = [...b.querySelectorAll('table')].filter(visivel);
      if (tabs.length && !b.querySelector('.kpis, canvas, svg')) {
        /* título do bloco (texto antes da primeira tabela) */
        const t0 = b.querySelector('.ct, h2, h3, .lbl, b'); const titB = t0 && !t0.closest('table') ? s(t0.textContent).trim() : '';
        if (titB) { if (y > BOT - 20) nova(); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...AZUL_RGB); doc.text(titB.slice(0, 160), Lm, y + 4); y += 7; }
        for (const t of tabs) {
          const T = tabelaDe(t); if (!T.body.length && !T.head.length) continue;
          const nc = Math.max((T.head[0] || []).length, ...T.body.map(r => r.length)); const fs = nc > 14 ? 6 : nc > 10 ? 6.8 : 7.8;
          doc.autoTable({ head: T.head, body: T.body, startY: y, margin: { top: TOP, left: Lm, right: 10, bottom: 14 }, theme: 'grid',
            styles: { font: 'helvetica', fontSize: fs, cellPadding: 1.2, overflow: 'linebreak', valign: 'top', lineColor: [217, 222, 232], lineWidth: 0.1 },
            headStyles: { fillColor: AZUL_RGB, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [244, 246, 250] },
            didParseCell: d => { if (d.section === 'body' && d.row.index >= T.body.length - T.nFoot) d.cell.styles.fontStyle = 'bold'; if (/^[-−R$\s\d.,%h]+$/.test(s(d.cell.raw)) && /\d/.test(s(d.cell.raw))) d.cell.styles.halign = 'right'; },
            didDrawPage: () => cab() });
          y = doc.lastAutoTable.finalY + 5;
        }
      } else await imagem(b);
    }
    const n = doc.internal.getNumberOfPages();
    for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setDrawColor(...AZUL_RGB); doc.line(Lm, H - 10, R, H - 10); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(90);
      doc.text(`${M.codigo} rev. ${M.rev} · emitido em ${em} · cópia impressa não é controlada`, Lm, H - 6.5); doc.text(`Página ${p} de ${n}`, R, H - 6.5, { align: 'right' }); }
    baixar(doc.output('blob'), nomeArq(o.arquivo || o.titulo || 'Painel', 'pdf'));
  }
  const tituloPainel = root => {
    const h = root.querySelector('h2'); const ab = document.querySelector('.tabs .on, .tab.on, nav .on, [aria-selected="true"], .seg .on');
    const mod = s(document.title).split('·')[0].trim(); const t = h && visivel(h) ? s(h.textContent).trim() : ab ? s(ab.textContent).trim() : '';
    return t && t !== mod ? (mod ? mod + ' – ' : '') + t : mod || 'Painel';
  };
  function poeBotoes() {
    document.querySelectorAll('.kpis').forEach(k => {
      if (!visivel(k) || k.closest('.rel-sem-pdf')) return; const root = raizPainel(k);
      if (!root || root.querySelector(':scope > .rel-pdf-bar') || root.dataset.relPdf === '1' && root.querySelector('.rel-pdf-bar')) return;
      if ([...root.querySelectorAll('.kpis')].filter(visivel)[0] !== k) return;
      const bar = document.createElement('div'); bar.className = 'rel-pdf-bar'; bar.style.cssText = 'display:flex;justify-content:flex-end;margin:0 0 6px';
      bar.innerHTML = '<button type="button" style="font:600 13px system-ui,sans-serif;padding:6px 12px;border-radius:8px;border:1px solid #1f3a8a;background:#fff;color:#1f3a8a;cursor:pointer">⤓ PDF do painel</button>';
      const bt = bar.querySelector('button');
      bt.onclick = async () => { const t0 = bt.textContent; bt.disabled = true; bt.textContent = 'Gerando PDF…'; try { const tit = tituloPainel(root); await painelPdf(root, { titulo: tit, arquivo: tit }); } catch (e) { console.error(e); alert('Não foi possível gerar o PDF: ' + (e.message || e)); } bt.disabled = false; bt.textContent = t0; };
      root.dataset.relPdf = '1'; root.insertBefore(bar, root.firstChild);
    });
  }
  if (typeof document !== 'undefined') {
    let agendado = false; const tick = () => { if (agendado) return; agendado = true; setTimeout(() => { agendado = false; try { poeBotoes(); } catch (e) {} }, 300); };
    const ini = () => { new MutationObserver(tick).observe(document.body, { childList: true, subtree: true }); tick(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ini); else ini();
  }
  window.PrevRel = { exportar, escolher, deMatriz, painelPdf, MODELOS, EMP };
})();
