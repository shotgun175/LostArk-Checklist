import { Subject } from "rxjs";
import { FieldPath, getDocFromCache, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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
    getDocFromCache: jest.fn(() => Promise.resolve({})),
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

/** A promise settled from the test, for a write that is still on its way. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(r => resolve = r);
  return { promise, resolve };
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

  it("shows field changes at once, even on a document that did not exist", () => {
    const snapshots = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(snapshots as never);
    const seen: TestDoc[] = [];
    storage.getOne("u1").subscribe(doc => seen.push(JSON.parse(JSON.stringify(doc))));
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
    // The first change is written at once: the SDK keeps a write it was handed in every later local
    // snapshot until the server confirms or refuses it, so the next snapshot includes it. The second
    // change waits in its one-second window, which no snapshot knows about yet.
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
    storage.getOne("u1").subscribe();
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

  it("queues a field change made during the hold for flushPending, and skips whole-document writes", () => {
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
    FirestoreStorage.holdWrites();
    storage.patchFields("u1", [{ path: ["data", "b"], value: 3 }]);
    storage.setOne("u2", { data: {} }).subscribe();
    expect(FirestoreStorage.writesArePaused()).toBe(true);
    expect(FirestoreStorage.hasPending()).toBe(true);
    // Not even once its window would have closed: only flushPending sends the queue.
    jest.advanceTimersByTime(5000);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    FirestoreStorage.flushPending();
    expect(updateDoc).toHaveBeenCalledTimes(2);
    expect(updateDoc).toHaveBeenLastCalledWith(atDoc("completion/u1"), new FieldPath("data", "a"), 2, new FieldPath("data", "b"), 3);
    expect(FirestoreStorage.hasPending()).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("shows a field change made during the hold at once", () => {
    const states = new Subject<DocState<TestDoc>>();
    jest.mocked(docSnapshot$).mockReturnValue(states);
    const shown: TestDoc[] = [];
    storage.getOne("u1").subscribe(d => shown.push(JSON.parse(JSON.stringify(d))));
    states.next(snap({ $key: "u1", data: {} }));
    FirestoreStorage.holdWrites();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    expect(shown[shown.length - 1].data).toEqual({ a: 1 });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("sends the changes held back when writing resumes (the account change was refused)", () => {
    FirestoreStorage.holdWrites();
    storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
    FirestoreStorage.resumeWrites();
    expect(updateDoc).toHaveBeenCalledWith(atDoc("completion/u1"), new FieldPath("data", "a"), 1);
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

  describe("live document (synced between tabs and devices)", () => {
    /** The object getOne shows now, as the checklist holds it (edited in place by its click handler). */
    let current: TestDoc | undefined;
    const shown = (): TestDoc => current as TestDoc;

    /** Collects deep copies, so a later change to the emitted object cannot rewrite what was seen. */
    function watch(key = "u1"): TestDoc[] {
      const seen: TestDoc[] = [];
      current = undefined;
      storage.getOne(key).subscribe(doc => {
        current = doc;
        seen.push(JSON.parse(JSON.stringify(doc)));
      });
      return seen;
    }

    it("shows the cached copy at once on startup, then the server copy", () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { old: 1 } }, true));
      expect(seen).toEqual([{ $key: "u1", data: { old: 1 }, fromCache: true }]);
      snapshots.next(snap({ $key: "u1", data: { fromOtherDevice: 1 } }));
      expect(seen).toEqual([
        { $key: "u1", data: { old: 1 }, fromCache: true },
        { $key: "u1", data: { fromOtherDevice: 1 } }
      ]);
    });

    it("shows a later snapshot from another device with a different entry", () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      snapshots.next(snap({ $key: "u1", data: { a: 1, b: 1 } }));
      expect(seen).toEqual([
        { $key: "u1", data: { a: 1 } },
        { $key: "u1", data: { a: 1, b: 1 } }
      ]);
      expect(snapshots.observed).toBe(true);
    });

    it("offline, keeps a queued tick when the server copy arrives, and still shows later changes", () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { cached: 1 } }, true));
      // The first tick is written at once; the second waits in its one-second window.
      storage.patchFields("u1", [{ path: ["data", "tick1"], value: 1 }]);
      storage.patchFields("u1", [{ path: ["data", "tick2"], value: 1 }]);
      // Back online: the server copy already holds the written tick (the SDK shows its local writes).
      snapshots.next(snap({ $key: "u1", data: { cached: 1, otherDevice: 1, tick1: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { cached: 1, otherDevice: 1, tick1: 1, tick2: 1 } });
      snapshots.next(snap({ $key: "u1", data: { cached: 1, otherDevice: 2, tick1: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { cached: 1, otherDevice: 2, tick1: 1, tick2: 1 } });
    });

    it("an in-place click cannot hide another device undoing it", async () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      // The click handler edits the shown object, then patches the field (written at once).
      const doc = shown();
      doc.data["a"] = 2;
      storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 2 } });
      // The server confirms the write.
      await settle();
      // Another device sets it back. The snapshot equals the one before the click, so it would be
      // skipped as "unchanged" if the copy it is compared with were not the one on screen.
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 1 } });
      expect(shown().data).toEqual({ a: 1 });
    });

    it("a field change made without an in-place edit cannot hide another device undoing it either", async () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 2 } });
      await settle();
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 1 } });
    });

    it("does not bring back a written tick once another device changes that entry", async () => {
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 0 } }));
      storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
      storage.patchFields("u1", [{ path: ["data", "b"], value: 1 }]);
      // A snapshot from another device while b waits in its window: b stays on screen.
      snapshots.next(snap({ $key: "u1", data: { a: 1, c: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 1, c: 1, b: 1 } });
      jest.advanceTimersByTime(1000);
      expect(updateDoc).toHaveBeenLastCalledWith(atDoc("completion/u1"), new FieldPath("data", "b"), 1);
      snapshots.next(snap({ $key: "u1", data: { a: 1, b: 1, c: 1 } }));
      await settle();
      // Another device clears b: nothing is pending or in flight any more, so its value wins.
      snapshots.next(snap({ $key: "u1", data: { a: 1, b: 0, c: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 1, b: 0, c: 1 } });
    });

    it("keeps a written change on screen when a snapshot without it comes before the SDK has it", async () => {
      const first = deferred();
      const second = deferred();
      jest.mocked(updateDoc).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 0 } }));
      // Click 1 is written at once; click 2 waits for the window and is written when it closes.
      storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
      storage.patchFields("u1", [{ path: ["data", "a"], value: 2 }]);
      jest.advanceTimersByTime(1000);
      expect(updateDoc).toHaveBeenCalledTimes(2);
      // A snapshot raised for click 1 only, delivered before the SDK added click 2 to its local view.
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 2 } });
      first.resolve();
      second.resolve();
      await settle();
      // Both writes settled: a later change from another device shows as it is.
      snapshots.next(snap({ $key: "u1", data: { a: 5 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 5 } });
    });

    it("keeps the first tick on a new document when the server reports it missing again before the create lands", async () => {
      const create = deferred();
      jest.mocked(updateDoc).mockReturnValueOnce(Promise.reject({ code: "not-found" }));
      jest.mocked(setDoc).mockReturnValueOnce(create.promise);
      const seen = watch();
      snapshots.next(snap(undefined));
      expect(seen).toEqual([{ $key: "u1", notFound: true }]);
      storage.patchFields("u1", [{ path: ["data", "t"], value: 1 }]);
      await settle();
      expect(setDoc).toHaveBeenCalledWith(atDoc("completion/u1"), { data: { t: 1 } }, { merge: true });
      snapshots.next(snap(undefined));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { t: 1 } });
      create.resolve();
      await settle();
      snapshots.next(snap({ $key: "u1", data: { t: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { t: 1 } });
    });

    it("a whole-document write stops showing field changes still in flight", () => {
      jest.mocked(updateDoc).mockReturnValueOnce(deferred().promise);
      const seen = watch();
      snapshots.next(snap({ $key: "u1", data: { a: 0 } }));
      storage.patchFields("u1", [{ path: ["data", "a"], value: 1 }]);
      storage.setOne("u1", { data: { a: 0, reset: 1 } });
      snapshots.next(snap({ $key: "u1", data: { a: 0, reset: 1 } }));
      expect(seen[seen.length - 1]).toEqual({ $key: "u1", data: { a: 0, reset: 1 } });
    });

    it("keeps one listener per document until its last subscriber leaves", () => {
      const first = storage.getOne("u1").subscribe();
      const second = storage.getOne("u1").subscribe();
      first.unsubscribe();
      storage.getOne("u1").subscribe().unsubscribe();
      expect(docSnapshot$).toHaveBeenCalledTimes(1);
      second.unsubscribe();
      storage.getOne("u1").subscribe();
      expect(docSnapshot$).toHaveBeenCalledTimes(2);
    });

    it("saving the shown object as a whole document keeps its $key on screen", () => {
      watch();
      snapshots.next(snap({ $key: "u1", data: { a: 1 } }));
      const doc = shown();
      const converter = (storage as unknown as { converter: { toFirestore(doc: TestDoc): unknown } }).converter;
      expect(converter.toFirestore(doc)).toEqual({ data: { a: 1 } });
      storage.setOne(doc.$key, doc);
      expect(doc.$key).toBe("u1");
      expect(setDoc).toHaveBeenCalledWith(atDoc("completion/u1"), doc);
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

describe("FirestoreStorage.flushPendingLocally", () => {
  let storage: TestStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TestStorage();
  });

  afterEach(() => jest.useRealTimers());

  /** Whether the promise has settled after the pending microtasks ran. */
  async function isDone(promise: Promise<void>): Promise<boolean> {
    let done = false;
    promise.then(() => done = true);
    await settle();
    return done;
  }

  it("sends the queued changes first, then waits for a cache read queued behind them", async () => {
    let finishRead: () => void = () => undefined;
    jest.mocked(getDocFromCache).mockImplementationOnce(() => new Promise(resolve => finishRead = () => resolve({} as never)));
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 1 } }]);
    storage.patchFields("u1", [{ path: ["data", "1:t1"], value: { amount: 2 } }]);
    const flushed = FirestoreStorage.flushPendingLocally();
    expect(updateDoc).toHaveBeenCalledWith(atDoc("completion/u1"), new FieldPath("data", "1:t1"), { amount: 2 });
    const writes = jest.mocked(updateDoc).mock.invocationCallOrder;
    expect(writes[writes.length - 1]).toBeLessThan(jest.mocked(getDocFromCache).mock.invocationCallOrder[0]);
    expect(await isDone(flushed)).toBe(false);
    finishRead();
    expect(await isDone(flushed)).toBe(true);
  });

  it("resolves when the cache read fails (the document is not cached)", async () => {
    jest.mocked(getDocFromCache).mockRejectedValueOnce(new Error("unavailable"));
    expect(await isDone(FirestoreStorage.flushPendingLocally())).toBe(true);
  });

  it("gives up waiting after a short timeout, so a reload is never blocked", async () => {
    jest.mocked(getDocFromCache).mockImplementationOnce(() => new Promise(() => undefined));
    const flushed = FirestoreStorage.flushPendingLocally();
    jest.advanceTimersByTime(FirestoreStorage.LOCAL_HANDOFF_TIMEOUT_MS - 1);
    expect(await isDone(flushed)).toBe(false);
    jest.advanceTimersByTime(1);
    expect(await isDone(flushed)).toBe(true);
  });
});
