/* Registros de campo (SST): DDS com assinatura dos participantes no celular, inspeções com checklist
   (item não conforme vira ocorrência "condição insegura") e observações comportamentais.
   campo/{id} = { tipo: 'dds'|'insp'|'obs', data, hora, local, resp, tema/modelo, conteudo, itens:[{t, st:'C'|'NC'|'NA', nota}], parts:[{fid, nome, sig}], fotos:[], numero } */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const MODELOS = {
  'EPI em uso': ['Capacete com jugular', 'Óculos de segurança', 'Protetor auricular', 'Luvas adequadas à tarefa', 'Calçado de segurança', 'Uniforme / vestimenta (NR-10 quando aplicável)', 'Cinto e talabarte (altura)', 'EPI em bom estado e com CA válido'],
  'Ferramentas e equipamentos': ['Ferramentas isoladas íntegras (NR-10)', 'Ferramentas manuais sem defeito', 'Extensões e cabos sem emenda', 'Equipamentos com inspeção em dia', 'Ferramentas identificadas (código)', 'Guarda e transporte corretos'],
  'Trabalho em altura': ['Permissão de trabalho emitida', 'Ponto de ancoragem adequado', 'Andaime/plataforma liberado', 'Área isolada e sinalizada', 'Trabalhadores com NR-35 e ASO apto', 'Resgate previsto'],
  'Bloqueio e etiquetagem (LOTO)': ['Energias identificadas', 'Cadeado e etiqueta pessoal de cada executante', 'Teste de ausência de energia', 'Liberação e desbloqueio registrados'],
  'Organização e limpeza (5S)': ['Área limpa e organizada', 'Rotas de fuga desobstruídas', 'Resíduos separados e destinados', 'Extintores acessíveis e sinalizados'],
  'Veículos': ['Documentação em dia', 'Pneus e freios', 'Cinto de segurança', 'Kit de emergência e extintor', 'Motorista habilitado']
};
const D = { reg: [], func: [] }; const V = { tab: 'dds' }; let db = null, MEU = '', UID = '', PODE = false;
function reduzir(file) { return new Promise((ok, err) => { const fr = new FileReader(); fr.onerror = err; fr.onload = () => { const im = new Image(); im.onerror = err; im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.7)); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
/* assinatura no dedo */
function padAss(cv) { const x = cv.getContext('2d'); let des = false, vazio = true; x.lineWidth = 2.4; x.lineCap = 'round'; x.strokeStyle = '#111';
  const pos = e => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; };
  const ini = e => { e.preventDefault(); des = true; vazio = false; const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); }, mov = e => { if (!des) return; e.preventDefault(); const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); }, fim = () => des = false;
  cv.addEventListener('mousedown', ini); cv.addEventListener('mousemove', mov); window.addEventListener('mouseup', fim); cv.addEventListener('touchstart', ini, { passive: false }); cv.addEventListener('touchmove', mov, { passive: false }); cv.addEventListener('touchend', fim);
  return { limpar: () => { x.clearRect(0, 0, cv.width, cv.height); vazio = true; }, vazio: () => vazio, dado: () => cv.toDataURL('image/png') }; }

function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const L = D.reg.filter(r => r.tipo === V.tab).sort((a, b) => str(b.data + b.hora).localeCompare(str(a.data + a.hora)));
  const mes = hoje().slice(0, 7); const noMes = L.filter(r => str(r.data).startsWith(mes));
  const ttl = { dds: 'Diálogos diários de segurança', insp: 'Inspeções de segurança', obs: 'Observações comportamentais' }[V.tab];
  const kp = V.tab === 'dds' ? kpi('DDS no mês', noMes.length) + kpi('Participações no mês', noMes.reduce((a, r) => a + (r.parts || []).length, 0))
    : V.tab === 'insp' ? kpi('Inspeções no mês', noMes.length) + kpi('Itens não conformes no mês', noMes.reduce((a, r) => a + (r.itens || []).filter(i => i.st === 'NC').length, 0), 'warn') + kpi('Conformidade', (() => { const I = noMes.flatMap(r => (r.itens || []).filter(i => i.st !== 'NA')); return I.length ? Math.round(I.filter(i => i.st === 'C').length / I.length * 100) + '%' : '—'; })())
    : kpi('Observações no mês', noMes.length) + kpi('Comportamentos de risco', noMes.filter(r => r.classe === 'risco').length, 'warn') + kpi('Comportamentos seguros', noMes.filter(r => r.classe === 'seguro').length);
  $('#body').innerHTML = `<div class="kpis">${kp}</div><div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">${ttl}</div><button class="btn primary" id="novo" type="button">+ Registrar</button><button class="btn sm ghost" id="exp" type="button">Exportar</button></div></div>
    <div class="card">${L.map(r => `<button data-reg="${esc(r.id)}" type="button" style="display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><b>${esc(r.numero)}</b> · ${esc(r.tema || r.modelo || (r.classe === 'risco' ? 'Comportamento de risco' : 'Comportamento seguro'))}<br><span style="font-size:12px;color:var(--muted)">${fmtD(r.data)} ${esc(r.hora || '')} · ${esc(r.local || '—')} · ${esc(r.resp || '')}${r.tipo === 'dds' ? ' · ' + (r.parts || []).length + ' participante(s)' : ''}${r.tipo === 'insp' ? ' · ' + (r.itens || []).filter(i => i.st === 'NC').length + ' não conforme(s)' : ''}</span></button>`).join('') || '<p class="cs">Nenhum registro ainda.</p>'}</div>`;
  $('#novo').onclick = () => novo(V.tab);
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: ttl, cols: [{ t: 'Número' }, { t: 'Data', tipo: 'data' }, { t: 'Local' }, { t: 'Responsável' }, { t: 'Tema / modelo' }, { t: V.tab === 'dds' ? 'Participantes' : V.tab === 'insp' ? 'Não conformes' : 'Classificação' }],
    linhas: L.map(r => [r.numero, r.data, r.local, r.resp, r.tema || r.modelo || r.descricao, V.tab === 'dds' ? (r.parts || []).length : V.tab === 'insp' ? (r.itens || []).filter(i => i.st === 'NC').length : (r.classe === 'risco' ? 'Risco' : 'Seguro')]), filtros: 'Todos', arquivo: ttl });
}
const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
function novo(tipo) {
  const base = `<div style="display:flex;gap:10px"><div style="flex:1"><label>Data</label><input type="date" id="c-data" value="${hoje()}" style="${inp}"></div><div style="flex:1"><label>Hora</label><input type="time" id="c-hora" value="${new Date().toTimeString().slice(0, 5)}" style="${inp}"></div></div>
    <label>Local / área</label><input id="c-loc" style="${inp}"><label>Responsável</label><input id="c-resp" value="${esc(MEU)}" style="${inp}"><datalist id="dl-f">${D.func.filter(f => f.ativo !== false).map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist>`;
  const corpo = tipo === 'dds' ? `<label>Tema</label><input id="c-tema" style="${inp}"><label>O que foi falado</label><textarea id="c-cont" rows="3" style="${inp}"></textarea>
      <div class="card" style="margin:0"><div class="ct">Participantes (cada um assina no celular)</div><div id="c-parts"></div>
      <input id="c-pn" list="dl-f" placeholder="Nome do participante" style="${inp}"><canvas id="c-sig" width="600" height="180" style="width:100%;height:120px;border:1px dashed #9aa3b2;border-radius:8px;background:#fff;touch-action:none"></canvas>
      <div class="actions"><button class="btn sm ghost" id="c-lim" type="button">Limpar</button><button class="btn sm primary" id="c-add" type="button">Adicionar assinatura</button></div></div>`
    : tipo === 'insp' ? `<label>Modelo de checklist</label><select id="c-mod" style="${inp}">${Object.keys(MODELOS).map(m => `<option>${m}</option>`).join('')}</select><div id="c-itens"></div>`
    : `<label>Classificação</label><select id="c-cl" style="${inp}"><option value="risco">Comportamento de risco</option><option value="seguro">Comportamento seguro</option></select><label>O que foi observado</label><textarea id="c-desc" rows="3" style="${inp}"></textarea><label>Orientação dada</label><input id="c-ori" style="${inp}"><label>Pessoa observada (opcional)</label><input id="c-pes" list="dl-f" style="${inp}">`;
  sheet(`<div class="top"><h2>${({ dds: 'Novo DDS', insp: 'Nova inspeção', obs: 'Nova observação' })[tipo]}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>${base}${corpo}
    <label>Fotos (até 3)</label><input type="file" id="c-fot" accept="image/*" multiple style="${inp}"><div id="c-fv" style="display:flex;gap:6px;flex-wrap:wrap"></div>
    <button class="btn big primary" id="c-ok" type="button" style="margin-top:10px">Salvar</button>`);
  $('#m-x').onclick = fechar; let fotos = []; const parts = [];
  $('#c-fot').onchange = async e => { for (const f of [...e.target.files].slice(0, 3)) fotos.push(await reduzir(f)); fotos = fotos.slice(-3); $('#c-fv').innerHTML = fotos.map(f => `<img src="${f}" style="width:70px;height:70px;object-fit:cover;border-radius:6px">`).join(''); };
  if (tipo === 'dds') { const pad = padAss($('#c-sig')); const lista = () => $('#c-parts').innerHTML = parts.map((p, i) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><img src="${p.sig}" style="height:34px;background:#fff;border:1px solid var(--line);border-radius:4px"><span style="flex:1">${i + 1}. ${esc(p.nome)}</span></div>`).join('');
    $('#c-lim').onclick = () => pad.limpar();
    $('#c-add').onclick = () => { const n = $('#c-pn').value.trim(); if (!n) return toast('Escreva o nome.', 'bad'); if (pad.vazio()) return toast('Falta a assinatura.', 'bad'); const f = D.func.find(x => norm(x.nome) === norm(n)); parts.push({ fid: f ? f.id : '', nome: f ? f.nome : n, sig: pad.dado() }); pad.limpar(); $('#c-pn').value = ''; lista(); }; }
  if (tipo === 'insp') { const itens = () => { const m = MODELOS[$('#c-mod').value] || []; $('#c-itens').innerHTML = m.map((t, i) => `<div style="border-bottom:1px solid var(--line);padding:6px 0"><div>${esc(t)}</div><div style="display:flex;gap:6px;margin-top:4px">${['C', 'NC', 'NA'].map(s => `<label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="radio" name="it${i}" value="${s}" ${s === 'C' ? 'checked' : ''}> ${({ C: 'Conforme', NC: 'Não conforme', NA: 'N/A' })[s]}</label>`).join('')}</div><input data-nota="${i}" placeholder="Observação (obrigatória se não conforme)" style="${inp};margin-top:4px"></div>`).join(''); };
    $('#c-mod').onchange = itens; itens(); }
  $('#c-ok').onclick = async () => {
    const d = { tipo, data: $('#c-data').value, hora: $('#c-hora').value, local: $('#c-loc').value.trim(), resp: $('#c-resp').value.trim(), fotos, criadoPor: MEU, criadoUid: UID, criadoEm: new Date().toISOString() };
    d.numero = ({ dds: 'DDS', insp: 'INS', obs: 'OBS' })[tipo] + '-' + d.data.replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 1e4)).padStart(4, '0');
    if (tipo === 'dds') { d.tema = $('#c-tema').value.trim(); d.conteudo = $('#c-cont').value.trim(); d.parts = parts; if (!d.tema) return toast('Informe o tema.', 'bad'); if (!parts.length) return toast('Colete ao menos uma assinatura.', 'bad'); }
    if (tipo === 'insp') { d.modelo = $('#c-mod').value; d.itens = (MODELOS[d.modelo] || []).map((t, i) => ({ t, st: (document.querySelector(`input[name="it${i}"]:checked`) || {}).value || 'C', nota: $(`[data-nota="${i}"]`).value.trim() }));
      if (d.itens.some(i => i.st === 'NC' && !i.nota)) return toast('Descreva os itens não conformes.', 'bad'); }
    if (tipo === 'obs') { d.classe = $('#c-cl').value; d.descricao = $('#c-desc').value.trim(); d.orientacao = $('#c-ori').value.trim(); d.pessoa = $('#c-pes').value.trim(); if (!d.descricao) return toast('Descreva o que foi observado.', 'bad'); }
    const b = $('#c-ok'); b.disabled = true;
    try {
      await db.collection('campo').doc().set(d);
      // item não conforme vira ocorrência para o TST tratar
      const nc = tipo === 'insp' ? d.itens.filter(i => i.st === 'NC') : [];
      for (const i of nc) await db.collection('ocorrencias').doc().set({ tipo: 'condicao', data: d.data, hora: d.hora, titulo: i.t + ' (inspeção ' + d.numero + ')', descricao: i.nota, local: d.local, envolvidos: [], gravidade: '', imediata: '', fotos: [], numero: 'OC-' + d.data.slice(0, 4) + '-' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0'), status: 'aberta', acoes: [], origem: d.numero, criadoPor: MEU, criadoUid: UID, criadoEm: new Date().toISOString() });
      if (tipo === 'obs' && d.classe === 'risco') await db.collection('ocorrencias').doc().set({ tipo: 'condicao', data: d.data, hora: d.hora, titulo: 'Comportamento de risco (observação ' + d.numero + ')', descricao: d.descricao + (d.orientacao ? '\nOrientação: ' + d.orientacao : ''), local: d.local, envolvidos: d.pessoa ? [d.pessoa] : [], fotos: [], numero: 'OC-' + d.data.slice(0, 4) + '-' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0'), status: 'aberta', acoes: [], origem: d.numero, criadoPor: MEU, criadoUid: UID, criadoEm: new Date().toISOString() });
      toast('Registrado' + (nc.length ? ` (${nc.length} não conformidade(s) enviada(s) para Ocorrências)` : '') + '.', 'ok'); fechar();
    } catch (e) { b.disabled = false; toast('Não foi possível salvar (permissão ou fotos grandes).', 'bad'); }
  };
}
function ver(id) {
  const r = D.reg.find(x => x.id === id); if (!r) return;
  sheet(`<div class="top"><h2>${esc(r.numero)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <p class="cs" style="margin:0 0 8px">${fmtD(r.data)} ${esc(r.hora || '')} · ${esc(r.local || '—')} · responsável ${esc(r.resp || '—')}</p>
    ${r.tipo === 'dds' ? `<div class="card"><b>${esc(r.tema)}</b><p style="white-space:pre-wrap">${esc(r.conteudo || '')}</p></div><div class="card"><div class="ct">Participantes (${(r.parts || []).length})</div>${(r.parts || []).map((p, i) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${i + 1}. ${esc(p.nome)}</span><img src="${p.sig}" style="height:34px;background:#fff"></div>`).join('')}</div>` : ''}
    ${r.tipo === 'insp' ? `<div class="card"><div class="ct">${esc(r.modelo)}</div>${(r.itens || []).map(i => `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${esc(i.t)}${i.nota ? `<br><span style="font-size:12px;color:var(--muted)">${esc(i.nota)}</span>` : ''}</span><span class="badge ${i.st === 'C' ? 'b-ok' : i.st === 'NC' ? 'b-bad' : 'b-mut'}">${({ C: 'Conforme', NC: 'Não conforme', NA: 'N/A' })[i.st]}</span></div>`).join('')}</div>` : ''}
    ${r.tipo === 'obs' ? `<div class="card"><b>${r.classe === 'risco' ? 'Comportamento de risco' : 'Comportamento seguro'}</b><p style="white-space:pre-wrap">${esc(r.descricao || '')}</p>${r.orientacao ? `<p class="cs">Orientação: ${esc(r.orientacao)}</p>` : ''}${r.pessoa ? `<p class="cs">Pessoa: ${esc(r.pessoa)}</p>` : ''}</div>` : ''}
    ${(r.fotos || []).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${r.fotos.map(f => `<a href="${f}" target="_blank" rel="noopener"><img src="${f}" style="width:90px;height:90px;object-fit:cover;border-radius:6px"></a>`).join('')}</div>` : ''}
    ${PODE ? '<div class="actions"><button class="btn danger" id="c-del" type="button">Excluir</button></div>' : ''}`);
  $('#m-x').onclick = fechar; const del = $('#c-del'); if (del) del.onclick = async () => { if (!confirm('Excluir o registro ' + r.numero + '?')) return; try { await db.doc('campo/' + id).delete(); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const r = e.target.closest('[data-reg]'); if (r) { ver(r.dataset.reg); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || ''; UID = F.uid || ''; PODE = ['admin', 'gerente', 'gestao', 'tst'].includes(F.papelGeral);
  db.collection('campo').onSnapshot(s => { D.reg = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão (publique as regras do Firestore).', 'bad'));
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
