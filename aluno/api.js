/* Portal do aluno: acesso ao Firebase. Usa uma instância própria ("aluno"), separada do login da equipe. */
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(FIREBASE_CONFIG, 'aluno');
const auth = getAuth(app);
const fs = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const errPt = e => ({
  'auth/invalid-credential': 'Matrícula ou senha incorretas.', 'auth/wrong-password': 'Matrícula ou senha incorretas.', 'auth/user-not-found': 'Matrícula ou senha incorretas.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/network-request-failed': 'Sem internet.', 'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/requires-recent-login': 'Entre de novo para trocar a senha.', 'auth/user-disabled': 'Acesso desativado. Fale com o RH.', 'permission-denied': 'Sem permissão. Fale com o RH.'
}[e && e.code] || ((e && e.message) || String(e)));
const lista = async q => (await getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data()));
const um = async p => { const s = await getDoc(doc(fs, p)); return s.exists() ? Object.assign({ id: s.id }, s.data()) : null; };
const chaveDe = m => String(m || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

window.API = {
  errPt,
  onUser(cb) {
    onAuthStateChanged(auth, async u => {
      if (!u) return cb(null);
      try { const p = await um('usuarios/' + u.uid); cb({ uid: u.uid, perfil: p }); } catch (e) { cb({ uid: u.uid, perfil: null, erro: errPt(e) }); }
    });
  },
  async entrar(matricula, senha) {
    const k = chaveDe(matricula); if (!k) throw { message: 'Digite a matrícula.' };
    let lg; try { lg = await um('login/' + k); } catch (e) { throw { message: errPt(e) }; }
    if (!lg || !lg.email) throw { message: 'Matrícula sem acesso. Peça ao RH para liberar.' };
    try { await signInWithEmailAndPassword(auth, lg.email, senha); } catch (e) { throw { message: errPt(e) }; }
  },
  sair: () => signOut(auth),
  async trocarSenha(nova, uid) { try { await updatePassword(auth.currentUser, nova); await updateDoc(doc(fs, 'usuarios/' + uid), { trocarSenha: false, senhaTrocadaEm: new Date().toISOString() }); } catch (e) { throw { message: errPt(e) }; } },
  funcionario: id => um('funcionarios/' + id),
  empresa: () => um('config/empresa').catch(() => null),
  matriculas: fid => lista(query(collection(fs, 'matriculas'), where('funcionarioId', '==', fid))),
  curso: id => um('cursos/' + id),
  padroes: () => lista(collection(fs, 'padroes')),
  regsPadrao: fid => lista(query(collection(fs, 'padrao_reg'), where('funcionarioId', '==', fid))),
  treinamentos: fid => lista(query(collection(fs, 'treinamentos'), where('funcionarioId', '==', fid))),
  externos: fid => lista(query(collection(fs, 'trein_ext'), where('funcionarioId', '==', fid))),
  salvarMatricula: (id, patch) => updateDoc(doc(fs, 'matriculas/' + id), patch),
  salvarModulo: (id, modId, obj) => updateDoc(doc(fs, 'matriculas/' + id), { ['prog.' + modId]: obj }),
  somarTempo: (id, seg) => updateDoc(doc(fs, 'matriculas/' + id), { tempo: increment(seg) }),
  registrarPadrao: reg => setDoc(doc(collection(fs, 'padrao_reg')), reg),
  async arquivo(id) {
    const m = await um('arquivos/' + id); if (!m) throw { message: 'Arquivo não encontrado.' };
    let b64 = ''; for (let i = 0; i < Number(m.partes || 0); i++) { const p = await um(`arquivos/${id}/p/${i}`); if (!p) throw { message: 'Arquivo incompleto.' }; b64 += p.d; }
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return { bytes: u8, tipo: m.tipo || 'application/pdf', nome: m.nome };
  }
};
window.dispatchEvent(new Event('api-pronta'));
