import { Subject } from "rxjs";
import { FieldPath, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { DocState, docSnapshot$ } from "../firebase/rx";
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
    // doc(collection) makes a new id on the device, as addOne does.
    doc: jest.fn((parent: { path: string }, name?: string, key?: string) => name === undefined
      ? { ...ref(`${parent.path}/new-id`), id: "new-id" }
      : ref(`${name}/${key}`)),
    deleteField: jest.fn(() => "DELETE_FIELD"),
    updateDoc: jest.fn(() => Promise.resolve()),
    setDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn(),
    runTransaction: jest.fn(),
    writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) }))
  };
});
jest.mock("../firebase/rx", () => ({ docSnapshot$: jest.fn(), collectionSnapshot$: jest.fn(), authState$: jest.fn() }));

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

/** A document snapshot as docSnapshot$ emits it; undefined data is a missing document. */
function snap(data: TestDoc | undefined, fromCache = false): DocState<TestDoc> {
  return { data, exists: data !== undefined, fromCache, hasPendingWrites: false };
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
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1", true).subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
    snapshots.next(snap(undefined));
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { "1:t1": { amount: 1 } } });
  });

  it("keeps pending changes on screen when another snapshot arrives first", () => {
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u2").subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
    snapshots.next(snap({ $key: "u2", data: { other: 1 } }));
    // The first change is written at once (Firestore then shows it in its own snapshots); the second waits
    storage.patchFields("u2", [{ path: ["data", "first"], value: 1 }]);
    storage.patchFields("u2", [{ path: ["data", "mine"], value: 2 }]);
    snapshots.next(snap({ $key: "u2", data: { other: 3, first: 1 } }));
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
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
    snapshots.next(snap(undefined));
    expect(seen).toEqual([{ $key: "u1", data: { a: 1 } }]);
  });

  it("still reports a document that never existed as missing", () => {
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next(snap(undefined));
    expect(seen).toEqual([{ $key: "u1", notFound: true }]);
  });

  it("does not create it again when a field change finds it gone", async () => {
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    storage.getOne("u1", true).subscribe();
    snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
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
    const { deleteDoc } = jest.requireMock("firebase/firestore");
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("writes again after resumeWrites", () => {
    FirestoreStorage.pauseWrites();
    FirestoreStorage.resumeWrites();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});

describe("FirestoreStorage.holdWrites", () => {
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

  it("keeps queued field changes for flushPending, but starts no new write", () => {
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    FirestoreStorage.holdWrites();
    storage.patchFields("u1", [{ path: ["data", "b"], value: 3 }]);
    storage.setOne("u2", { data: {} }).subscribe();
    expect(FirestoreStorage.writesArePaused()).toBe(true);
    FirestoreStorage.flushPending();
    expect(updateDoc).toHaveBeenCalledTimes(2);
    expect(updateDoc).toHaveBeenLastCalledWith(atDoc("completion/u1"), new FieldPath("data", "a"), 2);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("still creates a document that a flushed change finds missing", async () => {
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    jest.mocked(updateDoc).mockReturnValueOnce(Promise.reject({ code: "not-found" }));
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    FirestoreStorage.holdWrites();
    FirestoreStorage.flushPending();
    await settle();
    expect(setDoc).toHaveBeenCalledWith(atDoc("completion/u1"), { data: { a: 2 } }, { merge: true });
  });
});

describe("FirestoreStorage with a local cache", () => {
  let storage: TestStorage;
  let snapshots: Subject<DocState<TestDoc>>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TestStorage();
    snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots);
  });

  afterEach(() => jest.useRealTimers());

  it("emits nothing for a document missing from the cache, and notFound only when the server says so", () => {
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next(snap(undefined, true));
    expect(seen).toEqual([]);
    snapshots.next(snap(undefined));
    expect(seen).toEqual([{ $key: "u1", notFound: true }]);
  });

  it("marks a cached copy and still emits a server copy with the same data", () => {
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(doc));
    snapshots.next(snap({ $key: "u1", data: { a: 1 } }, true));
    snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
    snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
    expect(seen).toEqual([
      { $key: "u1", data: { a: 1 }, fromCache: true },
      { $key: "u1", data: { a: 1 } }
    ]);
  });

  it("never saves the cache marker", () => {
    const converter = (storage as unknown as { converter: { toFirestore(doc: TestDoc): unknown } }).converter;
    expect(converter.toFirestore({ $key: "u1", data: {}, fromCache: true, notFound: true })).toEqual({ data: {} });
  });

  describe("current-user document (local-first)", () => {
    it("online, takes the server copy as its base and never shows the cached one", () => {
      const seen: TestDoc[] = [];
      storage.getOne("u1", true).subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
      snapshots.next(snap({ $key: "u1", data: { old: 1 } }, true));
      jest.advanceTimersByTime(20);
      snapshots.next(snap({ $key: "u1", data: { fromOtherDevice: 1 } }));
      jest.advanceTimersByTime(FirestoreStorage.SERVER_COPY_WAIT_MS);
      expect(seen).toEqual([{ $key: "u1", data: { fromOtherDevice: 1 } }]);
    });

    it("keeps ignoring later echoes once it has the server copy", () => {
      const seen: TestDoc[] = [];
      storage.getOne("u1", true).subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      snapshots.next(snap({ $key: "u1", data: { a: 2 } }));
      expect(seen).toEqual([{ $key: "u1", data: { a: 1 } }]);
      expect(snapshots.observed).toBe(false);
    });

    it("offline, shows the cached copy after the wait, then replaces it once with the server copy, keeping queued ticks", () => {
      const seen: TestDoc[] = [];
      storage.getOne("u1", true).subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
      snapshots.next(snap({ $key: "u1", data: { cached: 1 } }, true));
      jest.advanceTimersByTime(FirestoreStorage.SERVER_COPY_WAIT_MS - 1);
      expect(seen).toEqual([]);
      jest.advanceTimersByTime(1);
      expect(seen).toEqual([{ $key: "u1", data: { cached: 1 }, fromCache: true }]);
      // The first tick is written at once; the second waits in its one-second window.
      storage.patchFields("u1", [{ path: ["data", "tick1"], value: 1 }]);
      storage.patchFields("u1", [{ path: ["data", "tick2"], value: 1 }]);
      // Back online: the server copy already holds the written tick (Firestore shows local writes).
      snapshots.next(snap({ $key: "u1", data: { cached: 1, otherDevice: 1, tick1: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { cached: 1, otherDevice: 1, tick1: 1, tick2: 1 } });
      const count = seen.length;
      snapshots.next(snap({ $key: "u1", data: { echo: 1 } }));
      expect(seen.length).toBe(count);
    });

    it("offline with nothing cached, shows nothing (and writes nothing) until the server answers", () => {
      const seen: TestDoc[] = [];
      storage.getOne("u1", true).subscribe(doc => seen.push(doc));
      snapshots.next(snap(undefined, true));
      jest.advanceTimersByTime(FirestoreStorage.SERVER_COPY_WAIT_MS * 5);
      expect(seen).toEqual([]);
      snapshots.next(snap(undefined));
      expect(seen).toEqual([{ $key: "u1", notFound: true }]);
    });
  });
});

describe("FirestoreStorage writes that do not wait for the server", () => {
  let storage: TestStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new TestStorage();
  });

  it("addOne returns the id made on this device at once, while the write is still waiting", () => {
    jest.mocked(setDoc).mockReturnValueOnce(new Promise(() => undefined));
    const ids: string[] = [];
    storage.addOne({ data: { a: 1 } }).subscribe(id => ids.push(id));
    expect(ids).toEqual(["new-id"]);
    expect(setDoc).toHaveBeenCalledWith(atDoc("completion/new-id"), { data: { a: 1 } });
  });

  it("addOne logs a write the server refuses later", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(setDoc).mockReturnValueOnce(Promise.reject(new Error("permission-denied")));
    storage.addOne({ data: {} }).subscribe();
    await settle();
    expect(error).toHaveBeenCalledWith("Could not save completion/new-id:", expect.any(Error));
    error.mockRestore();
  });

  it("addOne reports data Firestore refuses at once to the caller", () => {
    jest.mocked(setDoc).mockImplementationOnce(() => {
      throw new Error("invalid-argument");
    });
    const errors: unknown[] = [];
    storage.addOne({ data: {} }).subscribe({ error: e => errors.push(e) });
    expect(errors).toEqual([new Error("invalid-argument")]);
  });

  it("setOneInBackground starts the write and only logs a failure", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(setDoc).mockReturnValueOnce(Promise.reject(new Error("unavailable")));
    storage.setOneInBackground("u1", { data: {} });
    expect(setDoc).toHaveBeenCalledWith(atDoc("completion/u1"), { data: {} });
    await settle();
    expect(error).toHaveBeenCalledWith("Could not save completion/u1:", expect.any(Error));
    error.mockRestore();
  });
});
