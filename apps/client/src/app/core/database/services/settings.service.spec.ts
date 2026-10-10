import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { SettingsService } from "./settings.service";
import { AuthService } from "./auth.service";
import { RosterService } from "./roster.service";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { FirestoreStorage } from "../firestore-storage";
import { Settings } from "../../../model/settings";

// No real Firebase in unit tests (same as energy.service.spec.ts)
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ withConverter: jest.fn(() => ({})) }))
}));

describe("SettingsService defaults and migrations", () => {
  const complete = {
    $key: "u1",
    hiddenOnCompletion: false,
    crystallineAura: true,
    lazytracking: {},
    chestConfiguration: {},
    goldPlannerConfiguration: {},
    raidModesForGoldPlanner: {},
    forceAbyss: {}
  } as Settings;
  // A character still keyed by name, which the key migration would move to its id.
  const roster = { $key: "u1", characters: [{ id: 1, name: "Arwen" }] };

  afterEach(() => jest.restoreAllMocks());

  function load(copy: Partial<Settings>, rosterCopy: object = roster): { shown: Settings[]; saved: jest.SpyInstance; patched: jest.SpyInstance } {
    jest.spyOn(FirestoreStorage.prototype, "getOne").mockReturnValue(of(copy as Settings));
    const saved = jest.spyOn(FirestoreStorage.prototype, "setOneInBackground").mockImplementation(() => undefined);
    const patched = jest.spyOn(FirestoreStorage.prototype, "patchFields").mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: AuthService, useValue: { uid$: of("u1") } },
        { provide: RosterService, useValue: { roster$: of(rosterCopy) } }
      ]
    });
    const shown: Settings[] = [];
    TestBed.inject(SettingsService).settings$.subscribe(s => shown.push(s));
    return { shown, saved, patched };
  }

  it("writes the defaults for a document the server says is missing, without waiting for the write", () => {
    const { shown, saved } = load({ $key: "u1", notFound: true });
    expect(saved).toHaveBeenCalledWith("u1", expect.objectContaining({ lazytracking: {}, forceAbyss: {} }));
    expect(shown).toHaveLength(1);
    expect(shown[0].lazytracking).toEqual({});
  });

  it("does not write defaults or migrations from a cached copy", () => {
    const { shown, saved } = load({ $key: "u1", hiddenOnCompletion: true, fromCache: true });
    expect(saved).not.toHaveBeenCalled();
    expect(shown).toEqual([{ $key: "u1", hiddenOnCompletion: true, fromCache: true }]);
  });

  it("runs the gold planner migration from the server's copy", () => {
    const { raidModesForGoldPlanner, ...old } = complete;
    expect(raidModesForGoldPlanner).toEqual({});
    const { saved } = load({ ...old, manualGoldEntries: {} });
    expect(saved).toHaveBeenCalledWith("u1", expect.objectContaining({ raidModesForGoldPlanner: {} }));
  });

  it("moves name keys only when both settings and roster are the server's copies", () => {
    const withNameKey = { ...complete, lazytracking: { "Arwen:t1": false } };
    expect(load({ ...withNameKey, fromCache: true }).patched).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
    expect(load(withNameKey, { ...roster, fromCache: true }).patched).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
    expect(load(withNameKey).patched).toHaveBeenCalledWith("u1", expect.any(Array));
  });
});
