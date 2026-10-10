import { TestBed } from "@angular/core/testing";
import { deleteUser, reauthenticateWithCredential, signOut } from "firebase/auth";
import { getDocsFromServer, writeBatch } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "../firebase/firebase.providers";
import { FirestoreStorage } from "../database/firestore-storage";
import { AccountDeletionService } from "./account-deletion.service";
import { LocalDataService } from "../firebase/local-data.service";
import { ConnectionRequiredError } from "../firebase/connection-required";

const calls: string[] = [];

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: jest.fn((email: string, password: string) => ({ email, password })) },
  reauthenticateWithCredential: jest.fn(() => { calls.push("reauthenticate"); return Promise.resolve(); }),
  deleteUser: jest.fn(() => { calls.push("deleteUser"); return Promise.resolve(); }),
  signOut: jest.fn(() => { calls.push("signOut"); return Promise.resolve(); })
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn((_firestore: unknown, name: string, id: string) => `${name}/${id}`),
  getDocsFromServer: jest.fn(() => { calls.push("getTasks"); return Promise.resolve({ docs: [{ id: "t1" }, { id: "t2" }] }); }),
  writeBatch: jest.fn()
}));
jest.mock("../database/firestore-storage", () => ({
  FirestoreStorage: {
    pauseWrites: jest.fn(() => calls.push("pause"))
  }
}));
jest.mock("../firebase/local-data.service", () => ({ LocalDataService: class {} }));

const localData = {
  syncBeforeAccountChange: jest.fn(() => { calls.push("sync"); return Promise.resolve(); }),
  requestClear: jest.fn(() => calls.push("requestClear")),
  announceCleared: jest.fn(() => calls.push("announceCleared")),
  cancelClear: jest.fn(() => calls.push("cancelClear"))
};

function setup(user: { uid: string; isAnonymous: boolean; email?: string } | null): { service: AccountDeletionService; deleted: string[] } {
  const deleted: string[] = [];
  jest.mocked(writeBatch).mockImplementation(() => {
    const batch = {
      delete: jest.fn((path: string) => { deleted.push(path); return batch; }),
      commit: jest.fn(() => { calls.push("commit"); return Promise.resolve(); })
    };
    return batch as never;
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: FIREBASE_AUTH, useValue: { currentUser: user } },
      { provide: FIRESTORE, useValue: {} },
      { provide: LocalDataService, useValue: localData }
    ]
  });
  return { service: TestBed.inject(AccountDeletionService), deleted };
}

const EVERY_DOC = ["tasks/t1", "tasks/t2", "roster/me", "settings/me", "completion/me", "energy/me", "users/me"];

describe("AccountDeletionService", () => {
  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
  });

  it("re-authenticates a registered user, pauses writes, deletes every document, then the account", async () => {
    const { service, deleted } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("pw")).resolves.toBe("account-deleted");
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(expect.anything(), { email: "a@example.com", password: "pw" });
    // The other tabs reload only once the account is gone, so none starts with it and writes its documents again.
    expect(calls).toEqual(["sync", "reauthenticate", "getTasks", "pause", "commit", "requestClear", "deleteUser", "announceCleared"]);
    expect(deleted).toEqual(EVERY_DOC);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("deletes a guest's documents and signs the guest out, with no password", async () => {
    const { service, deleted } = setup({ uid: "me", isAnonymous: true });
    await expect(service.deleteAccountAndData("")).resolves.toBe("guest-data-deleted");
    expect(calls).toEqual(["sync", "getTasks", "pause", "commit", "requestClear", "signOut", "announceCleared"]);
    expect(deleted).toEqual(EVERY_DOC);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes nothing when the password is wrong", async () => {
    jest.mocked(reauthenticateWithCredential).mockRejectedValueOnce({ code: "auth/invalid-credential" });
    const { service, deleted } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("wrong")).rejects.toEqual({ code: "auth/invalid-credential" });
    expect(getDocsFromServer).not.toHaveBeenCalled();
    expect(FirestoreStorage.pauseWrites).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
    // The sync held writes; they resume, or later ticks would be ignored until a reload.
    expect(calls).toEqual(["sync", "cancelClear"]);
  });

  it("resumes writes and keeps this device's data when the deletion fails part way", async () => {
    jest.mocked(deleteUser).mockRejectedValueOnce(new Error("offline"));
    const { service } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("pw")).rejects.toThrow("offline");
    expect(calls[calls.length - 1]).toBe("cancelClear");
    expect(localData.announceCleared).not.toHaveBeenCalled();
  });

  it("refuses offline (or with unsent changes) before anything is deleted", async () => {
    localData.syncBeforeAccountChange.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to delete your account."));
    const { service, deleted } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("pw")).rejects.toThrow("You're offline. Connect to the internet to delete your account.");
    expect(localData.syncBeforeAccountChange).toHaveBeenCalledWith("delete your account");
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(FirestoreStorage.pauseWrites).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });
});
