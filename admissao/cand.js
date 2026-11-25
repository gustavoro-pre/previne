/* Página do candidato: confirma o CPF, preenche os dados pessoais e envia os documentos, um espaço por documento. */
"use strict";
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = v => v == null ? '' : String(v);
  let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3500); };
  const TAM_CAMISA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'EXG', 'XGG', 'G1', 'G2', 'G3', 'G4'];
  const TAM_CALCA = Array.from({ length: 15 }, (_, i) => String(34 + i * 2));
  const TAM_CALCADO = Array.from({ length: 16 }, (_, i) => String(33 + i));
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const CAMPOS = [
    ['nascimento', 'Data de nascimento', 'date', true], ['sexo', 'Sexo', ['Masculino', 'Feminino'], true], ['estadoCivil', 'Estado civil', ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'], true],
    ['mae', 'Nome da mãe', 'text', true], ['pai', 'Nome do pai', 'text', false], ['telefone', 'Celular (WhatsApp)', 'tel', true], ['email', 'E-mail', 'email', false],
    ['cep', 'CEP', 'cep', true], ['rua', 'Rua / avenida', 'text', true], ['numero', 'Número', 'text', true], ['complemento', 'Complemento', 'text', false], ['bairro', 'Bairro', 'text', true], ['cidade', 'Cidade', 'text', true], ['uf', 'Estado', UFS, true],
    ['escolaridade', 'Escolaridade', ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Técnico', 'Superior incompleto', 'Superior completo', 'Pós-graduação'], true],
    ['pis', 'PIS / NIS (se souber)', 'text', false], ['banco', 'Banco', 'text', false], ['pix', 'Chave PIX', 'text', false],
    ['tamCamisa', 'Tamanho de camisa', TAM_CAMISA, true], ['tamCalca', 'Tamanho de calça', TAM_CALCA, true], ['tamCalcado', 'Número do calçado', TAM_CALCADO, true],
    ['emergNome', 'Contato de emergência (nome)', 'text', true], ['emergTel', 'Contato de emergência (telefone)', 'tel', true], ['dependentes', 'Dependentes (nome, parentesco e nascimento)', 'area', false]
  ];
  const tk = (new URLSearchParams(location.search).get('c') || '').replace(/[^a-z0-9]/g, '');
  let A = null, CAND = null, ATIVO = 'dados', ocupado = false;
  const chaveCpf = () => 'adm_cpf_' + tk;

  async function iniciar() {
    if (!tk) return fim('Link incompleto. Abra o link que o RH enviou.');
    try { A = await CAPI.get(tk); } catch (e) { return fim(e.message); }
    if (!A) return fim('Link inválido ou expirado. Fale com o RH.');
    if (A.status !== 'aberto') return fim('Este processo de admissão já foi encerrado pelo RH. Obrigado!');
    CAPI.empresa().then(e => { if (e && e.nome) $('#emp').textContent = e.nome; });
    CAND = Object.assign({ dados: {}, docs: {} }, A.cand || {}); CAND.dados = CAND.dados || {}; CAND.docs = CAND.docs || {};
    let ok = false; try { ok = localStorage.getItem(chaveCpf()) === A.cpf; } catch (e) {}
    ok ? fluxo() : telaCpf();
  }
  function fim(t) { $('#app').innerHTML = `<div class="card"><h1>Documentos de admissão</h1><p>${esc(t)}</p></div>`; }
  function telaCpf() {
    $('#app').innerHTML = `<div class="card"><h1>Olá, ${esc(str(A.nome).split(' ')[0])}!</h1><p>Aqui você envia os seus dados e documentos para a admissão${A.funcao ? ' como <b>' + esc(A.funcao) + '</b>' : ''}. Leva uns 15 minutos e dá para parar e continuar depois pelo mesmo link.</p>
      <label for="c-cpf">Para começar, digite o seu CPF</label><input id="c-cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00">
      <div style="margin-top:14px"><button class="btn primary big" id="c-go">Continuar</button></div>
      <p class="note" style="margin-top:12px">Seus dados são usados só para a sua admissão e ficam guardados com segurança pela empresa (LGPD).</p></div>`;
    $('#c-go').onclick = () => { if (ADM.dig($('#c-cpf').value) !== A.cpf) return toast('CPF não confere com o cadastro do RH. Confira os números.', 'bad');
      try { localStorage.setItem(chaveCpf(), A.cpf); } catch (e) {} fluxo(); };
  }
  /* ---------- assinatura no app ---------- */
  const assinadoC = id => { const s = (CAND.assin || {})[id]; const d = !(id === 'lgpd' || id === 'carta') ? (A.assinar || {})[id] : (A.textos || {})[id]; return !!(s && d && s.hash === d.hash); };
  function pad(box) {
    box.innerHTML = `<div style="position:relative;border:2px dashed #b9c0cb;border-radius:12px;background:#fff;touch-action:none"><canvas style="width:100%;height:170px;display:block;border-radius:12px"></canvas>
      <span style="position:absolute;left:12px;bottom:8px;font-size:12px;color:#8a93a3;pointer-events:none">Assine aqui com o dedo</span></div><div style="text-align:right;margin-top:4px"><button class="btn ghost" type="button" style="padding:6px 12px">Limpar</button></div>`;
    const cv = box.querySelector('canvas'), r = window.devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = 170 * r;
    const x = cv.getContext('2d'); x.scale(r, r); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#14213d';
    let des = false, pts = 0; const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = e => { des = true; cv.setPointerCapture(e.pointerId); x.beginPath(); x.moveTo(...pos(e)); };
    cv.onpointermove = e => { if (!des) return; x.lineTo(...pos(e)); x.stroke(); pts++; };
    cv.onpointerup = cv.onpointercancel = () => { des = false; };
    box.querySelector('button').onclick = () => { x.clearRect(0, 0, cv.width, cv.height); pts = 0; };
    return { vazio: () => pts < 12, img: () => { const o = document.createElement('canvas'); const k = Math.min(1, 600 / cv.width); o.width = Math.round(cv.width * k); o.height = Math.round(cv.height * k); o.getContext('2d').drawImage(cv, 0, 0, o.width, o.height); return o.toDataURL('image/png'); } };
  }
  async function assinar(id, hashDoc, p, extra) {
    if (p.vazio()) throw new Error('Faça a sua assinatura no quadro.');
    const reg = Object.assign({ img: p.img(), hash: hashDoc, em: new Date().toISOString(), ua: navigator.userAgent, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', tela: screen.width + 'x' + screen.height, cpfConfirmado: true }, extra || {});
    CAND.assin = Object.assign({}, CAND.assin || {}, { [id]: reg }); await salvarCand();
  }
  /* termo LGPD e carta-convite vêm antes de tudo */
  async function fluxo() {
    for (const q of ['lgpd', 'carta']) { if (!(A.textos || {})[q] || assinadoC(q)) continue; return telaTexto(q); }
    tela();
  }
  async function telaTexto(q) {
    $('#app').innerHTML = '<div class="card"><p class="note">Carregando…</p></div>';
    let d; try { d = await CAPI.getD(tk, q); } catch (e) { return fim(e.message); }
    if (!d) return tela();
    const h = await ADM.sha256(d.texto); if (h !== A.textos[q].hash) return fim('O documento foi atualizado pelo RH. Recarregue a página.');
    const carta = q === 'carta';
    $('#app').innerHTML = `<div class="card"><p class="note">Passo ${carta ? 2 : 1} de 2 antes do envio dos documentos</p><h1>${carta ? 'Carta-convite' : 'Termo de proteção de dados (LGPD)'}</h1>
      <div style="white-space:pre-wrap;border:1px solid var(--line);border-radius:10px;padding:14px;max-height:${carta ? 'none' : '360px'};overflow:auto;background:#fafbfc;font-size:15px">${esc(d.texto)}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;color:var(--ink);font-size:15px;margin-top:14px"><input type="checkbox" id="t-ok" style="width:22px;height:22px;flex:none;margin-top:2px"> ${carta ? 'Li a carta-convite e aceito a proposta.' : 'Li e concordo com o termo de tratamento dos meus dados pessoais.'}</label>
      <label>Sua assinatura</label><div id="t-pad"></div>
      <div style="margin-top:12px"><button class="btn primary big" id="t-go">${carta ? 'Assinar e aceitar' : 'Assinar e continuar'}</button></div>
      <p class="note">Registramos a data, a hora e o aparelho da assinatura. Ela tem validade como assinatura eletrônica (MP 2.200-2/2001).</p></div>`;
    const p = pad($('#t-pad'));
    $('#t-go').onclick = async () => { if (!$('#t-ok').checked) return toast('Marque que leu e concorda.', 'bad'); const b = $('#t-go'); b.disabled = true;
      try { await assinar(q, h, p); toast(carta ? 'Carta assinada. Bem-vindo(a)!' : 'Termo assinado.', 'ok'); window.scrollTo(0, 0); fluxo(); } catch (e) { b.disabled = false; toast(e.message, 'bad'); } };
  }
  /* OS de segurança e termo de EPI (PDF gerado pelo RH) */
  const titC = id => id === 'osepi' ? 'OS de segurança e termo de EPI' : String(((A.assinar || {})[id] || {}).titulo || 'Documento');
  function osBox() {
    const ids = Object.keys(A.assinar || {}).sort((x, y) => (x === 'osepi' ? -1 : y === 'osepi' ? 1 : String(A.assinar[x].em).localeCompare(String(A.assinar[y].em))));
    const lst = $('#c-os'); if (!lst) return;
    lst.innerHTML = ids.map(id => `<div class="slot ${assinadoC(id) ? 'ok' : ''}"><div class="sh"><div class="m"><b>${esc(titC(id))}</b></div>${assinadoC(id) ? '<span class="st s-ok">Assinado</span>' : '<span class="st s-warn">Assinar</span>'}</div><div id="os-${id}" style="margin-top:8px"></div></div>`).join('');
    ids.forEach(docBox);
  }
  async function docBox(id) {
    const os = (A.assinar || {})[id]; const box = $('#os-' + id); if (!os || !box) return;
    if (assinadoC(id)) { box.innerHTML = `<p class="note" style="margin:0">Assinado em ${new Date(CAND.assin[id].em).toLocaleString('pt-BR')}.</p>`; return; }
    box.innerHTML = `<button class="btn primary big" id="o-ler-${id}">Ler e assinar</button>`;
    $('#o-ler-' + id).onclick = async () => {
      box.innerHTML = '<p class="note">Abrindo o documento…</p>';
      try {
        const blob = await ADM.ler(os, id, pid => CAPI.getD(tk, pid).then(x => x ? x.d : null));
        const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        const h = await ADM.sha256(b64); if (h !== os.hash) throw new Error('O documento não confere. Recarregue a página.');
        await new Promise((res, rej) => { if (window.pdfjsLib) return res(); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('Sem internet para abrir o PDF.')); document.head.appendChild(s); });
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        box.innerHTML = `<div id="o-pgs-${id}" style="border:1px solid var(--line);border-radius:10px;overflow:hidden"></div>
          <label style="display:flex;gap:10px;align-items:flex-start;color:var(--ink);font-size:15px;margin-top:14px"><input type="checkbox" id="o-ok-${id}" style="width:22px;height:22px;flex:none;margin-top:2px"> ${id === 'osepi' ? 'Recebi, li e compreendi a Ordem de Serviço e o termo de EPI, e me comprometo a cumpri-los.' : 'Li e concordo com este documento.'}</label>
          <label>Sua assinatura</label><div id="o-pad-${id}"></div><div style="margin-top:12px"><button class="btn primary big" id="o-go-${id}">Assinar</button></div>`;
        const W = Math.min(900, box.clientWidth || 360) * (window.devicePixelRatio > 1 ? 2 : 1.4);
        for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i); const v0 = pg.getViewport({ scale: 1 }); const vp = pg.getViewport({ scale: W / v0.width }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.cssText = 'width:100%;display:block;border-bottom:1px solid #e2e5ea'; $('#o-pgs-' + id).appendChild(cv); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; }
        const p = pad($('#o-pad-' + id));
        $('#o-go-' + id).onclick = async () => { if (!$('#o-ok-' + id).checked) return toast('Marque que leu e concorda.', 'bad'); const b = $('#o-go-' + id); b.disabled = true;
          try { await assinar(id, h, p, { v: os.v }); toast('Assinado!', 'ok'); osBox(); } catch (e) { b.disabled = false; toast(e.message, 'bad'); } };
      } catch (e) { box.innerHTML = `<div class="badbox">${esc(e.message || 'Não foi possível abrir.')}</div>`; }
    };
  }
  function progresso() {
    const st = ADM.docsSt({ cand: CAND, rev: A.rev });
    const dObr = CAMPOS.filter(c => c[3]); const dOk = dObr.filter(c => str(CAND.dados[c[0]]).trim()).length;
    const tot = dObr.length + st.obr, feito = dOk + st.env;
    return { st, dOk, dTot: dObr.length, pct: Math.round(feito / tot * 100), enviou: dOk === dObr.length && st.env === st.obr, completo: dOk === dObr.length && st.env === st.obr && !st.rej.length };
  }
  function tela() {
    const p = progresso(); const rejs = p.st.rej;
    $('#app').innerHTML = `<div class="card"><h1>${esc(A.nome)}</h1><p class="note">CPF ${esc(ADM.fmtCpf(A.cpf))}${A.funcao ? ' · ' + esc(A.funcao) : ''}</p>
        <div class="bar"><i style="width:${p.pct}%"></i></div><p class="note">${p.pct}% concluído</p>
        ${p.completo ? `<div class="okbox">Documentos enviados! Agora assine a OS e o termo de EPI e faça os treinamentos logo abaixo. O RH vai conferir e entra em contato.</div>` : ''}
        ${rejs.length ? `<div class="badbox"><b>O RH pediu para reenviar:</b> ${rejs.map(s => esc(s.t)).join(', ')}. Veja o motivo no documento.</div>` : ''}</div>
      <div class="card"><div class="sh"><div class="m"><h2>1. Seus dados</h2><p class="note">${p.dOk} de ${p.dTot} campos obrigatórios</p></div><button class="btn ghost" id="c-tdados">${ATIVO === 'dados' ? 'Fechar' : 'Preencher'}</button></div>
        <div id="c-dados" class="${ATIVO === 'dados' ? '' : 'hidden'}"></div></div>
      <div class="card"><h2>2. Documentos</h2><p class="note">Tire foto com o documento inteiro aparecendo, em cima de uma mesa, com boa luz. PDF também vale. Os marcados com * são obrigatórios.</p><div id="c-docs"></div></div>
      ${p.enviou ? '' : `<div class="card" style="opacity:.75"><h2>3. OS de segurança, termo de EPI e treinamentos</h2><p class="note">Liberados aqui assim que você preencher os seus dados e enviar todos os documentos obrigatórios.</p></div>`}
      ${p.enviou && Object.keys(A.assinar || {}).length ? `<div class="card"><h2>3. OS de segurança, termo de EPI e documentos para assinar</h2><p class="note">Leia cada documento até o fim e assine.</p><div id="c-os"></div></div>` : ''}
      ${p.enviou && (A.trein || {}).cursos && A.trein.cursos.length ? `<div class="card"><h2>4. Treinamentos</h2><p class="note">Agora faça estes treinamentos pelo celular:</p><ul style="margin:6px 0 10px;padding-left:20px">${A.trein.cursos.map(c => `<li>${esc(c.nome)}</li>`).join('')}</ul>
        <p>Login: <b>seu CPF</b><br>Senha provisória: <b style="font-size:18px;letter-spacing:1px">${esc(A.trein.senha || '')}</b></p><p class="note">No primeiro acesso você cria a sua senha.</p>
        <a class="btn primary big" href="../aluno/" target="_blank" rel="noopener" style="text-decoration:none">Abrir treinamentos</a></div>` : ''}`;
    $('#c-tdados').onclick = () => { ATIVO = ATIVO === 'dados' ? '' : 'dados'; tela(); };
    if (ATIVO === 'dados') formDados();
    docs(); osBox();
  }
  function campo([k, t, tp, obr]) {
    const v = str(CAND.dados[k]); const lab = `<label for="d-${k}">${esc(t)}${obr ? ' *' : ''}</label>`;
    if (Array.isArray(tp)) return `<div>${lab}<select id="d-${k}"><option value="">Escolha…</option>${tp.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    if (tp === 'area') return `<div style="grid-column:1/-1">${lab}<textarea id="d-${k}" rows="3">${esc(v)}</textarea></div>`;
    return `<div>${lab}<input id="d-${k}" type="${tp === 'cep' ? 'text' : tp}" ${tp === 'cep' || tp === 'tel' ? 'inputmode="numeric"' : ''} value="${esc(v)}"></div>`;
  }
  function formDados() {
    $('#c-dados').innerHTML = `<div class="g2">${CAMPOS.map(campo).join('')}</div><div style="margin-top:14px"><button class="btn primary big" id="c-sdados">Salvar dados</button></div>`;
    $('#d-cep').onchange = async () => { const c = ADM.dig($('#d-cep').value); if (c.length !== 8) return;
      try { const r = await fetch(`https://viacep.com.br/ws/${c}/json/`); const j = await r.json(); if (j && !j.erro) { [['rua', j.logradouro], ['bairro', j.bairro], ['cidade', j.localidade], ['uf', j.uf]].forEach(([k, v]) => { if (v && !$('#d-' + k).value) $('#d-' + k).value = v; }); } } catch (e) {} };
    $('#c-sdados').onclick = async () => {
      const d = {}; CAMPOS.forEach(([k]) => d[k] = $('#d-' + k).value.trim());
      const falta = CAMPOS.filter(c => c[3] && !d[c[0]]).map(c => c[1]);
      if (d.nascimento && (d.nascimento < '1940-01-01' || d.nascimento > new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10))) return toast('Confira a data de nascimento.', 'bad');
      CAND.dados = d; const b = $('#c-sdados'); b.disabled = true; b.textContent = 'Salvando…';
      try { await salvarCand(); toast(falta.length ? `Salvo. Ainda faltam: ${falta.slice(0, 3).join(', ')}${falta.length > 3 ? '…' : ''}` : 'Dados salvos!', falta.length ? '' : 'ok'); if (!falta.length) ATIVO = ''; tela(); if (!falta.length) $('#c-docs').scrollIntoView({ behavior: 'smooth' }); }
      catch (e) { toast(e.message, 'bad'); b.disabled = false; b.textContent = 'Salvar dados'; }
    };
  }
  async function salvarCand() { CAND.em = new Date().toISOString(); const p = progresso(); CAND.completo = p.completo; if (p.completo && !CAND.completoEm) CAND.completoEm = CAND.em; await CAPI.setCand(tk, CAND); }
  function docs() {
    const rev = A.rev || {};
    $('#c-docs').innerHTML = ADM.slotsDe(A).map(s => { const L = CAND.docs[s.id] || []; const r = rev[s.id]; const ult = ADM.ultimoEnvio(L);
      const rej = L.length && r && r.st === 'rej' && str(r.em) >= ult; const aprov = L.length && r && r.st === 'ok' && str(r.em) >= ult;
      const st = rej ? '<span class="st s-bad">Reenviar</span>' : aprov ? '<span class="st s-ok">Conferido</span>' : L.length ? '<span class="st s-ok">Enviado</span>' : s.obr ? '<span class="st s-warn">Pendente</span>' : '<span class="st s-mut">Se tiver</span>';
      return `<div class="slot ${rej ? 'rej' : L.length ? 'ok' : ''}" id="s-${s.id}"><div class="sh"><div class="m"><b>${esc(s.t)}${s.obr ? ' *' : ''}</b>${s.d ? `<div class="note">${esc(s.d)}</div>` : ''}</div>${st}</div>
        ${rej ? `<div class="badbox">Motivo: ${esc(r.motivo || 'documento ilegível ou errado')}</div>` : ''}
        ${L.length ? `<div class="files">${L.map((f, i) => `<div class="file">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}${aprov ? '' : `<button data-rm="${s.id}|${i}" aria-label="Remover">×</button>`}</div>`).join('')}</div>` : ''}
        ${L.some(f => f.q === 'baixa') && !aprov ? `<div class="warnbox">Atenção: ${esc([...new Set(L.flatMap(f => f.prob || []))].join('; '))}. Se der, tire de novo.</div>` : ''}
        ${L.length < s.max && !aprov ? `<div class="acts"><button class="btn ghost" data-cam="${s.id}">${s.selfie ? 'Tirar selfie' : 'Tirar foto'}</button><button class="btn ghost" data-arq="${s.id}">Escolher arquivo</button></div>` : ''}
        <div class="sending hidden" id="e-${s.id}">Enviando…</div></div>`; }).join('');
  }
  function escolher(slot, camera) {
    if (ocupado) return toast('Espere terminar o envio anterior.');
    const s = ADM.slotsDe(A).find(x => x.id === slot); const i = document.createElement('input'); i.type = 'file';
    i.accept = camera ? 'image/*' : 'image/*,application/pdf'; if (camera) i.setAttribute('capture', s.selfie ? 'user' : 'environment');
    i.onchange = () => i.files[0] && enviar(slot, i.files[0]); i.click();
  }
  async function enviar(slot, file) {
    ocupado = true; const e = $('#e-' + slot); if (e) e.classList.remove('hidden');
    try {
      const prep = await ADM.preparar(file);
      if (!prep.q.ok) toast('Foto enviada, mas parece com problema: ' + prep.q.prob[0] + '.', 'bad');
      const arq = await ADM.gravar(prep, slot, (id, d) => CAPI.setPart(tk, id, d));
      CAND.docs[slot] = (CAND.docs[slot] || []).concat([arq]); await salvarCand();
      if (prep.q.ok) toast('Documento enviado!', 'ok');
    } catch (er) { toast(er.message || 'Não foi possível enviar.', 'bad'); }
    ocupado = false; tela(); const el = $('#s-' + slot); if (el) el.scrollIntoView({ block: 'center' });
  }
  document.addEventListener('click', async ev => {
    const c = ev.target.closest('[data-cam]'); if (c) return escolher(c.dataset.cam, true);
    const a = ev.target.closest('[data-arq]'); if (a) return escolher(a.dataset.arq, false);
    const r = ev.target.closest('[data-rm]'); if (r) { const [s, i] = r.dataset.rm.split('|'); if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = '?'; toast('Toque de novo no × para remover.'); return; }
      CAND.docs[s] = (CAND.docs[s] || []).filter((_, k) => k !== +i); try { await salvarCand(); } catch (er) { toast(er.message, 'bad'); } tela(); }
  });
  const go = () => window.CAPI ? iniciar() : window.addEventListener('capi', iniciar, { once: true });
  go();
})();
