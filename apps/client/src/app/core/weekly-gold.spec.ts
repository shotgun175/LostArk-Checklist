import { applyWeeklyGoldDefaults, countWeeklyGoldCharacters, getWeeklyGoldLimitWarning, isWeeklyGoldTickDisabled, MAX_WEEKLY_GOLD_CHARACTERS, newCharacterWeeklyGold } from './weekly-gold';

const chars = (...flags: (boolean | undefined)[]) => flags.map((weeklyGold, i) => ({ name: `C${i}`, weeklyGold }));

describe('weekly gold characters', () => {
  it('allows 6 weekly gold characters per roster', () => {
    expect(MAX_WEEKLY_GOLD_CHARACTERS).toBe(6);
  });

  it('counts only characters with Weekly Gold on', () => {
    expect(countWeeklyGoldCharacters(chars(true, false, true, undefined))).toBe(2);
  });

  it('disables the tick on characters without Weekly Gold once 6 have it', () => {
    const roster = chars(true, true, true, true, true, true, false);
    expect(isWeeklyGoldTickDisabled(roster, roster[6])).toBe(true);
    roster.slice(0, 6).forEach(c => expect(isWeeklyGoldTickDisabled(roster, c)).toBe(false));
  });

  it('enables the tick again under 6', () => {
    const roster = chars(true, true, true, true, true, false, false);
    expect(isWeeklyGoldTickDisabled(roster, roster[6])).toBe(false);
  });

  it('keeps ticked characters untickable when over 6', () => {
    const roster = chars(true, true, true, true, true, true, true);
    roster.forEach(c => expect(isWeeklyGoldTickDisabled(roster, c)).toBe(false));
  });

  it('gives a new character Weekly Gold only while fewer than 6 have it, wherever it sits in the roster', () => {
    expect(newCharacterWeeklyGold(chars(true, false, false, false, false, false, false))).toBe(true);
    expect(newCharacterWeeklyGold(chars(true, true, true, true, true, true))).toBe(false);
  });

  it('warns only when more than 6 characters have Weekly Gold', () => {
    expect(getWeeklyGoldLimitWarning(6)).toBeUndefined();
    expect(getWeeklyGoldLimitWarning(7)).toBe('Weekly gold on 7 characters, max is 6');
  });
});

describe('applyWeeklyGoldDefaults', () => {
  it('fills missing values by count, not position, and reports whether anything changed', () => {
    const roster = chars(false, false, true, undefined, undefined, true, true, true, undefined, undefined);
    expect(applyWeeklyGoldDefaults(roster)).toBe(true);
    expect(roster.map(c => c.weeklyGold)).toEqual([false, false, true, true, true, true, true, true, false, false]);
  });

  it('never unticks existing values', () => {
    const roster = chars(true, true, true, true, true, true, true, undefined);
    applyWeeklyGoldDefaults(roster);
    expect(roster.map(c => c.weeklyGold)).toEqual([true, true, true, true, true, true, true, false]);
  });

  it('changes nothing when every value is set', () => {
    const roster = chars(true, false);
    expect(applyWeeklyGoldDefaults(roster)).toBe(false);
    expect(roster.map(c => c.weeklyGold)).toEqual([true, false]);
  });
});
