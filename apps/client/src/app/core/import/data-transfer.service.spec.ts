import { of } from "rxjs";
import { Firestore } from "firebase/firestore";
import { AuthService } from "../database/services/auth.service";
import { CompletionService } from "../database/services/completion.service";
import { FirestoreStorage } from "../database/firestore-storage";
import { DataTransferService } from "./data-transfer.service";
import { LostarkExport } from "./lostark-export";

const commit = jest.fn();
const getDocMock = jest.fn();
const batchSet = jest.fn();

// DataTransferService pulls in AuthService and the FIRESTORE token, which import firebase/app and
// firebase/auth. The Node build of firebase/auth 10 cannot load on Node 16, so they are stubbed.
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn((_parent: unknown, name?: string, id?: string) => ({ id: id ?? "fresh", path: `${name ?? "tasks"}/${id ?? "fresh"}` })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(() => ({ set: batchSet, delete: jest.fn(), commit }))
}));

function file(): LostarkExport {
  return {
    format: 1,
    exportedAt: "",
    sourceUid: "src",
    roster: { characters: [], showAllTasks: false, trackedTasks: {} },
    settings: {},
    completion: { data: { t1: { amount: 1, updated: 1 } } },
    energy: null,
    tasks: [{ $key: "t1", label: "Chaos Dungeon" }] as LostarkExport["tasks"]
  };
}

describe("DataTransferService", () => {
  const previous = { $key: "me", data: { old: { amount: 1, updated: 1 } } };
  let setLocal: jest.Mock;
  let service: DataTransferService;

  beforeEach(() => {
    commit.mockReset();
    getDocMock.mockReset();
    batchSet.mockReset();
    setLocal = jest.fn();
    const completionService = { completion$: of(previous), setLocal } as unknown as CompletionService;
    const auth = { uid$: of("me") } as unknown as AuthService;
    service = new DataTransferService({} as Firestore, auth, completionService);
  });

  afterEach(() => FirestoreStorage.resumeWrites());

  it("puts the previous in-memory completion back when the batch fails", async () => {
    commit.mockRejectedValue(new Error("permission-denied"));
    await expect(service.importExport(file())).rejects.toThrow("permission-denied");
    expect(setLocal).toHaveBeenCalledTimes(2);
    expect(setLocal.mock.calls[0][1]).toEqual({ $key: "me", data: { fresh: { amount: 1, updated: 1 } } });
    expect(setLocal.mock.calls[1]).toEqual(["me", previous]);
  });

  it("keeps the imported completion in memory when the batch succeeds", async () => {
    commit.mockResolvedValue(undefined);
    await service.importExport(file());
    expect(setLocal).toHaveBeenCalledTimes(1);
  });

  it("writes queued field changes before the import batch, so the import lands on top of them", async () => {
    const flush = jest.spyOn(FirestoreStorage, "flushPending").mockImplementation(() => undefined);
    commit.mockImplementation(async () => expect(flush).toHaveBeenCalledTimes(1));
    await service.importExport(file());
    expect(commit).toHaveBeenCalledTimes(1);
    flush.mockRestore();
  });

  it("pauses service writes for the import, so stale data cannot be written over it before the reload", async () => {
    commit.mockImplementation(async () => expect(FirestoreStorage.writesArePaused()).toBe(true));
    await service.importExport(file());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(FirestoreStorage.writesArePaused()).toBe(true);
  });

  it("writes again when the import batch fails", async () => {
    commit.mockRejectedValue(new Error("permission-denied"));
    await expect(service.importExport(file())).rejects.toThrow("permission-denied");
    expect(FirestoreStorage.writesArePaused()).toBe(false);
  });

  it("backs up an account with no roster or settings document as a restorable file", async () => {
    getDocMock.mockResolvedValue({ data: () => undefined });
    const backup = await service.buildBackup();
    expect(backup.roster).toEqual({ characters: [], trackedTasks: {}, showAllTasks: false });
    expect(backup.settings).toEqual({});
  });

  it("puts the display name in the backup", async () => {
    getDocMock.mockImplementation(async (ref: { path: string }) => ({
      data: () => ref.path === "users/me" ? { name: "Synthetic Sorc", region: "old" } : undefined
    }));
    const backup = await service.buildBackup();
    expect(backup.user).toEqual({ name: "Synthetic Sorc" });
  });

  it("backs up an account without a display name with user null", async () => {
    getDocMock.mockResolvedValue({ data: () => undefined });
    expect((await service.buildBackup()).user).toBeNull();
  });

  it("restores the display name from a backup", async () => {
    commit.mockResolvedValue(undefined);
    await service.importExport({ ...file(), user: { name: "Synthetic Sorc" } });
    expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ path: "users/me" }), { name: "Synthetic Sorc" });
  });

  it("keeps the display name on an Import from Lostark-helper", async () => {
    commit.mockResolvedValue(undefined);
    await service.importExport({ ...file(), user: { name: "Synthetic Sorc" } }, true);
    expect(batchSet.mock.calls.some(([ref]) => ref.path === "users/me")).toBe(false);
  });

  describe("other open tabs", () => {
    type Listener = (event: { data: unknown }) => void;
    const channels: { name: string; onmessage: Listener | null; closed: boolean }[] = [];
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

    class FakeChannel {
      onmessage: Listener | null = null;
      closed = false;
      constructor(public name: string) {
        channels.push(this);
      }
      postMessage(data: unknown): void {
        channels.filter(c => c !== this && c.name === this.name && !c.closed).forEach(c => c.onmessage?.({ data }));
      }
      close(): void {
        this.closed = true;
      }
    }

    beforeEach(() => {
      channels.length = 0;
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel;
    });

    afterEach(() => {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
    });

    function otherTab(uid: string): { reload: jest.Mock } {
      const completionService = { completion$: of(previous), setLocal: jest.fn() } as unknown as CompletionService;
      const other = new DataTransferService({} as Firestore, { uid$: of(uid) } as unknown as AuthService, completionService);
      const reload = jest.fn();
      other.reloadPage = reload;
      other.reloadWhenReplacedInAnotherTab();
      return { reload };
    }

    it("reload, with writes paused, when this account's data is replaced in another tab", async () => {
      const tab = otherTab("me");
      commit.mockResolvedValue(undefined);
      await service.importExport(file());
      expect(tab.reload).toHaveBeenCalledTimes(1);
      expect(FirestoreStorage.writesArePaused()).toBe(true);
    });

    it("do not reload for another account's import", async () => {
      const tab = otherTab("someone-else");
      commit.mockResolvedValue(undefined);
      await service.importExport(file());
      expect(tab.reload).not.toHaveBeenCalled();
    });

    it("do not reload when the import fails", async () => {
      const tab = otherTab("me");
      commit.mockRejectedValue(new Error("permission-denied"));
      await expect(service.importExport(file())).rejects.toThrow("permission-denied");
      expect(tab.reload).not.toHaveBeenCalled();
    });

    it("the importing tab does not reload itself through the channel", async () => {
      const reload = jest.fn();
      service.reloadPage = reload;
      service.reloadWhenReplacedInAnotherTab();
      commit.mockResolvedValue(undefined);
      await service.importExport(file());
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
