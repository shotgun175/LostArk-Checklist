import { authErrorMessage, PASSWORD_RESET_SENT, passwordResetMessage, WRONG_CREDENTIALS } from "./auth-errors";

const err = (code: string) => ({ code, message: `Firebase: Error (${code}).` });

describe("authErrorMessage", () => {
  it.each([
    "auth/invalid-credential",
    "auth/invalid-login-credentials",
    "auth/wrong-password",
    "auth/user-not-found"
  ])("shows one generic message for %s, so it never tells which part was wrong", code => {
    expect(authErrorMessage(err(code))).toBe(WRONG_CREDENTIALS);
  });

  it.each([
    ["auth/email-already-in-use", "An account with this email already exists. Use Sign in instead."],
    ["auth/credential-already-in-use", "An account with this email already exists. Use Sign in instead."],
    ["auth/invalid-email", "That email address is not valid."],
    ["auth/weak-password", "Choose a password with at least 6 characters."],
    ["auth/too-many-requests", "Too many attempts. Wait a few minutes, then try again."],
    ["auth/network-request-failed", "Could not reach the server. Check your connection and try again."],
    ["auth/requires-recent-login", "For your security, enter your password again."],
    ["auth/user-disabled", "This account has been disabled."]
  ])("maps %s", (code, text) => {
    expect(authErrorMessage(err(code))).toBe(text);
  });

  it.each([null, undefined, "boom", 42, {}, { code: 7 }, err("auth/something-new")])(
    "falls back to a generic message for %p", value => {
      expect(authErrorMessage(value)).toBe("Something went wrong. Please try again.");
    });
});

describe("passwordResetMessage", () => {
  it("shows the neutral message when the email was sent or the account does not exist", () => {
    expect(passwordResetMessage(null)).toEqual({ ok: true, text: PASSWORD_RESET_SENT });
    expect(passwordResetMessage(err("auth/user-not-found"))).toEqual({ ok: true, text: PASSWORD_RESET_SENT });
    expect(PASSWORD_RESET_SENT).toBe("If an account exists, we sent a reset email.");
  });

  it("reports errors that mean nothing was sent", () => {
    expect(passwordResetMessage(err("auth/too-many-requests")))
      .toEqual({ ok: false, text: "Too many attempts. Wait a few minutes, then try again." });
    expect(passwordResetMessage(err("auth/network-request-failed")).ok).toBe(false);
  });
});
