/* Gera a Proposta Técnica e a Proposta Comercial (DOCX) no modelo padrão da Previne, a partir dos dados da proposta.
   Funciona no navegador (window.docx, do CDN) e no Node (require('docx')) para teste. */
(function (root) {
  "use strict";
  const X = () => root.docx || (typeof require === 'function' ? require('docx') : null);
  const NAVY = '14213D', BLUE = '1F4E9C', ZEBRA = 'EEF1F6', GRAY = '6B7280', LINE = 'C9D0DB', LBL = 'F4F6F9', GOLD = 'F2A900';
  const W = 10538; // largura útil (Carta, margens 1,5 cm)
  const EMP = 'PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA', CNPJ = 'CNPJ 03.052.261/0001-43', END = 'Av. Homero Leite, 198, Saudade, Barra Mansa – RJ';
  const s = v => v == null ? '' : String(v);
  const n = v => { const x = typeof v === 'number' ? v : parseFloat(s(v).replace(/\./g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const brl = v => n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const qtd = v => n(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtD = d => { const p = s(d).slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s(d); };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataExt = d => { const p = s(d).slice(0, 10).split('-'); return p.length === 3 ? `${+p[2]} de ${MESES[+p[1] - 1]} de ${p[0]}` : s(d); };

  /* valor por extenso (reais e centavos) */
  function extenso(v) {
    const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    const ate999 = x => { if (x === 100) return 'cem'; const c = Math.floor(x / 100), r = x % 100, p = []; if (c) p.push(C[c]); if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : '')); return p.join(' e '); };
    const inteiro = x => {
      if (x === 0) return 'zero';
      const g = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil'], [1, '', '']]; const p = []; let resto = x;
      for (const [b, s1, sn] of g) { const q = Math.floor(resto / b); resto %= b; if (!q) continue; if (b === 1e3 && q === 1) p.push('mil'); else p.push(ate999(q) + (s1 ? ' ' + (q === 1 ? s1 : sn) : '')); }
      if (p.length > 1) { const ult = x % 1000; const sep = (ult && (ult < 100 || ult % 100 === 0)) ? ' e ' : ' '; return p.slice(0, -1).join(' ') + sep + p[p.length - 1]; }
      return p[0];
    };
    const tot = Math.round(n(v) * 100), r = Math.floor(tot / 100), c = tot % 100; const p = [];
    if (r) p.push(inteiro(r) + (r === 1 ? ' real' : (r % 1e6 === 0 ? ' de reais' : ' reais')));
    if (c) p.push(inteiro(c) + (c === 1 ? ' centavo' : ' centavos'));
    return p.length ? p.join(' e ') : 'zero reais';
  }

  /* totais da proposta a partir dos itens internos */
  function totais(P, K) {
    K = K || {}; const sum = L => (L || []).reduce((a, x) => a + n(x.qtd) * n(x.unit), 0);
    const mo = sum(K.mo), mat = sum(K.mat), eq = sum(K.eq);
    const ajuste = v => v * (1 + n(K.bdi) / 100);
    const t = { mo: ajuste(mo), mat: ajuste(mat), eq: ajuste(eq) }; t.total = t.mo + t.mat + t.eq;
    if (P && P.modalidade === 'hh') { const h = (P.hh || []).reduce((a, x) => a + n(x.normal) * n(x.qtdEst), 0); if (h) { t.hhEst = h; } }
    if (P && n(P.valorFixo)) { t.total = n(P.valorFixo); }
    t.bruto = t.total; t.desc = P && n(P.desconto) ? Math.round(t.total * n(P.desconto)) / 100 : 0; t.total = t.bruto - t.desc;
    return t;
  }

  function build(P, tipo, opt) {
    const d = X(); opt = opt || {}; const K = opt.custos || {}; const F = opt.cfg || {};
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun, Header, Footer, PageNumber, VerticalAlign, LevelFormat, PageBreak, TableLayoutType } = d;
    const isT = tipo === 'tec';
    const mesmoCod = !!P.codPT && P.codPT === P.codPC; const cod = isT ? P.codPT : P.codPC, vinc = (isT ? P.codPC : P.codPT) === cod ? `${cod} (proposta ${isT ? 'comercial' : 'técnica'})` : (isT ? P.codPC : P.codPT);
    const titulo = isT ? 'PROPOSTA TÉCNICA' : 'PROPOSTA COMERCIAL';
    const rev = s(P.rev || '00').padStart(2, '0');
    const R = (t, o) => new TextRun(Object.assign({ text: s(t), font: 'Arial', size: 20, color: '222222' }, o || {}));
    const Pp = (runs, o) => new Paragraph(Object.assign({ children: Array.isArray(runs) ? runs : [typeof runs === 'string' ? R(runs) : runs], spacing: { after: 100, line: 264 }, alignment: AlignmentType.JUSTIFIED }, o || {}));
    const bd = { style: BorderStyle.SINGLE, size: 4, color: LINE }; const borders = { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd };
    const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }; const noB = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };
    const C = (w, content, o) => new TableCell(Object.assign({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: Array.isArray(content) ? content : [content] }, o || {}));
    const sh = f => ({ fill: f, type: ShadingType.CLEAR, color: 'auto' });
    const TB = (grid, rows, o) => new Table(Object.assign({ width: { size: W, type: WidthType.DXA }, columnWidths: grid, layout: TableLayoutType.FIXED, borders, rows }, o || {}));
    const scale = g => { const t = g.reduce((a, b) => a + b, 0); const r = g.map(x => Math.floor(x * W / t)); r[r.length - 1] += W - r.reduce((a, b) => a + b, 0); return r; };
    /* tabela com cabeçalho azul e zebra */
    const grade = (cols, head, rows, al, total) => {
      const g = scale(cols); al = al || head.map(() => 'left'); const A = x => ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT })[x];
      const cp = (t, i, o) => new Paragraph({ alignment: A(al[i]), spacing: { after: 0 }, children: [R(t, Object.assign({ size: 18 }, o || {}))] });
      const tr = [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => C(g[i], cp(h, i, { bold: true, color: 'FFFFFF' }), { shading: sh(BLUE) })) })];
      rows.forEach((r, k) => tr.push(new TableRow({ cantSplit: true, children: r.map((v, i) => C(g[i], cp(v, i), k % 2 ? { shading: sh(ZEBRA) } : {})) })));
      if (total) tr.push(new TableRow({ cantSplit: true, children: total.map((v, i) => C(g[i], cp(v, i, { bold: true }), { shading: sh(LBL) })) }));
      return [TB(g, tr), new Paragraph({ spacing: { after: 80 }, children: [] })];
    };
    const H1 = t => new Paragraph({ keepNext: true, spacing: { before: 240, after: 120 }, shading: sh(NAVY), children: [R(' ' + t.toUpperCase(), { bold: true, color: 'FFFFFF', size: 20 })] });
    const H2 = t => new Paragraph({ keepNext: true, spacing: { before: 180, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 1 } }, children: [R(t, { bold: true, color: BLUE })] });
    const LI = t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 264 }, alignment: AlignmentType.JUSTIFIED, children: [R(t)] });
    const lista = L => (L || []).map(s).filter(x => x.trim()).map(LI);
    const NOTA = t => Pp([R(t, { size: 16, color: GRAY })], { spacing: { after: 120 } });
    let numN = 0; const NUM = (pref, t) => Pp([R(pref + '  ', { bold: true }), R(t)], { indent: { left: 400, hanging: 400 }, spacing: { after: 80, line: 264 } });

    /* ---------- cabeçalho e rodapé ---------- */
    const logo = opt.logo ? new ImageRun({ type: 'png', data: opt.logo, transformation: { width: 46, height: 37 } }) : R('PREVINE', { bold: true, color: NAVY });
    const L = (w, t) => C(w, new Paragraph({ spacing: { after: 0 }, children: [R(t, { size: 13, color: GRAY })] }), { shading: sh(LBL) });
    const V = (w, t) => C(w, new Paragraph({ spacing: { after: 0 }, children: [R(t, { size: 15, bold: true, color: '111827' })] }));
    const lw = 1100, vw = Math.floor((W - 3 * lw) / 3); const gI = [lw, vw, lw, vw, lw, W - 3 * lw - 2 * vw];
    const info = TB(gI, [
      new TableRow({ children: [L(lw, 'Área do Documento'), V(vw, 'Comercial / Engenharia'), L(lw, 'Unidade'), V(vw, s(P.unidade)), L(lw, 'Código'), V(gI[5], cod)] }),
      new TableRow({ children: [L(lw, 'Elaborador'), V(vw, F.elab || ''), L(lw, 'Verificador'), V(vw, F.verif || ''), L(lw, 'Aprovador'), V(gI[5], F.aprov || '')] }),
      new TableRow({ children: [L(lw, 'Data de elaboração'), V(vw, fmtD(P.dataElab || P.data)), L(lw, 'Data de revisão'), V(vw, fmtD(P.data)), L(lw, 'Nº da Revisão'), V(gI[5], rev)] }),
      new TableRow({ children: mesmoCod ? [L(lw, 'Ref. do cliente (RC)'), C(W - lw, new Paragraph({ spacing: { after: 0 }, children: [R(P.rc || '—', { size: 15, bold: true, color: '111827' })] }), { columnSpan: 5 })] : [L(lw, 'Ref. do cliente (RC)'), C(2 * vw + lw, new Paragraph({ spacing: { after: 0 }, children: [R(P.rc || '—', { size: 15, bold: true, color: '111827' })] }), { columnSpan: 3 }), L(lw, 'Proposta vinculada'), V(gI[5], vinc)] }),
      new TableRow({ children: [L(lw, 'Páginas'), C(vw, new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Arial', size: 15, bold: true })] })), L(lw, 'Cliente'), C(vw + lw + gI[5], new Paragraph({ spacing: { after: 0 }, children: [R(P.cliente, { size: 15, bold: true })] }), { columnSpan: 3 })] })
    ]);
    const gT = [1300, 6438, 2800];
    const topo = TB(gT, [new TableRow({ children: [
      C(gT[0], new Paragraph({ children: [logo] })),
      C(gT[1], [new Paragraph({ spacing: { after: 0 }, children: [R(EMP, { bold: true, size: 17, color: '111827' })] }), new Paragraph({ spacing: { after: 0 }, children: [R(CNPJ, { size: 15, color: GRAY })] }), new Paragraph({ spacing: { after: 0 }, children: [R(titulo, { bold: true, size: 26, color: BLUE })] })]),
      C(gT[2], [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [R(cod, { bold: true, size: 20, color: NAVY })] }), new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [R(`Rev. ${rev} de ${fmtD(P.data)}`, { size: 15, color: GRAY })] }), new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [R(isT ? 'Proposta Técnica' : 'Proposta Comercial', { size: 15, color: GRAY })] })])
    ] })], { borders: { top: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb, bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY } } });
    const header = new Header({ children: [topo, new Paragraph({ spacing: { after: 60 }, children: [] }), info, new Paragraph({ spacing: { after: 120 }, children: [] })] });
    const footer = new Footer({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }, tabStops: [{ type: 'right', position: W }], children: [R(EMP + ' – ' + CNPJ, { size: 14, color: GRAY }), new TextRun({ children: ['\t' + cod + ' – Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Arial', size: 14, color: GRAY })] })] });

    /* ---------- capa ---------- */
    const ctrlRow = (a, b) => new TableRow({ children: [C(2400, new Paragraph({ spacing: { after: 0 }, children: [R(a, { size: 15, color: GRAY })] }), { shading: sh(LBL) }), C(W - 2400, new Paragraph({ spacing: { after: 0 }, children: [R(b, { size: 17, bold: true, color: '111827' })] }))] });
    const capa = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [opt.logo ? new ImageRun({ type: 'png', data: opt.logo, transformation: { width: 128, height: 103 } }) : R('PREVINE', { bold: true, size: 48, color: NAVY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [R(EMP, { bold: true, size: 22, color: '111827' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 }, children: [R(CNPJ, { size: 17, color: GRAY })] }),
      new Paragraph({ spacing: { after: 80 }, children: [R(isT ? 'PROPOSTA TÉCNICA' : 'PROPOSTA COMERCIAL', { bold: true, size: 20, color: GOLD })] }),
      new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 8 } }, children: [R(s(P.objeto).toUpperCase(), { bold: true, size: 40, color: NAVY })] }),
      new Paragraph({ spacing: { before: 120, after: 1000 }, children: [R(cod + '  ·  Revisão ' + rev, { bold: true, size: 24, color: BLUE })] }),
      new Paragraph({ spacing: { after: 0 }, children: [R(P.cliente, { bold: true, size: 18, color: '111827' })] }),
      new Paragraph({ spacing: { after: 400 }, children: [R([P.unidade, P.area].filter(Boolean).join(' · '), { size: 18, color: GRAY })] }),
      TB([2400, W - 2400], [ctrlRow('Código', cod), ctrlRow('Nº da Revisão', rev + ' – ' + fmtD(P.data)), ctrlRow('Ref. do cliente (RC)', P.rc || '—'), ...(mesmoCod ? [] : [ctrlRow('Proposta vinculada', vinc)]), ctrlRow('Elaborado por', F.elab || ''), ctrlRow('Verificado por', F.verif || ''), ctrlRow('Aprovado por', F.aprov || '')]),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [R(END, { size: 15, color: GRAY })] })
    ];

    /* ---------- carta ---------- */
    const carta = [
      Pp([R('Barra Mansa, ' + dataExt(P.data) + '.')], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }),
      Pp([R((isT ? 'Proposta Técnica' : 'Proposta Comercial') + ' nº ' + cod + (P.rc ? '  ·  Ref. do cliente (RC): ' + P.rc : ''), { bold: true })], { spacing: { after: 240 } }),
      Pp('À', { spacing: { after: 0 } }), Pp([R(P.cliente, { bold: true })], { spacing: { after: 0 } }),
      Pp('Unidade: ' + (P.unidade || '—') + '  ·  Área: ' + (P.area || '—'), { spacing: { after: 0 } }),
      ...(P.contato ? [Pp('A/C: ' + P.contato, { spacing: { after: 0 } })] : []),
      Pp([R('Assunto: proposta para ' + s(P.objeto).replace(/\.$/, '').replace(/^./, c => c.toLowerCase()) + '.', { bold: true })], { spacing: { before: 240, after: 200 } }),
      Pp('Prezados,', { spacing: { after: 120 } }),
      Pp(`Apresentamos nossa ${isT ? 'proposta técnica' : 'proposta comercial'} para ${s(P.objeto).replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}, elaborada para atender à especificação técnica e às normas internas da contratante, com qualidade e segurança na execução.`),
      Pp('Em caso de aceite, comprometemo-nos a formalizar o contrato ou pedido de compra no prazo acordado entre as partes.'),
      Pp('Agradecemos a oportunidade e permanecemos à disposição para os esclarecimentos necessários.', { spacing: { after: 360 } }),
      Pp('Atenciosamente,', { spacing: { after: 480 } }),
      Pp([R(F.assinante || 'Cláudio José de Almeida', { bold: true })], { spacing: { after: 0 } }), Pp(F.assinanteCargo || 'Sócio-Gerente', { spacing: { after: 0 } }), Pp(F.assinanteTel || 'Cel.: (24) 98855-7269', { spacing: { after: 240 } }),
      ...grade([3, 4, 4], ['Contato', 'Nome', 'Telefone / e-mail'], [['Gestor técnico', s(P.gestorTec && P.gestorTec.nome), s(P.gestorTec && P.gestorTec.contato)], ['Gestor comercial', s(P.gestorCom && P.gestorCom.nome), s(P.gestorCom && P.gestorCom.contato)]]),
      new Paragraph({ children: [new PageBreak()] })
    ];

    const T = P.tecnico || {}; const corpo = [];
    if (isT) {
      corpo.push(H1('1. Apresentação'), Pp('Esta proposta define o escopo, as condições técnicas e as responsabilidades para a execução dos serviços pela PREVINE, em conformidade com a especificação do cliente, as normas de segurança do trabalho e o sistema de gestão da empresa (ISO 9001, ISO 14001 e ISO 45001).'));
      corpo.push(H1('2. Dados da solicitação'), ...grade([3, 7], ['Campo', 'Informação'], [['Cliente', P.cliente], ['Unidade', P.unidade || '—'], ['Área', P.area || '—'], ['Solicitação / RC do cliente', P.rc || '—'], ['Gestor técnico Previne', s(P.gestorTec && P.gestorTec.nome) || '—'], ['Gestor comercial Previne', s(P.gestorCom && P.gestorCom.nome) || '—'], ['Visita técnica', T.visita || 'Não realizada']]));
      let k = 3; corpo.push(H1(`${k}. Escopo dos serviços`)); let sub = 0;
      if (T.objetivo) corpo.push(H2(`${k}.${++sub} Objetivo`), ...s(T.objetivo).split(/\n+/).filter(Boolean).map(x => Pp(x)));
      if ((T.incluidas || []).length) corpo.push(H2(`${k}.${++sub} Atividades incluídas`), ...lista(T.incluidas));
      if ((T.excluidas || []).length) corpo.push(H2(`${k}.${++sub} Atividades não incluídas (exclusões)`), ...lista(T.excluidas));
      if ((T.premissas || []).length) corpo.push(H2(`${k}.${++sub} Premissas`), ...lista(T.premissas));
      if ((T.fornPrevine || []).length || (T.fornCliente || []).length) { k++; corpo.push(H1(`${k}. Fornecimentos`)); sub = 0; if ((T.fornPrevine || []).length) corpo.push(H2(`${k}.${++sub} Fornecimento da PREVINE`), ...lista(T.fornPrevine)); if ((T.fornCliente || []).length) corpo.push(H2(`${k}.${++sub} Fornecimento da CONTRATANTE`), ...lista(T.fornCliente)); }
      const mats = (T.materiais || []).filter(x => s(x.desc).trim()); if (mats.length) { k++; corpo.push(H1(`${k}. Lista de materiais`), NOTA('Materiais previstos para a execução. Quantidades sujeitas à confirmação em campo.'), ...grade([1, 6, 1.4, 1.4], ['Item', 'Descrição do material', 'Unid.', 'Qtd.'], mats.map((x, i) => [String(i + 1), x.desc, s(x.un), qtd(x.qtd)]), ['center', 'left', 'center', 'center'])); }
      const eqs = (T.equipamentos || []).filter(x => s(x.desc).trim()); if (eqs.length) { k++; corpo.push(H1(`${k}. Lista de equipamentos e ferramentas`), ...grade([1, 6, 1.4, 1.4], ['Item', 'Equipamento / ferramenta', 'Qtd.', 'Período'], eqs.map((x, i) => [String(i + 1), x.desc, qtd(x.qtd), s(x.periodo)]), ['center', 'left', 'center', 'center'])); }
      const eqp = (T.equipe || []).filter(x => s(x.funcao).trim()); if (eqp.length) { k++; corpo.push(H1(`${k}. Equipe`), ...grade([5, 1.5, 3], ['Função', 'Qtd.', 'Turno / jornada'], eqp.map(x => [x.funcao, qtd(x.qtd), s(x.turno)]), ['left', 'center', 'left'])); }
      const cr = (T.cronograma || []).filter(x => s(x.etapa).trim()); if (T.prazo || cr.length) { k++; corpo.push(H1(`${k}. Prazo e cronograma`)); if (T.prazo) corpo.push(Pp('Prazo de execução: ' + T.prazo + '.')); if (cr.length) corpo.push(...grade([1, 6, 2.5], ['Etapa', 'Descrição', 'Duração'], cr.map((x, i) => [String(i + 1), x.etapa, s(x.dur)]), ['center', 'left', 'center'])); }
      if (T.nrs || (T.ssma || []).length) { k++; corpo.push(H1(`${k}. Segurança, saúde e meio ambiente`)); if (T.nrs) corpo.push(LI('Normas aplicáveis: ' + T.nrs + ', além das normas internas do cliente.')); corpo.push(...lista(T.ssma)); }
      if ((T.entregaveis || []).length) { k++; corpo.push(H1(`${k}. Entregáveis`), ...lista(T.entregaveis)); }
      k++; corpo.push(H1(`${k}. Condições técnicas gerais`));
      (T.condicoes && T.condicoes.length ? T.condicoes : COND_TEC).forEach((t, i) => corpo.push(NUM(`${k}.${i + 1}`, t)));
      const refs = (T.docsRef || []).filter(x => s(x.doc).trim()); if (refs.length) { k++; corpo.push(H1(`${k}. Documentos de referência`), ...grade([1, 7, 2.5], ['Nº', 'Documento', 'Revisão / data'], refs.map((x, i) => [String(i + 1), x.doc, s(x.rev)]), ['center', 'left', 'center'])); }
    } else {
      const t = totais(P, K); const hh = P.modalidade === 'hh';
      corpo.push(H1('1. Dados da proposta'), ...grade([3, 7], ['Campo', 'Informação'], [['Cliente', P.cliente], ['Unidade / área', [P.unidade, P.area].filter(Boolean).join(' / ') || '—'], ['Objeto', P.objeto], ['Proposta técnica vinculada', P.codPT], ['Modalidade de preço', hh ? 'Homem-hora (HH)' : 'Preço global'], ['Gestor comercial Previne', s(P.gestorCom && P.gestorCom.nome) || '—']]));
      let k = 2;
      if (hh) {
        const H = (P.hh || []).filter(x => s(x.funcao).trim());
        const fd = 1 - n(P.desconto) / 100;
        corpo.push(H1(`${k}. Preços por homem-hora`), ...grade([4, 2, 2, 2], ['Função', 'HH normal', 'HH extra 50%', 'HH extra 100%'], H.map(x => [x.funcao, brl(n(x.normal) * fd), x.he50 ? brl(n(x.he50) * fd) : '—', x.he100 ? brl(n(x.he100) * fd) : '—']), ['left', 'right', 'right', 'right']));
        if (n(P.desconto)) corpo.push(NOTA(`Valores já com desconto comercial de ${qtd(P.desconto)}%.`));
        if (P.hhNota) corpo.push(Pp(P.hhNota));
        if (t.total) { corpo.push(H2('Estimativa de valor'), ...grade([6, 3], ['Grupo', 'Valor (R$)'], [['Mão de obra (estimativa de horas)', brl(t.hhEst || t.mo)], ...(t.mat ? [['Materiais', brl(t.mat)]] : []), ...(t.eq ? [['Equipamentos', brl(t.eq)]] : [])], ['left', 'right'], ['VALOR ESTIMADO', brl((t.hhEst || t.mo) + t.mat + t.eq)])); }
      } else {
        corpo.push(H1(`${k}. Resumo de preços`), ...grade([6, 3], ['Grupo', 'Valor (R$)'], [['Mão de obra', brl(t.mo)], ['Materiais', brl(t.mat)], ['Equipamentos', brl(t.eq)]].filter(r => r[1] !== brl(0) || r[0] === 'Mão de obra').concat(t.desc ? [['Subtotal', brl(t.bruto)], [`Desconto comercial (${qtd(P.desconto)}%)`, '− ' + brl(t.desc)]] : []), ['left', 'right'], ['VALOR TOTAL', brl(t.total)]));
        corpo.push(Pp('Valor total por extenso: ' + extenso(t.total) + '.', { spacing: { after: 160 } }));
        if (P.abrirCustos) {
          const lin = [];
          const pct = 1 + n(K.bdi) / 100;
          (K.mo || []).forEach(x => lin.push(['Mão de obra – ' + s(x.desc || x.funcao), s(x.un || 'h'), qtd(x.qtd), brl(n(x.unit) * pct), brl(n(x.qtd) * n(x.unit) * pct)]));
          (K.mat || []).forEach(x => lin.push(['Material – ' + s(x.desc), s(x.un), qtd(x.qtd), brl(n(x.unit) * pct), brl(n(x.qtd) * n(x.unit) * pct)]));
          (K.eq || []).forEach(x => lin.push(['Equipamento – ' + s(x.desc), s(x.un), qtd(x.qtd), brl(n(x.unit) * pct), brl(n(x.qtd) * n(x.unit) * pct)]));
          if (t.desc) lin.push([`Desconto comercial (${qtd(P.desconto)}%)`, '', '', '', '− ' + brl(t.desc)]);
          corpo.push(H2(`${k}.1 Abertura de custos`), ...grade([5, 1.2, 1.2, 1.8, 1.8], ['Item', 'Unid.', 'Qtd.', 'Unitário (R$)', 'Total (R$)'], lin, ['left', 'center', 'center', 'right', 'right'], ['TOTAL', '', '', '', brl(t.total)]));
        }
      }
      k++; corpo.push(H1(`${k}. Condições comerciais`));
      const cc = [
        `Validade da proposta: ${P.validade || 30} dias a partir da data de emissão.`,
        `Condição de pagamento: ${P.pagamento || '45 dias após a aprovação da medição e a emissão da nota fiscal'}.`,
        `Faturamento: ${P.faturamento || 'por medição mensal'}, com nota fiscal de serviço (item ${P.lc116 || '14.01'} da LC 116/2003)${(totais(P, K).mat > 0) ? ' e nota fiscal de materiais' : ''}.`,
        'Impostos: todos os tributos incidentes estão inclusos nos preços acima.',
        `Prazo de execução: ${(P.tecnico || {}).prazo || 'conforme a proposta técnica vinculada'}.`,
        ...(P.reajuste ? [`Reajuste: ${P.reajuste}.`] : []),
        'Serviços adicionais ou alterações de escopo são orçados à parte e só executados após aprovação formal do cliente.',
        ...((P.condExtra || []).filter(Boolean))
      ];
      cc.forEach((x, i) => corpo.push(NUM(`${k}.${i + 1}`, x)));
      k++; corpo.push(H1(`${k}. Aceite`), Pp('Declaramos de acordo com as condições desta proposta.', { spacing: { after: 480 }, keepNext: true }), Pp('_______________________________________________', { alignment: AlignmentType.CENTER, spacing: { after: 0 }, keepNext: true }), Pp(s(P.cliente) + ' – nome, cargo e data', { alignment: AlignmentType.CENTER }));
    }
    /* histórico de revisões */
    const meu = M => (M || []).filter(m => m.tipo === tipo);
    const revs = (P.revisoes || []).map(r => ({ rev: r.rev, data: r.data, txt: r.txt, mud: meu(r.mudancas) })).concat([{ rev, data: P.data, txt: P.revMotivo || (rev === '00' ? 'Emissão inicial.' : 'Revisão da proposta.'), mud: meu(P.revMud) }]).filter((x, i, a) => a.findIndex(y => y.rev === x.rev) === i);
    const linhasRev = []; revs.forEach(r => { if (!r.mud.length) linhasRev.push([s(r.rev), fmtD(r.data), r.rev === '00' ? 'Emissão inicial' : '—', r.rev === '00' ? s(r.txt) : s(r.txt) + (isT ? ' (sem alteração técnica)' : ' (sem alteração comercial)')]); else r.mud.forEach((m, i) => linhasRev.push([i ? '' : s(r.rev), i ? '' : fmtD(r.data), s(m.cat), s(m.txt)])); });
    corpo.push(new Paragraph({ children: [new PageBreak()] }), H1('Controle de revisões'), ...grade([1, 1.5, 2.6, 6], ['Revisão', 'Data', 'Item alterado', 'Descrição da alteração'], linhasRev, ['center', 'center', 'left', 'left']));

    return new Document({
      creator: 'Portal Previne', title: `${cod} - ${titulo}`,
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 280 } } } }] }] },
      sections: [{
        properties: { titlePage: true, page: { size: { width: 12240, height: 15840 }, margin: { top: 1701, right: 851, bottom: 567, left: 851, header: 400, footer: 400 } } },
        headers: { default: header, first: new Header({ children: [new Paragraph({ children: [] })] }) },
        footers: { default: footer, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
        children: [...capa, new Paragraph({ children: [new PageBreak()] }), ...carta, ...corpo]
      }]
    });
  }
  const COND_TEC = [
    'A PREVINE executa todos os serviços especificados no escopo desta proposta, com pessoal e ferramental em perfeitas condições de trabalho.',
    'Durante a execução, a PREVINE disponibiliza a quantidade de profissionais necessária para cumprir o prazo, sem que isso limite suas responsabilidades.',
    'Documentos aplicáveis: além da especificação, a PREVINE segue as normas internas do cliente. Divergências identificadas são comunicadas por escrito, em tempo hábil, para tratativa entre as partes.',
    'Entrega: ao fim dos serviços a PREVINE faz a limpeza da área e retira as sobras de materiais geradas, depositando-as no local indicado pela fiscalização do cliente.',
    'Serviços fora do escopo: atividades não contempladas nesta proposta são negociadas previamente entre a PREVINE e a contratante.',
    'Disciplina: os profissionais da PREVINE cumprem as regras de segurança do local, trabalham uniformizados e com todos os EPIs necessários.',
    'Sigilo: informações, documentos e dados trocados em razão desta proposta são mantidos em sigilo e só são repassados a terceiros com autorização da contratante.'];
  async function gerar(P, tipo, opt) { const d = X(); const doc = build(P, tipo, opt); return root.document ? d.Packer.toBlob(doc) : d.Packer.toBuffer(doc); }
  const API = { gerar, totais, extenso, brl, COND_TEC };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PropDoc = API;
})(typeof window !== 'undefined' ? window : globalThis);
