/**
 * RE/MAX Meeting Recorder — Offscreen Recorder
 * Handles MediaRecorder, audio mixing, and upload to backend
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host';

let mediaRecorder = null;
let audioChunks = [];
let tabStream = null;
let micStream = null;
let mixedStream = null;
let audioContext = null;
let candidateId = null;
let tabTitle = '';

// ─── Message listener ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;

  switch (msg.action) {
    case 'START':
      handleStart(msg.streamId, msg.candidateId, msg.tabTitle);
      break;
    case 'STOP':
      handleStop();
      break;
  }
});

// ─── Start Recording ─────────────────────────────────────────────
async function handleStart(streamId, candId, title) {
  candidateId = candId;
  tabTitle = title;
  audioChunks = [];

  try {
    // 1. Capture tab audio using the stream ID from tabCapture
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // 2. Capture microphone
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch (micErr) {
      console.warn('[Recorder] Mic not available, recording tab audio only:', micErr.message);
      micStream = null;
    }

    // 3. Mix the two audio streams using Web Audio API
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const tabSource = audioContext.createMediaStreamSource(tabStream);
    tabSource.connect(destination);

    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);
    }

    mixedStream = destination.stream;

    // 4. Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Notify background that recording stopped
      chrome.runtime.sendMessage({ action: 'RECORDING_COMPLETE' });

      // Build the final blob
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];

      // Upload to backend
      await uploadRecording(audioBlob);

      // Cleanup streams
      cleanup();
    };

    // Handle stream ending (user closes Meet tab, etc.)
    tabStream.getAudioTracks().forEach(track => {
      track.onended = () => {
        console.log('[Recorder] Tab audio track ended');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      };
    });

    // Start recording — collect data every 1 second
    mediaRecorder.start(1000);
    console.log('[Recorder] ✅ Recording started');

  } catch (err) {
    console.error('[Recorder] Error starting:', err);
    cleanup();
    chrome.runtime.sendMessage({ action: 'UPLOAD_ERROR', error: err.message });
  }
}

// ─── Stop Recording ──────────────────────────────────────────────
function handleStop() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// ─── Upload Recording ────────────────────────────────────────────
async function uploadRecording(audioBlob) {
  try {
    console.log(`[Recorder] Uploading ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB...`);

    const { auth_token } = await chrome.storage.local.get(['auth_token']);
    if (!auth_token) throw new Error('No auth token');

    const formData = new FormData();
    formData.append('audio', audioBlob, `meeting-${Date.now()}.webm`);
    formData.append('candidate_id', candidateId);
    formData.append('platform', detectPlatform(tabTitle));

    const response = await fetch(`${API_BASE}/api/meetings/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth_token}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed (${response.status}): ${text}`);
    }

    const result = await response.json();
    console.log('[Recorder] ✅ Upload successful:', result);

    chrome.runtime.sendMessage({
      action: 'UPLOAD_COMPLETE',
      meetingId: result.meeting?.id,
    });

  } catch (err) {
    console.error('[Recorder] Upload error:', err);
    chrome.runtime.sendMessage({
      action: 'UPLOAD_ERROR',
      error: err.message,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function detectPlatform(title) {
  if (title?.toLowerCase().includes('meet')) return 'google_meet';
  if (title?.toLowerCase().includes('zoom')) return 'zoom';
  if (title?.toLowerCase().includes('teams')) return 'teams';
  return 'other';
}

function cleanup() {
  if (tabStream) {
    tabStream.getTracks().forEach(t => t.stop());
    tabStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  mixedStream = null;
  mediaRecorder = null;
}
