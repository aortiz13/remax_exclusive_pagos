/**
 * RE/MAX Meeting Recorder — Popup Controller
 * Manages login, candidate search, recording state, and UI updates
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host';

// ─── DOM refs ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

const loginScreen     = $('#login-screen');
const mainScreen      = $('#main-screen');
const loginToken      = $('#login-token');
const btnLogin        = $('#btn-login');
const loginError      = $('#login-error');
const userName        = $('#user-name');
const btnLogout       = $('#btn-logout');
const candidateSearch = $('#candidate-search');
const candidateResults= $('#candidate-results');
const selectedCandidate = $('#selected-candidate');
const candidateAvatar = $('#candidate-avatar');
const candidateName   = $('#candidate-name');
const candidateEmail  = $('#candidate-email');
const btnClearCand    = $('#btn-clear-candidate');
const btnRecord       = $('#btn-record');
const btnStop         = $('#btn-stop');
const btnRetry        = $('#btn-retry');
const timerEl         = $('#timer');
const meetStatus      = $('#meet-status');
const meetStatusText  = $('#meet-status-text');
const errorMessage    = $('#error-message');

const stateIdle       = $('#state-idle');
const stateRecording  = $('#state-recording');
const stateProcessing = $('#state-processing');
const stateDone       = $('#state-done');
const stateError      = $('#state-error');

let selectedCandId = null;
let timerInterval = null;
let searchTimeout = null;

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  const { auth_token, user_profile } = await chrome.storage.local.get(['auth_token', 'user_profile']);

  if (auth_token && user_profile) {
    showMain(user_profile);
  } else {
    showLogin();
  }

  // Listen for state updates from service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATE_UPDATE') {
      updateStateUI(msg.state, msg.startTime);
    }
    if (msg.action === 'UPLOAD_COMPLETE') {
      updateStateUI('DONE');
    }
    if (msg.action === 'UPLOAD_ERROR') {
      errorMessage.textContent = msg.error || 'Error desconocido';
      updateStateUI('ERROR');
    }
  });

  // Get current state from service worker
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
    if (res && res.state !== 'IDLE') {
      updateStateUI(res.state, res.startTime);
      if (res.candidateId) {
        selectedCandId = res.candidateId;
      }
    }
  });

  // Check if current tab is Google Meet
  detectGoogleMeet();
});

// ─── Login ───────────────────────────────────────────────────────
btnLogin.addEventListener('click', async () => {
  const token = loginToken.value.trim();
  if (!token) {
    showError('Ingresa un token de acceso');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Verificando...';

  try {
    // Verify token by fetching user profile
    const res = await fetch(`${API_BASE}/api/meetings/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Token inválido o expirado');

    const profile = await res.json();
    await chrome.storage.local.set({ auth_token: token, user_profile: profile });
    showMain(profile);

  } catch (err) {
    showError(err.message);
    btnLogin.disabled = false;
    btnLogin.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Iniciar Sesión`;
  }
});

loginToken.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

function showLogin() {
  loginScreen.style.display = 'block';
  mainScreen.style.display = 'none';
}

function showMain(profile) {
  loginScreen.style.display = 'none';
  mainScreen.style.display = 'block';
  userName.textContent = profile.full_name || profile.email || '';
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
  setTimeout(() => { loginError.style.display = 'none'; }, 4000);
}

// ─── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', async () => {
  await chrome.storage.local.remove(['auth_token', 'user_profile']);
  selectedCandId = null;
  showLogin();
});

// ─── Candidate Search ────────────────────────────────────────────
candidateSearch.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  clearTimeout(searchTimeout);

  if (query.length < 2) {
    candidateResults.style.display = 'none';
    return;
  }

  searchTimeout = setTimeout(() => searchCandidates(query), 300);
});

async function searchCandidates(query) {
  try {
    const { auth_token } = await chrome.storage.local.get(['auth_token']);
    const res = await fetch(
      `${API_BASE}/api/meetings/candidates/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Authorization': `Bearer ${auth_token}` } }
    );

    if (!res.ok) throw new Error('Search failed');
    const candidates = await res.json();

    if (candidates.length === 0) {
      candidateResults.innerHTML = '<div class="search-result-item"><span style="color:var(--text-dim);font-size:12px">Sin resultados</span></div>';
    } else {
      candidateResults.innerHTML = candidates.map(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        const initials = `${(c.first_name || '?')[0]}${(c.last_name || '')[0] || ''}`.toUpperCase();
        return `
          <div class="search-result-item" data-id="${c.id}" data-name="${name}" data-email="${c.email || ''}">
            <div class="result-avatar">${initials}</div>
            <div>
              <div class="result-name">${name || 'Sin nombre'}</div>
              <div class="result-email">${c.email || c.phone || ''}</div>
            </div>
            ${c.pipeline_stage ? `<span class="result-stage">${c.pipeline_stage}</span>` : ''}
          </div>
        `;
      }).join('');
    }

    candidateResults.style.display = 'block';

    // Add click handlers
    candidateResults.querySelectorAll('.search-result-item[data-id]').forEach(item => {
      item.addEventListener('click', () => selectCandidate(item));
    });

  } catch (err) {
    console.error('Search error:', err);
  }
}

function selectCandidate(el) {
  selectedCandId = el.dataset.id;
  const name = el.dataset.name;
  const email = el.dataset.email;
  const initials = name.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();

  candidateAvatar.textContent = initials;
  candidateName.textContent = name;
  candidateEmail.textContent = email;

  candidateResults.style.display = 'none';
  candidateSearch.parentElement.style.display = 'none';
  selectedCandidate.style.display = 'flex';
  btnRecord.disabled = false;
}

btnClearCand.addEventListener('click', () => {
  selectedCandId = null;
  candidateSearch.value = '';
  candidateSearch.parentElement.style.display = 'flex';
  selectedCandidate.style.display = 'none';
  btnRecord.disabled = true;
});

// ─── Recording ───────────────────────────────────────────────────
btnRecord.addEventListener('click', () => {
  if (!selectedCandId) return;

  chrome.runtime.sendMessage(
    { action: 'START_RECORDING', candidateId: selectedCandId },
    (res) => {
      if (res?.error) {
        errorMessage.textContent = res.error;
        updateStateUI('ERROR');
      } else {
        updateStateUI('RECORDING', Date.now());
      }
    }
  );
});

btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, (res) => {
    if (res?.error) {
      errorMessage.textContent = res.error;
      updateStateUI('ERROR');
    }
  });
});

btnRetry.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'RESET' });
  updateStateUI('IDLE');
});

// ─── State UI Updates ────────────────────────────────────────────
function updateStateUI(state, startTime) {
  // Hide all states
  stateIdle.style.display = 'none';
  stateRecording.style.display = 'none';
  stateProcessing.style.display = 'none';
  stateDone.style.display = 'none';
  stateError.style.display = 'none';

  clearInterval(timerInterval);

  switch (state) {
    case 'IDLE':
      stateIdle.style.display = 'flex';
      break;

    case 'RECORDING':
      stateRecording.style.display = 'flex';
      // Disable candidate change
      if (candidateSearch) candidateSearch.disabled = true;
      // Start timer
      if (startTime) {
        timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const secs = String(elapsed % 60).padStart(2, '0');
          timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
      }
      break;

    case 'PROCESSING':
      stateProcessing.style.display = 'flex';
      break;

    case 'DONE':
      stateDone.style.display = 'flex';
      break;

    case 'ERROR':
      stateError.style.display = 'flex';
      break;
  }
}

// ─── Google Meet Detection ───────────────────────────────────────
async function detectGoogleMeet() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('meet.google.com')) {
      meetStatus.classList.add('active');
      meetStatusText.textContent = 'Google Meet detectado ✓';
    } else {
      meetStatusText.textContent = 'Abre Google Meet para grabar';
    }
  } catch (err) {
    meetStatusText.textContent = 'No se pudo verificar la pestaña';
  }
}
