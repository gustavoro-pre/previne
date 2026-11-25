// Envia notificações de "de acordo" pendente para o celular de quem precisa aprovar.
// Roda no GitHub Actions; a chave da conta de serviço fica no segredo FIREBASE_SA (nunca no código).
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.log('Segredo FIREBASE_SA não configurado.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const chave = n => norm(n).replace(/[^a-z0-9]+/g, '_');

// certificados recentes (últimos 180 dias) para ler pouco do Firestore
const desde = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
const snap = await db.collection('treinamentos').where('termino', '>=', desde).get();
const pend = {}; // chave do aprovador -> { nome, ids: [] }
snap.forEach(d => {
  const r = d.data(); const vistos = new Set();
  [r.instrutor, r.rt, r.tst].forEach(n => {
    const k = chave(n); if (!k || vistos.has(k)) return; vistos.add(k);
    if ((r.aprov || {})[k]) return;
    (pend[k] = pend[k] || { nome: n, ids: [] }).ids.push(d.id);
  });
});

const estRef = db.doc('push_estado/aprov'); const est = (await estRef.get()).data() || {};
const toks = (await db.collection('push_tokens').get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
const novoEst = {};
for (const [k, p] of Object.entries(pend)) {
  novoEst[k] = p.ids;
  const ja = new Set(est[k] || []); const novos = p.ids.filter(id => !ja.has(id));
  if (!novos.length) continue;
  const alvo = toks.filter(t => chave(t.nome) === k);
  console.log(`${p.nome}: ${novos.length} novo(s), ${p.ids.length} no total, ${alvo.length} aparelho(s)`);
  for (const t of alvo) {
    try {
      await admin.messaging().send({ token: t.token, webpush: { headers: { Urgency: 'high', TTL: '86400' }, data: {
        title: 'De acordo pendente',
        body: `${novos.length === 1 ? '1 novo certificado aguarda' : novos.length + ' novos certificados aguardam'} o seu de acordo (${p.ids.length} no total).`,
        url: '/treinamentos/#aprov', tag: 'aprov' } } });
    } catch (e) {
      const c = e.errorInfo && e.errorInfo.code || e.code || '';
      console.log('falha no envio:', c);
      if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(c)) await db.doc('push_tokens/' + t.id).delete();
    }
  }
}
await estRef.set(novoEst);

// pedidos de EPI ou ferramenta fora do previsto (sem decisão): vão para Administrador e Gerente
const desdeIso = new Date(Date.now() - 60 * 864e5).toISOString();
const sols = (await db.collection('autorizacoes').where('em', '>=', desdeIso).get()).docs;
const decs = sols.length ? await db.getAll(...sols.map(d => db.doc('decisoes/' + d.id))) : [];
const decididas = new Set(decs.filter(d => d.exists).map(d => d.id));
const pendAut = sols.filter(d => !decididas.has(d.id));
const estAutRef = db.doc('push_estado/aut'); const estAut = new Set(((await estAutRef.get()).data() || {}).ids || []);
const novosAut = pendAut.filter(d => !estAut.has(d.id));
if (novosAut.length) {
  const usr = (await db.collection('usuarios').get()).docs.filter(d => ['admin', 'gerente'].includes(d.data().papel) && d.data().ativo !== false).map(d => d.id);
  const alvo = toks.filter(t => usr.includes(t.uid));
  const um = novosAut[0].data(); const item = um.kind === 'ferramenta' ? 'ferramenta ' + (um.tipoFerr || '') : 'EPI ' + (um.epiNome || '');
  const body = novosAut.length === 1 ? `${um.funcionarioNome || 'Funcionário'} (${um.funcao || 'sem função'}) precisa de ${item.trim()}${um.excecao ? ', fora da lista da função' : ''}.` : `${novosAut.length} novos pedidos de EPI ou ferramenta aguardam a sua autorização.`;
  console.log(`autorizações: ${novosAut.length} nova(s), ${alvo.length} aparelho(s)`);
  for (const t of alvo) {
    try { await admin.messaging().send({ token: t.token, webpush: { headers: { Urgency: 'high', TTL: '86400' }, data: { title: 'Autorização pendente', body, url: '/ferramentas/#painel', tag: 'aut' } } }); }
    catch (e) { const c = e.errorInfo && e.errorInfo.code || e.code || ''; console.log('falha no envio:', c); if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(c)) await db.doc('push_tokens/' + t.id).delete().catch(() => {}); }
  }
}
await estAutRef.set({ ids: pendAut.map(d => d.id) });
// documentos (novos ou novas revisões) aguardando aprovação: vai para o aprovador indicado
const docsP = (await db.collection('docs').get()).docs.filter(d => { const p = d.data().pend; return p && !p.recusa && p.aprovador; });
const estDocRef = db.doc('push_estado/docs'); const estDoc = new Set(((await estDocRef.get()).data() || {}).ids || []);
for (const d of docsP) {
  const p = d.data().pend, kid = d.id + ':' + p.rev + ':' + p.em; if (estDoc.has(kid)) continue;
  const alvo = toks.filter(t => chave(t.nome) === chave(p.aprovador));
  for (const t of alvo) { try { await admin.messaging().send({ token: t.token, webpush: { headers: { Urgency: 'high', TTL: '86400' }, data: { title: 'Documento para aprovar', body: `${d.data().codigo} ${d.data().titulo || ''} (Rev. ${String(+p.rev || 0).padStart(2, '0')}) enviado por ${p.por}.`, url: '/documentos/#aprov', tag: 'doc' } } }); } catch (e) { console.log('falha no envio:', e.code || ''); } }
}
await estDocRef.set({ ids: docsP.map(d => d.id + ':' + d.data().pend.rev + ':' + d.data().pend.em) });
console.log('ok');
