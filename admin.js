/* ═══════ FLARM Admin Dashboard (Supabase-powered) ═══════ */
'use strict';

/* 👤 ADMIN LOGIN — this email must exist as a user in Supabase:
   Dashboard → Authentication → Users → "Add user" (email + password).
   The login page asks only for the password; the email is fixed below. */

const STATUSES = ["Pending","Confirmed","Processing","Out for Delivery","Delivered","Cancelled"];
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2400); }

const DEFAULT_SETTINGS = {
  email:"flarmnaturalhealthcare@gmail.com",
  phone:"+234 810 123 4567",
  whatsapp:"2348101234567",
  location:"Shop 67 Adamashingba Sport Complex, opposite Recreation Club, Sabo Road, Ibadan",
  heroTitle:"Natural Wellness. Healthier Families. Stronger Communities.",
  heroSub:"We remain committed to delivering premium natural health products that support healthier families, stronger communities, and a better quality of life."
};

/* ─── In-memory mirror of Supabase data ─── */
let DB = { products: [], orders: [], settings: {...DEFAULT_SETTINGS}, activity: [], loaded:false };

/* ─── Settings column mapping (snake_case in DB ↔ camelCase here) ─── */
const mapSettingsFrom = r => ({ email:r.email, phone:r.phone, whatsapp:r.whatsapp, location:r.location, heroTitle:r.hero_title||'', heroSub:r.hero_sub||'' });
const mapSettingsTo   = s => ({ id:1, email:s.email, phone:s.phone, whatsapp:s.whatsapp, location:s.location, hero_title:s.heroTitle, hero_sub:s.heroSub });

/* ─── Load everything from Supabase ─── */
async function loadAll() {
  if (!SB_READY || !sb) {
    throw new Error('Supabase client is not ready.');
  }

  const [p, o, s, a] = await Promise.all([
    sb.from('products').select('*').order('id'),
    sb.from('orders').select('*').order('created_at', {
      ascending: false
    }),
    sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('activity').select('*')
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  // Report database errors instead of silently showing empty data.
  if (p.error) console.error('Products loading failed:', p.error);
  if (o.error) console.error('Orders loading failed:', o.error);
  if (s.error) console.error('Settings loading failed:', s.error);
  if (a.error) console.error('Activity loading failed:', a.error);

  DB.products = p.error ? [] : (p.data || []);
  DB.orders = o.error ? [] : (o.data || []).map(r => ({
    ...r,
    date: r.created_at
  }));

  if (!s.error && s.data) {
    DB.settings = {
      ...DEFAULT_SETTINGS,
      ...mapSettingsFrom(s.data)
    };
  }

  DB.activity = a.error ? [] : (a.data || []).map(r => ({
    time: r.created_at,
    action: r.action
  }));

  DB.loaded = true;

  console.log('FLARM data loaded:', {
    products: DB.products.length,
    orders: DB.orders.length,
    activity: DB.activity.length
  });
}

async function logAction(action){
  DB.activity.unshift({time:new Date().toISOString(), action});
  DB.activity = DB.activity.slice(0,50);
  if(SB_READY) await sb.from('activity').insert({action});
}

/* ─── Show Admin Dashboard ─── */

async function showApp() {
  const loginWrap = document.getElementById('loginWrap');
  const adminApp = document.getElementById('adminApp');

  if (!adminApp || !loginWrap) {
    throw new Error('Login or dashboard container is missing.');
  }

  loginWrap.hidden = true;
  adminApp.hidden = false;

  try {
    await loadAll();
    renderAll();

    console.log('FLARM dashboard loaded successfully.');
  } catch (err) {
    console.error('Dashboard loading failed:', err);
    toast('Dashboard data could not be loaded. Check the console.');
  }
}

/* ─── Auth ─── */
(async function init() {
  const errorBox = document.getElementById('errorBox');

  if (
    typeof SB_READY === 'undefined' ||
    !SB_READY ||
    typeof sb === 'undefined' ||
    sb === null
  ) {
    if (errorBox) {
      errorBox.textContent =
        'Supabase is not ready. Check supabase-config.js and the browser console.';
    }

    console.error('Supabase configuration or client is missing.');
    return;
  }

  try {
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await showApp();
    }
  } catch (err) {
    console.error('Session check failed:', err.message);

    if (errorBox) {
      errorBox.textContent =
        'Unable to check your login session. Please refresh and try again.';
    }
  }
})();

$('#loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const emailInput = $('#adminEmail');
  const passwordInput = $('#adminPass');
  const errorBox = $('#loginErr');
  const button = $('#loginForm button[type="submit"]');

  if (!emailInput || !passwordInput || !errorBox || !button) {
    console.error('A login form element is missing. Check admin.html.');
    return;
  }

  if (typeof SB_READY === 'undefined' || !SB_READY || !sb) {
    errorBox.textContent = 'Supabase is not ready. Check supabase-config.js.';
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorBox.textContent = '';
  button.disabled = true;
  button.textContent = 'Signing in...';

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase sign-in error:', error.message);
      errorBox.textContent = 'Sign-in failed. Check your email and password.';
      return;
    }

    if (!data.session) {
      errorBox.textContent = 'No session returned. Please try again.';
      return;
    }

    await showApp();
    toast('Welcome back, Admin');

  } catch (err) {
    console.error('Sign-in error:', err);
    errorBox.textContent = 'An error occurred. Check the browser console.';
  } finally {
    button.disabled = false;
    button.textContent = 'Sign In 🔐';
  }
});

/* ─── Tabs ─── */
$$('.side-link[data-tab]').forEach(b=>b.onclick=()=>{
  $$('.side-link[data-tab]').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  $$('.tab').forEach(t=>t.classList.remove('active'));
  $('#tab-'+b.dataset.tab).classList.add('active');
  renderAll();
});

/* ─── Render everything ─── */
function renderAll(){
  if(!DB.loaded) return;
  renderStats(); renderProducts(); renderOrders(); renderSettings(); renderActivity();
}

/* ═══════ DASHBOARD STATS ═══════ */
function renderStats(){
  const now = new Date(); const day = 24*3600*1000;
  const startWeek = new Date(now); startWeek.setDate(now.getDate()-now.getDay());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const o = DB.orders;
  $('#statToday').textContent  = o.filter(x=>new Date(x.date) > new Date(new Date().setHours(0,0,0,0))).length;
  $('#statWeek').textContent   = o.filter(x=>new Date(x.date) >= startWeek).length;
  $('#statMonth').textContent  = o.filter(x=>new Date(x.date) >= startMonth).length;
  $('#statTotal').textContent  = o.length;
  const max = Math.max(1, ...STATUSES.map(s=>o.filter(x=>x.status===s).length));
  $('#statusBars').innerHTML = STATUSES.map(s=>{
    const c = o.filter(x=>x.status===s).length;
    return `<div class="sbar"><span class="lbl">${s}</span><div class="bar"><div class="fill" style="width:${c/max*100}%"></div></div><span class="cnt">${c}</span></div>`;
  }).join('');
  const pending = o.filter(x=>x.status==='Pending').length;
  $('#pendingPill').hidden = !pending; $('#pendingPill').textContent = pending;
}
function renderActivity(){
  $('#activityLog').innerHTML = DB.activity.length
    ? DB.activity.slice(0,12).map(a=>`<div>🕒 ${esc(a.action)} <small>— ${new Date(a.time).toLocaleString()}</small></div>`).join('')
    : '<div>No activity yet.</div>';
}

/* ═══════ PRODUCTS CRUD ═══════ */
function renderProducts(){
  $('#productRows').innerHTML = DB.products.map(p=>`
    <tr>
      <td><img src="${esc(p.img)}" alt="" onerror="this.src='https://picsum.photos/seed/flarm-${p.id}/100/100'"></td>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(p.category)}</td>
      <td>${esc(p.form||'—')}</td>
      <td class="${p.available?'avail-yes':'avail-no'}">${p.available?'✔ Available':'✖ Sold Out'}</td>
      <td><div class="row-actions">
        <button class="btn small" data-edit="${p.id}">✏️ Edit</button>
        <button class="btn small ${p.available?'danger':''}" data-toggle="${p.id}">${p.available?'Mark Sold Out':'Mark Available'}</button>
        <button class="btn small danger" data-del="${p.id}">🗑 Delete</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem">No products yet — click "+ Add Product".</td></tr>';
  $('#catList').innerHTML = [...new Set(DB.products.map(p=>p.category))].map(c=>`<option value="${esc(c)}">`).join('');
}

$('#addProductBtn').onclick = ()=>{
  $('#productForm').reset(); $('#pId').value=''; $('#pAvailable').checked=true; $('#pImgPreview').hidden=true;
  $('#pModalTitle').textContent='Add Product'; $('#pModal').hidden=false;
};

document.addEventListener('click', async e=>{
  const ed=e.target.closest('[data-edit]'), tg=e.target.closest('[data-toggle]'), dl=e.target.closest('[data-del]'), cl=e.target.closest('[data-close]');
  if(ed){
    const p=DB.products.find(x=>x.id==ed.dataset.edit); if(!p) return;
    $('#pId').value=p.id; $('#pName').value=p.name; $('#pCategory').value=p.category;
    $('#pDesc').value=p.desc; $('#pForm').value=p.form||''; $('#pImgUrl').value=p.img.startsWith('data:')?'':p.img;
    $('#pAvailable').checked=!!p.available; $('#pImgFile').value='';
    const prev=$('#pImgPreview'); if(p.img){ prev.src=p.img; prev.hidden=false; } else prev.hidden=true;
    $('#pModalTitle').textContent='Edit Product'; $('#pModal').hidden=false;
  }
  if(tg){
    const p=DB.products.find(x=>x.id==tg.dataset.toggle); if(!p) return;
    const { error } = await sb.from('products').update({available:!p.available}).eq('id', p.id);
    if(error){ toast('⚠ Update failed — try again'); return; }
    logAction(`${p.name} marked ${!p.available?'available':'sold out'}`);
    await loadAll(); renderAll();
    toast('✔ Availability updated — store synced');
  }
  if(dl){
    const p=DB.products.find(x=>x.id==dl.dataset.del); if(!p) return;
    if(confirm(`Delete "${p.name}" permanently?`)){
      await sb.from('products').delete().eq('id', p.id);
      logAction(`Deleted product: ${p.name}`);
      await loadAll(); renderAll();
      toast('✔ Product deleted');
    }
  }
  if(cl){ $('#'+cl.dataset.close).hidden=true; }
});
$('#pModal').addEventListener('click', e=>{ if(e.target.id==='pModal') e.target.hidden=true; });

/* Image: URL or file upload → uploaded to Supabase Storage (base64 data-URLs don't belong in a DB) */
async function uploadImageIfNeeded(src){
  if(!src.startsWith('data:')) return src;                       /* already a link — keep it */
  const blob = await (await fetch(src)).blob();
  const ext  = (blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('product-images').upload(path, blob, {contentType: blob.type});
  if(error) throw error;
  return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

$('#pImgUrl').addEventListener('input', ()=>{ const v=$('#pImgUrl').value.trim(); const pv=$('#pImgPreview');
  if(v){ pv.src=v; pv.hidden=false; } else pv.hidden=true; });
$('#pImgFile').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ $('#pImgUrl').value=''; const pv=$('#pImgPreview'); pv.src=r.result; pv.hidden=false; };
  r.readAsDataURL(f);
});

$('#productForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = $('#pId').value;
  if($('#pImgPreview').hidden){ toast('Please provide a product image (link or upload)'); return; }
  const previewSrc = $('#pImgPreview').src;
  let img;
  try{
    img = await uploadImageIfNeeded(previewSrc);
  }catch(err){
    console.warn('Image upload failed:', err);
    toast('⚠ Image upload failed — try a smaller image or a link');
    return;
  }
  const data = {
    name: $('#pName').value.trim(), category: $('#pCategory').value.trim(),
    desc: $('#pDesc').value.trim(), form: $('#pForm').value.trim()||'Herbal Capsules',
    img, available: $('#pAvailable').checked
  };
  let error;
  if(id){ ({error} = await sb.from('products').update(data).eq('id', id)); }
  else  { ({error} = await sb.from('products').insert(data)); }
  if(error){ toast('⚠ Save failed — try again'); return; }
  logAction(`${id?'Edited':'Added'} product: ${data.name}`);
  await loadAll(); renderAll();
  $('#pModal').hidden=true;
  toast('✔ Product saved — live on the store now!');
});

/* ═══════ ORDERS ═══════ */
function renderOrders(){
  const q = $('#orderSearch').value.trim().toLowerCase();
  const sf = $('#orderStatusFilter').value;
  let list = DB.orders.filter(o =>
    (!sf || o.status===sf) &&
    (!q || o.code.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q))
  );
  $('#orderList').innerHTML = list.length ? list.map(o=>`
    <div class="order-card">
      <div class="order-top">
        <div>
          <span class="order-code">${esc(o.code)}</span>
          <select class="status-select status-${o.status.replace(/ /g,'')}" data-status="${esc(o.code)}">
            ${STATUSES.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <small class="muted">${new Date(o.date).toLocaleString()} • via ${esc(o.via||'Website')}</small>
        <button class="btn small danger" data-delorder="${esc(o.code)}">🗑</button>
      </div>
      <div class="order-items">${o.items.map(i=>`• ${esc(i.name)} × ${i.qty}`).join('<br>')}</div>
      <div class="order-customer">
        👤 <strong>${esc(o.customer.name)}</strong> &nbsp; 📞 ${esc(o.customer.phone)}<br>📍 ${esc(o.customer.address)}
      </div>
    </div>`).join('') : '<div class="no-orders">🧾 No orders found.</div>';
}
$('#orderSearch').addEventListener('input', renderOrders);
$('#orderStatusFilter').addEventListener('change', renderOrders);

document.addEventListener('change', async e=>{
  const s=e.target.closest('[data-status]');
  if(!s) return;
  const code = s.dataset.status;
  const { error } = await sb.from('orders').update({status:s.value}).eq('code', code);
  if(error){ toast('⚠ Status update failed'); return; }
  logAction(`Order ${code} → ${s.value}`);
  await loadAll(); renderStats(); renderActivity();
  s.className='status-select status-'+s.value.replace(/ /g,'');
  toast(`✔ Order ${code} is now "${s.value}" — customer sees it instantly`);
});

document.addEventListener('click', async e=>{
  const d=e.target.closest('[data-delorder]');
  if(d && confirm('Delete this order record?')){
    await sb.from('orders').delete().eq('code', d.dataset.delorder);
    await loadAll(); renderAll();
    toast('Order deleted');
  }
});

/* ═══════ SETTINGS & HOMEPAGE ═══════ */
function renderSettings(){
  $('#setEmail').value=DB.settings.email; $('#setPhone').value=DB.settings.phone;
  $('#setWhatsapp').value=DB.settings.whatsapp; $('#setLocation').value=DB.settings.location;
  $('#setHeroTitle').value=DB.settings.heroTitle; $('#setHeroSub').value=DB.settings.heroSub;
}
$('#settingsForm').addEventListener('submit', async e=>{
  e.preventDefault();
  Object.assign(DB.settings, { email:$('#setEmail').value.trim(), phone:$('#setPhone').value.trim(),
    whatsapp:$('#setWhatsapp').value.replace(/\D/g,''), location:$('#setLocation').value.trim() });
  const { error } = await sb.from('settings').upsert(mapSettingsTo(DB.settings));
  if(error){ $('#settingsStatus').textContent='⚠ Save failed — try again.'; return; }
  logAction('Updated contact settings');
  $('#settingsStatus').textContent='✔ Saved! Store contact info updated instantly.'; toast('✔ Settings saved');
});
$('#homeForm').addEventListener('submit', async e=>{
  e.preventDefault();
  Object.assign(DB.settings, { heroTitle:$('#setHeroTitle').value.trim(), heroSub:$('#setHeroSub').value.trim() });
  const { error } = await sb.from('settings').upsert(mapSettingsTo(DB.settings));
  if(error){ $('#homeStatus').textContent='⚠ Save failed — try again.'; return; }
  logAction('Updated homepage content');
  $('#homeStatus').textContent='✔ Saved! Homepage updated instantly.'; toast('✔ Homepage saved');
});

/* ─── Supabase Logout ─── */
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async function () {
    logoutBtn.disabled = true;

    try {
      if (
        typeof SB_READY === 'undefined' ||
        !SB_READY ||
        !sb
      ) {
        throw new Error('Supabase is not ready.');
      }

      const { error } = await sb.auth.signOut();

      if (error) throw error;

      // Hide the dashboard and show the login form
      document.getElementById('adminApp').hidden = true;
      document.getElementById('loginWrap').hidden = false;

      // Clear the password field
      const passwordInput =
        document.getElementById('adminPass');

      if (passwordInput) {
        passwordInput.value = '';
      }

      console.log('Admin logged out successfully.');

    } catch (err) {
      console.error('Logout failed:', err.message);

      alert('Logout failed. Please check the browser console.');
    } finally {
      logoutBtn.disabled = false;
    }
  });
}