import { completionEntryFieldWrites, moveNameKeysToIds } from "./get-completion-entry-key";
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

describe("moveNameKeysToIds", () => {
  it("copies an old name key to every character with that name, then removes it", () => {
    const data: Record<string, unknown> = { "Arwen:t1": entry, "Arwen:t2": entry, t3: entry };
    expect(moveNameKeysToIds(data, [{ id: 1, name: "Arwen" }, { id: 2, name: "Arwen" }])).toBe(true);
    expect(data).toEqual({ "1:t1": entry, "2:t1": entry, "1:t2": entry, "2:t2": entry, t3: entry });
  });

  it("keeps an id key that already exists (the id key wins)", () => {
    const own = { amount: 3, updated: 9 };
    const data: Record<string, unknown> = { "Arwen:t1": entry, "1:t1": own };
    moveNameKeysToIds(data, [{ id: 1, name: "Arwen" }, { id: 2, name: "Arwen" }]);
    expect(data).toEqual({ "1:t1": own, "2:t1": entry });
  });

  it("leaves keys of other names, of characters without an id, and of names that are also an id", () => {
    const data: Record<string, unknown> = { "Arwenna:t1": entry, "NoId:t1": entry, "7:t1": entry, "1:t1": entry };
    expect(moveNameKeysToIds(data, [{ id: 1, name: "Arwen" }, { name: "NoId" }, { id: 2, name: "7" }, { id: 7, name: "Brakka" }])).toBe(false);
    expect(data).toEqual({ "Arwenna:t1": entry, "NoId:t1": entry, "7:t1": entry, "1:t1": entry });
  });

  it("matches a name with a colon in it by its whole name", () => {
    const data: Record<string, unknown> = { "A:B:t1": entry };
    moveNameKeysToIds(data, [{ id: 1, name: "A" }, { id: 2, name: "A:B" }]);
    expect(data).toEqual({ "2:t1": entry });
  });
});
