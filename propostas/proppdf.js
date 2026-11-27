/* Gera a Proposta Técnica e a Comercial em PDF, com o mesmo conteúdo e o mesmo layout do DOCX.
   Truque: o PropDoc.build monta o documento com uma "biblioteca docx" falsa (abaixo) que só guarda a estrutura;
   depois esta estrutura é desenhada página a página com o jsPDF (cabeçalho, rodapé, tabelas, quebra de página).
   Funciona no navegador (window.jspdf, do CDN) e no Node (require('jspdf')) para teste. */
(function (root) {
  'use strict';
  /* ---------- biblioteca docx falsa: só guarda as opções ---------- */
  class Node0 { constructor(o) { Object.assign(this, o || {}); } }
  class TextRun extends Node0 { } class ImageRun extends Node0 { } class PageBreak extends Node0 { }
  class Paragraph extends Node0 { } class Table extends Node0 { } class TableRow extends Node0 { } class TableCell extends Node0 { }
  class Header extends Node0 { } class Footer extends Node0 { } class Document extends Node0 { }
  const LIB = {
    TextRun, ImageRun, PageBreak, Paragraph, Table, TableRow, TableCell, Header, Footer, Document,
    WidthType: { DXA: 'dxa' }, AlignmentType: { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'both' },
    BorderStyle: { SINGLE: 'single', NONE: 'none' }, ShadingType: { CLEAR: 'clear' }, PageNumber: { CURRENT: '\u0001', TOTAL_PAGES: '\u0002' },
    VerticalAlign: { CENTER: 'center' }, LevelFormat: { BULLET: 'bullet' }, TableLayoutType: { FIXED: 'fixed' }
  };

  const tw = v => (+v || 0) / 20;                       // twips -> pt
  const rgb = h => { const x = String(h || '222222').replace('#', ''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
  const TROCA = { '≥': '>=', '≤': '<=', '→': '->', '✓': 'v', '✕': 'x', ' ': ' ' };
  const limpa = t => String(t == null ? '' : t).replace(/[≥≤→✓✕ ]/g, c => TROCA[c]);

  function gerarPdf(P, tipo, opt) {
    const J = root.jspdf ? root.jspdf.jsPDF : require('jspdf').jsPDF;
    const PD = root.PropDoc || require('./propdoc.js');
    const D = PD.build(P, tipo, Object.assign({}, opt, { lib: LIB }));
    const sec = D.sections[0]; const pg = sec.properties.page; const M = pg.margin;
    const PW = tw(pg.size.width), PH = tw(pg.size.height), ML = tw(M.left), MR = tw(M.right), CW = PW - ML - MR;
    const doc = new J({ unit: 'pt', format: [PW, PH], compress: true });
    doc.setProperties({ title: D.title || '', creator: 'Portal Previne' });
    let total = 1, cur = 1;

    /* ---------- texto: quebra de linhas com estilos misturados ---------- */
    const fonte = r => { doc.setFont('helvetica', r.bold ? 'bold' : 'normal'); doc.setFontSize((r.size || 20) / 2); };
    const textoRun = r => r.children ? r.children.map(c => c === LIB.PageNumber.CURRENT ? String(cur) : c === LIB.PageNumber.TOTAL_PAGES ? String(total) : String(c)).join('') : limpa(r.text);
    function tokens(par) {
      const T = [];
      (par.children || []).forEach(r => {
        if (r instanceof ImageRun) { T.push({ img: r, w: r.transformation.width * 0.75, h: r.transformation.height * 0.75 }); return; }
        if (!(r instanceof TextRun)) return;
        fonte(r); const t = textoRun(r);
        t.split(/(\t| +)/).forEach(p => { if (!p) return; if (p === '\t') T.push({ tab: true, r }); else T.push({ t: p, r, sp: /^ +$/.test(p), w: doc.getTextWidth(p) }); });
      });
      return T;
    }
    function linhas(par, larg) {
      const T = tokens(par); const ind = par.numbering ? { left: 640, hanging: 0 } : (par.indent || {}); const esq = tw(ind.left), pend = tw(ind.hanging);
      const L = []; let lin = { it: [], w: 0, x0: esq - pend }; const lim = () => larg - lin.x0;
      const fecha = () => { while (lin.it.length && lin.it[lin.it.length - 1].sp) { lin.w -= lin.it.pop().w; } L.push(lin); lin = { it: [], w: 0, x0: esq }; };
      T.forEach(k => {
        if (k.tab) { lin.it.push(k); return; }
        if (k.sp && !lin.it.length) return;
        if (!k.sp && lin.w + k.w > lim() && lin.it.length) fecha();
        if (!k.sp && k.w > lim() && !k.img) { /* palavra maior que a linha: corta */ let s = k.t; fonte(k.r); while (s) { let n = s.length; while (n > 1 && doc.getTextWidth(s.slice(0, n)) > lim() - lin.w) n--; lin.it.push({ t: s.slice(0, n), r: k.r, w: doc.getTextWidth(s.slice(0, n)) }); lin.w += doc.getTextWidth(s.slice(0, n)); s = s.slice(n); if (s) fecha(); } return; }
        lin.it.push(k); lin.w += k.w;
      });
      if (lin.it.length || !L.length) fecha();
      const fator = (par.spacing && par.spacing.line ? par.spacing.line / 240 : 1) * 1.15;
      L.forEach(l => { const tam = l.it.filter(k => !k.img).reduce((a, k) => Math.max(a, (k.r.size || 20) / 2), 0) || 10; const im = l.it.filter(k => k.img).reduce((a, k) => Math.max(a, k.h), 0); l.asc = Math.max(tam * 0.8, im); l.h = Math.max(tam * fator, im + 2); });
      return L;
    }
    function altPar(par, larg) {
      const sp = par.spacing || {}; let h = tw(sp.before) + tw(sp.after);
      if ((par.children || []).some(c => c instanceof PageBreak)) return 0;
      const L = linhas(par, larg); h += L.reduce((a, l) => a + l.h, 0);
      if (par.border && par.border.bottom && par.border.bottom.style !== 'none') h += (par.border.bottom.space || 1) + 2;
      if (par.border && par.border.top && par.border.top.style !== 'none') h += (par.border.top.space || 1) + 1;
      return h;
    }
    function desenhaLinha(l, x, y, larg, al, ultima, tabRight) {
      const sobra = larg - l.x0 - l.w; let px = x + l.x0, extra = 0;
      const temTab = l.it.findIndex(k => k.tab);
      if (temTab >= 0 && tabRight) { /* rodapé: parte depois do tab alinhada à direita */
        const dir = l.it.slice(temTab + 1); const wd = dir.reduce((a, k) => a + (k.w || 0), 0);
        desenhaItens(l.it.slice(0, temTab), px, y, 0, l); desenhaItens(dir, x + larg - wd, y, 0, l); return;
      }
      if (al === 'center') px += sobra / 2; else if (al === 'right') px += sobra;
      else if (al === 'both' && !ultima) { const n = l.it.filter(k => k.sp).length; if (n) extra = sobra / n; }
      desenhaItens(l.it, px, y, extra, l);
    }
    function desenhaItens(it, px, y, extra, l) {
      it.forEach(k => {
        if (k.img) { doc.addImage(k.img.data, 'PNG', px, y + l.asc - k.h, k.w, k.h); px += k.w; return; }
        if (k.tab) return;
        if (k.sp) { px += k.w + extra; return; }
        fonte(k.r); doc.setTextColor(...rgb(k.r.color));
        if (/[²³]/.test(k.t)) { /* expoente desenhado à mão (o ² da fonte padrão não aparece em alguns leitores) */
          const tam = (k.r.size || 20) / 2; let xx = px;
          k.t.split(/([²³])/).forEach(pp => { if (!pp) return; if (pp === '²' || pp === '³') { doc.setFontSize(tam * 0.6); doc.text(pp === '²' ? '2' : '3', xx, y + l.asc - tam * 0.35); xx += doc.getTextWidth(pp === '²' ? '2' : '3'); doc.setFontSize(tam); } else { doc.text(pp, xx, y + l.asc); xx += doc.getTextWidth(pp); } });
        } else doc.text(k.t, px, y + l.asc);
        px += k.w;
      });
    }
    /* desenha parágrafo inteiro em (x,y) com largura larg; devolve a altura */
    function parTodo(par, x, y, larg) {
      const sp = par.spacing || {}; let yy = y + tw(sp.before); const L = linhas(par, larg);
      const hL = L.reduce((a, l) => a + l.h, 0);
      if (par.shading && par.shading.fill) { doc.setFillColor(...rgb(par.shading.fill)); doc.rect(x, yy - 1, larg, hL + 2, 'F'); }
      if (par.border && par.border.top && par.border.top.style !== 'none') { doc.setDrawColor(...rgb(par.border.top.color)); doc.setLineWidth((par.border.top.size || 4) / 8); doc.line(x, yy, x + larg, yy); yy += (par.border.top.space || 1) + 1; }
      const bul = par.numbering ? '•' : null;
      L.forEach((l, i) => { if (bul && i === 0) { const r0 = (l.it.find(k => k.r) || {}).r || {}; fonte(r0); doc.setTextColor(...rgb(r0.color)); doc.text(bul, x + 18, yy + l.asc); }
        desenhaLinha(l, x, yy, larg, par.alignment || 'left', i === L.length - 1, (par.tabStops || []).some(t => t.type === 'right')); yy += l.h; });
      if (par.border && par.border.bottom && par.border.bottom.style !== 'none') { yy += (par.border.bottom.space || 1); doc.setDrawColor(...rgb(par.border.bottom.color)); doc.setLineWidth((par.border.bottom.size || 4) / 8); doc.line(x, yy, x + larg, yy); yy += 2; }
      return yy + tw(sp.after) - y;
    }

    /* ---------- tabelas ---------- */
    const larguras = (tb, larg) => { const g = (tb.columnWidths || []).map(tw); const t = g.reduce((a, b) => a + b, 0) || 1; return g.map(v => v * larg / t); };
    function celulas(tb, row, larg) {
      const g = larguras(tb, larg); let ci = 0;
      return (row.children || []).map(c => { const n = c.columnSpan || 1; const w = g.slice(ci, ci + n).reduce((a, b) => a + b, 0); const x = g.slice(0, ci).reduce((a, b) => a + b, 0); ci += n; return { c, x, w }; });
    }
    const mg = c => { const m = c.margins || {}; return { t: tw(m.top || 50), b: tw(m.bottom || 50), l: tw(m.left || 90), r: tw(m.right || 90) }; };
    function altCel(c, w) { const m = mg(c); return m.t + m.b + (c.children || []).reduce((a, p) => a + (p instanceof Table ? altTab(p, w - m.l - m.r) : altPar(p, w - m.l - m.r)), 0); }
    function altLinha(tb, row, larg) { return celulas(tb, row, larg).reduce((a, k) => Math.max(a, altCel(k.c, k.w)), 0); }
    function altTab(tb, larg) { return (tb.rows || []).reduce((a, r) => a + altLinha(tb, r, larg), 0); }
    function bordas(tb) { const b = tb.borders || {}; const f = k => b[k] && b[k].style !== 'none' ? b[k] : null; return { top: f('top'), bottom: f('bottom'), left: f('left'), right: f('right'), h: f('insideHorizontal'), v: f('insideVertical') }; }
    function traco(b, x1, y1, x2, y2) { if (!b) return; doc.setDrawColor(...rgb(b.color)); doc.setLineWidth(Math.max(0.3, (b.size || 4) / 8)); doc.line(x1, y1, x2, y2); }
    function linhaTab(tb, row, x, y, larg, h, primeira, ultima) {
      const B = bordas(tb);
      celulas(tb, row, larg).forEach(({ c, x: cx, w }, i, arr) => {
        const X = x + cx; const m = mg(c);
        if (c.shading && c.shading.fill) { doc.setFillColor(...rgb(c.shading.fill)); doc.rect(X, y, w, h, 'F'); }
        const hc = altCel(c, w) - m.t - m.b; let yy = y + m.t + (h - m.t - m.b - hc) / 2;
        (c.children || []).forEach(p => { yy += p instanceof Table ? (tabela(p, X + m.l, yy, w - m.l - m.r), altTab(p, w - m.l - m.r)) : parTodo(p, X + m.l, yy, w - m.l - m.r); });
        traco(i === 0 ? B.left : B.v, X, y, X, y + h); if (i === arr.length - 1) traco(B.right, X + w, y, X + w, y + h);
      });
      traco(primeira ? B.top : B.h, x, y, x + larg, y); if (ultima) traco(B.bottom, x, y + h, x + larg, y + h);
    }
    function tabela(tb, x, y, larg) { (tb.rows || []).forEach((r, i, a) => { const h = altLinha(tb, r, larg); linhaTab(tb, r, x, y, larg, h, i === 0, i === a.length - 1); y += h; }); return y; }

    /* ---------- cabeçalho e rodapé ---------- */
    const hdr = sec.headers.default, ftr = sec.footers.default;
    const altBloco = (L, larg) => (L || []).reduce((a, b) => a + (b instanceof Table ? altTab(b, larg) : altPar(b, larg)), 0);
    const yHdr = tw(M.header), hHdr = altBloco(hdr.children, CW), hFtr = altBloco(ftr.children, CW);
    const topoCorpo = Math.max(tw(M.top), yHdr + hHdr), baseCorpo = PH - Math.max(tw(M.bottom), tw(M.footer) + hFtr + 4);
    const topo1 = tw(M.top), base1 = PH - tw(M.bottom);
    const desenhaBloco = (L, y) => (L || []).forEach(b => { y += b instanceof Table ? (tabela(b, ML, y, CW) - y) : parTodo(b, ML, y, CW); });

    /* ---------- corpo: paginação ---------- */
    let pag = 1; let y = topo1; const lim = () => pag === 1 && sec.properties.titlePage ? base1 : baseCorpo;
    const novaPag = () => { doc.addPage([PW, PH]); pag++; y = topoCorpo; };
    const kids = sec.children;
    kids.forEach((b, idx) => {
      if (b instanceof Paragraph && (b.children || []).some(c => c instanceof PageBreak)) { novaPag(); return; }
      if (b instanceof Table) {
        const rows = b.rows || []; const cab = rows[0] && rows[0].tableHeader ? rows[0] : null;
        rows.forEach((r, i) => {
          const h = altLinha(b, r, CW);
          if (y + h > lim() && y > (pag === 1 ? topo1 : topoCorpo) + 1) { if (i > 0) traco(bordas(b).bottom, ML, y, ML + CW, y); novaPag(); if (cab && r !== cab) { const hc = altLinha(b, cab, CW); linhaTab(b, cab, ML, y, CW, hc, true, false); y += hc; } }
          linhaTab(b, r, ML, y, CW, h, i === 0 || (cab && i === 1 && false), i === rows.length - 1); y += h;
        });
        return;
      }
      /* parágrafo */
      let h = altPar(b, CW);
      if (b.keepNext) { const prox = kids[idx + 1]; const hp = prox ? (prox instanceof Table ? altLinha(prox, prox.rows[0], CW) + (prox.rows[1] ? altLinha(prox, prox.rows[1], CW) : 0) : Math.min(altPar(prox, CW), 40)) : 0; if (y + h + hp > lim()) novaPag(); }
      if (y + h <= lim()) { y += parTodo(b, ML, y, CW); return; }
      /* parágrafo longo: quebra por linhas */
      const sp = b.spacing || {}; const L = linhas(b, CW); let ini = 0; y += tw(sp.before);
      while (ini < L.length) {
        let fim = ini, hh = 0; while (fim < L.length && y + hh + L[fim].h <= lim()) { hh += L[fim].h; fim++; }
        if (fim === ini) { novaPag(); continue; }
        const parte = Object.assign(Object.create(Paragraph.prototype), b, { spacing: { line: sp.line, before: 0, after: 0 } });
        let yy = y; L.slice(ini, fim).forEach((l, i) => { if (b.numbering && ini === 0 && i === 0) { const r0 = (l.it.find(k => k.r) || {}).r || {}; fonte(r0); doc.setTextColor(...rgb(r0.color)); doc.text('•', ML + 18, yy + l.asc); } desenhaLinha(l, ML, yy, CW, b.alignment || 'left', ini + i === L.length - 1, false); yy += l.h; });
        y = yy; ini = fim; if (ini < L.length) novaPag();
      }
      y += tw(sp.after);
    });

    /* ---------- cabeçalho/rodapé em todas as páginas (menos a capa) ---------- */
    total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      if (p === 1 && sec.properties.titlePage) continue;
      doc.setPage(p); cur = p; desenhaBloco(hdr.children, yHdr); desenhaBloco(ftr.children, PH - tw(M.footer) - hFtr);
    }
    return doc;
  }
  async function gerar(P, tipo, opt) { const doc = gerarPdf(P, tipo, opt); return root.document ? doc.output('blob') : Buffer.from(doc.output('arraybuffer')); }
  const API = { gerar, LIB };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PropPdf = API;
})(typeof window !== 'undefined' ? window : globalThis);
