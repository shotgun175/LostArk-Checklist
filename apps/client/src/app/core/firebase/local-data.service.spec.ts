import { TestBed } from "@angular/core/testing";
import { clearIndexedDbPersistence, waitForPendingWrites } from "firebase/firestore";
import { FIRESTORE } from "./firebase.providers";
import {
  CLEAR_LOCAL_DATA_KEY,
  CLEAR_TIMEOUT_MS,
  clearRequestedLocalData,
  DATA_REPLACED_CHANNEL,
  LocalDataService,
  localDataClearRequested,
  MAX_CLEAR_ATTEMPTS,
  OTHER_TABS_FLUSH_MS,
  PENDING_WRITES_TIMEOUT_MS,
  readClearRequest,
  TAB_ID
} from "./local-data.service";
import { ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";
import { FirestoreStorage } from "../database/firestore-storage";

const calls: string[] = [];

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  clearIndexedDbPersistence: jest.fn(() => { calls.push("clear"); return Promise.resolve(); }),
  waitForPendingWrites: jest.fn(() => { calls.push("waitForPendingWrites"); return Promise.resolve(); })
}));
jest.mock("./server-connection.service", () => ({ ServerConnectionService: class {} }));
jest.mock("../database/firestore-storage", () => ({
  FirestoreStorage: {
    flushPending: jest.fn(() => calls.push("flushPending")),
    holdWrites: jest.fn(() => calls.push("holdWrites")),
    pauseWrites: jest.fn(() => calls.push("pauseWrites")),
    resumeWrites: jest.fn(() => calls.push("resumeWrites"))
  }
}));

/** jsdom has no BroadcastChannel: records what is posted while installed. */
function fakeChannel(): { posted: { name: string, data: unknown }[], remove: () => void } {
  const posted: { name: string, data: unknown }[] = [];
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = class {
    constructor(private name: string) {}
    postMessage(data: unknown): void {
      calls.push("broadcast");
      posted.push({ name: this.name, data });
    }
    close(): void {
      // Nothing to release.
    }
  };
  return { posted, remove: () => delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel };
}

describe("LocalDataService", () => {
  let connection: { requireServer: jest.Mock };
  let service: LocalDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    localStorage.clear();
    connection = { requireServer: jest.fn(() => { calls.push("requireServer"); return Promise.resolve(); }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: ServerConnectionService, useValue: connection }
      ]
    });
    service = TestBed.inject(LocalDataService);
  });

  afterEach(() => jest.useRealTimers());

  describe("syncBeforeAccountChange", () => {
    it("checks the server, stops new writes, sends queued field changes, then waits for every pending write", async () => {
      await service.syncBeforeAccountChange("log out");
      expect(connection.requireServer).toHaveBeenCalledWith("log out");
      expect(calls).toEqual(["requireServer", "holdWrites", "flushPending", "waitForPendingWrites"]);
    });

    it("asks the other tabs to send their queued changes and gives them a moment before waiting", async () => {
      jest.useFakeTimers();
      const channel = fakeChannel();
      const done = service.syncBeforeAccountChange("sign in");
      await jest.advanceTimersByTimeAsync(OTHER_TABS_FLUSH_MS - 1);
      expect(calls).toEqual(["requireServer", "holdWrites", "flushPending", "broadcast"]);
      await jest.advanceTimersByTimeAsync(1);
      await done;
      channel.remove();
      expect(calls[calls.length - 1]).toBe("waitForPendingWrites");
      expect(channel.posted).toEqual([{ name: DATA_REPLACED_CHANNEL, data: { flush: true, tabId: TAB_ID } }]);
    });

    it("refuses offline without touching the queue", async () => {
      connection.requireServer.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to log out."));
      await expect(service.syncBeforeAccountChange("log out")).rejects.toThrow("You're offline");
      expect(FirestoreStorage.flushPending).not.toHaveBeenCalled();
      expect(FirestoreStorage.holdWrites).not.toHaveBeenCalled();
    });

    it("refuses rather than drop changes that do not reach the server in time, and writes again", async () => {
      jest.useFakeTimers();
      jest.mocked(waitForPendingWrites).mockReturnValueOnce(new Promise(() => undefined));
      const result = service.syncBeforeAccountChange("sign in");
      const outcome = expect(result).rejects.toThrow("Your latest changes have not reached the server yet. Stay online and try to sign in again in a moment.");
      await jest.advanceTimersByTimeAsync(PENDING_WRITES_TIMEOUT_MS);
      await outcome;
      expect(calls[calls.length - 1]).toBe("resumeWrites");
    });
  });

  it("requestClear stops writes and leaves a pending request, without telling the other tabs yet", () => {
    const channel = fakeChannel();
    service.requestClear();
    channel.remove();
    expect(FirestoreStorage.pauseWrites).toHaveBeenCalled();
    expect(localDataClearRequested()).toBe(true);
    expect(readClearRequest()).toEqual({ state: "pending", attempts: 0 });
    expect(channel.posted).toEqual([]);
  });

  it("announceCleared marks the request ready and tells the other tabs", () => {
    const channel = fakeChannel();
    service.requestClear();
    service.announceCleared();
    channel.remove();
    expect(readClearRequest()).toEqual({ state: "ready", attempts: 0 });
    expect(channel.posted).toEqual([{ name: DATA_REPLACED_CHANNEL, data: { cleared: true, tabId: TAB_ID } }]);
  });

  it("cancelClear drops the request and writes again", () => {
    service.requestClear();
    service.cancelClear();
    expect(localDataClearRequested()).toBe(false);
    expect(FirestoreStorage.resumeWrites).toHaveBeenCalled();
  });
});

describe("clearRequestedLocalData (app initializer)", () => {
  const firestore = { kind: "firestore" } as never;
  const ready = (attempts = 0) => localStorage.setItem(CLEAR_LOCAL_DATA_KEY, JSON.stringify({ state: "ready", attempts }));
  const pending = () => localStorage.setItem(CLEAR_LOCAL_DATA_KEY, JSON.stringify({ state: "pending", attempts: 0 }));

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (navigator as { locks?: unknown }).locks;
  });

  it("deletes the saved Firestore data, then removes the request", async () => {
    ready();
    jest.mocked(clearIndexedDbPersistence).mockImplementationOnce(() => {
      // Still set while the delete runs: a failed delete must be tried again.
      expect(localDataClearRequested()).toBe(true);
      return Promise.resolve();
    });
    await clearRequestedLocalData(firestore);
    expect(clearIndexedDbPersistence).toHaveBeenCalledWith(firestore);
    expect(localDataClearRequested()).toBe(false);
  });

  it("treats a request saved by the previous version as ready", async () => {
    localStorage.setItem(CLEAR_LOCAL_DATA_KEY, "true");
    await clearRequestedLocalData(firestore);
    expect(clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
    expect(localDataClearRequested()).toBe(false);
  });

  it("lets the app start when the delete fails, and keeps the request so the next load tries again", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    ready();
    jest.mocked(clearIndexedDbPersistence).mockRejectedValueOnce(new Error("failed-precondition"));
    await expect(clearRequestedLocalData(firestore)).resolves.toBeUndefined();
    expect(readClearRequest()).toEqual({ state: "ready", attempts: 1 });
    expect(error).toHaveBeenCalledWith("Could not clear the data saved on this device:", expect.any(Error));
    error.mockRestore();
  });

  it("drops the request after the last failed attempt, so a guest account can start again", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    ready(MAX_CLEAR_ATTEMPTS - 1);
    jest.mocked(clearIndexedDbPersistence).mockRejectedValueOnce(new Error("failed-precondition"));
    await clearRequestedLocalData(firestore);
    expect(localDataClearRequested()).toBe(false);
    error.mockRestore();
  });

  it("starts the app after the wait when the delete hangs, and removes the request once it is done", async () => {
    jest.useFakeTimers();
    ready();
    let finish: () => void = () => undefined;
    jest.mocked(clearIndexedDbPersistence).mockReturnValueOnce(new Promise<void>(resolve => finish = resolve));
    const started = clearRequestedLocalData(firestore);
    await jest.advanceTimersByTimeAsync(CLEAR_TIMEOUT_MS);
    await started;
    expect(localDataClearRequested()).toBe(true);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(localDataClearRequested()).toBe(false);
  });

  describe("a tab that starts while another tab changes the account", () => {
    it("waits for the change, keeping the guest guard on, then clears", async () => {
      jest.useFakeTimers();
      // Another tab called requestClear and is signing out.
      pending();
      const started = clearRequestedLocalData(firestore);
      await jest.advanceTimersByTimeAsync(1000);
      expect(clearIndexedDbPersistence).not.toHaveBeenCalled();
      expect(localDataClearRequested()).toBe(true);
      // The other tab signed out and called announceCleared.
      ready();
      await jest.advanceTimersByTimeAsync(100);
      await started;
      expect(clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
      expect(localDataClearRequested()).toBe(false);
    });

    it("does not clear when the change failed and the request was dropped", async () => {
      jest.useFakeTimers();
      pending();
      const started = clearRequestedLocalData(firestore);
      await jest.advanceTimersByTimeAsync(500);
      localStorage.removeItem(CLEAR_LOCAL_DATA_KEY);
      await jest.advanceTimersByTimeAsync(100);
      await started;
      expect(clearIndexedDbPersistence).not.toHaveBeenCalled();
    });

    it("clears anyway when the change never finishes (that tab was closed)", async () => {
      jest.useFakeTimers();
      pending();
      const started = clearRequestedLocalData(firestore);
      await jest.advanceTimersByTimeAsync(CLEAR_TIMEOUT_MS + 100);
      await started;
      expect(clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
    });
  });

  it("clears once when two tabs start together: the second finds the request gone", async () => {
    // A Web Lock that runs one task at a time.
    let queue = Promise.resolve();
    (navigator as { locks?: unknown }).locks = {
      request: (_name: string, task: () => Promise<void>) => {
        const run = queue.then(task);
        queue = run.catch(() => undefined);
        return run;
      }
    };
    ready();
    await Promise.all([clearRequestedLocalData(firestore), clearRequestedLocalData(firestore)]);
    expect(clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
  });
});
