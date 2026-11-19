import { ChangeDetectionStrategy, Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NzTooltipDirective, NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TAP_SLOP_PX } from './tap-tooltip.directive';
import { TapTooltipModule } from './tap-tooltip.module';

@Component({
  template: `
    <span id="info" nz-tooltip nzTooltipTitle="Info" (nzTooltipVisibleChange)="visible = $event">i</span>
    <button type="button" id="cleared" nz-tooltip [nzTooltipTitle]="title()" (click)="title.set('')" (nzTooltipVisibleChange)="clearedVisible = $event; clearedEverVisible = clearedEverVisible || $event">c</button>
    <span id="slow" nz-tooltip nzTooltipTitle="Slow" nzTooltipMouseEnterDelay="0.5" (nzTooltipVisibleChange)="slowVisible = $event">s</span>
    <span id="click" nz-tooltip nzTooltipTrigger="click" nzTooltipTitle="Click" (nzTooltipVisibleChange)="clickVisible = $event">k</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
class HostComponent {
  readonly title = signal('Note');
  visible = false;
  clearedVisible = false;
  clearedEverVisible = false;
  slowVisible = false;
  clickVisible = false;
}

/** A touch event the way a phone sends it: one finger at (x, y). */
function touch(target: Element, type: string, x = 10, y = 10): void {
  const event = new Event(type, { bubbles: true, cancelable: type !== 'touchcancel' });
  const point = [{ clientX: x, clientY: y, target }];
  Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : point });
  Object.defineProperty(event, 'changedTouches', { value: point });
  target.dispatchEvent(event);
}

/** A touch event with these fingers still on the screen (touches) and this one changing (changedTouches). */
function touchWith(target: Element, type: string, fingers: { clientX: number; clientY: number }[], changed = fingers.slice(-1)): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: fingers });
  Object.defineProperty(event, 'changedTouches', { value: changed });
  target.dispatchEvent(event);
}

const mouse = (target: Element, type: string): boolean => target.dispatchEvent(new MouseEvent(type, { bubbles: true }));

describe('TapTooltipDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = (id: string): HTMLElement => fixture.nativeElement.querySelector(`#${id}`);

  const setup = (tooltipModule: Type<unknown>) => {
    TestBed.configureTestingModule({ declarations: [HostComponent], imports: [tooltipModule, NoopAnimationsModule] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** A tap in the order a phone sends it: touch, then the mouse events it makes up, then the click. */
  const tap = (target: Element) => {
    touch(target, 'touchstart');
    touch(target, 'touchend');
    mouse(target, 'mouseenter');
    mouse(target, 'mousedown');
    mouse(target, 'mouseup');
    mouse(target, 'click');
    fixture.detectChanges();
  };

  /** Past the tooltip's 0.15 s hover delay. */
  const wait = () => {
    tick(150);
    fixture.detectChanges();
    tick();
  };

  it('opens on a tap in the order a phone sends it', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('info'));
    wait();
    expect(host.visible).toBe(true);
  }));

  // If this starts failing after an ng-zorro update, ng-zorro opens hover tooltips on a tap again and the directive may go
  it('ng-zorro on its own still ignores the same tap, which is why the directive exists', fakeAsync(() => {
    setup(NzTooltipModule);
    tap(el('info'));
    tick(1000);
    fixture.detectChanges();
    tick();
    expect(host.visible).toBe(false);
  }));

  // Control for the test above: this harness does see ng-zorro open a tooltip by itself
  it('ng-zorro on its own still opens the tooltip on a mouse hover', fakeAsync(() => {
    setup(NzTooltipModule);
    mouse(el('info'), 'mouseenter');
    wait();
    expect(host.visible).toBe(true);
  }));

  it('opens on a tap that no click follows, as on a disabled checkbox', fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart');
    touch(el('info'), 'touchend');
    wait();
    expect(host.visible).toBe(true);
  }));

  it('waits the hover delay before it opens', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('info'));
    tick(100);
    fixture.detectChanges();
    expect(host.visible).toBe(false);
    wait();
    expect(host.visible).toBe(true);
  }));

  it(`opens nothing when the finger moves more than ${TAP_SLOP_PX} px (a scroll or a drag)`, fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart', 10, 10);
    touch(el('info'), 'touchmove', 10, 10 + TAP_SLOP_PX + 1);
    touch(el('info'), 'touchend', 10, 10 + TAP_SLOP_PX + 1);
    wait();
    expect(host.visible).toBe(false);
  }));

  it(`still opens when the finger wobbles ${TAP_SLOP_PX} px`, fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart', 10, 10);
    touch(el('info'), 'touchmove', 10 + TAP_SLOP_PX, 10);
    touch(el('info'), 'touchend', 10 + TAP_SLOP_PX, 10);
    wait();
    expect(host.visible).toBe(true);
  }));

  it('opens nothing for a two-finger touch (a pinch)', fakeAsync(() => {
    setup(TapTooltipModule);
    const pinch = new Event('touchstart', { bubbles: true, cancelable: true });
    const fingers = [{ clientX: 10, clientY: 10 }, { clientX: 60, clientY: 60 }];
    Object.defineProperty(pinch, 'touches', { value: fingers });
    Object.defineProperty(pinch, 'changedTouches', { value: fingers });
    el('info').dispatchEvent(pinch);
    touch(el('info'), 'touchend');
    wait();
    expect(host.visible).toBe(false);
  }));

  it('opens nothing when another finger touches down during the tap (a pinch that starts elsewhere)', fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart', 10, 10);
    touchWith(el('info'), 'touchmove', [{ clientX: 10, clientY: 10 }, { clientX: 200, clientY: 200 }]);
    touchWith(el('info'), 'touchend', [{ clientX: 200, clientY: 200 }], [{ clientX: 10, clientY: 10 }]);
    wait();
    expect(host.visible).toBe(false);
  }));

  it('opens nothing when another finger is still down as this one lifts', fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart', 10, 10);
    touchWith(el('info'), 'touchend', [{ clientX: 200, clientY: 200 }], [{ clientX: 10, clientY: 10 }]);
    wait();
    expect(host.visible).toBe(false);
  }));

  it('opens nothing when the touch is cancelled', fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('info'), 'touchstart');
    touch(el('info'), 'touchcancel');
    touch(el('info'), 'touchend');
    wait();
    expect(host.visible).toBe(false);
  }));

  it('opens nothing when the tap itself clears the title (a popup opening on the same button)', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('cleared'));
    wait();
    expect(host.clearedEverVisible).toBe(false);
  }));

  it('leaves tooltips with another trigger to ng-zorro', fakeAsync(() => {
    setup(TapTooltipModule);
    touch(el('click'), 'touchstart');
    touch(el('click'), 'touchend');
    wait();
    expect(host.clickVisible).toBe(false);
  }));

  it('waits the hover delay the tooltip sets for itself', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('slow'));
    wait();
    expect(host.slowVisible).toBe(false);
    tick(350);
    fixture.detectChanges();
    expect(host.slowVisible).toBe(true);
  }));

  it('opens nothing once the element is gone, when it goes during the wait', fakeAsync(() => {
    setup(TapTooltipModule);
    const tooltip = fixture.debugElement.query(By.css('#info')).injector.get(NzTooltipDirective);
    const show = jest.spyOn(tooltip, 'show');
    tap(el('info'));
    fixture.destroy();
    tick(200);
    expect(show).not.toHaveBeenCalled();
  }));

  it('leaves an open tooltip open on a second tap on the same element', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('info'));
    wait();
    tap(el('info'));
    wait();
    expect(host.visible).toBe(true);
  }));

  it('ignores the mouse: a click with no touch opens nothing', fakeAsync(() => {
    setup(TapTooltipModule);
    mouse(el('info'), 'mousedown');
    mouse(el('info'), 'mouseup');
    mouse(el('info'), 'click');
    wait();
    expect(host.visible).toBe(false);
  }));

  it('closes on a tap elsewhere', fakeAsync(() => {
    setup(TapTooltipModule);
    tap(el('info'));
    wait();
    expect(host.visible).toBe(true);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    tick(200);
    fixture.detectChanges();
    expect(host.visible).toBe(false);
  }));
});
