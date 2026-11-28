/* Ocorrências e ações (NR-01 / ISO 45001, 9001 e 14001): qualquer pessoa da equipe registra pelo celular, com foto;
   o TST (ou gestão) investiga (causas, 5 porquês), define ações com responsável e prazo e verifica a eficácia.
   Dados: ocorrencias/{id}. Número OC-AAAA-NNNNN. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { V.det = ''; $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;

const TIPOS = { acidente_afast: 'Acidente com afastamento', acidente: 'Acidente sem afastamento', quase: 'Quase-acidente', condicao: 'Condição insegura', ambiental: 'Incidente ambiental',
  nc: 'Não conformidade', reclamacao: 'Reclamação do cliente', auditoria: 'Achado de auditoria', melhoria: 'Oportunidade de melhoria' };
const SST = ['acidente_afast', 'acidente', 'quase', 'condicao'];
const ST = { aberta: ['Aberta', 'b-bad'], investigacao: ['Em investigação', 'b-warn'], acoes: ['Ações em andamento', 'b-info'], verificacao: ['Verificar eficácia', 'b-info'], encerrada: ['Encerrada', 'b-ok'] };
const GRAV = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' };
const D = { oc: [], func: [] };
const V = { tab: 'lista', tipo: '', st: '', busca: '' };
let db = null, GESTOR = false, UID = '', MEU = '';
const badge = s => `<span class="badge ${(ST[s] || ['', 'b-mut'])[1]}">${esc((ST[s] || [s])[0])}</span>`;
const atrasada = a => a.status !== 'feita' && a.prazo && a.prazo < hoje();

function reduzir(file) {
  return new Promise((ok, err) => { const fr = new FileReader(); fr.onerror = err; fr.onload = () => { const im = new Image(); im.onerror = err; im.onload = () => {
    const k = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}

function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  ({ lista: rLista, acoes: rAcoes, ind: rInd })[V.tab]();
}
function filtrados() {
  let L = D.oc.slice().sort((a, b) => str(b.data + b.hora).localeCompare(str(a.data + a.hora)));
  if (V.tipo) L = L.filter(o => V.tipo === 'sst' ? SST.includes(o.tipo) : V.tipo === 'iso' ? !SST.includes(o.tipo) : o.tipo === V.tipo);
  if (V.st) L = L.filter(o => V.st === 'abertas' ? o.status !== 'encerrada' : o.status === V.st);
  if (V.busca) { const q = norm(V.busca); L = L.filter(o => norm([o.numero, o.titulo, o.descricao, o.local, (o.envolvidos || []).join(' ')].join(' ')).includes(q)); }
  return L;
}
function rLista() {
  const L = filtrados(); const ab = D.oc.filter(o => o.status !== 'encerrada'); const atr = D.oc.flatMap(o => (o.acoes || []).filter(atrasada)).length;
  const mes = hoje().slice(0, 7); const qm = D.oc.filter(o => o.tipo === 'quase' && str(o.data).startsWith(mes)).length;
  $('#body').innerHTML = `<div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">Ocorrências</div><button class="btn primary" id="nova" type="button">+ Registrar ocorrência</button></div>
    <div class="kpis" style="margin-top:10px">${kpi('Abertas', ab.length, ab.length ? 'warn' : '')}${kpi('Ações atrasadas', atr, atr ? 'warn' : '')}${kpi('Quase-acidentes no mês', qm)}${kpi('Dias sem acidente com afastamento', diasSemAfast())}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <select id="f-tipo" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todos os tipos</option><option value="sst" ${V.tipo === 'sst' ? 'selected' : ''}>Segurança (acidentes e quase)</option><option value="iso" ${V.tipo === 'iso' ? 'selected' : ''}>Qualidade e meio ambiente</option>${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${V.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="f-st" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todas</option><option value="abertas" ${V.st === 'abertas' ? 'selected' : ''}>Não encerradas</option>${Object.entries(ST).map(([k, [t]]) => `<option value="${k}" ${V.st === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input id="f-busca" placeholder="Buscar" value="${esc(V.busca)}" style="flex:1;min-width:140px;padding:8px;border:1px solid #cfd4dc;border-radius:8px">
      <button class="btn sm ghost" id="exp" type="button">Exportar</button></div></div>
    <div class="card">${L.length ? L.map(o => { const na = (o.acoes || []).length, nf = (o.acoes || []).filter(a => a.status === 'feita').length, at = (o.acoes || []).some(atrasada);
      return `<button class="item" data-oc="${esc(o.id)}" style="display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:10px 0;cursor:pointer">
        <div style="flex:1;min-width:0"><b>${esc(o.numero)}</b> · ${esc(TIPOS[o.tipo] || o.tipo)}${o.gravidade ? ' · ' + esc(GRAV[o.gravidade] || o.gravidade) : ''}<br><span>${esc(o.titulo)}</span><br><span style="font-size:12px;color:var(--muted)">${fmtD(o.data)}${o.hora ? ' ' + esc(o.hora) : ''} · ${esc(o.local || '—')}${na ? ` · ações ${nf}/${na}` : ''}${at ? ' · <b style="color:var(--bad)">ação atrasada</b>' : ''}</span></div>
        <div>${badge(o.status)}</div></button>`; }).join('') : '<p class="cs">Nenhuma ocorrência com esse filtro.</p>'}</div>`;
  $('#nova').onclick = () => form(null);
  $('#exp').onclick = exportar;
}
function diasSemAfast() { const a = D.oc.filter(o => o.tipo === 'acidente_afast').map(o => o.data).sort().pop(); if (!a) return '—'; return Math.max(0, Math.round((Date.parse(hoje()) - Date.parse(a)) / 864e5)); }
function rAcoes() {
  const A = []; D.oc.forEach(o => (o.acoes || []).forEach(a => A.push({ o, a })));
  const L = A.filter(x => x.a.status !== 'feita').sort((x, y) => str(x.a.prazo || '9').localeCompare(str(y.a.prazo || '9')));
  $('#body').innerHTML = `<div class="card"><div class="ct">Ações em aberto (${L.length})</div><p class="cs">Das ocorrências registradas. Atrasadas em vermelho.</p>
    ${L.length ? L.map(({ o, a }) => `<button class="item" data-oc="${esc(o.id)}" style="display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer">
      <b>${esc(a.o)}</b><br><span style="font-size:13px;color:${atrasada(a) ? 'var(--bad)' : 'var(--muted)'}">${esc(a.resp || 'sem responsável')} · prazo ${fmtD(a.prazo)}${atrasada(a) ? ' · ATRASADA' : ''} · ${esc(o.numero)} ${esc(o.titulo)}</span></button>`).join('') : '<p class="cs">Nenhuma ação em aberto.</p>'}</div>`;
}
function rInd() {
  const ano = hoje().slice(0, 4); const doAno = D.oc.filter(o => str(o.data).startsWith(ano)); const por = {}; doAno.forEach(o => por[o.tipo] = (por[o.tipo] || 0) + 1);
  const meses = Array.from({ length: 12 }, (_, i) => ano + '-' + String(i + 1).padStart(2, '0'));
  const max = Math.max(1, ...meses.map(m => doAno.filter(o => str(o.data).startsWith(m)).length));
  const A = D.oc.flatMap(o => o.acoes || []); const feitas = A.filter(a => a.status === 'feita'); const noPrazo = feitas.filter(a => !a.prazo || str(a.feitoEm).slice(0, 10) <= a.prazo).length;
  const encer = D.oc.filter(o => o.status === 'encerrada'), efic = encer.filter(o => o.eficacia && o.eficacia.ok).length;
  $('#body').innerHTML = `<div class="kpis">${kpi('Ocorrências em ' + ano, doAno.length)}${kpi('Acidentes com afastamento', por.acidente_afast || 0, por.acidente_afast ? 'warn' : '')}${kpi('Quase-acidentes', por.quase || 0)}${kpi('Não conformidades', (por.nc || 0) + (por.auditoria || 0))}${kpi('Ações no prazo', feitas.length ? Math.round(noPrazo / feitas.length * 100) + '%' : '—')}${kpi('Ações eficazes', encer.length ? Math.round(efic / encer.length * 100) + '%' : '—')}</div>
    <div class="card" style="margin-top:12px"><div class="ct">Por mês (${ano})</div>${meses.map(m => { const n = doAno.filter(o => str(o.data).startsWith(m)).length; return `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin:3px 0"><span style="width:60px">${m.slice(5)}/${ano}</span><span style="flex:1;background:var(--mut-bg);border-radius:4px;height:14px"><span style="display:block;height:14px;border-radius:4px;background:var(--s1);width:${n / max * 100}%"></span></span><span style="width:28px;text-align:right">${n}</span></div>`; }).join('')}</div>
    <div class="card"><div class="ct">Por tipo (${ano})</div>${Object.entries(TIPOS).map(([k, t]) => `<div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px solid var(--line)"><span>${t}</span><b>${por[k] || 0}</b></div>`).join('')}
    <p class="cs" style="margin-top:8px">A pirâmide de Bird mostra que muitos quase-acidentes registrados indicam uma equipe que relata e previne; poucos registros costumam ser falta de relato, não falta de risco.</p></div>`;
}

function form(o) {
  const x = o || { tipo: 'quase', data: hoje(), hora: new Date().toTimeString().slice(0, 5), status: 'aberta', fotos: [], envolvidos: [] };
  const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
  sheet(`<div class="top"><h2>${o ? 'Editar ' + esc(o.numero) : 'Registrar ocorrência'}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <label>Tipo</label><select id="o-tipo" style="${inp}">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <div style="display:flex;gap:10px"><div style="flex:1"><label>Data</label><input type="date" id="o-data" value="${esc(x.data)}" style="${inp}"></div><div style="flex:1"><label>Hora</label><input type="time" id="o-hora" value="${esc(x.hora || '')}" style="${inp}"></div></div>
    <label>O que aconteceu (resumo)</label><input id="o-tit" value="${esc(x.titulo || '')}" placeholder="Ex.: ferramenta caiu da plataforma" style="${inp}">
    <label>Descrição</label><textarea id="o-desc" rows="4" style="${inp}">${esc(x.descricao || '')}</textarea>
    <label>Local / área</label><input id="o-loc" value="${esc(x.local || '')}" placeholder="Ex.: Trefilaria, ATT2" style="${inp}">
    <label>Pessoas envolvidas</label><input id="o-env" list="dl-func" value="${esc((x.envolvidos || []).join(', '))}" placeholder="Nomes, separados por vírgula" style="${inp}"><datalist id="dl-func">${D.func.filter(f => f.ativo !== false).map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist>
    <label>Gravidade (real ou potencial)</label><select id="o-grav" style="${inp}"><option value="">—</option>${Object.entries(GRAV).map(([k, t]) => `<option value="${k}" ${x.gravidade === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <label>Ação imediata tomada</label><input id="o-imed" value="${esc(x.imediata || '')}" style="${inp}">
    <label>Fotos (até 3)</label><input type="file" id="o-fot" accept="image/*" multiple style="${inp}"><div id="o-fv" style="display:flex;gap:6px;flex-wrap:wrap">${(x.fotos || []).map(f => `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:6px">`).join('')}</div>
    <button class="btn big primary" id="o-ok" type="button" style="margin-top:12px">${o ? 'Salvar' : 'Registrar'}</button>`);
  let fotos = (x.fotos || []).slice();
  $('#o-fot').onchange = async e => { for (const f of [...e.target.files].slice(0, 3)) fotos.push(await reduzir(f)); fotos = fotos.slice(-3); $('#o-fv').innerHTML = fotos.map(f => `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:6px">`).join(''); };
  $('#m-x').onclick = fechar;
  $('#o-ok').onclick = async () => {
    const d = { tipo: $('#o-tipo').value, data: $('#o-data').value, hora: $('#o-hora').value, titulo: $('#o-tit').value.trim(), descricao: $('#o-desc').value.trim(), local: $('#o-loc').value.trim(),
      envolvidos: $('#o-env').value.split(',').map(s => s.trim()).filter(Boolean), gravidade: $('#o-grav').value, imediata: $('#o-imed').value.trim(), fotos };
    if (!d.titulo || !d.data) return toast('Informe o resumo e a data.', 'bad');
    const b = $('#o-ok'); b.disabled = true;
    try {
      if (o) await db.doc('ocorrencias/' + o.id).set(d, { merge: true });
      else { const r = db.collection('ocorrencias').doc(); Object.assign(d, { numero: 'OC-' + d.data.slice(0, 4) + '-' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0'), status: 'aberta', acoes: [], criadoPor: MEU, criadoUid: UID, criadoEm: new Date().toISOString() }); await r.set(d); }
      toast(o ? 'Salvo.' : 'Ocorrência registrada. O TST vai analisar.', 'ok'); fechar();
    } catch (e) { b.disabled = false; toast('Não foi possível salvar (permissão ou fotos grandes demais).', 'bad'); }
  };
}

function detalhe(id) {
  const o = D.oc.find(x => x.id === id); if (!o) return; const A = o.acoes || [];
  const pode = GESTOR; const inp = 'width:100%;padding:8px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 8px';
  const pq = o.porques || [];
  sheet(`<div class="top"><h2>${esc(o.numero)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <p style="margin:0 0 6px">${badge(o.status)} · ${esc(TIPOS[o.tipo] || o.tipo)}${o.gravidade ? ' · ' + esc(GRAV[o.gravidade]) : ''}</p>
    <div class="card"><b>${esc(o.titulo)}</b><p style="margin:6px 0;white-space:pre-wrap">${esc(o.descricao || '')}</p>
      <p class="cs" style="margin:0">${fmtD(o.data)} ${esc(o.hora || '')} · ${esc(o.local || '—')} · envolvidos: ${esc((o.envolvidos || []).join(', ') || '—')} · registrado por ${esc(o.criadoPor || '—')}</p>
      ${o.imediata ? `<p class="cs" style="margin:6px 0 0">Ação imediata: ${esc(o.imediata)}</p>` : ''}
      ${(o.fotos || []).length ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${o.fotos.map(f => `<a href="${f}" target="_blank" rel="noopener"><img src="${f}" style="width:96px;height:96px;object-fit:cover;border-radius:6px"></a>`).join('')}</div>` : ''}
      ${pode || (o.criadoUid === UID && o.status === 'aberta') ? '<button class="btn sm ghost" id="d-ed" type="button" style="margin-top:8px">Editar registro</button>' : ''}</div>
    <div class="card"><div class="ct">Investigação</div>
      ${pode ? `<label>Por que aconteceu? (5 porquês)</label>${[0, 1, 2, 3, 4].map(i => `<input data-pq="${i}" value="${esc(pq[i] || '')}" placeholder="${i + 1}º porquê" style="${inp}">`).join('')}
        <label>Causa raiz</label><input id="d-causa" value="${esc(o.causa || '')}" style="${inp}"><button class="btn sm ghost" id="d-inv" type="button">Salvar investigação</button>`
      : `${pq.filter(Boolean).map((p, i) => `<p class="cs" style="margin:2px 0">${i + 1}. ${esc(p)}</p>`).join('') || '<p class="cs">Ainda não investigada.</p>'}${o.causa ? `<p><b>Causa raiz:</b> ${esc(o.causa)}</p>` : ''}`}</div>
    <div class="card"><div class="ct">Ações (${A.filter(a => a.status === 'feita').length}/${A.length} feitas)</div>
      ${A.map((a, i) => `<div style="border-bottom:1px solid var(--line);padding:6px 0"><b>${esc(a.o)}</b><br><span class="cs" style="color:${atrasada(a) ? 'var(--bad)' : ''}">${esc(a.resp || '—')} · prazo ${fmtD(a.prazo)} · ${a.status === 'feita' ? 'feita em ' + fmtD(a.feitoEm) + (a.evid ? ' · ' + esc(a.evid) : '') : atrasada(a) ? 'ATRASADA' : 'pendente'}</span>
        ${pode && a.status !== 'feita' ? ` <button class="btn sm ghost" data-feita="${i}" type="button">Marcar feita</button>` : ''}</div>`).join('') || '<p class="cs">Nenhuma ação.</p>'}
      ${pode ? `<div style="margin-top:8px"><input id="a-o" placeholder="O que fazer" style="${inp}"><div style="display:flex;gap:8px"><input id="a-r" list="dl-func2" placeholder="Responsável" style="${inp};flex:2"><input id="a-p" type="date" style="${inp};flex:1"></div><datalist id="dl-func2">${D.func.filter(f => f.ativo !== false).map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist><button class="btn sm ghost" id="a-add" type="button">+ Adicionar ação</button></div>` : ''}</div>
    <div class="card"><div class="ct">Verificação de eficácia</div>
      ${o.eficacia ? `<p>${o.eficacia.ok ? '✅ Eficaz' : '❌ Não eficaz'} · ${esc(o.eficacia.texto || '')} · ${esc(o.eficacia.por || '')} em ${fmtD(o.eficacia.em)}</p>` : '<p class="cs">Depois que as ações forem feitas, confira se o problema não voltou.</p>'}
      ${pode && A.length && A.every(a => a.status === 'feita') && o.status !== 'encerrada' ? `<input id="e-tx" placeholder="Como foi verificado" style="${inp}"><div class="actions"><button class="btn sm primary" data-efic="1" type="button">Eficaz: encerrar</button><button class="btn sm danger" data-efic="0" type="button">Não eficaz: novas ações</button></div>` : ''}</div>`);
  $('#m-x').onclick = fechar;
  const ed = $('#d-ed'); if (ed) ed.onclick = () => form(o);
  const salva = async (d, msg) => { try { await db.doc('ocorrencias/' + o.id).set(d, { merge: true }); toast(msg || 'Salvo.', 'ok'); Object.assign(o, d); const cur = D.oc.find(x => x.id === o.id); if (cur && cur !== o) Object.assign(cur, d); V.det = o.id; detalhe(o.id); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
  if (!pode) return;
  $('#d-inv').onclick = () => salva({ porques: $$('[data-pq]').map(i => i.value.trim()), causa: $('#d-causa').value.trim(), status: o.status === 'aberta' ? 'investigacao' : o.status }, 'Investigação salva.');
  $('#a-add').onclick = () => { const a = { id: Math.random().toString(36).slice(2, 9), o: $('#a-o').value.trim(), resp: $('#a-r').value.trim(), prazo: $('#a-p').value, status: 'pendente' }; if (!a.o) return toast('Escreva a ação.', 'bad');
    salva({ acoes: A.concat([a]), status: ['aberta', 'investigacao'].includes(o.status) ? 'acoes' : o.status }, 'Ação adicionada.'); };
  $$('[data-feita]').forEach(b => b.onclick = () => { const ev = prompt('Evidência (o que foi feito / onde está o registro):', '') ; if (ev === null) return; const L = A.map((a, i) => i === +b.dataset.feita ? Object.assign({}, a, { status: 'feita', feitoEm: hoje(), evid: ev.trim(), feitoPor: MEU }) : a);
    salva({ acoes: L, status: L.every(a => a.status === 'feita') ? 'verificacao' : o.status }, 'Ação concluída.'); });
  $$('[data-efic]').forEach(b => b.onclick = () => { const ok = b.dataset.efic === '1'; salva({ eficacia: { ok, texto: $('#e-tx').value.trim(), por: MEU, em: hoje() }, status: ok ? 'encerrada' : 'acoes' }, ok ? 'Ocorrência encerrada.' : 'Registre as novas ações.'); });
}

function exportar() {
  const L = filtrados();
  PrevRel.escolher({ modelo: 'rel_ocorrencias_sst', titulo: 'Ocorrências e ações', cols: [{ t: 'Número' }, { t: 'Data', tipo: 'data' }, { t: 'Tipo' }, { t: 'Gravidade' }, { t: 'Resumo' }, { t: 'Local' }, { t: 'Causa raiz' }, { t: 'Ações (feitas/total)' }, { t: 'Situação' }],
    linhas: L.map(o => [o.numero, o.data, TIPOS[o.tipo] || o.tipo, GRAV[o.gravidade] || '', o.titulo, o.local, o.causa || '', (o.acoes || []).filter(a => a.status === 'feita').length + '/' + (o.acoes || []).length, (ST[o.status] || [o.status])[0]]),
    filtros: [V.tipo && (TIPOS[V.tipo] || V.tipo), V.st, V.busca].filter(Boolean).join(' · ') || 'Todas', arquivo: 'Ocorrencias' });
}

document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const oc = e.target.closest('[data-oc]'); if (oc) { V.det = oc.dataset.oc; detalhe(oc.dataset.oc); return; }
  if (e.target.id === 'modal') fechar();
});
document.addEventListener('change', e => { if (e.target.id === 'f-tipo') { V.tipo = e.target.value; render(); } if (e.target.id === 'f-st') { V.st = e.target.value; render(); } });
let tb; document.addEventListener('input', e => { if (e.target.id === 'f-busca') { clearTimeout(tb); tb = setTimeout(() => { V.busca = e.target.value; render(); const i = $('#f-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } });

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; GESTOR = ['admin', 'gerente', 'gestao', 'tst'].includes(F.papel); UID = F.uid || ''; MEU = F.nome || '';
  db.collection('ocorrencias').onSnapshot(s => { D.oc = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); const ae = document.activeElement; if (!$('#modal').hidden && V.det && $('#sheet [data-pq]') && !(ae && ae.closest && ae.closest('#sheet') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) detalhe(V.det); }, () => toast('Sem permissão para ver as ocorrências.', 'bad'));
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
  render();
})();
