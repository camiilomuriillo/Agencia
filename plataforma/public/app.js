const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  cfg: null, user: null, catalog: null, tab: 'image', presets: new Set(), image: null,
  jobs: [], filter: 'all', pollTimer: null, registerMode: false, viewing: null,
};

const IDEAS = [
  'Una taza de café humeante sobre una mesa de madera al amanecer',
  'Zapatilla deportiva flotando sobre agua, salpicaduras congeladas',
  'Retrato de una chef sonriendo en una cocina profesional',
  'Coche clásico rojo en una carretera de montaña al atardecer',
];

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { status: res.status });
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

const money = (cents) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: (state.cfg?.currency ?? 'eur').toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const mediaType = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(url ?? '') ? 'video' : /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url ?? '') ? 'audio' : 'image';

// Cerrar diálogos con su botón × o clic fuera
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});

// ---------- Marca y precios ----------
function applyBrand() {
  document.title = `${state.cfg.brand} · Imágenes, videos y voces con IA`;
  $$('[data-brand]').forEach((el) => { el.textContent = state.cfg.brand; });
  $$('[data-tagline]').forEach((el) => { el.textContent = state.cfg.tagline; });
  $$('[data-free]').forEach((el) => { el.textContent = state.cfg.freeCredits; });
  $('#year').textContent = new Date().getFullYear();
}

function packsHtml(action) {
  return state.cfg.packs.map((p) => `
    <div class="pack ${p.popular ? 'popular' : ''}">
      ${p.popular ? '<span class="ribbon">Más popular</span>' : ''}
      <span class="pname">${esc(p.name)}</span>
      <span class="price">${money(p.price)}</span>
      <span class="credits-n">⚡ ${p.credits} créditos</span>
      <ul>${p.perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn ${p.popular ? 'primary' : ''} wide" data-${action}="${p.id}">${action === 'buy' ? 'Comprar' : 'Empezar'}</button>
    </div>`).join('');
}

// ---------- Acceso ----------
function openAuth(register) {
  state.registerMode = register;
  $('#auth-submit').textContent = register ? 'Crear cuenta gratis' : 'Entrar';
  $('#auth-sub').textContent = register ? `Te regalamos ${state.cfg.freeCredits} créditos para empezar` : 'Entra para seguir creando';
  $('#auth-toggle').textContent = register ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Regístrate';
  $('#auth-form [name=password]').autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-error').textContent = '';
  if (!$('#auth-dialog').open) $('#auth-dialog').showModal();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-auth], [data-start]');
  if (a) openAuth(a.dataset.auth !== 'login');
});
$('#auth-toggle').onclick = () => openAuth(!state.registerMode);

$('#auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  $('#auth-submit').disabled = true;
  try {
    await api(state.registerMode ? '/api/register' : '/api/login', { body: f });
    $('#auth-dialog').close();
    e.target.reset();
    await enterApp();
    if (state.registerMode) toast(`¡Bienvenido! Tienes ⚡${state.user.credits} créditos para empezar`);
  } catch (err) {
    $('#auth-error').textContent = err.message;
  } finally {
    $('#auth-submit').disabled = false;
  }
};

function showLanding() {
  clearInterval(state.pollTimer);
  $('#landing').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#landing-packs').innerHTML = packsHtml('start');
}

// ---------- Formulario ----------
const currentModel = () => state.catalog.models.find((m) => m.id === $('#model').value);

function renderTabs() {
  $('#tabs').innerHTML = state.catalog.tabs.map((t) =>
    `<button type="button" class="tab ${t.id === state.tab ? 'active' : ''}" data-tab="${t.id}">${t.emoji} ${esc(t.name)}</button>`).join('');
}

$('#tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) selectTab(t.dataset.tab);
});

function selectTab(tab, modelId) {
  state.tab = tab;
  state.presets.clear();
  renderTabs();
  $('#model').innerHTML = state.catalog.models.filter((m) => m.tab === tab)
    .map((m) => `<option value="${m.id}">${esc(m.name)} · ⚡${m.cost}${m.perChars ? ` / ${m.perChars} car.` : ''}</option>`).join('');
  if (modelId) $('#model').value = modelId;
  onModelChange();
}

function onModelChange() {
  const m = currentModel();
  $('#model-tagline').textContent = m.tagline;
  $('#aspect-field').classList.toggle('hidden', !m.aspects);
  $('#aspect').innerHTML = (m.aspects ?? []).map((a) => `<option>${a}</option>`).join('');
  $('#duration-field').classList.toggle('hidden', !m.durations);
  $('#duration').innerHTML = (m.durations ?? []).map((d) => `<option value="${d}">${d} s</option>`).join('');
  $('#voice-field').classList.toggle('hidden', !m.voices);
  $('#voice').innerHTML = (m.voices ?? []).map((v) => `<option value="${v.id}">${esc(v.label)}</option>`).join('');
  $('#image-field').classList.toggle('hidden', !m.needsImage);
  $('#image-label').textContent = m.imageLabel ?? 'Imagen de partida';
  $('#prompt-field').classList.toggle('hidden', !!m.noPrompt);
  $('#prompt-label').textContent = m.promptLabel ?? 'Prompt';
  $('#prompt').placeholder = m.kind === 'audio'
    ? (m.voices ? 'Hola, bienvenidos a nuestra tienda. Hoy tenemos un 20% de descuento…' : 'Cinematic whoosh transition, deep bass impact')
    : m.tab === 'tools' ? 'Cambia el fondo por una playa al atardecer'
      : 'Describe lo que quieres ver… p. ej. una taza de café humeante al amanecer';
  renderPresets();
  updateCost();
}

function updateCost() {
  const m = currentModel();
  if (!m) return;
  const d = Number($('#duration').value);
  const cost = m.perChars ? m.cost * Math.max(1, Math.ceil($('#prompt').value.trim().length / m.perChars))
    : m.kind === 'video' && m.durations?.length > 1 && d > m.durations[0] ? m.cost * 2 : m.cost;
  const short = state.user && state.user.credits < cost;
  $('#generate').disabled = false;
  $('#generate').dataset.short = short ? '1' : '';
  $('#generate').innerHTML = short ? `Comprar créditos · necesitas ⚡${cost}` : `Generar · ⚡${cost}`;
}

function renderPresets() {
  const m = currentModel();
  const allowed = m && !m.noPrompt ? state.catalog.presets.filter((p) => p.kinds.includes(m.kind)) : [];
  const chip = (p) => `<button type="button" class="chip ${state.presets.has(p.id) ? 'active' : ''}" data-preset="${p.id}">${p.emoji} ${esc(p.name)}</button>`;
  const cam = allowed.filter((p) => p.group === 'camera');
  const sty = allowed.filter((p) => p.group === 'style');
  $('#camera-field').classList.toggle('hidden', !cam.length);
  $('#style-field').classList.toggle('hidden', !sty.length);
  $('#camera-presets').innerHTML = cam.map(chip).join('');
  $('#style-presets').innerHTML = sty.map(chip).join('');
}

// Un preset por grupo (una cámara + un estilo); clic de nuevo para quitarlo.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-preset]');
  if (!btn) return;
  const preset = state.catalog.presets.find((p) => p.id === btn.dataset.preset);
  if (state.presets.has(preset.id)) {
    state.presets.delete(preset.id);
  } else {
    for (const id of state.presets) {
      if (state.catalog.presets.find((p) => p.id === id).group === preset.group) state.presets.delete(id);
    }
    state.presets.add(preset.id);
  }
  renderPresets();
});

$('#model').onchange = () => { state.presets.clear(); onModelChange(); };
$('#duration').onchange = updateCost;
$('#prompt').oninput = () => { $('#prompt-count').textContent = `${$('#prompt').value.length} / 2000`; updateCost(); };

// Imagen de entrada (se reduce a 1536 px máx. para no enviar archivos enormes)
function setImage(dataUrl) {
  state.image = dataUrl;
  $('#image-preview').src = dataUrl ?? '';
  $('#image-preview').classList.toggle('hidden', !dataUrl);
  $('#drop-text').classList.toggle('hidden', !!dataUrl);
}

function imageToDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, 1536 / Math.max(img.naturalWidth || 1024, img.naturalHeight || 1024));
      const c = document.createElement('canvas');
      c.width = Math.round((img.naturalWidth || 1024) * scale);
      c.height = Math.round((img.naturalHeight || 1024) * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL(src.startsWith('data:image/png') || src.endsWith('.png') ? 'image/png' : 'image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = async () => setImage(await imageToDataUrl(reader.result));
  reader.readAsDataURL(file);
}
$('#image-input').onchange = (e) => loadFile(e.target.files[0]);
const drop = $('#drop');
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]); };

$('#gen-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#gen-error').textContent = '';
  if ($('#generate').dataset.short) return openBuy();
  const m = currentModel();
  if (m.needsImage && !state.image) { $('#gen-error').textContent = 'Sube una imagen primero'; return; }
  $('#generate').disabled = true;
  try {
    const { job, user } = await api('/api/generate', {
      body: {
        modelId: m.id, prompt: $('#prompt').value, presets: [...state.presets],
        aspect: $('#aspect').value, duration: $('#duration').value, voice: $('#voice').value,
        image: m.needsImage ? state.image : undefined,
      },
    });
    state.jobs.unshift(job);
    setUser(user);
    renderGallery();
    schedulePoll();
    if (job.status === 'failed') toast('No se pudo generar. Te hemos devuelto los créditos.');
  } catch (err) {
    $('#gen-error').textContent = err.message;
    if (err.status === 401) showLanding();
  } finally {
    updateCost();
  }
};

// ---------- Galería ----------
function setUser(u) {
  state.user = u;
  $('#credits').textContent = u.credits;
  $('#admin-open').classList.toggle('hidden', !u.isAdmin);
  updateCost();
}

const modelOf = (id) => state.catalog.models.find((m) => m.id === id);
const modelName = (id) => modelOf(id)?.name ?? id;
const KIND_ICON = { image: '🖼️', video: '🎞️', audio: '🎙️' };

function mediaHtml(j, { full = false } = {}) {
  const url = esc(j.resultUrl);
  const t = mediaType(j.resultUrl);
  const transparent = j.modelId === 'remove-bg' ? 'checker' : '';
  if (t === 'video') return full ? `<video src="${url}" controls autoplay loop playsinline></video>` : `<video src="${url}" muted loop playsinline preload="metadata"></video>`;
  if (t === 'audio') {
    const bars = Array.from({ length: 28 }, (_, i) => `<i style="height:${20 + Math.abs(Math.sin(i * 1.7 + j.id.charCodeAt(0))) * 80}%"></i>`).join('');
    return `<div class="audio-card"><div class="wave">${bars}</div><audio src="${url}" controls preload="none"></audio></div>`;
  }
  return `<img src="${url}" ${full ? '' : 'loading="lazy"'} class="${transparent}" alt="">`;
}

function renderGallery() {
  const jobs = state.jobs.filter((j) => state.filter === 'all' || j.kind === state.filter);
  $('#empty').classList.toggle('hidden', state.jobs.length > 0);
  $('#gallery').innerHTML = jobs.map((j) => {
    const tag = `<span class="tag">${KIND_ICON[j.kind] ?? ''} ${esc(modelName(j.modelId))}</span>`;
    const meta = `<div class="meta">${esc(j.prompt)}</div>`;
    if (j.status === 'done') return `<div class="card" data-job="${j.id}">${tag}${mediaHtml(j)}${meta}</div>`;
    if (j.status === 'failed') {
      return `<div class="card" data-job="${j.id}">${tag}<div class="placeholder failed"><b>No se pudo generar</b><span class="small">${esc(j.error ?? '')}</span><span class="small">✓ Créditos devueltos</span></div>${meta}</div>`;
    }
    const wait = j.kind === 'video' ? 'Generando video… (1-5 min)' : 'Generando…';
    return `<div class="card pending">${tag}<div class="placeholder"><div class="spinner"></div><span class="small muted">${wait}</span></div>${meta}</div>`;
  }).join('');
}

$('#gallery').addEventListener('mouseover', (e) => e.target.tagName === 'VIDEO' && e.target.play().catch(() => {}));
$('#gallery').addEventListener('mouseout', (e) => e.target.tagName === 'VIDEO' && e.target.pause());

$$('[data-filter]').forEach((b) => {
  b.onclick = () => {
    state.filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
    renderGallery();
  };
});

$('#ideas').innerHTML = IDEAS.map((t) => `<button type="button" class="chip" data-idea="${esc(t)}">${esc(t)}</button>`).join('');
$('#ideas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-idea]');
  if (!b) return;
  selectTab('image');
  $('#prompt').value = b.dataset.idea;
  $('#prompt').oninput();
  $('#prompt').focus();
});

async function refreshJobs() {
  try {
    const before = new Map(state.jobs.map((j) => [j.id, j.status]));
    const { jobs, user } = await api('/api/jobs');
    state.jobs = jobs;
    setUser(user);
    renderGallery();
    for (const j of jobs) {
      const was = before.get(j.id);
      if (was && was !== j.status && j.status === 'done') toast(`✓ ${modelName(j.modelId)}: listo`);
      if (was && was !== j.status && j.status === 'failed') toast('Una generación falló. Créditos devueltos.');
    }
  } catch (err) {
    if (err.status === 401) showLanding();
  }
}

function schedulePoll() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!state.jobs.some((j) => j.status === 'queued' || j.status === 'running')) return clearInterval(state.pollTimer);
    await refreshJobs();
  }, 3000);
}

// ---------- Visor ----------
$('#gallery').addEventListener('click', (e) => {
  const card = e.target.closest('[data-job]');
  if (!card || e.target.tagName === 'AUDIO') return;
  const j = state.jobs.find((x) => x.id === card.dataset.job);
  state.viewing = j;
  const done = j.status === 'done';
  $('#viewer-media').innerHTML = done ? mediaHtml(j, { full: true }) : '';
  $('#viewer-prompt').textContent = j.prompt;
  const presetNames = j.presets.map((id) => state.catalog.presets.find((p) => p.id === id)?.name).filter(Boolean);
  $('#viewer-meta').textContent = [modelName(j.modelId), `⚡${j.cost}`, ...presetNames, new Date(j.createdAt).toLocaleString()].join(' · ');
  $('#viewer-download').classList.toggle('hidden', !done);
  $('#viewer-download').href = j.resultUrl ?? '#';
  const isImage = done && mediaType(j.resultUrl) === 'image';
  $('#viewer-animate').classList.toggle('hidden', !isImage);
  $('#viewer-edit').classList.toggle('hidden', !isImage);
  $('#viewer-reuse').classList.toggle('hidden', !!modelOf(j.modelId)?.noPrompt);
  $('#viewer').showModal();
});

$('#viewer').addEventListener('close', () => { $('#viewer-media').innerHTML = ''; });

$('#viewer-reuse').onclick = () => {
  const j = state.viewing;
  const m = modelOf(j.modelId);
  if (m) selectTab(m.tab, m.id);
  $('#prompt').value = j.prompt;
  $('#prompt').oninput();
  j.presets.forEach((id) => state.presets.add(id));
  renderPresets();
  $('#viewer').close();
  $('#prompt').focus();
};

// Usar una imagen generada como entrada de otra herramienta
async function useAsInput(tab, modelId) {
  const j = state.viewing;
  try {
    const dataUrl = await imageToDataUrl(j.resultUrl);
    selectTab(tab, modelId);
    setImage(dataUrl);
    if (tab === 'video') { $('#prompt').value = j.prompt; $('#prompt').oninput(); }
    $('#viewer').close();
    toast('Imagen cargada: ajusta el prompt y genera');
  } catch {
    toast('No se pudo cargar la imagen');
  }
}
$('#viewer-animate').onclick = () => useAsInput('video', 'kling-i2v');
$('#viewer-edit').onclick = () => useAsInput('tools', 'edit');

$('#viewer-delete').onclick = async () => {
  if (!confirm('¿Borrar esta creación?')) return;
  await api(`/api/jobs/${state.viewing.id}`, { method: 'DELETE' });
  state.jobs = state.jobs.filter((j) => j.id !== state.viewing.id);
  $('#viewer').close();
  renderGallery();
};

// ---------- Comprar créditos ----------
function openBuy() {
  const notes = {
    stripe: 'Pago seguro con tarjeta a través de Stripe. Los créditos no caducan.',
    demo: 'Modo demo: las compras se simulan y no se cobra nada.',
    off: 'Los pagos aún no están configurados. Contacta con el administrador.',
  };
  $('#buy-note').textContent = notes[state.cfg.payments];
  $('#buy-packs').innerHTML = packsHtml('buy');
  $('#buy-error').textContent = '';
  $('#buy-dialog').showModal();
}
$('#buy-open').onclick = openBuy;

$('#buy-packs').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-buy]');
  if (!b) return;
  b.disabled = true;
  b.textContent = 'Redirigiendo…';
  try {
    const { url } = await api('/api/checkout', { body: { packId: b.dataset.buy } });
    location.href = url;
  } catch (err) {
    $('#buy-error').textContent = err.message;
    b.disabled = false;
    b.textContent = 'Comprar';
  }
});

async function handleCheckoutReturn() {
  const q = new URLSearchParams(location.search);
  const result = q.get('checkout');
  if (!result) return;
  history.replaceState(null, '', '/');
  if (result === 'cancel') return toast('Pago cancelado');
  const sid = q.get('session_id');
  for (let i = 0; i < 6; i++) {
    try {
      const r = await api(`/api/checkout/verify?session_id=${encodeURIComponent(sid)}`);
      if (r.status === 'paid') { setUser(r.user); return toast(`✓ Pago completado: +${r.credits} créditos`, 4500); }
    } catch { /* reintentar */ }
    await new Promise((res) => setTimeout(res, 2000));
  }
  toast('Estamos confirmando tu pago. Los créditos aparecerán en unos minutos.', 5000);
}

// ---------- Cuenta ----------
$('#account-open').onclick = async () => {
  $('#acc-email').textContent = state.user.email;
  $('#acc-credits').textContent = `⚡ ${state.user.credits}`;
  $('#pass-error').textContent = '';
  $('#account-dialog').showModal();
  try {
    const { purchases } = await api('/api/purchases');
    $('#acc-purchases').innerHTML = purchases.length
      ? purchases.map((p) => `<div>${new Date(p.paidAt).toLocaleDateString()} · ⚡${p.credits} · ${p.mode === 'demo' ? 'demo' : money(p.amount)}</div>`).join('')
      : 'Aún no has comprado créditos.';
  } catch { /* nada */ }
};

$('#pass-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#pass-error').textContent = '';
  try {
    await api('/api/password', { body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset();
    toast('Contraseña actualizada');
  } catch (err) {
    $('#pass-error').textContent = err.message;
  }
};

$('#logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  $('#account-dialog').close();
  showLanding();
};

// ---------- Admin ----------
async function loadAdmin() {
  const [s, { users }] = await Promise.all([api('/api/admin/stats'), api('/api/admin/users')]);
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  $('#admin-stats').innerHTML = [
    stat(money(s.revenueLast30), 'Ingresos (30 días)'),
    stat(money(s.revenueTotal), 'Ingresos totales'),
    stat(s.users, `Usuarios (+${s.usersLast30} en 30 días)`),
    stat(s.jobsLast30, 'Generaciones (30 días)'),
    stat(`⚡${s.creditsSpentLast30}`, 'Créditos gastados (30 días)'),
    stat(s.failedLast30, 'Fallos (30 días)'),
  ].join('') + (s.topModels.length
    ? `<div class="stat" style="grid-column:1/-1"><span>Modelos más usados (30 días)</span><div class="chips" style="margin-top:6px">${s.topModels.map((m) => `<span class="chip">${esc(modelName(m.id))} · ${m.n}</span>`).join('')}</div></div>`
    : '');
  $('#admin-users').innerHTML = users.map((u) =>
    `<tr><td>${esc(u.email)}${u.isAdmin ? ' 👑' : ''}</td><td>⚡${u.credits}</td><td>${u.jobs}</td><td>${money(u.spent)}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join('');
}
$('#admin-open').onclick = async () => { $('#admin').showModal(); await loadAdmin(); };
$('#admin-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#admin-error').textContent = '';
  try {
    await api('/api/admin/credits', { body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset();
    await Promise.all([loadAdmin(), refreshJobs()]);
    toast('Créditos actualizados');
  } catch (err) {
    $('#admin-error').textContent = err.message;
  }
};

// ---------- Arranque ----------
async function enterApp() {
  const { user } = await api('/api/me');
  $('#landing').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#demo-badge').classList.toggle('hidden', !state.cfg.aiDemo);
  setUser(user);
  selectTab(state.tab);
  await refreshJobs();
  schedulePoll();
  await handleCheckoutReturn();
}

async function boot() {
  [state.cfg, state.catalog] = await Promise.all([api('/api/config'), api('/api/catalog')]);
  applyBrand();
  try {
    await enterApp();
  } catch (err) {
    if (err.status === 401) showLanding();
    else console.error(err);
  }
}

boot();
