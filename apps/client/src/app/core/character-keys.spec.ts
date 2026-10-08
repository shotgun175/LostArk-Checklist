import { characterFlagKey, characterKeyMigrationWrites, manualGoldKey, readCharacterFlag, readManualGold, removedCharacterWrites } from './character-keys';
import { applyFieldWrites } from './database/write-coalescer';

const elkie = { id: 5, name: 'Elkie' };

describe('character flag keys', () => {
  it('keys a character by id, and by name only when it has no id', () => {
    expect(characterFlagKey(elkie, 'task1')).toBe('5:task1');
    expect(characterFlagKey({ name: 'Elkie' }, 'task1')).toBe('Elkie:task1');
    expect(manualGoldKey('chaos', elkie)).toBe('chaos:5');
  });

  it('reads the id key first and falls back to the older name key', () => {
    expect(readCharacterFlag({ '5:task1': false, 'Elkie:task1': true }, elkie, 'task1')).toBe(false);
    expect(readCharacterFlag({ 'Elkie:task1': false }, elkie, 'task1')).toBe(false);
    expect(readCharacterFlag(undefined, elkie, 'task1')).toBeUndefined();
    expect(readManualGold({ 'other:Elkie': { amount: 3 } }, 'other', elkie)).toEqual({ amount: 3 });
  });
});

describe('characterKeyMigrationWrites', () => {
  const settings = () => ({
    lazytracking: { 'Elkie:task1': false, 'Elkie:task2': true, 'Gone:task1': false, '9:task1': false },
    goldPlannerConfiguration: {
      'Elkie:gold:taking:Kazeros Gate 1': true,
      'Elkie:gold:Kazeros Gate 1': true,
      'expandRaid:Kazeros': true,
      hideAlreadyDoneTasks: true
    },
    raidModesForGoldPlanner: { 'Elkie:runningMode:Kazeros Gate 1': 'HM' },
    manualGoldEntries: { 'chaos:Elkie': { amount: 100, timestamp: 1 }, 'other:Gone': { amount: 5, timestamp: 1 } }
  });

  it('moves lazy and gold name keys to id keys exactly once', () => {
    const data = settings();
    const writes = characterKeyMigrationWrites(data, [elkie, { id: 9, name: 'Ilvane' }]);
    applyFieldWrites(data, writes);
    expect(data).toEqual({
      lazytracking: { '5:task1': false, '5:task2': true, 'Gone:task1': false, '9:task1': false },
      goldPlannerConfiguration: {
        '5:gold:taking:Kazeros Gate 1': true,
        '5:gold:Kazeros Gate 1': true,
        'expandRaid:Kazeros': true,
        hideAlreadyDoneTasks: true
      },
      raidModesForGoldPlanner: { '5:runningMode:Kazeros Gate 1': 'HM' },
      manualGoldEntries: { 'chaos:5': { amount: 100, timestamp: 1 }, 'other:Gone': { amount: 5, timestamp: 1 } }
    });
    expect(characterKeyMigrationWrites(data, [elkie, { id: 9, name: 'Ilvane' }])).toEqual([]);
  });

  it('keeps an existing id key and only removes the older name key', () => {
    const data = { lazytracking: { '5:task1': true, 'Elkie:task1': false } };
    applyFieldWrites(data, characterKeyMigrationWrites(data, [elkie]));
    expect(data.lazytracking).toEqual({ '5:task1': true });
  });

  it('gives a name key to every character with that name', () => {
    const data = { lazytracking: { 'Twin:task1': false } };
    applyFieldWrites(data, characterKeyMigrationWrites(data, [{ id: 1, name: 'Twin' }, { id: 2, name: 'Twin' }]));
    expect(data.lazytracking).toEqual({ '1:task1': false, '2:task1': false });
  });

  it('leaves keys alone for characters without an id and for a name that is also an id', () => {
    const data = { lazytracking: { 'NoId:task1': false, '7:task1': true } };
    expect(characterKeyMigrationWrites(data, [{ name: 'NoId' }, { id: 7, name: 'Seven' }, { id: 8, name: '7' }])).toEqual([]);
  });

  it('does nothing for missing maps', () => {
    expect(characterKeyMigrationWrites({}, [elkie])).toEqual([]);
  });
});

describe('removedCharacterWrites', () => {
  const settings = {
    lazytracking: { '5:task1': false, '15:task1': false, 'Elkie:task1': false },
    manualGoldEntries: { 'chaos:5': { amount: 1 }, 'chaos:15': { amount: 2 } }
  };

  it('deletes only the removed id keys, not ids that start with the same digits or name keys', () => {
    expect(removedCharacterWrites(settings, elkie, [])).toEqual([
      { path: ['lazytracking', '5:task1'], delete: true },
      { path: ['manualGoldEntries', 'chaos:5'], delete: true }
    ]);
  });

  it('deletes nothing for a character without an id, or when another character keeps the id', () => {
    expect(removedCharacterWrites(settings, { name: 'Elkie' }, [])).toEqual([]);
    expect(removedCharacterWrites(settings, elkie, [{ id: 5, name: 'Other' }])).toEqual([]);
  });
});
