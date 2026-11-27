/* Indicadores → Pessoas: visão geral, funcionários (busca, filtros e a vida de cada um na empresa com os documentos),
   folha e horas (importação mensal do extrato da contabilidade) e absenteísmo. Folha e salários: só Admin, Gestão, Gerente e RH. */
"use strict";
const podeFolha = () => ((window.__FB || {}).perfil || {}).verSalarios === true; /* salários: só quem tem a permissão 'Vê salários' */
Object.assign(V, { pt: 'geral', pes: '', fq: '', fa: '', ff: '', fs: 'ativos', fv: '', comp: '' });
const PB = () => $('#pes-body') || $('#ind-body');
const soDig = s => str(s).replace(/\D/g, '');
const fmtCpf = s => { const d = soDig(s); return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : (str(s) || '—'); };
const cpfMask = s => { const d = soDig(s); return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : '—'; };
const brl2 = v => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hh = v => (Math.round(num(v) * 10) / 10).toLocaleString('pt-BR') + 'h';
const pc1 = (a, b) => b ? (Math.round(a / b * 1000) / 10).toLocaleString('pt-BR') + '%' : '—';
const funcDe = id => D.func.find(x => x.id === id);

/* ---------- base de qualquer KPI (todas as abas): toque no número e veja de onde ele vem ---------- */
let KB = {}, KBn = 0;
function kpiG(t, n, k, s, fn) { const id = 'kg' + (++KBn); KB[id] = fn; return kpi(t, n, k, s, id); }
function abrirKG(b) {
  const k = b.dataset.kb, fn = KB[k]; if (!fn) return; const grid = b.closest('.kpis'); if (!grid) return;
  let det = grid.nextElementSibling; if (!det || !det.classList.contains('kg-det')) { det = document.createElement('div'); det.className = 'kg-det'; grid.after(det); }
  grid.querySelectorAll('.kpi.on').forEach(x => x.classList.remove('on'));
  if (det.dataset.k === k) { det.innerHTML = ''; det.dataset.k = ''; return; }
  const [t, ex, html] = fn(); det.dataset.k = k; b.classList.add('on');
  det.innerHTML = `<div class="card" style="margin-top:10px;border-color:#1f4e9c"><div class="head" style="margin:0 0 6px"><p class="ct" style="margin:0;margin-right:auto">Base: ${esc(t)}</p><button class="btn sm ghost" data-kgxp="1" style="margin-right:6px">Exportar</button><button class="btn sm ghost" data-kgx="1">Fechar</button></div>${ex ? `<p class="note" style="margin:0 0 8px">${ex}</p>` : ''}${html || '<p class="note">Nada para mostrar.</p>'}</div>`;
  det.querySelector('[data-kgx]').onclick = () => { det.innerHTML = ''; det.dataset.k = ''; b.classList.remove('on'); };
  det.querySelector('[data-kgxp]').onclick = () => exportarBase(det, t, ex);
  det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-kb^="kg"]'); if (b) abrirKG(b); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.closest) return; const b = e.target.closest('[data-kb^="kg"]'); if (b) abrirKG(b); });
function exportarBase(det, t, ex) { const tb = det.querySelector('table'); let rows;
    if (tb) rows = [...tb.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.innerText.trim()));
    else rows = [['Nome', 'Detalhe']].concat([...det.querySelectorAll('.ritem')].map(r => [str((r.querySelector('b') || r).innerText).trim(), str((r.querySelector('.note') || {}).innerText || '').trim()]));
    if (rows.length < 2) return toast('Nada para exportar.', 'bad');
    const tab = ({ pes: 'Pessoas', trein: 'Treinamentos', pad: 'Padrões', ferr: 'Ferramentas', epi: 'EPI' })[V.tab] || '';
    PrevRel.escolher(Object.assign(PrevRel.deMatriz(rows.map(r => r.map(v => /^R\$\s?[\d.]+,\d{2}$/.test(v) ? v.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.') : /^[\d.]+,\d+h$/.test(v) ? v.replace('h', '').replace(/\./g, '').replace(',', '.') : v))), { modelo: 'rel_indicador', titulo: 'Indicadores · ' + tab + ' · ' + t, arquivo: 'Indicador ' + t, filtros: ((AREA_FIXA || V.area) ? 'Área: ' + ((D.areas.find(x => x.id === (AREA_FIXA || V.area)) || {}).nome || (AREA_FIXA || V.area)) + ' · ' : '') + (ex ? ex.replace(/<[^>]+>/g, '') : '') }));
}
/* listas usadas nas bases */
const listaP = (L, fx) => L.length ? `<div class="card" style="padding:4px 12px;max-height:520px;overflow:auto;margin:0">${L.map(f => `<button class="ritem lk" data-pessoa="${esc(f.id)}"><div class="main"><b>${esc(f.nome)}</b><div class="note">${fx ? fx(f) : esc([f.matricula, f.funcao, f.area].filter(Boolean).join(' · '))}</div></div></button>`).join('')}</div>` : '<p class="note">Ninguém.</p>';
const tabela = (cab, linhas, alinhaDir) => linhas.length ? `<div class="tbwrap" style="margin:0;max-height:560px;overflow:auto"><table class="tb"><thead><tr>${cab.map((c, i) => `<th${(alinhaDir || []).includes(i) ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr${l.pessoa ? ` data-pessoa="${esc(l.pessoa)}" style="cursor:pointer"` : ''}>${(l.c || l).map((v, i) => `<td${(alinhaDir || []).includes(i) ? ' class="n"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="note">Nada para mostrar.</p>';

/* ---------- hub da aba Pessoas ---------- */
function tPesHub() {
  const pf = podeFolha(); const subs = [['geral', 'Visão geral'], ['func', 'Funcionários']].concat(pf ? [['sal', 'Salários'], ['folha', 'Folha e horas']] : []);
  if (!subs.some(s => s[0] === V.pt)) V.pt = 'geral';
  $('#ind-body').innerHTML = `<div class="seg" id="pes-seg" style="background:#e9ecf1">${subs.map(([k, t]) => `<button data-pt="${k}" class="${V.pt === k && !V.pes ? 'on' : ''}">${t}</button>`).join('')}</div><div id="pes-body"></div>`;
  if (V.pes) return vida(V.pes);
  ({ geral: tPes, func: tFunc, sal: tSal, folha: tFolha })[V.pt]();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pt]'); if (!b) return; V.pt = b.dataset.pt; V.pes = ''; tPesHub(); window.scrollTo(0, 0); });

/* ---------- Funcionários: busca e filtros ---------- */
function tFunc() {
  const base = daArea(D.func.filter(f => !NAO_ADM.includes(f.situacao)));
  const uniq = k => [...new Set(base.map(f => str(f[k]).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const opt = (L, v, todos) => `<option value="">${todos}</option>` + L.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  PB().innerHTML = `<div class="card"><div class="grid3" style="align-items:end">
      <div style="grid-column:1/-1"><label for="fu-q" style="margin-top:0">🔎 Buscar por nome, matrícula ou CPF</label><input id="fu-q" placeholder="Digite para buscar…" value="${esc(V.fq)}" autocomplete="off"></div>
      <div><label>Área</label><select id="fu-a">${opt(uniq('area'), V.fa, 'Todas as áreas')}</select></div>
      <div><label>Função</label><select id="fu-f">${opt(uniq('funcao'), V.ff, 'Todas as funções')}</select></div>
      <div><label>Situação</label><select id="fu-s">${[['ativos', 'Ativos'], ['desligados', 'Desligados'], ['todos', 'Todos'], ['afastados', 'Afastados'], ['ferias', 'De férias'], ['altura', 'Trabalham em altura']].map(([k, t]) => `<option value="${k}" ${V.fs === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Vínculo</label><select id="fu-v"><option value="">CLT e PJ</option><option value="CLT" ${V.fv === 'CLT' ? 'selected' : ''}>CLT</option><option value="PJ" ${V.fv === 'PJ' ? 'selected' : ''}>PJ</option></select></div>
      <div><button class="btn primary" id="fu-csv" type="button" style="width:100%">Exportar (Excel ou PDF)</button></div></div></div>
    <div id="fu-n" class="note" style="margin:0 0 6px"></div><div id="fu-list"></div>`;
  const lista = () => {
    const q = norm(V.fq), qd = soDig(V.fq);
    const L = base.filter(f => (V.fs === 'todos' || (V.fs === 'ativos' && f.ativo !== false) || (V.fs === 'desligados' && f.ativo === false) || (V.fs === 'afastados' && f.ativo !== false && f.situacao === 'Afastado') || (V.fs === 'ferias' && f.ativo !== false && f.situacao === 'Férias') || (V.fs === 'altura' && f.ativo !== false && f.altura))
      && (!V.fa || str(f.area).trim() === V.fa) && (!V.ff || str(f.funcao).trim() === V.ff) && (!V.fv || (V.fv === 'PJ' ? f.vinculo === 'PJ' : f.vinculo !== 'PJ'))
      && (!q || norm(f.nome).includes(q) || norm(f.matricula) === q || (qd.length >= 3 && soDig(f.cpf).includes(qd)))).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
    $('#fu-n').textContent = `${L.length} funcionário(s)`;
    $('#fu-list').innerHTML = L.length ? `<div class="card" style="padding:4px 12px">${L.slice(0, 400).map(f => `<button class="ritem lk" data-pessoa="${esc(f.id)}"><div class="main"><b>${esc(f.nome)}</b><div class="note">${esc([f.matricula, f.funcao, [f.area, f.subarea].filter(Boolean).join(' / ')].filter(Boolean).join(' · '))}${f.admissao ? ' · desde ' + fmtD(f.admissao) : ''}</div></div>${f.ativo === false ? `<span class="badge b-mut">Desligado${f.demissao ? ' ' + fmtD(f.demissao) : ''}</span>` : f.situacao && f.situacao !== 'Trabalhando' ? `<span class="badge b-warn">${esc(f.situacao)}</span>` : f.vinculo === 'PJ' ? '<span class="badge b-info">PJ</span>' : ''}</button>`).join('')}</div>` : '<div class="empty">Ninguém com esses filtros.</div>';
    return L;
  };
  let L = lista();
  $('#fu-q').addEventListener('input', e => { V.fq = e.target.value; L = lista(); });
  [['#fu-a', 'fa'], ['#fu-f', 'ff'], ['#fu-s', 'fs'], ['#fu-v', 'fv']].forEach(([s, k]) => $(s).onchange = e => { V[k] = e.target.value; L = lista(); });
  $('#fu-csv').onclick = () => exportarFunc(L, [V.fa && 'Área: ' + V.fa, V.ff && 'Função: ' + V.ff, 'Situação: ' + ({ ativos: 'ativos', desligados: 'desligados', todos: 'todos', afastados: 'afastados', ferias: 'de férias', altura: 'trabalham em altura' })[V.fs], V.fv && 'Vínculo: ' + V.fv, V.fq && 'Busca: ' + V.fq].filter(Boolean).join(' · '));
}

/* ---------- a vida do funcionário na empresa ---------- */
function ultimaFolha() { const o = {}; (D.folha || []).forEach(x => { if (x.funcionarioId && (!o[x.funcionarioId] || str(o[x.funcionarioId].comp) < str(x.comp))) o[x.funcionarioId] = x; }); return o; }
function vida(fid) {
  const f = funcDe(fid); if (!f) { V.pes = ''; return tPesHub(); }
  const pf = podeFolha(); const FO = (D.folha || []).filter(x => x.funcionarioId === fid).sort((a, b) => str(a.comp).localeCompare(str(b.comp))); const u = FO[FO.length - 1];
  const idade = f.nascimento ? Math.floor(anosEntre(f.nascimento)) + ' anos (' + fmtD(f.nascimento) + ')' : '—';
  const adm = f.admissao || (u && u.adm) || '';
  const casa = adm ? fmtAnos(anosEntre(adm, f.ativo === false && f.demissao ? str(f.demissao).slice(0, 10) : '')) : '—';
  const kv = [['Matrícula', f.matricula], ['CPF', pf ? fmtCpf(f.cpf || (u && u.cpf)) : cpfMask(f.cpf)], ['Função', f.funcao], pf && u ? ['Cargo na folha', u.cargo] : null, ['Área', [f.area, f.subarea].filter(Boolean).join(' / ')], ['Unidade', f.unidade], ['Vínculo', f.vinculo || 'CLT'], ['Admissão', fmtD(adm)], ['Tempo de casa', casa], ['Idade', idade],
    ['Situação', f.ativo === false ? 'Desligado' + (f.demissao ? ' em ' + fmtD(f.demissao) : '') + (f.demissaoTipo ? ' · ' + f.demissaoTipo : '') + (f.demissaoMotivo ? ' · ' + f.demissaoMotivo : '') : (f.situacao || 'Trabalhando')], ['Trabalho em altura', f.altura ? 'Sim' : 'Não'],
    ['Tamanhos', [f.tamCamisa || f.tamRoupa ? 'camisa ' + (f.tamCamisa || f.tamRoupa) : '', f.tamCalca ? 'calça ' + f.tamCalca : '', f.tamCalcado ? 'calçado ' + f.tamCalcado : ''].filter(Boolean).join(' · ') || '—'],
    pf && u ? ['Salário (folha de ' + mesNome(u.comp) + ')', brl2(u.salario) + ' · líquido ' + brl2(u.liquido)] : null].filter(Boolean);
  /* linha do tempo */
  const ev = [];
  if (adm) ev.push([adm, '🟢', 'Admissão', [f.funcao, f.area].filter(Boolean).join(' · ')]);
  D.tr.filter(r => r.funcionarioId === fid && str(r.inicio) <= hoje()).forEach(r => ev.push([str(r.termino || r.inicio), '🎓', 'Treinamento: ' + str(r.tipoNome), [r.cargaHoraria ? num(r.cargaHoraria) + 'h' : '', r.validade ? 'válido até ' + fmtD(r.validade) : '', r.origem === 'ead' ? 'on-line' : ''].filter(Boolean).join(' · ')]));
  D.ext.filter(x => x.funcionarioId === fid).forEach(x => ev.push([str(x.termino), '📜', 'Curso externo: ' + str(x.tipo), [x.entidade, x.validade ? 'válido até ' + fmtD(x.validade) : ''].filter(Boolean).join(' · ')]));
  D.preg.filter(r => r.funcionarioId === fid).forEach(r => { const p = D.pad.find(x => x.id === r.padraoId) || {}; ev.push([str(r.data), '📄', 'Padrão assinado: ' + str(p.codigo || r.codigo || ''), 'rev. ' + str(r.rev) + (r.nota != null ? ' · nota ' + num(r.nota) + '%' : '')]); });
  const entG = {}; D.ent.filter(e => e.funcionarioId === fid).forEach(e => { const k = str(e.data).slice(0, 10); (entG[k] = entG[k] || []).push(e); });
  Object.entries(entG).forEach(([d, L]) => ev.push([d, '🦺', 'EPI entregue (' + L.reduce((a, e) => a + (num(e.qtd) || 1), 0) + ' item(ns))', L.map(e => str(e.epiNome) + (num(e.qtd) > 1 ? ' ×' + num(e.qtd) : '')).join(', ')]));
  D.caut.filter(c => c.funcionarioId === fid).forEach(c => { ev.push([str(c.retiradaEm).slice(0, 10), '🔧', 'Retirou ferramenta(s) · cautela ' + str(c.numero), (c.itens || []).map(i => i.codigo || i.descricao).join(', ')]);
    (c.itens || []).filter(i => i.devolvido && i.devolvidaEm).forEach(i => ev.push([str(i.devolvidaEm).slice(0, 10), '↩️', 'Devolveu ' + str(i.codigo || i.descricao), i.estadoDevolucao && i.estadoDevolucao !== 'ok' ? 'estado: ' + str(i.estadoDevolucao).replace('_', ' ') : ''])); });
  if (pf) { let ant = null; FO.forEach(x => { const d = x.comp + '-01';
    if (ant && (norm(ant.cargo) !== norm(x.cargo) || Math.abs(num(ant.salario) - num(x.salario)) > 0.5)) ev.push([d, '💼', norm(ant.cargo) !== norm(x.cargo) ? 'Mudou de cargo na folha: ' + str(x.cargo) : 'Salário alterado', brl2(ant.salario) + ' → ' + brl2(x.salario)]);
    if (/doen|afast|acid|matern/i.test(str(x.situacao))) ev.push([d, '🏥', 'Afastado na folha de ' + mesNome(x.comp), str(x.situacao)]); ant = x; }); }
  if (f.ativo === false && f.demissao) ev.push([str(f.demissao).slice(0, 10), '🔴', 'Desligamento', [f.demissaoTipo, f.demissaoMotivo].filter(Boolean).join(' · ')]);
  ev.sort((a, b) => str(b[0]).localeCompare(str(a[0])));
  const certs = D.tr.filter(r => r.funcionarioId === fid && str(r.inicio) <= hoje() && r.codigo).map(r => r.id);
  const resto = fichaPessoa(fid).split('\n    <div class="rgrid">').slice(1).join('\n    <div class="rgrid">');
  PB().innerHTML = `<button class="link" id="vi-bk" style="margin:0 0 6px">‹ Voltar</button>
    <div class="card"><b style="font-size:19px">${esc(f.nome)}</b><div style="margin:4px 0 10px">${subsDe(f).map(s => `<span class="badge b-info" style="margin:2px">${esc(subNome(s))}</span>`).join('')}</div>
      <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl></div>
    <h3>Documentos</h3>
    <div class="card"><p class="ct">Documentos de segurança gerados pelo portal</p><p class="note" style="margin:0 0 8px">Saem na hora com os dados atuais do cadastro, no modelo aprovado.</p>
      <div class="actions" style="justify-content:flex-start;flex-wrap:wrap;gap:8px"><button class="btn ghost sm" data-gdoc="os">Ordem de Serviço (PDF)</button><button class="btn ghost sm" data-gdoc="ficha">Ficha de EPI (PDF)</button><button class="btn ghost sm" data-gdoc="termo">Termo de EPI (PDF)</button>${certs.length ? `<button class="btn ghost sm" data-gcert="${esc(certs.join(','))}">Certificados (${certs.length}) (PDF)</button>` : ''}${D.ext.filter(x => x.funcionarioId === fid && x.arquivoId).map(x => `<button class="btn ghost sm" data-arq="${esc(x.arquivoId)}">${esc(x.tipo)} (externo)</button>`).join('')}</div></div>
    <div class="card" id="vi-rh"><p class="ct">Documentos pessoais e de RH (Drive do RH)</p><p class="note">Carregando…</p></div>
    <h3>Linha do tempo na empresa (${ev.length})</h3>
    <div class="card" style="padding:4px 12px;max-height:560px;overflow:auto">${ev.map(([d, ic, t, s]) => `<div class="ritem"><div style="font-size:18px;width:28px;flex:none">${ic}</div><div class="main"><b>${esc(t)}</b>${s ? `<div class="note">${esc(s)}</div>` : ''}</div><span class="note" style="white-space:nowrap">${fmtD(d)}</span></div>`).join('') || '<p class="note">Nada registrado ainda.</p>'}</div>
    ${pf ? `<h3>Folha mês a mês</h3>${FO.length ? `<div class="card" style="padding:6px 10px">${tabela(['Mês', 'Cargo', 'Salário', 'HE (h)', 'HE noturna (h)', 'Adic. noturno', 'Faltas (h)', 'Proventos', 'Líquido'], FO.slice().reverse().map(x => { const a = x.ag || {}; return [mesNome(x.comp), esc(x.cargo), brl2(x.salario), hh(num(a.he50h) + num(a.he70h) + num(a.he100h)), hh(a.heNoth), brl2(a.adNotv), hh(a.faltash), brl2(x.proventos), brl2(x.liquido)]; }), [2, 3, 4, 5, 6, 7, 8])}</div>` : '<div class="empty">Nenhuma folha importada com este funcionário. Importe o extrato mensal em Pessoas → Folha e horas.</div>'}` : ''}
    ${pf ? '<h3>Contracheques</h3><div id="vi-cc"><p class="note">Carregando…</p></div>' : ''}
    <h3>Treinamentos e padrões</h3>
    <div class="rgrid">${resto}`;
  $('#vi-bk').onclick = () => { V.pes = ''; tPesHub(); };
  PB().querySelectorAll('[data-gdoc]').forEach(b => b.onclick = () => gerarDoc(b, '#gerar-func=' + fid + '.' + b.dataset.gdoc, 'previne-func-doc', ({ os: 'OS - ', ficha: 'Ficha EPI - ', termo: 'Termo EPI - ' }[b.dataset.gdoc]) + f.nome + '.pdf'));
  PB().querySelectorAll('[data-gcert]').forEach(b => b.onclick = () => gerarDoc(b, '#gerar-cert=' + b.dataset.gcert, 'previne-cert', 'Certificados - ' + f.nome + '.pdf'));
  rhBox(f); if (pf && window.ccBox) ccBox(f);
}
/* PDFs gerados pelo módulo Ferramentas & EPI / Treinamentos, aberto escondido (mesmo mecanismo da Admissão) */
function gerarDoc(btn, hash, tipo, nome) {
  if (btn.disabled) return; const t0 = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0'; let ok = false;
  const fim = () => { window.removeEventListener('message', on); fr.remove(); btn.disabled = false; btn.textContent = t0; };
  const on = ev => { if (ev.origin !== location.origin || !ev.data || ev.data.tipo !== tipo) return; ok = true; fim();
    if (ev.data.erro) return toast(ev.data.erro, 'bad');
    const bin = atob(ev.data.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })); a.download = nome.replace(/[\\/:*?"<>|]+/g, ' '); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
  window.addEventListener('message', on); fr.src = new URL('../ferramentas/' + hash, location.href).href; document.body.appendChild(fr);
  setTimeout(() => { if (!ok) { fim(); toast('Não foi possível gerar o PDF agora. Tente de novo.', 'bad'); } }, 60000);
}
const RHD = [['RG', 'RG'], ['CPF', 'CPF'], ['CTPS', 'CTPS'], ['PIS', 'PIS'], ['TITULO', 'Título de eleitor'], ['RESERVISTA', 'Reservista'], ['CNH', 'CNH'], ['RESIDENCIA', 'Comprovante de residência'], ['ESCOLARIDADE', 'Escolaridade'], ['FOTO', 'Foto'], ['CONTRATO', 'Contrato de experiência'], ['FICHA EMPREGADO', 'Ficha de empregado'], ['ESOCIAL', 'eSocial'], ['ASO', 'ASO'], ['INTEGRACAO', 'Integração'], ['OS', 'OS de segurança (assinada)'], ['FICHA EPI', 'Ficha de EPI (assinada)'], ['NR', 'Certificados NR'], ['CERTIFICADO CURSO', 'Outros certificados'], ['CASAMENTO', 'Certidão de casamento'], ['NASCIMENTO', 'Certidão de nascimento (filhos)'], ['VT', 'Vale-transporte'], ['CRC', 'CRC'], ['ATESTADO', 'Atestados'], ['ADVERTENCIA', 'Advertências'], ['FERIAS', 'Férias'], ['RESCISAO', 'Rescisão']];
const RHD_SAL = ['CONTRATO', 'FICHA EMPREGADO', 'ESOCIAL', 'CTPS', 'FERIAS', 'RESCISAO']; const ehSal = k => RHD_SAL.includes(k) || /CONTRA.?CHEQUE|RECIBO|SALAR|HOLERITE|FOLHA|PAGAMENTO|TRCT/.test(k);
const RHD_SEG = ['ASO', 'INTEGRACAO', 'OS', 'FICHA EPI', 'NR', 'CERTIFICADO CURSO', 'ATESTADO'];
async function rhBox(f) {
  const box = $('#vi-rh'); if (!box) return; let d = null;
  try { const s = await db.doc('rh_docs/' + f.id).get(); d = s.exists ? s.data() : null; } catch (e) { box.innerHTML = '<p class="ct">Documentos pessoais e de RH</p><p class="note">Seu usuário não tem acesso aos documentos do RH.</p>'; return; }
  if (!$('#vi-rh')) return;
  if (!d) { box.innerHTML = '<p class="ct">Documentos pessoais e de RH (Drive do RH)</p><p class="note">Nenhuma pasta deste funcionário foi encontrada no Drive do RH.</p>'; return; }
  const vs = podeFolha(); const t = Object.fromEntries(Object.entries(d.tipos || {}).filter(([k]) => vs || !ehSal(k))); const lk = id => 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view';
  const outros = Object.keys(t).filter(k => !RHD.some(x => x[0] === k)).map(k => [k, k.charAt(0) + k.slice(1).toLowerCase()]);
  const lin = ([k, n]) => t[k] ? `<tr><td>${esc(n)}</td><td class="n">${num(t[k].n)}</td><td>${fmtD(t[k].d)}</td><td><a href="${lk(t[k].id)}" target="_blank" rel="noopener">abrir</a></td></tr>` : '';
  const pess = RHD.filter(([k]) => !RHD_SEG.includes(k)).concat(outros).map(lin).join(''), seg = RHD.filter(([k]) => RHD_SEG.includes(k)).map(lin).join('');
  const cab = '<thead><tr><th>Documento</th><th class="n">Arquivos</th><th>Mais recente</th><th></th></tr></thead>';
  box.innerHTML = `<p class="ct">Documentos pessoais e de RH (Drive do RH)</p>
    <div class="actions" style="margin:6px 0 8px;justify-content:flex-start;flex-wrap:wrap;gap:8px">${(vs ? d.pastas || [] : []).map((p, i) => `<a class="btn primary sm" href="https://drive.google.com/drive/folders/${esc(p.id)}" target="_blank" rel="noopener">Abrir pasta${(d.pastas || []).length > 1 ? ' ' + (i + 1) : ''} no Drive (baixar tudo)</a>`).join('')}</div>
    ${vs ? '' : '<p class="note" style="margin:0 0 8px">Contrato, ficha de empregado, CTPS, férias, rescisão e outros documentos com salário só aparecem para quem tem a permissão <b>Vê salários</b>.</p>'}<p class="note" style="margin:0 0 8px${vs ? '' : ';display:none'}">Para baixar tudo de uma vez: abra a pasta, selecione todos os arquivos (Ctrl+A) e use <b>Fazer download</b>; o Drive entrega um .zip.</p>
    ${pess ? `<p class="note" style="margin:8px 0 2px"><b>Pessoais e RH</b></p><div class="tbwrap" style="margin:0"><table class="tb">${cab}<tbody>${pess}</tbody></table></div>` : ''}
    ${seg ? `<p class="note" style="margin:12px 0 2px"><b>Segurança e saúde (ASO, OS, ficha de EPI, certificados)</b></p><div class="tbwrap" style="margin:0"><table class="tb">${cab}<tbody>${seg}</tbody></table></div>` : ''}
    <p class="note" style="margin-top:6px">Os arquivos ficam no Drive do RH: o link abre para quem tem acesso à pasta. Lista atualizada em ${fmtD(str(d.em).slice(0, 10))}.</p>`;
}

/* ---------- folha: importação do extrato mensal e indicadores ---------- */
const RUB = [ /* [chave, teste no nome da rubrica, é hora?] */
  ['he50', n => /HORAS EXTRAS 50%/.test(n) && !/NOTURN/.test(n), 1], ['he70', n => /HORAS EXTRAS 70%/.test(n) && !/NOTURN/.test(n), 1], ['he100', n => /HORAS EXTRAS 100%/.test(n) && !/NOTURN/.test(n), 1],
  ['heNot', n => /HORAS EXTRAS .*NOTURN/.test(n), 1], ['dsrHe', n => /REFLEXO EXTRAS DSR/.test(n), 0], ['adNot', n => /ADICIONAL NOTURNO|ADIC\. NOTURNO/.test(n), 1],
  ['insal', n => /INSALUB/.test(n), 0], ['peric', n => /PERICULOSIDADE/.test(n), 0], ['faltas', n => /^HORAS FALTAS($| PARCIAL)/.test(n), 1], ['faltasDsr', n => /^HORAS FALTAS DSR/.test(n), 1],
  ['afast', n => /HORAS AFAST/.test(n), 1], ['ferias', n => /FERIAS|FÉRIAS/.test(n) && !/RESC|INDENIZ|INSS|IRRF|ADIANTAMENTO/.test(n), 0], ['resc', n => /RESCIS|AVISO PREVIO|INDENIZ|MULTA/.test(n), 0],
  ['ajuda', n => /AJUDA DE CUSTO/.test(n), 0], ['planoDesc', n => /PLANO DE SA/.test(n), 0], ['vtDesc', n => /VALE TRANSPORTE/.test(n), 0], ['bolsa', n => /BOLSA AUXILIO/.test(n), 0]];
function agrega(rub) {
  const a = {}; (rub || []).forEach(r => { if (r.inf) return; const n = str(r.n).toUpperCase(); RUB.forEach(([k, t, h]) => { if (!t(n)) return; a[k + 'v'] = Math.round((num(a[k + 'v']) + num(r.v)) * 100) / 100; if (h) a[k + 'h'] = Math.round((num(a[k + 'h']) + num(r.ref)) * 100) / 100; }); });
  a.heh = Math.round((num(a.he50h) + num(a.he70h) + num(a.he100h) + num(a.heNoth)) * 100) / 100; a.hev = Math.round((num(a.he50v) + num(a.he70v) + num(a.he100v) + num(a.heNotv) + num(a.dsrHev)) * 100) / 100; return a;
}
const comps = () => [...new Set((D.folha || []).map(x => x.comp))].sort().reverse();
const doMes = c => (D.folha || []).filter(x => x.comp === c && (!idsAreaF() || idsAreaF().has(x.funcionarioId)));
function idsAreaF() { return (AREA_FIXA || V.area) ? new Set(daArea(D.func).map(f => f.id)) : null; }
const custoF = x => num(x.proventos) + num(x.fgts);
const ativoNaFolha = x => !/demit/i.test(str(x.situacao));
function tFolha() {
  const C = comps(); if (!V.comp || !C.includes(V.comp)) V.comp = C[0] || '';
  const imp = `<div class="card"><div class="head" style="margin:0"><p class="ct" style="margin:0;margin-right:auto">Importar a folha do mês</p><label class="btn primary sm" style="margin:0;cursor:pointer">Escolher o extrato (PDF)<input type="file" id="fo-file" accept="application/pdf,.pdf" hidden></label></div>
    <p class="note" style="margin:6px 0 0">Use o <b>Extrato Mensal</b> que a contabilidade manda (o PDF com todos os funcionários). Todo mês: importe o do mês fechado. Se importar o mesmo mês de novo, ele é substituído. CPF, matrícula e admissão que estiverem vazios no cadastro são preenchidos com os dados da folha.</p><div id="fo-prev"></div></div>`;
  if (!C.length) { PB().innerHTML = imp + '<div class="empty">Nenhuma folha importada ainda. Importe o extrato mensal acima para ver horas extras, horas noturnas, adicionais, faltas, salários por função e custo.</div>' + (window.ccCard ? ccCard() : '') + beneficiosCard(); return ligaImport(); }
  const L = doMes(V.comp); const M12 = C.slice(0, 12).reverse();
  const S = k => L.reduce((a, x) => a + num((x.ag || {})[k]), 0);
  const prov = L.reduce((a, x) => a + num(x.proventos), 0), custo = L.reduce((a, x) => a + custoF(x), 0), fgts = L.reduce((a, x) => a + num(x.fgts), 0);
  const heh = S('heh'), hev = S('hev'), hnot = S('heNoth'), adn = S('adNotv'), adnh = S('adNoth'), ins = S('insalv'), per = S('pericv'), fh = S('faltash'), afH = S('afasth');
  const at = L.filter(ativoNaFolha), sal = at.map(x => num(x.salario)).filter(v => v > 0);
  const afast = L.filter(x => /doen|afast|acid|matern/i.test(str(x.situacao)));
  const nomeL = x => { const f = funcDe(x.funcionarioId); return f ? `<a href="#" data-pessoa="${esc(f.id)}">${esc(x.nome)}</a>` : esc(x.nome) + ' <span class="note">(sem cadastro)</span>'; };
  const ord = (k) => L.slice().sort((a, b) => num((b.ag || {})[k]) - num((a.ag || {})[k])).filter(x => num((x.ag || {})[k]) > 0);
  const linP = (x, extra) => ({ pessoa: x.funcionarioId || '', c: [nomeL(x), esc(x.cargo)].concat(extra) });
  /* por grupo (área do cadastro ou cargo da folha) */
  const grpK = x => { const f = funcDe(x.funcionarioId); return f ? (f.area || 'Sem área') : 'Sem cadastro'; };
  const porGrupo = (fnK, k) => { const o = {}; L.forEach(x => { const g = fnK(x); o[g] = (o[g] || 0) + num((x.ag || {})[k]); }); return Object.entries(o).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]); };
  /* salário por cargo */
  const cg = {}; at.forEach(x => { const k = str(x.cargo).trim() || 'Sem cargo'; (cg[k] = cg[k] || []).push(x); });
  const CG = Object.entries(cg).map(([k, X]) => { const s = X.map(x => num(x.salario)).filter(v => v > 0); return { k, X, n: X.length, min: Math.min(...s), max: Math.max(...s), med: media(s), adic: media(X.map(x => num((x.ag || {}).insalv) + num((x.ag || {}).pericv) + num((x.ag || {}).adNotv))), hev: media(X.map(x => num((x.ag || {}).hev))), prov: media(X.map(x => num(x.proventos))) }; }).sort((a, b) => b.med - a.med);
  const ben = benTotal(at.length);
  PB().innerHTML = imp + `<div class="top2" style="margin-top:4px"><label style="margin:0">Mês</label><select id="fo-comp">${C.map(c => `<option value="${c}" ${c === V.comp ? 'selected' : ''}>${mesNome(c)}</option>`).join('')}</select><span class="note">${L.length} pessoas na folha de ${mesNome(V.comp)}${idsAreaF() ? ' (área filtrada)' : ''}</span></div>
    <div class="kpis">${kpiG('Folha bruta (proventos)', brl(prov), 'info', 'custo c/ FGTS ' + brl(custo), () => ['Folha bruta', `Soma dos proventos de ${L.length} pessoas + FGTS ${brl2(fgts)} = custo ${brl2(custo)} (sem INSS patronal e benefícios).`, tabela(['Nome', 'Cargo', 'Proventos', 'FGTS', 'Líquido'], L.slice().sort((a, b) => num(b.proventos) - num(a.proventos)).map(x => linP(x, [brl2(x.proventos), brl2(x.fgts), brl2(x.liquido)])), [2, 3, 4])])
      + kpiG('Horas extras', hh(heh), heh ? 'warn' : '', brl(hev) + ' · ' + pc1(hev, prov) + ' da folha', () => ['Horas extras', `50%: ${hh(S('he50h'))} · 70%: ${hh(S('he70h'))} · 100%: ${hh(S('he100h'))} · noturnas: ${hh(hnot)}. Valor inclui o reflexo no DSR (${brl2(S('dsrHev'))}).`, tabela(['Nome', 'Cargo', 'HE 50%', 'HE 70%', 'HE 100%', 'HE noturna', 'Total (h)', 'Valor'], ord('heh').map(x => { const a = x.ag; return linP(x, [hh(a.he50h), hh(a.he70h), hh(a.he100h), hh(a.heNoth), '<b>' + hh(a.heh) + '</b>', brl2(a.hev)]); }), [2, 3, 4, 5, 6, 7])])
      + kpiG('Horas extras noturnas', hh(hnot), '', brl(S('heNotv')), () => ['Horas extras noturnas', '', tabela(['Nome', 'Cargo', 'Horas', 'Valor'], ord('heNoth').map(x => linP(x, [hh(x.ag.heNoth), brl2(x.ag.heNotv)])), [2, 3])])
      + kpiG('Adicional noturno', brl(adn), '', hh(adnh) + ' noturnas', () => ['Adicional noturno', 'Horas com adicional noturno e o valor pago (com o reflexo no DSR).', tabela(['Nome', 'Cargo', 'Horas', 'Valor'], ord('adNotv').map(x => linP(x, [hh(x.ag.adNoth), brl2(x.ag.adNotv)])), [2, 3])])
      + kpiG('Insalubridade + periculosidade', brl(ins + per), '', 'insal. ' + brl(ins) + ' · peric. ' + brl(per), () => ['Adicionais de insalubridade e periculosidade', '', tabela(['Nome', 'Cargo', 'Insalubridade', 'Periculosidade'], L.filter(x => num(x.ag.insalv) + num(x.ag.pericv) > 0).sort((a, b) => (num(b.ag.insalv) + num(b.ag.pericv)) - (num(a.ag.insalv) + num(a.ag.pericv))).map(x => linP(x, [brl2(x.ag.insalv), brl2(x.ag.pericv)])), [2, 3])])
      + kpiG('Salário médio', sal.length ? brl(media(sal)) : '—', '', at.length + ' ativos na folha', () => ['Salário-base médio', `Média do salário-base de ${sal.length} pessoas ativas na folha (sem adicionais e horas extras).`, tabela(['Nome', 'Cargo', 'Salário'], at.slice().sort((a, b) => num(b.salario) - num(a.salario)).map(x => linP(x, [brl2(x.salario)])), [2])])
      + kpiG('Faltas descontadas', hh(fh), fh ? 'warn' : '', brl(S('faltasv') + S('faltasDsrv')) + ' descontados', () => ['Faltas descontadas na folha', 'Horas de falta e atraso descontadas (o DSR perdido aparece à parte).', tabela(['Nome', 'Cargo', 'Faltas (h)', 'DSR perdido (h)', 'Descontado'], ord('faltash').map(x => linP(x, [hh(x.ag.faltash), hh(x.ag.faltasDsrh), brl2(num(x.ag.faltasv) + num(x.ag.faltasDsrv))])), [2, 3, 4])])
      + kpiG('Afastados (INSS / doença)', afast.length, afast.length ? 'warn' : '', hh(afH) + ' afastadas', () => ['Afastados', 'Situação de afastamento no extrato da folha.', tabela(['Nome', 'Cargo', 'Situação', 'Horas afastadas'], afast.map(x => linP(x, [esc(x.situacao), hh(x.ag.afasth)])), [3])])
      + kpiG('Desligados no mês (folha)', L.filter(x => !ativoNaFolha(x)).length, '', brl(S('rescv')) + ' em verbas rescisórias', () => ['Desligados na folha do mês', '', tabela(['Nome', 'Cargo', 'Verbas rescisórias', 'Líquido'], L.filter(x => !ativoNaFolha(x)).map(x => linP(x, [brl2(x.ag.rescv), brl2(x.liquido)])), [2, 3])])
      + kpiG('Benefícios (estimado)', ben.total ? brl(ben.total) : '—', '', ben.total ? 'por mês' : 'cadastre abaixo', () => ['Benefícios', 'Estimativa: valor mensal de cada benefício × pessoas elegíveis (ativos; "após a experiência" conta só quem tem mais de 90 dias de casa).', tabela(['Benefício', 'Valor por pessoa', 'Elegíveis', 'Total no mês'], ben.L.map(b => [esc(b.nome), brl2(b.valor), b.n, brl2(b.total)]), [1, 2, 3])])}</div>
    <div class="rgrid">
      <div class="card"><p class="ct">Horas extras por mês</p>${barras(M12.map(c => { const X = doMes(c); const h = X.reduce((a, x) => a + num((x.ag || {}).heh), 0); return { t: mesNome(c), v: h, s: hh(h) + ' · ' + brl(X.reduce((a, x) => a + num((x.ag || {}).hev), 0)), cor: c === V.comp ? 'var(--s2)' : 'var(--s1)', data: `data-fcomp="${c}"` }; }))}</div>
      <div class="card"><p class="ct">Folha bruta por mês</p>${barras(M12.map(c => { const v = doMes(c).reduce((a, x) => a + num(x.proventos), 0); return { t: mesNome(c), v, s: brl(v), cor: c === V.comp ? 'var(--s2)' : 'var(--s3)', data: `data-fcomp="${c}"` }; }))}</div>
      <div class="card"><p class="ct">Horas extras por área (${mesNome(V.comp)})</p>${barras(porGrupo(grpK, 'heh').map(([t, v]) => ({ t, v, s: hh(v) })))}</div>
      <div class="card"><p class="ct">Horas noturnas por área (${mesNome(V.comp)})</p>${barras(porGrupo(grpK, 'adNoth').map(([t, v]) => ({ t, v, s: hh(v), cor: 'var(--s3)' })))}</div>
      <div class="card"><p class="ct">Quem mais fez hora extra</p>${barras(ord('heh').slice(0, 12).map(x => ({ t: x.nome, v: x.ag.heh, s: hh(x.ag.heh) + ' · ' + brl(x.ag.hev), cor: 'var(--s2)', data: x.funcionarioId ? `data-pessoa="${esc(x.funcionarioId)}"` : '' })))}</div>
      <div class="card"><p class="ct">Horas extras por cargo</p>${barras(porGrupo(x => str(x.cargo).trim() || 'Sem cargo', 'heh').slice(0, 12).map(([t, v]) => ({ t, v, s: hh(v) })))}</div></div>
    <h3>Quanto cada função paga (${mesNome(V.comp)})</h3>
    <div class="card" style="padding:6px 10px">${tabela(['Cargo (folha)', 'Pessoas', 'Salário mín.', 'Salário médio', 'Salário máx.', 'Adicionais (média)', 'HE (média)', 'Remuneração bruta média', ben.porPessoa ? 'Com benefícios' : null].filter(Boolean), CG.map(g => [`<a href="#" data-cargo="${esc(g.k)}">${esc(g.k)}</a>`, g.n, brl2(g.min), '<b>' + brl2(g.med) + '</b>', brl2(g.max), brl2(g.adic), brl2(g.hev), brl2(g.prov)].concat(ben.porPessoa ? [brl2(g.prov + ben.porPessoa)] : [])), [1, 2, 3, 4, 5, 6, 7, 8])}
      <p class="note" style="margin:6px 0 0">Adicionais = insalubridade + periculosidade + adicional noturno. Remuneração bruta = todos os proventos do mês. Toque no cargo para ver as pessoas.</p><div id="fo-cargo"></div></div>
    ${window.ccCard ? ccCard() : ''}
    ${beneficiosCard()}`;
  $('#fo-comp').onchange = e => { V.comp = e.target.value; tFolha(); };
  PB().querySelectorAll('[data-fcomp]').forEach(b => b.onclick = () => { V.comp = b.dataset.fcomp; tFolha(); });
  PB().querySelectorAll('[data-cargo]').forEach(a => a.onclick = e => { e.preventDefault(); const g = CG.find(x => x.k === a.dataset.cargo); $('#fo-cargo').innerHTML = `<p class="ct" style="margin-top:10px">${esc(g.k)}</p>` + tabela(['Nome', 'Cargo', 'Salário', 'Adicionais', 'HE', 'Proventos'], g.X.sort((a, b) => num(b.salario) - num(a.salario)).map(x => linP(x, [brl2(x.salario), brl2(num(x.ag.insalv) + num(x.ag.pericv) + num(x.ag.adNotv)), brl2(x.ag.hev), brl2(x.proventos)])), [2, 3, 4, 5]); });
  ligaImport();
}
/* benefícios: cadastro simples (valor mensal por pessoa), usado na estimativa de custo e na remuneração por função */
function benTotal(nAtivos) {
  const B = (D.benef && D.benef.lista) || []; const at = daArea(ativos()).filter(f => f.vinculo !== 'PJ'); const exp = at.filter(f => { const a = anosEntre(f.admissao); return a != null && a >= 90 / 365.25; }).length;
  const L = B.filter(b => b.ativo !== false && num(b.valor) > 0).map(b => { const n = b.regra === 'experiencia' ? exp : at.length; return { nome: b.nome, valor: num(b.valor), n, total: num(b.valor) * n }; });
  const total = L.reduce((a, b) => a + b.total, 0); return { L, total, porPessoa: B.filter(b => b.ativo !== false).reduce((a, b) => a + num(b.valor), 0) };
}
function beneficiosCard() {
  const B = (D.benef && D.benef.lista) || [];
  return `<h3>Benefícios</h3><div class="card"><p class="note" style="margin:0 0 8px">Valor mensal por pessoa. Entra na estimativa de custo e na coluna "com benefícios" da tabela de funções. Ex.: cartão alimentação R$ 250, assiduidade R$ 250, plano de saúde (parte da empresa por vida).</p>
    <div id="bn-l">${(B.length ? B : [{ nome: 'Cartão alimentação', valor: 250, regra: 'todos' }, { nome: 'Assiduidade (cartão)', valor: 250, regra: 'todos' }, { nome: 'Plano de saúde (parte da empresa)', valor: 0, regra: 'experiencia' }]).map(benLinha).join('')}</div>
    <div class="actions" style="justify-content:flex-start;gap:8px"><button class="btn ghost sm" id="bn-add" type="button">+ Benefício</button><button class="btn primary sm" id="bn-sv" type="button">Salvar benefícios</button></div>${B.length ? '' : '<p class="note" style="margin:6px 0 0">Ainda não salvo: confira os valores e toque em Salvar.</p>'}</div>`;
}
const benLinha = b => `<div class="grid3 bn-r" style="align-items:end"><div><label>Benefício</label><input class="bn-n" value="${esc(b.nome)}"></div><div><label>Valor mensal por pessoa (R$)</label><input class="bn-v" inputmode="decimal" value="${num(b.valor) ? String(num(b.valor)).replace('.', ',') : ''}"></div><div><label>Quem recebe</label><select class="bn-g"><option value="todos" ${b.regra !== 'experiencia' ? 'selected' : ''}>Todos os CLT ativos</option><option value="experiencia" ${b.regra === 'experiencia' ? 'selected' : ''}>Após a experiência (90 dias)</option></select></div></div>`;
document.addEventListener('click', async e => {
  if (e.target.closest('#bn-add')) { $('#bn-l').insertAdjacentHTML('beforeend', benLinha({ nome: '', valor: 0, regra: 'todos' })); return; }
  if (!e.target.closest('#bn-sv')) return;
  const lista = $$('#bn-l .bn-r').map(r => ({ nome: r.querySelector('.bn-n').value.trim(), valor: num(r.querySelector('.bn-v').value.replace(/\./g, '').replace(',', '.')), regra: r.querySelector('.bn-g').value })).filter(b => b.nome);
  try { await db.doc('config/beneficios').set({ lista, em: new Date().toISOString(), por: (window.__FB || {}).uid || '' }); D.benef = { lista }; toast('Benefícios salvos.', 'ok'); render(); } catch (er) { toast('Não foi possível salvar (permissão).', 'bad'); }
});

/* importação: lê o PDF no navegador, confere, mostra o resumo e grava */
async function pdfLib() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; return window.pdfjsLib;
}
async function lerExtrato(file) {
  const lib = await pdfLib(); const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); pages.push(tc.items.map(t => ({ x: t.transform[4], y: t.transform[5], s: t.str }))); }
  return folhaParse(pages);
}
function casar(r) {
  const porCpf = {}, porMat = {}, porNome = {}; D.func.forEach(f => { const c = soDig(f.cpf); if (c.length === 11) porCpf[c] = f; if (str(f.matricula).trim()) porMat[str(f.matricula).trim().replace(/^0+/, '')] = f; const n = norm(f.nome).replace(/\s+/g, ' '); (porNome[n] = porNome[n] || []).push(f); });
  return r.func.map(x => { let f = porCpf[x.cpf], como = f ? 'CPF' : '';
    if (!f) { const L = porNome[norm(x.nome).replace(/\s+/g, ' ')] || []; if (L.length === 1) { f = L[0]; como = 'nome'; } else if (L.length > 1) { f = L.find(y => str(y.matricula).replace(/^0+/, '') === x.cod) || L.find(y => y.ativo !== false) || L[0]; como = 'nome'; } }
    if (!f) { const m = porMat[x.cod]; if (m && norm(m.nome).split(' ')[0] === norm(x.nome).split(' ')[0]) { f = m; como = 'matrícula'; } }
    return { x, f, como }; });
}
function ligaImport() {
  if (window.ligaCC) ligaCC();
  const inp = $('#fo-file'); if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files[0]; inp.value = ''; if (!file) return; const box = $('#fo-prev'); box.innerHTML = '<p class="note">Lendo o PDF…</p>';
    let r; try { r = await lerExtrato(file); } catch (e) { box.innerHTML = '<p class="note" style="color:var(--bad)">Não foi possível ler este PDF. Confira se é o Extrato Mensal da folha.</p>'; return; }
    if (!r.comp || !r.func.length) { box.innerHTML = '<p class="note" style="color:var(--bad)">Este PDF não parece ser o Extrato Mensal da folha (não achei a competência nem os funcionários).</p>'; return; }
    const outra = r.cnpj && soDig(r.cnpj) !== '03052261000143';
    const M = casar(r); const sem = M.filter(m => !m.f);
    const upd = M.filter(m => m.f).map(m => { const o = {}; if (soDig(m.f.cpf).length !== 11 && m.x.cpf.length === 11) o.cpf = fmtCpf(m.x.cpf); if (!str(m.f.matricula).trim()) o.matricula = m.x.cod; if (!m.f.admissao && m.x.adm) o.admissao = m.x.adm; return { f: m.f, o }; }).filter(u => Object.keys(u.o).length);
    const soma = r.func.reduce((a, x) => a + num(x.proventos), 0); const ja = comps().includes(r.comp);
    box.innerHTML = `<div class="card" style="margin:10px 0 0;border-color:#1f4e9c"><p class="ct">Conferência: folha de ${mesNome(r.comp)}</p>
      ${outra ? `<p class="note" style="color:var(--bad)">Atenção: o CNPJ do PDF (${esc(r.cnpj)}) não é o da Previne.</p>` : ''}
      <dl class="kv"><dt>Funcionários no extrato</dt><dd>${r.func.length} (sócios ficam de fora)</dd><dt>Proventos somados</dt><dd>${brl2(soma)}</dd><dt>Encontrados no cadastro</dt><dd>${M.length - sem.length} (${M.filter(m => m.como === 'CPF').length} pelo CPF, ${M.filter(m => m.como === 'nome').length} pelo nome, ${M.filter(m => m.como === 'matrícula').length} pela matrícula)</dd>
      <dt>Cadastro a completar</dt><dd>${upd.length ? `${upd.filter(u => u.o.cpf).length} CPF · ${upd.filter(u => u.o.matricula).length} matrícula · ${upd.filter(u => u.o.admissao).length} admissão` : 'nada (já está completo)'}</dd></dl>
      ${sem.length ? `<details style="margin-top:6px"><summary class="note">${sem.length} da folha sem cadastro no portal (entram nos indicadores, sem ficha)</summary><p class="note">${sem.map(m => esc(m.x.nome) + ' (' + esc(m.x.cargo) + ', ' + esc(m.x.situacao) + ')').join('; ')}</p></details>` : ''}
      ${ja ? `<p class="note" style="color:var(--warn)">A folha de ${mesNome(r.comp)} já foi importada: ela será substituída por esta.</p>` : ''}
      <div class="actions" style="justify-content:flex-start;gap:8px"><button class="btn primary" id="fo-ok" type="button">Importar ${mesNome(r.comp)}</button><button class="btn ghost" id="fo-no" type="button">Cancelar</button></div><p class="note" id="fo-st"></p></div>`;
    $('#fo-no').onclick = () => { box.innerHTML = ''; };
    $('#fo-ok').onclick = async () => {
      const b = $('#fo-ok'); b.disabled = true; $('#fo-no').disabled = true; const st = $('#fo-st'); const now = new Date().toISOString(), por = (window.__FB || {}).uid || '';
      try {
        const exM = {}; (D.folha || []).filter(x => x.comp === r.comp).forEach(x => { const o = {}; ['absExcl', 'heExcl', 'notExcl'].forEach(k => { if (x[k] === true) o[k] = true; }); if (Object.keys(o).length) exM[x.id] = o; });
        if (ja) { const velhos = (D.folha || []).filter(x => x.comp === r.comp); for (let i = 0; i < velhos.length; i++) { await db.doc('folha/' + velhos[i].id).delete(); if (i % 20 === 0) st.textContent = `Limpando a importação anterior… ${i}/${velhos.length}`; } }
        let i = 0; for (const m of M) { const x = m.x;
          await db.doc('folha/' + r.comp + '_' + x.cod).set(JSON.parse(JSON.stringify({ ...(exM[r.comp + '_' + x.cod] || {}), comp: r.comp, cod: x.cod, nome: x.nome, cpf: x.cpf, adm: x.adm, situacao: x.situacao, vinculo: str(x.vinculo), cargo: str(x.cargo), cbo: str(x.cbo), salario: num(x.salario), horasMes: num(x.horasMes), proventos: num(x.proventos), descontos: num(x.descontos), liquido: num(x.liquido), fgts: num(x.fgts), baseInss: num(x.baseInss), rub: x.rub, ag: agrega(x.rub), obs: str(x.obs), funcionarioId: m.f ? m.f.id : '', importadoEm: now, por, arquivo: file.name })));
          if (++i % 10 === 0) { st.textContent = `Gravando… ${i}/${M.length}`; await new Promise(z => setTimeout(z, 60)); } }
        let k = 0; for (const u of upd) { try { await db.doc('funcionarios/' + u.f.id).update(u.o); k++; } catch (e) { console.warn('cadastro', u.f.nome, e); } if (k % 10 === 0) st.textContent = `Completando o cadastro… ${k}/${upd.length}`; }
        await db.doc('folha_imp/' + r.comp).set({ comp: r.comp, arquivo: file.name, n: M.length, semCadastro: sem.length, proventos: soma, cadastroCompletado: k, em: now, por });
        toast(`Folha de ${mesNome(r.comp)} importada: ${M.length} pessoas; ${k} cadastros completados.`, 'ok'); V.comp = r.comp; carregar();
      } catch (e) { b.disabled = false; $('#fo-no').disabled = false; st.innerHTML = '<span style="color:var(--bad)">Não foi possível gravar: ' + esc(e.message || e) + '. Seu usuário precisa ter a permissão Vê salários.</span>'; }
    };
  };
}

/* ---------- absenteísmo (por enquanto: faltas e afastamentos da folha; com o RHiD ligado, passa a usar o ponto) ---------- */
/* absenteísmo, horas extras e noturnas: ver horas.js (janelinhas na Visão geral) */
/* ---------- exportação da lista de funcionários: escolher colunas, indicadores individuais, Excel ou PDF ---------- */
function kpisPessoa(f) {
  const h = hoje(), d12 = addDays(-365), pf = podeFolha(); const o = {};
  const G = grupos().filter(g => obrig(g, f)); const st = G.map(g => { const u = ultimo(f.id, g.k); return { g, s: u ? trState(u) : 'falta' }; });
  o.nrExig = G.length; o.nrOk = st.filter(x => x.s === 'ok' || x.s === 'vence').length; o.nrPct = G.length ? o.nrOk / G.length : null;
  o.nrVenc = st.filter(x => x.s === 'vencido').map(x => x.g.nome).join(', '); o.nrFalta = st.filter(x => x.s === 'falta').map(x => x.g.nome).join(', '); o.nrVence = st.filter(x => x.s === 'vence').map(x => x.g.nome).join(', ');
  const T12 = D.tr.filter(r => r.funcionarioId === f.id && str(r.termino) >= d12 && str(r.termino) <= h); o.tr12 = T12.length; o.trH12 = T12.reduce((a, r) => a + num(r.cargaHoraria), 0) + D.ext.filter(x => x.funcionarioId === f.id && str(x.termino) >= d12).reduce((a, x) => a + num(x.cargaHoraria), 0);
  const P = D.pad.filter(p => precisa(p, f)); const ps = P.map(p => ({ p, s: padSt(p, f.id).st })); o.padExig = P.length; o.padOk = ps.filter(x => x.s === 'ok').length; o.padPend = ps.filter(x => x.s !== 'ok').map(x => x.p.codigo).join(', ');
  const E = D.ent.filter(e => e.funcionarioId === f.id && str(e.data).slice(0, 10) >= d12); o.epiQ = E.reduce((a, e) => a + (num(e.qtd) || 1), 0); o.epiR = E.reduce((a, e) => a + num(e.custo) * (num(e.qtd) || 1), 0); o.epiMau = E.filter(e => ['mau_uso', 'perda'].includes(e.motivo)).length;
  o.epiUlt = D.ent.filter(e => e.funcionarioId === f.id).map(e => str(e.data).slice(0, 10)).sort().pop() || '';
  const C = D.caut.filter(c => c.funcionarioId === f.id); const pend = C.flatMap(c => (c.itens || []).filter(i => !i.devolvido).map(i => ({ c, i })));
  o.ferPosse = pend.length; o.ferAtraso = pend.filter(x => x.c.previsaoDevolucao && str(x.c.previsaoDevolucao) < h).length; o.ferLista = pend.map(x => x.i.codigo || x.i.descricao).join(', ');
  o.ferOc = C.flatMap(c => c.itens || []).filter(i => ['mau_uso', 'dano', 'extraviada', 'extravio'].includes(str(i.estadoDevolucao))).length;
  if (pf) { const FO = (D.folha || []).filter(x => x.funcionarioId === f.id).sort((a, b) => str(b.comp).localeCompare(str(a.comp))); const U = FO.slice(0, 12), U3 = FO.slice(0, 3); const sm = (L, k) => L.reduce((a, x) => a + num((x.ag || {})[k]), 0);
    o.cargo = FO[0] ? FO[0].cargo : ''; o.sal = FO[0] ? num(FO[0].salario) : null; o.prov3 = U3.length ? U3.reduce((a, x) => a + num(x.proventos), 0) / U3.length : null; o.custo3 = U3.length ? U3.reduce((a, x) => a + num(x.proventos) + num(x.fgts), 0) / U3.length : null;
    o.heH = sm(U, 'heh'); o.heR = sm(U, 'hev'); o.heMes = U.length ? o.heH / U.length : null; o.notH = sm(U, 'adNoth'); o.fH = sm(U, 'faltash'); o.afH = sm(U, 'afasth'); const hm = U.reduce((a, x) => a + (num(x.horasMes) || 220), 0); o.abs = hm ? o.fH / hm : null; o.meses = U.length; }
  return o;
}
const COLS_F = [
  ['Cadastro', [['nome', 'Nome', 'txt', 34, f => f.nome, 1], ['mat', 'Matrícula', 'txt', 11, f => f.matricula, 1], ['cpf', 'CPF', 'txt', 16, f => podeFolha() ? fmtCpf(f.cpf) : cpfMask(f.cpf), 1], ['funcao', 'Função', 'txt', 30, f => f.funcao, 1], ['area', 'Área', 'txt', 16, f => f.area, 1], ['sub', 'Subárea', 'txt', 18, f => f.subarea || subsDe(f).map(subNome).join(', '), 0], ['unid', 'Unidade', 'txt', 14, f => f.unidade, 0], ['vinc', 'Vínculo', 'txt', 9, f => f.vinculo || 'CLT', 0], ['adm', 'Admissão', 'data', 12, f => f.admissao, 1], ['casa', 'Tempo de casa (anos)', 'num', 12, f => { const v = anosEntre(f.admissao, f.ativo === false && f.demissao ? str(f.demissao).slice(0, 10) : ''); return v == null ? null : Math.round(v * 10) / 10; }, 1], ['nasc', 'Nascimento', 'data', 12, f => f.nascimento, 0], ['idade', 'Idade', 'int', 7, f => { const v = anosEntre(f.nascimento); return v == null ? null : Math.floor(v); }, 0], ['sit', 'Situação', 'txt', 13, f => f.ativo === false ? 'Desligado' : (f.situacao || 'Trabalhando'), 1], ['dem', 'Desligamento', 'data', 12, f => f.demissao, 0], ['demt', 'Tipo / motivo do desligamento', 'txt', 28, f => [f.demissaoTipo, f.demissaoMotivo].filter(Boolean).join(' · '), 0], ['alt', 'Trabalho em altura', 'txt', 9, f => f.altura ? 'Sim' : 'Não', 0], ['tam', 'Tamanhos (camisa / calça / calçado)', 'txt', 20, f => [f.tamCamisa || f.tamRoupa, f.tamCalca, f.tamCalcado].map(x => x || '—').join(' / '), 0]]],
  ['Treinamentos e padrões', [['nrExig', 'NRs exigidas', 'int', 9, (f, k) => k.nrExig, 1], ['nrOk', 'NRs em dia', 'int', 9, (f, k) => k.nrOk, 1], ['nrPct', '% NRs em dia', 'pct', 10, (f, k) => k.nrPct, 1], ['nrVenc', 'NRs vencidas', 'txt', 22, (f, k) => k.nrVenc, 1], ['nrFalta', 'NRs que faltam', 'txt', 22, (f, k) => k.nrFalta, 0], ['nrVence', 'Vencem em 60 dias', 'txt', 22, (f, k) => k.nrVence, 0], ['tr12', 'Treinamentos (12 meses)', 'int', 11, (f, k) => k.tr12, 0], ['trH12', 'Horas de treinamento (12 meses)', 'h', 12, (f, k) => k.trH12, 0], ['padExig', 'Padrões exigidos', 'int', 9, (f, k) => k.padExig, 0], ['padOk', 'Padrões assinados', 'int', 9, (f, k) => k.padOk, 0], ['padPend', 'Padrões pendentes', 'txt', 24, (f, k) => k.padPend, 0]]],
  ['EPI e ferramentas', [['epiQ', 'EPIs recebidos (12 meses)', 'int', 11, (f, k) => k.epiQ, 0], ['epiR', 'Gasto com EPI (12 meses)', 'brl', 13, (f, k) => k.epiR, 0], ['epiMau', 'Trocas por mau uso/perda (12 meses)', 'int', 12, (f, k) => k.epiMau, 0], ['epiUlt', 'Última entrega de EPI', 'data', 12, (f, k) => k.epiUlt, 0], ['ferPosse', 'Ferramentas em posse', 'int', 10, (f, k) => k.ferPosse, 0], ['ferLista', 'Quais ferramentas', 'txt', 24, (f, k) => k.ferLista, 0], ['ferAtraso', 'Ferramentas em atraso', 'int', 10, (f, k) => k.ferAtraso, 0], ['ferOc', 'Ocorrências (mau uso, dano, extravio)', 'int', 12, (f, k) => k.ferOc, 0]]],
  ['Folha (Admin, Gestão, Gerente e RH)', [['cargo', 'Cargo na folha', 'txt', 26, (f, k) => k.cargo, 0], ['sal', 'Salário-base', 'brl', 13, (f, k) => k.sal, 0], ['prov3', 'Remuneração bruta média (3 meses)', 'brl', 14, (f, k) => k.prov3, 0], ['custo3', 'Custo médio c/ FGTS (3 meses)', 'brl', 14, (f, k) => k.custo3, 0], ['heH', 'Horas extras (12 meses)', 'h', 11, (f, k) => k.heH, 0], ['heMes', 'Horas extras por mês (média)', 'h', 11, (f, k) => k.heMes, 0], ['heR', 'Valor de horas extras (12 meses)', 'brl', 14, (f, k) => k.heR, 0], ['notH', 'Horas com adicional noturno (12 meses)', 'h', 12, (f, k) => k.notH, 0], ['fH', 'Faltas (h, 12 meses)', 'h', 10, (f, k) => k.fH, 0], ['abs', 'Absenteísmo (12 meses)', 'pct', 11, (f, k) => k.abs, 0], ['afH', 'Horas afastadas (12 meses)', 'h', 11, (f, k) => k.afH, 0], ['meses', 'Meses de folha considerados', 'int', 9, (f, k) => k.meses, 0]], 'folha']];
const PRESETS = { padrao: null, cadastro: g => g === 'Cadastro', sst: g => g !== 'Folha (Admin, Gestão, Gerente e RH)' && g !== 'Cadastro', tudo: () => true };
function exportarFunc(L, filtros) {
  const pf = podeFolha(); const grupos_ = COLS_F.filter(g => !g[2] || pf);
  let sel; try { sel = JSON.parse(localStorage.getItem('prev_exp_func') || 'null'); } catch (e) { sel = null; }
  const marcado = c => sel ? sel.includes(c[0]) : !!c[5];
  const box = document.createElement('div'); box.className = 'card'; box.id = 'fx-box'; box.style.borderColor = '#1f4e9c';
  box.innerHTML = `<div class="head" style="margin:0 0 6px"><p class="ct" style="margin:0;margin-right:auto">Exportar ${L.length} funcionário(s)</p><button class="btn sm ghost" type="button" id="fx-x">Fechar</button></div>
    <p class="note" style="margin:0 0 8px">Sai com o cabeçalho da Previne e o número de controle do documento. Usa os filtros da lista${filtros ? ` (${esc(filtros)})` : ''}. Marque o que deve vir na planilha.</p>
    <div class="actions" style="justify-content:flex-start;gap:6px;flex-wrap:wrap;margin:0 0 8px"><span class="note">Prontos:</span><button class="btn sm ghost" type="button" data-pr="cadastro">Só cadastro</button><button class="btn sm ghost" type="button" data-pr="sst">Cadastro + SST</button><button class="btn sm ghost" type="button" data-pr="tudo">Tudo</button></div>
    ${grupos_.map(([g, C], gi) => `<details ${gi < 2 ? 'open' : ''} style="margin:6px 0"><summary style="cursor:pointer;font-weight:600">${esc(g)} <button class="link" type="button" data-gall="${gi}" style="margin-left:8px;font-size:13px">marcar todos</button></summary>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 12px;margin:6px 0 0">${C.map(c => `<label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:400;color:inherit;font-size:14px"><input type="checkbox" data-col="${c[0]}" data-g="${gi}" ${marcado(c) || c[0] === 'nome' ? 'checked' : ''} ${c[0] === 'nome' ? 'disabled' : ''} style="width:17px;height:17px"> ${esc(c[1])}</label>`).join('')}</div></details>`).join('')}
    <div class="grid3" style="align-items:end;margin-top:8px"><div><label>Título</label><input id="fx-tit" value="Relação de funcionários"></div><div><label>Ordenar por</label><select id="fx-ord"><option value="nome">Nome</option><option value="area">Área e nome</option><option value="funcao">Função e nome</option><option value="adm">Admissão</option></select></div><div><label>Linha de totais</label><select id="fx-tot"><option value="1">Sim</option><option value="">Não</option></select></div></div>
    <div class="actions" style="justify-content:flex-start;gap:8px;margin-top:10px"><button class="btn primary" type="button" data-fx="xlsx">Baixar Excel</button><button class="btn ghost" type="button" data-fx="pdf">Baixar PDF</button></div><p class="note" id="fx-st" style="margin:6px 0 0"></p>`;
  const old = $('#fx-box'); if (old) old.remove(); $('#fu-n').before(box); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#fx-x').onclick = () => box.remove();
  box.querySelectorAll('[data-gall]').forEach(b => b.onclick = e => { e.preventDefault(); const ins = box.querySelectorAll(`[data-g="${b.dataset.gall}"]`); const tudo = [...ins].every(i => i.checked); ins.forEach(i => { if (!i.disabled) i.checked = !tudo; }); });
  box.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { const fn = PRESETS[b.dataset.pr]; box.querySelectorAll('[data-col]').forEach(i => { if (i.disabled) return; const g = grupos_[+i.dataset.g][0]; const c = grupos_[+i.dataset.g][1].find(x => x[0] === i.dataset.col); i.checked = b.dataset.pr === 'cadastro' ? (fn(g) && !!c[5]) || (g === 'Cadastro' && c[5]) : fn(g) && (g !== 'Cadastro' || !!c[5]); }); });
  box.querySelectorAll('[data-fx]').forEach(b => b.onclick = async () => {
    const ids = [...box.querySelectorAll('[data-col]')].filter(i => i.checked).map(i => i.dataset.col); try { localStorage.setItem('prev_exp_func', JSON.stringify(ids)); } catch (e) {}
    const C = grupos_.flatMap(g => g[1]).filter(c => ids.includes(c[0])); const precisaK = C.some(c => c[4].length > 1);
    const ord = $('#fx-ord').value; const O = L.slice().sort((a, b) => ord === 'area' ? (str(a.area).localeCompare(str(b.area), 'pt') || str(a.nome).localeCompare(str(b.nome), 'pt')) : ord === 'funcao' ? (str(a.funcao).localeCompare(str(b.funcao), 'pt') || str(a.nome).localeCompare(str(b.nome), 'pt')) : ord === 'adm' ? str(a.admissao).localeCompare(str(b.admissao)) : str(a.nome).localeCompare(str(b.nome), 'pt'));
    const linhas = O.map(f => { const k = precisaK ? kpisPessoa(f) : {}; return C.map(c => { const v = c[4](f, k); return v === '' ? null : v; }); });
    const st = $('#fx-st'); st.textContent = 'Gerando…'; box.querySelectorAll('[data-fx]').forEach(x => x.disabled = true);
    try { await PrevRel.exportar({ modelo: 'rel_funcionarios', titulo: $('#fx-tit').value.trim() || 'Relação de funcionários', cols: C.map(c => ({ t: c[1], tipo: c[2], w: c[3] })), linhas, filtros, arquivo: $('#fx-tit').value.trim() || 'Relacao de funcionarios', formato: b.dataset.fx, totais: !!$('#fx-tot').value, nota: C.some(c => ['heH', 'fH', 'abs', 'heR'].includes(c[0])) ? 'Horas e valores da folha: últimos 12 meses importados. ' : '' }); st.textContent = 'Pronto: arquivo baixado.'; }
    catch (e) { st.textContent = 'Não foi possível gerar: ' + (e.message || e); }
    box.querySelectorAll('[data-fx]').forEach(x => x.disabled = false);
  });
}
/* botão "‹ Voltar" do topo: dentro dos Indicadores volta um passo na tela antes de sair da página */
window.addEventListener('prev-voltar', e => {
  if (V.tab === 'pes' && V.pes) { e.preventDefault(); V.pes = ''; tPesHub(); window.scrollTo(0, 0); return; }
  if (V.tab === 'pad' && V.nav && V.nav.length) { e.preventDefault(); V.nav.pop(); render(); window.scrollTo(0, 0); return; }
  if (V.tab === 'pes' && V.pt && V.pt !== 'geral') { e.preventDefault(); V.pt = 'geral'; tPesHub(); window.scrollTo(0, 0); return; }
});
