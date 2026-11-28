/* Checklist de desligamento: o RH abre o desligamento e vai marcando cada etapa. O portal mostra o que a pessoa ainda tem
   (cautelas de ferramentas abertas, EPIs entregues) e, no fim, marca o funcionário como desligado no cadastro (com data, tipo e motivo,
   os mesmos campos do cadastro de Ferramentas & EPI). Dados: desligamentos/{funcionarioId}. Gate: módulo Admissão (RH). */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { V.ver = ''; $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const DEM_TIPO = ['Pedido de demissão', 'Dispensa sem justa causa', 'Dispensa por justa causa', 'Término do contrato de experiência', 'Término de contrato por prazo determinado', 'Acordo entre as partes', 'Encerramento de contrato PJ', 'Aposentadoria', 'Falecimento', 'Outro'];
const DEM_MOT = ['Desempenho', 'Assiduidade (faltas e atrasos)', 'Comportamento e disciplina', 'Descumprimento de normas de segurança', 'Adaptação à função', 'Redução de quadro', 'Fim de contrato ou obra no cliente', 'Proposta de outra empresa', 'Salário e benefícios', 'Mudança de cidade', 'Motivos pessoais ou familiares', 'Saúde', 'Aposentadoria', 'Outro'];
const AVISO = ['Trabalhado', 'Indenizado', 'Dispensado', 'Não se aplica'];
/* etapas: [chave, texto, ajuda] */
const ETAPAS = [
  ['comunicado', 'Comunicado de desligamento entregue e assinado', 'Ou pedido de demissão do funcionário.'],
  ['aviso', 'Aviso prévio definido e registrado', ''],
  ['ferramentas', 'Ferramentas devolvidas (cautelas fechadas)', 'O portal mostra as cautelas abertas da pessoa.'],
  ['epi', 'EPIs devolvidos ou baixados', 'Crachá, uniforme, cinto e o que for de devolução.'],
  ['demissional', 'Exame demissional (ASO) feito', 'Informe a data e se ficou apto.'],
  ['contab', 'Documentos enviados à contabilidade (rescisão)', ''],
  ['acessos', 'Acessos bloqueados', 'Roleta/crachá da ArcelorMittal, RHiD, usuário do portal e grupos.'],
  ['cliente', 'Cliente avisado (desmobilização na ArcelorMittal)', ''],
  ['entrevista', 'Entrevista de desligamento feita', 'Ajuda a entender o turnover.'],
  ['homolog', 'Rescisão paga e assinada', ''],
  ['arquivo', 'Documentos arquivados (pasta do funcionário vai para o Arquivo morto)', 'O script do Drive move a pasta para "03 - Desligados" quando o cadastro fica desligado.']
];
const PERG = ['O que mais te motivou a sair (ou o que levou ao desligamento)?', 'Como foi a relação com a liderança?', 'Você recebeu os treinamentos e EPIs necessários?', 'O que a Previne pode melhorar?', 'Voltaria a trabalhar na Previne?'];
const D = { func: [], ds: {}, caut: [], ent: [] };
const V = { tab: 'and', busca: '' };
let db = null, PODE = false, MEU = '';
const funcBy = id => D.func.find(f => f.id === id) || {};

function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const and = Object.values(D.ds).filter(d => d.status !== 'concluido'), fim = Object.values(D.ds).filter(d => d.status === 'concluido');
  if (V.tab === 'novo') {
    let L = D.func.filter(f => f.ativo !== false && !(D.ds[f.id] && D.ds[f.id].status !== 'concluido'));
    if (V.busca) { const q = norm(V.busca); L = L.filter(f => norm(f.nome).includes(q) || str(f.matricula).includes(q)); }
    L.sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
    $('#body').innerHTML = `<div class="card"><div class="ct">Iniciar desligamento</div><input id="busca" placeholder="Buscar funcionário ativo" value="${esc(V.busca)}" style="width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px"></div>
      <div class="card">${L.slice(0, 200).map(f => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><div style="flex:1"><b>${esc(f.nome)}</b><br><span style="font-size:12px;color:var(--muted)">${esc(f.matricula || '')} · ${esc(f.funcao || '')}</span></div>${PODE ? `<button class="btn sm ghost" data-ini="${esc(f.id)}" type="button">Iniciar</button>` : ''}</div>`).join('') || '<p class="cs">Ninguém encontrado.</p>'}</div>`;
    return;
  }
  const L = (V.tab === 'and' ? and : fim).sort((a, b) => str(b.data).localeCompare(str(a.data)));
  $('#body').innerHTML = `<div class="kpis">${kpiH('Em andamento', and.length)}${kpiH('Concluídos', fim.length)}${kpiH('Com ferramenta em posse', and.filter(d => cautAbertas(d.fid).length).length)}</div>
    <div class="card">${L.map(d => { const n = ETAPAS.filter(([k]) => (d.etapas || {})[k]).length; const ca = cautAbertas(d.fid).length;
      return `<button data-ver="${esc(d.fid)}" type="button" style="display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:10px 0;cursor:pointer">
        <div style="flex:1"><b>${esc(d.nome)}</b><br><span style="font-size:12px;color:var(--muted)">Saída ${fmtD(d.data)} · ${esc(d.tipo || '—')}${ca ? ` · <b style="color:var(--bad)">${ca} cautela(s) aberta(s)</b>` : ''}</span></div>
        <div style="text-align:right"><b>${n}/${ETAPAS.length}</b><br><span style="font-size:12px;color:var(--muted)">etapas</span></div></button>`; }).join('') || `<p class="cs">${V.tab === 'and' ? 'Nenhum desligamento em andamento.' : 'Nenhum desligamento concluído.'}</p>`}</div>`;
}
const kpiH = (t, n) => `<div class="kpi"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const cautAbertas = fid => D.caut.filter(c => c.funcionarioId === fid && c.status === 'aberta');

function iniciar(fid) {
  const f = funcBy(fid); const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
  sheet(`<div class="top"><h2>Desligamento · ${esc(f.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <label>Data da saída</label><input type="date" id="d-data" value="${hoje()}" style="${inp}">
    <label>Tipo</label><select id="d-tipo" style="${inp}">${DEM_TIPO.map(t => `<option>${t}</option>`).join('')}</select>
    <label>Motivo</label><select id="d-mot" style="${inp}"><option value="">— escolha —</option>${DEM_MOT.map(t => `<option>${t}</option>`).join('')}</select>
    <label>Aviso prévio</label><select id="d-av" style="${inp}">${AVISO.map(t => `<option>${t}</option>`).join('')}</select>
    <label>Observação (só a gestão vê)</label><input id="d-obs" style="${inp}">
    <button class="btn big primary" id="d-ok" type="button">Abrir o checklist</button>`);
  $('#m-x').onclick = fechar;
  $('#d-ok').onclick = async () => { const d = { fid, nome: str(f.nome), matricula: str(f.matricula), funcao: str(f.funcao), data: $('#d-data').value, tipo: $('#d-tipo').value, motivo: $('#d-mot').value, aviso: $('#d-av').value, obs: $('#d-obs').value.trim(), etapas: {}, status: 'andamento', abertoPor: MEU, abertoEm: new Date().toISOString() };
    if (!d.data || !d.motivo) return toast('Informe a data e o motivo.', 'bad');
    try { await db.doc('desligamentos/' + fid).set(d); toast('Checklist aberto.', 'ok'); V.tab = 'and'; ver(fid); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
}
function ver(fid) {
  V.ver = fid;
  const d = D.ds[fid] || {}; const f = funcBy(fid); const E = d.etapas = d.etapas || {}; const ca = cautAbertas(fid);
  const ents = D.ent.filter(x => x.funcionarioId === fid).sort((a, b) => str(b.data).localeCompare(str(a.data))).slice(0, 12);
  const inp = 'width:100%;padding:8px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 8px'; const ent = d.entrevista || {};
  sheet(`<div class="top"><h2>${esc(d.nome || f.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <p class="cs" style="margin:0 0 8px">Saída ${fmtD(d.data)} · ${esc(d.tipo)} · ${esc(d.motivo)} · aviso ${esc(d.aviso || '—')}${d.status === 'concluido' ? ` · <b>concluído em ${fmtD(d.concluidoEm)} por ${esc(d.concluidoPor || '')}</b>` : ''}</p>
    <div class="card"><div class="ct">O que a pessoa ainda tem</div>
      ${ca.length ? ca.map(c => `<p style="margin:3px 0"><b style="color:var(--bad)">Cautela ${esc(c.numero)}</b>: ${(c.itens || []).filter(i => !i.devolvido).map(i => esc(i.codigo + ' ' + i.descricao)).join(', ')}</p>`).join('') : '<p class="cs" style="margin:0">Nenhuma cautela de ferramenta aberta. ✅</p>'}
      ${ents.length ? `<p class="cs" style="margin:8px 0 2px">Últimas entregas de EPI:</p>${ents.map(x => `<p style="margin:2px 0;font-size:13px">${fmtD(x.data)} · ${esc((x.itens || []).map(i => i.nome || i.epiNome || '').filter(Boolean).join(', ') || x.numero)}</p>`).join('')}` : ''}</div>
    <div class="card"><div class="ct">Checklist</div>${ETAPAS.map(([k, t, h]) => { const e = E[k]; return `<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line)"><input type="checkbox" data-et="${k}" ${e ? 'checked' : ''} ${PODE && d.status !== 'concluido' ? '' : 'disabled'} style="margin-top:3px">
      <span style="flex:1">${esc(t)}${h ? `<br><span style="font-size:12px;color:var(--muted)">${esc(h)}</span>` : ''}${e ? `<br><span style="font-size:12px;color:var(--ok)">✔ ${esc(e.por || '')} em ${fmtD(e.em)}${e.nota ? ' · ' + esc(e.nota) : ''}</span>` : ''}${k === 'ferramentas' && ca.length && !e ? '<br><span style="font-size:12px;color:var(--bad)">Ainda há cautela aberta.</span>' : ''}</span></label>`; }).join('')}</div>
    <div class="card"><div class="ct">Entrevista de desligamento</div>${PERG.map((p, i) => `<label style="font-size:13px">${esc(p)}</label><textarea data-pg="${i}" rows="2" style="${inp}" ${PODE && d.status !== 'concluido' ? '' : 'disabled'}>${esc((ent.r || [])[i] || '')}</textarea>`).join('')}
      ${PODE && d.status !== 'concluido' ? '<button class="btn sm ghost" id="d-ent" type="button">Salvar entrevista</button>' : ''}</div>
    ${PODE && d.status !== 'concluido' ? `<div class="actions"><button class="btn danger" id="d-cancel" type="button">Cancelar desligamento</button><button class="btn primary" id="d-fim" type="button">Concluir e marcar como desligado</button></div>` : ''}`);
  $('#m-x').onclick = fechar;
  if (!PODE || d.status === 'concluido') return;
  $$('[data-et]').forEach(c => c.onchange = async () => { const k = c.dataset.et; let nota = '';
    if (c.checked && k === 'ferramentas' && ca.length && !confirm('Ainda há cautela aberta no Ferramentas & EPI. Marcar mesmo assim?')) { c.checked = false; return; }
    if (c.checked && k === 'demissional') { nota = prompt('Data do exame e resultado (ex.: 05/12/2026, apto):', '') || ''; }
    if (c.checked) E[k] = { por: MEU, em: new Date().toISOString(), nota }; else delete E[k];
    try { await db.doc('desligamentos/' + fid).update({ etapas: Object.assign({}, E) }); } catch (e) { toast('Não foi possível salvar.', 'bad'); } });
  $('#d-ent').onclick = async () => { try { await db.doc('desligamentos/' + fid).set({ entrevista: { r: $$('[data-pg]').map(t => t.value.trim()), por: MEU, em: new Date().toISOString() }, etapas: Object.assign(E, { entrevista: E.entrevista || { por: MEU, em: new Date().toISOString() } }) }, { merge: true }); toast('Entrevista salva.', 'ok'); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  $('#d-cancel').onclick = async () => { if (!confirm('Cancelar este desligamento? O checklist é apagado e o funcionário continua ativo.')) return; try { await db.doc('desligamentos/' + fid).delete(); toast('Desligamento cancelado.', 'ok'); fechar(); } catch (e) { toast('Não foi possível cancelar.', 'bad'); } };
  $('#d-fim').onclick = async () => {
    const falta = ETAPAS.filter(([k]) => !E[k]).map(([, t]) => t);
    if (!confirm(`${falta.length ? `Faltam ${falta.length} etapa(s):\n- ${falta.join('\n- ')}\n\n` : ''}Concluir e marcar ${d.nome} como desligado no cadastro (saída ${fmtD(d.data)})?`)) return;
    try {
      await db.doc('funcionarios/' + fid).update({ ativo: false, demissao: d.data, demissaoTipo: d.tipo, demissaoMotivo: d.motivo, demissaoObs: d.obs || '', situacao: 'Desligado' });
      await db.doc('desligamentos/' + fid).set({ status: 'concluido', concluidoPor: MEU, concluidoEm: new Date().toISOString(), faltaram: falta }, { merge: true });
      toast('Desligamento concluído.', 'ok'); fechar();
    } catch (e) { toast('Não foi possível concluir (permissão?).', 'bad'); }
  };
}

document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const i = e.target.closest('[data-ini]'); if (i) { iniciar(i.dataset.ini); return; }
  const v = e.target.closest('[data-ver]'); if (v) { ver(v.dataset.ver); return; }
  if (e.target.id === 'modal') fechar();
});
let tb; document.addEventListener('input', e => { if (e.target.id === 'busca') { clearTimeout(tb); tb = setTimeout(() => { V.busca = e.target.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); } });
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || ''; PODE = F.papelGeral === 'admin' || ['rh', 'admin', 'gestao', 'gerente'].includes(F.papel) || ['gestao', 'gerente'].includes(F.papelGeral);
  const reabre = () => { render(); if (V.ver && !$('#modal').hidden && $('#sheet [data-et]') && !(document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox')) ver(V.ver); };
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão para ver os funcionários.', 'bad'));
  db.collection('desligamentos').onSnapshot(s => { D.ds = {}; s.docs.forEach(d => D.ds[d.id] = Object.assign({}, d.data(), { fid: d.id })); reabre(); }, () => {});
  db.collection('cautelas').where('status', '==', 'aberta').onSnapshot(s => { D.caut = s.docs.map(d => d.data()); render(); }, () => {});
  try { const q = await db.collection('entregas').get(); D.ent = q.docs.map(d => d.data()); } catch (e) {}
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
