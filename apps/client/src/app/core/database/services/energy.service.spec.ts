import { TestBed } from "@angular/core/testing";
import { EnergyService } from "./energy.service";
import { TimeService } from "../../time.service";
import { NEVER, of } from "rxjs";
import { TasksService } from "./tasks.service";
import { tasks } from "../../tasks";
import { RosterService } from "./roster.service";
import { CompletionService } from "./completion.service";
import { CompletionEntry } from "../../../model/completion-entry";
import { AuthService } from "./auth.service";
import { FIRESTORE } from "../../firebase/firebase.providers";

// No real Firebase in unit tests. The Node build of firebase/auth 10 cannot load on Node 16,
// and FirestoreStorage only needs collection().withConverter() at construction.
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ withConverter: jest.fn(() => ({})) }))
}));

const mockTask = {
  ...tasks[0],
  $key: "testing"
};

describe("EnergyService", () => {
  let service: EnergyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: NEVER } },
        {
          provide: TimeService,
          useValue: {
            // Sun 08/05/2022 @10AM UTC +1s
            lastDailyReset$: of(1652005000000)
          }
        },
        {
          provide: TasksService,
          useValue: {
            taskList$: of({ tasks: [mockTask], fromCache: false })
          }
        },
        {
          provide: RosterService,
          useValue: {
            roster$: of({
              characters: []
            })
          }
        },
        {
          provide: CompletionService,
          useValue: {
            completion$: of({
              data: {}
            })
          }
        }
      ]
    });
    service = TestBed.inject(EnergyService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  // Current task data: Chaos Dungeon is 1 run a day worth 20 rest bonus (cap 200);
  // Una's Task is 3 runs a day worth 10 each (cap 100).
  const unaTask = tasks.find(task => task.label === "Una's Task");
  const day = 86400000;

  it("should update energy properly", () => {
    const reset = 1652005000000;
    const twoDaysBefore = reset + 3600000 - 2 * day;
    const completionEntry: CompletionEntry = {
      amount: 1,
      updated: twoDaysBefore
    };
    const energy = { $key: "test", data: {}, updated: twoDaysBefore };
    const task = tasks[0]; // Chaos dungeon
    const entry = { amount: 0 };

    // Done two days ago, then one full day missed: 1 run x 20
    expect(service.getEnergyUpdate(reset, completionEntry, energy, task, entry).amount).toBe(20);
  });

  it("should update energy properly on specific case", () => {
    const reset = 1652176800000;
    const completionDate = 1652038911993;
    const completionEntry: CompletionEntry = {
      amount: 2,
      updated: completionDate
    };
    const energy = { $key: "test", data: {}, updated: 1652176800000 - 3600000 };
    const task = tasks[0]; // Chaos dungeon
    const entry = { amount: 0 };

    expect(service.getEnergyUpdate(reset, completionEntry, energy, task, entry).amount).toBe(20);
  });

  it("should update energy properly with partially done task", () => {
    const reset = 1652005000000;
    const twoDaysBefore = reset + 3600000 - 2 * day;
    const completionEntry: CompletionEntry = {
      amount: 1,
      updated: twoDaysBefore
    };
    const energy = { $key: "test", data: {}, updated: twoDaysBefore };
    const entry = { amount: 0 };

    // 2 runs left that day (20), then one full day missed (3 x 10)
    expect(service.getEnergyUpdate(reset, completionEntry, energy, unaTask, entry).amount).toBe(50);
  });

  it("should update energy properly with partially done task on last day only", () => {
    const reset = 1652005000000;
    const oneDayBefore = reset + 3600000 - day;
    const completionEntry: CompletionEntry = {
      amount: 1,
      updated: oneDayBefore
    };
    const energy = { $key: "test", data: {}, updated: oneDayBefore };
    const entry = { amount: 0 };

    // Only the 2 runs left yesterday count: 2 x 10
    expect(service.getEnergyUpdate(reset, completionEntry, energy, unaTask, entry).amount).toBe(20);
  });

  it("should update energy properly with partially done task after existing update", () => {
    const reset = 1652005000000;
    const twoDaysBefore = reset + 3600000 - 2 * day;
    const oneDayBefore = reset + 3600000 - day;
    const completionEntry: CompletionEntry = {
      amount: 1,
      updated: twoDaysBefore
    };
    const energy = { $key: "test", data: {}, updated: oneDayBefore };
    const task = tasks[0]; // Chaos dungeon
    const entry = { amount: 10 };

    expect(service.getEnergyUpdate(reset, completionEntry, energy, task, entry).amount).toBe(30);
  });

  it("should not update energy if task was completed yesterday", () => {
    const reset = 1652005000000;
    const oneDayBefore = reset + 3600000 - day;
    const completionEntry: CompletionEntry = {
      amount: 3,
      updated: oneDayBefore
    };
    const energy = { $key: "test", data: {}, updated: oneDayBefore };
    const entry = { amount: 40 };

    expect(service.getEnergyUpdate(reset, completionEntry, energy, unaTask, entry).amount).toBe(40);
  });
});

describe("EnergyService daily rollover", () => {
  // Sun 08/05/2022 @10AM UTC +1s
  const reset = 1652005000000;
  const chaosTask = { ...tasks[0], $key: "chaos" };
  const guardianTask = { ...tasks.find(task => task.label === "Guardian"), $key: "guardian" };
  const character = { id: 1, name: "Arwen", ilvl: 1700 };

  /** Which inputs are cached copies (read before the server answered). */
  interface Cached {
    energy?: boolean;
    completion?: boolean;
    roster?: boolean;
    tasks?: boolean;
  }

  interface Rollover {
    data: Record<string, { amount: number }>;
    energySaved: jest.Mock;
    completionSaved: jest.Mock;
  }

  function runRollover(energyData: Record<string, { amount: number }>, energyUpdated: number, cached: Cached = {}): Rollover {
    const completionSaved = jest.fn();
    const marker = (fromCache?: boolean) => fromCache ? { fromCache: true as const } : {};
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("uid") } },
        { provide: TimeService, useValue: { lastDailyReset$: of(reset) } },
        { provide: TasksService, useValue: { taskList$: of({ tasks: [chaosTask, guardianTask], fromCache: !!cached.tasks }) } },
        { provide: RosterService, useValue: { roster$: of({ characters: [character], ...marker(cached.roster) }) } },
        {
          provide: CompletionService,
          useValue: {
            completion$: of({ $key: "uid", data: {}, ...marker(cached.completion) }),
            setOneInBackground: completionSaved
          }
        }
      ]
    });
    const service = TestBed.inject(EnergyService);
    jest.spyOn(service, "getOne").mockReturnValue(of({ $key: "uid", data: energyData, updated: energyUpdated, ...marker(cached.energy) }));
    const energySaved = jest.spyOn(service, "setOneInBackground").mockImplementation(() => undefined) as unknown as jest.Mock;
    let data: Record<string, { amount: number }> = {};
    service.energy$.subscribe(energy => data = energy.data).unsubscribe();
    return { data, energySaved, completionSaved };
  }

  function rollover(energyData: Record<string, { amount: number }>, energyUpdated: number): Record<string, { amount: number }> {
    return runRollover(energyData, energyUpdated).data;
  }

  it("saves both documents in the background after a reset, without waiting for the server", () => {
    const { energySaved, completionSaved } = runRollover({ "1:chaos": { amount: 100 } }, reset - 3600000);
    expect(energySaved).toHaveBeenCalledWith("uid", expect.objectContaining({ updated: expect.any(Number) }));
    expect(completionSaved).toHaveBeenCalledWith("uid", expect.objectContaining({ $key: "uid" }));
  });

  it.each<[string, Cached]>([
    ["energy", { energy: true }],
    ["completion", { completion: true }],
    ["roster", { roster: true }],
    ["task list", { tasks: true }]
  ])("does not run the reset from a cached %s: it waits for the server's copy", (_, cached) => {
    const { data, energySaved, completionSaved } = runRollover({ "1:chaos": { amount: 100 } }, reset - 3600000, cached);
    expect(energySaved).not.toHaveBeenCalled();
    expect(completionSaved).not.toHaveBeenCalled();
    // The stored bonus is shown as it is.
    expect(data).toEqual({ "1:chaos": { amount: 100 } });
  });

  it("does not move name keys of a cached copy", () => {
    const { energySaved, completionSaved } = runRollover({ "Arwen:chaos": { amount: 100 } }, Date.now(), { completion: true });
    expect(energySaved).not.toHaveBeenCalled();
    expect(completionSaved).not.toHaveBeenCalled();
  });

  it("leaves name keys in place while the roster is a cached copy, whose ids may never be saved", () => {
    const { data } = runRollover({ "Arwen:chaos": { amount: 100 } }, Date.now(), { roster: true });
    expect(data).toEqual({ "Arwen:chaos": { amount: 100 } });
  });

  it("moves name keys of server copies with background saves", () => {
    const { energySaved } = runRollover({ "Arwen:chaos": { amount: 100 } }, Date.now());
    expect(energySaved).toHaveBeenCalledWith("uid", expect.objectContaining({ data: { "1:chaos": { amount: 100 } } }));
  });

  it("keeps and grows a stored bonus when the task has no completion entry", () => {
    // Saved 1 hour before the reset (a restored backup or a value typed in Settings), never ticked
    const result = rollover({ "1:chaos": { amount: 100 }, "1:guardian": { amount: 30 } }, reset - 3600000);

    // One day not done: Chaos Dungeon +20, Guardian +10
    expect(result["1:chaos"]).toEqual({ amount: 120 });
    expect(result["1:guardian"]).toEqual({ amount: 40 });
  });

  it("creates a 0 bonus when the task has no energy entry yet", () => {
    const result = rollover({ "1:guardian": { amount: 30 } }, reset - 3600000);

    expect(result["1:chaos"]).toEqual({ amount: 0 });
  });
});
