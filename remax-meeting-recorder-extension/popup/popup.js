/**
 * REMAX Meeting Recorder — Popup Logic
 * Handles UI state, recording controls, and communication with service worker
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host/api';

// ─── DOM ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screenLogin = $('screen-login');
const screenMain = $('screen-main');
const stateIdle = $('state-idle');
const stateReady = $('state-ready');
const stateRecording = $('state-recording');
const statePost = $('state-post');
const stateUploading = $('state-uploading');
const stateDone = $('state-done');
const stateError = $('state-error');
const statusDot = $('status-dot');

// ─── State ───────────────────────────────────────────────────────
let authToken = '';
let currentUser = null;
let currentTabId = null;
let timerInterval = null;
let audioBase64 = null;
let recordedDuration = 0;
let selectedCandidateId = null;
let searchTimeout = null;

// ─── Screen Management ──────────────────────────────────────────
function showScreen(name) {
  screenLogin.classList.toggle('active', name === 'login');
  screenMain.classList.toggle('active', name === 'main');
}

function showState(name) {
  [stateIdle, stateReady, stateRecording, statePost, stateUploading, stateDone, stateError]
    .forEach(el => el.classList.remove('active'));

  const map = { idle: stateIdle, ready: stateReady, recording: stateRecording, post: statePost, uploading: stateUploading, done: stateDone, error: stateError };
  if (map[name]) map[name].classList.add('active');

  // Update status dot
  statusDot.className = 'status-dot';
  if (name === 'recording') statusDot.classList.add('recording');
  else if (authToken) statusDot.classList.add('connected');
}

// ─── Timer ───────────────────────────────────────────────────────
function startTimer() {
  const start = Date.now();
  const timerEl = $('rec-timer');
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${min}:${sec}`;
  }, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Auth ────────────────────────────────────────────────────────
async function login(token) {
  try {
    const resp = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Token inválido');
    const data = await resp.json();
    currentUser = data.user || data;
    authToken = token;
    await chrome.storage.local.set({ authToken: token, user: currentUser });

    // Update UI
    $('user-name').textContent = currentUser.full_name || currentUser.email || 'Agente';
    $('user-avatar').textContent = (currentUser.full_name || 'A')[0].toUpperCase();
    showScreen('main');
    statusDot.classList.add('connected');
    checkCurrentTab();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
}

async function logout() {
  authToken = '';
  currentUser = null;
  await chrome.storage.local.remove(['authToken', 'user']);
  statusDot.className = 'status-dot';
  showScreen('login');
}

// ─── Tab Detection ──────────────────────────────────────────────
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/.test(tab.url)) {
      currentTabId = tab.id;
      $('meet-title').textContent = tab.title?.replace('Meet: ', '').replace('Meet - ', '') || 'Reunión';
      showState('ready');
    } else {
      currentTabId = null;
      showState('idle');
    }
  } catch {
    showState('idle');
  }
}

// ─── Recording Controls ─────────────────────────────────────────
async function startRecording() {
  if (!currentTabId) {
    showState('error');
    $('error-msg').textContent = 'No hay tab de Google Meet activo';
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: 'start-recording',
    target: 'service-worker',
    tabId: currentTabId
  });

  if (resp?.success) {
    showState('recording');
    startTimer();
  } else {
    showState('error');
    $('error-msg').textContent = resp?.error || 'Error al iniciar grabación';
  }
}

async function stopRecording() {
  stopTimer();

  const resp = await chrome.runtime.sendMessage({
    type: 'stop-recording',
    target: 'service-worker'
  });

  if (resp?.success) {
    // Wait for recording data from offscreen
    showState('uploading');
    $('upload-step').textContent = 'Procesando audio...';
  } else {
    showState('error');
    $('error-msg').textContent = resp?.error || 'Error al detener';
  }
}

// ─── Upload ──────────────────────────────────────────────────────
async function uploadRecording() {
  if (!audioBase64) return;

  showState('uploading');
  $('upload-step').textContent = 'Subiendo grabación...';

  const resp = await chrome.runtime.sendMessage({
    type: 'upload-recording',
    target: 'service-worker',
    audioBase64: audioBase64,
    duration: recordedDuration,
    metadata: {
      candidateId: selectedCandidateId,
      meetingTitle: $('meet-title')?.textContent || 'Reunión'
    }
  });

  if (resp?.success) {
    showState('done');
    audioBase64 = null;
    selectedCandidateId = null;
  } else {
    showState('error');
    $('error-msg').textContent = resp?.error || 'Error al subir';
  }
}

// ─── Candidate Search ───────────────────────────────────────────
async function searchCandidates(query) {
  if (!query || query.length < 2) {
    $('candidate-results').innerHTML = '';
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/candidates?search=${encodeURIComponent(query)}&limit=5`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const candidates = data.data || data || [];

    $('candidate-results').innerHTML = candidates.map(c => `
      <div class="candidate-item" data-id="${c.id}">
        <div>
          <div class="cand-name">${c.full_name || c.name || 'Sin nombre'}</div>
          <div class="cand-email">${c.email || ''}</div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.candidate-item').forEach(el => {
      el.addEventListener('click', () => {
        selectedCandidateId = el.dataset.id;
        $('selected-name').textContent = el.querySelector('.cand-name').textContent;
        $('selected-candidate').classList.remove('hidden');
        $('candidate-results').innerHTML = '';
        $('candidate-search').value = '';
      });
    });
  } catch { /* ignore */ }
}

// ─── Message Handler (from service worker) ──────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'popup') return;

  if (msg.type === 'recording-data') {
    audioBase64 = msg.audioBase64;
    recordedDuration = msg.duration;
    $('post-duration').textContent = formatDuration(recordedDuration);
    showState('post');
  }
});

// ─── Init ────────────────────────────────────────────────────────
async function init() {
  // Restore session
  const stored = await chrome.storage.local.get(['authToken', 'user']);
  if (stored.authToken) {
    authToken = stored.authToken;
    currentUser = stored.user;
    $('user-name').textContent = currentUser?.full_name || currentUser?.email || 'Agente';
    $('user-avatar').textContent = (currentUser?.full_name || 'A')[0].toUpperCase();
    showScreen('main');
    statusDot.classList.add('connected');

    // Check if we're already recording
    const state = await chrome.runtime.sendMessage({ type: 'get-state', target: 'service-worker' });
    if (state?.state === 'recording') {
      showState('recording');
      // Resume timer from elapsed time
      const elapsed = state.elapsed;
      const timerEl = $('rec-timer');
      const baseTime = Date.now() - elapsed;
      timerInterval = setInterval(() => {
        const e = Math.floor((Date.now() - baseTime) / 1000);
        timerEl.textContent = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
      }, 200);
    } else {
      checkCurrentTab();
    }
  } else {
    showScreen('login');
  }
}

// ─── Event Listeners ─────────────────────────────────────────────
$('btn-login').addEventListener('click', () => {
  const token = $('login-token').value.trim();
  if (token) login(token);
});

$('login-token').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const token = $('login-token').value.trim();
    if (token) login(token);
  }
});

$('btn-logout').addEventListener('click', logout);
$('btn-record').addEventListener('click', startRecording);
$('btn-stop').addEventListener('click', stopRecording);
$('btn-upload').addEventListener('click', uploadRecording);

$('btn-discard').addEventListener('click', () => {
  audioBase64 = null;
  selectedCandidateId = null;
  checkCurrentTab();
});

$('btn-new-recording').addEventListener('click', () => checkCurrentTab());
$('btn-retry').addEventListener('click', () => checkCurrentTab());

$('btn-clear-cand').addEventListener('click', () => {
  selectedCandidateId = null;
  $('selected-candidate').classList.add('hidden');
});

$('candidate-search').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => searchCandidates(e.target.value), 300);
});

// Initialize
init();
