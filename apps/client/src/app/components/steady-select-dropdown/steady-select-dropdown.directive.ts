import { Directive, DoCheck, inject } from "@angular/core";
import { ConnectionPositionPair } from "@angular/cdk/overlay";
import { POSITION_MAP } from "ng-zorro-antd/core/overlay";
import { NzSelectComponent } from "ng-zorro-antd/select";

/** ng-zorro's gap between a select and its dropdown, in px. */
const GAP = 4;

/** The overlay's own order when a select names no placement: below, above, then above and below against the right edge. */
const DEFAULT_SIDES = [POSITION_MAP.bottomLeft, POSITION_MAP.topLeft, POSITION_MAP.topRight, POSITION_MAP.bottomRight];

/**
 * Keeps a select's dropdown on one side of its field while anything on the page scrolls.
 *
 * ng-zorro (checked in 22.1.1 and 22.2.0) gives the dropdown one 4 px gap whose sign follows the side the
 * dropdown is on now (+4 below, -4 above), and the overlay uses that one gap for both sides when it checks
 * which fits. With between (dropdown height - 4) and (dropdown height + 4) px of room below the field, each
 * check moves the dropdown to the other side, and every scroll on the page runs a check, the dropdown's own
 * list included: the dropdown shows above and below the field in turn. Here each side carries its own gap,
 * which the overlay uses instead of the shared one, so every check picks the same side. The gap on the
 * screen stays 4 px.
 *
 * Usage: `<nz-select lostarkHelperSteadyDropdown ...>`, with SteadySelectDropdownModule imported by the page's module.
 */
@Directive({
  selector: "nz-select[lostarkHelperSteadyDropdown]",
  standalone: false
})
export class SteadySelectDropdownDirective implements DoCheck {
  private readonly select = inject(NzSelectComponent);
  private sides: ConnectionPositionPair[] = [];

  /** Runs before the select draws, and again when the select replaces its sides (its nzPlacement changed). */
  ngDoCheck(): void {
    if (this.select.positions === this.sides) {
      return;
    }
    const named = this.select.positions.length ? this.select.positions : DEFAULT_SIDES;
    this.sides = named.map(side => new ConnectionPositionPair(
      { originX: side.originX, originY: side.originY },
      { overlayX: side.overlayX, overlayY: side.overlayY },
      side.offsetX,
      // The dropdown's top edge against the field: it opens below
      side.overlayY === "top" ? GAP : -GAP
    ));
    this.select.positions = this.sides;
  }
}
