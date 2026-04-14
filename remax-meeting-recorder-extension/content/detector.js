/**
 * Content Script — Google Meet Detector
 * Detects when user is in an active Google Meet call
 */

function detectMeetingState() {
  const url = window.location.href;

  // Only activate on actual meeting pages (not landing/lobby)
  const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;
  if (!meetRegex.test(url)) return;

  // Check if we're in an active call (has call controls)
  const hasCallEnd = !!document.querySelector('[data-call-ended]') === false &&
    (document.querySelector('button[aria-label*="Salir"]') ||
     document.querySelector('button[aria-label*="Leave"]') ||
     document.body.innerText.includes('call_end'));

  const title = document.title.replace('Meet: ', '').replace('Meet - ', '');

  chrome.runtime.sendMessage({
    from: 'content',
    type: 'meeting-state',
    inMeeting: hasCallEnd,
    meetingTitle: title,
    url: url
  }).catch(() => {}); // popup might not be open
}

// Check periodically
setInterval(detectMeetingState, 3000);

// Initial check
setTimeout(detectMeetingState, 1500);
