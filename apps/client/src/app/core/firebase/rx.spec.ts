import { Auth, User } from "firebase/auth";
import { DocumentReference, Query } from "firebase/firestore";
import { authState$, collectionData$, docData$ } from "./rx";

const mockOnSnapshot = jest.fn();
const mockOnAuthStateChanged = jest.fn();

// Factories only: the real Node build of firebase/auth 10 cannot load on Node 16.
jest.mock("firebase/firestore", () => ({
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args)
}));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args)
}));

interface TestZone {
  name: string;
  run<R>(fn: () => R): R;
  fork(spec: { name: string }): TestZone;
}

// zone.js is loaded by jest-preset-angular's setup file
const zones = (globalThis as unknown as { Zone: { current: TestZone; root: TestZone } }).Zone;

interface SnapshotObserver {
  next: (snapshot: unknown) => void;
  error: (err: unknown) => void;
}

interface Row {
  name: string;
}

function docSnapshot(id: string, data: Record<string, unknown> | undefined) {
  return { id, exists: () => data !== undefined, data: () => data };
}

function lastSnapshotObserver(): SnapshotObserver {
  return mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1][2];
}

const ref = { id: "uid-1" } as unknown as DocumentReference<Row>;
const rowsQuery = {} as unknown as Query<Row>;
const auth = {} as unknown as Auth;

describe("docData$", () => {
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    unsubscribe = jest.fn();
    mockOnSnapshot.mockReset().mockReturnValue(unsubscribe);
  });

  it("listens with metadata changes and emits the converted data", () => {
    const values: unknown[] = [];
    docData$(ref).subscribe(value => values.push(value));
    expect(mockOnSnapshot).toHaveBeenCalledWith(ref, { includeMetadataChanges: true }, expect.anything());
    lastSnapshotObserver().next(docSnapshot("uid-1", { name: "Arwen", $key: "uid-1" }));
    expect(values).toEqual([{ name: "Arwen", $key: "uid-1" }]);
  });

  it("emits undefined for a document that does not exist", () => {
    const values: unknown[] = [];
    docData$(ref).subscribe(value => values.push(value));
    lastSnapshotObserver().next(docSnapshot("uid-1", undefined));
    expect(values).toEqual([undefined]);
  });

  it("adds the id under idField for an existing document only", () => {
    const values: unknown[] = [];
    docData$(ref, { idField: "id" }).subscribe(value => values.push(value));
    lastSnapshotObserver().next(docSnapshot("uid-1", { name: "Arwen" }));
    lastSnapshotObserver().next(docSnapshot("uid-1", undefined));
    expect(values).toEqual([{ name: "Arwen", id: "uid-1" }, undefined]);
  });

  it("passes listener errors to the subscriber", () => {
    const errors: unknown[] = [];
    docData$(ref).subscribe({ error: err => errors.push(err) });
    const denied = new Error("permission-denied");
    lastSnapshotObserver().error(denied);
    expect(errors).toEqual([denied]);
  });

  it("stops listening on unsubscribe", () => {
    const subscription = docData$(ref).subscribe();
    expect(unsubscribe).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("registers the listener in the root zone and emits in the subscriber's zone", () => {
    let registeredIn = "";
    mockOnSnapshot.mockImplementation(() => {
      registeredIn = zones.current.name;
      return unsubscribe;
    });
    const appZone = zones.current.fork({ name: "app" });
    const emittedIn: string[] = [];
    appZone.run(() => docData$(ref).subscribe(() => emittedIn.push(zones.current.name)));
    zones.root.run(() => lastSnapshotObserver().next(docSnapshot("uid-1", { name: "Arwen" })));
    expect(registeredIn).toBe(zones.root.name);
    expect(emittedIn).toEqual(["app"]);
  });
});

describe("collectionData$", () => {
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    unsubscribe = jest.fn();
    mockOnSnapshot.mockReset().mockReturnValue(unsubscribe);
  });

  it("emits every document's data in query order, with idField when asked", () => {
    const plain: unknown[] = [];
    const withId: unknown[] = [];
    collectionData$(rowsQuery).subscribe(value => plain.push(value));
    expect(mockOnSnapshot).toHaveBeenCalledWith(rowsQuery, { includeMetadataChanges: true }, expect.anything());
    lastSnapshotObserver().next({ docs: [docSnapshot("a", { name: "Arwen" }), docSnapshot("b", { name: "Brakka" })] });
    collectionData$(rowsQuery, { idField: "id" }).subscribe(value => withId.push(value));
    lastSnapshotObserver().next({ docs: [docSnapshot("a", { name: "Arwen" })] });
    expect(plain).toEqual([[{ name: "Arwen" }, { name: "Brakka" }]]);
    expect(withId).toEqual([[{ name: "Arwen", id: "a" }]]);
  });

  it("passes listener errors to the subscriber", () => {
    const errors: unknown[] = [];
    collectionData$(rowsQuery).subscribe({ error: err => errors.push(err) });
    const denied = new Error("permission-denied");
    lastSnapshotObserver().error(denied);
    expect(errors).toEqual([denied]);
  });

  it("stops listening on unsubscribe", () => {
    collectionData$(rowsQuery).subscribe().unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("authState$", () => {
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    unsubscribe = jest.fn();
    mockOnAuthStateChanged.mockReset().mockReturnValue(unsubscribe);
  });

  function handlers(): { next: (user: User | null) => void; error: (err: unknown) => void } {
    const call = mockOnAuthStateChanged.mock.calls[mockOnAuthStateChanged.mock.calls.length - 1];
    return { next: call[1], error: call[2] };
  }

  it("emits the signed-in user, then null after sign-out", () => {
    const values: unknown[] = [];
    authState$(auth).subscribe(value => values.push(value));
    expect(mockOnAuthStateChanged.mock.calls[0][0]).toBe(auth);
    const user = { uid: "uid-1", isAnonymous: true } as unknown as User;
    handlers().next(user);
    handlers().next(null);
    expect(values).toEqual([user, null]);
  });

  it("passes errors to the subscriber and stops listening on unsubscribe", () => {
    const errors: unknown[] = [];
    const subscription = authState$(auth).subscribe({ error: err => errors.push(err) });
    const failure = new Error("network-request-failed");
    handlers().error(failure);
    expect(errors).toEqual([failure]);
    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("emits in the subscriber's zone", () => {
    const appZone = zones.current.fork({ name: "app" });
    const emittedIn: string[] = [];
    appZone.run(() => authState$(auth).subscribe(() => emittedIn.push(zones.current.name)));
    zones.root.run(() => handlers().next(null));
    expect(emittedIn).toEqual(["app"]);
  });
});
