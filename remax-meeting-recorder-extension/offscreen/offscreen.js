/**
 * REMAX Meeting Recorder — Offscreen Document
 * Handles actual audio capture, mixing, and recording.
 * Runs in a hidden DOM context so MediaRecorder and AudioContext work.
 */

let mediaRecorder = null;
let audioChunks = [];
let tabStream = null;
let micStream = null;
let audioContext = null;
let recordingStartTime = 0;

// ─── Start Capture ──────────────────────────────────────────────
async function startCapture(streamId) {
  try {
    console.log('[Offscreen] Starting capture with streamId:', streamId);

    // 1. Get tab audio stream via the streamId from tabCapture
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });
    console.log('[Offscreen] ✅ Tab audio stream acquired');

    // 2. Get microphone stream
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      console.log('[Offscreen] ✅ Microphone stream acquired');
    } catch (micErr) {
      console.warn('[Offscreen] ⚠️ Mic not available, recording tab audio only:', micErr.message);
      micStream = null;
    }

    // 3. Mix streams using AudioContext
    audioContext = new AudioContext({ sampleRate: 48000 });
    const destination = audioContext.createMediaStreamDestination();

    // Add tab audio to mix
    const tabSource = audioContext.createMediaStreamSource(tabStream);
    tabSource.connect(destination);

    // IMPORTANT: Also connect tab audio to speakers so user can hear the meeting
    tabSource.connect(audioContext.destination);

    // Add mic audio to mix (if available)
    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      // Reduce mic volume slightly to avoid overpowering tab audio
      const micGain = audioContext.createGain();
      micGain.gain.value = 0.8;
      micSource.connect(micGain);
      micGain.connect(destination);
    }

    // 4. Record the mixed stream
    const mixedStream = destination.stream;
    audioChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[Offscreen] MediaRecorder stopped, processing...');
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const duration = (Date.now() - recordingStartTime) / 1000;

      // Convert to base64 to send via message
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        chrome.runtime.sendMessage({
          from: 'offscreen',
          type: 'recording-complete',
          audioBase64: base64,
          duration: duration
        });
        console.log(`[Offscreen] ✅ Recording complete: ${duration.toFixed(1)}s, ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
      };
      reader.readAsDataURL(blob);

      // Cleanup
      cleanup();
    };

    mediaRecorder.onerror = (e) => {
      console.error('[Offscreen] MediaRecorder error:', e.error);
      chrome.runtime.sendMessage({
        from: 'offscreen',
        type: 'recording-error',
        error: e.error?.message || 'Recording error'
      });
      cleanup();
    };

    // Start recording — collect data every 1 second
    mediaRecorder.start(1000);
    console.log('[Offscreen] 🔴 Recording started');

  } catch (err) {
    console.error('[Offscreen] Failed to start capture:', err);
    chrome.runtime.sendMessage({
      from: 'offscreen',
      type: 'recording-error',
      error: err.message
    });
    cleanup();
  }
}

// ─── Stop Capture ───────────────────────────────────────────────
function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    console.log('[Offscreen] Stopping MediaRecorder...');
    mediaRecorder.stop();
  } else {
    cleanup();
  }
}

// ─── Cleanup ────────────────────────────────────────────────────
function cleanup() {
  if (tabStream) {
    tabStream.getTracks().forEach(t => t.stop());
    tabStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  mediaRecorder = null;
  audioChunks = [];
}

// ─── Message Listener ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;

  switch (msg.type) {
    case 'start-capture':
      startCapture(msg.streamId);
      sendResponse({ success: true });
      break;

    case 'stop-capture':
      stopCapture();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

console.log('[Offscreen] Ready');
