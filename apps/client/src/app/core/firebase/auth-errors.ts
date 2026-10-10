import { ConnectionRequiredError } from "./connection-required";

export const WRONG_CREDENTIALS = "Email or password is incorrect.";
export const PASSWORD_RESET_SENT = "If an account exists, we sent a reset email.";
const GENERIC = "Something went wrong. Please try again.";
const EMAIL_TAKEN = "An account with this email already exists. Use Sign in instead.";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": WRONG_CREDENTIALS,
  "auth/invalid-login-credentials": WRONG_CREDENTIALS,
  "auth/wrong-password": WRONG_CREDENTIALS,
  "auth/user-not-found": WRONG_CREDENTIALS,
  "auth/email-already-in-use": EMAIL_TAKEN,
  "auth/credential-already-in-use": EMAIL_TAKEN,
  "auth/invalid-email": "That email address is not valid.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Could not reach the server. Check your connection and try again.",
  "auth/requires-recent-login": "For your security, enter your password again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/provider-already-linked": "This browser's account is already registered. Use Sign in instead.",
  "auth/operation-not-allowed": "This sign-in method is turned off.",
  "auth/firebase-app-check-token-is-invalid": "The security check failed. Reload the page and try again."
};

/** The Firebase error code of an error, or null when it has none. */
export function authErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

/**
 * A plain message for a Firebase Auth error. An action refused because it needs the server keeps
 * its own message; unknown errors get a generic message.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ConnectionRequiredError) {
    return error.message;
  }
  const code = authErrorCode(error);
  return (code && MESSAGES[code]) || GENERIC;
}

/**
 * What to tell the user after a password reset request. With Email Enumeration Protection on,
 * Firebase sends the email only if the account exists and reports no difference, so success and
 * "no such user" both get the neutral message. Errors that mean nothing was sent are shown.
 */
export function passwordResetMessage(error: unknown): { ok: boolean; text: string } {
  if (error === null || error === undefined || authErrorCode(error) === "auth/user-not-found") {
    return { ok: true, text: PASSWORD_RESET_SENT };
  }
  return { ok: false, text: authErrorMessage(error) };
}
