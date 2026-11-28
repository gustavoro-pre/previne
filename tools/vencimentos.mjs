// Resumo semanal de vencimentos (segunda-feira, 7h): NRs e treinamentos externos vencidos ou vencendo em 30 dias
// (só a última de cada pessoa × tipo, só funcionários ativos) e CA de EPI vencido ou vencendo em 60 dias.
// Também: funcionários que completam 45 ou 90 dias de experiência nas próximas 2 semanas.
// Manda notificação no celular para Administrador, Gestão, Gerente e TST e grava o resumo em push_estado/venc.
// O log só mostra contagens (repositório público).
import admin from 'firebase-admin';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.log('Segredo FIREBASE_SA não configurado.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const hoje = new Date().toISOString().slice(0, 10);
const mais = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const lim30 = mais(30), lim60 = mais(60);

const func = (await db.collection('funcionarios').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.ativo !== false);
const ativos = new Set(func.map(f => f.id));
function ultimos(regs, chaveTipo) {
  const m = new Map();
  for (const r of regs) { if (!ativos.has(r.funcionarioId) || !r.validade) continue; const k = r.funcionarioId + '|' + chaveTipo(r); const a = m.get(k); if (!a || String(r.termino || r.validade) > String(a.termino || a.validade)) m.set(k, r); }
  return [...m.values()];
}
const tr = ultimos((await db.collection('treinamentos').get()).docs.map(d => d.data()), r => r.tipoId || r.tipoNome);
const ex = ultimos((await db.collection('trein_ext').get()).docs.map(d => d.data()), r => r.tipoId || r.nomeTreinamento || r.tipoNome || r.titulo || '');
const todos = tr.concat(ex);
const venc = todos.filter(r => r.validade < hoje).length, vence = todos.filter(r => r.validade >= hoje && r.validade <= lim30).length;
const pessoas = new Set(todos.filter(r => r.validade <= lim30).map(r => r.funcionarioId)).size;
const epis = (await db.collection('epis').get()).docs.map(d => d.data()).filter(p => p.ativo !== false && !p.semCA);
const ca = epis.filter(p => (p.caSituacao && !/^V[ÁA]LIDO/i.test(String(p.caSituacao))) || (p.validadeCA && p.validadeCA <= lim60)).length;
// fim do período de experiência (45 + 45 dias): quem completa 45 ou 90 dias nos próximos 14 dias
const somaDias = (d, n) => { const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const lim14 = mais(14); let exp45 = 0, exp90 = 0;
for (const f of func) { if (!/^\d{4}-\d{2}-\d{2}/.test(String(f.admissao || ''))) continue; const a = somaDias(f.admissao, 44), b = somaDias(f.admissao, 89); if (a >= hoje && a <= lim14) exp45++; if (b >= hoje && b <= lim14) exp90++; }
// licenças e documentos da empresa (Requisitos legais e licenças)
const lic = (await db.collection('licencas').get()).docs.map(d => d.data()).filter(l => l.validade && l.validade <= lim60).length;
const cont = { lic, em: new Date().toISOString(), trVencidos: venc, trVencendo30: vence, pessoas, caVencendo60: ca, exp45, exp90, funcionariosAtivos: func.length };
await db.doc('push_estado/venc').set(cont);
console.log('Resumo:', JSON.stringify(cont));
if (!venc && !vence && !ca && !exp45 && !exp90 && !lic) process.exit(0);
const usr = (await db.collection('usuarios').get()).docs.filter(d => ['admin', 'gestao', 'gerente', 'tst', 'rh'].includes(d.data().papel) && d.data().ativo !== false).map(d => d.id);
const toks = (await db.collection('push_tokens').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(t => usr.includes(t.uid));
const partes = [];
if (venc || vence) partes.push(`${venc} treinamento(s) vencido(s) e ${vence} vencendo em 30 dias (${pessoas} pessoa(s))`);
if (ca) partes.push(`${ca} CA de EPI vencido ou vencendo em 60 dias`);
if (lic) partes.push(`${lic} licença(s)/documento(s) da empresa vencido(s) ou vencendo em 60 dias`);
if (exp45 || exp90) partes.push(`experiência: ${exp45} completa(m) 45 dias e ${exp90} completa(m) 90 dias nas próximas 2 semanas`);
for (const t of toks) {
  try { await admin.messaging().send({ token: t.token, webpush: { headers: { Urgency: 'normal', TTL: '172800' }, data: { title: 'Vencimentos da semana', body: partes.join(' · ') + '.', url: '/treinamentos/#painel', tag: 'venc' } } }); }
  catch (e) { const c = e.errorInfo && e.errorInfo.code || e.code || ''; console.log('falha no envio:', c); if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(c)) await db.doc('push_tokens/' + t.id).delete().catch(() => {}); }
}
console.log('Notificações enviadas:', toks.length);
