import { characterNameError, cleanCharacterName, fixDuplicateCharacterIds, nextCharacterId, parseRosterImport, toClassNumber } from './roster-input';
import { LostarkClass } from '../model/character/lostark-class';

const char = (id: number | undefined, name: string) => ({ id, name });

describe('nextCharacterId', () => {
  it('gives 12 after ids 1 to 11, compared as numbers', () => {
    const roster = Array.from({ length: 11 }, (_, i) => char(i + 1, `Char${i + 1}`));
    expect(nextCharacterId(roster)).toBe(12);
  });

  it('gives 1 for an empty roster (an id of 0 counts as no id)', () => {
    expect(nextCharacterId([])).toBe(1);
  });

  it('skips over large legacy random ids and ignores missing or junk ids', () => {
    expect(nextCharacterId([char(482915377, 'Old'), char(undefined, 'NoId'), { id: 'x' as unknown as number, name: 'Junk' }])).toBe(482915378);
  });
});

describe('fixDuplicateCharacterIds', () => {
  it('gives every later duplicate a new id and keeps the first one', () => {
    const roster = [char(10, 'Alpha'), char(11, 'Bravo'), char(10, 'Charlie'), char(11, 'Delta')];
    expect(fixDuplicateCharacterIds(roster)).toBe(true);
    expect(roster.map(c => c.id)).toEqual([10, 11, 12, 13]);
  });

  it('changes nothing when the ids are unique', () => {
    const roster = [char(1, 'Alpha'), char(2, 'Bravo')];
    expect(fixDuplicateCharacterIds(roster)).toBe(false);
    expect(roster.map(c => c.id)).toEqual([1, 2]);
  });
});

describe('cleanCharacterName', () => {
  it('trims, strips zero-width and control characters and caps at 16 characters', () => {
    expect(cleanCharacterName('  Ar​wen\u0007 ')).toBe('Arwen');
    expect(cleanCharacterName('﻿Abcdefghijklmnopqrst')).toBe('Abcdefghijklmnop');
  });

  it('turns a whitespace or zero-width only name into an empty string', () => {
    expect(cleanCharacterName(' ​‍ \t')).toBe('');
    expect(cleanCharacterName(undefined)).toBe('');
  });
});

describe('characterNameError', () => {
  const roster = [char(1, 'Arwen'), char(2, 'Brakka')];

  it('rejects an empty name', () => {
    expect(characterNameError('', roster)).toMatch(/empty/i);
  });

  it('rejects a name another character already has, ignoring case', () => {
    expect(characterNameError('brakka', roster, 1)).toMatch(/already/i);
    expect(characterNameError('Brakka', roster)).toMatch(/already/i);
  });

  it('accepts a new name, and the character keeping its own name', () => {
    expect(characterNameError('Celyne', roster, 1)).toBeNull();
    expect(characterNameError('Arwen', roster, 1)).toBeNull();
  });
});

describe('toClassNumber', () => {
  it('reads stored numbers and numeric strings, and rejects junk', () => {
    expect(toClassNumber(16)).toBe(LostarkClass.BARD);
    expect(toClassNumber('4')).toBe(LostarkClass.WARDANCER);
    expect(toClassNumber('Bard')).toBeUndefined();
    expect(toClassNumber(999)).toBeUndefined();
    expect(toClassNumber(null)).toBeNull();
  });
});

describe('parseRosterImport', () => {
  const good = { id: 5, name: ' Arwen ', ilvl: 1720, class: '16', lazy: false, weeklyGold: true };

  it('rejects text that is not JSON with a plain sentence', () => {
    const result = parseRosterImport('{not json');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['That does not look like an exported roster.']);
  });

  it('rejects a characters list of plain strings', () => {
    const result = parseRosterImport(JSON.stringify({ characters: ['Arwen'] }));
    expect(result.ok).toBe(false);
    expect(result.characters).toEqual([]);
    expect(result.errors[0]).toMatch(/Character 1/);
  });

  it('reports an empty list as no characters found', () => {
    expect(parseRosterImport(JSON.stringify({ characters: [] })).errors).toEqual(['No characters found.']);
    expect(parseRosterImport(JSON.stringify({ name: 'x' })).errors).toEqual(['That does not look like an exported roster.']);
  });

  it('names what is wrong with each character', () => {
    const result = parseRosterImport(JSON.stringify({
      characters: [
        { ...good, id: undefined },
        { ...good, id: 6, name: '   ' },
        { ...good, id: 7, ilvl: 'high' },
        { ...good, id: 8, class: 'Bard' }
      ]
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]).toMatch(/Character 1 .*id/);
    expect(result.errors[1]).toMatch(/Character 2 .*name/);
    expect(result.errors[2]).toMatch(/Character 3 .*item level/);
    expect(result.errors[3]).toMatch(/Character 4 .*class/);
  });

  it('accepts an exported roster, with names cleaned and classes as numbers', () => {
    const result = parseRosterImport(JSON.stringify({ $key: 'abc', characters: [good, { ...good, id: 9, name: 'Brakka', class: 4, ilvl: '1712' }] }));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.characters.map(c => [c.id, c.name, c.ilvl, c.class])).toEqual([[5, 'Arwen', 1720, 16], [9, 'Brakka', 1712, 4]]);
    expect(result.characters[0].weeklyGold).toBe(true);
  });

  it('gives duplicate ids in the file new ids instead of letting one character overwrite another', () => {
    const result = parseRosterImport(JSON.stringify({ characters: [good, { ...good, name: 'Brakka' }] }));
    expect(result.ok).toBe(true);
    expect(result.characters.map(c => c.id)).toEqual([5, 6]);
  });
});
