// js/admin.js — Painel admin com aceitar/rejeitar + horário fim + dia todo

import {
  auth, dateKey, isAdmin,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, loginWithGoogle,
  getTodosAgendamentos, getAgendamentosDoDia, cancelarAgendamento, atualizarStatusAgendamento,
  bloquearDia, desbloquearDia, getDiasBloqueados, isDayBlocked
} from './firebase.js';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── AUTH ──────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user && isAdmin(user)) showAdmin();
  else if (user) { signOut(auth); document.getElementById('loginError').textContent='Acesso restrito.'; showLogin(); }
  else showLogin();
});
function showLogin() { document.getElementById('loginScreen').style.display='flex'; document.getElementById('adminLayout').style.display='none'; }
function showAdmin() { document.getElementById('loginScreen').style.display='none'; document.getElementById('adminLayout').style.display='flex'; initAdmin(); }

document.getElementById('btnLogin').addEventListener('click', async () => {
  const email=document.getElementById('loginEmail').value.trim();
  const senha=document.getElementById('loginSenha').value;
  const errEl=document.getElementById('loginError');
  const btn  =document.getElementById('btnLogin');
  errEl.textContent=''; btn.disabled=true; btn.textContent='Entrando...';
  try { await signInWithEmailAndPassword(auth,email,senha); }
  catch(e) { errEl.textContent='E-mail ou senha incorretos.'; btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Entrar'; }
});
document.getElementById('loginSenha').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('btnLogin').click(); });
document.getElementById('btnGoogleAdmin').addEventListener('click', async () => {
  try { await loginWithGoogle(); }
  catch(e) { document.getElementById('loginError').textContent='Erro ao entrar com Google.'; }
});
document.getElementById('btnLogout').addEventListener('click', ()=>signOut(auth));

// ── TABS ──────────────────────────────────────────────────────────
document.querySelectorAll('.sidebar__link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar__link').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab==='agendamentos') loadAgendamentos();
    if (btn.dataset.tab==='bloqueios')    loadBloqueios();
  });
});

// ── INIT ──────────────────────────────────────────────────────────
let adminYear, adminMonth, selectedAdminDate=null;
function initAdmin() {
  const hoje=new Date(); adminYear=hoje.getFullYear(); adminMonth=hoje.getMonth();
  renderAdminCal();
  loadAgendamentos();
}

// ── CALENDÁRIO ADMIN ──────────────────────────────────────────────
async function renderAdminCal() {
  document.getElementById('adminCalLabel').textContent=`${MESES[adminMonth]} ${adminYear}`;
  const grid=document.getElementById('adminCalDays');
  grid.innerHTML='<div class="loading-msg" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  const [bloqueados, todos] = await Promise.all([getDiasBloqueados(), getTodosAgendamentos()]);
  const bloqSet = new Set(bloqueados.map(b=>b.data));
  const countMap={}, pendMap={};
  todos.forEach(ag => {
    if (ag.status==='rejeitado') return;
    if (!countMap[ag.data]) { countMap[ag.data]=0; pendMap[ag.data]=0; }
    countMap[ag.data]++;
    if (ag.status==='pendente') pendMap[ag.data]++;
  });

  grid.innerHTML='';
  const firstDay=new Date(adminYear,adminMonth,1).getDay();
  const daysInMonth=new Date(adminYear,adminMonth+1,0).getDate();
  const hoje=new Date(); hoje.setHours(0,0,0,0);

  for(let i=0;i<firstDay;i++){
    const el=document.createElement('div'); el.className='admin-cal-day empty'; grid.appendChild(el);
  }
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(adminYear,adminMonth,d); date.setHours(0,0,0,0);
    const key=dateKey(date);
    const el=document.createElement('div'); el.className='admin-cal-day';
    const isPast=date<hoje, isSun=date.getDay()===0, isBloq=bloqSet.has(key);
    const count=countMap[key]||0, pend=pendMap[key]||0;

    if(isPast) el.classList.add('past');
    if(date.getTime()===hoje.getTime()) el.classList.add('today');
    if(isSun)  el.classList.add('sunday');
    if(isBloq) el.classList.add('blocked');
    else if(pend>0) el.classList.add('has-pending');
    else if(count>0)el.classList.add('has-bookings');
    if(selectedAdminDate&&date.getTime()===selectedAdminDate.getTime()) el.classList.add('selected');

    el.innerHTML=`<span class="day-num">${d}</span>`;
    if(isBloq)       el.innerHTML+=`<span class="day-badge badge-blocked"><i class="fa-solid fa-ban"></i></span>`;
    else if(pend>0)  el.innerHTML+=`<span class="day-badge badge-pending">${pend}</span>`;
    else if(count>0) el.innerHTML+=`<span class="day-badge badge-count">${count}</span>`;

    el.addEventListener('click',()=>selectAdminDay(date));
    grid.appendChild(el);
  }
}

async function selectAdminDay(date) {
  selectedAdminDate=date; renderAdminCal(); await loadDayDetail(date);
}

async function loadDayDetail(date) {
  const detail =document.getElementById('dayDetail');
  const title  =document.getElementById('dayDetailTitle');
  const content=document.getElementById('dayDetailContent');
  const btnBlq =document.getElementById('btnBloquearDia');
  const btnDes =document.getElementById('btnDesbloquearDia');

  const ds=date.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  title.textContent=ds.charAt(0).toUpperCase()+ds.slice(1);
  detail.style.display='block';
  content.innerHTML='<div class="loading-msg"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  const [bloq,ags]=await Promise.all([isDayBlocked(date), getAgendamentosDoDia(date)]);
  if(bloq){ btnBlq.style.display='none'; btnDes.style.display='inline-flex'; }
  else    { btnBlq.style.display='inline-flex'; btnDes.style.display='none'; }

  btnBlq.onclick=()=>{
    const motivo=prompt('Motivo do bloqueio (ex: Férias, Feriado):');
    if(motivo===null) return;
    confirm2(`Bloquear este dia?`, async()=>{ await bloquearDia(date,motivo||'Indisponível'); renderAdminCal(); loadDayDetail(date); });
  };
  btnDes.onclick=()=>{
    confirm2(`Desbloquear este dia?`, async()=>{ await desbloquearDia(date); renderAdminCal(); loadDayDetail(date); });
  };

  if(bloq){ content.innerHTML=`<div class="bloq-banner"><i class="fa-solid fa-ban"></i> <strong>Dia bloqueado:</strong> ${bloq.motivo}</div>`; return; }
  if(date.getDay()===0){ content.innerHTML='<div class="bloq-banner" style="background:#f5f5f5;color:#888"><i class="fa-solid fa-calendar-xmark"></i> Domingo — sem atendimento</div>'; return; }
  if(!ags.length){ content.innerHTML='<p class="empty-day">Nenhum agendamento neste dia.</p>'; return; }

  ags.sort((a,b)=>a.hora.localeCompare(b.hora));
  content.innerHTML=ags.map(ag=>agendamentoCardAdmin(ag)).join('');
  bindCardActions(content, date);
}

function agendamentoCardAdmin(ag) {
  const statusHtml = {
    pendente: `<span class="ag-status ag-status--pending">⏳ Pendente</span>`,
    aceito:   `<span class="ag-status ag-status--ok">✅ Confirmado${ag.horaFim?' ('+ag.hora+'–'+ag.horaFim+')':''}</span>`,
    rejeitado:`<span class="ag-status ag-status--rejected">❌ Rejeitado</span>`,
  }[ag.status] || '';

  const acoes = ag.status==='pendente' ? `
    <div class="ag-admin-acoes">
      <div class="accept-form">
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          <label style="font-size:.72rem;color:#888;white-space:nowrap">Horário fim:</label>
          <select class="sel-hora-fim" data-id="${ag.id}" style="font-size:.8rem;padding:.3rem .5rem;border:1.5px solid rgba(0,0,0,.12);border-radius:4px;background:#faf7f4">
            <option value="">Selecione...</option>
            ${gerarOpcoesHora(ag.hora)}
            <option value="__DIA_TODO__">🔒 Dia todo</option>
          </select>
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.5rem">
          <button class="btn-aceitar" data-id="${ag.id}" data-nome="${ag.nome}" data-hora="${ag.hora}"><i class="fa-solid fa-check"></i> Aceitar</button>
          <button class="btn-rejeitar" data-id="${ag.id}" data-nome="${ag.nome}"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
        </div>
      </div>
    </div>` : `
    <div style="margin-top:.5rem">
      <button class="btn-cancelar" data-id="${ag.id}" data-nome="${ag.nome}" data-hora="${ag.hora}" title="Remover"><i class="fa-solid fa-trash"></i> Remover</button>
    </div>`;

  return `
    <div class="ag-card">
      <div class="ag-card__time"><span class="ag-hora">${ag.hora}</span></div>
      <div class="ag-card__info">
        <strong>${ag.nome}</strong>
        <span class="ag-servico">${ag.servico}</span>
        <span class="ag-contato"><i class="fa-brands fa-whatsapp"></i> ${ag.telefone}${ag.email?' · '+ag.email:''}</span>
        ${ag.mensagem?`<span class="ag-msg">"${ag.mensagem}"</span>`:''}
        ${statusHtml}
        ${acoes}
      </div>
      <div class="ag-card__actions">
        <a href="https://wa.me/55${ag.telefone.replace(/\D/g,'')}" target="_blank" class="btn-wa" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
      </div>
    </div>`;
}

function gerarOpcoesHora(horaInicio) {
  const [h]=horaInicio.split(':').map(Number);
  let opts='';
  for(let i=h+1;i<=22;i++) opts+=`<option value="${String(i).padStart(2,'0')}:00">${String(i).padStart(2,'0')}:00</option>`;
  return opts;
}

function bindCardActions(container, date) {
  // Aceitar
  container.querySelectorAll('.btn-aceitar').forEach(btn=>{
    btn.addEventListener('click', async()=>{
      const id=btn.dataset.id, nome=btn.dataset.nome, hora=btn.dataset.hora;
      const sel=container.querySelector(`.sel-hora-fim[data-id="${id}"]`);
      const val=sel?sel.value:'';
      if(!val){ alert('Selecione o horário de fim antes de aceitar.'); return; }
      const diaTodo = val==='__DIA_TODO__';
      const horaFim = diaTodo?null:val;
      confirm2(`Aceitar agendamento de ${nome} às ${hora}${horaFim?' até '+horaFim:''}${diaTodo?' (dia todo)':''}?`, async()=>{
        await atualizarStatusAgendamento(id,'aceito',horaFim,diaTodo);
        renderAdminCal(); loadDayDetail(date);
      });
    });
  });
  // Rejeitar
  container.querySelectorAll('.btn-rejeitar').forEach(btn=>{
    btn.addEventListener('click',()=>{
      confirm2(`Rejeitar agendamento de ${btn.dataset.nome}?`, async()=>{
        await atualizarStatusAgendamento(btn.dataset.id,'rejeitado');
        renderAdminCal(); loadDayDetail(date);
      });
    });
  });
  // Cancelar/Remover
  container.querySelectorAll('.btn-cancelar').forEach(btn=>{
    btn.addEventListener('click',()=>{
      confirm2(`Remover agendamento de ${btn.dataset.nome}?`, async()=>{
        await cancelarAgendamento(btn.dataset.id);
        renderAdminCal(); loadDayDetail(date);
      });
    });
  });
}

// ── ABA AGENDAMENTOS ──────────────────────────────────────────────
async function loadAgendamentos() {
  const list=document.getElementById('agendamentosList');
  list.innerHTML='<div class="loading-msg"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
  const todos=await getTodosAgendamentos();
  renderListaAg(todos);
}

function renderListaAg(lista) {
  const list=document.getElementById('agendamentosList');
  if(!lista.length){ list.innerHTML='<p class="empty-day">Nenhum agendamento encontrado.</p>'; return; }
  list.innerHTML=lista.map(ag=>{
    const[y,m,d]=ag.data.split('-');
    const sf={'pendente':'⏳','aceito':'✅','rejeitado':'❌'}[ag.status]||'⏳';
    return `
      <div class="ag-card">
        <div class="ag-card__time"><span class="ag-hora">${ag.hora}</span><span class="ag-data">${d}/${m}/${y}</span></div>
        <div class="ag-card__info">
          <strong>${ag.nome}</strong>
          <span class="ag-servico">${ag.servico}</span>
          <span class="ag-contato"><i class="fa-brands fa-whatsapp"></i> ${ag.telefone}</span>
          <span class="ag-status">${sf} ${ag.status}</span>
        </div>
        <div class="ag-card__actions">
          <a href="https://wa.me/55${ag.telefone.replace(/\D/g,'')}" target="_blank" class="btn-wa"><i class="fa-brands fa-whatsapp"></i></a>
          <button class="btn-cancelar" data-id="${ag.id}" data-nome="${ag.nome}" data-hora="${ag.hora}" data-data="${d}/${m}/${y}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
  list.querySelectorAll('.btn-cancelar').forEach(btn=>{
    btn.addEventListener('click',()=>{
      confirm2(`Remover agendamento de ${btn.dataset.nome} no dia ${btn.dataset.data}?`, async()=>{
        await cancelarAgendamento(btn.dataset.id); loadAgendamentos();
      });
    });
  });
}

document.getElementById('btnRefreshAgendamentos').addEventListener('click', loadAgendamentos);
document.getElementById('searchInput').addEventListener('input', async e=>{
  const q=e.target.value.toLowerCase();
  const todos=await getTodosAgendamentos();
  renderListaAg(todos.filter(ag=>
    ag.nome?.toLowerCase().includes(q)||ag.servico?.toLowerCase().includes(q)||ag.data?.includes(q)||ag.telefone?.includes(q)
  ));
});

// ── ABA BLOQUEIOS ─────────────────────────────────────────────────
async function loadBloqueios() {
  const list=document.getElementById('bloqueiosList');
  list.innerHTML='<div class="loading-msg"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
  const bloqueios=await getDiasBloqueados();
  if(!bloqueios.length){ list.innerHTML='<p class="empty-day">Nenhum dia bloqueado.</p>'; return; }
  bloqueios.sort((a,b)=>a.data.localeCompare(b.data));
  list.innerHTML=bloqueios.map(b=>{
    const[y,m,d]=b.data.split('-');
    return `
      <div class="bloq-card">
        <div class="bloq-card__info"><span class="bloq-data">${d}/${m}/${y}</span><span class="bloq-motivo">${b.motivo}</span></div>
        <button class="btn-danger-sm" data-data="${b.data}"><i class="fa-solid fa-circle-check"></i> Desbloquear</button>
      </div>`;
  }).join('');
  list.querySelectorAll('.btn-danger-sm').forEach(btn=>{
    btn.addEventListener('click',()=>{
      confirm2(`Desbloquear o dia ${btn.dataset.data}?`, async()=>{
        const[y,m,d]=btn.dataset.data.split('-');
        await desbloquearDia(new Date(+y,+m-1,+d));
        loadBloqueios(); renderAdminCal();
      });
    });
  });
}

document.getElementById('btnSalvarBloqueio').addEventListener('click', async()=>{
  const di=document.getElementById('bloqueioDataInicio').value;
  const df=document.getElementById('bloqueioDataFim').value;
  const motivo=document.getElementById('bloqueioMotivo').value.trim()||'Indisponível';
  if(!di){ alert('Selecione a data inicial.'); return; }
  const inicio=new Date(di+'T12:00:00'), fim=df?new Date(df+'T12:00:00'):inicio;
  const dias=[];
  for(let d=new Date(inicio);d<=fim;d.setDate(d.getDate()+1)) dias.push(new Date(d));
  confirm2(`Bloquear ${dias.length} dia(s) — "${motivo}"?`, async()=>{
    for(const d of dias) await bloquearDia(d,motivo);
    document.getElementById('bloqueioDataInicio').value='';
    document.getElementById('bloqueioDataFim').value='';
    document.getElementById('bloqueioMotivo').value='';
    loadBloqueios(); renderAdminCal();
  });
});

document.getElementById('adminCalPrev').addEventListener('click',()=>{ adminMonth--; if(adminMonth<0){adminMonth=11;adminYear--;} renderAdminCal(); });
document.getElementById('adminCalNext').addEventListener('click',()=>{ adminMonth++; if(adminMonth>11){adminMonth=0;adminYear++;} renderAdminCal(); });

// ── MODAL ─────────────────────────────────────────────────────────
let confirmCb=null;
function confirm2(msg,cb){ document.getElementById('modalText').textContent=msg; document.getElementById('modalOverlay').style.display='flex'; confirmCb=cb; }
document.getElementById('modalConfirm').addEventListener('click',async()=>{ document.getElementById('modalOverlay').style.display='none'; if(confirmCb){await confirmCb();confirmCb=null;} });
document.getElementById('modalCancel').addEventListener('click',()=>{ document.getElementById('modalOverlay').style.display='none'; confirmCb=null; });
