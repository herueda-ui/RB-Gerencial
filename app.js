const cfg = window.RB_CLOUD || {};
let session = null;
let timer = null;

function money(v){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v||0))}
function el(id){return document.getElementById(id)}
function saveSession(s){session=s; localStorage.setItem('rb_cloud_session',JSON.stringify(s))}
function clearSession(){session=null;localStorage.removeItem('rb_cloud_session')}
function setLive(kind,text){el('status').textContent=text; el('liveDot').className='dot '+kind}

async function authPassword(email,password){
  const r=await fetch(cfg.supabaseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!r.ok) throw new Error('Correo o contraseña incorrectos.');
  return await r.json();
}
async function refreshSession(){
  if(!session?.refresh_token) throw new Error('Sesión vencida');
  const r=await fetch(cfg.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!r.ok) throw new Error('Sesión vencida');
  const d=await r.json(); saveSession(d); return d;
}
async function login(){
  el('loginStatus').textContent='Ingresando…';
  try{
    const d=await authPassword(el('email').value.trim(),el('password').value);
    saveSession(d); el('password').value=''; showDashboard(); await loadDashboard(true);
  }catch(e){el('loginStatus').innerHTML='<span class="error">'+e.message+'</span>'}
}
function logout(){clearInterval(timer);timer=null;clearSession();el('dashboardView').classList.add('hidden');el('loginView').classList.remove('hidden');el('loginStatus').textContent='Sesión cerrada.'}
function showDashboard(){el('loginView').classList.add('hidden');el('dashboardView').classList.remove('hidden'); if(timer)clearInterval(timer); timer=setInterval(()=>loadDashboard(false),(Number(cfg.refreshSeconds)||15)*1000)}
async function apiLatest(){
  if(!session?.access_token) throw new Error('Sesión no iniciada');
  let url=cfg.supabaseUrl+'/rest/v1/manager_snapshots?select=*&branch_code=eq.'+encodeURIComponent(cfg.branchCode||'RB-MANIZALES-01')+'&order=created_at.desc&limit=1';
  let r=await fetch(url,{headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token}});
  if(r.status===401){await refreshSession();r=await fetch(url,{headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token}})}
  if(!r.ok) throw new Error(await r.text());
  return await r.json();
}
function put(id,v){el(id).textContent=v}
function render(d){
  put('today',money(d.revenue_today)); put('month',money(d.revenue_month)); put('parkingToday',money(d.parking_revenue_today)); put('monthlyToday',money(d.monthly_revenue_today));
  put('avgTicket','Ticket promedio: '+money(d.avg_ticket_today));
  const u=Number(d.utilization_pct||0); put('utilization',u.toFixed(1)+'%'); el('utilBar').style.width=Math.max(0,Math.min(100,u))+'%';
  put('occupiedText',(d.occupied_now||0)+' vehículos dentro'); put('freeText',(d.free_now||0)+' puestos disponibles');
  put('cars',d.cars_inside||0);put('motos',d.motorcycles_inside||0);put('bikes',d.bicycles_inside||0);put('reserved',d.reserved_monthly_outside||0);put('entries',d.entries_today||0);put('exits',d.exits_today||0);
  put('cash',money(d.cash_today));put('transfer',money(d.transfer_today));put('card',money(d.card_today));put('other',money(d.other_today));put('openShifts',d.open_shift_count||0);
  put('monthlyActive',d.monthly_active||0);put('monthlyAssigned',d.monthly_assigned||0);put('monthlyExpiring',d.monthly_expiring||0);put('monthlyOverdue',d.monthly_overdue||0);
  const t=new Date(d.created_at);put('updated',t.toLocaleString('es-CO'));
  const age=Math.max(0,Math.round((Date.now()-t.getTime())/1000));
  put('freshness',age<90?'Datos en tiempo real · '+age+' s desde la última sincronización':'Último dato recibido hace '+Math.round(age/60)+' min');
  setLive(age<90?'ok':age<300?'warn':'bad',age<90?'EN LÍNEA':'DATOS RETRASADOS');
}
async function loadDashboard(manual){
  try{
    if(manual)setLive('warn','Actualizando…');
    const rows=await apiLatest(); if(!rows.length)throw new Error('Aún no hay snapshots de RB Parqueadero.'); render(rows[0]);
  }catch(e){
    if(String(e.message).includes('JWT')||String(e.message).includes('Sesión')){logout();el('loginStatus').innerHTML='<span class="error">Vuelva a iniciar sesión.</span>';return}
    setLive('bad','SIN CONEXIÓN'); el('freshness').innerHTML='<span class="error">'+e.message+'</span>';
  }
}
(function init(){
  try{session=JSON.parse(localStorage.getItem('rb_cloud_session')||'null')}catch(_){session=null}
  if(session?.access_token){showDashboard();loadDashboard(true)}
})();
