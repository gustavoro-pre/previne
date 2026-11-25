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
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3400); };
const kpi = (t, n, k, s) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
const PRAZO = 8;

const D = { adm: [], func: [], areas: [], kits: [] };
const V = { tab: 'and', q: '', per: '180' };
let db = null, PODE = false, MEU = '';

/* ---------- regras ---------- */
const etp = a => a.etapas || {};
const fimMob = a => str((etp(a).integ || {}).realizada);
const diasMob = a => diasEntre(a.abertoEm, fimMob(a) || hoje());
const atrasado = a => diasMob(a) > PRAZO;
const precisaJust = a => atrasado(a) && !str(a.justificativa).trim();
function etapas(a) {
  const e = etp(a), ds = ADM.docsSt(a), aso = e.aso || {}, ig = e.integ || {}, tr = e.trein || {};
  return [
    { k: 'docs', t: 'Documentos', st: ds.rej.length ? 'bad' : ds.ok === ds.obr ? 'ok' : ds.env ? 'at' : '', s: ds.rej.length ? 'reenviar' : ds.ok === ds.obr ? 'conferidos' : `${ds.env}/${ds.obr}` },
    { k: 'aso', t: 'ASO', st: aso.data && aso.apto !== false ? 'ok' : aso.data ? 'bad' : aso.agendado ? 'at' : '', s: aso.data ? (aso.apto === false ? 'inapto' : fmtD(aso.data).slice(0, 5)) : aso.agendado ? 'marcado ' + fmtD(aso.agendado).slice(0, 5) : '' },
    { k: 'integ', t: 'Integração', st: ig.realizada ? 'ok' : ig.agendada ? 'at' : '', s: ig.realizada ? fmtD(ig.realizada).slice(0, 5) : ig.agendada ? 'marcada ' + fmtD(ig.agendada).slice(0, 5) : '' },
    { k: 'trein', t: 'Treinamentos', st: tr.concluido ? 'ok' : tr.enviado ? 'at' : '', s: tr.concluido ? 'feitos' : tr.enviado ? 'enviados' : '' },
    { k: 'epi', t: 'OS e ficha EPI', st: (e.epi || {}).data ? 'ok' : '', s: (e.epi || {}).data ? 'assinadas' : '' },
    { k: 'admiss', t: 'Docs admissionais', st: (e.admiss || {}).data ? 'ok' : '', s: (e.admiss || {}).data ? 'assinados' : '' },
    { k: 'contab', t: 'Contabilidade', st: (e.contab || {}).data ? 'ok' : '', s: (e.contab || {}).data ? 'enviado' : '' }
  ];
}
const pills = a => `<div class="ets">${etapas(a).map(x => `<span class="et ${x.st}">${x.st === 'ok' ? '✓ ' : ''}${esc(x.t)}${x.s && x.st !== 'ok' ? ' · ' + esc(x.s) : ''}</span>`).join('')}</div>`;
const areaBy = id => D.areas.find(a => a.id === id);
const funcoes = () => [...new Set(D.func.map(f => str(f.funcao).trim()).concat(D.kits.map(k => str(k.funcao).trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
const linkDe = a => new URL('enviar.html?c=' + a.id, location.href).href;
const waDe = a => { const t = ADM.dig(a.telefone); const msg = `Olá, ${str(a.nome).split(' ')[0]}! Aqui é do RH da PREVINE. Para a sua admissão${a.funcao ? ' como ' + a.funcao : ''}, envie seus dados e documentos por este link (leva uns 15 minutos): ${linkDe(a)}`;
  return 'https://wa.me/' + (t ? (t.length <= 11 ? '55' + t : t) : '') + '?text=' + encodeURIComponent(msg); };

/* ---------- dados ---------- */
function ouvir() {
  db.collection('admissoes').onSnapshot(s => { D.adm = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); if (ABERTO && !$('#modal').hidden) detalhe(ABERTO, true); }, () => toast('Sem permissão para ver as admissões.', 'bad'));
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); }, () => {});
  db.collection('areas').onSnapshot(s => { D.areas = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')); render(); }, () => {});
  db.collection('kits').onSnapshot(s => { D.kits = s.docs.map(d => d.data()); }, () => {});
}

/* ---------- telas ---------- */
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const ae = document.activeElement; if (ae && ae.closest && ae.closest('#body') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  ({ and: rAnd, nova: rNova, conc: rConc, kpi: rKpi })[V.tab]();
}
function cardAdm(a) {
  const d = diasMob(a), ds = ADM.docsSt(a); const foto = ((a.cand || {}).docs || {}).foto; const th = foto && foto[0] && foto[0].thumb;
  return `<div class="card adm" data-open="${esc(a.id)}"><div style="display:flex;gap:12px;align-items:flex-start">${th ? `<img class="foto" src="${th}" alt="">` : ''}
    <div style="flex:1;min-width:0"><b>${esc(a.nome)}</b><div class="t2">${esc(a.funcao || '')}${a.area ? ' · ' + esc(a.area) : ''}${a.subarea ? ' → ' + esc(a.subarea) : ''}</div>
    <div class="t2">Aberto em ${fmtD(a.abertoEm)}${(a.cand || {}).em ? ' · candidato mexeu em ' + fmtD(a.cand.em) : ' · candidato ainda não abriu o link'}${ds.pendRev.length && a.status === 'aberto' ? ` · <b style="color:var(--info)">${ds.pendRev.length} doc(s) para conferir</b>` : ''}</div></div>
    <div style="text-align:right"><div class="dias ${d > PRAZO ? 'bad' : ''}">${d}d</div><div class="t2">${fimMob(a) ? 'mobilizado' : 'mobilização'}</div>${precisaJust(a) && a.status === 'aberto' ? '<span class="badge b-bad">Justificar</span>' : ''}</div></div>${pills(a)}</div>`;
}
function rAnd() {
  let L = D.adm.filter(a => a.status === 'aberto'); if (V.q) { const q = norm(V.q); L = L.filter(a => norm(a.nome + ' ' + a.funcao + ' ' + a.area + ' ' + a.cpf).includes(q)); }
  L.sort((a, b) => diasMob(b) - diasMob(a));
  const conf = L.filter(a => ADM.docsSt(a).pendRev.length).length, atr = L.filter(atrasado).length, semInt = L.filter(a => !fimMob(a)).length;
  $('#body').innerHTML = `<div class="kpis k5" style="margin-bottom:12px">${kpi('Em andamento', L.length)}${kpi('Acima de ' + PRAZO + ' dias', atr, atr ? 'bad' : 'ok')}${kpi('Docs para conferir', conf, conf ? 'info' : '')}${kpi('Sem integração', semInt, semInt ? 'warn' : '')}${kpi('Prazo', PRAZO + ' dias')}</div>
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
    <div class="grid3"><div><label for="n-sal">Salário (R$)</label><input id="n-sal" inputmode="decimal"></div><div><label class="req" for="n-area">Área</label><select id="n-area">${optAreas('')}</select></div><div><label for="n-sub">Sub-área</label><select id="n-sub">${optSubs('')}</select></div></div>
    <div class="grid3"><div><label for="n-un">Unidade</label><input id="n-un" placeholder="Ex.: Barra Mansa"></div><div><label for="n-int">Previsão de integração</label><input type="date" id="n-int" value="${addDays(PRAZO - 1)}"></div><div><label for="n-alt">Trabalho em altura</label><select id="n-alt"><option value="">Não</option><option value="1">Sim</option></select></div></div>
    <label for="n-obs">Observação (só RH)</label><input id="n-obs">
    <div class="actions"><button class="btn primary big" id="n-save">Abrir admissão e gerar link</button></div></div>`;
  $('#n-area').onchange = () => $('#n-sub').innerHTML = optSubs($('#n-area').value);
  $('#n-save').onclick = criar;
}
async function criar() {
  const nome = $('#n-nome').value.trim().replace(/\s+/g, ' '), cpf = ADM.dig($('#n-cpf').value), tel = ADM.dig($('#n-tel').value), funcao = $('#n-fun').value.trim().toUpperCase(), areaId = $('#n-area').value;
  if (nome.split(' ').length < 2) return toast('Informe o nome completo.', 'bad'); if (!ADM.cpfOk(cpf)) return toast('CPF inválido.', 'bad'); if (tel.length < 10) return toast('Informe o celular com DDD.', 'bad');
  if (!funcao) return toast('Informe a função.', 'bad'); if (!areaId) return toast('Escolha a área.', 'bad');
  const dup = D.adm.find(a => a.cpf === cpf && a.status === 'aberto'); if (dup) return toast('Já existe admissão em andamento para esse CPF.', 'bad');
  const ex = D.func.find(f => ADM.dig(f.cpf) === cpf && f.ativo !== false); if (ex) return toast(`CPF já cadastrado como funcionário ativo: ${ex.nome}.`, 'bad');
  const ar = areaBy(areaId), sid = $('#n-sub').value, sub = ((ar && ar.subs) || []).find(s => s.id === sid);
  const tk = ADM.rand(20); const agora = new Date().toISOString();
  const a = { nome, cpf, telefone: tel, funcao, areaId, area: ar ? ar.nome : '', subareaId: sid, subarea: sub ? sub.nome : '', unidade: $('#n-un').value.trim(), altura: $('#n-alt').value === '1',
    status: 'aberto', abertoEm: agora, abertoPor: MEU, etapas: { integ: { agendada: $('#n-int').value } }, rev: {}, cand: { dados: {}, docs: {} }, obs: $('#n-obs').value.trim() };
  const b = $('#n-save'); b.disabled = true;
  try {
    await db.doc('admissoes/' + tk).set(a);
    const sal = parseFloat(str($('#n-sal').value).replace(/\./g, '').replace(',', '.')); await db.doc('admissoes_priv/' + tk).set({ salario: isFinite(sal) ? sal : null, em: agora });
    D.adm.push(Object.assign({ id: tk }, a)); V.tab = 'and'; render(); detalhe(tk); toast('Admissão aberta. Envie o link ao candidato.', 'ok');
  } catch (e) { b.disabled = false; toast('Não foi possível abrir: ' + ((e && e.message) || e), 'bad'); }
}

/* ---------- detalhe ---------- */
let ABERTO = '', SUJO = false; /* SUJO: o RH mexeu em campos ainda não salvos; não redesenha por cima */
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#sheet')) SUJO = true; });
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { ABERTO = ''; SUJO = false; $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
async function detalhe(id, refresh) {
  const a = D.adm.find(x => x.id === id); if (!a) return; ABERTO = id;
  if (refresh) { const ae = document.activeElement; if (SUJO || (ae && ae.closest && ae.closest('#sheet') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return; }
  SUJO = false;
  const y = $('#sheet').scrollTop;
  const e = etp(a), c = a.cand || {}, dd = c.dados || {}, docs = c.docs || {}, rev = a.rev || {}, ro = PODE && a.status === 'aberto' ? '' : 'disabled';
  const d = diasMob(a);
  sheet(`<div class="top"><h2>${esc(a.nome)}</h2><button class="x" id="m-x" aria-label="Fechar">×</button></div>
    <p class="note" style="margin:-4px 0 8px">CPF ${esc(ADM.fmtCpf(a.cpf))} · ${esc(a.funcao)} · ${esc(a.area)}${a.subarea ? ' → ' + esc(a.subarea) : ''}${a.unidade ? ' · ' + esc(a.unidade) : ''}${a.altura ? ' · trabalho em altura' : ''}</p>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${kpi('Dias de mobilização', d, d > PRAZO ? 'bad' : 'ok', fimMob(a) ? 'integrado em ' + fmtD(fimMob(a)) : 'desde ' + fmtD(a.abertoEm))}${kpi('Documentos', ADM.docsSt(a).env + '/' + ADM.docsSt(a).obr, ADM.docsSt(a).rej.length ? 'bad' : '')}<div class="kpi"><div class="n" id="m-sal" style="font-size:18px">…</div><div class="t">Salário</div></div></div>
    ${pills(a)}
    ${a.status === 'aberto' ? `<div class="etf"><h4>Link do candidato</h4><div class="linkbox"><input readonly value="${esc(linkDe(a))}" id="m-link"><button class="btn sm ghost" id="m-copy">Copiar</button><a class="btn sm accent" href="${esc(waDe(a))}" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp</a></div></div>` : ''}
    <h3>Documentos</h3><div class="card" style="padding:4px 12px">${ADM.SLOTS.map(s => { const L = docs[s.id] || []; const r = rev[s.id]; const ult = ADM.ultimoEnvio(L); const atual = r && str(r.em) >= ult;
      const st = !L.length ? (s.obr ? '<span class="badge b-warn">Falta</span>' : '<span class="badge b-mut">Opcional</span>') : atual && r.st === 'ok' ? '<span class="badge b-ok">Conferido</span>' : atual && r.st === 'rej' ? '<span class="badge b-bad">Recusado</span>' : '<span class="badge b-info">Conferir</span>';
      return `<div class="dslot"><div class="main"><b>${esc(s.t)}</b>${s.obr ? '' : ' <span class="t2">(se tiver)</span>'} ${st}${L.some(f => f.q === 'baixa') ? ' <span class="badge b-warn">qualidade baixa</span>' : ''}
        ${atual && r.st === 'rej' ? `<div class="t2">Motivo: ${esc(r.motivo)}</div>` : ''}
        ${L.length ? `<div class="thumbs">${L.map((f, i) => `<button data-ver="${s.id}|${i}" title="${esc(f.nome)}">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}</button>`).join('')}</div>` : ''}
        ${ro ? '' : `<div class="actions" style="margin-top:6px">${L.length ? `<button class="btn sm ghost" data-ok="${s.id}">✓ Conferido</button><button class="btn sm danger" data-rej="${s.id}">Recusar</button>` : ''}<button class="btn sm ghost" data-anx="${s.id}">Anexar</button></div>`}</div></div>`; }).join('')}</div>
    <h3>Dados do candidato</h3><div class="card">${Object.keys(dd).length ? `<dl class="kv">${[['Nascimento', fmtD(dd.nascimento)], ['Sexo', dd.sexo], ['Estado civil', dd.estadoCivil], ['Mãe', dd.mae], ['Pai', dd.pai], ['Celular', dd.telefone], ['E-mail', dd.email],
        ['Endereço', [dd.rua, dd.numero, dd.complemento, dd.bairro, dd.cidade && dd.cidade + '/' + dd.uf, dd.cep].filter(Boolean).join(', ')], ['Escolaridade', dd.escolaridade], ['PIS', dd.pis], ['Banco', [dd.banco, dd.agencia && 'ag. ' + dd.agencia, dd.conta && 'cc ' + dd.conta, dd.pix && 'PIX ' + dd.pix].filter(Boolean).join(' · ')],
        ['Tamanhos', `camisa ${dd.tamCamisa || '—'} · calça ${dd.tamCalca || '—'} · calçado ${dd.tamCalcado || '—'}`], ['Emergência', [dd.emergNome, dd.emergTel].filter(Boolean).join(' · ')], ['Dependentes', dd.dependentes]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="note" style="margin:0">O candidato ainda não preencheu os dados.</p>'}</div>
    <h3>Etapas</h3>
    <div class="etf"><h4>ASO ${(e.aso || {}).data ? '<span class="badge b-ok">feito</span>' : ''}</h4><div class="grid3"><div><label for="e-asoag">Exame marcado para</label><input type="date" id="e-asoag" value="${esc((e.aso || {}).agendado || '')}" ${ro}></div><div><label for="e-aso">Data do ASO</label><input type="date" id="e-aso" value="${esc((e.aso || {}).data || '')}" ${ro}></div><div><label for="e-asov">Validade</label><input type="date" id="e-asov" value="${esc((e.aso || {}).validade || '')}" ${ro}></div></div>
      <div class="grid2"><div><label for="e-asoap">Resultado</label><select id="e-asoap" ${ro}><option value="1" ${(e.aso || {}).apto !== false ? 'selected' : ''}>Apto</option><option value="0" ${(e.aso || {}).apto === false ? 'selected' : ''}>Inapto</option></select></div><div><label>Arquivo do ASO</label>${((e.aso || {}).arq || []).length ? `<div class="thumbs">${e.aso.arq.map((f, i) => `<button data-veraso="${i}">${f.thumb ? `<img src="${f.thumb}" alt="">` : 'PDF'}</button>`).join('')}</div>` : ''}${ro ? '' : '<button class="btn sm ghost" id="e-asof" style="margin-top:4px">Anexar ASO</button>'}</div></div></div>
    <div class="etf"><h4>Integração</h4><div class="grid3"><div><label for="e-ia">Agendada para</label><input type="date" id="e-ia" value="${esc((e.integ || {}).agendada || '')}" ${ro}></div><div><label for="e-ir">Realizada em</label><input type="date" id="e-ir" value="${esc((e.integ || {}).realizada || '')}" ${ro}></div><div><label for="e-iv">Validade</label><input type="date" id="e-iv" value="${esc((e.integ || {}).validade || '')}" ${ro}></div></div></div>
    <div class="etf"><h4>Treinamentos admissionais</h4><div class="grid2"><div><label for="e-te">Enviados em</label><input type="date" id="e-te" value="${esc((e.trein || {}).enviado || '')}" ${ro}></div><div><label for="e-tc">Concluídos em</label><input type="date" id="e-tc" value="${esc((e.trein || {}).concluido || '')}" ${ro}></div></div></div>
    <div class="etf"><h4>Assinaturas e envio</h4><div class="grid3"><div><label for="e-epi">OS e ficha de EPI assinadas</label><input type="date" id="e-epi" value="${esc((e.epi || {}).data || '')}" ${ro}></div><div><label for="e-adm">Docs admissionais assinados</label><input type="date" id="e-adm" value="${esc((e.admiss || {}).data || '')}" ${ro}></div><div><label for="e-ct">Enviado à contabilidade</label><input type="date" id="e-ct" value="${esc((e.contab || {}).data || '')}" ${ro}></div></div></div>
    <div class="etf"><h4>Justificativa de atraso ${atrasado(a) ? `<span class="badge ${precisaJust(a) ? 'b-bad' : 'b-ok'}">${precisaJust(a) ? 'obrigatória' : 'preenchida'}</span>` : ''}</h4>
      <div class="grid2"><div><label for="e-jm">Motivo</label><select id="e-jm" ${ro}><option value="">—</option>${['Documentos do candidato', 'Agenda do ASO / clínica', 'Agenda da integração (cliente)', 'Treinamentos', 'Candidato desistiu ou sumiu', 'Aprovação interna', 'Outro'].map(m => `<option ${a.justMotivo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div><label for="e-j">Detalhe</label><input id="e-j" value="${esc(a.justificativa || '')}" ${ro} placeholder="${atrasado(a) ? 'Obrigatório: passou de ' + PRAZO + ' dias' : 'Só se passar de ' + PRAZO + ' dias'}"></div></div></div>
    <label for="e-obs">Observação (só RH)</label><input id="e-obs" value="${esc(a.obs || '')}" ${ro}>
    ${ro ? (a.funcionarioId ? `<p class="note">Cadastrado como funcionário em ${fmtD(a.concluidoEm)}.</p>` : '') : `<div class="actions"><button class="btn primary" id="e-save">Salvar etapas</button><button class="btn accent" id="e-conc">Concluir e cadastrar funcionário</button></div>
      <div class="actions" style="margin-top:6px"><button class="btn sm danger" id="e-canc">Cancelar admissão (desistência)</button></div>`}`);
  $('#sheet').scrollTop = y;
  db.doc('admissoes_priv/' + id).get().then(s => { const el = $('#m-sal'); if (el) el.textContent = s.exists && s.data().salario != null ? brl(s.data().salario) : '—'; }, () => { const el = $('#m-sal'); if (el) el.textContent = 'restrito'; });
  $('#m-x').onclick = fechar;
  const cp = $('#m-copy'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(linkDe(a)); toast('Link copiado.', 'ok'); } catch (er) { $('#m-link').select(); toast('Selecione e copie o link.'); } };
  const sv = $('#e-save'); if (sv) sv.onclick = () => salvarEtapas(a);
  const cc = $('#e-conc'); if (cc) cc.onclick = () => concluir(a);
  const cn = $('#e-canc'); if (cn) { let armed = false; cn.onclick = async () => { if (!armed) { armed = true; cn.textContent = 'Toque de novo para cancelar (o link deixa de funcionar)'; return; }
    try { await db.doc('admissoes/' + a.id).update({ status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: MEU }); toast('Admissão cancelada.', 'ok'); fechar(); } catch (er) { toast('Não foi possível cancelar.', 'bad'); } }; }
  const af = $('#e-asof'); if (af) af.onclick = () => anexar(a, 'aso');
  const ir = $('#e-ir'); if (ir) ir.onchange = () => { if (ir.value && !$('#e-iv').value) $('#e-iv').value = addMonths(ir.value, 12); };
  const as = $('#e-aso'); if (as) as.onchange = () => { if (as.value && !$('#e-asov').value) $('#e-asov').value = addMonths(as.value, 12); };
}
function lerEtapas(a) {
  const e = JSON.parse(JSON.stringify(etp(a)));
  e.aso = Object.assign({}, e.aso, { agendado: $('#e-asoag').value, data: $('#e-aso').value, validade: $('#e-asov').value, apto: $('#e-asoap').value !== '0' });
  e.integ = { agendada: $('#e-ia').value, realizada: $('#e-ir').value, validade: $('#e-iv').value };
  e.trein = { enviado: $('#e-te').value, concluido: $('#e-tc').value };
  e.epi = { data: $('#e-epi').value }; e.admiss = { data: $('#e-adm').value }; e.contab = { data: $('#e-ct').value };
  return e;
}
async function salvarEtapas(a, silencioso) {
  const e = lerEtapas(a); const u = { etapas: e, justMotivo: $('#e-jm').value, justificativa: $('#e-j').value.trim(), obs: $('#e-obs').value.trim(), atualizadoEm: new Date().toISOString() };
  if (e.integ.realizada && e.integ.realizada < str(a.abertoEm).slice(0, 10)) { toast('A integração não pode ser antes da abertura.', 'bad'); return false; }
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
      if (slot === 'aso') { const e = JSON.parse(JSON.stringify(etp(a))); e.aso = Object.assign({}, e.aso); e.aso.arq = (e.aso.arq || []).concat([arq]); await db.doc('admissoes/' + a.id).update({ etapas: e }); a.etapas = e; }
      else { const cand = JSON.parse(JSON.stringify(a.cand || { dados: {}, docs: {} })); cand.docs = cand.docs || {}; cand.docs[slot] = (cand.docs[slot] || []).concat([arq]); await db.doc('admissoes/' + a.id).update({ cand }); a.cand = cand; }
      toast(prep.q.ok ? 'Anexado.' : 'Anexado, mas a foto parece com problema: ' + prep.q.prob[0], prep.q.ok ? 'ok' : 'bad'); detalhe(a.id);
    } catch (er) { toast(er.message || 'Não foi possível anexar.', 'bad'); } };
  i.click();
}
/* concluir: cria (ou atualiza) o funcionário com os dados do candidato e as datas de ASO e integração */
async function concluir(a) {
  const e = lerEtapas(a); const dias = diasEntre(a.abertoEm, e.integ.realizada || hoje()); const ds = ADM.docsSt(a);
  const avisos = []; if (ds.faltam.length) avisos.push(`faltam documentos: ${ds.faltam.map(s => s.t).join(', ')}`); if (!e.aso.data) avisos.push('ASO sem data'); if (!e.integ.realizada) avisos.push('integração sem data de realização');
  if (dias > PRAZO && !$('#e-j').value.trim()) return toast(`Mobilização com ${dias} dias: preencha a justificativa de atraso antes de concluir.`, 'bad');
  if (!(await salvarEtapas(a, true))) return;
  SUJO = true; /* tela de conclusão aberta: não redesenhar o detalhe por cima */
  const dd = (a.cand || {}).dados || {}; const exist = D.func.find(f => ADM.dig(f.cpf) === a.cpf);
  sheet(`<div class="top"><h2>Concluir admissão</h2><button class="x" id="c-x" aria-label="Voltar">×</button></div>
    <p><b>${esc(a.nome)}</b> · ${esc(a.funcao)} · ${dias} dia(s) de mobilização</p>
    ${avisos.length ? `<div class="demo">Atenção: ${esc(avisos.join('; '))}. Dá para concluir assim mesmo e completar depois.</div>` : ''}
    ${exist ? `<div class="demo">Já existe funcionário com esse CPF (${esc(exist.nome)}, matrícula ${esc(exist.matricula || '—')}). O cadastro dele será atualizado e reativado.</div>` : ''}
    <div class="grid2"><div><label class="req" for="c-mat">Matrícula</label><input id="c-mat" value="${esc(exist ? exist.matricula || '' : '')}"></div><div><label class="req" for="c-adm">Data de admissão</label><input type="date" id="c-adm" value="${esc(e.integ.realizada || hoje())}"></div></div>
    <p class="note">Vai para o cadastro de funcionários: nome, CPF, função, área e sub-área, unidade, nascimento, tamanhos, contato, trabalho em altura, ASO e integração com as validades. Os documentos continuam guardados nesta admissão.</p>
    <div class="actions"><button class="btn primary big" id="c-go">Concluir e cadastrar</button></div>`);
  $('#c-x').onclick = () => detalhe(a.id);
  $('#c-go').onclick = async () => {
    const mat = $('#c-mat').value.trim(), adm = $('#c-adm').value; if (!mat) return toast('Informe a matrícula.', 'bad'); if (!adm) return toast('Informe a data de admissão.', 'bad');
    if (D.func.some(f => norm(f.matricula) === norm(mat) && (!exist || f.id !== exist.id))) return toast('Essa matrícula já é de outro funcionário.', 'bad');
    const b = $('#c-go'); b.disabled = true;
    const f = { nome: a.nome, matricula: mat, cpf: a.cpf, funcao: a.funcao, area: a.area, areaId: a.areaId, subareaId: a.subareaId || '', subarea: a.subarea || '', subareas: a.subareaId ? [a.subareaId] : [], unidade: a.unidade || '',
      admissao: adm, nascimento: dd.nascimento || '', situacao: 'Trabalhando', tamCamisa: dd.tamCamisa || '', tamRoupa: dd.tamCamisa || '', tamCalca: dd.tamCalca || '', tamCalcado: dd.tamCalcado || '',
      telefone: dd.telefone || a.telefone, email: dd.email || '', altura: !!a.altura, ativo: true, admissaoId: a.id,
      asoData: e.aso.data || '', asoValidade: e.aso.validade || '', integracaoData: e.integ.realizada || '', integracaoValidade: e.integ.validade || '' };
    try {
      let fid; if (exist) { fid = exist.id; await db.doc('funcionarios/' + fid).update(f); } else { const r = db.collection('funcionarios').doc(); fid = r.id; await r.set(Object.assign({ criadoEm: new Date().toISOString() }, f)); }
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
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const o = e.target.closest('[data-open]'); if (o) { detalhe(o.dataset.open); return; }
  const a = D.adm.find(x => x.id === ABERTO); if (!a) { if (e.target.id === 'modal') fechar(); return; }
  const v = e.target.closest('[data-ver]'); if (v) { const [s, i] = v.dataset.ver.split('|'); ver(a, s, a.cand.docs[s][+i]); return; }
  const va = e.target.closest('[data-veraso]'); if (va) { ver(a, 'aso', etp(a).aso.arq[+va.dataset.veraso]); return; }
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
  db.doc('config/empresa').onSnapshot(s => { const e = s.exists ? s.data() : {}; if (/^data:image\/(png|jpeg);base64,/.test(str(e.logo))) { const l = $('header .logo'); l.classList.add('img'); l.innerHTML = `<img src="${e.logo}" alt="Logo">`; }
    /* nome da empresa visível na página do candidato (que não faz login) */
    if (PODE && e.nome) db.doc('config/publico').get().then(p => { if (!p.exists || p.data().nome !== e.nome) db.doc('config/publico').set({ nome: e.nome }).catch(() => {}); }, () => {}); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  ouvir(); render();
})();
