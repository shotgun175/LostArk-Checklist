import { from, toArray, firstValueFrom, of, Subject } from "rxjs";
import { TestBed } from "@angular/core/testing";
import { writeBatch } from "firebase/firestore";
import { renameUserTask, skipDeletedTaskList, skipEmptyCachedTaskList, TasksService, upgradeUserTask, withDailyAmount } from "./tasks.service";
import { AuthService } from "./auth.service";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { QueryState } from "../../firebase/rx";
import { isTaskDone } from "../../is-task-done";
import { Character } from "../../../model/character/character";
import { Completion } from "../../../model/completion";
import { defaultOffTaskLabels, tasks } from "../../tasks";
import { isRaidTask } from "../../task-tracking";
import { TaskScope } from "../../../model/task-scope";
import { LostarkTask, TASKS_VERSION } from "../../../model/lostark-task";

// No real Firebase in unit tests (same as energy.service.spec.ts). TasksService itself gets its task
// list from a Subject and writes through a recorded batch.
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => {
  const ref = (path: string) => ({ path, id: path.split("/").pop(), withConverter() { return this; } });
  let next = 0;
  return {
    collection: jest.fn((_firestore: unknown, name: string) => ref(name)),
    doc: jest.fn((parent: { path: string }, name?: string, key?: string) => ref(name === undefined ? `${parent.path}/id-${next++}` : `${name}/${key}`)),
    where: jest.fn(),
    writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) }))
  };
});

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

const list = (n: number): LostarkTask[] => Array.from({ length: n }, (_, i) => userCopy(`T${i}`));
const state = (docs: LostarkTask[], fromCache = false): QueryState<LostarkTask> => ({ docs, fromCache, hasPendingWrites: false });

describe("skipDeletedTaskList", () => {
  const run = (lists: LostarkTask[][]) => firstValueFrom(from(lists.map(docs => state(docs))).pipe(skipDeletedTaskList(), toArray()));

  it("passes the first empty list of a new user, so the default tasks are created", async () => {
    expect((await run([[], list(2)])).map(l => l.docs.length)).toEqual([0, 2]);
  });

  it("drops an empty list after tasks were seen, so the defaults are not created for a deleted account", async () => {
    expect((await run([list(2), list(1), [], list(3)])).map(l => l.docs.length)).toEqual([2, 1, 3]);
  });
});

describe("skipEmptyCachedTaskList", () => {
  it("drops an empty list from the cache (offline, never cached) but keeps a server one and a cached one with tasks", async () => {
    const lists = [state([], true), state(list(1), true), state([])];
    const passed = await firstValueFrom(from(lists).pipe(skipEmptyCachedTaskList(), toArray()));
    expect(passed).toEqual([lists[1], lists[2]]);
  });
});

describe("TasksService with a cached task list", () => {
  let lists: Subject<QueryState<LostarkTask>>;
  let service: TasksService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(writeBatch).mockClear();
    lists = new Subject<QueryState<LostarkTask>>();
    jest.spyOn(TasksService.prototype, "getUserTasks").mockReturnValue(lists);
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("uid"), isAnonymous$: of(false) } }
      ]
    });
    service = TestBed.inject(TasksService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("shows a cached list but creates, upgrades and deletes nothing until the server's list arrives", () => {
    const seen: { fromCache: boolean, count: number }[] = [];
    service.taskList$.subscribe(taskList => seen.push({ fromCache: taskList.fromCache, count: taskList.tasks.length }));
    // An old copy (needs an upgrade) and a duplicate: both would be written from a server list.
    lists.next(state([userCopy(defaultTasks[0].label), userCopy(defaultTasks[0].label)], true));
    jest.advanceTimersByTime(5000);
    expect(seen).toEqual([{ fromCache: true, count: 2 }]);
    expect(writeBatch).not.toHaveBeenCalled();
    lists.next(state([userCopy(defaultTasks[0].label), userCopy(defaultTasks[0].label)]));
    jest.advanceTimersByTime(5000);
    expect(seen[seen.length - 1].fromCache).toBe(false);
    // Default tasks created, old copies upgraded, the duplicate deleted.
    expect(writeBatch).toHaveBeenCalledTimes(3);
  });

  it("emits nothing for an empty cached list, so no default tasks are made for it", () => {
    const seen: unknown[] = [];
    service.taskList$.subscribe(taskList => seen.push(taskList));
    lists.next(state([], true));
    jest.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

describe("withDailyAmount", () => {
  const affinity = (label: string): LostarkTask => ({ ...(tasks.find(t => t.label === label) as LostarkTask), $key: `key-${label}` });

  it("has 5 as the built-in amount of Affinity Song and Affinity Emote", () => {
    expect(affinity("Affinity Song").amount).toBe(5);
    expect(affinity("Affinity Emote").amount).toBe(5);
  });

  it("counts a user's built-in Affinity copy stored with 6 (the old Crystalline Aura amount) to 5", () => {
    ["Affinity Song", "Affinity Emote"].forEach(label => {
      expect(withDailyAmount({ ...affinity(label), amount: 6 }, new Date()).amount).toBe(5);
    });
  });

  it("leaves the amount of a custom task named Affinity alone", () => {
    expect(withDailyAmount({ ...affinity("Affinity Song"), amount: 6, custom: true }, new Date()).amount).toBe(6);
  });

  it("still shows a stored 6 of 6 Affinity completion as done", () => {
    const task = withDailyAmount({ ...affinity("Affinity Song"), amount: 6 }, new Date());
    const character = { name: "Synthchar", ilvl: 1700 } as Character;
    const dailyReset = Date.now() - 60_000;
    const completion = { data: { [task.$key as string]: { amount: 6, updated: Date.now() } } } as unknown as Completion;
    const done = isTaskDone(task, character, completion, dailyReset, dailyReset, dailyReset, dailyReset, {});
    expect(done).toBe(6);
    // The Checklist shows Math.min(done, amount) and treats done >= amount as finished.
    expect(Math.min(done, task.amount)).toBe(5);
    expect(done >= task.amount).toBe(true);
  });
});
