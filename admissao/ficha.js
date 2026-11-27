/* PREVINE · Admissão: ficha cadastral no modelo dos documentos da empresa (PDF com cabeçalho, código de controle,
   revisão e rodapé) e conferência dos dados digitados pelo candidato com os documentos anexados.
   A conferência lê os documentos (texto do PDF ou leitura da imagem por OCR, no próprio navegador), compara cada campo
   e o RH confirma campo a campo. A ficha mostra quem conferiu e quando; sem conferência, sai com o aviso "NÃO CONFERIDA". */
const FC_MODELO = ['fichacad', 'Ficha cadastral de admissão', 'FOR-RH-001'];
const FC_AZUL = [31, 58, 138];
const fcN = v => str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const fcDig = v => str(v).replace(/\D/g, '');
const FC_ESC = ['ESCOLARIDADE'];
/* campos conferidos: k (chave), t (rótulo), v(a) valor, docs (onde procurar), tipo de comparação */
const FC_CAMPOS = [
  { k: 'nome', t: 'Nome completo', v: a => a.nome, docs: ['rg', 'certidao', 'ctps', 'cpf'], tipo: 'nome' },
  { k: 'cpf', t: 'CPF', v: a => ADM.fmtCpf(a.cpf), docs: ['cpf', 'rg', 'ctps'], tipo: 'cpf' },
  { k: 'nascimento', t: 'Data de nascimento', v: (a, d) => d.nascimento ? fmtD(d.nascimento) : '', docs: ['rg', 'certidao', 'ctps', 'cpf'], tipo: 'data', ed: 'date' },
  { k: 'mae', t: 'Nome da mãe', v: (a, d) => d.mae, docs: ['rg', 'certidao', 'ctps'], tipo: 'nome', ed: 'text' },
  { k: 'pai', t: 'Nome do pai', v: (a, d) => d.pai, docs: ['rg', 'certidao', 'ctps'], tipo: 'nome', ed: 'text' },
  { k: 'rgNum', t: 'RG: número', v: (a, d) => d.rgNum, docs: ['rg'], tipo: 'num', ed: 'text' },
  { k: 'tituloNum', t: 'Título de eleitor', v: (a, d) => d.tituloNum, docs: ['titulo'], tipo: 'num', ed: 'text' },
  { k: 'reservistaNum', t: 'Reservista', v: (a, d) => d.reservistaNum, docs: ['reservista'], tipo: 'num', ed: 'text' },
  { k: 'cnhNum', t: 'CNH: número', v: (a, d) => d.cnhNum, docs: ['rg'], tipo: 'num', ed: 'text' },
  { k: 'naturalidade', t: 'Naturalidade', v: (a, d) => d.naturalidade, docs: ['rg', 'certidao'], tipo: 'nome', ed: 'text' },
  { k: 'pis', t: 'PIS / NIS', v: (a, d) => d.pis, docs: ['ctps', 'pis'], tipo: 'pis', ed: 'text' },
  { k: 'rua', t: 'Endereço (rua e número)', v: (a, d) => [d.rua, d.numero].filter(Boolean).join(', '), docs: ['residencia'], tipo: 'end' },
  { k: 'bairro', t: 'Bairro', v: (a, d) => d.bairro, docs: ['residencia'], tipo: 'nome', ed: 'text' },
  { k: 'cidade', t: 'Cidade', v: (a, d) => d.cidade, docs: ['residencia'], tipo: 'nome', ed: 'text' },
  { k: 'cep', t: 'CEP', v: (a, d) => d.cep, docs: ['residencia'], tipo: 'cep', ed: 'text' },
  { k: 'escolaridade', t: 'Escolaridade', v: (a, d) => d.escolaridade, docs: ['escolaridade'], tipo: 'manual' }
];
const fcValor = (a, c) => str(c.v(a, ((a.cand || {}).dados) || {})).trim();
/* conferência vale enquanto os valores forem os mesmos que o RH conferiu */
function fcEstado(a) {
  const cf = a.conf || {}; const camp = cf.campos || {}; const L = FC_CAMPOS.filter(c => fcValor(a, c));
  const ok = L.filter(c => camp[c.k] && camp[c.k].ok && camp[c.k].v === fcValor(a, c));
  return { total: L.length, ok: ok.length, completo: L.length > 0 && ok.length === L.length, por: cf.por, em: cf.em, campos: camp };
}

/* ---------- leitura dos documentos ---------- */
let FC_TESS = null;
const fcLoad = (src, ok) => new Promise((res, rej) => { if (ok()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => ok() ? res() : rej(new Error('lib')); s.onerror = () => rej(new Error('Sem internet para carregar o leitor de documentos.')); document.head.appendChild(s); });
async function fcPdfjs() { await fcLoad('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', () => window.pdfjsLib); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; return window.pdfjsLib; }
async function fcOcr(img) {
  await fcLoad('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', () => window.Tesseract);
  const o = Object.assign({ workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1', langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por@1.0.0/4.0.0_best_int' }, window.FC_TESS_OPT || {});
  const lim = (pr, ms, msg) => Promise.race([pr, new Promise((_, rj) => setTimeout(() => rj(new Error(msg)), ms))]);
  if (!FC_TESS) FC_TESS = lim(Tesseract.createWorker('por', 1, o), 120000, 'O leitor de documentos não carregou (internet lenta?). Tente de novo.').catch(e => { FC_TESS = null; throw e; });
  const w = await FC_TESS; const r = await lim(w.recognize(img), 90000, 'A leitura de um documento demorou demais.'); return r.data.text || '';
}
async function fcTexto(blob, tipo) {
  if (/pdf/.test(tipo) || /pdf/.test(blob.type)) {
    const lib = await fcPdfjs(); const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise; let t = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) { const pg = await pdf.getPage(p); const tc = await pg.getTextContent(); const tx = tc.items.map(i => i.str).join(' ');
      if (tx.replace(/\s/g, '').length > 40) { t += ' ' + tx; continue; }
      const vp = pg.getViewport({ scale: 2 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; t += ' ' + await fcOcr(cv); }
    return t;
  }
  return fcOcr(blob);
}
const fcLev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; } return m[a.length][b.length]; };
const FC_LIG = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E']);
/* compara um valor com o texto lido: 'ok' (achou igual), 'parcial' (achou parecido), 'nao' */
function fcComparar(c, val, txt) {
  const T = fcN(txt), dg = fcDig(txt);
  if (c.tipo === 'cpf') { const v = fcDig(val); return v.length === 11 && (txt.match(/\d{3}\D{0,2}\d{3}\D{0,2}\d{3}\D{0,2}\d{2}/g) || []).some(x => fcDig(x) === v) ? 'ok' : dg.includes(v) ? 'ok' : 'nao'; }
  if (c.tipo === 'pis') { const v = fcDig(val); return v.length >= 10 && (txt.match(/\d{3}\D{0,2}\d{4,5}\D{0,2}\d{2}\D{0,2}\d/g) || []).some(x => fcDig(x) === v) ? 'ok' : 'nao'; }
  if (c.tipo === 'num') { const v = fcDig(val); if (v.length < 4) return 'nao'; const runs = (txt.match(/[\d][\d.\-\/ ]{2,}[\d]/g) || []).map(fcDig); return runs.some(x => x.includes(v)) ? 'ok' : dg.includes(v) ? 'parcial' : 'nao'; }
  if (c.tipo === 'cep') { const v = fcDig(val); return v.length === 8 && (txt.match(/\d{2}\.?\d{3}\D{0,2}\d{3}/g) || []).some(x => fcDig(x) === v) ? 'ok' : 'nao'; }
  if (c.tipo === 'data') { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(val); if (!m) return 'nao'; const ds = (txt.match(/\d{2}\D{1,3}\d{2}\D{1,3}\d{2,4}/g) || []).map(fcDig);
    return ds.some(x => x === m[1] + m[2] + m[3] || x === m[1] + m[2] + m[3].slice(2)) ? 'ok' : 'nao'; }
  if (c.tipo === 'nome' || c.tipo === 'end') {
    const tk = T.split(' '); const set = new Set(tk); const alvo = fcN(val).split(' ').filter(w => w && !FC_LIG.has(w));
    if (!alvo.length) return 'nao'; let ach = 0, exato = 0;
    alvo.forEach(w => { if (set.has(w)) { ach++; exato++; } else if (/^\d+$/.test(w) ? false : tk.some(x => x.length > 2 && fcLev(w, x) <= (w.length > 5 ? 1 : 0))) ach++; });
    if (exato === alvo.length) return 'ok'; if (ach === alvo.length || ach / alvo.length >= 0.6) return 'parcial'; return 'nao';
  }
  return 'manual';
}
/* lê os documentos de cada tipo uma vez e compara todos os campos */
async function fcLer(a, prog) {
  const docs = (a.cand || {}).docs || {}; const slots = [...new Set(FC_CAMPOS.flatMap(c => c.docs))].filter(s => (docs[s] || []).length);
  const textos = {}; let n = 0; const tot = slots.reduce((s, x) => s + docs[x].length, 0);
  for (const s of slots) { textos[s] = [];
    for (let i = 0; i < docs[s].length; i++) { n++; prog && prog(`Lendo ${(ADM.SLOTS.find(z => z.id === s) || {}).t || s} (${n} de ${tot})…`);
      try { const b = await ADM.ler(docs[s][i], s, getPart(a.id)); textos[s].push(await fcTexto(b, docs[s][i].tipo)); } catch (e) { console.warn('ler', s, e); textos[s].push(''); } } }
  const res = {};
  FC_CAMPOS.forEach(c => { const val = fcValor(a, c); if (!val) return; if (c.tipo === 'manual') { res[c.k] = { r: 'manual' }; return; }
    let melhor = { r: 'nao' }; const ordem = { ok: 3, parcial: 2, nao: 1 };
    c.docs.forEach(s => (textos[s] || []).forEach((t, i) => { const r = fcComparar(c, val, t); if (ordem[r] > ordem[melhor.r]) melhor = { r, s, i }; }));
    if (melhor.r === 'nao') { const onde = c.docs.find(s => (docs[s] || []).length); if (onde) Object.assign(melhor, { s: onde, i: 0 }); else melhor.r = 'semdoc'; }
    res[c.k] = Object.assign(melhor, { v: val }); });
  return res;
}

/* ---------- caixa na tela da admissão ---------- */
const FC_BADGE = { ok: ['b-ok', 'igual ao documento'], parcial: ['b-warn', 'parecido, confira'], nao: ['b-bad', 'não encontrado no documento'], semdoc: ['b-mut', 'sem documento'], manual: ['b-info', 'conferir no olho'] };
function confBox(a, ro) {
  const dd = (a.cand || {}).dados || {}; if (!Object.keys(dd).length) return '';
  const E = fcEstado(a); const auto = (a.conf || {}).auto || {}; const docs = (a.cand || {}).docs || {};
  const linhas = FC_CAMPOS.map(c => { const val = fcValor(a, c); if (!val) return '';
    const au = auto[c.k] && auto[c.k].v === val ? auto[c.k] : null; const cf = E.campos[c.k]; const conf = cf && cf.ok && cf.v === val;
    const bd = au ? FC_BADGE[au.r] : null; const sl = au && au.s ? au.s : c.docs.find(s => (docs[s] || []).length);
    const verBt = sl ? `<button class="btn sm ghost" data-ver="${sl}|${au && au.i != null ? au.i : 0}" type="button">Ver ${esc(((ADM.SLOTS.find(z => z.id === sl) || {}).t || sl).split(' (')[0])}</button>` : '';
    const edit = c.ed && !ro ? `<button class="btn sm ghost" data-fced="${c.k}" type="button">Corrigir</button>` : '';
    return `<tr data-fcrow="${c.k}"><td><b>${esc(c.t)}</b><div class="t2">${esc(val)}</div></td><td>${bd ? `<span class="badge ${bd[0]}">${bd[1]}</span>` : '<span class="note">—</span>'}</td>
      <td style="white-space:nowrap">${verBt}${edit}</td><td style="text-align:center"><input type="checkbox" data-fcok="${c.k}" ${conf ? 'checked' : ''} ${ro} style="width:20px;height:20px" aria-label="Conferido"></td></tr>`; }).join('');
  const st = E.completo ? `<span class="badge b-ok">Conferido por ${esc(E.por || '')} em ${fmtDH(E.em)}</span>` : `<span class="badge b-warn">${E.ok} de ${E.total} campos conferidos</span>`;
  return `<h3>Conferência dos dados com os documentos</h3><div class="card"><p class="note" style="margin:0 0 6px">${st} Compare o que o candidato digitou com o documento anexado. Se tiver erro de digitação, clique em Corrigir. A ficha cadastral mostra quem conferiu.</p>
    <div class="tbwrap"><table class="tb"><thead><tr><th>Campo e valor digitado</th><th>Leitura automática</th><th></th><th style="text-align:center">Conferido${ro ? '' : '<br><label style="font-weight:400;font-size:12px;display:inline-flex;gap:4px;align-items:center"><input type="checkbox" id="fc-todos" style="width:16px;height:16px"> todos</label>'}</th></tr></thead><tbody>${linhas}</tbody></table></div>
    ${ro ? '' : `<div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="btn sm ghost" id="fc-ler" type="button">Ler os documentos e comparar</button><button class="btn sm primary" id="fc-ok" type="button">Salvar conferência</button></div><p class="note" id="fc-st" style="margin:4px 0 0"></p>`}</div>`;
}
function confWire(a) {
  const st = t => { const e = $('#fc-st'); if (e) e.textContent = t; };
  const lb = $('#fc-ler'); if (lb) lb.onclick = async () => { lb.disabled = true; try { const r = await fcLer(a, st); const conf = Object.assign({}, a.conf || {}, { auto: r, autoEm: new Date().toISOString() });
      await db.doc('admissoes/' + a.id).update({ conf }); a.conf = conf; const nOk = Object.values(r).filter(x => x.r === 'ok').length, nAl = Object.values(r).filter(x => x.r === 'nao' || x.r === 'parcial').length;
      toast(`Leitura pronta: ${nOk} campo(s) iguais ao documento${nAl ? ', ' + nAl + ' para olhar com atenção' : ''}.`, nAl ? '' : 'ok'); SUJO = false; detalhe(a.id); } catch (e) { console.error(e); lb.disabled = false; st(''); toast('Não foi possível ler: ' + (e.message || e), 'bad'); } };
  const ob = $('#fc-ok'); if (ob) ob.onclick = async () => { ob.disabled = true;
    const campos = Object.assign({}, (a.conf || {}).campos || {}); $$('#sheet [data-fcok]').forEach(x => { const c = FC_CAMPOS.find(z => z.k === x.dataset.fcok); campos[c.k] = { ok: x.checked, v: fcValor(a, c) }; });
    const conf = Object.assign({}, a.conf || {}, { campos, por: (window.__FB && window.__FB.perfil && window.__FB.perfil.nome) || MEU, em: new Date().toISOString() });
    try { await db.doc('admissoes/' + a.id).update({ conf }); a.conf = conf; const E = fcEstado(a); toast(E.completo ? 'Conferência completa.' : `Salvo: ${E.ok} de ${E.total} campos conferidos.`, 'ok'); SUJO = false; detalhe(a.id); } catch (e) { ob.disabled = false; toast('Não foi possível salvar.', 'bad'); } };
  $$('#sheet [data-fcok]').forEach(x => x.onchange = () => { SUJO = true; });
  const td = $('#fc-todos'); if (td) { const L = $$('#sheet [data-fcok]'); td.checked = L.length && L.every(x => x.checked); td.onchange = () => { L.forEach(x => { x.checked = td.checked; }); SUJO = true; }; }
  $$('#sheet [data-fced]').forEach(b => b.onclick = () => { const c = FC_CAMPOS.find(z => z.k === b.dataset.fced); const dd = (a.cand || {}).dados || {}; const tr = b.closest('tr'); if (tr.querySelector('.fced')) return;
    const atual = c.k === 'nascimento' ? str(dd.nascimento).slice(0, 10) : str(dd[c.k]);
    tr.querySelector('td').insertAdjacentHTML('beforeend', `<div class="fced" style="display:flex;gap:6px;margin-top:6px"><input type="${c.ed}" value="${esc(atual)}" style="flex:1"><button class="btn sm primary" type="button">Salvar</button></div>`);
    const box = tr.querySelector('.fced'); box.querySelector('button').onclick = async () => { const nv = box.querySelector('input').value.trim(); if (nv === atual) return box.remove();
      const cand = JSON.parse(JSON.stringify(a.cand)); cand.dados[c.k] = nv; const log = (a.correcoes || []).concat([{ campo: c.k, de: atual, para: nv, por: MEU, em: new Date().toISOString() }]);
      try { await db.doc('admissoes/' + a.id).update({ cand, correcoes: log }); a.cand = cand; a.correcoes = log; toast('Corrigido. Confira de novo esse campo.', 'ok'); SUJO = false; detalhe(a.id); } catch (e) { toast('Não foi possível corrigir.', 'bad'); } }; });
}


/* ---------- ficha de registro: campos que o RH completa ou corrige ---------- */
const UFS_ = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const FR_CAND = [['naturalidade', 'Cidade onde nasceu', 'text'], ['ufNasc', 'Estado onde nasceu', UFS_], ['nacionalidade', 'Nacionalidade', ['Brasileira', 'Estrangeira']],
  ['racaCor', 'Raça / cor', ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Prefiro não informar']], ['deficiencia', 'Pessoa com deficiência', ['Não', 'Sim – física', 'Sim – auditiva', 'Sim – visual', 'Sim – intelectual', 'Sim – mais de uma']],
  ['conjuge', 'Nome do cônjuge', 'text'], ['rgNum', 'RG: número', 'text'], ['rgOrgao', 'RG: órgão emissor', 'text'], ['rgUf', 'RG: estado', UFS_], ['rgData', 'RG: data de expedição', 'date'],
  ['tituloNum', 'Título de eleitor: número', 'text'], ['tituloZona', 'Título: zona', 'text'], ['tituloSecao', 'Título: seção', 'text'], ['reservistaNum', 'Reservista: número', 'text'],
  ['cnhNum', 'CNH: número', 'text'], ['cnhCat', 'CNH: categoria', ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE']], ['cnhVal', 'CNH: validade', 'date'], ['pis', 'PIS / NIS', 'text'],
  ['primeiroEmprego', 'Primeiro emprego', ['Não', 'Sim']], ['valeTransporte', 'Vale-transporte', ['Não', 'Sim']], ['agencia', 'Agência', 'text'], ['conta', 'Conta', 'text']];
const FR_RH = [['cbo', 'CBO da função', 'text'], ['jornada', 'Jornada e horário (ex.: 44h semanais, 07:00–17:00 seg–sex)', 'text'], ['experiencia', 'Contrato de experiência', ['45 + 45 dias', '30 + 60 dias', '90 dias', 'Sem experiência (prazo indeterminado)']], ['sindicato', 'Sindicato da categoria', 'text']];
const frInput = (pre, k, t, tp, v, ro) => { const id = pre + k; const lab = `<label for="${id}">${esc(t)}</label>`;
  if (Array.isArray(tp)) return `<div>${lab}<select id="${id}" data-fr="${pre}|${k}" ${ro}><option value="">—</option>${tp.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  return `<div>${lab}<input id="${id}" data-fr="${pre}|${k}" type="${tp}" value="${esc(v)}" ${ro}></div>`; };
function regBox(a, ro) {
  const dd = (a.cand || {}).dados || {}; const rg = a.reg || {};
  const faltam = FR_CAND.filter(([k]) => !str(dd[k]).trim()).length + FR_RH.filter(([k]) => !str(rg[k]).trim()).length;
  return `<details class="etf" ${faltam ? '' : ''}><summary style="cursor:pointer"><b>Completar a ficha de registro</b> <span class="badge ${faltam ? 'b-warn' : 'b-ok'}">${faltam ? faltam + ' campo(s) em branco' : 'completa'}</span></summary>
    <p class="note" style="margin:6px 0">Dados da ficha de registro do empregado. O candidato preenche no link; o que ele não preencheu (ou quem mandou antes destes campos existirem) o RH completa aqui, olhando os documentos.</p>
    <p class="ct" style="margin:8px 0 2px">Do funcionário</p><div class="grid2">${FR_CAND.map(([k, t, tp]) => frInput('fr-c-', k, t, tp, tp === 'date' ? str(dd[k]).slice(0, 10) : str(dd[k]), ro)).join('')}</div>
    <p class="ct" style="margin:10px 0 2px">Do contrato (RH)</p><div class="grid2">${FR_RH.map(([k, t, tp]) => frInput('fr-r-', k, t, tp, str(rg[k] || (k === 'experiencia' ? '' : '')), ro)).join('')}</div>
    ${ro ? '' : '<div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="btn sm primary" id="fr-s" type="button">Salvar ficha de registro</button></div>'}</details>`;
}
function regWire(a) {
  $$('#sheet [data-fr]').forEach(x => x.addEventListener('input', () => { SUJO = true; }));
  const b = $('#fr-s'); if (!b) return; b.onclick = async () => { b.disabled = true;
    const cand = JSON.parse(JSON.stringify(a.cand || { dados: {}, docs: {} })); cand.dados = cand.dados || {}; const reg = Object.assign({}, a.reg || {}); const log = (a.correcoes || []).slice();
    $$('#sheet [data-fr]').forEach(x => { const [pre, k] = x.dataset.fr.split('|'); const v = x.value.trim();
      if (pre === 'fr-c-') { const ant = str(cand.dados[k]); if (v !== ant) { cand.dados[k] = v; log.push({ campo: k, de: ant, para: v, por: MEU, em: new Date().toISOString() }); } } else reg[k] = v; });
    try { await db.doc('admissoes/' + a.id).update({ cand, reg, correcoes: log }); a.cand = cand; a.reg = reg; a.correcoes = log; toast('Ficha de registro salva.', 'ok'); SUJO = false; detalhe(a.id); } catch (e) { b.disabled = false; toast('Não foi possível salvar.', 'bad'); } };
}

/* ---------- ficha cadastral em PDF, no modelo dos documentos ---------- */
async function fcModelo() {
  let m = null; try { const d = await db.doc('config/modelos').get(); m = d.exists ? (d.data() || {})[FC_MODELO[0]] : null; } catch (e) {}
  if (m && m.codigo) return { codigo: m.codigo, rev: String(+m.rev || 0).padStart(2, '0'), data: fmtD(m.data), elab: str(m.elaborador) || '—', aprov: str(m.aprovador) || '—', prov: false };
  return { codigo: FC_MODELO[2], rev: '00', data: '27/11/2026', elab: 'Gustavo Rogel de Almeida', aprov: 'Claudio José de Almeida', prov: true };
}
async function fcLogo() { const lg = window.logoEmp ? window.logoEmp(D.emp) : D.emp || {}; if (/^data:image\/(png|jpeg)/.test(str(lg.logo))) return lg; try { const b = await (await fetch('/logo.png')).blob(); return { logo: await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }), logoW: 240, logoH: 193 }; } catch (e) { return {}; } }
async function fichaPdf(a, o = {}) {
  await loadPDF(); await fcLoad('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', () => window.jspdf && window.jspdf.jsPDF.API.autoTable);
  const M = await fcModelo(); const lg = await fcLogo(); const dd = (a.cand || {}).dados || {}, docs = (a.cand || {}).docs || {}; const dAdm = o.dataAdmissao || a.dataAdmissao || '';
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const W = 210, H = 297, Lm = 12, R = W - 12;
  const emit = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 17);
  const cab = () => { doc.setDrawColor(...FC_AZUL); doc.setLineWidth(0.3); doc.rect(Lm, 8, R - Lm, 24); const bx = R - 60; doc.line(Lm + 30, 8, Lm + 30, 32); doc.line(bx, 8, bx, 32);
    if (lg.logo) try { const h = 19, w = Math.min(26, h * (+lg.logoW || 240) / (+lg.logoH || 193)); doc.addImage(lg.logo, /jpeg/.test(lg.logo.slice(0, 20)) ? 'JPEG' : 'PNG', Lm + 15 - w / 2, 10.5, w, h); } catch (e) {}
    const tw = bx - (Lm + 33) - 2; const end = str((D.emp || {}).endereco) || 'Av. Homero Leite, 198, Saudade, Barra Mansa – RJ';
    doc.setTextColor(...FC_AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(doc.splitTextToSize(empNome(), tw)[0], Lm + 33, 12.8);
    doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.text('CNPJ ' + empCnpj(), Lm + 33, 16.3); doc.text(doc.splitTextToSize(end, tw)[0], Lm + 33, 19.3);
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('FICHA CADASTRAL DE ADMISSÃO', Lm + 33, 25.6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90); doc.text('Área: Recursos Humanos', Lm + 33, 29.8);
    doc.setFontSize(7); doc.setTextColor(20); [['Código', M.codigo], ['Revisão', M.rev + (M.data && M.data !== '—' ? ' · ' + M.data : '')], ['Elaborado por', M.elab], ['Aprovado por', M.aprov], ['Emitido', emit]].forEach(([k, v], i) => { doc.setFont('helvetica', 'bold'); doc.text(k + ':', bx + 2, 12.3 + i * 4.3); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(str(v), 39)[0], bx + 20, 12.3 + i * 4.3); }); };
  cab(); let y = 37;
  /* foto */
  const ft = (docs.foto || [])[0]; let fw = 0;
  if (ft) { try { const b = await ADM.ler(ft, 'foto', getPart(a.id)); const im = await imgB64(b); const h = 40, w = Math.min(32, h * im.w / im.h); doc.addImage('data:image/jpeg;base64,' + im.b64, 'JPEG', R - w, y + 1, w, h); doc.setDrawColor(200); doc.rect(R - w, y + 1, w, h); fw = w + 3; } catch (e) { console.warn('foto', e); } }
  const sec = (tit, linhas, larg) => { const lw = (larg || (R - Lm)); doc.autoTable({ startY: y, margin: { left: Lm, right: W - Lm - lw, top: 37, bottom: 18 }, tableWidth: lw, theme: 'grid',
      head: [[{ content: tit.toUpperCase(), colSpan: 4 }]], body: linhas, rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, overflow: 'linebreak', lineColor: [210, 216, 226], lineWidth: 0.1, valign: 'middle', halign: 'left' },
      headStyles: { fillColor: FC_AZUL, textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [242, 244, 248], cellWidth: lw * 0.2 }, 1: { cellWidth: lw * 0.3 }, 2: { fontStyle: 'bold', fillColor: [242, 244, 248], cellWidth: lw * 0.2 }, 3: { cellWidth: lw * 0.3 } },
      didDrawPage: () => cab() }); y = doc.lastAutoTable.finalY + 3.5; };
  const v = x => str(x).trim() || '—';
  const lin2 = pares => { const L = []; for (let i = 0; i < pares.length; i += 2) { const p = pares[i], q = pares[i + 1]; L.push(q ? [p[0], v(p[1]), q[0], v(q[1])] : [p[0], { content: v(p[1]), colSpan: 3 }]); } return L; };
  const rg = a.reg || {}; const aso = ((a.etapas || {}).aso || {}).data;
  const full = (k, val) => [{ content: k, styles: { fontStyle: 'bold', fillColor: [242, 244, 248] } }, { content: v(val), colSpan: 3 }];
  sec('Identificação', [full('Nome completo', a.nome)].concat(lin2([['CPF', ADM.fmtCpf(a.cpf)], ['Data de nascimento', dd.nascimento ? fmtD(dd.nascimento) : ''], ['Sexo', dd.sexo], ['Estado civil', dd.estadoCivil],
    ['Naturalidade', [dd.naturalidade, dd.ufNasc].filter(Boolean).join(' / ')], ['Nacionalidade', dd.nacionalidade], ['Raça / cor', dd.racaCor], ['Grau de instrução', dd.escolaridade], ['Pessoa com deficiência', dd.deficiencia]])), R - Lm - fw);
  if (y < 37 + 44) y = 37 + 44;
  sec('Filiação e família', [full('Nome completo da mãe', dd.mae), full('Nome completo do pai', dd.pai), full('Cônjuge', dd.conjuge), full('Dependentes (nome, parentesco, nascimento, CPF)', dd.dependentes)]);
  sec('Documentos', lin2([['RG', dd.rgNum], ['Órgão emissor / UF', [dd.rgOrgao, dd.rgUf].filter(Boolean).join(' / ')], ['Expedição do RG', dd.rgData ? fmtD(dd.rgData) : ''], ['CTPS', 'Digital (nº do CPF ' + ADM.fmtCpf(a.cpf) + ')'],
    ['PIS / NIS', dd.pis], ['Primeiro emprego', dd.primeiroEmprego], ['Título de eleitor', dd.tituloNum], ['Zona / seção', [dd.tituloZona, dd.tituloSecao].filter(Boolean).join(' / ')],
    ['Reservista', dd.reservistaNum], ['CNH / categoria', [dd.cnhNum, dd.cnhCat].filter(Boolean).join(' / ')], ['Validade da CNH', dd.cnhVal ? fmtD(dd.cnhVal) : ''], ['Registro profissional', (docs.registro || []).length ? 'anexado' : '']]));
  sec('Endereço e contato', [full('Endereço', [dd.rua, dd.numero, dd.complemento].filter(Boolean).join(', '))].concat(lin2([['Bairro', dd.bairro], ['Cidade / UF', [dd.cidade, dd.uf].filter(Boolean).join(' / ')], ['CEP', dd.cep], ['Celular', dd.telefone || a.telefone], ['E-mail', dd.email], ['Emergência', [dd.emergNome, dd.emergTel].filter(Boolean).join(' · ')]])));
  const ctr = [['Data de admissão', dAdm ? fmtD(dAdm) : ''], ['Cargo / função', a.funcao], ['Vínculo', a.vinculo || 'CLT'], ['Área / setor', [a.area, a.subarea].filter(Boolean).join(' / ')], ['Local de trabalho', a.unidade],
    ['Salário', o.salario != null ? brl(o.salario) : ''], ['Vale-transporte', dd.valeTransporte], ['Trabalho em altura', a.altura ? 'Sim' : 'Não'], ['Adicional', a.adicional], ['ASO admissional', aso ? fmtD(aso) : '']];
  sec('Dados da admissão', lin2(ctr));
  sec('Dados bancários e uniforme', lin2([['Banco', dd.banco], ['Agência / conta', [dd.agencia, dd.conta].filter(Boolean).join(' / ')], ['Chave PIX', dd.pix], ['Camisa / calça / calçado', [dd.tamCamisa, dd.tamCalca, dd.tamCalcado].map(x => x || '—').join(' · ')]]));
  const recebidos = ADM.slotsDe(a).filter(sl => (docs[sl.id] || []).length).map(sl => sl.t.split(' (')[0] + ' (' + docs[sl.id].length + ')').join(' · ');
  sec('Documentos recebidos', [[{ content: recebidos || '—', colSpan: 4, styles: { fontStyle: 'normal', fillColor: false } }]]);
  /* conferência */
  const E = fcEstado(a); const auto = (a.conf || {}).auto || {};
  const cl = FC_CAMPOS.filter(c => fcValor(a, c)).map(c => { const cf = E.campos[c.k]; const ok = cf && cf.ok && cf.v === fcValor(a, c); const au = auto[c.k] && auto[c.k].v === fcValor(a, c) ? (FC_BADGE[auto[c.k].r] || [])[1] : '';
    return [c.t, { content: ok ? 'Conferido' : 'Não conferido', styles: { textColor: ok ? [20, 110, 60] : [180, 40, 40], fontStyle: 'bold' } }, au ? 'Leitura: ' + au : '', ok ? 'Doc.: ' + (c.docs.map(s => ((ADM.SLOTS.find(z => z.id === s) || {}).t || s).split(' (')[0]).slice(0, 2).join(' / ')) : '']; });
  if (y > H - 80) { doc.addPage(); cab(); y = 37; }
  sec(E.completo ? `Conferência com os documentos: conferido por ${E.por || '—'} em ${fmtDH(E.em)}` : 'Conferência com os documentos: NÃO CONFERIDA POR COMPLETO', cl);
    const AP = o.aprov || a.aprovContratacao; y += 4; doc.setDrawColor(...FC_AZUL); doc.setLineWidth(0.3); doc.rect(Lm, y, R - Lm, 19);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...FC_AZUL); doc.text('DE ACORDO DA CONTRATAÇÃO', Lm + 3, y + 5); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(AP ? 20 : 180, AP ? 20 : 40, AP ? 20 : 40); doc.text(AP ? `De acordo: ${AP.por || '—'} · ${fmtDH(AP.em)} · registro eletrônico no portal PREVINE.` : 'Pendente: aguardando o de acordo da contratação no portal.', Lm + 3, y + 10.5);
  doc.setTextColor(E.completo ? 70 : 180, E.completo ? 70 : 40, E.completo ? 70 : 40); doc.text(E.completo ? `Dados conferidos com os documentos por ${E.por || '—'} em ${fmtDH(E.em)}.` : 'Dados ainda não conferidos por completo com os documentos.', Lm + 3, y + 15.5);
  y += 23;
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setDrawColor(...FC_AZUL); doc.setLineWidth(0.3); doc.line(Lm, H - 12, R, H - 12); doc.setFontSize(6.5); doc.setTextColor(90);
    doc.text(`${M.codigo} rev. ${M.rev} · Ficha cadastral de admissão · ${a.nome} · cópia impressa não é controlada`, Lm, H - 8.5); doc.text(`Página ${p} de ${n}`, R, H - 8.5, { align: 'right' }); }
  const blob = doc.output('blob');
  return { nome: ('Ficha cadastral - ' + a.nome + '.pdf').replace(/[\\/:*?"<>|]+/g, ' '), tipo: 'application/pdf', blob };
}
async function baixarFichaPdf(a) { try { toast('Gerando a ficha…'); const f = await fichaPdf(a, { salario: await salarioDe(a) }); await baixar(f.nome, f.blob); } catch (e) { console.error(e); toast('Não foi possível gerar a ficha: ' + (e.message || e), 'bad'); } }

/* ---------- tela do de acordo: abre pela notificação ou pelo e-mail (?aprov=<id do envio>) ---------- */
async function lerArqEnvio(id, fi, tipo) {
  const q = await db.collection('envios_contab/' + id + '/p').where('f', '==', fi).get();
  const b64 = q.docs.map(d => d.data()).sort((x, y) => x.i - y.i).map(x => x.d).join('');
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: tipo || 'application/pdf' });
}
async function telaAprov(envId) {
  const a = D.adm.find(x => (x.envios || []).some(e => e.id === envId)); if (!a) return toast('Pedido não encontrado.', 'bad');
  ABERTO = ''; let ed = {}; try { ed = (await db.doc('envios_contab/' + envId).get()).data() || {}; } catch (e) { return toast('Sem acesso a este pedido.', 'bad'); }
  const pend = ed.status === 'aprovacao';
  sheet(`<div class="top"><h2>De acordo da contratação</h2><button class="x" id="ta-x" aria-label="Fechar">×</button></div>
    <div class="card" style="${pend ? 'border:2px solid #d92d20;background:#fef3f2' : ''}"><b style="font-size:17px">${esc(a.nome)}</b>
      <div class="t2">${esc(a.funcao || '')} · ${esc([a.area, a.subarea].filter(Boolean).join(' / '))}${a.unidade ? ' · ' + esc(a.unidade) : ''}</div>
      <div class="t2">Vínculo ${esc(a.vinculo || 'CLT')} · ${esc(a.adicional || 'adicional não informado')}${a.altura ? ' · trabalho em altura' : ''}</div>
      <div class="t2">Admissão em ${fmtD(ed.dataAdmissao)} · e-mail à contabilidade (${esc(ed.para || '')}) marcado para ${fmtDH(ed.quando)} · ${(ed.arquivos || []).length} anexo(s)</div>
      <div class="t2">Dados conferidos com os documentos: ${fcEstado(a).completo ? 'sim, por ' + esc(fcEstado(a).por || '') : '<b style="color:#b42318">não</b>'}</div>
      <p style="margin:8px 0 0">${pend ? '<span class="badge b-bad">Aguardando de acordo</span>' : `<span class="badge b-ok">${ed.aprovadoPor ? 'De acordo de ' + esc(ed.aprovadoPor) + ' em ' + fmtDH(ed.aprovadoEm) : esc(ed.status || '')}</span>`}</p>
      <div class="actions" style="justify-content:flex-start;margin-top:10px">${pend && podeAprovar() ? '<button class="btn primary" id="ta-ok" type="button">Dar de acordo</button>' : ''}<button class="btn ghost" id="ta-det" type="button">Abrir a admissão</button><button class="btn ghost" id="ta-pdf" type="button">Baixar a ficha</button></div>
      ${pend && !podeAprovar() ? '<p class="note">Só Gustavo ou Josilaine dão o de acordo.</p>' : ''}</div>
    <h3>Ficha cadastral</h3><div id="ta-ficha" class="card" style="padding:6px"><p class="note">Carregando a ficha…</p></div>`);
  $('#ta-x').onclick = () => fechar(); $('#ta-det').onclick = () => detalhe(a.id);
  const ok = $('#ta-ok'); if (ok) ok.onclick = async () => { await aprovarEnvio(a, envId); telaAprov(envId); };
  const fi = (ed.arquivos || []).findIndex(f => /^Ficha cadastral/.test(str(f.nome)));
  let blob = null;
  try { blob = fi >= 0 ? await lerArqEnvio(envId, fi, ed.arquivos[fi].tipo) : (await fichaPdf(a, { dataAdmissao: ed.dataAdmissao })).blob;
    const lib = await fcPdfjs(); const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise; const box = $('#ta-ficha'); if (!box) return; box.innerHTML = '';
    for (let p = 1; p <= pdf.numPages; p++) { const pg = await pdf.getPage(p); const vp = pg.getViewport({ scale: 2 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.cssText = 'width:100%;height:auto;display:block;border:1px solid #e3e7ee;margin:0 0 8px'; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; box.appendChild(cv); }
  } catch (e) { console.error(e); const box = $('#ta-ficha'); if (box) box.innerHTML = '<p class="note">Não foi possível mostrar a ficha. Use “Baixar a ficha”.</p>'; }
  $('#ta-pdf').onclick = async () => { if (!blob) return; await baixar('Ficha cadastral - ' + a.nome + '.pdf', blob); };
}
