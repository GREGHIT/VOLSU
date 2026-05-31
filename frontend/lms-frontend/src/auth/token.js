const TOKEN_KEY = "lms_token";
const USER_KEY = "lms_user";
const USER_EVENT = "lms-user-changed";

function emitUserChange() {
  window.dispatchEvent(new CustomEvent(USER_EVENT));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitUserChange();
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
  emitUserChange();
}

export function clearAuth() {
  clearToken();
  clearUser();
}

export const USER_CHANGED_EVENT = USER_EVENT;
