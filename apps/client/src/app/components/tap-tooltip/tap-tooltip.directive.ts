import { DestroyRef, Directive, ElementRef, NgZone, inject } from "@angular/core";
import { NzTooltipDirective } from "ng-zorro-antd/tooltip";

/** How far, in px, a finger may move between touching down and lifting off and still count as a tap. */
export const TAP_SLOP_PX = 10;

/** ng-zorro's wait before a hover tooltip opens, in seconds, when the tooltip sets none of its own. */
const DEFAULT_ENTER_DELAY_S = 0.15;

/**
 * Opens a hover tooltip when its element is tapped on a touch screen.
 *
 * Since ng-zorro 22.1.2 (NG-ZORRO/ng-zorro-antd#9881) a hover tooltip ignores the mouse events a phone makes up
 * after a tap, so a tap no longer opens it. This directive opens it on a tap instead: one finger that lifts again
 * without moving more than TAP_SLOP_PX and without the touch being cancelled, so a scroll or a drag that starts
 * on the element opens nothing. It waits the tooltip's own hover delay first, so a title that the tap itself
 * clears (the Roster note button opening its popup) is already empty by then; ng-zorro shows nothing for an
 * empty title and closes the tooltip on a tap anywhere else. The mouse and the keyboard are left to ng-zorro,
 * and so are tooltips with a click, focus or manual trigger.
 *
 * It reaches every nz-tooltip in a module that imports TapTooltipModule, which every module with tooltips does.
 */
@Directive({
  // ng-zorro's own tooltip attribute, so every tooltip gets the tap without a template change
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: "[nz-tooltip]",
  standalone: false
})
export class TapTooltipDirective {
  private readonly tooltip = inject(NzTooltipDirective, { self: true });
  private readonly zone = inject(NgZone);
  private start: { x: number; y: number } | null = null;
  private pending?: ReturnType<typeof setTimeout>;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const listeners: [string, (event: TouchEvent) => void][] = [
      ["touchstart", event => this.onTouchStart(event)],
      ["touchmove", event => this.onTouchMove(event)],
      ["touchcancel", () => this.start = null],
      ["touchend", () => this.onTouchEnd()]
    ];
    // Passive and outside Angular: a touch never waits for these, and a moving finger runs no change detection
    this.zone.runOutsideAngular(() => {
      for (const [type, listener] of listeners) {
        host.addEventListener(type, listener as EventListener, { passive: true });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      for (const [type, listener] of listeners) {
        host.removeEventListener(type, listener as EventListener);
      }
      clearTimeout(this.pending);
    });
  }

  /** One finger down on the element: a tap may follow. A second finger means a pinch, not a tap. */
  private onTouchStart(event: TouchEvent): void {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    this.start = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  /** A finger that travels further than TAP_SLOP_PX is a scroll or a drag. */
  private onTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    if (this.start && touch && Math.hypot(touch.clientX - this.start.x, touch.clientY - this.start.y) > TAP_SLOP_PX) {
      this.start = null;
    }
  }

  /** The finger lifted after a tap: open the tooltip once its hover delay has passed, as a hover would. */
  private onTouchEnd(): void {
    const tapped = this.start !== null;
    this.start = null;
    if (!tapped || this.tooltip.trigger !== "hover") {
      return;
    }
    clearTimeout(this.pending);
    const delayMs = (this.tooltip.mouseEnterDelay || DEFAULT_ENTER_DELAY_S) * 1000;
    this.pending = setTimeout(() => this.zone.run(() => this.tooltip.show()), delayMs);
  }
}
