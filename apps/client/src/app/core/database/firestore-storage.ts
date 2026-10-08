import { DataModel } from "./data-model";
import { catchError, distinctUntilChanged, EMPTY, filter, finalize, first, from, map, merge, Observable, of, shareReplay, Subject, tap } from "rxjs";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  FirestoreDataConverter,
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
import { collectionData$, docData$ } from "../firebase/rx";
import { environment } from "../../../environments/environment";
import { startWith, switchMap } from "rxjs/operators";
import { applyFieldWrites, FieldWrite, WriteCoalescer } from "./write-coalescer";

export abstract class FirestoreStorage<T extends DataModel> {

  protected static OPERATIONS: Record<string, Record<"read" | "write" | "delete", number>> = {};

  protected shouldClone = true;

  protected converter: FirestoreDataConverter<T> = {
    toFirestore: (modelObject: WithFieldValue<T>): DocumentData => {
      const workingCopy: Partial<WithFieldValue<T>> = (this.shouldClone ? { ...modelObject } : modelObject) as Partial<WithFieldValue<T>>;
      delete workingCopy.$key;
      delete workingCopy.notFound;
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

  private static readonly coalescers: WriteCoalescer[] = [];
  private static flushOnHideRegistered = false;
  private static writesPaused = false;
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
   * Stops every write from the data services and drops queued field changes without writing them.
   * Used only while an account is deleted, so live listeners cannot re-create the deleted documents.
   * A page reload ends the pause.
   */
  public static pauseWrites(): void {
    FirestoreStorage.writesPaused = true;
    FirestoreStorage.coalescers.forEach(coalescer => coalescer.discard());
  }

  public static resumeWrites(): void {
    FirestoreStorage.writesPaused = false;
  }

  /** True while an account is being deleted, so services can skip prompts that would write. */
  public static writesArePaused(): boolean {
    return FirestoreStorage.writesPaused;
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

  public query(...filterQuery: QueryConstraint[]): Observable<T[]> {
    return collectionData$(query(this.collection, ...filterQuery).withConverter(this.converter)).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      catchError(err => this.endListener(err))
    );
  }

  public getOne(key: string, isForCurrentUser = false): Observable<T> {
    if (!this.cache[key]) {
      const source$ = docData$(this.docRef(key)).pipe(
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(() => this.recordOperation("read", "wtf")),
        tap(res => {
          if (res) {
            this.seenPresent.add(key);
          }
        }),
        // A document seen before that is now gone was deleted with the account: keep the last copy.
        filter(res => !!res || !this.seenPresent.has(key)),
        map(res => {
          if (!res) {
            return {
              $key: key,
              notFound: true
            } as T;
          }
          return res;
        })
      );
      if (isForCurrentUser) {
        this.updateSources[key] = new Subject<FieldWrite[]>();
        this.setSources[key] = new Subject<T>();
        this.cache[key] = merge(
          this.setSources[key],
          source$.pipe(first())
        ).pipe(
          switchMap((obj) => {
            return this.updateSources[key].pipe(
              map(writes => this.withLocalWrites(obj, writes)),
              startWith(obj)
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

  public addOne(row: Omit<T, "$key">): Observable<string> {
    if (FirestoreStorage.writesPaused) {
      return EMPTY;
    }
    return from(addDoc(this.collection, row)).pipe(
      tap(() => this.recordOperation("write")),
      map(ref => ref.id)
    );
  }

  public deleteOne(key: string): Observable<void> {
    if (FirestoreStorage.writesPaused) {
      return of(void 0);
    }
    this.recordOperation("delete", key);
    return from(deleteDoc(this.docRef(key)));
  }

  public setOne(key: string, row: Omit<T, "$key" | "notFound">): Observable<void> {
    if (FirestoreStorage.writesPaused) {
      return of(void 0);
    }
    this.coalescer.discard(key);
    this.recordOperation("write", key);
    if (this.setSources[key]) {
      this.setSources[key].next({ ...row, $key: key } as T);
    }
    return from(setDoc(this.docRef(key), row));
  }

  public updateOne(key: string, row: UpdateData<T>): Observable<void> {
    if (FirestoreStorage.writesPaused) {
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
    if (FirestoreStorage.writesPaused) {
      const paused = { set: () => paused, update: () => paused, delete: () => paused, commit: () => Promise.resolve() };
      return paused as unknown as WriteBatch;
    }
    return writeBatch(this.firestore);
  }

  protected abstract getCollectionName(): string;
}
