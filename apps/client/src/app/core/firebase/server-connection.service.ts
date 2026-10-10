import { inject, Injectable } from "@angular/core";
import { doc, getDocFromServer } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "./firebase.providers";
import { ConnectionRequiredError, offlineMessage } from "./connection-required";

/** How long the server check waits for an answer before it counts the device as offline. */
export const SERVER_CHECK_TIMEOUT_MS = 5000;

@Injectable({
  providedIn: "root"
})
export class ServerConnectionService {
  private readonly firestore = inject(FIRESTORE);
  private readonly auth = inject(FIREBASE_AUTH);

  /**
   * Whether the Firestore server answers now. navigator.onLine is not reliable (it is true on a
   * network with no internet), so this reads the user's own users document from the server, which
   * offline fails at once with "unavailable". Any other answer, even a refusal, means it answered.
   */
  public async isReachable(timeoutMs = SERVER_CHECK_TIMEOUT_MS): Promise<boolean> {
    const ref = doc(this.firestore, "users", this.auth.currentUser?.uid ?? "connection-check");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>(resolve => timer = setTimeout(() => resolve(false), timeoutMs));
    const answered = getDocFromServer(ref).then(
      () => true,
      (error: { code?: string }) => error?.code !== "unavailable"
    );
    try {
      return await Promise.race([answered, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolves when the server answers; otherwise rejects with a ConnectionRequiredError whose
   * message names the action, for example "You're offline. Connect to the internet to log out."
   */
  public async requireServer(action: string): Promise<void> {
    if (!await this.isReachable()) {
      throw new ConnectionRequiredError(offlineMessage(action));
    }
  }
}
