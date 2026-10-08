import { EMPTY, Subject } from "rxjs";
import { signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { NzMessageService } from "ng-zorro-antd/message";
import { FirestoreStorage } from "../firestore-storage";
import { AuthService } from "./auth.service";
import { idTokenState$ } from "../../firebase/rx";

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve())
}));
jest.mock("../../firebase/rx", () => ({ authState$: jest.fn(() => EMPTY), idTokenState$: jest.fn(() => EMPTY) }));
jest.mock("../firestore-storage", () => ({ FirestoreStorage: { flushPending: jest.fn() } }));

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService({} as never, {} as NzMessageService);
  });

  it("sends queued field changes before logging out", () => {
    jest.mocked(signOut).mockImplementation(() => {
      expect(FirestoreStorage.flushPending).toHaveBeenCalledTimes(1);
      return Promise.resolve();
    });
    service.disconnect();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("sends queued field changes before signing in as another user", () => {
    jest.mocked(signInWithEmailAndPassword).mockImplementation(() => {
      expect(FirestoreStorage.flushPending).toHaveBeenCalledTimes(1);
      return Promise.resolve({} as never);
    });
    service.login("a@example.com", "secret-1").subscribe();
    expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  });

  it("reports a guest upgraded in place as registered, once per change", () => {
    const tokenUser$ = new Subject<User | null>();
    jest.mocked(idTokenState$).mockReturnValue(tokenUser$);
    service = new AuthService({} as never, {} as NzMessageService);
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
