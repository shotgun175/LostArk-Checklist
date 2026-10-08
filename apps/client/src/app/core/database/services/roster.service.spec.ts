import { normalizeRosterCharacters } from "./roster.service";
import { Roster } from "../../../model/roster";

// No real Firebase in unit tests (same as energy.service.spec.ts)
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({}));

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

  it("leaves a clean roster unchanged", () => {
    const r = roster([{ id: 1, name: "Brakka", ilvl: 1700, class: 4, tickets: {}, weeklyGold: false }]);
    expect(normalizeRosterCharacters(r)).toBe(false);
  });
});
