import { inject, Injectable } from "@angular/core";
import { FIRESTORE_HOST_URL } from "./firebase.providers";
import { ConnectionRequiredError, offlineMessage } from "./connection-required";

/** How long the server check waits for an answer before it counts the device as offline. */
export const SERVER_CHECK_TIMEOUT_MS = 5000;

@Injectable({
  providedIn: "root"
})
export class ServerConnectionService {
  private readonly hostUrl = inject(FIRESTORE_HOST_URL);

  /**
   * Whether the Firestore server answers now. navigator.onLine false means offline for sure, but
   * true is not proof (a network with no internet). A Firestore read from the server is no proof
   * either: getDocFromServer answers from an open listener without the network. So this makes a
   * real request to the Firestore host; no-cors, because only reaching it matters, not the reply.
   */
  public async isReachable(timeoutMs = SERVER_CHECK_TIMEOUT_MS): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return false;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>(resolve => timer = setTimeout(() => resolve(false), timeoutMs));
    const answered = fetch(`${this.hostUrl}/`, { mode: "no-cors", cache: "no-store" }).then(() => true, () => false);
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
