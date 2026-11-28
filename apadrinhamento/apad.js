/* Apadrinhamento: o novato (apadrinhado) trabalha acompanhado por um padrinho experiente até ser liberado.
   apadrinhamento/{id} = { fid, nome, funcao, area, padrinhoId, padrinho, inicio, dias, fimPrevisto, ident, obs, acomp:[{data, por, texto, ok}], status:'andamento'|'liberado'|'encerrado', fim, resultado, obsFim }
   O formulário oficial (modelo do Gustavo) entra depois: por enquanto o registro guarda as informações e gera o relatório. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const addDias = (d, n) => { const x = new Date(str(d).slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diasAte = d => Math.round((Date.parse(str(d).slice(0, 10) + 'T12:00:00Z') - Date.parse(hoje() + 'T12:00:00Z')) / 864e5);
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
const D = { ap: [], func: [] }; const V = { tab: 'and', busca: '' }; let db = null, MEU = '', PODE = false;
const ativos = () => D.func.filter(f => f.ativo !== false).sort((a, b) => str(a.nome).localeCompare(str(b.nome), 'pt'));
const fDe = n => D.func.find(f => norm(f.nome) === norm(n));
function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  const and = D.ap.filter(a => a.status === 'andamento'), enc = D.ap.filter(a => a.status !== 'andamento');
  const venc = and.filter(a => diasAte(a.fimPrevisto) < 0).length, prox = and.filter(a => { const d = diasAte(a.fimPrevisto); return d >= 0 && d <= 7; }).length;
  const hj = hoje(); const novatos = D.func.filter(f => f.ativo !== false && f.admissao && f.admissao >= addDias(hj, -60) && !D.ap.some(a => a.fid === f.id));
  const L = (V.tab === 'and' ? and : enc).filter(a => !V.busca || norm(a.nome + ' ' + a.padrinho).includes(norm(V.busca)))
    .sort((a, b) => V.tab === 'and' ? str(a.fimPrevisto).localeCompare(str(b.fimPrevisto)) : str(b.fim).localeCompare(str(a.fim)));
  $('#body').innerHTML = `<div class="kpis">${kpi('Em apadrinhamento', and.length)}${kpi('Terminam em 7 dias', prox, prox ? 'warn' : '')}${kpi('Prazo vencido', venc, venc ? 'bad' : '')}${kpi('Admitidos (60 dias) sem padrinho', novatos.length, novatos.length ? 'warn' : '')}</div>
    ${novatos.length && V.tab === 'and' ? `<div class="card"><div class="ct">Admitidos nos últimos 60 dias sem padrinho</div>${novatos.map(f => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><b>${esc(f.nome)}</b> <span class="cs">${esc(f.funcao || '')} · admitido em ${fmtD(f.admissao)}</span></span>${PODE ? `<button class="btn sm primary" data-novo="${esc(f.id)}" type="button">Definir padrinho</button>` : ''}</div>`).join('')}</div>` : ''}
    <div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="busca" placeholder="Buscar apadrinhado ou padrinho" value="${esc(V.busca)}" style="flex:1;min-width:180px;padding:9px;border:1px solid #cfd4dc;border-radius:8px">${PODE ? '<button class="btn primary" id="novo" type="button">+ Novo apadrinhamento</button>' : ''}<button class="btn sm ghost" id="exp" type="button">Exportar</button></div></div>
    <div class="card">${L.map(a => { const d = diasAte(a.fimPrevisto);
      const b = a.status !== 'andamento' ? `<span class="badge ${a.status === 'liberado' ? 'b-ok' : 'b-mut'}">${a.status === 'liberado' ? 'Liberado' : 'Encerrado'} ${fmtD(a.fim)}</span>` : d < 0 ? `<span class="badge b-bad">Venceu há ${-d} dia(s)</span>` : d <= 7 ? `<span class="badge b-warn">Faltam ${d} dia(s)</span>` : `<span class="badge b-mut">até ${fmtD(a.fimPrevisto)}</span>`;
      return `<button data-ap="${esc(a.id)}" type="button" style="display:flex;gap:8px;align-items:center;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:9px 0;cursor:pointer"><div style="flex:1"><b>${esc(a.nome)}</b> <span class="cs">${esc(a.funcao || '')}</span><br><span style="font-size:12px;color:var(--muted)">Padrinho: ${esc(a.padrinho)} · ${esc(a.area || '')} · desde ${fmtD(a.inicio)} · ${(a.acomp || []).length} acompanhamento(s)</span></div>${b}</button>`; }).join('') || '<p class="cs">Nada aqui.</p>'}</div>
    <p class="cs">O formulário oficial de apadrinhamento entra aqui assim que o modelo for aprovado.</p>`;
  const bu = $('#busca'); bu.oninput = () => { clearTimeout(bu._t); bu._t = setTimeout(() => { V.busca = bu.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  const nv = $('#novo'); if (nv) nv.onclick = () => form();
  $('#exp').onclick = () => PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Apadrinhamento', cols: [{ t: 'Apadrinhado' }, { t: 'Função' }, { t: 'Área' }, { t: 'Padrinho' }, { t: 'Início', tipo: 'data' }, { t: 'Fim previsto', tipo: 'data' }, { t: 'Situação' }, { t: 'Acompanhamentos', tipo: 'int' }, { t: 'Resultado' }],
    linhas: L.map(a => [a.nome, a.funcao, a.area, a.padrinho, a.inicio, a.fimPrevisto, a.status === 'andamento' ? 'Em andamento' : a.status === 'liberado' ? 'Liberado' : 'Encerrado', (a.acomp || []).length, a.resultado || '']), filtros: V.tab === 'and' ? 'Em andamento' : 'Encerrados', arquivo: 'Apadrinhamento' });
}
function form(fid) {
  const f = D.func.find(x => x.id === fid) || {};
  sheet(`<div class="top"><h2>Novo apadrinhamento</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <datalist id="dl-f">${ativos().map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
    <label>Apadrinhado (novato)</label><input id="a-ap" list="dl-f" value="${esc(f.nome || '')}" style="${inp}">
    <label>Padrinho (funcionário experiente)</label><input id="a-pd" list="dl-f" style="${inp}">
    <label>Área / local de trabalho</label><input id="a-ar" value="${esc([f.area, f.subarea].filter(Boolean).join(' / '))}" style="${inp}">
    <div style="display:flex;gap:10px"><div style="flex:1"><label>Início</label><input type="date" id="a-in" value="${esc(f.admissao && f.admissao > addDias(hoje(), -30) ? f.admissao : hoje())}" style="${inp}"></div><div style="flex:1"><label>Duração (dias)</label><input type="number" id="a-di" value="90" min="1" style="${inp}"></div></div>
    <label><input type="checkbox" id="a-id"> Identificação visual de apadrinhado entregue (adesivo / colete)</label>
    <label style="display:block;margin-top:8px">Observações</label><textarea id="a-ob" rows="2" style="${inp}"></textarea>
    <button class="btn big primary" id="a-ok" type="button">Salvar</button>`);
  $('#m-x').onclick = fechar;
  $('#a-ok').onclick = async () => {
    const ap = fDe($('#a-ap').value), pd = fDe($('#a-pd').value);
    if (!ap) return toast('Escolha o apadrinhado da lista.', 'bad'); if (!pd) return toast('Escolha o padrinho da lista.', 'bad'); if (ap.id === pd.id) return toast('Padrinho e apadrinhado não podem ser a mesma pessoa.', 'bad');
    const ini = $('#a-in').value || hoje(), dias = Math.max(1, +$('#a-di').value || 90);
    try { await db.collection('apadrinhamento').doc().set({ fid: ap.id, nome: str(ap.nome), funcao: str(ap.funcao), area: $('#a-ar').value.trim(), padrinhoId: pd.id, padrinho: str(pd.nome), inicio: ini, dias, fimPrevisto: addDias(ini, dias), ident: $('#a-id').checked, obs: $('#a-ob').value.trim(), acomp: [], status: 'andamento', criadoPor: MEU, criadoEm: new Date().toISOString() });
      toast('Apadrinhamento registrado.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (publique a regra apadrinhamento).', 'bad'); }
  };
}
function ver(id) {
  const a = D.ap.find(x => x.id === id); if (!a) return; const and = a.status === 'andamento';
  sheet(`<div class="top"><h2>${esc(a.nome)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <div class="card"><p style="margin:0">Padrinho: <b>${esc(a.padrinho)}</b><br>${esc(a.funcao || '')} · ${esc(a.area || '')}<br>De ${fmtD(a.inicio)} a ${fmtD(a.fimPrevisto)} (${a.dias} dias)${a.ident ? ' · identificação visual entregue' : ' · <b style="color:var(--bad)">sem identificação visual</b>'}${a.obs ? '<br>' + esc(a.obs) : ''}</p></div>
    <div class="card"><div class="ct">Acompanhamento</div>${(a.acomp || []).map(x => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${fmtD(x.data)}</b> · ${esc(x.por)} · ${x.ok ? '<span class="badge b-ok">Evoluindo bem</span>' : '<span class="badge b-warn">Precisa de atenção</span>'}<br>${esc(x.texto)}</div>`).join('') || '<p class="cs">Nenhum acompanhamento registrado.</p>'}
      ${and && PODE ? `<label style="display:block;margin-top:8px">Novo acompanhamento (conversa com o padrinho)</label><textarea id="c-tx" rows="2" style="${inp}"></textarea><label><input type="checkbox" id="c-ok" checked> Evoluindo bem</label><div class="actions"><button class="btn sm primary" id="c-add" type="button">Registrar</button></div>` : ''}</div>
    ${and && PODE ? `<div class="card"><div class="ct">Encerrar</div><select id="e-res" style="${inp}"><option value="liberado">Liberado para trabalhar sem padrinho</option><option value="encerrado">Encerrado sem liberação (desligado / transferido)</option></select><textarea id="e-ob" rows="2" placeholder="Observação" style="${inp}"></textarea><div class="actions"><button class="btn sm ghost" id="e-pro" type="button">Prorrogar 30 dias</button><button class="btn sm primary" id="e-ok" type="button">Encerrar</button></div></div>`
      : !and ? `<div class="card"><b>${a.status === 'liberado' ? 'Liberado' : 'Encerrado'} em ${fmtD(a.fim)}</b> por ${esc(a.encerradoPor || '')}${a.obsFim ? '<br>' + esc(a.obsFim) : ''}</div>` : ''}
    ${PODE ? '<div class="actions"><button class="btn danger sm" id="a-del" type="button">Excluir registro</button></div>' : ''}`);
  $('#m-x').onclick = fechar; const ref = db.doc('apadrinhamento/' + id);
  const add = $('#c-add'); if (add) add.onclick = async () => { const t = $('#c-tx').value.trim(); if (!t) return toast('Escreva o acompanhamento.', 'bad');
    const acomp = (a.acomp || []).concat([{ data: hoje(), por: MEU, texto: t, ok: $('#c-ok').checked }]); try { await ref.update({ acomp }); a.acomp = acomp; toast('Registrado.', 'ok'); ver(id); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  const pro = $('#e-pro'); if (pro) pro.onclick = async () => { const fim = addDias(a.fimPrevisto, 30); try { await ref.update({ fimPrevisto: fim, dias: (+a.dias || 0) + 30 }); a.fimPrevisto = fim; a.dias = (+a.dias || 0) + 30; toast('Prorrogado até ' + fmtD(fim) + '.', 'ok'); ver(id); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  const ok = $('#e-ok'); if (ok) ok.onclick = async () => { const st = $('#e-res').value; try { await ref.update({ status: st, fim: hoje(), resultado: st === 'liberado' ? 'Liberado' : 'Encerrado sem liberação', obsFim: $('#e-ob').value.trim(), encerradoPor: MEU }); toast('Encerrado.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar.', 'bad'); } };
  const del = $('#a-del'); if (del) del.onclick = async () => { if (!confirm('Excluir o apadrinhamento de ' + a.nome + '?')) return; try { await ref.delete(); fechar(); } catch (e) { toast('Não foi possível excluir.', 'bad'); } };
}
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const n = e.target.closest('[data-novo]'); if (n) { form(n.dataset.novo); return; }
  const a = e.target.closest('[data-ap]'); if (a) { ver(a.dataset.ap); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || ''; PODE = ['admin', 'gerente', 'gestao', 'tst', 'rh'].includes(F.papelGeral);
  db.collection('apadrinhamento').onSnapshot(s => { D.ap = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => toast('Sem permissão (publique a regra apadrinhamento no Firestore).', 'bad'));
  db.collection('funcionarios').onSnapshot(s => { D.func = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
