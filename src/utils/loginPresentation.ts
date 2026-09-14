/** Presentation helpers only. Administrator authorization remains in AuthContext. */
export function loginDestination(requested: unknown): string {
  if (typeof requested !== "string") return "/dashboard";
  const pages = new Set([
    "/dashboard", "/profile", "/emergencies", "/map", "/residents",
    "/inhabitants", "/monitoring-reports", "/incident-heatmap", "/announcements",
    "/reports", "/responders", "/directory", "/rescue-reports", "/audit",
  ]);
  if (pages.has(requested) || /^\/emergencies\/[A-Za-z0-9_-]+$/.test(requested)) return requested;
  return "/dashboard";
}

export function friendlyLoginError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : "";
  const reason = `${code} ${message}`;
  if (/auth\/(invalid-credential|invalid-login-credentials|user-not-found|wrong-password)/.test(reason)) {
    return "The email or password is incorrect. Please try again.";
  }
  if (reason.includes("auth/user-disabled")) return "This account is disabled. Contact your system administrator for assistance.";
  if (reason.includes("auth/too-many-requests")) return "Too many sign in attempts. Please wait a while before trying again.";
  if (reason.includes("auth/invalid-email")) return "Enter a valid email address.";
  if (reason.includes("auth/network-request-failed")) return "Unable to connect. Check your internet connection and try again.";
  return "We could not sign you in. Please try again. If the problem continues, contact your system administrator.";
}

export function friendlyAccessError(message: string | null | undefined): string {
  if (!message) return "";
  if (message.includes("no active administrator record")) {
    return "This account does not have active administrator access. Contact your system administrator for assistance.";
  }
  return "We could not verify your administrator access. Please contact your system administrator for assistance.";
}
