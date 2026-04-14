/**
 * REMAX Meeting Recorder — Service Worker (Background)
 * Manages tab capture, offscreen document, and recording lifecycle
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host/api';

// ─── State ───────────────────────────────────────────────────────
let recordingState = 'idle'; // idle | recording | uploading | done | error
let recordingTabId = null;
let recordingStartTime = 0;
let offscreenReady = false;

// ─── Offscreen Document Management ──────────────────────────────
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Recording tab audio and microphone for meeting transcription'
  });
  offscreenReady = true;
}

async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
  } catch { /* already closed */ }
  offscreenReady = false;
}

// ─── Start Recording ────────────────────────────────────────────
async function startRecording(tabId) {
  if (recordingState === 'recording') {
    console.warn('[SW] Already recording');
    return { success: false, error: 'Already recording' };
  }

  try {
    // 1. Get the media stream ID for this tab
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

    // 2. Ensure offscreen document is running
    await ensureOffscreenDocument();

    // 3. Tell offscreen to start capturing
    await chrome.runtime.sendMessage({
      type: 'start-capture',
      target: 'offscreen',
      streamId: streamId,
      tabId: tabId
    });

    recordingState = 'recording';
    recordingTabId = tabId;
    recordingStartTime = Date.now();

    // Update badge
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

    console.log('[SW] ✅ Recording started for tab', tabId);
    return { success: true };
  } catch (err) {
    console.error('[SW] Failed to start recording:', err);
    recordingState = 'error';
    return { success: false, error: err.message };
  }
}

// ─── Stop Recording ─────────────────────────────────────────────
async function stopRecording() {
  if (recordingState !== 'recording') {
    return { success: false, error: 'Not recording' };
  }

  try {
    // Tell offscreen to stop and return the recording
    await chrome.runtime.sendMessage({
      type: 'stop-capture',
      target: 'offscreen'
    });

    recordingState = 'idle';
    recordingTabId = null;

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    console.log('[SW] ⏹ Recording stopped');
    return { success: true };
  } catch (err) {
    console.error('[SW] Failed to stop recording:', err);
    return { success: false, error: err.message };
  }
}

// ─── Upload Recording ───────────────────────────────────────────
async function uploadRecording(audioBase64, duration, metadata) {
  recordingState = 'uploading';

  try {
    const token = (await chrome.storage.local.get('authToken')).authToken;
    if (!token) throw new Error('No auth token');

    // Convert base64 → blob
    const byteChars = atob(audioBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'audio/webm' });

    // Create FormData
    const formData = new FormData();
    formData.append('audio', blob, `recording-${Date.now()}.webm`);
    formData.append('duration', String(Math.round(duration)));
    formData.append('platform', 'google_meet');
    formData.append('source', 'chrome_extension');
    if (metadata?.candidateId) formData.append('candidate_id', metadata.candidateId);
    if (metadata?.meetingTitle) formData.append('meeting_title', metadata.meetingTitle);

    const resp = await fetch(`${API_BASE}/meeting-bot/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Upload failed');
    }

    const result = await resp.json();
    recordingState = 'done';
    console.log('[SW] ✅ Upload complete:', result);
    return { success: true, data: result };
  } catch (err) {
    console.error('[SW] Upload error:', err);
    recordingState = 'error';
    return { success: false, error: err.message };
  }
}

// ─── Message Handler ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle messages from popup
  if (msg.target === 'service-worker') {
    switch (msg.type) {
      case 'start-recording':
        startRecording(msg.tabId).then(sendResponse);
        return true; // async

      case 'stop-recording':
        stopRecording().then(sendResponse);
        return true;

      case 'upload-recording':
        uploadRecording(msg.audioBase64, msg.duration, msg.metadata).then(sendResponse);
        return true;

      case 'get-state':
        sendResponse({
          state: recordingState,
          tabId: recordingTabId,
          startTime: recordingStartTime,
          elapsed: recordingState === 'recording' ? Date.now() - recordingStartTime : 0
        });
        return false;
    }
  }

  // Handle messages from offscreen
  if (msg.from === 'offscreen') {
    switch (msg.type) {
      case 'recording-complete':
        // Forward to popup
        chrome.runtime.sendMessage({
          type: 'recording-data',
          target: 'popup',
          audioBase64: msg.audioBase64,
          duration: msg.duration
        }).catch(() => {}); // popup might be closed
        break;

      case 'recording-error':
        recordingState = 'error';
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
        break;
    }
  }
});

// ─── Tab Close Detection ────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === recordingTabId && recordingState === 'recording') {
    console.log('[SW] Recording tab closed, stopping...');
    stopRecording();
  }
});

// ─── Extension Install ──────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SW] REMAX Meeting Recorder installed');
  chrome.action.setBadgeText({ text: '' });
});
