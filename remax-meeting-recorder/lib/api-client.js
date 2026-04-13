/**
 * RE/MAX CRM API Client for Chrome Extension
 * Handles communication with the backend API
 */

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host';

/** Get auth token from extension storage */
async function getToken() {
  const result = await chrome.storage.local.get(['auth_token']);
  return result.auth_token || null;
}

/** Set auth token in extension storage */
export async function setToken(token) {
  await chrome.storage.local.set({ auth_token: token });
}

/** Get stored user profile */
export async function getProfile() {
  const result = await chrome.storage.local.get(['user_profile']);
  return result.user_profile || null;
}

/** Set user profile */
export async function setProfile(profile) {
  await chrome.storage.local.set({ user_profile: profile });
}

/** Check if user is authenticated */
export async function isAuthenticated() {
  const token = await getToken();
  return !!token;
}

/** Make an authenticated API request */
async function apiRequest(path, options = {}) {
  const token = await getToken();
  if (!token) throw new Error('No autenticado. Inicia sesión primero.');

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return response.json();
}

/** Search candidates by name or email */
export async function searchCandidates(query) {
  return apiRequest(`/api/meetings/candidates/search?q=${encodeURIComponent(query)}`);
}

/** Upload recording + transcript to CRM */
export async function uploadMeeting({ candidateId, audioBlob, transcript, duration, platform }) {
  const token = await getToken();
  if (!token) throw new Error('No autenticado');

  const formData = new FormData();
  formData.append('audio', audioBlob, `meeting-${Date.now()}.webm`);
  formData.append('candidate_id', candidateId);
  formData.append('transcript', transcript);
  formData.append('duration', String(Math.round(duration)));
  formData.append('platform', platform || 'google_meet');

  const response = await fetch(`${API_BASE}/api/meetings/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${text}`);
  }

  return response.json();
}

/** Logout - clear stored credentials */
export async function logout() {
  await chrome.storage.local.remove(['auth_token', 'user_profile']);
}
