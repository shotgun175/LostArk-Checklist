import { renameUserTask, upgradeUserTask } from "./tasks.service";
import { defaultOffTaskLabels, tasks } from "../../tasks";
import { isRaidTask } from "../../task-tracking";
import { TaskScope } from "../../../model/task-scope";
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
  it("lists the default-off tasks among the default tasks, as character tasks that are not raids", () => {
    defaultOffTaskLabels.forEach(label => {
      const def = defaultTasks.find(t => t.label === label);
      expect(def).toMatchObject({ scope: TaskScope.CHARACTER, enabled: true, custom: false });
      expect(isRaidTask(def as LostarkTask)).toBe(false);
    });
  });

  it("refreshes an existing copy of a default-off task as a built-in task, keeping the user's key, switch and order", () => {
    defaultOffTaskLabels.forEach(label => {
      const def = defaultTasks.find(t => t.label === label) as LostarkTask;
      const upgraded = upgradeUserTask(userCopy(label, def.frequency), defaultTasks, "uid");
      expect(upgraded).toMatchObject({ label, amount: def.amount, iconPath: def.iconPath, $key: `key-${label}`, enabled: false, index: 7, version: TASKS_VERSION });
      expect(upgraded?.custom).toBe(false);
    });
  });

  it("turns a task that no longer has a default task into a custom task", () => {
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

describe("renameUserTask", () => {
  it("renames a built-in copy of Howl's Hourglass to Haal's Hourglass, keeping its key and everything else", () => {
    const old = userCopy("Howl's Hourglass");
    expect(renameUserTask(old)).toEqual({ ...old, label: "Haal's Hourglass" });
  });

  it("matches the new default task, so no duplicate is created", () => {
    const renamed = renameUserTask(userCopy("Howl's Hourglass"));
    expect(defaultTasks.some(t => t.label === renamed.label)).toBe(true);
    expect(defaultTasks.some(t => t.label === "Howl's Hourglass")).toBe(false);
  });

  it("leaves custom tasks and other labels as the same object", () => {
    const custom = { ...userCopy("Howl's Hourglass"), custom: true };
    const other = userCopy("Guardian");
    expect(renameUserTask(custom)).toBe(custom);
    expect(renameUserTask(other)).toBe(other);
  });
});
