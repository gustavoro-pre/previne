/* Avaliação de desempenho: fim da experiência (45 e 90 dias) e anual, com notas de 1 a 5 por competência.
   avaliacoes/{id} = { fid, nome, funcao, tipo, data, avaliador, notas: {comp: n}, media, pontos, melhorar, recomendacao }
   Gestão, Gerente, RH e Administrador. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const addDias = (d, n) => { const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const COMP = [['seg', 'Segurança: cumpre normas, usa EPI, relata riscos'], ['tec', 'Conhecimento técnico e qualidade do serviço'], ['prod', 'Produtividade e cumprimento de prazos'], ['ass', 'Assiduidade e pontualidade'], ['eq', 'Trabalho em equipe e relacionamento'], ['com', 'Comunicação com liderança e cliente'], ['ini', 'Iniciativa e disposição para aprender'], ['org', 'Organização e cuidado com ferramentas']];
const TIPO = { exp45: 'Experiência · 45 dias', exp90: 'Experiência · 90 dias', anual: 'Anual' };
const REC = { exp45: ['Prorrogar a experiência', 'Encerrar o contrato'], exp90: ['Efetivar', 'Encerrar o contrato'], anual: ['Manter na função', 'Indicar para promoção / outra função', 'Plano de melhoria', 'Desligar'] };
const D = { func: [], av: [], adv: [], aud: [], tr: [] }; const V = { tab: 'pend', busca: '' }; let db = null, MEU = '';
function pendentes() {
  const hj = hoje(), out = [];
  D.func.filter(f => f.ativo !== false && /^\d{4}-\d{2}-\d{2}/.test(str(f.admissao))).forEach(f => {
    const feito = t => D.av.some(a => a.fid === f.id && a.tipo === t && (t !== 'anual' || str(a.data) >= addDias(hj, -365)));
    const d45 = addDias(f.admissao, 44), d90 = addDias(f.admissao, 89);
    if (!feito('exp45') && d45 >= addDias(hj, -30) && d45 <= addDias(hj, 14)) out.push({ f, tipo: 'exp45', prazo: d45 });
    else if (!feito('exp90') && d90 >= addDias(hj, -30) && d90 <= addDias(hj, 14)) out.push({ f, tipo: 'exp90', prazo: d90 });
    else if (str(f.admissao) <= addDias(hj, -365) && !feito('anual')) out.push({ f, tipo: 'anual', prazo: '' });
  });
  return out.sort((a, b) => (a.tipo === 'anual') - (b.tipo === 'anual') || str(a.prazo).localeCompare(str(b.prazo)) || str(a.f.nome).localeCompare(str(b.f.nome), 'pt'));
}
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const P = pendentes(); const exp = P.filter(p => p.tipo !== 'anual');
  const filt = L => V.busca ? L.filter(x => norm((x.f || x).nome).includes(norm(V.busca))) : L;
  const busca = `<input id="busca" placeholder="Buscar funcionário" value="${esc(V.busca)}" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin-top:8px">`;
  const med = D.av.length ? (D.av.reduce((a, x) => a + (+x.media || 0), 0) / D.av.length).toFixed(1).replace('.', ',') : '—';
  const head = `<div class="kpis">${kpi('Experiências a avaliar', exp.length, exp.length ? 'warn' : '')}${kpi('Anuais pendentes', P.length - exp.length)}${kpi('Avaliações feitas', D.av.length)}${kpi('Nota média', med)}</div>`;
  if (V.tab === 'adv') return rAdv(head, filt, busca);
  if (V.tab === 'nota') return rNota(head, filt, busca);
  if (V.tab === 'pend') {
    $('#body').innerHTML = head + `<div class="card"><div class="ct">A avaliar</div><p class="cs">Experiência: quem completa 45 ou 90 dias entre 30 dias atrás e as próximas 2 semanas. Anual: quem tem mais de 1 ano e não foi avaliado nos últimos 12 meses.</p>${busca}</div>
      <div class="card">${filt(P).slice(0, 300).map(p => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><div style="flex:1"><b>${esc(p.f.nome)}</b><br><span style="font-size:12px;color:var(--muted)">${esc(p.f.funcao || '')} · admissão ${fmtD(p.f.admissao)} · ${TIPO[p.tipo]}${p.prazo ? ' até ' + fmtD(p.prazo) : ''}${p.prazo && p.prazo < hoje() ? ' · <b style="color:var(--bad)">atrasada</b>' : ''}</span></div><button class="btn sm primary" data-av="${esc(p.f.id)}|${p.tipo}" type="button">Avaliar</button></div>`).join('') || '<p class="cs">Ninguém para avaliar agora.</p>'}
      <div class="actions"><button class="btn sm ghost" id="outra" type="button">Avaliar outra pessoa</button></div></div>`;
    $('#outra').onclick = () => escolher();
  } else {
    const L = filt(D.av.slice().sort((a, b) => str(b.data).localeCompare(str(a.data))));
    $('#body').innerHTML = head + `<div class="card"><div style="display:flex;align-items:center;gap:8px"><div class="ct" style="flex:1;margin:0">Avaliações feitas</div><button class="btn sm ghost" id="exp" type="button">Exportar</button></div>${busca}</div>
      <div class="card">${L.map(a => `<button data-ver="${esc(a.id)}" type="button" style="display:flex;gap:8px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><div style="flex:1"><b>${esc(a.nome)}</b><br><span style="font-size:12px;color:var(--muted)">${TIPO[a.tipo] || a.tipo} · ${fmtD(a.data)} · ${esc(a.avaliador || '')} · ${esc(a.recomendacao || '')}</span></div><b style="font-size:18px">${esc(String(a.media).replace('.', ','))}</b></button>`).join('') || '<p class="cs">Nenhuma avaliação ainda.</p>'}</div>`;
    $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Avaliações de desempenho', cols: [{ t: 'Funcionário' }, { t: 'Função' }, { t: 'Tipo' }, { t: 'Data', tipo: 'data' }, { t: 'Avaliador' }].concat(COMP.map(([, t]) => ({ t: t.split(':')[0], tipo: 'num' }))).concat([{ t: 'Média', tipo: 'num' }, { t: 'Recomendação' }]),
      linhas: L.map(a => [a.nome, a.funcao, TIPO[a.tipo] || a.tipo, a.data, a.avaliador].concat(COMP.map(([k]) => +(a.notas || {})[k] || null)).concat([+a.media, a.recomendacao])), filtros: V.busca || 'Todas', arquivo: 'Avaliacoes de desempenho' });
  }
  const b = $('#busca'); if (b) b.oninput = () => { clearTimeout(b._t); b._t = setTimeout(() => { V.busca = b.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
}
function escolher() {
  sheet(`<div class="top"><h2>Avaliar</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div><label>Funcionário</label><select id="e-f" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:4px 0 10px">${D.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')).map(f => `<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</select>
    <label>Tipo</label><select id="e-t" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:4px 0 10px">${Object.entries(TIPO).map(([k, t]) => `<option value="${k}" ${k === 'anual' ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn big primary" id="e-ok" type="button">Continuar</button>`);
  $('#m-x').onclick = fechar; $('#e-ok').onclick = () => form($('#e-f').value, $('#e-t').value);
}
function form(fid, tipo) {
  const f = D.func.find(x => x.id === fid) || {}; const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
  sheet(`<div class="top"><h2>${esc(f.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div><p class="cs" style="margin:0 0 8px">${TIPO[tipo]} · ${esc(f.funcao || '')} · admissão ${fmtD(f.admissao)}</p>
    <p class="cs">1 = muito abaixo · 3 = atende · 5 = supera</p>
    ${COMP.map(([k, t]) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><div style="font-size:14px">${esc(t)}</div><div style="display:flex;gap:6px;margin-top:4px">${[1, 2, 3, 4, 5].map(n => `<label style="display:flex;gap:3px;align-items:center"><input type="radio" name="n-${k}" value="${n}"> ${n}</label>`).join('')}</div></div>`).join('')}
    <label style="margin-top:8px;display:block">Pontos fortes</label><textarea id="a-pf" rows="2" style="${inp}"></textarea><label>O que precisa melhorar</label><textarea id="a-me" rows="2" style="${inp}"></textarea>
    <label>Recomendação</label><select id="a-rec" style="${inp}">${REC[tipo].map(r => `<option>${r}</option>`).join('')}</select>
    <button class="btn big primary" id="a-ok" type="button">Salvar avaliação</button>`);
  $('#m-x').onclick = fechar;
  $('#a-ok').onclick = async () => { const notas = {}; for (const [k] of COMP) { const r = document.querySelector(`input[name="n-${k}"]:checked`); if (!r) return toast('Dê nota a todas as competências.', 'bad'); notas[k] = +r.value; }
    const media = Math.round(Object.values(notas).reduce((a, b) => a + b, 0) / COMP.length * 10) / 10;
    const d = { fid, nome: str(f.nome), funcao: str(f.funcao), tipo, data: hoje(), avaliador: MEU, notas, media, pontos: $('#a-pf').value.trim(), melhorar: $('#a-me').value.trim(), recomendacao: $('#a-rec').value, criadoEm: new Date().toISOString() };
    try { await db.collection('avaliacoes').doc().set(d); toast('Avaliação salva (média ' + String(media).replace('.', ',') + ').', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
}
function ver(id) {
  const a = D.av.find(x => x.id === id); if (!a) return;
  sheet(`<div class="top"><h2>${esc(a.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div><p class="cs" style="margin:0 0 8px">${TIPO[a.tipo] || a.tipo} · ${fmtD(a.data)} · avaliador ${esc(a.avaliador || '')}</p>
    <div class="card">${COMP.map(([k, t]) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(t)}</span><b>${(a.notas || {})[k] || '—'}</b></div>`).join('')}<div style="display:flex;justify-content:space-between;padding:6px 0"><b>Média</b><b>${esc(String(a.media).replace('.', ','))}</b></div></div>
    ${a.pontos ? `<p><b>Pontos fortes:</b> ${esc(a.pontos)}</p>` : ''}${a.melhorar ? `<p><b>Melhorar:</b> ${esc(a.melhorar)}</p>` : ''}<p><b>Recomendação:</b> ${esc(a.recomendacao || '')}</p>`);
  $('#m-x').onclick = fechar;
}

/* ---------- Advertências (medidas disciplinares) ----------
   advertencias/{id} = { fid, nome, funcao, tipo: 'verbal'|'escrita'|'suspensao', dias, data, motivo, descricao, testemunhas, anexo, anexoNome,
                         ciencia: { sig, em } | null, recusou: bool, criadoPor, criadoEm } */
const TADV = { verbal: 'Advertência verbal (registrada)', escrita: 'Advertência escrita', suspensao: 'Suspensão' };
const MOTIVOS = ['Descumprimento de norma de segurança / não uso de EPI', 'Atraso ou falta injustificada', 'Abandono do posto de trabalho', 'Desrespeito / conduta inadequada', 'Descumprimento de ordem de serviço / procedimento', 'Dano a ferramenta ou equipamento por negligência', 'Outro'];
function padAss(cv) { const x = cv.getContext('2d'); let des = false, vazio = true; x.lineWidth = 2.4; x.lineCap = 'round'; x.strokeStyle = '#111';
  const pos = e => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; };
  const ini = e => { e.preventDefault(); des = true; vazio = false; const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); }, mov = e => { if (!des) return; e.preventDefault(); const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); }, fim = () => des = false;
  cv.addEventListener('mousedown', ini); cv.addEventListener('mousemove', mov); window.addEventListener('mouseup', fim); cv.addEventListener('touchstart', ini, { passive: false }); cv.addEventListener('touchmove', mov, { passive: false }); cv.addEventListener('touchend', fim);
  return { limpar: () => { x.clearRect(0, 0, cv.width, cv.height); vazio = true; }, vazio: () => vazio, dado: () => cv.toDataURL('image/png') }; }
const lerArq = f => new Promise((ok, err) => { const r = new FileReader(); r.onerror = err; r.onload = () => ok(r.result); r.readAsDataURL(f); });
function rAdv(head, filt, busca) {
  const ano = addDias(hoje(), -365); const L = filt(D.adv.slice().sort((a, b) => str(b.data).localeCompare(str(a.data))));
  const u = D.adv.filter(a => str(a.data) >= ano);
  $('#body').innerHTML = `<div class="kpis">${kpi('Medidas em 12 meses', u.length)}${kpi('Advertências escritas', u.filter(a => a.tipo === 'escrita').length, 'warn')}${kpi('Suspensões', u.filter(a => a.tipo === 'suspensao').length, u.some(a => a.tipo === 'suspensao') ? 'warn' : '')}${kpi('Sem ciência do funcionário', D.adv.filter(a => !a.ciencia && !a.recusou).length)}</div>
    <div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">Advertências e suspensões</div><button class="btn primary" id="adv-n" type="button">+ Registrar</button><button class="btn sm ghost" id="exp" type="button">Exportar</button></div>
    <p class="cs">Registre o fato logo depois que ele acontecer (a medida precisa ser imediata e proporcional). O funcionário assina a ciência; se recusar, marque a recusa e informe duas testemunhas.</p>${busca}</div>
    <div class="card">${L.map(a => `<button data-adv="${esc(a.id)}" type="button" style="display:flex;gap:8px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><div style="flex:1"><b>${esc(a.nome)}</b><br><span style="font-size:12px;color:var(--muted)">${TADV[a.tipo] || a.tipo}${a.tipo === 'suspensao' ? ' · ' + (a.dias || 0) + ' dia(s)' : ''} · ${fmtD(a.data)} · ${esc(a.motivo || '')}</span></div><span class="badge ${a.ciencia ? 'b-ok' : a.recusou ? 'b-warn' : 'b-mut'}">${a.ciencia ? 'Ciente' : a.recusou ? 'Recusou assinar' : 'Falta ciência'}</span></button>`).join('') || '<p class="cs">Nenhum registro.</p>'}</div>`;
  $('#adv-n').onclick = () => advForm();
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Advertências e suspensões', cols: [{ t: 'Funcionário' }, { t: 'Função' }, { t: 'Tipo' }, { t: 'Dias', tipo: 'num' }, { t: 'Data', tipo: 'data' }, { t: 'Motivo' }, { t: 'Ciência' }], linhas: L.map(a => [a.nome, a.funcao, TADV[a.tipo], a.tipo === 'suspensao' ? +a.dias || 0 : null, a.data, a.motivo, a.ciencia ? 'Ciente' : a.recusou ? 'Recusou (testemunhas)' : 'Pendente']), filtros: V.busca || 'Todas', arquivo: 'Advertencias' });
  bindBusca();
}
function advForm() {
  const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
  sheet(`<div class="top"><h2>Nova medida disciplinar</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <label>Funcionário</label><select id="v-f" style="${inp}">${D.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt')).map(f => `<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</select>
    <div style="display:flex;gap:10px"><div style="flex:2"><label>Tipo</label><select id="v-t" style="${inp}">${Object.entries(TADV).map(([k, t]) => `<option value="${k}" ${k === 'escrita' ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div style="flex:1" id="v-dw" hidden><label>Dias</label><input id="v-d" type="number" min="1" max="30" value="1" style="${inp}"></div></div>
    <label>Data do fato</label><input type="date" id="v-data" value="${hoje()}" style="${inp}">
    <label>Motivo</label><select id="v-m" style="${inp}">${MOTIVOS.map(m => `<option>${m}</option>`).join('')}</select>
    <label>Descrição do fato (o que, onde, quando)</label><textarea id="v-desc" rows="3" style="${inp}"></textarea>
    <label>Anexo (opcional: foto, documento assinado; até 700 KB)</label><input type="file" id="v-arq" accept="image/*,application/pdf" style="${inp}">
    <div class="card" style="margin:0 0 10px"><div class="ct">Ciência do funcionário</div><canvas id="v-sig" width="600" height="180" style="width:100%;height:120px;border:1px dashed #9aa3b2;border-radius:8px;background:#fff;touch-action:none"></canvas>
      <div class="actions"><button class="btn sm ghost" id="v-lim" type="button">Limpar</button></div>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="v-rec"> O funcionário se recusou a assinar</label>
      <div id="v-tw" hidden><label>Testemunhas (duas, nome completo)</label><input id="v-t1" placeholder="Testemunha 1" style="${inp}"><input id="v-t2" placeholder="Testemunha 2" style="${inp}"></div>
      <p class="cs" style="margin:0">Pode deixar sem assinatura e colher depois, abrindo o registro.</p></div>
    <button class="btn big primary" id="v-ok" type="button">Salvar</button>`);
  $('#m-x').onclick = fechar; const pad = padAss($('#v-sig')); $('#v-lim').onclick = () => pad.limpar();
  $('#v-t').onchange = () => { $('#v-dw').hidden = $('#v-t').value !== 'suspensao'; };
  $('#v-rec').onchange = () => { $('#v-tw').hidden = !$('#v-rec').checked; };
  $('#v-ok').onclick = async () => {
    const f = D.func.find(x => x.id === $('#v-f').value) || {}; const desc = $('#v-desc').value.trim(); if (!desc) return toast('Descreva o fato.', 'bad');
    const d = { fid: f.id, nome: str(f.nome), funcao: str(f.funcao), tipo: $('#v-t').value, dias: $('#v-t').value === 'suspensao' ? Math.min(30, Math.max(1, +$('#v-d').value || 1)) : 0, data: $('#v-data').value, motivo: $('#v-m').value, descricao: desc,
      ciencia: pad.vazio() ? null : { sig: pad.dado(), em: new Date().toISOString() }, recusou: $('#v-rec').checked, testemunhas: [$('#v-t1').value.trim(), $('#v-t2').value.trim()].filter(Boolean), criadoPor: MEU, criadoEm: new Date().toISOString() };
    if (d.recusou && d.testemunhas.length < 2) return toast('Com recusa, informe duas testemunhas.', 'bad');
    const arq = $('#v-arq').files[0]; if (arq) { if (arq.size > 700 * 1024) return toast('Anexo maior que 700 KB.', 'bad'); d.anexo = await lerArq(arq); d.anexoNome = arq.name; }
    try { await db.collection('advertencias').doc().set(d); toast('Registrado.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (publique as regras do Firestore).', 'bad'); }
  };
}
function advVer(id) {
  const a = D.adv.find(x => x.id === id); if (!a) return;
  sheet(`<div class="top"><h2>${esc(a.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <p class="cs" style="margin:0 0 8px">${TADV[a.tipo]}${a.tipo === 'suspensao' ? ' · ' + a.dias + ' dia(s)' : ''} · ${fmtD(a.data)} · registrado por ${esc(a.criadoPor || '')}</p>
    <div class="card"><b>${esc(a.motivo)}</b><p style="white-space:pre-wrap">${esc(a.descricao)}</p>${a.anexo ? `<a class="btn sm ghost" href="${a.anexo}" download="${esc(a.anexoNome || 'anexo')}">Baixar anexo</a>` : ''}</div>
    <div class="card"><div class="ct">Ciência</div>${a.ciencia ? `<img src="${a.ciencia.sig}" style="height:60px;background:#fff;border:1px solid var(--line);border-radius:6px"><p class="cs">Assinado em ${fmtD(a.ciencia.em)}</p>` : a.recusou ? `<p>Recusou assinar. Testemunhas: ${esc((a.testemunhas || []).join(' e '))}</p>` : `<canvas id="v-sig" width="600" height="180" style="width:100%;height:120px;border:1px dashed #9aa3b2;border-radius:8px;background:#fff;touch-action:none"></canvas><div class="actions"><button class="btn sm ghost" id="v-lim" type="button">Limpar</button><button class="btn sm primary" id="v-as" type="button">Gravar assinatura</button></div>`}</div>
    <div class="actions"><button class="btn danger" id="v-del" type="button">Excluir</button></div>`);
  $('#m-x').onclick = fechar;
  if ($('#v-sig')) { const pad = padAss($('#v-sig')); $('#v-lim').onclick = () => pad.limpar(); $('#v-as').onclick = async () => { if (pad.vazio()) return toast('Falta a assinatura.', 'bad'); try { await db.doc('advertencias/' + id).update({ ciencia: { sig: pad.dado(), em: new Date().toISOString() } }); toast('Ciência registrada.', 'ok'); fechar(); } catch (e) { toast('Não foi possível gravar.', 'bad'); } }; }
  $('#v-del').onclick = async () => { if (!confirm('Excluir de forma definitiva esta medida de ' + a.nome + '?')) return; try { await db.doc('advertencias/' + id).delete(); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}

/* ---------- Nota de promoção ----------
   Combina: avaliação do gestor, auditorias de piso/cruzadas (campo, tipo aud), treinamentos em dia e disciplina (advertências), últimos 12 meses.
   Assiduidade (faltas injustificadas e atrasos) entra quando o ponto do RHiD for importado. Atestados e faltas justificadas NÃO entram. */
const PESO = { av: 50, aud: 20, tr: 15, dis: 15 };
function notaDe(f) {
  const ano = addDias(hoje(), -365), out = {};
  const av = D.av.filter(a => a.fid === f.id).sort((a, b) => str(b.data).localeCompare(str(a.data)))[0];
  out.av = av ? Math.round(((+av.media || 1) - 1) / 4 * 100) : null; out.avRec = av ? av.recomendacao : '';
  const au = D.aud.filter(r => str(r.data) >= ano && (r.auditadosIds || []).includes(f.id) && r.conformidade != null);
  out.aud = au.length ? Math.round(au.reduce((x, r) => x + r.conformidade, 0) / au.length) : null; out.nAud = au.length;
  const tr = D.tr.filter(t => t.funcionarioId === f.id && t.validade); const ult = {}; tr.forEach(t => { const k = t.tipoId || t.tipoNome; if (!ult[k] || str(t.validade) > str(ult[k].validade)) ult[k] = t; });
  const U = Object.values(ult); out.tr = U.length ? Math.round(U.filter(t => str(t.validade) >= hoje()).length / U.length * 100) : null;
  const ad = D.adv.filter(a => a.fid === f.id && str(a.data) >= ano); out.nAdv = ad.length; out.susp = ad.some(a => a.tipo === 'suspensao');
  out.dis = Math.max(0, 100 - ad.reduce((x, a) => x + (a.tipo === 'suspensao' ? 50 : a.tipo === 'escrita' ? 25 : 10), 0));
  let soma = 0, pes = 0; for (const k of Object.keys(PESO)) if (out[k] != null) { soma += out[k] * PESO[k]; pes += PESO[k]; }
  out.nota = pes && out.av != null ? Math.round(soma / pes) : null;
  const exp = /^\d{4}-\d{2}-\d{2}/.test(str(f.admissao)) && str(f.admissao) > addDias(hoje(), -90);
  out.trava = exp ? 'Em experiência' : out.susp ? 'Suspensão nos últimos 12 meses' : out.av == null ? 'Sem avaliação do gestor' : '';
  out.faixa = out.trava ? out.trava : out.nota >= 85 ? 'Recomendado' : out.nota >= 70 ? 'Pode ser considerado' : out.nota >= 55 ? 'Desenvolver antes' : 'Não recomendado';
  return out;
}
const bar = v => v == null ? '<span class="cs">—</span>' : `<b>${v}</b>`;
function rNota(head, filt, busca) {
  const L = filt(D.func.filter(f => f.ativo !== false)).map(f => ({ f, n: notaDe(f) })).sort((a, b) => (b.n.nota ?? -1) - (a.n.nota ?? -1) || str(a.f.nome).localeCompare(str(b.f.nome), 'pt'));
  const cor = n => n.trava ? 'b-mut' : n.nota >= 85 ? 'b-ok' : n.nota >= 70 ? 'b-info' : n.nota >= 55 ? 'b-warn' : 'b-bad';
  $('#body').innerHTML = `<div class="kpis">${kpi('Recomendados (≥ 85)', L.filter(x => !x.n.trava && x.n.nota >= 85).length)}${kpi('Podem ser considerados (70–84)', L.filter(x => !x.n.trava && x.n.nota >= 70 && x.n.nota < 85).length)}${kpi('Com trava', L.filter(x => x.n.trava).length)}${kpi('Sem avaliação', L.filter(x => x.n.av == null).length, 'warn')}</div>
    <div class="card"><div style="display:flex;gap:8px;align-items:center"><div class="ct" style="flex:1;margin:0">Nota de promoção (0 a 100, últimos 12 meses)</div><button class="btn sm ghost" id="exp" type="button">Exportar</button></div>
    <p class="cs">Avaliação do gestor ${PESO.av}% · Auditorias de piso/cruzadas ${PESO.aud}% · Treinamentos em dia ${PESO.tr}% · Disciplina ${PESO.dis}% (verbal −10, escrita −25, suspensão −50). Sem dado num bloco, o peso dele é redistribuído.
    Assiduidade (faltas injustificadas e atrasos) entra quando o ponto do RHiD for importado. Atestados e faltas justificadas não entram na nota. A nota é um apoio: a decisão é do gestor.</p>${busca}</div>
    <div class="card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;border-bottom:1px solid var(--line)"><th>Funcionário</th><th>Gestor</th><th>Auditorias</th><th>Treinam.</th><th>Disciplina</th><th>Nota</th><th>Indicação</th></tr></thead>
    <tbody>${L.slice(0, 400).map(({ f, n }) => `<tr style="border-bottom:1px solid var(--line)"><td style="padding:6px 4px"><b>${esc(f.nome)}</b><br><span style="color:var(--muted)">${esc(f.funcao || '')}</span></td><td>${bar(n.av)}</td><td>${bar(n.aud)}${n.nAud ? ` <span class="cs">(${n.nAud})</span>` : ''}</td><td>${bar(n.tr)}</td><td>${bar(n.dis)}${n.nAdv ? ` <span class="cs">(${n.nAdv})</span>` : ''}</td><td style="font-size:16px">${bar(n.nota)}</td><td><span class="badge ${cor(n)}">${esc(n.faixa)}</span></td></tr>`).join('')}</tbody></table></div>`;
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Nota de promoção', cols: [{ t: 'Funcionário' }, { t: 'Função' }, { t: 'Gestor', tipo: 'num' }, { t: 'Auditorias', tipo: 'num' }, { t: 'Treinamentos', tipo: 'num' }, { t: 'Disciplina', tipo: 'num' }, { t: 'Nota', tipo: 'num' }, { t: 'Indicação' }], linhas: L.map(({ f, n }) => [f.nome, f.funcao, n.av, n.aud, n.tr, n.dis, n.nota, n.faixa]), filtros: V.busca || 'Todos', arquivo: 'Nota de promocao' });
  bindBusca();
}
function bindBusca() { const b = $('#busca'); if (b) b.oninput = () => { clearTimeout(b._t); b._t = setTimeout(() => { V.busca = b.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); }; }
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const a = e.target.closest('[data-av]'); if (a) { const [f, tp] = a.dataset.av.split('|'); form(f, tp); return; }
  const v = e.target.closest('[data-ver]'); if (v) { ver(v.dataset.ver); return; }
  const w = e.target.closest('[data-adv]'); if (w) { advVer(w.dataset.adv); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || '';
  if (!['admin', 'gestao', 'gerente', 'rh'].includes(F.papelGeral)) { $('#body').innerHTML = '<div class="card">Só Administrador, Gestão, Gerente e RH.</div>'; return; }
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('advertencias').onSnapshot(s => { D.adv = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('campo').where('tipo', '==', 'aud').onSnapshot(s => { D.aud = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('treinamentos').onSnapshot(s => { D.tr = s.docs.map(d => { const x = d.data(); return { funcionarioId: x.funcionarioId, tipoId: x.tipoId, tipoNome: x.tipoNome, validade: x.validade }; }); render(); }, () => {});
  db.collection('avaliacoes').onSnapshot(s => { D.av = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão (publique as regras do Firestore).', 'bad'));
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
