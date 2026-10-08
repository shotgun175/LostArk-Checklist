import { TestBed } from "@angular/core/testing";
import { of, Subject } from "rxjs";
import { NzModalService } from "ng-zorro-antd/modal";
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
    doc: jest.fn((_firestore: unknown, name: string, key: string) => ref(`${name}/${key}`))
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
