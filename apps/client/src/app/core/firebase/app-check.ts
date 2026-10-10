import { FirebaseApp } from "firebase/app";
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

export interface AppCheckEnvironment {
  useEmulators: boolean;
  /** Public reCAPTCHA Enterprise site key; empty turns App Check off. */
  recaptchaEnterpriseKey: string;
  /** Lets localhost use a browser-generated debug token. Never true in production. */
  appCheckDebug: boolean;
}

declare global {
  // Read by the App Check SDK when it starts.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/**
 * Starts App Check before Auth or Firestore are used. Skipped with the emulators. With the debug
 * flag on localhost, the SDK generates a debug token, keeps it in this browser and prints it to
 * the console, to be registered in the Firebase console; no token is ever stored in the repo.
 */
export function initAppCheck(app: FirebaseApp, env: AppCheckEnvironment,
                             hostname: string = globalThis.location?.hostname ?? ""): AppCheck | null {
  if (env.useEmulators || !env.recaptchaEnterpriseKey) {
    return null;
  }
  if (env.appCheckDebug && LOCAL_HOSTS.includes(hostname)) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.recaptchaEnterpriseKey),
    isTokenAutoRefreshEnabled: true
  });
}
