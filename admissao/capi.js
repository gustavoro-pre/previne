/* Página do candidato: acesso ao Firestore sem login. A segurança vem do código do link (não listável) e das regras. */
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const fs = getFirestore(initializeApp(FIREBASE_CONFIG, 'candidato'));
const msg = e => ({ 'permission-denied': 'Este link não está mais ativo. Fale com o RH.', 'unavailable': 'Sem internet. Tente de novo.' }[e && e.code] || (e && e.message) || String(e));
window.CAPI = {
  async get(tk) { try { const s = await getDoc(doc(fs, 'admissoes/' + tk)); return s.exists() ? s.data() : null; } catch (e) { throw new Error(msg(e)); } },
  async empresa() { try { const s = await getDoc(doc(fs, 'config/publico')); return s.exists() ? s.data() : {}; } catch (e) { return {}; } },
  async setCand(tk, cand) { try { await updateDoc(doc(fs, 'admissoes/' + tk), { cand }); } catch (e) { throw new Error(msg(e)); } },
  async getD(tk, id) { try { const s = await getDoc(doc(fs, `admissoes/${tk}/d/${id}`)); return s.exists() ? s.data() : null; } catch (e) { throw new Error(msg(e)); } },
  async setPart(tk, id, d) { try { await setDoc(doc(fs, `admissoes/${tk}/p/${id}`), { d }); } catch (e) { throw new Error(msg(e)); } }
};
window.dispatchEvent(new Event('capi'));
