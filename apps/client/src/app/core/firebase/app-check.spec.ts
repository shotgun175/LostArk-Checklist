import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { FirebaseApp } from "firebase/app";
import { initAppCheck } from "./app-check";

jest.mock("firebase/app-check", () => ({
  initializeAppCheck: jest.fn(() => ({ kind: "app-check" })),
  ReCaptchaEnterpriseProvider: jest.fn()
}));

const app = { name: "[DEFAULT]" } as FirebaseApp;
const live = { useEmulators: false, recaptchaEnterpriseKey: "site-key", appCheckDebug: false };

describe("initAppCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = undefined;
  });

  it("starts App Check with reCAPTCHA Enterprise and token refresh", () => {
    expect(initAppCheck(app, live, "loa-checklist.web.app")).toEqual({ kind: "app-check" });
    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith("site-key");
    expect(initializeAppCheck).toHaveBeenCalledWith(app, expect.objectContaining({ isTokenAutoRefreshEnabled: true }));
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it("is skipped with the emulators or without a key", () => {
    expect(initAppCheck(app, { ...live, useEmulators: true }, "localhost")).toBeNull();
    expect(initAppCheck(app, { ...live, recaptchaEnterpriseKey: "" }, "loa-checklist.web.app")).toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it("turns on debug mode only on localhost and only with the flag", () => {
    initAppCheck(app, { ...live, appCheckDebug: true }, "loa-checklist.web.app");
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
    initAppCheck(app, live, "localhost");
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
    initAppCheck(app, { ...live, appCheckDebug: true }, "localhost");
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });
});
