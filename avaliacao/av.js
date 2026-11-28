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
const D = { func: [], av: [] }; const V = { tab: 'pend', busca: '' }; let db = null, MEU = '';
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
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const a = e.target.closest('[data-av]'); if (a) { const [f, tp] = a.dataset.av.split('|'); form(f, tp); return; }
  const v = e.target.closest('[data-ver]'); if (v) { ver(v.dataset.ver); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || '';
  if (!['admin', 'gestao', 'gerente', 'rh'].includes(F.papelGeral)) { $('#body').innerHTML = '<div class="card">Só Administrador, Gestão, Gerente e RH.</div>'; return; }
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('avaliacoes').onSnapshot(s => { D.av = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão (publique as regras do Firestore).', 'bad'));
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
