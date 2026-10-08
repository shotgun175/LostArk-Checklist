import { Subject } from "rxjs";
import { FieldPath, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { docData$ } from "../firebase/rx";
import { DataModel } from "./data-model";
import { FirestoreStorage } from "./firestore-storage";

jest.mock("firebase/firestore", () => {
  class FieldPath {
    readonly segments: string[];
    constructor(...segments: string[]) {
      this.segments = segments;
    }
  }
  const ref = (path: string) => ({ path, withConverter() { return this; } });
  return {
    FieldPath,
    collection: jest.fn((_firestore: unknown, name: string) => ref(name)),
    doc: jest.fn((_firestore: unknown, name: string, key: string) => ref(`${name}/${key}`)),
    deleteField: jest.fn(() => "DELETE_FIELD"),
    updateDoc: jest.fn(() => Promise.resolve()),
    setDoc: jest.fn(() => Promise.resolve()),
    addDoc: jest.fn(() => Promise.resolve({ id: "new" })),
    deleteDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn(),
    runTransaction: jest.fn(),
    writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) }))
  };
});
jest.mock("../firebase/rx", () => ({ docData$: jest.fn(), collectionData$: jest.fn(), authState$: jest.fn() }));

interface TestDoc extends DataModel {
  data: Record<string, unknown>;
}

class TestStorage extends FirestoreStorage<TestDoc> {
  constructor() {
    super({} as never);
  }

  public batchForTest() {
    return this.batch();
  }

  protected getCollectionName(): string {
    return "completion";
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

const atDoc = (path: string) => expect.objectContaining({ path });

describe("FirestoreStorage field writes", () => {
  let storage: TestStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TestStorage();
  });

  afterEach(() => jest.useRealTimers());

  it("writes the first change at once and later ones together a second later, with field paths and deletes", () => {
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith(atDoc("completion/u1"), new FieldPath("data", "1:t1"), { amount: 1 });
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 2 } }]);
    storage.patchFields("u1", [{ path: ["data", "Alice:t1"], delete: true }]);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(updateDoc).toHaveBeenCalledTimes(2);
    expect(updateDoc).toHaveBeenLastCalledWith(atDoc("completion/u1"),
      new FieldPath("data", "1:t1"), { amount: 2 },
      new FieldPath("data", "Alice:t1"), "DELETE_FIELD");
  });

  it("creates the document with a merge when it does not exist yet", async () => {
    jest.mocked(updateDoc).mockReturnValueOnce(Promise.reject({ code: "not-found" }));
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    await settle();
    expect(setDoc).toHaveBeenCalledWith(atDoc("completion/u1"), { data: { "1:t1": { amount: 1 } } }, { merge: true });
  });

  it("a whole-document set drops that document's pending field changes", () => {
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 2 } }]);
    storage.setOne("u1", { data: {} });
    jest.advanceTimersByTime(1000);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it("flushPending writes the queued changes of every storage at once", () => {
    const other = new TestStorage();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    other.patchFields("u2", [{ path: ["data", "b"], value: 1 }]);
    other.patchFields("u2", [{ path: ["data", "b"], value: 2 }]);
    expect(updateDoc).toHaveBeenCalledTimes(2);
    FirestoreStorage.flushPending();
    expect(updateDoc).toHaveBeenCalledTimes(4);
    expect(updateDoc).toHaveBeenCalledWith(atDoc("completion/u1"), new FieldPath("data", "a"), 2);
    expect(updateDoc).toHaveBeenCalledWith(atDoc("completion/u2"), new FieldPath("data", "b"), 2);
    jest.advanceTimersByTime(1000);
    expect(updateDoc).toHaveBeenCalledTimes(4);
  });

  it("shows field changes at once on a current-user document, even one that did not exist", () => {
    const snapshots = new Subject<TestDoc | undefined>();
    jest.mocked(docData$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1", true).subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
    snapshots.next(undefined);
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { "1:t1": { amount: 1 } } });
  });

  it("keeps pending changes on screen when another snapshot arrives first", () => {
    const snapshots = new Subject<TestDoc | undefined>();
    jest.mocked(docData$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u2").subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
    snapshots.next({ $key: "u2", data: { other: 1 } });
    // The first change is written at once (Firestore then shows it in its own snapshots); the second waits
    storage.patchFields("u2", [{ path: ["data", "first"], value: 1 }]);
    storage.patchFields("u2", [{ path: ["data", "mine"], value: 2 }]);
    snapshots.next({ $key: "u2", data: { other: 3, first: 1 } });
    expect(seen[seen.length - 1]).toEqual({ $key: "u2", data: { other: 3, first: 1, mine: 2 } });
  });
});

describe("FirestoreStorage after a document it saw is deleted (account deleted in another tab)", () => {
  let storage: TestStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TestStorage();
  });

  afterEach(() => jest.useRealTimers());

  it("keeps the last copy instead of reporting the document as missing", () => {
    const snapshots = new Subject<TestDoc | undefined>();
    jest.mocked(docData$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next({ $key: "u1", data: { a: 1 } });
    snapshots.next(undefined);
    expect(seen).toEqual([{ $key: "u1", data: { a: 1 } }]);
  });

  it("still reports a document that never existed as missing", () => {
    const snapshots = new Subject<TestDoc | undefined>();
    jest.mocked(docData$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next(undefined);
    expect(seen).toEqual([{ $key: "u1", notFound: true }]);
  });

  it("does not create it again when a field change finds it gone", async () => {
    const snapshots = new Subject<TestDoc | undefined>();
    jest.mocked(docData$).mockReturnValue(snapshots as never);
    storage.getOne("u1", true).subscribe();
    snapshots.next({ $key: "u1", data: { a: 1 } });
    jest.mocked(updateDoc).mockReturnValueOnce(Promise.reject({ code: "not-found" }));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    await settle();
    expect(setDoc).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("FirestoreStorage.pauseWrites", () => {
  let storage: TestStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TestStorage();
  });

  afterEach(() => {
    FirestoreStorage.resumeWrites();
    jest.useRealTimers();
  });

  it("drops field changes that were queued, so they are never written", () => {
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    FirestoreStorage.pauseWrites();
    jest.advanceTimersByTime(1000);
    FirestoreStorage.flushPending();
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it("does not create the document when a write sent before the pause finds it deleted", async () => {
    jest.mocked(updateDoc).mockReturnValueOnce(Promise.reject({ code: "not-found" }));
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    FirestoreStorage.pauseWrites();
    await settle();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("turns sets, updates, adds, deletes, field changes and batches into no-ops", async () => {
    FirestoreStorage.pauseWrites();
    storage.setOne("u1", { data: {} }).subscribe();
    storage.updateOne("u1", { data: {} }).subscribe();
    storage.addOne({ data: {} }).subscribe();
    storage.deleteOne("u1").subscribe();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    await storage.batchForTest().set({} as never, {}).commit();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
    const { addDoc, deleteDoc } = jest.requireMock("firebase/firestore");
    expect(addDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("writes again after resumeWrites", () => {
    FirestoreStorage.pauseWrites();
    FirestoreStorage.resumeWrites();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});
