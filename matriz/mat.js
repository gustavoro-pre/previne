/* Matriz por função: junta num só lugar o que cada função exige, a partir do que já está no portal
   - NRs obrigatórias: trein_tipos.obrig (as mesmas da Matriz de treinamentos) + sugestões (feitas por metade ou mais da função)
   - Kit de EPI e OS (riscos e exames do PCMSO): kits da função em Ferramentas & EPI
   - Padrões operacionais: os das subáreas onde as pessoas da função estão alocadas
   Proposta e aprovação ficam em matriz_funcao/{função}. Ao aprovar, as NRs marcadas passam a ser obrigatórias no tipo de treinamento
   (só o Administrador aprova: é conteúdo de SST e precisa do OK do Gustavo). */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'sem-funcao';
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const D = { func: [], tipos: [], kits: [], pad: [], areas: [], epis: [], tr: [], mz: {} };
const V = { busca: '', so: '' };
let db = null, PODE = false, ADMIN = false, MEU = '';

const ativos = () => D.func.filter(f => f.ativo !== false && f.situacao !== 'Em admissão');
const kitFuncs = k => [k.funcao].concat(Array.isArray(k.funcoesAlt) ? k.funcoesAlt : []).map(norm).filter(Boolean);
const kitsDa = fn => D.kits.filter(k => norm(fn) && kitFuncs(k).includes(norm(fn)));
const epiNome = id => (D.epis.find(e => e.id === id) || {}).nome || '(EPI removido)';
const subsDe = f => Array.isArray(f && f.subareas) ? f.subareas : [];
const tipoNome = t => [t.norma, t.nome].filter(Boolean).join(' · ') || t.nome;
const ehNR35 = t => /nr-?\s?35/i.test(str(t.norma) + ' ' + str(t.nome));

function funcoes() {
  const m = new Map(); const add = (fn, f) => { const k = norm(fn); if (!k) return; const x = m.get(k) || { nome: str(fn).trim(), pessoas: [] }; if (f) x.pessoas.push(f); m.set(k, x); };
  ativos().forEach(f => add(f.funcao, f)); D.kits.forEach(k => { add(k.funcao); (Array.isArray(k.funcoesAlt) ? k.funcoesAlt : []).forEach(fn => add(fn)); });
  D.tipos.forEach(t => (t.obrig || []).forEach(fn => add(fn)));
  return [...m.values()].sort((a, b) => b.pessoas.length - a.pessoas.length || a.nome.localeCompare(b.nome, 'pt'));
}
/* o que a função exige hoje + o que se sugere */
function exige(fx) {
  const P = fx.pessoas, n = P.length, salvo = D.mz[slug(fx.nome)] || null;
  const obrig = D.tipos.filter(t => t.ativo !== false && (t.obrig || []).includes(fx.nome));
  const feitos = {}; D.tr.forEach(r => { if (P.some(f => f.id === r.funcionarioId)) (feitos[r.tipoId] = feitos[r.tipoId] || new Set()).add(r.funcionarioId); });
  const sug = D.tipos.filter(t => t.ativo !== false && !obrig.includes(t) && n >= 2 && (feitos[t.id] || new Set()).size / n >= 0.5);
  const altura = P.filter(f => f.altura).length;
  const ks = kitsDa(fx.nome); const os = {}; ks.forEach(k => Object.entries(k.os || {}).forEach(([c, v]) => { if (str(v).trim() && !os[c]) os[c] = str(v); }));
  const epis = new Map(); ks.forEach(k => (k.epis || []).forEach(x => x && x.epiId && !epis.has(x.epiId) && epis.set(x.epiId, +x.qtd || 1)));
  const subs = {}; P.forEach(f => subsDe(f).forEach(s => subs[s] = (subs[s] || 0) + 1));
  const pads = D.pad.filter(p => p.ativo !== false && (p.subIds || []).some(s => (subs[s] || 0) / (n || 1) >= 0.5));
  return { fx, n, salvo, obrig, sug, altura, ks, os, epis, pads, feitos };
}
const statusBadge = e => !e.salvo ? '<span class="badge b-mut">Proposta automática</span>' : e.salvo.status === 'aprovada' ? `<span class="badge b-ok">Aprovada${e.salvo.aprovadoPor ? ' · ' + esc(e.salvo.aprovadoPor) : ''}</span>` : '<span class="badge b-warn">Proposta revisada · falta aprovar</span>';

function render() {
  let F = funcoes(); if (V.busca) F = F.filter(x => norm(x.nome).includes(norm(V.busca)));
  const E = F.map(exige); const L = V.so === 'pend' ? E.filter(e => !e.salvo || e.salvo.status !== 'aprovada') : E;
  const semKit = E.filter(e => e.n && !e.ks.length).length, semNr = E.filter(e => e.n && !e.obrig.length && !(e.salvo && (e.salvo.nrs || []).length)).length;
  $('#body').innerHTML = `<div class="card"><div class="ct">Matriz de exigências por função</div>
    <p class="cs">Montada com o que já está no portal (NRs obrigatórias dos tipos de treinamento, kits e OS de Ferramentas & EPI, padrões das subáreas). Revise cada função e aprove. Ao aprovar, as NRs marcadas passam a ser obrigatórias para a função na Matriz de treinamentos.</p>
    <div class="kpis">${kpi('Funções', E.length)}${kpi('Aprovadas', E.filter(e => e.salvo && e.salvo.status === 'aprovada').length)}${kpi('Sem kit de EPI/OS', semKit)}${kpi('Sem NR obrigatória', semNr)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><input id="busca" placeholder="Buscar função" value="${esc(V.busca)}" style="flex:1;min-width:160px;padding:9px;border:1px solid #cfd4dc;border-radius:8px">
      <select id="so" style="padding:9px;border:1px solid #cfd4dc;border-radius:8px"><option value="">Todas</option><option value="pend" ${V.so === 'pend' ? 'selected' : ''}>Falta aprovar</option></select>
      <button class="btn sm ghost" id="exp" type="button">Exportar a matriz (Excel/PDF)</button></div></div>
    ${L.map(e => { const s = e.salvo || {}; const nrs = s.nrs ? D.tipos.filter(t => s.nrs.includes(t.id)) : e.obrig;
      return `<div class="card"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><div class="ct" style="margin:0">${esc(e.fx.nome)}</div><div class="cs" style="margin:2px 0 8px">${e.n} pessoa(s) ativa(s)${e.altura ? ` · ${e.altura} com trabalho em altura (NR-35 obrigatória para essas pessoas)` : ''}</div></div>${statusBadge(e)}</div>
        <table class="tb" style="font-size:13px"><tbody>
          <tr><td style="width:150px;color:var(--muted);vertical-align:top">NRs obrigatórias</td><td>${nrs.length ? nrs.map(t => esc(tipoNome(t))).join('<br>') : '<span style="color:var(--bad)">nenhuma marcada</span>'}${!s.nrs && e.sug.length ? `<div class="cs" style="margin-top:4px">Sugestão (feita por metade ou mais da função): ${e.sug.map(t => esc(tipoNome(t))).join(', ')}</div>` : ''}</td></tr>
          <tr><td style="color:var(--muted);vertical-align:top">Exames (PCMSO)</td><td>${esc(s.exames || e.os.exames || '') || '<span style="color:var(--bad)">não informado na OS</span>'}</td></tr>
          <tr><td style="color:var(--muted);vertical-align:top">Riscos</td><td>${esc(str(s.riscos || e.os.riscos || '').split('\n').slice(0, 6).join(' · ')) || '<span style="color:var(--bad)">sem OS/riscos</span>'}</td></tr>
          <tr><td style="color:var(--muted);vertical-align:top">Kit de EPI</td><td>${e.ks.length ? esc(e.ks.map(k => k.nome || k.funcao).join(', ')) + ': ' + [...e.epis].map(([id, q]) => esc(epiNome(id)) + (q > 1 ? ' ×' + q : '')).join(', ') : '<span style="color:var(--bad)">sem kit</span>'}</td></tr>
          <tr><td style="color:var(--muted);vertical-align:top">Padrões</td><td>${(s.padroes ? D.pad.filter(p => s.padroes.includes(p.id)) : e.pads).map(p => esc(p.codigo + ' rev. ' + p.rev)).join(', ') || '—'}</td></tr>
          ${s.obs ? `<tr><td style="color:var(--muted)">Observação</td><td>${esc(s.obs)}</td></tr>` : ''}
        </tbody></table>
        ${PODE ? `<div class="actions" style="margin-top:8px"><button class="btn sm ghost" data-ed="${esc(slug(e.fx.nome))}" type="button">Revisar</button>${ADMIN ? `<button class="btn sm primary" data-ap="${esc(slug(e.fx.nome))}" type="button">${s.status === 'aprovada' ? 'Aprovar de novo' : 'Aprovar'}</button>` : ''}</div>` : ''}</div>`; }).join('') || '<div class="card">Nenhuma função.</div>'}`;
}
const kpi = (t, n) => `<div class="kpi"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const achar = sl => exige(funcoes().find(x => slug(x.nome) === sl));

function revisar(sl) {
  const e = achar(sl); if (!e) return; const s = e.salvo || {};
  const nrsSel = new Set(s.nrs || e.obrig.map(t => t.id)); const padSel = new Set(s.padroes || e.pads.map(p => p.id));
  const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
  sheet(`<div class="top"><h2>${esc(e.fx.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <label><b>NRs e treinamentos obrigatórios</b></label><div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:4px 0 10px;background:#fff">
      ${D.tipos.filter(t => t.ativo !== false).sort((a, b) => tipoNome(a).localeCompare(tipoNome(b), 'pt')).map(t => `<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:3px 0"><input type="checkbox" data-nr="${esc(t.id)}" ${nrsSel.has(t.id) ? 'checked' : ''}> ${esc(tipoNome(t))}${e.sug.includes(t) ? ' <span class="badge b-info">sugestão</span>' : ''}${e.n ? ` <span class="cs" style="font-size:12px">(${(e.feitos[t.id] || new Set()).size}/${e.n} já fizeram)</span>` : ''}</label>`).join('')}</div>
    <label><b>Exames do PCMSO</b> (o texto da OS vem preenchido; confirme com o médico do trabalho)</label><textarea id="ex" rows="3" style="${inp}">${esc(s.exames || e.os.exames || '')}</textarea>
    <label><b>Riscos</b> (da OS da função)</label><textarea id="ri" rows="4" style="${inp}">${esc(s.riscos || e.os.riscos || '')}</textarea>
    <label><b>Padrões operacionais</b></label><div style="max-height:180px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:4px 0 10px;background:#fff">
      ${D.pad.filter(p => p.ativo !== false).sort((a, b) => str(a.codigo).localeCompare(str(b.codigo), 'pt')).map(p => `<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:3px 0"><input type="checkbox" data-pd="${esc(p.id)}" ${padSel.has(p.id) ? 'checked' : ''}> ${esc(p.codigo)} rev. ${esc(p.rev)} – ${esc(p.titulo)}</label>`).join('') || '<p class="cs">Nenhum padrão cadastrado.</p>'}</div>
    <label><b>Observação</b></label><input id="ob" value="${esc(s.obs || '')}" style="${inp}">
    <p class="cs">O kit de EPI e a OS continuam sendo editados em Ferramentas & EPI → Kits.</p>
    <button class="btn big primary" id="ok" type="button">Salvar revisão</button>`);
  $('#m-x').onclick = fechar;
  $('#ok').onclick = async () => {
    const d = { funcao: e.fx.nome, nrs: $$('[data-nr]').filter(c => c.checked).map(c => c.dataset.nr), padroes: $$('[data-pd]').filter(c => c.checked).map(c => c.dataset.pd),
      exames: $('#ex').value.trim(), riscos: $('#ri').value.trim(), obs: $('#ob').value.trim(), status: 'revisada', revisadoPor: MEU, revisadoEm: new Date().toISOString() };
    try { await db.doc('matriz_funcao/' + sl).set(d, { merge: true }); toast('Revisão salva. Falta aprovar.', 'ok'); fechar(); } catch (er) { toast('Não foi possível salvar (permissão?).', 'bad'); }
  };
}
async function aprovar(sl) {
  const e = achar(sl); if (!e) return; const s = e.salvo || {};
  const nrs = s.nrs || e.obrig.map(t => t.id); const pads = s.padroes || e.pads.map(p => p.id);
  const add = D.tipos.filter(t => nrs.includes(t.id) && !(t.obrig || []).includes(e.fx.nome)), rem = D.tipos.filter(t => !nrs.includes(t.id) && (t.obrig || []).includes(e.fx.nome));
  if (!confirm(`Aprovar a matriz de ${e.fx.nome}?\n\nNRs obrigatórias: ${nrs.length}${add.length ? `\nPassam a ser obrigatórias: ${add.map(tipoNome).join(', ')}` : ''}${rem.length ? `\nDeixam de ser obrigatórias: ${rem.map(tipoNome).join(', ')}` : ''}\nPadrões: ${pads.length}`)) return;
  try {
    for (const t of add) await db.doc('trein_tipos/' + t.id).update({ obrig: (t.obrig || []).concat([e.fx.nome]) });
    for (const t of rem) await db.doc('trein_tipos/' + t.id).update({ obrig: (t.obrig || []).filter(x => x !== e.fx.nome) });
    await db.doc('matriz_funcao/' + sl).set({ funcao: e.fx.nome, nrs, padroes: pads, exames: s.exames != null ? s.exames : str(e.os.exames), riscos: s.riscos != null ? s.riscos : str(e.os.riscos), status: 'aprovada', aprovadoPor: MEU, aprovadoEm: new Date().toISOString() }, { merge: true });
    toast('Matriz de ' + e.fx.nome + ' aprovada.', 'ok');
  } catch (er) { toast('Não foi possível aprovar (permissão?).', 'bad'); }
}
function exportar() {
  const E = funcoes().map(exige);
  const linhas = E.map(e => { const s = e.salvo || {}; const nrs = s.nrs ? D.tipos.filter(t => s.nrs.includes(t.id)) : e.obrig; const pads = s.padroes ? D.pad.filter(p => s.padroes.includes(p.id)) : e.pads;
    return [e.fx.nome, e.n, nrs.map(tipoNome).join('; '), str(s.exames || e.os.exames), str(s.riscos || e.os.riscos).split('\n').join('; '), [...e.epis].map(([id, q]) => epiNome(id) + (q > 1 ? ' x' + q : '')).join('; '), pads.map(p => p.codigo + ' rev. ' + p.rev).join('; '),
      !e.salvo ? 'Proposta automática' : s.status === 'aprovada' ? 'Aprovada por ' + (s.aprovadoPor || '') + ' em ' + fmtD(s.aprovadoEm) : 'Revisada, falta aprovar']; });
  PrevRel.escolher({ modelo: 'rel_matriz_trein', titulo: 'Matriz de exigências por função', cols: [{ t: 'Função' }, { t: 'Pessoas', tipo: 'int' }, { t: 'NRs obrigatórias' }, { t: 'Exames (PCMSO)' }, { t: 'Riscos' }, { t: 'Kit de EPI' }, { t: 'Padrões' }, { t: 'Situação' }],
    linhas, filtros: 'Todas as funções', arquivo: 'Matriz por funcao' });
}

document.addEventListener('click', e => {
  const ed = e.target.closest('[data-ed]'); if (ed) { revisar(ed.dataset.ed); return; }
  const ap = e.target.closest('[data-ap]'); if (ap) { aprovar(ap.dataset.ap); return; }
  if (e.target.id === 'exp' && window.PrevRel) { exportar(); return; }
  if (e.target.id === 'modal') fechar();
});
document.addEventListener('change', e => { if (e.target.id === 'so') { V.so = e.target.value; render(); } });
let tb; document.addEventListener('input', e => { if (e.target.id === 'busca') { clearTimeout(tb); tb = setTimeout(() => { V.busca = e.target.value; render(); const i = $('#busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } });

(async () => {
  db = await claude.use('db');
  const F = window.__FB || {}; MEU = F.nome || ''; ADMIN = F.papelGeral === 'admin' || F.papel === 'admin'; PODE = ADMIN || ['gestor', 'tst', 'gestao'].includes(F.papel);
  let pend = 0; const pronto = () => { if (--pend <= 0) render(); };
  const ouvir = (c, k, map) => { pend++; let first = true; db.collection(c).onSnapshot(s => { if (map) { D[k] = {}; s.docs.forEach(d => D[k][d.id] = d.data()); } else D[k] = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); if (first) { first = false; pronto(); } else render(); }, () => { if (first) { first = false; pronto(); } }); };
  ouvir('funcionarios', 'func'); ouvir('trein_tipos', 'tipos'); ouvir('kits', 'kits'); ouvir('padroes', 'pad'); ouvir('areas', 'areas'); ouvir('epis', 'epis'); ouvir('matriz_funcao', 'mz', true);
  try { const q = await db.collection('treinamentos').get(); D.tr = q.docs.map(d => d.data()); } catch (e) {}
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
})();
