import { normalizeRestBonus, restBonusMax } from "./rest-bonus";

describe("normalizeRestBonus", () => {
  it("turns a cleared or unreadable cell into 0", () => {
    expect(normalizeRestBonus(null, 100)).toBe(0);
    expect(normalizeRestBonus(undefined, 100)).toBe(0);
    expect(normalizeRestBonus("", 100)).toBe(0);
    expect(normalizeRestBonus(NaN, 100)).toBe(0);
    expect(normalizeRestBonus("abc", 100)).toBe(0);
  });

  it("rounds to the nearest step of 10", () => {
    expect(normalizeRestBonus(55.5, 100)).toBe(60);
    expect(normalizeRestBonus(54, 100)).toBe(50);
    expect(normalizeRestBonus(40, 100)).toBe(40);
    expect(normalizeRestBonus("30", 100)).toBe(30);
  });

  it("keeps the value between 0 and the maximum", () => {
    expect(normalizeRestBonus(-20, 100)).toBe(0);
    expect(normalizeRestBonus(150, 100)).toBe(100);
    expect(normalizeRestBonus(150, 200)).toBe(150);
    expect(normalizeRestBonus(260, 200)).toBe(200);
  });
});

describe("restBonusMax", () => {
  it("allows 200 for Chaos Dungeon and 100 for other tasks", () => {
    expect(restBonusMax("Chaos Dungeon")).toBe(200);
    expect(restBonusMax("Guardian")).toBe(100);
    expect(restBonusMax(undefined)).toBe(100);
  });
});
