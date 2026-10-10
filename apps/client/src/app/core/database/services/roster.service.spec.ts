import { NEVER, of } from "rxjs";
import { normalizeRosterCharacters, RosterService } from "./roster.service";
import { Roster } from "../../../model/roster";
import { FirestoreStorage } from "../firestore-storage";

// No real Firebase in unit tests (same as energy.service.spec.ts)
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ withConverter: jest.fn(() => ({})) }))
}));

const roster = (characters: unknown[]): Roster => ({ $key: "uid1", characters, trackedTasks: {}, showAllTasks: false } as Roster);

describe("normalizeRosterCharacters", () => {
  it("drops entries that are not characters, so a bad import cannot blank the app", () => {
    const r = roster(["Arwen", null, 3, { id: 1, name: "Brakka", ilvl: 1700, class: 4 }]);
    normalizeRosterCharacters(r);
    expect(r.characters.map(c => c.name)).toEqual(["Brakka"]);
  });

  it("stores classes as numbers and asks for a save when one was a string", () => {
    const r = roster([{ id: 1, name: "Brakka", ilvl: 1700, class: "4", tickets: {}, weeklyGold: false }]);
    expect(normalizeRosterCharacters(r)).toBe(true);
    expect(r.characters[0].class).toBe(4);
  });

  it("gives a character that shares another's id a new one", () => {
    const r = roster([
      { id: 10, name: "Arwen", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false },
      { id: 10, name: "Brakka", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }
    ]);
    expect(normalizeRosterCharacters(r)).toBe(true);
    expect(r.characters.map(c => c.id)).toEqual([10, 11]);
  });

  it("gives a character without an id a new one only when asked", () => {
    const withId = roster([{ name: "Arwen", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }]);
    expect(normalizeRosterCharacters(withId)).toBe(true);
    expect(withId.characters[0].id).toEqual(expect.any(Number));
    const withoutId = roster([{ name: "Arwen", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }]);
    expect(normalizeRosterCharacters(withoutId, false)).toBe(false);
    expect(withoutId.characters[0].id).toBeUndefined();
  });

  it("leaves a clean roster unchanged", () => {
    const r = roster([{ id: 1, name: "Brakka", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }]);
    expect(normalizeRosterCharacters(r)).toBe(false);
  });
});

describe("RosterService repair", () => {
  // A string class needs a repair, which is saved as a whole document.
  const needsRepair = (fromCache: boolean): Roster => ({
    ...roster([{ id: 1, name: "Brakka", ilvl: 1700, class: "4", tickets: {}, weeklyGold: false }]),
    ...(fromCache ? { fromCache: true as const } : {})
  });

  afterEach(() => jest.restoreAllMocks());

  function load(copy: Roster): { shown: Roster[]; saved: jest.SpyInstance } {
    jest.spyOn(FirestoreStorage.prototype, "getOne").mockReturnValue(of(copy));
    const service = new RosterService({ uid$: NEVER } as never, {} as never);
    const saved = jest.spyOn(service, "setOneInBackground").mockImplementation(() => undefined);
    const shown: Roster[] = [];
    service.getOne("uid1", true).subscribe(r => shown.push(r));
    return { shown, saved };
  }

  it("shows the repair of a cached copy but does not save it", () => {
    const { shown, saved } = load(needsRepair(true));
    expect(shown[0].characters[0].class).toBe(4);
    expect(saved).not.toHaveBeenCalled();
  });

  it("gives no ids to the characters of a cached copy, so ticks stay under their names until the ids are saved", () => {
    const { shown, saved } = load({ ...roster([{ name: "Arwen", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }]), fromCache: true });
    expect(shown[0].characters[0].id).toBeUndefined();
    expect(saved).not.toHaveBeenCalled();
  });

  it("saves the repair of the server's copy in the background", () => {
    const { shown, saved } = load(needsRepair(false));
    expect(shown).toHaveLength(1);
    expect(saved).toHaveBeenCalledWith("uid1", expect.objectContaining({ characters: [expect.objectContaining({ class: 4 })] }));
  });
});
