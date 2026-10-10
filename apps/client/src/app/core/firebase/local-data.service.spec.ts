import { TestBed } from "@angular/core/testing";
import { clearIndexedDbPersistence, waitForPendingWrites } from "firebase/firestore";
import { FIRESTORE } from "./firebase.providers";
import {
  CLEAR_LOCAL_DATA_KEY,
  clearRequestedLocalData,
  DATA_REPLACED_CHANNEL,
  LocalDataService,
  localDataClearRequested,
  PENDING_WRITES_TIMEOUT_MS,
  TAB_ID
} from "./local-data.service";
import { ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";
import { FirestoreStorage } from "../database/firestore-storage";

const calls: string[] = [];

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  clearIndexedDbPersistence: jest.fn(() => Promise.resolve()),
  waitForPendingWrites: jest.fn(() => { calls.push("waitForPendingWrites"); return Promise.resolve(); })
}));
jest.mock("./server-connection.service", () => ({ ServerConnectionService: class {} }));
jest.mock("../database/firestore-storage", () => ({
  FirestoreStorage: {
    flushPending: jest.fn(() => calls.push("flushPending")),
    pauseWrites: jest.fn(() => calls.push("pauseWrites")),
    resumeWrites: jest.fn(() => calls.push("resumeWrites"))
  }
}));

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
    it("checks the server, sends queued field changes, then waits for every pending write", async () => {
      await service.syncBeforeAccountChange("log out");
      expect(connection.requireServer).toHaveBeenCalledWith("log out");
      expect(calls).toEqual(["requireServer", "flushPending", "waitForPendingWrites"]);
    });

    it("refuses offline without touching the queue", async () => {
      connection.requireServer.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to log out."));
      await expect(service.syncBeforeAccountChange("log out")).rejects.toThrow("You're offline");
      expect(FirestoreStorage.flushPending).not.toHaveBeenCalled();
    });

    it("refuses rather than drop changes that do not reach the server in time", async () => {
      jest.useFakeTimers();
      jest.mocked(waitForPendingWrites).mockReturnValueOnce(new Promise(() => undefined));
      const result = service.syncBeforeAccountChange("sign in");
      const outcome = expect(result).rejects.toThrow("Your latest changes have not reached the server yet. Stay online and try to sign in again in a moment.");
      await jest.advanceTimersByTimeAsync(PENDING_WRITES_TIMEOUT_MS);
      await outcome;
    });
  });

  it("clearOnNextLoad stops writes, leaves the request for the next load and tells the other tabs", () => {
    // jsdom has no BroadcastChannel.
    const posted: { name: string, data: unknown }[] = [];
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = class {
      constructor(private name: string) {}
      postMessage(data: unknown): void {
        posted.push({ name: this.name, data });
      }
      close(): void {
        // Nothing to release.
      }
    };
    service.clearOnNextLoad();
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    expect(FirestoreStorage.pauseWrites).toHaveBeenCalled();
    expect(localDataClearRequested()).toBe(true);
    expect(posted).toEqual([{ name: DATA_REPLACED_CHANNEL, data: { cleared: true, tabId: TAB_ID } }]);
  });

  it("cancelClear drops the request and writes again", () => {
    service.clearOnNextLoad();
    service.cancelClear();
    expect(localDataClearRequested()).toBe(false);
    expect(FirestoreStorage.resumeWrites).toHaveBeenCalled();
  });
});

describe("clearRequestedLocalData (app initializer)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("removes the request, then deletes the saved Firestore data", async () => {
    localStorage.setItem(CLEAR_LOCAL_DATA_KEY, "true");
    jest.mocked(clearIndexedDbPersistence).mockImplementationOnce(() => {
      expect(localDataClearRequested()).toBe(false);
      return Promise.resolve();
    });
    const firestore = { kind: "firestore" } as never;
    await clearRequestedLocalData(firestore);
    expect(clearIndexedDbPersistence).toHaveBeenCalledWith(firestore);
  });

  it("lets the app start when the delete fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem(CLEAR_LOCAL_DATA_KEY, "true");
    jest.mocked(clearIndexedDbPersistence).mockRejectedValueOnce(new Error("failed-precondition"));
    await expect(clearRequestedLocalData({} as never)).resolves.toBeUndefined();
    expect(localDataClearRequested()).toBe(false);
    expect(error).toHaveBeenCalledWith("Could not clear the data saved on this device:", expect.any(Error));
    error.mockRestore();
  });
});
