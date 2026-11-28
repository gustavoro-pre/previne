/* Carteirinhas: etiqueta de bloqueio (modelo da pasta "9. ETIQUETA DE BLOQUEIO": frente e verso para dobrar) e CRC da ArcelorMittal
   (a Previne não emite a CRC: só guarda a imagem de cada funcionário e imprime várias numa folha, no tamanho de cartão).
   Dados: cart/{funcionarioId} = { foto, matTag, funcaoTag, crc: { frente, verso, numero, validade } }, cart_cfg/geral = { telefone }. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toISOString().slice(0, 10);
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };

const D = { func: [], cart: {}, tel: '(24) 98855-7273', logo: '' };
const V = { tab: 'etq', busca: '', sel: new Set(), copias: 2 };
let db = null, PODE = false;
const ativos = () => D.func.filter(f => f.ativo !== false && f.situacao !== 'Em admissão').sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
const C = id => D.cart[id] || {};
const matTag = f => C(f.id).matTag || str(f.pn || f.matriculaAM || f.matricula);
const funcaoTag = f => C(f.id).funcaoTag || str(f.funcao);
const nomeTag = f => str(f.nome).toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\s(D[aeo]s?|E)\s/g, m => m.toLowerCase());

/* ---------- imagens ---------- */
function reduzir(file, max, q) {
  return new Promise((ok, err) => { const fr = new FileReader(); fr.onerror = err; fr.onload = () => { const im = new Image(); im.onerror = err; im.onload = () => {
    const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q || 0.85)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}
const carregarImg = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });

/* ---------- etiqueta: desenho em canvas (1 mm = 12 px) ---------- */
const PX = 12, FW = 90, FH = 135; // face de 90 x 135 mm; etiqueta = verso (em cima, de cabeça para baixo) + frente
const AZ = '#2f5597';
function contorno(x, cantosEmCima) {
  const w = FW * PX, h = FH * PX, c = 12 * PX, m = 3;
  x.beginPath();
  if (cantosEmCima) { x.moveTo(c, m); x.lineTo(w - c, m); x.lineTo(w - m, c); x.lineTo(w - m, h - m - 20); x.quadraticCurveTo(w - m, h - m, w - m - 20, h - m); x.lineTo(m + 20, h - m); x.quadraticCurveTo(m, h - m, m, h - m - 20); x.lineTo(m, c); x.closePath(); }
  x.lineWidth = 6; x.strokeStyle = AZ; x.stroke();
}
function caixaAtencao(x, y) {
  const w = FW * PX, bw = 78 * PX, bh = 17 * PX, bx = (w - bw) / 2;
  x.fillStyle = '#000'; x.beginPath(); x.roundRect ? x.roundRect(bx, y, bw, bh, 30) : x.rect(bx, y, bw, bh); x.fill();
  x.fillStyle = '#e10600'; x.beginPath(); x.ellipse(w / 2, y + bh / 2, bw / 2 - 30, bh / 2 - 24, 0, 0, Math.PI * 2); x.fill();
  x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
  x.fillStyle = '#fff'; x.font = `bold ${10 * PX}px "Times New Roman", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ATENÇÃO', w / 2, y + bh / 2 + 6);
  return y + bh;
}
async function logo(x, y) { if (!D.logo) return y; try { const im = await carregarImg(D.logo); const h = 13 * PX, w = h * im.width / im.height; x.drawImage(im, (FW * PX - w) / 2, y, w, h); return y + h; } catch (e) { return y; } }
function textoCentro(x, t, y, tam, fonte) { x.fillStyle = '#000'; x.font = fonte || `900 ${tam * PX}px "Arial Black", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText(t, FW * PX / 2, y); }
async function frente(f) {
  const cv = document.createElement('canvas'); cv.width = FW * PX; cv.height = FH * PX; const x = cv.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); contorno(x, true);
  let y = await logo(x, 5 * PX); y = caixaAtencao(x, y + 4 * PX) + 9 * PX;
  textoCentro(x, 'ESTE DISPOSITIVO SOMENTE', y, 0, `bold ${4.3 * PX}px Arial, sans-serif`); textoCentro(x, 'PODERÁ SER LIGADO POR:', y + 5.5 * PX, 0, `bold ${4.3 * PX}px Arial, sans-serif`);
  y += 9 * PX; const pw = 30 * PX, ph = 38 * PX;
  const foto = C(f.id).foto;
  if (foto) { try { const im = await carregarImg(foto); const k = Math.max(pw / im.width, ph / im.height); const sw = pw / k, sh = ph / k; x.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, (FW * PX - pw) / 2, y, pw, ph); } catch (e) {} }
  else { x.strokeStyle = '#999'; x.lineWidth = 3; x.strokeRect((FW * PX - pw) / 2, y, pw, ph); x.fillStyle = '#999'; x.font = `${3.5 * PX}px Arial`; x.textAlign = 'center'; x.fillText('FOTO', FW * PX / 2, y + ph / 2); }
  y += ph + 7 * PX;
  const linhas = [['Nome:', nomeTag(f)], ['Matrícula:', matTag(f)], ['Função:', funcaoTag(f)], ['Empresa:', 'PREVINE'], ['Telefone:', D.tel]];
  x.textAlign = 'left'; const lx = 11 * PX;
  for (const [k, v] of linhas) {
    x.font = `bold ${3.6 * PX}px "Times New Roman", serif`; x.fillStyle = '#000'; x.fillText(k, lx, y); const kw = x.measureText(k + ' ').width;
    x.font = `${3.6 * PX}px "Times New Roman", serif`; let t = v; while (x.measureText(t).width > FW * PX - lx - kw - 6 * PX && t.length > 3) t = t.slice(0, -2);
    x.fillText(t === v ? v : t + '…', lx + kw, y); y += 4.6 * PX;
  }
  textoCentro(x, 'VIDE VERSO', FH * PX - 6 * PX, 8.2);
  return cv;
}
async function verso() {
  const cv = document.createElement('canvas'); cv.width = FW * PX; cv.height = FH * PX; const x = cv.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); contorno(x, true);
  let y = await logo(x, 5 * PX); y = caixaAtencao(x, y + 4 * PX);
  textoCentro(x, 'EQUIPAMENTO', y + 30 * PX, 11.5); textoCentro(x, 'BLOQUEADO', y + 46 * PX, 13);
  textoCentro(x, 'VIDE VERSO', FH * PX - 6 * PX, 8.2);
  // de cabeça para baixo (a etiqueta é dobrada ao meio)
  const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height; const rx = r.getContext('2d'); rx.translate(r.width, r.height); rx.rotate(Math.PI); rx.drawImage(cv, 0, 0);
  return r;
}
async function pdfEtiquetas(lista, copias) {
  if (!window.jspdf) return toast('Carregando o gerador de PDF… tente de novo em alguns segundos.', 'bad');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const vs = await verso(); const vsImg = vs.toDataURL('image/jpeg', 0.9);
  const itens = []; lista.forEach(f => { for (let i = 0; i < copias; i++) itens.push(f); });
  for (let i = 0; i < itens.length; i++) {
    if (i && i % 2 === 0) doc.addPage(); const col = i % 2, x0 = col ? 112 : 8, y0 = (297 - 2 * FH) / 2;
    const fr = await frente(itens[i]);
    doc.addImage(vsImg, 'JPEG', x0, y0, FW, FH); doc.addImage(fr.toDataURL('image/jpeg', 0.92), 'JPEG', x0, y0 + FH, FW, FH);
    doc.setDrawColor(170); doc.setLineDashPattern([1.5, 1.5], 0); doc.line(x0 - 3, y0 + FH, x0 + FW + 3, y0 + FH); doc.setLineDashPattern([], 0);
  }
  doc.setFontSize(7); doc.setTextColor(120);
  doc.save('Etiquetas de bloqueio ' + hoje() + '.pdf');
}

/* ---------- CRC: cartões de 85,6 x 54 mm numa A4 ---------- */
async function pdfCrc(lista) {
  if (!window.jspdf) return toast('Carregando o gerador de PDF… tente de novo em alguns segundos.', 'bad');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const W = 85.6, H = 54, gx = 6, gy = 4, x0 = (210 - 2 * W - gx) / 2, y0 = 12;
  const cards = []; lista.forEach(f => { const c = C(f.id).crc || {}; if (c.frente) cards.push(c.frente); if (c.verso) cards.push(c.verso); });
  if (!cards.length) return toast('Nenhuma das pessoas selecionadas tem a CRC guardada.', 'bad');
  cards.forEach((img, i) => {
    const k = i % 10; if (i && k === 0) doc.addPage(); const col = k % 2, row = Math.floor(k / 2);
    const x = x0 + col * (W + gx), y = y0 + row * (H + gy);
    doc.addImage(img, 'JPEG', x, y, W, H); doc.setDrawColor(180); doc.setLineWidth(0.1); doc.rect(x, y, W, H);
  });
  doc.save('CRC ' + hoje() + '.pdf');
}

/* ---------- tela ---------- */
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const ae = document.activeElement; if (ae && ae.id === 'busca') { /* mantém o foco */ }
  let L = ativos(); if (V.busca) { const q = norm(V.busca); L = L.filter(f => norm(f.nome).includes(q) || str(f.matricula).includes(q) || norm(f.funcao).includes(q)); }
  const etq = V.tab === 'etq';
  const linha = f => { const c = C(f.id); const crc = c.crc || {}; const venc = crc.validade && crc.validade < hoje();
    return `<label class="item" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
      <input type="checkbox" data-sel="${esc(f.id)}" ${V.sel.has(f.id) ? 'checked' : ''}>
      ${etq ? (c.foto ? `<img src="${c.foto}" style="width:34px;height:44px;object-fit:cover;border-radius:4px">` : '<span style="width:34px;height:44px;border:1px dashed #bbb;border-radius:4px;display:inline-block"></span>')
        : (crc.frente ? `<img src="${crc.frente}" style="width:60px;height:38px;object-fit:cover;border-radius:4px">` : '<span style="width:60px;height:38px;border:1px dashed #bbb;border-radius:4px;display:inline-block"></span>')}
      <span style="flex:1;min-width:0"><b>${esc(f.nome)}</b><br><span class="cs" style="font-size:12px;color:var(--muted)">${etq ? `Matrícula ${esc(matTag(f) || '—')} · ${esc(funcaoTag(f) || '—')}${c.foto ? '' : ' · <span style="color:var(--bad)">sem foto</span>'}`
        : crc.frente ? `CRC${crc.numero ? ' nº ' + esc(crc.numero) : ''}${crc.validade ? ' · validade ' + fmtD(crc.validade) : ''}${venc ? ' · <b style="color:var(--bad)">vencida</b>' : ''}${crc.verso ? ' · frente e verso' : ''}` : '<span style="color:var(--bad)">sem CRC guardada</span>'}</span></span>
      ${PODE ? `<button class="btn sm ghost" data-edit="${esc(f.id)}" type="button">${etq ? 'Foto e dados' : 'Guardar CRC'}</button>` : ''}</label>`; };
  const nSel = [...V.sel].filter(id => L.some(f => f.id === id)).length;
  $('#body').innerHTML = `<div class="card"><div class="ct">${etq ? 'Etiqueta de bloqueio' : 'CRC da ArcelorMittal'}</div>
    <p class="cs">${etq ? `No modelo da Previne: verso "EQUIPAMENTO BLOQUEADO" em cima e frente com foto e dados embaixo, para dobrar. Duas por folha A4. Telefone: ${esc(D.tel)}${PODE ? ' <button class="btn sm ghost" data-tel type="button">alterar</button>' : ''}.`
      : 'A CRC é emitida pela ArcelorMittal: aqui só se guarda a imagem de cada funcionário (frente e verso) e se imprimem várias numa folha A4, no tamanho de cartão (85,6 × 54 mm).'}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="busca" placeholder="Buscar nome, matrícula ou função" value="${esc(V.busca)}" style="flex:1;min-width:180px;padding:9px;border:1px solid #cfd4dc;border-radius:8px">
      <button class="btn sm ghost" data-todos type="button">${nSel && nSel === L.length ? 'Desmarcar todos' : 'Marcar todos'}</button>
      ${etq ? `<label style="font-size:13px">Cópias por pessoa <input id="copias" type="number" min="1" max="6" value="${V.copias}" style="width:54px;padding:6px;border:1px solid #cfd4dc;border-radius:8px"></label>` : ''}
      <button class="btn sm primary" data-pdf type="button" ${nSel ? '' : 'disabled'}>Gerar PDF (${nSel})</button>
    </div></div>
    <div class="card">${L.length ? L.map(linha).join('') : '<p class="cs">Nenhum funcionário ativo encontrado.</p>'}</div>`;
}

function editar(fid) {
  const f = D.func.find(x => x.id === fid); if (!f) return; const c = C(fid); const crc = c.crc || {};
  const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 8px';
  if (V.tab === 'etq') {
    sheet(`<div class="top"><h2>${esc(f.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap"><div><div id="ed-fv" style="width:120px;height:160px;border:1px dashed #bbb;border-radius:8px;background:#fff center/cover no-repeat ${c.foto ? `url(${c.foto})` : ''}"></div>
      <input type="file" id="ed-foto" accept="image/*" capture="user" style="margin-top:6px;max-width:200px"></div>
      <div style="flex:1;min-width:200px"><label>Matrícula na etiqueta</label><input id="ed-mat" value="${esc(matTag(f))}" style="${inp}">
      <label>Função na etiqueta</label><input id="ed-fun" value="${esc(funcaoTag(f))}" style="${inp}"><p class="cs">Mudar aqui só muda a etiqueta, não o cadastro do funcionário.</p></div></div>
      <button class="btn big primary" id="ed-ok" type="button">Salvar</button>`);
    let foto = c.foto || '';
    $('#ed-foto').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; foto = await reduzir(fl, 520, 0.85); $('#ed-fv').style.backgroundImage = `url(${foto})`; };
    $('#ed-ok').onclick = async () => { try { await db.doc('cart/' + fid).set({ foto, matTag: $('#ed-mat').value.trim(), funcaoTag: $('#ed-fun').value.trim(), atualizadoEm: new Date().toISOString() }, { merge: true }); toast('Salvo.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
  } else {
    sheet(`<div class="top"><h2>CRC · ${esc(f.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
      <label>Frente (foto ou imagem escaneada)</label><input type="file" id="cr-f" accept="image/*" style="${inp}"><img id="cr-fv" src="${crc.frente || ''}" style="max-width:100%;${crc.frente ? '' : 'display:none'}">
      <label>Verso (opcional)</label><input type="file" id="cr-v" accept="image/*" style="${inp}"><img id="cr-vv" src="${crc.verso || ''}" style="max-width:100%;${crc.verso ? '' : 'display:none'}">
      <div style="display:flex;gap:10px"><div style="flex:1"><label>Número</label><input id="cr-n" value="${esc(crc.numero || '')}" style="${inp}"></div><div style="flex:1"><label>Validade</label><input id="cr-val" type="date" value="${esc(crc.validade || '')}" style="${inp}"></div></div>
      <button class="btn big primary" id="cr-ok" type="button">Salvar</button>`);
    const novo = { frente: crc.frente || '', verso: crc.verso || '' };
    const pega = (id, k, prev) => $(id).onchange = async e => { const fl = e.target.files[0]; if (!fl) return; novo[k] = await reduzir(fl, 1000, 0.85); const im = $(prev); im.src = novo[k]; im.style.display = ''; };
    pega('#cr-f', 'frente', '#cr-fv'); pega('#cr-v', 'verso', '#cr-vv');
    $('#cr-ok').onclick = async () => { try { await db.doc('cart/' + fid).set({ crc: { frente: novo.frente, verso: novo.verso, numero: $('#cr-n').value.trim(), validade: $('#cr-val').value }, atualizadoEm: new Date().toISOString() }, { merge: true }); toast('CRC guardada.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (a imagem pode estar grande demais).', 'bad'); } };
  }
  $('#m-x').onclick = fechar;
}

document.addEventListener('click', async e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { e.preventDefault(); editar(ed.dataset.edit); return; }
  if (e.target.closest('[data-todos]')) { let L = ativos(); if (V.busca) { const q = norm(V.busca); L = L.filter(f => norm(f.nome).includes(q) || str(f.matricula).includes(q) || norm(f.funcao).includes(q)); }
    const todos = L.every(f => V.sel.has(f.id)); L.forEach(f => todos ? V.sel.delete(f.id) : V.sel.add(f.id)); render(); return; }
  if (e.target.closest('[data-tel]')) { const v = prompt('Telefone que sai na etiqueta de bloqueio:', D.tel); if (v && v.trim()) { try { await db.doc('cart_cfg/geral').set({ telefone: v.trim() }, { merge: true }); D.tel = v.trim(); render(); } catch (er) { toast('Não foi possível salvar.', 'bad'); } } return; }
  const pd = e.target.closest('[data-pdf]'); if (pd) { const L = ativos().filter(f => V.sel.has(f.id)); pd.disabled = true; pd.textContent = 'Gerando…';
    try { V.tab === 'etq' ? await pdfEtiquetas(L, Math.max(1, Math.min(6, +V.copias || 2))) : await pdfCrc(L); } catch (er) { console.error(er); toast('Não foi possível gerar o PDF.', 'bad'); }
    render(); return; }
  if (e.target.id === 'modal') fechar();
});
document.addEventListener('change', e => {
  const s = e.target.closest('[data-sel]'); if (s) { s.checked ? V.sel.add(s.dataset.sel) : V.sel.delete(s.dataset.sel); render(); return; }
  if (e.target.id === 'copias') V.copias = +e.target.value || 2;
});
let tb; document.addEventListener('input', e => { if (e.target.id === 'busca') { clearTimeout(tb); tb = setTimeout(() => { V.busca = e.target.value; render(); const i = $('#busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } });

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; PODE = ['admin', 'gerente', 'gestao', 'tst', 'rh', 'almox'].includes(F.papel);
  D.logo = (window.LOGO_PADRAO || {}).logo || '';
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { D.logo = e.logo; const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; } }, () => {});
  db.doc('cart_cfg/geral').onSnapshot(s => { if (s.exists && s.data().telefone) { D.tel = s.data().telefone; render(); } }, () => {});
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão para ver os funcionários.', 'bad'));
  db.collection('cart').onSnapshot(s => { D.cart = {}; s.docs.forEach(d => D.cart[d.id] = d.data()); render(); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  render();
})();
