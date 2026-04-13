// ─── RE/MAX Meeting Recorder — Granola-Style App ─────────────────
const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host/api';

// ─── State ───────────────────────────────────────────────────────
let authToken = localStorage.getItem('remax-token') || '';
let currentUser = null;
let meetSourceId = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let timerInterval = null;
let selectedCandidateId = null;
let recordedBlob = null;
let recordedDuration = 0;
let searchTimeout = null;
let isCreatingNew = false;

// ─── DOM ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Screens
const screenLogin = $('screen-login');
const screenMain  = $('screen-main');

// States
const stateWaiting   = $('state-waiting');
const stateDetected  = $('state-detected');
const stateRecording = $('state-recording');
const statePost      = $('state-post');
const stateUploading = $('state-uploading');
const stateDone      = $('state-done');
const stateError     = $('state-error');

// Login
const loginToken = $('login-token');
const loginError = $('login-error');
const btnLogin   = $('btn-login');

// Header
const userName   = $('user-name');
const userAvatar = $('user-avatar');

// Detected
const meetingName = $('meeting-name');
const btnRecord   = $('btn-record');
const btnDismiss  = $('btn-dismiss');

// Recording
const recTimer = $('rec-timer');
const btnStop  = $('btn-stop');

// Post
const postDuration    = $('post-duration');
const candidateSearch = $('candidate-search');
const candidateResults = $('candidate-results');
const selectedCandidate = $('selected-candidate');
const candAvatar = $('cand-avatar');
const candName   = $('cand-name');
const candEmail  = $('cand-email');
const btnClearCand = $('btn-clear-cand');
const newCandName  = $('new-cand-name');
const newCandEmail = $('new-cand-email');
const newCandPhone = $('new-cand-phone');
const btnUpload  = $('btn-upload');
const btnDiscard = $('btn-discard');

// Others
const errorMsg = $('error-msg');
const uploadStep = $('upload-step');

// ─── Screen & State Management ──────────────────────────────────
function showScreen(name) {
    screenLogin.classList.toggle('active', name === 'login');
    screenMain.classList.toggle('active', name === 'main');
}

function showState(name) {
    [stateWaiting, stateDetected, stateRecording, statePost, stateUploading, stateDone, stateError]
        .forEach(el => el.classList.add('hidden'));
    const target = {
        waiting: stateWaiting,
        detected: stateDetected,
        recording: stateRecording,
        post: statePost,
        uploading: stateUploading,
        done: stateDone,
        error: stateError,
    }[name];
    if (target) target.classList.remove('hidden');
}

// ─── Auth ────────────────────────────────────────────────────────
async function login(token) {
    try {
        const res = await fetch(`${API_BASE}/meetings/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Token inválido o expirado');
        const user = await res.json();
        currentUser = user;
        authToken = token;
        localStorage.setItem('remax-token', token);

        // Update UI
        const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        userName.textContent = user.full_name || user.email;
        userAvatar.textContent = initials;

        showScreen('main');
        showState('waiting');
        return true;
    } catch (err) {
        throw err;
    }
}

async function autoLogin() {
    if (!authToken) return false;
    try {
        await login(authToken);
        return true;
    } catch {
        localStorage.removeItem('remax-token');
        authToken = '';
        return false;
    }
}

// ─── Meeting Detection Events ───────────────────────────────────
function setupMeetingListeners() {
    if (!window.electronAPI) return;

    window.electronAPI.onMeetingDetected((data) => {
        console.log('Meeting detected:', data);
        meetSourceId = data.sourceId;

        // Clean meeting name
        let name = data.sourceName || 'Reunión en curso';
        name = name.replace('Meet -', '').replace('- Google Chrome', '').trim();
        if (name.length > 60) name = name.substring(0, 57) + '...';
        meetingName.textContent = name;

        // Only show detection if we're in waiting state (not recording or posting)
        const currentState = getCurrentState();
        if (currentState === 'waiting' || currentState === 'detected') {
            showState('detected');
        }
    });

    window.electronAPI.onMeetingEnded(() => {
        console.log('Meeting ended');
        const currentState = getCurrentState();
        if (currentState === 'recording') {
            // Auto-stop recording
            stopRecording();
        } else if (currentState === 'detected') {
            showState('waiting');
            meetSourceId = null;
        }
    });
}

function getCurrentState() {
    if (!stateWaiting.classList.contains('hidden')) return 'waiting';
    if (!stateDetected.classList.contains('hidden')) return 'detected';
    if (!stateRecording.classList.contains('hidden')) return 'recording';
    if (!statePost.classList.contains('hidden')) return 'post';
    if (!stateUploading.classList.contains('hidden')) return 'uploading';
    if (!stateDone.classList.contains('hidden')) return 'done';
    if (!stateError.classList.contains('hidden')) return 'error';
    return 'waiting';
}

// ─── Recording ──────────────────────────────────────────────────
async function startRecording() {
    if (!meetSourceId) return;
    audioChunks = [];

    try {
        // Tell main process the source
        if (window.electronAPI) {
            await window.electronAPI.setSelectedSource(meetSourceId);
        }

        // Capture system audio via getDisplayMedia + loopback
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { width: { max: 1 }, height: { max: 1 }, frameRate: { max: 1 } },
        });

        const systemAudioTracks = displayStream.getAudioTracks();
        displayStream.getVideoTracks().forEach(t => t.stop());

        let recordStream;

        if (systemAudioTracks.length > 0) {
            const ctx = new AudioContext();
            const dest = ctx.createMediaStreamDestination();
            const systemSource = ctx.createMediaStreamSource(new MediaStream(systemAudioTracks));
            systemSource.connect(dest);

            try {
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true },
                });
                ctx.createMediaStreamSource(micStream).connect(dest);
            } catch (micErr) {
                console.warn('Mic not available:', micErr.message);
            }

            recordStream = dest.stream;
        } else {
            console.warn('No system audio, mic only');
            recordStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm';

        mediaRecorder = new MediaRecorder(recordStream, { mimeType, audioBitsPerSecond: 128000 });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(audioChunks, { type: mimeType });
            audioChunks = [];
            recordedDuration = Math.round((Date.now() - recordingStartTime) / 1000);
            postDuration.textContent = `Duración: ${formatTime(recordedDuration)}`;
            showState('post');
            resetPostForm();
        };

        mediaRecorder.start(1000);
        recordingStartTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        showState('recording');

    } catch (err) {
        console.error('Recording error:', err);
        errorMsg.textContent = err.message || 'Error al iniciar grabación';
        showState('error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    clearInterval(timerInterval);
}

function updateTimer() {
    const elapsed = Math.round((Date.now() - recordingStartTime) / 1000);
    recTimer.textContent = formatTime(elapsed);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ─── Post-Meeting: Candidate Management ─────────────────────────
function resetPostForm() {
    selectedCandidateId = null;
    isCreatingNew = false;
    candidateSearch.value = '';
    candidateResults.style.display = 'none';
    selectedCandidate.classList.add('hidden');
    newCandName.value = '';
    newCandEmail.value = '';
    newCandPhone.value = '';
    updateUploadButton();
}

async function searchCandidates(query) {
    if (!query || query.length < 2) {
        candidateResults.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/meetings/candidates/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const results = await res.json();

        if (results.length === 0) {
            candidateResults.innerHTML = '<div class="result-item" style="color:var(--text-dim)">No se encontraron candidatos</div>';
            candidateResults.style.display = 'block';
            return;
        }

        candidateResults.innerHTML = results.map(c => {
            const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            return `<div class="result-item" data-id="${c.id}" data-name="${name}" data-email="${c.email || ''}">
                <div class="result-avatar">${initials}</div>
                <div>
                    <div class="result-name">${name}</div>
                    <div class="result-email">${c.email || c.phone || '—'}</div>
                </div>
            </div>`;
        }).join('');
        candidateResults.style.display = 'block';

        // Click handlers
        candidateResults.querySelectorAll('.result-item[data-id]').forEach(el => {
            el.addEventListener('click', () => selectCandidate(el.dataset.id, el.dataset.name, el.dataset.email));
        });
    } catch (err) {
        console.error('Search error:', err);
    }
}

function selectCandidate(id, name, email) {
    selectedCandidateId = id;
    isCreatingNew = false;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    candAvatar.textContent = initials;
    candName.textContent = name;
    candEmail.textContent = email || '—';
    selectedCandidate.classList.remove('hidden');
    candidateResults.style.display = 'none';
    candidateSearch.value = '';
    updateUploadButton();
}

function updateUploadButton() {
    const hasCandidate = !!selectedCandidateId;
    const hasNewName = newCandName.value.trim().length >= 2;
    btnUpload.disabled = !(hasCandidate || hasNewName);
}

// ─── Upload ─────────────────────────────────────────────────────
async function uploadRecording() {
    if (!recordedBlob) return;

    showState('uploading');

    try {
        let candidateId = selectedCandidateId;

        // Create new candidate if needed
        if (!candidateId && newCandName.value.trim()) {
            uploadStep.textContent = 'Creando candidato...';
            candidateId = await createCandidate();
        }

        if (!candidateId) {
            throw new Error('Selecciona o crea un candidato');
        }

        // Upload
        uploadStep.textContent = 'Subiendo audio...';
        const formData = new FormData();
        formData.append('audio', recordedBlob, 'recording.webm');
        formData.append('candidateId', candidateId);
        formData.append('platform', 'google_meet');

        const res = await fetch(`${API_BASE}/meetings/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error al subir');
        }

        const data = await res.json();
        uploadStep.textContent = 'Transcribiendo con IA...';

        // Extract form
        try {
            await fetch(`${API_BASE}/meetings/${data.meeting.id}/extract-form`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            });
        } catch {
            // Non-critical
        }

        showState('done');
        recordedBlob = null;

    } catch (err) {
        console.error('Upload error:', err);
        errorMsg.textContent = err.message || 'Error al subir grabación';
        showState('error');
    }
}

async function createCandidate() {
    const name = newCandName.value.trim();
    if (!name) throw new Error('Nombre requerido');

    const parts = name.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    const res = await fetch(`${API_BASE}/meetings/candidates`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: newCandEmail.value.trim() || null,
            phone: newCandPhone.value.trim() || null,
            source: 'meeting_recorder',
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al crear candidato');
    }

    const candidate = await res.json();
    return candidate.id;
}

// ─── Event Listeners ────────────────────────────────────────────
function setupEventListeners() {
    // Window controls
    $('btn-close').addEventListener('click', () => window.electronAPI?.closeWindow());
    $('btn-minimize').addEventListener('click', () => window.electronAPI?.minimizeWindow());

    // Login
    btnLogin.addEventListener('click', async () => {
        const token = loginToken.value.trim();
        if (!token) return;
        btnLogin.disabled = true;
        btnLogin.textContent = 'Verificando...';
        try {
            await login(token);
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = 'Iniciar Sesión';
        }
    });

    loginToken.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnLogin.click();
    });

    // Logout
    $('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('remax-token');
        authToken = '';
        currentUser = null;
        loginToken.value = '';
        loginError.style.display = 'none';
        showScreen('login');
    });

    // Record
    btnRecord.addEventListener('click', startRecording);
    btnDismiss.addEventListener('click', () => {
        showState('waiting');
        meetSourceId = null;
    });

    // Stop
    btnStop.addEventListener('click', stopRecording);

    // Candidate search
    candidateSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchCandidates(candidateSearch.value.trim()), 300);
    });

    // Clear candidate
    btnClearCand.addEventListener('click', () => {
        selectedCandidateId = null;
        selectedCandidate.classList.add('hidden');
        updateUploadButton();
    });

    // New candidate inputs
    newCandName.addEventListener('input', () => {
        if (newCandName.value.trim()) {
            selectedCandidateId = null;
            selectedCandidate.classList.add('hidden');
            isCreatingNew = true;
        }
        updateUploadButton();
    });
    newCandEmail.addEventListener('input', updateUploadButton);

    // Upload
    btnUpload.addEventListener('click', uploadRecording);

    // Discard
    btnDiscard.addEventListener('click', () => {
        recordedBlob = null;
        showState('waiting');
    });

    // Done → New
    $('btn-new').addEventListener('click', () => showState('waiting'));

    // Retry
    $('btn-retry').addEventListener('click', () => {
        if (recordedBlob) showState('post');
        else showState('waiting');
    });
}

// ─── Init ────────────────────────────────────────────────────────
async function init() {
    // Version
    if (window.electronAPI) {
        const ver = await window.electronAPI.getVersion();
        $('app-version').textContent = `v${ver}`;
    }

    // Setup events
    setupEventListeners();
    setupMeetingListeners();

    // Try auto-login
    const success = await autoLogin();
    if (!success) {
        showScreen('login');
    }
}

init();
