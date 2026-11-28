/* Painel mensal da direção (ISO 9001/14001/45001, análise crítica): pessoas, segurança, EPI e contrato do mês escolhido.
   Tudo calculado dos dados do portal; o botão "PDF do painel" (rel.js) imprime com o cabeçalho padrão. Valores em R$ da medição só para Administrador. */
"use strict";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v); const num = v => +v || 0;
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const h2 = h => (Math.round((+h || 0) * 10) / 10).toLocaleString('pt-BR');
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesNome = m => MESES[+m.slice(5, 7) - 1] + ' de ' + m.slice(0, 4);
const D = { func: [], tt: [], tr: [], ext: [], oc: [], ent: [], med: [], adm: [] };
const V = { mes: hoje().slice(0, 7) };
let db = null, ADMIN = false;
const no = (d, m) => str(d).slice(0, 7) === m;
const fimMes = m => { const [y, mm] = m.split('-').map(Number); return m + '-' + String(new Date(y, mm, 0).getDate()).padStart(2, '0'); };

function ativosEm(dia) { return D.func.filter(f => (!f.admissao || str(f.admissao).slice(0, 10) <= dia) && (f.ativo !== false || (f.demissao && str(f.demissao).slice(0, 10) > dia))); }
function aptos(L, dia) {
  let ok = 0, comReq = 0;
  L.forEach(f => { const req = D.tt.filter(t => t.ativo !== false && ((t.obrig || []).includes(str(f.funcao)) || (f.altura && /nr-?\s?35/i.test(str(t.norma) + ' ' + str(t.nome))))); if (!req.length) return; comReq++;
    if (req.every(t => D.tr.concat(D.ext).some(r => r.funcionarioId === f.id && r.tipoId === t.id && (!r.validade || str(r.validade) >= dia)))) ok++; });
  return { ok, comReq };
}
function render() {
  const m = V.mes, fim = fimMes(m) < hoje() ? fimMes(m) : hoje();
  const at = ativosEm(fim), adm = D.func.filter(f => no(f.admissao, m)).length, desl = D.func.filter(f => f.ativo === false && no(f.demissao, m)).length;
  const turn = at.length ? ((adm + desl) / 2 / at.length * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const ap = aptos(at, fim);
  const oc = D.oc.filter(o => no(o.data, m)); const cnt = t => oc.filter(o => o.tipo === t).length;
  const acoesAtr = D.oc.flatMap(o => o.acoes || []).filter(a => a.status !== 'feita' && a.prazo && a.prazo < hoje()).length;
  const trM = D.tr.filter(r => no(r.termino || r.inicio, m)); const hTr = trM.reduce((a, r) => a + num(r.cargaHoraria), 0);
  const entM = D.ent.filter(e => no(e.data, m)); const itens = entM.reduce((a, e) => a + (num(e.qtd) || 1), 0); const custo = entM.reduce((a, e) => a + num(e.custo) * (num(e.qtd) || 1), 0);
  const mau = entM.filter(e => ['mau_uso', 'perda'].includes(e.motivo)).length;
  let ht = 0, hm = 0, nRep = 0, val = 0, naoMed = 0;
  D.med.forEach(d => Object.values(d.dias || {}).forEach(x => { const t = x.rol && x.rol.h ? x.rol.h : (x.pto && x.pto.h) || 0; const md = x.med ? x.med.h || 0 : 0; ht += t; hm += md; if (t && !md) naoMed++; if (x.med) { nRep += x.med.nRep || 0; val += x.med.val || 0; } }));
  const admAnd = D.adm.filter(a => a.status === 'aberto').length;
  const dest = [];
  if (cnt('acidente_afast')) dest.push(`<b style="color:var(--bad)">${cnt('acidente_afast')} acidente(s) com afastamento no mês.</b>`);
  if (ap.comReq && ap.ok < ap.comReq) dest.push(`${ap.comReq - ap.ok} pessoa(s) ativas sem NR obrigatória em dia.`);
  if (acoesAtr) dest.push(`${acoesAtr} ação(ões) corretiva(s) atrasada(s).`);
  if (naoMed) dest.push(`${naoMed} dia(s) trabalhado(s) sem medição no portalRDO.`);
  if (mau) dest.push(`${mau} entrega(s) de EPI por mau uso ou perda.`);
  if (!cnt('quase') && oc.length < 2) dest.push('Poucos quase-acidentes registrados: incentive o relato.');
  $('#body').innerHTML = `<div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ct" style="flex:1;margin:0">Resumo de ${mesNome(m)}</div><input type="month" id="mes" value="${m}" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"></div>
      ${dest.length ? `<ul style="margin:10px 0 0;padding-left:20px">${dest.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="cs" style="margin:10px 0 0">Nada fora do normal no mês.</p>'}</div>
    <h3>Pessoas</h3><div class="kpis">${kpi('Ativos no fim do mês', at.length)}${kpi('Admissões', adm)}${kpi('Desligamentos', desl, desl ? 'warn' : '')}${kpi('Turnover do mês', turn)}${kpi('Admissões em andamento', admAnd)}</div>
    <h3>Segurança do trabalho</h3><div class="kpis">${kpi('Aptos (NRs obrigatórias em dia)', pct(ap.ok, ap.comReq), ap.comReq && ap.ok < ap.comReq ? 'warn' : '')}${kpi('Acidentes com afastamento', cnt('acidente_afast'), cnt('acidente_afast') ? 'warn' : '')}${kpi('Acidentes sem afastamento', cnt('acidente'))}${kpi('Quase-acidentes', cnt('quase'))}${kpi('Condições inseguras', cnt('condicao'))}${kpi('Ações atrasadas', acoesAtr, acoesAtr ? 'warn' : '')}${kpi('Treinamentos no mês', trM.length)}${kpi('Horas de treinamento', h2(hTr))}</div>
    <h3>Qualidade e meio ambiente</h3><div class="kpis">${kpi('Não conformidades', cnt('nc') + cnt('auditoria'))}${kpi('Reclamações do cliente', cnt('reclamacao'), cnt('reclamacao') ? 'warn' : '')}${kpi('Incidentes ambientais', cnt('ambiental'))}${kpi('Melhorias registradas', cnt('melhoria'))}</div>
    <h3>EPI</h3><div class="kpis">${kpi('Itens entregues', itens)}${kpi('Custo das entregas', brl(custo))}${kpi('Custo por funcionário', at.length ? brl(custo / at.length) : '—')}${kpi('Por mau uso ou perda', mau, mau ? 'warn' : '')}</div>
    <h3>Contrato (medição de HH)</h3>${D.med.length ? `<div class="kpis">${kpi('Horas trabalhadas (roleta/ponto)', h2(ht))}${kpi('Horas medidas', h2(hm))}${kpi('% medido', pct(hm, ht), ht && hm / ht < 0.95 ? 'warn' : '')}${kpi('Dias sem medição', naoMed, naoMed ? 'warn' : '')}${kpi('Lançamentos reprovados', nRep, nRep ? 'warn' : '')}${ADMIN ? kpi('Valor medido', brl(val)) : ''}</div>` : '<div class="card"><p class="cs" style="margin:0">Sem medição importada para o mês (Alocação de OM → Medição).</p></div>'}
    <p class="cs">Turnover = (admissões + desligamentos) ÷ 2 ÷ ativos. Aptos = pessoas com todas as NRs obrigatórias da função válidas no fim do mês.</p>`;
  $('#mes').onchange = async e => { if (!e.target.value) return; V.mes = e.target.value; await carregarMed(); render(); };
}
async function carregarMed() { try { const q = await db.collection('med_mes').where('mes', '==', V.mes).get(); D.med = q.docs.map(d => d.data()); } catch (e) { D.med = []; } }
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; ADMIN = F.papelGeral === 'admin';
  if (!['admin', 'gestao', 'gerente'].includes(F.papelGeral) && !['admin', 'gestao', 'gerente'].includes(F.papel)) { $('#body').innerHTML = '<div class="card">Painel só para Administrador, Gestão e Gerente.</div>'; return; }
  const pega = async (c, k) => { try { const q = await db.collection(c).get(); D[k] = q.docs.map(d => Object.assign({}, d.data(), { id: d.id })); } catch (e) { D[k] = []; } };
  await Promise.all([pega('funcionarios', 'func'), pega('trein_tipos', 'tt'), pega('treinamentos', 'tr'), pega('trein_ext', 'ext'), pega('ocorrencias', 'oc'), pega('entregas', 'ent'), pega('admissoes', 'adm'), carregarMed()]);
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
