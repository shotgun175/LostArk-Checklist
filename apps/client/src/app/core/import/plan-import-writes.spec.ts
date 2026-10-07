import { LostarkExport } from "./lostark-export";
import { ImportWrite, planImportWrites } from "./plan-import-writes";

function sampleExport(): LostarkExport {
  return {
    format: 1,
    exportedAt: "2026-10-07T12:00:00.000Z",
    sourceUid: "source-uid",
    roster: { characters: [], showAllTasks: false, trackedTasks: {} },
    settings: { crystallineAura: true },
    completion: { data: { t1: { amount: 1, updated: 1 } } },
    energy: { data: {}, updated: 5 },
    tasks: [
      { $key: "t1", authorId: "source-uid", label: "Chaos Dungeon" },
      { $key: "t2", authorId: "source-uid", label: "Ghost Ship" }
    ] as LostarkExport["tasks"]
  };
}

function counter(): () => string {
  let next = 0;
  return () => `new${++next}`;
}

function plan(existingTaskIds: string[], file: LostarkExport = sampleExport()): ImportWrite[] {
  return planImportWrites("me", existingTaskIds, file, counter()).writes;
}

function dataOf(writes: ImportWrite[], collection: ImportWrite["collection"]): Record<string, unknown> | undefined {
  const write = writes.find(w => w.op === "set" && w.collection === collection);
  return write && write.op === "set" ? write.data : undefined;
}

describe("planImportWrites", () => {
  it("deletes every task the current user has", () => {
    expect(plan(["fresh1", "t1"]).filter(w => w.op === "delete")).toEqual([
      { op: "delete", collection: "tasks", id: "fresh1" },
      { op: "delete", collection: "tasks", id: "t1" }
    ]);
  });

  it("writes each task with a fresh id, authorId set to the current user and no $key", () => {
    const tasks = plan([]).filter(w => w.op === "set" && w.collection === "tasks");
    expect(tasks).toEqual([
      { op: "set", collection: "tasks", id: "new1", data: { authorId: "me", label: "Chaos Dungeon" } },
      { op: "set", collection: "tasks", id: "new2", data: { authorId: "me", label: "Ghost Ship" } }
    ]);
  });

  it("never writes a source task id, so the same file can be imported into several accounts", () => {
    const file = {
      ...sampleExport(),
      roster: { characters: [], showAllTasks: false, trackedTasks: { "42:t1": false } },
      settings: { lazytracking: { "Alice:t2": true } },
      completion: { data: { t1: { amount: 1, updated: 1 }, "42:t2": { amount: 2, updated: 2 } } },
      energy: { data: { "42:t2": { amount: 40 } }, updated: 5 }
    };
    const writes = plan(["t1"], file).filter(w => w.op === "set");
    const written = JSON.stringify(writes);
    expect(written).not.toMatch(/"t1"|:t1"|"t2"|:t2"/);
    expect(dataOf(writes, "completion")).toEqual({ data: { new1: { amount: 1, updated: 1 }, "42:new2": { amount: 2, updated: 2 } } });
    expect(dataOf(writes, "energy")).toEqual({ data: { "42:new2": { amount: 40 } }, updated: 5 });
    expect(dataOf(writes, "roster")).toEqual({ characters: [], showAllTasks: false, trackedTasks: { "42:new1": false } });
    expect(dataOf(writes, "settings")).toEqual({ lazytracking: { "Alice:new2": true } });
  });

  it("keeps keys that do not end with an imported task id", () => {
    const file = { ...sampleExport(), completion: { data: { "42:gone": { amount: 1, updated: 1 } } } };
    expect(dataOf(plan([], file), "completion")).toEqual({ data: { "42:gone": { amount: 1, updated: 1 } } });
  });

  it("returns the completion it writes, for the in-memory store", () => {
    const result = planImportWrites("me", [], sampleExport(), counter());
    expect(result.completion).toEqual({ data: { new1: { amount: 1, updated: 1 } } });
    expect(dataOf(result.writes, "completion")).toEqual(result.completion);
  });

  it("writes roster, settings, completion and energy under the current uid", () => {
    const docs = plan([]).filter(w => w.collection !== "tasks");
    expect(docs).toEqual([
      { op: "set", collection: "roster", id: "me", data: { characters: [], showAllTasks: false, trackedTasks: {} } },
      { op: "set", collection: "settings", id: "me", data: { crystallineAura: true } },
      { op: "set", collection: "completion", id: "me", data: { data: { new1: { amount: 1, updated: 1 } } } },
      { op: "set", collection: "energy", id: "me", data: { data: {}, updated: 5 } }
    ]);
  });

  it("writes empty defaults for null completion and energy", () => {
    const file = { ...sampleExport(), completion: null, energy: null };
    const docs = plan([], file).filter(w => w.collection === "completion" || w.collection === "energy");
    expect(docs.map(w => w.op === "set" ? w.data : null)).toEqual([{ data: {} }, { data: {}, updated: 0 }]);
  });

  it("orders deletes first, then tasks, then the four documents", () => {
    expect(plan(["fresh1"]).map(w => `${w.op}:${w.collection}`)).toEqual([
      "delete:tasks", "set:tasks", "set:tasks", "set:roster", "set:settings", "set:completion", "set:energy"
    ]);
  });
});
