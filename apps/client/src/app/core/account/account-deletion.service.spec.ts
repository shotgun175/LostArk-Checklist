import { TestBed } from "@angular/core/testing";
import { deleteUser, reauthenticateWithCredential, signOut } from "firebase/auth";
import { getDocs, writeBatch } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "../firebase/firebase.providers";
import { FirestoreStorage } from "../database/firestore-storage";
import { AccountDeletionService } from "./account-deletion.service";

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
  getDocs: jest.fn(() => { calls.push("getTasks"); return Promise.resolve({ docs: [{ id: "t1" }, { id: "t2" }] }); }),
  writeBatch: jest.fn()
}));
jest.mock("../database/firestore-storage", () => ({
  FirestoreStorage: {
    pauseWrites: jest.fn(() => calls.push("pause")),
    resumeWrites: jest.fn(() => calls.push("resume"))
  }
}));

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
      { provide: FIRESTORE, useValue: {} }
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
    expect(calls).toEqual(["reauthenticate", "getTasks", "pause", "commit", "deleteUser"]);
    expect(deleted).toEqual(EVERY_DOC);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("deletes a guest's documents and signs the guest out, with no password", async () => {
    const { service, deleted } = setup({ uid: "me", isAnonymous: true });
    await expect(service.deleteAccountAndData("")).resolves.toBe("guest-data-deleted");
    expect(calls).toEqual(["getTasks", "pause", "commit", "signOut"]);
    expect(deleted).toEqual(EVERY_DOC);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes nothing when the password is wrong", async () => {
    jest.mocked(reauthenticateWithCredential).mockRejectedValueOnce({ code: "auth/invalid-credential" });
    const { service, deleted } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("wrong")).rejects.toEqual({ code: "auth/invalid-credential" });
    expect(getDocs).not.toHaveBeenCalled();
    expect(FirestoreStorage.pauseWrites).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });

  it("resumes writes when the deletion fails part way", async () => {
    jest.mocked(deleteUser).mockRejectedValueOnce(new Error("offline"));
    const { service } = setup({ uid: "me", isAnonymous: false, email: "a@example.com" });
    await expect(service.deleteAccountAndData("pw")).rejects.toThrow("offline");
    expect(calls[calls.length - 1]).toBe("resume");
  });
});
