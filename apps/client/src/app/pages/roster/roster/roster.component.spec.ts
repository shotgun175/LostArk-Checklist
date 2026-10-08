import { of, Subject } from 'rxjs';
import { UntypedFormBuilder } from '@angular/forms';
import { RosterComponent } from './roster.component';
import { Roster } from '../../../model/roster';
import { Character } from '../../../model/character/character';

// No real Firebase in unit tests (same as energy.service.spec.ts): the services are stubbed below
jest.mock('firebase/app', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({ arrayRemove: (value: unknown) => ({ arrayRemove: value }) }));

const character = (id: number, name: string, extra: Partial<Character> = {}): Character =>
  ({ id, name, ilvl: 1700, lazy: false, class: 16, weeklyGold: false, tickets: {} as Character['tickets'], ...extra });

describe('RosterComponent', () => {
  let rosterService: { roster$: Subject<Roster>, setOne: jest.Mock, updateOne: jest.Mock };
  let message: { success: jest.Mock, error: jest.Mock, warning: jest.Mock };
  let modalClose: Subject<string | undefined>;
  let completion: { $key: string, data: Record<string, unknown> };
  let energy: { $key: string, data: Record<string, unknown> };
  let completionSetOne: jest.Mock;
  let energySetOne: jest.Mock;
  let settingsPatch: jest.Mock;
  let component: RosterComponent;
  const roster = (characters: Character[]): Roster => ({ $key: 'uid1', characters, trackedTasks: {}, showAllTasks: false });

  beforeEach(() => {
    rosterService = { roster$: new Subject<Roster>(), setOne: jest.fn(() => of(void 0)), updateOne: jest.fn(() => of(void 0)) };
    message = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    modalClose = new Subject<string | undefined>();
    completion = { $key: 'uid1', data: {} };
    energy = { $key: 'uid1', data: {} };
    completionSetOne = jest.fn(() => of(void 0));
    energySetOne = jest.fn(() => of(void 0));
    settingsPatch = jest.fn();
    component = new RosterComponent(
      rosterService as never,
      { uid$: of('uid1') } as never,
      new UntypedFormBuilder(),
      { copy: jest.fn() } as never,
      message as never,
      { completion$: of(completion), setOne: completionSetOne } as never,
      { energy$: of(energy), setOne: energySetOne } as never,
      // A popup's afterClose emits once: each popup gets its own subject
      { create: () => ({ afterClose: modalClose = new Subject<string | undefined>() }) } as never,
      { settings$: of({ $key: 'uid1', lazytracking: {}, goldPlannerConfiguration: {}, raidModesForGoldPlanner: {}, manualGoldEntries: {} }), patchFields: settingsPatch } as never
    );
  });

  describe('Import roster', () => {
    it('never writes or shows a success toast for junk like a list of plain names', () => {
      component.importRoster();
      modalClose.next(JSON.stringify({ characters: ['Arwen'] }));
      expect(rosterService.updateOne).not.toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalledWith(expect.stringMatching(/Character 1/), expect.anything());
    });

    it('closing the popup with X does nothing and shows no error', () => {
      component.importRoster();
      modalClose.next(undefined);
      expect(message.error).not.toHaveBeenCalled();
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    it('says plainly when the text is not a roster, or the list is empty', () => {
      component.importRoster();
      modalClose.next('{oops');
      expect(message.error).toHaveBeenLastCalledWith('That does not look like an exported roster.', expect.anything());
      component.importRoster();
      modalClose.next(JSON.stringify({ characters: [] }));
      expect(message.error).toHaveBeenLastCalledWith('No characters found.', expect.anything());
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    it('writes a valid roster with numeric classes', () => {
      component.importRoster();
      modalClose.next(JSON.stringify({ characters: [character(3, 'Arwen', { class: '16' as never })] }));
      expect(rosterService.updateOne).toHaveBeenCalledWith('uid1', { characters: [expect.objectContaining({ id: 3, name: 'Arwen', class: 16 })] });
      expect(message.success).toHaveBeenCalled();
    });
  });

  describe('adding a character', () => {
    it('gives the 12th character id 12 when ids 1 to 11 exist, so editing it leaves the others alone', () => {
      const r = roster(Array.from({ length: 11 }, (_, i) => character(i + 1, `Imp${i + 1}`)));
      component.form.setValue({ name: ' Newbie ', ilvl: 1600, lazy: false, class: 4 });
      component.addCharacter(r);
      const added = r.characters[11];
      expect(added.id).toBe(12);
      expect(added.name).toBe('Newbie');
      component.saveCharacter({ ...added, ilvl: 1610 }, r);
      const written: Character[] = rosterService.updateOne.mock.calls[0][1].characters;
      expect(written.find(c => c.name === 'Imp10')).toEqual(r.characters[9]);
      expect(written.find(c => c.id === 12)?.ilvl).toBe(1610);
    });

    it('refuses a duplicate name', () => {
      const r = roster([character(1, 'Arwen')]);
      component.form.setValue({ name: 'arwen', ilvl: 1600, lazy: false, class: 4 });
      component.addCharacter(r);
      expect(r.characters).toHaveLength(1);
      expect(rosterService.setOne).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalled();
    });

    it('rejects a whitespace name and an item level outside 0 to 2000 in the form', () => {
      component.form.setValue({ name: '   ', ilvl: 2500, lazy: false, class: 4 });
      expect(component.form.get('name')?.valid).toBe(false);
      expect(component.form.get('ilvl')?.valid).toBe(false);
      component.form.patchValue({ name: 'Ok', ilvl: -1 });
      expect(component.form.get('ilvl')?.valid).toBe(false);
    });

    it('offers class options as numbers, matching stored classes', () => {
      expect(component.classes.every(c => typeof c.id === 'number')).toBe(true);
      expect(component.classes.find(c => c.id === 4)?.name).toBe('Wardancer');
    });
  });

  describe('saving a character', () => {
    it('does not write when two characters share the id', () => {
      const r = roster([character(4, 'Arwen'), character(4, 'Brakka')]);
      component.saveCharacter({ ...r.characters[1], ilvl: 1 }, r);
      expect(rosterService.updateOne).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalled();
    });

    it('reverts an emptied item level instead of saving it', () => {
      const r = roster([character(1, 'Arwen')]);
      const model = { control: { setValue: jest.fn() } };
      component.saveIlvl(r.characters[0], r, null, model);
      expect(model.control.setValue).toHaveBeenCalledWith(1700, { emitViewToModelChange: false });
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('renaming a character', () => {
    it('rejects a blank or duplicate name, restores the old one and shows a message', () => {
      const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
      const model = { control: { setValue: jest.fn() } };
      component.saveCharacterName(r.characters[0], r, '  ​ ', model);
      component.saveCharacterName(r.characters[0], r, 'BRAKKA', model);
      expect(model.control.setValue).toHaveBeenCalledTimes(2);
      expect(model.control.setValue).toHaveBeenCalledWith('Arwen', { emitViewToModelChange: false });
      expect(message.error).toHaveBeenCalledTimes(2);
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    it('moves only that name\'s old completion and rest bonus keys, and removes the old rest bonus key', () => {
      completion.data = { 'Arwen:t1': { amount: 1 }, 'Arwenna:t1': { amount: 2 } };
      energy.data = { 'Arwen:t1': { amount: 40 }, 'Arwenna:t1': { amount: 60 } };
      const r = roster([character(1, 'Arwen'), character(2, 'Arwenna')]);
      component.saveCharacterName(r.characters[0], r, 'Elkie', { control: { setValue: jest.fn() } });
      expect(completion.data).toEqual({ '1:t1': { amount: 1 }, 'Arwenna:t1': { amount: 2 } });
      expect(energy.data).toEqual({ '1:t1': { amount: 40 }, 'Arwenna:t1': { amount: 60 } });
      expect(rosterService.updateOne.mock.calls[0][1].characters[0].name).toBe('Elkie');
    });
  });

  describe('reordering', () => {
    it('moves a row with the keyboard through the same handler as a drop, and stops at the ends', () => {
      const r = roster([character(1, 'Arwen'), character(2, 'Brakka'), character(3, 'Celyne')]);
      component.moveByKeyboard(r, 0, -1);
      expect(rosterService.updateOne).not.toHaveBeenCalled();
      component.moveByKeyboard(r, 0, 1);
      expect(rosterService.updateOne).toHaveBeenCalledTimes(1);
      expect(r.characters.map(c => c.name)).toEqual(['Brakka', 'Arwen', 'Celyne']);
      expect(r.characters.map(c => c.index)).toEqual([0, 1, 2]);
    });

    it('tracks rows by id, so two characters with the same name stay apart', () => {
      expect(component.trackByCharacter(0, character(7, 'Twin'))).toBe(7);
    });
  });
});
