import { LostarkExport } from "./lostark-export";
import { planImportWrites } from "./plan-import-writes";

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

describe("planImportWrites", () => {
  it("deletes the current user's tasks that are not in the file", () => {
    const writes = planImportWrites("me", ["fresh1", "fresh2"], sampleExport());
    expect(writes.filter(w => w.op === "delete")).toEqual([
      { op: "delete", collection: "tasks", id: "fresh1" },
      { op: "delete", collection: "tasks", id: "fresh2" }
    ]);
  });

  it("does not delete a task id that the file writes again (restore)", () => {
    const writes = planImportWrites("me", ["t1", "fresh1"], sampleExport());
    expect(writes.filter(w => w.op === "delete").map(w => w.id)).toEqual(["fresh1"]);
  });

  it("writes each task with its original id, authorId set to the current user and no $key", () => {
    const tasks = planImportWrites("me", [], sampleExport()).filter(w => w.op === "set" && w.collection === "tasks");
    expect(tasks).toEqual([
      { op: "set", collection: "tasks", id: "t1", data: { authorId: "me", label: "Chaos Dungeon" } },
      { op: "set", collection: "tasks", id: "t2", data: { authorId: "me", label: "Ghost Ship" } }
    ]);
  });

  it("writes roster, settings, completion and energy under the current uid", () => {
    const docs = planImportWrites("me", [], sampleExport()).filter(w => w.collection !== "tasks");
    expect(docs).toEqual([
      { op: "set", collection: "roster", id: "me", data: { characters: [], showAllTasks: false, trackedTasks: {} } },
      { op: "set", collection: "settings", id: "me", data: { crystallineAura: true } },
      { op: "set", collection: "completion", id: "me", data: { data: { t1: { amount: 1, updated: 1 } } } },
      { op: "set", collection: "energy", id: "me", data: { data: {}, updated: 5 } }
    ]);
  });

  it("writes empty defaults for null completion and energy", () => {
    const file = { ...sampleExport(), completion: null, energy: null };
    const docs = planImportWrites("me", [], file).filter(w => w.collection === "completion" || w.collection === "energy");
    expect(docs.map(w => w.op === "set" ? w.data : null)).toEqual([{ data: {} }, { data: {}, updated: 0 }]);
  });

  it("orders deletes first, then tasks, then the four documents", () => {
    const writes = planImportWrites("me", ["fresh1"], sampleExport());
    expect(writes.map(w => `${w.op}:${w.collection}`)).toEqual([
      "delete:tasks", "set:tasks", "set:tasks", "set:roster", "set:settings", "set:completion", "set:energy"
    ]);
  });
});
