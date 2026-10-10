import * as fs from 'fs';
import * as path from 'path';
import { of, Subject } from 'rxjs';
import { UntypedFormBuilder } from '@angular/forms';
import { RosterComponent } from './roster.component';
import { Roster } from '../../../model/roster';
import { Character } from '../../../model/character/character';
import { applyFieldWrites } from '../../../core/database/write-coalescer';
import { readCharacterFlag, readManualGold } from '../../../core/character-keys';
import { nextCharacterId } from '../../../core/roster-input';

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
  let completion: { $key: string, data: Record<string, unknown>, fromCache?: true };
  let energy: { $key: string, data: Record<string, unknown>, fromCache?: true };
  let completionSetOne: jest.Mock;
  let energySetOne: jest.Mock;
  let settingsPatch: jest.Mock;
  let settingsDoc: Record<string, unknown>;
  let component: RosterComponent;
  const roster = (characters: Character[]): Roster => ({ $key: 'uid1', characters, trackedTasks: {}, showAllTasks: false });

  beforeEach(() => {
    rosterService = { roster$: new Subject<Roster>(), setOne: jest.fn(() => of(void 0)), updateOne: jest.fn(() => of(void 0)) };
    message = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    modalClose = new Subject<string | undefined>();
    completion = { $key: 'uid1', data: {} };
    energy = { $key: 'uid1', data: {} };
    completionSetOne = jest.fn();
    energySetOne = jest.fn();
    settingsPatch = jest.fn();
    settingsDoc = { $key: 'uid1', lazytracking: {}, goldPlannerConfiguration: {}, raidModesForGoldPlanner: {}, manualGoldEntries: {} };
    component = new RosterComponent(
      rosterService as never,
      { uid$: of('uid1') } as never,
      new UntypedFormBuilder(),
      { copy: jest.fn() } as never,
      message as never,
      { completion$: of(completion), setOneInBackground: completionSetOne } as never,
      { energy$: of(energy), setOneInBackground: energySetOne } as never,
      // A popup's afterClose emits once: each popup gets its own subject
      { create: () => ({ afterClose: modalClose = new Subject<string | undefined>() }) } as never,
      { settings$: of(settingsDoc), patchFields: settingsPatch } as never
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

    it('confirms at once while the write is still waiting for the server (offline)', () => {
      rosterService.updateOne.mockReturnValue(new Subject<void>());
      component.importRoster();
      modalClose.next(JSON.stringify({ characters: [character(3, 'Arwen')] }));
      expect(message.success).toHaveBeenCalledWith('Roster imported');
    });

    it('shows an error when the server refuses the write later', () => {
      const write = new Subject<void>();
      rosterService.updateOne.mockReturnValue(write);
      component.importRoster();
      modalClose.next(JSON.stringify({ characters: [character(3, 'Arwen')] }));
      write.error(new Error('No document to update'));
      expect(message.error).toHaveBeenCalledWith('No document to update');
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

    it('adds a character with a name another character already has, under its own id', () => {
      const r = roster([character(1, 'Arwen')]);
      component.form.setValue({ name: 'Arwen', ilvl: 1600, lazy: false, class: 4 });
      component.addCharacter(r);
      expect(r.characters.map(c => [c.id, c.name])).toEqual([[1, 'Arwen'], [2, 'Arwen']]);
      expect(rosterService.setOne).toHaveBeenCalledTimes(1);
      expect(message.error).not.toHaveBeenCalled();
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
    it('rejects a blank name, restores the old one and shows a message', () => {
      const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
      const model = { control: { setValue: jest.fn() } };
      component.saveCharacterName(r.characters[0], r, '  ​ ', model);
      expect(model.control.setValue).toHaveBeenCalledWith('Arwen', { emitViewToModelChange: false });
      expect(message.error).toHaveBeenCalledTimes(1);
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    // Names are unique only per region (NA and EU), so one roster may hold the same name twice
    it('saves a name another character already has, and leaves that character alone', () => {
      const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
      component.saveCharacterName(r.characters[0], r, 'Brakka', { control: { setValue: jest.fn() } });
      expect(message.error).not.toHaveBeenCalled();
      const saved: Character[] = rosterService.updateOne.mock.calls[0][1].characters;
      expect(saved.map(c => [c.id, c.name])).toEqual([[1, 'Brakka'], [2, 'Brakka']]);
    });

    it('renaming one of two same-named characters gives both their copy of the old name keys', () => {
      completion.data = { 'Arwen:t1': { amount: 1 }, '2:t2': { amount: 3 } };
      energy.data = { 'Arwen:t1': { amount: 40 } };
      settingsDoc['lazytracking'] = { 'Arwen:t1': false };
      const r = roster([character(1, 'Arwen'), character(2, 'Arwen')]);
      component.saveCharacterName(r.characters[0], r, 'Elkie', { control: { setValue: jest.fn() } });
      expect(completion.data).toEqual({ '1:t1': { amount: 1 }, '2:t1': { amount: 1 }, '2:t2': { amount: 3 } });
      expect(energy.data).toEqual({ '1:t1': { amount: 40 }, '2:t1': { amount: 40 } });
      const lazy = applyFieldWrites(settingsDoc, settingsPatch.mock.calls[0][1])['lazytracking'];
      expect(lazy).toEqual({ '1:t1': false, '2:t1': false });
      const saved: Character[] = rosterService.updateOne.mock.calls[0][1].characters;
      expect(saved.map(c => [c.id, c.name])).toEqual([[1, 'Elkie'], [2, 'Arwen']]);
      expect(completionSetOne).toHaveBeenCalledWith('uid1', completion);
      expect(energySetOne).toHaveBeenCalledWith('uid1', energy);
    });

    it('does not move old name keys from cached copies (offline), but still saves the new name', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      completion.data = { 'Arwen:t1': { amount: 1 } };
      completion.fromCache = true;
      energy.data = { 'Arwen:t1': { amount: 40 } };
      settingsDoc['lazytracking'] = { 'Arwen:t1': false };
      const r = roster([character(1, 'Arwen')]);
      component.saveCharacterName(r.characters[0], r, 'Elkie', { control: { setValue: jest.fn() } });
      expect(completionSetOne).not.toHaveBeenCalled();
      expect(energySetOne).not.toHaveBeenCalled();
      expect(settingsPatch).not.toHaveBeenCalled();
      expect(rosterService.updateOne.mock.calls[0][1].characters[0].name).toBe('Elkie');
      warn.mockRestore();
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

  describe('deleting a character', () => {
    it('removes its settings, so a character added later with the same id starts clean', () => {
      const ana = character(1, 'Arwen');
      const bree = character(2, 'Brakka');
      settingsDoc['lazytracking'] = { '2:task1': false, '1:task1': false };
      settingsDoc['goldPlannerConfiguration'] = { '2:gold:taking:Gate 1': true, '1:gold:taking:Gate 1': true };
      settingsDoc['raidModesForGoldPlanner'] = { '2:runningMode:Gate 1': 'hard' };
      settingsDoc['manualGoldEntries'] = { 'chaos:2': { amount: 5 }, 'other:2': { amount: 7 }, 'chaos:1': { amount: 3 } };
      component.removeCharacter(bree, roster([ana, bree]));
      expect(rosterService.updateOne).toHaveBeenCalledWith('uid1', { characters: { arrayRemove: bree } });
      const after = applyFieldWrites(settingsDoc, settingsPatch.mock.calls.flatMap(call => call[1]));
      const cora = character(nextCharacterId([ana]), 'Celyne');
      expect(cora.id).toBe(2);
      expect(readCharacterFlag(after['lazytracking'] as Record<string, boolean>, cora, 'task1')).toBeUndefined();
      expect(readCharacterFlag(after['goldPlannerConfiguration'] as Record<string, boolean>, cora, 'gold:taking:Gate 1')).toBeUndefined();
      expect(readCharacterFlag(after['raidModesForGoldPlanner'] as Record<string, string>, cora, 'runningMode:Gate 1')).toBeUndefined();
      expect(readManualGold(after['manualGoldEntries'] as Record<string, unknown>, 'chaos', cora)).toBeUndefined();
      expect(readManualGold(after['manualGoldEntries'] as Record<string, unknown>, 'other', cora)).toBeUndefined();
      // The other character keeps its settings
      expect(after['lazytracking']).toEqual({ '1:task1': false });
      expect(after['goldPlannerConfiguration']).toEqual({ '1:gold:taking:Gate 1': true });
      expect(after['manualGoldEntries']).toEqual({ 'chaos:1': { amount: 3 } });
    });
  });

  describe('character note', () => {
    it('saves the trimmed note through saveCharacter and closes the popup', () => {
      const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
      component.onNoteVisible(r.characters[1], true);
      expect(component.openNoteId).toBe(2);
      component.noteDraft = '  Bus alt\nfor Serca  ';
      component.saveNote(r.characters[1], r);
      const written: Character[] = rosterService.updateOne.mock.calls[0][1].characters;
      expect(written.map(c => c.note)).toEqual([undefined, 'Bus alt\nfor Serca']);
      expect(component.openNoteId).toBeNull();
    });

    it('stores a blank note as an empty note, as the old text box did', () => {
      const r = roster([character(1, 'Arwen', { note: 'Old' })]);
      component.onNoteVisible(r.characters[0], true);
      component.noteDraft = '   ';
      component.saveNote(r.characters[0], r);
      expect(rosterService.updateOne.mock.calls[0][1].characters[0].note).toBe('');
      expect(component.hasNote(r.characters[0])).toBe(false);
    });

    it('Clear empties the note and saves it', () => {
      const r = roster([character(1, 'Arwen', { note: 'Old' })]);
      component.onNoteVisible(r.characters[0], true);
      component.clearNote(r.characters[0], r);
      expect(component.noteDraft).toBe('');
      expect(rosterService.updateOne.mock.calls[0][1].characters[0].note).toBe('');
      expect(component.openNoteId).toBeNull();
    });

    it('does not write when the note did not change', () => {
      const r = roster([character(1, 'Arwen', { note: 'Same' }), character(2, 'Brakka')]);
      component.onNoteVisible(r.characters[0], true);
      component.saveNote(r.characters[0], r);
      component.onNoteVisible(r.characters[1], true);
      component.clearNote(r.characters[1], r);
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    it('closing the popup without Save drops the edits, and reopening starts from the saved note', () => {
      const r = roster([character(1, 'Arwen', { note: 'Saved' })]);
      component.onNoteVisible(r.characters[0], true);
      component.noteDraft = 'Unsaved';
      component.onNoteVisible(r.characters[0], false);
      expect(component.openNoteId).toBeNull();
      component.onNoteVisible(r.characters[0], true);
      expect(component.noteDraft).toBe('Saved');
      expect(rosterService.updateOne).not.toHaveBeenCalled();
    });

    it('shows a blue Note button only for a non-blank note, with a capped hover text', () => {
      expect(component.hasNote(character(1, 'Arwen'))).toBe(false);
      expect(component.hasNote(character(1, 'Arwen', { note: ' \n ' }))).toBe(false);
      expect(component.hasNote(character(1, 'Arwen', { note: 'x' }))).toBe(true);
      expect(component.noteTooltip(character(1, 'Arwen', { note: ' Line 1\nLine 2 ' }))).toBe('Line 1\nLine 2');
      const long = component.noteTooltip(character(1, 'Arwen', { note: 'a'.repeat(400) }));
      expect(long).toBe(`${'a'.repeat(300)}...`);
    });

    describe('keyboard focus', () => {
      // Two rows' buttons, and two popups as when one is still fading out while the next opens
      const addNoteDom = (): Record<string, HTMLElement> => {
        document.body.innerHTML = `
          <button class="note-button" data-note-id="1"></button>
          <button class="note-button" data-note-id="2"></button>
          <div class="note-editor" data-note-id="1"><textarea></textarea><button class="save"></button></div>
          <div class="note-editor" data-note-id="2"><textarea></textarea></div>`;
        const q = (selector: string) => document.querySelector<HTMLElement>(selector) as HTMLElement;
        return {
          button1: q('.note-button[data-note-id="1"]'), button2: q('.note-button[data-note-id="2"]'),
          textarea1: q('[data-note-id="1"] textarea'), textarea2: q('[data-note-id="2"] textarea'), save1: q('.save')
        };
      };

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
      });

      it('focuses the text box of the popup that opened, even while another one is still closing', () => {
        const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
        const el = addNoteDom();
        component.onNoteVisible(r.characters[1], true);
        jest.runAllTimers();
        expect(document.activeElement).toBe(el.textarea2);
      });

      it('gives focus back to the note button after Save, Clear or Escape', () => {
        const r = roster([character(1, 'Arwen')]);
        const el = addNoteDom();
        el.save1.focus();
        component.saveNote(r.characters[0], r);
        jest.runAllTimers();
        expect(document.activeElement).toBe(el.button1);

        el.textarea1.focus();
        component.clearNote(r.characters[0], r);
        jest.runAllTimers();
        expect(document.activeElement).toBe(el.button1);

        el.textarea1.focus();
        component.onNoteVisible(r.characters[0], false);
        jest.runAllTimers();
        expect(document.activeElement).toBe(el.button1);
      });

      it('leaves focus alone when it already moved on, such as to another note button', () => {
        const r = roster([character(1, 'Arwen'), character(2, 'Brakka')]);
        const el = addNoteDom();
        component.onNoteVisible(r.characters[0], true);
        el.button2.focus();
        component.onNoteVisible(r.characters[1], true);
        component.onNoteVisible(r.characters[0], false);
        jest.runAllTimers();
        expect(component.openNoteId).toBe(2);
        expect(document.activeElement).toBe(el.textarea2);
      });
    });

    it('wires the note button into the row actions just before Delete, with no note text box on the row', () => {
      const html = fs.readFileSync(path.resolve(__dirname, 'roster.component.html'), 'utf8');
      expect(html).toMatch(/\[nzActions\]="\[[^\]]*setClassAction, noteAction, deleteAction\]"/);
      expect(html).not.toContain('[nzContent]');
      expect(html).toContain('(click)="saveNote(character, roster)"');
      expect(html).toContain('(click)="clearNote(character, roster)"');
      expect(html).toContain('(nzPopoverVisibleChange)="onNoteVisible(character, $event)"');
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
