/* Requisitos legais (ISO 14001/45001 6.1.3) e licenças/vencimentos da empresa (PGR, PCMSO, AVCB, alvarás, laudos, certidões…).
   legais/{id} = { norma, titulo, aplica, evid, resp, verif, sit, obs }  ·  licencas/{id} = { item, orgao, numero, emissao, validade, link, resp, obs }
   A lista sugerida é só um ponto de partida: cada item fica "A verificar" até alguém confirmar. Vencimentos entram no resumo de segunda. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const addDias = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const SIT = { atende: ['Atende', 'b-ok'], parcial: ['Atende em parte', 'b-warn'], nao: ['Não atende', 'b-bad'], verificar: ['A verificar', 'b-mut'], na: ['Não se aplica', 'b-mut'] };
const SUG = [
  ['NR-01', 'Disposições gerais e gerenciamento de riscos ocupacionais (GRO/PGR)', 'Toda a empresa', 'PGR com inventário de riscos e plano de ação; IPARs'],
  ['NR-04', 'SESMT', 'Conforme grau de risco e nº de empregados', 'Dimensionamento do SESMT / TST'],
  ['NR-05', 'CIPA (ou designado)', 'Conforme dimensionamento', 'Atas, eleição ou designação, treinamento'],
  ['NR-06', 'Equipamento de proteção individual', 'Toda a operação', 'Fichas de EPI, CA válido, termos assinados'],
  ['NR-07', 'PCMSO', 'Todos os empregados', 'PCMSO vigente, ASOs admissional/periódico/demissional'],
  ['NR-10', 'Segurança em instalações e serviços em eletricidade', 'Eletricistas e quem atua em instalações', 'Treinamento básico e SEP, autorização, prontuário'],
  ['NR-11', 'Transporte e movimentação de materiais', 'Operadores de ponte/talha/empilhadeira', 'Treinamento e cartão de operador'],
  ['NR-12', 'Segurança em máquinas e equipamentos', 'Manutenção de máquinas', 'Treinamento, bloqueio (LOTO)'],
  ['NR-15', 'Atividades insalubres', 'Conforme laudo', 'LTCAT/laudo de insalubridade'],
  ['NR-16', 'Atividades perigosas', 'Conforme laudo (eletricidade)', 'Laudo de periculosidade'],
  ['NR-17', 'Ergonomia', 'Toda a empresa', 'AEP/AET'],
  ['NR-18', 'Construção civil (quando houver obra)', 'Obras', 'PGR da obra, treinamentos'],
  ['NR-20', 'Inflamáveis e combustíveis', 'Se houver manuseio', 'Treinamento'],
  ['NR-23', 'Proteção contra incêndio', 'Instalações da Previne', 'Extintores, AVCB, brigada'],
  ['NR-24', 'Condições sanitárias e de conforto', 'Instalações da Previne', 'Vestiário, refeitório'],
  ['NR-26', 'Sinalização e rotulagem (GHS)', 'Produtos químicos', 'FISPQ/FDS'],
  ['NR-33', 'Espaço confinado', 'Quem entra em espaço confinado', 'Treinamento, PET, vigia'],
  ['NR-35', 'Trabalho em altura', 'Quem trabalha acima de 2 m', 'Treinamento, ASO apto para altura, PT'],
  ['CLT / eSocial', 'Registro, jornada, folha e eventos de SST (S-2210, S-2220, S-2240)', 'Todos os empregados', 'Contabilidade, RHiD, ASO e CAT no eSocial'],
  ['Lei 13.709/2018', 'LGPD – proteção de dados pessoais', 'Dados de funcionários e candidatos', 'Termo LGPD, controle de acesso, registro de acessos'],
  ['Lei 12.305/2010', 'Política Nacional de Resíduos Sólidos', 'Resíduos gerados nos serviços', 'Destinação e MTR quando aplicável'],
  ['Requisitos do cliente', 'Normas e procedimentos da ArcelorMittal (integração, PT, CRC, Take Care)', 'Todos os mobilizados', 'Integração, CRC, documentação de mobilização']
];
const D = { leg: [], lic: [] }; const V = { tab: 'lic' }; let db = null, PODE = false, MEU = '';
const stLic = l => !l.validade ? ['Sem validade', 'b-mut'] : l.validade < hoje() ? ['Vencida', 'b-bad'] : l.validade <= addDias(60) ? ['Vence em ' + fmtD(l.validade), 'b-warn'] : ['Válida até ' + fmtD(l.validade), 'b-ok'];

function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  if (V.tab === 'lic') {
    const L = D.lic.slice().sort((a, b) => str(a.validade || '9').localeCompare(str(b.validade || '9')));
    const venc = L.filter(l => l.validade && l.validade < hoje()).length, vence = L.filter(l => l.validade >= hoje() && l.validade <= addDias(60)).length;
    $('#body').innerHTML = `<div class="kpis">${kpi('Licenças e documentos', L.length)}${kpi('Vencidos', venc, venc ? 'warn' : '')}${kpi('Vencem em 60 dias', vence, vence ? 'warn' : '')}</div>
      <div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">Licenças, laudos e documentos da empresa</div>${PODE ? '<button class="btn sm primary" id="nl" type="button">+ Adicionar</button>' : ''}<button class="btn sm ghost" id="exp" type="button">Exportar</button></div>
      <p class="cs">PGR, PCMSO, LTCAT, laudos de insalubridade/periculosidade, AVCB, alvará, certidões (FGTS, INSS, trabalhista), ISO 9001/14001/45001, seguro de vida… Os vencidos e os que vencem em 60 dias entram no resumo de segunda-feira.</p>
      ${L.map(l => `<button data-lic="${esc(l.id)}" type="button" style="display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><div style="flex:1"><b>${esc(l.item)}</b><br><span style="font-size:12px;color:var(--muted)">${esc([l.orgao, l.numero && 'nº ' + l.numero, l.resp].filter(Boolean).join(' · ') || '—')}</span></div><span class="badge ${stLic(l)[1]}">${esc(stLic(l)[0])}</span></button>`).join('') || '<p class="cs">Nada cadastrado ainda.</p>'}</div>`;
    const nl = $('#nl'); if (nl) nl.onclick = () => edLic(null);
    $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Licenças e vencimentos da empresa', cols: [{ t: 'Item' }, { t: 'Órgão' }, { t: 'Número' }, { t: 'Emissão', tipo: 'data' }, { t: 'Validade', tipo: 'data' }, { t: 'Situação' }, { t: 'Responsável' }], linhas: L.map(l => [l.item, l.orgao, l.numero, l.emissao, l.validade, stLic(l)[0], l.resp]), filtros: 'Todas', arquivo: 'Licencas e vencimentos' });
    return;
  }
  const L = D.leg.slice().sort((a, b) => str(a.norma).localeCompare(str(b.norma), 'pt', { numeric: true }));
  const c = k => L.filter(x => (x.sit || 'verificar') === k).length;
  $('#body').innerHTML = `<div class="kpis">${kpi('Requisitos', L.length)}${kpi('Atende', c('atende'))}${kpi('Em parte', c('parcial'), c('parcial') ? 'warn' : '')}${kpi('Não atende', c('nao'), c('nao') ? 'warn' : '')}${kpi('A verificar', c('verificar'))}</div>
    <div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">Requisitos legais e outros requisitos</div>${PODE ? `${L.length ? '' : '<button class="btn sm ghost" id="sug" type="button">Carregar lista sugerida</button>'}<button class="btn sm primary" id="ng" type="button">+ Adicionar</button>` : ''}<button class="btn sm ghost" id="exp" type="button">Exportar</button></div>
    <p class="cs">Para cada lei ou norma: a quem se aplica, como a Previne atende (evidência), quem cuida e quando foi verificado. A lista sugerida é um ponto de partida: revise cada item.</p>
    ${L.map(x => { const s = SIT[x.sit || 'verificar']; return `<button data-leg="${esc(x.id)}" type="button" style="display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><div style="flex:1"><b>${esc(x.norma)}</b> · ${esc(x.titulo)}<br><span style="font-size:12px;color:var(--muted)">${esc(x.evid || '—')}${x.verif ? ' · verificado em ' + fmtD(x.verif) : ''}</span></div><span class="badge ${s[1]}">${s[0]}</span></button>`; }).join('') || '<p class="cs">Nenhum requisito cadastrado.</p>'}</div>`;
  const sg = $('#sug'); if (sg) sg.onclick = async () => { sg.disabled = true; try { const b = db.batch(); SUG.forEach(([norma, titulo, aplica, evid]) => b.set(db.collection('legais').doc(), { norma, titulo, aplica, evid, sit: 'verificar', criadoPor: MEU, criadoEm: new Date().toISOString() })); await b.commit(); toast('Lista sugerida carregada. Revise cada item.', 'ok'); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); sg.disabled = false; } };
  const ng = $('#ng'); if (ng) ng.onclick = () => edLeg(null);
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Requisitos legais e outros requisitos', cols: [{ t: 'Norma/lei' }, { t: 'Assunto' }, { t: 'Aplica-se a' }, { t: 'Como atendemos (evidência)' }, { t: 'Responsável' }, { t: 'Verificado em', tipo: 'data' }, { t: 'Situação' }], linhas: L.map(x => [x.norma, x.titulo, x.aplica, x.evid, x.resp, x.verif, SIT[x.sit || 'verificar'][0]]), filtros: 'Todos', arquivo: 'Requisitos legais' });
}
const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
function edLic(id) {
  const l = D.lic.find(x => x.id === id) || {}; const ro = PODE ? '' : 'disabled';
  sheet(`<div class="top"><h2>${id ? esc(l.item) : 'Nova licença ou documento'}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    ${[['item', 'Item (ex.: PCMSO, AVCB, Alvará de funcionamento)'], ['orgao', 'Órgão / emissor'], ['numero', 'Número'], ['resp', 'Responsável'], ['link', 'Link do arquivo (Drive)'], ['obs', 'Observação']].map(([k, t]) => `<label>${t}</label><input id="l-${k}" value="${esc(l[k] || '')}" style="${inp}" ${ro}>`).join('')}
    <div style="display:flex;gap:10px"><div style="flex:1"><label>Emissão</label><input type="date" id="l-emissao" value="${esc(l.emissao || '')}" style="${inp}" ${ro}></div><div style="flex:1"><label>Validade</label><input type="date" id="l-validade" value="${esc(l.validade || '')}" style="${inp}" ${ro}></div></div>
    ${l.link ? `<p><a href="${esc(l.link)}" target="_blank" rel="noopener">Abrir o arquivo</a></p>` : ''}
    ${PODE ? `<div class="actions">${id ? '<button class="btn danger" id="l-del" type="button">Excluir</button>' : ''}<button class="btn primary" id="l-ok" type="button">Salvar</button></div>` : ''}`);
  $('#m-x').onclick = fechar; if (!PODE) return;
  $('#l-ok').onclick = async () => { const d = {}; ['item', 'orgao', 'numero', 'resp', 'link', 'obs', 'emissao', 'validade'].forEach(k => d[k] = $('#l-' + k).value.trim()); if (!d.item) return toast('Informe o item.', 'bad');
    d.atualizadoPor = MEU; d.atualizadoEm = new Date().toISOString(); try { await (id ? db.doc('licencas/' + id).set(d, { merge: true }) : db.collection('licencas').doc().set(d)); toast('Salvo.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
  const del = $('#l-del'); if (del) del.onclick = async () => { if (!confirm('Excluir "' + l.item + '" da lista? (o arquivo no Drive não é apagado)')) return; try { await db.doc('licencas/' + id).delete(); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}
function edLeg(id) {
  const x = D.leg.find(y => y.id === id) || { sit: 'verificar' }; const ro = PODE ? '' : 'disabled';
  sheet(`<div class="top"><h2>${id ? esc(x.norma) : 'Novo requisito'}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    ${[['norma', 'Norma / lei'], ['titulo', 'Assunto'], ['aplica', 'Aplica-se a'], ['evid', 'Como atendemos (evidência)'], ['resp', 'Responsável'], ['obs', 'Observação']].map(([k, t]) => `<label>${t}</label><input id="g-${k}" value="${esc(x[k] || '')}" style="${inp}" ${ro}>`).join('')}
    <div style="display:flex;gap:10px"><div style="flex:1"><label>Situação</label><select id="g-sit" style="${inp}" ${ro}>${Object.entries(SIT).map(([k, [t]]) => `<option value="${k}" ${x.sit === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div style="flex:1"><label>Verificado em</label><input type="date" id="g-verif" value="${esc(x.verif || '')}" style="${inp}" ${ro}></div></div>
    ${PODE ? `<div class="actions">${id ? '<button class="btn danger" id="g-del" type="button">Excluir</button>' : ''}<button class="btn primary" id="g-ok" type="button">Salvar</button></div>` : ''}`);
  $('#m-x').onclick = fechar; if (!PODE) return;
  $('#g-ok').onclick = async () => { const d = {}; ['norma', 'titulo', 'aplica', 'evid', 'resp', 'obs', 'sit', 'verif'].forEach(k => d[k] = $('#g-' + k).value.trim()); if (!d.norma) return toast('Informe a norma ou lei.', 'bad');
    d.atualizadoPor = MEU; d.atualizadoEm = new Date().toISOString(); try { await (id ? db.doc('legais/' + id).set(d, { merge: true }) : db.collection('legais').doc().set(d)); toast('Salvo.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
  const del = $('#g-del'); if (del) del.onclick = async () => { if (!confirm('Excluir este requisito da lista?')) return; try { await db.doc('legais/' + id).delete(); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const a = e.target.closest('[data-lic]'); if (a) { edLic(a.dataset.lic); return; }
  const b = e.target.closest('[data-leg]'); if (b) { edLeg(b.dataset.leg); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || ''; PODE = ['admin', 'gerente', 'gestao', 'tst'].includes(F.papelGeral);
  db.collection('legais').onSnapshot(s => { D.leg = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  db.collection('licencas').onSnapshot(s => { D.lic = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
