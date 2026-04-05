const API_BASE = process.env.REACT_APP_API_URL || '';

const TOKEN_KEY = 'sb_token';
const USER_KEY = 'sb_user';

let token = localStorage.getItem(TOKEN_KEY);

export function setToken(t) {
  token = t;
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return token;
}

export function setStoredUser(u) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const isFormData = opts.body instanceof FormData;
  if (!isFormData && opts.method && opts.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({ error: 'parse_error' }));
  if (!res.ok) {
    const err = new Error(body.message || body.error || 'request_failed');
    err.code = body.error;
    err.status = res.status;
    throw err;
  }
  return body;
}

export const api = {
  registerAnonymous(timezone) {
    return request('/auth/register-anonymous', {
      method: 'POST',
      body: JSON.stringify({ timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
  },

  getTodayMission() {
    return request('/missions/today');
  },

  completeTask(taskId, body = {}) {
    return request(`/missions/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  uploadPhoto(file, subject) {
    const fd = new FormData();
    fd.append('image', file);
    if (subject) fd.append('subject', subject);
    return request('/learn/photo', { method: 'POST', body: fd });
  },

  tutorMessage(messages, opts = {}) {
    const body = { messages };
    if (opts.photoAnalysis != null && typeof opts.photoAnalysis === 'object') {
      body.photoAnalysis = opts.photoAnalysis;
    }
    if (opts.userIntent === 'explain_more' || opts.userIntent === 'dont_know') {
      body.userIntent = opts.userIntent;
    }
    const lc = opts.learningContext;
    if (lc != null && typeof lc === 'object' && !Array.isArray(lc)) {
      body.learningContext = {
        subject: typeof lc.subject === 'string' ? lc.subject : undefined,
        subTopic: typeof lc.subTopic === 'string' ? lc.subTopic : undefined,
      };
    }
    return request('/tutor/messages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  simplifySentence(sentence) {
    return request('/language/simplify', {
      method: 'POST',
      body: JSON.stringify({ sentence }),
    });
  },

  learnWord(word) {
    return request('/language/vocab/learn', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  readingChat(messages, opts = {}) {
    const body = { messages };
    if (opts.userIntent === 'explain_more' || opts.userIntent === 'dont_know') {
      body.userIntent = opts.userIntent;
    }
    return request('/language/reading-chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  readingApplication(mode, userAnswer) {
    return request('/language/reading-application', {
      method: 'POST',
      body: JSON.stringify({ mode, userAnswer }),
    });
  },

  getRecordsSummary() {
    return request('/records/summary');
  },

  trackEvent(eventType, props = {}) {
    return request('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ eventType, props }),
    }).catch(() => {});
  },
};
