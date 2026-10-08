import { applyFieldWrites, FieldWrite, mergeFieldWrite, WriteCoalescer } from "./write-coalescer";

describe("applyFieldWrites", () => {
  it("sets nested fields, creating missing maps, and keeps dotted keys as one field", () => {
    const target: Record<string, unknown> = { data: { a: 1 } };
    applyFieldWrites(target, [
      { path: ["data", "b.c"], value: 2 },
      { path: ["new", "x"], value: true }
    ]);
    expect(target).toEqual({ data: { a: 1, "b.c": 2 }, new: { x: true } });
  });

  it("deletes fields and ignores deletes under missing parents", () => {
    const target: Record<string, unknown> = { data: { a: 1, b: 2 } };
    applyFieldWrites(target, [{ path: ["data", "a"], delete: true }, { path: ["none", "z"], delete: true }]);
    expect(target).toEqual({ data: { b: 2 } });
  });
});

describe("mergeFieldWrite", () => {
  it("keeps the last value for the same field", () => {
    const merged = mergeFieldWrite([{ path: ["a"], value: 1 }], { path: ["a"], value: 2 });
    expect(merged).toEqual([{ path: ["a"], value: 2 }]);
  });

  it("folds a child change into a pending parent, without touching the caller's object", () => {
    const parentValue = { x: true };
    const merged = mergeFieldWrite([{ path: ["map"], value: parentValue }], { path: ["map", "y"], value: false });
    expect(merged).toEqual([{ path: ["map"], value: { x: true, y: false } }]);
    expect(parentValue).toEqual({ x: true });
  });

  it("drops pending children when the parent is replaced", () => {
    const merged = mergeFieldWrite([{ path: ["map", "y"], value: 1 }, { path: ["other"], value: 2 }], { path: ["map"], value: {} });
    expect(merged).toEqual([{ path: ["other"], value: 2 }, { path: ["map"], value: {} }]);
  });

  it("lets a set replace a delete and a delete replace a set", () => {
    const del: FieldWrite = { path: ["a"], delete: true };
    expect(mergeFieldWrite([del], { path: ["a"], value: 1 })).toEqual([{ path: ["a"], value: 1 }]);
    expect(mergeFieldWrite([{ path: ["a"], value: 1 }], del)).toEqual([del]);
  });
});

describe("WriteCoalescer", () => {
  let flushed: Array<[string, FieldWrite[]]>;
  let coalescer: WriteCoalescer;

  beforeEach(() => {
    jest.useFakeTimers();
    flushed = [];
    coalescer = new WriteCoalescer((key, writes) => flushed.push([key, writes]), 1000);
  });

  afterEach(() => jest.useRealTimers());

  it("writes the first change to a quiet document at once", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    expect(flushed).toEqual([["doc", [{ path: ["a"], value: 1 }]]]);
    jest.advanceTimersByTime(1000);
    expect(flushed.length).toBe(1);
  });

  it("merges changes made while the window is open into one write when it closes", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    jest.advanceTimersByTime(500);
    coalescer.enqueue("doc", [{ path: ["b"], value: 2 }, { path: ["a"], value: 3 }]);
    jest.advanceTimersByTime(499);
    expect(flushed.length).toBe(1);
    jest.advanceTimersByTime(1);
    expect(flushed[1]).toEqual(["doc", [{ path: ["b"], value: 2 }, { path: ["a"], value: 3 }]]);
  });

  it("does not extend the window, so a steady stream of clicks is written once a second", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    jest.advanceTimersByTime(900);
    coalescer.enqueue("doc", [{ path: ["a"], value: 2 }]);
    jest.advanceTimersByTime(100);
    expect(flushed.length).toBe(2);
    coalescer.enqueue("doc", [{ path: ["a"], value: 3 }]);
    jest.advanceTimersByTime(999);
    expect(flushed.length).toBe(2);
    jest.advanceTimersByTime(1);
    expect(flushed.map(([, writes]) => writes[0])).toEqual([{ path: ["a"], value: 1 }, { path: ["a"], value: 2 }, { path: ["a"], value: 3 }]);
  });

  it("writes at once again once a window closed with nothing pending", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    jest.advanceTimersByTime(1000);
    coalescer.enqueue("doc", [{ path: ["a"], value: 2 }]);
    expect(flushed.length).toBe(2);
  });

  it("keeps documents apart", () => {
    coalescer.enqueue("one", [{ path: ["a"], value: 1 }]);
    coalescer.enqueue("two", [{ path: ["a"], value: 2 }]);
    coalescer.enqueue("one", [{ path: ["a"], value: 3 }]);
    coalescer.enqueue("two", [{ path: ["a"], value: 4 }]);
    jest.advanceTimersByTime(1000);
    expect(flushed).toEqual([
      ["one", [{ path: ["a"], value: 1 }]], ["two", [{ path: ["a"], value: 2 }]],
      ["one", [{ path: ["a"], value: 3 }]], ["two", [{ path: ["a"], value: 4 }]]
    ]);
  });

  it("reports the changes still waiting, per document", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    expect(coalescer.pending("doc")).toEqual([]);
    coalescer.enqueue("doc", [{ path: ["b"], value: 2 }]);
    expect(coalescer.pending("doc")).toEqual([{ path: ["b"], value: 2 }]);
    expect(coalescer.pending("other")).toEqual([]);
  });

  it("flush() writes pending changes at once and ends the window", () => {
    coalescer.enqueue("doc", [{ path: ["a"], value: 1 }]);
    coalescer.enqueue("doc", [{ path: ["a"], value: 2 }]);
    coalescer.flush();
    expect(flushed.length).toBe(2);
    jest.advanceTimersByTime(5000);
    expect(flushed.length).toBe(2);
    expect(coalescer.pending("doc")).toEqual([]);
    coalescer.enqueue("doc", [{ path: ["a"], value: 3 }]);
    expect(flushed.length).toBe(3);
  });

  it("discard() drops pending changes for one document or for all", () => {
    coalescer.enqueue("one", [{ path: ["a"], value: 1 }]);
    coalescer.enqueue("two", [{ path: ["a"], value: 2 }]);
    coalescer.enqueue("one", [{ path: ["a"], value: 3 }]);
    coalescer.enqueue("two", [{ path: ["a"], value: 4 }]);
    coalescer.discard("one");
    jest.advanceTimersByTime(1000);
    expect(flushed.slice(2)).toEqual([["two", [{ path: ["a"], value: 4 }]]]);
    coalescer.enqueue("three", [{ path: ["a"], value: 5 }]);
    coalescer.enqueue("three", [{ path: ["a"], value: 6 }]);
    coalescer.discard();
    jest.advanceTimersByTime(1000);
    expect(flushed.length).toBe(4);
  });
});
