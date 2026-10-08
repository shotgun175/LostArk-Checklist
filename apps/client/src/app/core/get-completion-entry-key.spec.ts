import { completionEntryFieldWrites } from "./get-completion-entry-key";
import { LostarkTask } from "../model/lostark-task";
import { Character } from "../model/character/character";
import { TaskScope } from "../model/task-scope";

const charTask = { $key: "t1", scope: TaskScope.CHARACTER } as LostarkTask;
const rosterTask = { $key: "t2", scope: TaskScope.ROSTER } as LostarkTask;
const entry = { amount: 1, updated: 5 };

describe("completionEntryFieldWrites", () => {
  it("writes the id-based key and removes the older name-based key", () => {
    const alice = { id: 42, name: "Alice" } as Character;
    expect(completionEntryFieldWrites("data", { "42:t1": entry }, alice, charTask)).toEqual([
      { path: ["data", "42:t1"], value: entry },
      { path: ["data", "Alice:t1"], delete: true }
    ]);
  });

  it("writes only the name-based key for a character without id", () => {
    const bob = { name: "Bob.Two" } as Character;
    expect(completionEntryFieldWrites("data", { "Bob.Two:t1": entry }, bob, charTask))
      .toEqual([{ path: ["data", "Bob.Two:t1"], value: entry }]);
  });

  it("writes the task key for a roster task", () => {
    expect(completionEntryFieldWrites("data", { t2: entry }, { id: 1, name: "A" } as Character, rosterTask))
      .toEqual([{ path: ["data", "t2"], value: entry }]);
  });
});
