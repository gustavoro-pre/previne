/* Registro de acessos a dados sensíveis (LGPD). Só o Administrador vê. Gravado pelo fb.js (window.__FB.logAcesso). */
"use strict";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmtDT = s => { const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const V = { dias: 30, busca: '' }; let L = [], db = null;
function render() {
  const lim = new Date(Date.now() - V.dias * 864e5).toISOString(); let X = L.filter(a => a.em >= lim);
  if (V.busca) { const q = norm(V.busca); X = X.filter(a => norm([a.nome, a.email, a.oque, a.ref].join(' ')).includes(q)); }
  const pess = new Set(X.map(a => a.uid)).size;
  $('#body').innerHTML = `<div class="card"><div class="ct">Acessos a dados com salário</div><p class="cs">Cada vez que alguém abre o painel de salários, a folha, um contracheque, a carta-convite ou o salário de uma admissão, fica registrado aqui (no máximo 1 registro por item a cada 10 minutos). Ninguém consegue alterar ou apagar o registro.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><select id="dias" style="padding:8px;border:1px solid #cfd4dc;border-radius:8px">${[7, 30, 90, 365].map(d => `<option value="${d}" ${V.dias === d ? 'selected' : ''}>Últimos ${d} dias</option>`).join('')}</select>
    <input id="busca" placeholder="Buscar pessoa ou item" value="${esc(V.busca)}" style="flex:1;min-width:160px;padding:8px;border:1px solid #cfd4dc;border-radius:8px"><button class="btn sm ghost" id="exp" type="button">Exportar</button></div>
    <p class="cs" style="margin-top:8px">${X.length} acesso(s) de ${pess} pessoa(s).</p></div>
    <div class="card" style="overflow:auto"><table class="tb" style="font-size:13px"><thead><tr><th style="text-align:left">Quando</th><th style="text-align:left">Quem</th><th style="text-align:left">O quê</th><th style="text-align:left">De quem / qual</th><th style="text-align:left">Módulo</th></tr></thead>
    <tbody>${X.map(a => `<tr><td style="white-space:nowrap">${fmtDT(a.em)}</td><td>${esc(a.nome)}<br><span style="font-size:11px;color:var(--muted)">${esc(a.email)}</span></td><td>${esc(a.oque)}</td><td>${esc(a.ref || '—')}</td><td>${esc(a.modulo)}</td></tr>`).join('') || '<tr><td colspan="5" style="color:var(--muted)">Nenhum acesso no período.</td></tr>'}</tbody></table></div>`;
  $('#dias').onchange = e => { V.dias = +e.target.value; render(); };
  const b = $('#busca'); b.oninput = () => { clearTimeout(b._t); b._t = setTimeout(() => { V.busca = b.value; render(); const n = $('#busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $('#exp').onclick = () => window.PrevRel && PrevRel.escolher({ modelo: 'rel_painel', titulo: 'Registro de acessos a dados com salário', cols: [{ t: 'Quando' }, { t: 'Quem' }, { t: 'E-mail' }, { t: 'O quê' }, { t: 'De quem / qual' }, { t: 'Módulo' }], linhas: X.map(a => [fmtDT(a.em), a.nome, a.email, a.oque, a.ref, a.modulo]), filtros: 'Últimos ' + V.dias + ' dias' + (V.busca ? ' · ' + V.busca : ''), arquivo: 'Registro de acessos' });
}
(async () => {
  db = await claude.use('db'); const F = window.__FB || {};
  if (F.papelGeral !== 'admin') { $('#body').innerHTML = '<div class="card">Só o Administrador vê o registro de acessos.</div>'; return; }
  db.collection('acessos').onSnapshot(s => { L = s.docs.map(d => d.data()).sort((a, b) => String(b.em).localeCompare(String(a.em))); render(); }, () => { $('#body').innerHTML = '<div class="card">Sem permissão (publique as regras do Firestore).</div>'; });
  const c = $('#conn'); c.textContent = 'Online'; c.className = 'conn ok';
})();
