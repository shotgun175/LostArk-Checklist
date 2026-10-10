import { DataModel } from "./data-model";
import { catchError, delay, distinctUntilChanged, EMPTY, filter, finalize, first, from, map, merge, Observable, of, share, shareReplay, Subject, takeUntil, tap, throwError } from "rxjs";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  FirestoreDataConverter,
  getDocFromCache,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  setDoc,
  Transaction,
  UpdateData,
  updateDoc,
  WithFieldValue,
  WriteBatch,
  QueryConstraint,
  writeBatch
} from "firebase/firestore";
import { collectionSnapshot$, docSnapshot$, QueryState } from "../firebase/rx";
import { environment } from "../../../environments/environment";
import { startWith, switchMap } from "rxjs/operators";
import { applyFieldWrites, FieldWrite, WriteCoalescer } from "./write-coalescer";

export abstract class FirestoreStorage<T extends DataModel> {

  /**
   * How long a current-user document waits for the server's copy before it shows this device's
   * cached copy instead (offline). The server's copy still replaces it when it arrives.
   */
  public static readonly SERVER_COPY_WAIT_MS = 2000;

  protected static OPERATIONS: Record<string, Record<"read" | "write" | "delete", number>> = {};

  protected shouldClone = true;

  protected converter: FirestoreDataConverter<T> = {
    toFirestore: (modelObject: WithFieldValue<T>): DocumentData => {
      const workingCopy: Partial<WithFieldValue<T>> = (this.shouldClone ? { ...modelObject } : modelObject) as Partial<WithFieldValue<T>>;
      delete workingCopy.$key;
      delete workingCopy.notFound;
      delete workingCopy.fromCache;
      Object.entries(workingCopy)
        .forEach(([key, value]) => {
          if (value === undefined) {
            delete workingCopy[key];
          }
        });
      return workingCopy as T;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return {
        ...snapshot.data(),
        $key: snapshot.id
      } as T;
    }
  };

  protected cache: Record<string, Observable<T>> = {};

  protected updateSources: Record<string, Subject<FieldWrite[]>> = {};
  /** Local field changes for documents read with a live listener (not the current-user path). */
  private fieldWriteSources: Record<string, Subject<FieldWrite[]>> = {};
  /**
   * Documents this page has read as existing. These per-user documents are only ever removed by
   * account deletion (possibly in another tab, where pauseWrites does not reach), so one that
   * disappears must not be treated as missing and re-created with defaults or local data.
   */
  private readonly seenPresent = new Set<string>();

  /** How long flushPendingLocally waits for the local write at most, so a stuck write never blocks a reload. */
  public static readonly LOCAL_HANDOFF_TIMEOUT_MS = 2000;

  private static readonly coalescers: WriteCoalescer[] = [];
  private static db?: Firestore;
  private static flushOnHideRegistered = false;
  private static writesPaused = false;
  private static writesHeld = false;
  private readonly coalescer = new WriteCoalescer((key, writes) => this.commitFieldWrites(key, writes));
  protected setSources: Record<string, Subject<T>> = {};

  protected readonly collection = collection(this.firestore, this.getCollectionName()).withConverter(this.converter);

  protected constructor(protected firestore: Firestore) {
    if (!window["getOperationsStats"]) {
      window["getOperationsStats"] = () => {
        const totals = {
          read: 0,
          write: 0,
          delete: 0
        };
        Object.entries(FirestoreStorage.OPERATIONS).forEach(([uri, stats]) => {
          console.group(uri);
          Object.entries(stats).forEach(([op, count]) => {
            console.log(`${op}: ${count}`);
            totals[op] += count;
          });
          console.groupEnd();
        });
        console.group("TOTALS");
        Object.entries(totals).forEach(([op, count]) => {
          console.log(`${op}: ${count}`);
        });
        console.groupEnd();
      };
    }
    FirestoreStorage.db ??= firestore;
    FirestoreStorage.coalescers.push(this.coalescer);
    if (!FirestoreStorage.flushOnHideRegistered) {
      FirestoreStorage.flushOnHideRegistered = true;
      // Write queued field changes before the tab is hidden or closed.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          FirestoreStorage.flushPending();
        }
      });
      window.addEventListener("pagehide", () => FirestoreStorage.flushPending());
    }
  }

  /**
   * Writes every queued field change of every collection now. Call it before a write that must land
   * after them (import) and before the signed-in user changes, so they are sent as the user who made them.
   */
  public static flushPending(): void {
    FirestoreStorage.coalescers.forEach(coalescer => coalescer.flush());
  }

  /**
   * Like flushPending, then waits until this device's cache has the queued changes, so a reload right
   * after cannot cut them off. Resolves offline too (it never waits for the server).
   */
  public static async flushPendingLocally(): Promise<void> {
    FirestoreStorage.flushPending();
    const db = FirestoreStorage.db;
    if (!db) {
      return;
    }
    // A cache read runs on the SDK's queue after the writes just started, so it finishes only once
    // they are saved locally. The document does not need to exist.
    const handoff = getDocFromCache(doc(db, "users", "local-write-handoff")).then(() => undefined, () => undefined);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([handoff, new Promise<void>(resolve => timeout = setTimeout(resolve, FirestoreStorage.LOCAL_HANDOFF_TIMEOUT_MS))]);
    clearTimeout(timeout);
  }

  /**
   * Stops every write from the data services and drops queued field changes without writing them.
   * Used while an account is deleted, so live listeners cannot re-create the deleted documents, and
   * after an import, so they cannot rewrite the imported documents from stale data. A page reload
   * ends the pause.
   */
  public static pauseWrites(): void {
    FirestoreStorage.writesPaused = true;
    FirestoreStorage.coalescers.forEach(coalescer => coalescer.discard());
  }

  /**
   * Used while Log out, Sign in or account deletion waits for this device's changes to reach the
   * server. Field changes still show at once but are only queued, and flushPending sends them, so
   * the wait can include them; whole-document writes are skipped as with pauseWrites. resumeWrites
   * ends it and sends what was queued.
   */
  public static holdWrites(): void {
    FirestoreStorage.writesHeld = true;
    // A window closing during the hold would write outside the wait.
    FirestoreStorage.coalescers.forEach(coalescer => coalescer.closeWindows());
  }

  public static resumeWrites(): void {
    FirestoreStorage.writesPaused = false;
    FirestoreStorage.writesHeld = false;
    FirestoreStorage.flushPending();
  }

  /** Whether any field change is waiting to be written. */
  public static hasPending(): boolean {
    return FirestoreStorage.coalescers.some(coalescer => coalescer.hasQueued());
  }

  /** True while writes are paused or held (account change, import), so services can skip prompts that would write. */
  public static writesArePaused(): boolean {
    return FirestoreStorage.writesPaused || FirestoreStorage.writesHeld;
  }

  public recordOperation(operation: "read" | "write" | "delete", debugData?: unknown): void {
    if (window["verboseOperations"] || environment.verboseOperations) {
      console.log("OPERATION", operation, this.getCollectionName(), debugData);
    }
    FirestoreStorage.OPERATIONS[this.getCollectionName()] = FirestoreStorage.OPERATIONS[this.getCollectionName()] || {
      read: 0,
      write: 0,
      delete: 0
    };
    FirestoreStorage.OPERATIONS[this.getCollectionName()][operation]++;
  }

  protected docRef(key: string): DocumentReference<T> {
    return doc(this.firestore, this.getCollectionName(), key).withConverter(this.converter);
  }

  /**
   * Live query results. fromCache is true while they come from this device's cache: offline, a
   * query that was never cached gives an empty list from the cache, which does not mean it is empty.
   */
  public query(...filterQuery: QueryConstraint[]): Observable<QueryState<T>> {
    return collectionSnapshot$(query(this.collection, ...filterQuery).withConverter(this.converter)).pipe(
      // fromCache is compared too, so the server's copy is emitted even when it matches the cached one.
      distinctUntilChanged((a, b) => a.fromCache === b.fromCache && JSON.stringify(a.docs) === JSON.stringify(b.docs)),
      catchError(err => this.endListener(err))
    );
  }

  /**
   * The live document, with { $key, notFound: true } when the server says it does not exist. A copy
   * from this device's cache carries fromCache: true. A cached "missing" emits nothing: offline it
   * only means this device never stored the document, and treating it as missing would write
   * defaults over the real data.
   *
   * The current-user path (isForCurrentUser) keeps one base copy and only applies this page's own
   * changes to it, so later echoes of those changes cannot make ticks flicker. The base is the
   * server's first copy; offline, the cached copy is shown after SERVER_COPY_WAIT_MS and replaced
   * once by the server's copy when it arrives.
   */
  public getOne(key: string, isForCurrentUser = false): Observable<T> {
    if (!this.cache[key]) {
      const source$ = docSnapshot$(this.docRef(key)).pipe(
        filter(state => !!state.data || !state.fromCache),
        tap(state => {
          if (state.data) {
            this.seenPresent.add(key);
          }
        }),
        // A document seen before that is now gone was deleted with the account: keep the last copy.
        filter(state => !!state.data || !this.seenPresent.has(key)),
        map(state => {
          if (!state.data) {
            return {
              $key: key,
              notFound: true
            } as T;
          }
          return state.fromCache ? { ...state.data, fromCache: true } as T : state.data;
        }),
        // The marker is compared too, so the server's copy is emitted even when it matches the cached one.
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(() => this.recordOperation("read", "wtf"))
      );
      if (isForCurrentUser) {
        this.updateSources[key] = new Subject<FieldWrite[]>();
        this.setSources[key] = new Subject<T>();
        const snapshots$ = source$.pipe(share());
        const serverCopy$ = snapshots$.pipe(filter(obj => !obj.fromCache), first());
        const cachedCopy$ = snapshots$.pipe(
          filter(obj => !!obj.fromCache),
          first(),
          delay(FirestoreStorage.SERVER_COPY_WAIT_MS),
          takeUntil(serverCopy$)
        );
        this.cache[key] = merge(
          this.setSources[key],
          merge(serverCopy$, cachedCopy$)
        ).pipe(
          switchMap((obj) => {
            return this.updateSources[key].pipe(
              map(writes => this.withLocalWrites(obj, writes)),
              // Changes still waiting in their one-second window are not in a replacing server copy yet.
              startWith(this.withLocalWrites(obj, this.coalescer.pending(key)))
            );
          })
        );
      } else {
        const fieldWrites$ = this.fieldWriteSources[key] = this.fieldWriteSources[key] ?? new Subject<FieldWrite[]>();
        this.cache[key] = source$.pipe(
          // Pending field changes are applied to every snapshot, so a snapshot that arrives
          // before they are written cannot undo them on screen.
          switchMap(obj => fieldWrites$.pipe(
            map(writes => this.withLocalWrites(obj, writes)),
            startWith(this.withLocalWrites(obj, this.coalescer.pending(key)))
          )),
          catchError(err => this.endListener(err)),
          shareReplay({ refCount: true, bufferSize: 1 }),
          finalize(() => delete this.cache[key])
        );
      }
    }
    return this.cache[key];
  }

  private withLocalWrites(obj: T, writes: readonly FieldWrite[]): T {
    if (writes.length > 0) {
      applyFieldWrites(obj, writes);
      // A field change creates the document if it was missing, so it is no longer "not found".
      delete obj.notFound;
    }
    return obj;
  }

  /**
   * Changes only the given fields of one document. The change shows at once. A change to a document
   * with no recent writes is written at once; further changes within the next second are written
   * together when that second is over.
   */
  public patchFields(key: string, writes: FieldWrite[]): void {
    if (FirestoreStorage.writesPaused) {
      return;
    }
    (this.updateSources[key] ?? this.fieldWriteSources[key])?.next(writes);
    if (FirestoreStorage.writesHeld) {
      this.coalescer.queue(key, writes);
      return;
    }
    this.coalescer.enqueue(key, writes);
  }

  private commitFieldWrites(key: string, writes: FieldWrite[]): void {
    this.recordOperation("write", key);
    const ref = doc(this.firestore, this.getCollectionName(), key);
    const [field, value, ...more] = writes.flatMap(write => [new FieldPath(...write.path), "delete" in write ? deleteField() : write.value]);
    updateDoc(ref, field as FieldPath, value, ...more)
      .catch((error: { code?: string }) => {
        if (FirestoreStorage.writesPaused) {
          // The document was deleted with the account; creating it again would undo that.
          return;
        }
        if (error?.code === "not-found") {
          if (this.seenPresent.has(key)) {
            // It existed before, so it was deleted with the account (in another tab).
            return;
          }
          // First write for this document: create it with the same fields.
          return setDoc(ref, applyFieldWrites({}, writes), { merge: true });
        }
        throw error;
      })
      .catch(error => console.error(`Could not save ${this.getCollectionName()}/${key}:`, error));
  }

  // After Log out or Sign in, Firestore re-checks the previous user's live listeners with the new
  // credentials and the rules deny them. Ending that listener here keeps the outer per-user stream alive.
  private endListener(err: unknown): Observable<never> {
    console.warn(`Stopped a ${this.getCollectionName()} listener:`, err);
    return EMPTY;
  }

  /**
   * Creates a document with an id made on this device and returns the id at once: the write itself
   * only settles when the server confirms it, which offline can take until the next visit.
   */
  public addOne(row: Omit<T, "$key">): Observable<string> {
    if (FirestoreStorage.writesArePaused()) {
      return EMPTY;
    }
    const ref = doc(this.collection);
    try {
      setDoc(ref, row as WithFieldValue<T>)
        .catch(error => console.error(`Could not save ${this.getCollectionName()}/${ref.id}:`, error));
    } catch (error) {
      // Data Firestore cannot store is refused at once.
      return throwError(() => error);
    }
    this.recordOperation("write", ref.id);
    return of(ref.id);
  }

  public deleteOne(key: string): Observable<void> {
    if (FirestoreStorage.writesArePaused()) {
      return of(void 0);
    }
    this.recordOperation("delete", key);
    return from(deleteDoc(this.docRef(key)));
  }

  public setOne(key: string, row: Omit<T, "$key" | "notFound">): Observable<void> {
    if (FirestoreStorage.writesArePaused()) {
      return of(void 0);
    }
    this.coalescer.discard(key);
    this.recordOperation("write", key);
    if (this.setSources[key]) {
      this.setSources[key].next({ ...row, $key: key } as T);
    }
    return from(setDoc(this.docRef(key), row));
  }

  /**
   * Replaces a whole document without waiting for the server, which offline would hold up the
   * stream that asked for it. The new data shows at once; a failure is only logged.
   */
  public setOneInBackground(key: string, row: Omit<T, "$key" | "notFound">): void {
    this.setOne(key, row).subscribe({
      error: (error: unknown) => console.error(`Could not save ${this.getCollectionName()}/${key}:`, error)
    });
  }

  public updateOne(key: string, row: UpdateData<T>): Observable<void> {
    if (FirestoreStorage.writesArePaused()) {
      return of(void 0);
    }
    this.recordOperation("write", key);
    if (this.updateSources[key]) {
      this.updateSources[key].next(Object.entries(row as Record<string, unknown>)
        // Skipping array manipulations
        .filter(([, value]) => typeof value !== "function")
        .map(([field, value]) => ({ path: field.split("."), value })));
    }
    return from(updateDoc(this.docRef(key), row));
  }

  protected transaction<R>(transaction: (t: Transaction) => Promise<R>): Observable<R> {
    return from(runTransaction(this.firestore, transaction));
  }

  protected batch(): WriteBatch {
    if (FirestoreStorage.writesArePaused()) {
      const paused = { set: () => paused, update: () => paused, delete: () => paused, commit: () => Promise.resolve() };
      return paused as unknown as WriteBatch;
    }
    return writeBatch(this.firestore);
  }

  protected abstract getCollectionName(): string;
}
