import { BehaviorSubject, of, Subject } from 'rxjs';
import { UntypedFormBuilder } from '@angular/forms';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzIconsTesting } from 'ng-zorro-antd/icon/testing';
import { TasksComponent } from './tasks.component';
import { createTask, LostarkTask } from '../../../model/lostark-task';
import { TaskFrequency } from '../../../model/task-frequency';
import { TaskScope } from '../../../model/task-scope';
import { TasksModule } from '../tasks.module';
import { TasksService } from '../../../core/database/services/tasks.service';
import { AuthService } from '../../../core/database/services/auth.service';
import { LayoutStateService } from '../../../core/services/layout-state.service';
import { DRAWER_ANIMATE_DURATION } from 'ng-zorro-antd/drawer';

// No real Firebase in unit tests (same as energy.service.spec.ts): the services are stubbed below
jest.mock('firebase/app', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

const task = (label: string, index: number, custom = true): LostarkTask =>
  ({ ...createTask(label, 1600, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, undefined, { custom }), index, $key: `k-${index}`, authorId: 'uid1' });

describe('TasksComponent', () => {
  let tasks$: BehaviorSubject<LostarkTask[]>;
  let tasksService: { tasks$: BehaviorSubject<LostarkTask[]>, addTask: jest.Mock, importTasks: jest.Mock, updateTaskField: jest.Mock, setTrackAll: jest.Mock, updateIndexes: jest.Mock };
  let message: { success: jest.Mock, error: jest.Mock, info: jest.Mock };
  let clipboard: { copy: jest.Mock };
  let modalClose: Subject<string | undefined>;
  let phone$: BehaviorSubject<boolean>;
  let component: TasksComponent;

  beforeEach(() => {
    tasks$ = new BehaviorSubject<LostarkTask[]>([task('Guild Chores', 0), task('Bifrost Run', 52), task('Built in', 7, false)]);
    tasksService = { tasks$, addTask: jest.fn(), importTasks: jest.fn(() => of(void 0)), updateTaskField: jest.fn(), setTrackAll: jest.fn(), updateIndexes: jest.fn() };
    message = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
    clipboard = { copy: jest.fn() };
    modalClose = new Subject<string | undefined>();
    phone$ = new BehaviorSubject<boolean>(true);
    component = new TasksComponent(
      tasksService as never,
      new UntypedFormBuilder(),
      message as never,
      clipboard as never,
      // A popup's afterClose emits once: each popup gets its own subject
      { create: () => ({ afterClose: modalClose = new Subject<string | undefined>() }) } as never,
      { uid$: of('uid1') } as never,
      { isPhone$: phone$, isPhone: true } as never,
      { onDestroy: () => () => undefined, destroyed: false } as never
    );
    component.tasks$.subscribe();
  });

  const fillForm = () => component.form.setValue({ label: 'Island Run', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, amount: 1, minIlvl: 1500, maxIlvl: 1700, iconPath: null });

  it('a double click on Add creates one task', () => {
    const pending = new Subject<string>();
    tasksService.addTask.mockReturnValue(pending);
    fillForm();
    component.addTask('uid1');
    component.addTask('uid1');
    expect(tasksService.addTask).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.next('new-key');
    pending.complete();
    expect(component.saving).toBe(false);
    expect(component.highlightKey).toBe('new-key');
  });

  it('puts a new task after the last one instead of at index -1', () => {
    tasksService.addTask.mockReturnValue(of('new-key'));
    fillForm();
    component.addTask('uid1');
    expect(tasksService.addTask.mock.calls[0][0].index).toBe(53);
  });

  it('lets the Add button work again after a failed write', () => {
    const failing = new Subject<string>();
    tasksService.addTask.mockReturnValue(failing);
    fillForm();
    component.addTask('uid1');
    failing.error(new Error('denied'));
    expect(component.saving).toBe(false);
    expect(message.error).toHaveBeenCalled();
  });

  it('closes the phone sheet after a successful add', () => {
    tasksService.addTask.mockReturnValue(of('new-key'));
    component.openSheet();
    fillForm();
    component.addTask('uid1');
    expect(component.sheetOpen()).toBe(false);
    expect(message.success).toHaveBeenCalled();
    expect(component.form.get('label')?.value).toBeNull();
    expect(component.highlightKey).toBe('new-key');
  });

  it('keeps the phone sheet open when the add fails', () => {
    const failing = new Subject<string>();
    tasksService.addTask.mockReturnValue(failing);
    component.openSheet();
    fillForm();
    component.addTask('uid1');
    failing.error(new Error('denied'));
    expect(component.sheetOpen()).toBe(true);
    expect(component.form.get('label')?.value).toBe('Island Run');
    expect(message.error).toHaveBeenCalled();
  });

  describe('scroll to the new row', () => {
    let row: HTMLTableRowElement;
    let scrollIntoView: jest.Mock;

    beforeEach(() => {
      row = document.createElement('tr');
      row.dataset['taskKey'] = 'new-key';
      // jsdom has no scrollIntoView
      scrollIntoView = row.scrollIntoView = jest.fn();
      document.body.appendChild(row);
      tasksService.addTask.mockReturnValue(of('new-key'));
      fillForm();
    });

    afterEach(() => row.remove());

    it('starts right away after an add from the card', fakeAsync(() => {
      component.addTask('uid1');
      tick(0);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      tick(4000);
    }));

    it('waits for the sheet to finish closing, so its focus return to the open button does not undo it', fakeAsync(() => {
      component.openSheet();
      component.addTask('uid1');
      tick(DRAWER_ANIMATE_DURATION);
      expect(scrollIntoView).not.toHaveBeenCalled();
      tick(100);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      tick(4000);
    }));
  });

  it('closes the sheet when the screen gets wide', () => {
    component.openSheet();
    phone$.next(false);
    expect(component.isPhone()).toBe(false);
    expect(component.sheetOpen()).toBe(false);
  });

  it('rejects a blank name, zero repetitions and a minimum above the maximum', () => {
    component.form.setValue({ label: '   ', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, amount: 0, minIlvl: 1700, maxIlvl: 1600, iconPath: null });
    expect(component.form.get('label')?.valid).toBe(false);
    expect(component.form.get('amount')?.valid).toBe(false);
    expect(component.form.errors).toEqual({ ilvlRange: true });
  });

  it('import rejects junk without writing', () => {
    component.importTasks('uid1');
    modalClose.next('{}');
    component.importTasks('uid1');
    modalClose.next(JSON.stringify([{ label: '' }]));
    expect(tasksService.importTasks).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledTimes(2);
  });

  it('re-importing your own export adds 0 tasks', () => {
    component.exportTasks(tasks$.value);
    const exported: string = clipboard.copy.mock.calls[0][0];
    expect(exported).not.toContain('$key');
    component.importTasks('uid1');
    modalClose.next(exported);
    expect(tasksService.importTasks).not.toHaveBeenCalled();
    expect(message.info).toHaveBeenCalledWith('Imported 0 tasks, skipped 2 duplicates.');
  });

  it('closing the import popup with X does nothing', () => {
    component.importTasks('uid1');
    modalClose.next(undefined);
    expect(message.error).not.toHaveBeenCalled();
    expect(tasksService.importTasks).not.toHaveBeenCalled();
  });

  it('reverts a blank name or blank minimum item level in the table instead of saving it', () => {
    const row = tasks$.value[0];
    const model = { control: { setValue: jest.fn() } };
    component.saveTaskField(row, 'label', '  ', model);
    component.saveTaskField(row, 'minIlvl', null, model);
    expect(model.control.setValue).toHaveBeenNthCalledWith(1, 'Guild Chores', { emitViewToModelChange: false });
    expect(model.control.setValue).toHaveBeenNthCalledWith(2, 1600, { emitViewToModelChange: false });
    expect(tasksService.updateTaskField).not.toHaveBeenCalled();
    component.saveTaskField(row, 'label', ' Guild Duties ', model);
    expect(tasksService.updateTaskField).toHaveBeenCalledWith(expect.objectContaining({ label: 'Guild Duties' }), 'label');
  });

  it('moves a row with the keyboard through the drop handler and stops at the ends', () => {
    const sorted = [...tasks$.value].sort((a, b) => a.index - b.index);
    component.moveByKeyboard(sorted, 2, 1);
    expect(tasksService.updateIndexes).not.toHaveBeenCalled();
    component.moveByKeyboard(sorted, 0, 1);
    expect(tasksService.updateIndexes.mock.calls[0][0].map((t: LostarkTask) => t.label)).toEqual(['Built in', 'Guild Chores', 'Bifrost Run']);
  });
});

describe('TasksComponent page', () => {
  let phone$: BehaviorSubject<boolean>;

  const setup = (phone: boolean, addTask = jest.fn(() => of('new-key'))) => {
    phone$ = new BehaviorSubject<boolean>(phone);
    TestBed.configureTestingModule({
      imports: [TasksModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideNzIconsTesting(),
        { provide: TasksService, useValue: { tasks$: of([task('Guild Chores', 0)]), setTrackAll: jest.fn(), addTask } },
        { provide: AuthService, useValue: { uid$: of('uid1') } },
        { provide: LayoutStateService, useValue: { isPhone$: phone$, isPhone: phone } }
      ]
    });
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    return fixture;
  };

  // The sheet is in an overlay on the page body, outside the component
  const forms = () => document.querySelectorAll('form.add-form');
  const sheetForm = () => document.querySelector('.add-task-sheet form.add-form');
  const cardTitles = (el: HTMLElement) => [...el.querySelectorAll('.ant-card-head-title')].map(t => t.textContent?.trim());
  const openButton = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button.add-task-open');

  it('on a PC shows the add form in the card below the list, with no button or sheet', () => {
    const fixture = setup(false);
    const el: HTMLElement = fixture.nativeElement;
    expect(cardTitles(el)).toEqual(['Tasks', 'Add a custom task']);
    expect(openButton(el)).toBeNull();
    expect(el.querySelector('nz-drawer')).toBeNull();
    expect(forms().length).toBe(1);
  });

  it('on a phone shows a button under the header that opens the form in a bottom sheet', fakeAsync(() => {
    const fixture = setup(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(cardTitles(el)).toEqual(['Tasks']);
    const button = openButton(el);
    expect(button?.textContent).toContain('Add a custom task');
    expect(button?.querySelector('[nz-icon]')?.getAttribute('nzType')).toBe('plus');
    // Right under the page header, above the Tasks card
    expect(el.querySelector('nz-page-header')?.nextElementSibling).toBe(button);
    // The closed drawer keeps its content for the length of its closing animation after the first render
    tick(400);
    fixture.detectChanges();
    expect(forms().length).toBe(0);

    button?.click();
    fixture.detectChanges();
    tick(400);
    expect(fixture.componentInstance.sheetOpen()).toBe(true);
    expect(document.querySelector('.add-task-sheet .ant-drawer-title')?.textContent).toContain('Add a custom task');
    expect(sheetForm()).not.toBeNull();
    expect(forms().length).toBe(1);

    document.querySelector<HTMLButtonElement>('.add-task-sheet .ant-drawer-close')?.click();
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
    expect(fixture.componentInstance.sheetOpen()).toBe(false);
    expect(forms().length).toBe(0);
  }));

  it('closes the sheet on a tap outside it', fakeAsync(() => {
    const fixture = setup(true);
    openButton(fixture.nativeElement)?.click();
    fixture.detectChanges();
    tick(400);
    document.querySelector<HTMLElement>('.ant-drawer-mask')?.click();
    fixture.detectChanges();
    tick(400);
    expect(fixture.componentInstance.sheetOpen()).toBe(false);
  }));

  it('closes the sheet with Escape', fakeAsync(() => {
    const fixture = setup(true);
    openButton(fixture.nativeElement)?.click();
    fixture.detectChanges();
    tick(400);
    expect(fixture.componentInstance.sheetOpen()).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true } as KeyboardEventInit));
    fixture.detectChanges();
    tick(400);
    expect(fixture.componentInstance.sheetOpen()).toBe(false);
  }));

  it('closes the sheet after a successful add from it', fakeAsync(() => {
    const addTask = jest.fn(() => of('new-key'));
    const fixture = setup(true, addTask);
    openButton(fixture.nativeElement)?.click();
    fixture.detectChanges();
    tick(400);
    fixture.componentInstance.form.setValue({ label: 'Island Run', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, amount: 1, minIlvl: 1500, maxIlvl: 1700, iconPath: null });
    fixture.detectChanges();
    sheetForm()?.querySelector<HTMLButtonElement>('button.add-button')?.click();
    fixture.detectChanges();
    expect(addTask).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.sheetOpen()).toBe(false);
    tick(4000);
  }));

  it('moves the form back to its card when the screen gets wide with the sheet open', fakeAsync(() => {
    const fixture = setup(true);
    const el: HTMLElement = fixture.nativeElement;
    openButton(el)?.click();
    fixture.detectChanges();
    tick(400);
    expect(sheetForm()).not.toBeNull();

    phone$.next(false);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
    expect(fixture.componentInstance.sheetOpen()).toBe(false);
    expect(openButton(el)).toBeNull();
    expect(sheetForm()).toBeNull();
    expect(cardTitles(el)).toEqual(['Tasks', 'Add a custom task']);
    expect(forms().length).toBe(1);
  }));

  it('asks before Track all and Untrack all change every task', async () => {
    const setTrackAll = jest.fn();
    TestBed.configureTestingModule({
      imports: [TasksModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideNzIconsTesting(),
        { provide: TasksService, useValue: { tasks$: of([task('Guild Chores', 0)]), setTrackAll } },
        { provide: AuthService, useValue: { uid$: of('uid1') } }
      ]
    });
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll('nz-page-header-extra button')];
    const track = buttons.find(b => b.textContent?.includes('Track all'));
    const untrack = buttons.find(b => b.textContent?.includes('Untrack all'));
    track?.click();
    untrack?.click();
    expect(setTrackAll).not.toHaveBeenCalled();
    expect(track?.hasAttribute('nz-popconfirm')).toBe(true);
    expect(untrack?.hasAttribute('nz-popconfirm')).toBe(true);
  });
});
