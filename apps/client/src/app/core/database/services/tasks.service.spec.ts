import { upgradeUserTask } from "./tasks.service";
import { retiredTaskLabels, tasks } from "../../tasks";
import { LostarkTask, TASKS_VERSION } from "../../../model/lostark-task";

// No real Firebase in unit tests (same as energy.service.spec.ts); only the pure upgrade step is tested here.
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({}));

const defaultTasks = tasks.map((t, i) => ({ ...t, index: i }));
const userCopy = (label: string, frequency = defaultTasks[0].frequency): LostarkTask => ({
  ...defaultTasks[0],
  label,
  frequency,
  $key: `key-${label}`,
  version: TASKS_VERSION - 1,
  enabled: false,
  index: 7
});

describe("upgradeUserTask", () => {
  it("keeps a retired task built-in, with its own fields, when the task version goes up", () => {
    retiredTaskLabels.forEach(label => {
      const upgraded = upgradeUserTask(userCopy(label), defaultTasks, "uid");
      expect(upgraded).toEqual({ ...userCopy(label), custom: false, authorId: "uid", version: TASKS_VERSION });
    });
  });

  it("does not list retired tasks among the default tasks, so new accounts never get them", () => {
    expect(defaultTasks.filter(t => retiredTaskLabels.includes(t.label))).toEqual([]);
  });

  it("turns a removed task that is not retired into a custom task", () => {
    expect(upgradeUserTask(userCopy("Some Removed Task"), defaultTasks, "uid")?.custom).toBe(true);
  });

  it("refreshes a task that still has a default task, keeping the user's key, switch and order", () => {
    const def = defaultTasks[3];
    const upgraded = upgradeUserTask(userCopy(def.label, def.frequency), defaultTasks, "uid");
    expect(upgraded).toMatchObject({ label: def.label, $key: `key-${def.label}`, enabled: false, index: 7, version: TASKS_VERSION, authorId: "uid" });
    expect(upgraded?.custom).toBeFalsy();
  });

  it("leaves custom and current tasks alone", () => {
    expect(upgradeUserTask({ ...userCopy("Mine"), custom: true }, defaultTasks, "uid")).toBeNull();
    expect(upgradeUserTask({ ...userCopy("Una's Task"), version: TASKS_VERSION }, defaultTasks, "uid")).toBeNull();
  });
});
