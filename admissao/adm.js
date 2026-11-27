/* Módulo Admissão (RH): abre o processo, manda o link ao candidato, confere documentos, acompanha ASO, integração,
   treinamentos, OS/ficha de EPI, documentos admissionais e envio à contabilidade, com prazo de mobilização e indicadores. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const hoje = () => ymd(new Date());
const addDays = (n, b) => { const d = b ? new Date(b + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (b, m) => { const d = new Date(b + 'T12:00:00'); d.setMonth(d.getMonth() + m); return ymd(d); };
const fmtD = s => { s = str(s).slice(0, 10); const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const diasEntre = (a, b) => Math.round((new Date(str(b).slice(0, 10) + 'T12:00:00') - new Date(str(a).slice(0, 10) + 'T12:00:00')) / 864e5);
const numBR = t => { t = str(t).replace(/[^\d,.]/g, ''); if (!t) return null; t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : (/\.\d{3}$/.test(t) ? t.replace(/\./g, '') : t); const v = parseFloat(t); return isFinite(v) ? v : null; };
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3400); };
const kpi = (t, n, k, s) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
const PRAZO = 8;

const D = { adm: [], func: [], areas: [], kits: [], cursos: [], cfg: {}, emp: {} };
const V = { tab: 'and', q: '', per: '180' };
let db = null, PODE = false, MEU = ''; const VS = () => ((window.__FB || {}).perfil || {}).verSalarios === true;

/* ---------- regras ---------- */
const etp = a => a.etapas || {};
const fimMob = a => str((etp(a).integ || {}).realizada);
const diasMob = a => diasEntre(a.abertoEm, fimMob(a) || hoje());
const atrasado = a => diasMob(a) > PRAZO;
const precisaJust = a => atrasado(a) && !str(a.justificativa).trim();
function etapas(a) {
  const e = etp(a), ds = ADM.docsSt(a), aso = e.aso || {}, ig = e.integ || {}, tr = e.trein || {};
  return [
    { k: 'carta', t: 'Carta e LGPD', st: assinado(a, 'lgpd') && assinado(a, 'carta') ? 'ok' : assinado(a, 'lgpd') ? 'at' : '', s: assinado(a, 'carta') ? 'assinadas' : assinado(a, 'lgpd') ? 'falta carta' : 'aguardando' },
    { k: 'docs', t: 'Documentos', st: ds.rej.length ? 'bad' : ds.ok === ds.obr ? 'ok' : ds.env ? 'at' : '', s: ds.rej.length ? 'reenviar' : ds.ok === ds.obr ? 'conferidos' : `${ds.env}/${ds.obr}` },
    { k: 'aso', t: 'ASO', st: aso.data && aso.apto !== false ? 'ok' : aso.data ? 'bad' : aso.agendado ? 'at' : '', s: aso.data ? (aso.apto === false ? 'inapto' : fmtD(aso.data).slice(0, 5)) : aso.agendado ? 'marcado ' + fmtD(aso.agendado).slice(0, 5) : '' },
    { k: 'integ', t: 'Integração', st: ig.realizada ? 'ok' : ig.agendada ? 'at' : '', s: ig.realizada ? fmtD(ig.realizada).slice(0, 5) : ig.agendada ? 'marcada ' + fmtD(ig.agendada).slice(0, 5) : '' },
    { k: 'trein', t: 'Treinamentos', st: tr.concluido ? 'ok' : tr.enviado ? 'at' : '', s: tr.concluido ? 'feitos' : tr.enviado ? 'enviados' : '' },
    { k: 'epi', t: 'OS, ficha e termo EPI', st: (e.epi || {}).data || assinado(a, 'osepi') ? 'ok' : (a.assinar || {}).osepi ? 'at' : '', s: (e.epi || {}).data || assinado(a, 'osepi') ? 'assinados' : (a.assinar || {}).osepi ? 'aguardando assinatura' : '' },
    { k: 'admiss', t: 'Docs admissionais', st: (e.admiss || {}).data ? 'ok' : '', s: (e.admiss || {}).data ? 'assinados' : '' },
    { k: 'contab', t: 'Contabilidade', st: (e.contab || {}).data ? 'ok' : '', s: (e.contab || {}).data ? 'enviado' : '' }
  ];
}
const pills = a => `<div class="ets">${etapas(a).map(x => `<span class="et ${x.st}">${x.st === 'ok' ? '✓ ' : ''}${esc(x.t)}${x.s && x.st !== 'ok' ? ' · ' + esc(x.s) : ''}</span>`).join('')}</div>`;
const areaBy = id => D.areas.find(a => a.id === id);
const funcoes = () => [...new Set(D.func.map(f => str(f.funcao).trim()).concat(D.kits.map(k => str(k.funcao).trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
const linkDe = a => new URL('enviar.html?c=' + a.id, location.href).href;
const waDe = a => { const t = ADM.dig(a.telefone); const msg = `Olá, ${str(a.nome).split(' ')[0]}! Aqui é do RH da PREVINE. Para a sua admissão${a.funcao ? ' como ' + a.funcao : ''}, envie seus dados e documentos por este link (leva uns 15 minutos)${(a.trein || {}).cursos && a.trein.cursos.length ? '. No mesmo link estão os treinamentos que você já pode fazer' : ''}: ${linkDe(a)}`;
  return 'https://wa.me/' + (t ? (t.length <= 11 ? '55' + t : t) : '') + '?text=' + encodeURIComponent(msg); };

/* ---------- assinaturas no app ---------- */
/* assinado quando a assinatura do candidato bate com a impressão (SHA-256) do documento que o RH gerou */
const ehTexto = id => id === 'lgpd' || id === 'carta';
const tituloDoc = (a, id) => id === 'osepi' ? 'Ordem de Serviço de Segurança, Ficha de EPI e Termo de EPI' : str(((a.assinar || {})[id] || {}).titulo) || 'Documento';
function assinado(a, id) { const s = ((a.cand || {}).assin || {})[id]; const d = !ehTexto(id) ? (a.assinar || {})[id] : ((a.textos || {})[id]); return !!(s && d && s.hash === d.hash); }
const empNome = () => str(D.emp.nome) || 'PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA';
const empCnpj = () => str(D.emp.cnpj) || '03.052.261/0001-43';
/* gera (ou refaz) o texto da carta-convite e do termo LGPD com os dados da admissão; o candidato lê e assina */
async function gerarTextos(a, salario, quais) {
  quais = quais || ['lgpd', 'carta'];
  const ex = { empresa: empNome(), cnpj: empCnpj(), salario: ADM.moeda(salario), beneficios: a.vinculo === 'PJ' ? ADM.BENEF_PJ : (str(D.cfg.beneficiosTxt).trim() || ADM.BENEF_PADRAO) }; const tx = Object.assign({}, a.textos || {}); const agora = new Date().toISOString();
  for (const q of quais) { const texto = ADM.preencher(q === 'carta' ? (D.cfg.cartaTxt || ADM.CARTA_PADRAO) : (D.cfg.lgpdTxt || ADM.LGPD_PADRAO), a, ex);
    await db.doc(`admissoes/${a.id}/d/${q}`).set({ texto, em: agora }); tx[q] = { hash: await ADM.sha256(texto), em: agora }; }
  await db.doc('admissoes/' + a.id).update({ textos: tx }); a.textos = tx;
}
/* OS de segurança + termo de EPI: gerados pelo módulo Ferramentas & EPI (mesmos kits e textos), aberto escondido */
function gerarOsEpi(a) {
  return new Promise((res, rej) => {
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:900px;height:700px;left:-10000px;top:0;border:0;opacity:0';
    const fim = (f, v) => { window.removeEventListener('message', on); clearTimeout(t); fr.remove(); f(v); };
    const on = ev => { const m = ev.data; if (ev.origin !== location.origin || !m || m.tipo !== 'previne-adm-docs' || m.tk !== a.id) return; m.erro ? fim(rej, new Error(m.erro)) : fim(res, m); };
    const t = setTimeout(() => fim(rej, new Error('Demorou demais para gerar. Tente de novo.')), 70000);
    window.addEventListener('message', on); fr.src = new URL('../ferramentas/#gerar-adm=' + a.id, location.href).href; document.body.appendChild(fr);
  });
}
function gerarCertPdf(ids) {
  return new Promise((res, rej) => {
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:900px;height:700px;left:-10000px;top:0;border:0;opacity:0';
    const fim = (f, v) => { window.removeEventListener('message', on); clearTimeout(t); fr.remove(); f(v); };
    const on = ev => { const m = ev.data; if (ev.origin !== location.origin || !m || m.tipo !== 'previne-cert' || m.ids !== ids.join(',')) return; m.erro ? fim(rej, new Error(m.erro)) : fim(res, m); };
    const t = setTimeout(() => fim(rej, new Error('Demorou demais para gerar. Tente de novo.')), 70000);
    window.addEventListener('message', on); fr.src = new URL('../ferramentas/#gerar-cert=' + ids.join(','), location.href).href; document.body.appendChild(fr);
  });
}
async function baixarCerts(a, ids, btn) {
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
  /* no celular, a janela precisa abrir no toque; o PDF entra nela quando ficar pronto */
  const cel = /Android|iPhone|iPad/i.test(navigator.userAgent); const w = cel ? window.open('', '_blank') : null;
  if (w) try { w.document.write('<p style="font:16px sans-serif;padding:20px">Gerando o certificado…</p>'); } catch (_) {}
  try { const m = await gerarCertPdf(ids); const bin = atob(m.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const blob = new Blob([u], { type: 'application/pdf' });
    if (w && !w.closed) { w.location.href = URL.createObjectURL(blob); } else await baixar(`Certificado${ids.length > 1 ? 's' : ''} - ${a.nome}.pdf`, blob); }
  catch (e) { if (w && !w.closed) w.close(); toast(e.message || 'Não foi possível gerar.', 'bad'); }
  btn.disabled = false; btn.textContent = t0;
}
async function prepararOsEpi(a) {
  const m = await gerarOsEpi(a);
  const arq = await ADM.gravar({ b64: m.b64, tipo: 'application/pdf', nome: 'OS, ficha e termo de EPI.pdf', q: { ok: true, prob: [] }, thumb: '' }, 'osepi', (id, d) => db.doc(`admissoes/${a.id}/d/${id}`).set({ d }));
  arq.hash = await ADM.sha256(m.b64); arq.por = MEU; arq.modelo = m.modelo; arq.epis = m.epis; arq.sigs = m.sigs || [];
  const as = Object.assign({}, a.assinar || {}, { osepi: arq }); await db.doc('admissoes/' + a.id).update({ assinar: as }); a.assinar = as; return m;
}
const loadLib = (src, ok) => new Promise((res, rej) => { if (ok()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => ok() ? res() : rej(new Error('lib')); s.onerror = () => rej(new Error('Sem internet para carregar o gerador de PDF.')); document.head.appendChild(s); });
const loadPDF = () => loadLib('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf && window.jspdf.jsPDF);
const loadPdfLib = () => loadLib('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', () => window.PDFLib);
const fmtDH = iso => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); };
const evid = (a, s) => [`Assinado eletronicamente por ${a.nome}, CPF ${ADM.fmtCpf(a.cpf)}, em ${fmtDH(s.em)} (horário de Brasília), pelo link individual enviado pelo RH, após confirmar o CPF.`,
  `Código do processo: ${a.id}. Impressão digital do documento (SHA-256): ${s.hash}.`, `Aparelho: ${str(s.ua).slice(0, 160)}.`, 'Assinatura eletrônica nos termos da MP 2.200-2/2001, art. 10, § 2º, aceita pelas partes.'];
let CAPT = null; /* quando preenchido, os PDFs gerados vão para o envio à contabilidade em vez de baixar */
async function baixar(nome, blob) { if (CAPT) { CAPT.push({ nome, blob }); return; } const dl = await claude.use('downloads'); if (!dl) return toast('Download indisponível.', 'bad'); try { await dl.save({ filename: nome, data: blob }); toast('PDF pronto.', 'ok'); } catch (e) { if (!(e && e.code === 'declined')) toast('Não foi possível salvar.', 'bad'); } }
async function pdfTexto(a, q) {
  try { await loadPDF(); } catch (e) { return toast(e.message, 'bad'); }
  const d = await db.doc(`admissoes/${a.id}/d/${q}`).get(); if (!d.exists) return toast('Documento não encontrado.', 'bad');
  const texto = d.data().texto; const s = ((a.cand || {}).assin || {})[q]; const ok = assinado(a, q);
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const L = 18, W = 174; let y = 16;
  const lg = window.logoEmp ? window.logoEmp(D.emp) : D.emp; if (/^data:image/.test(str(lg.logo))) { try { const h = 14, w = Math.min(40, h * (+lg.logoW || 3) / (+lg.logoH || 1)); doc.addImage(lg.logo, /jpeg/.test(lg.logo.slice(0, 20)) ? 'JPEG' : 'PNG', L, y - 4, w, w * (+lg.logoH || 1) / (+lg.logoW || 3)); } catch (e) {} }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61); doc.text(q === 'carta' ? 'CARTA-CONVITE' : 'TERMO LGPD', L + W, y + 2, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(empNome(), L + W, y + 7, { align: 'right' }); doc.text('CNPJ ' + empCnpj(), L + W, y + 11, { align: 'right' });
  y += 16; doc.setDrawColor(242, 169, 0); doc.setLineWidth(0.8); doc.line(L, y, L + W, y); y += 8; doc.setTextColor(30, 33, 40); doc.setFontSize(10.5);
  doc.splitTextToSize(texto, W).forEach(l => { if (y > 270) { doc.addPage(); y = 18; } doc.text(l, L, y); y += 5.2; });
  y += 6; if (y > 230) { doc.addPage(); y = 20; }
  if (ok && /^data:image\/png/.test(str(s.img))) { try { doc.addImage(s.img, 'PNG', L, y, 60, 20); } catch (e) {} }
  y += 22; doc.setDrawColor(80); doc.setLineWidth(0.3); doc.line(L, y, L + 80, y); doc.setFontSize(9); doc.text(`${a.nome} · CPF ${ADM.fmtCpf(a.cpf)}`, L, y + 5);
  y += 12; doc.setFontSize(7.8); doc.setTextColor(90, 96, 110);
  (ok ? evid(a, s) : ['Documento ainda não assinado pelo candidato.']).forEach(t => doc.splitTextToSize(t, W).forEach(l => { doc.text(l, L, y); y += 3.8; }));
  baixar(`${q === 'carta' ? 'Carta-convite' : 'Termo LGPD'} - ${a.nome}${ok ? ' (assinado)' : ''}.pdf`, doc.output('blob'));
}
async function pdfDoc(a, id) {
  const arq = (a.assinar || {})[id]; if (!arq) return; const s = ((a.cand || {}).assin || {})[id]; const ok = assinado(a, id); const tit = tituloDoc(a, id);
  try {
    const blob = await ADM.ler(arq, id, pid => db.doc(`admissoes/${a.id}/d/${pid}`).get().then(x => x.exists ? x.data().d : null));
    if (!ok) return baixar(`${tit} - ${a.nome}.pdf`, blob);
    await loadPdfLib(); const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.load(await blob.arrayBuffer()); const f = await pdf.embedFont(StandardFonts.Helvetica), fb = await pdf.embedFont(StandardFonts.HelveticaBold);
    const lin = `Assinado eletronicamente por ${a.nome} em ${fmtDH(s.em)} · SHA-256 ${s.hash.slice(0, 16)}…`;
    pdf.getPages().forEach(pg => pg.drawText(lin, { x: 42, y: 31, size: 6.5, font: f, color: rgb(0.1, 0.35, 0.2) }));
    /* assinatura do funcionário também em cada campo de assinatura do documento (OS e termo de EPI) */
    const png = await pdf.embedPng(s.img); const MM = 72 / 25.4, pgs = pdf.getPages();
    (arq.sigs || []).forEach(sp => { const pgi = pgs[sp.p - 1]; if (!pgi) return; const H = pgi.getHeight(); const d = png.scaleToFit(sp.w * MM * 0.8, 34); pgi.drawImage(png, { x: sp.x * MM + (sp.w * MM - d.width) / 2, y: H - sp.y * MM + 1, width: d.width, height: d.height }); });
    const pg = pdf.addPage([595.28, 841.89]); let y = 790;
    pg.drawText('REGISTRO DE ASSINATURA ELETRÔNICA', { x: 50, y, size: 14, font: fb, color: rgb(0.08, 0.13, 0.24) }); y -= 18;
    pg.drawText((empNome() + ' · CNPJ ' + empCnpj()).slice(0, 110), { x: 50, y, size: 9, font: f, color: rgb(0.25, 0.27, 0.32) }); y -= 16;
    pg.drawText(('Documento: ' + tit).slice(0, 110), { x: 50, y, size: 9.5, font: f }); y -= 30;
    const dim = png.scaleToFit(220, 80); pg.drawImage(png, { x: 50, y: y - dim.height, width: dim.width, height: dim.height }); y -= dim.height + 8;
    pg.drawLine({ start: { x: 50, y }, end: { x: 300, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) }); y -= 13; pg.drawText(`${a.nome} · CPF ${ADM.fmtCpf(a.cpf)}`, { x: 50, y, size: 9.5, font: fb }); y -= 26;
    const quebra = (t, n) => { const w = t.split(' '); const L = []; let l = ''; w.forEach(x => { if ((l + ' ' + x).length > n) { L.push(l); l = x; } else l = l ? l + ' ' + x : x; }); if (l) L.push(l); return L; };
    evid(a, s).forEach(t => quebra(t, 105).forEach(l => { pg.drawText(l, { x: 50, y, size: 8.5, font: f, color: rgb(0.25, 0.27, 0.32) }); y -= 12; }));
    baixar(`${tit} - ${a.nome} (assinado).pdf`, new Blob([await pdf.save()], { type: 'application/pdf' }));
  } catch (e) { toast(e.message || 'Não foi possível gerar o PDF.', 'bad'); }
}
function assinBox(a, ro) {
  const row = (t, ok, pend, btns) => `<div class="bt" style="padding:7px 0;border-bottom:1px solid var(--line);gap:8px;align-items:center"><span style="flex:1">${t}</span>${ok ? `<span class="badge b-ok">Assinado ${fmtDH(ok).slice(0, 10)}</span>` : pend}${btns}</div>`;
  const sig = q => assinado(a, q) ? a.cand.assin[q].em : '';
  const os = (a.assinar || {}).osepi;
  return `<div class="etf"><h4>Assinaturas do candidato (no app)</h4>
    ${row('Termo LGPD', sig('lgpd'), (a.textos || {}).lgpd ? '<span class="badge b-warn">Aguardando</span>' : '<span class="badge b-mut">Não gerado</span>', `<button class="btn sm ghost" data-pdft="lgpd">PDF</button>`)}
    ${row('Carta-convite', sig('carta'), (a.textos || {}).carta ? '<span class="badge b-warn">Aguardando</span>' : '<span class="badge b-mut">Não gerada</span>', `<button class="btn sm ghost" data-pdft="carta">PDF</button>`)}
    ${row('OS de segurança, ficha e termo de EPI', sig('osepi'), os ? '<span class="badge b-warn">Aguardando</span>' : '<span class="badge b-mut">Não gerado</span>', os ? '<button class="btn sm ghost" id="as-osv">PDF</button>' : '')}
    ${Object.keys(a.assinar || {}).filter(k => k !== 'osepi').map(k => row(esc(tituloDoc(a, k)), sig(k), '<span class="badge b-warn">Aguardando</span>', `<button class="btn sm ghost" data-pdfd="${esc(k)}">PDF</button>${ro || assinado(a, k) ? '' : `<button class="btn sm danger" data-rmd="${esc(k)}" title="Retirar">×</button>`}`)).join('')}
    ${os && os.modelo ? '<p class="note" style="margin:4px 0 0;color:var(--warn)">A OS usou o texto-modelo da função. Revise em Ferramentas & EPI → Cadastros → Kits e gere de novo.</p>' : ''}
    ${os && !os.epis ? '<p class="note" style="margin:4px 0 0;color:var(--bad)">Nenhum kit de EPI cadastrado para esta função.</p>' : ''}
    ${ro ? '' : `<div class="actions" style="margin-top:8px">${!(a.textos || {}).carta ? '<button class="btn sm primary" id="as-tx">Gerar carta e termo LGPD</button>' : assinado(a, 'carta') ? '' : '<button class="btn sm ghost" id="as-tx">Atualizar carta (salário/textos)</button>'}
      <button class="btn sm ${os ? 'ghost' : 'primary'}" id="as-os">${os ? 'Gerar OS, ficha e termo de novo' : 'Gerar OS, ficha e termo de EPI para assinar'}</button></div>
      <div class="omrow" style="display:flex;gap:6px;margin-top:8px"><input id="as-tit" placeholder="Nome do documento (ex.: Contrato de trabalho)" style="flex:1"><button class="btn sm primary" id="as-anx">Anexar PDF para assinar</button></div>
      <p class="note" style="margin:4px 0 0">O candidato assina o termo LGPD e a carta antes de enviar os documentos. A OS, a ficha e o termo de EPI e os PDFs que você anexar (contrato de trabalho, acordos, termos) aparecem para ele assinar no link.</p>`}</div>`;
}
function rMod() {
  if (!PODE) { $('#body').innerHTML = '<div class="ro-banner">Seu perfil só consulta.</div>'; return; }
  $('#body').innerHTML = `<div class="card"><p class="ct">Carta-convite</p><p class="cs">Campos trocados automaticamente: {nome} {cpf} {funcao} {area} {unidade} {salario} {vinculo} {beneficios} {empresa} {cnpj}</p><textarea id="md-c" rows="16">${esc(D.cfg.cartaTxt || ADM.CARTA_PADRAO)}</textarea></div>
    <div class="card"><p class="ct">Benefícios (CLT)</p><p class="cs">Entra no lugar de {beneficios} na carta. Para PJ, a carta mostra "conforme o contrato de prestação de serviços".</p><textarea id="md-b" rows="4">${esc(D.cfg.beneficiosTxt || ADM.BENEF_PADRAO)}</textarea></div>
    <div class="card"><p class="ct">Termo LGPD</p><p class="cs">Revise com o jurídico ou a contabilidade antes de usar.</p><textarea id="md-l" rows="16">${esc(D.cfg.lgpdTxt || ADM.LGPD_PADRAO)}</textarea></div>
    <div class="card"><p class="ct">E-mail à contabilidade</p><p class="cs">Vem preenchido no botão “Enviar à contabilidade”; dá para mudar em cada envio. Campos trocados automaticamente: {nome} {cpf} {funcao} {area} {unidade} {vinculo} {adicional} {dataAdmissao} {empresa} {cnpj}</p>
      <div class="grid2"><div><label for="md-ep">Para (e-mails separados por vírgula)</label><input id="md-ep" value="${esc(D.cfg.contabEmail || '')}" placeholder="contabilidade@…"></div><div><label for="md-ec">Cópia (separe por vírgula)</label><input id="md-ec" value="${esc(D.cfg.contabCc || '')}"></div></div>
      <div class="grid2"><div><label for="md-ap">De acordo da contratação: e-mails de quem aprova</label><input id="md-ap" value="${esc(D.cfg.aprovEmails || '')}" placeholder="email1@…, email2@…"></div><div><label for="md-an">Nomes (aparecem no aviso)</label><input id="md-an" value="${esc(D.cfg.aprovNomes || '')}" placeholder="Gustavo ou Josilaine"></div></div>
      <label for="md-ea">Assunto</label><input id="md-ea" value="${esc(D.cfg.contabAssunto || ASSUNTO_PADRAO)}">
      <label for="md-em">Mensagem</label><textarea id="md-em" rows="12">${esc(D.cfg.contabMsg || MSG_PADRAO)}</textarea></div>
    <div class="actions"><button class="btn ghost" id="md-r">Voltar aos textos padrão</button><button class="btn primary" id="md-s">Salvar modelos</button></div><p class="note">Vale para as próximas admissões. As já abertas mantêm o texto que o candidato recebeu, até você clicar em “Atualizar carta”.</p>`;
  $('#md-s').onclick = async () => { try { const c = Object.assign({}, D.cfg, { cartaTxt: $('#md-c').value, lgpdTxt: $('#md-l').value, beneficiosTxt: $('#md-b').value, contabEmail: $('#md-ep').value.trim(), contabCc: $('#md-ec').value.trim(), contabAssunto: $('#md-ea').value.trim(), contabMsg: $('#md-em').value, aprovEmails: $('#md-ap').value.trim(), aprovNomes: $('#md-an').value.trim() }); await db.doc('config/admissao').set(c); D.cfg = c; toast('Modelos salvos.', 'ok'); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  $('#md-r').onclick = () => { $('#md-c').value = ADM.CARTA_PADRAO; $('#md-l').value = ADM.LGPD_PADRAO; $('#md-b').value = ADM.BENEF_PADRAO; $('#md-ea').value = ASSUNTO_PADRAO; $('#md-em').value = MSG_PADRAO; toast('Textos padrão carregados. Clique em Salvar para valer.'); };
}

/* ---------- dados ---------- */
function ouvir() {
  db.collection('admissoes').onSnapshot(s => { D.adm = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render();
    const qs = new URLSearchParams(location.search), dl = qs.get('a'), dap = qs.get('aprov');
    if (dap && !window.__deep && D.adm.some(x => (x.envios || []).some(e => e.id === dap))) { window.__deep = 1; setTimeout(() => telaAprov(dap), 300); }
    else if (dl && !window.__deep && D.adm.some(x => x.id === dl)) { window.__deep = 1; setTimeout(() => detalhe(dl), 300); } if (ABERTO && !$('#modal').hidden) detalhe(ABERTO, true); }, () => toast('Sem permissão para ver as admissões.', 'bad'));
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); }, () => {});
  db.collection('areas').onSnapshot(s => { D.areas = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')); render(); }, () => {});
  db.collection('kits').onSnapshot(s => { D.kits = s.docs.map(d => d.data()); }, () => {});
  db.collection('cursos').onSnapshot(s => { D.cursos = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).filter(c => c.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')); render(); }, () => {});
  db.doc('config/admissao').onSnapshot(s => { D.cfg = s.exists ? s.data() : {}; }, () => {});
}

/* ---------- telas ---------- */
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const ae = document.activeElement; if (ae && ae.closest && ae.closest('#body') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  if (V.criando && V.tab === 'nova') return; /* abrindo admissão: não apaga o formulário nem a mensagem de progresso */
  ({ and: rAnd, nova: rNova, conc: rConc, kpi: rKpi, mod: rMod })[V.tab]();
}
function cardAdm(a) {
  const d = diasMob(a), ds = ADM.docsSt(a); const foto = ((a.cand || {}).docs || {}).foto; const th = foto && foto[0] && foto[0].thumb;
  return `<div class="card adm" data-open="${esc(a.id)}"><div style="display:flex;gap:12px;align-items:flex-start">${th ? `<img class="foto" src="${th}" alt="">` : ''}
    <div style="flex:1;min-width:0"><b>${esc(a.nome)}</b><div class="t2">${a.vinculo === 'PJ' ? '<span class="badge b-warn">PJ</span> ' : ''}${esc(a.funcao || '')}${a.area ? ' · ' + esc(a.area) : ''}${a.subarea ? ' → ' + esc(a.subarea) : ''}</div>
    <div class="t2">Aberto em ${fmtD(a.abertoEm)}${(a.cand || {}).em ? ' · candidato mexeu em ' + fmtD(a.cand.em) : ' · candidato ainda não abriu o link'}${ds.pendRev.length && a.status === 'aberto' ? ` · <b style="color:var(--info)">${ds.pendRev.length} doc(s) para conferir</b>` : ''}</div></div>
    <div style="text-align:right"><div class="dias ${d > PRAZO ? 'bad' : ''}">${d}d</div><div class="t2">${fimMob(a) ? 'mobilizado' : 'mobilização'}</div>${precisaJust(a) && a.status === 'aberto' ? '<span class="badge b-bad">Justificar</span>' : ''}${(a.envios || []).some(x => x.status === 'aprovacao') ? '<span class="badge b-bad">Aguardando de acordo</span>' : ''}</div></div>${pills(a)}</div>`;
}
function rAnd() {
  let L = D.adm.filter(a => a.status === 'aberto'); if (V.q) { const q = norm(V.q); L = L.filter(a => norm(a.nome + ' ' + a.funcao + ' ' + a.area + ' ' + a.cpf).includes(q)); }
  L.sort((a, b) => diasMob(b) - diasMob(a));
  const conf = L.filter(a => ADM.docsSt(a).pendRev.length).length, atr = L.filter(atrasado).length, semInt = L.filter(a => !fimMob(a)).length;
  const pAp = podeAprovar() ? D.adm.filter(a => (a.envios || []).some(x => x.status === 'aprovacao')) : [];
  const ban = pAp.length ? `<div class="card" style="border:2px solid #d92d20;background:#fef3f2;margin-bottom:12px"><b style="color:#b42318">${pAp.length === 1 ? 'Contratação aguardando o seu de acordo' : pAp.length + ' contratações aguardando o seu de acordo'}</b>
    ${pAp.map(a => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="flex:1">${esc(a.nome)} · ${esc(a.funcao || '')}${a.area ? ' · ' + esc(a.area) : ''}</span><button class="btn sm primary" data-taprov="${esc(((a.envios || []).find(x => x.status === 'aprovacao') || {}).id)}" type="button">Ver ficha e dar o de acordo</button></div>`).join('')}</div>` : '';
  $('#body').innerHTML = ban + `<div class="kpis k5" style="margin-bottom:12px">${kpi('Em andamento', L.length)}${kpi('Acima de ' + PRAZO + ' dias', atr, atr ? 'bad' : 'ok')}${kpi('Docs para conferir', conf, conf ? 'info' : '')}${kpi('Sem integração', semInt, semInt ? 'warn' : '')}${kpi('Prazo', PRAZO + ' dias')}</div>
    <input id="a-q" placeholder="Buscar nome, CPF, função ou área" value="${esc(V.q)}" style="margin-bottom:12px">
    ${L.length ? L.map(cardAdm).join('') : '<div class="empty">Nenhuma admissão em andamento. Abra uma em “Nova admissão”.</div>'}`;
  const q = $('#a-q'); q.oninput = () => { V.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const p = q.selectionStart; q.blur(); render(); const n = $('#a-q'); n.focus(); n.setSelectionRange(p, p); }, 300); };
}
function rConc() {
  const L = D.adm.filter(a => a.status !== 'aberto').sort((a, b) => str(b.concluidoEm || b.canceladoEm).localeCompare(str(a.concluidoEm || a.canceladoEm)));
  $('#body').innerHTML = L.length ? L.map(a => cardAdm(a).replace('</b>', `</b> ${a.status === 'cancelado' ? '<span class="badge b-mut">Cancelada</span>' : '<span class="badge b-ok">Concluída</span>'}`)).join('') : '<div class="empty">Nenhuma admissão concluída ainda.</div>';
}
function optAreas(sel) { return `<option value="">—</option>` + D.areas.map(a => `<option value="${esc(a.id)}" ${sel === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join(''); }
function optSubs(areaId, sel) { const a = areaBy(areaId); return `<option value="">—</option>` + ((a && a.subs) || []).map(s => `<option value="${esc(s.id)}" ${sel === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join(''); }
function rNova() {
  if (!PODE) { $('#body').innerHTML = '<div class="ro-banner">Seu perfil só consulta.</div>'; return; }
  $('#body').innerHTML = `<div class="card"><p class="ct">Abrir admissão</p><p class="cs">O candidato recebe um link para preencher os dados e mandar os documentos. Função, salário e área ficam só com o RH.</p>
    <div class="grid2"><div><label class="req" for="n-nome">Nome completo</label><input id="n-nome"></div><div><label class="req" for="n-cpf">CPF</label><input id="n-cpf" inputmode="numeric"></div></div>
    <div class="grid2"><div><label class="req" for="n-tel">Celular (WhatsApp)</label><input id="n-tel" inputmode="tel" placeholder="(24) 99999-9999"></div><div><label class="req" for="n-fun">Função</label><input id="n-fun" list="n-funl"><datalist id="n-funl">${funcoes().map(f => `<option value="${esc(f)}">`).join('')}</datalist></div></div>
    <div class="grid3"><div${VS() ? '' : ' hidden'}><label for="n-sal">Salário (R$)</label><input id="n-sal" inputmode="decimal"></div><div><label class="req" for="n-area">Área</label><select id="n-area">${optAreas('')}</select></div><div><label for="n-sub">Sub-área</label><select id="n-sub">${optSubs('')}</select></div></div>
    <div class="grid3"><div><label for="n-un">Unidade</label><input id="n-un" placeholder="Ex.: Barra Mansa"></div><div><label for="n-int">Previsão de integração</label><input type="date" id="n-int" value="${addDays(PRAZO - 1)}"></div><div><label for="n-alt">Trabalho em altura</label><select id="n-alt"><option value="">Não</option><option value="1">Sim</option></select></div></div>
    <div class="grid3"><div><label class="req" for="n-adc">Adicional</label><select id="n-adc"><option value="">Escolha…</option>${['Sem adicional', 'Com insalubridade', 'Com periculosidade'].map(o => `<option>${o}</option>`).join('')}</select></div></div>
    <div class="grid3"><div><label for="n-vin">Vínculo</label><select id="n-vin"><option value="CLT">CLT</option><option value="PJ">PJ (prestador de serviço)</option></select></div></div>
    <label for="n-obs">Observação (só RH)</label><input id="n-obs">
    <p class="ct" style="margin-top:16px">Treinamentos admissionais (EaD)</p>${cursosPick(new Set(D.cfg.cursos || []), 'n')}
    <div class="actions"><button class="btn primary big" id="n-save">Abrir admissão e gerar link</button></div></div>`;
  $('#n-area').onchange = () => $('#n-sub').innerHTML = optSubs($('#n-area').value);
  $('#n-save').onclick = criar;
}
function cursosPick(sel, px, excluir) {
  const L = D.cursos.filter(c => !(excluir || []).includes(c.id));
  if (!D.cursos.length) return '<p class="note">Nenhum curso EaD cadastrado ainda. Cadastre em Treinamentos → Cursos EaD; depois eles aparecem aqui.</p>';
  if (!L.length) return '<p class="note">Todos os cursos já foram liberados.</p>';
  return `<p class="note" style="margin:0 0 6px">Os marcados são liberados no portal do aluno junto com o link dos documentos. Login: CPF do candidato.</p><div class="pick" style="max-height:220px">${L.map(c => `<label><input type="checkbox" data-cur="${esc(c.id)}" class="${px}-cur" ${sel.has(c.id) ? 'checked' : ''}><span class="main"><b>${esc(c.nome)}</b><div class="t2">${c.cargaHoraria ? c.cargaHoraria + ' h' : ''}${c.pratica ? ' · tem prática presencial' : ''}${c.prazoDias ? ' · prazo ' + c.prazoDias + ' dias' : ''}</div></span></label>`).join('')}</div>
    ${px === 'n' ? '<label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="n-padrao" style="width:18px;height:18px"> Usar estes como padrão nas próximas admissões</label>' : ''}`;
}
/* funcionário "em admissão" (inativo) para o candidato ter acesso ao portal do aluno antes da contratação */
async function garantirFunc(a) {
  let f = D.func.find(x => x.id === a.funcionarioId) || D.func.find(x => ADM.dig(x.cpf) === a.cpf && x.ativo === false);
  const base = { nome: a.nome, cpf: a.cpf, funcao: a.funcao, area: a.area, areaId: a.areaId, subareaId: a.subareaId || '', subarea: a.subarea || '', subareas: a.subareaId ? [a.subareaId] : [], unidade: a.unidade || '', altura: !!a.altura, vinculo: a.vinculo || 'CLT', admissaoId: a.id };
  if (f) { await db.doc('funcionarios/' + f.id).update(Object.assign(base, { situacao: 'Em admissão', ativo: false })); return f.id; }
  const r = db.collection('funcionarios').doc(); await r.set(Object.assign(base, { matricula: '', situacao: 'Em admissão', ativo: false, criadoEm: new Date().toISOString() })); return r.id;
}
async function liberarTrein(a, ids, novaSenha) {
  if (!ids.length && !novaSenha) return;
  if (!window.__FB || !window.__FB.criarAluno) throw new Error('Liberar treinamentos só funciona no app publicado.');
  const fid = await garantirFunc(a); const tr = Object.assign({ cursos: [] }, a.trein || {});
  if (!tr.senha || novaSenha) { const r = await window.__FB.criarAluno({ funcionarioId: fid, nome: a.nome, chave: a.cpf }); tr.senha = r.senha; tr.login = a.cpf; }
  const hj = hoje();
  for (const id of ids) { if (tr.cursos.some(c => c.id === id)) continue; const c = D.cursos.find(x => x.id === id); if (!c) continue;
    await db.doc('matriculas/' + id + '_' + fid).set({ cursoId: id, funcionarioId: fid, nome: a.nome, matricula: '', liberadoEm: hj, prazo: c.prazoDias ? addDays(+c.prazoDias) : '', prog: {}, tempo: 0, por: MEU, admissaoId: a.id });
    tr.cursos.push({ id, nome: c.nome }); }
  tr.liberadoEm = tr.liberadoEm || hj;
  const e = JSON.parse(JSON.stringify(etp(a))); e.trein = Object.assign({}, e.trein); if (!e.trein.enviado && tr.cursos.length) e.trein.enviado = hj;
  await db.doc('admissoes/' + a.id).update({ trein: tr, funcionarioId: fid, etapas: e }); Object.assign(a, { trein: tr, funcionarioId: fid, etapas: e });
}
async function criar() {
  const nome = $('#n-nome').value.trim().replace(/\s+/g, ' '), cpf = ADM.dig($('#n-cpf').value), tel = ADM.dig($('#n-tel').value), funcao = $('#n-fun').value.trim().toUpperCase(), areaId = $('#n-area').value;
  if (nome.split(' ').length < 2) return toast('Informe o nome completo.', 'bad'); if (!ADM.cpfOk(cpf)) return toast('CPF inválido.', 'bad'); if (tel.length < 10) return toast('Informe o celular com DDD.', 'bad');
  if (!funcao) return toast('Informe a função.', 'bad'); if (!areaId) return toast('Escolha a área.', 'bad');
  const dup = D.adm.find(a => a.cpf === cpf && a.status === 'aberto'); if (dup) return toast('Já existe admissão em andamento para esse CPF.', 'bad');
  const ex = D.func.find(f => ADM.dig(f.cpf) === cpf && f.ativo !== false); if (ex) return toast(`CPF já cadastrado como funcionário ativo: ${ex.nome}.`, 'bad');
  const ar = areaBy(areaId), sid = $('#n-sub').value, sub = ((ar && ar.subs) || []).find(s => s.id === sid);
  const tk = ADM.rand(20); const agora = new Date().toISOString();
  if (!$('#n-adc').value) return toast('Marque o adicional: sem adicional, com insalubridade ou com periculosidade.', 'bad');
  const a = { nome, cpf, telefone: tel, funcao, areaId, area: ar ? ar.nome : '', subareaId: sid, subarea: sub ? sub.nome : '', unidade: $('#n-un').value.trim(), altura: $('#n-alt').value === '1', adicional: $('#n-adc').value, vinculo: $('#n-vin').value,
    status: 'aberto', abertoEm: agora, abertoPor: MEU, etapas: { integ: { agendada: $('#n-int').value } }, rev: {}, cand: { dados: {}, docs: {} }, obs: $('#n-obs').value.trim() };
  /* lê tudo do formulário ANTES de gravar: a gravação dispara o snapshot, que redesenha a tela e limpa os campos */
  const salTxt = $('#n-sal').value; const sal = numBR(salTxt); if (salTxt.trim() && sal == null) return toast('Salário inválido. Ex.: 2500,00', 'bad');
  const cur = $$('.n-cur').filter(c => c.checked).map(c => c.dataset.cur); const usarPadrao = !!($('#n-padrao') && $('#n-padrao').checked);
  const b = $('#n-save'); b.disabled = true; V.criando = true;
  try {
    if (VS()) await db.doc('admissoes_priv/' + tk).set({ salario: sal != null ? sal : null, em: agora });
    await db.doc('admissoes/' + tk).set(a);
    const obj = Object.assign({ id: tk }, a); D.adm.push(obj);
    b.textContent = 'Gerando carta e termo LGPD…'; await gerarTextos(obj, sal);
    if (usarPadrao) db.doc('config/admissao').set(Object.assign({}, D.cfg, { cursos: cur })).catch(() => {});
    let aviso = '';
    if (cur.length) { b.textContent = 'Liberando treinamentos…'; try { await liberarTrein(obj, cur); } catch (er) { aviso = ' Os treinamentos não foram liberados: ' + ((er && er.message) || er) + ' Tente de novo no detalhe.'; } }
    b.textContent = 'Gerando OS e termo de EPI (uns 20 s)…'; try { const m = await prepararOsEpi(obj); if (m.modelo) aviso += ' A OS usou o texto-modelo da função: revise o kit em Ferramentas & EPI e gere de novo no detalhe.'; } catch (er) { aviso += ' A OS e o termo de EPI não foram gerados: ' + ((er && er.message) || er) + ' Gere no detalhe.'; }
    V.criando = false; V.tab = 'and'; render(); detalhe(tk); toast('Admissão aberta: ' + (cur.length ? 'treinamentos liberados, ' : '') + 'OS e termo de EPI prontos para assinar. Envie o link ao candidato.' + aviso, aviso ? 'bad' : 'ok');
  } catch (e) { V.criando = false; b.disabled = false; toast('Não foi possível abrir: ' + ((e && e.message) || e), 'bad'); }
}

/* ---------- detalhe ---------- */
let ABERTO = '', SUJO = false; /* SUJO: o RH mexeu em campos ainda não salvos; não redesenha por cima */
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#sheet')) SUJO = true; });
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { ABERTO = ''; SUJO = false; $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
/* ---------- envio à contabilidade por e-mail ----------
   O RH escolhe documentos, data de admissão e data/hora do envio. O portal grava o pedido em envios_contab (com os arquivos em partes)
   e o script do Google (conta previneime@gmail.com) envia o e-mail na hora marcada e grava o resultado. */
const ENV_ST = { aprovacao: ['Aguardando de acordo', 'b-warn'], agendado: ['Agendado', 'b-info'], enviado: ['Enviado', 'b-ok'], erro: ['Erro', 'b-bad'], cancelado: ['Cancelado', 'b-mut'] };
function envLista(a) {
  const L = (a.envios || []).slice().reverse(); if (!L.length) return '';
  return `<div style="margin-top:8px">${L.map(x => { const st = ENV_ST[x.status] || ENV_ST.agendado; return `<div class="note" style="display:flex;gap:8px;align-items:center;padding:3px 0"><span class="badge ${st[1]}">${st[0]}</span><span style="flex:1">${x.status === 'aprovacao' ? 'Aguardando de acordo de ' + esc(((D.cfg || {}).aprovNomes) || 'Gustavo ou Josilaine') + ' · envio marcado para ' + fmtDH(x.quando) : x.status === 'enviado' ? 'Enviado em ' + fmtDH(x.enviadoEm) + (x.aprovadoPor ? ' · de acordo de ' + esc(x.aprovadoPor) : '') : x.status === 'erro' ? esc(x.erro || 'Falha no envio') : 'Para ' + fmtDH(x.quando)} · ${esc(x.para)} · ${x.n} arquivo(s) · admissão ${fmtD(x.dataAdmissao)}</span>${x.status === 'aprovacao' && podeAprovar() ? `<button class="btn sm primary" data-taprov="${esc(x.id)}" type="button">Ver ficha e dar o de acordo</button>` : ''}${(x.status === 'agendado' || x.status === 'aprovacao') && PODE ? `<button class="link" data-envx="${esc(x.id)}" type="button">cancelar</button>` : ''}</div>`; }).join('')}</div>`;
}
async function envStatus(a) {
  const pend = (a.envios || []).filter(x => x.status === 'agendado'); const url = (D.cfg || {}).envioUrl || 'https://script.google.com/macros/s/AKfycbwxPg38bGnvm5053kBKgO8GYQFCpABP2NHzCD7p3caHa_m78ErgcV7o8V3DNdfFk6Az/exec'; if (!pend.length || !url) return;
  let r; try { r = await (await fetch(url + '?ids=' + pend.map(x => x.id).join(','))).json(); } catch (e) { return; }
  let mudou = false;
  for (const x of pend) { const s2 = r[x.id]; if (!s2) continue; Object.assign(x, { status: s2.status, enviadoEm: s2.status === 'enviado' ? s2.em : '', erro: s2.erro || '' }); mudou = true;
    db.doc('envios_contab/' + x.id).update({ status: s2.status, enviadoEm: s2.em || '', erro: s2.erro || '' }).catch(() => {}); }
  if (mudou && PODE) { const e = etp(a); const ult = (a.envios || []).filter(x => x.status === 'enviado').map(x => str(x.enviadoEm).slice(0, 10)).sort().pop(); const u = { envios: a.envios }; if (ult) { e.contab = { data: ult }; u.etapas = e; } await db.doc('admissoes/' + a.id).update(u).catch(() => {}); if (ABERTO === a.id) detalhe(a.id); }
}
const meuEmail = () => str((window.__FB || {}).email || ((window.__FB || {}).user || {}).email).toLowerCase();
const aprovEmails = () => str((D.cfg || {}).aprovEmails).split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
const podeAprovar = () => aprovEmails().includes(meuEmail());
async function aprovarEnvio(a, id) {
  const x = (a.envios || []).find(y => y.id === id); if (!x) return;
  if (!confirm(`Dar o de acordo para a contratação de ${a.nome} (${a.funcao})? O e-mail para a contabilidade sai ${new Date(x.quando) > new Date() ? 'em ' + fmtDH(x.quando) : 'em até 5 minutos'}.`)) return;
  const quem = str(((window.__FB || {}).perfil || {}).nome) || meuEmail(); const agora = new Date().toISOString(); const quando = new Date(x.quando) > new Date() ? x.quando : agora;
  const ap = { por: quem, email: meuEmail(), em: agora };
  try { toast('Registrando o de acordo e atualizando a ficha…');
    /* refaz a ficha cadastral do envio já com o de acordo */
    const ref = db.doc('envios_contab/' + id); const ed = (await ref.get()).data() || {}; const arqs = (ed.arquivos || []).slice(); const fi = arqs.findIndex(f => /^Ficha cadastral/.test(str(f.nome)));
    if (fi >= 0) { const salv = await salarioDe(a); if (salv != null) ed.temSalario = true; const f = await fichaPdf(a, { dataAdmissao: ed.dataAdmissao, salario: salv, aprov: ap });
      const u8 = new Uint8Array(await f.blob.arrayBuffer()); let bin = ''; for (let j = 0; j < u8.length; j += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(j, j + 0x8000)); const b64 = btoa(bin); const partes = Math.max(1, Math.ceil(b64.length / 700000));
      for (let p2 = 0; p2 < partes; p2++) await db.doc(`envios_contab/${id}/p/${fi}_${p2}`).set({ f: fi, i: p2, d: b64.slice(p2 * 700000, (p2 + 1) * 700000) });
      for (let p2 = partes; p2 < (+arqs[fi].partes || 1); p2++) await db.doc(`envios_contab/${id}/p/${fi}_${p2}`).delete().catch(() => {});
      arqs[fi] = Object.assign({}, arqs[fi], { partes, bytes: f.blob.size }); }
    await ref.update({ status: 'agendado', quando, aprovadoPor: quem, aprovadoEmail: meuEmail(), aprovadoEm: agora, arquivos: arqs, temSalario: !!ed.temSalario });
    Object.assign(x, { status: 'agendado', quando, aprovadoPor: quem, aprovadoEm: agora }); await db.doc('admissoes/' + a.id).update({ envios: a.envios, aprovContratacao: ap }); a.aprovContratacao = ap;
    toast('De acordo registrado. O envio à contabilidade está agendado.', 'ok'); detalhe(a.id); } catch (e) { console.error(e); toast('Não foi possível registrar o de acordo.', 'bad'); }
}
async function cancelarEnvio(a, id) {
  if (!confirm('Cancelar este envio agendado?')) return;
  try { await db.doc('envios_contab/' + id).update({ status: 'cancelado', canceladoPor: MEU, canceladoEm: new Date().toISOString() }); const x = (a.envios || []).find(y => y.id === id); if (x) x.status = 'cancelado'; await db.doc('admissoes/' + a.id).update({ envios: a.envios }); toast('Envio cancelado.', 'ok'); detalhe(a.id); } catch (e) { toast('Não foi possível cancelar.', 'bad'); }
}
const ASSUNTO_PADRAO = 'Admissão – {nome} – {funcao}';
const MSG_PADRAO = 'Prezados,\n\nSegue a documentação para admissão de {nome}, CPF {cpf}.\n\nFunção: {funcao}\nÁrea: {area}\nUnidade: {unidade}\nVínculo: {vinculo}\nAdicional: {adicional}\nData de admissão: {dataAdmissao}\n\nEm anexo, a ficha cadastral com os dados do funcionário, conferidos com os documentos.\n\nFicamos à disposição.\n\nAtenciosamente,\nRH – {empresa}';
const preencher = (t, a, dAdm) => str(t).replace(/\{(\w+)\}/g, (m, k) => ({ nome: a.nome, cpf: ADM.fmtCpf(a.cpf), funcao: a.funcao, area: [a.area, a.subarea].filter(Boolean).join(' / '), unidade: a.unidade || '—', vinculo: a.vinculo || 'CLT', adicional: a.adicional || 'não informado', dataAdmissao: dAdm ? fmtD(dAdm) : '[escolha a data]', empresa: empNome(), cnpj: empCnpj() })[k] ?? m);
const imgB64 = async blob => { // qualquer imagem -> JPEG base64 (ExcelJS aceita png/jpeg)
  const url = URL.createObjectURL(blob); try { const im = await new Promise((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = url; });
    const cv = document.createElement('canvas'); const k = Math.min(1, 600 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
    return { b64: cv.toDataURL('image/jpeg', .9).split(',')[1], w: cv.width, h: cv.height }; } finally { URL.revokeObjectURL(url); } };
const salarioDe = async a => { if (!VS()) return null; const p = await db.doc('admissoes_priv/' + a.id).get().catch(() => null); return p && p.exists && p.data().salario != null ? p.data().salario : null; };
function envioContab(a) {
  const c = a.cand || {}, docs = c.docs || {}; const cfg = D.cfg || {};
  const cand = []; ADM.slotsDe(a).forEach(sl => (docs[sl.id] || []).forEach((arq, i) => cand.push({ k: 'c|' + sl.id + '|' + i, t: sl.t + ((docs[sl.id] || []).length > 1 ? ' (' + (i + 1) + ')' : ''), sub: arq.nome })));
  const ass = []; if ((a.textos || {}).carta) ass.push({ k: 't|carta', t: 'Carta-convite' + (assinado(a, 'carta') ? ' (assinada)' : ' (não assinada)') }); if ((a.textos || {}).lgpd) ass.push({ k: 't|lgpd', t: 'Termo LGPD' + (assinado(a, 'lgpd') ? ' (assinado)' : ' (não assinado)') });
  Object.keys(a.assinar || {}).forEach(id => ass.push({ k: 'a|' + id, t: tituloDoc(a, id) + (assinado(a, id) ? ' (assinado)' : ' (não assinado)') }));
  [['aso', 'ASO admissional'], ['integ', 'Comprovante da integração']].forEach(([k, t]) => ((etp(a)[k] || {}).arq || []).forEach((f, i, L) => ass.push({ k: 'e|' + k + '|' + i, t: t + (L.length > 1 ? ' (' + (i + 1) + ')' : '') + ' (anexado)', sub: f.nome })));
  const amanha = new Date(Date.now() + 864e5); const dtl = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const chk = (x, on) => `<label style="display:flex;gap:8px;align-items:flex-start;color:inherit;font-size:14px;margin:4px 0"><input type="checkbox" data-ek="${esc(x.k)}" ${on ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px"><span>${esc(x.t)}${x.sub ? `<span class="note"> · ${esc(x.sub)}</span>` : ''}</span></label>`;
  sheet(`<div class="top"><h2>Enviar à contabilidade</h2><button class="x" id="v-x" aria-label="Voltar">×</button></div>
    <p class="note" style="margin:-4px 0 8px">${esc(a.nome)} · ${esc(a.funcao)} · ${esc(a.area)}</p>
    <div class="card"><div class="grid2"><div><label class="req" for="v-para">Para (e-mail da contabilidade)</label><input id="v-para" type="email" value="${esc(cfg.contabEmail || '')}" placeholder="contabilidade@…"></div><div><label for="v-cc">Cópia (separe por vírgula)</label><input id="v-cc" value="${esc(cfg.contabCc || '')}"></div></div>
      <div class="grid2"><div><label class="req" for="v-adm">Data de admissão (contratação)</label><input id="v-adm" type="date" value="${esc(a.dataAdmissao || '')}"></div><div><label class="req" for="v-quando">Enviar em</label><div style="display:flex;gap:6px"><input id="v-dia" type="date" value="${dtl(new Date())}"><input id="v-hora" type="time" value="${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}" style="max-width:120px"></div><p class="note" style="margin:2px 0 0">Data e hora de agora = envia em até 5 minutos. Pode marcar para outro dia (ex.: ${fmtD(dtl(amanha))}).</p></div></div>
      <label for="v-ass">Assunto</label><input id="v-ass" value="${esc(preencher(cfg.contabAssunto || ASSUNTO_PADRAO, a, a.dataAdmissao))}">
      <label for="v-msg">Mensagem</label><textarea id="v-msg" rows="8"></textarea></div>
    <div class="card"><p class="ct" style="margin:0 0 4px">Documentos do candidato</p>${cand.map(x => chk(x, true)).join('') || '<p class="note">Nenhum documento enviado.</p>'}
      <p class="ct" style="margin:12px 0 4px">Documentos da empresa</p>${chk({ k: 'x|ficha', t: 'Ficha cadastral (PDF, modelo FOR-RH) – foto, dados e conferência com os documentos' }, true)}${fcEstado(a).completo ? '' : `<p class="note" style="color:#b42318;margin:0 0 6px 26px">Atenção: os dados ainda não foram conferidos com os documentos (${fcEstado(a).ok} de ${fcEstado(a).total}). A ficha sai marcada como “não conferida”.</p>`}${VS() ? `<label style="display:flex;gap:8px;align-items:center;color:inherit;font-size:13px;margin:0 0 6px 26px"><input type="checkbox" id="v-sal" checked style="width:16px;height:16px"> incluir o salário na ficha</label>` : ''}${ass.map(x => chk(x, /assinad|anexado/.test(x.t))).join('') || '<p class="note">Nenhum documento gerado.</p>'}
      ${aprovEmails().length ? `<p class="note"><b>Antes do envio:</b> ${esc(str((D.cfg || {}).aprovNomes) || aprovEmails().join(', '))} recebe(m) um e-mail pedindo o de acordo da contratação. A contabilidade só recebe depois que um deles der o de acordo no portal.</p>` : ''}
      <p class="note">O e-mail sai de previneime@gmail.com. Limite de 25 MB por e-mail (os anexos são conferidos antes de agendar).</p></div>
    <div class="actions"><button class="btn ghost" id="v-cancel" type="button">Voltar</button><button class="btn primary" id="v-ok" type="button">${aprovEmails().length ? 'Pedir de acordo e agendar' : 'Agendar envio'}</button></div><p class="note" id="v-st"></p>`);
  const msgPad = () => preencher(cfg.contabMsg || MSG_PADRAO, a, $('#v-adm').value);
  let msgEditada = false; $('#v-msg').value = msgPad(); $('#v-msg').oninput = () => { msgEditada = true; };
  $('#v-adm').onchange = () => { if (!msgEditada) $('#v-msg').value = msgPad(); };
  $('#v-x').onclick = $('#v-cancel').onclick = () => detalhe(a.id);
  $('#v-ok').onclick = async () => {
    const para = $('#v-para').value.trim(), cc = $('#v-cc').value.trim(), dAdm = $('#v-adm').value, quando = new Date($('#v-dia').value + 'T' + ($('#v-hora').value || '00:00'));
    const sel = $$('#sheet [data-ek]:checked').map(x => x.dataset.ek);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return toast('Informe o e-mail da contabilidade.', 'bad');
    if (!dAdm) return toast('Escolha a data de admissão.', 'bad'); if (isNaN(quando)) return toast('Escolha o dia e a hora do envio.', 'bad');
    if (!sel.length) return toast('Marque ao menos um documento.', 'bad');
    if (sel.includes('x|ficha') && !fcEstado(a).completo && !confirm('Os dados do candidato ainda não foram conferidos com os documentos. Enviar mesmo assim?')) return;
    const b = $('#v-ok'); b.disabled = true; const st = $('#v-st');
    try {
      st.textContent = 'Juntando os documentos…'; const files = []; let temSal = false;
      for (const k of sel) { const [t, x, i] = k.split('|');
        if (t === 'x') { st.textContent = 'Gerando a ficha cadastral…'; const sv = $('#v-sal') && $('#v-sal').checked ? await salarioDe(a) : null; if (sv != null) temSal = true; files.push(await fichaPdf(a, { dataAdmissao: dAdm, salario: sv })); continue; }
        if (t === 'e') { const arq = etp(a)[x].arq[+i]; const blob = await ADM.ler(arq, x, getPart(a.id)); const ext = (str(arq.nome).match(/\.[a-z0-9]+$/i) || [''])[0] || (/pdf/.test(arq.tipo) ? '.pdf' : '.jpg'); files.push({ nome: ((x === 'aso' ? 'ASO admissional' : 'Integração') + (etp(a)[x].arq.length > 1 ? ' ' + (+i + 1) : '') + ' - ' + a.nome + ext).replace(/[\\/:*?"<>|]+/g, ' '), tipo: arq.tipo, blob }); continue; }
        if (t === 'c') { const arq = docs[x][+i]; const blob = await ADM.ler(arq, x, getPart(a.id)); const ext = (str(arq.nome).match(/\.[a-z0-9]+$/i) || [''])[0] || (/pdf/.test(arq.tipo) ? '.pdf' : '.jpg'); const tit = (ADM.SLOTS.find(z => z.id === x) || {}).t || x; files.push({ nome: (tit.split(' (')[0] + (docs[x].length > 1 ? ' ' + (+i + 1) : '') + ' - ' + a.nome + ext).replace(/[\\/:*?"<>|]+/g, ' '), tipo: arq.tipo, blob }); }
        else { CAPT = []; try { if (t === 't') await pdfTexto(a, x); else await pdfDoc(a, x); } finally { const cap = CAPT; CAPT = null; cap.forEach(f => files.push({ nome: f.nome.replace(/[\\/:*?"<>|]+/g, ' '), tipo: 'application/pdf', blob: f.blob })); } }
      }
      const tot = files.reduce((s2, f) => s2 + f.blob.size, 0); if (tot > 24 * 1024 * 1024) { b.disabled = false; st.textContent = ''; return toast(`Os anexos somam ${(tot / 1048576).toFixed(1)} MB; o limite é 25 MB. Desmarque alguns.`, 'bad'); }
      const ref = db.collection('envios_contab').doc(); const meta = [];
      for (let fi = 0; fi < files.length; fi++) { const f = files[fi]; st.textContent = `Enviando para o portal: ${f.nome}…`;
        const u8 = new Uint8Array(await f.blob.arrayBuffer()); let bin = ''; for (let j = 0; j < u8.length; j += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(j, j + 0x8000)); const b64 = btoa(bin); const partes = Math.max(1, Math.ceil(b64.length / 700000));
        for (let p2 = 0; p2 < partes; p2++) await db.doc(`envios_contab/${ref.id}/p/${fi}_${p2}`).set({ f: fi, i: p2, d: b64.slice(p2 * 700000, (p2 + 1) * 700000) });
        meta.push({ nome: f.nome, tipo: f.tipo || 'application/octet-stream', partes, bytes: f.blob.size }); }
      const agora = new Date().toISOString();
      const apv = aprovEmails(); const stIni = apv.length ? 'aprovacao' : 'agendado';
      const resumo = `Pedido de de acordo para contratação\n\nCandidato: ${a.nome}\nCPF: ${ADM.fmtCpf(a.cpf)}\nFunção: ${a.funcao}\nÁrea: ${[a.area, a.subarea].filter(Boolean).join(' / ')}\nUnidade: ${a.unidade || '—'}\nVínculo: ${a.vinculo || 'CLT'}\nAdicional: ${a.adicional || 'não informado'}\nData de admissão: ${fmtD(dAdm)}\nE-mail à contabilidade marcado para: ${fmtDH(quando.toISOString())} (${para})\nAnexos preparados: ${meta.length}\nDados conferidos com os documentos: ${fcEstado(a).completo ? 'sim, por ' + (fcEstado(a).por || '') : 'NÃO'}\nPedido por: ${str(((window.__FB || {}).perfil || {}).nome) || MEU}\n\nPara ver a ficha e dar o de acordo, abra: https://app.previneeletrica.com.br/admissao/?aprov=${ref.id}\n(a ficha cadastral também vai em anexo)`;
      await ref.set({ admissaoId: a.id, nome: a.nome, para, cc, assunto: $('#v-ass').value.trim() || 'Admissão – ' + a.nome, corpo: $('#v-msg').value, dataAdmissao: dAdm, quando: quando.toISOString(), status: stIni, arquivos: meta, criadoEm: agora, por: MEU, temSalario: !!temSal,
        aprovEmails: apv, aprovAssunto: `De acordo de contratação – ${a.nome} – ${a.funcao}`, aprovCorpo: resumo });
      const env = (a.envios || []).concat([{ id: ref.id, para, quando: quando.toISOString(), dataAdmissao: dAdm, n: meta.length, status: stIni }]);
      await db.doc('admissoes/' + a.id).update({ envios: env, dataAdmissao: dAdm }); a.envios = env; a.dataAdmissao = dAdm;
      if (!cfg.contabEmail && PODE) db.doc('config/admissao').set({ contabEmail: para, contabCc: cc }, { merge: true }).then(() => { D.cfg.contabEmail = para; D.cfg.contabCc = cc; }).catch(() => {});
      toast(stIni === 'aprovacao' ? 'Pedido de de acordo enviado por e-mail a ' + (str((D.cfg || {}).aprovNomes) || 'quem aprova') + '. O e-mail à contabilidade só sai depois do de acordo.' : quando - Date.now() < 5 * 60e3 ? 'Envio agendado: sai em até 5 minutos.' : 'Envio agendado para ' + fmtDH(quando.toISOString()) + '.', 'ok'); detalhe(a.id);
    } catch (e) { console.error(e); b.disabled = false; st.textContent = ''; toast('Não foi possível agendar: ' + (e.message || e), 'bad'); }
  };
}
async function detalhe(id, refresh) {
  const a = D.adm.find(x => x.id === id); if (!a) return; ABERTO = id;
  if (refresh) { const ae = document.activeElement; if (SUJO || (ae && ae.closest && ae.closest('#sheet') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return; }
  SUJO = false;
  const y = $('#sheet').scrollTop;
  const e = etp(a), c = a.cand || {}, dd = c.dados || {}, docs = c.docs || {}, rev = a.rev || {}, ro = PODE && a.status === 'aberto' ? '' : 'disabled';
  const d = diasMob(a);
  sheet(`<div class="top"><h2>${esc(a.nome)}</h2><button class="x" id="m-x" aria-label="Fechar">×</button></div>
    <p class="note" style="margin:-4px 0 8px">CPF ${esc(ADM.fmtCpf(a.cpf))} · ${esc(a.funcao)} · ${esc(a.area)}${a.subarea ? ' → ' + esc(a.subarea) : ''}${a.unidade ? ' · ' + esc(a.unidade) : ''}${a.altura ? ' · trabalho em altura' : ''}${a.adicional ? ' · ' + esc(a.adicional.toLowerCase()) : ''}${a.vinculo === 'PJ' ? ' · <b>PJ</b>' : ''}</p>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${kpi('Dias de mobilização', d, d > PRAZO ? 'bad' : 'ok', fimMob(a) ? 'integrado em ' + fmtD(fimMob(a)) : 'desde ' + fmtD(a.abertoEm))}${kpi('Documentos', ADM.docsSt(a).env + '/' + ADM.docsSt(a).obr, ADM.docsSt(a).rej.length ? 'bad' : '')}<div class="kpi"><div class="n" id="m-sal" style="font-size:18px">…</div><div class="t">Salário</div></div></div>
    ${pills(a)}
    ${a.status === 'aberto' ? `<div class="etf"><h4>Link do candidato</h4><div class="linkbox"><input readonly value="${esc(linkDe(a))}" id="m-link"><button class="btn sm ghost" id="m-copy">Copiar</button><a class="btn sm accent" href="${esc(waDe(a))}" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp</a></div></div>` : ''}
    <h3>Documentos</h3><div class="card" style="padding:4px 12px">${ADM.slotsDe(a).map(s => { const L = docs[s.id] || []; const r = rev[s.id]; const ult = ADM.ultimoEnvio(L); const atual = r && str(r.em) >= ult;
      const st = !L.length ? (s.obr ? '<span class="badge b-warn">Falta</span>' : '<span class="badge b-mut">Opcional</span>') : atual && r.st === 'ok' ? '<span class="badge b-ok">Conferido</span>' : atual && r.st === 'rej' ? '<span class="badge b-bad">Recusado</span>' : '<span class="badge b-info">Conferir</span>';
      return `<div class="dslot"><div class="main"><b>${esc(s.t)}</b>${s.obr ? '' : ' <span class="t2">(se tiver)</span>'} ${st}${L.some(f => f.q === 'baixa') ? ' <span class="badge b-warn">qualidade baixa</span>' : ''}
        ${atual && r.st === 'rej' ? `<div class="t2">Motivo: ${esc(r.motivo)}</div>` : ''}
        ${L.length ? `<div class="thumbs">${L.map((f, i) => `<button data-ver="${s.id}|${i}" title="${esc(f.nome)}">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}</button>`).join('')}</div>` : ''}
        ${ro ? '' : `<div class="actions" style="margin-top:6px">${L.length ? `<button class="btn sm ghost" data-ok="${s.id}">✓ Conferido</button><button class="btn sm danger" data-rej="${s.id}">Recusar</button>` : ''}<button class="btn sm ghost" data-anx="${s.id}">Anexar</button></div>`}</div></div>`; }).join('')}</div>
    <h3>Dados do candidato</h3><div class="card">${Object.keys(dd).length ? `<dl class="kv">${[['Nascimento', fmtD(dd.nascimento)], ['Sexo', dd.sexo], ['Estado civil', dd.estadoCivil], ['Mãe', dd.mae], ['Pai', dd.pai], ['Celular', dd.telefone], ['E-mail', dd.email],
        ['Endereço', [dd.rua, dd.numero, dd.complemento, dd.bairro, dd.cidade && dd.cidade + '/' + dd.uf, dd.cep].filter(Boolean).join(', ')], ['Escolaridade', dd.escolaridade], ['PIS', dd.pis], ['Banco', [dd.banco, dd.agencia && 'ag. ' + dd.agencia, dd.conta && 'cc ' + dd.conta, dd.pix && 'PIX ' + dd.pix].filter(Boolean).join(' · ')],
        ['Tamanhos', `camisa ${dd.tamCamisa || '—'} · calça ${dd.tamCalca || '—'} · calçado ${dd.tamCalcado || '—'}`], ['Emergência', [dd.emergNome, dd.emergTel].filter(Boolean).join(' · ')], ['Dependentes', dd.dependentes]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="note" style="margin:0">O candidato ainda não preencheu os dados.</p>'}</div>
    ${confBox(a, ro)}
    <h3>Etapas</h3>
    <div class="etf"><h4>ASO ${(e.aso || {}).data ? '<span class="badge b-ok">feito</span>' : ''}</h4><div class="grid2"><div><label for="e-asoag">Exame marcado para</label><input type="date" id="e-asoag" value="${esc((e.aso || {}).agendado || '')}" ${ro}></div><div><label for="e-aso">Data do ASO</label><input type="date" id="e-aso" value="${esc((e.aso || {}).data || '')}" ${ro}></div></div>
      ${(e.aso || {}).data ? `<p class="note" style="margin:6px 0 0">Vence em ${fmtD(addMonths(e.aso.data, 12))} (1 ano, automático).</p>` : ''}
      <div class="grid2"><div><label for="e-asoap">Resultado</label><select id="e-asoap" ${ro}><option value="1" ${(e.aso || {}).apto !== false ? 'selected' : ''}>Apto</option><option value="0" ${(e.aso || {}).apto === false ? 'selected' : ''}>Inapto</option></select></div><div><label>Arquivo do ASO</label>${((e.aso || {}).arq || []).length ? `<div class="thumbs">${e.aso.arq.map((f, i) => `<button data-veraso="${i}">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}</button>`).join('')}</div>` : ''}${ro ? '' : '<button class="btn sm ghost" id="e-asof" style="margin-top:4px">Anexar ASO</button>'}</div></div></div>
    <div class="etf"><h4>Integração</h4><div class="grid2"><div><label for="e-ia">Agendada para</label><input type="date" id="e-ia" value="${esc((e.integ || {}).agendada || '')}" ${ro}></div><div><label for="e-ir">Realizada em</label><input type="date" id="e-ir" value="${esc((e.integ || {}).realizada || '')}" ${ro}></div></div><p class="note" style="margin:6px 0 0">A integração não vence.</p>
      <div style="margin-top:6px"><label>Comprovante da integração (lista de presença, certificado ou foto)</label>${((e.integ || {}).arq || []).length ? `<div class="thumbs">${e.integ.arq.map((f, i) => `<button data-verinteg="${i}">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}</button>`).join('')}</div>` : ''}${ro ? '' : '<button class="btn sm ghost" id="e-intf" style="margin-top:4px">Anexar integração</button>'}</div></div>
    <div class="etf"><h4>Treinamentos admissionais</h4><div id="m-trein"><p class="note">Carregando…</p></div><div class="grid2"><div><label for="e-te">Enviados em</label><input type="date" id="e-te" value="${esc((e.trein || {}).enviado || '')}" ${ro}></div><div><label for="e-tc">Concluídos em</label><input type="date" id="e-tc" value="${esc((e.trein || {}).concluido || '')}" ${ro}></div></div></div>
    <div class="etf"><h4>Assinaturas e envio</h4><div class="grid3"><div><label for="e-epi">OS e ficha de EPI assinadas</label><input type="date" id="e-epi" value="${esc((e.epi || {}).data || '')}" ${ro}></div><div><label for="e-adm">Docs admissionais assinados</label><input type="date" id="e-adm" value="${esc((e.admiss || {}).data || '')}" ${ro}></div><div><label for="e-ct">Enviado à contabilidade</label><input type="date" id="e-ct" value="${esc((e.contab || {}).data || '')}" ${ro}></div></div>
      ${envLista(a)}${PODE ? '<div class="actions" style="justify-content:flex-start;margin-top:6px"><button class="btn sm accent" id="e-env" type="button">Enviar à contabilidade por e-mail…</button><button class="btn sm ghost" id="e-fx" type="button">Baixar ficha cadastral (PDF)</button></div>' : ''}</div>
    <div class="etf"><h4>Justificativa de atraso ${atrasado(a) ? `<span class="badge ${precisaJust(a) ? 'b-bad' : 'b-ok'}">${precisaJust(a) ? 'obrigatória' : 'preenchida'}</span>` : ''}</h4>
      <div class="grid2"><div><label for="e-jm">Motivo</label><select id="e-jm" ${ro}><option value="">—</option>${['Documentos do candidato', 'Agenda do ASO / clínica', 'Agenda da integração (cliente)', 'Treinamentos', 'Candidato desistiu ou sumiu', 'Aprovação interna', 'Outro'].map(m => `<option ${a.justMotivo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div><label for="e-j">Detalhe</label><input id="e-j" value="${esc(a.justificativa || '')}" ${ro} placeholder="${atrasado(a) ? 'Obrigatório: passou de ' + PRAZO + ' dias' : 'Só se passar de ' + PRAZO + ' dias'}"></div></div></div>
    <h3>Documentos da contratação para assinar</h3>
    ${assinBox(a, ro)}
    <div class="grid2"><div${VS() ? '' : ' hidden'}><label for="e-sal">Salário (R$) · só quem vê salários</label><input id="e-sal" inputmode="decimal" placeholder="Carregando…" disabled></div><div><label for="e-obs">Observação (só RH)</label><input id="e-obs" value="${esc(a.obs || '')}" ${ro}></div></div>
    <div class="grid2"><div><label for="e-adc">Adicional</label><select id="e-adc" ${ro}><option value="">—</option>${['Sem adicional', 'Com insalubridade', 'Com periculosidade'].map(o => `<option ${a.adicional === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
    ${ro ? (a.funcionarioId ? `<p class="note">Cadastrado como funcionário em ${fmtD(a.concluidoEm)}.</p>` : '') : `<div class="actions"><button class="btn primary" id="e-save">Salvar etapas</button><button class="btn accent" id="e-conc">Concluir e cadastrar funcionário</button></div>
      <div class="actions" style="margin-top:6px"><button class="btn sm danger" id="e-canc">Cancelar admissão (desistência)</button></div>`}`);
  $('#sheet').scrollTop = y;
  treinBox(a, !!ro);
  $$('[data-pdft]').forEach(b => b.onclick = () => pdfTexto(a, b.dataset.pdft));
  const osv = $('#as-osv'); if (osv) osv.onclick = () => pdfDoc(a, 'osepi');
  $$('[data-pdfd]').forEach(b => b.onclick = () => pdfDoc(a, b.dataset.pdfd));
  $$('[data-rmd]').forEach(b => { let armed = false; b.onclick = async () => { if (!armed) { armed = true; b.textContent = 'Retirar?'; return; } const as = Object.assign({}, a.assinar); delete as[b.dataset.rmd]; try { await db.doc('admissoes/' + a.id).update({ assinar: as }); a.assinar = as; SUJO = false; detalhe(a.id); } catch (e) { toast('Não foi possível retirar.', 'bad'); } }; });
  const anx = $('#as-anx'); if (anx) anx.onclick = () => { const tit = $('#as-tit').value.trim(); if (!tit) return toast('Dê um nome ao documento (ex.: Contrato de trabalho).', 'bad');
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf';
    i.onchange = async () => { const f = i.files[0]; if (!f) return; if (!/pdf$/i.test(f.type || f.name)) return toast('Envie em PDF.', 'bad'); anx.disabled = true; anx.textContent = 'Enviando…';
      try { const prep = await ADM.preparar(f); const id = 'doc' + ADM.rand(6); const arq = await ADM.gravar(prep, id, (pid, d) => db.doc(`admissoes/${a.id}/d/${pid}`).set({ d }));
        arq.hash = await ADM.sha256(prep.b64); arq.titulo = tit; arq.por = MEU; const as = Object.assign({}, a.assinar || {}, { [id]: arq }); await db.doc('admissoes/' + a.id).update({ assinar: as }); a.assinar = as;
        toast('Documento enviado para o candidato assinar.', 'ok'); SUJO = false; detalhe(a.id); } catch (e) { anx.disabled = false; anx.textContent = 'Anexar PDF para assinar'; toast(e.message || 'Não foi possível anexar.', 'bad'); } };
    i.click(); };
  const astx = $('#as-tx'); if (astx) astx.onclick = async () => { astx.disabled = true; try { const p = VS() ? await db.doc('admissoes_priv/' + a.id).get().catch(() => null) : null; await gerarTextos(a, p && p.exists ? p.data().salario : null, (a.textos || {}).carta ? ['carta'] : ['lgpd', 'carta']); toast('Carta e termo prontos para o candidato assinar.', 'ok'); SUJO = false; detalhe(a.id); } catch (e) { astx.disabled = false; toast('Não foi possível gerar: ' + ((e && e.message) || e), 'bad'); } };
  const asos = $('#as-os'); if (asos) asos.onclick = async () => { asos.disabled = true; asos.textContent = 'Gerando (pode levar uns 20 s)…'; try { const m = await prepararOsEpi(a); toast(m.modelo ? 'Gerado, mas a OS usou o texto-modelo da função.' : 'OS e termo de EPI enviados para o candidato assinar.', m.modelo ? 'bad' : 'ok'); SUJO = false; detalhe(a.id); } catch (e) { asos.disabled = false; asos.textContent = 'Gerar OS e termo de EPI para assinar'; toast(e.message || 'Não foi possível gerar.', 'bad'); } };
  /* OS assinada: preenche a etapa sozinho */
  if (!ro && assinado(a, 'osepi') && !((a.etapas || {}).epi || {}).data) { const ne = JSON.parse(JSON.stringify(etp(a))); ne.epi = { data: str(a.cand.assin.osepi.em).slice(0, 10) }; db.doc('admissoes/' + a.id).update({ etapas: ne }).then(() => { a.etapas = ne; const x = $('#e-epi'); if (x && !x.value) x.value = ne.epi.data; }, () => {}); }
  (VS() ? db.doc('admissoes_priv/' + id).get() : Promise.reject()).then(s => { const v = s.exists ? s.data().salario : null; const el = $('#m-sal'); if (el) el.textContent = v != null ? brl(v) : 'não informado';
      const inp = $('#e-sal'); if (inp) { inp.value = v != null ? String(v).replace('.', ',') : ''; inp.dataset.orig = inp.value; inp.placeholder = 'Ex.: 3500,00'; inp.disabled = !!ro; } },
    () => { const el = $('#m-sal'); if (el) el.textContent = 'restrito'; const inp = $('#e-sal'); if (inp) inp.placeholder = 'Seu perfil não vê salário'; });
  $('#m-x').onclick = fechar;
  const cp = $('#m-copy'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(linkDe(a)); toast('Link copiado.', 'ok'); } catch (er) { $('#m-link').select(); toast('Selecione e copie o link.'); } };
  const sv = $('#e-save'); if (sv) sv.onclick = () => salvarEtapas(a);
  const en = $('#e-env'); if (en) en.onclick = () => envioContab(a);
  const fx = $('#e-fx'); if (fx) fx.onclick = () => baixarFichaPdf(a);
  confWire(a);
  if (!refresh) envStatus(a);
  $$('[data-envx]').forEach(b => b.onclick = () => cancelarEnvio(a, b.dataset.envx));
  $$('[data-envap]').forEach(b => b.onclick = () => aprovarEnvio(a, b.dataset.envap));
  const cc = $('#e-conc'); if (cc) cc.onclick = () => concluir(a);
  const cn = $('#e-canc'); if (cn) { let armed = false; cn.onclick = async () => { if (!armed) { armed = true; cn.textContent = 'Toque de novo para cancelar (o link deixa de funcionar)'; return; }
    try { await db.doc('admissoes/' + a.id).update({ status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: MEU });
      if ((a.trein || {}).senha) { try { const l = await db.doc('login/' + a.cpf).get(); if (l.exists && l.data().uid) await db.doc('usuarios/' + l.data().uid).update({ ativo: false }); } catch (er) {} }
      if (a.funcionarioId) db.doc('funcionarios/' + a.funcionarioId).update({ situacao: 'Desistiu' }).catch(() => {});
      toast('Admissão cancelada.', 'ok'); fechar(); } catch (er) { toast('Não foi possível cancelar.', 'bad'); } }; }
  const af = $('#e-asof'); if (af) af.onclick = () => anexar(a, 'aso');
  const inf = $('#e-intf'); if (inf) inf.onclick = () => anexar(a, 'integ');
}
function lerEtapas(a) {
  const e = JSON.parse(JSON.stringify(etp(a)));
  const asoD = $('#e-aso').value;
  e.aso = Object.assign({}, e.aso, { agendado: $('#e-asoag').value, data: asoD, validade: asoD ? addMonths(asoD, 12) : '', apto: $('#e-asoap').value !== '0' });
  e.integ = Object.assign({}, e.integ, { agendada: $('#e-ia').value, realizada: $('#e-ir').value, validade: '' });
  e.trein = { enviado: $('#e-te').value, concluido: $('#e-tc').value };
  e.epi = { data: $('#e-epi').value }; e.admiss = { data: $('#e-adm').value }; e.contab = { data: $('#e-ct').value };
  return e;
}
async function salvarEtapas(a, silencioso) {
  const e = lerEtapas(a); const u = { etapas: e, justMotivo: $('#e-jm').value, justificativa: $('#e-j').value.trim(), obs: $('#e-obs').value.trim(), adicional: ($('#e-adc') || {}).value || a.adicional || '', atualizadoEm: new Date().toISOString() };
  if (e.integ.realizada && e.integ.realizada < str(a.abertoEm).slice(0, 10)) { toast('A integração não pode ser antes da abertura.', 'bad'); return false; }
  const si = $('#e-sal'); if (si && !si.disabled && si.value !== si.dataset.orig) {
    const v = numBR(si.value); if (si.value.trim() && v == null) { toast('Salário inválido.', 'bad'); return false; }
    try { await db.doc('admissoes_priv/' + a.id).set({ salario: v, em: new Date().toISOString(), por: MEU }); si.dataset.orig = si.value;
      if (assinado(a, 'carta')) toast('A carta-convite já foi assinada com o salário anterior. Para mudar, gere a carta de novo no detalhe.', 'bad'); else await gerarTextos(a, v, ['carta']); } catch (er) { toast('Não foi possível salvar o salário.', 'bad'); return false; } }
  try { await db.doc('admissoes/' + a.id).update(u); Object.assign(a, u); if (!silencioso) { toast('Etapas salvas.', 'ok'); detalhe(a.id); } return true; } catch (er) { toast('Não foi possível salvar.', 'bad'); return false; }
}
async function revisar(a, slot, st, motivo) {
  const rev = Object.assign({}, a.rev || {}); rev[slot] = { st, motivo: motivo || '', em: new Date().toISOString(), por: MEU };
  const u = { rev }; const tmp = Object.assign({}, a, { rev }); const ds = ADM.docsSt(tmp); if (ds.ok === ds.obr && !a.docsOkEm) u.docsOkEm = new Date().toISOString();
  try { await db.doc('admissoes/' + a.id).update(u); Object.assign(a, u); detalhe(a.id); } catch (er) { toast('Não foi possível salvar.', 'bad'); }
}
const getPart = tk => id => db.doc(`admissoes/${tk}/p/${id}`).get().then(s => s.exists ? s.data().d : null);
async function ver(a, slot, arq) {
  const w = window.open('', '_blank'); if (w) w.document.write('<p style="font:16px system-ui;padding:20px">Abrindo…</p>');
  try { const blob = await ADM.ler(arq, slot, getPart(a.id)); const url = URL.createObjectURL(blob); if (w && !w.closed) w.location.href = url; else { const dl = await claude.use('downloads'); if (dl) await dl.save({ filename: arq.nome, data: blob }); } setTimeout(() => URL.revokeObjectURL(url), 120000); }
  catch (er) { if (w) w.close(); toast(er.message || 'Não foi possível abrir.', 'bad'); }
}
function anexar(a, slot) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,application/pdf';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; toast('Enviando…');
    try { const prep = await ADM.preparar(f); const arq = await ADM.gravar(prep, slot, (id, d) => db.doc(`admissoes/${a.id}/p/${id}`).set({ d }));
      if (slot === 'aso' || slot === 'integ') { const e = JSON.parse(JSON.stringify(etp(a))); e[slot] = Object.assign({}, e[slot]); e[slot].arq = (e[slot].arq || []).concat([arq]); await db.doc('admissoes/' + a.id).update({ etapas: e }); a.etapas = e; }
      else { const cand = JSON.parse(JSON.stringify(a.cand || { dados: {}, docs: {} })); cand.docs = cand.docs || {}; cand.docs[slot] = (cand.docs[slot] || []).concat([arq]); await db.doc('admissoes/' + a.id).update({ cand }); a.cand = cand; }
      toast(prep.q.ok ? 'Anexado.' : 'Anexado, mas a foto parece com problema: ' + prep.q.prob[0], prep.q.ok ? 'ok' : 'bad'); detalhe(a.id);
    } catch (er) { toast(er.message || 'Não foi possível anexar.', 'bad'); } };
  i.click();
}
/* treinamentos do candidato: progresso no portal do aluno, liberar mais cursos e nova senha */
async function treinBox(a, ro) {
  const box = $('#m-trein'); if (!box) return; const tr = a.trein || { cursos: [] };
  const linhas = await Promise.all((tr.cursos || []).map(async c => { const cu = D.cursos.find(x => x.id === c.id) || {}; let m = null; try { const s = await db.doc(`matriculas/${c.id}_${a.funcionarioId}`).get(); m = s.exists ? s.data() : null; } catch (er) {}
    const nm = (cu.mods || []).length; const ok = m ? Object.values(m.prog || {}).filter(p => p && p.ok).length : 0;
    const st = !m ? '<span class="badge b-mut">—</span>' : m.concluidoEm ? (cu.pratica && !m.praticaOk ? `<span class="badge b-warn">Teoria ok · falta prática</span>` : `<span class="badge b-ok">Concluído ${fmtD(m.concluidoEm)}</span>`) : ok || m.tempo ? `<span class="badge b-info">${nm ? Math.round(ok / nm * 100) : 0}% · ${Math.round((m.tempo || 0) / 60)} min</span>` : '<span class="badge b-mut">Não começou</span>';
    return { c, m, cu, st, fim: m && m.concluidoEm && !(cu.pratica && !m.praticaOk) ? str(m.praticaEm || m.concluidoEm).slice(0, 10) : '' }; }));
  if (!$('#m-trein')) return;
  const alunoUrl = new URL('../aluno/', location.href).href;
  const certs = linhas.filter(l => l.m && l.m.certId).map(l => l.m.certId);
  box.innerHTML = (linhas.length ? linhas.map(l => `<div class="bt" style="padding:5px 0;border-bottom:1px solid var(--line);gap:8px;align-items:center"><span style="flex:1">${esc(l.c.nome)}</span>${l.st}${l.m && l.m.certId ? `<button class="btn sm ghost" data-cpdf="${esc(l.m.certId)}" type="button">Certificado PDF</button>` : ''}</div>`).join('') + (certs.length > 1 ? `<div class="actions" style="margin-top:6px"><button class="btn sm ghost" id="l-certs" type="button">Todos os certificados (PDF)</button></div>` : '') + (tr.senha ? `<p class="note" style="margin:8px 0 0">Portal do aluno: <b>${esc(alunoUrl)}</b> · login: CPF · senha provisória: <b class="code">${esc(tr.senha)}</b>. Isso também aparece no link do candidato.</p>` : '') : '<p class="note" style="margin:0">Nenhum treinamento liberado ainda.</p>')
    + (ro ? '' : `<details style="margin-top:8px"><summary class="link" style="cursor:pointer">Liberar treinamentos</summary>${cursosPick(new Set(), 'l', (tr.cursos || []).map(c => c.id))}<div class="actions"><button class="btn sm primary" id="l-go">Liberar marcados</button>${tr.senha ? '<button class="btn sm ghost" id="l-senha">Gerar nova senha</button>' : ''}</div></details>`);
  $$('#m-trein [data-cpdf]').forEach(b => b.onclick = () => baixarCerts(a, [b.dataset.cpdf], b)); const lc = $('#l-certs'); if (lc) lc.onclick = () => baixarCerts(a, certs, lc);
  const go = $('#l-go'); if (go) go.onclick = async () => { const ids = $$('.l-cur').filter(c => c.checked).map(c => c.dataset.cur); if (!ids.length) return toast('Marque ao menos um curso.', 'bad'); go.disabled = true; go.textContent = 'Liberando…';
    try { await liberarTrein(a, ids); toast('Treinamentos liberados.', 'ok'); SUJO = false; detalhe(a.id); } catch (er) { go.disabled = false; go.textContent = 'Liberar marcados'; toast((er && er.message) || 'Não foi possível liberar.', 'bad'); } };
  const ns = $('#l-senha'); if (ns) { let armed = false; ns.onclick = async () => { if (!armed) { armed = true; ns.textContent = 'Toque de novo: a senha antiga deixa de valer'; return; } try { await liberarTrein(a, [], true); toast('Nova senha gerada.', 'ok'); SUJO = false; detalhe(a.id); } catch (er) { toast((er && er.message) || 'Erro.', 'bad'); } }; }
  /* todos concluídos: marca a etapa sozinho */
  const e = etp(a); if (!ro && linhas.length && linhas.every(l => l.fim) && !(e.trein || {}).concluido) { const ne = JSON.parse(JSON.stringify(e)); ne.trein = Object.assign({}, ne.trein, { concluido: linhas.map(l => l.fim).sort().pop() });
    try { await db.doc('admissoes/' + a.id).update({ etapas: ne }); a.etapas = ne; const tc = $('#e-tc'); if (tc && !tc.value) tc.value = ne.trein.concluido; } catch (er) {} }
}
/* concluir: cria (ou atualiza) o funcionário com os dados do candidato e as datas de ASO e integração */
async function concluir(a) {
  const e = lerEtapas(a); const dias = diasEntre(a.abertoEm, e.integ.realizada || hoje()); const ds = ADM.docsSt(a);
  const avisos = []; if (ds.faltam.length) avisos.push(`faltam documentos: ${ds.faltam.map(s => s.t).join(', ')}`); if (!e.aso.data) avisos.push('ASO sem data'); if (!e.integ.realizada) avisos.push('integração sem data de realização');
  if (dias > PRAZO && !$('#e-j').value.trim()) return toast(`Mobilização com ${dias} dias: preencha a justificativa de atraso antes de concluir.`, 'bad');
  if (!(await salvarEtapas(a, true))) return;
  SUJO = true; /* tela de conclusão aberta: não redesenhar o detalhe por cima */
  const dd = (a.cand || {}).dados || {}; const exist = D.func.find(f => f.id === a.funcionarioId) || D.func.find(f => ADM.dig(f.cpf) === a.cpf); const outro = exist && exist.id !== a.funcionarioId && exist.ativo !== false;
  sheet(`<div class="top"><h2>Concluir admissão</h2><button class="x" id="c-x" aria-label="Voltar">×</button></div>
    <p><b>${esc(a.nome)}</b> · ${esc(a.funcao)} · ${dias} dia(s) de mobilização</p>
    ${avisos.length ? `<div class="demo">Atenção: ${esc(avisos.join('; '))}. Dá para concluir assim mesmo e completar depois.</div>` : ''}
    ${outro ? `<div class="demo">Já existe funcionário com esse CPF (${esc(exist.nome)}, matrícula ${esc(exist.matricula || '—')}). O cadastro dele será atualizado e reativado.</div>` : ''}
    <div class="grid2"><div><label class="req" for="c-mat">Matrícula</label><input id="c-mat" value="${esc(exist && ADM.dig(exist.matricula) !== a.cpf ? exist.matricula || '' : '')}"></div><div><label class="req" for="c-adm">Data de admissão</label><input type="date" id="c-adm" value="${esc(e.integ.realizada || hoje())}"></div></div>
    <p class="note">Vai para o cadastro de funcionários: nome, CPF, função, área e sub-área, unidade, nascimento, tamanhos, contato, trabalho em altura, ASO e integração com as validades. Os documentos continuam guardados nesta admissão.</p>
    <div class="actions"><button class="btn primary big" id="c-go">Concluir e cadastrar</button></div>`);
  $('#c-x').onclick = () => detalhe(a.id);
  $('#c-go').onclick = async () => {
    const mat = $('#c-mat').value.trim(), adm = $('#c-adm').value; if (!mat) return toast('Informe a matrícula.', 'bad'); if (!adm) return toast('Informe a data de admissão.', 'bad');
    if (D.func.some(f => norm(f.matricula) === norm(mat) && (!exist || f.id !== exist.id))) return toast('Essa matrícula já é de outro funcionário.', 'bad');
    const b = $('#c-go'); b.disabled = true;
    const f = { nome: a.nome, matricula: mat, cpf: a.cpf, funcao: a.funcao, area: a.area, areaId: a.areaId, subareaId: a.subareaId || '', subarea: a.subarea || '', subareas: a.subareaId ? [a.subareaId] : [], unidade: a.unidade || '',
      admissao: adm, nascimento: dd.nascimento || '', situacao: 'Trabalhando', tamCamisa: dd.tamCamisa || '', tamRoupa: dd.tamCamisa || '', tamCalca: dd.tamCalca || '', tamCalcado: dd.tamCalcado || '',
      telefone: dd.telefone || a.telefone, email: dd.email || '', altura: !!a.altura, adicional: a.adicional || '', vinculo: a.vinculo || 'CLT', ativo: true, admissaoId: a.id,
      asoData: e.aso.data || '', asoValidade: e.aso.validade || '', integracaoData: e.integ.realizada || '', integracaoValidade: '' };
    try {
      let fid; if (exist) { fid = exist.id; await db.doc('funcionarios/' + fid).update(f); } else { const r = db.collection('funcionarios').doc(); fid = r.id; await r.set(Object.assign({ criadoEm: new Date().toISOString() }, f)); }
      /* a matrícula passa a valer como login do portal do aluno, além do CPF */
      if ((a.trein || {}).senha) { try { const l = await db.doc('login/' + a.cpf).get(); const k = norm(mat).replace(/[^a-z0-9]/g, ''); if (l.exists && k && k !== a.cpf) await db.doc('login/' + k).set(Object.assign({}, l.data(), { funcionarioId: fid })); } catch (er) {} }
      await db.doc('admissoes/' + a.id).update({ status: 'concluido', concluidoEm: new Date().toISOString(), concluidoPor: MEU, funcionarioId: fid, matricula: mat, admissao: adm, mobDias: diasEntre(a.abertoEm, e.integ.realizada || hoje()) });
      toast('Admissão concluída e funcionário cadastrado.', 'ok'); fechar();
    } catch (er) { b.disabled = false; toast('Não foi possível concluir: ' + ((er && er.message) || er), 'bad'); }
  };
}

/* ---------- indicadores de mobilização ---------- */
function rKpi() {
  const ini = V.per === 'all' ? '' : addDays(-+V.per);
  const L = D.adm.filter(a => str(a.abertoEm).slice(0, 10) >= ini);
  const mob = L.filter(a => a.status !== 'cancelado' && fimMob(a)); const dias = mob.map(diasMob).sort((x, y) => x - y);
  const media = dias.length ? dias.reduce((s, x) => s + x, 0) / dias.length : 0; const med = dias.length ? dias[Math.floor(dias.length / 2)] : 0;
  const noPrazo = mob.filter(a => diasMob(a) <= PRAZO).length; const canc = L.filter(a => a.status === 'cancelado').length;
  const fase = (f, t) => { const v = mob.map(a => { const x = f(a), y = t(a); return x && y ? diasEntre(x, y) : null; }).filter(v => v != null && v >= 0); return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1).replace('.', ',') : '—'; };
  const fases = [['Abertura → documentos completos', a => a.abertoEm, a => (a.cand || {}).completoEm], ['Documentos → ASO', a => (a.cand || {}).completoEm, a => (etp(a).aso || {}).data], ['ASO → integração', a => (etp(a).aso || {}).data, a => fimMob(a)], ['Abertura → integração (total)', a => a.abertoEm, a => fimMob(a)]];
  const mot = {}; L.filter(atrasado).forEach(a => { const k = a.justMotivo || (a.justificativa ? 'Outro' : 'Sem justificativa'); mot[k] = (mot[k] || 0) + 1; });
  const porF = {}; mob.forEach(a => { (porF[a.funcao] = porF[a.funcao] || []).push(diasMob(a)); });
  const mx = Math.max(1, ...Object.values(mot));
  $('#body').innerHTML = `<div class="top2"><select id="k-per">${[['90', '90 dias'], ['180', '6 meses'], ['365', '12 meses'], ['all', 'Tudo']].map(([v, t]) => `<option value="${v}" ${V.per === v ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="note">Mobilização = da abertura até a integração realizada. Prazo: ${PRAZO} dias.</span></div>
    <div class="kpis" style="margin-bottom:12px">${kpi('Tempo médio', dias.length ? media.toFixed(1).replace('.', ',') + 'd' : '—', media > PRAZO ? 'bad' : 'ok')}${kpi('Mediana', dias.length ? med + 'd' : '—')}${kpi('No prazo', mob.length ? Math.round(noPrazo / mob.length * 100) + '%' : '—', noPrazo === mob.length ? 'ok' : 'warn', `${noPrazo} de ${mob.length}`)}${kpi('Mobilizados', mob.length)}${kpi('Em andamento', L.filter(a => a.status === 'aberto' && !fimMob(a)).length)}${kpi('Desistências', canc, canc ? 'warn' : '')}</div>
    <div class="rgrid"><div class="card"><p class="ct">Tempo médio por fase (dias)</p>${fases.map(([t, f, g]) => `<div class="bt" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${t}</span><b>${fase(f, g)}</b></div>`).join('')}</div>
      <div class="card"><p class="ct">Motivos de atraso (acima de ${PRAZO} dias)</p>${Object.keys(mot).length ? Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="br"><div class="bt"><span>${esc(k)}</span><b>${v}</b></div><div class="bb"><i style="width:${Math.round(v / mx * 100)}%;background:${k === 'Sem justificativa' ? 'var(--bad)' : '#c98a00'}"></i></div></div>`).join('') : '<div class="empty">Nenhum atraso no período.</div>'}</div></div>
    <div class="card"><p class="ct">Por função</p><div class="tbwrap"><table class="tb"><thead><tr><th>Função</th><th class="n">Mobilizados</th><th class="n">Média (dias)</th><th class="n">Acima de ${PRAZO}d</th></tr></thead><tbody>${Object.keys(porF).length ? Object.entries(porF).sort((a, b) => b[1].length - a[1].length).map(([f, v]) => `<tr><td>${esc(f)}</td><td class="n">${v.length}</td><td class="n">${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1).replace('.', ',')}</td><td class="n">${v.filter(x => x > PRAZO).length}</td></tr>`).join('') : '<tr><td colspan="4" class="t2">Sem mobilizações no período.</td></tr>'}</tbody></table></div></div>
    <div class="card"><p class="ct">Atrasos e justificativas</p><div class="tbwrap"><table class="tb"><thead><tr><th>Candidato</th><th>Função</th><th class="n">Dias</th><th>Motivo</th><th>Detalhe</th></tr></thead><tbody>${L.filter(atrasado).sort((a, b) => diasMob(b) - diasMob(a)).map(a => `<tr data-open="${esc(a.id)}" style="cursor:pointer"><td>${esc(a.nome)}</td><td>${esc(a.funcao)}</td><td class="n">${diasMob(a)}</td><td>${esc(a.justMotivo || '')}${precisaJust(a) ? '<span class="badge b-bad">Falta justificar</span>' : ''}</td><td>${esc(a.justificativa || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="t2">Nenhum.</td></tr>'}</tbody></table></div></div>`;
  $('#k-per').onchange = e => { V.per = e.target.value; render(); };
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const tp = e.target.closest('[data-taprov]'); if (tp) { e.stopPropagation(); telaAprov(tp.dataset.taprov); return; }
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const o = e.target.closest('[data-open]'); if (o) { detalhe(o.dataset.open); return; }
  const a = D.adm.find(x => x.id === ABERTO); if (!a) { if (e.target.id === 'modal') fechar(); return; }
  const v = e.target.closest('[data-ver]'); if (v) { const [s, i] = v.dataset.ver.split('|'); ver(a, s, a.cand.docs[s][+i]); return; }
  const va = e.target.closest('[data-veraso]'); if (va) { ver(a, 'aso', etp(a).aso.arq[+va.dataset.veraso]); return; }
  const vi = e.target.closest('[data-verinteg]'); if (vi) { ver(a, 'integ', etp(a).integ.arq[+vi.dataset.verinteg]); return; }
  const ok = e.target.closest('[data-ok]'); if (ok) { revisar(a, ok.dataset.ok, 'ok'); return; }
  const rj = e.target.closest('[data-rej]'); if (rj) { const s = rj.dataset.rej; const box = rj.closest('.main');
    if (!box.querySelector('.rejbox')) { box.insertAdjacentHTML('beforeend', `<div class="omrow rejbox" style="display:flex;gap:6px;margin-top:6px"><input placeholder="Motivo (o candidato vê)" list="rej-m" style="flex:1"><datalist id="rej-m"><option value="Foto ilegível, tire de novo com mais luz"><option value="Documento cortado: precisa aparecer inteiro"><option value="Falta o verso"><option value="Documento errado"><option value="Comprovante com mais de 3 meses"></datalist><button class="btn sm danger" data-rejok="${s}">Recusar</button></div>`); box.querySelector('.rejbox input').focus(); }
    return; }
  const rk = e.target.closest('[data-rejok]'); if (rk) { const m = rk.parentElement.querySelector('input').value.trim(); if (!m) return toast('Escreva o motivo.', 'bad'); revisar(a, rk.dataset.rejok, 'rej', m); return; }
  const ax = e.target.closest('[data-anx]'); if (ax) { anexar(a, ax.dataset.anx); return; }
  if (e.target.id === 'modal') fechar();
});

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; PODE = ['admin', 'gestao', 'rh'].includes(F.papel); MEU = F.nome || '';
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; D.emp = e; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; }
    /* nome da empresa visível na página do candidato (que não faz login) */
    if (PODE && e.nome) db.doc('config/publico').get().then(p => { if (!p.exists || p.data().nome !== e.nome) db.doc('config/publico').set({ nome: e.nome }).catch(() => {}); }, () => {}); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  ouvir(); render();
})();
