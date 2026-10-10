import { inject, Injectable } from "@angular/core";
import { clearIndexedDbPersistence, Firestore, waitForPendingWrites } from "firebase/firestore";
import { FIRESTORE } from "./firebase.providers";
import { ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";
import { FirestoreStorage } from "../database/firestore-storage";

/**
 * BroadcastChannel that tells the other open tabs of this browser to reload: an import or restore
 * replaced an account's data, or Log out, Sign in or an account deletion changed the account. Before
 * such an account change it also asks them to send their queued changes (flush).
 */
export const DATA_REPLACED_CHANNEL = "loa-checklist:data-replaced";

/** Tells this tab's own messages apart: a BroadcastChannel also reaches other listeners in the same tab. */
export const TAB_ID = `${Date.now()}-${Math.random()}`;

/**
 * localStorage key set from an account change until a page load has cleared the Firestore data
 * saved on this device. Its value is a ClearRequest; "true" from an older version counts as ready.
 */
export const CLEAR_LOCAL_DATA_KEY = "loa-checklist:clear-local-data";

/** How long an account change waits for this device's queued changes to reach the server. */
export const PENDING_WRITES_TIMEOUT_MS = 10000;

/** How long the other tabs get to send their queued changes before this tab waits for the server. */
export const OTHER_TABS_FLUSH_MS = 300;

/**
 * How long the start of the app waits for the saved data to be deleted, and for an account change
 * in another tab to finish, before it goes on.
 */
export const CLEAR_TIMEOUT_MS = 5000;

/** Failed clears before the request is dropped: while it is set, no guest account is started. */
export const MAX_CLEAR_ATTEMPTS = 3;

/** Web Lock held while a starting tab checks the request and clears, so two tabs never both clear. */
const CLEAR_LOCK = "loa-checklist:clear-local-data";

/**
 * The clear request. pending: the account is still changing in some tab, so a tab that starts now
 * waits (it would load the old account's data). ready: the account has changed; clear on load.
 */
export interface ClearRequest {
  state: "pending" | "ready";
  attempts: number;
}

/** The clear request saved in this browser, or null when there is none. */
export function readClearRequest(): ClearRequest | null {
  let value: string | null;
  try {
    value = localStorage.getItem(CLEAR_LOCAL_DATA_KEY);
  } catch {
    return null;
  }
  if (value === null) {
    return null;
  }
  try {
    const request = JSON.parse(value) as Partial<ClearRequest>;
    return {
      state: request.state === "pending" ? "pending" : "ready",
      attempts: typeof request.attempts === "number" ? request.attempts : 0
    };
  } catch {
    return { state: "ready", attempts: 0 };
  }
}

function writeClearRequest(request: ClearRequest | null): void {
  try {
    if (request) {
      localStorage.setItem(CLEAR_LOCAL_DATA_KEY, JSON.stringify(request));
    } else {
      localStorage.removeItem(CLEAR_LOCAL_DATA_KEY);
    }
  } catch {
    // Storage blocked: Firestore cannot keep data in IndexedDB either.
  }
}

/** True between an account change and the page load that clears this device's saved data. */
export function localDataClearRequested(): boolean {
  return readClearRequest() !== null;
}

function resolveAfter(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** The request once it is no longer pending, or the still pending one after CLEAR_TIMEOUT_MS. */
async function waitWhilePending(): Promise<ClearRequest | null> {
  const deadline = Date.now() + CLEAR_TIMEOUT_MS;
  let request = readClearRequest();
  while (request?.state === "pending" && Date.now() < deadline) {
    await resolveAfter(100);
    request = readClearRequest();
  }
  return request;
}

/** Runs task under CLEAR_LOCK where the browser has Web Locks, otherwise directly. */
function withClearLock(task: () => Promise<void>): Promise<void> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks ? locks.request(CLEAR_LOCK, task) : task();
}

/**
 * Deletes this browser's Firestore data when Log out, Sign in or an account deletion asked for it.
 * Runs as an app initializer, so before anything reads Firestore: clearing is only allowed before
 * the instance starts. All tabs share one database, and the SDK stops the other tabs' instances
 * when it is deleted, so the first tab to start clears it for all; the lock makes the later ones
 * find the request gone. A tab that starts while another tab is still changing the account waits
 * for that change, so it does not load the old account's data into the cleared database.
 *
 * The request is removed only once the data is deleted, so a failed clear is tried again on the
 * next load, up to MAX_CLEAR_ATTEMPTS times. The app starts after CLEAR_TIMEOUT_MS at most.
 */
export async function clearRequestedLocalData(firestore: Firestore): Promise<void> {
  await withClearLock(async () => {
    // Still pending after the wait: the tab that asked was closed during the change. Clear anyway.
    const request = await waitWhilePending();
    if (!request) {
      return;
    }
    const cleared = clearIndexedDbPersistence(firestore).then(
      () => writeClearRequest(null),
      (error: unknown) => {
        console.error("Could not clear the data saved on this device:", error);
        const attempts = request.attempts + 1;
        writeClearRequest(attempts < MAX_CLEAR_ATTEMPTS ? { state: "ready", attempts } : null);
      }
    );
    await Promise.race([cleared, resolveAfter(CLEAR_TIMEOUT_MS)]);
  });
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
   * Sends every change made on this device and waits until the server has it, so none is lost or
   * sent as the wrong user. The other open tabs are asked to send their queued changes too. From
   * here on no new change is written (holdWrites): one made during the wait could not be waited
   * for. The caller changes the account next, or calls cancelClear when that fails. Rejects with
   * a ConnectionRequiredError offline, or when the changes do not reach the server in time; writing
   * then resumes.
   *
   * Args:
   *   action: what needs it, for the message, for example "log out".
   */
  public async syncBeforeAccountChange(action: string): Promise<void> {
    await this.connection.requireServer(action);
    FirestoreStorage.holdWrites();
    try {
      FirestoreStorage.flushPending();
      if (this.broadcast({ flush: true, tabId: TAB_ID })) {
        // Their changes go into the write queue the tabs share, which waitForPendingWrites covers.
        await resolveAfter(OTHER_TABS_FLUSH_MS);
      }
      const synced = await Promise.race([
        waitForPendingWrites(this.firestore).then(() => true),
        resolveAfter(PENDING_WRITES_TIMEOUT_MS).then(() => false)
      ]);
      if (!synced) {
        throw new ConnectionRequiredError(`Your latest changes have not reached the server yet. Stay online and try to ${action} again in a moment.`);
      }
    } catch (error) {
      FirestoreStorage.resumeWrites();
      throw error;
    }
  }

  /**
   * Stops writes and asks the next page load to delete the data saved on this device. Call it right
   * before the signed-in account changes, and announceCleared once it has changed. While the
   * request is set, no guest account is started (see AuthService), in this tab or the others.
   */
  public requestClear(): void {
    FirestoreStorage.pauseWrites();
    writeClearRequest({ state: "pending", attempts: 0 });
  }

  /**
   * Marks the account change as done and tells the other open tabs to reload, which clears the data
   * saved on this device. Only after the change: a tab that reloaded before it would start with the
   * old account, and could load its data again or write its deleted documents back.
   */
  public announceCleared(): void {
    writeClearRequest({ state: "ready", attempts: 0 });
    this.broadcast({ cleared: true, tabId: TAB_ID });
  }

  /** Undoes syncBeforeAccountChange and requestClear when the account change failed and the same account stays signed in. */
  public cancelClear(): void {
    writeClearRequest(null);
    FirestoreStorage.resumeWrites();
  }

  /** A method of its own so tests can replace it (jsdom cannot reload). */
  public reloadPage(): void {
    window.location.reload();
  }

  /** Posts a message to the other tabs; false where the browser has no BroadcastChannel. */
  private broadcast(message: { flush?: true, cleared?: true, tabId: string }): boolean {
    if (typeof BroadcastChannel === "undefined") {
      return false;
    }
    const channel = new BroadcastChannel(DATA_REPLACED_CHANNEL);
    channel.postMessage(message);
    channel.close();
    return true;
  }
}
