import { isTaskDone } from "./is-task-done";
import { createTask } from "../model/lostark-task";
import { TaskFrequency } from "../model/task-frequency";
import { TaskScope } from "../model/task-scope";
import { Character } from "../model/character/character";

describe("isTaskDone lazy flags", () => {
  const day = 24 * 3600 * 1000;
  const dailyReset = Date.UTC(2026, 9, 8, 10);
  const task = { ...createTask("Guardian", 0, TaskFrequency.DAILY, TaskScope.CHARACTER), $key: "t1" };
  const elkie = { id: 5, name: "Elkie", lazy: true } as Character;
  // Done 1 day before the last reset: counts as done only while the lazy 3 day window applies
  const completion = { $key: "c", data: { "5:t1": { amount: 1, updated: dailyReset - day } } };
  const done = (lazyTracking: Record<string, boolean>, character = elkie) => isTaskDone(task, character, completion, dailyReset, 0, 0, 0, lazyTracking);

  it("reads the lazy flag by character id, so a rename keeps it", () => {
    expect(done({ "5:t1": false })).toBe(0);
    expect(done({ "5:t1": false }, { ...elkie, name: "Renamed" })).toBe(0);
    expect(done({})).toBe(1);
  });

  it("still reads a flag saved under the name before the move to ids", () => {
    expect(done({ "Elkie:t1": false })).toBe(0);
  });
});
