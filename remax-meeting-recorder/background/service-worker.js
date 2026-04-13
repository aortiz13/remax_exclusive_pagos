/**
 * RE/MAX Meeting Recorder — Background Service Worker
 * Manages the recording lifecycle and offscreen document
 */

// ─── State Machine ────────────────────────────────────────────────
let recordingState = 'IDLE'; // IDLE | RECORDING | PROCESSING | DONE | ERROR
let currentCandidateId = null;
let recordingStartTime = null;

// ─── Message Handler ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {
        case 'GET_STATE':
          sendResponse({ state: recordingState, candidateId: currentCandidateId, startTime: recordingStartTime });
          break;

        case 'START_RECORDING':
          await startRecording(msg.candidateId);
          sendResponse({ ok: true, state: recordingState });
          break;

        case 'STOP_RECORDING':
          await stopRecording();
          sendResponse({ ok: true, state: recordingState });
          break;

        case 'RECORDING_COMPLETE':
          // Sent from offscreen document when recording data is ready
          recordingState = 'PROCESSING';
          broadcastState();
          sendResponse({ ok: true });
          break;

        case 'UPLOAD_COMPLETE':
          recordingState = 'DONE';
          broadcastState();
          // Reset after a few seconds
          setTimeout(() => {
            recordingState = 'IDLE';
            currentCandidateId = null;
            recordingStartTime = null;
            broadcastState();
          }, 5000);
          sendResponse({ ok: true });
          break;

        case 'UPLOAD_ERROR':
          recordingState = 'ERROR';
          broadcastState();
          sendResponse({ ok: true });
          break;

        case 'RESET':
          recordingState = 'IDLE';
          currentCandidateId = null;
          recordingStartTime = null;
          await closeOffscreen();
          broadcastState();
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (err) {
      console.error('[SW] Error:', err);
      recordingState = 'ERROR';
      broadcastState();
      sendResponse({ error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});

// ─── Recording Control ───────────────────────────────────────────
async function startRecording(candidateId) {
  if (recordingState === 'RECORDING') throw new Error('Ya hay una grabación en curso');

  currentCandidateId = candidateId;
  recordingState = 'RECORDING';
  recordingStartTime = Date.now();

  // 1. Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No se encontró pestaña activa');

  // 2. Get a media stream ID for the tab
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

  // 3. Create the offscreen document if not already created
  await ensureOffscreen();

  // 4. Tell the offscreen document to start recording
  chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'START',
    streamId,
    candidateId,
    tabTitle: tab.title || 'Google Meet',
  });

  broadcastState();
}

async function stopRecording() {
  if (recordingState !== 'RECORDING') throw new Error('No hay grabación activa');

  // Tell the offscreen document to stop
  chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'STOP',
  });
}

// ─── Offscreen Document Management ──────────────────────────────
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Recording meeting audio from tab and microphone',
  });
}

async function closeOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) {
    await chrome.offscreen.closeDocument();
  }
}

// ─── Broadcast state to all extension pages ─────────────────────
function broadcastState() {
  chrome.runtime.sendMessage({
    action: 'STATE_UPDATE',
    state: recordingState,
    candidateId: currentCandidateId,
    startTime: recordingStartTime,
  }).catch(() => {}); // Popup might be closed
}
