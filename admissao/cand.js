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
    ['pis', 'PIS / NIS (se souber)', 'text', false], ['banco', 'Banco', 'text', false], ['agencia', 'Agência', 'text', false], ['conta', 'Conta', 'text', false], ['pix', 'Chave PIX', 'text', false],
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
    ok ? tela() : telaCpf();
  }
  function fim(t) { $('#app').innerHTML = `<div class="card"><h1>Documentos de admissão</h1><p>${esc(t)}</p></div>`; }
  function telaCpf() {
    $('#app').innerHTML = `<div class="card"><h1>Olá, ${esc(str(A.nome).split(' ')[0])}!</h1><p>Aqui você envia os seus dados e documentos para a admissão${A.funcao ? ' como <b>' + esc(A.funcao) + '</b>' : ''}. Leva uns 15 minutos e dá para parar e continuar depois pelo mesmo link.</p>
      <label for="c-cpf">Para começar, digite o seu CPF</label><input id="c-cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00">
      <div style="margin-top:14px"><button class="btn primary big" id="c-go">Continuar</button></div>
      <p class="note" style="margin-top:12px">Seus dados são usados só para a sua admissão e ficam guardados com segurança pela empresa (LGPD).</p></div>`;
    $('#c-go').onclick = () => { if (ADM.dig($('#c-cpf').value) !== A.cpf) return toast('CPF não confere com o cadastro do RH. Confira os números.', 'bad');
      try { localStorage.setItem(chaveCpf(), A.cpf); } catch (e) {} tela(); };
  }
  function progresso() {
    const st = ADM.docsSt({ cand: CAND, rev: A.rev });
    const dObr = CAMPOS.filter(c => c[3]); const dOk = dObr.filter(c => str(CAND.dados[c[0]]).trim()).length;
    const tot = dObr.length + st.obr, feito = dOk + st.env;
    return { st, dOk, dTot: dObr.length, pct: Math.round(feito / tot * 100), completo: dOk === dObr.length && st.env === st.obr && !st.rej.length };
  }
  function tela() {
    const p = progresso(); const rejs = p.st.rej;
    $('#app').innerHTML = `<div class="card"><h1>${esc(A.nome)}</h1><p class="note">CPF ${esc(ADM.fmtCpf(A.cpf))}${A.funcao ? ' · ' + esc(A.funcao) : ''}</p>
        <div class="bar"><i style="width:${p.pct}%"></i></div><p class="note">${p.pct}% concluído</p>
        ${p.completo ? `<div class="okbox">Tudo enviado! O RH vai conferir e entra em contato. Você pode fechar esta página.</div>` : ''}
        ${rejs.length ? `<div class="badbox"><b>O RH pediu para reenviar:</b> ${rejs.map(s => esc(s.t)).join(', ')}. Veja o motivo no documento.</div>` : ''}</div>
      <div class="card"><div class="sh"><div class="m"><h2>1. Seus dados</h2><p class="note">${p.dOk} de ${p.dTot} campos obrigatórios</p></div><button class="btn ghost" id="c-tdados">${ATIVO === 'dados' ? 'Fechar' : 'Preencher'}</button></div>
        <div id="c-dados" class="${ATIVO === 'dados' ? '' : 'hidden'}"></div></div>
      ${(A.trein || {}).cursos && A.trein.cursos.length ? `<div class="card"><h2>3. Treinamentos</h2><p class="note">Você já pode fazer estes treinamentos pelo celular:</p><ul style="margin:6px 0 10px;padding-left:20px">${A.trein.cursos.map(c => `<li>${esc(c.nome)}</li>`).join('')}</ul>
        <p>Login: <b>seu CPF</b><br>Senha provisória: <b style="font-size:18px;letter-spacing:1px">${esc(A.trein.senha || '')}</b></p><p class="note">No primeiro acesso você cria a sua senha.</p>
        <a class="btn primary big" href="../aluno/" target="_blank" rel="noopener" style="text-decoration:none">Abrir treinamentos</a></div>` : ''}
      <div class="card"><h2>2. Documentos</h2><p class="note">Tire foto com o documento inteiro aparecendo, em cima de uma mesa, com boa luz. PDF também vale. Os marcados com * são obrigatórios.</p><div id="c-docs"></div></div>`;
    $('#c-tdados').onclick = () => { ATIVO = ATIVO === 'dados' ? '' : 'dados'; tela(); };
    if (ATIVO === 'dados') formDados();
    docs();
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
