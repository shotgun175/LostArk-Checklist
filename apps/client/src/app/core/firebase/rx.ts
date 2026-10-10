import { Observable } from "rxjs";
import { Auth, onAuthStateChanged, onIdTokenChanged, User } from "firebase/auth";
import { DocumentReference, DocumentSnapshot, onSnapshot, Query } from "firebase/firestore";

export interface DataOptions {
  idField?: string;
}

interface ZoneLike {
  run<R>(fn: () => R): R;
}

/**
 * Wraps a Firebase listener as an Observable. The listener is registered in the root zone, so
 * Firebase's own timers and network callbacks do not trigger change detection, and every emission
 * re-enters the zone the subscriber was in (the Angular zone in the app), as AngularFire did.
 * Without zone.js both happen directly.
 */
function fromListener<T>(listen: (next: (value: T) => void, error: (err: unknown) => void) => () => void): Observable<T> {
  return new Observable<T>(subscriber => {
    const zone = (globalThis as unknown as { Zone?: { current: ZoneLike; root: ZoneLike } }).Zone;
    const subscriberZone = zone?.current;
    const enter = (fn: () => void): void => {
      if (subscriberZone) {
        subscriberZone.run(fn);
      } else {
        fn();
      }
    };
    const start = (): (() => void) => listen(
      value => enter(() => subscriber.next(value)),
      err => enter(() => subscriber.error(err))
    );
    return zone ? zone.root.run(start) : start();
  });
}

// Same result as rxfire's snapToData, which AngularFire used: a missing document gives undefined
function snapshotData<T>(snapshot: DocumentSnapshot<T>, options: DataOptions): T | undefined {
  const data = snapshot.data();
  if (!snapshot.exists() || typeof data !== "object" || data === null || !options.idField) {
    return data;
  }
  return { ...data, [options.idField]: snapshot.id };
}

/** Emits the signed-in user on sign-in and sign-out (not on token refresh). */
export function authState$(auth: Auth): Observable<User | null> {
  return fromListener<User | null>((next, error) => onAuthStateChanged(auth, next, error));
}

/**
 * Emits the signed-in user on sign-in, sign-out and every ID token change. Unlike authState$, it
 * also fires when a guest registers, because linking keeps the same user and only refreshes the token.
 */
export function idTokenState$(auth: Auth): Observable<User | null> {
  return fromListener<User | null>((next, error) => onIdTokenChanged(auth, next, error));
}

/** One document snapshot: the data (undefined while the document does not exist) and where it came from. */
export interface DocState<T> {
  data: T | undefined;
  exists: boolean;
  /** True when the snapshot came from the local cache, not from the server. */
  fromCache: boolean;
  /** True while the data includes local writes the server has not confirmed yet. */
  hasPendingWrites: boolean;
}

/** One query snapshot: the documents in query order and where they came from. */
export interface QueryState<T> {
  docs: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
}

/**
 * Live document snapshots, including metadata changes. With a local cache the first snapshot can
 * come from the cache, and offline a document that was never cached is reported as missing from
 * the cache: only a server snapshot (fromCache false) proves that a document does not exist.
 */
export function docSnapshot$<T>(ref: DocumentReference<T>, options: DataOptions = {}): Observable<DocState<T>> {
  return fromListener<DocState<T>>((next, error) => onSnapshot(ref, { includeMetadataChanges: true }, {
    next: snapshot => next({
      data: snapshotData(snapshot, options),
      exists: snapshot.exists(),
      fromCache: snapshot.metadata.fromCache,
      hasPendingWrites: snapshot.metadata.hasPendingWrites
    }),
    error
  }));
}

/** Live query snapshots in query order, including metadata changes. */
export function collectionSnapshot$<T>(q: Query<T>, options: DataOptions = {}): Observable<QueryState<T>> {
  return fromListener<QueryState<T>>((next, error) => onSnapshot(q, { includeMetadataChanges: true }, {
    next: snapshot => next({
      docs: snapshot.docs.map(docSnapshot => snapshotData(docSnapshot, options) as T),
      fromCache: snapshot.metadata.fromCache,
      hasPendingWrites: snapshot.metadata.hasPendingWrites
    }),
    error
  }));
}
