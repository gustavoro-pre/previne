/* Camada Firebase: login, perfis, banco (Firestore offline) e downloads.
   Expõe para o app a mesma interface que ele já usava: claude.use('db' | 'user' | 'downloads'). */
import { FIREBASE_CONFIG } from './firebase-config.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, collection, doc, getDoc, getDocs, getDocFromServer, getDocFromCache, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const MOD = window.__MODULO || 'portal'; /* qual módulo carregou este arquivo */
const MOD_NOME = { portal: 'PREVINE Engenharia', ferramentas: 'Ferramentas & EPI', treinamentos: 'Treinamentos', indicadores: 'Indicadores' };
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: true }) }) });
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* ---------- tela de login / configuração inicial ---------- */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gate = document.getElementById('gate');
function showGate(html) { gate.innerHTML = `<div class="gbox"><div class="glogo">${document.querySelector('.logo').innerHTML}</div>${html}</div>`; gate.hidden = false; }
function hideGate() { gate.hidden = true; gate.innerHTML = ''; }
const msg = (t, bad) => { const m = gate.querySelector('.gmsg'); if (m) { m.textContent = t; m.className = 'gmsg' + (bad ? ' bad' : ''); } };
const errPt = e => ({
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.', 'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/network-request-failed': 'Sem internet. O primeiro login precisa de conexão.',
  'auth/email-already-in-use': 'Este e-mail já tem conta.', 'auth/weak-password': 'Senha fraca: use pelo menos 8 caracteres.', 'auth/user-disabled': 'Usuário desativado.'
}[e && e.code] || ('Erro: ' + ((e && e.message) || e)));

function telaLogin() {
  showGate(`<h1>${esc(MOD_NOME[MOD] || 'PREVINE')}</h1><p class="gsub">Entre com seu e-mail e senha</p>
    <form id="g-form"><label>E-mail</label><input id="g-email" type="email" autocomplete="username" required>
    <label>Senha</label><input id="g-pass" type="password" autocomplete="current-password" required>
    <button class="btn primary big" type="submit" style="margin-top:14px">Entrar</button></form>
    <button class="link" id="g-forgot" type="button" style="margin-top:10px">Esqueci minha senha / primeiro acesso</button>
    <p class="gmsg"></p>`);
  gate.querySelector('#g-form').onsubmit = async e => { e.preventDefault(); msg('Entrando…'); try { await signInWithEmailAndPassword(auth, gate.querySelector('#g-email').value.trim(), gate.querySelector('#g-pass').value); } catch (er) { msg(errPt(er), true); } };
  gate.querySelector('#g-forgot').onclick = async () => { const em = gate.querySelector('#g-email').value.trim(); if (!em) return msg('Digite seu e-mail acima e toque de novo.', true); try { await sendPasswordResetEmail(auth, em); msg('Se o e-mail estiver cadastrado, você vai receber um link para criar ou trocar a senha. Confira também o spam.'); } catch (er) { msg(errPt(er), true); } };
}
function telaSetup() {
  showGate(`<h1>Configuração inicial</h1><p class="gsub">Crie a conta do primeiro administrador. Isso só aparece uma vez.</p>
    <form id="g-form"><label>Nome completo</label><input id="g-nome" required>
    <label>E-mail</label><input id="g-email" type="email" autocomplete="username" required>
    <label>Senha (mínimo 8 caracteres)</label><input id="g-pass" type="password" autocomplete="new-password" minlength="8" required>
    <button class="btn primary big" type="submit" style="margin-top:14px">Criar administrador</button></form><p class="gmsg"></p>`);
  gate.querySelector('#g-form').onsubmit = async e => {
    e.preventDefault(); msg('Criando…');
    const nome = gate.querySelector('#g-nome').value.trim(), email = gate.querySelector('#g-email').value.trim(), pass = gate.querySelector('#g-pass').value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const b = writeBatch(fs);
      b.set(doc(fs, 'config/setup'), { adminUid: cred.user.uid, em: new Date().toISOString() });
      b.set(doc(fs, 'usuarios/' + cred.user.uid), { nome, email, papel: 'admin', ativo: true, criadoEm: new Date().toISOString() });
      await b.commit();
      location.reload();
    } catch (er) { msg(errPt(er), true); }
  };
}
function telaSemModulo() {
  showGate(`<h1>Sem acesso a este módulo</h1><p class="gsub">Seu usuário não tem acesso ao módulo <b>${esc(MOD_NOME[MOD] || MOD)}</b>. Peça ao administrador para liberar.</p>
    <a class="btn primary big" href="${new URL('./', import.meta.url).href}" style="margin-top:14px;display:block;text-align:center;text-decoration:none">Voltar ao portal</a>`);
}
/* perfil da pessoa no módulo aberto: Administrador vale para tudo; 'papel' é o perfil de Ferramentas & EPI; os demais módulos ficam em 'modulos' */
function papelNoModulo(d) {
  if (d.papel === 'admin') return 'admin';
  if (d.papel === 'funcionario') return 'nenhum';
  if (MOD === 'portal' || MOD === 'ferramentas') return d.papel || 'nenhum';
  const m = (d.modulos || {})[MOD];
  if (m) return m;
  /* sem perfil definido no módulo: Gestão vale para tudo; Gerente, TST e RH herdam o que já faziam com treinamentos */
  if (d.papel === 'gestao') return 'gestao';
  if (MOD === 'treinamentos') return ({ gerente: 'gestor', tst: 'tst', rh: 'rh' })[d.papel] || 'nenhum';
  if (MOD === 'indicadores') return d.papel === 'gerente' ? 'todos' : 'nenhum';
  return 'nenhum';
}
function telaSemAcesso(u) {
  showGate(`<h1>Acesso não liberado</h1><p class="gsub">A conta <b>${esc(u.email)}</b> está desativada ou ainda não tem perfil. Fale com o administrador.</p>
    <button class="btn ghost big" id="g-out" type="button">Sair</button>`);
  gate.querySelector('#g-out').onclick = () => signOut(auth).then(() => location.reload());
}

/* ---------- banco: mesma interface do app ---------- */
const pend = { n: 0 };
const mapErr = e => ({ code: ({ 'permission-denied': 'invalid_argument', 'invalid-argument': 'invalid_argument', 'not-found': 'invalid_argument', 'resource-exhausted': 'resource_exhausted', 'unavailable': 'unavailable', 'unauthenticated': 'revoked' })[e && e.code] || 'unavailable', message: (e && e.message) || String(e) });
/* gravação: grava no celular na hora; se estiver sem internet, não trava a tela esperando o servidor */
function write(p) {
  pend.n++; updConn();
  const done = p.then(() => { pend.n--; updConn(); }, e => { pend.n--; updConn(); throw mapErr(e); });
  return Promise.race([done, new Promise(r => setTimeout(r, navigator.onLine ? 8000 : 400))]);
}
const wDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites } });
const wQuery = s => { const docs = s.docs.map(wDoc); return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }, docChanges: () => [] }; };
function docRef(path) {
  const r = doc(fs, path);
  return {
    id: r.id, path,
    get: () => getDoc(r).then(wDoc, e => { throw mapErr(e); }),
    set: d => write(setDoc(r, d)),
    update: d => write(updateDoc(r, d)),
    delete: () => write(deleteDoc(r)),
    onSnapshot: (next, err) => onSnapshot(r, s => next(wDoc(s)), e => err && err(mapErr(e))),
    collection: sub => collRef(path + '/' + sub)
  };
}
function collRef(path, cons) {
  cons = cons || [];
  const c = collection(fs, path); const q = () => cons.length ? query(c, ...cons) : c;
  return {
    path,
    where: (f, op, v) => collRef(path, cons.concat(where(f, op, v))),
    orderBy: (f, d) => collRef(path, cons.concat(orderBy(f, d || 'asc'))),
    limit: n => collRef(path, cons.concat(limit(n))),
    get: () => getDocs(q()).then(wQuery, e => { throw mapErr(e); }),
    onSnapshot: (next, err) => onSnapshot(q(), { includeMetadataChanges: true }, s => next(wQuery(s)), e => err && err(mapErr(e))),
    doc: id => docRef(id ? path + '/' + id : doc(c).path),
    add: async d => { const r = docRef(doc(c).path); await r.set(d); return r; }
  };
}
const DB = { doc: docRef, collection: p => collRef(p) };

/* ---------- conexão / pendências ---------- */
function updConn() {
  const c = document.getElementById('conn'); if (!c) return;
  if (!navigator.onLine) { c.textContent = 'Offline' + (pend.n ? ` · ${pend.n} a enviar` : ' · salvando no aparelho'); c.className = 'conn warn'; }
  else if (pend.n) { c.textContent = `Enviando ${pend.n}…`; c.className = 'conn warn'; }
  else if (c.textContent.startsWith('Offline') || c.textContent.startsWith('Enviando')) { c.textContent = 'Online'; c.className = 'conn ok'; }
}
addEventListener('online', updConn); addEventListener('offline', updConn); setInterval(updConn, 3000);

/* ---------- usuários / perfis ---------- */
let ME = null; let USERS = {};
const PAPEIS_EDIT = ['admin', 'gerente', 'gestao'];
function profileOf(id) { const u = USERS[id]; return { id, name: (u && u.nome) || '', avatarUrl: '', color: '#2a78d6', email: (u && u.email) || null, isMe: ME && id === ME.uid, guest: false }; }
const USER = {
  id: async () => ME && ME.uid,
  me: async () => ({ id: ME.uid, name: ME.nome, email: ME.email, avatarUrl: '', color: '#2a78d6', isOwner: ME.papel === 'admin', canEdit: PAPEIS_EDIT.includes(ME.papel) }),
  isOwner: async () => !!ME && ME.papel === 'admin',
  canEdit: async () => !!ME && PAPEIS_EDIT.includes(ME.papel),
  can: async n => n === 'data.write' ? !!ME : false,
  profiles: async ids => { const out = {}; [].concat(ids).forEach(id => out[id] = profileOf(id)); return out; },
  search: async q => { q = String(q || '').toLowerCase(); return Object.keys(USERS).filter(id => !q || (USERS[id].nome + ' ' + USERS[id].email).toLowerCase().includes(q)).slice(0, 8).map(profileOf); },
  name: async () => ME && ME.nome
};

/* ---------- downloads ---------- */
const DOWNLOADS = {
  save: async ({ filename, data }) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv' : /\.pdf$/i.test(filename) ? 'application/pdf' : 'application/octet-stream' });
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return { status: 'saved' }; } catch (e) { if (e && e.name === 'AbortError') throw { code: 'declined' }; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { status: 'saved' };
  }
};

/* ---------- administração de usuários (usado pela tela Cadastros → Usuários) ---------- */
async function criarUsuario({ nome, email, papel, modulos }) {
  const tmp = initializeApp(FIREBASE_CONFIG, 'cadastro-' + Date.now());
  try {
    const a2 = getAuth(tmp);
    const senhaTemp = crypto.getRandomValues(new Uint32Array(4)).join('-') + 'Aa!';
    let uid;
    try { uid = (await createUserWithEmailAndPassword(a2, email, senhaTemp)).user.uid; }
    catch (e) { if (e && e.code === 'auth/email-already-in-use') throw { message: 'Este e-mail já tem conta. Se a pessoa foi desativada, reative na lista.' }; throw { message: errPt(e) }; }
    await signOut(a2);
    await setDoc(doc(fs, 'usuarios/' + uid), { nome, email, papel, modulos: modulos || {}, ativo: true, criadoEm: new Date().toISOString(), por: ME.uid });
    await sendPasswordResetEmail(auth, email);
    return uid;
  } finally { deleteApp(tmp).catch(() => {}); }
}
const reenviarConvite = email => sendPasswordResetEmail(auth, email);
/* acesso do funcionário ao portal do aluno: login = matrícula; a conta usa um e-mail interno que não recebe mensagens */
async function criarAluno({ funcionarioId, nome, chave }) {
  if (!navigator.onLine) throw { message: 'Criar o acesso precisa de internet.' };
  const lref = doc(fs, 'login/' + chave);
  let ant = null;
  try { const s = await getDocFromServer(lref); ant = s.exists() ? s.data() : null; } catch (e) { throw { message: 'Sem conexão com o servidor. Tente de novo.' }; }
  const senha = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  const tmp = initializeApp(FIREBASE_CONFIG, 'aluno-' + Date.now());
  try {
    const a2 = getAuth(tmp); let uid = null, email = '', v = ant ? (Number(ant.v) || 1) : 0;
    for (let k = 0; k < 6 && !uid; k++) {
      v++; email = chave + (v > 1 ? '.v' + v : '') + '@aluno.previne.app';
      try { uid = (await createUserWithEmailAndPassword(a2, email, senha)).user.uid; }
      catch (e) { if (!(e && e.code === 'auth/email-already-in-use')) throw { message: errPt(e) }; }
    }
    if (!uid) throw { message: 'Não foi possível criar o acesso. Tente de novo.' };
    await signOut(a2);
    const agora = new Date().toISOString(); const b = writeBatch(fs);
    b.set(doc(fs, 'usuarios/' + uid), { nome, email, papel: 'funcionario', funcionarioId, login: chave, ativo: true, trocarSenha: true, criadoEm: agora, por: ME.uid });
    b.set(lref, { email, v, uid, funcionarioId, em: agora });
    if (ant && ant.uid) b.update(doc(fs, 'usuarios/' + ant.uid), { ativo: false });
    await b.commit();
    return { senha, email };
  } finally { deleteApp(tmp).catch(() => {}); }
}
const atualizarUsuario = (uid, d) => updateDoc(doc(fs, 'usuarios/' + uid), d);

/* ---------- inicialização ---------- */
/* leitura robusta: servidor com prazo, depois cache local (evita travar na abertura com várias abas) */
const tempo = (p, ms) => Promise.race([p, new Promise((_, j) => setTimeout(() => j(new Error('timeout')), ms))]);
async function lerDoc(caminho) {
  const r = doc(fs, caminho);
  for (const ms of [6000, 10000]) {
    if (!navigator.onLine) break;
    try { const d = await tempo(getDocFromServer(r), ms); d.__srv = true; return d; } catch (e) { if (e && e.code === 'permission-denied') return null; }
  }
  try { return await tempo(getDocFromCache(r), 3000); } catch (_) { return null; }
}
let resolveReady; const ready = new Promise(r => resolveReady = r);
window.__fbUse = name => ready.then(() => ({ db: DB, user: USER, downloads: DOWNLOADS })[name] || null);
onAuthStateChanged(auth, async u => {
  if (!u) {
    const setup = await lerDoc('config/setup');
    return (setup && setup.__srv && !setup.exists()) ? telaSetup() : telaLogin();
  }
  const perf = await lerDoc('usuarios/' + u.uid);
  if (!perf) return telaErro();
  const d = perf.exists() ? perf.data() : null;
  if (!d && !perf.__srv) return telaErro();
  if (!d || d.ativo === false) return telaSemAcesso(u);
  if (d.papel === 'funcionario') { location.replace(new URL('./aluno/', import.meta.url).href); return; }
  const pm = papelNoModulo(d);
  if (MOD !== 'portal' && pm === 'nenhum') return telaSemModulo();
  ME = { uid: u.uid, email: u.email, nome: d.nome || u.email, papel: pm };
  window.__FB = { modulo: MOD, perfil: d, papel: pm, papelGeral: d.papel, uid: u.uid, nome: ME.nome, email: u.email, criarUsuario, criarAluno, reenviarConvite, atualizarUsuario, users: () => USERS, sair: () => signOut(auth).then(() => location.reload()) };
  onSnapshot(collection(fs, 'usuarios'), s => { USERS = {}; s.docs.forEach(x => USERS[x.id] = x.data()); const m = USERS[u.uid]; if (m && (m.ativo === false || m.papel !== window.__FB.papelGeral || JSON.stringify(m.modulos || {}) !== JSON.stringify(d.modulos || {}))) location.reload(); window.dispatchEvent(new Event('fb-users')); }, () => {});
  const um = document.getElementById('usermenu'); if (um) { um.hidden = false; um.querySelector('b').textContent = ME.nome.split(' ')[0]; um.onclick = () => { if (confirmSair()) window.__FB.sair(); }; }
  hideGate(); resolveReady();
});
function telaErro() {
  showGate(`<h1>Não foi possível carregar</h1><p class="gsub">Verifique a internet e tente de novo.</p>
    <button class="btn primary big" id="g-retry" type="button" style="margin-top:14px">Tentar de novo</button>`);
  document.getElementById('g-retry').onclick = () => location.reload();
}
function confirmSair() { const b = document.getElementById('usermenu'); if (b.dataset.armed) return true; b.dataset.armed = '1'; b.querySelector('span').textContent = 'Tocar de novo para sair'; setTimeout(() => { delete b.dataset.armed; b.querySelector('span').textContent = 'Sair'; }, 3000); return false; }

/* ---------- app instalável ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), { scope: new URL('./', import.meta.url).pathname }).catch(() => {});
