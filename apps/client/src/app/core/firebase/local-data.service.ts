import { inject, Injectable } from "@angular/core";
import { clearIndexedDbPersistence, Firestore, waitForPendingWrites } from "firebase/firestore";
import { FIRESTORE } from "./firebase.providers";
import { ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";
import { FirestoreStorage } from "../database/firestore-storage";

/**
 * BroadcastChannel that tells the other open tabs of this browser to reload: an import or restore
 * replaced an account's data, or Log out, Sign in or an account deletion changed the account.
 */
export const DATA_REPLACED_CHANNEL = "loa-checklist:data-replaced";

/** Tells this tab's own messages apart: a BroadcastChannel also reaches other listeners in the same tab. */
export const TAB_ID = `${Date.now()}-${Math.random()}`;

/** localStorage key set until the next page load has cleared the Firestore data saved on this device. */
export const CLEAR_LOCAL_DATA_KEY = "loa-checklist:clear-local-data";

/** How long an account change waits for this device's queued changes to reach the server. */
export const PENDING_WRITES_TIMEOUT_MS = 10000;

/** How long the start of the app waits for the saved data to be deleted before it goes on. */
const CLEAR_TIMEOUT_MS = 5000;

/** True between an account change and the page load that clears this device's saved data. */
export function localDataClearRequested(): boolean {
  try {
    return localStorage.getItem(CLEAR_LOCAL_DATA_KEY) === "true";
  } catch {
    return false;
  }
}

function resolveAfter(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deletes this browser's Firestore data when Log out, Sign in or an account deletion asked for it.
 * Runs as an app initializer, so before anything reads Firestore: clearing is only allowed before
 * the instance starts. The request is removed first, so a tab that starts while this one clears
 * does not delete the data again after this tab has started using it.
 */
export async function clearRequestedLocalData(firestore: Firestore): Promise<void> {
  try {
    localStorage.removeItem(CLEAR_LOCAL_DATA_KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
  try {
    await Promise.race([clearIndexedDbPersistence(firestore), resolveAfter(CLEAR_TIMEOUT_MS)]);
  } catch (error) {
    console.error("Could not clear the data saved on this device:", error);
  }
}

/**
 * Keeps the previous account's data off this device: Log out, Sign in and account deletion send
 * every change first, then the next page load deletes the Firestore data saved in this browser.
 */
@Injectable({
  providedIn: "root"
})
export class LocalDataService {
  private readonly firestore = inject(FIRESTORE);
  private readonly connection = inject(ServerConnectionService);

  /**
   * Sends this page's queued changes and waits until the server has every change made on this
   * device, so none is lost or sent as the wrong user. Rejects with a ConnectionRequiredError
   * offline, or when the changes do not reach the server in time.
   *
   * Args:
   *   action: what needs it, for the message, for example "log out".
   */
  public async syncBeforeAccountChange(action: string): Promise<void> {
    await this.connection.requireServer(action);
    FirestoreStorage.flushPending();
    const synced = await Promise.race([
      waitForPendingWrites(this.firestore).then(() => true),
      resolveAfter(PENDING_WRITES_TIMEOUT_MS).then(() => false)
    ]);
    if (!synced) {
      throw new ConnectionRequiredError(`Your latest changes have not reached the server yet. Stay online and try to ${action} again in a moment.`);
    }
  }

  /**
   * Stops writes, asks the next page load to delete the data saved on this device, and tells the
   * other open tabs to reload. Call it right before the signed-in account changes; while it is
   * pending, no guest account is started (see AuthService).
   */
  public clearOnNextLoad(): void {
    FirestoreStorage.pauseWrites();
    try {
      localStorage.setItem(CLEAR_LOCAL_DATA_KEY, "true");
    } catch {
      // Storage blocked: Firestore cannot keep data in IndexedDB either.
    }
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(DATA_REPLACED_CHANNEL);
      channel.postMessage({ cleared: true, tabId: TAB_ID });
      channel.close();
    }
  }

  /** Undoes clearOnNextLoad when the account change failed and the same account stays signed in. */
  public cancelClear(): void {
    try {
      localStorage.removeItem(CLEAR_LOCAL_DATA_KEY);
    } catch {
      // Storage blocked: nothing was saved.
    }
    FirestoreStorage.resumeWrites();
  }

  /** A method of its own so tests can replace it (jsdom cannot reload). */
  public reloadPage(): void {
    window.location.reload();
  }
}
