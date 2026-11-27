/* Contracheques (recibos de pagamento) — importação dos PDFs da contabilidade e consulta na vida do funcionário.
   Dados sensíveis: coleções contracheques / cc_arq só para Admin, Gestão, Gerente e RH (regra folhaOk).
   Cada PDF importado fica guardado inteiro (em partes) em cc_arq/{id}/p/{i}; cada recibo é um doc em contracheques
   apontando para as páginas dele (p0, np). Ao abrir, o navegador recorta as páginas com pdf-lib. */
const CC_PARTE = 700000;
const CC_TIPO = { folha: 'Folha mensal', complementar: 'Complementar', estagio: 'Bolsa estágio', comunicado: 'Comunicado', digitalizado: 'Via assinada (digitalizada)' };
const ccMeses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ccNum = s => s == null || s === '' ? null : Number(String(s).replace(/\./g, '').replace(',', '.'));
const ccNorm = s => norm(s).replace(/\s+/g, ' ').trim();

async function pdfLibW() {
  if (window.PDFLib) return window.PDFLib;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return window.PDFLib;
}

function ccCard() {
  return `<div class="card"><div class="head" style="margin:0"><p class="ct" style="margin:0;margin-right:auto">Importar contracheques</p><label class="btn sm" style="margin:0;cursor:pointer">Escolher os recibos (PDF)<input type="file" id="cc-file" accept="application/pdf,.pdf,.json" multiple hidden></label></div>
    <p class="note" style="margin:6px 0 0">Use o <b>Recibo de Pagamento</b> do mês (o PDF com o contracheque de todos). Cada recibo vai para a página do funcionário, em <b>Indicadores › Pessoas</b>. Se o mesmo mês for importado de novo com valor diferente, o novo vira o atual e o anterior fica como versão anterior.</p><div id="cc-prev"></div></div>`;
}

/* lê as páginas e devolve os recibos (páginas seguidas do mesmo funcionário viram um recibo) */
async function ccLer(buf, nomeArq) {
  const lib = await pdfLib(); const pdf = await lib.getDocument({ data: buf.slice(0) }).promise; const out = [];
  const compl = /complem|diferen/i.test(nomeArq);
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent(); const L = {};
    tc.items.forEach(t => { const y = Math.round(t.transform[5] / 3); (L[y] = L[y] || []).push({ x: t.transform[4], s: t.str }); });
    const T = Object.keys(L).map(Number).sort((a, b) => b - a).map(y => L[y].sort((a, b) => a.x - b.x).map(o => o.s).join('   ')).filter(l => l.trim()).join('\n');
    const r = { pag: i - 1 }; let m;
    if ((m = T.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})/i))) r.comp = m[2] + '-' + String(ccMeses.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0');
    if ((m = T.match(/Filial\s*\n\s*(\d{1,5})\s{2,}(\S.*?\S)\s{2,}(\d{6})/))) { r.cod = m[1]; r.nome = m[2].trim(); }
    if ((m = T.match(/\n\s*([A-ZÀ-Ú][^\n]*?)\s{2,}Admiss.o:\s+(\d{2}\/\d{2}\/\d{4})/))) { r.cargo = m[1].trim(); r.adm = m[2]; }
    if ((m = T.match(/Valor L\S{1,3}quido[^\n]*\n[^\d\n]*([\d.]+,\d{2})/))) r.liq = ccNum(m[1]);
    if ((m = T.match(/Total de Descontos[^\n]*\n(?:[^\n]*\n){0,3}?[^\n]*?([\d.]+,\d{2})\s+([\d.]+,\d{2})/))) { r.venc = ccNum(m[1]); r.desc = ccNum(m[2]); }
    if (!r.cod && (m = T.match(/Prezad[oa]\(a\)\s+([A-ZÀ-Ú][A-ZÀ-Ú ]+)/))) { r.nome = m[1].trim(); r.tipo = 'comunicado'; if (!r.comp && (m = T.match(/compet.ncia (\d{2})\/(\d{4})/))) r.comp = m[2] + '-' + m[1]; }
    if (!r.tipo) r.tipo = /ESTAGI/i.test(T) && /BOLSA/i.test(T) ? 'estagio' : compl ? 'complementar' : 'folha';
    const p = out[out.length - 1];
    if (p && r.cod && p.cod === r.cod && p.comp === r.comp && p.liq == null && r.tipo !== 'comunicado') { p.np++; ['liq', 'venc', 'desc'].forEach(k => { if (r[k] != null) p[k] = r[k]; }); continue; }
    out.push(Object.assign(r, { p0: i - 1, np: 1 }));
  }
  return out;
}

function ccCasar(x) {
  const c = str(x.cod).replace(/^0+/, ''); let f = c && D.func.find(y => str(y.matricula).trim().replace(/^0+/, '') === c);
  if (!f && x.nome) { const n = ccNorm(x.nome); const L = D.func.filter(y => ccNorm(y.nome) === n); f = L.find(y => y.ativo !== false) || L[0]; }
  if (!f && x.nome) { const n = ccNorm(x.nome); const L = D.func.filter(y => { const m = ccNorm(y.nome); return m.startsWith(n) || n.startsWith(m); }); if (L.length === 1) f = L[0]; }
  return f || null;
}

function ccB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

function ligaCC() {
  const inp = $('#cc-file'); if (!inp) return;
  inp.onchange = async () => {
    const files = [...inp.files]; inp.value = ''; if (!files.length) return; const box = $('#cc-prev'); box.innerHTML = '<p class="note">Lendo os PDFs…</p>';
    let man = []; for (const mf of files.filter(f => /\.json$/i.test(f.name))) { try { const j = JSON.parse(await mf.text()); man = man.concat(Array.isArray(j) ? j : [j]); } catch (e) { } } if (!man.length) man = null;
    const lotes = [];
    try {
      for (const f of files.filter(f => /\.pdf$/i.test(f.name))) {
        const buf = new Uint8Array(await f.arrayBuffer()); const mm = man && man.find(m => m.arquivo === f.name);
        const itens = mm ? mm.itens.map(x => Object.assign({}, x, { origem: x.arq })) : (await ccLer(buf, f.name)).map(x => Object.assign(x, { origem: f.name }));
        itens.forEach(x => { x.f = ccCasar(x); });
        lotes.push({ file: f, buf, itens }); box.innerHTML = `<p class="note">Lidos ${lotes.length} arquivo(s)…</p>`;
      }
    } catch (e) { box.innerHTML = '<p class="note" style="color:var(--bad)">Não foi possível ler: ' + esc(e.message || e) + '</p>'; return; }
    const T = lotes.flatMap(l => l.itens); const sem = T.filter(x => !x.f); const meses = [...new Set(T.map(x => x.comp).filter(Boolean))].sort();
    if (!T.length) { box.innerHTML = '<p class="note" style="color:var(--bad)">Não achei contracheques nesses PDFs.</p>'; return; }
    box.innerHTML = `<div class="card" style="margin:10px 0 0;background:var(--bg2,#f6f7f9)"><dl class="kv">
      <dt>Arquivos</dt><dd>${lotes.length}</dd><dt>Recibos</dt><dd>${T.length} (${meses.map(mesNome).join(', ')})</dd>
      <dt>Ligados ao cadastro</dt><dd>${T.length - sem.length}</dd><dt>Sem cadastro</dt><dd>${sem.length ? sem.length + ': ' + esc([...new Set(sem.map(x => x.nome))].slice(0, 12).join(', ')) + (sem.length > 12 ? '…' : '') : 'nenhum'}</dd></dl>
      <div class="actions" style="justify-content:flex-start;gap:8px"><button class="btn primary" id="cc-ok" type="button">Importar contracheques</button><button class="btn ghost" id="cc-no" type="button">Cancelar</button></div><p class="note" id="cc-st"></p></div>`;
    $('#cc-no').onclick = () => { box.innerHTML = ''; };
    $('#cc-ok').onclick = async () => {
      $('#cc-ok').disabled = true; $('#cc-no').disabled = true; const st = $('#cc-st'); const now = new Date().toISOString(), por = (window.__FB || {}).uid || '';
      try {
        let n = 0;
        for (const l of lotes) {
          const aref = db.collection('cc_arq').doc(); const b64 = ccB64(l.buf); const partes = Math.ceil(b64.length / CC_PARTE);
          for (let i = 0; i < partes; i++) { st.textContent = `Enviando ${l.file.name} (${i + 1}/${partes})…`; await db.doc(`cc_arq/${aref.id}/p/${i}`).set({ i, d: b64.slice(i * CC_PARTE, (i + 1) * CC_PARTE) }); }
          await aref.set({ nome: l.file.name, bytes: l.buf.length, partes, recibos: l.itens.length, em: now, por });
          for (const x of l.itens) {
            const doc = { funcionarioId: x.f ? x.f.id : '', cod: x.cod || '', nome: x.nome || '', cargo: x.cargo || '', comp: x.comp || '', tipo: x.tipo || 'folha', liq: x.liq == null ? null : x.liq, venc: x.venc == null ? null : x.venc, desc: x.desc == null ? null : x.desc, arq: aref.id, origem: x.origem || l.file.name, p0: x.p0, np: x.np || 1, atual: x.atual !== false, em: now, por };
            if (!man && doc.tipo === 'folha' && doc.funcionarioId && doc.comp) {
              const ant = await db.collection('contracheques').where('funcionarioId', '==', doc.funcionarioId).get();
              for (const a of ant.docs) { const v = a.data(); if (v.comp === doc.comp && v.tipo === 'folha' && v.atual) { if (v.liq === doc.liq) { doc.dup = true; break; } await a.ref.update({ atual: false }); } }
              if (doc.dup) continue;
            }
            await db.collection('contracheques').add(doc);
            if (++n % 10 === 0) { st.textContent = `Gravando recibos… ${n}/${T.length}`; await new Promise(z => setTimeout(z, 40)); }
          }
        }
        st.innerHTML = `<span style="color:var(--ok)">Pronto: ${n} contracheques importados.</span>`; toast(`${n} contracheques importados.`, 'ok');
      } catch (e) { st.innerHTML = '<span style="color:var(--bad)">Não foi possível gravar: ' + esc(e.message || e) + '. Seu usuário precisa ser Administrador, Gestão, Gerente ou RH.</span>'; }
    };
  };
}

/* página do funcionário */
const CC_CACHE = {};
async function ccArquivo(id) {
  if (CC_CACHE[id]) return CC_CACHE[id];
  const m = await db.doc('cc_arq/' + id).get(); if (!m.exists) throw new Error('arquivo não encontrado'); let b64 = '';
  for (let i = 0; i < num(m.data().partes); i++) { const p = await db.doc(`cc_arq/${id}/p/${i}`).get(); if (!p.exists) throw new Error('arquivo incompleto'); b64 += p.data().d; }
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return (CC_CACHE[id] = u8);
}
async function ccPdf(x) {
  const P = await pdfLibW(); const src = await P.PDFDocument.load(await ccArquivo(x.arq)); const out = await P.PDFDocument.create();
  const pgs = await out.copyPages(src, Array.from({ length: x.np || 1 }, (_, i) => x.p0 + i)); pgs.forEach(p => out.addPage(p));
  return new Blob([await out.save()], { type: 'application/pdf' });
}
async function ccBox(f) {
  const el = $('#vi-cc'); if (!el) return;
  let L = [];
  try {
    const Q = [db.collection('contracheques').where('funcionarioId', '==', f.id).get()];
    const cods = [...new Set((D.folha || []).filter(x => x.funcionarioId === f.id && x.cod).map(x => String(x.cod)))].slice(0, 10);
    if (cods.length) Q.push(db.collection('contracheques').where('cod', 'in', cods).get());
    const vis = {}; (await Promise.all(Q)).forEach(s => s.docs.forEach(d => { vis[d.id] = Object.assign({ id: d.id }, d.data()); })); L = Object.values(vis);
  }
  catch (e) { el.innerHTML = '<p class="note">Não foi possível carregar os contracheques (' + esc(e.message || e) + ').</p>'; return; }
  if (!L.length) { el.innerHTML = '<p class="note">Nenhum contracheque importado para esta pessoa. Importe em Indicadores › Pessoas › Folha.</p>'; return; }
  L.sort((a, b) => str(b.comp).localeCompare(str(a.comp)) || (b.atual ? 1 : 0) - (a.atual ? 1 : 0) || str(a.tipo).localeCompare(str(b.tipo)));
  const at = L.filter(x => x.atual !== false), ant = L.filter(x => x.atual === false);
  const lin = x => `<tr><td>${esc(x.comp ? mesNome(x.comp) : '—')}</td><td>${esc(CC_TIPO[x.tipo] || x.tipo)}${x.atual === false ? ' <span class="badge b-mut">versão anterior</span>' : ''}</td><td style="text-align:right">${x.venc == null ? '—' : brl2(x.venc)}</td><td style="text-align:right">${x.desc == null ? '—' : brl2(x.desc)}</td><td style="text-align:right"><b>${x.liq == null ? '—' : brl2(x.liq)}</b></td><td style="white-space:nowrap;text-align:right"><button class="btn sm ghost" data-cco="${esc(x.id)}" type="button">Abrir</button> <button class="btn sm ghost" data-ccb="${esc(x.id)}" type="button">Baixar</button></td></tr>`;
  const tab = R => `<div class="tbwrap" style="margin:0"><table class="tb" style="width:100%"><thead><tr><th>Mês</th><th>Tipo</th><th style="text-align:right">Vencimentos</th><th style="text-align:right">Descontos</th><th style="text-align:right">Líquido</th><th></th></tr></thead><tbody>${R.map(lin).join('')}</tbody></table></div>`;
  el.innerHTML = `<div class="card" style="padding:6px 10px;overflow:auto">${tab(at)}${ant.length ? `<details style="margin-top:6px"><summary class="note" style="cursor:pointer">Versões anteriores substituídas (${ant.length})</summary>${tab(ant)}</details>` : ''}
    <div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="btn sm" id="cc-todos" type="button">Baixar todos em um PDF</button></div></div>`;
  const por = id => L.find(x => x.id === id);
  const nomeArq = x => `Contracheque ${x.comp} - ${f.nome}${x.tipo !== 'folha' ? ' - ' + (CC_TIPO[x.tipo] || x.tipo) : ''}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');
  const baixa = (blob, nome) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
  const busy = async (b, fn) => { const t = b.textContent; b.disabled = true; b.textContent = '…'; try { await fn(); } catch (e) { toast('Não foi possível abrir: ' + (e.message || e), 'bad'); } b.disabled = false; b.textContent = t; };
  el.querySelectorAll('[data-cco]').forEach(b => b.onclick = () => { const w = window.open('', '_blank'); if (w) w.document.write('<p style="font:16px system-ui;padding:20px">Abrindo o contracheque…</p>'); busy(b, async () => { try { const u = URL.createObjectURL(await ccPdf(por(b.dataset.cco))); if (w) w.location.href = u; else location.href = u; } catch (e) { if (w) w.close(); throw e; } }); });
  el.querySelectorAll('[data-ccb]').forEach(b => b.onclick = () => busy(b, async () => { const x = por(b.dataset.ccb); baixa(await ccPdf(x), nomeArq(x)); }));
  $('#cc-todos').onclick = () => busy($('#cc-todos'), async () => {
    const P = await pdfLibW(); const out = await P.PDFDocument.create();
    for (const x of at.slice().reverse()) { const src = await P.PDFDocument.load(await ccArquivo(x.arq)); (await out.copyPages(src, Array.from({ length: x.np || 1 }, (_, i) => x.p0 + i))).forEach(p => out.addPage(p)); }
    baixa(new Blob([await out.save()], { type: 'application/pdf' }), `Contracheques - ${f.nome}.pdf`.replace(/[\\/:*?"<>|]+/g, ' '));
  });
}
