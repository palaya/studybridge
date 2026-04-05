import { api } from './client';

const SESSION_KEY = 'sb_session_start';

export function trackSessionStart() {
  const now = Date.now();
  sessionStorage.setItem(SESSION_KEY, String(now));
  api.trackEvent('session_start', { timestamp: new Date(now).toISOString() });
}

export function trackSessionEnd() {
  const startStr = sessionStorage.getItem(SESSION_KEY);
  if (!startStr) return;
  const durationMs = Date.now() - Number(startStr);
  api.trackEvent('session_end', {
    durationMs,
    durationSec: Math.round(durationMs / 1000),
  });
}

export function trackPageView(page) {
  api.trackEvent('page_view', { page, timestamp: new Date().toISOString() });
}

export function trackTaskComplete(taskType) {
  api.trackEvent('task_complete', { taskType, timestamp: new Date().toISOString() });
}

export function trackMissionComplete(completionRate) {
  api.trackEvent('mission_complete', { completionRate, timestamp: new Date().toISOString() });
}

export function initAnalytics() {
  trackSessionStart();

  window.addEventListener('beforeunload', trackSessionEnd);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackSessionEnd();
    } else if (document.visibilityState === 'visible') {
      trackSessionStart();
    }
  });
}
