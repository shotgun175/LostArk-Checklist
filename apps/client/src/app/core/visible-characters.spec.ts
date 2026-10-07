import { filterGoldPlannerCharacters, filterVisibleCharacters } from './visible-characters';

interface TestCharacter {
  name: string;
  ilvl: number;
  isHide?: boolean;
}

const roster: TestCharacter[] = [
  { name: 'HiddenLow', ilvl: 1690, isHide: true },
  { name: 'MainA', ilvl: 1745 },
  { name: 'HiddenMid', ilvl: 1700, isHide: true },
  { name: 'MainB', ilvl: 1720, isHide: false }
];

describe('filterVisibleCharacters', () => {
  it('drops hidden characters when show hidden is off', () => {
    expect(filterVisibleCharacters(roster, false).map(c => c.name)).toEqual(['MainA', 'MainB']);
  });

  it('keeps every character, in roster order, when show hidden is on', () => {
    expect(filterVisibleCharacters(roster, true).map(c => c.name)).toEqual(['HiddenLow', 'MainA', 'HiddenMid', 'MainB']);
  });

  it('gives column i the i-th visible character, not roster[i]', () => {
    const visible = filterVisibleCharacters(roster, false);
    // The old template read roster[0] (ilvl 1690) for the first column.
    expect(roster[0].ilvl).toBe(1690);
    expect(visible[0].name).toBe('MainA');
    expect(visible[0].ilvl).toBe(1745);
    expect(visible[1].name).toBe('MainB');
  });
});

describe('filterGoldPlannerCharacters', () => {
  const goldRoster = [
    { name: 'HiddenEarner', isHide: true, weeklyGold: true },
    { name: 'MainEarner', isHide: false, weeklyGold: true },
    { name: 'MainNoGold', weeklyGold: false },
    { name: 'HiddenNoGold', isHide: true, weeklyGold: false }
  ];

  it('keeps only visible characters with Weekly Gold on', () => {
    expect(filterGoldPlannerCharacters(goldRoster, false).map(c => c.name)).toEqual(['MainEarner']);
  });

  it('adds hidden Weekly Gold characters when show hidden is on', () => {
    expect(filterGoldPlannerCharacters(goldRoster, true).map(c => c.name)).toEqual(['HiddenEarner', 'MainEarner']);
  });
});
