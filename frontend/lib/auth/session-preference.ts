const sessionOnlyModeKey = "vidyasetu_session_only";
const activeBrowserSessionKey = "vidyasetu_active_browser_session";

export function setSessionPreference(rememberSession: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (rememberSession) {
    window.localStorage.removeItem(sessionOnlyModeKey);
    window.sessionStorage.removeItem(activeBrowserSessionKey);
    return;
  }

  // This is only a local retention preference. Authentication and authorization still use Supabase cookies and tokens.
  window.localStorage.setItem(sessionOnlyModeKey, "true");
  window.sessionStorage.setItem(activeBrowserSessionKey, "true");
}

export function shouldExpireSessionOnly() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.localStorage.getItem(sessionOnlyModeKey) === "true" &&
    window.sessionStorage.getItem(activeBrowserSessionKey) !== "true"
  );
}

export function clearSessionPreference() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionOnlyModeKey);
  window.sessionStorage.removeItem(activeBrowserSessionKey);
}
