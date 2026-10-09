/* ═══════════ FLARM GLOBAL — Storefront App (Supabase-powered) ═══════════ */
'use strict';

/* ─── Default product data (used to seed Supabase on the very first run) ─── */
const DEFAULT_PRODUCTS = [
  { name: "Infectoherb",         category: "Immune Support",      form: "Herbal Capsules", desc: "Supports the body's natural defence system and helps with infections, UTI & more.", img: "images/infectoherb.jpg",        available: true },
  { name: "Pure Cleans Detox",   category: "Detox & Digestion",   form: "Herbal Capsules", desc: "Supports natural detoxification, promotes bowel regularity and improves digestion.", img: "images/pure-cleans-detox.jpg",  available: true },
  { name: "Lumboflex",           category: "Pain & Joints",       form: "Herbal Tea",      desc: "Relieves body pain & arthritis, helps with joint mobility and reduces inflammation.", img: "images/lumboflex.jpg",          available: true },
  { name: "Digestive Comfort",   category: "Detox & Digestion",   form: "Herbal Capsules", desc: "Supports healing of stomach ulcers, relieves acid reflux (GERD) and improves digestion.", img: "images/digestive-comfort.jpg",  available: true },
  { name: "Hepacare",            category: "Liver Care",          form: "Herbal Capsules", desc: "Supports healthy liver function, reduces liver stress and improves digestion.", img: "images/hepacare.jpg",           available: true },
  { name: "Fever Relief",        category: "Fever & Cold",        form: "Herbal Capsules", desc: "Helps with malaria, reduces fever, cold & flu symptoms and supports recovery.", img: "images/fever-relief.jpg",       available: true },
  { name: "Pressure Care",       category: "Heart & Circulation", form: "Herbal Capsules", desc: "Supports healthy blood pressure, heart health and circulation.", img: "images/pressure-care.jpg",      available: true },
  { name: "Sugar Balance",       category: "Blood Sugar",         form: "Herbal Capsules", desc: "Helps maintain healthy blood sugar levels and improves insulin sensitivity.", img: "images/sugar-balance.jpg",      available: true },
  { name: "Deking",              category: "Men's Health",        form: "Herbal Capsules", desc: "Supports male vitality & performance, boosts energy and stamina.", img: "images/deking.jpg",             available: true },
  { name: "Pain Go",             category: "Pain & Joints",       form: "Herbal Capsules", desc: "Relieves pain and inflammation, soothes muscles and joints.", img: "images/pain-go.jpg",            available: true }
];
const DEFAULT_SETTINGS = {
  email:"flarmnaturalhealthcare@gmail.com",
  phone:"+234 810 123 4567",
  whatsapp:"2348101234567",
  location:"Shop 67 Adamashingba Sport Complex, opposite Recreation Club, Sabo Road, Ibadan",
  heroTitle:"Natural Wellness. Healthier Families. Stronger Communities.",
  heroSub:"We remain committed to delivering premium natural health products that support healthier families, stronger communities, and a better quality of life."
};

const ORDER_STEPS = ["Pending","Confirmed","Processing","Out for Delivery","Delivered"];

/* ─── In-memory mirror of the Supabase data ─── */
let DB = { products: [], settings: {...DEFAULT_SETTINGS} };

/* ─── Device-local cart & wishlist (stay per-device in localStorage) ─── */
let cart   = JSON.parse(localStorage.getItem('flarm_cart')||'[]');
let wishes = JSON.parse(localStorage.getItem('flarm_wish')||'[]');
const saveCart   = ()=>localStorage.setItem('flarm_cart', JSON.stringify(cart));
const saveWishes = ()=>localStorage.setItem('flarm_wish', JSON.stringify(wishes));

/* ─── Helpers ─── */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2600); }
const getProduct = id => DB.products.find(p=>p.id==id);

/* ─── Settings column mapping (snake_case in DB ↔ camelCode here) ─── */
const mapSettingsFrom = r => ({ email:r.email, phone:r.phone, whatsapp:r.whatsapp, location:r.location, heroTitle:r.hero_title||'', heroSub:r.hero_sub||'' });

/* ─── Load products + settings from Supabase (localStorage cache = offline fallback) ─── */
async function loadFromSupabase(){
  if(!SB_READY){
    console.warn('Supabase not configured — edit supabase-config.js');
  } else {
    try{
      const [{data:products, error:e1},{data:settingsRow, error:e2}] = await Promise.all([
        sb.from('products').select('*').order('id'),
        sb.from('settings').select('*').eq('id',1).single()
      ]);
      if(e1) throw e1;
      DB.products = products || [];
      if(settingsRow && !e2) DB.settings = {...DEFAULT_SETTINGS, ...mapSettingsFrom(settingsRow)};
      localStorage.setItem('flarm_db', JSON.stringify({products:DB.products, settings:DB.settings}));
    }catch(err){
      console.warn('Supabase unreachable, using cached data:', err);
      try{
        const cached = JSON.parse(localStorage.getItem('flarm_db')||'null');
        if(cached){ DB.products = cached.products||[]; DB.settings = {...DEFAULT_SETTINGS, ...(cached.settings||{})}; }
      }catch(e){}
    }
    /* Seed default products on the very first run (only ever happens once) */
    if(SB_READY && !DB.products.length && !localStorage.getItem('flarm_seeded')){
      try{
        localStorage.setItem('flarm_seeded','1');
        await sb.from('products').insert(DEFAULT_PRODUCTS);
        await loadFromSupabase();
      }catch(e){ console.warn('Seeding failed:', e); }
    }
  }
}

/* ═══════════ RENDERING ═══════════ */
function renderAll(){ applySettings(); renderProducts(); renderWishlist(); renderCart(); renderFooterProducts(); }

function applySettings(){
  const s = DB.settings;
  $('#contactPhone').textContent    = s.phone;
  $('#contactEmail').textContent    = s.email;
  $('#contactLocation').textContent = s.location;
  const wa = `https://wa.me/${String(s.whatsapp).replace(/\D/g,'')}`;
  $('#whatsappBtn').href = wa; $('#floatWhatsapp').href = wa;
  $('#contactWhatsapp').innerHTML = `<a href="${wa}" target="_blank" style="color:var(--green-700);font-weight:700">Chat now →</a>`;
  $('#heroTitle').textContent = s.heroTitle;
  $('#heroSub').textContent   = s.heroSub;
}

function productCard(p){
  const wished = wishes.includes(p.id);
  return `
  <article class="p-card" data-id="${p.id}">
    <div class="p-img-wrap">
      <button class="wish-btn ${wished?'active':''}" data-wish="${p.id}" aria-label="Save to favorites">${wished?'❤️':'🤍'}</button>
      <img class="p-img" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/flarm-${p.id}/600/600'">
      <span class="avail-badge ${p.available?'in':'out'}">${p.available?'✔ AVAILABLE':'✖ SOLD OUT'}</span>
    </div>
    <div class="p-body">
      <span class="p-cat">${esc(p.category)}</span>
      <h3 class="p-name">${esc(p.name)}</h3>
      <p class="p-desc">${esc(p.desc)}</p>
      <div class="p-actions">
        <button class="btn btn-outline btn-sm" data-view="${p.id}">View Details</button>
        <button class="btn btn-primary btn-sm" data-add="${p.id}" ${p.available?'':'disabled'}>Order Now</button>
      </div>
    </div>
  </article>`;
}

function renderProducts(){
  const q   = $('#searchInput').value.trim().toLowerCase();
  const cat = $('#categoryFilter').value;
  const av  = $('#availFilter').value;
  let list = DB.products.filter(p =>
    (!q || p.name.toLowerCase().includes(q)) &&
    (!cat || p.category===cat) &&
    (!av || (av==='available')===!!p.available)
  );
  $('#productGrid').innerHTML = list.map(productCard).join('');
  $('#noResults').hidden = list.length>0;
  const cats=[...new Set(DB.products.map(p=>p.category))];
  const cur=$('#categoryFilter').value;
  $('#categoryFilter').innerHTML = '<option value="">All Categories</option>'+cats.map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join('');
}

function renderWishlist(){
  const list = DB.products.filter(p=>wishes.includes(p.id));
  $('#wishlistGrid').innerHTML = list.map(productCard).join('');
  $('#wishlistEmpty').hidden = list.length>0;
  $$('.wish-btn').forEach(b=>{
    b.textContent = wishes.includes(+b.dataset.wish)?'❤️':'🤍';
    b.classList.toggle('active', wishes.includes(+b.dataset.wish));
  });
}

function renderFooterProducts(){
  $('#footerProducts').innerHTML = DB.products.slice(0,6)
    .map(p=>`<a href="#products" data-view="${p.id}">${esc(p.name)}</a>`).join('');
}

/* ═══════════ PRODUCT DETAIL ═══════════ */
function openProduct(id){
  const p = getProduct(id); if(!p) return;
  const related = DB.products.filter(x=>x.id!=p.id && x.category===p.category).concat(DB.products.filter(x=>x.id!=p.id && x.category!==p.category)).slice(0,4);
  $('#productModalBody').innerHTML = `
    <div class="pd-grid">
      <div class="pd-img"><img src="${esc(p.img)}" alt="${esc(p.name)}" onerror="this.src='https://picsum.photos/seed/flarm-${p.id}/600/600'"></div>
      <div>
        <span class="p-cat">${esc(p.category)}</span>
        <h2>${esc(p.name)}</h2>
        <p class="pd-meta">${esc(p.desc)}</p>
        <p class="pd-meta"><strong>Form:</strong> ${esc(p.form||'Herbal Capsules')} &nbsp;•&nbsp;
        <strong>Availability:</strong> ${p.available?'<span style="color:var(--green-600);font-weight:700">✔ In Stock</span>':'<span style="color:#b02a2a;font-weight:700">✖ Sold Out</span>'}</p>
        <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1rem">
          <button class="btn btn-primary" data-add="${p.id}" ${p.available?'':'disabled'}>🛒 Add to Cart</button>
          <button class="btn btn-gold" data-order-direct="${p.id}" ${p.available?'':'disabled'}>Order Now</button>
          <button class="wish-btn ${wishes.includes(p.id)?'active':''}" data-wish="${p.id}" style="position:static;box-shadow:var(--shadow)">${wishes.includes(p.id)?'❤️':'🤍'}</button>
        </div>
        <div class="disclaimer">⚠️ <strong>Health Disclaimer:</strong> ${esc(p.name)} is a natural wellness product. It is not intended to diagnose, treat, cure or prevent any disease and is not a substitute for professional medical advice. Always consult a qualified healthcare provider.</div>
      </div>
    </div>
    <h3 class="related-title">You may also like</h3>
    <div class="related-row">
      ${related.map(r=>`<div class="related-card" data-view="${r.id}">
        <img src="${esc(r.img)}" alt="${esc(r.name)}" onerror="this.src='https://picsum.photos/seed/flarm-${r.id}/600/600'"><p>${esc(r.name)}</p></div>`).join('')}
    </div>`;
  openModal('productModal');
}

/* ═══════════ CART ═══════════ */
function addToCart(id, qty=1){
  const p=getProduct(id); if(!p) return;
  if(!p.available){ toast('Sorry, this product is sold out'); return; }
  const item = cart.find(i=>i.id==id);
  item ? item.qty+=qty : cart.push({id:+id, qty});
  saveCart(); renderCart(); toast(`✔ ${p.name} added to cart`);
  openCart();
}
function renderCart(){
  const count = cart.reduce((a,i)=>a+i.qty,0);
  $('#cartCount').textContent = count;
  $('#cartCountDrawer').textContent = count;
  $('#cartTotalItems').textContent = count;
  const box = $('#cartItems');
  if(!cart.length){ box.innerHTML = '<div class="cart-empty">🛒<br>Your cart is empty.<br>Explore our natural products!</div>'; return; }
  box.innerHTML = cart.map(i=>{ const p=getProduct(i.id); if(!p) return '';
    return `<div class="cart-item">
      <img src="${esc(p.img)}" alt="${esc(p.name)}">
      <div class="cart-item-info"><h4>${esc(p.name)}</h4><small class="muted">${esc(p.form||'')}</small></div>
      <div class="qty-ctrl">
        <button data-dec="${i.id}" aria-label="Decrease">−</button><strong>${i.qty}</strong><button data-inc="${i.id}" aria-label="Increase">+</button>
      </div>
      <button class="remove-btn" data-remove="${i.id}" aria-label="Remove">🗑</button>
    </div>`;}).join('');
}
const openCart  = ()=>{ $('#cartDrawer').classList.add('open'); $('#overlay').classList.add('show'); };
const closeCart = ()=>{ $('#cartDrawer').classList.remove('open'); $('#overlay').classList.remove('show'); };

/* ═══════════ MODALS ═══════════ */
function openModal(id){ $('#'+id).hidden=false; document.body.style.overflow='hidden'; }
function closeModal(id){ $('#'+id).hidden=true; document.body.style.overflow=''; }

/* ═══════════ CHECKOUT & ORDERS ═══════════ */
function orderSummaryHTML(){
  return '<strong>Order Summary</strong>' + cart.map(i=>{const p=getProduct(i.id);
    return `<div class="row"><span>${esc(p?.name||'Item')} × ${i.qty}</span><span>${esc(p?.form||'')}</span></div>`;}).join('')
    + `<div class="row" style="border-top:1px solid #ddd;padding-top:.4rem;margin-top:.3rem"><strong>Total items</strong><strong>${cart.reduce((a,i)=>a+i.qty,0)}</strong></div>`;
}
function openCheckout(){
  if(!cart.length){ toast('Your cart is empty'); return; }
  $('#orderSummary').innerHTML = orderSummaryHTML();
  closeCart(); openModal('checkoutModal');
}
function makeOrderCode(){
  return 'FLARM-' + Math.floor(1000 + Math.random()*9000);
}
async function placeOrder(viaWhatsApp){
  const name=$('#coName').value.trim();
  const phone=$('#coPhone').value.trim();
  const addr=$('#coAddress').value.trim();

  if(!name||!phone||!addr){
    toast('Please fill in all delivery details');
    return;
  }
  if(!SB_READY){ toast('Ordering unavailable right now — please use WhatsApp'); return; }

  /* Remember phone for automatic order tracking */
  sessionStorage.setItem('flarm_last_order_phone', phone);

  const order = {
    code: makeOrderCode(),
    customer:{name, phone, address:addr},
    items: cart.map(i=>({
      id:i.id,
      name:getProduct(i.id)?.name||'Item',
      qty:i.qty
    })),
    status:'Pending',
    via:viaWhatsApp?'WhatsApp':'Website'
  };

  try{
    const { error } = await sb.from('orders').insert(order);
    if(error && error.code==='23505'){          /* extremely rare code collision — retry once */
      order.code = makeOrderCode();
      const retry = await sb.from('orders').insert(order);
      if(retry.error) throw retry.error;
    } else if(error){ throw error; }
  }catch(err){
    console.warn('Order insert failed:', err);
    toast('⚠ Could not place order — please try again or order via WhatsApp');
    return;
  }

  /* Log the event for the admin dashboard (fire-and-forget) */
  sb.from('activity').insert({action:`New order ${order.code} — ${name}`}).then(()=>{});

  if(viaWhatsApp){
    const msg = `Hello FLARM GLOBAL! I would like to place an order.%0A%0A🧾 Order: ${order.code}%0A👤 Name: ${encodeURIComponent(name)}%0A📞 Phone: ${encodeURIComponent(phone)}%0A📍 Address: ${encodeURIComponent(addr)}%0A%0AItems:%0A` +
      cart.map(i=>`• ${encodeURIComponent(getProduct(i.id)?.name||'Item')} x ${i.qty}`).join('%0A');
    window.open(`https://wa.me/${String(DB.settings.whatsapp).replace(/\D/g,'')}?text=${msg}`,'_blank');
  }
  cart=[]; saveCart(); renderCart();
  closeModal('checkoutModal');
  $('#orderCodeText').textContent = order.code;
  openModal('confirmModal');
}

/* ═══════════ ORDER TRACKING ═══════════ */
const STEP_INDEX = s => ORDER_STEPS.indexOf(s);
async function trackOrder(){
  const code=$('#trackCode').value.trim().toUpperCase(), phone=$('#trackPhone').value.trim();
  const box=$('#trackResult'); box.innerHTML='';
  if(!code||!phone){ box.innerHTML='<p class="muted">Please enter both your order number and phone number.</p>'; return; }
  if(!SB_READY){ box.innerHTML='<div class="track-card"><p>😕 Tracking is unavailable right now. Please contact us on WhatsApp.</p></div>'; return; }
  box.innerHTML = '<p class="muted">Checking your order…</p>';
  let o = null;
  try{
    const { data, error } = await sb.rpc('track_order', { p_code: code, p_phone: phone });
    if(error) throw error;
    if(data && data[0]) o = {...data[0], date: data[0].created_at};
  }catch(err){
    console.warn('Tracking failed:', err);
  }
  if(!o){ box.innerHTML='<div class="track-card"><p>😕 No order found with that number and phone. Please check and try again, or contact us on WhatsApp.</p></div>'; return; }
  const cancelled = o.status==='Cancelled';
  const idx = cancelled ? -1 : STEP_INDEX(o.status);
  box.innerHTML = `
    <div class="track-card">
      <h3>Order ${esc(o.code)} ${cancelled?'<span style="color:#b02a2a">— Cancelled</span>':''}</h3>
      <p class="muted" style="font-size:.88rem">Placed ${new Date(o.date).toLocaleString()} • ${esc(o.customer.name)} • ${o.items.reduce((a,i)=>a+i.qty,0)} item(s)</p>
      ${cancelled?'<p style="margin-top:1rem">This order was cancelled. Contact us on WhatsApp if you believe this is a mistake.</p>':`
      <ol class="timeline">
        ${ORDER_STEPS.map((s,i)=>`
          <li class="tl-step ${i<idx?'done':''} ${i===idx?'done now':''}">
            <span class="tl-dot">${i<idx||i===idx?'✔':i+1}</span>
            <div><h4>${s}</h4><p>${i<idx?'Completed':i===idx?'Current status':'Pending'}</p></div>
          </li>`).join('')}
      </ol>`}
    </div>`;
}

/* ═══════════ HASH ROUTING (SPA views) ═══════════ */
function route(){
  const h = location.hash || '#home';
  const track = h==='#track', wish = h==='#wishlist';
  $('#trackView').hidden = !track;
  $('#wishlistView').hidden = !wish;
  document.querySelectorAll('.hero,.products-section,.why-section,.about-section,.contact-section').forEach(el=>{
    el.style.display = (track||wish) ? 'none' : '';
  });
  $$('.nav-link').forEach(a=>a.classList.toggle('active', h===a.getAttribute('href')));
  if(track||wish){ window.scrollTo({top:0}); }
  else { const target=document.querySelector(h); if(target) target.scrollIntoView({behavior:'smooth'}); }
  if(track) trackOrder();
  $('#mobileMenu').classList.remove('open'); $('#hamburger').classList.remove('open');
}

/* ═══════════ EVENTS ═══════════ */
document.addEventListener('click', e=>{
  const t = e.target.closest('[data-add],[data-order-direct],[data-view],[data-wish],[data-inc],[data-dec],[data-remove],[data-close]');
  if(!t) return;
  if(t.dataset.add)          addToCart(+t.dataset.add);
  if(t.dataset.orderDirect){ addToCart(+t.dataset.orderDirect,1); closeModal('productModal'); openCheckout(); }
  if(t.dataset.view){ closeModal('productModal'); openProduct(+t.dataset.view); }
  if(t.dataset.wish){
    const id=+t.dataset.wish;
    wishes = wishes.includes(id) ? wishes.filter(x=>x!==id) : [...wishes,id];
    saveWishes(); renderWishlist(); renderProducts();
    toast(wishes.includes(id)?'❤️ Saved to favorites':'Removed from favorites');
  }
  if(t.dataset.inc){ cart.find(i=>i.id==t.dataset.inc).qty++; saveCart(); renderCart(); }
  if(t.dataset.dec){ const it=cart.find(i=>i.id==t.dataset.dec); it.qty>1?it.qty--:cart=cart.filter(i=>i.id!=it.id); saveCart(); renderCart(); }
  if(t.dataset.remove){ cart=cart.filter(i=>i.id!=t.dataset.remove); saveCart(); renderCart(); }
  if(t.dataset.close){ closeModal(t.dataset.close); }
});

$('#cartToggle').onclick  = openCart;
$('#cartClose').onclick   = closeCart;
$('#overlay').onclick     = closeCart;
$('#checkoutBtn').onclick = openCheckout;
$('#checkoutForm').addEventListener('submit', e=>{ e.preventDefault(); placeOrder(false); });
$('#checkoutWhatsApp').onclick = ()=>placeOrder(true);
$('#cartWhatsApp').onclick = ()=>{
  if(!cart.length){ toast('Your cart is empty'); return; }
  const msg = 'Hello FLARM GLOBAL! I would like to order:%0A' +
    cart.map(i=>`• ${encodeURIComponent(getProduct(i.id)?.name||'Item')} x ${i.qty}`).join('%0A');
  window.open(`https://wa.me/${String(DB.settings.whatsapp).replace(/\D/g,'')}?text=${msg}`,'_blank');
};

/* Search & filters */
$('#searchInput').addEventListener('input', renderProducts);
$('#categoryFilter').addEventListener('change', renderProducts);
$('#availFilter').addEventListener('change', renderProducts);
const clearAll = ()=>{ $('#searchInput').value=''; $('#categoryFilter').value=''; $('#availFilter').value=''; renderProducts(); };
$('#clearFilters').onclick = clearAll;
$('#clearFilters2').onclick = clearAll;
$('#searchToggle').onclick = ()=>{ location.hash='#products'; setTimeout(()=>$('#searchInput').focus(),400); };

/* Track */
$('#trackBtn').onclick = trackOrder;

$('#confirmTrackBtn').addEventListener('click', e=>{
  e.preventDefault();
  const code = $('#orderCodeText').textContent.trim();
  const phone = sessionStorage.getItem('flarm_last_order_phone') || '';
  closeModal('confirmModal');
  $('#trackCode').value = code;
  $('#trackPhone').value = phone;
  location.hash = '#track';
  setTimeout(()=>{ trackOrder(); },100);
});

/* Mobile menu */
$('#hamburger').onclick = ()=>{ $('#mobileMenu').classList.toggle('open'); $('#hamburger').classList.toggle('open'); };
$$('.mobile-link').forEach(a=>a.addEventListener('click',()=>{ $('#mobileMenu').classList.remove('open'); $('#hamburger').classList.remove('open'); }));

/* Contact form → saves to Supabase AND opens WhatsApp with the message */
$('#contactForm').addEventListener('submit', e=>{
  e.preventDefault();
  if(SB_READY){
    sb.from('messages').insert({
      name: $('#cfName').value, phone: $('#cfPhone').value,
      email: $('#cfEmail').value, body: $('#cfMsg').value
    }).then(()=>{});
  }
  const msg = `Hello FLARM GLOBAL!%0A%0A👤 Name: ${encodeURIComponent($('#cfName').value)}%0A📞 Phone: ${encodeURIComponent($('#cfPhone').value)}%0A✉️ Email: ${encodeURIComponent($('#cfEmail').value||'-')}%0A%0A💬 Message: ${encodeURIComponent($('#cfMsg').value)}`;
  window.open(`https://wa.me/${String(DB.settings.whatsapp).replace(/\D/g,'')}?text=${msg}`,'_blank');
  $('#contactStatus').textContent = '✔ Opening WhatsApp — we will reply shortly!';
  e.target.reset();
});

/* Newsletter → saved in Supabase */
$('#newsletterForm').addEventListener('submit', e=>{
  e.preventDefault();
  if(SB_READY){
    sb.from('newsletter_subscribers').insert({email: $('#nlEmail').value.trim()}).then(()=>{});
  }
  $('#nlStatus').textContent='✔ Subscribed! Welcome to the FLARM family.';
  e.target.reset();
});

/* Header shadow + scroll spy + reveal animations */
window.addEventListener('scroll', ()=>{
  $('#header').classList.toggle('scrolled', scrollY>10);
  const spy = ['home','products','health','about','contact'].findLast(id=>{
    const el=document.getElementById(id); return el && el.getBoundingClientRect().top < innerHeight*0.4;
  });
  if(spy) $$('.nav-link').forEach(a=>a.classList.toggle('active', a.dataset.nav===spy));
});
const io = new IntersectionObserver(es=>es.forEach(x=>x.isIntersecting&&x.target.classList.add('visible')),{threshold:.12});
$$('.reveal').forEach(el=>io.observe(el));

/* ═══════════ INIT + LIVE SYNC ═══════════ */
window.addEventListener('hashchange', route);

(async function init(){
  await loadFromSupabase();
  renderAll();
  route();

  /* Live sync: when the admin changes products or settings, update instantly */
  if(SB_READY){
    sb.channel('storefront-sync')
      .on('postgres_changes', {event:'*', schema:'public', table:'products'}, payload=>{
        if(payload.eventType==='DELETE')      DB.products = DB.products.filter(p=>p.id!==payload.old.id);
        else if(payload.eventType==='INSERT') DB.products = [...DB.products, payload.new];
        else                                  DB.products = DB.products.map(p=>p.id===payload.new.id?payload.new:p);
        renderAll();
        toast('✔ Store updated by admin');
      })
      .on('postgres_changes', {event:'UPDATE', schema:'public', table:'settings'}, payload=>{
        DB.settings = {...DEFAULT_SETTINGS, ...mapSettingsFrom(payload.new)};
        applySettings();
        toast('✔ Store settings updated');
      })
      .subscribe();
  }
})();