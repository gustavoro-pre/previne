/* eSocial SST: monta, com os dados do portal, as planilhas que a contabilidade ou a clínica usam para enviar
   S-2240 (condições ambientais: função, setor, riscos da OS, EPI do kit com CA), S-2220 (ASOs registrados) e S-2210 (acidentes das Ocorrências).
   O portal não envia nada ao eSocial: só organiza os dados para conferir e repassar. Os códigos da tabela 24 (agentes nocivos) ficam para a clínica/LTCAT. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
const cpf = v => { const d = str(v).replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''; };
const D = { func: [], kits: [], epis: [], oc: [], adm: [] }; const V = { tab: 's2240' }; let db = null;
const kitFuncs = k => [k.funcao].concat(Array.isArray(k.funcoesAlt) ? k.funcoesAlt : []).map(norm).filter(Boolean);
const kitDe = fn => D.kits.filter(k => kitFuncs(k).includes(norm(fn)));
const epiBy = id => D.epis.find(e => e.id === id) || {};
function linhas() {
  const at = D.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
  if (V.tab === 's2240') return { cols: ['Nome', 'CPF', 'Matrícula', 'Função', 'Setor / área', 'Riscos (OS da função)', 'EPI do kit (CA)', 'Trabalho em altura', 'Pendência'], rows: at.map(f => {
    const ks = kitDe(f.funcao); const os = ks.map(k => k.os || {}).find(o => str(o.riscos).trim()) || {}; const epis = [...new Set(ks.flatMap(k => (k.epis || []).map(x => x && x.epiId)).filter(Boolean))].map(id => { const e = epiBy(id); return e.nome ? e.nome + (e.ca ? ' (CA ' + e.ca + ')' : '') : ''; }).filter(Boolean);
    const pend = [!f.cpf && 'sem CPF', !ks.length && 'função sem kit/OS', ks.length && !str(os.riscos).trim() && 'OS sem riscos'].filter(Boolean).join('; ');
    return [f.nome, cpf(f.cpf), f.matricula, f.funcao, [f.area, f.subarea].filter(Boolean).join(' / '), str(os.riscos).split('\n').map(s => s.trim()).filter(Boolean).join('; '), epis.join('; '), f.altura ? 'Sim' : 'Não', pend]; }) };
  if (V.tab === 's2220') { const R = []; D.adm.forEach(a => { const e = (a.etapas || {}).aso || {}; if (e.data || e.asoData) R.push([a.nome, cpf(a.cpf), a.funcao, 'Admissional', fmtD(e.data || e.asoData), e.apto === false || e.resultado === 'inapto' ? 'Inapto' : 'Apto', a.status === 'aberto' ? 'Admissão em andamento' : '']); });
    D.func.forEach(f => { if (f.asoData || f.asoValidade) R.push([f.nome, cpf(f.cpf), f.funcao, f.asoTipo || 'Periódico', fmtD(f.asoData), f.asoApto === false ? 'Inapto' : 'Apto', f.asoValidade ? 'Válido até ' + fmtD(f.asoValidade) : '']); });
    return { cols: ['Nome', 'CPF', 'Função', 'Tipo de exame', 'Data do ASO', 'Resultado', 'Observação'], rows: R }; }
  const A = D.oc.filter(o => ['acidente', 'acidente_afast'].includes(o.tipo)).sort((a, b) => str(b.data).localeCompare(str(a.data)));
  return { cols: ['Número', 'Data', 'Hora', 'Tipo', 'Acidentado(s)', 'CPF', 'Local', 'Descrição', 'Gravidade', 'Afastamento', 'Situação da ocorrência'], rows: A.map(o => { const p = (o.envolvidos || []).map(n => D.func.find(f => norm(f.nome) === norm(n))).filter(Boolean);
    return [o.numero, fmtD(o.data), o.hora, 'Típico', (o.envolvidos || []).join(', '), p.map(f => cpf(f.cpf)).join(', '), o.local, o.descricao || o.titulo, o.gravidade, o.tipo === 'acidente_afast' ? 'Sim' : 'Não', o.status]; }) };
}
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const { cols, rows } = linhas(); const pend = V.tab === 's2240' ? rows.filter(r => r[8]).length : 0;
  const nota = { s2240: 'Uma linha por funcionário ativo: riscos vêm da OS do kit da função e os EPIs (com CA) do próprio kit. Envie à contabilidade/clínica para o S-2240; a codificação dos agentes (tabela 24) e a intensidade vêm do LTCAT/PGR.',
    s2220: 'ASOs registrados no portal (admissões e cadastro). Os periódicos dos funcionários antigos entram quando o inventário do Drive trouxer as datas.', s2210: 'Acidentes registrados em Ocorrências e ações. A CAT precisa ser enviada até o 1º dia útil seguinte (ou na hora, em caso de óbito).' }[V.tab];
  $('#body').innerHTML = `<div class="card"><p class="cs" style="margin:0 0 8px">${nota}</p><div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${rows.length} linha(s)${pend ? ` · <span style="color:var(--bad)">${pend} com pendência</span>` : ''}</b><button class="btn sm primary" id="exp" type="button">Exportar (Excel/PDF)</button></div></div>
    <div class="card" style="overflow:auto"><table class="tb" style="font-size:12px"><thead><tr>${cols.map(c => `<th style="text-align:left;white-space:nowrap">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 400).map(r => `<tr>${r.map((v, i) => `<td style="${V.tab === 's2240' && i === 8 && v ? 'color:var(--bad)' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" style="color:var(--muted)">Nada a mostrar.</td></tr>`}</tbody></table></div>`;
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: { s2240: 'eSocial S-2240 · condições ambientais do trabalho', s2220: 'eSocial S-2220 · monitoramento da saúde (ASO)', s2210: 'eSocial S-2210 · comunicação de acidente de trabalho' }[V.tab], cols: cols.map(t => ({ t })), linhas: rows, filtros: 'Funcionários ativos', arquivo: 'eSocial ' + V.tab.toUpperCase() });
}
document.addEventListener('click', e => { const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); } });
(async () => {
  db = await claude.use('db'); const F = window.__FB || {};
  if (!['admin', 'gerente', 'gestao', 'tst', 'rh'].includes(F.papelGeral)) { $('#body').innerHTML = '<div class="card">Só Administrador, Gestão, Gerente, TST e RH.</div>'; return; }
  const pega = async (c, k) => { try { const q = await db.collection(c).get(); D[k] = q.docs.map(d => Object.assign({}, d.data(), { id: d.id })); } catch (e) { D[k] = []; } };
  await Promise.all([pega('funcionarios', 'func'), pega('kits', 'kits'), pega('epis', 'epis'), pega('ocorrencias', 'oc'), pega('admissoes', 'adm')]);
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
