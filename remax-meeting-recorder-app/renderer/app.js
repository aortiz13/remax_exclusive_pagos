/**
 * RE/MAX Meeting Recorder — Desktop App Controller
 * Manages login, source selection, candidate search, recording, and upload
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host';

// ─── State ───────────────────────────────────────────────────────
let authToken = null;
let userProfile = null;
let selectedSourceId = null;
let selectedCandidateId = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let timerInterval = null;
let searchTimeout = null;

// ─── DOM refs ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

// Screens
const screenLogin = $('#screen-login');
const screenMain = $('#screen-main');

// Login
const loginToken = $('#login-token');
const btnLogin = $('#btn-login');
const loginError = $('#login-error');

// Header
const userName = $('#user-name');
const userAvatar = $('#user-avatar');
const btnLogout = $('#btn-logout');

// Source
const btnChooseSource = $('#btn-choose-source');
const selectedSourceEl = $('#selected-source');
const sourceThumb = $('#source-thumb');
const sourceName = $('#source-name');
const btnChangeSource = $('#btn-change-source');
const sourceModal = $('#source-modal');
const sourceList = $('#source-list');
const btnCloseModal = $('#btn-close-modal');

// Candidate
const searchBox = $('#search-box');
const candidateSearch = $('#candidate-search');
const candidateResults = $('#candidate-results');
const selectedCandidateEl = $('#selected-candidate');
const candAvatar = $('#cand-avatar');
const candName = $('#cand-name');
const candEmail = $('#cand-email');
const btnClearCandidate = $('#btn-clear-candidate');

// Recording
const btnRecord = $('#btn-record');
const btnStop = $('#btn-stop');
const btnNewRecording = $('#btn-new-recording');
const btnRetry = $('#btn-retry');
const recTimer = $('#rec-timer');
const errorMsg = $('#error-msg');

const recIdle = $('#rec-idle');
const recRecording = $('#rec-recording');
const recUploading = $('#rec-uploading');
const recDone = $('#rec-done');
const recError = $('#rec-error');

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Show version
    if (window.electronAPI) {
        const ver = await window.electronAPI.getVersion();
        $('#app-version').textContent = `v${ver}`;
    }

    // Check stored token
    const storedToken = localStorage.getItem('auth_token');
    const storedProfile = localStorage.getItem('user_profile');
    if (storedToken && storedProfile) {
        authToken = storedToken;
        userProfile = JSON.parse(storedProfile);
        showMain();
    }
});

// ─── Window Controls ─────────────────────────────────────────────
$('#btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimizeWindow());
$('#btn-close')?.addEventListener('click', () => window.electronAPI?.closeWindow());

// ─── Login ───────────────────────────────────────────────────────
btnLogin.addEventListener('click', handleLogin);
loginToken.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

async function handleLogin() {
    const token = loginToken.value.trim();
    if (!token) return showLoginError('Ingresa tu token de acceso');

    btnLogin.disabled = true;
    btnLogin.textContent = 'Verificando...';

    try {
        const res = await fetch(`${API_BASE}/api/meetings/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Token inválido o expirado');

        const profile = await res.json();
        authToken = token;
        userProfile = profile;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_profile', JSON.stringify(profile));
        showMain();
    } catch (err) {
        showLoginError(err.message);
    }

    btnLogin.disabled = false;
    btnLogin.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Iniciar Sesión`;
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
    setTimeout(() => loginError.style.display = 'none', 4000);
}

function showMain() {
    screenLogin.classList.remove('active');
    screenMain.classList.add('active');
    const name = userProfile.full_name || userProfile.email || '';
    userName.textContent = name;
    userAvatar.textContent = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'U';
}

// ─── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    authToken = null;
    userProfile = null;
    screenMain.classList.remove('active');
    screenLogin.classList.add('active');
    loginToken.value = '';
});

// ─── Source Selection ────────────────────────────────────────────
btnChooseSource.addEventListener('click', openSourcePicker);
btnChangeSource.addEventListener('click', openSourcePicker);
btnCloseModal.addEventListener('click', () => sourceModal.style.display = 'none');

async function openSourcePicker() {
    if (!window.electronAPI) return;
    const sources = await window.electronAPI.getSources();

    sourceList.innerHTML = sources.map(s => `
        <div class="source-item" data-id="${s.id}" data-name="${s.name}">
            <img src="${s.thumbnail}" alt="${s.name}" />
            <span>${s.name}</span>
        </div>
    `).join('');

    sourceList.querySelectorAll('.source-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedSourceId = item.dataset.id;
            sourceThumb.src = item.querySelector('img').src;
            sourceName.textContent = item.dataset.name;
            btnChooseSource.style.display = 'none';
            selectedSourceEl.style.display = 'flex';
            sourceModal.style.display = 'none';
            updateRecordButton();
        });
    });

    sourceModal.style.display = 'flex';
}

// ─── Candidate Search ────────────────────────────────────────────
candidateSearch.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);
    if (q.length < 2) { candidateResults.style.display = 'none'; return; }
    searchTimeout = setTimeout(() => searchCandidates(q), 300);
});

async function searchCandidates(query) {
    try {
        const res = await fetch(
            `${API_BASE}/api/meetings/candidates/search?q=${encodeURIComponent(query)}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        if (!res.ok) throw new Error('Error');
        const candidates = await res.json();

        if (!candidates.length) {
            candidateResults.innerHTML = '<div class="result-item"><span style="color:var(--text-dim);font-size:11px">Sin resultados</span></div>';
        } else {
            candidateResults.innerHTML = candidates.map(c => {
                const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
                const initials = `${(c.first_name || '?')[0]}${(c.last_name || '')[0] || ''}`.toUpperCase();
                return `
                    <div class="result-item" data-id="${c.id}" data-name="${name}" data-email="${c.email || ''}">
                        <div class="result-avatar">${initials}</div>
                        <div>
                            <div class="result-name">${name || 'Sin nombre'}</div>
                            <div class="result-email">${c.email || c.phone || ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        candidateResults.style.display = 'block';

        candidateResults.querySelectorAll('.result-item[data-id]').forEach(item => {
            item.addEventListener('click', () => selectCandidate(item));
        });
    } catch (err) {
        console.error('Search error:', err);
    }
}

function selectCandidate(el) {
    selectedCandidateId = el.dataset.id;
    const name = el.dataset.name;
    const email = el.dataset.email;
    const initials = name.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();

    candAvatar.textContent = initials;
    candName.textContent = name;
    candEmail.textContent = email;

    candidateResults.style.display = 'none';
    searchBox.style.display = 'none';
    selectedCandidateEl.style.display = 'flex';
    updateRecordButton();
}

btnClearCandidate.addEventListener('click', () => {
    selectedCandidateId = null;
    candidateSearch.value = '';
    searchBox.style.display = 'flex';
    selectedCandidateEl.style.display = 'none';
    updateRecordButton();
});

function updateRecordButton() {
    btnRecord.disabled = !(selectedSourceId && selectedCandidateId);
}

// ─── Recording ───────────────────────────────────────────────────
btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
btnNewRecording.addEventListener('click', resetToIdle);
btnRetry.addEventListener('click', resetToIdle);

async function startRecording() {
    if (!selectedSourceId || !selectedCandidateId) return;
    audioChunks = [];

    try {
        // Tell main process which source the user selected
        if (window.electronAPI) {
            await window.electronAPI.setSelectedSource(selectedSourceId);
        }

        // Use getDisplayMedia which triggers the main process handler
        // On macOS: uses ScreenCaptureKit with audio:'loopback' to capture system audio
        // This works even with headphones — captures all system audio output
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: {
                width: { max: 1 },
                height: { max: 1 },
                frameRate: { max: 1 },
            },
        });

        // Extract audio tracks from display media (system audio)
        const systemAudioTracks = displayStream.getAudioTracks();
        // Stop video tracks — we only need audio
        displayStream.getVideoTracks().forEach(t => t.stop());

        let recordStream;

        if (systemAudioTracks.length > 0) {
            // System audio captured! Now mix with microphone
            const ctx = new AudioContext();
            const dest = ctx.createMediaStreamDestination();

            // Add system audio
            const systemSource = ctx.createMediaStreamSource(new MediaStream(systemAudioTracks));
            systemSource.connect(dest);

            // Also capture microphone
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true },
                });
                const micSource = ctx.createMediaStreamSource(micStream);
                micSource.connect(dest);
            } catch (micErr) {
                console.warn('Mic not available, system audio only:', micErr.message);
            }

            recordStream = dest.stream;
        } else {
            // Fallback: no system audio (older macOS), use mic only
            console.warn('No system audio tracks available, using mic only');
            try {
                recordStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true },
                });
            } catch (micErr) {
                throw new Error('No se pudo capturar audio. Verifica permisos de micrófono.');
            }
        }

        // Create MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm';

        mediaRecorder = new MediaRecorder(recordStream, { mimeType, audioBitsPerSecond: 128000 });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            showPanel('uploading');
            const blob = new Blob(audioChunks, { type: mimeType });
            audioChunks = [];
            await uploadRecording(blob);
        };

        mediaRecorder.start(1000);

        // Start timer
        recordingStartTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        showPanel('recording');

    } catch (err) {
        console.error('Recording error:', err);
        errorMsg.textContent = err.message || 'Error al iniciar grabación';
        showPanel('error');
    }
}

function stopRecording() {
    clearInterval(timerInterval);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    recTimer.textContent = `${mins}:${secs}`;
}

async function uploadRecording(blob) {
    try {
        const formData = new FormData();
        formData.append('audio', blob, `meeting-${Date.now()}.webm`);
        formData.append('candidate_id', selectedCandidateId);
        formData.append('platform', 'google_meet');

        const res = await fetch(`${API_BASE}/api/meetings/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error ${res.status}: ${text}`);
        }

        showPanel('done');
    } catch (err) {
        console.error('Upload error:', err);
        errorMsg.textContent = err.message;
        showPanel('error');
    }
}

function resetToIdle() {
    showPanel('idle');
    recTimer.textContent = '00:00';
}

function showPanel(name) {
    [recIdle, recRecording, recUploading, recDone, recError].forEach(el => el.style.display = 'none');
    ({
        idle: recIdle,
        recording: recRecording,
        uploading: recUploading,
        done: recDone,
        error: recError,
    })[name].style.display = 'flex';
}
