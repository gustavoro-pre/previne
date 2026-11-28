/* Pedidos e medições: pedido/contrato do cliente (valor), boletins de medição (BM) enviados com % ou valor,
   de acordo do cliente, BRO, NF emitida e recebimento. Mostra o saldo a medir de cada pedido.
   pedidos/{id} = { numero, cliente, descricao, valor, inicio, fim, status, obs, bms: [{ id, numero, comp, pct, valor, enviadoEm, deAcordoEm, bro, nf, nfData, recebidoEm, obs }] }
   Só Administrador, Gestão e Gerente. */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v == null ? '' : String(v);
const num = v => { if (typeof v === 'number') return v; const t = str(v).replace(/[R$\s]/g, ''); const n = parseFloat(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')); return isFinite(n) ? n : 0; };
const norm = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const fmtD = s => { const p = str(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let tt; const toast = (t, k) => { const e = $('#toast'); e.textContent = t; e.className = 'show ' + (k || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3200); };
const sheet = h => { $('#sheet').innerHTML = h; $('#modal').hidden = false; $('#sheet').scrollTop = 0; };
const fechar = () => { V.ver = ''; $('#modal').hidden = true; $('#sheet').innerHTML = ''; render(); };
const kpi = (t, n, k) => `<div class="kpi ${k || ''}"><div class="n">${n}</div><div class="t">${t}</div></div>`;
const D = { ped: [] }; const V = { tab: 'ped', busca: '', st: 'aberto', ver: '' }; let db = null, MEU = '';
const stBm = b => b.recebidoEm ? ['Recebido', 'b-ok'] : b.nf ? ['Faturado (NF ' + b.nf + ')', 'b-info'] : b.deAcordoEm ? ['De acordo · falta NF', 'b-warn'] : ['Aguardando de acordo', 'b-bad'];
const vBm = (p, b) => num(b.valor) || (num(b.pct) && num(p.valor) ? num(p.valor) * num(b.pct) / 100 : 0);
function tot(p) { const B = p.bms || []; const med = B.reduce((a, b) => a + vBm(p, b), 0), fat = B.filter(b => b.nf).reduce((a, b) => a + vBm(p, b), 0), rec = B.filter(b => b.recebidoEm).reduce((a, b) => a + vBm(p, b), 0), ac = B.filter(b => b.deAcordoEm).reduce((a, b) => a + vBm(p, b), 0);
  return { med, fat, rec, ac, saldo: Math.max(0, num(p.valor) - med), pct: num(p.valor) ? med / num(p.valor) * 100 : 0 }; }

function render() {
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === V.tab));
  let P = D.ped.slice().sort((a, b) => str(b.inicio).localeCompare(str(a.inicio)));
  if (V.st) P = P.filter(p => (p.status || 'aberto') === V.st); if (V.busca) { const q = norm(V.busca); P = P.filter(p => norm([p.numero, p.cliente, p.descricao].join(' ')).includes(q) || (p.bms || []).some(b => norm([b.numero, b.bro, b.nf].join(' ')).includes(q))); }
  const T = P.map(tot); const S = k => T.reduce((a, t) => a + t[k], 0); const contr = P.reduce((a, p) => a + num(p.valor), 0);
  const B = P.flatMap(p => (p.bms || []).map(b => ({ p, b })));
  const filtros = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><select id="st" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px"><option value="aberto" ${V.st === 'aberto' ? 'selected' : ''}>Pedidos abertos</option><option value="encerrado" ${V.st === 'encerrado' ? 'selected' : ''}>Encerrados</option><option value="" ${V.st === '' ? 'selected' : ''}>Todos</option></select>
    <input id="busca" placeholder="Buscar pedido, cliente, BM, BRO ou NF" value="${esc(V.busca)}" style="flex:1;min-width:180px;padding:8px;border:1px solid #cfd4dc;border-radius:8px">${V.tab === 'ped' ? '<button class="btn sm primary" id="np" type="button">+ Pedido</button>' : ''}<button class="btn sm ghost" id="exp" type="button">Exportar</button></div>`;
  const head = `<div class="kpis">${kpi('Contratado', brl(contr))}${kpi('Medido', brl(S('med')))}${kpi('Saldo a medir', brl(S('saldo')))}${kpi('Faturado', brl(S('fat')))}${kpi('A faturar (com de acordo)', brl(S('ac') - S('fat')), S('ac') - S('fat') > 0 ? 'warn' : '')}${kpi('Aguardando de acordo', B.filter(x => !x.b.deAcordoEm).length, B.some(x => !x.b.deAcordoEm) ? 'warn' : '')}</div>`;
  if (V.tab === 'ped') {
    $('#body').innerHTML = head + `<div class="card"><div class="ct">Pedidos</div>${filtros}</div><div class="card">${P.map((p, i) => { const t = T[i];
      return `<button data-ped="${esc(p.id)}" type="button" style="display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:10px 0;cursor:pointer">
        <b>${esc(p.numero)}</b> · ${esc(p.cliente || '')} <span style="float:right"><b>${brl(t.saldo)}</b> <span style="font-size:12px;color:var(--muted)">a medir</span></span><br>
        <span style="font-size:13px">${esc(p.descricao || '')}</span><br>
        <span style="font-size:12px;color:var(--muted)">Valor ${brl(p.valor)} · medido ${brl(t.med)} (${t.pct.toFixed(0)}%) · faturado ${brl(t.fat)} · ${(p.bms || []).length} BM(s)${p.fim ? ' · até ' + fmtD(p.fim) : ''}</span>
        <div style="height:6px;background:var(--mut-bg,#eef1f5);border-radius:4px;margin-top:6px"><div style="height:6px;border-radius:4px;background:${t.pct > 100 ? 'var(--bad)' : 'var(--s1,#1f4e9c)'};width:${Math.min(100, t.pct)}%"></div></div></button>`; }).join('') || '<p class="cs">Nenhum pedido.</p>'}</div>`;
    $('#np').onclick = () => edPed(null);
  } else {
    const L = B.sort((x, y) => str(y.b.enviadoEm || y.b.comp).localeCompare(str(x.b.enviadoEm || x.b.comp)));
    $('#body').innerHTML = head + `<div class="card"><div class="ct">Boletins de medição e NFs</div>${filtros}</div><div class="card" style="overflow:auto"><table class="tb" style="font-size:13px"><thead><tr><th style="text-align:left">Pedido</th><th style="text-align:left">BM</th><th style="text-align:left">Competência</th><th>%</th><th>Valor</th><th style="text-align:left">BRO</th><th style="text-align:left">NF</th><th style="text-align:left">Situação</th></tr></thead><tbody>
      ${L.map(({ p, b }) => `<tr data-ped="${esc(p.id)}" style="cursor:pointer"><td>${esc(p.numero)}</td><td>${esc(b.numero || '—')}</td><td>${esc(b.comp || '')}</td><td style="text-align:right">${num(b.pct) ? num(b.pct) + '%' : '—'}</td><td style="text-align:right">${brl(vBm(p, b))}</td><td>${esc(b.bro || '—')}</td><td>${esc(b.nf || '—')}${b.nfData ? ' · ' + fmtD(b.nfData) : ''}</td><td><span class="badge ${stBm(b)[1]}">${esc(stBm(b)[0])}</span></td></tr>`).join('') || '<tr><td colspan="8" style="color:var(--muted)">Nenhum boletim.</td></tr>'}</tbody></table></div>`;
  }
  $('#st').onchange = e => { V.st = e.target.value; render(); };
  const bu = $('#busca'); bu.oninput = () => { clearTimeout(bu._t); bu._t = setTimeout(() => { V.busca = bu.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $('#exp').onclick = () => V.tab === 'ped'
    ? PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Pedidos e saldo a medir', cols: [{ t: 'Pedido' }, { t: 'Cliente' }, { t: 'Descrição' }, { t: 'Valor', tipo: 'brl' }, { t: 'Medido', tipo: 'brl' }, { t: '% medido', tipo: 'num' }, { t: 'Saldo a medir', tipo: 'brl' }, { t: 'Faturado', tipo: 'brl' }, { t: 'Recebido', tipo: 'brl' }], linhas: P.map((p, i) => [p.numero, p.cliente, p.descricao, num(p.valor), T[i].med, +T[i].pct.toFixed(1), T[i].saldo, T[i].fat, T[i].rec]), filtros: V.st || 'Todos', arquivo: 'Pedidos e saldo' })
    : PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Boletins de medição e NFs', cols: [{ t: 'Pedido' }, { t: 'BM' }, { t: 'Competência' }, { t: '%', tipo: 'num' }, { t: 'Valor', tipo: 'brl' }, { t: 'Enviado', tipo: 'data' }, { t: 'De acordo', tipo: 'data' }, { t: 'BRO' }, { t: 'NF' }, { t: 'Data NF', tipo: 'data' }, { t: 'Recebido', tipo: 'data' }, { t: 'Situação' }], linhas: B.map(({ p, b }) => [p.numero, b.numero, b.comp, num(b.pct), vBm(p, b), b.enviadoEm, b.deAcordoEm, b.bro, b.nf, b.nfData, b.recebidoEm, stBm(b)[0]]), filtros: V.st || 'Todos', arquivo: 'Boletins e NFs' });
}
const inp = 'width:100%;padding:9px;border:1px solid #cfd4dc;border-radius:8px;margin:2px 0 10px';
function edPed(id) {
  const p = D.ped.find(x => x.id === id) || { status: 'aberto' };
  sheet(`<div class="top"><h2>${id ? 'Pedido ' + esc(p.numero) : 'Novo pedido'}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    ${[['numero', 'Número do pedido / contrato'], ['cliente', 'Cliente'], ['descricao', 'Descrição do serviço'], ['obs', 'Observação']].map(([k, t]) => `<label>${t}</label><input id="p-${k}" value="${esc(p[k] || '')}" style="${inp}">`).join('')}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:130px"><label>Valor (R$)</label><input id="p-valor" inputmode="decimal" value="${p.valor ? num(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>Início</label><input type="date" id="p-inicio" value="${esc(p.inicio || '')}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>Fim</label><input type="date" id="p-fim" value="${esc(p.fim || '')}" style="${inp}"></div></div>
    <label>Situação</label><select id="p-status" style="${inp}"><option value="aberto" ${p.status !== 'encerrado' ? 'selected' : ''}>Aberto</option><option value="encerrado" ${p.status === 'encerrado' ? 'selected' : ''}>Encerrado</option></select>
    <div class="actions">${id ? '<button class="btn ghost" id="p-bm" type="button">Boletins de medição</button>' : ''}<button class="btn primary" id="p-ok" type="button">Salvar</button></div>`);
  $('#m-x').onclick = fechar;
  const bm = $('#p-bm'); if (bm) bm.onclick = () => verPed(id);
  $('#p-ok').onclick = async () => { const d = {}; ['numero', 'cliente', 'descricao', 'obs', 'inicio', 'fim', 'status'].forEach(k => d[k] = $('#p-' + k).value.trim()); d.valor = num($('#p-valor').value);
    if (!d.numero) return toast('Informe o número do pedido.', 'bad'); d.atualizadoPor = MEU; d.atualizadoEm = new Date().toISOString();
    try { if (id) await db.doc('pedidos/' + id).set(d, { merge: true }); else { d.bms = []; await db.collection('pedidos').doc().set(d); } toast('Pedido salvo.', 'ok'); fechar(); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
}
function verPed(id) {
  V.ver = id; const p = D.ped.find(x => x.id === id); if (!p) return; const t = tot(p); const B = p.bms || [];
  sheet(`<div class="top"><h2>Pedido ${esc(p.numero)}</h2><button class="btn sm ghost" id="m-x" type="button">Fechar</button></div>
    <p class="cs" style="margin:0 0 8px">${esc(p.cliente || '')} · ${esc(p.descricao || '')}<br>Valor ${brl(p.valor)} · medido ${brl(t.med)} (${t.pct.toFixed(1)}%) · <b>saldo a medir ${brl(t.saldo)}</b> · faturado ${brl(t.fat)} · recebido ${brl(t.rec)}</p>
    <div class="card">${B.map((b, i) => `<div style="border-bottom:1px solid var(--line);padding:8px 0"><b>BM ${esc(b.numero || i + 1)}</b> · ${esc(b.comp || '')} · ${num(b.pct) ? num(b.pct) + '% · ' : ''}${brl(vBm(p, b))} <span class="badge ${stBm(b)[1]}">${esc(stBm(b)[0])}</span><br>
      <span style="font-size:12px;color:var(--muted)">Enviado ${fmtD(b.enviadoEm)} · de acordo ${fmtD(b.deAcordoEm)} · BRO ${esc(b.bro || '—')} · NF ${esc(b.nf || '—')} ${b.nfData ? fmtD(b.nfData) : ''} · recebido ${fmtD(b.recebidoEm)}</span> <button class="btn sm ghost" data-bm="${i}" type="button">Editar</button></div>`).join('') || '<p class="cs">Nenhum boletim ainda.</p>'}
      <button class="btn sm primary" data-bm="-1" type="button" style="margin-top:8px">+ Boletim de medição</button></div>
    <div class="actions"><button class="btn ghost" id="p-ed" type="button">Editar pedido</button></div>`);
  $('#m-x').onclick = fechar; $('#p-ed').onclick = () => edPed(id);
  $$('[data-bm]').forEach(x => x.onclick = () => edBm(p, +x.dataset.bm));
}
function edBm(p, i) {
  const B = (p.bms || []).slice(); const b = i >= 0 ? B[i] : { id: Math.random().toString(36).slice(2, 9), numero: String(B.length + 1), comp: new Date().toISOString().slice(0, 7), enviadoEm: new Date().toISOString().slice(0, 10) };
  sheet(`<div class="top"><h2>Pedido ${esc(p.numero)} · BM</h2><button class="btn sm ghost" id="m-x" type="button">Voltar</button></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:110px"><label>Nº do BM</label><input id="b-numero" value="${esc(b.numero || '')}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>Competência</label><input type="month" id="b-comp" value="${esc(b.comp || '')}" style="${inp}"></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:110px"><label>% medido</label><input id="b-pct" inputmode="decimal" value="${esc(b.pct || '')}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>Valor (R$, se não for por %)</label><input id="b-valor" inputmode="decimal" value="${b.valor ? num(b.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}" style="${inp}"></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:130px"><label>Enviado em</label><input type="date" id="b-enviadoEm" value="${esc(b.enviadoEm || '')}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>De acordo do cliente em</label><input type="date" id="b-deAcordoEm" value="${esc(b.deAcordoEm || '')}" style="${inp}"></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:110px"><label>Nº do BRO</label><input id="b-bro" value="${esc(b.bro || '')}" style="${inp}"></div><div style="flex:1;min-width:110px"><label>NF</label><input id="b-nf" value="${esc(b.nf || '')}" style="${inp}"></div><div style="flex:1;min-width:130px"><label>Data da NF</label><input type="date" id="b-nfData" value="${esc(b.nfData || '')}" style="${inp}"></div></div>
    <label>Recebido em</label><input type="date" id="b-recebidoEm" value="${esc(b.recebidoEm || '')}" style="${inp}"><label>Observação</label><input id="b-obs" value="${esc(b.obs || '')}" style="${inp}">
    <div class="actions">${i >= 0 ? '<button class="btn danger" id="b-del" type="button">Excluir BM</button>' : ''}<button class="btn primary" id="b-ok" type="button">Salvar</button></div>`);
  $('#m-x').onclick = () => verPed(p.id);
  const salva = async L => { try { await db.doc('pedidos/' + p.id).update({ bms: L, atualizadoPor: MEU, atualizadoEm: new Date().toISOString() }); p.bms = L; toast('Salvo.', 'ok'); verPed(p.id); } catch (e) { toast('Não foi possível salvar (permissão?).', 'bad'); } };
  $('#b-ok').onclick = () => { const d = Object.assign({}, b); ['numero', 'comp', 'enviadoEm', 'deAcordoEm', 'bro', 'nf', 'nfData', 'recebidoEm', 'obs'].forEach(k => d[k] = $('#b-' + k).value.trim()); d.pct = num($('#b-pct').value); d.valor = num($('#b-valor').value);
    if (!d.pct && !d.valor) return toast('Informe o % ou o valor do BM.', 'bad'); const t = tot(p); const novo = vBm(p, d) - (i >= 0 ? vBm(p, b) : 0); if (num(p.valor) && t.med + novo > num(p.valor) * 1.0001 && !confirm('Com este BM o medido passa do valor do pedido. Salvar mesmo assim?')) return;
    if (i >= 0) B[i] = d; else B.push(d); salva(B); };
  const del = $('#b-del'); if (del) del.onclick = () => { if (confirm('Excluir o BM ' + (b.numero || '') + '?')) { B.splice(i, 1); salva(B); } };
}
document.addEventListener('click', e => {
  const t = e.target.closest('#seg [data-tab]'); if (t) { V.tab = t.dataset.tab; render(); return; }
  const p = e.target.closest('[data-ped]'); if (p && $('#modal').hidden) { verPed(p.dataset.ped); return; }
  if (e.target.id === 'modal') fechar();
});
(async () => {
  db = await claude.use('db'); const F = window.__FB || {}; MEU = F.nome || '';
  if (!['admin', 'gestao', 'gerente'].includes(F.papelGeral)) { $('#body').innerHTML = '<div class="card">Só Administrador, Gestão e Gerente.</div>'; return; }
  db.collection('pedidos').onSnapshot(s => { D.ped = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => { $('#body').innerHTML = '<div class="card">Sem permissão (publique as regras do Firestore).</div>'; });
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok'; render();
})();
