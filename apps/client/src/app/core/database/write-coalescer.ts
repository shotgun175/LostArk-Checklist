/** One field change inside a document, addressed by field names from the top of the document. */
export type FieldWrite =
  | { readonly path: readonly string[]; readonly value: unknown }
  | { readonly path: readonly string[]; readonly delete: true };

type FieldMap = Record<string, unknown>;

function isMap(value: unknown): value is FieldMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDelete(write: FieldWrite): boolean {
  return "delete" in write;
}

function startsWith(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, i) => path[i] === segment);
}

/**
 * Applies field changes to a plain object in place and returns it. A missing or non-map parent
 * becomes a map, as Firestore does for an update with a field path. Field names are never split.
 */
export function applyFieldWrites<T extends object>(target: T, writes: readonly FieldWrite[]): T {
  writes.forEach(write => {
    let parent = target as FieldMap;
    for (const segment of write.path.slice(0, -1)) {
      if (!isMap(parent[segment])) {
        if (isDelete(write)) {
          return;
        }
        parent[segment] = {};
      }
      parent = parent[segment] as FieldMap;
    }
    const last = write.path[write.path.length - 1];
    if (isDelete(write)) {
      delete parent[last];
    } else {
      parent[last] = (write as { value: unknown }).value;
    }
  });
  return target;
}

/**
 * Adds one change to a document's pending changes so that no two pending paths overlap
 * (Firestore rejects an update that names both "a" and "a.b").
 */
export function mergeFieldWrite(pending: readonly FieldWrite[], next: FieldWrite): FieldWrite[] {
  const parent = pending.find(write => write.path.length < next.path.length && startsWith(next.path, write.path));
  if (parent) {
    if (isDelete(parent) && isDelete(next)) {
      return [...pending];
    }
    const parentValue = isDelete(parent) ? undefined : (parent as { value: unknown }).value;
    const base: FieldMap = isMap(parentValue) ? JSON.parse(JSON.stringify(parentValue)) : {};
    const relative = { ...next, path: next.path.slice(parent.path.length) } as FieldWrite;
    const merged: FieldWrite = { path: parent.path, value: applyFieldWrites(base, [relative]) };
    return pending.map(write => write === parent ? merged : write);
  }
  return [...pending.filter(write => !startsWith(write.path, next.path)), next];
}

/**
 * Collects field changes per document and hands them to `write` at most once per window. A change
 * to a quiet document is written at once and opens a window; changes made while the window is open
 * are merged and written when it closes, which opens the next window. So a tab closed right after a
 * single change has already sent it, as a direct write would have: a write started while the page
 * unloads never reaches the network.
 */
export class WriteCoalescer {
  private readonly queued = new Map<string, FieldWrite[]>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly write: (key: string, writes: FieldWrite[]) => void,
              private readonly delayMs = 1000) {
  }

  public enqueue(key: string, writes: readonly FieldWrite[]): void {
    if (!this.timers.has(key)) {
      this.write(key, writes.reduce(mergeFieldWrite, []));
      this.openWindow(key);
      return;
    }
    this.queued.set(key, writes.reduce(mergeFieldWrite, this.queued.get(key) ?? []));
  }

  /** The changes of one document that are waiting for its window to close. */
  public pending(key: string): FieldWrite[] {
    return this.queued.get(key) ?? [];
  }

  /** Writes the pending changes of one document, or of all documents, now and ends their windows. */
  public flush(key?: string): void {
    this.keys(key).forEach(k => {
      const writes = this.queued.get(k);
      this.clear(k);
      if (writes?.length) {
        this.write(k, writes);
      }
    });
  }

  /** Drops the pending changes of one document, or of all documents, without writing them. */
  public discard(key?: string): void {
    this.keys(key).forEach(k => this.clear(k));
  }

  private openWindow(key: string): void {
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      const writes = this.queued.get(key);
      this.queued.delete(key);
      if (writes?.length) {
        this.write(key, writes);
        this.openWindow(key);
      }
    }, this.delayMs));
  }

  private keys(key?: string): string[] {
    return key === undefined ? [...new Set([...this.queued.keys(), ...this.timers.keys()])] : [key];
  }

  private clear(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    this.queued.delete(key);
  }
}
