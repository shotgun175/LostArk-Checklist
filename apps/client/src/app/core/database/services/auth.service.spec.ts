import { EMPTY, Subject } from "rxjs";
import { signInAnonymously, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { NzMessageService } from "ng-zorro-antd/message";
import { AuthService } from "./auth.service";
import { authState$, idTokenState$ } from "../../firebase/rx";
import { CLEAR_LOCAL_DATA_KEY, LocalDataService } from "../../firebase/local-data.service";
import { ServerConnectionService } from "../../firebase/server-connection.service";
import { ConnectionRequiredError } from "../../firebase/connection-required";

const calls: string[] = [];

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: jest.fn(() => { calls.push("signIn"); return Promise.resolve(); }),
  signOut: jest.fn(() => { calls.push("signOut"); return Promise.resolve(); }),
  linkWithCredential: jest.fn(() => Promise.resolve({ user: { uid: "u1" } })),
  EmailAuthProvider: { credential: jest.fn() }
}));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../../firebase/rx", () => ({ authState$: jest.fn(() => EMPTY), idTokenState$: jest.fn(() => EMPTY) }));
jest.mock("../firestore-storage", () => ({
  FirestoreStorage: {
    pauseWrites: jest.fn(() => calls.push("pauseWrites")),
    resumeWrites: jest.fn(() => calls.push("resumeWrites"))
  }
}));
jest.mock("../../firebase/server-connection.service", () => ({ ServerConnectionService: class {} }));

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe("AuthService", () => {
  let localData: Record<"syncBeforeAccountChange" | "requestClear" | "announceCleared" | "cancelClear" | "reloadPage", jest.Mock>;
  let connection: { requireServer: jest.Mock };
  let message: { error: jest.Mock };
  let service: AuthService;

  const create = () => new AuthService({ currentUser: null } as never, message as unknown as NzMessageService,
    localData as unknown as LocalDataService, connection as unknown as ServerConnectionService);

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    localStorage.clear();
    localData = {
      syncBeforeAccountChange: jest.fn(() => { calls.push("sync"); return Promise.resolve(); }),
      requestClear: jest.fn(() => calls.push("requestClear")),
      announceCleared: jest.fn(() => calls.push("announceCleared")),
      cancelClear: jest.fn(() => calls.push("cancelClear")),
      reloadPage: jest.fn(() => calls.push("reload"))
    };
    connection = { requireServer: jest.fn(() => Promise.resolve()) };
    message = { error: jest.fn() };
    service = create();
  });

  describe("Log out", () => {
    it("sends every change, asks for the clear, signs out, tells the other tabs, then reloads, in that order", async () => {
      await service.disconnect();
      expect(localData.syncBeforeAccountChange).toHaveBeenCalledWith("log out");
      expect(calls).toEqual(["sync", "requestClear", "signOut", "announceCleared", "reload"]);
    });

    it("is refused offline or with unsent changes: nothing is signed out or cleared", async () => {
      localData.syncBeforeAccountChange.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to log out."));
      await expect(service.disconnect()).rejects.toThrow("You're offline. Connect to the internet to log out.");
      expect(signOut).not.toHaveBeenCalled();
      expect(localData.requestClear).not.toHaveBeenCalled();
      expect(localData.reloadPage).not.toHaveBeenCalled();
    });

    it("drops the clear request when signing out fails", async () => {
      jest.mocked(signOut).mockRejectedValueOnce(new Error("boom"));
      await expect(service.disconnect()).rejects.toThrow("boom");
      expect(calls).toEqual(["sync", "requestClear", "cancelClear"]);
    });
  });

  describe("Sign in", () => {
    it("sends every change and stops writing before signing in, then tells the other tabs and reloads", async () => {
      service.login("a@example.com", "secret-1").subscribe();
      await settle();
      expect(localData.syncBeforeAccountChange).toHaveBeenCalledWith("sign in");
      expect(calls).toEqual(["sync", "requestClear", "signIn", "announceCleared", "reload"]);
    });

    it("keeps the guest and writes again when the password is wrong", async () => {
      jest.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({ code: "auth/invalid-credential" });
      service.login("a@example.com", "wrong-1").subscribe();
      await settle();
      expect(calls).toEqual(["sync", "requestClear", "cancelClear"]);
      expect(message.error).toHaveBeenCalledWith("Email or password is incorrect.");
    });

    it("shows the offline message and does not try to sign in offline", async () => {
      localData.syncBeforeAccountChange.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to sign in."));
      service.login("a@example.com", "secret-1").subscribe();
      await settle();
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalledWith("You're offline. Connect to the internet to sign in.");
    });
  });

  it("refuses to register offline", async () => {
    connection.requireServer.mockRejectedValueOnce(new ConnectionRequiredError("You're offline. Connect to the internet to register."));
    service.register("a@example.com", "secret-1").subscribe();
    await settle();
    expect(connection.requireServer).toHaveBeenCalledWith("register");
    expect(message.error).toHaveBeenCalledWith("You're offline. Connect to the internet to register.");
  });

  describe("guest account", () => {
    let authUser$: Subject<User | null>;

    beforeEach(() => {
      authUser$ = new Subject<User | null>();
      jest.mocked(authState$).mockReturnValue(authUser$);
      service = create();
    });

    it("starts a guest when nobody is signed in", () => {
      authUser$.next(null);
      expect(signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it("starts no guest while an account change waits for the reload that clears this device", () => {
      localStorage.setItem(CLEAR_LOCAL_DATA_KEY, "true");
      authUser$.next(null);
      expect(signInAnonymously).not.toHaveBeenCalled();
    });

    it("tries again once when the browser is back online after failing offline", async () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
      jest.mocked(signInAnonymously).mockRejectedValueOnce({ code: "auth/network-request-failed" });
      authUser$.next(null);
      await settle();
      expect(error).toHaveBeenCalledWith("Could not start a guest account:", expect.anything());
      window.dispatchEvent(new Event("online"));
      expect(signInAnonymously).toHaveBeenCalledTimes(2);
      window.dispatchEvent(new Event("online"));
      expect(signInAnonymously).toHaveBeenCalledTimes(2);
      error.mockRestore();
    });
  });

  it("reports a guest upgraded in place as registered, once per change", () => {
    const tokenUser$ = new Subject<User | null>();
    jest.mocked(idTokenState$).mockReturnValue(tokenUser$);
    service = create();
    const values: boolean[] = [];
    service.isAnonymous$.subscribe(value => values.push(value));
    const guest = { uid: "uid-1", isAnonymous: true } as unknown as User;
    const registered = { uid: "uid-1", isAnonymous: false } as unknown as User;
    tokenUser$.next(guest);
    tokenUser$.next(guest);
    tokenUser$.next(registered);
    tokenUser$.next(registered);
    expect(values).toEqual([true, false]);
  });
});
