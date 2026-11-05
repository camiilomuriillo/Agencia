const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  user: null, catalog: null, kind: 'image', presets: new Set(), image: null,
  jobs: [], filter: 'all', pollTimer: null, registerMode: false, viewing: null,
};

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
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const isVideoUrl = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u ?? '');

// ---------- Acceso ----------
function showAuth() {
  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

$('#auth-toggle').onclick = () => {
  state.registerMode = !state.registerMode;
  $('#auth-submit').textContent = state.registerMode ? 'Crear cuenta' : 'Entrar';
  $('#auth-toggle').textContent = state.registerMode ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Regístrate';
  $('#auth-error').textContent = '';
};

$('#auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api(state.registerMode ? '/api/register' : '/api/login', { body: Object.fromEntries(f) });
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
};

$('#logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  clearInterval(state.pollTimer);
  showAuth();
};

// ---------- Formulario ----------
function modelsOfKind() {
  return state.catalog.models.filter((m) => m.kind === state.kind);
}

function currentModel() {
  return state.catalog.models.find((m) => m.id === $('#model').value);
}

function renderModels() {
  $('#model').innerHTML = modelsOfKind()
    .map((m) => `<option value="${m.id}">${esc(m.name)} · ⚡${m.cost}</option>`).join('');
  onModelChange();
}

function onModelChange() {
  const m = currentModel();
  $('#model-tagline').textContent = m.tagline;
  $('#aspect').innerHTML = m.aspects.map((a) => `<option>${a}</option>`).join('');
  $('#duration-field').classList.toggle('hidden', !m.durations);
  $('#duration').innerHTML = (m.durations ?? []).map((d) => `<option value="${d}">${d} s</option>`).join('');
  $('#image-field').classList.toggle('hidden', !m.needsImage);
  $('#camera-field').classList.toggle('hidden', m.kind !== 'video');
  updateCost();
}

function updateCost() {
  const m = currentModel();
  if (!m) return;
  const d = Number($('#duration').value);
  const cost = m.kind === 'video' && m.durations?.length > 1 && d > m.durations[0] ? m.cost * 2 : m.cost;
  const short = state.user && state.user.credits < cost;
  $('#generate').disabled = short;
  $('#generate').innerHTML = short ? `Créditos insuficientes · necesitas ⚡${cost}` : `Generar · ⚡ <span id="cost">${cost}</span>`;
}

function renderPresets() {
  const chip = (p) => `<button type="button" class="chip ${state.presets.has(p.id) ? 'active' : ''}" data-preset="${p.id}">${p.emoji} ${esc(p.name)}</button>`;
  const visible = state.catalog.presets.filter((p) => p.kinds.includes(state.kind));
  $('#camera-presets').innerHTML = visible.filter((p) => p.group === 'camera').map(chip).join('');
  $('#style-presets').innerHTML = visible.filter((p) => p.group === 'style').map(chip).join('');
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

$$('.tab').forEach((t) => {
  t.onclick = () => {
    state.kind = t.dataset.kind;
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    state.presets.clear();
    renderModels();
    renderPresets();
  };
});

$('#model').onchange = onModelChange;
$('#duration').onchange = updateCost;

// Subida de imagen (se reduce a 1536 px máx. para no enviar archivos enormes)
function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1536 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      state.image = c.toDataURL('image/jpeg', 0.9);
      $('#image-preview').src = state.image;
      $('#image-preview').classList.remove('hidden');
      $('#drop-text').classList.add('hidden');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
$('#image-input').onchange = (e) => loadImage(e.target.files[0]);
const drop = $('#drop');
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); loadImage(e.dataTransfer.files[0]); };

$('#gen-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#gen-error').textContent = '';
  const m = currentModel();
  if (m.needsImage && !state.image) { $('#gen-error').textContent = 'Sube una imagen de partida'; return; }
  $('#generate').disabled = true;
  try {
    const { job, user } = await api('/api/generate', {
      body: {
        modelId: m.id, prompt: $('#prompt').value, presets: [...state.presets],
        aspect: $('#aspect').value, duration: $('#duration').value, image: m.needsImage ? state.image : undefined,
      },
    });
    state.jobs.unshift(job);
    setUser(user);
    renderGallery();
    schedulePoll();
  } catch (err) {
    $('#gen-error').textContent = err.message;
    if (err.status === 401) showAuth();
  } finally {
    updateCost();
  }
};

// ---------- Galería ----------
function setUser(u) {
  state.user = u;
  $('#credits').textContent = u.credits;
  $('#user-email').textContent = u.email;
  $('#admin-open').classList.toggle('hidden', !u.isAdmin);
  updateCost();
}

function modelName(id) {
  return state.catalog.models.find((m) => m.id === id)?.name ?? id;
}

function renderGallery() {
  const jobs = state.jobs.filter((j) => state.filter === 'all' || j.kind === state.filter);
  $('#empty').classList.toggle('hidden', jobs.length > 0);
  $('#gallery').innerHTML = jobs.map((j) => {
    const tag = `<span class="tag">${j.kind === 'video' ? '🎞️' : '🖼️'} ${esc(modelName(j.modelId))}</span>`;
    if (j.status === 'done') {
      const media = isVideoUrl(j.resultUrl)
        ? `<video src="${esc(j.resultUrl)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${esc(j.resultUrl)}" loading="lazy" alt="">`;
      return `<div class="card" data-job="${j.id}">${tag}${media}<div class="meta">${esc(j.prompt)}</div></div>`;
    }
    if (j.status === 'failed') {
      return `<div class="card" data-job="${j.id}">${tag}<div class="placeholder failed"><b>Falló</b><span class="small">${esc(j.error ?? '')}</span><span class="small">Créditos devueltos</span></div><div class="meta">${esc(j.prompt)}</div></div>`;
    }
    return `<div class="card pending">${tag}<div class="placeholder"><div class="spinner"></div><span class="small muted">${j.kind === 'video' ? 'Generando video… (1-5 min)' : 'Generando…'}</span></div><div class="meta">${esc(j.prompt)}</div></div>`;
  }).join('');
}

// Previsualizar videos al pasar el ratón
$('#gallery').addEventListener('mouseover', (e) => e.target.tagName === 'VIDEO' && e.target.play());
$('#gallery').addEventListener('mouseout', (e) => e.target.tagName === 'VIDEO' && e.target.pause());

$$('[data-filter]').forEach((b) => {
  b.onclick = () => {
    state.filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
    renderGallery();
  };
});

async function refreshJobs() {
  try {
    const { jobs, user } = await api('/api/jobs');
    state.jobs = jobs;
    setUser(user);
    renderGallery();
  } catch (err) {
    if (err.status === 401) showAuth();
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
  if (!card) return;
  const j = state.jobs.find((x) => x.id === card.dataset.job);
  state.viewing = j;
  $('#viewer-media').innerHTML = j.status !== 'done' ? ''
    : isVideoUrl(j.resultUrl) ? `<video src="${esc(j.resultUrl)}" controls autoplay loop playsinline></video>`
      : `<img src="${esc(j.resultUrl)}" alt="">`;
  $('#viewer-prompt').textContent = j.prompt;
  const presetNames = j.presets.map((id) => state.catalog.presets.find((p) => p.id === id)?.name).filter(Boolean);
  $('#viewer-meta').textContent = [modelName(j.modelId), `⚡${j.cost}`, ...presetNames, new Date(j.createdAt).toLocaleString()].join(' · ');
  $('#viewer-download').classList.toggle('hidden', j.status !== 'done');
  $('#viewer-download').href = j.resultUrl ?? '#';
  $('#viewer').showModal();
});

$('#viewer-close').onclick = () => $('#viewer').close();
$('#viewer').addEventListener('close', () => { $('#viewer-media').innerHTML = ''; });

$('#viewer-reuse').onclick = () => {
  const j = state.viewing;
  $(`.tab[data-kind="${j.kind}"]`).click();
  if (state.catalog.models.some((m) => m.id === j.modelId)) { $('#model').value = j.modelId; onModelChange(); }
  $('#prompt').value = j.prompt;
  j.presets.forEach((id) => state.presets.add(id));
  renderPresets();
  $('#viewer').close();
  $('#prompt').focus();
};

$('#viewer-delete').onclick = async () => {
  if (!confirm('¿Borrar esta creación?')) return;
  await api(`/api/jobs/${state.viewing.id}`, { method: 'DELETE' });
  state.jobs = state.jobs.filter((j) => j.id !== state.viewing.id);
  $('#viewer').close();
  renderGallery();
};

// ---------- Admin ----------
async function loadAdminUsers() {
  const { users } = await api('/api/admin/users');
  $('#admin-users').innerHTML = users.map((u) =>
    `<tr><td>${esc(u.email)}${u.isAdmin ? ' 👑' : ''}</td><td>${u.credits}</td><td>${u.jobs}</td></tr>`).join('');
}
$('#admin-open').onclick = async () => { $('#admin').showModal(); await loadAdminUsers(); };
$('#admin-close').onclick = () => $('#admin').close();
$('#admin-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#admin-error').textContent = '';
  try {
    await api('/api/admin/credits', { body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset();
    await loadAdminUsers();
    await refreshJobs();
  } catch (err) {
    $('#admin-error').textContent = err.message;
  }
};

// ---------- Arranque ----------
async function boot() {
  try {
    state.catalog ??= await api('/api/catalog');
    const { user, demo } = await api('/api/me');
    $('#demo-badge').classList.toggle('hidden', !demo);
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    setUser(user);
    renderModels();
    renderPresets();
    await refreshJobs();
    schedulePoll();
  } catch (err) {
    if (err.status === 401) showAuth();
    else console.error(err);
  }
}

boot();
