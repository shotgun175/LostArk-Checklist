import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, Subject } from "rxjs";
import { NzModalService } from "ng-zorro-antd/modal";
import { updateDoc } from "firebase/firestore";
import { docData$ } from "../../firebase/rx";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { FirestoreStorage } from "../firestore-storage";
import { AuthService } from "./auth.service";
import { UserService } from "./user.service";

// No real Firebase in unit tests: the users document arrives through a mocked listener.
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => {
  const ref = (path: string) => ({ path, withConverter() { return this; } });
  return {
    collection: jest.fn((_firestore: unknown, name: string) => ref(name)),
    doc: jest.fn((_firestore: unknown, name: string, key: string) => ref(`${name}/${key}`)),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteField: jest.fn(() => "<deleteField>")
  };
});
jest.mock("../../firebase/rx", () => ({ docData$: jest.fn(), collectionData$: jest.fn(), authState$: jest.fn() }));
jest.mock("../../../components/text-question-popup/text-question-popup/text-question-popup.component", () => ({
  TextQuestionPopupComponent: class {}
}));

describe("UserService.user$", () => {
  let userDoc: Subject<unknown>;
  let create: jest.Mock;
  let service: UserService;

  beforeEach(() => {
    userDoc = new Subject<unknown>();
    jest.mocked(docData$).mockReturnValue(userDoc as never);
    create = jest.fn(() => ({ afterClose: new Subject<string>() }));
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("u1"), isAnonymous$: of(false) } },
        { provide: NzModalService, useValue: { create } }
      ]
    });
    service = TestBed.inject(UserService);
  });

  afterEach(() => {
    FirestoreStorage.resumeWrites();
  });

  it("asks a registered user without a name for one", () => {
    service.user$.subscribe();
    userDoc.next(undefined);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not ask for a name while writes are paused for account deletion", () => {
    service.user$.subscribe();
    FirestoreStorage.pauseWrites();
    userDoc.next(undefined);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("UserService.user$ cleaning leftover fields", () => {
  let userDoc: Subject<unknown>;
  let isAnonymous$: BehaviorSubject<boolean>;
  let service: UserService;

  beforeEach(() => {
    jest.mocked(updateDoc).mockClear();
    userDoc = new Subject<unknown>();
    jest.mocked(docData$).mockReturnValue(userDoc as never);
    isAnonymous$ = new BehaviorSubject(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("u1"), isAnonymous$ } },
        { provide: NzModalService, useValue: { create: jest.fn(() => ({ afterClose: new Subject<string>() })) } }
      ]
    });
    service = TestBed.inject(UserService);
  });

  afterEach(() => {
    FirestoreStorage.resumeWrites();
  });

  // The live listener adds $key to every document it reads.
  const dirty = { $key: "u1", name: "Synthetic Sorc", friends: ["x"], region: "EUC", availability: {} };

  it("removes every field but name with one write, once", () => {
    service.user$.subscribe();
    userDoc.next(dirty);
    // A guest who registers in place replays the same document before the write lands.
    isAnonymous$.next(false);
    userDoc.next({ ...dirty, version: 2 });
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateDoc).mock.calls[0][0]).toEqual(expect.objectContaining({ path: "users/u1" }));
    expect(jest.mocked(updateDoc).mock.calls[0][1]).toEqual({
      friends: "<deleteField>",
      region: "<deleteField>",
      availability: "<deleteField>"
    });
  });

  it("writes nothing for a document that has only a name", () => {
    service.user$.subscribe();
    userDoc.next({ $key: "u1", name: "Synthetic Sorc" });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("writes nothing for a missing document", () => {
    service.user$.subscribe();
    userDoc.next(undefined);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("writes nothing while writes are paused, and cleans on the next load after they resume", () => {
    service.user$.subscribe();
    FirestoreStorage.pauseWrites();
    userDoc.next(dirty);
    expect(updateDoc).not.toHaveBeenCalled();
    FirestoreStorage.resumeWrites();
    userDoc.next({ ...dirty, region: "NAE" });
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});

describe("UserService.user$ when a guest registers", () => {
  it("does not ask for a name: the register popup saves the one the user typed", () => {
    const userDoc = new Subject<unknown>();
    jest.mocked(docData$).mockReturnValue(userDoc as never);
    const create = jest.fn(() => ({ afterClose: new Subject<string>() }));
    const isAnonymous$ = new BehaviorSubject(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("u1"), isAnonymous$ } },
        { provide: NzModalService, useValue: { create } }
      ]
    });
    const service = TestBed.inject(UserService);
    service.user$.subscribe();
    userDoc.next(undefined);
    isAnonymous$.next(false);
    userDoc.next(undefined);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("UserService.updateUserName", () => {
  let afterClose: Subject<string | undefined>;
  let create: jest.Mock;
  let service: UserService;
  let setOne: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(docData$).mockReturnValue(new Subject() as never);
    afterClose = new Subject<string | undefined>();
    create = jest.fn(() => ({ afterClose }));
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("u1"), isAnonymous$: of(false) } },
        { provide: NzModalService, useValue: { create } }
      ]
    });
    service = TestBed.inject(UserService);
    setOne = jest.spyOn(service, "setOne").mockReturnValue(of(void 0));
  });

  it("opens with the current name, selected, and a Cancel button", () => {
    service.updateUserName({ $key: "u1", name: "Arwen" }).subscribe();
    const options = create.mock.calls[0][0];
    expect(options.nzData).toEqual(expect.objectContaining({ baseText: "Arwen", cancellable: true, selectOnOpen: true, maxLength: 32 }));
  });

  it("saves the cleaned name and emits it", () => {
    const saved: string[] = [];
    service.updateUserName({ $key: "u1", name: "Arwen" }).subscribe(name => saved.push(name));
    afterClose.next("  Synthetic\u200B Sorc  ");
    expect(setOne).toHaveBeenCalledWith("u1", { name: "Synthetic Sorc" });
    expect(saved).toEqual(["Synthetic Sorc"]);
  });

  it("saves nothing when closed with Escape or Cancel", () => {
    const saved: string[] = [];
    service.updateUserName({ $key: "u1", name: "Arwen" }).subscribe(name => saved.push(name));
    afterClose.next(undefined);
    expect(setOne).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("saves nothing for a blank or invisible-only name", () => {
    service.updateUserName({ $key: "u1", name: "Arwen" }).subscribe();
    afterClose.next(" \u200B ");
    expect(setOne).not.toHaveBeenCalled();
  });

  it("does not open a second popup while one is open", () => {
    service.updateUserName({ $key: "u1", name: "" }).subscribe();
    service.updateUserName({ $key: "u1", name: "" }).subscribe();
    expect(create).toHaveBeenCalledTimes(1);
    afterClose.next(undefined);
    service.updateUserName({ $key: "u1", name: "" }).subscribe();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("saves what is typed in the automatic prompt, which has no Cancel button", () => {
    const userDoc = new Subject<unknown>();
    jest.mocked(docData$).mockReturnValue(userDoc as never);
    service.user$.subscribe();
    userDoc.next(undefined);
    expect(create.mock.calls[0][0].nzData.cancellable).toBe(false);
    afterClose.next("Synthetic Sorc");
    expect(setOne).toHaveBeenCalledWith("u1", { name: "Synthetic Sorc" });
  });
});
