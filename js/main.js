// js/main.js

import {
  auth, dateKey,
  getHorariosDisponiveis, salvarAgendamento, getAgendamentosDoUsuario,
  onAuthStateChanged, signOut,
  loginWithGoogle, registerWithEmail, loginWithEmail,
  isAdmin
} from './firebase.js';

// Fixa --vh uma vez no load para evitar resize do hero ao rolar no mobile
function setVh() {
  document.documentElement.style.setProperty('--vh', window.innerHeight * 0.01 + 'px');
}
setVh();
// Só recalcula no resize real (orientação), não no scroll
window.addEventListener('resize', setVh, { passive: true });

const MESES      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTO= ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── LOADER ────────────────────────────────────────────────────────
const loader = document.getElementById('loader');
window.addEventListener('load', () => setTimeout(() => loader.classList.add('hidden'), 800));

// ── HEADER SCROLL ─────────────────────────────────────────────────
const header = document.getElementById('header');
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 60));

// ── HAMBURGER ─────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const nav       = document.getElementById('nav');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  nav.classList.toggle('open');
});
nav.querySelectorAll('.nav__link').forEach(l => l.addEventListener('click', () => {
  hamburger.classList.remove('open'); nav.classList.remove('open');
}));

// ── SWIPER HERO ───────────────────────────────────────────────────
new Swiper('#heroSwiper', {
  loop: true, speed: 1400, effect: 'fade',
  fadeEffect: { crossFade: true },
  autoplay: { delay: 5500, disableOnInteraction: false },
});

// ── SWIPER DEPOIMENTOS ────────────────────────────────────────────
new Swiper('#depSwiper', {
  loop: true, speed: 600,
  autoplay: { delay: 6000, disableOnInteraction: false },
  pagination: { el: '#depPag', clickable: true },
});

// ── PORTFOLIO FILTER ──────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('.porto-item').forEach(item =>
      item.classList.toggle('hidden', f !== 'all' && item.dataset.cat !== f)
    );
  });
});

// ── AUTH STATE ────────────────────────────────────────────────────
let currentUser = null;

const navAuth      = document.getElementById('navAuth');
const navUserEl    = document.getElementById('navUser');
const userNameEl   = document.getElementById('userName');
const userAvatarEl = document.getElementById('userAvatar');
const authOverlay  = document.getElementById('authOverlay');
const formLogin    = document.getElementById('formLogin');
const formRegister = document.getElementById('formRegister');
const userDropdown = document.getElementById('userDropdown');
const googleBanner = document.getElementById('googleBanner');

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    navAuth.style.display = 'none';
    navUserEl.style.display = 'flex';
    userNameEl.textContent = user.displayName || user.email.split('@')[0];
    userAvatarEl.innerHTML = user.photoURL
      ? `<img src="${user.photoURL}" alt="">`
      : '<i class="fa-solid fa-user"></i>';
    if (isAdmin(user)) document.getElementById('linkAdmin').style.display = 'flex';
    closeAuthModal();
    googleBanner.style.display = 'none';
    document.getElementById('meus-agendamentos').style.display = 'block';
    loadMeusAgendamentos();
  } else {
    navAuth.style.display = 'flex';
    navUserEl.style.display = 'none';
    document.getElementById('linkAdmin').style.display = 'none';
    document.getElementById('meus-agendamentos').style.display = 'none';
    // Mostra banner Google depois de 2s
    // Usa localStorage com expiração de 24h para não sumir definitivamente
    const bannerTs = localStorage.getItem('bannerFechadoTs');
    const expirou  = !bannerTs || (Date.now() - Number(bannerTs)) > 24*60*60*1000;
    if (expirou) {
      setTimeout(() => { googleBanner.style.display = 'block'; }, 2000);
    }
  }
});

// ── GOOGLE BANNER ─────────────────────────────────────────────────
document.getElementById('btnBannerGoogle').addEventListener('click', async () => {
  try { await loginWithGoogle(); }
  catch(e) { console.error(e); }
});
document.getElementById('btnBannerClose').addEventListener('click', () => {
  googleBanner.style.display = 'none';
  localStorage.setItem('bannerFechadoTs', String(Date.now()));
});

// ── AUTH MODAL ────────────────────────────────────────────────────
document.getElementById('btnOpenLogin').addEventListener('click', () => openAuthModal('login'));
document.getElementById('btnCloseAuth').addEventListener('click', closeAuthModal);
authOverlay.addEventListener('click', e => { if (e.target === authOverlay) closeAuthModal(); });

function openAuthModal(form = 'login') {
  authOverlay.style.display = 'flex';
  formLogin.style.display    = form === 'login' ? 'block' : 'none';
  formRegister.style.display = form === 'register' ? 'block' : 'none';
}
function closeAuthModal() {
  authOverlay.style.display = 'none';
  document.getElementById('authLoginError').textContent = '';
  document.getElementById('authRegisterError').textContent = '';
}

document.getElementById('btnGoRegister').addEventListener('click', () => { formLogin.style.display='none'; formRegister.style.display='block'; });
document.getElementById('btnGoLogin').addEventListener('click',    () => { formRegister.style.display='none'; formLogin.style.display='block'; });

document.getElementById('btnGoogleLogin').addEventListener('click',    async () => { try { await loginWithGoogle(); } catch(e) { document.getElementById('authLoginError').textContent = 'Erro ao entrar com Google.'; } });
document.getElementById('btnGoogleRegister').addEventListener('click', async () => { try { await loginWithGoogle(); } catch(e) { document.getElementById('authRegisterError').textContent = 'Erro ao cadastrar com Google.'; } });

document.getElementById('btnAuthLogin').addEventListener('click', async () => {
  const email = document.getElementById('authLoginEmail').value.trim();
  const senha = document.getElementById('authLoginSenha').value;
  const errEl = document.getElementById('authLoginError');
  errEl.textContent = '';
  if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  try { await loginWithEmail(email, senha); }
  catch(e) { errEl.textContent = 'E-mail ou senha incorretos.'; }
});

document.getElementById('btnAuthRegister').addEventListener('click', async () => {
  const nome  = document.getElementById('authRegisterNome').value.trim();
  const email = document.getElementById('authRegisterEmail').value.trim();
  const senha = document.getElementById('authRegisterSenha').value;
  const errEl = document.getElementById('authRegisterError');
  errEl.textContent = '';
  if (!nome || !email || !senha) { errEl.textContent = 'Preencha todos os campos.'; return; }
  if (senha.length < 6) { errEl.textContent = 'Senha mínima de 6 caracteres.'; return; }
  try { await registerWithEmail(email, senha, nome); }
  catch(e) {
    errEl.textContent = e.code === 'auth/email-already-in-use'
      ? 'Este e-mail já está cadastrado.' : 'Erro ao criar conta. Tente novamente.';
  }
});

// User dropdown
document.getElementById('btnUserMenu').addEventListener('click', e => { e.stopPropagation(); userDropdown.classList.toggle('open'); });
document.addEventListener('click', () => userDropdown.classList.remove('open'));
document.getElementById('btnLogoutSite').addEventListener('click', () => signOut(auth));

// ── MEUS AGENDAMENTOS ─────────────────────────────────────────────
async function loadMeusAgendamentos() {
  if (!currentUser) return;
  const list    = document.getElementById('meusAgList');
  const emptyEl = document.getElementById('meusAgEmpty');
  list.innerHTML = '<div class="meus-ag__loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  emptyEl.style.display = 'none';

  const ags  = await getAgendamentosDoUsuario(currentUser.uid);
  if (!ags.length) { list.innerHTML=''; emptyEl.style.display='block'; return; }

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  list.innerHTML = ags.map(ag => {
    const [y,m,d]  = ag.data.split('-');
    const agDate   = new Date(+y, +m-1, +d);
    const isPast   = agDate < hoje;
    const statusMap = {
      pendente:   { cls:'status--pending', txt:'⏳ Aguardando confirmação' },
      aceito:     { cls:'status--ok',      txt:'✅ Confirmado' },
      rejeitado:  { cls:'status--rejected',txt:'❌ Não confirmado' },
    };
    const s = statusMap[ag.status] || statusMap['pendente'];
    return `
      <div class="meu-ag-card ${isPast?'meu-ag-card--past':''}">
        <div class="meu-ag-card__date"><span class="dia">${+d}</span><span class="mes">${MESES_CURTO[+m-1]}</span></div>
        <div class="meu-ag-card__info">
          <span class="servico">${ag.servico}</span>
          <span class="horario"><i class="fa-solid fa-clock"></i> ${ag.hora}${ag.horaFim?' – '+ag.horaFim:''}</span>
          <span class="status ${s.cls}">${s.txt}</span>
        </div>
      </div>`;
  }).join('');
}

// ── AGENDAMENTO FLOW ──────────────────────────────────────────────
let selectedServico = '';
let selectedDate    = null;
let selectedHora    = '';
const today = new Date(); today.setHours(0,0,0,0);
let calYear = today.getFullYear(), calMonth = today.getMonth();

function goToStep(n) {
  document.querySelectorAll('.agenda-step').forEach(s => s.classList.remove('active'));
  const t = document.getElementById('step' + n);
  if (t) { t.classList.add('active'); t.scrollIntoView({ behavior:'smooth', block:'center' }); }
}

// Step 1 → 2: exige login
document.getElementById('btn12').addEventListener('click', () => {
  const checked = document.querySelector('input[name="servico"]:checked');
  if (!checked) { alert('Por favor, selecione um serviço.'); return; }
  if (!currentUser) { openAuthModal('login'); return; }
  selectedServico = checked.value;
  goToStep(2);
  renderCalendar();
});

// Step 2 → 3
document.getElementById('btn23').addEventListener('click', () => {
  if (!selectedDate) { alert('Selecione uma data.'); return; }
  if (!selectedHora) { alert('Selecione um horário.'); return; }
  buildResumo();
  goToStep(3);
  if (currentUser) {
    const n = document.getElementById('nomeCliente');
    const e = document.getElementById('emailCliente');
    if (!n.value && currentUser.displayName) n.value = currentUser.displayName;
    if (!e.value && currentUser.email)       e.value = currentUser.email;
  }
});

document.getElementById('btnBack1').addEventListener('click', () => goToStep(1));
document.getElementById('btnBack2').addEventListener('click', () => goToStep(2));

// ── CALENDÁRIO ────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('calLabel').textContent = `${MESES[calMonth]} ${calYear}`;
  const grid = document.getElementById('calDays');
  grid.innerHTML = '';
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  for (let i=0; i<firstDay; i++) {
    const el = document.createElement('div'); el.className='cal-day empty'; grid.appendChild(el);
  }
  for (let d=1; d<=daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d); date.setHours(0,0,0,0);
    const el = document.createElement('div'); el.className='cal-day'; el.textContent=d;
    const isPast  = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSun   = date.getDay() === 0;
    if (isSun)  el.classList.add('sunday');
    if (isPast) el.classList.add('past');
    if (isToday)el.classList.add('today');
    if (selectedDate && date.getTime()===selectedDate.getTime()) el.classList.add('selected');
    if (!isPast) el.addEventListener('click', () => selectDay(date, el));
    grid.appendChild(el);
  }
}

async function selectDay(date, el) {
  document.querySelectorAll('.cal-day.selected').forEach(d=>d.classList.remove('selected'));
  el.classList.add('selected');
  selectedDate = date; selectedHora='';
  await renderHorarios(date);
}

async function renderHorarios(date) {
  const box     = document.getElementById('horariosBox');
  const loading = document.getElementById('horariosLoading');
  const grid    = document.getElementById('horariosGrid');
  box.style.display='block'; loading.style.display='block'; grid.innerHTML='';
  const res = await getHorariosDisponiveis(date);
  loading.style.display='none';
  if (res.bloqueado) {
    grid.innerHTML=`<div class="dia-bloqueado"><i class="fa-solid fa-ban"></i> ${res.motivo}</div>`; return;
  }
  if (!res.horarios.length) {
    grid.innerHTML=`<div class="dia-bloqueado"><i class="fa-solid fa-calendar-xmark"></i> Todos os horários estão reservados.</div>`; return;
  }
  res.horarios.forEach(h => {
    const btn = document.createElement('button');
    btn.className='hora-btn'; btn.textContent=h;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hora-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected'); selectedHora=h;
    });
    grid.appendChild(btn);
  });
}

document.getElementById('calPrev').addEventListener('click', () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); });
document.getElementById('calNext').addEventListener('click', () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); });

function buildResumo() {
  const ds = selectedDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  document.getElementById('resumoBox').innerHTML =
    `<strong>Serviço:</strong> ${selectedServico}<br><strong>Data:</strong> ${ds}<br><strong>Horário:</strong> ${selectedHora}`;
}

// ── ENVIO ─────────────────────────────────────────────────────────
document.getElementById('btnEnviar').addEventListener('click', async () => {
  if (!currentUser) { openAuthModal('login'); return; }
  const nome = document.getElementById('nomeCliente').value.trim();
  const tel  = document.getElementById('telefoneCliente').value.trim();
  if (!nome || !tel) { alert('Preencha nome e WhatsApp.'); return; }

  const btn = document.getElementById('btnEnviar');
  btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    const dados = {
      servico: selectedServico,
      data:    dateKey(selectedDate),
      hora:    selectedHora,
      nome, telefone: tel,
      email:    document.getElementById('emailCliente').value.trim(),
      mensagem: document.getElementById('msgCliente').value.trim(),
      userId:   currentUser.uid,
      userEmail:currentUser.email,
    };
    await salvarAgendamento(dados);

    const ds = selectedDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    let txt = `Olá Daiane! Acabei de solicitar um agendamento pelo site:\n\n`;
    txt += `📸 *Serviço:* ${dados.servico}\n📅 *Data:* ${ds}\n⏰ *Horário:* ${dados.hora}\n👤 *Nome:* ${dados.nome}\n📱 *WhatsApp:* ${dados.telefone}`;
    if (dados.email)    txt += `\n📧 *E-mail:* ${dados.email}`;
    if (dados.mensagem) txt += `\n\n💬 ${dados.mensagem}`;
    window.open(`https://wa.me/554192576289?text=${encodeURIComponent(txt)}`, '_blank');
    goToStep('Ok');
    loadMeusAgendamentos();
  } catch(err) {
    console.error(err);
    alert('Erro ao salvar. Verifique sua conexão.');
    btn.disabled=false;
    btn.innerHTML='<i class="fa-brands fa-whatsapp"></i> Confirmar pelo WhatsApp';
  }
});

document.getElementById('btnNovo').addEventListener('click', () => {
  selectedServico=''; selectedDate=null; selectedHora='';
  document.querySelectorAll('input[name="servico"]').forEach(r=>r.checked=false);
  ['nomeCliente','telefoneCliente','emailCliente','msgCliente'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  calYear=today.getFullYear(); calMonth=today.getMonth();
  document.getElementById('horariosBox').style.display='none';
  const btn=document.getElementById('btnEnviar');
  btn.disabled=false; btn.innerHTML='<i class="fa-brands fa-whatsapp"></i> Confirmar pelo WhatsApp';
  goToStep(1);
});
