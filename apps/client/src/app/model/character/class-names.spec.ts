import { LostarkClass } from './lostark-class';
import { CLASS_OPTIONS, classDisplayName } from './class-names';

describe('class names', () => {
  it('uses the Global client names', () => {
    expect(classDisplayName(LostarkClass.ARCANA)).toBe('Arcanist');
    expect(classDisplayName(LostarkClass.SCOUTER)).toBe('Machinist');
    expect(classDisplayName(LostarkClass.GUARDIANKNIGHT)).toBe('Guardian Knight');
    expect(classDisplayName(LostarkClass.DIMENTIONALIST)).toBe('Dimensionalist');
    expect(classDisplayName(LostarkClass.WARDANCER)).toBe('Wardancer');
  });

  it('has a name for every class number, old ones included', () => {
    const ids = Object.keys(LostarkClass).filter(key => !isNaN(+key)).map(Number);
    ids.forEach(id => expect(classDisplayName(id)).toBeTruthy());
    expect(CLASS_OPTIONS.map(option => option.id).sort((a, b) => a - b)).toEqual(ids);
  });

  it('lists the pickable classes alphabetically', () => {
    const names = CLASS_OPTIONS.filter(option => !option.hide).map(option => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0]).toBe('Aeromancer');
  });

  it('leaves base classes and unreleased placeholders out of the picker, keeping them for saved characters', () => {
    const hidden = CLASS_OPTIONS.filter(option => option.hide).map(option => option.id).sort((a, b) => a - b);
    expect(hidden).toEqual([
      LostarkClass.UNRELEASED,
      LostarkClass.UNRELEASED0,
      LostarkClass.GUNNER,
      LostarkClass.MAGE,
      LostarkClass.WARRIOR,
      LostarkClass.ASSASSIN,
      LostarkClass.UNRELEASED4,
      LostarkClass.UNRELEASED5
    ]);
    expect(CLASS_OPTIONS.find(option => option.id === LostarkClass.MAGE)?.name).toBe('Mage');
  });

  it('points every option at its class icon', () => {
    expect(CLASS_OPTIONS.find(option => option.id === LostarkClass.WARDANCER)?.icon).toBe('class_04.png');
    expect(CLASS_OPTIONS.find(option => option.id === LostarkClass.DIMENTIONALIST)?.icon).toBe('class_37.png');
  });
});
