// js/firebase.js — Firebase config + funções compartilhadas

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

const app           = initializeApp(firebaseConfig);
const db            = getFirestore(app);
const auth          = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// E-mail da administradora
const ADMIN_EMAIL = '';
function isAdmin(user) { return user && user.email === ADMIN_EMAIL; }

// ── AUTH helpers ──────────────────────────────────────────────────
async function loginWithGoogle()                       { return signInWithPopup(auth, googleProvider); }
async function loginWithEmail(email, pass)             { return signInWithEmailAndPassword(auth, email, pass); }
async function registerWithEmail(email, pass, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(cred.user, { displayName: name });
  return cred;
}

// ── Horários padrão: 09h–22h de seg a sáb ───────────────────────
function gerarHorasPadrao(dow) {
  if (dow === 0) return []; // domingo fechado
  const horas = [];
  for (let h = 9; h <= 22; h++) horas.push(`${String(h).padStart(2,'0')}:00`);
  return horas;
}

// ── dateKey "YYYY-MM-DD" ──────────────────────────────────────────
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ── Verifica bloqueio do dia ──────────────────────────────────────
async function isDayBlocked(date) {
  const snap = await getDoc(doc(db, 'dias_bloqueados', dateKey(date)));
  return snap.exists() ? snap.data() : null;
}

// ── Horários ocupados (agendamentos aceitos ou pendentes) ─────────
async function getHorariosOcupados(date) {
  const key  = dateKey(date);
  const q    = query(collection(db, 'agendamentos'), where('data', '==', key));
  const snap = await getDocs(q);
  // Horário ocupa quando status != 'rejeitado'
  return snap.docs
    .filter(d => d.data().status !== 'rejeitado')
    .map(d => {
      const ag = d.data();
      // Se for "dia todo" ocupa todos os horários (retorna símbolo especial)
      return ag.diaTodo ? '__DIA_TODO__' : ag.hora;
    });
}

// ── Horários disponíveis ──────────────────────────────────────────
async function getHorariosDisponiveis(date) {
  if (date.getDay() === 0) return { bloqueado: true, motivo: 'Domingo sem atendimento' };
  const bloqueio = await isDayBlocked(date);
  if (bloqueio) return { bloqueado: true, motivo: bloqueio.motivo || 'Indisponível' };

  const ocupados = await getHorariosOcupados(date);
  if (ocupados.includes('__DIA_TODO__'))
    return { bloqueado: true, motivo: 'Dia inteiro reservado' };

  const livres = gerarHorasPadrao(date.getDay()).filter(h => !ocupados.includes(h));
  return { bloqueado: false, horarios: livres };
}

// ── Salva agendamento com status "pendente" ───────────────────────
async function salvarAgendamento(dados) {
  const id = `${dados.data}_${dados.hora.replace(':','')}_${Date.now()}`;
  await setDoc(doc(db, 'agendamentos', id), {
    ...dados, id, status: 'pendente', criadoEm: new Date().toISOString()
  });
  return id;
}

// ── Atualiza status de um agendamento ────────────────────────────
async function atualizarStatusAgendamento(id, status, horaFim, diaTodo) {
  const payload = { status };
  if (horaFim  !== undefined) payload.horaFim = horaFim;
  if (diaTodo  !== undefined) payload.diaTodo  = diaTodo;
  await updateDoc(doc(db, 'agendamentos', id), payload);
}

// ── Cancela / remove agendamento ─────────────────────────────────
async function cancelarAgendamento(id) { await deleteDoc(doc(db, 'agendamentos', id)); }

// ── Bloqueios de dias ────────────────────────────────────────────
async function bloquearDia(date, motivo) {
  await setDoc(doc(db, 'dias_bloqueados', dateKey(date)), { motivo, data: dateKey(date) });
}
async function desbloquearDia(date) { await deleteDoc(doc(db, 'dias_bloqueados', dateKey(date))); }

// ── Queries ───────────────────────────────────────────────────────
async function getAgendamentosDoDia(date) {
  const q    = query(collection(db, 'agendamentos'), where('data', '==', dateKey(date)));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
async function getTodosAgendamentos() {
  const snap = await getDocs(collection(db, 'agendamentos'));
  return snap.docs.map(d => d.data()).sort((a,b) => a.data.localeCompare(b.data)||a.hora.localeCompare(b.hora));
}
async function getDiasBloqueados() {
  const snap = await getDocs(collection(db, 'dias_bloqueados'));
  return snap.docs.map(d => d.data());
}
async function getAgendamentosDoUsuario(userId) {
  const q    = query(collection(db, 'agendamentos'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data()).sort((a,b) => a.data.localeCompare(b.data)||a.hora.localeCompare(b.hora));
}

export {
  signInWithEmailAndPassword,
  auth, db, dateKey, isAdmin, ADMIN_EMAIL,
  loginWithGoogle, loginWithEmail, registerWithEmail,
  signOut, onAuthStateChanged,
  isDayBlocked, getHorariosDisponiveis,
  salvarAgendamento, atualizarStatusAgendamento, cancelarAgendamento,
  bloquearDia, desbloquearDia,
  getAgendamentosDoDia, getTodosAgendamentos, getDiasBloqueados,
  getAgendamentosDoUsuario
};
