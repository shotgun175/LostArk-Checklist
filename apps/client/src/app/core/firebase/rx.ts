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

/** Live document data, including metadata changes; undefined while the document does not exist. */
export function docData$<T>(ref: DocumentReference<T>, options: DataOptions = {}): Observable<T | undefined> {
  return fromListener<T | undefined>((next, error) => onSnapshot(ref, { includeMetadataChanges: true }, {
    next: snapshot => next(snapshotData(snapshot, options)),
    error
  }));
}

/** Live query results in query order, including metadata changes. */
export function collectionData$<T>(q: Query<T>, options: DataOptions = {}): Observable<T[]> {
  return fromListener<T[]>((next, error) => onSnapshot(q, { includeMetadataChanges: true }, {
    next: snapshot => next(snapshot.docs.map(docSnapshot => snapshotData(docSnapshot, options) as T)),
    error
  }));
}
